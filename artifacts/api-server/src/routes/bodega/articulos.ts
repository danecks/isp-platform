import { Router } from "express";
import { pool } from "@workspace/db";

export const articulosRouter = Router();

// ─── ARTÍCULOS ────────────────────────────────────────────────────────────────
articulosRouter.get("/bodega/articulos", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.*,
        c.nombre AS categoria_nombre,
        COUNT(u.id) FILTER (WHERE u.estado != 'baja') ::int AS stock_total,
        COUNT(u.id) FILTER (WHERE u.estado = 'disponible')          ::int AS stock_disponible,
        COUNT(u.id) FILTER (WHERE u.estado = 'asignado_puesto')     ::int AS stock_asignado_puesto,
        COUNT(u.id) FILTER (WHERE u.estado = 'asignado_colaborador')::int AS stock_asignado_colaborador,
        COUNT(u.id) FILTER (WHERE u.estado = 'en_reparacion')       ::int AS stock_reparacion,
        COUNT(u.id) FILTER (WHERE u.estado = 'baja')                ::int AS stock_baja
      FROM bodega_articulos a
      LEFT JOIN bodega_categorias c ON c.id = a.categoria_id
      LEFT JOIN bodega_unidades u ON u.articulo_id = a.id
      WHERE a.activo = TRUE
      GROUP BY a.id, c.nombre
      ORDER BY c.nombre NULLS LAST, a.nombre
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

articulosRouter.post("/bodega/articulos", async (req, res) => {
  const { nombre, descripcion, categoria_id, codigo_prefijo, tipo_rastreo, tipo_asignacion, costo_unitario } = req.body;
  if (!nombre?.trim() || !codigo_prefijo?.trim()) return res.status(400).json({ error: "Nombre y prefijo requeridos" });
  const prefijo = codigo_prefijo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  try {
    const { rows } = await pool.query(`
      INSERT INTO bodega_articulos
        (nombre, descripcion, categoria_id, codigo_prefijo, tipo_rastreo, tipo_asignacion, costo_unitario)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [nombre.trim(), descripcion?.trim() || null, categoria_id || null, prefijo,
        tipo_rastreo || "seriado", tipo_asignacion || "colaborador",
        parseFloat(costo_unitario) || 0]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

articulosRouter.put("/bodega/articulos/:id", async (req, res) => {
  const { nombre, descripcion, categoria_id, codigo_prefijo, tipo_rastreo, tipo_asignacion, costo_unitario } = req.body;
  const prefijo = codigo_prefijo?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  try {
    const { rows } = await pool.query(`
      UPDATE bodega_articulos SET
        nombre=$1, descripcion=$2, categoria_id=$3,
        codigo_prefijo=$4, tipo_rastreo=$5, tipo_asignacion=$6,
        costo_unitario=$7, updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [nombre?.trim(), descripcion?.trim() || null, categoria_id || null, prefijo,
        tipo_rastreo, tipo_asignacion, parseFloat(costo_unitario) || 0, req.params.id]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

articulosRouter.delete("/bodega/articulos/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE bodega_articulos SET activo=FALSE WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).send(e.message); }
});

// Siguiente código disponible para un artículo
articulosRouter.get("/bodega/articulos/:id/siguiente-codigo", async (req, res) => {
  try {
    const { rows: art } = await pool.query(
      `SELECT codigo_prefijo FROM bodega_articulos WHERE id=$1`, [req.params.id]
    );
    if (!art[0]) return res.status(404).json({ error: "Artículo no encontrado" });
    const prefijo = art[0].codigo_prefijo;
    const { rows } = await pool.query(`
      SELECT codigo_inventario FROM bodega_unidades
      WHERE codigo_inventario LIKE $1
      ORDER BY codigo_inventario DESC LIMIT 1
    `, [`ISP-${prefijo}-%`]);
    let siguiente = 1;
    if (rows[0]) {
      const partes = rows[0].codigo_inventario.split("-");
      const ultimo = parseInt(partes[partes.length - 1]) || 0;
      siguiente = ultimo + 1;
    }
    res.json({
      siguiente_codigo: `ISP-${prefijo}-${String(siguiente).padStart(3, "0")}`,
      siguiente_numero: siguiente,
      prefijo,
    });
  } catch (e: any) { res.status(500).send(e.message); }
});

