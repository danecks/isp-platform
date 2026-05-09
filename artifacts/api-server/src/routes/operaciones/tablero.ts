import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

import { calcularEstadoCiclo } from "../../lib/turno-calc";

const router = Router();

router.get("/operaciones/tablero", async (req, res) => {
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
        EXISTS (
          SELECT 1 FROM puesto_slots ps_v
          WHERE ps_v.puesto_id = po.id AND ps_v.activo = TRUE AND ps_v.empleado_id IS NULL
        ) AS tiene_slot_vacio,
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
            'employee_id',         src.employee_id,
            'nombre',              COALESCE(e_src.nombre_completo, '—'),
            'orden',               src.orden,
            'fecha_inicio_ciclo',  src.pt_fic,
            'slot_dias_trabajo',   src.slot_dias,
            'slot_fecha_inicio',   src.slot_fic,
            'slot_longitud_ciclo', src.slot_longitud_ciclo
          ) ORDER BY src.orden
        ) AS titulares_json
        FROM (
          -- Opción A: slots con empleado asignado (sistema nuevo, multi-titular)
          SELECT
            ps.empleado_id        AS employee_id,
            ps.slot_numero        AS orden,
            NULL::date            AS pt_fic,
            ps.dias_trabajo       AS slot_dias,
            COALESCE(ps.longitud_ciclo, 14)::int AS slot_longitud_ciclo,
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
            COALESCE(ps2.longitud_ciclo, 14)::int AS slot_longitud_ciclo,
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
    // cycleDay = (diasDesdeInicio % longitud_ciclo) + 1  (1..longitud_ciclo)
    // Default longitud_ciclo = 14 para compatibilidad con slots existentes.
    function calcTrabajaPorSlot(
      diasTrabajo: number[],
      fechaInicioStr: string,
      fechaConsulta: string,
      longitudCiclo: number = 14,
    ): boolean {
      const lc = (longitudCiclo && longitudCiclo > 0) ? longitudCiclo : 14;
      const [iy, im, id] = fechaInicioStr.split("-").map(Number);
      const [cy, cm, cd] = fechaConsulta.split("-").map(Number);
      const inicio   = Date.UTC(iy, im - 1, id);
      const consulta = Date.UTC(cy, cm - 1, cd);
      const daysElapsed = Math.floor((consulta - inicio) / 86400000);
      const cycleDay = ((daysElapsed % lc) + lc) % lc + 1; // 1-based, handles negative offsets
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
            (t as any).slot_longitud_ciclo,
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
            (p as any).agente_id              = t0.employee_id;
            (p as any).agente_nombre          = t0.nombre;
            (p as any).estado                 = "cubierto";
            // Marca: el agente mostrado es el titular puro (no hay cobertura
            // manual del día en BD). El frontend usa esto para ocultar el
            // botón "Remover agente" — que llama a /liberar y requiere
            // agente_id real en BD — y dejar solo "Quitar titularidad" o
            // "Registrar falta" como acciones válidas. Bug: PIZ-LIB-01.
            (p as any).agente_virtual_titular = true;
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

    // ── Verificar VACACIONES del titular para la fecha consultada (PIZ-VAC-01) ──
    // Bug: cuando un titular entra de vacaciones (vacaciones normales, NO
    // 'vacaciones_trabajadas'), el pizarrón seguía mostrándolo cubriendo el
    // puesto. La query del SELECT solo capturaba vacaciones del titular legacy
    // (po.titular_employee_id), no de titulares vía puesto_slots/puesto_titulares.
    // Aquí hacemos query general por employee_id y aplicamos a TODOS los puestos:
    // el puesto queda descubierto (estado='descubierto', agente_id=NULL) pero
    // titular_employee_id se preserva para que se vea quién está de vacaciones
    // y alguien lo pueda relevar. El frontend muestra badge "Titular en vacaciones".
    {
      const { rows: vacRows } = await pool.query(`
        SELECT DISTINCT employee_id,
               to_char(fecha::date, 'YYYY-MM-DD') AS vac_inicio,
               to_char(COALESCE(fecha_fin, fecha)::date, 'YYYY-MM-DD') AS vac_fin
          FROM eventos_rrhh
         WHERE tipo_evento = 'vacaciones'
           AND $1::date BETWEEN fecha::date AND COALESCE(fecha_fin, fecha)::date
           AND estado NOT IN ('anulado', 'cancelado')
      `, [fechaConsultada]);

      // Calcula días hasta el regreso del titular: el regreso es el día siguiente
      // al fin de las vacaciones. Si fin=30/04 y hoy=26/04 → vuelve en 5 días.
      // Si fin=hoy → vuelve en 1 día (mañana). Si fin<hoy → 0 (ya regresó, no debería pasar).
      function diasParaRegreso(vacFinISO: string): number {
        const [fy, fm, fd] = vacFinISO.split("-").map(Number);
        const [cy, cm, cd] = fechaConsultada.split("-").map(Number);
        const fin     = Date.UTC(fy, fm - 1, fd);
        const hoy     = Date.UTC(cy, cm - 1, cd);
        const dias = Math.floor((fin - hoy) / 86400000) + 1; // +1 porque regresa al día siguiente del fin
        return Math.max(0, dias);
      }

      const vacacionMap = new Map<number, { inicio: string; fin: string; dias_para_regreso: number }>();
      for (const v of vacRows) {
        const fin = String(v.vac_fin);
        vacacionMap.set(Number(v.employee_id), {
          inicio: String(v.vac_inicio),
          fin,
          dias_para_regreso: diasParaRegreso(fin),
        });
      }

      if (vacacionMap.size > 0) {
        for (const p of puestosFinales) {
          // 24x24: si par_trabajando está de vacaciones y no hay relevo cubriendo
          if (p.es_par_24x24 && p.par_trabajando && !(p as any).es_relevo_dia) {
            const v = vacacionMap.get(Number(p.par_trabajando.employee_id));
            if (v) {
              (p as any).agente_id                  = null;
              (p as any).agente_nombre              = null;
              (p as any).estado                     = "descubierto";
              (p as any).titular_en_vacaciones      = true;
              (p as any).titular_vac_tipo           = "vacaciones";
              (p as any).titular_vac_inicio         = v.inicio;
              (p as any).titular_vac_fin            = v.fin;
              (p as any).titular_vac_dias_regreso   = v.dias_para_regreso;
              (p as any).agente_virtual_titular     = false;
            }
          }
          // No-24x24: si el agente_id actual (titular puro o real) está de vacaciones
          if (!p.es_par_24x24 && p.agente_id && !(p as any).es_relevo_dia) {
            const v = vacacionMap.get(Number(p.agente_id));
            if (v) {
              (p as any).agente_id                  = null;
              (p as any).agente_nombre              = null;
              (p as any).estado                     = "descubierto";
              (p as any).titular_en_vacaciones      = true;
              (p as any).titular_vac_tipo           = "vacaciones";
              (p as any).titular_vac_inicio         = v.inicio;
              (p as any).titular_vac_fin            = v.fin;
              (p as any).titular_vac_dias_regreso   = v.dias_para_regreso;
              (p as any).agente_virtual_titular     = false;
            }
          }
        }
      }
    }

    // ── Verificar TITULAR DADO DE BAJA (PIZ-BAJA-01) ────────────────────────────
    // Si el titular del puesto fue dado de baja (estado_laboral != 'activo'),
    // el slot debe quedar VACÍO en el pizarrón para que se vea claramente que
    // hay que reasignar titular. NO se borra la titularidad real (el operador
    // lo hace manualmente desde "Quitar titularidad" o asigna a otro). Igual
    // patrón virtual que vacaciones: solo afecta la respuesta del API.
    {
      const { rows: bajaRows } = await pool.query(`
        SELECT id, estado_laboral
          FROM employees
         WHERE estado_laboral != 'activo'
      `);
      const bajaMap = new Map<number, string>();
      for (const b of bajaRows) bajaMap.set(Number(b.id), String(b.estado_laboral));

      if (bajaMap.size > 0) {
        for (const p of puestosFinales) {
          // 24x24: si par_trabajando está dado de baja
          if (p.es_par_24x24 && p.par_trabajando && !(p as any).es_relevo_dia) {
            const estado = bajaMap.get(Number(p.par_trabajando.employee_id));
            if (estado) {
              (p as any).agente_id              = null;
              (p as any).agente_nombre          = null;
              (p as any).estado                 = "descubierto";
              (p as any).titular_dado_de_baja   = true;
              (p as any).titular_estado_laboral = estado;
              (p as any).agente_virtual_titular = false;
            }
          }
          // No-24x24: si el agente_id actual (titular puro o real) está dado de baja
          if (!p.es_par_24x24 && p.agente_id && !(p as any).es_relevo_dia) {
            const estado = bajaMap.get(Number(p.agente_id));
            if (estado) {
              (p as any).agente_id              = null;
              (p as any).agente_nombre          = null;
              (p as any).estado                 = "descubierto";
              (p as any).titular_dado_de_baja   = true;
              (p as any).titular_estado_laboral = estado;
              (p as any).agente_virtual_titular = false;
            }
          }
        }
      }
    }

    // ── Inyectar slots virtuales de custodia ────────────────────────────────────
    const diaSemana = new Date(fechaConsultada + "T12:00:00Z").getUTCDay();
    const { rows: custodiaClientes } = await pool.query(`
      SELECT
        c.id, c.nombre, c.nombre_comercial, c.fecha_inicio_contrato,
        COALESCE(cfs.cantidad_agentes, 0) AS fuerza_hoy
      FROM clients c
      LEFT JOIN custodia_fuerza_semanal cfs ON cfs.cliente_id = c.id AND cfs.dia_semana = $1
      WHERE c.tipo_servicio IN ('custodia', 'mixto')
        AND c.estado = 'activo'
    `, [diaSemana]);

    const custodiaSlots: any[] = [];
    const custodiaFaltaSet = new Set<number>();
    {
      const { rows: faltasRows } = await pool.query(`
        SELECT employee_id FROM eventos_rrhh
        WHERE tipo_evento = 'falta'
          AND fecha::date = $1::date
          AND estado NOT IN ('anulado', 'cancelado')
      `, [fechaConsultada]);
      for (const f of faltasRows) custodiaFaltaSet.add(Number(f.employee_id));
    }

    for (const cl of custodiaClientes) {
      const fuerzaHoy = Number(cl.fuerza_hoy);
      if (fuerzaHoy <= 0) continue;

      const { rows: titularesRows } = await pool.query(`
        SELECT ct.slot_numero, ct.employee_id, e.nombre_completo
        FROM custodia_titulares ct
        JOIN employees e ON e.id = ct.employee_id
        WHERE ct.cliente_id = $1 AND ct.activo = TRUE
        ORDER BY ct.slot_numero
      `, [cl.id]);

      const titularMap = new Map<number, { employee_id: number; nombre: string }>();
      for (const t of titularesRows) {
        titularMap.set(Number(t.slot_numero), { employee_id: t.employee_id, nombre: t.nombre_completo });
      }

      const { rows: asignaciones } = await pool.query(`
        SELECT cad.employee_id, cad.slot_numero, cad.notas, e.nombre_completo
        FROM custodia_asignacion_diaria cad
        JOIN employees e ON e.id = cad.employee_id
        WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
        ORDER BY cad.slot_numero
      `, [cl.id, fechaConsultada]);

      const asignacionMap = new Map<number, any>();
      for (const a of asignaciones) {
        asignacionMap.set(Number(a.slot_numero), a);
      }

      const { rows: armasSlots } = await pool.query(`
        SELECT a.id AS arma_id, a.codigo AS arma_codigo, a.tipo AS arma_tipo, a.marca AS arma_marca, a.serie AS arma_serie, a.custodia_slot_numero
        FROM armas a
        WHERE a.custodia_cliente_id = $1 AND a.custodia_slot_numero IS NOT NULL AND a.activo = TRUE
      `, [cl.id]);
      const armaMap = new Map<number, any>();
      for (const ar of armasSlots) {
        armaMap.set(Number(ar.custodia_slot_numero), ar);
      }

      for (let i = 1; i <= fuerzaHoy; i++) {
        const titular = titularMap.get(i) ?? null;
        const asig = asignacionMap.get(i);
        const arma = armaMap.get(i) ?? null;
        const titularFaltando = titular && custodiaFaltaSet.has(titular.employee_id);

        let agente_id: number | null = null;
        let agente_nombre: string | null = null;
        let estado = "descubierto";
        let es_relevo_dia = false;

        if (asig) {
          agente_id = asig.employee_id;
          agente_nombre = asig.nombre_completo;
          estado = "cubierto";
          if (titular && asig.employee_id !== titular.employee_id) {
            es_relevo_dia = true;
          }
        } else if (titular && !titularFaltando) {
          agente_id = titular.employee_id;
          agente_nombre = titular.nombre;
          estado = "cubierto";
        }

        custodiaSlots.push({
          id: `custodia-${cl.id}-${i}`,
          es_custodia: true,
          slot_numero: i,
          cliente_id: cl.id,
          cliente_nombre: cl.nombre_comercial || cl.nombre,
          fecha_inicio_contrato: cl.fecha_inicio_contrato,
          nombre: `Custodio ${i}`,
          estado,
          agente_id,
          agente_nombre,
          notas_custodia: asig?.notas ?? null,
          titular_employee_id: titular?.employee_id ?? null,
          titular_nombre: titular?.nombre ?? null,
          titular_faltando: titularFaltando || false,
          es_relevo_dia,
          arma_id: arma?.arma_id ?? null,
          arma_codigo: arma?.arma_codigo ?? null,
          arma_tipo: arma?.arma_tipo ?? null,
          arma_marca: arma?.arma_marca ?? null,
          arma_serie: arma?.arma_serie ?? null,
          titulares: [],
          es_par_24x24: false,
          descanso_por_ciclo: false,
          es_inicio_hoy: false,
          tiene_slot_vacio: !titular,
          jornada: "12h",
          horas_trabajo: 12,
        });
      }
    }

    // Agrupar por cliente
    const mapaClientes: Record<string, {
      clienteId: number | null;
      clienteNombre: string;
      fechaInicioContrato: string | null;
      iniciaHoy: boolean;
      tipoServicio?: string;
      puestos: any[];
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

    for (const cs of custodiaSlots) {
      const key = String(cs.cliente_id);
      if (!mapaClientes[key]) {
        mapaClientes[key] = {
          clienteId: cs.cliente_id,
          clienteNombre: cs.cliente_nombre,
          fechaInicioContrato: cs.fecha_inicio_contrato
            ? String(cs.fecha_inicio_contrato).slice(0, 10)
            : null,
          iniciaHoy: false,
          tipoServicio: "custodia",
          puestos: [],
        };
      }
      mapaClientes[key].tipoServicio = "custodia";
      mapaClientes[key].puestos.push(cs);
    }

    res.json(Object.values(mapaClientes));
  } catch (err) {
    logger.error({ err }, "GET /operaciones/tablero error");
    res.status(500).json({ error: "Error al cargar tablero" });
  }
});

// ─── GET /api/operaciones/historial ──────────────────────────────────────────

router.get("/operaciones/historial", async (req, res) => {
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


router.get("/operaciones/pizarron-historico/:fecha", async (req, res) => {
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

// ─── GET /api/operaciones/tablero/administracion ─────────────────────────────

router.get("/operaciones/tablero/administracion", async (req, res) => {
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
      WHERE e.tipo_personal IN ('administrativo_bodega', 'administrativo_rrhh', 'gerencia', 'administrativo')
        AND e.estado_laboral IN ('activo', 'licencia', 'suspendido')
      ORDER BY
        CASE e.tipo_personal
          WHEN 'gerencia'            THEN 1
          WHEN 'administrativo_rrhh' THEN 2
          WHEN 'administrativo_bodega' THEN 3
          WHEN 'administrativo'      THEN 4
          ELSE 5
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
      administrativo:       enriquecidos.filter((e: any) => e.tipo_personal === 'administrativo'),
    };

    res.json({ fecha: hoy, empleados: enriquecidos, grupos });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/tablero/administracion error");
    res.status(500).json({ error: "Error al obtener personal administrativo" });
  }
});

export default router;
