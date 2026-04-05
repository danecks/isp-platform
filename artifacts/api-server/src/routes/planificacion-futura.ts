import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { calcularEstadoCiclo } from "../lib/turno-calc";

export const planificacionFuturaRouter = Router();

// ─── GET /api/operaciones/planificacion-futura?fecha=YYYY-MM-DD ───────────────
// Devuelve todos los planes para una fecha: puestos operativos + SSA
planificacionFuturaRouter.get("/operaciones/planificacion-futura", async (req, res) => {
  const { fecha } = req.query as { fecha?: string };
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Parámetro 'fecha' requerido en formato YYYY-MM-DD" });
  }
  try {
    const { rows } = await pool.query(`
      SELECT
        pf.id,
        pf.fecha,
        pf.puesto_id,
        po.nombre                             AS puesto_nombre,
        COALESCE(po.cliente_nombre, sac.nombre) AS cliente_nombre,
        po.titular_employee_id,
        pf.tipo_evento,
        pf.tipo_ausencia,
        pf.tipo_cobertura_futura,
        pf.ssa_id,
        s.tipo_solicitud                      AS ssa_tipo_solicitud,
        pf.titular_ausente_id,
        ea.nombre_completo                    AS titular_ausente_nombre,
        pf.relevo_id,
        er.nombre_completo                    AS relevo_nombre,
        pf.motivo,
        pf.notas,
        pf.estado,
        pf.fuente,
        pf.creado_por,
        pf.created_at
      FROM planificacion_futura pf
      LEFT JOIN puestos_operativos po       ON po.id = pf.puesto_id
      LEFT JOIN solicitudes_servicio_adicional s ON s.id = pf.ssa_id
      LEFT JOIN clients sac                 ON sac.id = s.cliente_id
      LEFT JOIN employees ea                ON ea.id  = pf.titular_ausente_id
      LEFT JOIN employees er                ON er.id  = pf.relevo_id
      WHERE pf.fecha = $1
        AND pf.estado != 'cancelado'
      ORDER BY cliente_nombre, puesto_nombre
    `, [fecha]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/planificacion-futura error");
    res.status(500).json({ error: "Error al cargar planificación futura" });
  }
});

// ─── GET /api/operaciones/planificacion-futura/proximos ───────────────────────
// Devuelve los próximos 30 días de planes, agrupados por puesto_id
// Útil para mostrar badges en el Pizarrón del día actual
planificacionFuturaRouter.get("/operaciones/planificacion-futura/proximos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        pf.id,
        pf.fecha,
        pf.puesto_id,
        po.nombre             AS puesto_nombre,
        po.cliente_nombre,
        pf.tipo_evento,
        pf.tipo_ausencia,
        pf.titular_ausente_id,
        ea.nombre_completo    AS titular_ausente_nombre,
        pf.relevo_id,
        er.nombre_completo    AS relevo_nombre,
        pf.motivo,
        pf.estado
      FROM planificacion_futura pf
      JOIN puestos_operativos po ON po.id = pf.puesto_id
      LEFT JOIN employees ea ON ea.id = pf.titular_ausente_id
      LEFT JOIN employees er ON er.id  = pf.relevo_id
      WHERE pf.fecha > CURRENT_DATE
        AND pf.fecha <= CURRENT_DATE + INTERVAL '30 days'
        AND pf.estado != 'cancelado'
      ORDER BY pf.fecha ASC
    `);

    // Agrupar por puesto_id para que el frontend haga lookup O(1)
    const porPuesto: Record<number, typeof rows> = {};
    for (const row of rows) {
      if (!porPuesto[row.puesto_id]) porPuesto[row.puesto_id] = [];
      porPuesto[row.puesto_id].push(row);
    }
    res.json(porPuesto);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/planificacion-futura/proximos error");
    res.status(500).json({ error: "Error al cargar próximos cambios" });
  }
});

// ─── POST /api/operaciones/planificacion-futura ───────────────────────────────
// Crea un plan futuro para un puesto operativo O para un SSA
planificacionFuturaRouter.post("/operaciones/planificacion-futura", async (req, res) => {
  const {
    fecha,
    puestoId,
    ssaId,
    tipoEvento = "ausencia",
    tipoAusencia,
    tipoCobertura,
    titularAusenteId,
    relevId,
    motivo,
    notas,
    estado = "programado",
    fuente = "operaciones",
    creadoPor,
  } = req.body as {
    fecha: string;
    puestoId?: number | null;
    ssaId?: string | null;
    tipoEvento?: string;
    tipoAusencia?: string;
    tipoCobertura?: string;
    titularAusenteId?: number | null;
    relevId?: number | null;
    motivo?: string;
    notas?: string;
    estado?: string;
    fuente?: string;
    creadoPor?: string;
  };

  if (!fecha || (!puestoId && !ssaId)) {
    return res.status(400).json({ error: "fecha y (puestoId o ssaId) son requeridos" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" });
  }

  // Determinar tipo_cobertura_futura según contexto
  const tipoCoberturaNorm = tipoCobertura ?? (ssaId ? "ssa_programado" : "relevo_ausencia");
  const tipoEventoNorm    = ssaId ? "cobertura_ssa" : tipoEvento;

  try {
    const { rows } = await pool.query(`
      INSERT INTO planificacion_futura
        (fecha, puesto_id, ssa_id, tipo_evento, tipo_ausencia, tipo_cobertura_futura,
         titular_ausente_id, relevo_id, motivo, notas, estado, fuente, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      fecha,
      puestoId ?? null,
      ssaId ?? null,
      tipoEventoNorm,
      tipoAusencia ?? null,
      tipoCoberturaNorm,
      titularAusenteId ?? null,
      relevId ?? null,
      motivo ?? null,
      notas ?? null,
      estado,
      fuente,
      creadoPor ?? null,
    ]);

    logger.info({ id: rows[0].id, fecha, puestoId, ssaId }, "Planificación futura creada");
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /operaciones/planificacion-futura error");
    res.status(500).json({ error: "Error al crear planificación futura" });
  }
});

// ─── PATCH /api/operaciones/planificacion-futura/:id ─────────────────────────
// Actualiza un plan: puede asignar relevo, cambiar estado o notas
planificacionFuturaRouter.patch("/operaciones/planificacion-futura/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    relevId,
    estado,
    notas,
    motivo,
    tipoAusencia,
    titularAusenteId,
  } = req.body as {
    relevId?: number | null;
    estado?: string;
    notas?: string;
    motivo?: string;
    tipoAusencia?: string;
    titularAusenteId?: number | null;
  };

  try {
    const sets: string[] = ["updated_at = NOW()"];
    const vals: unknown[] = [];
    let idx = 1;

    if (relevId !== undefined)          { sets.push(`relevo_id = $${idx++}`);           vals.push(relevId ?? null); }
    if (estado !== undefined)           { sets.push(`estado = $${idx++}`);              vals.push(estado); }
    if (notas !== undefined)            { sets.push(`notas = $${idx++}`);               vals.push(notas); }
    if (motivo !== undefined)           { sets.push(`motivo = $${idx++}`);              vals.push(motivo); }
    if (tipoAusencia !== undefined)     { sets.push(`tipo_ausencia = $${idx++}`);       vals.push(tipoAusencia); }
    if (titularAusenteId !== undefined) { sets.push(`titular_ausente_id = $${idx++}`); vals.push(titularAusenteId ?? null); }

    if (vals.length === 0) return res.status(400).json({ error: "Sin cambios que aplicar" });

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE planificacion_futura SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "Plan no encontrado" });

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/planificacion-futura/:id error");
    res.status(500).json({ error: "Error al actualizar plan" });
  }
});

// ─── DELETE /api/operaciones/planificacion-futura/:id ────────────────────────
planificacionFuturaRouter.delete("/operaciones/planificacion-futura/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query("DELETE FROM planificacion_futura WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /operaciones/planificacion-futura/:id error");
    res.status(500).json({ error: "Error al eliminar plan" });
  }
});

// ─── PUT /api/operaciones/planificacion-futura/ssa-batch ─────────────────────
// Reemplaza TODOS los planes de una SSA para una fecha específica.
// Body: { fecha, ssaId, agentes: [{id, motivo?, notas?}], creadoPor? }
// Devuelve el arreglo actualizado de planes creados.
planificacionFuturaRouter.put("/operaciones/planificacion-futura/ssa-batch", async (req, res) => {
  const { fecha, ssaId, agentes = [], creadoPor = "sistema" } = req.body as {
    fecha: string;
    ssaId: string;
    agentes: Array<{ id: number | null; motivo?: string; notas?: string }>;
    creadoPor?: string;
  };
  if (!fecha || !ssaId) return res.status(400).json({ error: "fecha y ssaId son requeridos" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: "Formato de fecha inválido" });

  try {
    // Verificar que el SSA existe
    const { rows: ssaRows } = await pool.query(
      `SELECT id, cantidad_guardias FROM solicitudes_servicio_adicional WHERE id = $1`, [ssaId],
    );
    if (ssaRows.length === 0) return res.status(404).json({ error: "SSA no encontrada" });

    // Eliminar planes existentes para esta SSA+fecha
    await pool.query(
      `DELETE FROM planificacion_futura WHERE ssa_id = $1 AND fecha = $2::date`,
      [ssaId, fecha],
    );

    // Crear nuevos planes (uno por agente seleccionado)
    const creados: any[] = [];
    for (const ag of agentes) {
      if (!ag.id) continue; // omitir slots vacíos
      const { rows: empRows } = await pool.query(
        `SELECT id, nombre_completo FROM employees WHERE id = $1`, [ag.id],
      );
      if (empRows.length === 0) continue;

      const { rows: inserted } = await pool.query(
        `INSERT INTO planificacion_futura
           (fecha, ssa_id, puesto_id, tipo_evento, tipo_cobertura_futura, relevo_id, motivo, notas, estado, creado_por)
         VALUES ($1::date, $2, NULL, 'cobertura_ssa', 'ssa_programado', $3, $4, $5, 'activo', $6)
         RETURNING *`,
        [fecha, ssaId, ag.id, ag.motivo ?? null, ag.notas ?? null, creadoPor],
      );
      creados.push({ ...inserted[0], relevo_nombre: empRows[0].nombre_completo });
    }

    logger.info({ ssaId, fecha, count: creados.length }, "SSA batch plan actualizado");
    return res.json({ ok: true, planes: creados });
  } catch (err) {
    logger.error({ err }, "PUT /operaciones/planificacion-futura/ssa-batch error");
    return res.status(500).json({ error: "Error al guardar planes SSA" });
  }
});

// ─── GET /api/operaciones/proximos-arranques?dias=30 ─────────────────────────
// Servicios programados: clientes nuevos + SSA autorizados/pendientes
// Devuelve tipo: 'inicio_cliente' | 'ssa'
planificacionFuturaRouter.get("/operaciones/proximos-arranques", async (req, res) => {
  const dias = Math.min(parseInt((req.query.dias as string) ?? "30", 10), 180);
  try {
    const { rows } = await pool.query(`
      -- Clientes nuevos (inicio_cliente)
      SELECT
        'inicio_cliente'                                                        AS tipo,
        NULL                                                                    AS ssa_id,
        NULL                                                                    AS tipo_solicitud,
        c.id                                                                    AS cliente_id,
        c.nombre                                                                AS cliente_nombre,
        c.nombre_comercial                                                      AS cliente_nombre_comercial,
        c.sector,
        c.fecha_inicio_contrato                                                 AS fecha_inicio_contrato,
        COUNT(po.id)::int                                                       AS total_puestos,
        COUNT(po.id) FILTER (WHERE po.titular_employee_id IS NOT NULL)::int     AS puestos_con_titular,
        COUNT(po.id) FILTER (WHERE po.titular_employee_id IS NULL)::int         AS puestos_sin_titular,
        (c.fecha_inicio_contrato - CURRENT_DATE)::int                           AS dias_para_inicio,
        NULL                                                                    AS descripcion,
        NULL                                                                    AS hora_inicio,
        NULL                                                                    AS hora_fin,
        NULL                                                                    AS estado_ssa
      FROM clients c
      LEFT JOIN puestos_operativos po ON po.cliente_id = c.id AND po.activo = true
      WHERE c.fecha_inicio_contrato >= CURRENT_DATE
        AND c.fecha_inicio_contrato <= CURRENT_DATE + ($1 || ' days')::interval
      GROUP BY c.id, c.nombre, c.nombre_comercial, c.sector, c.fecha_inicio_contrato

      UNION ALL

      -- SSA autorizados o pendientes (ssa)
      SELECT
        'ssa'                                                                   AS tipo,
        s.id                                                                    AS ssa_id,
        s.tipo_solicitud,
        s.cliente_id,
        c.nombre                                                                AS cliente_nombre,
        c.nombre_comercial                                                      AS cliente_nombre_comercial,
        c.sector,
        s.fecha                                                                 AS fecha_inicio_contrato,
        s.cantidad_guardias                                                     AS total_puestos,
        0                                                                       AS puestos_con_titular,
        s.cantidad_guardias                                                     AS puestos_sin_titular,
        (s.fecha - CURRENT_DATE)::int                                           AS dias_para_inicio,
        s.descripcion,
        s.hora_inicio,
        s.hora_fin,
        s.estado_general                                                        AS estado_ssa
      FROM solicitudes_servicio_adicional s
      JOIN clients c ON c.id = s.cliente_id
      WHERE s.fecha >= CURRENT_DATE
        AND s.fecha <= CURRENT_DATE + ($1 || ' days')::interval
        AND s.estado_general NOT IN ('cancelada', 'cubierta')

      ORDER BY dias_para_inicio, tipo
    `, [dias]);
    res.json({ arranques: rows, total: rows.length, dias });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/proximos-arranques error");
    res.status(500).json({ error: "Error al obtener próximos arranques" });
  }
});

// ─── GET /api/operaciones/pool-futuro?fecha=YYYY-MM-DD ────────────────────────
// Calcula disponibilidad futura por turno + ausencias planificadas + eventos RRHH
planificacionFuturaRouter.get("/operaciones/pool-futuro", async (req, res) => {
  const { fecha } = req.query as { fecha?: string };
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Parámetro 'fecha' requerido en formato YYYY-MM-DD" });
  }

  try {
    // 1. Obtener todos los empleados activos con su asignación y turno
    //    Para guardias: turno viene del puesto (t).
    //    Para supervisores/jefes: turno viene directamente del EOA (t_eoa + eoa.fecha_inicio).
    const { rows: empleados } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo,
        e.nombre_completo AS nombre,
        e.elegible_pool,
        e.estado_laboral,
        COALESCE(e.tipo_personal, 'guardia') AS tipo_personal,
        -- Asignación operativa activa
        eoa.puesto_id,
        po.nombre        AS puesto_nombre,
        po.cliente_nombre,
        po.cliente_id,
        -- Turno: desde puesto (guardias) o desde EOA directo (supervisores/jefes)
        COALESCE(t.id,            t_eoa.id)            AS turno_id,
        COALESCE(t.nombre,        t_eoa.nombre)        AS turno_nombre,
        COALESCE(
          t.tipo_ciclo,
          t_eoa.tipo_ciclo,
          CASE WHEN COALESCE(t.horas_trabajo, t_eoa.horas_trabajo, 0)
                    + COALESCE(t.horas_descanso, t_eoa.horas_descanso, 0) <= 24
               THEN 'diario' ELSE 'alternado' END
        )                                              AS tipo_ciclo,
        COALESCE(t.horas_trabajo,  t_eoa.horas_trabajo)  AS horas_trabajo,
        COALESCE(t.horas_descanso, t_eoa.horas_descanso) AS horas_descanso,
        -- fecha_inicio_ciclo: EOA individual tiene prioridad (rotaciones 24x24 con
        -- dos titulares de distinta fecha_inicio). Fallback a puesto (supervisores sin EOA).
        -- IMPORTANTE: usar AT TIME ZONE 'UTC' antes de ::date para extraer la fecha
        -- en UTC y evitar que la sesión Guatemala (UTC-6) desplace la medianoche UTC
        -- al día anterior (e.g. "2026-04-03 00:00:00+00" → 2026-04-02 en Guatemala → INCORRECTO).
        COALESCE(
          (eoa.fecha_inicio AT TIME ZONE 'UTC')::date::text,
          po.fecha_inicio_ciclo::text
        ) AS fecha_inicio_ciclo,
        -- Ausencia en planificacion_futura como titular ausente
        pf.id            AS plan_id,
        pf.tipo_ausencia AS plan_tipo_ausencia,
        pf.relevo_id     AS plan_relevo_id,
        pf.estado        AS plan_estado,
        pf.puesto_id     AS plan_puesto_id
      FROM employees e
      LEFT JOIN employee_operational_assignments eoa
             ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN puestos_operativos po
             ON po.id = eoa.puesto_id AND po.activo = TRUE
      LEFT JOIN turnos t
             ON t.id = po.tipo_turno_id
      LEFT JOIN turnos t_eoa
             ON t_eoa.id = eoa.tipo_turno_id
      LEFT JOIN planificacion_futura pf
             ON pf.titular_ausente_id = e.id
            AND pf.fecha = $1
            AND pf.estado != 'cancelado'
      WHERE e.estado_laboral IN ('activo', 'suspendido', 'incapacitado')
      ORDER BY e.nombre_completo
    `, [fecha]);

    // 2. Eventos RRHH aprobados/pendientes para esa fecha
    // Soporta rangos: si fecha_fin está definido, verifica que la fecha consultada esté dentro del rango
    const { rows: eventosRrhh } = await pool.query(`
      SELECT
        employee_id,
        employee_nombre,
        tipo_evento,
        estado,
        fecha_fin
      FROM eventos_rrhh
      WHERE $1::date BETWEEN DATE(fecha) AND COALESCE(fecha_fin, DATE(fecha))
        AND estado IN ('aprobado', 'pendiente', 'activo')
        AND tipo_evento IN (
          'permiso', 'vacaciones', 'incapacidad', 'suspension',
          'falta', 'falta_injustificada', 'permiso_sin_goce',
          'permiso_con_goce', 'permiso_goce_sueldo', 'amonestacion',
          'relevo_vacaciones', 'cambio_titular'
        )
    `, [fecha]);

    const eventosMap = new Map<number, { tipo: string; estado: string }>();
    for (const ev of eventosRrhh) {
      if (!eventosMap.has(ev.employee_id)) {
        eventosMap.set(ev.employee_id, { tipo: ev.tipo_evento, estado: ev.estado });
      }
    }

    // 3. Quiénes son relevos programados para esa fecha (ya asignados como cobertura)
    const { rows: relevos } = await pool.query(`
      SELECT DISTINCT relevo_id
      FROM planificacion_futura
      WHERE fecha = $1 AND estado != 'cancelado' AND relevo_id IS NOT NULL
    `, [fecha]);
    const relevosSet = new Set(relevos.map((r: any) => r.relevo_id as number));

    // 4. Función de cálculo de turno para una fecha usando el motor de turnos real
    // NOTA: pg devuelve NUMERIC como string; parseFloat normaliza antes de pasar al motor
    function calcularEstadoTurno(
      horasTrabajo: number | string | null,
      horasDescanso: number | string | null,
      fechaInicioCiclo: string | Date | null,
      turnoId?: number | null,
      turnoNombre?: string | null,
      tipoCiclo?: string | null,
    ): { estado: "trabajando" | "descansando" | "sin_turno"; descansoPorCiclo: boolean; disponibleHE: boolean } {
      const ht = horasTrabajo != null ? parseFloat(String(horasTrabajo)) : null;
      const hd = horasDescanso != null ? parseFloat(String(horasDescanso)) : 0;
      if (!ht) return { estado: "sin_turno", descansoPorCiclo: false, disponibleHE: true };

      const estadoCiclo = calcularEstadoCiclo(
        {
          id: turnoId ?? 0,
          nombre: turnoNombre ?? "",
          horas_trabajo: ht,
          horas_descanso: hd,
          tipo_ciclo: tipoCiclo ?? undefined,
        },
        fechaInicioCiclo,
        fecha,
      );

      if (estadoCiclo.trabaja) {
        return { estado: "trabajando", descansoPorCiclo: false, disponibleHE: false };
      } else {
        return {
          estado: estadoCiclo.descansoPorCiclo ? "descansando" : "sin_turno",
          descansoPorCiclo: estadoCiclo.descansoPorCiclo,
          disponibleHE: estadoCiclo.disponibleHE,
        };
      }
    }

    // 5. Categorizar cada empleado
    const trabajando:         typeof empleados = [];
    const descansando:        typeof empleados = [];
    const disponible:         typeof empleados = [];
    const relevoProgramado:   typeof empleados = [];
    const ausenteProgramado:  typeof empleados = [];
    const noElegible:         typeof empleados = [];

    for (const emp of empleados) {
      // Empleados suspendidos o incapacitados → siempre no elegibles (independiente de puesto)
      if (emp.estado_laboral === "suspendido" || emp.estado_laboral === "incapacitado") {
        noElegible.push({ ...emp, razon_no_elegible: emp.estado_laboral });
        continue;
      }

      // ¿Tiene evento RRHH aprobado ese día? → ausente programado (incluso si tiene puesto)
      const eventoRrhh = eventosMap.get(emp.id);
      if (eventoRrhh) {
        ausenteProgramado.push({ ...emp, fuente_ausencia: "rrhh", tipo_ausencia_rrhh: eventoRrhh.tipo });
        continue;
      }

      // ¿Tiene planificacion_futura como titular ausente?
      if (emp.plan_id && emp.plan_estado !== "cancelado") {
        ausenteProgramado.push({ ...emp, fuente_ausencia: "planificacion_futura" });
        continue;
      }

      // ¿Es relevo programado en algún puesto?
      if (relevosSet.has(emp.id)) {
        relevoProgramado.push({ ...emp });
        continue;
      }

      // ¿Tiene puesto asignado O turno directo en EOA (supervisores/jefes)?
      // → calcular ciclo usando motor real (independiente de elegible_pool)
      if (emp.puesto_id || emp.turno_id) {
        const { estado, descansoPorCiclo, disponibleHE } = calcularEstadoTurno(
          emp.horas_trabajo, emp.horas_descanso, emp.fecha_inicio_ciclo,
          emp.turno_id, emp.turno_nombre, emp.tipo_ciclo,
        );
        if (estado === "trabajando") {
          trabajando.push({ ...emp, estado_turno: "trabajando", descansoPorCiclo: false, disponibleHE: false });
        } else if (estado === "descansando") {
          descansando.push({ ...emp, estado_turno: "descansando", descansoPorCiclo, disponibleHE });
        } else {
          // Sin turno definido → asumir trabajando si tiene puesto, disponible si solo tiene EOA
          if (emp.puesto_id) {
            trabajando.push({ ...emp, estado_turno: "sin_turno_asume_trabajo", descansoPorCiclo: false, disponibleHE: false });
          } else {
            disponible.push({ ...emp, estado_turno: "sin_turno" });
          }
        }
        continue;
      }

      // Sin puesto ni turno EOA: elegible_pool determina disponibilidad
      if (!emp.elegible_pool) {
        noElegible.push({ ...emp, razon_no_elegible: "no_elegible_pool" });
        continue;
      }

      // Sin puesto y elegible → disponible en el pool
      disponible.push({ ...emp });
    }

    // ── Servicios programados para esta fecha: clientes nuevos + SSA ──
    const { rows: iniciosProyecto } = await pool.query(`
      -- Clientes cuya fecha_inicio_contrato = fecha consultada
      SELECT
        'inicio_cliente'        AS tipo,
        NULL                    AS ssa_id,
        NULL                    AS tipo_solicitud,
        c.id                    AS cliente_id,
        c.nombre                AS cliente_nombre,
        c.nombre_comercial      AS cliente_nombre_comercial,
        c.sector,
        c.notas,
        c.fecha_inicio_contrato AS fecha_inicio_contrato,
        COUNT(po.id)::int       AS total_puestos,
        COUNT(po.id) FILTER (WHERE po.titular_employee_id IS NOT NULL)::int AS puestos_con_titular,
        COUNT(po.id) FILTER (WHERE po.titular_employee_id IS NULL)::int     AS puestos_sin_titular,
        json_agg(json_build_object(
          'id', po.id,
          'nombre', po.nombre,
          'turno_nombre', t.nombre,
          'titular_nombre', ea.nombre_completo,
          'activo', po.activo
        ) ORDER BY po.nombre) FILTER (WHERE po.id IS NOT NULL) AS puestos,
        NULL                    AS descripcion,
        NULL                    AS hora_inicio,
        NULL                    AS hora_fin,
        NULL                    AS estado_ssa
      FROM clients c
      LEFT JOIN puestos_operativos po ON po.cliente_id = c.id AND po.activo = true
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      LEFT JOIN employees ea ON ea.id = po.titular_employee_id
      WHERE c.fecha_inicio_contrato = $1::date
      GROUP BY c.id, c.nombre, c.nombre_comercial, c.sector, c.notas, c.fecha_inicio_contrato

      UNION ALL

      -- SSA pendientes/pendientes-operaciones para esta fecha
      SELECT
        'ssa'                   AS tipo,
        s.id                    AS ssa_id,
        s.tipo_solicitud,
        s.cliente_id,
        c.nombre                AS cliente_nombre,
        c.nombre_comercial      AS cliente_nombre_comercial,
        c.sector,
        NULL                    AS notas,
        s.fecha                 AS fecha_inicio_contrato,
        s.cantidad_guardias     AS total_puestos,
        0                       AS puestos_con_titular,
        s.cantidad_guardias     AS puestos_sin_titular,
        NULL::json              AS puestos,
        s.descripcion,
        s.hora_inicio,
        s.hora_fin,
        s.estado_general        AS estado_ssa
      FROM solicitudes_servicio_adicional s
      JOIN clients c ON c.id = s.cliente_id
      WHERE $1::date BETWEEN s.fecha AND COALESCE(s.fecha_fin, s.fecha)
        AND s.estado_general NOT IN ('cancelada', 'cubierta')

      ORDER BY tipo, cliente_nombre
    `, [fecha]);

    // ── Planes existentes para SSA en esta fecha (multi-agente) ───────────
    const ssaIds = iniciosProyecto
      .filter((r: any) => r.tipo === "ssa" && r.ssa_id)
      .map((r: any) => r.ssa_id);

    const planPorSSA: Record<string, Array<{ plan_id: number; relevo_id: number | null; relevo_nombre: string | null }>> = {};
    if (ssaIds.length > 0) {
      const { rows: planesSSA } = await pool.query(`
        SELECT pf.id, pf.ssa_id, pf.relevo_id, e.nombre_completo AS relevo_nombre, pf.tipo_cobertura_futura
        FROM planificacion_futura pf
        LEFT JOIN employees e ON e.id = pf.relevo_id
        WHERE pf.fecha = $1::date
          AND pf.ssa_id = ANY($2::varchar[])
          AND pf.estado != 'cancelado'
        ORDER BY pf.id ASC
      `, [fecha, ssaIds]);
      for (const p of planesSSA) {
        if (!planPorSSA[p.ssa_id]) planPorSSA[p.ssa_id] = [];
        planPorSSA[p.ssa_id].push({
          plan_id:       p.id,
          relevo_id:     p.relevo_id,
          relevo_nombre: p.relevo_nombre,
        });
      }
    }

    // Enriquecer iniciosProyecto con plan_agentes array
    const iniciosProyectoEnriquecido = iniciosProyecto.map((ip: any) => {
      if (ip.tipo === "ssa" && ip.ssa_id) {
        return { ...ip, plan_agentes: planPorSSA[ip.ssa_id] ?? [] };
      }
      return { ...ip, plan_agentes: [] };
    });

    res.json({
      fecha,
      trabajando,
      descansando,
      disponible,
      relevoProgramado,
      ausenteProgramado,
      noElegible,
      iniciosProyecto: iniciosProyectoEnriquecido,
      totales: {
        trabajando:        trabajando.length,
        descansando:       descansando.length,
        disponible:        disponible.length,
        relevoProgramado:  relevoProgramado.length,
        ausenteProgramado: ausenteProgramado.length,
        noElegible:        noElegible.length,
        iniciosProyecto:   iniciosProyectoEnriquecido.length,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/pool-futuro error");
    res.status(500).json({ error: "Error al calcular disponibilidad futura" });
  }
});
