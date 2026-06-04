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

    // Anular también el evento de falta en eventos_rrhh (si ya existe, p.ej. en un
    // día reabierto donde el cierre lo generó). El pizarrón lee AMBAS fuentes (el
    // slot y este evento), por lo que sin esto el agente seguiría saliendo "faltando".
    // En cascada anulamos su HE par (la extra de quien cubrió), igual que /rrhh/eventos/:id/anular.
    // Guardamos el estado previo de cada evento para poder reactivarlo si fue por error.
    const eventosFaltaAnulados: Array<{ id: number; estado_anterior: string; par_id: number | null; par_estado_anterior: string | null }> = [];
    const { rows: faltaEvs } = await client.query(`
      SELECT id, estado, evento_par_id
        FROM eventos_rrhh
       WHERE employee_id  = $1
         AND fecha::date   = $2::date
         AND tipo_evento   = 'falta'
         AND estado       != 'anulado'
    `, [po.falta_employee_id, fechaDia]);
    for (const ev of faltaEvs) {
      await client.query(`
        UPDATE eventos_rrhh
           SET estado = 'anulado', estado_anterior = $1, anulado_por = $2,
               anulado_at = NOW(), motivo_anulacion = $3, updated_at = NOW()
         WHERE id = $4
      `, [ev.estado, usuario ?? "sistema", motivoTxt, ev.id]);
      let parEstadoAnterior: string | null = null;
      if (ev.evento_par_id) {
        const { rows: parRows } = await client.query(
          `SELECT id, estado FROM eventos_rrhh WHERE id = $1`, [ev.evento_par_id],
        );
        if (parRows.length && parRows[0].estado !== "anulado") {
          parEstadoAnterior = parRows[0].estado;
          await client.query(`
            UPDATE eventos_rrhh
               SET estado = 'anulado', estado_anterior = $1, anulado_por = $2,
                   anulado_at = NOW(), motivo_anulacion = $3, updated_at = NOW()
             WHERE id = $4
          `, [parRows[0].estado, usuario ?? "sistema", motivoTxt, ev.evento_par_id]);
        }
      }
      eventosFaltaAnulados.push({
        id: Number(ev.id),
        estado_anterior: ev.estado,
        // Solo registramos el par si ESTA operación lo anuló (parEstadoAnterior != null).
        // Si el par ya estaba anulado de antes, lo dejamos como null para no reactivarlo por error.
        par_id: parEstadoAnterior !== null ? Number(ev.evento_par_id) : null,
        par_estado_anterior: parEstadoAnterior,
      });
    }

    const snapshot = {
      puesto_id: Number(po.id),
      fecha: fechaDia,
      falta_employee_id: Number(po.falta_employee_id),
      falta_motivo: po.falta_motivo ?? null,
      falta_notas: po.falta_notas ?? null,
      falta_usuario: po.falta_usuario ?? null,
      motivo_anulacion: motivoTxt,
      eventos_falta_anulados: eventosFaltaAnulados,
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

// POST /api/operaciones/reactivar-falta
// Deshace una anulación de falta hecha por error: regresa el slot a 'faltando',
// reactiva el evento de falta y su HE par (la extra de quien cubrió) y marca la
// solicitud de anulación como 'revertido'. Toca las MISMAS dos fuentes que anular,
// para que el pizarrón quede consistente (el agente vuelve a "faltando").
router.post("/operaciones/reactivar-falta", async (req, res) => {
  const rol = getRol(req);
  if (!["admin", "operaciones"].includes(rol)) {
    return res.status(403).json({ error: "Solo admin u operaciones pueden reactivar faltas" });
  }

  const { puestoId, motivo, usuario, fecha } = req.body as {
    puestoId: number; motivo?: string; usuario?: string; fecha?: string;
  };
  if (!puestoId) return res.status(400).json({ error: "puestoId es requerido" });
  const motivoTxt = String(motivo ?? "").trim().slice(0, 500) || null;

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
      return res.status(409).json({ error: "El día está cerrado. Reabra el día antes de reactivar faltas." });
    }

    // Buscar la anulación pendiente más reciente de ese puesto + fecha
    const { rows: anulRows } = await client.query(`
      SELECT id, metadata_json
        FROM eventos_rrhh
       WHERE tipo_evento = 'anulacion_falta'
         AND estado      = 'pendiente_aprobacion'
         AND fecha::date  = $1::date
         AND (metadata_json->>'puesto_id')::int = $2
       ORDER BY id DESC
       LIMIT 1
    `, [fechaDia, puestoId]);
    if (!anulRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No hay una anulación de falta para reactivar en este puesto" });
    }
    const anul = anulRows[0];
    const meta = typeof anul.metadata_json === "string"
      ? JSON.parse(anul.metadata_json)
      : (anul.metadata_json ?? {});

    if (!meta.falta_employee_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La anulación no tiene datos de la falta para restaurar" });
    }

    // Restaurar el slot a 'faltando' con los datos originales
    await client.query(`
      UPDATE puestos_operativos
         SET estado_operativo_puesto = 'faltando',
             falta_employee_id       = $2,
             falta_motivo            = $3,
             falta_notas             = $4,
             falta_usuario           = $5,
             updated_at              = NOW()
       WHERE id = $1
    `, [
      puestoId,
      meta.falta_employee_id,
      meta.falta_motivo ?? null,
      meta.falta_notas ?? null,
      meta.falta_usuario ?? null,
    ]);

    // Reactivar los eventos de falta + HE par que se habían anulado
    const evs = Array.isArray(meta.eventos_falta_anulados) ? meta.eventos_falta_anulados : [];
    for (const e of evs) {
      await client.query(`
        UPDATE eventos_rrhh
           SET estado = $1, estado_anterior = NULL, anulado_por = NULL,
               anulado_at = NULL, motivo_anulacion = NULL, updated_at = NOW()
         WHERE id = $2 AND estado = 'anulado'
      `, [e.estado_anterior ?? "pendiente_aprobacion", e.id]);
      if (e.par_id) {
        await client.query(`
          UPDATE eventos_rrhh
             SET estado = $1, estado_anterior = NULL, anulado_por = NULL,
                 anulado_at = NULL, motivo_anulacion = NULL, updated_at = NOW()
           WHERE id = $2 AND estado = 'anulado'
        `, [e.par_estado_anterior ?? "pendiente_aprobacion", e.par_id]);
      }
    }

    // Marcar la solicitud de anulación como revertida (deja de aparecer "Reactivar")
    await client.query(`
      UPDATE eventos_rrhh
         SET estado        = 'revertido',
             observaciones = COALESCE(observaciones, '') ||
                             ' [Reactivado por ' || $2 ||
                             COALESCE(': ' || $3, '') || ']',
             updated_at    = NOW()
       WHERE id = $1
    `, [anul.id, usuario ?? "sistema", motivoTxt]);

    await client.query("COMMIT");
    logger.info({ puestoId, anulacionId: anul.id, usuario }, "Falta reactivada (anulación revertida)");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /operaciones/reactivar-falta error");
    res.status(500).json({ error: "Error al reactivar falta" });
  } finally {
    client.release();
  }
});

export default router;
