import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

// CUST-FASE1: planificación de demanda por cliente.
// - Excepciones puntuales (CRUD) sobre la fuerza semanal base
// - Reporte agregado día x día (base + excepciones aplicadas) para contabilidad
export const custodiasPlanificacionRouter = Router();

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Excepciones ─────────────────────────────────────────────────────────────
custodiasPlanificacionRouter.get("/custodias/cliente/:id/excepciones", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });
    const { rows } = await pool.query(
      `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, cantidad, motivo
         FROM custodia_excepciones
        WHERE cliente_id = $1
        ORDER BY fecha ASC`,
      [clienteId]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[Custodias/excepciones] GET");
    res.status(500).json({ error: "Error al cargar excepciones" });
  }
});

custodiasPlanificacionRouter.post("/custodias/cliente/:id/excepciones", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });
    const { fecha, cantidad, motivo } = req.body as { fecha: string; cantidad: number; motivo?: string };
    if (!fecha || !FECHA_RE.test(String(fecha).slice(0, 10))) {
      return res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    }
    const cant = Number(cantidad);
    if (!Number.isFinite(cant) || cant < 0) {
      return res.status(400).json({ error: "Cantidad inválida" });
    }
    const ins = await pool.query(
      `INSERT INTO custodia_excepciones (cliente_id, fecha, cantidad, motivo)
       VALUES ($1, $2::date, $3, $4)
       ON CONFLICT (cliente_id, fecha)
       DO UPDATE SET cantidad = EXCLUDED.cantidad,
                     motivo   = EXCLUDED.motivo,
                     updated_at = NOW()
       RETURNING id`,
      [clienteId, String(fecha).slice(0, 10), Math.floor(cant), motivo || null]
    );
    res.json({ ok: true, id: ins.rows[0].id });
  } catch (err) {
    logger.error({ err }, "[Custodias/excepciones] POST");
    res.status(500).json({ error: "Error al guardar excepción" });
  }
});

custodiasPlanificacionRouter.put("/custodias/cliente/:id/excepciones/:excepcionId", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const excepcionId = parseInt(req.params.excepcionId);
    if (!clienteId || !excepcionId) return res.status(400).json({ error: "ID inválido" });
    const { fecha, cantidad, motivo } = req.body as { fecha?: string; cantidad?: number; motivo?: string };
    if (fecha && !FECHA_RE.test(String(fecha).slice(0, 10))) {
      return res.status(400).json({ error: "Fecha inválida" });
    }
    const cant = cantidad === undefined ? undefined : Number(cantidad);
    if (cant !== undefined && (!Number.isFinite(cant) || cant < 0)) {
      return res.status(400).json({ error: "Cantidad inválida" });
    }
    const { rowCount } = await pool.query(
      `UPDATE custodia_excepciones
          SET fecha    = COALESCE($1::date, fecha),
              cantidad = COALESCE($2, cantidad),
              motivo   = $3,
              updated_at = NOW()
        WHERE id = $4 AND cliente_id = $5`,
      [fecha ? String(fecha).slice(0, 10) : null, cant ?? null, motivo ?? null, excepcionId, clienteId]
    );
    if (!rowCount) return res.status(404).json({ error: "Excepción no encontrada" });
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Ya existe una excepción para esa fecha" });
    }
    logger.error({ err }, "[Custodias/excepciones] PUT");
    res.status(500).json({ error: "Error al actualizar excepción" });
  }
});

custodiasPlanificacionRouter.delete("/custodias/cliente/:id/excepciones/:excepcionId", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const excepcionId = parseInt(req.params.excepcionId);
    if (!clienteId || !excepcionId) return res.status(400).json({ error: "ID inválido" });
    const { rowCount } = await pool.query(
      `DELETE FROM custodia_excepciones WHERE id = $1 AND cliente_id = $2`,
      [excepcionId, clienteId]
    );
    if (!rowCount) return res.status(404).json({ error: "Excepción no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Custodias/excepciones] DELETE");
    res.status(500).json({ error: "Error al borrar excepción" });
  }
});

// ── Reporte de demanda histórica ────────────────────────────────────────────
// GET /custodias/reporte-demanda?clienteId=…&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Devuelve un array con una fila por día: { fecha, diaSemana, base, excepcion,
// efectiva, motivo }. La cantidad efectiva = excepcion si existe, si no base.
custodiasPlanificacionRouter.get("/custodias/reporte-demanda", async (req, res) => {
  try {
    const clienteId = parseInt((req.query.clienteId as string) || "");
    const desde = String(req.query.desde || "").slice(0, 10);
    const hasta = String(req.query.hasta || "").slice(0, 10);
    if (!clienteId) return res.status(400).json({ error: "Falta clienteId" });
    if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta)) {
      return res.status(400).json({ error: "Rango de fechas inválido" });
    }
    if (desde > hasta) return res.status(400).json({ error: "'desde' debe ser <= 'hasta'" });

    // Tope de 400 días para evitar abusos.
    const MS_DIA = 86400000;
    const [hy, hm, hd] = hasta.split("-").map(Number);
    const [dy0, dm0, dd0] = desde.split("-").map(Number);
    const dias = Math.floor((Date.UTC(hy, hm - 1, hd) - Date.UTC(dy0, dm0 - 1, dd0)) / MS_DIA) + 1;
    if (dias > 400) return res.status(400).json({ error: "Rango demasiado grande (máx 400 días)" });

    const [{ rows: cliRows }, { rows: fuerzaRows }, { rows: excRows }] = await Promise.all([
      pool.query(`SELECT id, nombre, nombre_comercial FROM clients WHERE id = $1`, [clienteId]),
      pool.query(`SELECT dia_semana, cantidad_agentes FROM custodia_fuerza_semanal WHERE cliente_id = $1`, [clienteId]),
      pool.query(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, cantidad, motivo
           FROM custodia_excepciones
          WHERE cliente_id = $1 AND fecha BETWEEN $2::date AND $3::date`,
        [clienteId, desde, hasta]
      ),
    ]);

    if (!cliRows.length) return res.status(404).json({ error: "Cliente no encontrado" });

    const base: Record<number, number> = {};
    for (let i = 0; i <= 6; i++) base[i] = 0;
    for (const r of fuerzaRows) base[Number(r.dia_semana)] = Number(r.cantidad_agentes);

    const excMap = new Map<string, { cantidad: number; motivo: string | null }>();
    for (const r of excRows) excMap.set(r.fecha, { cantidad: Number(r.cantidad), motivo: r.motivo });

    const filas: Array<{
      fecha: string; diaSemana: number; base: number;
      excepcion: number | null; efectiva: number; motivo: string | null;
    }> = [];
    const [dy, dm, dd] = desde.split("-").map(Number);
    let total = 0;
    for (let i = 0; i < dias; i++) {
      const ts = Date.UTC(dy, dm - 1, dd) + i * MS_DIA;
      const d = new Date(ts);
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
      const baseDia = base[dow] ?? 0;
      const exc = excMap.get(iso);
      const efectiva = exc ? exc.cantidad : baseDia;
      total += efectiva;
      filas.push({
        fecha: iso,
        diaSemana: dow,
        base: baseDia,
        excepcion: exc ? exc.cantidad : null,
        efectiva,
        motivo: exc?.motivo ?? null,
      });
    }

    const cli = cliRows[0];
    res.json({
      clienteId,
      clienteNombre: cli.nombre_comercial || cli.nombre,
      desde,
      hasta,
      total,
      filas,
    });
  } catch (err) {
    logger.error({ err }, "[Custodias/reporte-demanda]");
    res.status(500).json({ error: "Error al generar reporte" });
  }
});

// Listar clientes con tipo_servicio custodia/mixto, para el selector del reporte.
custodiasPlanificacionRouter.get("/custodias/clientes-planificables", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, COALESCE(nombre_comercial, nombre) AS nombre
         FROM clients
        WHERE tipo_servicio IN ('custodia', 'mixto')
          AND estado = 'activo'
        ORDER BY 2`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[Custodias/clientes-planificables]");
    res.status(500).json({ error: "Error al listar clientes" });
  }
});
