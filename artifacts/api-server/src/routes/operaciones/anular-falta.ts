import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

const router = Router();

function getRol(req: any): string {
  try { return JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; }
  catch { return ""; }
}

// POST /api/operaciones/anular-falta
// Limpia el estado "faltando" de un puesto fijo y crea un evento RRHH
// 'anulacion_falta' en estado pendiente_aprobacion. NO toca nómina ni HE.
// El snapshot del estado previo queda en metadata_json para poder revertir
// si RRHH rechaza la anulación.
router.post("/operaciones/anular-falta", async (req, res) => {
  const rol = getRol(req);
  if (!["admin", "operaciones"].includes(rol)) {
    return res.status(403).json({ error: "Solo admin u operaciones pueden anular faltas" });
  }

  const { puestoId, motivo, usuario, fecha } = req.body as {
    puestoId: number; motivo: string; usuario?: string; fecha?: string;
  };
  if (!puestoId) return res.status(400).json({ error: "puestoId es requerido" });
  const motivoTxt = String(motivo ?? "").trim();
  if (!motivoTxt) return res.status(400).json({ error: "motivo es requerido" });
  if (motivoTxt.length > 500) return res.status(400).json({ error: "motivo no puede exceder 500 caracteres" });

  const fechaDia = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? fecha
    : new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Día no cerrado
    const { rows: cierreRows } = await client.query(
      `SELECT estado FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaDia],
    );
    if (cierreRows.length && cierreRows[0].estado === "cerrado") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El día está cerrado. Reabra el día antes de anular faltas." });
    }

    const { rows: poRows } = await client.query(`
      SELECT id, nombre, cliente_id, cliente_nombre, tipo_puesto,
             estado_operativo_puesto, falta_employee_id, falta_motivo,
             falta_notas, falta_usuario
        FROM puestos_operativos
       WHERE id = $1
    `, [puestoId]);
    if (!poRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Puesto no encontrado" });
    }
    const po = poRows[0];
    if (po.tipo_puesto === "custodia") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Use el flujo de custodia para anular faltas de custodia" });
    }
    if (po.estado_operativo_puesto !== "faltando") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El puesto no está en estado 'faltando'" });
    }
    if (!po.falta_employee_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El puesto no tiene un titular faltante registrado" });
    }

    const { rows: emp } = await client.query(
      `SELECT id, nombre_completo, dpi FROM employees WHERE id = $1`,
      [po.falta_employee_id],
    );
    const empleado = emp[0] ?? null;

    const snapshot = {
      puesto_id: Number(po.id),
      fecha: fechaDia,
      falta_employee_id: Number(po.falta_employee_id),
      falta_motivo: po.falta_motivo ?? null,
      falta_notas: po.falta_notas ?? null,
      falta_usuario: po.falta_usuario ?? null,
      motivo_anulacion: motivoTxt,
    };

    // Limpiar el estado del slot (sin tocar nómina/HE/segmentos)
    await client.query(`
      UPDATE puestos_operativos
         SET estado_operativo_puesto = 'normal',
             falta_employee_id       = NULL,
             falta_motivo            = NULL,
             falta_notas             = NULL,
             falta_usuario           = NULL,
             updated_at              = NOW()
       WHERE id = $1
    `, [puestoId]);

    // Crear evento RRHH
    const { rows: evRows } = await client.query(`
      INSERT INTO eventos_rrhh
        (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha,
         cliente_nombre, puesto_nombre, generado_desde, estado,
         observaciones, usuario_generador, metadata_json)
      VALUES ($1, $2, $3, 'anulacion_falta', $4::date,
              $5, $6, 'operaciones', 'pendiente_aprobacion',
              $7, $8, $9::jsonb)
      RETURNING id
    `, [
      empleado?.id ?? null,
      empleado?.nombre_completo ?? "—",
      empleado?.dpi ?? null,
      fechaDia,
      po.cliente_nombre,
      po.nombre,
      motivoTxt,
      usuario ?? "sistema",
      JSON.stringify(snapshot),
    ]);

    await client.query("COMMIT");
    logger.info({ puestoId, eventoId: evRows[0].id, usuario }, "Falta anulada (pendiente aprobación RRHH)");
    res.json({ ok: true, eventoId: evRows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /operaciones/anular-falta error");
    res.status(500).json({ error: "Error al anular falta" });
  } finally {
    client.release();
  }
});

export default router;
