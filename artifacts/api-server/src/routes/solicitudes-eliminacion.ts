import { Router } from "express";
import { pool } from "@workspace/db";

export const solicitudesEliminacionRouter = Router();

// ── POST /api/solicitudes-eliminacion ─────────────────────────────────────────
solicitudesEliminacionRouter.post("/solicitudes-eliminacion", async (req, res) => {
  const { entidad, entidad_id, entidad_descripcion, motivo, solicitante_username } = req.body;
  if (!entidad || !entidad_id || !entidad_descripcion || !motivo || !solicitante_username) {
    return res.status(400).json({ error: "Todos los campos son requeridos" });
  }
  if (motivo.trim().length < 10) {
    return res.status(400).json({ error: "El motivo debe tener al menos 10 caracteres" });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO solicitudes_eliminacion
        (entidad, entidad_id, entidad_descripcion, motivo, solicitante_username, estado)
      VALUES ($1, $2, $3, $4, $5, 'pendiente')
      RETURNING *
    `, [
      entidad.trim(),
      Number(entidad_id),
      entidad_descripcion.trim(),
      motivo.trim(),
      solicitante_username.trim(),
    ]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/solicitudes-eliminacion ──────────────────────────────────────────
solicitudesEliminacionRouter.get("/solicitudes-eliminacion", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM solicitudes_eliminacion
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/solicitudes-eliminacion/:id ────────────────────────────────────
solicitudesEliminacionRouter.patch("/solicitudes-eliminacion/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { estado, revisado_por } = req.body;
  if (!["aprobada", "rechazada"].includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  try {
    const { rows } = await pool.query(`
      UPDATE solicitudes_eliminacion
      SET estado = $1, revisado_por = $2, revisado_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [estado, revisado_por || null, id]);
    if (!rows[0]) return res.status(404).json({ error: "Solicitud no encontrada" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
