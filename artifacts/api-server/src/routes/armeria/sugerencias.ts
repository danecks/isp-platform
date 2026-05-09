import { Router } from "express";
import { pool } from "@workspace/db";

export const sugerenciasRouter = Router();

// ── GET /api/armeria/sugerencias — lista de sugerencias pendientes ────────────
sugerenciasRouter.get("/armeria/sugerencias", async (req, res) => {
  const soloActivas = req.query.pendientes !== "false";
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id, s.arma_id, s.supervisor_nombre, s.estado_sugerido, s.observacion,
        s.atendido, s.atendido_por, s.atendido_at,
        s.created_at::text AS created_at,
        a.codigo AS arma_codigo, a.tipo AS arma_tipo, a.marca AS arma_marca,
        a.modelo AS arma_modelo, a.calibre AS arma_calibre,
        po.nombre AS puesto_nombre, po.cliente_nombre
      FROM arma_sugerencias s
      JOIN armas a ON a.id = s.arma_id
      LEFT JOIN puestos_operativos po ON po.id = s.puesto_id
      ${soloActivas ? "WHERE s.atendido = FALSE" : ""}
      ORDER BY s.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/armeria/armas/:id/sugerir-cambio ────────────────────────────────
// El supervisor sugiere cambio de estado de un arma (desde AgenteEscaneo)
sugerenciasRouter.post("/armeria/armas/:id/sugerir-cambio", async (req, res) => {
  const armaId = parseInt(req.params.id);
  const { supervisor_nombre, puesto_id, estado_sugerido, observacion } = req.body;
  if (!supervisor_nombre || !estado_sugerido) {
    return res.status(400).json({ error: "supervisor_nombre y estado_sugerido son requeridos" });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO arma_sugerencias (arma_id, supervisor_nombre, puesto_id, estado_sugerido, observacion)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [armaId, supervisor_nombre, puesto_id || null, estado_sugerido, observacion || null]);
    res.json({ ok: true, id: rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/armeria/sugerencias/:id/atender ───────────────────────────────
sugerenciasRouter.patch("/armeria/sugerencias/:id/atender", async (req, res) => {
  const id = parseInt(req.params.id);
  const { atendido_por } = req.body;
  try {
    await pool.query(`
      UPDATE arma_sugerencias
      SET atendido=TRUE, atendido_por=$1, atendido_at=NOW()
      WHERE id=$2
    `, [atendido_por || "armería", id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
