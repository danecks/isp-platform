import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// SUPERV-ZONA-01 — CRUD para asignación supervisor↔zona (tabla zona_supervisores).
// Vista admin del módulo Supervisión, separada del Pizarrón.

export const supervisionZonasRouter = Router();

const auth = (req: any, res: any): boolean => {
  if (!req.headers["x-isp-session"]) { res.status(401).json({ error: "No autorizado" }); return false; }
  return true;
};

// ─── GET /api/supervision-zonas ─────────────────────────────────────────────
// Devuelve todas las zonas con sus supervisores asignados.
supervisionZonasRouter.get("/supervision-zonas", async (_req, res) => {
  if (!auth(_req, res)) return;
  try {
    const { rows } = await pool.query(`
      SELECT
        z.id AS zona_id, z.nombre AS zona_nombre, z.descripcion AS zona_descripcion,
        COALESCE(
          json_agg(
            json_build_object(
              'asignacion_id',  zs.id,
              'employee_id',    e.id,
              'nombre_completo', e.nombre_completo,
              'telefono',       e.telefono,
              'estado_laboral', e.estado_laboral,
              'asignado_at',    zs.created_at
            ) ORDER BY e.nombre_completo
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::json
        ) AS supervisores
      FROM operational_zones z
      LEFT JOIN zona_supervisores zs ON zs.zona_id = z.id
      LEFT JOIN employees e          ON e.id = zs.employee_id
      GROUP BY z.id, z.nombre, z.descripcion
      ORDER BY z.nombre ASC
    `);
    res.json({ zonas: rows });
  } catch (err) {
    logger.error({ err }, "GET /supervision-zonas error");
    res.status(500).json({ error: "Error al listar zonas" });
  }
});

// ─── POST /api/supervision-zonas ────────────────────────────────────────────
// Body: { zona_id, employee_id }
supervisionZonasRouter.post("/supervision-zonas", async (req, res) => {
  if (!auth(req, res)) return;
  const zonaId = Number(req.body?.zona_id);
  const empId  = Number(req.body?.employee_id);
  if (!zonaId || !empId) return res.status(400).json({ error: "zona_id y employee_id requeridos" });

  try {
    const { rows: emp } = await pool.query(
      `SELECT tipo_personal FROM employees WHERE id = $1`, [empId]
    );
    if (!emp[0]) return res.status(404).json({ error: "Empleado no encontrado" });
    if (emp[0].tipo_personal !== "supervisor") {
      return res.status(400).json({ error: "El empleado no es supervisor" });
    }

    const { rows } = await pool.query(
      `INSERT INTO zona_supervisores (zona_id, employee_id)
       VALUES ($1, $2)
       ON CONFLICT (zona_id, employee_id) DO NOTHING
       RETURNING id`,
      [zonaId, empId]
    );
    if (!rows[0]) return res.status(409).json({ error: "Asignación ya existe" });
    res.status(201).json({ asignacion_id: rows[0].id });
  } catch (err) {
    logger.error({ err }, "POST /supervision-zonas error");
    res.status(500).json({ error: "Error al crear asignación" });
  }
});

// ─── DELETE /api/supervision-zonas/:id ──────────────────────────────────────
supervisionZonasRouter.delete("/supervision-zonas/:id", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });
  try {
    const { rowCount } = await pool.query(`DELETE FROM zona_supervisores WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /supervision-zonas/:id error");
    res.status(500).json({ error: "Error al eliminar asignación" });
  }
});

// ─── GET /api/supervision-zonas/supervisores-disponibles ────────────────────
// Lista empleados con tipo_personal='supervisor' (para selector).
supervisionZonasRouter.get("/supervision-zonas/supervisores-disponibles", async (_req, res) => {
  if (!auth(_req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre_completo, telefono, estado_laboral
       FROM employees
       WHERE tipo_personal = 'supervisor' AND estado_laboral = 'activo'
       ORDER BY nombre_completo ASC`
    );
    res.json({ supervisores: rows });
  } catch (err) {
    logger.error({ err }, "GET /supervision-zonas/supervisores-disponibles error");
    res.status(500).json({ error: "Error al listar supervisores" });
  }
});
