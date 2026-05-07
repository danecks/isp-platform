import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// Fase B — Endpoints públicos de la PWA del supervisor.
// Auth: device_uuid + device_token (mismo patrón que agente-fichaje) + qr_token del carnet.
// Vínculo TOFU: el device se asocia al primer supervisor que use su carnet en él;
// cualquier QR distinto luego es rechazado. Esto bloquea impersonación entre supervisores.
// Todas las credenciales viajan en BODY (POST) para no dejar tokens en URL/logs/proxies.

export const agenteSupervisionRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function hashToken(t: string): string {
  return crypto.createHash("sha256").update(t).digest("hex");
}

interface AuthCtx {
  device_id: number;
  employee_id: number;
  supervisor_nombre: string;
  bound_now: boolean;
}

async function autenticar(
  device_uuid: string,
  device_token: string,
  qr_token: string
): Promise<{ ctx?: AuthCtx; status?: number; error?: string }> {
  if (!device_uuid || !device_token || !qr_token) {
    return { status: 400, error: "device_uuid, device_token y qr_token requeridos" };
  }
  if (!UUID_RE.test(device_uuid)) return { status: 403, error: "dispositivo_no_autorizado" };

  const { rows: devRows } = await pool.query(
    `SELECT id, device_token_hash, activo, supervisor_employee_id
       FROM supervisor_devices WHERE device_uuid = $1`,
    [device_uuid]
  );
  const dev = devRows[0];
  if (!dev || !dev.activo) return { status: 403, error: "dispositivo_no_autorizado" };
  if (dev.device_token_hash !== hashToken(device_token)) {
    return { status: 403, error: "token_incorrecto" };
  }

  const { rows: empRows } = await pool.query(
    `SELECT e.id, e.nombre_completo, e.tipo_personal
       FROM agente_qr_tokens aqt
       JOIN employees e ON e.id = aqt.employee_id
      WHERE aqt.qr_token = $1 AND aqt.activo = TRUE`,
    [qr_token]
  );
  const emp = empRows[0];
  if (!emp) return { status: 403, error: "carnet_invalido" };
  if (emp.tipo_personal !== "supervisor") return { status: 403, error: "no_es_supervisor" };

  // Vínculo TOFU. Primer uso: amarra device.supervisor_employee_id de forma atómica
  // (UPDATE ... WHERE supervisor_employee_id IS NULL). Si otro proceso ya lo ató antes,
  // re-leemos y validamos. Después de eso, cualquier mismatch → 403.
  let boundId: number | null = dev.supervisor_employee_id;
  let boundNow = false;
  if (boundId == null) {
    const r = await pool.query(
      `UPDATE supervisor_devices
          SET supervisor_employee_id = $2
        WHERE id = $1 AND supervisor_employee_id IS NULL
       RETURNING supervisor_employee_id`,
      [dev.id, emp.id]
    );
    if (r.rowCount && r.rows[0]) {
      boundId = r.rows[0].supervisor_employee_id;
      boundNow = true;
    } else {
      const re = await pool.query(
        `SELECT supervisor_employee_id FROM supervisor_devices WHERE id = $1`,
        [dev.id]
      );
      boundId = re.rows[0]?.supervisor_employee_id ?? null;
    }
  }
  if (boundId !== emp.id) {
    logger.warn(
      { device_id: dev.id, intento: emp.id, dueño: boundId },
      "agente-supervision: intento de uso con carnet ajeno"
    );
    return { status: 403, error: "carnet_no_corresponde_a_este_dispositivo" };
  }

  await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [dev.id]);
  return { ctx: { device_id: dev.id, employee_id: emp.id, supervisor_nombre: emp.nombre_completo, bound_now: boundNow } };
}

const SELECT_AGENDA = `
  SELECT
    sp.id, sp.cliente_id, sp.puesto_id, sp.zona_id,
    to_char(sp.fecha_planificada, 'YYYY-MM-DD') AS fecha_planificada,
    to_char(sp.ventana_inicio, 'HH24:MI') AS ventana_inicio,
    to_char(sp.ventana_fin,    'HH24:MI') AS ventana_fin,
    sp.tipo, sp.prioridad, sp.estado, sp.instrucciones, sp.observaciones,
    sp.bono_monto, sp.iniciada_at, sp.completada_at,
    c.nombre  AS cliente_nombre,
    po.nombre AS puesto_nombre,
    po.direccion AS puesto_direccion,
    z.nombre  AS zona_nombre
  FROM supervision_visitas_programadas sp
  LEFT JOIN clients c             ON c.id  = sp.cliente_id
  LEFT JOIN puestos_operativos po ON po.id = sp.puesto_id
  LEFT JOIN operational_zones z   ON z.id  = sp.zona_id
`;

// ── POST /api/agente/supervision/mi-agenda ──
// body: { device_uuid, device_token, qr_token, desde?, hasta? }
agenteSupervisionRouter.post("/agente/supervision/mi-agenda", async (req, res) => {
  const b = req.body || {};
  const a = await autenticar(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  const desde = String(b.desde ?? "");
  const hasta = String(b.hasta ?? "");
  if (desde && !ISO_DATE.test(desde)) return res.status(400).json({ error: "desde inválido" });
  if (hasta && !ISO_DATE.test(hasta)) return res.status(400).json({ error: "hasta inválido" });

  try {
    const params: any[] = [a.ctx.employee_id];
    let where = `sp.supervisor_employee_id = $1`;
    if (desde) { params.push(desde); where += ` AND sp.fecha_planificada >= $${params.length}`; }
    if (hasta) { params.push(hasta); where += ` AND sp.fecha_planificada <= $${params.length}`; }
    if (!desde && !hasta) {
      where += ` AND sp.fecha_planificada >= (CURRENT_DATE - INTERVAL '1 day')
                 AND sp.fecha_planificada <= (CURRENT_DATE + INTERVAL '7 days')`;
    }
    const sql = `${SELECT_AGENDA} WHERE ${where}
                 ORDER BY sp.fecha_planificada ASC, sp.ventana_inicio ASC NULLS LAST, sp.id ASC`;
    const { rows } = await pool.query(sql, params);
    res.json({
      ok: true,
      supervisor: { id: a.ctx.employee_id, nombre: a.ctx.supervisor_nombre },
      bound_now: a.ctx.bound_now,
      agenda: rows,
    });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/mi-agenda error");
    res.status(500).json({ error: "Error al cargar agenda" });
  }
});

// ── POST /api/agente/supervision/iniciar ──
// body: { device_uuid, device_token, qr_token, programacion_id }
// Transición atómica: pendiente|en_curso → en_curso (con guarda en WHERE).
agenteSupervisionRouter.post("/agente/supervision/iniciar", async (req, res) => {
  const b = req.body || {};
  const a = await autenticar(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  const id = Number(b.programacion_id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "programacion_id inválido" });

  try {
    // Buscar fichaje de turno activo del supervisor para asociar GPS.
    const { rows: fich } = await pool.query(
      `SELECT id FROM agente_fichajes
        WHERE employee_id = $1 AND tipo = 'inicio_turno' AND turno_cerrado_en IS NULL
        ORDER BY id DESC LIMIT 1`,
      [a.ctx.employee_id]
    );
    const fichajeId = fich[0]?.id || null;

    const { rowCount, rows } = await pool.query(
      `UPDATE supervision_visitas_programadas
          SET estado = 'en_curso',
              iniciada_at = COALESCE(iniciada_at, NOW()),
              fichaje_supervisor_id = COALESCE(fichaje_supervisor_id, $3),
              updated_at = NOW()
        WHERE id = $1
          AND supervisor_employee_id = $2
          AND estado IN ('pendiente','en_curso')
       RETURNING id, estado`,
      [id, a.ctx.employee_id, fichajeId]
    );
    if (!rowCount) {
      // Diagnóstico: no existe / no es suya / estado finalizado.
      const { rows: chk } = await pool.query(
        `SELECT supervisor_employee_id, estado
           FROM supervision_visitas_programadas WHERE id = $1`,
        [id]
      );
      if (!chk[0]) return res.status(404).json({ error: "Programación no encontrada" });
      if (chk[0].supervisor_employee_id !== a.ctx.employee_id) {
        return res.status(403).json({ error: "No es su programación" });
      }
      return res.status(409).json({ error: `No se puede iniciar (estado actual: ${chk[0].estado})` });
    }
    res.json({ ok: true, programacion_id: rows[0].id, fichaje_id: fichajeId });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/iniciar error");
    res.status(500).json({ error: "Error al iniciar visita" });
  }
});

// ── POST /api/agente/supervision/completar ──
// body: { device_uuid, device_token, qr_token, programacion_id, observaciones? }
// Transición atómica: pendiente|en_curso → completada.
agenteSupervisionRouter.post("/agente/supervision/completar", async (req, res) => {
  const b = req.body || {};
  const a = await autenticar(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  const id = Number(b.programacion_id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "programacion_id inválido" });

  try {
    const { rowCount } = await pool.query(
      `UPDATE supervision_visitas_programadas
          SET estado = 'completada',
              iniciada_at = COALESCE(iniciada_at, NOW()),
              completada_at = COALESCE(completada_at, NOW()),
              observaciones = COALESCE($3, observaciones),
              updated_at = NOW()
        WHERE id = $1
          AND supervisor_employee_id = $2
          AND estado IN ('pendiente','en_curso')`,
      [id, a.ctx.employee_id, b.observaciones || null]
    );
    if (!rowCount) {
      const { rows: chk } = await pool.query(
        `SELECT supervisor_employee_id, estado
           FROM supervision_visitas_programadas WHERE id = $1`, [id]
      );
      if (!chk[0]) return res.status(404).json({ error: "Programación no encontrada" });
      if (chk[0].supervisor_employee_id !== a.ctx.employee_id) {
        return res.status(403).json({ error: "No es su programación" });
      }
      return res.status(409).json({ error: `No se puede completar (estado actual: ${chk[0].estado})` });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/completar error");
    res.status(500).json({ error: "Error al completar visita" });
  }
});

// ── POST /api/agente/supervision/no-realizada ──
// body: { device_uuid, device_token, qr_token, programacion_id, motivo }
// Transición atómica: pendiente|en_curso → no_realizada (motivo obligatorio).
agenteSupervisionRouter.post("/agente/supervision/no-realizada", async (req, res) => {
  const b = req.body || {};
  const a = await autenticar(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  const id = Number(b.programacion_id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "programacion_id inválido" });
  const motivo = String(b.motivo || "").trim();
  if (motivo.length < 3) return res.status(400).json({ error: "Motivo requerido (min. 3 caracteres)" });

  try {
    const { rowCount } = await pool.query(
      `UPDATE supervision_visitas_programadas
          SET estado = 'no_realizada',
              observaciones = $3,
              updated_at = NOW()
        WHERE id = $1
          AND supervisor_employee_id = $2
          AND estado IN ('pendiente','en_curso')`,
      [id, a.ctx.employee_id, motivo]
    );
    if (!rowCount) {
      const { rows: chk } = await pool.query(
        `SELECT supervisor_employee_id, estado
           FROM supervision_visitas_programadas WHERE id = $1`, [id]
      );
      if (!chk[0]) return res.status(404).json({ error: "Programación no encontrada" });
      if (chk[0].supervisor_employee_id !== a.ctx.employee_id) {
        return res.status(403).json({ error: "No es su programación" });
      }
      return res.status(409).json({ error: `No se puede marcar no realizada (estado actual: ${chk[0].estado})` });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/no-realizada error");
    res.status(500).json({ error: "Error al marcar no realizada" });
  }
});
