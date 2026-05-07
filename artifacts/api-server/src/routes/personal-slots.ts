import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { normalizarFechaALunesString as normalizarFechaALunes } from "../lib/fecha-lunes";

// PERS-SLOT-01 — Endpoints CRUD de personal_slots (supervisores y administrativos).
// Modelo idéntico a puesto_slots pero anclado a employee_id (no a puesto_operativo).
// Reutiliza la misma regla SLOT-FIC-MON-01 (fecha_inicio_ciclo siempre en lunes).

export const personalSlotsRouter = Router();

const authCheck = (req: any, res: any): boolean => {
  const session = req.headers["x-isp-session"];
  if (!session) { res.status(401).json({ error: "No autorizado" }); return false; }
  return true;
};

const TIPOS_VALIDOS = new Set(["supervisor", "administrativo"]);

// ─── GET /api/personal/empleados/:empleadoId/slots ───────────────────────────
personalSlotsRouter.get("/personal/empleados/:empleadoId/slots", async (req, res) => {
  if (!authCheck(req, res)) return;
  const empId = Number(req.params.empleadoId);
  if (!empId) return res.status(400).json({ error: "empleadoId inválido" });

  try {
    const { rows } = await pool.query(
      `SELECT
         ps.id, ps.employee_id, ps.tipo, ps.slot_numero, ps.horas_turno,
         to_char(ps.hora_entrada, 'HH24:MI') AS hora_entrada,
         ps.hora_entrada_por_semana,
         ps.dias_trabajo, ps.dias_medio_turno, ps.longitud_ciclo,
         to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
         ps.notas, ps.activo,
         ps.created_at, ps.updated_at,
         e.nombre_completo AS empleado_nombre,
         e.estado_laboral  AS empleado_estado,
         e.tipo_personal   AS empleado_tipo_personal,
         e.telefono        AS empleado_telefono
       FROM personal_slots ps
       LEFT JOIN employees e ON e.id = ps.employee_id
       WHERE ps.employee_id = $1 AND ps.activo = TRUE
       ORDER BY ps.slot_numero ASC`,
      [empId]
    );
    res.json({ slots: rows });
  } catch (err) {
    logger.error({ err }, "GET /personal/empleados/:empleadoId/slots error");
    res.status(500).json({ error: "Error al obtener slots de personal" });
  }
});

// ─── GET /api/personal-slots?tipo=supervisor|administrativo ──────────────────
// Lista todos los personal_slots activos de un tipo (para el pizarrón).
personalSlotsRouter.get("/personal-slots", async (req, res) => {
  if (!authCheck(req, res)) return;
  const tipo = String(req.query.tipo || "").trim();
  if (tipo && !TIPOS_VALIDOS.has(tipo)) {
    return res.status(400).json({ error: "tipo debe ser 'supervisor' o 'administrativo'" });
  }

  try {
    const params: any[] = [];
    let where = "ps.activo = TRUE";
    if (tipo) { params.push(tipo); where += ` AND ps.tipo = $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT
         ps.id, ps.employee_id, ps.tipo, ps.slot_numero, ps.horas_turno,
         to_char(ps.hora_entrada, 'HH24:MI') AS hora_entrada,
         ps.hora_entrada_por_semana,
         ps.dias_trabajo, ps.dias_medio_turno, ps.longitud_ciclo,
         to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
         ps.notas, ps.activo, ps.updated_at,
         e.nombre_completo AS empleado_nombre,
         e.estado_laboral  AS empleado_estado,
         e.tipo_personal   AS empleado_tipo_personal,
         e.telefono        AS empleado_telefono
       FROM personal_slots ps
       JOIN employees e ON e.id = ps.employee_id
       WHERE ${where}
       ORDER BY e.nombre_completo ASC, ps.slot_numero ASC`,
      params
    );
    res.json({ slots: rows });
  } catch (err) {
    logger.error({ err }, "GET /personal-slots error");
    res.status(500).json({ error: "Error al listar personal_slots" });
  }
});

// ─── POST /api/personal/empleados/:empleadoId/slots ──────────────────────────
personalSlotsRouter.post("/personal/empleados/:empleadoId/slots", async (req, res) => {
  if (!authCheck(req, res)) return;
  const empId = Number(req.params.empleadoId);
  if (!empId) return res.status(400).json({ error: "empleadoId inválido" });

  const {
    tipo,
    horas_turno,
    hora_entrada,
    fecha_inicio_ciclo,
    notas,
    longitud_ciclo,
    hora_entrada_por_semana,
    dias_trabajo,
    dias_medio_turno,
  } = req.body;

  if (!hora_entrada) return res.status(400).json({ error: "hora_entrada requerida" });
  if (!tipo || !TIPOS_VALIDOS.has(tipo)) {
    return res.status(400).json({ error: "tipo debe ser 'supervisor' o 'administrativo'" });
  }

  // Validar longitud_ciclo (default 7 para administrativos, valores 7/14/21/28)
  let longitudCicloFinal = 7;
  if (longitud_ciclo !== undefined && longitud_ciclo !== null) {
    const lc = Number(longitud_ciclo);
    if (![7, 14, 21, 28].includes(lc)) {
      return res.status(400).json({ error: "longitud_ciclo debe ser 7, 14, 21 o 28" });
    }
    longitudCicloFinal = lc;
  }

  // Validar hora_entrada_por_semana
  let horaEntradaPorSemanaFinal: string[] | null = null;
  if (hora_entrada_por_semana !== undefined && hora_entrada_por_semana !== null) {
    if (!Array.isArray(hora_entrada_por_semana)) {
      return res.status(400).json({ error: "hora_entrada_por_semana debe ser array" });
    }
    const semanasEsperadas = Math.ceil(longitudCicloFinal / 7);
    if (hora_entrada_por_semana.length !== semanasEsperadas) {
      return res.status(400).json({
        error: `hora_entrada_por_semana debe tener ${semanasEsperadas} elemento(s) para longitud_ciclo=${longitudCicloFinal}`
      });
    }
    const formatoOk = hora_entrada_por_semana.every((h: any) => typeof h === "string" && /^\d{2}:\d{2}$/.test(h));
    if (!formatoOk) return res.status(400).json({ error: "hora_entrada_por_semana debe contener strings HH:MM" });
    horaEntradaPorSemanaFinal = hora_entrada_por_semana;
  }

  // Validar dias_trabajo
  let diasTrabajoFinal: number[] = Array.from({ length: longitudCicloFinal }, (_, i) => i + 1).slice(0, 5); // L-V por defecto
  if (Array.isArray(dias_trabajo) && dias_trabajo.length > 0) {
    const validos = dias_trabajo.every((d: any) => Number.isInteger(d) && d >= 1 && d <= longitudCicloFinal);
    if (!validos) return res.status(400).json({ error: `dias_trabajo debe contener números del 1 al ${longitudCicloFinal}` });
    diasTrabajoFinal = dias_trabajo.map((d: any) => Number(d)).sort((a: number, b: number) => a - b);
  }

  // Validar dias_medio_turno
  let diasMedioTurnoFinal: number[] = [];
  if (Array.isArray(dias_medio_turno)) {
    const validos = dias_medio_turno.every((d: any) => Number.isInteger(d) && d >= 1 && d <= longitudCicloFinal);
    if (!validos) return res.status(400).json({ error: `dias_medio_turno debe contener números del 1 al ${longitudCicloFinal}` });
    diasMedioTurnoFinal = dias_medio_turno.map((d: any) => Number(d));
  }

  // Validar horas_turno
  const horasTurnoFinal = horas_turno !== undefined ? Number(horas_turno) : 8;
  if (![8, 12, 24].includes(horasTurnoFinal)) {
    return res.status(400).json({ error: "horas_turno debe ser 8, 12 o 24" });
  }

  try {
    // Validar empleado y coherencia tipo ↔ tipo_personal
    const { rows: empCheck } = await pool.query(
      `SELECT id, estado_laboral, COALESCE(tipo_personal,'guardia') AS tipo_personal FROM employees WHERE id = $1`,
      [empId]
    );
    if (!empCheck.length) return res.status(404).json({ error: "Empleado no encontrado" });
    const tp = String(empCheck[0].tipo_personal || "guardia");
    if (tipo === "supervisor" && tp !== "supervisor") {
      return res.status(409).json({ error: `El empleado no es supervisor (tipo_personal='${tp}'). Cambia su tipo en su ficha antes de configurar plantilla de supervisor.` });
    }
    if (tipo === "administrativo" && tp === "guardia") {
      return res.status(409).json({ error: "Los guardias usan plantilla por puesto (puesto_slots), no plantilla administrativa. Si es personal administrativo, cambia su tipo en su ficha primero." });
    }

    // Determinar slot_numero
    const { rows: [countRow] } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM personal_slots WHERE employee_id = $1 AND activo = TRUE`,
      [empId]
    );
    const newSlotNum = (countRow.cnt || 0) + 1;

    const { rows } = await pool.query(
      `INSERT INTO personal_slots
         (employee_id, tipo, slot_numero, horas_turno, hora_entrada,
          dias_trabajo, dias_medio_turno, longitud_ciclo, fecha_inicio_ciclo,
          notas, hora_entrada_por_semana)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, employee_id, tipo, slot_numero, horas_turno,
                 to_char(hora_entrada, 'HH24:MI') AS hora_entrada,
                 hora_entrada_por_semana,
                 dias_trabajo, dias_medio_turno, longitud_ciclo,
                 to_char(fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
                 notas, activo, created_at`,
      [
        empId, tipo, newSlotNum, horasTurnoFinal, hora_entrada,
        diasTrabajoFinal, diasMedioTurnoFinal, longitudCicloFinal,
        normalizarFechaALunes(fecha_inicio_ciclo),
        notas || null, horaEntradaPorSemanaFinal,
      ]
    );
    res.status(201).json({ slot: rows[0] });
  } catch (err) {
    logger.error({ err }, "POST /personal/empleados/:empleadoId/slots error");
    res.status(500).json({ error: "Error al crear personal_slot" });
  }
});

// ─── PUT /api/personal-slots/:id ─────────────────────────────────────────────
personalSlotsRouter.put("/personal-slots/:id", async (req, res) => {
  if (!authCheck(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  const {
    horas_turno, hora_entrada, dias_trabajo, dias_medio_turno,
    fecha_inicio_ciclo, notas, slot_numero, longitud_ciclo, hora_entrada_por_semana, tipo,
  } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  let p = 1;

  // Resolver longitud_ciclo efectiva
  let longitudCicloEfectiva: number | null = null;
  let cambioLongitudCiclo = false;
  let estadoPrevio: { dias_trabajo: number[] | null; dias_medio_turno: number[] | null; hora_entrada_por_semana: string[] | null } | null = null;
  try {
    const { rows: cur } = await pool.query(
      `SELECT longitud_ciclo, dias_trabajo, dias_medio_turno, hora_entrada_por_semana FROM personal_slots WHERE id = $1`,
      [id],
    );
    if (cur.length > 0) {
      estadoPrevio = {
        dias_trabajo: Array.isArray(cur[0].dias_trabajo) ? cur[0].dias_trabajo : null,
        dias_medio_turno: Array.isArray(cur[0].dias_medio_turno) ? cur[0].dias_medio_turno : null,
        hora_entrada_por_semana: Array.isArray(cur[0].hora_entrada_por_semana) ? cur[0].hora_entrada_por_semana : null,
      };
      longitudCicloEfectiva = Number(cur[0].longitud_ciclo) || 7;
    }
  } catch {}
  if (longitudCicloEfectiva == null) longitudCicloEfectiva = 7;

  if (longitud_ciclo !== undefined && longitud_ciclo !== null) {
    const lc = Number(longitud_ciclo);
    if (![7, 14, 21, 28].includes(lc)) {
      return res.status(400).json({ error: "longitud_ciclo debe ser 7, 14, 21 o 28" });
    }
    cambioLongitudCiclo = lc !== longitudCicloEfectiva;
    longitudCicloEfectiva = lc;
    updates.push(`longitud_ciclo = $${p++}`); params.push(lc);
  }

  if (cambioLongitudCiclo && dias_trabajo === undefined && estadoPrevio?.dias_trabajo) {
    const fueraDeRango = estadoPrevio.dias_trabajo.some(d => d > longitudCicloEfectiva!);
    if (fueraDeRango) {
      return res.status(400).json({
        error: `Al cambiar longitud_ciclo a ${longitudCicloEfectiva} debes enviar dias_trabajo válido`,
      });
    }
  }
  if (cambioLongitudCiclo && hora_entrada_por_semana === undefined && estadoPrevio?.hora_entrada_por_semana) {
    const semanasEsperadas = Math.ceil(longitudCicloEfectiva / 7);
    if (estadoPrevio.hora_entrada_por_semana.length !== semanasEsperadas) {
      return res.status(400).json({
        error: `Al cambiar longitud_ciclo a ${longitudCicloEfectiva} debes enviar hora_entrada_por_semana con ${semanasEsperadas} elemento(s) (o null para limpiar)`,
      });
    }
  }

  if (tipo !== undefined) {
    if (!TIPOS_VALIDOS.has(tipo)) return res.status(400).json({ error: "tipo debe ser 'supervisor' o 'administrativo'" });
    // Validar coherencia tipo↔employees.tipo_personal
    try {
      const { rows: empRow } = await pool.query(
        `SELECT e.tipo_personal FROM personal_slots ps JOIN employees e ON e.id = ps.employee_id WHERE ps.id = $1`,
        [id],
      );
      if (empRow.length > 0) {
        const tp = String(empRow[0].tipo_personal || "").toLowerCase();
        if (tp && tp !== tipo) {
          return res.status(400).json({ error: `tipo='${tipo}' incompatible con tipo_personal='${tp}' del empleado` });
        }
      }
    } catch {}
    updates.push(`tipo = $${p++}`); params.push(tipo);
  }
  if (horas_turno !== undefined) {
    if (![8, 12, 24].includes(Number(horas_turno))) return res.status(400).json({ error: "horas_turno debe ser 8, 12 o 24" });
    updates.push(`horas_turno = $${p++}`); params.push(Number(horas_turno));
  }
  if (hora_entrada !== undefined) { updates.push(`hora_entrada = $${p++}`); params.push(hora_entrada); }
  if (dias_trabajo !== undefined) {
    if (!Array.isArray(dias_trabajo) || dias_trabajo.length === 0) return res.status(400).json({ error: "dias_trabajo inválido" });
    const diasValidos = dias_trabajo.every((d: any) => Number.isInteger(d) && d >= 1 && d <= longitudCicloEfectiva!);
    if (!diasValidos) return res.status(400).json({ error: `dias_trabajo debe contener números del 1 al ${longitudCicloEfectiva}` });
    updates.push(`dias_trabajo = $${p++}`); params.push(dias_trabajo);
  }
  if (dias_medio_turno !== undefined) {
    if (!Array.isArray(dias_medio_turno)) return res.status(400).json({ error: "dias_medio_turno inválido" });
    const diasValidos = dias_medio_turno.every((d: any) => Number.isInteger(d) && d >= 1 && d <= longitudCicloEfectiva!);
    if (!diasValidos) return res.status(400).json({ error: `dias_medio_turno debe contener números del 1 al ${longitudCicloEfectiva}` });
    updates.push(`dias_medio_turno = $${p++}`); params.push(dias_medio_turno);
  }
  if (hora_entrada_por_semana !== undefined) {
    if (hora_entrada_por_semana === null) {
      updates.push(`hora_entrada_por_semana = $${p++}`); params.push(null);
    } else {
      if (!Array.isArray(hora_entrada_por_semana)) return res.status(400).json({ error: "hora_entrada_por_semana debe ser array o null" });
      const semanasEsperadas = Math.ceil(longitudCicloEfectiva! / 7);
      if (hora_entrada_por_semana.length !== semanasEsperadas) {
        return res.status(400).json({ error: `hora_entrada_por_semana debe tener ${semanasEsperadas} elemento(s)` });
      }
      const formatoOk = hora_entrada_por_semana.every((h: any) => typeof h === "string" && /^\d{2}:\d{2}$/.test(h));
      if (!formatoOk) return res.status(400).json({ error: "hora_entrada_por_semana debe contener strings HH:MM" });
      updates.push(`hora_entrada_por_semana = $${p++}`); params.push(hora_entrada_por_semana);
    }
  }
  if (fecha_inicio_ciclo !== undefined) {
    updates.push(`fecha_inicio_ciclo = $${p++}`); params.push(normalizarFechaALunes(fecha_inicio_ciclo));
  }
  if (notas !== undefined) { updates.push(`notas = $${p++}`); params.push(notas || null); }
  if (slot_numero !== undefined) { updates.push(`slot_numero = $${p++}`); params.push(Number(slot_numero)); }

  if (updates.length === 0) return res.status(400).json({ error: "Sin campos a actualizar" });
  updates.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE personal_slots SET ${updates.join(", ")} WHERE id = $${p} AND activo = TRUE
       RETURNING id, employee_id, tipo, slot_numero, horas_turno,
                 to_char(hora_entrada, 'HH24:MI') AS hora_entrada,
                 dias_trabajo, dias_medio_turno, longitud_ciclo,
                 hora_entrada_por_semana,
                 to_char(fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
                 notas, activo, updated_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "Slot no encontrado" });
    res.json({ slot: rows[0] });
  } catch (err) {
    logger.error({ err }, "PUT /personal-slots/:id error");
    res.status(500).json({ error: "Error al actualizar personal_slot" });
  }
});

// ─── DELETE /api/personal-slots/:id ──────────────────────────────────────────
personalSlotsRouter.delete("/personal-slots/:id", async (req, res) => {
  if (!authCheck(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "id inválido" });

  try {
    await pool.query(`UPDATE personal_slots SET activo = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /personal-slots/:id error");
    res.status(500).json({ error: "Error al eliminar personal_slot" });
  }
});
