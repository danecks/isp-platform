import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.get("/dashboard/summary", async (_req, res) => {
  try {
    const [incRes, empRes, alertasRes, anticRes, liqRes, leadsRes, postRes, tareasRes] =
      await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))                         AS activas,
            COUNT(*) FILTER (WHERE es_emergencia AND estado IN ('abierta','en_proceso'))        AS emergencias
          FROM incidents
        `),
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE estado_laboral = 'activo')                                   AS activos,
            COUNT(*) FILTER (WHERE estado_laboral = 'suspendido')                               AS suspendidos,
            COUNT(*) FILTER (WHERE estado_laboral = 'baja'
              AND fecha_baja >= DATE_TRUNC('month', CURRENT_DATE))                              AS bajas_mes
          FROM employees
        `),
        pool.query(`
          SELECT COUNT(*) AS activas FROM rrhh_alertas WHERE estado IN ('nueva','en_revision')
        `),
        pool.query(`
          SELECT COUNT(*) AS pendientes FROM anticipos WHERE estado = 'pendiente'
        `),
        pool.query(`
          SELECT COUNT(*) AS confirmadas
          FROM prestaciones_liquidaciones
          WHERE estado = 'confirmada'
        `),
        pool.query(`
          SELECT COUNT(*) AS nuevos FROM leads WHERE estado = 'nuevo'
        `),
        pool.query(`
          SELECT COUNT(*) AS nuevas FROM applications WHERE estado = 'recibido'
        `),
        pool.query(`
          SELECT COUNT(*) AS pendientes FROM tareas WHERE estado IN ('pendiente','en_proceso')
        `),
      ]);

    res.json({
      operaciones: {
        incidencias_activas:  Number(incRes.rows[0].activas),
        emergencias_activas:  Number(incRes.rows[0].emergencias),
        tareas_pendientes:    Number(tareasRes.rows[0].pendientes),
      },
      rrhh: {
        empleados_activos:        Number(empRes.rows[0].activos),
        suspendidos:              Number(empRes.rows[0].suspendidos),
        bajas_este_mes:           Number(empRes.rows[0].bajas_mes),
        alertas_activas:          Number(alertasRes.rows[0].activas),
        anticipos_pendientes:     Number(anticRes.rows[0].pendientes),
        liquidaciones_confirmadas: Number(liqRes.rows[0].confirmadas),
        postulaciones_nuevas:     Number(postRes.rows[0].nuevas),
      },
      comercial: {
        leads_nuevos:         Number(leadsRes.rows[0].nuevos),
        postulaciones_nuevas: Number(postRes.rows[0].nuevas),
      },
    });
  } catch (err) {
    console.error("[dashboard/summary] error:", err);
    res.status(500).json({ error: "Error al obtener resumen del dashboard" });
  }
});

export default router;
