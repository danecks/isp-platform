import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";
import { lunesISO, DIAS_VALIDOS, normalizarDia } from "./_helpers";

const router = Router();

// GET /api/employees/:id/user — usuario vinculado al empleado
router.get("/employees/:id/user", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const { rows } = await pool.query<{
      id: number;
      nombre: string;
      username: string;
      correo: string | null;
      rol: string;
      estado: string;
      telefono: string | null;
      last_login: Date | null;
      created_at: Date;
    }>(`
      SELECT
        u.id,
        u.nombre,
        u.username,
        u.correo,
        u.rol,
        u.estado,
        u.telefono,
        u.created_at
      FROM users u
      WHERE u.employee_id = $1
      LIMIT 1
    `, [empId]);

    if (!rows.length) {
      return res.json(null);
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("[Employee/user] Error:", err);
    res.status(500).json({ error: "Error al obtener usuario vinculado" });
  }
});

// ─── Día de descanso por semana (overrides) ──────────────────────────────────
// Permite que un agente descanse en un día distinto cada semana.
// La semana se identifica por su LUNES (DATE). Si no hay override para una
// semana, se aplica el dia_descanso por defecto del empleado.

router.get("/employees/:id/descanso-semanal", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  const { desde, hasta } = req.query as Record<string, string>;
  try {
    const params: any[] = [id];
    let where = "WHERE employee_id = $1";
    if (desde) { params.push(lunesISO(desde)); where += ` AND semana_inicio >= $${params.length}`; }
    if (hasta) { params.push(lunesISO(hasta)); where += ` AND semana_inicio <= $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT id, semana_inicio, dia_descanso, created_at, updated_at
         FROM employee_descanso_semanal
         ${where}
         ORDER BY semana_inicio ASC`,
      params
    );
    res.json(rows.map((r: any) => ({
      ...r,
      semana_inicio: r.semana_inicio instanceof Date
        ? r.semana_inicio.toISOString().slice(0, 10)
        : String(r.semana_inicio).slice(0, 10),
    })));
  } catch (err) {
    logger.error({ err }, "GET /employees/:id/descanso-semanal error");
    res.status(500).json({ error: "Error al cargar descansos por semana" });
  }
});

router.put("/employees/:id/descanso-semanal", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  const { semana_inicio, dia_descanso } = req.body || {};
  if (!semana_inicio || !dia_descanso) {
    return res.status(400).json({ error: "semana_inicio y dia_descanso son requeridos" });
  }
  const dia = normalizarDia(String(dia_descanso));
  if (!DIAS_VALIDOS.has(dia)) {
    return res.status(400).json({ error: "dia_descanso inválido" });
  }
  try {
    const lunes = lunesISO(String(semana_inicio));
    const { rows } = await pool.query(
      `INSERT INTO employee_descanso_semanal (employee_id, semana_inicio, dia_descanso)
         VALUES ($1, $2::date, $3)
         ON CONFLICT (employee_id, semana_inicio)
         DO UPDATE SET dia_descanso = EXCLUDED.dia_descanso, updated_at = NOW()
         RETURNING id, semana_inicio, dia_descanso, created_at, updated_at`,
      [id, lunes, dia]
    );
    const r: any = rows[0];
    res.json({
      ...r,
      semana_inicio: r.semana_inicio instanceof Date
        ? r.semana_inicio.toISOString().slice(0, 10)
        : String(r.semana_inicio).slice(0, 10),
    });
  } catch (err) {
    logger.error({ err }, "PUT /employees/:id/descanso-semanal error");
    res.status(500).json({ error: "Error al guardar descanso de la semana" });
  }
});

router.delete("/employees/:id/descanso-semanal/:semana", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const lunes = lunesISO(req.params.semana);
    const { rowCount } = await pool.query(
      `DELETE FROM employee_descanso_semanal
         WHERE employee_id = $1 AND semana_inicio = $2::date`,
      [id, lunes]
    );
    res.json({ ok: true, deleted: rowCount });
  } catch (err) {
    logger.error({ err }, "DELETE /employees/:id/descanso-semanal error");
    res.status(500).json({ error: "Error al eliminar override" });
  }
});

export default router;
