import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const adminResetRouter = Router();

// POST /api/admin/reset-produccion
// Limpia todos los datos operativos de prueba. Solo admin.
adminResetRouter.post("/admin/reset-produccion", async (req, res) => {
  const { password } = req.body as { password?: string };

  if (password !== "RESET-ISP-2024") {
    return res.status(403).json({ error: "Contraseña incorrecta" });
  }

  try {
    // Limpiar datos operativos/transaccionales en orden seguro (FK)
    await pool.query(`TRUNCATE TABLE
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
      incidents,
      tareas,
      task_evidencias,
      leads,
      applications
      RESTART IDENTITY CASCADE
    `);

    // Resetear estado operativo de puestos a descubierto
    await pool.query(`
      UPDATE puestos_operativos SET
        agente_id = NULL,
        estado = 'descubierto',
        estado_operativo_puesto = 'normal',
        updated_at = NOW()
    `);

    // Resetear estado laboral de empleados a activo
    await pool.query(`
      UPDATE employees SET
        estado_laboral = 'activo',
        updated_at = NOW()
      WHERE estado_laboral IN ('suspendido', 'licencia')
    `);

    logger.info("Admin reset: datos operativos de producción limpiados");
    res.json({
      ok: true,
      mensaje: "Base de datos de producción limpiada correctamente. Los empleados, usuarios, puestos y clientes se conservaron.",
    });
  } catch (err) {
    logger.error({ err }, "Admin reset: error al limpiar producción");
    res.status(500).json({ error: "Error al limpiar la base de datos" });
  }
});

export default adminResetRouter;
