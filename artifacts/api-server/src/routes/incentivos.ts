import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const incentivosRouter = Router();

// Normaliza una fecha a ISO (YYYY-MM-DD). El pizarrón operativo envía las
// fechas en formato guatemalteco DD-MM-YYYY (fechaHoyStr/fechaVista); PostgreSQL
// no puede castear "22-06-2026" a ::date y la inserción falla con
// DateTimeParseError (22008). Acepta tanto DD-MM-YYYY como ISO y devuelve ISO.
function toISODate(v: unknown): string {
  const s = String(v ?? "").trim();
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return s.slice(0, 10);
}

// ─── GET /api/incentivos ──────────────────────────────────────────────────────
// Lista incentivos cash con filtros opcionales
// Query params: fecha, fechaDesde, fechaHasta, employeeId, clienteId, estado, puestoId
incentivosRouter.get("/incentivos", async (req, res) => {
  const { fecha, fechaDesde, fechaHasta, employeeId, clienteId, estado, puestoId } = req.query;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (fecha) {
      conditions.push(`ic.fecha = $${params.length + 1}`);
      params.push(fecha);
    } else {
      if (fechaDesde) {
        conditions.push(`ic.fecha >= $${params.length + 1}`);
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        conditions.push(`ic.fecha <= $${params.length + 1}`);
        params.push(fechaHasta);
      }
    }
    if (employeeId) {
      conditions.push(`ic.employee_id = $${params.length + 1}`);
      params.push(Number(employeeId));
    }
    if (clienteId) {
      conditions.push(`ic.cliente_id = $${params.length + 1}`);
      params.push(Number(clienteId));
    }
    if (puestoId) {
      conditions.push(`ic.puesto_id = $${params.length + 1}`);
      params.push(Number(puestoId));
    }
    if (estado) {
      conditions.push(`ic.estado = $${params.length + 1}`);
      params.push(estado);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(`
      SELECT
        ic.*,
        e.nombre_completo AS employee_nombre_join,
        c.nombre          AS cliente_nombre_join,
        cs.nombre         AS sede_nombre_join,
        po.nombre         AS puesto_nombre_join
      FROM incentivos_cash_cobertura ic
      LEFT JOIN employees              e  ON e.id  = ic.employee_id
      LEFT JOIN clients                c  ON c.id  = ic.cliente_id
      LEFT JOIN client_sedes           cs ON cs.id = ic.sede_id
      LEFT JOIN puestos_operativos     po ON po.id = ic.puesto_id
      ${where}
      ORDER BY ic.fecha DESC, ic.created_at DESC
    `, params);

    const resumen = {
      total:     rows.length,
      pendiente: rows.filter((r: any) => r.estado === "pendiente").length,
      pagado:    rows.filter((r: any) => r.estado === "pagado").length,
      auditado:  rows.filter((r: any) => r.estado === "auditado").length,
      monto_total: rows.reduce((s: number, r: any) => s + parseFloat(r.monto ?? 0), 0).toFixed(2),
    };

    res.json({ incentivos: rows, resumen });
  } catch (err) {
    logger.error({ err }, "GET /incentivos error");
    res.status(500).json({ error: "Error al obtener incentivos" });
  }
});

// ─── POST /api/incentivos ─────────────────────────────────────────────────────
// Registra un nuevo incentivo cash por cobertura
incentivosRouter.post("/incentivos", async (req, res) => {
  const {
    employeeId, employeeNombre, fecha,
    clienteId, clienteNombre, sedeId,
    puestoId, puestoNombre, segmentoId,
    tipo = "relevo_cash", monto, motivo,
    autorizadoPor, pagadoPor,
    metodoPago = "efectivo", estado = "pendiente", observaciones,
  } = req.body;

  if (!employeeId || !employeeNombre || !fecha || !monto) {
    return res.status(400).json({ error: "employeeId, employeeNombre, fecha y monto son requeridos" });
  }
  const fechaISO = toISODate(fecha);
  if (isNaN(Number(monto)) || Number(monto) <= 0) {
    return res.status(400).json({ error: "monto debe ser un número positivo" });
  }

  const TIPOS_VALIDOS = ["relevo_cash", "bono_cobertura", "motivacion_cobertura", "he_efectivo"];
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: `tipo debe ser: ${TIPOS_VALIDOS.join(" | ")}` });
  }
  const ESTADOS_VALIDOS = ["pendiente", "pagado", "auditado", "cancelado"];
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${ESTADOS_VALIDOS.join(" | ")}` });
  }

  try {
    if (tipo === "he_efectivo") {
      const { rows: dup } = await pool.query(`
        SELECT id FROM incentivos_cash_cobertura
        WHERE employee_id = $1 AND fecha = $2::date AND tipo = 'he_efectivo'
          AND puesto_id = $3
        LIMIT 1
      `, [Number(employeeId), fechaISO, puestoId ? Number(puestoId) : null]);
      if (dup.length > 0) {
        return res.status(409).json({ error: "Ya existe un pago HE en efectivo para este agente/fecha/puesto" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const { rows } = await client.query(`
          INSERT INTO incentivos_cash_cobertura
            (employee_id, employee_nombre, fecha,
             cliente_id, cliente_nombre, sede_id,
             puesto_id, puesto_nombre, segmento_id,
             tipo, monto, motivo,
             autorizado_por, pagado_por, metodo_pago, estado, observaciones)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          RETURNING *
        `, [
          Number(employeeId), employeeNombre, fechaISO,
          clienteId ? Number(clienteId) : null, clienteNombre ?? null,
          sedeId ? Number(sedeId) : null,
          puestoId ? Number(puestoId) : null, puestoNombre ?? null,
          segmentoId ? Number(segmentoId) : null,
          tipo, Number(monto), motivo ?? null,
          autorizadoPor ?? null, pagadoPor ?? null,
          metodoPago, estado, observaciones ?? null,
        ]);

        await client.query(`
          UPDATE novedades_nomina_diarias SET
            impacto_nomina = 'pagado_efectivo',
            requiere_revision_rrhh = FALSE,
            observaciones = COALESCE(observaciones, '') || ' | HE pagadas en efectivo Q' || $3::text,
            updated_at = NOW()
          WHERE fecha = $1::date AND employee_id = $2
            AND impacto_nomina = 'pendiente'
        `, [fechaISO, Number(employeeId), Number(monto).toFixed(2)]);

        await client.query(`
          UPDATE eventos_rrhh SET
            estado = 'pagado_efectivo',
            tipo_resolucion = 'he_pagado_efectivo',
            rrhh_resuelto_por = $3,
            rrhh_resuelto_at = NOW(),
            updated_at = NOW()
          WHERE employee_id = $1
            AND fecha::date = $2::date
            AND tipo_evento = 'horas_extra'
            AND estado = 'pendiente_aprobacion'
        `, [Number(employeeId), fechaISO, autorizadoPor ?? 'sistema']);

        await client.query("COMMIT");
        logger.info({ incentivo: rows[0], employeeId, fecha }, "HE pagado en efectivo (tx completa) — excluido de planilla");
        res.status(201).json({ ok: true, incentivo: rows[0] });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } else {
      const { rows } = await pool.query(`
        INSERT INTO incentivos_cash_cobertura
          (employee_id, employee_nombre, fecha,
           cliente_id, cliente_nombre, sede_id,
           puesto_id, puesto_nombre, segmento_id,
           tipo, monto, motivo,
           autorizado_por, pagado_por, metodo_pago, estado, observaciones)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *
      `, [
        Number(employeeId), employeeNombre, fechaISO,
        clienteId ? Number(clienteId) : null, clienteNombre ?? null,
        sedeId ? Number(sedeId) : null,
        puestoId ? Number(puestoId) : null, puestoNombre ?? null,
        segmentoId ? Number(segmentoId) : null,
        tipo, Number(monto), motivo ?? null,
        autorizadoPor ?? null, pagadoPor ?? null,
        metodoPago, estado, observaciones ?? null,
      ]);
      logger.info({ incentivo: rows[0] }, "Incentivo cash registrado");
      res.status(201).json({ ok: true, incentivo: rows[0] });
    }
  } catch (err) {
    logger.error({ err }, "POST /incentivos error");
    res.status(500).json({ error: "Error al registrar incentivo" });
  }
});

// ─── PATCH /api/incentivos/:id ────────────────────────────────────────────────
// Actualiza estado, pagadoPor u observaciones de un incentivo
incentivosRouter.patch("/incentivos/:id", async (req, res) => {
  const { id } = req.params;
  const { estado, pagadoPor, autorizadoPor, observaciones, monto, motivo } = req.body;

  const ESTADOS_VALIDOS = ["pendiente", "pagado", "auditado", "cancelado"];
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `estado inválido` });
  }

  try {
    const { rows } = await pool.query(`
      UPDATE incentivos_cash_cobertura SET
        estado         = COALESCE($1, estado),
        pagado_por     = COALESCE($2, pagado_por),
        autorizado_por = COALESCE($3, autorizado_por),
        observaciones  = COALESCE($4, observaciones),
        monto          = COALESCE($5, monto),
        motivo         = COALESCE($6, motivo),
        updated_at     = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      estado ?? null, pagadoPor ?? null, autorizadoPor ?? null,
      observaciones ?? null,
      monto != null ? Number(monto) : null,
      motivo ?? null,
      Number(id),
    ]);

    if (rows.length === 0) return res.status(404).json({ error: "Incentivo no encontrado" });
    res.json({ ok: true, incentivo: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /incentivos/:id error");
    res.status(500).json({ error: "Error al actualizar incentivo" });
  }
});

// ─── DELETE /api/incentivos/:id ───────────────────────────────────────────────
incentivosRouter.delete("/incentivos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM incentivos_cash_cobertura WHERE id = $1",
      [Number(id)]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Incentivo no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /incentivos/:id error");
    res.status(500).json({ error: "Error al eliminar incentivo" });
  }
});

export { incentivosRouter };
