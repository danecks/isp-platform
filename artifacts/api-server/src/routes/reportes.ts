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

export default router;
