/**
 * turnos.ts — Catálogo de tipos de turno
 *
 * ENDPOINTS:
 *   GET    /api/turnos            → Listar todos los turnos
 *   POST   /api/turnos            → Crear nuevo turno
 *   PATCH  /api/turnos/:id        → Actualizar turno
 *   DELETE /api/turnos/:id        → Desactivar turno (soft delete)
 *
 * MODELO DE CICLO:
 *   ciclo_horas = horas_trabajo + horas_descanso
 *   Si ciclo ≤ 24: trabajan todos los días (descanso manejado por dia_descanso)
 *   Si ciclo > 24: alternancia día trabaja / día descansa según fecha_inicio_ciclo del puesto
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const turnosRouter = Router();

// ─── GET /api/turnos ──────────────────────────────────────────────────────────
turnosRouter.get("/turnos", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.*,
        (t.horas_trabajo + COALESCE(t.horas_descanso, 0))                    AS ciclo_horas,
        CASE
          WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24
            THEN 'diario'
          ELSE 'alternado'
        END                                                                    AS tipo_ciclo,
        CEIL(t.horas_trabajo / 24.0)                                          AS dias_trabajo,
        CEIL(COALESCE(t.horas_descanso, 0) / 24.0)                            AS dias_descanso,
        COUNT(po.id) FILTER (WHERE po.activo = TRUE)                          AS puestos_count
      FROM turnos t
      LEFT JOIN puestos_operativos po ON po.tipo_turno_id = t.id
      GROUP BY t.id
      ORDER BY t.activo DESC, t.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /turnos error");
    res.status(500).json({ error: "Error al listar turnos" });
  }
});

// ─── POST /api/turnos ─────────────────────────────────────────────────────────
turnosRouter.post("/turnos", async (req, res) => {
  const { nombre, descripcion, horas_trabajo, horas_descanso } = req.body ?? {};

  if (!nombre?.trim() || horas_trabajo == null) {
    return res.status(400).json({ error: "nombre y horas_trabajo son requeridos" });
  }
  if (horas_trabajo <= 0 || horas_trabajo > 168) {
    return res.status(400).json({ error: "horas_trabajo debe estar entre 1 y 168" });
  }

  const horasDesc = parseFloat(horas_descanso ?? 0);

  try {
    const { rows } = await pool.query(`
      INSERT INTO turnos (nombre, descripcion, horas_trabajo, horas_descanso)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [nombre.trim(), descripcion?.trim() || null, parseFloat(horas_trabajo), horasDesc]);
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "23505") {
      return res.status(409).json({ error: "Ya existe un turno con ese nombre" });
    }
    logger.error({ err }, "POST /turnos error");
    res.status(500).json({ error: "Error al crear turno" });
  }
});

// ─── PATCH /api/turnos/:id ────────────────────────────────────────────────────
turnosRouter.patch("/turnos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { nombre, descripcion, horas_trabajo, horas_descanso, activo } = req.body ?? {};

  try {
    const { rows } = await pool.query(`
      UPDATE turnos SET
        nombre         = COALESCE($1, nombre),
        descripcion    = COALESCE($2, descripcion),
        horas_trabajo  = COALESCE($3, horas_trabajo),
        horas_descanso = COALESCE($4, horas_descanso),
        activo         = COALESCE($5, activo),
        updated_at     = NOW()
      WHERE id = $6
      RETURNING *
    `, [
      nombre?.trim() || null,
      descripcion !== undefined ? (descripcion?.trim() || null) : null,
      horas_trabajo != null ? parseFloat(horas_trabajo) : null,
      horas_descanso != null ? parseFloat(horas_descanso) : null,
      activo != null ? Boolean(activo) : null,
      id,
    ]);

    if (!rows.length) return res.status(404).json({ error: "Turno no encontrado" });
    res.json(rows[0]);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "23505") {
      return res.status(409).json({ error: "Ya existe un turno con ese nombre" });
    }
    logger.error({ err }, "PATCH /turnos/:id error");
    res.status(500).json({ error: "Error al actualizar turno" });
  }
});

// ─── DELETE /api/turnos/:id ───────────────────────────────────────────────────
turnosRouter.delete("/turnos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    // Verificar si tiene puestos activos asociados
    const { rows: check } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM puestos_operativos WHERE tipo_turno_id = $1 AND activo = TRUE`,
      [id]
    );
    if (check[0].n > 0) {
      return res.status(409).json({
        error: `Este turno está asignado a ${check[0].n} puesto(s) activo(s). Reasígnalos antes de desactivar.`,
      });
    }

    const { rows } = await pool.query(
      `UPDATE turnos SET activo = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id, nombre, activo`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Turno no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "DELETE /turnos/:id error");
    res.status(500).json({ error: "Error al desactivar turno" });
  }
});
