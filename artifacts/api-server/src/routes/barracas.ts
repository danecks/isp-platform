import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const barracasRouter = Router();

barracasRouter.get("/barracas", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*,
        (SELECT COUNT(*) FROM barraca_asignaciones ba WHERE ba.barraca_id = b.id AND ba.activo = TRUE)::int AS ocupantes
      FROM barracas b
      ORDER BY b.activo DESC, b.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /barracas error");
    res.status(500).json({ error: "Error al obtener barracas" });
  }
});

barracasRouter.get("/barracas/:id", async (req, res) => {
  try {
    const { rows: [barraca] } = await pool.query(`SELECT * FROM barracas WHERE id = $1`, [req.params.id]);
    if (!barraca) return res.status(404).json({ error: "Barraca no encontrada" });

    const { rows: asignaciones } = await pool.query(`
      SELECT ba.*, e.nombre_completo, e.dpi, e.telefono, e.estado_laboral,
        po.nombre AS puesto_nombre, po.cliente_nombre
      FROM barraca_asignaciones ba
      JOIN employees e ON e.id = ba.employee_id
      LEFT JOIN puestos_operativos po ON po.titular_employee_id = ba.employee_id AND po.activo = TRUE
      WHERE ba.barraca_id = $1
      ORDER BY ba.activo DESC, e.nombre_completo
    `, [req.params.id]);

    res.json({ ...barraca, asignaciones });
  } catch (err) {
    logger.error({ err }, "GET /barracas/:id error");
    res.status(500).json({ error: "Error al obtener barraca" });
  }
});

barracasRouter.post("/barracas", async (req, res) => {
  const { nombre, direccion, departamento, municipio, cuota_mensual, capacidad, notas } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: "El nombre es requerido" });
  if (cuota_mensual == null || cuota_mensual < 0) return res.status(400).json({ error: "La cuota mensual es requerida" });

  try {
    const { rows: [created] } = await pool.query(`
      INSERT INTO barracas (nombre, direccion, departamento, municipio, cuota_mensual, capacidad, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [nombre.trim(), direccion || null, departamento || null, municipio || null, cuota_mensual, capacidad ?? 10, notas || null]);
    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /barracas error");
    res.status(500).json({ error: "Error al crear barraca" });
  }
});

barracasRouter.patch("/barracas/:id", async (req, res) => {
  const { nombre, direccion, departamento, municipio, cuota_mensual, capacidad, notas, activo } = req.body;
  try {
    const { rows: [updated] } = await pool.query(`
      UPDATE barracas SET
        nombre = COALESCE($2, nombre),
        direccion = COALESCE($3, direccion),
        departamento = COALESCE($4, departamento),
        municipio = COALESCE($5, municipio),
        cuota_mensual = COALESCE($6, cuota_mensual),
        capacidad = COALESCE($7, capacidad),
        notas = COALESCE($8, notas),
        activo = COALESCE($9, activo),
        updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id, nombre || null, direccion, departamento, municipio, cuota_mensual, capacidad, notas, activo]);
    if (!updated) return res.status(404).json({ error: "Barraca no encontrada" });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /barracas/:id error");
    res.status(500).json({ error: "Error al actualizar barraca" });
  }
});

barracasRouter.post("/barracas/:id/asignar", async (req, res) => {
  const barracaId = parseInt(req.params.id);
  const { employeeId, notas } = req.body;
  if (!employeeId) return res.status(400).json({ error: "employeeId es requerido" });

  try {
    const { rows: [barraca] } = await pool.query(`SELECT id, capacidad, cuota_mensual FROM barracas WHERE id = $1 AND activo = TRUE`, [barracaId]);
    if (!barraca) return res.status(404).json({ error: "Barraca no encontrada o inactiva" });

    const { rows: ocupantes } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM barraca_asignaciones WHERE barraca_id = $1 AND activo = TRUE`, [barracaId]
    );
    if (ocupantes[0].count >= barraca.capacidad) {
      return res.status(409).json({ error: "La barraca está llena" });
    }

    const { rows: [emp] } = await pool.query(`SELECT id, nombre_completo FROM employees WHERE id = $1 AND estado_laboral = 'activo'`, [employeeId]);
    if (!emp) return res.status(400).json({ error: "Empleado no encontrado o inactivo" });

    const { rows: [asig] } = await pool.query(`
      INSERT INTO barraca_asignaciones (barraca_id, employee_id, notas)
      VALUES ($1, $2, $3) RETURNING *
    `, [barracaId, employeeId, notas || null]);

    logger.info({ barracaId, employeeId }, "Empleado asignado a barraca");
    res.status(201).json(asig);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Este empleado ya está asignado a una barraca" });
    }
    logger.error({ err }, "POST /barracas/:id/asignar error");
    res.status(500).json({ error: "Error al asignar empleado" });
  }
});

barracasRouter.post("/barracas/desasignar/:asignacionId", async (req, res) => {
  try {
    const { rows: [updated] } = await pool.query(`
      UPDATE barraca_asignaciones SET activo = FALSE, fecha_fin = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1 AND activo = TRUE RETURNING *
    `, [req.params.asignacionId]);
    if (!updated) return res.status(404).json({ error: "Asignación no encontrada" });
    logger.info({ asignacionId: req.params.asignacionId }, "Empleado desasignado de barraca");
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /barracas/desasignar error");
    res.status(500).json({ error: "Error al desasignar empleado" });
  }
});

barracasRouter.delete("/barracas/:id", async (req, res) => {
  try {
    const { rows: asig } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM barraca_asignaciones WHERE barraca_id = $1 AND activo = TRUE`, [req.params.id]
    );
    if (asig[0]?.count > 0) {
      return res.status(409).json({ error: "No se puede eliminar una barraca con empleados asignados. Desasigne primero." });
    }
    await pool.query(`DELETE FROM barracas WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /barracas/:id error");
    res.status(500).json({ error: "Error al eliminar barraca" });
  }
});

export function buildBarracaCuotaMap(employeeIds: number[]): Promise<Map<number, { barracaId: number; barracaNombre: string; cuota: number }>> {
  if (employeeIds.length === 0) return Promise.resolve(new Map());
  return pool.query(`
    SELECT ba.employee_id, b.id AS barraca_id, b.nombre AS barraca_nombre, b.cuota_mensual
    FROM barraca_asignaciones ba
    JOIN barracas b ON b.id = ba.barraca_id
    WHERE ba.activo = TRUE AND b.activo = TRUE AND ba.employee_id = ANY($1)
  `, [employeeIds]).then(({ rows }) => {
    const map = new Map<number, { barracaId: number; barracaNombre: string; cuota: number }>();
    for (const r of rows) {
      map.set(Number(r.employee_id), { barracaId: r.barraca_id, barracaNombre: r.barraca_nombre, cuota: parseFloat(r.cuota_mensual) });
    }
    return map;
  });
}
