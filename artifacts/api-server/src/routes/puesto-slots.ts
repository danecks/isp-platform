import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  liberarTitularidadAgente,
  lockTitularidadAgente,
} from "./operaciones/_helpers/titularidad";

export const puestoSlotsRouter = Router();

// SLOT-FIC-MON-01: ver lib/fecha-lunes.ts para la regla completa.
import { normalizarFechaALunesString as normalizarFechaALunes } from "../lib/fecha-lunes";

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
         ps.hora_entrada_por_semana,
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
         ps.hora_entrada_por_semana,
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

  const { hora_entrada, fecha_inicio_ciclo, empleado_id, notas, longitud_ciclo, hora_entrada_por_semana, dias_trabajo: diasReq } = req.body;

  if (!hora_entrada) return res.status(400).json({ error: "hora_entrada requerida" });

  // TURNOS-04: validar longitud_ciclo si se provee (default 14, valores válidos 7/14/21/28)
  let longitudCicloFinal = 14;
  if (longitud_ciclo !== undefined && longitud_ciclo !== null) {
    const lc = Number(longitud_ciclo);
    if (![7, 14, 21, 28].includes(lc)) {
      return res.status(400).json({ error: "longitud_ciclo debe ser 7, 14, 21 o 28" });
    }
    longitudCicloFinal = lc;
  }

  // TURNOS-04: validar hora_entrada_por_semana si se provee
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
    let diasAuto: number[] = !esRotativo
      ? Array.from({ length: longitudCicloFinal }, (_, i) => i + 1)
      : (newSlotNum % 2 === 1)
        ? Array.from({ length: longitudCicloFinal }, (_, i) => i + 1).filter(d => d % 2 === 1)
        : Array.from({ length: longitudCicloFinal }, (_, i) => i + 1).filter(d => d % 2 === 0);

    // Si el cliente provee dias_trabajo explícito, validarlo y usarlo
    if (Array.isArray(diasReq) && diasReq.length > 0) {
      const validos = diasReq.every((d: any) => Number.isInteger(d) && d >= 1 && d <= longitudCicloFinal);
      if (!validos) return res.status(400).json({ error: `dias_trabajo debe contener números del 1 al ${longitudCicloFinal}` });
      diasAuto = diasReq.map((d: any) => Number(d)).sort((a: number, b: number) => a - b);
    }

    // PIZ-DUP-01: si el slot se crea CON empleado titular, validar activo
    // y liberar titularidad previa en otros puestos (regla "1 titular = 1 puesto").
    const asignandoEmpleado = empleado_id !== undefined && empleado_id !== null && Number(empleado_id) > 0;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (asignandoEmpleado) {
        const empId = Number(empleado_id);
        const { rows: empCheck } = await client.query(
          `SELECT id, estado_laboral FROM employees WHERE id = $1`,
          [empId]
        );
        if (!empCheck.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Colaborador no encontrado" });
        }
        if (empCheck[0].estado_laboral !== "activo") {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: `No se puede asignar como titular: el colaborador está ${empCheck[0].estado_laboral} (no activo)`
          });
        }
        await lockTitularidadAgente(client, empId);
        const liberado = await liberarTitularidadAgente(client, empId, {
          puestoId: puestoId,
        });
        if (liberado.puestos.length > 0 || liberado.custodias.length > 0) {
          logger.info({
            employeeId: empId,
            puestoDestino: puestoId,
            liberado,
          }, "POST /puestos/:puestoId/slots: titularidad previa liberada");
        }
      }

      const { rows } = await client.query(
        `INSERT INTO puesto_slots
           (puesto_id, slot_numero, horas_turno, hora_entrada, dias_trabajo, longitud_ciclo, fecha_inicio_ciclo, empleado_id, notas, hora_entrada_por_semana)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, puesto_id, slot_numero, horas_turno,
                   to_char(hora_entrada, 'HH24:MI') AS hora_entrada,
                   hora_entrada_por_semana,
                   dias_trabajo, dias_medio_turno, longitud_ciclo,
                   to_char(fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
                   empleado_id, notas, activo, created_at`,
        [puestoId, newSlotNum, horasTurno, hora_entrada,
         diasAuto, longitudCicloFinal, normalizarFechaALunes(fecha_inicio_ciclo), empleado_id || null, notas || null,
         horaEntradaPorSemanaFinal]
      );
      await client.query("COMMIT");
      res.status(201).json({ slot: rows[0] });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
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

  const { horas_turno, hora_entrada, dias_trabajo, dias_medio_turno, fecha_inicio_ciclo, empleado_id, notas, slot_numero, longitud_ciclo, hora_entrada_por_semana } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  let p = 1;

  // TURNOS-04: longitud_ciclo efectiva para validar dias_trabajo y hora_entrada_por_semana.
  // Si viene en este PUT se usa; si no, hay que leer la actual del slot para validar.
  let longitudCicloEfectiva: number | null = null;
  let cambioLongitudCiclo = false;
  let estadoPrevio: { dias_trabajo: number[] | null; dias_medio_turno: number[] | null; hora_entrada_por_semana: string[] | null } | null = null;
  try {
    const { rows: cur } = await pool.query(
      `SELECT longitud_ciclo, dias_trabajo, dias_medio_turno, hora_entrada_por_semana FROM puesto_slots WHERE id = $1`,
      [id],
    );
    if (cur.length > 0) {
      estadoPrevio = {
        dias_trabajo: Array.isArray(cur[0].dias_trabajo) ? cur[0].dias_trabajo : null,
        dias_medio_turno: Array.isArray(cur[0].dias_medio_turno) ? cur[0].dias_medio_turno : null,
        hora_entrada_por_semana: Array.isArray(cur[0].hora_entrada_por_semana) ? cur[0].hora_entrada_por_semana : null,
      };
      longitudCicloEfectiva = Number(cur[0].longitud_ciclo) || 14;
    }
  } catch {}
  if (longitudCicloEfectiva == null) longitudCicloEfectiva = 14;

  if (longitud_ciclo !== undefined && longitud_ciclo !== null) {
    const lc = Number(longitud_ciclo);
    if (![7, 14, 21, 28].includes(lc)) {
      return res.status(400).json({ error: "longitud_ciclo debe ser 7, 14, 21 o 28" });
    }
    cambioLongitudCiclo = lc !== longitudCicloEfectiva;
    longitudCicloEfectiva = lc;
    updates.push(`longitud_ciclo = $${p++}`); params.push(lc);
  }

  // Defensa: si cambia longitud_ciclo y el caller NO mandó nuevos dias_trabajo,
  // exigirlo (el estado previo casi siempre quedaría fuera de rango).
  if (cambioLongitudCiclo && dias_trabajo === undefined && estadoPrevio?.dias_trabajo) {
    const fueraDeRango = estadoPrevio.dias_trabajo.some(d => d > longitudCicloEfectiva!);
    if (fueraDeRango) {
      return res.status(400).json({
        error: `Al cambiar longitud_ciclo a ${longitudCicloEfectiva} debes enviar dias_trabajo válido (estado actual contiene días fuera del rango 1..${longitudCicloEfectiva})`,
      });
    }
  }
  // Defensa similar para hora_entrada_por_semana: si cambia longitud_ciclo y el slot
  // tenía rotación de horarios pero no se manda nuevo array → forzar a enviarlo.
  if (cambioLongitudCiclo && hora_entrada_por_semana === undefined && estadoPrevio?.hora_entrada_por_semana) {
    const semanasEsperadas = Math.ceil(longitudCicloEfectiva / 7);
    if (estadoPrevio.hora_entrada_por_semana.length !== semanasEsperadas) {
      return res.status(400).json({
        error: `Al cambiar longitud_ciclo a ${longitudCicloEfectiva} debes enviar hora_entrada_por_semana con ${semanasEsperadas} elemento(s) (o null para limpiar)`,
      });
    }
  }

  if (horas_turno !== undefined) {
    if (![12, 24].includes(Number(horas_turno))) return res.status(400).json({ error: "horas_turno debe ser 12 o 24" });
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
        return res.status(400).json({ error: `hora_entrada_por_semana debe tener ${semanasEsperadas} elemento(s) para longitud_ciclo=${longitudCicloEfectiva}` });
      }
      const formatoOk = hora_entrada_por_semana.every((h: any) => typeof h === "string" && /^\d{2}:\d{2}$/.test(h));
      if (!formatoOk) return res.status(400).json({ error: "hora_entrada_por_semana debe contener strings HH:MM" });
      updates.push(`hora_entrada_por_semana = $${p++}`); params.push(hora_entrada_por_semana);
    }
  }
  if (fecha_inicio_ciclo !== undefined) {
    updates.push(`fecha_inicio_ciclo = $${p++}`); params.push(normalizarFechaALunes(fecha_inicio_ciclo));
  }
  if (empleado_id !== undefined) { updates.push(`empleado_id = $${p++}`); params.push(empleado_id || null); }
  if (notas !== undefined) { updates.push(`notas = $${p++}`); params.push(notas || null); }
  if (slot_numero !== undefined) { updates.push(`slot_numero = $${p++}`); params.push(Number(slot_numero)); }

  if (updates.length === 0) return res.status(400).json({ error: "Sin campos a actualizar" });
  updates.push(`updated_at = NOW()`);
  params.push(id);

  // PIZ-DUP-01: si se está asignando un empleado al slot, validar que esté activo
  // y liberar cualquier titularidad previa que tenga (regla "1 titular = 1 puesto").
  // Toda la operación va dentro de una transacción + advisory lock por agente.
  const asignandoEmpleado = empleado_id !== undefined && empleado_id !== null && Number(empleado_id) > 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Resolver puesto destino del slot que estamos editando
    const { rows: slotInfo } = await client.query(
      `SELECT puesto_id FROM puesto_slots WHERE id = $1 AND activo = TRUE FOR UPDATE`,
      [id]
    );
    if (!slotInfo.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Slot no encontrado" });
    }
    const puestoDestinoId = Number(slotInfo[0].puesto_id);

    if (asignandoEmpleado) {
      const empId = Number(empleado_id);
      // Validar empleado activo
      const { rows: empCheck } = await client.query(
        `SELECT id, estado_laboral FROM employees WHERE id = $1`,
        [empId]
      );
      if (!empCheck.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Colaborador no encontrado" });
      }
      if (empCheck[0].estado_laboral !== "activo") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: `No se puede asignar como titular: el colaborador está ${empCheck[0].estado_laboral} (no activo)`
        });
      }

      // Lock + liberar titularidad previa en otros puestos (modo estricto)
      await lockTitularidadAgente(client, empId);
      const liberado = await liberarTitularidadAgente(client, empId, {
        puestoId: puestoDestinoId,
      });
      if (liberado.puestos.length > 0 || liberado.custodias.length > 0) {
        logger.info({
          employeeId: empId,
          puestoDestino: puestoDestinoId,
          slotId: id,
          liberado,
        }, "PUT /slots/:id: titularidad previa liberada (modo estricto)");
      }
    }

    const { rows } = await client.query(
      `UPDATE puesto_slots SET ${updates.join(", ")} WHERE id = $${p} AND activo = TRUE
       RETURNING id, puesto_id, slot_numero, horas_turno,
                 to_char(hora_entrada, 'HH24:MI') AS hora_entrada,
                 dias_trabajo, dias_medio_turno, longitud_ciclo,
                 hora_entrada_por_semana,
                 to_char(fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
                 empleado_id, notas, activo, updated_at`,
      params
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Slot no encontrado" });
    }
    await client.query("COMMIT");
    res.json({ slot: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "PUT /slots/:id error");
    res.status(500).json({ error: "Error al actualizar slot" });
  } finally {
    client.release();
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
