import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const puestoSlotsRouter = Router();

const authCheck = (req: any, res: any): boolean => {
  const session = req.headers["x-isp-session"];
  if (!session) { res.status(401).json({ error: "No autorizado" }); return false; }
  return true;
};

// ─── GET /api/puestos/:puestoId/slots ────────────────────────────────────────
puestoSlotsRouter.get("/puestos/:puestoId/slots", async (req, res) => {
  if (!authCheck(req, res)) return;
  const puestoId = Number(req.params.puestoId);
  if (!puestoId) return res.status(400).json({ error: "puestoId inválido" });

  try {
    const { rows } = await pool.query(
      `SELECT
         ps.id, ps.puesto_id, ps.slot_numero, ps.horas_turno,
         to_char(ps.hora_entrada, 'HH24:MI') AS hora_entrada,
         ps.dias_trabajo, ps.longitud_ciclo,
         to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
         ps.empleado_id, ps.notas, ps.activo,
         ps.created_at, ps.updated_at,
         e.nombre_completo AS empleado_nombre,
         e.estado_laboral  AS empleado_estado,
         e.telefono        AS empleado_telefono
       FROM puesto_slots ps
       LEFT JOIN employees e ON e.id = ps.empleado_id
       WHERE ps.puesto_id = $1 AND ps.activo = TRUE
       ORDER BY ps.slot_numero ASC`,
      [puestoId]
    );
    res.json({ slots: rows });
  } catch (err) {
    logger.error({ err }, "GET /puestos/:puestoId/slots error");
    res.status(500).json({ error: "Error al obtener slots" });
  }
});

// ─── GET /api/clientes/:clienteId/slots ──────────────────────────────────────
puestoSlotsRouter.get("/clientes/:clienteId/slots", async (req, res) => {
  if (!authCheck(req, res)) return;
  const clienteId = Number(req.params.clienteId);
  if (!clienteId) return res.status(400).json({ error: "clienteId inválido" });

  try {
    const { rows } = await pool.query(
      `SELECT
         ps.id, ps.puesto_id, ps.slot_numero, ps.horas_turno,
         to_char(ps.hora_entrada, 'HH24:MI') AS hora_entrada,
         ps.dias_trabajo, ps.longitud_ciclo,
         to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
         ps.empleado_id, ps.notas, ps.activo,
         ps.updated_at,
         po.nombre AS puesto_nombre,
         po.sede_id,
         cs.nombre AS sede_nombre,
         e.nombre_completo AS empleado_nombre,
         e.estado_laboral  AS empleado_estado,
         e.telefono        AS empleado_telefono
       FROM puesto_slots ps
       JOIN  puestos_operativos po ON po.id = ps.puesto_id
       LEFT JOIN client_sedes cs ON cs.id = po.sede_id
       LEFT JOIN employees e ON e.id = ps.empleado_id
       WHERE po.cliente_id = $1 AND ps.activo = TRUE AND po.activo = TRUE
       ORDER BY po.sede_id NULLS LAST, po.nombre ASC, ps.slot_numero ASC`,
      [clienteId]
    );
    res.json({ slots: rows });
  } catch (err) {
    logger.error({ err }, "GET /clientes/:clienteId/slots error");
    res.status(500).json({ error: "Error al obtener slots del cliente" });
  }
});

// ─── POST /api/puestos/:puestoId/slots ───────────────────────────────────────
puestoSlotsRouter.post("/puestos/:puestoId/slots", async (req, res) => {
  if (!authCheck(req, res)) return;
  const puestoId = Number(req.params.puestoId);
  if (!puestoId) return res.status(400).json({ error: "puestoId inválido" });

  const { slot_numero, horas_turno, hora_entrada, dias_trabajo, fecha_inicio_ciclo, empleado_id, notas } = req.body;

  if (!horas_turno || ![8, 12, 24].includes(Number(horas_turno))) {
    return res.status(400).json({ error: "horas_turno debe ser 8, 12 o 24" });
  }
  if (!hora_entrada) return res.status(400).json({ error: "hora_entrada requerida" });
  if (!Array.isArray(dias_trabajo) || dias_trabajo.length === 0) {
    return res.status(400).json({ error: "dias_trabajo debe ser un arreglo no vacío" });
  }
  // Ciclo fijo de 14 días: valores 1–14
  const diasValidos = dias_trabajo.every((d: any) => Number.isInteger(d) && d >= 1 && d <= 14);
  if (!diasValidos) return res.status(400).json({ error: "dias_trabajo debe contener números del 1 al 14" });

  try {
    let slotNum = Number(slot_numero) || null;
    if (!slotNum) {
      const { rows } = await pool.query(
        `SELECT COALESCE(MAX(slot_numero), 0) + 1 AS next_slot FROM puesto_slots WHERE puesto_id = $1`,
        [puestoId]
      );
      slotNum = rows[0].next_slot;
    }

    const { rows } = await pool.query(
      `INSERT INTO puesto_slots
         (puesto_id, slot_numero, horas_turno, hora_entrada, dias_trabajo, longitud_ciclo, fecha_inicio_ciclo, empleado_id, notas)
       VALUES ($1, $2, $3, $4, $5, 14, $6, $7, $8)
       RETURNING id, puesto_id, slot_numero, horas_turno,
                 to_char(hora_entrada, 'HH24:MI') AS hora_entrada,
                 dias_trabajo, longitud_ciclo,
                 to_char(fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
                 empleado_id, notas, activo, created_at`,
      [puestoId, slotNum, Number(horas_turno), hora_entrada,
       dias_trabajo, fecha_inicio_ciclo || null, empleado_id || null, notas || null]
    );
    res.status(201).json({ slot: rows[0] });
  } catch (err) {
    logger.error({ err }, "POST /puestos/:puestoId/slots error");
    res.status(500).json({ error: "Error al crear slot" });
  }
});

// ─── PUT /api/slots/:id ───────────────────────────────────────────────────────
puestoSlotsRouter.put("/slots/:id", async (req, res) => {
  if (!authCheck(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const { horas_turno, hora_entrada, dias_trabajo, fecha_inicio_ciclo, empleado_id, notas, slot_numero } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  let p = 1;

  if (horas_turno !== undefined) {
    if (![12, 24].includes(Number(horas_turno))) return res.status(400).json({ error: "horas_turno debe ser 12 o 24" });
    updates.push(`horas_turno = $${p++}`); params.push(Number(horas_turno));
  }
  if (hora_entrada !== undefined) { updates.push(`hora_entrada = $${p++}`); params.push(hora_entrada); }
  if (dias_trabajo !== undefined) {
    if (!Array.isArray(dias_trabajo) || dias_trabajo.length === 0) return res.status(400).json({ error: "dias_trabajo inválido" });
    const diasValidos = dias_trabajo.every((d: any) => Number.isInteger(d) && d >= 1 && d <= 14);
    if (!diasValidos) return res.status(400).json({ error: "dias_trabajo debe contener números del 1 al 14" });
    updates.push(`dias_trabajo = $${p++}`); params.push(dias_trabajo);
  }
  if (fecha_inicio_ciclo !== undefined) {
    updates.push(`fecha_inicio_ciclo = $${p++}`); params.push(fecha_inicio_ciclo || null);
  }
  if (empleado_id !== undefined) { updates.push(`empleado_id = $${p++}`); params.push(empleado_id || null); }
  if (notas !== undefined) { updates.push(`notas = $${p++}`); params.push(notas || null); }
  if (slot_numero !== undefined) { updates.push(`slot_numero = $${p++}`); params.push(Number(slot_numero)); }

  if (updates.length === 0) return res.status(400).json({ error: "Sin campos a actualizar" });
  updates.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE puesto_slots SET ${updates.join(", ")} WHERE id = $${p} AND activo = TRUE
       RETURNING id, puesto_id, slot_numero, horas_turno,
                 to_char(hora_entrada, 'HH24:MI') AS hora_entrada,
                 dias_trabajo, longitud_ciclo,
                 to_char(fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
                 empleado_id, notas, activo, updated_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "Slot no encontrado" });
    res.json({ slot: rows[0] });
  } catch (err) {
    logger.error({ err }, "PUT /slots/:id error");
    res.status(500).json({ error: "Error al actualizar slot" });
  }
});

// ─── DELETE /api/slots/:id ────────────────────────────────────────────────────
puestoSlotsRouter.delete("/slots/:id", async (req, res) => {
  if (!authCheck(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  try {
    await pool.query(`UPDATE puesto_slots SET activo = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /slots/:id error");
    res.status(500).json({ error: "Error al eliminar slot" });
  }
});

// ─── GET /api/operaciones/disponibles-cobertura ───────────────────────────────
// Devuelve agentes que descansan en la fecha indicada según su ciclo de 14 días.
// ?fecha=YYYY-MM-DD (default: hoy Guatemala UTC-6)
puestoSlotsRouter.get("/operaciones/disponibles-cobertura", async (req, res) => {
  if (!authCheck(req, res)) return;

  try {
    let fechaStr = req.query.fecha as string | undefined;

    if (!fechaStr) {
      const { rows } = await pool.query(
        `SELECT to_char(NOW() AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD') AS hoy`
      );
      fechaStr = rows[0].hoy;
    }

    // Agentes con slots activos que descansan en la fecha indicada:
    // Si tiene fecha_inicio_ciclo → calcula día del ciclo
    // Si no tiene → usa el día ISO de semana como fallback (compatibilidad)
    const { rows } = await pool.query(
      `SELECT
         e.id             AS empleado_id,
         e.nombre_completo,
         e.telefono,
         e.estado_laboral,
         po.id            AS puesto_id,
         po.nombre        AS puesto_nombre,
         po.cliente_id,
         c.nombre         AS cliente_nombre,
         ps.id            AS slot_id,
         ps.slot_numero,
         ps.horas_turno,
         to_char(ps.hora_entrada, 'HH24:MI') AS hora_entrada,
         ps.dias_trabajo,
         ps.longitud_ciclo,
         to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
         CASE
           WHEN ps.fecha_inicio_ciclo IS NULL THEN
             EXTRACT(ISODOW FROM $1::date)::int
           ELSE
             ((($1::date - ps.fecha_inicio_ciclo) % ps.longitud_ciclo) + 1)
         END AS dia_en_ciclo
       FROM puesto_slots ps
       JOIN employees e ON e.id = ps.empleado_id
       JOIN puestos_operativos po ON po.id = ps.puesto_id
       JOIN clients c ON c.id = po.cliente_id
       WHERE ps.activo = TRUE
         AND po.activo = TRUE
         AND e.estado_laboral NOT IN ('baja', 'suspendido', 'vacaciones')
         AND NOT (
           CASE
             WHEN ps.fecha_inicio_ciclo IS NULL THEN
               EXTRACT(ISODOW FROM $1::date)::int = ANY(ps.dias_trabajo)
             ELSE
               ((($1::date - ps.fecha_inicio_ciclo) % ps.longitud_ciclo) + 1) = ANY(ps.dias_trabajo)
           END
         )
       ORDER BY c.nombre ASC, e.nombre_completo ASC`,
      [fechaStr]
    );

    res.json({
      fecha: fechaStr,
      disponibles: rows
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/disponibles-cobertura error");
    res.status(500).json({ error: "Error al calcular disponibilidad" });
  }
});
