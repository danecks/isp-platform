import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  hoyGT_ISO, parseISO, semanaDelMes, mesDeSemana, rangoSemanaISO,
} from "../lib/semana-mes";

// SUPERV-PLAN-MES-01 — Plantilla mensual de supervisión por SEDE × SEMANA.
// Convive con supervision_visitas_programadas (que sigue siendo para visitas
// de fecha exacta, extraordinarias o comisiones). El plan mensual declara
// "esta sede debe ser supervisada en estas semanas del mes por X supervisor".
//
// Cumplimiento de la semana en curso = al menos UNA visita con
// estado='completada' contra cualquier puesto de la sede asignada,
// dentro del rango lun-dom ISO de la fecha consultada.

export const supervisionPlanMensualRouter = Router();

const auth = (req: any, res: any): boolean => {
  if (!req.headers["x-isp-session"]) {
    res.status(401).json({ error: "No autorizado" });
    return false;
  }
  return true;
};

// ─── GET /api/supervision-plan-mensual/catalogos ────────────────────────────
supervisionPlanMensualRouter.get("/supervision-plan-mensual/catalogos", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const [{ rows: sedes }, { rows: supervisores }] = await Promise.all([
      pool.query(
        `SELECT s.id, s.nombre, s.client_id,
                COALESCE(c.nombre, c.nombre_comercial, 'Cliente '||c.id::text) AS cliente_nombre,
                (SELECT COUNT(*)::int FROM puestos_operativos po
                  WHERE po.sede_id = s.id AND po.activo = TRUE) AS puestos_activos
           FROM client_sedes s
           JOIN clients c ON c.id = s.client_id
          WHERE s.activo = TRUE
            AND COALESCE(c.estado, 'activo') = 'activo'
          ORDER BY cliente_nombre, s.nombre`
      ),
      pool.query(
        `SELECT id, nombre_completo, telefono
           FROM employees
          WHERE tipo_personal = 'supervisor' AND estado_laboral = 'activo'
          ORDER BY nombre_completo ASC`
      ),
    ]);
    res.json({ sedes, supervisores });
  } catch (err) {
    logger.error({ err }, "GET /supervision-plan-mensual/catalogos error");
    res.status(500).json({ error: "Error al cargar catálogos" });
  }
});

// ─── GET /api/supervision-plan-mensual ──────────────────────────────────────
// Lista todas las filas del plan: sede × semana_mes × supervisor.
supervisionPlanMensualRouter.get("/supervision-plan-mensual", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT pm.id, pm.sede_id, pm.semana_mes, pm.supervisor_employee_id,
              pm.notas, pm.activo, pm.created_at, pm.updated_at,
              s.nombre AS sede_nombre,
              s.client_id AS cliente_id,
              COALESCE(c.nombre, c.nombre_comercial, 'Cliente '||c.id::text) AS cliente_nombre,
              e.nombre_completo AS supervisor_nombre
         FROM supervision_plan_mensual pm
         JOIN client_sedes s ON s.id = pm.sede_id
         JOIN clients c ON c.id = s.client_id
         JOIN employees e ON e.id = pm.supervisor_employee_id
        WHERE pm.activo = TRUE
        ORDER BY cliente_nombre, sede_nombre, pm.semana_mes`
    );
    res.json({ plan: rows });
  } catch (err) {
    logger.error({ err }, "GET /supervision-plan-mensual error");
    res.status(500).json({ error: "Error al listar plan mensual" });
  }
});

// ─── POST /api/supervision-plan-mensual ─────────────────────────────────────
// Upsert por (sede_id, semana_mes). Cambia supervisor o notas.
supervisionPlanMensualRouter.post("/supervision-plan-mensual", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const sedeId = Number(req.body?.sede_id);
    const semana = Number(req.body?.semana_mes);
    const supId = Number(req.body?.supervisor_employee_id);
    const notas: string | null = req.body?.notas ?? null;
    if (!Number.isInteger(sedeId) || sedeId <= 0) {
      return res.status(400).json({ error: "sede_id inválido" });
    }
    if (!Number.isInteger(semana) || semana < 1 || semana > 5) {
      return res.status(400).json({ error: "semana_mes debe ser 1..5" });
    }
    if (!Number.isInteger(supId) || supId <= 0) {
      return res.status(400).json({ error: "supervisor_employee_id inválido" });
    }
    const { rows } = await pool.query(
      `INSERT INTO supervision_plan_mensual
              (sede_id, semana_mes, supervisor_employee_id, notas, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (sede_id, semana_mes) DO UPDATE
         SET supervisor_employee_id = EXCLUDED.supervisor_employee_id,
             notas = EXCLUDED.notas,
             activo = TRUE,
             updated_at = NOW()
       RETURNING id`,
      [sedeId, semana, supId, notas]
    );
    res.json({ id: rows[0].id, ok: true });
  } catch (err) {
    logger.error({ err }, "POST /supervision-plan-mensual error");
    res.status(500).json({ error: "Error al guardar plan" });
  }
});

// ─── DELETE /api/supervision-plan-mensual/:id ───────────────────────────────
supervisionPlanMensualRouter.delete("/supervision-plan-mensual/:id", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "id inválido" });
    }
    await pool.query(`DELETE FROM supervision_plan_mensual WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /supervision-plan-mensual error");
    res.status(500).json({ error: "Error al eliminar" });
  }
});

// ─── GET /api/supervision-plan-mensual/cobertura ────────────────────────────
// Tablero de la semana ISO (lun-dom) que contiene `?fecha=YYYY-MM-DD`
// (default = hoy GT). Devuelve 4 baldes:
//  - sin_plan       : sedes activas SIN ninguna fila en el plan mensual
//  - pendientes     : sedes con plan en la semana_mes en curso, sin visita
//                     completada en el rango lun-dom
//  - cumplidas      : sedes con plan en la semana_mes en curso, con visita
//                     completada en el rango lun-dom
//  - otras_semanas  : sedes con plan pero asignadas a otras semanas del mes
supervisionPlanMensualRouter.get("/supervision-plan-mensual/cobertura", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const fechaParam = (req.query.fecha as string) || hoyGT_ISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
      return res.status(400).json({ error: "fecha inválida (formato YYYY-MM-DD)" });
    }
    const probe = parseISO(fechaParam);
    if (isNaN(probe.getTime())) {
      return res.status(400).json({ error: "fecha inválida" });
    }
    const fechaISO = fechaParam;
    const ref = probe;
    const semana = semanaDelMes(ref);
    const { mes, anio } = mesDeSemana(ref);
    const { lunes, domingo } = rangoSemanaISO(ref);

    // 1) sedes activas con info de cliente
    const sedesQ = pool.query(
      `SELECT s.id AS sede_id, s.nombre AS sede_nombre,
              s.client_id AS cliente_id,
              COALESCE(c.nombre, c.nombre_comercial, 'Cliente '||c.id::text) AS cliente_nombre,
              (SELECT COUNT(*)::int FROM puestos_operativos po
                WHERE po.sede_id = s.id AND po.activo = TRUE) AS puestos_activos
         FROM client_sedes s
         JOIN clients c ON c.id = s.client_id
        WHERE s.activo = TRUE
          AND COALESCE(c.estado, 'activo') = 'activo'
        ORDER BY cliente_nombre, sede_nombre`
    );

    // 2) plan mensual completo (todas las filas activas)
    const planQ = pool.query(
      `SELECT pm.sede_id, pm.semana_mes, pm.supervisor_employee_id,
              e.nombre_completo AS supervisor_nombre
         FROM supervision_plan_mensual pm
         JOIN employees e ON e.id = pm.supervisor_employee_id
        WHERE pm.activo = TRUE`
    );

    // 3) visitas completadas en la semana actual contra cualquier puesto
    //    de cada sede. Cumplimiento se mide por la fecha REAL de cierre
    //    (completada_at) en zona Guatemala, no por fecha_planificada — una
    //    visita planificada el viernes y completada el lunes siguiente debe
    //    contar para la semana del lunes, no para la del viernes.
    const visitasQ = pool.query(
      `SELECT po.sede_id,
              MAX(sp.completada_at) AS ultima_completada,
              COUNT(*)::int AS total_completadas
         FROM supervision_visitas_programadas sp
         JOIN puestos_operativos po ON po.id = sp.puesto_id
        WHERE sp.estado = 'completada'
          AND sp.completada_at IS NOT NULL
          AND (sp.completada_at AT TIME ZONE 'America/Guatemala')::date
              BETWEEN $1::date AND $2::date
          AND po.sede_id IS NOT NULL
        GROUP BY po.sede_id`,
      [lunes, domingo]
    );

    const [sedesR, planR, visitasR] = await Promise.all([sedesQ, planQ, visitasQ]);

    const planPorSede = new Map<number, Array<{ semana_mes: number; supervisor_employee_id: number; supervisor_nombre: string }>>();
    for (const p of planR.rows) {
      const arr = planPorSede.get(p.sede_id) ?? [];
      arr.push({
        semana_mes: p.semana_mes,
        supervisor_employee_id: p.supervisor_employee_id,
        supervisor_nombre: p.supervisor_nombre,
      });
      planPorSede.set(p.sede_id, arr);
    }

    const visitaPorSede = new Map<number, { ultima_completada: string; total_completadas: number }>();
    for (const v of visitasR.rows) {
      visitaPorSede.set(v.sede_id, {
        ultima_completada: v.ultima_completada,
        total_completadas: v.total_completadas,
      });
    }

    const sin_plan: any[] = [];
    const pendientes: any[] = [];
    const cumplidas: any[] = [];
    const otras_semanas: any[] = [];

    for (const s of sedesR.rows) {
      const plan = planPorSede.get(s.sede_id);
      if (!plan || plan.length === 0) {
        sin_plan.push(s);
        continue;
      }
      const enEstaSemana = plan.find(p => p.semana_mes === semana);
      const visita = visitaPorSede.get(s.sede_id);
      if (enEstaSemana) {
        const fila = {
          ...s,
          semana_mes: enEstaSemana.semana_mes,
          supervisor_employee_id: enEstaSemana.supervisor_employee_id,
          supervisor_nombre: enEstaSemana.supervisor_nombre,
          ultima_completada: visita?.ultima_completada ?? null,
          total_completadas: visita?.total_completadas ?? 0,
        };
        if (visita && visita.total_completadas > 0) cumplidas.push(fila);
        else pendientes.push(fila);
      } else {
        otras_semanas.push({
          ...s,
          semanas_asignadas: plan.map(p => p.semana_mes).sort(),
          supervisores: plan.map(p => ({
            semana_mes: p.semana_mes,
            supervisor_nombre: p.supervisor_nombre,
          })),
        });
      }
    }

    res.json({
      fecha_referencia: fechaISO,
      semana_mes: semana,
      mes, anio,
      rango: { lunes, domingo },
      sin_plan, pendientes, cumplidas, otras_semanas,
      totales: {
        sedes_activas: sedesR.rows.length,
        sin_plan: sin_plan.length,
        pendientes: pendientes.length,
        cumplidas: cumplidas.length,
        otras_semanas: otras_semanas.length,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /supervision-plan-mensual/cobertura error");
    res.status(500).json({ error: "Error al calcular cobertura" });
  }
});

// ─── GET /api/supervision-plan-mensual/carga-supervisores ───────────────────
// Reparto: por cada supervisor activo, cuántas sedes tiene en cada semana
// del mes y total de filas en plan.
supervisionPlanMensualRouter.get("/supervision-plan-mensual/carga-supervisores", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT e.id AS supervisor_employee_id,
              e.nombre_completo AS supervisor_nombre,
              COALESCE(SUM(CASE WHEN pm.semana_mes = 1 THEN 1 ELSE 0 END), 0)::int AS sem_1,
              COALESCE(SUM(CASE WHEN pm.semana_mes = 2 THEN 1 ELSE 0 END), 0)::int AS sem_2,
              COALESCE(SUM(CASE WHEN pm.semana_mes = 3 THEN 1 ELSE 0 END), 0)::int AS sem_3,
              COALESCE(SUM(CASE WHEN pm.semana_mes = 4 THEN 1 ELSE 0 END), 0)::int AS sem_4,
              COALESCE(SUM(CASE WHEN pm.semana_mes = 5 THEN 1 ELSE 0 END), 0)::int AS sem_5,
              COALESCE(COUNT(pm.id), 0)::int AS total,
              COUNT(DISTINCT pm.sede_id)::int AS sedes_distintas
         FROM employees e
         LEFT JOIN supervision_plan_mensual pm
                ON pm.supervisor_employee_id = e.id AND pm.activo = TRUE
        WHERE e.tipo_personal = 'supervisor' AND e.estado_laboral = 'activo'
        GROUP BY e.id, e.nombre_completo
        ORDER BY total DESC, e.nombre_completo`
    );
    res.json({ carga: rows });
  } catch (err) {
    logger.error({ err }, "GET /supervision-plan-mensual/carga-supervisores error");
    res.status(500).json({ error: "Error al calcular carga" });
  }
});
