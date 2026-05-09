import { Router } from "express";
import { pool } from "@workspace/db";

export const categoriasRouter = Router();

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
categoriasRouter.get("/bodega/categorias", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(a.id)::int AS total_articulos
      FROM bodega_categorias c
      LEFT JOIN bodega_articulos a ON a.categoria_id = c.id AND a.activo = TRUE
      WHERE c.activo = TRUE
      GROUP BY c.id ORDER BY c.nombre
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

categoriasRouter.post("/bodega/categorias", async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: "Nombre requerido" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO bodega_categorias (nombre, descripcion) VALUES ($1,$2) RETURNING *`,
      [nombre.trim(), descripcion?.trim() || null]
    );
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

categoriasRouter.put("/bodega/categorias/:id", async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE bodega_categorias SET nombre=$1, descripcion=$2 WHERE id=$3 RETURNING *`,
      [nombre?.trim(), descripcion?.trim() || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

categoriasRouter.delete("/bodega/categorias/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE bodega_categorias SET activo=FALSE WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).send(e.message); }
});

