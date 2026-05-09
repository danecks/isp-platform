import { Router } from "express";
import { pool } from "@workspace/db";

export const movimientosRouter = Router();

// ─── MOVIMIENTOS ─────────────────────────────────────────────────────────────
movimientosRouter.get("/bodega/movimientos", async (req, res) => {
  const { unidad_id, tipo, limit = "50" } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (unidad_id) { params.push(unidad_id); conditions.push(`m.unidad_id = $${params.length}`); }
  if (tipo)      { params.push(tipo);      conditions.push(`m.tipo = $${params.length}`); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  params.push(Math.min(parseInt(limit) || 50, 500));
  try {
    const { rows } = await pool.query(`
      SELECT
        m.*, m.created_at::text AS created_at,
        u.codigo_inventario,
        a.nombre AS articulo_nombre,
        COALESCE(po.nombre,'') AS puesto_nombre,
        COALESCE(e.nombre_completo,'') AS empleado_nombre
      FROM bodega_movimientos m
      JOIN bodega_unidades u ON u.id = m.unidad_id
      JOIN bodega_articulos a ON a.id = u.articulo_id
      LEFT JOIN puestos_operativos po ON po.id = m.puesto_id
      LEFT JOIN employees e ON e.id = m.employee_id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

// Puestos y colaboradores para selectores
movimientosRouter.get("/bodega/puestos", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre, COALESCE(cliente_nombre,'') AS cliente_nombre
      FROM puestos_operativos ORDER BY cliente_nombre, nombre
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

movimientosRouter.get("/bodega/colaboradores", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre_completo, dpi, puesto
      FROM employees WHERE estado_laboral='activo' ORDER BY nombre_completo
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

