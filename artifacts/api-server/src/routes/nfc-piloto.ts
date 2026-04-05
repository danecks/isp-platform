/**
 * NFC PILOTO — Módulo experimental de control operativo con NFC.
 * ─────────────────────────────────────────────────────────────
 * SANDBOX MODE: sandbox_mode=TRUE | produccion=FALSE | no_side_effects=TRUE
 *
 * REGLA: Este módulo NO toca, NO modifica y NO afecta ninguna tabla productiva.
 * Solo lee datos de referencia (empleados, puestos, clientes) en modo read-only.
 * Todos los eventos y registros viven exclusivamente en tablas nfc_*.
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { createHash, randomBytes } from "node:crypto";

// ── Token helpers (SHA-256, no bcrypt por simplicidad en piloto) ──────────────
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
function genToken(): string {
  return randomBytes(32).toString("hex"); // 64-char hex
}

const router = Router();
const P = "/pilot/nfc"; // prefijo aislado

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
async function audit(
  entity_type: string,
  entity_id: number | null,
  action: string,
  actor: string,
  meta?: Record<string, unknown>,
) {
  try {
    await pool.query(
      `INSERT INTO nfc_audit_log (entity_type, entity_id, action, actor, meta)
       VALUES ($1,$2,$3,$4,$5)`,
      [entity_type, entity_id, action, actor, meta ? JSON.stringify(meta) : null],
    );
  } catch (_) { /* no-op: audit never blocks */ }
}

function actor(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers["x-isp-session"] as string) || "sistema";
}

// ──────────────────────────────────────────────────────────────────────────────
// FEATURE FLAG / STATUS
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/status`, (_req, res) => {
  res.json({
    sandbox_mode: true,
    produccion: false,
    no_side_effects: true,
    version: "1.0.0-pilot",
    modulo: "nfc_operaciones",
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/dashboard`, async (_req, res) => {
  try {
    const [devices, tags, eventsToday, pending, forms, lastEvents] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM nfc_devices WHERE sandbox_mode = TRUE`),
      pool.query(`SELECT COUNT(*) FROM nfc_tags WHERE sandbox_mode = TRUE AND status = 'active'`),
      pool.query(
        `SELECT COUNT(*) FROM nfc_shift_events
         WHERE sandbox_mode = TRUE
           AND (event_at AT TIME ZONE 'UTC')::date = CURRENT_DATE AT TIME ZONE 'UTC'`,
      ),
      pool.query(`SELECT COUNT(*) FROM nfc_shift_events WHERE sandbox_mode = TRUE AND validation_status = 'pendiente'`),
      pool.query(
        `SELECT COUNT(*) FROM nfc_supervisor_forms
         WHERE sandbox_mode = TRUE
           AND (created_at AT TIME ZONE 'UTC')::date = CURRENT_DATE AT TIME ZONE 'UTC'`,
      ),
      pool.query(`
        SELECT e.id, e.event_type, e.scheduled_status, e.validation_status, e.event_at,
               t.alias, t.profile_type,
               emp.nombre_completo AS nombre_empleado,
               p.nombre AS nombre_puesto
        FROM nfc_shift_events e
        LEFT JOIN nfc_tags t ON t.id = e.tag_id
        LEFT JOIN employees emp ON emp.id = e.empleado_id_ref
        LEFT JOIN puestos_operativos p ON p.id = e.puesto_id_ref
        WHERE e.sandbox_mode = TRUE
        ORDER BY e.event_at DESC LIMIT 10
      `),
    ]);
    res.json({
      total_devices: +devices.rows[0].count,
      active_tags: +tags.rows[0].count,
      events_today: +eventsToday.rows[0].count,
      pending_validations: +pending.rows[0].count,
      supervisor_forms_today: +forms.rows[0].count,
      last_events: lastEvents.rows,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DEVICES
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/devices`, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*,
             p.nombre AS nombre_puesto,
             c.nombre AS cliente_nombre
      FROM nfc_devices d
      LEFT JOIN puestos_operativos p ON p.id = d.puesto_id_ref
      LEFT JOIN clients c ON c.id = d.cliente_id_ref
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post(`${P}/devices`, async (req, res) => {
  try {
    const { device_code, device_name, puesto_id_ref, cliente_id_ref, sede_id_ref, notes } = req.body;
    if (!device_code || !device_name) {
      return res.status(400).json({ error: "device_code y device_name son requeridos" });
    }
    const { rows } = await pool.query(
      `INSERT INTO nfc_devices (device_code, device_name, puesto_id_ref, cliente_id_ref, sede_id_ref, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [device_code, device_name, puesto_id_ref || null, cliente_id_ref || null, sede_id_ref || null, notes || null],
    );
    await audit("device", rows[0].id, "create", actor(req), { device_code });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get(`${P}/devices/:id`, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, p.nombre AS nombre_puesto FROM nfc_devices d
       LEFT JOIN puestos_operativos p ON p.id = d.puesto_id_ref
       WHERE d.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Dispositivo no encontrado" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.patch(`${P}/devices/:id`, async (req, res) => {
  try {
    const { device_name, status, puesto_id_ref, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE nfc_devices
       SET device_name   = COALESCE($1, device_name),
           status        = COALESCE($2, status),
           puesto_id_ref = CASE WHEN $3::text IS NULL THEN puesto_id_ref ELSE $3::int END,
           notes         = COALESCE($4, notes),
           updated_at    = NOW()
       WHERE id = $5 RETURNING *`,
      [device_name || null, status || null, puesto_id_ref != null ? String(puesto_id_ref) : null, notes || null, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    await audit("device", rows[0].id, "update", actor(req));
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// ENROLAMIENTO DE DISPOSITIVOS
// ──────────────────────────────────────────────────────────────────────────────

/** Enrola el dispositivo: genera device_uuid (si no existe) + nuevo token.
 *  El token en texto plano se devuelve UNA SOLA VEZ — el admin lo da al kiosko. */
router.post(`${P}/devices/:id/enroll`, async (req, res) => {
  try {
    const token = genToken();
    const tokenHash = hashToken(token);
    const { rows } = await pool.query(
      `UPDATE nfc_devices
       SET device_uuid       = COALESCE(device_uuid, gen_random_uuid()::text),
           device_token_hash = $1,
           enrolled_at       = NOW(),
           revoked_at        = NULL,
           status            = 'active',
           updated_at        = NOW()
       WHERE id = $2 AND sandbox_mode = TRUE
       RETURNING id, device_uuid, device_code, device_name, enrolled_at`,
      [tokenHash, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Dispositivo no encontrado" });
    await audit("device", rows[0].id, "device_enrolled", actor(req));
    res.json({
      device_uuid:  rows[0].device_uuid,
      device_code:  rows[0].device_code,
      device_name:  rows[0].device_name,
      device_token: token,            // Solo se muestra UNA VEZ — no se guarda en texto plano
      enrolled_at:  rows[0].enrolled_at,
      message: "Dispositivo enrolado. Copia el token — no se mostrará de nuevo.",
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

/** Re-enrola: revoca token anterior y genera uno nuevo. El historial de eventos se conserva. */
router.post(`${P}/devices/:id/re-enroll`, async (req, res) => {
  try {
    const token = genToken();
    const tokenHash = hashToken(token);
    const { rows } = await pool.query(
      `UPDATE nfc_devices
       SET device_token_hash = $1,
           enrolled_at       = NOW(),
           revoked_at        = NULL,
           status            = 'active',
           updated_at        = NOW()
       WHERE id = $2 AND sandbox_mode = TRUE
       RETURNING id, device_uuid, device_code, device_name, enrolled_at`,
      [tokenHash, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Dispositivo no encontrado" });
    await audit("device", rows[0].id, "device_reenrolled", actor(req));
    res.json({
      device_uuid:  rows[0].device_uuid,
      device_code:  rows[0].device_code,
      device_name:  rows[0].device_name,
      device_token: token,
      enrolled_at:  rows[0].enrolled_at,
      message: "Dispositivo re-enrolado. El token anterior fue invalidado.",
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

/** Revoca el token del dispositivo. El kiosko ya no podrá marcar hasta re-enrolamiento. */
router.post(`${P}/devices/:id/revoke-token`, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE nfc_devices
       SET device_token_hash = NULL,
           revoked_at        = NOW(),
           status            = 'inactive',
           updated_at        = NOW()
       WHERE id = $1 AND sandbox_mode = TRUE
       RETURNING id, device_code, device_name`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Dispositivo no encontrado" });
    await audit("device", rows[0].id, "device_token_revoked", actor(req));
    res.json({ message: "Token revocado. El kiosko requiere re-enrolamiento.", device_code: rows[0].device_code });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// KIOSKO — Activación y verificación de identidad
// ──────────────────────────────────────────────────────────────────────────────

/** El kiosko presenta device_code + token para obtener sus credenciales y activarse. */
router.post(`${P}/kiosk/activate`, async (req, res) => {
  try {
    const { device_code, device_token } = req.body;
    if (!device_code || !device_token) {
      return res.status(400).json({ error: "device_code y device_token son requeridos" });
    }

    const { rows } = await pool.query(
      `SELECT d.*, p.nombre AS nombre_puesto FROM nfc_devices d
       LEFT JOIN puestos_operativos p ON p.id = d.puesto_id_ref
       WHERE d.device_code = $1 AND d.sandbox_mode = TRUE`,
      [device_code],
    );

    if (!rows.length) {
      await audit("device", null, "kiosk_activation_failed", "kiosk", { device_code, reason: "not_found" });
      return res.status(404).json({ error: "Dispositivo no encontrado", code: "DEVICE_NOT_FOUND" });
    }

    const device = rows[0];

    if (!device.device_token_hash) {
      await audit("device", device.id, "kiosk_activation_failed", "kiosk", { device_code, reason: "not_enrolled" });
      return res.status(403).json({ error: "Dispositivo no enrolado. Contacta al administrador.", code: "NOT_ENROLLED" });
    }

    if (device.device_token_hash !== hashToken(device_token)) {
      await audit("device", device.id, "kiosk_activation_failed", "kiosk", { device_code, reason: "invalid_token" });
      return res.status(403).json({ error: "Token inválido", code: "INVALID_TOKEN" });
    }

    if (device.status !== "active") {
      return res.status(403).json({ error: "Dispositivo inactivo o revocado", code: "DEVICE_INACTIVE" });
    }

    await pool.query(`UPDATE nfc_devices SET last_seen_at=NOW() WHERE id=$1`, [device.id]);

    res.json({
      device_uuid:  device.device_uuid,
      device_code:  device.device_code,
      device_name:  device.device_name,
      puesto_nombre: device.nombre_puesto,
      status:       device.status,
      enrolled_at:  device.enrolled_at,
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

/** El kiosko verifica sus credenciales en cada arranque. */
router.get(`${P}/kiosk/me`, async (req, res) => {
  try {
    const { device_uuid, device_token } = req.query as Record<string, string>;
    if (!device_uuid || !device_token) {
      return res.status(400).json({ error: "device_uuid y device_token son requeridos" });
    }

    const { rows } = await pool.query(
      `SELECT d.*, p.nombre AS nombre_puesto FROM nfc_devices d
       LEFT JOIN puestos_operativos p ON p.id = d.puesto_id_ref
       WHERE d.device_uuid = $1 AND d.device_token_hash = $2 AND d.sandbox_mode = TRUE`,
      [device_uuid, hashToken(device_token)],
    );

    if (!rows.length) {
      return res.status(403).json({ error: "Credenciales inválidas o revocadas", code: "INVALID_CREDENTIALS" });
    }

    const device = rows[0];
    if (device.status !== "active") {
      return res.status(403).json({ error: "Dispositivo inactivo", code: "DEVICE_INACTIVE" });
    }

    await pool.query(`UPDATE nfc_devices SET last_seen_at=NOW() WHERE id=$1`, [device.id]);

    res.json({
      device_uuid:  device.device_uuid,
      device_code:  device.device_code,
      device_name:  device.device_name,
      puesto_nombre: device.nombre_puesto,
      status:       device.status,
      enrolled_at:  device.enrolled_at,
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// TAGS NFC
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/tags`, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*,
             e.nombre_completo AS empleado_nombre
      FROM nfc_tags t
      LEFT JOIN employees e ON e.id = t.empleado_id_ref
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post(`${P}/tags`, async (req, res) => {
  try {
    const { tag_uid, profile_type, empleado_id_ref, alias, issued_at, notes } = req.body;
    if (!tag_uid) return res.status(400).json({ error: "tag_uid es requerido" });
    const { rows } = await pool.query(
      `INSERT INTO nfc_tags (tag_uid, profile_type, empleado_id_ref, alias, issued_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tag_uid, profile_type || "AGENTE", empleado_id_ref || null, alias || null, issued_at || null, notes || null],
    );
    await audit("tag", rows[0].id, "create", actor(req), { tag_uid, profile_type });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.patch(`${P}/tags/:id`, async (req, res) => {
  try {
    const { alias, status, empleado_id_ref, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE nfc_tags
       SET alias           = COALESCE($1, alias),
           status          = COALESCE($2, status),
           empleado_id_ref = CASE WHEN $3::text IS NULL THEN empleado_id_ref ELSE $3::int END,
           notes           = COALESCE($4, notes),
           updated_at      = NOW()
       WHERE id = $5 RETURNING *`,
      [alias || null, status || null, empleado_id_ref != null ? String(empleado_id_ref) : null, notes || null, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    await audit("tag", rows[0].id, "update", actor(req));
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post(`${P}/tags/:id/revoke`, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE nfc_tags SET status='revoked', revoked_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    await audit("tag", rows[0].id, "revoke", actor(req));
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// SCAN — Flujo principal del kiosko
// ──────────────────────────────────────────────────────────────────────────────
router.post(`${P}/scan`, async (req, res) => {
  try {
    const { tag_uid, device_code, device_uuid, device_token, photo_path } = req.body;
    if (!tag_uid) return res.status(400).json({ error: "tag_uid es requerido" });
    if (!device_uuid && !device_code) {
      return res.status(400).json({ error: "Se requiere device_uuid o device_code" });
    }

    // 1. Verificar dispositivo — por device_uuid (modo enrolado) o device_code (modo legado)
    let devRes;
    if (device_uuid) {
      devRes = await pool.query(
        `SELECT d.*, p.nombre AS nombre_puesto FROM nfc_devices d
         LEFT JOIN puestos_operativos p ON p.id = d.puesto_id_ref
         WHERE d.device_uuid = $1 AND d.status = 'active' AND d.sandbox_mode = TRUE`,
        [device_uuid],
      );
    } else {
      devRes = await pool.query(
        `SELECT d.*, p.nombre AS nombre_puesto FROM nfc_devices d
         LEFT JOIN puestos_operativos p ON p.id = d.puesto_id_ref
         WHERE d.device_code = $1 AND d.status = 'active' AND d.sandbox_mode = TRUE`,
        [device_code],
      );
    }

    if (!devRes.rows.length) {
      await audit("event", null, "scan_rejected_device", "kiosk", { tag_uid, device_code, device_uuid });
      return res.status(403).json({ error: "Dispositivo no autorizado", code: "DEVICE_UNAUTHORIZED" });
    }
    const device = devRes.rows[0];

    // 1b. Si el dispositivo tiene token registrado, validarlo obligatoriamente
    if (device.device_token_hash) {
      if (!device_token) {
        await audit("event", device.id, "scan_rejected_invalid_token", "kiosk", { tag_uid, reason: "missing_token" });
        return res.status(403).json({ error: "Este dispositivo requiere token de autenticación", code: "TOKEN_REQUIRED" });
      }
      if (device.device_token_hash !== hashToken(device_token)) {
        await audit("event", device.id, "scan_rejected_invalid_token", "kiosk", { tag_uid, reason: "invalid_token" });
        return res.status(403).json({ error: "Token de dispositivo inválido", code: "INVALID_TOKEN" });
      }
    }
    // Si device.device_token_hash es NULL → modo pre-enrolamiento (sandbox legado permitido)

    // 2. Verificar tag
    const tagRes = await pool.query(
      `SELECT t.*, e.nombre_completo AS nombre_empleado
       FROM nfc_tags t
       LEFT JOIN employees e ON e.id = t.empleado_id_ref
       WHERE t.tag_uid = $1 AND t.sandbox_mode = TRUE`,
      [tag_uid],
    );
    if (!tagRes.rows.length) {
      return res.status(404).json({ error: "Tag no registrado", code: "TAG_NOT_FOUND" });
    }
    const tag = tagRes.rows[0];

    if (tag.status === "revoked") {
      await audit("event", null, "scan_rejected_revoked", "kiosk", { tag_uid });
      return res.status(403).json({ error: "Tag revocado", code: "TAG_REVOKED" });
    }
    if (tag.status !== "active") {
      return res.status(403).json({ error: "Tag inactivo", code: "TAG_INACTIVE" });
    }

    // 3. Validar contra programación sandbox (solo lectura)
    const nowGT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
    const horaActual = nowGT.toTimeString().slice(0, 5);
    const diaSemana = nowGT.getDay();
    const schedRes = await pool.query(
      `SELECT * FROM nfc_sandbox_schedules
       WHERE (device_id = $1 OR puesto_id_ref = $2)
         AND activo = TRUE
         AND (dia_semana IS NULL OR dia_semana = $3)
         AND hora_inicio <= $4::time AND hora_fin >= $4::time`,
      [device.id, device.puesto_id_ref, diaSemana, horaActual],
    );

    let scheduled_status = "pendiente";
    if (schedRes.rows.length > 0) {
      const s = schedRes.rows[0];
      if (!s.empleado_id_ref || s.empleado_id_ref === tag.empleado_id_ref) {
        scheduled_status = "programado";
      } else {
        scheduled_status = "cobertura_potencial";
      }
    } else {
      scheduled_status = "no_programado";
    }

    // 4. Determinar si es inicio o fin de turno
    let event_type = "INICIO_TURNO";
    if (tag.profile_type === "AGENTE") {
      const prevRes = await pool.query(
        `SELECT id FROM nfc_shift_events
         WHERE tag_id = $1 AND event_type = 'INICIO_TURNO'
           AND validation_status != 'rechazado'
           AND event_at > NOW() - INTERVAL '16 hours'
         ORDER BY event_at DESC LIMIT 1`,
        [tag.id],
      );
      if (prevRes.rows.length) event_type = "FIN_TURNO";
    }

    // 5. Registrar evento (sandbox, sin side effects)
    const { rows } = await pool.query(
      `INSERT INTO nfc_shift_events
         (tag_id, empleado_id_ref, device_id, puesto_id_ref, event_type, scheduled_status, validation_status, photo_path)
       VALUES ($1,$2,$3,$4,$5,$6,'pendiente',$7) RETURNING *`,
      [tag.id, tag.empleado_id_ref, device.id, device.puesto_id_ref, event_type, scheduled_status, photo_path || null],
    );

    // 6. Actualizar last_seen_at del dispositivo
    await pool.query(`UPDATE nfc_devices SET last_seen_at=NOW() WHERE id=$1`, [device.id]);

    await audit("event", rows[0].id, "scan_ok", "kiosk", { tag_uid, device_code, event_type });

    res.json({
      event: rows[0],
      tag,
      device,
      profile_type: tag.profile_type,
      scheduled_status,
      nombre_empleado: tag.nombre_empleado,
      puesto_nombre: device.nombre_puesto,
      event_type,
      mensaje: event_type === "FIN_TURNO" ? "Fin de turno registrado" : "Inicio de turno detectado",
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// SHIFT EVENTS
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/shift-events`, async (req, res) => {
  try {
    const { desde, hasta, puesto_id, estado } = req.query;
    const where = ["e.sandbox_mode = TRUE"];
    const params: unknown[] = [];
    if (desde) { params.push(desde); where.push(`(e.event_at AT TIME ZONE 'UTC')::date >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); where.push(`(e.event_at AT TIME ZONE 'UTC')::date <= $${params.length}::date`); }
    if (puesto_id) { params.push(puesto_id); where.push(`e.puesto_id_ref = $${params.length}`); }
    if (estado) { params.push(estado); where.push(`e.validation_status = $${params.length}`); }

    const { rows } = await pool.query(`
      SELECT e.*,
             t.tag_uid, t.profile_type, t.alias,
             emp.nombre_completo AS nombre_empleado,
             d.device_code, d.device_name,
             p.nombre AS nombre_puesto
      FROM nfc_shift_events e
      LEFT JOIN nfc_tags t ON t.id = e.tag_id
      LEFT JOIN employees emp ON emp.id = e.empleado_id_ref
      LEFT JOIN nfc_devices d ON d.id = e.device_id
      LEFT JOIN puestos_operativos p ON p.id = e.puesto_id_ref
      WHERE ${where.join(" AND ")}
      ORDER BY e.event_at DESC LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get(`${P}/shift-events/:id`, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*, t.tag_uid, t.alias,
             emp.nombre_completo AS nombre_empleado,
             d.device_name, p.nombre AS nombre_puesto
      FROM nfc_shift_events e
      LEFT JOIN nfc_tags t ON t.id = e.tag_id
      LEFT JOIN employees emp ON emp.id = e.empleado_id_ref
      LEFT JOIN nfc_devices d ON d.id = e.device_id
      LEFT JOIN puestos_operativos p ON p.id = e.puesto_id_ref
      WHERE e.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// VALIDATION QUEUE
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/validation/pending`, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*,
             t.tag_uid, t.alias, t.profile_type,
             emp.nombre_completo AS nombre_empleado,
             d.device_name, p.nombre AS nombre_puesto
      FROM nfc_shift_events e
      LEFT JOIN nfc_tags t ON t.id = e.tag_id
      LEFT JOIN employees emp ON emp.id = e.empleado_id_ref
      LEFT JOIN nfc_devices d ON d.id = e.device_id
      LEFT JOIN puestos_operativos p ON p.id = e.puesto_id_ref
      WHERE e.validation_status = 'pendiente' AND e.sandbox_mode = TRUE
      ORDER BY e.event_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post(`${P}/validation/:id/approve`, async (req, res) => {
  try {
    const { notas } = req.body;
    const a = actor(req);
    const { rows } = await pool.query(
      `UPDATE nfc_shift_events
       SET validation_status='validado_manualmente', validated_by=$1, validated_at=NOW(),
           notes=COALESCE($2,notes), updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [a, notas || null, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    await audit("event", rows[0].id, "validate_approve", a);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post(`${P}/validation/:id/reject`, async (req, res) => {
  try {
    const { notas } = req.body;
    const a = actor(req);
    const { rows } = await pool.query(
      `UPDATE nfc_shift_events
       SET validation_status='rechazado', validated_by=$1, validated_at=NOW(),
           notes=COALESCE($2,notes), updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [a, notas || null, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    await audit("event", rows[0].id, "validate_reject", a);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// SUPERVISOR FORMS
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/supervisor/forms`, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const where = ["f.sandbox_mode = TRUE"];
    const params: unknown[] = [];
    if (desde) { params.push(desde); where.push(`(f.created_at AT TIME ZONE 'UTC')::date >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); where.push(`(f.created_at AT TIME ZONE 'UTC')::date <= $${params.length}::date`); }

    const { rows } = await pool.query(`
      SELECT f.*,
             sup.nombre_completo AS supervisor_nombre,
             ag.nombre_completo AS agente_nombre,
             p.nombre AS nombre_puesto, d.device_name
      FROM nfc_supervisor_forms f
      LEFT JOIN employees sup ON sup.id = f.supervisor_id_ref
      LEFT JOIN employees ag  ON ag.id  = f.agente_id_ref
      LEFT JOIN puestos_operativos p ON p.id = f.puesto_id_ref
      LEFT JOIN nfc_devices d ON d.id = f.device_id
      WHERE ${where.join(" AND ")}
      ORDER BY f.created_at DESC LIMIT 100
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post(`${P}/supervisor/forms`, async (req, res) => {
  try {
    const {
      supervisor_tag_id, supervisor_id_ref, device_id, puesto_id_ref, agente_id_ref,
      arma_estado, uniforme_estado, puesto_estado, agente_estado, observaciones, photo_path, form_items,
    } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO nfc_supervisor_forms
         (supervisor_tag_id, supervisor_id_ref, device_id, puesto_id_ref, agente_id_ref,
          arma_estado, uniforme_estado, puesto_estado, agente_estado, observaciones, photo_path, form_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'completado') RETURNING *`,
      [
        supervisor_tag_id || null, supervisor_id_ref || null, device_id || null,
        puesto_id_ref || null, agente_id_ref || null,
        arma_estado || "sin_novedad", uniforme_estado || "completo",
        puesto_estado || "sin_novedad", agente_estado || "presente",
        observaciones || null, photo_path || null,
      ],
    );
    const form = rows[0];

    if (form_items && Array.isArray(form_items)) {
      for (const item of form_items as { item_type: string; item_name: string; item_status?: string; item_notes?: string }[]) {
        await pool.query(
          `INSERT INTO nfc_supervisor_form_items (form_id, item_type, item_name, item_status, item_notes)
           VALUES ($1,$2,$3,$4,$5)`,
          [form.id, item.item_type, item.item_name, item.item_status || "ok", item.item_notes || null],
        );
      }
    }

    await audit("form", form.id, "create", actor(req));
    res.json(form);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get(`${P}/supervisor/forms/:id`, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*,
              sup.nombre_completo AS supervisor_nombre,
              ag.nombre_completo  AS agente_nombre,
              p.nombre AS nombre_puesto
       FROM nfc_supervisor_forms f
       LEFT JOIN employees sup ON sup.id = f.supervisor_id_ref
       LEFT JOIN employees ag  ON ag.id  = f.agente_id_ref
       LEFT JOIN puestos_operativos p ON p.id = f.puesto_id_ref
       WHERE f.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    const { rows: items } = await pool.query(
      `SELECT * FROM nfc_supervisor_form_items WHERE form_id = $1 ORDER BY id`,
      [req.params.id],
    );
    res.json({ ...rows[0], items });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// SANDBOX SCHEDULES
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/schedules`, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
             p.nombre AS nombre_puesto,
             e.nombre_completo AS empleado_nombre,
             d.device_name
      FROM nfc_sandbox_schedules s
      LEFT JOIN puestos_operativos p ON p.id = s.puesto_id_ref
      LEFT JOIN employees e ON e.id = s.empleado_id_ref
      LEFT JOIN nfc_devices d ON d.id = s.device_id
      ORDER BY s.id DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.post(`${P}/schedules`, async (req, res) => {
  try {
    const { device_id, puesto_id_ref, empleado_id_ref, dia_semana, hora_inicio, hora_fin, notes } = req.body;
    if (!hora_inicio || !hora_fin) return res.status(400).json({ error: "hora_inicio y hora_fin son requeridos" });
    const { rows } = await pool.query(
      `INSERT INTO nfc_sandbox_schedules (device_id, puesto_id_ref, empleado_id_ref, dia_semana, hora_inicio, hora_fin, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [device_id || null, puesto_id_ref || null, empleado_id_ref || null,
       dia_semana !== undefined && dia_semana !== null && dia_semana !== "" ? +dia_semana : null,
       hora_inicio, hora_fin, notes || null],
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.delete(`${P}/schedules/:id`, async (req, res) => {
  try {
    await pool.query(`DELETE FROM nfc_sandbox_schedules WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/audit-logs`, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM nfc_audit_log ORDER BY created_at DESC LIMIT 300`,
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ──────────────────────────────────────────────────────────────────────────────
// READ-ONLY HELPERS (para dropdowns del frontend, solo lectura)
// ──────────────────────────────────────────────────────────────────────────────
router.get(`${P}/ref/puestos`, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre AS nombre_puesto FROM puestos_operativos WHERE estado_operativo_puesto != 'desactivado' ORDER BY nombre LIMIT 200`,
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get(`${P}/ref/empleados`, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre_completo, tipo_personal
       FROM employees WHERE estado_laboral != 'baja' ORDER BY nombre_completo LIMIT 300`,
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export { router as nfcPilotoRouter };
