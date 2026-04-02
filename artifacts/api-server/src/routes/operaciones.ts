import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { generarNovedades } from "./nomina";

const operacionesRouter = Router();

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
        po.titular_employee_id,
        po.titular_nombre,
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
        CASE
          WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24
            THEN 'diario'
          ELSE 'alternado'
        END                                                            AS tipo_ciclo,
        e.estado_laboral AS agente_estado_laboral,
        e.puesto         AS agente_puesto,
        e.telefono       AS agente_telefono,
        e.area           AS agente_area,
        e.sede           AS agente_sede,
        cs.nombre        AS sede_nombre,
        oz.nombre        AS zona_nombre,
        cl.fecha_inicio_contrato,
        (cl.fecha_inicio_contrato = COALESCE($1::date, CURRENT_DATE)) AS es_inicio_hoy
      FROM puestos_operativos po
      LEFT JOIN employees e  ON e.id  = po.agente_id
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      LEFT JOIN clients cl ON cl.id = po.cliente_id
      WHERE po.activo = TRUE
        AND (cl.fecha_inicio_contrato IS NULL
             OR cl.fecha_inicio_contrato <= COALESCE($1::date, CURRENT_DATE))
      ORDER BY po.cliente_nombre, po.orden, po.nombre
    `, [fechaFiltro]);

    // Agrupar por cliente
    const mapaClientes: Record<string, {
      clienteId: number | null;
      clienteNombre: string;
      fechaInicioContrato: string | null;
      iniciaHoy: boolean;
      puestos: typeof puestos;
    }> = {};

    for (const p of puestos) {
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
// Pool de agentes: disponibles / en descanso / sin asignación
// P-02: categorización hecha 100% en SQL (LEFT JOIN en vez de filter en JS)
operacionesRouter.get("/operaciones/pool", async (req, res) => {
  try {
    const { rows: agentes } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area, e.sede,
        e.telefono, e.wa_autorizado, e.supervisor_id,
        COALESCE(e.elegible_pool, TRUE) AS elegible_pool,
        COALESCE(eoa.tipo_asignacion, 'sin_asignacion') AS tipo_asignacion_eoa,
        titular_po.estado_operativo_puesto AS estado_puesto_titular,
        titular_po.nombre                  AS nombre_puesto_titular,
        titular_po.cliente_nombre          AS cliente_puesto_titular,
        CASE
          WHEN po.agente_id  IS NOT NULL AND e.estado_laboral = 'activo' THEN 'en_puesto'
          WHEN ssa.agente_id IS NOT NULL AND e.estado_laboral = 'activo' THEN 'en_ssa'
          WHEN e.estado_laboral = 'licencia'                             THEN 'en_descanso'
          WHEN e.estado_laboral = 'suspendido'                           THEN 'suspendido'
          WHEN titular_po.id IS NOT NULL
               AND (titular_po.agente_id IS NULL OR titular_po.agente_id != e.id)
               AND COALESCE(titular_po.estado_operativo_puesto, 'normal') != 'normal'
               AND e.estado_laboral = 'activo'                           THEN 'faltando'
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
      ) ssa ON ssa.agente_id = e.id
      LEFT JOIN employee_operational_assignments eoa
        ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN puestos_operativos titular_po
        ON titular_po.titular_employee_id = e.id AND titular_po.activo = TRUE
      WHERE e.estado_laboral IN ('activo', 'suspendido', 'licencia')
        AND (
          COALESCE(e.elegible_pool, TRUE) = TRUE
          OR (
            titular_po.id IS NOT NULL
            AND (titular_po.agente_id IS NULL OR titular_po.agente_id != e.id)
            AND COALESCE(titular_po.estado_operativo_puesto, 'normal') != 'normal'
            AND e.estado_laboral = 'activo'
          )
        )
      ORDER BY e.estado_laboral, e.nombre_completo
    `);

    const disponibles = agentes.filter((a: any) => a.categoria === 'disponible');
    const enPuesto    = agentes.filter((a: any) => a.categoria === 'en_puesto');
    const enSSA       = agentes.filter((a: any) => a.categoria === 'en_ssa');
    const enDescanso  = agentes.filter((a: any) => a.categoria === 'en_descanso');
    const suspendidos = agentes.filter((a: any) => a.categoria === 'suspendido');
    const faltando    = agentes.filter((a: any) => a.categoria === 'faltando');

    res.json({ disponibles, enPuesto, enSSA, enDescanso, suspendidos, faltando, total: agentes.length });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/pool error");
    res.status(500).json({ error: "Error al cargar pool" });
  }
});

// ─── POST /api/operaciones/asignar ───────────────────────────────────────────
// Asignar agente a puesto (sin agente previo)
operacionesRouter.post("/operaciones/asignar", async (req, res) => {
  // soloCobertura=true → solo cubre hoy, NO cambia titular ni EOA
  // soloCobertura=false (default) → asigna como titular si el puesto no tiene uno
  // oldTitularAccion → qué hacer con el EOA del titular previo
  // fechaEfectiva   → "YYYY-MM-DD" o null (usa hoy si null)
  // motivoCambio    → texto libre del motivo del cambio de titular
  const { puestoId, agenteId, usuario, notas, forzar,
          soloCobertura = false,
          oldTitularAccion,
          fechaEfectiva,
          motivoCambio,
          horaInstalacion } = req.body;
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

      // Verificar que no esté cubriendo un SSA activo
      const { rows: yaEnSSA } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre, s.tipo_solicitud, s.fecha
         FROM solicitudes_servicio_adicional s
         LEFT JOIN clients c ON c.id = s.cliente_id
         WHERE s.agente_id = $1
           AND s.estado_general NOT IN ('cancelada', 'cerrada')`,
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
      // ── Solo cobertura temporal: solo pone agente_id, NO toca titular ────────
      await pool.query(
        `UPDATE puestos_operativos
         SET agente_id     = $1,
             agente_nombre = $2,
             estado        = 'cubierto',
             updated_at    = NOW()
         WHERE id = $3`,
        [agenteId, agente.nombre_completo, puestoId]
      );
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
        : new Date().toISOString().split("T")[0];

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

    // A-04: Auto-crear / actualizar segmento de cobertura para hoy
    try {
      const hoy = new Date().toISOString().split("T")[0];
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
      const tipoSegmento    = soloCobertura ? 'relevo' : 'titular';
      const obsSegmento     = horaInstalacion ? `Instalación real: ${horaInstalacion}` : null;

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

    res.json({
      ok: true,
      mensaje: `${agente.nombre_completo} asignado a ${puesto.nombre}`,
      asignadoComoTitular: !soloCobertura && sinTitular,
      soloCobertura,
    });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/asignar error");
    res.status(500).json({ error: "Error al asignar agente" });
  }
});

// ─── POST /api/operaciones/sustituir ─────────────────────────────────────────
// Sustituir agente en un puesto (hay uno previo)
operacionesRouter.post("/operaciones/sustituir", async (req, res) => {
  const { puestoId, agenteEntranteId, motivo, usuario, notas, forzar, tipoSustitucion,
          tipoNovedad, coberturaTipo } = req.body;
  if (!puestoId || !agenteEntranteId) return res.status(400).json({ error: "puestoId y agenteEntranteId son requeridos" });

  // tipoSustitucion: 'relevo' = solo cambia agente_id (titular no cambia)
  //                 'reasignacion' = cambia agente_id Y titular_employee_id
  const esRelevo = tipoSustitucion === 'relevo';

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

      // Bloquear si el entrante cubre un SSA activo — no se puede forzar
      const { rows: yaSSA } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre
         FROM solicitudes_servicio_adicional s
         LEFT JOIN clients c ON c.id = s.cliente_id
         WHERE s.agente_id = $1 AND s.estado_general NOT IN ('cancelada', 'cerrada')`,
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

    const agenteSalienteId     = puesto.agente_id;
    const agenteSalienteNombre = puesto.agente_nombre;

    // Si es relevo: solo cambia agente_id, el titular_employee_id NO cambia
    // Si es reasignación: cambia tanto agente_id como titular_employee_id
    if (esRelevo) {
      await pool.query(
        `UPDATE puestos_operativos
         SET agente_id     = $1,
             agente_nombre = $2,
             estado        = 'cubierto',
             updated_at    = NOW()
         WHERE id = $3`,
        [agenteEntranteId, entrante.nombre_completo, puestoId]
      );
    } else {
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
      abandono_parcial: "abandono_parcial", // Fix: genera evento tipo abandono, no falta
      suspension:       "suspension",
      incapacidad:      "incapacidad",
      vacaciones:       "vacaciones",
      permiso_sin_goce: "permiso_sin_goce",
      permiso_con_goce: "permiso_con_goce",
    };
    const tipoEventoRrhh = tipoNovedad
      ? tiposRrhhSaliente[tipoNovedad] ?? null
      : (["falta","suspension"].includes((motivo || "").toLowerCase()) ? motivo?.toLowerCase() : null);

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
        await pool.query(
          `INSERT INTO eventos_rrhh
             (employee_id, employee_nombre, employee_dpi,
              tipo_evento, fecha, cliente_nombre, puesto_nombre,
              generado_desde, movimiento_id, estado, usuario_generador, documentos_generados)
           VALUES ($1,$2,$3,$4,NOW(),$5,$6,'operaciones',$7,'pendiente',$8,'[]')`,
          [employeeId, employeeNombre, employeeDpi, tipoEventoRrhh,
           puesto.cliente_nombre || null, puesto.nombre || null,
           movimientoId, usuario || "sistema"]
        );
        logger.info({ tipoEventoRrhh, empleado: employeeNombre }, "Evento RRHH auto-generado desde sustitución");
      } catch (errRrhh) {
        logger.error({ errRrhh }, "Error al auto-generar evento RRHH (no bloqueante)");
      }
    }

    // A-04: Auto-crear segmento de cobertura para hoy al sustituir agente
    // Determinar el estado operativo real del puesto basado en tipo_novedad
    const estadoOpPuesto = (() => {
      if (!esRelevo) return "normal";
      switch (tipoNovedad) {
        case "falta_total":      return "relevo_completo";
        case "abandono_parcial": return "abandono_parcial";
        case "vacaciones":       return "vacaciones";
        case "relevo_vacaciones":return "vacaciones";
        case "incapacidad":      return "incapacidad";
        case "suspension":       return "suspension";
        case "relevo_parcial":   return "relevo_parcial";
        case "relevo_completo":  return "relevo_completo";
        case "cierre_tarde_cliente": return "horas_extra";
        case "servicio_especial": return "servicio_especial";
        default: return "relevo_completo";
      }
    })();

    // Actualizar estado_operativo_puesto en puestos_operativos
    await pool.query(
      `UPDATE puestos_operativos
       SET estado_operativo_puesto = $1, updated_at = NOW()
       WHERE id = $2`,
      [estadoOpPuesto, puestoId]
    );

    // A-04: Auto-crear segmento de cobertura para hoy al sustituir agente
    try {
      const hoy = new Date().toISOString().split("T")[0];
      const turno = (puesto.turno ?? "día").toLowerCase();
      const horaInicio = turno === "noche" ? "20:00" : "08:00";
      const horaFin    = turno === "noche" ? "06:00" : "18:00";
      const horasCalc  = 10;
      const tipoSeg    = esRelevo ? "relevo" : "titular";
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

      // Registrar novedad de nómina para el agente entrante (limpia cualquier falta previa)
      try {
        await pool.query(
          `INSERT INTO novedades_nomina_diarias
             (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
              puesto_cubierto_id, puesto_cubierto_nombre, num_puestos_cubiertos, fuente)
           VALUES ($1, $2, $3, TRUE, $4, 0, $5, $6, 1, 'sustitucion_pizarron')
           ON CONFLICT (fecha, employee_id) DO UPDATE SET
             trabajo_dia           = TRUE,
             falta                 = FALSE,
             descuento_dia         = FALSE,
             horas_trabajadas      = GREATEST(novedades_nomina_diarias.horas_trabajadas, $4),
             num_puestos_cubiertos = novedades_nomina_diarias.num_puestos_cubiertos + 1,
             updated_at            = NOW()`,
          [hoy, agenteEntranteId, entrante.nombre_completo, horasCalc, puestoId, puesto.nombre]
        );
      } catch (nomEntranteErr) {
        logger.warn({ nomEntranteErr }, "A-04: no se pudo actualizar novedad nómina del entrante (no bloqueante)");
      }
    } catch (segErr) {
      logger.warn({ segErr }, "A-04: no se pudo auto-crear segmento al sustituir (no bloqueante)");
    }

    res.json({
      ok: true,
      mensaje: `Sustitución registrada: ${agenteSalienteNombre} → ${entrante.nombre_completo}`,
      eventoRrhhGenerado: !!tipoEventoRrhh,
      tipoNovedad: tipoNovedad ?? null,
      estadoOperativoPuesto: estadoOpPuesto,
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
    const hoy = new Date().toISOString().split("T")[0];

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
          await pool.query(
            `INSERT INTO eventos_rrhh
               (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha,
                cliente_nombre, puesto_nombre, generado_desde, movimiento_id, estado,
                usuario_generador, observaciones)
             VALUES ($1, $2, $3, 'falta', NOW(), $4, $5, 'pizarron', $6, 'pendiente', $7, $8)`,
            [emp.id, emp.nombre_completo, emp.dpi ?? null,
             puesto.cliente_nombre, puesto.nombre,
             movId, usuario || 'sistema', notas || null]
          );
          // Novedad de nómina: falta = no se paga el día
          await pool.query(
            `INSERT INTO novedades_nomina_diarias
               (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
                falta, descuento_dia, puesto_titular_id, puesto_titular_nombre, fuente)
             VALUES ($1, $2, $3, FALSE, 0, 0, TRUE, TRUE, $4, $5, 'liberacion_pizarron')
             ON CONFLICT (fecha, employee_id) DO UPDATE SET
               falta = TRUE, descuento_dia = TRUE, trabajo_dia = FALSE, horas_trabajadas = 0,
               updated_at = NOW()`,
            [hoy, emp.id, emp.nombre_completo, puesto.id, puesto.nombre]
          );
          logger.info({ agenteId, hoy }, "liberar: evento falta + novedad nómina registrados");
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
// Actualizar campos de configuración de un puesto (horario, jornada, sede, notas)
operacionesRouter.patch("/operaciones/puestos/:id", async (req, res) => {
  const { horario, jornada, sedeId, notas, turno } = req.body;

  // P-03: rechazar body vacío para evitar UPDATE sin efecto
  if ([horario, jornada, sedeId, notas, turno].every(v => v === undefined || v === null)) {
    return res.status(400).json({ error: "Debe proporcionar al menos un campo para actualizar (horario, jornada, sedeId, notas, turno)" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE puestos_operativos
       SET horario    = COALESCE($1, horario),
           jornada    = COALESCE($2, jornada),
           sede_id    = COALESCE($3, sede_id),
           notas      = COALESCE($4, notas),
           turno      = COALESCE($5, turno),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [horario ?? null, jornada ?? null, sedeId ?? null, notas ?? null, turno ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id error");
    res.status(500).json({ error: "Error al actualizar puesto" });
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

// ─── POST /api/operaciones/puestos ───────────────────────────────────────────
// Crear un nuevo puesto operativo
// Requiere: clienteNombre, nombre, tipoTurnoId, fechaInicioCiclo
operacionesRouter.post("/operaciones/puestos", async (req, res) => {
  const {
    clienteId, clienteNombre, nombre, turno, notas, sedeId, horario, jornada,
    tipoTurnoId, fechaInicioCiclo,
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

  try {
    // Verificar que el turno exista
    const { rows: turnoRows } = await pool.query(
      `SELECT id FROM turnos WHERE id = $1 AND activo = TRUE`, [tipoTurnoId]
    );
    if (!turnoRows.length) {
      return res.status(400).json({ error: `El turno con id=${tipoTurnoId} no existe o está inactivo` });
    }

    const { rows: ordenRows } = await pool.query(
      `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM puestos_operativos WHERE cliente_nombre=$1`,
      [clienteNombre]
    );
    const orden = ordenRows[0].siguiente;

    const { rows } = await pool.query(
      `INSERT INTO puestos_operativos
         (cliente_id, cliente_nombre, nombre, turno, orden, notas, sede_id, horario, jornada,
          tipo_turno_id, fecha_inicio_ciclo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        clienteId || null, clienteNombre, nombre, turno || 'día', orden,
        notas || null, sedeId || null, horario || null, jornada || null,
        tipoTurnoId, fechaInicioCiclo,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /operaciones/puestos error");
    res.status(500).json({ error: "Error al crear puesto" });
  }
});

// ─── DELETE /api/operaciones/puestos/:id ─────────────────────────────────────
operacionesRouter.delete("/operaciones/puestos/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE puestos_operativos SET activo=FALSE WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
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

// ─── Helper: fecha hoy en formato DD-MM-YYYY ──────────────────────────────────
function fechaHoyStr(): string {
  const hoy = new Date();
  const dd   = String(hoy.getDate()).padStart(2, '0');
  const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
  const yyyy = hoy.getFullYear();
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
  const ahora = new Date();
  const todayISO = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth()+1).padStart(2,'0')}-${String(ahora.getUTCDate()).padStart(2,'0')}`;

  const { rows: hoyRows } = await pool.query(
    `SELECT * FROM cierre_operativo_diario WHERE fecha = CURRENT_DATE`
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

  // Hoy está cerrado → encontrar el primer día no cerrado
  const { rows: closedRows } = await pool.query(`
    SELECT fecha::text AS fecha FROM cierre_operativo_diario
    WHERE fecha >= CURRENT_DATE AND estado = 'cerrado'
    ORDER BY fecha
  `);

  let fechaActiva = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  for (const row of closedRows) {
    const rowISO = (row.fecha as string).substring(0, 10);
    const faISO  = fechaActiva.toISOString().substring(0, 10);
    if (rowISO === faISO) {
      fechaActiva = new Date(fechaActiva.getTime() + 86_400_000);
    } else {
      break;
    }
  }

  const fechaActivaISO = fechaActiva.toISOString().substring(0, 10);
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
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = CURRENT_DATE
      GROUP BY tipo, motivo
    `);

    const ausencias = movHoy
      .filter((m: any) => m.motivo === 'falta')
      .reduce((acc: number, m: any) => acc + parseInt(m.cantidad), 0);

    const { rows: relevosRows } = await pool.query(`
      SELECT COUNT(*) AS cantidad FROM movimientos_operativos
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = CURRENT_DATE
        AND tipo = 'sustitucion' AND (motivo IS NULL OR motivo = '')
    `);
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
operacionesRouter.post("/operaciones/cierre", async (req, res) => {
  const { confirmacion, comentario, usuario, usuarioId, rol, fecha: fechaSolicitada } = req.body;

  if (!['admin', 'supervisor'].includes(rol)) {
    return res.status(403).json({ error: 'Solo supervisores y administradores pueden cerrar el día' });
  }

  try {
    const ahora = new Date();
    const todayISO = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, '0')}-${String(ahora.getUTCDate()).padStart(2, '0')}`;

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
               po.titular_employee_id, po.titular_nombre,
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
      // Estado actual del pizarrón
      const { rows: puestoSnap } = await pool.query(`
        SELECT po.id, po.nombre, po.cliente_nombre, po.cliente_id, po.estado,
               po.agente_id, po.agente_nombre, po.titular_employee_id, po.titular_nombre,
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

    // ── Generar novedades de nómina desde segmentos de cobertura ──────────
    const novedadesGeneradas = await generarNovedades(fechaACerrarISO, cierreRows[0].id);

    const mensaje = esRetroactivo
      ? `Cierre retroactivo de ${fechaACerrarStr} completado. ${novedadesGeneradas} novedad(es) de nómina generada(s).`
      : `Día ${fechaACerrarStr} cerrado. ${novedadesGeneradas} novedad(es) de nómina generada(s).`;

    logger.info({ usuario, fecha: fechaACerrarStr, esRetroactivo, novedadesGeneradas }, "Día operativo cerrado");
    res.json({ ok: true, cierre: cierreRows[0], resumen, novedadesGeneradas, retroactivo: esRetroactivo, mensaje });
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
      const ahora = new Date();
      fechaISO = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth()+1).padStart(2,'0')}-${String(ahora.getUTCDate()).padStart(2,'0')}`;
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

  const { tipo_turno_id, fecha_inicio_ciclo } = req.body ?? {};

  // Validación: si se provee un turno, la fecha_inicio_ciclo es obligatoria
  if (tipo_turno_id != null && !fecha_inicio_ciclo) {
    return res.status(400).json({ error: "fecha_inicio_ciclo es requerida al asignar un turno" });
  }

  // Validar formato de fecha
  if (fecha_inicio_ciclo && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio_ciclo)) {
    return res.status(400).json({ error: "fecha_inicio_ciclo debe tener formato YYYY-MM-DD" });
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

    const { rows: updated } = await pool.query(`
      UPDATE puestos_operativos
      SET
        tipo_turno_id     = $1,
        fecha_inicio_ciclo = $2,
        updated_at        = NOW()
      WHERE id = $3
      RETURNING
        id,
        nombre,
        tipo_turno_id,
        fecha_inicio_ciclo
    `, [
      tipo_turno_id ?? null,
      tipo_turno_id != null ? fecha_inicio_ciclo : null,
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
        CASE
          WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24
            THEN 'diario'
          ELSE 'alternado'
        END AS tipo_ciclo
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

  const fecha = (req.query.fecha as string) || new Date().toISOString().slice(0, 10);

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
        CASE
          WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24 THEN 'diario'
          ELSE 'alternado'
        END AS tipo_ciclo,
        CEIL(t.horas_trabajo / 24.0)                        AS dias_trabajo,
        CEIL(COALESCE(t.horas_descanso, 0) / 24.0)          AS dias_descanso
      FROM puestos_operativos po
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      WHERE po.id = $1 AND po.activo = TRUE
    `, [puestoId]);

    if (rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });

    const p = rows[0];
    let estado_turno: string | null = null;

    if (p.tipo_turno_id && p.fecha_inicio_ciclo && p.ciclo_horas > 24) {
      const diasTrabajo  = Math.ceil(p.horas_trabajo / 24);
      const diasDescanso = Math.ceil((p.horas_descanso ?? 0) / 24);
      const cicloDias    = diasTrabajo + diasDescanso;
      const inicio       = new Date(p.fecha_inicio_ciclo + "T00:00:00Z");
      const objetivo     = new Date(fecha + "T00:00:00Z");
      const diff         = Math.round((objetivo.getTime() - inicio.getTime()) / 86_400_000);
      const posicion     = ((diff % cicloDias) + cicloDias) % cicloDias;
      estado_turno       = posicion < diasTrabajo ? "trabajando" : "descansando";
    } else if (p.tipo_turno_id) {
      estado_turno = "trabajando"; // turno diario: siempre trabaja
    }

    res.json({ ...p, estado_turno, fecha_consultada: fecha });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/:id/turno error");
    res.status(500).json({ error: "Error al obtener turno del puesto" });
  }
});

export default operacionesRouter;
