import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.get("/dashboard/summary", async (_req, res) => {
  try {
    const [
      incRes, empRes, alertasRes, anticRes, liqRes,
      leadsRes, postRes, tareasRes,
      fichajeRes, bodegaRes, armaRes, vacRes, elimRes,
    ] = await Promise.all([
      // Incidencias
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))                         AS activas,
          COUNT(*) FILTER (WHERE es_emergencia AND estado IN ('abierta','en_proceso'))        AS emergencias
        FROM incidents
      `),
      // Empleados
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado_laboral = 'activo')                                  AS activos,
          COUNT(*) FILTER (WHERE estado_laboral = 'suspendido')                              AS suspendidos,
          COUNT(*) FILTER (WHERE estado_laboral = 'baja'
            AND fecha_baja >= DATE_TRUNC('month', CURRENT_DATE))                             AS bajas_mes
        FROM employees
      `),
      // Alertas RRHH
      pool.query(`SELECT COUNT(*) AS activas FROM rrhh_alertas WHERE estado IN ('nueva','en_revision')`),
      // Anticipos
      pool.query(`SELECT COUNT(*) AS pendientes FROM anticipos WHERE estado = 'pendiente'`),
      // Liquidaciones
      pool.query(`SELECT COUNT(*) AS confirmadas FROM prestaciones_liquidaciones WHERE estado = 'confirmada'`),
      // Leads
      pool.query(`SELECT COUNT(*) AS nuevos FROM leads WHERE estado = 'nuevo'`),
      // Postulaciones (nuevo módulo Kiosco)
      pool.query(`SELECT COUNT(*) AS nuevas FROM solicitudes_empleo WHERE estado = 'pendiente'`),
      // Tareas
      pool.query(`SELECT COUNT(*) AS pendientes FROM tareas WHERE estado IN ('pendiente','en_proceso')`),

      // ── NUEVO: Fichaje QR del día ──────────────────────────────────────────
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE fecha_fichaje = CURRENT_DATE)                               AS fichajes_hoy,
          COUNT(*) FILTER (WHERE fecha_fichaje = CURRENT_DATE AND hora_salida IS NULL)        AS agentes_en_turno
        FROM agente_fichajes
      `).catch(() => ({ rows: [{ fichajes_hoy: 0, agentes_en_turno: 0 }] })),

      // ── NUEVO: Bodega solicitudes pendientes ───────────────────────────────
      pool.query(`SELECT COUNT(*) AS pendientes FROM bodega_solicitudes WHERE estado = 'pendiente'`)
        .catch(() => ({ rows: [{ pendientes: 0 }] })),

      // ── NUEVO: Armas en orden de servicio abiertas ─────────────────────────
      pool.query(`SELECT COUNT(*) AS abiertas FROM arma_ordenes_servicio WHERE estado = 'abierta'`)
        .catch(() => ({ rows: [{ abiertas: 0 }] })),

      // ── NUEVO: Vacaciones pendientes ──────────────────────────────────────
      pool.query(`SELECT COUNT(*) AS pendientes FROM solicitudes_vacaciones WHERE estado = 'pendiente'`)
        .catch(() => ({ rows: [{ pendientes: 0 }] })),

      // ── NUEVO: Solicitudes de eliminación pendientes ──────────────────────
      pool.query(`SELECT COUNT(*) AS pendientes FROM solicitudes_eliminacion WHERE estado = 'pendiente'`)
        .catch(() => ({ rows: [{ pendientes: 0 }] })),
    ]);

    res.json({
      operaciones: {
        incidencias_activas:  Number(incRes.rows[0].activas),
        emergencias_activas:  Number(incRes.rows[0].emergencias),
        tareas_pendientes:    Number(tareasRes.rows[0].pendientes),
      },
      rrhh: {
        empleados_activos:         Number(empRes.rows[0].activos),
        suspendidos:               Number(empRes.rows[0].suspendidos),
        bajas_este_mes:            Number(empRes.rows[0].bajas_mes),
        alertas_activas:           Number(alertasRes.rows[0].activas),
        anticipos_pendientes:      Number(anticRes.rows[0].pendientes),
        liquidaciones_confirmadas: Number(liqRes.rows[0].confirmadas),
        postulaciones_nuevas:      Number(postRes.rows[0].nuevas),
        vacaciones_pendientes:     Number(vacRes.rows[0].pendientes),
      },
      comercial: {
        leads_nuevos:         Number(leadsRes.rows[0].nuevos),
        postulaciones_nuevas: Number(postRes.rows[0].nuevas),
      },
      control_qr: {
        fichajes_hoy:    Number(fichajeRes.rows[0].fichajes_hoy),
        agentes_en_turno: Number(fichajeRes.rows[0].agentes_en_turno),
      },
      bodega: {
        solicitudes_pendientes: Number(bodegaRes.rows[0].pendientes),
        armas_en_reparacion:    Number(armaRes.rows[0].abiertas),
      },
      sistema: {
        eliminaciones_pendientes: Number(elimRes.rows[0].pendientes),
      },
    });
  } catch (err) {
    console.error("[dashboard/summary] error:", err);
    res.status(500).json({ error: "Error al obtener resumen del dashboard" });
  }
});

export default router;
