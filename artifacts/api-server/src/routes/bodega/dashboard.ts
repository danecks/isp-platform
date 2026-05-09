import { Router } from "express";
import { pool } from "@workspace/db";

export const dashboardRouter = Router();

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
dashboardRouter.get("/bodega/dashboard", async (req, res) => {
  try {
    const [statsRes, movRes, artRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado = 'disponible')              AS disponible,
          COUNT(*) FILTER (WHERE estado = 'asignado_puesto')         AS asignado_puesto,
          COUNT(*) FILTER (WHERE estado = 'asignado_colaborador')    AS asignado_colaborador,
          COUNT(*) FILTER (WHERE estado = 'en_reparacion')           AS en_reparacion,
          COUNT(*) FILTER (WHERE estado = 'baja')                    AS baja,
          COUNT(*)                                                    AS total
        FROM bodega_unidades
      `),
      pool.query(`
        SELECT
          m.id, m.tipo, m.notas, m.registrado_por,
          m.created_at::text AS created_at,
          u.codigo_inventario,
          a.nombre AS articulo_nombre,
          COALESCE(po.nombre, '') AS puesto_nombre,
          COALESCE(e.nombre_completo, '') AS empleado_nombre
        FROM bodega_movimientos m
        JOIN bodega_unidades u ON u.id = m.unidad_id
        JOIN bodega_articulos a ON a.id = u.articulo_id
        LEFT JOIN puestos_operativos po ON po.id = m.puesto_id
        LEFT JOIN employees e ON e.id = m.employee_id
        ORDER BY m.created_at DESC LIMIT 15
      `),
      pool.query(`
        SELECT a.id, a.nombre, a.tipo_asignacion,
          COUNT(u.id) FILTER (WHERE u.estado = 'disponible')           AS disponible,
          COUNT(u.id) FILTER (WHERE u.estado != 'baja')               AS total
        FROM bodega_articulos a
        LEFT JOIN bodega_unidades u ON u.articulo_id = a.id
        WHERE a.activo = TRUE
        GROUP BY a.id
        ORDER BY COUNT(u.id) DESC LIMIT 10
      `),
    ]);
    res.json({
      stats:     statsRes.rows[0],
      recientes: movRes.rows,
      articulos: artRes.rows,
    });
  } catch (e: any) { res.status(500).send(e.message); }
});

