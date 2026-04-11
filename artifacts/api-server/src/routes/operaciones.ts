import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../lib/logger";
import { generarNovedades } from "./nomina";
import { calcularEstadoCiclo } from "../lib/turno-calc";

const operacionesRouter = Router();

// ─── Helper: detectar y registrar impacto salarial ───────────────────────────
// Llámalo DESPUÉS de actualizar puestos_operativos.
// No lanza excepciones — falla silenciosamente para no bloquear la operación.
async function registrarImpactoSalarial(opts: {
  agenteId:       number;
  agenteNombre:   string;
  puestoId:       number;
  puestoNombre:   string;
  clienteNombre:  string;
  salarioPuesto:  number | null;
  salarioActual:  number | null;
  movimientoId?:  number | null;
  usuario?:       string;
  tipoMovimiento: string;
  snapshotPuesto?: Record<string, unknown>;
}): Promise<{ tieneImpacto: boolean; impactoId?: number }> {
  try {
    const { salarioPuesto, salarioActual } = opts;
    // Solo aplica si ambos salarios están definidos y son distintos
    if (!salarioPuesto || !salarioActual) return { tieneImpacto: false };
    const diferencia = salarioPuesto - salarioActual;
    if (Math.abs(diferencia) < 0.01) return { tieneImpacto: false };

    const tipoImpacto = diferencia > 0 ? "aumento" : "disminucion";
    const { rows } = await pool.query(
      `INSERT INTO cambios_salariales
         (employee_id, empleado_nombre, puesto_id, puesto_nombre, cliente_nombre,
          salario_actual, salario_puesto, diferencia, tipo_impacto,
          movimiento_id, operacion_usuario, tipo_movimiento, snapshot_puesto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        opts.agenteId, opts.agenteNombre, opts.puestoId, opts.puestoNombre, opts.clienteNombre,
        salarioActual, salarioPuesto, Math.abs(diferencia), tipoImpacto,
        opts.movimientoId ?? null, opts.usuario ?? null, opts.tipoMovimiento,
        opts.snapshotPuesto ? JSON.stringify(opts.snapshotPuesto) : null
      ]
    );
    logger.info({ impactoId: rows[0].id, tipoImpacto, diferencia }, "Impacto salarial registrado");
    return { tieneImpacto: true, impactoId: rows[0].id };
  } catch (err) {
    logger.warn({ err }, "registrarImpactoSalarial: error no bloqueante");
    return { tieneImpacto: false };
  }
}

// ─── GET /api/operaciones/tablero ─────────────────────────────────────────────
// Devuelve: clientes con sus puestos, agente actual, titular y datos de sede/horario
// ?fecha=YYYY-MM-DD — opcional; si se omite usa CURRENT_DATE.
//   Permite al tablero futuro mostrar clientes que arrancan en esa fecha.
operacionesRouter.get("/operaciones/tablero", async (req, res) => {
  const { fecha } = req.query as { fecha?: string };
  const fechaFiltro = (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) ? fecha : null;

  try {
    const { rows: puestos } = await pool.query(`
      SELECT
        po.id,
        po.cliente_id,
        po.cliente_nombre,
        po.nombre,
        po.turno,
        po.agente_id,
        po.agente_nombre,
        -- TH: titular efectivo para la fecha consultada (histórico con fallback a actual)
        COALESCE(th_tab.hist_titular_id,     po.titular_employee_id) AS titular_employee_id,
        COALESCE(th_tab.hist_titular_nombre, po.titular_nombre)      AS titular_nombre,
        po.horario,
        po.jornada,
        po.sede_id,
        po.estado,
        po.orden,
        po.notas,
        po.updated_at,
        po.zona_operativa_id,
        po.hora_entrada,
        po.hora_salida,
        po.estado_operativo_puesto,
        po.tipo_turno_id,
        po.fecha_inicio_ciclo,
        t.nombre                                                       AS turno_nombre,
        t.horas_trabajo,
        t.horas_descanso,
        (t.horas_trabajo + COALESCE(t.horas_descanso, 0))             AS ciclo_horas,
        COALESCE(t.tipo_ciclo,
          CASE
            WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24
              THEN 'diario'
            ELSE 'alternado'
          END
        )                                                              AS tipo_ciclo,
        e.estado_laboral AS agente_estado_laboral,
        e.puesto         AS agente_puesto,
        e.telefono       AS agente_telefono,
        e.area           AS agente_area,
        e.sede           AS agente_sede,
        cs.nombre        AS sede_nombre,
        oz.nombre        AS zona_nombre,
        cl.fecha_inicio_contrato,
        (cl.fecha_inicio_contrato = COALESCE($1::date, CURRENT_DATE)) AS es_inicio_hoy,
        -- Vacaciones del titular en la fecha consultada (normal o trabajadas)
        titular_vac.tipo_evento                                        AS titular_vac_tipo,
        titular_vac.vac_fecha::date                                    AS titular_vac_inicio,
        titular_vac.vac_fin                                            AS titular_vac_fin,
        -- ARM: arma asignada al puesto (si existe)
        arm.id     AS arma_id,
        arm.codigo AS arma_codigo,
        arm.tipo   AS arma_tipo,
        -- PT: todos los titulares del puesto con sus fechas de ciclo individuales
        COALESCE(pt_tab.titulares_json, '[]'::json)                   AS titulares_json,
        -- TURNO-RT: ¿el agente asignado está actualmente dentro de su ventana de turno?
        -- Prioridad 1: cobertura_segmentos (registro formal de cobertura del día).
        -- Prioridad 2: hora_entrada + horas_trabajo del turno (fallback cuando no hay cobertura formal).
        CASE
          -- Cobertura formal abierta HOY dentro de las horas esperadas
          WHEN po.agente_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM cobertura_segmentos seg
            WHERE seg.puesto_id   = po.id
              AND seg.employee_id = po.agente_id
              AND seg.fecha       = CURRENT_DATE
              AND seg.hora_fin    IS NULL
              AND (
                seg.horas_calculadas IS NULL
                OR seg.horas_calculadas = 0
                -- Turnos de 24h+: trabajan todo el día; el TIME wrappea en PostgreSQL,
                -- así que si el segmento está abierto hoy, siempre están en turno
                OR seg.horas_calculadas >= 24
                OR (seg.hora_inicio::time + (seg.horas_calculadas || ' hours')::interval) > CURRENT_TIME
              )
          ) THEN TRUE
          -- Sin cobertura formal hoy: usar hora_entrada + horas del turno configuradas en el puesto
          WHEN po.agente_id IS NOT NULL
            AND po.hora_entrada IS NOT NULL
            AND t.horas_trabajo IS NOT NULL
            AND po.hora_entrada::time <= CURRENT_TIME
            AND (po.hora_entrada::time + (t.horas_trabajo || ' hours')::interval) > CURRENT_TIME
            AND NOT EXISTS (
              SELECT 1 FROM cobertura_segmentos seg
              WHERE seg.puesto_id = po.id AND seg.fecha = CURRENT_DATE
            )
          THEN TRUE
          ELSE FALSE
        END AS agente_en_turno,
        -- APTO-HE: agente con turno corto (≤12h) que está en su periodo de descanso → disponible para horas extras
        CASE
          WHEN po.agente_id IS NOT NULL
            AND t.horas_trabajo IS NOT NULL
            AND t.horas_trabajo <= 12
            AND NOT (
              -- No está en cobertura formal activa ahora
              EXISTS (
                SELECT 1 FROM cobertura_segmentos seg
                WHERE seg.puesto_id   = po.id
                  AND seg.employee_id = po.agente_id
                  AND seg.fecha       = CURRENT_DATE
                  AND seg.hora_fin    IS NULL
                  AND (
                    seg.horas_calculadas IS NULL
                    OR seg.horas_calculadas = 0
                    OR seg.horas_calculadas >= 24
                    OR (seg.hora_inicio::time + (seg.horas_calculadas || ' hours')::interval) > CURRENT_TIME
                  )
              )
              OR
              -- No está dentro de la ventana de hora_entrada configurada
              (
                po.hora_entrada IS NOT NULL
                AND po.hora_entrada::time <= CURRENT_TIME
                AND (po.hora_entrada::time + (t.horas_trabajo || ' hours')::interval) > CURRENT_TIME
                AND NOT EXISTS (SELECT 1 FROM cobertura_segmentos s2 WHERE s2.puesto_id = po.id AND s2.fecha = CURRENT_DATE)
              )
            )
          THEN TRUE
          ELSE FALSE
        END AS apto_horas_extra
      FROM puestos_operativos po
      -- TH: obtener titular histórico para la fecha consultada
      LEFT JOIN LATERAL (
        SELECT pth.employee_id                                        AS hist_titular_id,
               COALESCE(e2.nombre_completo, po.titular_nombre)       AS hist_titular_nombre
        FROM puesto_titular_historico pth
        LEFT JOIN employees e2 ON e2.id = pth.employee_id
        WHERE pth.puesto_id = po.id
          AND pth.fecha_inicio <= COALESCE($1::date, CURRENT_DATE)
          AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= COALESCE($1::date, CURRENT_DATE))
        ORDER BY pth.fecha_inicio DESC
        LIMIT 1
      ) th_tab ON TRUE
      -- Vacaciones activas del titular en la fecha consultada
      LEFT JOIN LATERAL (
        SELECT er.tipo_evento, er.fecha AS vac_fecha, er.fecha_fin AS vac_fin
        FROM eventos_rrhh er
        WHERE er.employee_id = COALESCE(th_tab.hist_titular_id, po.titular_employee_id)
          AND er.tipo_evento IN ('vacaciones', 'vacaciones_trabajadas')
          AND er.estado NOT IN ('anulado', 'cancelado')
          AND er.fecha::date <= COALESCE($1::date, CURRENT_DATE)
          AND (er.fecha_fin IS NULL OR er.fecha_fin >= COALESCE($1::date, CURRENT_DATE))
        ORDER BY er.created_at DESC
        LIMIT 1
      ) titular_vac ON TRUE
      -- PT: JSON array de titulares — fuente dual:
      --   A) Si el puesto tiene puesto_slots con empleado_id asignado → usarlos (24x24, 24x48, etc.)
      --   B) Si no → usar puesto_titulares con datos del slot para cálculo de ciclo (fallback)
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'employee_id',        src.employee_id,
            'nombre',             COALESCE(e_src.nombre_completo, '—'),
            'orden',              src.orden,
            'fecha_inicio_ciclo', src.pt_fic,
            'slot_dias_trabajo',  src.slot_dias,
            'slot_fecha_inicio',  src.slot_fic
          ) ORDER BY src.orden
        ) AS titulares_json
        FROM (
          -- Opción A: slots con empleado asignado (sistema nuevo, multi-titular)
          SELECT
            ps.empleado_id        AS employee_id,
            ps.slot_numero        AS orden,
            NULL::date            AS pt_fic,
            ps.dias_trabajo       AS slot_dias,
            COALESCE(ps.fecha_inicio_ciclo, po.fecha_inicio_ciclo) AS slot_fic
          FROM puesto_slots ps
          WHERE ps.puesto_id = po.id AND ps.activo = TRUE AND ps.empleado_id IS NOT NULL

          UNION ALL

          -- Opción B: puesto_titulares cuando no hay slots con empleado (sistema legacy)
          SELECT
            pt.employee_id        AS employee_id,
            pt.orden              AS orden,
            pt.fecha_inicio_ciclo AS pt_fic,
            ps2.dias_trabajo      AS slot_dias,
            COALESCE(ps2.fecha_inicio_ciclo, po.fecha_inicio_ciclo) AS slot_fic
          FROM puesto_titulares pt
          LEFT JOIN puesto_slots ps2
            ON  ps2.puesto_id   = po.id
            AND ps2.slot_numero = pt.orden
            AND ps2.activo      = TRUE
          WHERE pt.puesto_id = po.id AND pt.activo = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM puesto_slots ps3
              WHERE ps3.puesto_id = po.id AND ps3.activo = TRUE AND ps3.empleado_id IS NOT NULL
            )
        ) src
        LEFT JOIN employees e_src ON e_src.id = src.employee_id
      ) pt_tab ON TRUE
      LEFT JOIN employees e  ON e.id  = po.agente_id
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      LEFT JOIN clients cl ON cl.id = po.cliente_id
      LEFT JOIN armas arm ON arm.puesto_id = po.id AND arm.activo = TRUE
      WHERE po.activo = TRUE
        AND (cl.fecha_inicio_contrato IS NULL
             OR cl.fecha_inicio_contrato <= COALESCE($1::date, CURRENT_DATE))
      ORDER BY po.cliente_nombre, po.orden, po.nombre
    `, [fechaFiltro]);

    // ── Calcular estado de ciclo por puesto Y por cada titular individual ─────
    const fechaConsultada = fechaFiltro ?? todayGT();

    type PuestoRaw = (typeof puestos)[0];
    type TitularEnriquecido = {
      employee_id: number;
      nombre: string;
      orden: number;
      fecha_inicio_ciclo: string | null;
      slot_dias_trabajo: number[] | null;
      slot_fecha_inicio: string | null;
      trabaja_hoy: boolean;
      descanso_por_ciclo: boolean;
    };

    // Calcula si un titular trabaja en una fecha dada usando su puesto_slot.dias_trabajo.
    // cycleDay = (diasDesdeInicio % 14) + 1  (1..14)
    function calcTrabajaPorSlot(diasTrabajo: number[], fechaInicioStr: string, fechaConsulta: string): boolean {
      const [iy, im, id] = fechaInicioStr.split("-").map(Number);
      const [cy, cm, cd] = fechaConsulta.split("-").map(Number);
      const inicio   = Date.UTC(iy, im - 1, id);
      const consulta = Date.UTC(cy, cm - 1, cd);
      const daysElapsed = Math.floor((consulta - inicio) / 86400000);
      const cycleDay = ((daysElapsed % 14) + 14) % 14 + 1; // 1-based, handles negative offsets
      return diasTrabajo.includes(cycleDay);
    }
    type PuestoFinal = PuestoRaw & {
      titulares: TitularEnriquecido[];
      es_par_24x24: boolean;
      par_trabajando?: TitularEnriquecido;
      par_descansando?: TitularEnriquecido;
    };

    function buildTurnoObj(p: PuestoRaw) {
      if (!p.tipo_turno_id) return null;
      return {
        id: p.tipo_turno_id,
        nombre: p.turno_nombre ?? "",
        horas_trabajo: parseFloat(p.horas_trabajo ?? 0),
        horas_descanso: parseFloat(p.horas_descanso ?? 0),
        tipo_ciclo: p.tipo_ciclo ?? undefined,
      };
    }

    const puestosFinales: PuestoFinal[] = puestos.map((p) => {
      const turnoObj = buildTurnoObj(p);

      // descanso_por_ciclo del puesto (ancla del titular A — para compatibilidad legacy)
      let descanso_por_ciclo = false;
      if (turnoObj && p.fecha_inicio_ciclo) {
        descanso_por_ciclo = calcularEstadoCiclo(
          turnoObj,
          String(p.fecha_inicio_ciclo).slice(0, 10),
          fechaConsultada,
        ).descansoPorCiclo;
      }
      p.descanso_por_ciclo = descanso_por_ciclo;

      // Enriquecer cada titular con su propio estado de ciclo
      const rawTitulares: Array<{
        employee_id: number;
        nombre: string;
        orden: number;
        fecha_inicio_ciclo: string | null;
      }> = Array.isArray(p.titulares_json) ? p.titulares_json : [];

      const titulares: TitularEnriquecido[] = rawTitulares.map((t) => {
        // Prioridad 1: slot.dias_trabajo — fuente de verdad cuando está configurado
        if (
          t.slot_dias_trabajo &&
          Array.isArray(t.slot_dias_trabajo) &&
          t.slot_dias_trabajo.length > 0 &&
          t.slot_fecha_inicio
        ) {
          const trabaja = calcTrabajaPorSlot(
            t.slot_dias_trabajo,
            String(t.slot_fecha_inicio).slice(0, 10),
            fechaConsultada,
          );
          return { ...t, trabaja_hoy: trabaja, descanso_por_ciclo: !trabaja };
        }
        // Fallback: motor de ciclo genérico (12x12, 24x24, etc.)
        let trabaja_hoy = true;
        let desc = false;
        if (turnoObj && t.fecha_inicio_ciclo) {
          const estado = calcularEstadoCiclo(
            turnoObj,
            String(t.fecha_inicio_ciclo).slice(0, 10),
            fechaConsultada,
          );
          desc = estado.descansoPorCiclo;
          trabaja_hoy = !desc;
        }
        return { ...t, trabaja_hoy, descanso_por_ciclo: desc };
      });

      const esPar = titulares.length >= 2;
      const par_trabajando  = esPar ? (titulares.find((t) => t.trabaja_hoy)  ?? titulares[0]) : undefined;
      const par_descansando = esPar ? (titulares.find((t) => !t.trabaja_hoy) ?? titulares[1]) : undefined;

      // ── Puestos single-titular vía puesto_titulares (sin agente_id legacy) ──────
      // Si no hay par 24x24 y el puesto tiene un titular en puesto_titulares
      // pero puestos_operativos.agente_id/titular_employee_id están vacíos,
      // propagamos esos datos desde titulares[] para que el frontend pueda
      // mostrar el nombre, los botones de acción y el estado correcto.
      if (!esPar && titulares.length >= 1 && titulares[0].employee_id) {
        const t0 = titulares[0];
        // titular_employee_id / titular_nombre — siempre que no estén ya seteados
        if (!p.titular_employee_id) {
          (p as any).titular_employee_id = t0.employee_id;
          (p as any).titular_nombre      = t0.nombre;
        }
        // agente_id / agente_nombre / estado — solo si el legado está vacío
        if (!p.agente_id) {
          if (t0.trabaja_hoy) {
            (p as any).agente_id     = t0.employee_id;
            (p as any).agente_nombre = t0.nombre;
            (p as any).estado        = "cubierto";
          } else {
            // Titular en descanso de ciclo: el puesto está descubierto en esta fecha
            (p as any).descanso_por_ciclo = true;
          }
        }
      }

      return { ...p, titulares, es_par_24x24: esPar, par_trabajando, par_descansando };
    });

    // ── Aplicar agente efectivo desde ciclo + overrides de cobertura_segmentos ──
    // Para puestos con ciclo configurado (24x24 etc), el agente mostrado es:
    //   1. El sustituto registrado en cobertura_segmentos para esa fecha (relevo del día)
    //   2. Si no hay relevo ese día → el titular que le toca trabajar según el ciclo
    // Esto asegura que mañana el tablero vuelve automáticamente a la normalidad.
    {
      const { rows: coberturas } = await pool.query(`
        SELECT DISTINCT ON (cs.puesto_id)
          cs.puesto_id,
          cs.employee_id       AS relevo_id,
          cs.empleado_nombre   AS relevo_nombre,
          cs.tipo_cobertura
        FROM cobertura_segmentos cs
        WHERE cs.fecha = $1::date
          AND cs.tipo_cobertura IN ('relevo','cobertura_supervisor','cobertura_jefe_servicio')
        ORDER BY cs.puesto_id, cs.created_at DESC
      `, [fechaConsultada]);

      const coberturaMap = new Map<number, { relevo_id: number; relevo_nombre: string; tipo_cobertura: string }>();
      for (const c of coberturas) coberturaMap.set(Number(c.puesto_id), c);

      for (const p of puestosFinales) {
        const override = coberturaMap.get(Number(p.id));

        if (p.es_par_24x24 && p.par_trabajando) {
          // Puesto 24x24: el agente efectivo viene del ciclo, con posible relevo del día
          if (override) {
            (p as any).agente_id     = override.relevo_id;
            (p as any).agente_nombre = override.relevo_nombre;
            (p as any).es_relevo_dia = true;
            (p as any).estado        = "cubierto"; // forzar cubierto para el frontend
          } else {
            (p as any).agente_id     = p.par_trabajando.employee_id;
            (p as any).agente_nombre = p.par_trabajando.nombre;
            (p as any).es_relevo_dia = false;
            // Si hay titular que trabaja hoy → el puesto está cubierto (incluso si po.estado='descubierto')
            if (p.par_trabajando.employee_id) {
              (p as any).estado = "cubierto";
            }
          }
        } else if (!p.es_par_24x24 && override) {
          // Puesto normal (un agente): si hay relevo registrado ese día, mostrarlo
          // puestos_operativos.agente_id NO se modificó → mañana el titular regresa solo
          (p as any).agente_id     = override.relevo_id;
          (p as any).agente_nombre = override.relevo_nombre;
          (p as any).es_relevo_dia = true;
          (p as any).estado        = "cubierto"; // forzar cubierto para el frontend
        }
        // Si es puesto normal sin override: agente_id ya viene de puestos_operativos (titular)
      }
    }

    // ── Verificar faltas registradas para la fecha consultada ──────────────────
    // Si el titular que trabaja hoy tiene un evento 'falta' en eventos_rrhh,
    // el puesto se muestra como descubierto (a menos que ya haya un relevo cubriendo).
    {
      const { rows: faltasRows } = await pool.query(`
        SELECT employee_id FROM eventos_rrhh
        WHERE tipo_evento = 'falta'
          AND fecha::date = $1::date
          AND estado NOT IN ('anulado', 'cancelado')
        UNION
        SELECT falta_employee_id AS employee_id FROM puestos_operativos
        WHERE estado_operativo_puesto = 'faltando'
          AND falta_employee_id IS NOT NULL
          AND activo = TRUE
      `, [fechaConsultada]);

      const faltaSet = new Set(faltasRows.map((f: any) => Number(f.employee_id)));

      if (faltaSet.size > 0) {
        for (const p of puestosFinales) {
          // 24x24: si par_trabajando tiene falta y no hay relevo cubriendo
          if (p.es_par_24x24 && p.par_trabajando && !(p as any).es_relevo_dia) {
            if (faltaSet.has(Number(p.par_trabajando.employee_id))) {
              (p as any).agente_id        = null;
              (p as any).agente_nombre    = null;
              (p as any).estado           = "descubierto";
              (p as any).titular_faltando = true;
            }
          }
          // No-24x24: si el agente_id actual tiene falta y no es relevo
          if (!p.es_par_24x24 && p.agente_id && !(p as any).es_relevo_dia) {
            if (faltaSet.has(Number(p.agente_id))) {
              (p as any).agente_id        = null;
              (p as any).agente_nombre    = null;
              (p as any).estado           = "descubierto";
              (p as any).titular_faltando = true;
            }
          }
        }
      }
    }

    // Agrupar por cliente
    const mapaClientes: Record<string, {
      clienteId: number | null;
      clienteNombre: string;
      fechaInicioContrato: string | null;
      iniciaHoy: boolean;
      puestos: PuestoFinal[];
    }> = {};

    for (const p of puestosFinales) {
      const key = String(p.cliente_id ?? p.cliente_nombre);
      if (!mapaClientes[key]) {
        mapaClientes[key] = {
          clienteId: p.cliente_id,
          clienteNombre: p.cliente_nombre,
          fechaInicioContrato: p.fecha_inicio_contrato
            ? String(p.fecha_inicio_contrato).slice(0, 10)
            : null,
          iniciaHoy: p.es_inicio_hoy === true,
          puestos: [],
        };
      }
      mapaClientes[key].puestos.push(p);
    }

    res.json(Object.values(mapaClientes));
  } catch (err) {
    logger.error({ err }, "GET /operaciones/tablero error");
    res.status(500).json({ error: "Error al cargar tablero" });
  }
});

// ─── GET /api/operaciones/pool ────────────────────────────────────────────────
// Pool de agentes — clasificación inteligente con motor de turnos
// P-02 (v2): el SQL asigna categorías base (en_puesto, en_ssa, en_descanso,
// suspendido, faltando). Los "disponible" son post-procesados en JS con
// calcularEstadoCiclo para distinguir entre:
//   • trabajando         — su turno indica que laboran hoy
//   • descansandoCiclo   — su turno indica descanso normal (dPC=true)
//   • disponibles        — sin turno asignado, genuinamente libres
operacionesRouter.get("/operaciones/pool", async (req, res) => {
  try {
    const fechaParam = typeof req.query.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)
      ? req.query.fecha : null;
    const hoy = fechaParam ?? todayGT();
    const mañanaDt = new Date(hoy + "T12:00:00Z");
    mañanaDt.setUTCDate(mañanaDt.getUTCDate() + 1);
    const mañana = mañanaDt.toISOString().slice(0, 10);
    // Contexto de puesto: para enriquecer con hints de experiencia previa
    const puestoIdParam = req.query.puesto_id ? Number(req.query.puesto_id) : null;

    const { rows: agentes } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area, e.sede,
        e.telefono, e.wa_autorizado, e.supervisor_id,
        COALESCE(e.tipo_personal, 'guardia') AS tipo_personal,
        COALESCE(e.elegible_pool, TRUE) AS elegible_pool,
        COALESCE(eoa.tipo_asignacion, 'sin_asignacion') AS tipo_asignacion_eoa,
        titular_po.estado_operativo_puesto AS estado_puesto_titular,
        titular_po.nombre                  AS nombre_puesto_titular,
        titular_po.cliente_nombre          AS cliente_puesto_titular,
        COALESCE(eoa.zona_operativa_id, titular_po.zona_operativa_id) AS zona_operativa_id,
        oz.nombre AS zona_nombre,
        COALESCE(t.tipo_ciclo, CASE WHEN t.horas_trabajo <= 24 THEN 'diario' ELSE 'ciclo_bloques' END) AS tipo_ciclo_turno,
        t.horas_trabajo  AS horas_trabajo_turno,
        t.horas_descanso AS horas_descanso_turno,
        t.nombre         AS turno_nombre,
        titular_po.fecha_inicio_ciclo AS fecha_inicio_ciclo_turno,
        titular_po.hora_entrada AS hora_entrada_puesto,
        vac_activa.tipo_evento AS vacacion_activa_tipo,
        vac_activa.fecha::date AS vacacion_inicio,
        vac_activa.fecha_fin   AS vacacion_fin,
        cs_faltando.tiene_relevo IS NOT NULL    AS hay_relevo_hoy_faltando,
        cs_trabajando.trabajando_hoy IS NOT NULL AS cs_trabajando_hoy,
        slot_hoy.trabaja_hoy AS slot_trabaja_hoy,
        ev_falta.tiene_falta IS NOT NULL AS tiene_falta_evento,
        CASE
          WHEN e.estado_laboral = 'licencia'   THEN 'en_descanso'
          WHEN e.estado_laboral = 'suspendido' THEN 'suspendido'
          -- FALTANDO: evento de falta registrado en eventos_rrhh para la fecha consultada
          WHEN e.estado_laboral = 'activo'
               AND ev_falta.tiene_falta IS NOT NULL
               AND (po.agente_id IS NOT NULL OR titular_po.id IS NOT NULL)
               THEN 'faltando'
          -- FALTANDO: falta diferida (pre-cierre) marcada en puestos_operativos
          WHEN e.estado_laboral = 'activo'
               AND titular_po.estado_operativo_puesto = 'faltando'
               AND titular_po.falta_employee_id = e.id
               THEN 'faltando'
          -- FALTANDO: agente titular cuyo puesto tiene un relevo activo hoy
          WHEN e.estado_laboral = 'activo'
               AND cs_faltando.tiene_relevo IS NOT NULL
               AND COALESCE(slot_hoy.trabaja_hoy, TRUE) = TRUE
               AND (po.agente_id IS NOT NULL OR titular_po.id IS NOT NULL)
               THEN 'faltando'
          -- EN_PUESTO: agente titular y el ciclo confirma que HOY trabaja.
          WHEN (po.agente_id IS NOT NULL OR titular_po.id IS NOT NULL)
               AND e.estado_laboral = 'activo'
               AND COALESCE(slot_hoy.trabaja_hoy, TRUE) = TRUE
               THEN 'en_puesto'
          WHEN (ssa.agente_id IS NOT NULL OR ssa_ag.employee_id IS NOT NULL)
               AND e.estado_laboral = 'activo'
               THEN 'en_ssa'
          ELSE 'disponible'
        END AS categoria
      FROM employees e
      LEFT JOIN (
        SELECT DISTINCT agente_id
        FROM puestos_operativos
        WHERE activo = TRUE AND agente_id IS NOT NULL
      ) po ON po.agente_id = e.id
      LEFT JOIN (
        SELECT DISTINCT agente_id
        FROM solicitudes_servicio_adicional
        WHERE agente_id IS NOT NULL
          AND estado_general NOT IN ('cancelada', 'cerrada')
          AND $1::date BETWEEN fecha AND COALESCE(fecha_fin, fecha)
      ) ssa ON ssa.agente_id = e.id
      LEFT JOIN (
        SELECT DISTINCT sa.employee_id
        FROM ssa_agentes sa
        JOIN solicitudes_servicio_adicional s2
          ON s2.id = sa.ssa_id
         AND s2.estado_general NOT IN ('cancelada', 'cerrada')
         AND $1::date BETWEEN s2.fecha AND COALESCE(s2.fecha_fin, s2.fecha)
        WHERE sa.estado IN ('asignado', 'confirmado')
      ) ssa_ag ON ssa_ag.employee_id = e.id
      LEFT JOIN employee_operational_assignments eoa
        ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN LATERAL (
        SELECT po2.id, po2.estado_operativo_puesto, po2.nombre, po2.cliente_nombre,
               po2.agente_id, po2.tipo_turno_id,
               COALESCE(pt2.fecha_inicio_ciclo, po2.fecha_inicio_ciclo) AS fecha_inicio_ciclo,
               po2.zona_operativa_id,
               po2.hora_entrada,
               po2.falta_employee_id
        FROM puesto_titulares pt2
        JOIN puestos_operativos po2 ON po2.id = pt2.puesto_id AND po2.activo = TRUE
        WHERE pt2.employee_id = e.id AND pt2.activo = TRUE
        ORDER BY po2.id
        LIMIT 1
      ) titular_po ON TRUE
      LEFT JOIN turnos t ON t.id = titular_po.tipo_turno_id
      LEFT JOIN operational_zones oz ON oz.id = COALESCE(eoa.zona_operativa_id, titular_po.zona_operativa_id)
      LEFT JOIN LATERAL (
        SELECT er.tipo_evento, er.fecha, er.fecha_fin
        FROM eventos_rrhh er
        WHERE er.employee_id = e.id
          AND er.tipo_evento IN ('vacaciones', 'vacaciones_trabajadas')
          AND er.estado NOT IN ('anulado', 'cancelado')
          AND er.fecha::date <= $1::date
          AND (er.fecha_fin IS NULL OR er.fecha_fin >= $1::date)
        ORDER BY er.created_at DESC
        LIMIT 1
      ) vac_activa ON TRUE
      -- Evento de falta registrado en eventos_rrhh para la fecha consultada
      LEFT JOIN LATERAL (
        SELECT TRUE AS tiene_falta
        FROM eventos_rrhh er_f
        WHERE er_f.employee_id = e.id
          AND er_f.tipo_evento = 'falta'
          AND er_f.fecha::date = $1::date
          AND er_f.estado NOT IN ('anulado', 'cancelado')
        LIMIT 1
      ) ev_falta ON TRUE
      LEFT JOIN LATERAL (
        SELECT TRUE AS tiene_relevo
        FROM cobertura_segmentos cs_f
        WHERE cs_f.fecha = $1::date
          AND cs_f.tipo_cobertura IN ('relevo','cobertura_supervisor','cobertura_jefe_servicio')
          AND cs_f.employee_id IS DISTINCT FROM e.id
          AND (
            cs_f.puesto_id = titular_po.id
            OR EXISTS (
              SELECT 1 FROM puestos_operativos po_x
              WHERE po_x.id = cs_f.puesto_id
                AND po_x.agente_id = e.id
                AND po_x.activo = TRUE
            )
          )
        LIMIT 1
      ) cs_faltando ON TRUE
      LEFT JOIN LATERAL (
        SELECT TRUE AS trabajando_hoy
        FROM cobertura_segmentos cs_t
        WHERE cs_t.employee_id = e.id
          AND cs_t.fecha = $1::date
          AND cs_t.tipo_cobertura IN ('relevo','cobertura_supervisor','cobertura_jefe_servicio','titular')
        LIMIT 1
      ) cs_trabajando ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          ((($1::date - ps.fecha_inicio_ciclo::date) % 14 + 14) % 14 + 1) = ANY(ps.dias_trabajo)
          AS trabaja_hoy
        FROM puesto_slots ps
        WHERE ps.empleado_id = e.id AND ps.activo = TRUE
        LIMIT 1
      ) slot_hoy ON TRUE
      WHERE e.estado_laboral IN ('activo', 'suspendido', 'licencia')
        AND COALESCE(e.tipo_personal, 'guardia') IN ('guardia', 'custodio')
        AND (
          COALESCE(e.elegible_pool, TRUE) = TRUE
          OR (
            (titular_po.id IS NOT NULL OR po.agente_id IS NOT NULL)
            AND e.estado_laboral = 'activo'
            AND (
              ev_falta.tiene_falta IS NOT NULL
              OR (
                cs_faltando.tiene_relevo IS NOT NULL
                AND COALESCE(slot_hoy.trabaja_hoy, TRUE) = TRUE
              )
            )
          )
          OR ssa.agente_id IS NOT NULL
          OR ssa_ag.employee_id IS NOT NULL
        )
      ORDER BY e.estado_laboral, e.nombre_completo
    `, [hoy]);

    // Supervisores — personal operativo con turno real (12h o 24x24)
    // La zona se resuelve primero por la FK formal (operational_zones.supervisor_employee_id),
    // luego por la asignación operativa del empleado
    const { rows: supervisoresRows } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area, e.sede,
        e.telefono, e.wa_autorizado,
        COALESCE(oz_formal.id, eoa.zona_operativa_id)          AS zona_operativa_id,
        COALESCE(oz_formal.nombre, oz_eoa.nombre)              AS zona_nombre,
        t.id                                                   AS tipo_turno_id,
        t.nombre                                               AS turno_nombre,
        t.tipo_ciclo                                           AS tipo_ciclo_turno,
        t.horas_trabajo                                        AS horas_trabajo_turno,
        t.horas_descanso                                       AS horas_descanso_turno,
        eoa.fecha_inicio                                       AS fecha_inicio_ciclo_turno,
        CASE
          WHEN e.estado_laboral = 'licencia'   THEN 'licencia'
          WHEN e.estado_laboral = 'suspendido' THEN 'suspendido'
          ELSE 'activo'
        END AS estado_display,
        veh_zona.vehiculos_zona
      FROM employees e
      LEFT JOIN employee_operational_assignments eoa ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN operational_zones oz_eoa   ON oz_eoa.id  = eoa.zona_operativa_id
      LEFT JOIN operational_zones oz_formal ON oz_formal.supervisor_employee_id = e.id
      LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id',     v.id,
          'placa',  v.placa,
          'tipo',   v.tipo,
          'marca',  v.marca,
          'color',  v.color,
          'estado', v.estado
        ) ORDER BY v.id) AS vehiculos_zona
        FROM vehiculos v
        WHERE v.zona_operativa_id = COALESCE(oz_formal.id, eoa.zona_operativa_id)
          AND v.activo = TRUE
      ) veh_zona ON TRUE
      WHERE COALESCE(e.tipo_personal, 'guardia') = 'supervisor'
        AND e.estado_laboral IN ('activo', 'licencia', 'suspendido')
      ORDER BY COALESCE(oz_formal.id, eoa.zona_operativa_id) NULLS LAST, e.nombre_completo
    `);

    // ── Aplicar motor de ciclos a supervisores ────────────────────────────────
    const supervisoresEnriquecidos = supervisoresRows.map((sv: any) => {
      if (sv.estado_display !== 'activo') {
        return { ...sv, trabaja_hoy: false, trabaja_mañana: false, estado_ciclo: sv.estado_display, puede_cubrir: false, disponible_he: false };
      }
      if (sv.tipo_ciclo_turno && sv.horas_trabajo_turno && sv.fecha_inicio_ciclo_turno) {
        const turnoObj = {
          id: sv.tipo_turno_id ?? 0,
          nombre: sv.turno_nombre ?? "",
          tipo_ciclo: sv.tipo_ciclo_turno,
          horas_trabajo:  Number(sv.horas_trabajo_turno),
          horas_descanso: Number(sv.horas_descanso_turno ?? 0),
        };
        const fechaInicioStr = sv.fecha_inicio_ciclo_turno instanceof Date
          ? sv.fecha_inicio_ciclo_turno.toISOString().slice(0, 10)
          : String(sv.fecha_inicio_ciclo_turno).slice(0, 10);

        const estadoHoy    = calcularEstadoCiclo(turnoObj, fechaInicioStr, hoy);
        const estadoMañana = calcularEstadoCiclo(turnoObj, fechaInicioStr, mañana);

        // Un supervisor puede cubrir si: trabaja hoy (turno activo) o descansa pero disponibleHE
        const puedeHoy = estadoHoy.trabaja || (estadoHoy.disponibleHE === true);

        return {
          ...sv,
          trabaja_hoy:    estadoHoy.trabaja,
          trabaja_mañana: estadoMañana.trabaja,
          disponible_he:  !estadoHoy.trabaja && (estadoHoy.disponibleHE === true),
          estado_ciclo:   estadoHoy.trabaja ? "trabajando"
            : (estadoHoy.disponibleHE ? "disponible_he" : "descansando_ciclo"),
          puede_cubrir:   puedeHoy,
        };
      }
      // Sin turno → disponible por defecto
      return { ...sv, trabaja_hoy: null, trabaja_mañana: null, estado_ciclo: "sin_turno", puede_cubrir: true, disponible_he: false };
    });

    // Jefes de servicio — personal operativo con turno real 24x24, procesados por el motor de ciclos
    const { rows: jefesServicioRows } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area,
        e.telefono, e.wa_autorizado,
        eoa.zona_operativa_id,
        oz.nombre                                              AS zona_nombre,
        t.id                                                   AS tipo_turno_id,
        t.nombre                                               AS turno_nombre,
        t.tipo_ciclo                                           AS tipo_ciclo_turno,
        t.horas_trabajo                                        AS horas_trabajo_turno,
        t.horas_descanso                                       AS horas_descanso_turno,
        eoa.fecha_inicio                                       AS fecha_inicio_ciclo_turno,
        CASE
          WHEN e.estado_laboral = 'licencia'   THEN 'licencia'
          WHEN e.estado_laboral = 'suspendido' THEN 'suspendido'
          ELSE 'activo'
        END AS estado_display
      FROM employees e
      LEFT JOIN employee_operational_assignments eoa ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN operational_zones oz ON oz.id = eoa.zona_operativa_id
      LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
      WHERE COALESCE(e.tipo_personal, 'guardia') = 'jefe_servicio'
        AND e.estado_laboral IN ('activo', 'licencia', 'suspendido')
      ORDER BY oz.id NULLS LAST, e.nombre_completo
    `);

    // ── Aplicar motor de ciclos a jefes de servicio ──────────────────────────
    // Calculamos estado HOY y MAÑANA para el panel "Jefe de Servicio del Día"

    const jefesServicioEnriquecidos = jefesServicioRows.map((js: any) => {
      if (js.estado_display !== 'activo') {
        return { ...js, trabaja_hoy: false, trabaja_mañana: false, estado_ciclo: js.estado_display };
      }
      if (js.tipo_ciclo_turno && js.horas_trabajo_turno && js.fecha_inicio_ciclo_turno) {
        const turnoObj = {
          id: js.tipo_turno_id ?? 0,
          nombre: js.turno_nombre ?? "",
          tipo_ciclo: js.tipo_ciclo_turno,
          horas_trabajo:  Number(js.horas_trabajo_turno),
          horas_descanso: Number(js.horas_descanso_turno ?? js.horas_trabajo_turno),
        };
        const fechaInicioStr = js.fecha_inicio_ciclo_turno instanceof Date
          ? js.fecha_inicio_ciclo_turno.toISOString().slice(0, 10)
          : String(js.fecha_inicio_ciclo_turno).slice(0, 10);

        const estadoHoy     = calcularEstadoCiclo(turnoObj, fechaInicioStr, hoy);
        const estadoMañana  = calcularEstadoCiclo(turnoObj, fechaInicioStr, mañana);
        return {
          ...js,
          trabaja_hoy:     estadoHoy.trabaja,
          trabaja_mañana:  estadoMañana.trabaja,
          estado_ciclo:    estadoHoy.trabaja ? "trabajando" : "descansando_ciclo",
        };
      }
      // Sin datos de ciclo → disponible pero sin estado de turno conocido
      return { ...js, trabaja_hoy: null, trabaja_mañana: null, estado_ciclo: "sin_turno" };
    });

    // ── Post-proceso: reclasificar "disponible" con el motor de turnos ────────
    // Un agente laboral-activo sin asignación especial puede estar:
    //   a) Trabajando hoy (su turno dice que trabaja)
    //   b) Descansando por ciclo (su turno dice que descansa)
    //   c) Genuinamente disponible (no tiene puesto titular o turno sin ciclo)
    const trabajando:       any[] = [];
    const descansandoCiclo: any[] = [];
    const disponibles:      any[] = [];
    const enPuesto:         any[] = [];
    const enSSA:            any[] = [];
    const enDescanso:       any[] = [];
    const suspendidos:      any[] = [];
    const faltando:         any[] = [];
    const enVacaciones:     any[] = [];

    // Helper: ¿el agente está DENTRO de su ventana laboral ahora mismo?
    // Para turnos diarios cortos (≤12h) con hora_entrada configurada.
    // Maneja cruce de medianoche (ej. turno 19:00-07:00).
    const estaEnVentanaLaboral = (horaEntradaStr: string, horasTrabajo: number): boolean => {
      const [hh, mm] = horaEntradaStr.split(":").map(Number);
      if (isNaN(hh) || isNaN(mm)) return true; // sin dato → asumir trabajando
      const nowGT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
      const ahora = nowGT.getHours() * 60 + nowGT.getMinutes();
      const inicio = hh * 60 + mm;
      const fin    = inicio + horasTrabajo * 60;
      return fin > 1440
        ? (ahora >= inicio || ahora < fin - 1440)   // turno cruza medianoche
        : (ahora >= inicio && ahora < fin);
    };

    for (const a of agentes) {
      // Vacaciones activas tienen prioridad sobre la categoría de ciclo
      if (a.vacacion_activa_tipo) {
        if (a.vacacion_activa_tipo === 'vacaciones_trabajadas') {
          // Vacaciones trabajadas: el empleado SÍ trabaja, pero se señala con badge especial.
          // Se deja pasar al motor de turnos y queda en 'trabajando' con flag vacacion_trabajada=true.
          a.vacacion_trabajada = true;
          // No hacemos continue: cae al switch normal → motor de turnos → trabajando/descansandoCiclo
        } else {
          // Vacaciones normales: el empleado está ausente.
          enVacaciones.push(a);
          continue;
        }
      }
      switch (a.categoria) {
        case 'en_puesto': {
          // Para turnos cortos diarios (≤12h): si el agente está fuera de su ventana laboral,
          // va a descansandoCiclo (disponible para HE) en lugar de enPuesto
          if (Number(a.horas_trabajo_turno) <= 12 && a.hora_entrada_puesto) {
            const enVentana = estaEnVentanaLaboral(String(a.hora_entrada_puesto), Number(a.horas_trabajo_turno));
            if (!enVentana) {
              descansandoCiclo.push({ ...a, disponibleHE: true });
              break;
            }
          }
          enPuesto.push(a);
          break;
        }
        case 'en_ssa':      enSSA.push(a);        break;
        case 'en_descanso': enDescanso.push(a);   break;
        case 'suspendido':  suspendidos.push(a);  break;
        case 'faltando':    faltando.push(a);     break;
        default: {
          // ── Fallback por slot cuando tipo_ciclo_turno está vacío ─────────
          // Agentes 24x24 cuyo turno no tiene tipo_ciclo configurado en DB pero sí tienen
          // puesto_slots correctos. slot_trabaja_hoy=true|false|null (null=sin slot).
          if (a.slot_trabaja_hoy !== null && a.slot_trabaja_hoy !== undefined && !a.tipo_ciclo_turno) {
            if (a.slot_trabaja_hoy === false) {
              descansandoCiclo.push({ ...a, disponibleHE: true });
            } else {
              // slot dice que trabaja hoy pero cayó aquí (ej. sin po.agente_id ni titular_po)
              trabajando.push({ ...a, disponibleHE: false });
            }
            break;
          }
          // ── Aplicar motor de turnos si el agente tiene datos de ciclo ──────
          if (a.tipo_ciclo_turno && a.horas_trabajo_turno && a.fecha_inicio_ciclo_turno) {
            const turnoObj = {
              id: 0,
              nombre: a.turno_nombre ?? "",
              tipo_ciclo: a.tipo_ciclo_turno,
              horas_trabajo: Number(a.horas_trabajo_turno),
              horas_descanso: Number(a.horas_descanso_turno),
            };
            const fechaInicioStr = a.fecha_inicio_ciclo_turno instanceof Date
              ? a.fecha_inicio_ciclo_turno.toISOString().slice(0, 10)
              : String(a.fecha_inicio_ciclo_turno).slice(0, 10);

            const estado = calcularEstadoCiclo(turnoObj, fechaInicioStr, hoy);

            // ── Refinamiento intra-día para turnos diarios cortos (≤12h) ─────
            // calcularEstadoCiclo opera a nivel de día: para un 12x12 siempre dice "trabaja"
            // porque el ciclo cabe dentro de un día. Aquí verificamos la hora actual:
            // si el agente está fuera de su ventana laboral → descanso, disponible para HE.
            if (estado.trabaja && Number(a.horas_trabajo_turno) <= 12 && a.hora_entrada_puesto) {
              if (!estaEnVentanaLaboral(String(a.hora_entrada_puesto), Number(a.horas_trabajo_turno))) {
                descansandoCiclo.push({ ...a, disponibleHE: true });
                break;
              }
            }

            if (estado.trabaja) {
              trabajando.push({ ...a, disponibleHE: false });
            } else {
              descansandoCiclo.push({ ...a, disponibleHE: estado.disponibleHE ?? true });
            }
          } else {
            // Sin turno de ciclo → genuinamente disponible
            disponibles.push(a);
          }
        }
      }
    }

    // ── Enriquecer con hints de experiencia si se proveyó puesto_id ──────────
    if (puestoIdParam) {
      // Obtener cliente y zona del puesto contexto
      const { rows: pCtx } = await pool.query(
        `SELECT cliente_id, zona_operativa_id FROM puestos_operativos WHERE id = $1`,
        [puestoIdParam]
      );
      const ctxClienteId   = pCtx[0]?.cliente_id   ?? null;
      const ctxZonaId      = pCtx[0]?.zona_operativa_id ?? null;

      // Agentes que ya cubrieron este puesto específico (historial titular)
      const { rows: rvPuesto } = await pool.query(
        `SELECT DISTINCT employee_id FROM puesto_titular_historico WHERE puesto_id = $1`,
        [puestoIdParam]
      );
      const conocenPuestoSet = new Set(rvPuesto.map((r: any) => Number(r.employee_id)));

      // Agentes que conocen el cliente (EOA actual o historial titular de cualquier puesto de ese cliente)
      let conocenClienteSet = new Set<number>();
      if (ctxClienteId) {
        const { rows: rvCliente } = await pool.query(
          `SELECT DISTINCT eoa.employee_id
           FROM employee_operational_assignments eoa
           WHERE eoa.cliente_id = $1
           UNION
           SELECT DISTINCT pth.employee_id
           FROM puesto_titular_historico pth
           JOIN puestos_operativos po ON po.id = pth.puesto_id
           WHERE po.cliente_id = $1`,
          [ctxClienteId]
        );
        conocenClienteSet = new Set(rvCliente.map((r: any) => Number(r.employee_id)));
      }

      // Agentes con puesto titular en la misma zona (refuerza la señal de zona)
      let zonaExpSet = new Set<number>();
      if (ctxZonaId) {
        const { rows: rvZona } = await pool.query(
          `SELECT DISTINCT titular_employee_id AS employee_id
           FROM puestos_operativos
           WHERE zona_operativa_id = $1 AND activo = TRUE AND titular_employee_id IS NOT NULL`,
          [ctxZonaId]
        );
        zonaExpSet = new Set(rvZona.map((r: any) => Number(r.employee_id)));
      }

      // Anotar todos los grupos con los hints
      const annotate = (arr: any[]) =>
        arr.map((a: any) => ({
          ...a,
          conoce_puesto:  conocenPuestoSet.has(Number(a.id)),
          conoce_cliente: conocenClienteSet.has(Number(a.id)),
          misma_zona_exp: zonaExpSet.has(Number(a.id)),
        }));

      trabajando.splice(0, trabajando.length, ...annotate(trabajando));
      descansandoCiclo.splice(0, descansandoCiclo.length, ...annotate(descansandoCiclo));
      disponibles.splice(0, disponibles.length, ...annotate(disponibles));
      faltando.splice(0, faltando.length, ...annotate(faltando));
      enSSA.splice(0, enSSA.length, ...annotate(enSSA));
      enPuesto.splice(0, enPuesto.length, ...annotate(enPuesto));
    }

    // ── Inyectar supervisores/jefes disponibles como contingencia en el pool ─────
    // Solo los que pueden cubrir pero NO están en turno activo:
    //   - supervisores con disponible_he=true → van a descansandoCiclo (disponibles para HE)
    //   - jefes_servicio que no trabajan hoy y están activos → igual
    // Así rankCandidatos los ve y les asigna grupo P5 (contingencia).
    for (const sv of supervisoresEnriquecidos) {
      if (sv.estado_laboral !== 'activo') continue;
      if (sv.disponible_he) {
        descansandoCiclo.push({ ...sv, tipo_personal: 'supervisor', disponibleHE: true });
      }
    }
    for (const js of jefesServicioEnriquecidos) {
      if (js.estado_laboral !== 'activo') continue;
      if (!js.trabaja_hoy) {
        descansandoCiclo.push({ ...js, tipo_personal: 'jefe_servicio', disponibleHE: true });
      }
    }

    // ── Separar "Haciendo horas extra" de descansandoCiclo ───────────────────────
    // Un agente de descanso que tiene una cobertura activa hoy (relevo en su día libre)
    // se mueve a haciendoHE para mostrarlo separado en el pool y no confundir el conteo
    // de agentes genuinamente disponibles para cubrir.
    const haciendoHE: any[] = [];
    {
      const quedanDescansando: any[] = [];
      for (const a of descansandoCiclo) {
        // cs_trabajando_hoy solo existe en agentes del query principal (no supervisores inyectados)
        if (a.cs_trabajando_hoy === true) {
          haciendoHE.push({ ...a, disponibleHE: false, haciendo_he: true });
        } else {
          quedanDescansando.push(a);
        }
      }
      descansandoCiclo.splice(0, descansandoCiclo.length, ...quedanDescansando);
    }

    res.json({
      trabajando,
      descansandoCiclo,
      haciendoHE,
      disponibles,
      enPuesto,
      enSSA,
      enDescanso,
      suspendidos,
      faltando,
      enVacaciones,
      supervisores: supervisoresEnriquecidos,
      jefes_servicio: jefesServicioEnriquecidos,
      fecha_hoy: hoy,
      fecha_mañana: mañana,
      total: agentes.length,
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/pool error");
    res.status(500).json({ error: "Error al cargar pool" });
  }
});

// ─── POST /api/operaciones/asignar ───────────────────────────────────────────
// Asignar agente a puesto (sin agente previo)
operacionesRouter.post("/operaciones/asignar", async (req, res) => {
  // soloCobertura=true → relevo temporal de un día, NO cambia titular ni EOA, NO toca agente_id
  // soloCobertura=false (default) → asigna como titular si el puesto no tiene uno
  // oldTitularAccion → qué hacer con el EOA del titular previo
  // fechaEfectiva   → "YYYY-MM-DD" o null (usa hoy si null)
  // motivoCambio    → texto libre del motivo del cambio de titular
  // fechaOperacion  → "YYYY-MM-DD" de la fecha a cubrir (si es distinta a hoy, modo retroactivo)
  const { puestoId, agenteId, usuario, notas, forzar,
          soloCobertura = false,
          oldTitularAccion,
          fechaEfectiva,
          motivoCambio,
          horaInstalacion,
          fechaOperacion } = req.body;
  const hoyGT = todayGT();
  const fechaCobertura = fechaOperacion ?? hoyGT;
  const esRetroactivo = fechaCobertura < hoyGT;
  if (!puestoId || !agenteId) return res.status(400).json({ error: "puestoId y agenteId son requeridos" });

  try {
    if (await verificarDiaCerrado()) {
      return res.status(423).json({ error: "Día operativo cerrado. Reabre el día para continuar.", diaCerrado: true });
    }
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    const { rows: agenteRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [agenteId]);
    if (!agenteRows.length) return res.status(404).json({ error: "Agente no encontrado" });
    const agente = agenteRows[0];

    // Verificar que no esté ya asignado a otro puesto (se puede forzar)
    if (!forzar) {
      const { rows: yaAsignadoRows } = await pool.query(
        `SELECT po.nombre, po.cliente_nombre FROM puestos_operativos po
         WHERE po.agente_id=$1 AND po.activo=TRUE AND po.id!=$2`,
        [agenteId, puestoId]
      );
      if (yaAsignadoRows.length > 0) {
        return res.status(409).json({
          error: `${agente.nombre_completo} ya está asignado en ${yaAsignadoRows[0].cliente_nombre} — ${yaAsignadoRows[0].nombre}`,
          advertencia: true,
        });
      }

      // Verificar que no esté cubriendo un SSA vigente HOY
      const { rows: yaEnSSA } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre, s.tipo_solicitud, s.fecha
         FROM solicitudes_servicio_adicional s
         LEFT JOIN clients c ON c.id = s.cliente_id
         WHERE s.agente_id = $1
           AND s.estado_general NOT IN ('cancelada', 'cerrada')
           AND CURRENT_DATE BETWEEN s.fecha AND COALESCE(s.fecha_fin, s.fecha)`,
        [agenteId]
      );
      if (yaEnSSA.length > 0) {
        const ssa = yaEnSSA[0];
        return res.status(409).json({
          error: `${agente.nombre_completo} ya cubre un Servicio Especial (${ssa.cliente_nombre ?? "—"} · ${ssa.id})`,
          advertencia: true,
          ssaId: ssa.id,
        });
      }
    }

    const sinTitular = !puesto.titular_employee_id;
    const titularPrevioId: number | null = puesto.titular_employee_id ?? null;

    if (soloCobertura) {
      // ── Solo cobertura temporal (relevo): NO toca agente_id ni titular en puestos_operativos.
      // El agente cubre SOLO la fecha indicada (fechaCobertura).
      // El tablero lee el relevo desde cobertura_segmentos; al día siguiente el puesto vuelve
      // automáticamente a su estado normal (vacante o con titular) sin intervención manual.
      //
      // No se hace ningún UPDATE a puestos_operativos aquí.
      // (La cobertura queda registrada en el bloque A-04 de abajo)
    } else {
      // ── Asignación normal (puede convertir en titular) ─────────────────────

      // Fix E2E-02: Exclusividad de titular.
      // Si el puesto no tiene titular, este agente se convertirá en titular.
      // Antes de hacerlo, verificar que no sea ya titular en otro puesto activo.
      if (!forzar && !puesto.titular_employee_id) {
        const { rows: yaTitularRows } = await pool.query(
          `SELECT po.nombre, po.cliente_nombre FROM puestos_operativos po
           WHERE po.titular_employee_id = $1 AND po.activo = TRUE AND po.id != $2`,
          [agenteId, puestoId]
        );
        if (yaTitularRows.length > 0) {
          return res.status(409).json({
            error: `${agente.nombre_completo} ya es titular en "${yaTitularRows[0].nombre}" (${yaTitularRows[0].cliente_nombre}). Resuelva esa titularidad antes de asignar una nueva.`,
            advertencia: true,
            titularEnPuesto: yaTitularRows[0].nombre,
            titularEnCliente: yaTitularRows[0].cliente_nombre,
          });
        }
      }

      await pool.query(
        `UPDATE puestos_operativos
         SET agente_id      = $1,
             agente_nombre  = $2,
             estado         = 'cubierto',
             titular_employee_id = COALESCE(titular_employee_id, $1),
             titular_nombre      = COALESCE(titular_nombre, $2),
             updated_at     = NOW()
         WHERE id = $3`,
        [agenteId, agente.nombre_completo, puestoId]
      );

      // ── Registro en historial de titularidad (TH) ────────────────────────
      const fechaEfectivaDate = fechaEfectiva
        ? fechaEfectiva  // "YYYY-MM-DD" string → PostgreSQL lo parsea como DATE
        : todayGT();

      // Cerrar registro activo del titular anterior (si lo había)
      if (titularPrevioId) {
        await pool.query(
          `UPDATE puesto_titular_historico
           SET fecha_fin = $1, updated_at = NOW()
           WHERE puesto_id = $2 AND fecha_fin IS NULL`,
          [fechaEfectivaDate, puestoId]
        );
      }
      // Abrir registro para el nuevo titular
      await pool.query(
        `INSERT INTO puesto_titular_historico
           (puesto_id, employee_id, fecha_inicio, motivo, creado_por)
         VALUES ($1, $2, $3, $4, $5)`,
        [puestoId, agenteId, fechaEfectivaDate, motivoCambio || null, usuario || 'sistema']
      );

      // ── Actualizar EOA del agente entrante ────────────────────────────────
      await pool.query(
        `UPDATE employee_operational_assignments
         SET activa = FALSE, updated_at = NOW()
         WHERE employee_id = $1 AND activa = TRUE`,
        [agenteId]
      );
      await pool.query(
        `INSERT INTO employee_operational_assignments
           (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
            tipo_asignacion, activa, fecha_inicio, notas, created_at, updated_at)
         SELECT $1, $2, po.sede_id, po.cliente_id, po.zona_operativa_id, po.tipo_turno_id,
                'titular', TRUE, NOW(), 'Asignado desde pizarrón operativo', NOW(), NOW()
         FROM puestos_operativos po WHERE po.id = $2`,
        [agenteId, puestoId]
      );

      // ── Mover titular previo a nueva categoría EOA (si se indicó acción) ─
      if (titularPrevioId && titularPrevioId !== agenteId && oldTitularAccion) {
        const nuevoTipo = oldTitularAccion === 'disponible'   ? 'disponible'
                        : oldTitularAccion === 'pool_relevo'  ? 'pool_relevo'
                        : 'sin_asignacion';
        await pool.query(
          `UPDATE employee_operational_assignments
           SET activa = FALSE, updated_at = NOW()
           WHERE employee_id = $1 AND activa = TRUE`,
          [titularPrevioId]
        );
        await pool.query(
          `INSERT INTO employee_operational_assignments
             (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
              tipo_asignacion, activa, fecha_inicio, notas, created_at, updated_at)
           VALUES ($1, NULL, NULL, NULL, NULL, NULL, $2, TRUE, NOW(),
                   'Movido al cambiar titular en pizarrón', NOW(), NOW())`,
          [titularPrevioId, nuevoTipo]
        );
      }
    }

    // Registrar movimiento
    await pool.query(
      `INSERT INTO movimientos_operativos
         (puesto_id, cliente_nombre, puesto_nombre, agente_entrante_id, agente_entrante_nombre, tipo, usuario_cambio, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [puestoId, puesto.cliente_nombre, puesto.nombre, agenteId, agente.nombre_completo,
       soloCobertura ? 'relevo' : 'asignacion', usuario || 'sistema', notas || null]
    );

    // A-04: Auto-crear / actualizar segmento de cobertura para fechaCobertura (hoy o fecha retroactiva)
    try {
      const hoy = fechaCobertura;  // puede ser hoy o una fecha retroactiva
      const turno = (puesto.turno ?? "día").toLowerCase();
      const horaFinTurno = turno === "noche" ? "06:00" : "18:00";
      const horaInicioDefault = turno === "noche" ? "20:00" : "08:00";

      // Usar hora real de instalación si se proporcionó, si no la del turno
      const horaInicioFinal = horaInstalacion || horaInicioDefault;

      // Calcular horas trabajadas (maneja cruce de medianoche)
      function calcHoras(inicio: string, fin: string): number {
        const [h1, m1] = inicio.split(":").map(Number);
        const [h2, m2] = fin.split(":").map(Number);
        let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (mins < 0) mins += 24 * 60;
        return Math.round(mins / 6) / 10;
      }
      const horasCalcFinal  = calcHoras(horaInicioFinal, horaFinTurno);
      const horasStandard   = 10;
      const generaExtra     = horasCalcFinal > horasStandard;
      const horasExtraCalc  = generaExtra ? Math.round((horasCalcFinal - horasStandard) * 10) / 10 : 0;
      // Marcar cobertura especial cuando es supervisor o jefe de servicio — trazabilidad
      const tipoPersonalAgente = agente.tipo_personal ?? 'guardia';
      const tipoSegmento = tipoPersonalAgente === 'supervisor'
        ? 'cobertura_supervisor'
        : tipoPersonalAgente === 'jefe_servicio'
          ? 'cobertura_jefe_servicio'
          : soloCobertura ? 'relevo' : 'titular';
      const obsSegmento = [
        tipoPersonalAgente === 'supervisor'   ? '⚠ Cobertura por Supervisor de Zona' : null,
        tipoPersonalAgente === 'jefe_servicio' ? '⚠ Cobertura por Jefe de Servicio' : null,
        horaInstalacion ? `Instalación real: ${horaInstalacion}` : null,
      ].filter(Boolean).join(' | ') || null;

      // Intentar insertar; si ya existe (mismo empleado+puesto+fecha), actualizar
      const ins = await pool.query(
        `INSERT INTO cobertura_segmentos
           (fecha, puesto_id, client_id, employee_id, empleado_nombre,
            tipo_cobertura, hora_inicio, hora_fin, horas_calculadas,
            fue_en_dia_descanso, genera_horas_extra, observaciones, usuario_registro)
         SELECT $1,$2,$3,$4,$5,$9,$6,$7,$8,FALSE,$10,$11,'asignacion_pizarron'
         WHERE NOT EXISTS (
           SELECT 1 FROM cobertura_segmentos
           WHERE fecha=$1 AND puesto_id=$2 AND employee_id=$4
         )`,
        [hoy, puestoId, puesto.cliente_id ?? null, agenteId,
         agente.nombre_completo, horaInicioFinal, horaFinTurno, horasCalcFinal,
         tipoSegmento, generaExtra, obsSegmento]
      );

      // Si el registro ya existía y se indicó hora real, actualizar horas
      if (horaInstalacion && ins.rowCount === 0) {
        await pool.query(
          `UPDATE cobertura_segmentos
           SET hora_inicio = $1, horas_calculadas = $2, genera_horas_extra = $3,
               observaciones = $4, updated_at = NOW()
           WHERE fecha = $5 AND puesto_id = $6 AND employee_id = $7`,
          [horaInstalacion, horasCalcFinal, generaExtra, obsSegmento, hoy, puestoId, agenteId]
        );
      }

      // Registrar novedad de nómina para el colaborador que cubre
      try {
        await pool.query(
          `INSERT INTO novedades_nomina_diarias
             (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
              puesto_cubierto_id, puesto_cubierto_nombre, num_puestos_cubiertos, fuente)
           VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, 1, 'asignacion_pizarron')
           ON CONFLICT (fecha, employee_id) DO UPDATE SET
             trabajo_dia           = TRUE,
             falta                 = FALSE,
             descuento_dia         = FALSE,
             horas_trabajadas      = GREATEST(novedades_nomina_diarias.horas_trabajadas, $4),
             horas_extra           = GREATEST(novedades_nomina_diarias.horas_extra, $5),
             num_puestos_cubiertos = novedades_nomina_diarias.num_puestos_cubiertos + 1,
             updated_at            = NOW()`,
          [hoy, agenteId, agente.nombre_completo, horasCalcFinal, horasExtraCalc, puestoId, puesto.nombre]
        );
      } catch (nomErr) {
        logger.warn({ nomErr }, "A-04: no se pudo actualizar novedad nómina (no bloqueante)");
      }

      logger.info({ puestoId, agenteId, hoy, horaInstalacion, horasCalcFinal, generaExtra }, "A-04: segmento registrado en asignación");
    } catch (segErr) {
      logger.warn({ segErr }, "A-04: no se pudo crear segmento al asignar (no bloqueante)");
    }

    // SAL-01: Detectar impacto salarial (no bloqueante)
    const impacto = await registrarImpactoSalarial({
      agenteId:      agenteId,
      agenteNombre:  agente.nombre_completo,
      puestoId:      puestoId,
      puestoNombre:  puesto.nombre,
      clienteNombre: puesto.cliente_nombre ?? "",
      salarioPuesto: puesto.salario_puesto  ? Number(puesto.salario_puesto)  : null,
      salarioActual: agente.sueldo_base     ? Number(agente.sueldo_base)     : null,
      usuario:       usuario ?? null,
      tipoMovimiento: soloCobertura ? "cobertura" : "asignacion_titular",
      snapshotPuesto: { nombre: puesto.nombre, cliente_nombre: puesto.cliente_nombre, salario_puesto: puesto.salario_puesto },
    });

    // SAL-02: solo admin/rrhh ven el impacto salarial en la respuesta
    let rolSesion = "";
    try { rolSesion = JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; } catch {}
    const puedeVerImpacto = rolSesion === "admin" || rolSesion === "rrhh";

    res.json({
      ok: true,
      mensaje: `${agente.nombre_completo} asignado a ${puesto.nombre}`,
      asignadoComoTitular: !soloCobertura && sinTitular,
      soloCobertura,
      ...(puedeVerImpacto && {
        impactoSalarial: impacto.tieneImpacto
          ? { detectado: true, impactoId: impacto.impactoId }
          : { detectado: false },
      }),
    });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/asignar error");
    res.status(500).json({ error: "Error al asignar agente" });
  }
});

// ─── POST /api/operaciones/registrar-falta ───────────────────────────────────
// Registrar inasistencia de un titular en su puesto para el día de hoy.
// Para puestos normales (no-24x24): también actualiza estado_operativo_puesto='faltando'.
// Para puestos 24x24: solo registra el evento de RRHH (el ciclo se auto-corrige mañana).
// Body: { puestoId, empleadoId, motivo, notas?, es_24x24?, usuario? }
operacionesRouter.post("/operaciones/registrar-falta", async (req, res) => {
  const { puestoId, empleadoId, motivo, notas, es_24x24, usuario, fecha } = req.body;
  if (!puestoId || !empleadoId) {
    return res.status(400).json({ error: "puestoId y empleadoId son requeridos" });
  }
  const motivoNorm = motivo ?? "inasistencia";
  try {
    const { rows: emp } = await pool.query(
      `SELECT id, nombre_completo FROM employees WHERE id = $1`,
      [empleadoId]
    );
    if (emp.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });
    const { rows: po } = await pool.query(
      `SELECT id, nombre, cliente_nombre FROM puestos_operativos WHERE id = $1`,
      [puestoId]
    );
    if (po.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });

    const hoyGT = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? fecha
      : new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);
    const nota  = notas
      ? `${motivoNorm} — ${po[0].nombre} (${po[0].cliente_nombre}). ${notas}`
      : `${motivoNorm} — ${po[0].nombre} (${po[0].cliente_nombre})`;

    // Marcar puesto como 'faltando' con metadata del empleado y motivo.
    // El evento RRHH se genera al cierre del pizarrón, NO aquí.
    // Esto permite que si durante el día se cubre con sustitución, la falta
    // ya no se genera al cerrar (la sustitución genera su propio par de eventos).
    await pool.query(`
      UPDATE puestos_operativos
      SET estado_operativo_puesto = 'faltando',
          falta_employee_id       = $2,
          falta_motivo            = $3,
          falta_notas             = $4,
          falta_usuario           = $5,
          updated_at              = NOW()
      WHERE id = $1
    `, [puestoId, empleadoId, motivoNorm, nota, usuario ?? 'sistema']);

    logger.info({ puestoId, empleadoId, motivo: motivoNorm, es_24x24, diferido: true }, "Falta marcada (evento diferido al cierre)");
    res.json({ ok: true, empleado: emp[0].nombre_completo, puesto: po[0].nombre, diferido: true });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/registrar-falta error");
    res.status(500).json({ error: "Error al registrar falta" });
  }
});

// ─── POST /api/operaciones/sustituir ─────────────────────────────────────────
// Sustituir agente en un puesto (hay uno previo)
// fechaOperacion: "YYYY-MM-DD" — si es un día pasado, la cobertura se registra en esa fecha
//   y puestos_operativos.agente_id NO se modifica (el tablero lo calcula del ciclo+cobertura).
operacionesRouter.post("/operaciones/sustituir", async (req, res) => {
  const { puestoId, agenteEntranteId, motivo, usuario, notas, forzar, tipoSustitucion,
          tipoNovedad, coberturaTipo, fechaOperacion,
          horaInicioParcial, horaFinParcial,
          agenteSalienteId: bodySalienteId, agenteSalienteNombre: bodySalienteNombre } = req.body;
  if (!puestoId || !agenteEntranteId) return res.status(400).json({ error: "puestoId y agenteEntranteId son requeridos" });

  // tipoSustitucion: 'relevo' = solo cambia agente_id (titular no cambia)
  //                 'reasignacion' = cambia agente_id Y titular_employee_id
  const esRelevo = tipoSustitucion === 'relevo';

  // Operación retroactiva: la fecha de la cobertura es en el pasado.
  // En ese caso NO se toca agente_id en puestos_operativos — el tablero lo resuelve
  // desde el ciclo (puesto_slots) y los overrides de cobertura_segmentos.
  const hoyGT = todayGT();
  const fechaCobertura = (fechaOperacion && /^\d{4}-\d{2}-\d{2}$/.test(fechaOperacion))
    ? fechaOperacion
    : hoyGT;
  const esRetroactivoSustitucion = fechaCobertura < hoyGT;

  try {
    if (await verificarDiaCerrado()) {
      return res.status(423).json({ error: "Día operativo cerrado. Reabre el día para continuar.", diaCerrado: true });
    }
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    const { rows: entranteRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [agenteEntranteId]);
    if (!entranteRows.length) return res.status(404).json({ error: "Agente entrante no encontrado" });
    const entrante = entranteRows[0];

    // Advertir si el entrante ya está en otro puesto (a menos que forzar=true)
    if (!forzar) {
      const { rows: yaRows } = await pool.query(
        `SELECT po.nombre, po.cliente_nombre FROM puestos_operativos po
         WHERE po.agente_id=$1 AND po.activo=TRUE AND po.id!=$2`,
        [agenteEntranteId, puestoId]
      );
      if (yaRows.length > 0) {
        return res.status(409).json({
          error: `${entrante.nombre_completo} ya tiene el puesto ${yaRows[0].nombre} en ${yaRows[0].cliente_nombre}`,
          advertencia: true,
        });
      }

      // Bloquear si el entrante cubre un SSA vigente HOY — no se puede forzar
      const { rows: yaSSA } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre
         FROM solicitudes_servicio_adicional s
         LEFT JOIN clients c ON c.id = s.cliente_id
         WHERE s.agente_id = $1
           AND s.estado_general NOT IN ('cancelada', 'cerrada')
           AND CURRENT_DATE BETWEEN s.fecha AND COALESCE(s.fecha_fin, s.fecha)`,
        [agenteEntranteId]
      );
      if (yaSSA.length > 0) {
        return res.status(409).json({
          error: `${entrante.nombre_completo} ya cubre un Servicio Especial (${yaSSA[0].cliente_nombre ?? "—"} · ${yaSSA[0].id})`,
          advertencia: true,
          ssaId: yaSSA[0].id,
        });
      }
    }

    const agenteSalienteId     = puesto.agente_id ?? bodySalienteId ?? null;
    const agenteSalienteNombre = puesto.agente_nombre ?? bodySalienteNombre ?? null;

    // REGLA FUNDAMENTAL DE RELEVOS:
    // Un relevo es SIEMPRE un evento de un solo día — no importa si es hoy, ayer o retroactivo.
    // El agente sustituto cubre SOLO esa fecha; al día siguiente el ciclo retoma normalmente.
    // Por esto, un relevo NUNCA toca puestos_operativos.agente_id.
    // Solo queda registrado en cobertura_segmentos para esa fecha específica.
    //
    // Una reasignación permanente (esRelevo=false) SÍ actualiza agente_id,
    // pero solo si es para hoy o futuro (no retroactiva).
    if (!esRelevo && !esRetroactivoSustitucion) {
      await pool.query(
        `UPDATE puestos_operativos
         SET agente_id             = $1,
             agente_nombre         = $2,
             titular_employee_id   = $1,
             titular_nombre        = $2,
             estado                = 'cubierto',
             updated_at            = NOW()
         WHERE id = $3`,
        [agenteEntranteId, entrante.nombre_completo, puestoId]
      );
    }

    // Registrar movimiento de sustitución
    await pool.query(
      `INSERT INTO movimientos_operativos
         (puesto_id, cliente_nombre, puesto_nombre,
          agente_saliente_id, agente_saliente_nombre,
          agente_entrante_id, agente_entrante_nombre,
          tipo, motivo, usuario_cambio, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sustitucion', $8, $9, $10)`,
      [
        puestoId, puesto.cliente_nombre, puesto.nombre,
        agenteSalienteId, agenteSalienteNombre,
        agenteEntranteId, entrante.nombre_completo,
        motivo || null, usuario || 'sistema', notas || null,
      ]
    );

    // Obtener ID del movimiento recién insertado
    const { rows: movRows } = await pool.query(
      `SELECT id FROM movimientos_operativos
       WHERE puesto_id=$1 AND tipo='sustitucion'
       ORDER BY created_at DESC LIMIT 1`,
      [puestoId],
    );
    const movimientoId = movRows[0]?.id || null;

    // ── Auto-crear evento RRHH (expandido: tipoNovedad + motivo legacy) ────────
    const tiposRrhhSaliente: Record<string, string> = {
      falta_total:      "falta",
      abandono_parcial: "abandono_parcial",
      suspension_disc:  "suspension_disciplinaria",
      suspension:       "suspension_disciplinaria",
      incapacidad:      "incapacidad",
      permiso_sin_goce: "permiso_sin_goce",
      permiso_con_goce: "permiso_con_goce",
    };
    const tipoEventoRrhh = tipoNovedad
      ? tiposRrhhSaliente[tipoNovedad] ?? null
      : (["falta","suspension"].includes((motivo || "").toLowerCase()) ? motivo?.toLowerCase() : null);

    let turnoHorasPuesto = 24;
    if (puesto.tipo_turno_id) {
      try {
        const { rows: tRows } = await pool.query(`SELECT horas_trabajo::float FROM turnos WHERE id=$1`, [puesto.tipo_turno_id]);
        if (tRows.length) turnoHorasPuesto = Number(tRows[0].horas_trabajo);
      } catch {}
    }

    let eventoRrhhSalienteId: number | null = null;
    if (tipoEventoRrhh && agenteSalienteId) {
      try {
        let employeeId: number | null = Number(agenteSalienteId);
        let employeeNombre = agenteSalienteNombre || "Colaborador desconocido";
        let employeeDpi: string | null = null;
        const { rows: empRows } = await pool.query(
          `SELECT id, nombre_completo, dpi FROM employees WHERE id=$1`, [employeeId]
        );
        if (empRows.length) {
          employeeNombre = empRows[0].nombre_completo;
          employeeDpi    = empRows[0].dpi || null;
        }
        const estadoEvento = "pendiente_aprobacion";
        const { rows: evSalRows } = await pool.query(
          `INSERT INTO eventos_rrhh
             (employee_id, employee_nombre, employee_dpi,
              tipo_evento, fecha, cliente_nombre, puesto_nombre,
              generado_desde, movimiento_id, estado, usuario_generador, documentos_generados,
              cantidad_horas)
           VALUES ($1,$2,$3,$4,NOW(),$5,$6,'operaciones',$7,'pendiente_aprobacion',$8,'[]',$9)
           RETURNING id`,
          [employeeId, employeeNombre, employeeDpi, tipoEventoRrhh,
           puesto.cliente_nombre || null, puesto.nombre || null,
           movimientoId, usuario || "sistema", turnoHorasPuesto]
        );
        eventoRrhhSalienteId = evSalRows[0]?.id ?? null;
        logger.info({ tipoEventoRrhh, empleado: employeeNombre, estadoEvento, eventoRrhhSalienteId }, "Evento RRHH auto-generado desde sustitución");
      } catch (errRrhh: any) {
        logger.error({ err: errRrhh?.message ?? errRrhh }, "Error al auto-generar evento RRHH (no bloqueante)");
      }
    }

    // A-04: Auto-crear segmento de cobertura para hoy al sustituir agente
    // Determinar el estado operativo real del puesto basado en tipo_novedad
    const estadoOpPuesto = (() => {
      if (!esRelevo) return "normal";
      switch (tipoNovedad) {
        case "falta_total":      return "relevo_completo";
        case "abandono_parcial": return "abandono_parcial";
        case "incapacidad":      return "incapacidad";
        case "suspension_disc":  return "suspension_disciplinaria";
        case "suspension":       return "suspension_disciplinaria";
        case "permiso_sin_goce": return "permiso_sin_goce";
        case "permiso_con_goce": return "permiso_con_goce";
        case "relevo_parcial":   return "relevo_parcial";
        case "relevo_completo":  return "relevo_completo";
        case "horas_extra_puras":return "horas_extra";
        case "cierre_tarde_cliente": return "horas_extra";
        default: return "relevo_completo";
      }
    })();

    await pool.query(
      `UPDATE puestos_operativos
       SET estado_operativo_puesto = $1,
           falta_employee_id = NULL,
           falta_motivo = NULL,
           falta_notas = NULL,
           falta_usuario = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [estadoOpPuesto, puestoId]
    );

    // A-04: Auto-crear segmento de cobertura (para fechaCobertura: hoy o fecha retroactiva)
    try {
      const hoy = fechaCobertura;
      const turno = (puesto.turno ?? "día").toLowerCase();
      const horaInicioDefault = turno === "noche" ? "20:00" : "08:00";
      const horaFinDefault    = turno === "noche" ? "06:00" : "18:00";
      const usaParcial = coberturaTipo === "parcial" && horaInicioParcial && horaFinParcial;
      const horaInicio = usaParcial ? horaInicioParcial : horaInicioDefault;
      const horaFin    = usaParcial ? horaFinParcial    : horaFinDefault;
      const calcHorasCobertura = (hi: string, hf: string) => {
        const [h1,m1] = hi.split(":").map(Number);
        const [h2,m2] = hf.split(":").map(Number);
        let diff = (h2*60+m2) - (h1*60+m1);
        if (diff <= 0) diff += 1440;
        return Math.round((diff / 60) * 100) / 100;
      };
      const horasCalc = usaParcial ? calcHorasCobertura(horaInicio, horaFin) : turnoHorasPuesto;
      // Marcar cobertura especial cuando el entrante es supervisor o jefe de servicio
      const tipoPersonalEntrante = entrante.tipo_personal ?? 'guardia';
      const tipoSeg = tipoPersonalEntrante === 'supervisor'
        ? 'cobertura_supervisor'
        : tipoPersonalEntrante === 'jefe_servicio'
          ? 'cobertura_jefe_servicio'
          : esRelevo ? "relevo" : "titular";
      const alcance    = coberturaTipo || "completo";
      await pool.query(
        `INSERT INTO cobertura_segmentos
           (fecha, puesto_id, client_id, employee_id, empleado_nombre,
            tipo_cobertura, hora_inicio, hora_fin, horas_calculadas,
            fue_en_dia_descanso, genera_horas_extra, usuario_registro,
            tipo_novedad, cobertura_alcance)
         SELECT $1,$2,$3,$4,$5,$6::VARCHAR,$7,$8,$9,FALSE,FALSE,'sustitucion_pizarron',$10,$11
         WHERE NOT EXISTS (
           SELECT 1 FROM cobertura_segmentos
           WHERE fecha=$1 AND puesto_id=$2 AND employee_id=$4
         )`,
        [hoy, puestoId, puesto.cliente_id ?? null, agenteEntranteId,
         entrante.nombre_completo, tipoSeg, horaInicio, horaFin, horasCalc,
         tipoNovedad ?? null, alcance]
      );
      logger.info({ puestoId, agenteEntranteId, tipoSeg, tipoNovedad, hoy }, "A-04: segmento auto-creado en sustitución");

      // Crear evento RRHH para el agente ENTRANTE (HE / cobertura) → requiere validación RRHH
      let eventoRrhhEntranteId: number | null = null;
      if (esRelevo) {
        try {
          const { rows: evEntRows } = await pool.query(
            `INSERT INTO eventos_rrhh
               (employee_id, employee_nombre, employee_dpi,
                tipo_evento, fecha, cliente_nombre, puesto_nombre,
                generado_desde, movimiento_id, estado, usuario_generador,
                observaciones, documentos_generados, evento_par_id, cantidad_horas)
             VALUES ($1,$2,$3,'horas_extra',$4::date,$5,$6,'operaciones',$7,'pendiente_aprobacion',$8,
                     $9,'[]',$10,$11)
             RETURNING id`,
            [agenteEntranteId, entrante.nombre_completo, entrante.dpi ?? null,
             hoy, puesto.cliente_nombre || null, puesto.nombre || null,
             movimientoId, usuario || "sistema",
             `Cobertura HE: ${tipoNovedad ?? 'relevo'} en ${puesto.nombre} (${puesto.cliente_nombre})`,
             eventoRrhhSalienteId, horasCalc]
          );
          eventoRrhhEntranteId = evEntRows[0]?.id ?? null;
          if (eventoRrhhSalienteId && eventoRrhhEntranteId) {
            await pool.query(`UPDATE eventos_rrhh SET evento_par_id = $1 WHERE id = $2`, [eventoRrhhEntranteId, eventoRrhhSalienteId]);
          }
          logger.info({ agenteEntranteId, eventoRrhhEntranteId, eventoRrhhSalienteId, tipoNovedad }, "Evento RRHH HE creado para entrante (par vinculado)");
        } catch (errEvEnt) {
          logger.warn({ errEvEnt }, "No se pudo crear evento RRHH para entrante (no bloqueante)");
        }
      }

      // Registrar novedad de nómina para el agente entrante (limpia cualquier falta previa)
      try {
        await pool.query(
          `INSERT INTO novedades_nomina_diarias
             (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
              puesto_cubierto_id, puesto_cubierto_nombre, num_puestos_cubiertos, fuente,
              requiere_revision_rrhh, impacto_nomina, evento_rrhh_id, tipo_novedad)
           VALUES ($1, $2, $3, TRUE, $4, $11, $5, $6, 1, 'sustitucion_pizarron',
                   $7, $8, $9, $10)
           ON CONFLICT (fecha, employee_id) DO UPDATE SET
             trabajo_dia           = TRUE,
             falta                 = FALSE,
             descuento_dia         = FALSE,
             horas_trabajadas      = GREATEST(novedades_nomina_diarias.horas_trabajadas, $4),
             horas_extra           = GREATEST(novedades_nomina_diarias.horas_extra, $11),
             num_puestos_cubiertos = novedades_nomina_diarias.num_puestos_cubiertos + 1,
             requiere_revision_rrhh = CASE
               WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
               THEN novedades_nomina_diarias.requiere_revision_rrhh
               ELSE COALESCE($7, novedades_nomina_diarias.requiere_revision_rrhh)
             END,
             impacto_nomina = CASE
               WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
               THEN novedades_nomina_diarias.impacto_nomina
               ELSE COALESCE($8, novedades_nomina_diarias.impacto_nomina)
             END,
             evento_rrhh_id = COALESCE(novedades_nomina_diarias.evento_rrhh_id, $9),
             updated_at            = NOW()`,
          [hoy, agenteEntranteId, entrante.nombre_completo, horasCalc, puestoId, puesto.nombre,
           esRelevo ? true : null, esRelevo ? 'pendiente' : null, eventoRrhhEntranteId,
           tipoNovedad ?? 'relevo_completo', esRelevo ? horasCalc : 0]
        );
      } catch (nomEntranteErr) {
        logger.warn({ nomEntranteErr }, "A-04: no se pudo actualizar novedad nómina del entrante (no bloqueante)");
      }

      // Registrar novedad de falta/ausencia para el agente SALIENTE (titular que sale)
      if (agenteSalienteId && tipoEventoRrhh && esRelevo) {
        try {
          const TIPOS_SIN_DESCUENTO = ["vacaciones", "relevo_vacaciones", "incapacidad", "permiso_con_goce", "permiso", "descanso"];
          const sinDescuento = TIPOS_SIN_DESCUENTO.includes(tipoNovedad ?? "");
          const esSuspension = ["suspension", "suspension_disciplinaria"].includes(tipoEventoRrhh);
          const esFalta      = !sinDescuento && !esSuspension;
          const diasDesc     = esFalta ? (turnoHorasPuesto >= 24 ? 3 : turnoHorasPuesto >= 12 ? 2 : 1) : null;

          let salienteNombre = agenteSalienteNombre || "Desconocido";
          try {
            const { rows: sRows } = await pool.query(`SELECT nombre_completo FROM employees WHERE id=$1`, [agenteSalienteId]);
            if (sRows.length) salienteNombre = sRows[0].nombre_completo;
          } catch {}

          const ptId = puesto.titular_employee_id === Number(agenteSalienteId) ? puestoId : null;
          const ptNombre = ptId ? puesto.nombre : null;

          await pool.query(
            `INSERT INTO novedades_nomina_diarias
               (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
                falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
                puesto_titular_id, puesto_titular_nombre,
                tipo_novedad, fuente, evento_rrhh_id, dias_descuento,
                requiere_revision_rrhh, impacto_nomina, updated_at)
             VALUES ($1,$2,$3, FALSE, 0, 0,
                     $4, $5, FALSE, $6, $7,
                     $8, $9,
                     $10, 'sustitucion_pizarron', $11, $12,
                     TRUE, 'pendiente', NOW())
             ON CONFLICT (fecha, employee_id) DO UPDATE SET
               trabajo_dia      = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.trabajo_dia
                 ELSE FALSE END,
               horas_trabajadas = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.horas_trabajadas
                 ELSE 0 END,
               horas_extra      = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.horas_extra
                 ELSE 0 END,
               falta            = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.falta
                 ELSE $4 END,
               suspension       = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.suspension
                 ELSE $5 END,
               afecta_septimo   = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.afecta_septimo
                 ELSE $6 END,
               descuento_dia    = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.descuento_dia
                 ELSE $7 END,
               tipo_novedad     = COALESCE(novedades_nomina_diarias.tipo_novedad, $10),
               fuente           = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.fuente
                 ELSE 'sustitucion_pizarron' END,
               evento_rrhh_id   = COALESCE(novedades_nomina_diarias.evento_rrhh_id, $11),
               dias_descuento   = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.dias_descuento
                 ELSE $12 END,
               requiere_revision_rrhh = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.requiere_revision_rrhh
                 ELSE TRUE END,
               impacto_nomina   = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.impacto_nomina
                 ELSE 'pendiente' END,
               updated_at       = NOW()`,
            [hoy, agenteSalienteId, salienteNombre,
             esFalta, esSuspension, esFalta, esFalta,
             ptId, ptNombre,
             tipoNovedad ?? 'falta_total', eventoRrhhSalienteId, diasDesc]
          );
          logger.info({ agenteSalienteId, fecha: hoy, tipoNovedad, diasDesc, esFalta, esSuspension },
            "A-04: novedad de falta/ausencia creada para titular saliente");
        } catch (nomSalienteErr) {
          logger.warn({ nomSalienteErr }, "A-04: no se pudo crear novedad nómina del saliente (no bloqueante)");
        }
      }
    } catch (segErr) {
      logger.warn({ segErr }, "A-04: no se pudo auto-crear segmento al sustituir (no bloqueante)");
    }

    // SAL-01: Detectar impacto salarial (no bloqueante)
    const impacto = await registrarImpactoSalarial({
      agenteId:      agenteEntranteId,
      agenteNombre:  entrante.nombre_completo,
      puestoId:      puestoId,
      puestoNombre:  puesto.nombre,
      clienteNombre: puesto.cliente_nombre ?? "",
      salarioPuesto: puesto.salario_puesto ? Number(puesto.salario_puesto) : null,
      salarioActual: entrante.sueldo_base  ? Number(entrante.sueldo_base)  : null,
      usuario:       usuario ?? null,
      tipoMovimiento: esRelevo ? "relevo" : "reasignacion",
      snapshotPuesto: { nombre: puesto.nombre, cliente_nombre: puesto.cliente_nombre, salario_puesto: puesto.salario_puesto },
    });

    // SAL-02: solo admin/rrhh ven el impacto salarial en la respuesta
    let rolSesionSus = "";
    try { rolSesionSus = JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; } catch {}
    const puedeVerImpactoSus = rolSesionSus === "admin" || rolSesionSus === "rrhh";

    res.json({
      ok: true,
      mensaje: `Sustitución registrada: ${agenteSalienteNombre} → ${entrante.nombre_completo}`,
      eventoRrhhGenerado: !!tipoEventoRrhh,
      tipoNovedad: tipoNovedad ?? null,
      estadoOperativoPuesto: estadoOpPuesto,
      ...(puedeVerImpactoSus && {
        impactoSalarial: impacto.tieneImpacto
          ? { detectado: true, impactoId: impacto.impactoId }
          : { detectado: false },
      }),
    });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/sustituir error");
    res.status(500).json({ error: "Error al registrar sustitución" });
  }
});

// ─── POST /api/operaciones/liberar ───────────────────────────────────────────
// Quitar agente de un puesto (queda descubierto)
// horaFin: "HH:MM" real de cuando salió — cierra el segmento de cobertura del día
// generarEventoFalta: true → crea evento RRHH + novedad de nómina (falta/descuento)
operacionesRouter.post("/operaciones/liberar", async (req, res) => {
  const { puestoId, motivo, usuario, notas, horaFin, generarEventoFalta } = req.body;
  if (!puestoId) return res.status(400).json({ error: "puestoId es requerido" });

  try {
    if (await verificarDiaCerrado()) {
      return res.status(423).json({ error: "Día operativo cerrado. Reabre el día para continuar.", diaCerrado: true });
    }
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    if (!puesto.agente_id) return res.status(400).json({ error: "El puesto no tiene agente asignado" });

    const agenteId = puesto.agente_id as number;
    const agenteNombre = puesto.agente_nombre as string;
    const hoy = todayGT();

    // ── Operación atómica: limpiar agente + registrar movimiento ─────────────
    // Si cualquiera de los dos pasos falla, se hace ROLLBACK completo.
    // Segmento de cobertura y eventos RRHH son "best effort" (fuera de la tx).
    const client = await pool.connect();
    let movId: number | null = null;
    try {
      await client.query("BEGIN");

      // IMPORTANTE: solo se limpia agente_id (cobertura del día).
      // El titular_employee_id se preserva para mantener la asignación base.
      await client.query(
        `UPDATE puestos_operativos SET agente_id=NULL, agente_nombre=NULL, estado='descubierto', updated_at=NOW()
         WHERE id=$1`,
        [puestoId]
      );

      const movResult = await client.query(
        `INSERT INTO movimientos_operativos
           (puesto_id, cliente_nombre, puesto_nombre,
            agente_saliente_id, agente_saliente_nombre,
            tipo, motivo, usuario_cambio, notas)
         VALUES ($1, $2, $3, $4, $5, 'liberacion', $6, $7, $8)
         RETURNING id`,
        [
          puestoId, puesto.cliente_nombre, puesto.nombre,
          agenteId, agenteNombre,
          motivo || null, usuario || 'sistema', notas || null,
        ]
      );
      movId = movResult.rows[0]?.id ?? null;

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      client.release();
      logger.error({ txErr, puestoId }, "liberar: transacción revertida");
      return res.status(500).json({ error: "Error al liberar puesto. La operación fue revertida." });
    }
    client.release();

    // ── Cerrar segmento de cobertura del día si se indica hora de salida ──────
    if (horaFin) {
      try {
        // Calcular horas: obtenemos hora_inicio del segmento para el cálculo
        const { rows: segRows } = await pool.query(
          `SELECT hora_inicio FROM cobertura_segmentos
           WHERE fecha=$1 AND puesto_id=$2 AND employee_id=$3 AND hora_fin IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [hoy, puestoId, agenteId]
        );
        const horaInicio = segRows[0]?.hora_inicio ?? null;
        let horasReal: number | null = null;
        if (horaInicio) {
          const [h1, m1] = horaInicio.split(":").map(Number);
          const [h2, m2] = horaFin.split(":").map(Number);
          let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (mins < 0) mins += 24 * 60;
          horasReal = Math.round(mins / 6) / 10;
        }
        await pool.query(
          `UPDATE cobertura_segmentos
           SET hora_fin = $1,
               horas_calculadas = COALESCE($2, horas_calculadas),
               updated_at = NOW()
           WHERE fecha=$3 AND puesto_id=$4 AND employee_id=$5 AND hora_fin IS NULL`,
          [horaFin, horasReal, hoy, puestoId, agenteId]
        );
      } catch (segErr) {
        logger.warn({ segErr }, "liberar: no se pudo cerrar segmento (no bloqueante)");
      }
    }

    // ── Generar evento RRHH + novedad nómina si fue falta ────────────────────
    const esFalta = motivo === 'falta' || generarEventoFalta === true;
    if (esFalta) {
      try {
        const { rows: empRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [agenteId]);
        const emp = empRows[0];
        if (emp) {
          // Capturar ID del evento RRHH para enlazarlo a la novedad
          const { rows: eventoRows } = await pool.query(
            `INSERT INTO eventos_rrhh
               (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha,
                cliente_nombre, puesto_nombre, generado_desde, movimiento_id, estado,
                usuario_generador, observaciones)
             VALUES ($1, $2, $3, 'falta', NOW(), $4, $5, 'pizarron', $6, 'pendiente', $7, $8)
             RETURNING id`,
            [emp.id, emp.nombre_completo, emp.dpi ?? null,
             puesto.cliente_nombre, puesto.nombre,
             movId, usuario || 'sistema', notas || null]
          );
          const eventoRrhhId = eventoRows[0]?.id ?? null;

          // Novedad pendiente de revisión RRHH — no se descuenta hasta que RRHH resuelva
          await pool.query(
            `INSERT INTO novedades_nomina_diarias
               (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
                falta, descuento_dia, impacto_nomina, requiere_revision_rrhh,
                tipo_novedad, evento_rrhh_id, puesto_titular_id, puesto_titular_nombre, fuente)
             VALUES ($1, $2, $3, FALSE, 0, 0, FALSE, FALSE, 'pendiente', TRUE,
                     'falta_total', $6, $4, $5, 'liberacion_pizarron')
             ON CONFLICT (fecha, employee_id) DO UPDATE SET
               trabajo_dia            = FALSE,
               horas_trabajadas       = 0,
               tipo_novedad           = COALESCE(novedades_nomina_diarias.tipo_novedad, 'falta_total'),
               evento_rrhh_id         = COALESCE(novedades_nomina_diarias.evento_rrhh_id, EXCLUDED.evento_rrhh_id),
               impacto_nomina         = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.impacto_nomina
                 ELSE 'pendiente'
               END,
               requiere_revision_rrhh = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.requiere_revision_rrhh
                 ELSE TRUE
               END,
               updated_at             = NOW()`,
            [hoy, emp.id, emp.nombre_completo, puesto.id, puesto.nombre, eventoRrhhId]
          );
          logger.info({ agenteId, hoy, eventoRrhhId }, "liberar: incidencia creada como pendiente RRHH");
        }
      } catch (faltaErr) {
        logger.warn({ faltaErr }, "liberar: no se pudo crear evento falta (no bloqueante)");
      }
    }

    res.json({
      ok: true,
      mensaje: `${agenteNombre} removido de ${puesto.nombre}`,
      faltaRegistrada: esFalta,
      segmentoCerrado: !!horaFin,
    });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/liberar error");
    res.status(500).json({ error: "Error al liberar puesto" });
  }
});

// ─── POST /api/operaciones/puestos/:id/titular ───────────────────────────────
// Establecer o cambiar el titular de un puesto (sin mover la cobertura del día)
operacionesRouter.post("/operaciones/puestos/:id/titular", async (req, res) => {
  const { titularEmployeeId, usuario } = req.body;
  const puestoId = req.params.id;

  try {
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });

    if (!titularEmployeeId) {
      // Quitar titular
      await pool.query(
        `UPDATE puestos_operativos SET titular_employee_id=NULL, titular_nombre=NULL, updated_at=NOW() WHERE id=$1`,
        [puestoId]
      );
      return res.json({ ok: true, mensaje: "Titular removido" });
    }

    const { rows: empRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [titularEmployeeId]);
    if (!empRows.length) return res.status(404).json({ error: "Colaborador no encontrado" });
    const emp = empRows[0];

    await pool.query(
      `UPDATE puestos_operativos SET titular_employee_id=$1, titular_nombre=$2, updated_at=NOW() WHERE id=$3`,
      [titularEmployeeId, emp.nombre_completo, puestoId]
    );

    // Si no hay agente_id asignado, también asignar como cobertura actual
    const puesto = puestoRows[0];
    if (!puesto.agente_id) {
      await pool.query(
        `UPDATE puestos_operativos SET agente_id=$1, agente_nombre=$2, estado='cubierto', updated_at=NOW() WHERE id=$3`,
        [titularEmployeeId, emp.nombre_completo, puestoId]
      );
    }

    res.json({ ok: true, mensaje: `${emp.nombre_completo} definido como titular de ${puestoRows[0].nombre}` });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/puestos/:id/titular error");
    res.status(500).json({ error: "Error al definir titular" });
  }
});

// ─── PATCH /api/operaciones/puestos/:id ──────────────────────────────────────
// Actualizar campos de configuración de un puesto (horario, jornada, sede, notas, zona)
operacionesRouter.patch("/operaciones/puestos/:id", async (req, res) => {
  const { horario, jornada, sedeId, notas, turno, zonaOperativaId, tipoPuesto } = req.body;

  // P-03: rechazar body vacío para evitar UPDATE sin efecto
  if ([horario, jornada, sedeId, notas, turno, zonaOperativaId, tipoPuesto].every(v => v === undefined || v === null)) {
    return res.status(400).json({ error: "Debe proporcionar al menos un campo para actualizar (horario, jornada, sedeId, notas, turno, zonaOperativaId, tipoPuesto)" });
  }

  // Zona no puede quitarse una vez asignada — es parte estructural del modelo
  if (zonaOperativaId === null) {
    return res.status(400).json({ error: "El puesto debe tener una zona operativa asignada" });
  }

  // Validar tipo_puesto si viene
  if (tipoPuesto !== undefined && !['normal', 'custodia'].includes(tipoPuesto)) {
    return res.status(400).json({ error: "tipoPuesto debe ser 'normal' o 'custodia'" });
  }

  try {
    // Si se actualiza zona, verificar que exista
    if (zonaOperativaId !== undefined) {
      const { rows: zonaRows } = await pool.query(
        `SELECT id FROM operational_zones WHERE id = $1`, [zonaOperativaId]
      );
      if (!zonaRows.length) {
        return res.status(400).json({ error: `La zona operativa con id=${zonaOperativaId} no existe` });
      }
    }

    const { rows } = await pool.query(
      `UPDATE puestos_operativos
       SET horario             = COALESCE($1, horario),
           jornada             = COALESCE($2, jornada),
           sede_id             = COALESCE($3, sede_id),
           notas               = COALESCE($4, notas),
           turno               = COALESCE($5, turno),
           zona_operativa_id   = COALESCE($6, zona_operativa_id),
           tipo_puesto         = COALESCE($7, tipo_puesto),
           updated_at          = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        horario ?? null, jornada ?? null, sedeId ?? null, notas ?? null,
        turno ?? null, zonaOperativaId ?? null, tipoPuesto ?? null, req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id error");
    res.status(500).json({ error: "Error al actualizar puesto" });
  }
});

// ─── PATCH /api/operaciones/puestos/:id/salario ──────────────────────────────
// Solo admin/rrhh pueden actualizar el salario_puesto
operacionesRouter.patch("/operaciones/puestos/:id/salario", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  let userRole = "";
  try { userRole = JSON.parse(sessionRaw as string)?.rol ?? ""; } catch {}
  if (!["admin", "rrhh"].includes(userRole)) {
    return res.status(403).json({ error: "Solo RRHH o administradores pueden modificar el salario del puesto" });
  }
  const { salarioPuesto } = req.body;
  if (salarioPuesto === undefined) {
    return res.status(400).json({ error: "salarioPuesto es requerido" });
  }
  const salarioVal = salarioPuesto === null ? null : Number(salarioPuesto);
  if (salarioPuesto !== null && (isNaN(salarioVal!) || salarioVal! < 0)) {
    return res.status(400).json({ error: "salarioPuesto debe ser un número positivo" });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE puestos_operativos SET salario_puesto = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, nombre, cliente_nombre, salario_puesto`,
      [salarioVal, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json({ ok: true, puesto: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id/salario error");
    res.status(500).json({ error: "Error al actualizar salario del puesto" });
  }
});

// ─── GET /api/operaciones/puestos-salarios ────────────────────────────────────
// Lista todos los puestos operativos con su salario (solo admin/rrhh)
operacionesRouter.get("/operaciones/puestos-salarios", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  let userRole = "";
  try { userRole = JSON.parse(sessionRaw as string)?.rol ?? ""; } catch {}
  if (!["admin", "rrhh"].includes(userRole)) {
    return res.status(403).json({ error: "Solo RRHH o administradores pueden ver los salarios" });
  }
  try {
    const { rows } = await pool.query(`
      SELECT
        po.id, po.nombre, po.cliente_id, po.cliente_nombre,
        po.salario_puesto, po.activo, po.estado,
        c.nombre_comercial AS cliente_nombre_comercial
      FROM puestos_operativos po
      LEFT JOIN clients c ON c.id = po.cliente_id
      WHERE po.activo = true
      ORDER BY po.cliente_nombre, po.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos-salarios error");
    res.status(500).json({ error: "Error al obtener puestos" });
  }
});

// ─── PATCH /api/operaciones/puestos/:id/igss ─────────────────────────────────
// Actualizar clasificación IGSS de un puesto/servicio
operacionesRouter.patch("/operaciones/puestos/:id/igss", async (req, res) => {
  const { aplicaIgss, regimenIgss, notasIgss } = req.body ?? {};
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID inválido" });

  const REGIMENES_VALIDOS = ["aplica", "no_aplica", "en_transicion"];
  if (regimenIgss !== undefined && !REGIMENES_VALIDOS.includes(regimenIgss)) {
    return res.status(400).json({ error: "regimen_igss inválido. Use: aplica, no_aplica, en_transicion" });
  }

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [puestoId];

  if (aplicaIgss !== undefined) {
    params.push(!!aplicaIgss);
    sets.push(`aplica_igss = $${params.length}`);
    // Sincronizar regimen_igss automáticamente si no se pasa explícito
    if (regimenIgss === undefined) {
      params.push(aplicaIgss ? "aplica" : "no_aplica");
      sets.push(`regimen_igss = $${params.length}`);
    }
  }
  if (regimenIgss !== undefined) {
    params.push(regimenIgss);
    sets.push(`regimen_igss = $${params.length}`);
  }
  if (notasIgss !== undefined) {
    params.push(notasIgss || null);
    sets.push(`notas_igss = $${params.length}`);
  }

  try {
    const { rows } = await pool.query(
      `UPDATE puestos_operativos SET ${sets.join(", ")} WHERE id = $1 RETURNING id, nombre, cliente_nombre, aplica_igss, regimen_igss, notas_igss`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id/igss error");
    res.status(500).json({ error: "Error al actualizar IGSS del puesto" });
  }
});

// ─── GET /api/operaciones/puestos/sin-zona ───────────────────────────────────
// Diagnóstico: lista de puestos activos sin zona_operativa_id asignada
operacionesRouter.get("/operaciones/puestos/sin-zona", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT po.id,
             po.nombre,
             po.cliente_nombre AS cliente
      FROM puestos_operativos po
      WHERE po.activo = TRUE AND po.zona_operativa_id IS NULL
      ORDER BY po.cliente_nombre, po.nombre
    `);
    res.json({ total: rows.length, puestos: rows });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/sin-zona error");
    res.status(500).json({ error: "Error al consultar puestos sin zona" });
  }
});

// ─── POST /api/operaciones/puestos ───────────────────────────────────────────
// Crear un nuevo puesto operativo
// Requiere: clienteNombre, nombre, tipoTurnoId, fechaInicioCiclo, zonaOperativaId
operacionesRouter.post("/operaciones/puestos", async (req, res) => {
  const {
    clienteId, clienteNombre, nombre, turno, notas, sedeId, horario, jornada,
    tipoTurnoId, fechaInicioCiclo, zonaOperativaId, tipoPuesto,
  } = req.body;

  if (!clienteNombre || !nombre) {
    return res.status(400).json({ error: "clienteNombre y nombre son requeridos" });
  }
  if (!tipoTurnoId) {
    return res.status(400).json({ error: "tipoTurnoId es requerido para crear un puesto" });
  }
  if (!fechaInicioCiclo || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioCiclo)) {
    return res.status(400).json({ error: "fechaInicioCiclo (YYYY-MM-DD) es requerida para crear un puesto" });
  }
  // Zona obligatoria — parte estructural del modelo operativo
  if (!zonaOperativaId) {
    return res.status(400).json({ error: "El puesto debe tener una zona operativa asignada" });
  }

  try {
    // Verificar que el turno exista
    const { rows: turnoRows } = await pool.query(
      `SELECT id FROM turnos WHERE id = $1 AND activo = TRUE`, [tipoTurnoId]
    );
    if (!turnoRows.length) {
      return res.status(400).json({ error: `El turno con id=${tipoTurnoId} no existe o está inactivo` });
    }

    // Verificar que la zona exista
    const { rows: zonaRows } = await pool.query(
      `SELECT id FROM operational_zones WHERE id = $1`, [zonaOperativaId]
    );
    if (!zonaRows.length) {
      return res.status(400).json({ error: `La zona operativa con id=${zonaOperativaId} no existe` });
    }

    const { rows: ordenRows } = await pool.query(
      `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM puestos_operativos WHERE cliente_nombre=$1`,
      [clienteNombre]
    );
    const orden = ordenRows[0].siguiente;

    const tipoPuestoFinal = (tipoPuesto === 'custodia') ? 'custodia' : 'normal';

    const { rows } = await pool.query(
      `INSERT INTO puestos_operativos
         (cliente_id, cliente_nombre, nombre, turno, orden, notas, sede_id, horario, jornada,
          tipo_turno_id, fecha_inicio_ciclo, zona_operativa_id, tipo_puesto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        clienteId || null, clienteNombre, nombre, turno || 'día', orden,
        notas || null, sedeId || null, horario || null, jornada || null,
        tipoTurnoId, fechaInicioCiclo, zonaOperativaId, tipoPuestoFinal,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /operaciones/puestos error");
    res.status(500).json({ error: "Error al crear puesto" });
  }
});

// ─── DELETE /api/operaciones/puestos/:id ─────────────────────────────────────
// Al desactivar un puesto:
//   1. Marca el puesto como inactivo
//   2. Desactiva sus registros en puesto_titulares
//   3. Marca los agentes involucrados como elegibles para el pool (disponibles)
//   4. Registra un movimiento operativo de liberación
operacionesRouter.delete("/operaciones/puestos/:id", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  const session = sessionRaw ? JSON.parse(Buffer.from(String(sessionRaw), "base64").toString()) : null;
  const usuario = session?.nombre ?? session?.username ?? "sistema";

  try {
    const puestoId = parseInt(req.params.id);

    // Leer el puesto antes de desactivarlo para saber quién es el titular/agente
    const { rows: puestoRows } = await pool.query(
      `SELECT id, nombre, cliente_nombre, titular_employee_id, agente_id
       FROM puestos_operativos WHERE id = $1`,
      [puestoId]
    );
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    // 1. Desactivar el puesto
    await pool.query(
      `UPDATE puestos_operativos SET activo = FALSE, agente_id = NULL, agente_nombre = NULL, updated_at = NOW() WHERE id = $1`,
      [puestoId]
    );

    // 2. Desactivar registros de puesto_titulares para este puesto
    await pool.query(
      `UPDATE puesto_titulares SET activo = FALSE, updated_at = NOW() WHERE puesto_id = $1 AND activo = TRUE`,
      [puestoId]
    );

    // 3. Recolectar IDs de empleados afectados (titular y/o agente activo)
    const afectadosSet = new Set<number>();
    if (puesto.titular_employee_id) afectadosSet.add(Number(puesto.titular_employee_id));
    if (puesto.agente_id && puesto.agente_id !== puesto.titular_employee_id) afectadosSet.add(Number(puesto.agente_id));

    // También los titulares registrados en puesto_titulares (multi-titular)
    const { rows: titularesRows } = await pool.query(
      `SELECT employee_id FROM puesto_titulares WHERE puesto_id = $1`,
      [puestoId]
    );
    for (const t of titularesRows) {
      if (t.employee_id) afectadosSet.add(Number(t.employee_id));
    }

    const afectadosArr = [...afectadosSet];

    if (afectadosArr.length > 0) {
      // 4. Marcar empleados afectados como elegibles para el pool (disponibles)
      await pool.query(
        `UPDATE employees SET elegible_pool = TRUE, updated_at = NOW()
         WHERE id = ANY($1::int[]) AND estado_laboral = 'activo'`,
        [afectadosArr]
      );

      // 5. Registrar movimiento operativo por cada empleado liberado
      for (const empId of afectadosArr) {
        const { rows: empRows } = await pool.query(
          `SELECT nombre_completo FROM employees WHERE id = $1`, [empId]
        );
        const empNombre = empRows[0]?.nombre_completo ?? "Desconocido";
        await pool.query(
          `INSERT INTO movimientos_operativos
             (tipo, motivo, puesto_id, puesto_nombre, cliente_nombre,
              agente_saliente_id, agente_saliente_nombre, usuario_cambio, fecha_hora)
           VALUES ('salida', 'puesto_desactivado', $1, $2, $3, $4, $5, $6, NOW())`,
          [puestoId, puesto.nombre, puesto.cliente_nombre, empId, empNombre, usuario]
        );
      }
    }

    logger.info(
      { puestoId, nombre: puesto.nombre, afectados: afectadosArr },
      "Puesto desactivado — agentes liberados al pool"
    );

    res.json({
      ok: true,
      agentes_liberados: afectadosArr.length,
      mensaje: afectadosArr.length > 0
        ? `Puesto desactivado. ${afectadosArr.length} agente(s) pasaron a disponibles en el pool.`
        : "Puesto desactivado. No había agentes asignados.",
    });
  } catch (err) {
    logger.error({ err }, "DELETE /operaciones/puestos/:id error");
    res.status(500).json({ error: "Error al eliminar puesto" });
  }
});

// ─── GET /api/operaciones/historial ──────────────────────────────────────────
// Últimos movimientos registrados
operacionesRouter.get("/operaciones/historial", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const puestoId = req.query.puestoId;

    let sql = `
      SELECT id, puesto_id, cliente_nombre, puesto_nombre,
             agente_saliente_nombre, agente_entrante_nombre,
             tipo, motivo, usuario_cambio, notas, fecha_hora
      FROM movimientos_operativos
    `;
    const params: any[] = [];
    if (puestoId) {
      sql += ` WHERE puesto_id=$1`;
      params.push(puestoId);
    }
    sql += ` ORDER BY fecha_hora DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/historial error");
    res.status(500).json({ error: "Error al cargar historial" });
  }
});

// ─── GET /api/operaciones/agentes/:id/disponibilidad ─────────────────────────
operacionesRouter.get("/operaciones/agentes/:id/disponibilidad", async (req, res) => {
  try {
    const { rows: puestos } = await pool.query(
      `SELECT po.nombre, po.cliente_nombre, po.turno
       FROM puestos_operativos po
       WHERE po.agente_id=$1 AND po.activo=TRUE`,
      [req.params.id]
    );
    const { rows: emp } = await pool.query(
      `SELECT id, nombre_completo, estado_laboral, puesto FROM employees WHERE id=$1`,
      [req.params.id]
    );
    if (!emp.length) return res.status(404).json({ error: "Agente no encontrado" });

    res.json({
      agente: emp[0],
      puestosActivos: puestos,
      disponible: puestos.length === 0 && emp[0].estado_laboral === 'activo',
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/agentes/:id/disponibilidad error");
    res.status(500).json({ error: "Error al verificar disponibilidad" });
  }
});

// ─── Helper: fecha hoy en formato DD-MM-YYYY (Guatemala) ─────────────────────
function fechaHoyStr(): string {
  const iso = todayGT(); // YYYY-MM-DD en hora Guatemala
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

// ─── Helper: formatear fecha ISO a DD-MM-YYYY ─────────────────────────────────
function isoADDMMYYYY(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

// ─── Helper: calcular la fecha operativa activa ────────────────────────────────
// La fecha activa es el primer día no cerrado comenzando desde hoy.
// Si hoy está cerrado → mañana; si mañana también → pasado, etc.
interface FechaActivaResult {
  fechaActivaISO: string;
  fechaActivaStr: string;
  esFechaFutura: boolean;
  cierreDeHoy: any | null;
}

async function calcFechaActiva(): Promise<FechaActivaResult> {
  // todayGT() da la fecha de hoy en Guatemala (UTC-6); el pool también está
  // configurado en America/Guatemala, por lo que CURRENT_DATE en SQL coincide.
  const todayISO = todayGT();

  const { rows: hoyRows } = await pool.query(
    `SELECT * FROM cierre_operativo_diario WHERE fecha = $1`,
    [todayISO]
  );
  const cierreDeHoy = hoyRows[0] ?? null;

  if (cierreDeHoy?.estado !== 'cerrado') {
    return {
      fechaActivaISO: todayISO,
      fechaActivaStr: isoADDMMYYYY(todayISO),
      esFechaFutura: false,
      cierreDeHoy: null,
    };
  }

  // Hoy está cerrado → encontrar el primer día no cerrado desde hoy
  const { rows: closedRows } = await pool.query(`
    SELECT fecha::text AS fecha FROM cierre_operativo_diario
    WHERE fecha >= $1 AND estado = 'cerrado'
    ORDER BY fecha
  `, [todayISO]);

  // Avanzar día a día desde hoy hasta encontrar uno sin cierre
  let fechaActivaISO = todayISO;
  for (const row of closedRows) {
    const rowISO = (row.fecha as string).substring(0, 10);
    if (rowISO === fechaActivaISO) {
      // Este día está cerrado → avanzar un día
      const d = new Date(fechaActivaISO + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      fechaActivaISO = d.toISOString().substring(0, 10);
    } else {
      break;
    }
  }

  return {
    fechaActivaISO,
    fechaActivaStr: isoADDMMYYYY(fechaActivaISO),
    esFechaFutura:  true,
    cierreDeHoy,
  };
}

// ─── Helper: verificar si la fecha activa está cerrada ────────────────────────
async function verificarDiaCerrado(): Promise<boolean> {
  const { fechaActivaISO } = await calcFechaActiva();
  const { rows } = await pool.query(
    `SELECT estado FROM cierre_operativo_diario WHERE fecha = $1`,
    [fechaActivaISO]
  );
  return rows[0]?.estado === 'cerrado';
}

// ─── GET /api/operaciones/cierre-hoy ─────────────────────────────────────────
// Estado de la fecha activa + resumen de cobertura en vivo + advertencias
operacionesRouter.get("/operaciones/cierre-hoy", async (req, res) => {
  try {
    const { fechaActivaISO, fechaActivaStr, esFechaFutura, cierreDeHoy } = await calcFechaActiva();

    // Cierre de la fecha activa (si existe — normalmente null cuando esFechaFutura)
    const { rows: cierreActivaRows } = await pool.query(
      `SELECT * FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaActivaISO]
    );
    const cierreActiva = cierreActivaRows[0] ?? null;

    const { rows: puestos } = await pool.query(`
      SELECT id, nombre, cliente_nombre, estado, agente_id, titular_employee_id
      FROM puestos_operativos WHERE activo = TRUE
    `);

    const totalPuestos        = puestos.length;
    const cubiertos           = puestos.filter((p: any) => p.estado === 'cubierto').length;
    const descubiertos        = totalPuestos - cubiertos;
    const cubiertosPorTitular = puestos.filter((p: any) => p.agente_id && p.agente_id === p.titular_employee_id).length;
    const cubiertosPorRelevo  = puestos.filter((p: any) => p.agente_id && p.agente_id !== p.titular_employee_id).length;

    const { rows: movHoy } = await pool.query(`
      SELECT tipo, motivo, COUNT(*) AS cantidad
      FROM movimientos_operativos
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = $1
      GROUP BY tipo, motivo
    `, [fechaActivaISO]);

    const ausencias = movHoy
      .filter((m: any) => m.motivo === 'falta')
      .reduce((acc: number, m: any) => acc + parseInt(m.cantidad), 0);

    const { rows: relevosRows } = await pool.query(`
      SELECT COUNT(*) AS cantidad FROM movimientos_operativos
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = $1
        AND tipo = 'sustitucion' AND (motivo IS NULL OR motivo = '')
    `, [fechaActivaISO]);
    const relevossinMotivo = parseInt(relevosRows[0]?.cantidad ?? '0');

    // Puestos cubiertos sin tramos registrados en cobertura_segmentos
    const { rows: sinSegmentos } = await pool.query(`
      SELECT COUNT(*)::int AS cantidad
      FROM puestos_operativos po
      WHERE po.activo = TRUE AND po.estado = 'cubierto'
        AND NOT EXISTS (
          SELECT 1 FROM cobertura_segmentos cs
          WHERE cs.puesto_id = po.id
            AND cs.fecha = $1
        )
    `, [fechaActivaISO]);
    const puestosSinTramos = sinSegmentos[0]?.cantidad ?? 0;

    const advertencias: string[] = [];
    if (descubiertos > 0)     advertencias.push(`${descubiertos} puesto${descubiertos !== 1 ? 's' : ''} descubierto${descubiertos !== 1 ? 's' : ''}`);
    if (relevossinMotivo > 0) advertencias.push(`${relevossinMotivo} relevo${relevossinMotivo !== 1 ? 's' : ''} sin motivo registrado`);
    if (puestosSinTramos > 0) advertencias.push(`${puestosSinTramos} puesto${puestosSinTramos !== 1 ? 's' : ''} cubierto${puestosSinTramos !== 1 ? 's' : ''} sin tramos de cobertura registrados`);

    // Días pasados sin cierre: todos los días desde el primer cierre registrado
    // hasta ayer que NO están marcados como 'cerrado'.
    const { rows: pendientesRows } = await pool.query(`
      SELECT d::date::text AS fecha
      FROM generate_series(
        COALESCE(
          (SELECT MIN(fecha) FROM cierre_operativo_diario),
          $1::date
        ),
        $1::date - INTERVAL '1 day',
        '1 day'::interval
      ) AS s(d)
      WHERE NOT EXISTS (
        SELECT 1 FROM cierre_operativo_diario cod
        WHERE cod.fecha = d::date AND cod.estado = 'cerrado'
      )
      ORDER BY fecha
    `, [todayGT()]);

    const diasPendientesCierre = pendientesRows.map((r: any) => ({
      fecha:     r.fecha as string,
      fechaStr:  isoADDMMYYYY(r.fecha as string),
    }));

    // Días pasados que SÍ están explícitamente cerrados (para que el frontend
    // pueda distinguir "día cerrado → solo lectura" vs "día abierto/sin registro → editable").
    const { rows: cerradosRows } = await pool.query(`
      SELECT fecha::text AS fecha
      FROM cierre_operativo_diario
      WHERE estado = 'cerrado' AND fecha < $1::date
      ORDER BY fecha
    `, [todayGT()]);

    const diasCerrados: string[] = cerradosRows.map((r: any) =>
      (r.fecha as string).substring(0, 10)
    );

    res.json({
      estado:         cierreActiva?.estado ?? 'abierto',
      cierre:         cierreActiva ?? null,
      fechaActiva:    fechaActivaISO,
      fechaActivaStr,
      esFechaFutura,
      cierreDeHoy:    cierreDeHoy ?? null,
      resumen: {
        totalPuestos,
        cubiertos,
        descubiertos,
        cubiertosPorTitular,
        cubiertosPorRelevo,
        ausencias,
        horasExtra: 0,
      },
      advertencias,
      diasPendientesCierre,
      diasCerrados,
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierre-hoy error");
    res.status(500).json({ error: "Error al consultar estado de cierre" });
  }
});

// ─── POST /api/operaciones/cierre ────────────────────────────────────────────
// Cerrar la fecha activa o una fecha pasada (retroactivo, solo supervisor/admin).
//
// Body:
//   confirmacion  : string  — "CERRAR DD/MM/YYYY" (fecha a cerrar)
//   comentario    : string? — Motivo / nota libre
//   usuario       : string  — Nombre del usuario
//   usuarioId     : number? — ID del usuario
//   rol           : string  — Rol del usuario
//   fecha         : string? — "YYYY-MM-DD". Si no se envía → cierra la fecha activa.
//                             Si es pasada → cierre retroactivo (requiere admin/supervisor).
//                             Si es futura → rechazado.
// ─── Helper: calcula responsable de turno en zona (para sync vehículos) ──────
async function calcularResponsableTurnoLocal(zonaId: number, fecha: string): Promise<any | null> {
  const { rows } = await pool.query(`
    SELECT
      e.id, e.nombre_completo, e.tipo_personal,
      t.id AS tipo_turno_id, t.nombre AS turno_nombre,
      t.tipo_ciclo, t.horas_trabajo, t.horas_descanso,
      eoa.fecha_inicio AS fecha_inicio_ciclo
    FROM employee_operational_assignments eoa
    JOIN employees e ON e.id = eoa.employee_id
    LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
    WHERE eoa.zona_operativa_id = $1
      AND eoa.activa = TRUE
      AND e.estado_laboral = 'activo'
      AND e.tipo_personal IN ('supervisor','jefe_servicio')
    ORDER BY e.nombre_completo
  `, [zonaId]);
  for (const sv of rows) {
    if (!sv.tipo_ciclo || !sv.horas_trabajo || !sv.fecha_inicio_ciclo) continue;
    const turno = {
      id: sv.tipo_turno_id ?? 0, nombre: sv.turno_nombre ?? "",
      tipo_ciclo: sv.tipo_ciclo,
      horas_trabajo:  Number(sv.horas_trabajo),
      horas_descanso: Number(sv.horas_descanso ?? sv.horas_trabajo),
    };
    const fechaStr = sv.fecha_inicio_ciclo instanceof Date
      ? sv.fecha_inicio_ciclo.toISOString().slice(0, 10)
      : String(sv.fecha_inicio_ciclo).slice(0, 10);
    const estado = calcularEstadoCiclo(turno, fechaStr, fecha);
    if (estado.trabaja) return sv;
  }
  return null;
}

// ─── Helper: ejecuta sync de custodias al cierre y escribe auditoría ─────────
async function sincronizarCustodiasAlCierre(
  fecha: string,
  cierreId: number,
  snapshotPuestos: any[],
  usuario: string,
  usuarioId: number | null | undefined,
): Promise<{ armas: any[]; vehiculos: any[]; totalCambios: number }> {
  const resultadosArmas: any[] = [];
  const resultadosVehiculos: any[] = [];

  // ── Armas: usa agente real del snapshot ────────────────────────────────────
  const { rows: armas } = await pool.query(`
    SELECT a.id, a.codigo, a.puesto_id,
           po.nombre AS puesto_nombre
    FROM armas a
    JOIN puestos_operativos po ON po.id = a.puesto_id
    WHERE a.activo = TRUE AND a.puesto_id IS NOT NULL
  `);

  // índice snapshot: puesto_id → agente_id
  const snapMap = new Map<number, { agente_id: number | null; agente_nombre: string | null }>();
  for (const p of snapshotPuestos) {
    snapMap.set(Number(p.id), { agente_id: p.agente_id ?? null, agente_nombre: p.agente_nombre ?? null });
  }

  for (const arma of armas) {
    const snap = snapMap.get(Number(arma.puesto_id));
    const nuevoId = snap?.agente_id ?? null;
    if (!nuevoId) {
      resultadosArmas.push({ codigo: arma.codigo, cambio: false, motivo: "Puesto sin agente al cierre" });
      continue;
    }

    const { rows: custRows } = await pool.query(
      `SELECT id, employee_id, (SELECT nombre_completo FROM employees WHERE id = employee_id) AS nombre
       FROM arma_custodia WHERE arma_id=$1 AND fecha_fin IS NULL`,
      [arma.id]
    );
    const custActual = custRows[0] ?? null;
    if (custActual && Number(custActual.employee_id) === Number(nuevoId)) {
      resultadosArmas.push({ codigo: arma.codigo, cambio: false, motivo: "Sin cambio" });
      continue;
    }

    const { rows: eNuevo } = await pool.query(`SELECT nombre_completo FROM employees WHERE id=$1`, [nuevoId]);
    const nombreNuevo = eNuevo[0]?.nombre_completo ?? null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (custActual) {
        await client.query(`UPDATE arma_custodia SET fecha_fin=NOW() WHERE id=$1`, [custActual.id]);
      }
      await client.query(`
        INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
        VALUES ($1,$2,$3,'cierre_operativo',$4,$5)
      `, [arma.id, nuevoId, arma.puesto_id, `Custodia sincronizada al cierre — ${fecha}`, usuario]);
      await client.query(`
        INSERT INTO custodia_sync_log
          (cierre_id,fecha,tipo_activo,activo_id,activo_codigo,
           custodio_anterior_id,custodio_anterior_nombre,
           custodio_nuevo_id,custodio_nuevo_nombre,
           referencia_nombre,origen,usuario,usuario_id)
        VALUES ($1,$2,'arma',$3,$4,$5,$6,$7,$8,$9,'cierre_operativo',$10,$11)
      `, [
        cierreId, fecha, arma.id, arma.codigo,
        custActual?.employee_id ?? null, custActual?.nombre ?? null,
        nuevoId, nombreNuevo,
        arma.puesto_nombre, usuario, usuarioId ?? null,
      ]);
      await client.query("COMMIT");
      resultadosArmas.push({
        codigo: arma.codigo, cambio: true,
        custodioAnteriorNombre: custActual?.nombre ?? "(Sin custodio)",
        custodioNuevoNombre: nombreNuevo,
      });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      resultadosArmas.push({ codigo: arma.codigo, cambio: false, error: e.message });
    } finally {
      client.release();
    }
  }

  // ── Vehículos: usa motor de turnos para la fecha del cierre ────────────────
  const { rows: vehiculos } = await pool.query(`
    SELECT v.id, v.placa, v.zona_operativa_id,
           oz.nombre AS zona_nombre
    FROM vehiculos v
    JOIN operational_zones oz ON oz.id = v.zona_operativa_id
    WHERE v.activo = TRUE AND v.zona_operativa_id IS NOT NULL
  `);

  for (const v of vehiculos) {
    const responsable = await calcularResponsableTurnoLocal(v.zona_operativa_id, fecha);
    if (!responsable) {
      resultadosVehiculos.push({ placa: v.placa, cambio: false, motivo: "Sin responsable en zona" });
      continue;
    }

    const { rows: custRows } = await pool.query(
      `SELECT id, employee_id, (SELECT nombre_completo FROM employees WHERE id = employee_id) AS nombre
       FROM vehiculo_custodia WHERE vehiculo_id=$1 AND fecha_fin IS NULL`,
      [v.id]
    );
    const custActual = custRows[0] ?? null;
    if (custActual && Number(custActual.employee_id) === Number(responsable.id)) {
      resultadosVehiculos.push({ placa: v.placa, cambio: false, motivo: "Sin cambio" });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (custActual) {
        await client.query(`UPDATE vehiculo_custodia SET fecha_fin=NOW() WHERE id=$1`, [custActual.id]);
      }
      await client.query(`
        INSERT INTO vehiculo_custodia (vehiculo_id, employee_id, zona_operativa_id, tipo_relevo, notas, registrado_por)
        VALUES ($1,$2,$3,'cierre_operativo',$4,$5)
      `, [v.id, responsable.id, v.zona_operativa_id, `Custodia sincronizada al cierre — ${fecha}`, usuario]);
      await client.query(`
        INSERT INTO custodia_sync_log
          (cierre_id,fecha,tipo_activo,activo_id,activo_codigo,
           custodio_anterior_id,custodio_anterior_nombre,
           custodio_nuevo_id,custodio_nuevo_nombre,
           referencia_nombre,origen,usuario,usuario_id)
        VALUES ($1,$2,'vehiculo',$3,$4,$5,$6,$7,$8,$9,'cierre_operativo',$10,$11)
      `, [
        cierreId, fecha, v.id, v.placa,
        custActual?.employee_id ?? null, custActual?.nombre ?? null,
        responsable.id, responsable.nombre_completo,
        v.zona_nombre, usuario, usuarioId ?? null,
      ]);
      await client.query("COMMIT");
      resultadosVehiculos.push({
        placa: v.placa, cambio: true,
        custodioAnteriorNombre: custActual?.nombre ?? "(Sin custodio)",
        custodioNuevoNombre: responsable.nombre_completo,
      });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      resultadosVehiculos.push({ placa: v.placa, cambio: false, error: e.message });
    } finally {
      client.release();
    }
  }

  return {
    armas: resultadosArmas,
    vehiculos: resultadosVehiculos,
    totalCambios:
      resultadosArmas.filter((r: any) => r.cambio).length +
      resultadosVehiculos.filter((r: any) => r.cambio).length,
  };
}

// ─── GET /api/operaciones/cierre/preview-custodias ────────────────────────────
// Preview sin aplicar cambios: qué custodias cambiarían al cerrar.
// ?fecha=YYYY-MM-DD (opcional; por defecto fecha activa de hoy)
operacionesRouter.get("/operaciones/cierre/preview-custodias", async (req, res) => {
  try {
    const fechaParam = req.query.fecha as string | undefined;
    const fecha = (fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) ? fechaParam : todayGT();

    // Armas: compara custodio actual con agente que cubre el puesto hoy
    const { rows: armasRows } = await pool.query(`
      SELECT
        a.id, a.codigo, a.puesto_id,
        po.nombre           AS puesto_nombre,
        po.cliente_nombre,
        po.agente_id        AS nuevo_custodio_id,
        e_nuevo.nombre_completo AS nuevo_custodio_nombre,
        ac.employee_id      AS custodio_actual_id,
        e_actual.nombre_completo AS custodio_actual_nombre
      FROM armas a
      JOIN puestos_operativos po     ON po.id = a.puesto_id
      LEFT JOIN arma_custodia ac     ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees e_actual   ON e_actual.id = ac.employee_id
      LEFT JOIN employees e_nuevo    ON e_nuevo.id  = po.agente_id
      WHERE a.activo = TRUE AND a.puesto_id IS NOT NULL
    `);

    const armasCambios = armasRows
      .filter((r: any) => r.nuevo_custodio_id && String(r.custodio_actual_id) !== String(r.nuevo_custodio_id))
      .map((r: any) => ({
        tipo: 'arma' as const,
        id: r.id,
        codigo: r.codigo,
        referencaNombre: r.puesto_nombre,
        clienteNombre: r.cliente_nombre,
        custodioAnteriorNombre: r.custodio_actual_nombre ?? '(Sin custodio)',
        custodioNuevoNombre: r.nuevo_custodio_nombre,
      }));

    // Vehículos: compara custodio actual con responsable de zona según motor de ciclos
    const { rows: vehiculosRows } = await pool.query(`
      SELECT
        v.id, v.placa, v.zona_operativa_id,
        oz.nombre AS zona_nombre,
        vc.employee_id AS custodio_actual_id,
        e_actual.nombre_completo AS custodio_actual_nombre
      FROM vehiculos v
      JOIN operational_zones oz      ON oz.id = v.zona_operativa_id
      LEFT JOIN vehiculo_custodia vc ON vc.vehiculo_id = v.id AND vc.fecha_fin IS NULL
      LEFT JOIN employees e_actual   ON e_actual.id = vc.employee_id
      WHERE v.activo = TRUE AND v.zona_operativa_id IS NOT NULL
    `);

    const vehiculosCambios: any[] = [];
    for (const v of vehiculosRows) {
      const responsable = await calcularResponsableTurnoLocal(v.zona_operativa_id, fecha);
      if (!responsable) continue;
      if (v.custodio_actual_id && String(v.custodio_actual_id) === String(responsable.id)) continue;
      vehiculosCambios.push({
        tipo: 'vehiculo',
        id: v.id,
        codigo: v.placa,
        referencaNombre: v.zona_nombre,
        custodioAnteriorNombre: v.custodio_actual_nombre ?? '(Sin custodio)',
        custodioNuevoNombre: responsable.nombre_completo,
      });
    }

    res.json({
      fecha,
      armas: armasCambios,
      vehiculos: vehiculosCambios,
      totalCambios: armasCambios.length + vehiculosCambios.length,
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierre/preview-custodias error");
    res.status(500).json({ error: "Error al calcular preview de custodias" });
  }
});

// ─── POST /api/operaciones/cierre ─────────────────────────────────────────────
operacionesRouter.post("/operaciones/cierre", async (req, res) => {
  const { confirmacion, comentario, usuario, usuarioId, rol, fecha: fechaSolicitada, sincronizarCustodias } = req.body;

  if (!['admin', 'supervisor'].includes(rol)) {
    return res.status(403).json({ error: 'Solo supervisores y administradores pueden cerrar el día' });
  }

  try {
    const todayISO = todayGT();

    // ── Determinar fecha a cerrar y si es retroactiva ──────────────────────
    let fechaACerrarISO: string;
    let esRetroactivo: boolean;

    if (fechaSolicitada && fechaSolicitada !== todayISO) {
      if (fechaSolicitada > todayISO) {
        return res.status(400).json({ error: 'No se puede cerrar una fecha futura' });
      }
      // Cierre retroactivo de una fecha pasada
      const diasAtras = Math.floor(
        (new Date(todayISO).getTime() - new Date(fechaSolicitada).getTime()) / 86_400_000
      );
      // Supervisor puede cerrar hasta 7 días atrás; admin sin límite
      if (rol === 'supervisor' && diasAtras > 7) {
        return res.status(403).json({
          error: `Supervisores solo pueden cerrar hasta 7 días atrás (esta fecha tiene ${diasAtras} días). Contacta a un administrador.`,
        });
      }
      fechaACerrarISO = fechaSolicitada;
      esRetroactivo = true;
    } else {
      // Cierre normal: usar la fecha activa calculada por calcFechaActiva()
      const { fechaActivaISO } = await calcFechaActiva();
      fechaACerrarISO = fechaActivaISO;
      esRetroactivo = false;
    }

    const fechaACerrarStr = isoADDMMYYYY(fechaACerrarISO);

    // ── Validar confirmación ────────────────────────────────────────────────
    const confirmacionEsperada = `CERRAR ${fechaACerrarStr}`;
    if (confirmacion !== confirmacionEsperada) {
      return res.status(400).json({ error: `Texto incorrecto. Escribe exactamente: ${confirmacionEsperada}` });
    }

    // ── Verificar que no esté ya cerrado ───────────────────────────────────
    const { rows: existente } = await pool.query(
      `SELECT estado FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaACerrarISO]
    );
    if (existente[0]?.estado === 'cerrado') {
      return res.status(400).json({ error: `El día ${fechaACerrarStr} ya está cerrado` });
    }

    // ── Snapshot de cobertura ──────────────────────────────────────────────
    // Retroactivo: reconstruir desde cobertura_segmentos de esa fecha
    // Normal: estado actual del pizarrón
    let snapshotPuestos: any[];

    if (esRetroactivo) {
      // Reconstruir puestos cubiertos desde segmentos históricos de la fecha
      const { rows: segSnap } = await pool.query(`
        SELECT DISTINCT ON (cs.puesto_id)
               po.id, po.nombre, po.cliente_nombre, po.cliente_id,
               'cubierto'           AS estado,
               cs.employee_id       AS agente_id,
               cs.empleado_nombre   AS agente_nombre,
               -- TH: titular efectivo para la fecha del cierre (histórico con fallback)
               COALESCE(
                 (SELECT pth.employee_id FROM puesto_titular_historico pth
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= $1::date
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_employee_id
               ) AS titular_employee_id,
               COALESCE(
                 (SELECT e2.nombre_completo
                  FROM puesto_titular_historico pth
                  JOIN employees e2 ON e2.id = pth.employee_id
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= $1::date
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_nombre
               ) AS titular_nombre,
               po.turno, po.horario, po.jornada, po.notas, po.orden,
               po.zona_operativa_id, oz.nombre AS zona_nombre,
               po.sede_id,          sedes.nombre AS sede_nombre
        FROM cobertura_segmentos cs
        JOIN puestos_operativos po   ON po.id = cs.puesto_id
        LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
        LEFT JOIN client_sedes sedes   ON sedes.id = po.sede_id
        WHERE cs.fecha = $1
        ORDER BY cs.puesto_id, cs.hora_inicio
      `, [fechaACerrarISO]);
      snapshotPuestos = segSnap;
    } else {
      // Estado actual del pizarrón — titular histórico de hoy
      const { rows: puestoSnap } = await pool.query(`
        SELECT po.id, po.nombre, po.cliente_nombre, po.cliente_id, po.estado,
               po.agente_id, po.agente_nombre,
               -- TH: titular efectivo para hoy (histórico con fallback)
               COALESCE(
                 (SELECT pth.employee_id FROM puesto_titular_historico pth
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= CURRENT_DATE
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= CURRENT_DATE)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_employee_id
               ) AS titular_employee_id,
               COALESCE(
                 (SELECT e2.nombre_completo
                  FROM puesto_titular_historico pth
                  JOIN employees e2 ON e2.id = pth.employee_id
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= CURRENT_DATE
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= CURRENT_DATE)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_nombre
               ) AS titular_nombre,
               po.turno, po.horario, po.jornada, po.notas, po.orden,
               po.zona_operativa_id, oz.nombre AS zona_nombre,
               po.sede_id, sedes.nombre AS sede_nombre
        FROM puestos_operativos po
        LEFT JOIN operational_zones oz  ON oz.id = po.zona_operativa_id
        LEFT JOIN client_sedes sedes    ON sedes.id = po.sede_id
        WHERE po.activo = TRUE
        ORDER BY po.cliente_nombre, po.orden, po.nombre
      `);
      snapshotPuestos = puestoSnap;
    }

    const totalPuestos        = snapshotPuestos.length;
    const cubiertos           = snapshotPuestos.filter((p: any) => p.estado === 'cubierto').length;
    const descubiertos        = totalPuestos - cubiertos;
    const cubiertosPorTitular = snapshotPuestos.filter((p: any) => p.agente_id && p.agente_id === p.titular_employee_id).length;
    const cubiertosPorRelevo  = snapshotPuestos.filter((p: any) => p.agente_id && p.agente_id !== p.titular_employee_id).length;

    // Movimientos de la fecha cerrada (históricos)
    const { rows: movDia } = await pool.query(`
      SELECT tipo, motivo, agente_saliente_nombre, agente_entrante_nombre,
             puesto_nombre, cliente_nombre, fecha_hora
      FROM movimientos_operativos
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = $1::date
      ORDER BY fecha_hora
    `, [fechaACerrarISO]);
    const ausencias = movDia.filter((m: any) => m.motivo === 'falta').length;

    const resumen = {
      totalPuestos, cubiertos, descubiertos,
      cubiertosPorTitular, cubiertosPorRelevo,
      ausencias, horasExtra: 0,
      snapshotPuestos,
      movimientosHoy:   movDia,
      fechaCierre:      new Date().toISOString(),
      retroactivo:      esRetroactivo,
      cerradoPor:       usuario,
      cerradoEn:        new Date().toISOString(),
    };

    const { rows: cierreRows } = await pool.query(`
      INSERT INTO cierre_operativo_diario
        (fecha, estado, resumen_json, cerrado_por_id, cerrado_por, cerrado_en, comentario, retroactivo)
      VALUES ($1, 'cerrado', $2, $3, $4, NOW(), $5, $6)
      ON CONFLICT (fecha) DO UPDATE
        SET estado        = 'cerrado',
            resumen_json  = $2,
            cerrado_por_id = $3,
            cerrado_por   = $4,
            cerrado_en    = NOW(),
            comentario    = $5,
            retroactivo   = $6,
            updated_at    = NOW()
      RETURNING *
    `, [fechaACerrarISO, JSON.stringify(resumen), usuarioId ?? null, usuario ?? 'sistema', comentario ?? null, esRetroactivo]);

    // ── Auditoría ──────────────────────────────────────────────────────────
    const accionAudit  = esRetroactivo ? 'cerrar_retroactivo' : 'cerrar';
    const detalleAudit = esRetroactivo
      ? `Cierre RETROACTIVO de ${fechaACerrarStr} realizado por ${usuario ?? 'sistema'} el ${isoADDMMYYYY(todayISO)}.${comentario ? ` Motivo: ${comentario}` : ''}`
      : `Día ${fechaACerrarStr} cerrado.${comentario ? ` Comentario: ${comentario}` : ''}`;

    await pool.query(`
      INSERT INTO cierre_auditoria (cierre_id, accion, user_id, user_nombre, detalle)
      VALUES ($1, $2, $3, $4, $5)
    `, [cierreRows[0].id, accionAudit, usuarioId ?? null, usuario ?? 'sistema', detalleAudit]);

    // ── Generar eventos RRHH diferidos para puestos que siguen "faltando" ──
    let faltasDiferidas = 0;
    try {
      const { rows: puestosFaltando } = await pool.query(`
        SELECT po.id, po.nombre, po.cliente_nombre, po.falta_employee_id, po.falta_motivo, po.falta_notas, po.falta_usuario,
               COALESCE(t.horas_trabajo, 24) AS turno_horas
        FROM puestos_operativos po
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        WHERE po.estado_operativo_puesto = 'faltando'
          AND po.falta_employee_id IS NOT NULL
      `);

      for (const pf of puestosFaltando) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const { rows: yaExiste } = await client.query(`
            SELECT id FROM eventos_rrhh
            WHERE employee_id = $1
              AND DATE(fecha) = $2
              AND tipo_evento = 'falta'
              AND estado != 'anulado'
              AND puesto_nombre = $3
          `, [pf.falta_employee_id, fechaACerrarISO, pf.nombre]);

          let eventoId: number | null = null;

          if (yaExiste.length === 0) {
            const { rows: empRows } = await client.query(
              `SELECT nombre_completo FROM employees WHERE id = $1`,
              [pf.falta_employee_id]
            );
            const empNombre = empRows[0]?.nombre_completo ?? "Colaborador";

            const { rows: evRows } = await client.query(`
              INSERT INTO eventos_rrhh (employee_id, employee_nombre, tipo_evento, fecha, observaciones,
                usuario_generador, puesto_nombre, cliente_nombre, generado_desde, estado)
              VALUES ($1, $2, 'falta', $3::date, $4, $5, $6, $7, 'cierre_operativo', 'pendiente_aprobacion')
              RETURNING id
            `, [
              pf.falta_employee_id, empNombre, fechaACerrarISO,
              pf.falta_notas ?? `${pf.falta_motivo ?? "inasistencia"} — ${pf.nombre} (${pf.cliente_nombre})`,
              pf.falta_usuario ?? usuario ?? 'sistema',
              pf.nombre, pf.cliente_nombre,
            ]);
            eventoId = evRows[0]?.id ?? null;
          } else {
            eventoId = yaExiste[0].id;
          }

          const { rows: empRows2 } = await client.query(
            `SELECT nombre_completo FROM employees WHERE id = $1`,
            [pf.falta_employee_id]
          );
          const empNombre2 = empRows2[0]?.nombre_completo ?? "Colaborador";

          const turnoHoras = parseFloat(pf.turno_horas) || 24;
          const diasDescFalta = turnoHoras >= 24 ? 3 : 2;

          await client.query(`
            INSERT INTO novedades_nomina_diarias
              (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
               falta, descuento_dia, impacto_nomina, requiere_revision_rrhh,
               tipo_novedad, evento_rrhh_id, puesto_titular_id, puesto_titular_nombre, fuente,
               dias_descuento)
            VALUES ($1, $2, $3, FALSE, 0, 0, FALSE, FALSE, 'pendiente', TRUE,
                    'falta_total', $6, $4, $5, 'cierre_falta_diferida', $7)
            ON CONFLICT (fecha, employee_id) DO UPDATE SET
              trabajo_dia            = FALSE,
              horas_trabajadas       = 0,
              tipo_novedad           = COALESCE(novedades_nomina_diarias.tipo_novedad, 'falta_total'),
              evento_rrhh_id         = COALESCE(novedades_nomina_diarias.evento_rrhh_id, EXCLUDED.evento_rrhh_id),
              dias_descuento         = EXCLUDED.dias_descuento,
              impacto_nomina         = CASE
                WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                THEN novedades_nomina_diarias.impacto_nomina
                ELSE 'pendiente'
              END,
              requiere_revision_rrhh = CASE
                WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                THEN novedades_nomina_diarias.requiere_revision_rrhh
                ELSE TRUE
              END,
              updated_at             = NOW()
          `, [fechaACerrarISO, pf.falta_employee_id, empNombre2, pf.id, pf.nombre, eventoId, diasDescFalta]);

          await client.query('COMMIT');

          if (yaExiste.length === 0) faltasDiferidas++;
          logger.info({ puestoId: pf.id, employeeId: pf.falta_employee_id, fecha: fechaACerrarISO },
            yaExiste.length === 0 ? "Falta diferida materializada al cierre" : "Falta diferida: novedad backfill al cierre");
        } catch (txErr) {
          await client.query('ROLLBACK');
          logger.warn({ txErr, puestoId: pf.id }, "Falta diferida: transacción falló (no bloqueante)");
        } finally {
          client.release();
        }
      }

      if (faltasDiferidas > 0) {
        logger.info({ faltasDiferidas }, "Faltas diferidas generadas al cierre del pizarrón");
      }
    } catch (faltaErr) {
      logger.warn({ faltaErr }, "Error al generar faltas diferidas al cierre (no bloqueante)");
    }

    // ── Generar novedades de nómina desde segmentos de cobertura ──────────
    const novedadesGeneradas = await generarNovedades(fechaACerrarISO, cierreRows[0].id);

    // ── Sincronización de custodias (opcional) ─────────────────────────────
    let syncCustodias: { armas: any[]; vehiculos: any[]; totalCambios: number } | null = null;
    if (sincronizarCustodias) {
      try {
        syncCustodias = await sincronizarCustodiasAlCierre(
          fechaACerrarISO, cierreRows[0].id, snapshotPuestos,
          usuario ?? 'sistema', usuarioId ?? null
        );
        logger.info({ totalCambios: syncCustodias.totalCambios }, "Custodias sincronizadas al cierre");
      } catch (syncErr) {
        logger.error({ syncErr }, "Error al sincronizar custodias al cierre (no bloqueante)");
      }
    }

    const faltasMsg = faltasDiferidas > 0 ? ` ${faltasDiferidas} falta(s) pendiente(s) generada(s).` : "";
    const mensaje = esRetroactivo
      ? `Cierre retroactivo de ${fechaACerrarStr} completado. ${novedadesGeneradas} novedad(es) de nómina generada(s).${faltasMsg}`
      : `Día ${fechaACerrarStr} cerrado. ${novedadesGeneradas} novedad(es) de nómina generada(s).${faltasMsg}`;

    logger.info({ usuario, fecha: fechaACerrarStr, esRetroactivo, novedadesGeneradas, faltasDiferidas }, "Día operativo cerrado");
    res.json({ ok: true, cierre: cierreRows[0], resumen, novedadesGeneradas, faltasDiferidas, retroactivo: esRetroactivo, mensaje, syncCustodias });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/cierre error");
    res.status(500).json({ error: "Error al cerrar el día" });
  }
});

// ─── POST /api/operaciones/reabrir ───────────────────────────────────────────
// Reabrir una fecha cerrada (solo admin). Acepta `fecha` ISO opcional; por defecto CURRENT_DATE.
operacionesRouter.post("/operaciones/reabrir", async (req, res) => {
  const { confirmacion, motivo, usuario, usuarioId, rol, fecha } = req.body;

  if (rol !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden reabrir el día' });
  }
  if (!motivo?.trim()) {
    return res.status(400).json({ error: 'El motivo de reapertura es obligatorio' });
  }

  try {
    // Determinar la fecha a reabrir
    let fechaISO: string;
    let fechaStr: string;
    if (fecha) {
      fechaISO = (fecha as string).substring(0, 10);
      fechaStr = isoADDMMYYYY(fechaISO);
    } else {
      fechaISO = todayGT();
      fechaStr = isoADDMMYYYY(fechaISO);
    }

    const confirmacionEsperada = `REABRIR ${fechaStr}`;
    if (confirmacion !== confirmacionEsperada) {
      return res.status(400).json({ error: `Texto incorrecto. Escribe exactamente: ${confirmacionEsperada}` });
    }

    const { rows: cierreRows } = await pool.query(
      `SELECT * FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaISO]
    );
    if (!cierreRows[0] || cierreRows[0].estado !== 'cerrado') {
      return res.status(400).json({ error: 'El día operativo no está cerrado' });
    }

    const { rows: updated } = await pool.query(`
      UPDATE cierre_operativo_diario
      SET estado='abierto', reabierto_por_id=$1, reabierto_por=$2,
          reabierto_en=NOW(), motivo_reapertura=$3, updated_at=NOW()
      WHERE fecha = $4
      RETURNING *
    `, [usuarioId ?? null, usuario ?? 'sistema', motivo, fechaISO]);

    await pool.query(`
      INSERT INTO cierre_auditoria (cierre_id, accion, user_id, user_nombre, detalle)
      VALUES ($1, 'reabrir', $2, $3, $4)
    `, [updated[0].id, usuarioId ?? null, usuario ?? 'sistema', `Reapertura: ${motivo}`]);

    logger.info({ usuario, fecha: fechaStr, motivo }, "Día operativo reabierto");
    res.json({ ok: true, cierre: updated[0] });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/reabrir error");
    res.status(500).json({ error: "Error al reabrir el día" });
  }
});

// ─── GET /api/operaciones/cierres ────────────────────────────────────────────
// Historial de cierres operativos (últimos 90, ordenados por fecha DESC)
operacionesRouter.get("/operaciones/cierres", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        cod.id,
        cod.fecha::text                                                           AS fecha_iso,
        TO_CHAR(cod.fecha, 'DD-MM-YYYY')                                          AS fecha_str,
        cod.estado,
        cod.cerrado_por,
        TO_CHAR(cod.cerrado_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YY HH24:MI') AS cerrado_en_str,
        cod.reabierto_por,
        TO_CHAR(cod.reabierto_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YY HH24:MI') AS reabierto_en_str,
        cod.motivo_reapertura,
        cod.comentario,
        cod.retroactivo,
        (cod.resumen_json->>'totalPuestos')::int  AS total_puestos,
        (cod.resumen_json->>'cubiertos')::int     AS cubiertos,
        (cod.resumen_json->>'descubiertos')::int  AS descubiertos,
        (cod.resumen_json->>'ausencias')::int     AS ausencias
      FROM cierre_operativo_diario cod
      ORDER BY cod.fecha DESC
      LIMIT 90
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierres error");
    res.status(500).json({ error: "Error al cargar historial de cierres" });
  }
});

// ─── GET /api/operaciones/cierres/:fecha ──────────────────────────────────────
// Detalle de un cierre específico por fecha (YYYY-MM-DD) + auditoría
operacionesRouter.get("/operaciones/cierres/:fecha", async (req, res) => {
  try {
    const { fecha } = req.params;

    const { rows: cierreRows } = await pool.query(`
      SELECT
        *,
        TO_CHAR(fecha, 'DD-MM-YYYY')                                                  AS fecha_str,
        TO_CHAR(cerrado_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI')    AS cerrado_en_str,
        TO_CHAR(reabierto_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI')  AS reabierto_en_str
      FROM cierre_operativo_diario
      WHERE fecha = $1
    `, [fecha]);

    if (!cierreRows.length) {
      return res.status(404).json({ error: "No existe cierre para esta fecha" });
    }

    const cierre = cierreRows[0];

    const { rows: auditoria } = await pool.query(`
      SELECT
        id,
        accion,
        user_nombre,
        detalle,
        TO_CHAR(fecha_accion AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI') AS fecha_str,
        fecha_accion
      FROM cierre_auditoria
      WHERE cierre_id = $1
      ORDER BY fecha_accion ASC
    `, [cierre.id]);

    res.json({ cierre, auditoria });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierres/:fecha error");
    res.status(500).json({ error: "Error al cargar detalle del cierre" });
  }
});

// ─── GET /api/operaciones/pizarron-historico/:fecha ──────────────────────────
// Devuelve el pizarrón completo congelado de un día cerrado:
//   - snapshotPuestos del cierre (agrupados por cliente, tal como quedaron)
//   - movimientosHoy del cierre
//   - cobertura_segmentos de esa fecha (tramos de cobertura granulares)
//   - metadata del cierre (cerrado_por, cerrado_en, comentario)
operacionesRouter.get("/operaciones/pizarron-historico/:fecha", async (req, res) => {
  try {
    const { fecha } = req.params;

    const { rows: cierreRows } = await pool.query(`
      SELECT
        *,
        TO_CHAR(fecha, 'DD-MM-YYYY')                                                  AS fecha_str,
        TO_CHAR(cerrado_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI')    AS cerrado_en_str,
        TO_CHAR(reabierto_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI')  AS reabierto_en_str
      FROM cierre_operativo_diario
      WHERE fecha = $1
    `, [fecha]);

    if (!cierreRows.length) {
      return res.status(404).json({ error: "No existe cierre para esta fecha" });
    }

    const cierre = cierreRows[0];
    const resumen = cierre.resumen_json ?? {};
    const snapshotPuestos: any[] = resumen.snapshotPuestos ?? [];
    const movimientosHoy: any[] = resumen.movimientosHoy ?? [];

    // Agrupar puestos por cliente (igual que el tablero vivo)
    const clienteMap: Record<string, { clienteId: number | null; clienteNombre: string; puestos: any[] }> = {};
    for (const p of snapshotPuestos) {
      const key = String(p.cliente_id ?? p.cliente_nombre ?? "Sin cliente");
      if (!clienteMap[key]) {
        clienteMap[key] = {
          clienteId: p.cliente_id ?? null,
          clienteNombre: p.cliente_nombre ?? "Sin cliente",
          puestos: [],
        };
      }
      clienteMap[key].puestos.push(p);
    }
    const tableroHistorico = Object.values(clienteMap);

    // Segmentos de cobertura del día (desde cobertura_segmentos, si existen)
    const { rows: segmentos } = await pool.query(`
      SELECT
        cs.id, cs.puesto_id, cs.employee_id, cs.hora_inicio, cs.hora_fin,
        cs.horas_calculadas, cs.tipo_cobertura, cs.genera_horas_extra,
        e.nombre_completo AS empleado_nombre,
        po.nombre AS puesto_nombre
      FROM cobertura_segmentos cs
      LEFT JOIN employees e ON e.id = cs.employee_id
      LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
      WHERE cs.fecha = $1
      ORDER BY cs.puesto_id, cs.hora_inicio
    `, [fecha]);

    // Stat summary del resumen
    const stats = {
      totalPuestos:        resumen.totalPuestos ?? snapshotPuestos.length,
      cubiertos:           resumen.cubiertos ?? snapshotPuestos.filter((p: any) => p.estado === 'cubierto').length,
      descubiertos:        resumen.descubiertos ?? 0,
      cubiertosPorTitular: resumen.cubiertosPorTitular ?? 0,
      cubiertosPorRelevo:  resumen.cubiertosPorRelevo ?? 0,
      ausencias:           resumen.ausencias ?? 0,
      horasExtra:          resumen.horasExtra ?? 0,
    };

    res.json({
      cierre: {
        id:              cierre.id,
        fecha_iso:       fecha,
        fecha_str:       cierre.fecha_str,
        estado:          cierre.estado,
        cerrado_por:     cierre.cerrado_por,
        cerrado_en_str:  cierre.cerrado_en_str,
        reabierto_por:   cierre.reabierto_por ?? null,
        reabierto_en_str: cierre.reabierto_en_str ?? null,
        motivo_reapertura: cierre.motivo_reapertura ?? null,
        comentario:      cierre.comentario ?? null,
      },
      stats,
      tableroHistorico,
      movimientosHoy,
      segmentos,
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/pizarron-historico/:fecha error");
    res.status(500).json({ error: "Error al cargar el pizarrón histórico" });
  }
});

// ─── GET /api/operaciones/puestos/:id/titular-historico ──────────────────────
// Historial de titulares de un puesto específico
operacionesRouter.get("/operaciones/puestos/:id/titular-historico", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT
         pth.id,
         pth.puesto_id,
         pth.employee_id,
         TO_CHAR(pth.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
         TO_CHAR(pth.fecha_fin,   'YYYY-MM-DD') AS fecha_fin,
         pth.motivo,
         pth.creado_por,
         e.nombre_completo AS empleado_nombre
       FROM puesto_titular_historico pth
       JOIN employees e ON e.id = pth.employee_id
       WHERE pth.puesto_id = $1
       ORDER BY pth.fecha_inicio DESC`,
      [puestoId]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/:id/titular-historico error");
    res.status(500).json({ error: "Error al cargar historial de titularidad" });
  }
});

// ─── GET /api/operaciones/clientes-disponibles ───────────────────────────────
// Lista de clientes para el selector de "Nuevo Puesto"
operacionesRouter.get("/operaciones/clientes-disponibles", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, nombre_comercial, portal_cliente_id FROM clients WHERE estado='activo' ORDER BY nombre`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/clientes-disponibles error");
    res.status(500).json({ error: "Error al cargar clientes" });
  }
});

// ─── PATCH /api/operaciones/puestos/:id/turno ─────────────────────────────────
// Asigna o actualiza el turno y fecha_inicio_ciclo de un puesto operativo.
// Permite dejar tipo_turno_id en null para remover turno (enviar null explícito).
operacionesRouter.patch("/operaciones/puestos/:id/turno", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  const { tipo_turno_id, fecha_inicio_ciclo, hora_entrada } = req.body ?? {};

  // Validación: si se provee un turno, la fecha_inicio_ciclo es obligatoria
  if (tipo_turno_id != null && !fecha_inicio_ciclo) {
    return res.status(400).json({ error: "fecha_inicio_ciclo es requerida al asignar un turno" });
  }

  // Validar formato de fecha
  if (fecha_inicio_ciclo && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio_ciclo)) {
    return res.status(400).json({ error: "fecha_inicio_ciclo debe tener formato YYYY-MM-DD" });
  }

  // Validar hora_entrada: si se provee, debe ser HH:MM
  if (hora_entrada != null && hora_entrada !== "" && !/^\d{2}:\d{2}$/.test(hora_entrada)) {
    return res.status(400).json({ error: "hora_entrada debe tener formato HH:MM" });
  }

  try {
    // Verificar que el puesto existe
    const { rows: puestos } = await pool.query(
      `SELECT id, nombre FROM puestos_operativos WHERE id = $1 AND activo = TRUE`,
      [puestoId]
    );
    if (puestos.length === 0) {
      return res.status(404).json({ error: "Puesto no encontrado" });
    }

    // Verificar que el turno existe (si se asigna uno)
    if (tipo_turno_id != null) {
      const { rows: turnos } = await pool.query(
        `SELECT id, nombre FROM turnos WHERE id = $1 AND activo = TRUE`,
        [tipo_turno_id]
      );
      if (turnos.length === 0) {
        return res.status(404).json({ error: "Turno no encontrado o inactivo" });
      }
    }

    // hora_entrada solo aplica a turnos diarios (< 24h); para alternados se limpia
    const horaEntradaFinal = (tipo_turno_id != null && hora_entrada && hora_entrada !== "")
      ? hora_entrada
      : null;

    const { rows: updated } = await pool.query(`
      UPDATE puestos_operativos
      SET
        tipo_turno_id      = $1,
        fecha_inicio_ciclo = $2,
        hora_entrada       = $3,
        updated_at         = NOW()
      WHERE id = $4
      RETURNING
        id,
        nombre,
        tipo_turno_id,
        fecha_inicio_ciclo,
        hora_entrada
    `, [
      tipo_turno_id ?? null,
      tipo_turno_id != null ? fecha_inicio_ciclo : null,
      horaEntradaFinal,
      puestoId,
    ]);

    // Si hay asignaciones operativas activas para este puesto, actualizarlas también
    if (tipo_turno_id != null) {
      await pool.query(`
        UPDATE employee_operational_assignments
        SET tipo_turno_id = $1
        WHERE puesto_id = $2 AND activa = TRUE
      `, [tipo_turno_id, puestoId]);
    }

    // Obtener datos completos del puesto actualizado con turno
    const { rows: resultado } = await pool.query(`
      SELECT
        po.id,
        po.nombre,
        po.tipo_turno_id,
        po.fecha_inicio_ciclo,
        t.nombre         AS turno_nombre,
        t.horas_trabajo,
        t.horas_descanso,
        (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) AS ciclo_horas,
        COALESCE(t.tipo_ciclo,
          CASE
            WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24
              THEN 'diario'
            ELSE 'alternado'
          END
        ) AS tipo_ciclo
      FROM puestos_operativos po
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      WHERE po.id = $1
    `, [puestoId]);

    logger.info(
      { puestoId, tipo_turno_id, fecha_inicio_ciclo },
      "PATCH /operaciones/puestos/:id/turno: turno actualizado"
    );
    res.json({ ok: true, puesto: resultado[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id/turno error");
    res.status(500).json({ error: "Error al actualizar turno del puesto" });
  }
});

// ─── GET /api/operaciones/puestos/:id/turno ───────────────────────────────────
// Devuelve el turno actual y el estado calculado para una fecha dada
operacionesRouter.get("/operaciones/puestos/:id/turno", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  const fecha = (req.query.fecha as string) || todayGT();

  try {
    const { rows } = await pool.query(`
      SELECT
        po.id,
        po.nombre,
        po.tipo_turno_id,
        TO_CHAR(po.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
        t.nombre         AS turno_nombre,
        t.descripcion    AS turno_descripcion,
        t.horas_trabajo,
        t.horas_descanso,
        (t.horas_trabajo + COALESCE(t.horas_descanso, 0))  AS ciclo_horas,
        COALESCE(t.tipo_ciclo,
          CASE
            WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24 THEN 'diario'
            ELSE 'alternado'
          END
        ) AS tipo_ciclo,
        CEIL(t.horas_trabajo / 24.0)                        AS dias_trabajo,
        CEIL(COALESCE(t.horas_descanso, 0) / 24.0)          AS dias_descanso
      FROM puestos_operativos po
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      WHERE po.id = $1 AND po.activo = TRUE
    `, [puestoId]);

    if (rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });

    const p = rows[0];
    let estado_turno: string | null = null;
    let descanso_por_ciclo = false;
    let disponible_he = false;

    if (p.tipo_turno_id) {
      const ec = calcularEstadoCiclo(
        { id: p.tipo_turno_id, horas_trabajo: p.horas_trabajo, horas_descanso: p.horas_descanso, tipo_ciclo: p.tipo_ciclo },
        p.fecha_inicio_ciclo,
        fecha,
      );
      estado_turno       = ec.trabaja ? "trabajando" : "descansando";
      descanso_por_ciclo = ec.descansoPorCiclo;
      disponible_he      = ec.disponibleHE;
    }

    res.json({ ...p, estado_turno, descanso_por_ciclo, disponible_he, fecha_consultada: fecha });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/:id/turno error");
    res.status(500).json({ error: "Error al obtener turno del puesto" });
  }
});

// ─── GET /api/operaciones/tablero/administracion ──────────────────────────────
// Devuelve personal administrativo (bodega, rrhh, gerencia) con estado de turno.
// ?fecha=YYYY-MM-DD — opcional; si se omite usa la fecha actual.
operacionesRouter.get("/operaciones/tablero/administracion", async (req, res) => {
  const { fecha } = req.query as { fecha?: string };
  const hoy = (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) ? fecha : todayGT();

  try {
    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo,
        e.estado_laboral,
        e.puesto,
        e.area,
        e.sede,
        e.tipo_personal,
        t.id                    AS tipo_turno_id,
        t.nombre                AS turno_nombre,
        t.tipo_ciclo            AS tipo_ciclo_turno,
        t.horas_trabajo         AS horas_trabajo_turno,
        t.horas_descanso        AS horas_descanso_turno,
        eoa.fecha_inicio        AS fecha_inicio_ciclo_turno
      FROM employees e
      LEFT JOIN employee_operational_assignments eoa ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
      WHERE e.tipo_personal IN ('administrativo_bodega', 'administrativo_rrhh', 'gerencia')
        AND e.estado_laboral IN ('activo', 'licencia', 'suspendido')
      ORDER BY
        CASE e.tipo_personal
          WHEN 'gerencia'            THEN 1
          WHEN 'administrativo_rrhh' THEN 2
          WHEN 'administrativo_bodega' THEN 3
          ELSE 4
        END,
        e.nombre_completo
    `);

    const enriquecidos = rows.map((e: any) => {
      if (e.estado_laboral !== 'activo') {
        return { ...e, trabaja_hoy: false, estado_ciclo: e.estado_laboral };
      }
      if (e.tipo_ciclo_turno && e.horas_trabajo_turno && e.fecha_inicio_ciclo_turno) {
        const turnoObj = {
          id: e.tipo_turno_id ?? 0,
          nombre: e.turno_nombre ?? "",
          tipo_ciclo: e.tipo_ciclo_turno,
          horas_trabajo:  Number(e.horas_trabajo_turno),
          horas_descanso: Number(e.horas_descanso_turno ?? e.horas_trabajo_turno),
        };
        const fechaInicioStr = e.fecha_inicio_ciclo_turno instanceof Date
          ? e.fecha_inicio_ciclo_turno.toISOString().slice(0, 10)
          : String(e.fecha_inicio_ciclo_turno).slice(0, 10);
        const estadoHoy = calcularEstadoCiclo(turnoObj, fechaInicioStr, hoy);
        return {
          ...e,
          trabaja_hoy:  estadoHoy.trabaja,
          estado_ciclo: estadoHoy.trabaja ? "trabajando" : "descansando_ciclo",
        };
      }
      return { ...e, trabaja_hoy: null, estado_ciclo: "sin_turno" };
    });

    const grupos = {
      gerencia:             enriquecidos.filter((e: any) => e.tipo_personal === 'gerencia'),
      administrativo_rrhh:  enriquecidos.filter((e: any) => e.tipo_personal === 'administrativo_rrhh'),
      administrativo_bodega: enriquecidos.filter((e: any) => e.tipo_personal === 'administrativo_bodega'),
    };

    res.json({ fecha: hoy, empleados: enriquecidos, grupos });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/tablero/administracion error");
    res.status(500).json({ error: "Error al obtener personal administrativo" });
  }
});

// ─── GET /api/operaciones/puestos/:id/titulares ───────────────────────────────
// Devuelve la lista de titulares activos del puesto con su fecha_inicio_ciclo.
operacionesRouter.get("/operaciones/puestos/:id/titulares", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  try {
    const { rows } = await pool.query(`
      SELECT
        pt.id,
        pt.employee_id,
        pt.orden,
        TO_CHAR(pt.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
        pt.activo,
        e.nombre_completo,
        e.puesto          AS cargo,
        e.estado_laboral
      FROM puesto_titulares pt
      JOIN employees e ON e.id = pt.employee_id
      WHERE pt.puesto_id = $1 AND pt.activo = TRUE
      ORDER BY pt.orden
    `, [puestoId]);

    res.json({ titulares: rows });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/:id/titulares error");
    res.status(500).json({ error: "Error al obtener titulares" });
  }
});

// ─── PUT /api/operaciones/puestos/:id/titulares ───────────────────────────────
// Reemplaza todos los titulares activos del puesto.
// Body: { titulares: [{ employee_id: number, fecha_inicio_ciclo: string }] }
operacionesRouter.put("/operaciones/puestos/:id/titulares", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  const { titulares } = req.body ?? {};
  if (!Array.isArray(titulares)) {
    return res.status(400).json({ error: "Se requiere un arreglo de titulares" });
  }

  for (const t of titulares) {
    if (!t.employee_id || !t.fecha_inicio_ciclo) {
      return res.status(400).json({ error: "Cada titular requiere employee_id y fecha_inicio_ciclo" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.fecha_inicio_ciclo)) {
      return res.status(400).json({ error: "fecha_inicio_ciclo debe tener formato YYYY-MM-DD" });
    }
  }

  try {
    const { rows: puestos } = await pool.query(
      `SELECT id, nombre FROM puestos_operativos WHERE id = $1 AND activo = TRUE`,
      [puestoId]
    );
    if (puestos.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });

    await pool.query(`DELETE FROM puesto_titulares WHERE puesto_id = $1`, [puestoId]);

    if (titulares.length > 0) {
      const params: any[] = [puestoId];
      const values = titulares.map((t: any, i: number) => {
        params.push(t.employee_id, t.fecha_inicio_ciclo, i + 1);
        const base = i * 3 + 2;
        return `($1, $${base}, $${base + 1}, $${base + 2})`;
      }).join(", ");

      await pool.query(
        `INSERT INTO puesto_titulares (puesto_id, employee_id, fecha_inicio_ciclo, orden)
         VALUES ${values}`,
        params
      );

      // Si sólo hay 1 titular, actualizar agente_id/nombre en el puesto también
      if (titulares.length >= 1) {
        const { rows: emp } = await pool.query(
          `SELECT nombre_completo FROM employees WHERE id = $1`,
          [titulares[0].employee_id]
        );
        if (emp.length > 0) {
          await pool.query(`
            UPDATE puestos_operativos
            SET titular_employee_id = $1,
                titular_nombre       = $2,
                fecha_inicio_ciclo   = $3,
                updated_at           = NOW()
            WHERE id = $4
          `, [titulares[0].employee_id, emp[0].nombre_completo, titulares[0].fecha_inicio_ciclo, puestoId]);
        }
      }
    }

    const { rows: resultado } = await pool.query(`
      SELECT pt.id, pt.employee_id, pt.orden,
             TO_CHAR(pt.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
             e.nombre_completo
      FROM puesto_titulares pt
      JOIN employees e ON e.id = pt.employee_id
      WHERE pt.puesto_id = $1 AND pt.activo = TRUE
      ORDER BY pt.orden
    `, [puestoId]);

    logger.info({ puestoId, count: titulares.length }, "PUT /operaciones/puestos/:id/titulares: titulares actualizados");
    res.json({ ok: true, titulares: resultado });
  } catch (err) {
    logger.error({ err }, "PUT /operaciones/puestos/:id/titulares error");
    res.status(500).json({ error: "Error al actualizar titulares" });
  }
});

// ─── GET /api/custodias/puestos ──────────────────────────────────────────────
// Lista puestos marcados como tipo_puesto = 'custodia' con estado operativo calculado.
// Estado:
//   incidente_activo    → tiene incident activo ligado al puesto
//   incidente_completado → sólo incidentes cerrados
//   en_ruta             → agente asignado hoy, sin incidentes abiertos
//   planificada         → sin agente asignado
operacionesRouter.get("/custodias/puestos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        p.cliente_id,
        p.cliente_nombre,
        p.turno,
        p.horario,
        p.tipo_puesto,
        p.agente_id,
        p.agente_nombre,
        p.titular_employee_id,
        p.titular_nombre,
        p.notas,
        p.activo,
        oz.nombre                           AS zona_nombre,
        cs.nombre                           AS sede_nombre,
        t.nombre                            AS turno_tipo_nombre,
        p.tipo_turno_id,
        TO_CHAR(p.fecha_inicio_ciclo,'YYYY-MM-DD') AS fecha_inicio_ciclo,
        -- Calcular estado operativo de custodia
        -- Estados activos de incident: abierta, en_proceso
        -- Estado cerrado: cerrada (y cualquier otra cosa)
        CASE
          WHEN EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.puesto_id = p.id
              AND i.estado IN ('abierta','en_proceso')
          ) THEN 'incidente_activo'
          WHEN EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.puesto_id = p.id
              AND i.estado NOT IN ('abierta','en_proceso')
          ) AND NOT EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.puesto_id = p.id
              AND i.estado IN ('abierta','en_proceso')
          ) THEN 'incidente_completado'
          -- Agente tiene segmento abierto HOY y dentro de la ventana esperada de horas
          WHEN p.agente_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM cobertura_segmentos seg
            WHERE seg.puesto_id    = p.id
              AND seg.employee_id  = p.agente_id
              AND seg.fecha        = CURRENT_DATE
              AND seg.hora_fin     IS NULL
              AND (
                seg.horas_calculadas IS NULL
                OR seg.horas_calculadas = 0
                -- Turnos de 24h+: trabajan todo el día; TIME wrappea en PostgreSQL
                OR seg.horas_calculadas >= 24
                OR (seg.hora_inicio::time + (seg.horas_calculadas || ' hours')::interval) > CURRENT_TIME
              )
          ) THEN 'en_ruta'
          -- Agente tuvo turno hoy pero las horas ya terminaron (o fue liberado formalmente)
          WHEN p.agente_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM cobertura_segmentos seg
            WHERE seg.puesto_id   = p.id
              AND seg.employee_id = p.agente_id
              AND seg.fecha       = CURRENT_DATE
              AND (
                seg.hora_fin IS NOT NULL
                OR (
                  seg.hora_fin IS NULL
                  AND seg.horas_calculadas IS NOT NULL
                  AND seg.horas_calculadas > 0
                  -- Solo aplicar el chequeo de tiempo-expirado para turnos < 24h;
                  -- los de 24h+ nunca "terminan" dentro del mismo día
                  AND seg.horas_calculadas < 24
                  AND (seg.hora_inicio::time + (seg.horas_calculadas || ' hours')::interval) <= CURRENT_TIME
                )
              )
          ) THEN 'completada'
          -- Agente asignado pero sin cobertura activa hoy (turno futuro o sin registro)
          WHEN p.agente_id IS NOT NULL THEN 'planificada'
          ELSE 'planificada'
        END                                 AS estado_custodia,
        -- Contar incidentes totales asociados
        (SELECT COUNT(*) FROM incidents i WHERE i.puesto_id = p.id) AS total_incidentes,
        (SELECT COUNT(*) FROM incidents i WHERE i.puesto_id = p.id
           AND i.estado IN ('abierta','en_proceso'))                  AS incidentes_activos
      FROM puestos_operativos p
      LEFT JOIN operational_zones oz ON oz.id = p.zona_operativa_id
      LEFT JOIN client_sedes     cs ON cs.id = p.sede_id
      LEFT JOIN turnos            t  ON t.id  = p.tipo_turno_id
      WHERE p.tipo_puesto = 'custodia'
        AND p.activo      = TRUE
      ORDER BY
        CASE
          WHEN EXISTS (SELECT 1 FROM incidents i WHERE i.puesto_id = p.id AND i.estado NOT IN ('cerrado','resuelto','completado')) THEN 0
          WHEN p.agente_id IS NOT NULL THEN 1
          ELSE 2
        END,
        p.cliente_nombre,
        p.nombre
    `);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /custodias/puestos error");
    res.status(500).json({ error: "Error al obtener custodias" });
  }
});

export default operacionesRouter;
