import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

function getSession(req: any): { nombre: string; username: string; rol: string } | null {
  try {
    const raw = req.headers["x-isp-session"] as string;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function requireAdmin(req: any, res: any): boolean {
  const s = getSession(req);
  if (!s || s.rol !== "admin") {
    res.status(403).json({ error: "Solo administradores pueden gestionar tipos de personal" });
    return false;
  }
  return true;
}

// GET /tipos-personal-config — listar tipos de personal
router.get("/tipos-personal-config", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "No autenticado" });
  try {
    const { rows } = await pool.query(`
      SELECT t.*, 
             (SELECT COUNT(*) FROM employees e WHERE e.tipo_personal = t.clave) AS empleados_count
      FROM tipos_personal_config t
      ORDER BY t.orden, t.clave
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar tipos de personal" });
  }
});

// POST /tipos-personal-config — crear tipo
router.post("/tipos-personal-config", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { clave, label, color, descripcion, orden } = req.body;
  if (!clave || !label) return res.status(400).json({ error: "clave y label son requeridos" });
  const cleanClave = clave.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  try {
    const { rows } = await pool.query(
      `INSERT INTO tipos_personal_config (clave, label, color, descripcion, orden, es_sistema)
       VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *`,
      [
        cleanClave,
        label,
        color ?? "text-white/50 bg-white/5 border-white/10",
        descripcion ?? null,
        orden ?? 99,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Ya existe un tipo con esa clave" });
    console.error(err);
    res.status(500).json({ error: "Error al crear tipo de personal" });
  }
});

// PATCH /tipos-personal-config/:clave — actualizar tipo
router.patch("/tipos-personal-config/:clave", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { label, color, descripcion, activo, orden } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tipos_personal_config SET
         label       = COALESCE($1, label),
         color       = COALESCE($2, color),
         descripcion = COALESCE($3, descripcion),
         activo      = COALESCE($4, activo),
         orden       = COALESCE($5, orden)
       WHERE clave = $6 RETURNING *`,
      [label ?? null, color ?? null, descripcion ?? null, activo ?? null, orden ?? null, req.params.clave]
    );
    if (!rows.length) return res.status(404).json({ error: "Tipo no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar tipo de personal" });
  }
});

// DELETE /tipos-personal-config/:clave — eliminar tipo (solo si no tiene empleados)
router.delete("/tipos-personal-config/:clave", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { clave } = req.params;
  try {
    const tipo = await pool.query(`SELECT es_sistema FROM tipos_personal_config WHERE clave = $1`, [clave]);
    if (!tipo.rows.length) return res.status(404).json({ error: "Tipo no encontrado" });
    if (tipo.rows[0].es_sistema) return res.status(409).json({ error: "No se pueden eliminar tipos del sistema" });
    const empCount = await pool.query(`SELECT COUNT(*) FROM employees WHERE tipo_personal = $1`, [clave]);
    if (parseInt(empCount.rows[0].count) > 0) {
      return res.status(409).json({ error: `No se puede eliminar: ${empCount.rows[0].count} colaborador(es) usan este tipo` });
    }
    await pool.query(`DELETE FROM tipos_personal_config WHERE clave = $1`, [clave]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar tipo" });
  }
});

export { router as tiposPersonalConfigRouter };
