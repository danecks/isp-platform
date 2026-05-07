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
         SUM(CASE WHEN sp.tipo  = 'comision'        THEN 1 ELSE 0 END)::int AS comisiones,
         SUM(CASE WHEN sp.tipo  = 'extraordinaria'  THEN 1 ELSE 0 END)::int AS extraordinarias,
         COALESCE(SUM(CASE WHEN sp.estado = 'completada' THEN sp.bono_monto ELSE 0 END), 0)::numeric AS bonos_completados,
         COALESCE(SUM(CASE WHEN sp.bono_pagado = TRUE  THEN sp.bono_monto ELSE 0 END), 0)::numeric AS bonos_pagados,
         COALESCE(SUM(CASE WHEN sp.estado = 'completada' AND sp.bono_pagado = FALSE THEN sp.bono_monto ELSE 0 END), 0)::numeric AS bonos_pendientes_pago
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
         SUM(CASE WHEN sp.estado = 'no_realizada' THEN 1 ELSE 0 END)::int AS no_realizadas,
         COALESCE(SUM(CASE WHEN sp.estado='completada' THEN sp.bono_monto ELSE 0 END),0)::numeric AS bonos_completados
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

// ── PUT /api/supervision-programaciones/:id/bono-pagado — admin marca bono incluido en planilla ──
supervisionDashboardRouter.put("/supervision-programaciones/:id/bono-pagado", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
  const pagado = !!(req.body?.pagado);

  try {
    const { rowCount } = await pool.query(
      `UPDATE supervision_visitas_programadas
          SET bono_pagado = $2,
              bono_pagado_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
              bono_pagado_por_user_id = CASE WHEN $2 THEN $3 ELSE NULL END,
              updated_at = NOW()
        WHERE id = $1`,
      [id, pagado, (req as any).user?.id || null]
    );
    if (!rowCount) return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true, bono_pagado: pagado });
  } catch (err) {
    logger.error({ err }, "PUT /supervision-programaciones/:id/bono-pagado error");
    res.status(500).json({ error: "Error al actualizar bono" });
  }
});
