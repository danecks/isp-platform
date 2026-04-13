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
         ps.dias_trabajo, ps.dias_medio_turno, ps.longitud_ciclo,
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
         ps.dias_trabajo, ps.dias_medio_turno, ps.longitud_ciclo,
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
// El número de titulares y los días de trabajo se determinan AUTOMÁTICAMENTE
// desde la definición del turno asignado al puesto.
// El usuario solo proporciona: hora_entrada, fecha_inicio_ciclo, empleado_id, notas.
puestoSlotsRouter.post("/puestos/:puestoId/slots", async (req, res) => {
  if (!authCheck(req, res)) return;
  const puestoId = Number(req.params.puestoId);
  if (!puestoId) return res.status(400).json({ error: "puestoId inválido" });

  const { hora_entrada, fecha_inicio_ciclo, empleado_id, notas } = req.body;

  if (!hora_entrada) return res.status(400).json({ error: "hora_entrada requerida" });

  try {
    // 1. Obtener la definición del turno asignado al puesto
    const { rows: [puesto] } = await pool.query(
      `SELECT po.tipo_turno_id, t.num_titulares, t.tipo_ciclo, t.horas_trabajo
       FROM puestos_operativos po
       LEFT JOIN turnos t ON t.id = po.tipo_turno_id
       WHERE po.id = $1`,
      [puestoId]
    );

    if (!puesto) return res.status(404).json({ error: "Puesto no encontrado" });
    if (!puesto.tipo_turno_id) {
      return res.status(400).json({
        error: "El puesto no tiene turno asignado. Asigna un turno antes de configurar titulares."
      });
    }

    // 2. Contar slots activos actuales
    const { rows: [countRow] } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM puesto_slots WHERE puesto_id = $1 AND activo = TRUE`,
      [puestoId]
    );
    const activeCount = countRow.cnt;

    if (activeCount >= puesto.num_titulares) {
      return res.status(409).json({
        error: `Este puesto ya tiene ${puesto.num_titulares} titular(es) configurado(s) según el turno "${puesto.tipo_ciclo}". No se pueden agregar más.`
      });
    }

    // 3. Determinar slot_numero y dias_trabajo automáticamente según el turno
    const newSlotNum = activeCount + 1;
    const horasTurno = Math.round(Number(puesto.horas_trabajo));
    const cicloTotal = horasTurno + 0; // se usa horas_trabajo del turno

    // Para turnos de ciclo largo (>24h): días alternados por slot
    // Slot 1 → días impares {1,3,5,7,9,11,13}
    // Slot 2 → días pares   {2,4,6,8,10,12,14}
    // Para turnos diarios (≤24h): trabaja todos los días
    const esRotativo = horasTurno >= 24 && puesto.tipo_ciclo !== "diario";
    const diasAuto: number[] = !esRotativo
      ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14]
      : (newSlotNum % 2 === 1) ? [1,3,5,7,9,11,13] : [2,4,6,8,10,12,14];

    const { rows } = await pool.query(
      `INSERT INTO puesto_slots
         (puesto_id, slot_numero, horas_turno, hora_entrada, dias_trabajo, longitud_ciclo, fecha_inicio_ciclo, empleado_id, notas)
       VALUES ($1, $2, $3, $4, $5, 14, $6, $7, $8)
       RETURNING id, puesto_id, slot_numero, horas_turno,
                 to_char(hora_entrada, 'HH24:MI') AS hora_entrada,
                 dias_trabajo, dias_medio_turno, longitud_ciclo,
                 to_char(fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
                 empleado_id, notas, activo, created_at`,
      [puestoId, newSlotNum, horasTurno, hora_entrada,
       diasAuto, fecha_inicio_ciclo || null, empleado_id || null, notas || null]
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

  const { horas_turno, hora_entrada, dias_trabajo, dias_medio_turno, fecha_inicio_ciclo, empleado_id, notas, slot_numero } = req.body;

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
  if (dias_medio_turno !== undefined) {
    if (!Array.isArray(dias_medio_turno)) return res.status(400).json({ error: "dias_medio_turno inválido" });
    const diasValidos = dias_medio_turno.every((d: any) => Number.isInteger(d) && d >= 1 && d <= 14);
    if (!diasValidos) return res.status(400).json({ error: "dias_medio_turno debe contener números del 1 al 14" });
    updates.push(`dias_medio_turno = $${p++}`); params.push(dias_medio_turno);
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
                 dias_trabajo, dias_medio_turno, longitud_ciclo,
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
