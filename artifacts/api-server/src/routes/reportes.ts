/**
 * REPORTES — Endpoints de reportería profesional ISP, S.A.
 *
 * ENDPOINTS:
 *   GET /reportes/operaciones  → Incidencias agregadas
 *   GET /reportes/emergencias  → Incidencias de emergencia
 *   GET /reportes/tareas       → Tareas operativas
 *   GET /reportes/rrhh         → Anticipos + Reclutamiento
 *   GET /reportes/comercial    → Leads comerciales
 *   GET /reportes/kpi          → KPI ejecutivo consolidado
 *
 * FILTROS COMUNES (query params):
 *   desde    → ISO date string (ej: 2026-01-01)
 *   hasta    → ISO date string (ej: 2026-03-31)
 *   cliente  → nombre parcial del cliente
 *   estado   → estado exacto
 *   canal    → "whatsapp" | "web" | "manual"
 *   prioridad → "alta" | "media" | "baja"
 *
 * EXTENSIBILIDAD:
 *   Para agregar un nuevo reporte: añadir endpoint en este archivo con
 *   la misma firma de filtros y la estructura de respuesta estandarizada.
 */

import { Router, type Request } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helpers de filtro ────────────────────────────────────────────────────────

interface Filtros {
  desde?: string;
  hasta?: string;
  cliente?: string;
  estado?: string;
  canal?: string;
  prioridad?: string;
}

function parseFiltros(req: Request): Filtros {
  return {
    desde: req.query.desde as string | undefined,
    hasta: req.query.hasta as string | undefined,
    cliente: req.query.cliente as string | undefined,
    estado: req.query.estado as string | undefined,
    canal: req.query.canal as string | undefined,
    prioridad: req.query.prioridad as string | undefined,
  };
}

function buildDateClause(campo: string, desde?: string, hasta?: string, params: unknown[] = []): string {
  const clauses: string[] = [];
  if (desde) {
    params.push(new Date(desde));
    clauses.push(`${campo} >= $${params.length}`);
  }
  if (hasta) {
    const hastaFin = new Date(hasta);
    hastaFin.setHours(23, 59, 59, 999);
    params.push(hastaFin);
    clauses.push(`${campo} <= $${params.length}`);
  }
  return clauses.join(" AND ");
}

// ─── GET /reportes/operaciones ────────────────────────────────────────────────
router.get("/reportes/operaciones", async (req, res) => {
  try {
    const f = parseFiltros(req);
    const params: unknown[] = [];
    const where: string[] = ["es_emergencia = false OR es_emergencia IS NULL"];

    const dateClause = buildDateClause("fecha", f.desde, f.hasta, params);
    if (dateClause) where.push(dateClause);
    if (f.cliente) { params.push(`%${f.cliente}%`); where.push(`cliente ILIKE $${params.length}`); }
    if (f.estado) { params.push(f.estado); where.push(`estado = $${params.length}`); }
    if (f.canal) { params.push(f.canal); where.push(`origen = $${params.length}`); }
    if (f.prioridad) { params.push(f.prioridad); where.push(`prioridad = $${params.length}`); }

    const wClause = `WHERE ${where.join(" AND ")}`;

    const [summary, porEstado, porTipo, porPrioridad, porOrigen, porCliente, ultimas] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'abierta') AS abiertas,
          COUNT(*) FILTER (WHERE estado = 'en_proceso') AS en_proceso,
          COUNT(*) FILTER (WHERE estado = 'resuelta') AS resueltas,
          COUNT(*) FILTER (WHERE estado = 'cerrada') AS cerradas
        FROM incidents ${wClause}
      `, params),
      pool.query(`SELECT estado, COUNT(*) as total FROM incidents ${wClause} GROUP BY estado ORDER BY total DESC`, params),
      pool.query(`SELECT tipo, COUNT(*) as total FROM incidents ${wClause} GROUP BY tipo ORDER BY total DESC LIMIT 10`, params),
      pool.query(`SELECT prioridad, COUNT(*) as total FROM incidents ${wClause} GROUP BY prioridad ORDER BY total DESC`, params),
      pool.query(`SELECT origen, COUNT(*) as total FROM incidents ${wClause} GROUP BY origen ORDER BY total DESC`, params),
      pool.query(`SELECT cliente, COUNT(*) as total FROM incidents ${wClause} GROUP BY cliente ORDER BY total DESC LIMIT 10`, params),
      pool.query(`
        SELECT id, fecha, cliente, tipo, estado, prioridad, origen, ubicacion, responsable
        FROM incidents ${wClause}
        ORDER BY fecha DESC
        LIMIT 50
      `, params),
    ]);

    res.json({
      resumen: summary.rows[0],
      porEstado: porEstado.rows,
      porTipo: porTipo.rows,
      porPrioridad: porPrioridad.rows,
      porOrigen: porOrigen.rows,
      porCliente: porCliente.rows,
      incidencias: ultimas.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/operaciones error");
    res.status(500).json({ error: "Error al generar reporte de operaciones" });
  }
});

// ─── GET /reportes/emergencias ────────────────────────────────────────────────
router.get("/reportes/emergencias", async (req, res) => {
  try {
    const f = parseFiltros(req);
    const params: unknown[] = [true];
    const where: string[] = ["es_emergencia = $1"];

    const dateClause = buildDateClause("fecha", f.desde, f.hasta, params);
    if (dateClause) where.push(dateClause);
    if (f.cliente) { params.push(`%${f.cliente}%`); where.push(`cliente ILIKE $${params.length}`); }
    if (f.estado) { params.push(f.estado); where.push(`estado = $${params.length}`); }

    const wClause = `WHERE ${where.join(" AND ")}`;

    const [summary, porCliente, porTipo, porOrigen, activas, todas] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'abierta' OR estado = 'en_proceso') AS activas,
          COUNT(*) FILTER (WHERE estado = 'resuelta' OR estado = 'cerrada') AS cerradas
        FROM incidents ${wClause}
      `, params),
      pool.query(`SELECT cliente, COUNT(*) as total FROM incidents ${wClause} GROUP BY cliente ORDER BY total DESC LIMIT 10`, params),
      pool.query(`SELECT tipo, COUNT(*) as total FROM incidents ${wClause} GROUP BY tipo ORDER BY total DESC`, params),
      pool.query(`SELECT reportado_por, COUNT(*) as total FROM incidents ${wClause} AND reportado_por IS NOT NULL GROUP BY reportado_por ORDER BY total DESC`, params),
      pool.query(`
        SELECT id, fecha, cliente, tipo, estado, ubicacion, reportado_por
        FROM incidents ${wClause} AND (estado = 'abierta' OR estado = 'en_proceso')
        ORDER BY fecha DESC
      `, params),
      pool.query(`
        SELECT id, fecha, cliente, tipo, estado, prioridad, ubicacion, reportado_por, origen
        FROM incidents ${wClause}
        ORDER BY fecha DESC LIMIT 50
      `, params),
    ]);

    res.json({
      resumen: summary.rows[0],
      porCliente: porCliente.rows,
      porTipo: porTipo.rows,
      porReportador: porOrigen.rows,
      activas: activas.rows,
      emergencias: todas.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/emergencias error");
    res.status(500).json({ error: "Error al generar reporte de emergencias" });
  }
});

// ─── GET /reportes/tareas ─────────────────────────────────────────────────────
router.get("/reportes/tareas", async (req, res) => {
  try {
    const f = parseFiltros(req);
    const params: unknown[] = [];
    const where: string[] = ["1=1"];

    const dateClause = buildDateClause("t.created_at", f.desde, f.hasta, params);
    if (dateClause) where.push(dateClause);
    if (f.estado) { params.push(f.estado); where.push(`t.estado = $${params.length}`); }
    if (f.prioridad) { params.push(f.prioridad); where.push(`t.prioridad = $${params.length}`); }

    const wClause = `WHERE ${where.join(" AND ")}`;

    const [summary, porEstado, porPrioridad, porSupervisor, conEvidencia, listaTareas] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE t.estado = 'pendiente') AS pendientes,
          COUNT(*) FILTER (WHERE t.estado = 'en_proceso') AS en_proceso,
          COUNT(*) FILTER (WHERE t.estado = 'completada') AS completadas,
          COUNT(*) FILTER (WHERE t.estado = 'cancelada') AS canceladas,
          COUNT(e.id) AS con_evidencia
        FROM tareas t
        LEFT JOIN task_evidencias e ON e.tarea_id = t.id
        ${wClause}
      `, params),
      pool.query(`SELECT t.estado, COUNT(*) as total FROM tareas t ${wClause} GROUP BY t.estado ORDER BY total DESC`, params),
      pool.query(`SELECT t.prioridad, COUNT(*) as total FROM tareas t ${wClause} GROUP BY t.prioridad ORDER BY total DESC`, params),
      pool.query(`
        SELECT e.supervisor_nombre, COUNT(*) as tareas_cerradas, MAX(e.fecha_cierre) as ultimo_cierre
        FROM task_evidencias e
        JOIN tareas t ON t.id = e.tarea_id
        ${wClause}
        GROUP BY e.supervisor_nombre ORDER BY tareas_cerradas DESC
      `, params),
      pool.query(`
        SELECT t.id, t.titulo, t.prioridad, t.asignado, e.supervisor_nombre,
               e.comentario, e.canal, e.fecha_cierre
        FROM tareas t
        JOIN task_evidencias e ON e.tarea_id = t.id
        ${wClause}
        ORDER BY e.fecha_cierre DESC LIMIT 20
      `, params),
      pool.query(`
        SELECT t.id, t.titulo, t.estado, t.prioridad, t.asignado, t.incidencia_id,
               t.trello_card_id, t.created_at, t.updated_at
        FROM tareas t ${wClause}
        ORDER BY t.created_at DESC LIMIT 50
      `, params),
    ]);

    res.json({
      resumen: summary.rows[0],
      porEstado: porEstado.rows,
      porPrioridad: porPrioridad.rows,
      porSupervisor: porSupervisor.rows,
      conEvidencia: conEvidencia.rows,
      tareas: listaTareas.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/tareas error");
    res.status(500).json({ error: "Error al generar reporte de tareas" });
  }
});

// ─── GET /reportes/rrhh ───────────────────────────────────────────────────────
router.get("/reportes/rrhh", async (req, res) => {
  try {
    const f = parseFiltros(req);
    const params: unknown[] = [];
    const where: string[] = ["1=1"];

    const dateClause = buildDateClause("fecha_solicitud", f.desde, f.hasta, params);
    if (dateClause) where.push(dateClause);
    if (f.estado) { params.push(f.estado); where.push(`estado = $${params.length}`); }
    if (f.canal) { params.push(f.canal); where.push(`origen = $${params.length}`); }

    const aWhere = `WHERE ${where.join(" AND ")}`;

    // Filtros para postulaciones
    const appParams: unknown[] = [];
    const appWhere: string[] = ["1=1"];
    const appDateClause = buildDateClause("created_at", f.desde, f.hasta, appParams);
    if (appDateClause) appWhere.push(appDateClause);
    if (f.estado) { appParams.push(f.estado); appWhere.push(`estado = $${appParams.length}`); }
    if (f.canal) { appParams.push(f.canal); appWhere.push(`canal = $${appParams.length}`); }
    const appsClause = `WHERE ${appWhere.join(" AND ")}`;

    const [anticipoSummary, anticipoPorEstado, anticipoPorPeriodo, anticipoLista,
           appSummary, appPorEstado, appPorCanal, appLista] = await Promise.all([
      // Anticipos
      pool.query(`
        SELECT
          COUNT(*) AS total_solicitudes,
          SUM(cantidad) AS monto_total,
          SUM(CASE WHEN estado='pendiente' THEN cantidad ELSE 0 END) AS monto_pendiente,
          SUM(CASE WHEN estado='aprobada' THEN cantidad ELSE 0 END) AS monto_aprobado,
          SUM(CASE WHEN estado='pagada' THEN cantidad ELSE 0 END) AS monto_pagado
        FROM anticipos ${aWhere}
      `, params),
      pool.query(`SELECT estado, COUNT(*) as total, SUM(cantidad) as monto FROM anticipos ${aWhere} GROUP BY estado ORDER BY total DESC`, params),
      pool.query(`SELECT periodo, COUNT(*) as total, SUM(cantidad) as monto FROM anticipos ${aWhere} AND periodo IS NOT NULL GROUP BY periodo ORDER BY periodo DESC`, params),
      pool.query(`
        SELECT id, nombre, puesto, cantidad, estado, periodo, fecha_solicitud
        FROM anticipos ${aWhere}
        ORDER BY fecha_solicitud DESC LIMIT 30
      `, params),
      // Reclutamiento
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'recibido') AS recibidas,
          COUNT(*) FILTER (WHERE estado = 'aprobado') AS aprobadas,
          COUNT(*) FILTER (WHERE estado = 'descartado') AS descartadas
        FROM applications ${appsClause}
      `, appParams),
      pool.query(`SELECT estado, COUNT(*) as total FROM applications ${appsClause} GROUP BY estado ORDER BY total DESC`, appParams),
      pool.query(`SELECT canal, COUNT(*) as total FROM applications ${appsClause} GROUP BY canal ORDER BY total DESC`, appParams),
      pool.query(`
        SELECT id, nombre, puesto, canal, estado, ubicacion, created_at
        FROM applications ${appsClause}
        ORDER BY created_at DESC LIMIT 30
      `, appParams),
    ]);

    res.json({
      anticipos: {
        resumen: anticipoSummary.rows[0],
        porEstado: anticipoPorEstado.rows,
        porPeriodo: anticipoPorPeriodo.rows,
        lista: anticipoLista.rows,
      },
      reclutamiento: {
        resumen: appSummary.rows[0],
        porEstado: appPorEstado.rows,
        porCanal: appPorCanal.rows,
        lista: appLista.rows,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/rrhh error");
    res.status(500).json({ error: "Error al generar reporte RRHH" });
  }
});

// ─── GET /reportes/comercial ──────────────────────────────────────────────────
router.get("/reportes/comercial", async (req, res) => {
  try {
    const f = parseFiltros(req);
    const params: unknown[] = [];
    const where: string[] = ["1=1"];

    const dateClause = buildDateClause("created_at", f.desde, f.hasta, params);
    if (dateClause) where.push(dateClause);
    if (f.estado) { params.push(f.estado); where.push(`estado = $${params.length}`); }
    if (f.canal) { params.push(f.canal); where.push(`canal = $${params.length}`); }

    const wClause = `WHERE ${where.join(" AND ")}`;

    const [summary, porEstado, porCanal, porServicio, porEjecutivo, lista] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'nuevo') AS nuevos,
          COUNT(*) FILTER (WHERE estado = 'contactado') AS contactados,
          COUNT(*) FILTER (WHERE estado = 'cotizado') AS cotizados,
          COUNT(*) FILTER (WHERE estado = 'ganado') AS ganados,
          COUNT(*) FILTER (WHERE estado = 'perdido') AS perdidos
        FROM leads ${wClause}
      `, params),
      pool.query(`SELECT estado, COUNT(*) as total FROM leads ${wClause} GROUP BY estado ORDER BY total DESC`, params),
      pool.query(`SELECT canal, COUNT(*) as total FROM leads ${wClause} GROUP BY canal ORDER BY total DESC`, params),
      pool.query(`SELECT servicio, COUNT(*) as total FROM leads ${wClause} GROUP BY servicio ORDER BY total DESC LIMIT 8`, params),
      pool.query(`SELECT ejecutivo, COUNT(*) as total FROM leads ${wClause} AND ejecutivo IS NOT NULL GROUP BY ejecutivo ORDER BY total DESC`, params),
      pool.query(`
        SELECT id, empresa, contacto, servicio, canal, estado, ejecutivo, ubicacion, created_at
        FROM leads ${wClause}
        ORDER BY created_at DESC LIMIT 50
      `, params),
    ]);

    res.json({
      resumen: summary.rows[0],
      porEstado: porEstado.rows,
      porCanal: porCanal.rows,
      porServicio: porServicio.rows,
      porEjecutivo: porEjecutivo.rows,
      leads: lista.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/comercial error");
    res.status(500).json({ error: "Error al generar reporte comercial" });
  }
});

// ─── GET /reportes/kpi ────────────────────────────────────────────────────────
router.get("/reportes/kpi", async (req, res) => {
  try {
    const f = parseFiltros(req);
    const params: unknown[] = [];
    const dateClause = buildDateClause("fecha", f.desde, f.hasta, params);
    const incWhere = dateClause ? `WHERE ${dateClause}` : "";

    const aParams: unknown[] = [];
    const aDateClause = buildDateClause("fecha_solicitud", f.desde, f.hasta, aParams);
    const aWhere = aDateClause ? `WHERE ${aDateClause}` : "";

    const tParams: unknown[] = [];
    const tDateClause = buildDateClause("created_at", f.desde, f.hasta, tParams);
    const tWhere = tDateClause ? `WHERE ${tDateClause}` : "";

    const [incidencias, emergencias, tareas, anticipos, leads, apps, clientesActivos] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'abierta' OR estado = 'en_proceso') AS activas,
          COUNT(*) FILTER (WHERE estado = 'resuelta' OR estado = 'cerrada') AS cerradas,
          COUNT(*) FILTER (WHERE prioridad = 'alta') AS criticas
        FROM incidents ${incWhere}
      `, params),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'abierta' OR estado = 'en_proceso') AS activas
        FROM incidents ${incWhere ? incWhere + " AND" : "WHERE"} es_emergencia = true
      `, params),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'completada') AS completadas,
          COUNT(*) FILTER (WHERE estado = 'pendiente' OR estado = 'en_proceso') AS activas
        FROM tareas ${tWhere}
      `, tParams),
      pool.query(`
        SELECT
          COUNT(*) AS total_solicitudes,
          SUM(cantidad) AS monto_total,
          COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes
        FROM anticipos ${aWhere}
      `, aParams),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE estado = 'ganado') AS ganados
        FROM leads ${incWhere ? "WHERE" + incWhere.replace("WHERE", "") : ""}
      `, params),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM applications ${tWhere}
      `, tParams),
      pool.query(`
        SELECT cliente, COUNT(*) as incidencias
        FROM incidents ${incWhere}
        GROUP BY cliente ORDER BY incidencias DESC LIMIT 5
      `, params),
    ]);

    const incTotal = parseInt(incidencias.rows[0]?.total ?? 0);
    const tareasComp = parseInt(tareas.rows[0]?.completadas ?? 0);
    const tareasTotal = parseInt(tareas.rows[0]?.total ?? 0);
    const cumplimientoTareas = tareasTotal > 0 ? Math.round((tareasComp / tareasTotal) * 100) : 0;

    res.json({
      incidencias: incidencias.rows[0],
      emergencias: emergencias.rows[0],
      tareas: { ...tareas.rows[0], cumplimiento_pct: cumplimientoTareas },
      anticipos: anticipos.rows[0],
      leads: leads.rows[0],
      postulaciones: apps.rows[0],
      clientesActivos: clientesActivos.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/kpi error");
    res.status(500).json({ error: "Error al generar KPI ejecutivo" });
  }
});

// ─── GET /reportes/cobertura-zonas ───────────────────────────────────────────
// Reporte de cobertura operativa por zona, con soporte de períodos
// Params: desde, hasta, zona_id, cliente_id, sede_id, tipo_cobertura, supervisor_id
// ─────────────────────────────────────────────────────────────────────────────
// REPORTE: PLANTILLA DE TURNOS VIGENTE
// Devuelve por cliente → puesto → slots, la plantilla actual con titularidad,
// turno (24/12), rotación (1-4 semanas), días de trabajo/descanso por semana
// y hora de entrada por semana. Foto del momento (no histórico).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/reportes/plantilla-turnos", async (req, res) => {
  try {
    const { cliente_id, zona_id, sede_id, solo_vacantes } = req.query;

    // Helper: parseo seguro de filtro entero (devuelve null si inválido)
    const intFiltro = (v: unknown): number | null | "invalid" => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : "invalid";
    };

    const fCliente = intFiltro(cliente_id);
    const fZona    = intFiltro(zona_id);
    const fSede    = intFiltro(sede_id);
    if (fCliente === "invalid" || fZona === "invalid" || fSede === "invalid") {
      return res.status(400).json({ error: "Parámetros inválidos: cliente_id, zona_id y sede_id deben ser enteros positivos" });
    }

    // WHERE filtra solo lo que aplica a puestos_operativos (NUNCA a ps,
    // para no convertir el LEFT JOIN en INNER JOIN y perder puestos sin slot).
    const params: unknown[] = [];
    const clauses: string[] = ["po.activo = TRUE"];

    if (fCliente !== null) {
      params.push(fCliente);
      clauses.push(`po.cliente_id = $${params.length}`);
    }
    if (fZona !== null) {
      params.push(fZona);
      clauses.push(`po.zona_operativa_id = $${params.length}`);
    }
    if (fSede !== null) {
      params.push(fSede);
      clauses.push(`po.sede_id = $${params.length}`);
    }
    // solo_vacantes: incluye slots sin titular Y puestos sin slots configurados.
    // Como ps.activo va en el ON del JOIN, las filas con ps.* todo en NULL
    // (puestos sin slots activos) cuentan como vacantes.
    if (String(solo_vacantes ?? "") === "1") {
      clauses.push(`ps.empleado_id IS NULL`);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const slotsQ = await pool.query(
      `
      SELECT
        po.cliente_id,
        po.cliente_nombre,
        po.sede_id,
        cs.nombre                       AS sede_nombre,
        po.zona_operativa_id            AS zona_id,
        oz.nombre                       AS zona_nombre,
        esup.nombre_completo            AS supervisor_nombre,
        po.id                           AS puesto_id,
        po.nombre                       AS puesto_nombre,
        po.tipo_servicio,
        po.tipo_puesto,
        po.turno                        AS puesto_turno,
        po.jornada,
        po.horario                      AS puesto_horario,
        po.cantidad_contratada,
        ps.id                           AS slot_id,
        ps.slot_numero,
        ps.empleado_id,
        e.nombre_completo               AS titular_nombre,
        ps.horas_turno,
        to_char(ps.hora_entrada, 'HH24:MI') AS hora_entrada,
        ps.dias_trabajo,
        ps.dias_medio_turno,
        COALESCE(ps.longitud_ciclo, 14) AS longitud_ciclo,
        ps.hora_entrada_por_semana,
        to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
        ps.notas
      FROM puestos_operativos po
      LEFT JOIN puesto_slots ps          ON ps.puesto_id = po.id AND ps.activo = TRUE
      LEFT JOIN employees e              ON e.id = ps.empleado_id
      LEFT JOIN client_sedes cs          ON cs.id = po.sede_id
      LEFT JOIN operational_zones oz     ON oz.id = po.zona_operativa_id
      LEFT JOIN employees esup           ON esup.id = oz.supervisor_employee_id
      ${where}
      ORDER BY po.cliente_nombre NULLS LAST, cs.nombre NULLS LAST,
               po.nombre, ps.slot_numero NULLS FIRST
      `,
      params,
    );

    // Stats: total_puestos cuenta puestos únicos (con o sin slots);
    // las demás métricas filtran a slots reales (ps.id NOT NULL) para no inflar.
    const globalQ = await pool.query(
      `
      SELECT
        COUNT(DISTINCT po.cliente_id)                                                   AS total_clientes,
        COUNT(DISTINCT po.id)                                                           AS total_puestos,
        COUNT(ps.id)                                                                    AS total_slots,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND ps.empleado_id IS NOT NULL)        AS slots_con_titular,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND ps.empleado_id IS NULL)            AS slots_vacantes,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND ps.horas_turno = 24)               AS turnos_24h,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND ps.horas_turno = 12)               AS turnos_12h,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND COALESCE(ps.longitud_ciclo,14)=7)  AS rot_1_sem,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND COALESCE(ps.longitud_ciclo,14)=14) AS rot_2_sem,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND COALESCE(ps.longitud_ciclo,14)=21) AS rot_3_sem,
        COUNT(*) FILTER (WHERE ps.id IS NOT NULL AND COALESCE(ps.longitud_ciclo,14)=28) AS rot_4_sem
      FROM puestos_operativos po
      LEFT JOIN puesto_slots ps ON ps.puesto_id = po.id AND ps.activo = TRUE
      ${where}
      `,
      params,
    );

    const clientesQ = await pool.query(
      `SELECT id, nombre FROM clients WHERE estado = 'activo' ORDER BY nombre`,
    );
    const zonasQ = await pool.query(
      `SELECT id, nombre FROM operational_zones WHERE estado = 'activo' ORDER BY nombre`,
    );

    res.json({
      generadoEn: new Date().toISOString(),
      globalStats: globalQ.rows[0],
      slots: slotsQ.rows,
      clientesDisponibles: clientesQ.rows,
      zonasDisponibles: zonasQ.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/plantilla-turnos error");
    res.status(500).json({ error: "Error al generar reporte de plantilla de turnos" });
  }
});

router.get("/reportes/cobertura-zonas", async (req, res) => {
  try {
    const { desde, hasta, zona_id, cliente_id, sede_id, tipo_cobertura, supervisor_id } = req.query;

    // Defaults: si no llegan fechas, usar hoy
    const desdeDate = desde ? String(desde) : new Date().toISOString().split("T")[0];
    const hastaDate = hasta ? String(hasta) : desdeDate;

    // ── Parámetros dinámicos ────────────────────────────────────────────────
    const params: unknown[] = [desdeDate, hastaDate];
    const clauses: string[] = [];

    if (zona_id) {
      params.push(Number(zona_id));
      clauses.push(`po.zona_operativa_id = $${params.length}`);
    }
    if (cliente_id) {
      params.push(Number(cliente_id));
      clauses.push(`cd.client_id = $${params.length}`);
    }
    if (sede_id) {
      params.push(Number(sede_id));
      clauses.push(`cd.sede_id = $${params.length}`);
    }
    if (tipo_cobertura) {
      params.push(String(tipo_cobertura));
      clauses.push(`cd.tipo_cobertura = $${params.length}`);
    }
    if (supervisor_id) {
      params.push(Number(supervisor_id));
      clauses.push(`oz.supervisor_employee_id = $${params.length}`);
    }

    const whereExtra = clauses.length > 0 ? `AND ${clauses.join(" AND ")}` : "";

    // ── Registros detallados ────────────────────────────────────────────────
    const detallesQ = await pool.query(`
      SELECT
        cd.id,
        cd.fecha::text,
        cd.puesto_id,
        cd.puesto_nombre,
        cd.client_id      AS cliente_id,
        cd.cliente_nombre,
        cd.sede_id,
        cs.nombre         AS sede_nombre,
        cd.titular_employee_id,
        cd.titular_nombre,
        cd.cobertura_employee_id,
        cd.cobertura_nombre,
        cd.tipo_cobertura,
        cd.motivo,
        cd.horas_trabajadas,
        cd.horas_extra,
        cd.observaciones,
        po.zona_operativa_id AS zona_id,
        oz.nombre         AS zona_nombre,
        oz.supervisor_employee_id,
        esup.nombre_completo AS supervisor_nombre,
        po.tipo_servicio,
        po.turno,
        po.jornada,
        po.horario
      FROM cobertura_diaria cd
      LEFT JOIN puestos_operativos po     ON po.id = cd.puesto_id
      LEFT JOIN operational_zones oz      ON oz.id = po.zona_operativa_id
      LEFT JOIN employees esup            ON esup.id = oz.supervisor_employee_id
      LEFT JOIN client_sedes cs           ON cs.id = cd.sede_id
      WHERE cd.fecha BETWEEN $1 AND $2
      ${whereExtra}
      ORDER BY oz.nombre NULLS LAST, cd.cliente_nombre, cs.nombre NULLS LAST, cd.puesto_nombre, cd.fecha
    `, params);

    // ── Resumen global ──────────────────────────────────────────────────────
    const globalQ = await pool.query(`
      SELECT
        COUNT(*)                                                  AS total_registros,
        COUNT(DISTINCT cd.puesto_id)                              AS total_puestos,
        COUNT(DISTINCT cd.client_id)                              AS total_clientes,
        COUNT(DISTINCT cd.sede_id)                                AS total_sedes,
        COUNT(DISTINCT po.zona_operativa_id)                      AS total_zonas,
        COUNT(*) FILTER (WHERE cd.tipo_cobertura = 'titular')     AS cubiertos_titular,
        COUNT(*) FILTER (WHERE cd.tipo_cobertura = 'relevo')      AS cubiertos_relevo,
        COUNT(*) FILTER (WHERE cd.tipo_cobertura = 'ausencia_sin_cubrir') AS descubiertos,
        COALESCE(SUM(cd.horas_trabajadas), 0)                     AS horas_trabajadas,
        COALESCE(SUM(cd.horas_extra), 0)                          AS horas_extra
      FROM cobertura_diaria cd
      LEFT JOIN puestos_operativos po ON po.id = cd.puesto_id
      LEFT JOIN operational_zones oz  ON oz.id = po.zona_operativa_id
      WHERE cd.fecha BETWEEN $1 AND $2
      ${whereExtra}
    `, params);

    // ── Resumen por zona ────────────────────────────────────────────────────
    const zonaSummQ = await pool.query(`
      SELECT
        po.zona_operativa_id                                      AS zona_id,
        COALESCE(oz.nombre, 'Sin zona')                           AS zona_nombre,
        oz.supervisor_employee_id,
        esup.nombre_completo                                      AS supervisor_nombre,
        COUNT(DISTINCT cd.puesto_id)                              AS total_puestos,
        COUNT(DISTINCT cd.client_id)                              AS total_clientes,
        COUNT(DISTINCT cd.sede_id)                                AS total_sedes,
        COUNT(*) FILTER (WHERE cd.tipo_cobertura = 'titular')     AS cubiertos_titular,
        COUNT(*) FILTER (WHERE cd.tipo_cobertura = 'relevo')      AS cubiertos_relevo,
        COUNT(*) FILTER (WHERE cd.tipo_cobertura = 'ausencia_sin_cubrir') AS descubiertos,
        COALESCE(SUM(cd.horas_trabajadas), 0)                     AS horas_trabajadas,
        COALESCE(SUM(cd.horas_extra), 0)                          AS horas_extra
      FROM cobertura_diaria cd
      LEFT JOIN puestos_operativos po ON po.id = cd.puesto_id
      LEFT JOIN operational_zones oz  ON oz.id = po.zona_operativa_id
      LEFT JOIN employees esup        ON esup.id = oz.supervisor_employee_id
      WHERE cd.fecha BETWEEN $1 AND $2
      ${whereExtra}
      GROUP BY po.zona_operativa_id, oz.nombre, oz.supervisor_employee_id, esup.nombre_completo
      ORDER BY oz.nombre NULLS LAST
    `, params);

    // ── Lista de zonas activas (para filtro) ────────────────────────────────
    const zonasQ = await pool.query(
      `SELECT id, nombre FROM operational_zones WHERE estado = 'activo' ORDER BY nombre`
    );

    // ── Lista de clientes activos (para filtro) ─────────────────────────────
    const clientesQ = await pool.query(
      `SELECT id, nombre FROM clients WHERE estado = 'activo' ORDER BY nombre`
    );

    // Calcular días del período
    const d1 = new Date(desdeDate);
    const d2 = new Date(hastaDate);
    const dias = Math.round((d2.getTime() - d1.getTime()) / 86_400_000) + 1;

    res.json({
      periodo: { desde: desdeDate, hasta: hastaDate, dias },
      globalStats: globalQ.rows[0],
      zonaSummaries: zonaSummQ.rows,
      detalles: detallesQ.rows,
      zonasDisponibles: zonasQ.rows,
      clientesDisponibles: clientesQ.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /reportes/cobertura-zonas error");
    res.status(500).json({ error: "Error al generar reporte de cobertura por zonas" });
  }
});

export default router;
