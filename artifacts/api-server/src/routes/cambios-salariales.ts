import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helper: verificar rol admin/rrhh ────────────────────────────────────────
function rolesPermitidos(req: Request, res: Response): boolean {
  let rol = "";
  try { rol = JSON.parse(req.headers["x-isp-session"] as string ?? "")?.role ?? ""; } catch {}
  if (rol === "admin" || rol === "rrhh") return true;
  res.status(403).json({ error: "Acceso restringido a RRHH y administradores" });
  return false;
}

// ─── GET /api/cambios-salariales ─────────────────────────────────────────────
// Listar cambios salariales con filtros opcionales
router.get("/cambios-salariales", async (req, res) => {
  if (!rolesPermitidos(req, res)) return;
  try {
    const { estado, employee_id, desde, hasta } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (estado) { conditions.push(`cs.estado = $${idx++}`); params.push(estado); }
    if (employee_id) { conditions.push(`cs.employee_id = $${idx++}`); params.push(employee_id); }
    if (desde) { conditions.push(`cs.fecha >= $${idx++}`); params.push(desde); }
    if (hasta) { conditions.push(`cs.fecha <= $${idx++}`); params.push(hasta); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
         cs.*,
         e.nombre_completo AS empleado_nombre
       FROM cambios_salariales cs
       LEFT JOIN employees e ON e.id = cs.employee_id
       ${where}
       ORDER BY cs.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /cambios-salariales error");
    res.status(500).json({ error: "Error al obtener cambios salariales" });
  }
});

// ─── GET /api/cambios-salariales/pendientes/count ────────────────────────────
// Badge de notificación: cuántos cambios están pendientes
router.get("/cambios-salariales/pendientes/count", async (req, res) => {
  if (!rolesPermitidos(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS total FROM cambios_salariales WHERE estado = 'pendiente_rrhh'`
    );
    res.json({ total: parseInt(rows[0].total) });
  } catch (err) {
    logger.error({ err }, "GET /cambios-salariales/pendientes/count error");
    res.status(500).json({ error: "Error al contar pendientes" });
  }
});

// ─── GET /api/cambios-salariales/employee/:employeeId/periodo ────────────────
// Para planilla: obtener cambios aprobados/modificados de un empleado en un período
router.get("/cambios-salariales/employee/:employeeId/periodo", async (req, res) => {
  if (!rolesPermitidos(req, res)) return;
  const { desde, hasta } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT cs.*
       FROM cambios_salariales cs
       WHERE cs.employee_id = $1
         AND cs.estado IN ('aprobado','modificado')
         AND cs.fecha BETWEEN $2 AND $3
       ORDER BY cs.fecha ASC`,
      [req.params.employeeId, desde, hasta]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET cambios-salariales/employee/:id/periodo error");
    res.status(500).json({ error: "Error al consultar cambios salariales del período" });
  }
});

// ─── GET /api/cambios-salariales/:id ─────────────────────────────────────────
router.get("/cambios-salariales/:id", async (req, res) => {
  if (!rolesPermitidos(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT cs.*,
              e.sueldo_base AS sueldo_base_actual,
              po.nombre AS puesto_nombre_actual
       FROM cambios_salariales cs
       LEFT JOIN employees        e  ON e.id  = cs.employee_id
       LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
       WHERE cs.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Cambio salarial no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /cambios-salariales/:id error");
    res.status(500).json({ error: "Error al obtener cambio salarial" });
  }
});

// ─── PATCH /api/cambios-salariales/:id/resolver ──────────────────────────────
// RRHH aprueba, rechaza o modifica el cambio salarial
router.patch("/cambios-salariales/:id/resolver", async (req, res) => {
  if (!rolesPermitidos(req, res)) return;
  const { estado, valor_aprobado, notas, usuario } = req.body;
  const estadosValidos = ["aprobado", "rechazado", "modificado"];

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: "estado debe ser: aprobado, rechazado o modificado" });
  }
  if (estado === "modificado" && (valor_aprobado == null || isNaN(Number(valor_aprobado)))) {
    return res.status(400).json({ error: "valor_aprobado es requerido cuando estado = modificado" });
  }

  try {
    const { rows: existing } = await pool.query(
      `SELECT * FROM cambios_salariales WHERE id = $1`, [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: "Cambio salarial no encontrado" });
    if (existing[0].estado !== "pendiente_rrhh") {
      return res.status(409).json({ error: "Este cambio ya fue resuelto" });
    }

    const { rows } = await pool.query(
      `UPDATE cambios_salariales
       SET estado             = $1,
           valor_aprobado     = $2,
           rrhh_notas         = $3,
           rrhh_usuario       = $4,
           rrhh_resuelto_at   = NOW(),
           updated_at         = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        estado,
        estado === "aprobado"   ? existing[0].salario_puesto :
        estado === "modificado" ? valor_aprobado : null,
        notas ?? null,
        usuario ?? "rrhh",
        req.params.id
      ]
    );

    logger.info({ id: req.params.id, estado, usuario }, "Cambio salarial resuelto por RRHH");
    res.json({ ok: true, registro: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /cambios-salariales/:id/resolver error");
    res.status(500).json({ error: "Error al resolver cambio salarial" });
  }
});

export default router;
