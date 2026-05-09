import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

const sedesRouter = Router();

// ─── GET /api/clientes/:id/sedes ─────────────────────────────────────────────
sedesRouter.get("/clientes/:id/sedes", async (req, res) => {
  try {
    const { rows: sedes } = await pool.query(
      `SELECT cs.*,
        (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.sede_id = cs.id AND po.activo = TRUE) AS total_puestos,
        (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.sede_id = cs.id AND po.activo = TRUE AND po.estado = 'cubierto') AS puestos_cubiertos
       FROM client_sedes cs
       WHERE cs.client_id = $1
       ORDER BY cs.nombre`,
      [req.params.id]
    );
    res.json(sedes);
  } catch (err) {
    logger.error({ err }, "GET /clientes/:id/sedes error");
    res.status(500).json({ error: "Error al cargar sedes" });
  }
});

// ─── POST /api/clientes/:id/sedes ────────────────────────────────────────────
sedesRouter.post("/clientes/:id/sedes", async (req, res) => {
  const { nombre, direccion, ciudad, contacto, telefono, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO client_sedes (client_id, nombre, direccion, ciudad, contacto, telefono, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, nombre, direccion || null, ciudad || null, contacto || null, telefono || null, notas || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /clientes/:id/sedes error");
    res.status(500).json({ error: "Error al crear sede" });
  }
});

// ─── PATCH /api/sedes/:id ─────────────────────────────────────────────────────
sedesRouter.patch("/sedes/:id", async (req, res) => {
  const { nombre, direccion, ciudad, contacto, telefono, notas, activo } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE client_sedes
       SET nombre    = COALESCE($1, nombre),
           direccion = COALESCE($2, direccion),
           ciudad    = COALESCE($3, ciudad),
           contacto  = COALESCE($4, contacto),
           telefono  = COALESCE($5, telefono),
           notas     = COALESCE($6, notas),
           activo    = COALESCE($7, activo),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [nombre ?? null, direccion ?? null, ciudad ?? null, contacto ?? null, telefono ?? null, notas ?? null, activo ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Sede no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /sedes/:id error");
    res.status(500).json({ error: "Error al actualizar sede" });
  }
});

// ─── DELETE /api/sedes/:id ────────────────────────────────────────────────────
sedesRouter.delete("/sedes/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE client_sedes SET activo = FALSE, updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /sedes/:id error");
    res.status(500).json({ error: "Error al desactivar sede" });
  }
});

// ─── GET /api/sedes/:id/puestos ───────────────────────────────────────────────
// Puestos de una sede con su titular y cobertura actual
sedesRouter.get("/sedes/:id/puestos", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT po.*,
              et.nombre_completo AS titular_nombre_completo,
              et.telefono        AS titular_telefono,
              ea.nombre_completo AS agente_nombre_completo,
              ea.telefono        AS agente_telefono_actual
       FROM puestos_operativos po
       LEFT JOIN employees et ON et.id = po.titular_employee_id
       LEFT JOIN employees ea ON ea.id = po.agente_id
       WHERE po.sede_id = $1 AND po.activo = TRUE
       ORDER BY po.orden`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /sedes/:id/puestos error");
    res.status(500).json({ error: "Error al cargar puestos de sede" });
  }
});

export default sedesRouter;
