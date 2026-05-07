import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// Fase D — Dashboard de Supervisión: KPIs y desglose por supervisor.
// También expone tracking GPS asociado al fichaje del supervisor durante la visita.

export const supervisionDashboardRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const auth = (req: any, res: any): boolean => {
  if (!req.headers["x-isp-session"]) { res.status(401).json({ error: "No autorizado" }); return false; }
  return true;
};

// ── GET /api/supervision-dashboard?desde=&hasta=&supervisor= ──
supervisionDashboardRouter.get("/supervision-dashboard", async (req, res) => {
  if (!auth(req, res)) return;

  const desde = String(req.query.desde ?? "");
  const hasta = String(req.query.hasta ?? "");
  const sup = req.query.supervisor ? Number(req.query.supervisor) : null;
  if (desde && !ISO_DATE.test(desde)) return res.status(400).json({ error: "desde inválido" });
  if (hasta && !ISO_DATE.test(hasta)) return res.status(400).json({ error: "hasta inválido" });
  if (sup !== null && (!Number.isInteger(sup) || sup <= 0)) {
    return res.status(400).json({ error: "supervisor inválido" });
  }

  try {
    const params: any[] = [];
    const where: string[] = [];
    if (desde) { params.push(desde); where.push(`sp.fecha_planificada >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`sp.fecha_planificada <= $${params.length}`); }
    if (!desde && !hasta) {
      where.push(`sp.fecha_planificada >= (CURRENT_DATE - INTERVAL '7 days')`);
      where.push(`sp.fecha_planificada <= CURRENT_DATE`);
    }
    if (sup) { params.push(sup); where.push(`sp.supervisor_employee_id = $${params.length}`); }
    const W = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows: kpiRows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         SUM(CASE WHEN sp.estado = 'pendiente'    THEN 1 ELSE 0 END)::int AS pendientes,
         SUM(CASE WHEN sp.estado = 'en_curso'     THEN 1 ELSE 0 END)::int AS en_curso,
         SUM(CASE WHEN sp.estado = 'completada'   THEN 1 ELSE 0 END)::int AS completadas,
         SUM(CASE WHEN sp.estado = 'no_realizada' THEN 1 ELSE 0 END)::int AS no_realizadas,
         SUM(CASE WHEN sp.estado = 'cancelada'    THEN 1 ELSE 0 END)::int AS canceladas,
         SUM(CASE WHEN sp.tipo  = 'rutina'          THEN 1 ELSE 0 END)::int AS rutinas,
         SUM(CASE WHEN sp.tipo  = 'comision'        THEN 1 ELSE 0 END)::int AS comisiones,
         SUM(CASE WHEN sp.tipo  = 'extraordinaria'  THEN 1 ELSE 0 END)::int AS extraordinarias
       FROM supervision_visitas_programadas sp ${W}`,
      params
    );
    const k = kpiRows[0] || {};
    const cumplimiento = k.total > 0 ? Math.round((k.completadas / k.total) * 1000) / 10 : 0;

    const { rows: porSupervisor } = await pool.query(
      `SELECT
         sp.supervisor_employee_id AS id,
         e.nombre_completo AS nombre,
         COUNT(*)::int AS total,
         SUM(CASE WHEN sp.estado = 'completada' THEN 1 ELSE 0 END)::int AS completadas,
         SUM(CASE WHEN sp.estado = 'pendiente'  THEN 1 ELSE 0 END)::int AS pendientes,
         SUM(CASE WHEN sp.estado = 'en_curso'   THEN 1 ELSE 0 END)::int AS en_curso,
         SUM(CASE WHEN sp.estado = 'no_realizada' THEN 1 ELSE 0 END)::int AS no_realizadas
       FROM supervision_visitas_programadas sp
       JOIN employees e ON e.id = sp.supervisor_employee_id
       ${W}
       GROUP BY sp.supervisor_employee_id, e.nombre_completo
       ORDER BY total DESC, completadas DESC`,
      params
    );

    res.json({
      kpis: { ...k, cumplimiento_pct: cumplimiento },
      por_supervisor: porSupervisor,
    });
  } catch (err) {
    logger.error({ err }, "GET /supervision-dashboard error");
    res.status(500).json({ error: "Error al calcular dashboard" });
  }
});

// ── GET /api/supervision-tracking/en-vivo ──
// Última posición conocida (≤ 30 min) de cada supervisor con turno activo.
supervisionDashboardRouter.get("/supervision-tracking/en-vivo", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const { rows } = await pool.query(`
      WITH activos AS (
        SELECT DISTINCT ON (f.employee_id)
               f.id AS fichaje_id, f.employee_id, f.registrado_en AS turno_inicio
          FROM agente_fichajes f
          JOIN employees e ON e.id = f.employee_id
         WHERE f.tipo = 'inicio_turno'
           AND f.turno_cerrado_en IS NULL
           AND e.tipo_personal = 'supervisor'
           AND f.registrado_en >= NOW() - INTERVAL '24 hours'
         ORDER BY f.employee_id, f.registrado_en DESC
      ),
      ultimo AS (
        SELECT DISTINCT ON (g.fichaje_id)
               g.fichaje_id, g.latitud, g.longitud, g.precision_metros,
               g.velocidad_mps, g.capturado_en
          FROM agente_recorrido_gps g
          JOIN activos a ON a.fichaje_id = g.fichaje_id
         WHERE g.capturado_en >= NOW() - INTERVAL '30 minutes'
         ORDER BY g.fichaje_id, g.capturado_en DESC
      ),
      visita_activa AS (
        SELECT DISTINCT ON (sp.supervisor_employee_id)
               sp.supervisor_employee_id, sp.id AS programacion_id,
               sp.cliente_id, sp.puesto_id, sp.zona_id,
               c.nombre  AS cliente_nombre,
               po.nombre AS puesto_nombre,
               z.nombre  AS zona_nombre
          FROM supervision_visitas_programadas sp
          LEFT JOIN clients c             ON c.id  = sp.cliente_id
          LEFT JOIN puestos_operativos po ON po.id = sp.puesto_id
          LEFT JOIN operational_zones z   ON z.id  = sp.zona_id
         WHERE sp.estado = 'en_curso'
         ORDER BY sp.supervisor_employee_id, sp.iniciada_at DESC
      )
      SELECT
        a.employee_id        AS supervisor_id,
        e.nombre_completo    AS supervisor_nombre,
        a.fichaje_id,
        a.turno_inicio,
        u.latitud, u.longitud, u.precision_metros, u.velocidad_mps, u.capturado_en,
        v.programacion_id, v.cliente_nombre, v.puesto_nombre, v.zona_nombre,
        EXTRACT(EPOCH FROM (NOW() - u.capturado_en))::int AS hace_segundos
      FROM activos a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN ultimo u        ON u.fichaje_id = a.fichaje_id
      LEFT JOIN visita_activa v ON v.supervisor_employee_id = a.employee_id
      ORDER BY e.nombre_completo
    `);
    res.json({ supervisores: rows, server_now: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /supervision-tracking/en-vivo error");
    res.status(500).json({ error: "Error al cargar tracking" });
  }
});

// ── GET /api/supervision-programaciones/:id/gps ──
// Devuelve puntos GPS del recorrido del supervisor entre iniciada_at y completada_at.
supervisionDashboardRouter.get("/supervision-programaciones/:id/gps", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: prog } = await pool.query(
      `SELECT id, supervisor_employee_id, iniciada_at, completada_at, fichaje_supervisor_id
         FROM supervision_visitas_programadas WHERE id = $1`,
      [id]
    );
    if (!prog[0]) return res.status(404).json({ error: "No encontrada" });
    if (!prog[0].iniciada_at) return res.json({ puntos: [], info: "Aún no iniciada" });

    let fichajeId = prog[0].fichaje_supervisor_id;
    if (!fichajeId) {
      const { rows } = await pool.query(
        `SELECT id FROM agente_fichajes
          WHERE employee_id = $1 AND tipo = 'inicio_turno'
            AND registrado_en <= $2
            AND (turno_cerrado_en IS NULL OR turno_cerrado_en >= $2)
          ORDER BY registrado_en DESC LIMIT 1`,
        [prog[0].supervisor_employee_id, prog[0].iniciada_at]
      );
      fichajeId = rows[0]?.id || null;
    }
    if (!fichajeId) return res.json({ puntos: [], info: "Sin turno activo asociado" });

    const hasta = prog[0].completada_at || new Date();
    const { rows: puntos } = await pool.query(
      `SELECT latitud, longitud, precision_metros, velocidad_mps, capturado_en
         FROM agente_recorrido_gps
        WHERE fichaje_id = $1
          AND capturado_en BETWEEN $2 AND $3
        ORDER BY capturado_en ASC
        LIMIT 5000`,
      [fichajeId, prog[0].iniciada_at, hasta]
    );
    res.json({
      puntos,
      fichaje_id: fichajeId,
      iniciada_at: prog[0].iniciada_at,
      completada_at: prog[0].completada_at,
    });
  } catch (err) {
    logger.error({ err }, "GET /supervision-programaciones/:id/gps error");
    res.status(500).json({ error: "Error al cargar GPS" });
  }
});
