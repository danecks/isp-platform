import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const adminResetRouter = Router();

// POST /api/admin/reset-produccion
// Limpia TODOS los datos dejando solo los usuarios del sistema.
adminResetRouter.post("/admin/reset-produccion", async (req, res) => {
  const { password } = req.body as { password?: string };

  if (password !== "RESET-ISP-2024") {
    return res.status(403).json({ error: "Contraseña incorrecta" });
  }

  try {
    // Un solo TRUNCATE con CASCADE elimina todo en orden seguro
    await pool.query(`
      TRUNCATE TABLE
        planilla_lineas,
        planillas,
        pre_planilla_auditoria,
        pre_planilla_cierres,
        pre_planilla_revision,
        novedades_nomina_diarias,
        cobertura_segmentos,
        cobertura_diaria,
        cierre_operativo_diario,
        cierre_auditoria,
        movimientos_operativos,
        anticipos,
        eventos_rrhh,
        rrhh_alertas,
        solicitudes_cambio_operativo,
        solicitudes_servicio_adicional,
        puesto_titular_historico,
        employee_operational_assignments,
        puestos_operativos,
        contratos_empleados,
        employees,
        incidents,
        tareas,
        task_evidencias,
        leads,
        applications,
        client_aliases,
        position_aliases,
        service_locations,
        agent_assignments,
        clients
      RESTART IDENTITY CASCADE
    `);

    logger.info("Admin reset: base de datos de producción limpiada completamente");
    res.json({
      ok: true,
      mensaje: "Base de datos limpiada. Solo quedan los usuarios del sistema. El servidor NO volverá a crear datos de prueba automáticamente.",
    });
  } catch (err) {
    logger.error({ err }, "Admin reset: error");
    res.status(500).json({ error: String(err) });
  }
});

export default adminResetRouter;
