import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

export const custodiasPoolRouter = Router();

custodiasPoolRouter.get("/custodias/pool-disponible", async (req, res) => {
  try {
    const fecha = (req.query.fecha as string) || todayGT();
    const clienteId = req.query.clienteId ? parseInt(req.query.clienteId as string) : null;

    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo,
        e.empl_numero,
        e.estado_laboral,
        e.tipo_personal
      FROM employees e
      WHERE e.estado_laboral = 'activo'
        AND NOT EXISTS (
          SELECT 1 FROM custodia_asignacion_diaria cad2
          WHERE cad2.employee_id = e.id AND cad2.fecha = $1::date
        )
      ORDER BY e.nombre_completo
    `, [fecha]);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[Custodias/pool-disponible]");
    res.status(500).json({ error: "Error al cargar pool disponible" });
  }
});
