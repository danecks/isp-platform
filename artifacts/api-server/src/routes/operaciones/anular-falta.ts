import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

const router = Router();

function getRol(req: any): string {
  try { return JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; }
  catch { return ""; }
}

type DBClient = { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }> };

// Restaura simétricamente lo que anular-falta revirtió (nómina del titular, HE de
// cobertura neutralizadas, segmento de ausencia y alertas RRHH), usando el snapshot
// guardado en metadata_json. Lo usan reactivar-falta y el rechazo de RRHH.
export async function restaurarRollbackFalta(db: DBClient, meta: any): Promise<void> {
  if (!meta) return;

  // (1) Restaurar la novedad de descuento del titular.
  const prev = meta.nov_titular_prev;
  if (prev && meta.falta_employee_id && meta.fecha) {
    await db.query(`
      UPDATE novedades_nomina_diarias
         SET falta = $3, suspension = $4, descuento_dia = $5, dias_descuento = $6,
             impacto_nomina = $7, updated_at = NOW()
       WHERE fecha = $1::date AND employee_id = $2
         AND COALESCE(impacto_nomina, 'pendiente') NOT IN ('aprobado_rrhh','rechazado_rrhh','pagado_efectivo')
    `, [
      meta.fecha, meta.falta_employee_id,
      prev.falta ?? false, prev.suspension ?? false, prev.descuento_dia ?? false,
      prev.dias_descuento ?? 0, prev.impacto_nomina ?? 'pendiente',
    ]);
  }

  // (2) Reactivar las HE de cobertura neutralizadas (genera_horas_extra).
  const segHE = Array.isArray(meta.segmentos_he_neutralizados) ? meta.segmentos_he_neutralizados : [];
  if (segHE.length) {
    await db.query(
      `UPDATE cobertura_segmentos SET genera_horas_extra = TRUE, updated_at = NOW() WHERE id = ANY($1::int[])`,
      [segHE.map((x: any) => Number(x))],
    );
  }

  // (3) Re-insertar el segmento de ausencia sin cubrir borrado.
  const segAus = Array.isArray(meta.segmentos_ausencia) ? meta.segmentos_ausencia : [];
  for (const s of segAus) {
    // Idempotente por (fecha, puesto_id, tipo_cobertura): el UNIQUE no dedup cuando
    // employee_id es NULL, así que se evita la fila duplicada con NOT EXISTS.
    await db.query(`
      INSERT INTO cobertura_segmentos
        (fecha, puesto_id, client_id, sede_id, employee_id, empleado_nombre,
         tipo_cobertura, hora_inicio, hora_fin, horas_calculadas, motivo,
         fue_en_dia_descanso, genera_horas_extra, horas_extra_calculadas,
         observaciones, usuario_registro)
      SELECT $1::date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
       WHERE NOT EXISTS (
         SELECT 1 FROM cobertura_segmentos
          WHERE fecha = $1::date AND puesto_id = $2 AND tipo_cobertura = $7
            AND COALESCE(employee_id, -1) = COALESCE($5::int, -1)
       )
    `, [
      s.fecha, s.puesto_id, s.client_id ?? null, s.sede_id ?? null, s.employee_id ?? null,
      s.empleado_nombre ?? null, s.tipo_cobertura, s.hora_inicio ?? null, s.hora_fin ?? null,
      s.horas_calculadas ?? null, s.motivo ?? null, s.fue_en_dia_descanso ?? false,
      s.genera_horas_extra ?? false, s.horas_extra_calculadas ?? null,
      s.observaciones ?? null, s.usuario_registro ?? null,
    ]);
  }

  // (4) Restaurar el estado previo de las alertas RRHH.
  const alertas = Array.isArray(meta.alertas_resueltas) ? meta.alertas_resueltas : [];
  for (const a of alertas) {
    await db.query(
      `UPDATE rrhh_alertas SET estado = $2, resuelta_at = NULL WHERE id = $1`,
      [Number(a.id), a.estado_anterior ?? 'pendiente'],
    );
  }
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
    const eventosFaltaAnulados: Array<{ id: number; estado_anterior: string; pares: Array<{ id: number; estado_anterior: string }> }> = [];
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
      // Anular TODAS las HE enlazadas (1:N) + el par legacy 1:1, guardando el estado
      // previo de SOLO las que esta operación anuló, para poder reactivarlas luego.
      const { rows: parRows } = await client.query(`
        SELECT id, estado FROM eventos_rrhh
         WHERE tipo_evento = 'horas_extra' AND estado != 'anulado'
           AND (evento_par_id = $1 OR id = $2)
      `, [ev.id, ev.evento_par_id ?? -1]);
      const pares: Array<{ id: number; estado_anterior: string }> = [];
      for (const par of parRows) {
        await client.query(`
          UPDATE eventos_rrhh
             SET estado = 'anulado', estado_anterior = $1, anulado_por = $2,
                 anulado_at = NOW(), motivo_anulacion = $3, updated_at = NOW()
           WHERE id = $4
        `, [par.estado, usuario ?? "sistema", motivoTxt, par.id]);
        pares.push({ id: Number(par.id), estado_anterior: par.estado });
      }
      eventosFaltaAnulados.push({
        id: Number(ev.id),
        estado_anterior: ev.estado,
        pares,
      });
    }

    // ── ROLLBACK COMPLETO: nómina + segmentos + alertas ─────────────────────────
    // Antes solo se tocaba el slot y los eventos RRHH; el descuento del titular, las
    // HE de cobertura y la alerta quedaban "pegados", e incluso el cierre regeneraba
    // una HE nueva (genera_horas_extra seguía TRUE) → HE duplicadas. Aquí se revierte
    // todo y se guarda el estado previo en el snapshot para poder restaurarlo.
    const titularId = Number(po.falta_employee_id);

    // (1) Revertir la novedad de descuento del titular (si RRHH no la decidió ya).
    const { rows: novPrevRows } = await client.query(`
      SELECT falta, suspension, descuento_dia, dias_descuento, impacto_nomina
        FROM novedades_nomina_diarias
       WHERE fecha = $1::date AND employee_id = $2
    `, [fechaDia, titularId]);
    const novTitularPrev = novPrevRows[0] ?? null;
    await client.query(`
      UPDATE novedades_nomina_diarias
         SET falta = FALSE, suspension = FALSE, descuento_dia = FALSE,
             dias_descuento = 0, impacto_nomina = 'pendiente', updated_at = NOW()
       WHERE fecha = $1::date AND employee_id = $2
         AND COALESCE(impacto_nomina, 'pendiente') NOT IN ('aprobado_rrhh','rechazado_rrhh','pagado_efectivo')
    `, [fechaDia, titularId]);

    // (2) Neutralizar en origen las HE de cobertura de este puesto+fecha, para que el
    // cierre NO regenere una HE nueva (causa de las HE duplicadas). Reversible.
    const { rows: segHE } = await client.query(`
      SELECT id FROM cobertura_segmentos
       WHERE fecha = $1::date AND puesto_id = $2 AND genera_horas_extra = TRUE
    `, [fechaDia, puestoId]);
    const segmentosHENeutralizados = segHE.map((s: any) => Number(s.id));
    if (segmentosHENeutralizados.length) {
      await client.query(
        `UPDATE cobertura_segmentos SET genera_horas_extra = FALSE, updated_at = NOW() WHERE id = ANY($1::int[])`,
        [segmentosHENeutralizados],
      );
    }

    // (3) Quitar el segmento de ausencia sin cubrir del titular (si existe). Se guarda
    // la fila completa para poder re-insertarla en reactivar/rechazo.
    const { rows: segAus } = await client.query(`
      SELECT id, fecha, puesto_id, client_id, sede_id, employee_id, empleado_nombre,
             tipo_cobertura, hora_inicio, hora_fin, horas_calculadas, motivo,
             fue_en_dia_descanso, genera_horas_extra, horas_extra_calculadas,
             observaciones, usuario_registro
        FROM cobertura_segmentos
       WHERE fecha = $1::date AND puesto_id = $2 AND tipo_cobertura = 'ausencia_sin_cubrir'
    `, [fechaDia, puestoId]);
    const segmentosAusencia = segAus;
    if (segmentosAusencia.length) {
      await client.query(
        `DELETE FROM cobertura_segmentos WHERE id = ANY($1::int[])`,
        [segmentosAusencia.map((s: any) => Number(s.id))],
      );
    }

    // (4) Resolver las alertas RRHH generadas por esta falta (puesto+fecha). Reversible.
    const { rows: alertasPrev } = await client.query(`
      SELECT id, estado FROM rrhh_alertas
       WHERE puesto_id = $1 AND fecha_evento::date = $2::date
         AND tipo IN ('faltante_sin_cubrir','horas_extra_pendiente')
         AND estado NOT IN ('anulado','resuelta')
    `, [puestoId, fechaDia]);
    const alertasResueltas = alertasPrev.map((a: any) => ({ id: Number(a.id), estado_anterior: a.estado }));
    if (alertasResueltas.length) {
      await client.query(
        `UPDATE rrhh_alertas SET estado = 'resuelta', resuelta_at = NOW() WHERE id = ANY($1::int[])`,
        [alertasResueltas.map((a) => a.id)],
      );
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
      nov_titular_prev: novTitularPrev,
      segmentos_he_neutralizados: segmentosHENeutralizados,
      segmentos_ausencia: segmentosAusencia,
      alertas_resueltas: alertasResueltas,
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
      // Reactivar TODAS las HE par (1:N). Back-compat con snapshots viejos (par_id único).
      const pares = Array.isArray(e.pares)
        ? e.pares
        : (e.par_id ? [{ id: e.par_id, estado_anterior: e.par_estado_anterior }] : []);
      for (const p of pares) {
        await client.query(`
          UPDATE eventos_rrhh
             SET estado = $1, estado_anterior = NULL, anulado_por = NULL,
                 anulado_at = NULL, motivo_anulacion = NULL, updated_at = NOW()
           WHERE id = $2 AND estado = 'anulado'
        `, [p.estado_anterior ?? "pendiente_aprobacion", p.id]);
      }
    }

    // Restaurar simétricamente nómina + segmentos + alertas que anular revirtió.
    await restaurarRollbackFalta(client, meta);

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
