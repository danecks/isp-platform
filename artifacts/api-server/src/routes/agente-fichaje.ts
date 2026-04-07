import { Router } from "express";
import { pool } from "@workspace/db";
import { v4 as uuidv4 } from "uuid";
import { createHash, randomBytes } from "node:crypto";
import { logger } from "../lib/logger";

export const agenteFichajeRouter = Router();

// ── Utilidades ────────────────────────────────────────────────────────────────
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function haversineMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPOSITIVOS AUTENTICADOS — gestión (admin) y validación (público)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/supervisor-devices/validate — el teléfono se identifica al cargar la página
agenteFichajeRouter.post("/supervisor-devices/validate", async (req, res) => {
  const { device_uuid, device_token } = req.body;
  if (!device_uuid || !device_token) {
    return res.status(400).json({ ok: false, error: "device_uuid y device_token requeridos" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT sd.id, sd.supervisor_nombre, sd.descripcion, sd.tipo, sd.puesto_id,
              po.nombre AS puesto_nombre, po.cliente_nombre
       FROM supervisor_devices sd
       LEFT JOIN puestos_operativos po ON po.id = sd.puesto_id
       WHERE sd.device_uuid = $1 AND sd.activo = TRUE`,
      [device_uuid]
    );
    if (!rows[0]) return res.status(403).json({ ok: false, error: "Dispositivo no registrado o revocado" });
    const dev = rows[0];
    if (!dev.device_token_hash) return res.status(403).json({ ok: false, error: "Dispositivo sin token configurado" });
    if (dev.device_token_hash !== hashToken(device_token)) {
      return res.status(403).json({ ok: false, error: "Token de dispositivo incorrecto" });
    }
    await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [dev.id]);
    res.json({
      ok: true,
      device_id: dev.id,
      tipo: dev.tipo,
      supervisor_nombre: dev.supervisor_nombre,
      descripcion: dev.descripcion,
      puesto_id: dev.puesto_id,
      puesto_nombre: dev.puesto_nombre,
      cliente_nombre: dev.cliente_nombre,
    });
  } catch (err) {
    logger.error({ err }, "supervisor-devices/validate: error");
    res.status(500).json({ ok: false, error: "Error al validar dispositivo" });
  }
});

// GET /api/supervisor-devices — lista de dispositivos (admin)
agenteFichajeRouter.get("/supervisor-devices", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sd.id, sd.device_uuid, sd.supervisor_nombre, sd.descripcion,
             sd.tipo, sd.puesto_id, sd.activo, sd.ultimo_uso, sd.created_at,
             (sd.device_token_hash IS NOT NULL) AS tiene_token,
             po.nombre AS puesto_nombre, po.cliente_nombre
      FROM supervisor_devices sd
      LEFT JOIN puestos_operativos po ON po.id = sd.puesto_id
      ORDER BY sd.tipo, sd.supervisor_nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "supervisor-devices GET: error");
    res.status(500).json({ error: "Error obteniendo dispositivos" });
  }
});

// POST /api/supervisor-devices — registrar nuevo dispositivo (admin)
agenteFichajeRouter.post("/supervisor-devices", async (req, res) => {
  const { supervisor_nombre, descripcion, tipo = "supervisor", puesto_id } = req.body;
  if (!supervisor_nombre) return res.status(400).json({ error: "supervisor_nombre requerido" });
  if (!["supervisor", "puesto", "maestro"].includes(tipo)) return res.status(400).json({ error: "tipo debe ser 'supervisor', 'puesto' o 'maestro'" });

  try {
    const plainToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(plainToken);
    const { rows } = await pool.query(
      `INSERT INTO supervisor_devices
         (supervisor_nombre, descripcion, tipo, puesto_id, device_token_hash)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, device_uuid, supervisor_nombre, descripcion, tipo, puesto_id, created_at`,
      [supervisor_nombre, descripcion ?? null, tipo, puesto_id ?? null, tokenHash]
    );
    res.json({
      ok: true,
      device: rows[0],
      device_token: plainToken,   // Solo se devuelve una vez — no se almacena en texto plano
    });
  } catch (err) {
    logger.error({ err }, "supervisor-devices POST: error");
    res.status(500).json({ error: "Error registrando dispositivo" });
  }
});

// DELETE /api/supervisor-devices/:id — revocar dispositivo (admin)
agenteFichajeRouter.delete("/supervisor-devices/:id", async (req, res) => {
  try {
    await pool.query(
      `UPDATE supervisor_devices SET activo = FALSE, device_token_hash = NULL WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error revocando dispositivo" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PÚBLICO — escaneo de QR del agente
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/agente/scan/:token — info del agente al escanear el QR
agenteFichajeRouter.get("/agente/scan/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const { rows: tkRows } = await pool.query(
      `SELECT aqt.employee_id, aqt.activo,
              e.nombre_completo, e.puesto AS cargo, e.tipo_personal, e.dpi
       FROM agente_qr_tokens aqt
       JOIN employees e ON e.id = aqt.employee_id
       WHERE aqt.qr_token = $1`,
      [token]
    );
    if (!tkRows[0]) return res.status(404).json({ error: "QR no válido" });
    if (!tkRows[0].activo) return res.status(403).json({ error: "Token desactivado" });

    const emp = tkRows[0];

    const { rows: poRows } = await pool.query(
      `SELECT po.id, po.nombre, po.cliente_nombre, po.horario,
              po.hora_entrada, po.hora_salida, po.turno, po.jornada
       FROM puestos_operativos po
       WHERE po.agente_id = $1 AND po.estado = 'cubierto'
       LIMIT 1`,
      [emp.employee_id]
    );
    const puesto = poRows[0] ?? null;

    let gps: { latitud: number; longitud: number; radio_metros: number } | null = null;
    if (puesto?.id) {
      const { rows: gpsRows } = await pool.query(
        `SELECT latitud, longitud, radio_metros FROM puestos_gps WHERE puesto_id = $1`,
        [puesto.id]
      );
      if (gpsRows[0]) {
        gps = {
          latitud: Number(gpsRows[0].latitud),
          longitud: Number(gpsRows[0].longitud),
          radio_metros: gpsRows[0].radio_metros,
        };
      }
    }

    let armamento: { codigo: string; descripcion: string } | null = null;
    if (puesto?.id) {
      const { rows: armaRows } = await pool.query(
        `SELECT codigo, CONCAT(marca, ' ', modelo, ' ', calibre) AS descripcion
         FROM armas
         WHERE puesto_id = $1 AND activo = TRUE
         LIMIT 1`,
        [puesto.id]
      );
      if (armaRows[0]) armamento = armaRows[0];
    }

    const { rows: dupRows } = await pool.query(
      `SELECT id FROM agente_fichajes
       WHERE employee_id = $1
         AND tipo = 'fichaje'
         AND DATE(registrado_en AT TIME ZONE 'America/Guatemala') = CURRENT_DATE AT TIME ZONE 'America/Guatemala'
       LIMIT 1`,
      [emp.employee_id]
    );

    res.json({
      employee_id: emp.employee_id,
      nombre_completo: emp.nombre_completo,
      cargo: emp.cargo,
      tipo_personal: emp.tipo_personal,
      dpi: emp.dpi,
      puesto,
      gps,
      armamento,
      ya_ficho_hoy: dupRows.length > 0,
    });
  } catch (err) {
    logger.error({ err }, "agente/scan: error");
    res.status(500).json({ error: "Error al verificar token" });
  }
});

// POST /api/agente/fichaje — registrar fichaje (requiere dispositivo tipo 'puesto')
agenteFichajeRouter.post("/agente/fichaje", async (req, res) => {
  const { token, latitud, longitud, precision_metros, device_uuid, device_token } = req.body;
  if (!token) return res.status(400).json({ error: "token requerido" });

  // 1. Validar dispositivo de puesto
  if (!device_uuid || !device_token) {
    return res.status(401).json({ error: "dispositivo_no_autorizado", mensaje: "Este teléfono no está registrado como dispositivo de puesto" });
  }
  try {
    const { rows: devRows } = await pool.query(
      `SELECT id, tipo, device_token_hash, activo FROM supervisor_devices
       WHERE device_uuid = $1 AND activo = TRUE`,
      [device_uuid]
    );
    if (!devRows[0] || devRows[0].device_token_hash !== hashToken(device_token)) {
      return res.status(403).json({ error: "dispositivo_no_autorizado", mensaje: "Dispositivo no autorizado o token incorrecto" });
    }
    if (!["puesto", "maestro"].includes(devRows[0].tipo)) {
      return res.status(403).json({ error: "tipo_incorrecto", mensaje: "Este dispositivo no está configurado para registrar fichajes" });
    }
    const deviceId = devRows[0].id;
    await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [deviceId]);

    // 2. Obtener empleado y puesto
    const { rows: tkRows } = await pool.query(
      `SELECT aqt.employee_id, aqt.activo FROM agente_qr_tokens aqt WHERE aqt.qr_token = $1`,
      [token]
    );
    if (!tkRows[0] || !tkRows[0].activo) return res.status(404).json({ error: "QR no válido" });
    const employeeId = tkRows[0].employee_id;

    const { rows: poRows } = await pool.query(
      `SELECT po.id FROM puestos_operativos po
       WHERE po.agente_id = $1 AND po.estado = 'cubierto' LIMIT 1`,
      [employeeId]
    );
    const puestoId = poRows[0]?.id ?? null;

    // 3. Verificar duplicado del día
    const { rows: dupRows } = await pool.query(
      `SELECT id FROM agente_fichajes
       WHERE employee_id = $1
         AND tipo = 'fichaje'
         AND DATE(registrado_en AT TIME ZONE 'America/Guatemala') = CURRENT_DATE AT TIME ZONE 'America/Guatemala'`,
      [employeeId]
    );
    if (dupRows.length > 0) {
      return res.status(409).json({ error: "ya_registrado", mensaje: "Ya existe un fichaje para hoy" });
    }

    // 4. Validar GPS
    let resultado = "sin_gps";
    let distanciaMetros: number | null = null;

    if (latitud != null && longitud != null && puestoId) {
      const { rows: gpsRows } = await pool.query(
        `SELECT latitud, longitud, radio_metros FROM puestos_gps WHERE puesto_id = $1`,
        [puestoId]
      );
      if (gpsRows[0]) {
        distanciaMetros = Math.round(
          haversineMetros(Number(latitud), Number(longitud),
            Number(gpsRows[0].latitud), Number(gpsRows[0].longitud))
        );
        resultado = distanciaMetros <= gpsRows[0].radio_metros ? "ok" : "fuera_de_zona";
      } else {
        resultado = "ok";
      }
    } else if (latitud != null && longitud != null) {
      resultado = "ok";
    }

    if (resultado === "fuera_de_zona") {
      return res.status(403).json({
        error: "fuera_de_zona",
        distancia_metros: distanciaMetros,
        mensaje: `Estás a ${distanciaMetros} m del puesto. Debes estar dentro del radio permitido.`,
      });
    }

    // 5. Registrar fichaje
    const { rows: inserted } = await pool.query(
      `INSERT INTO agente_fichajes
         (employee_id, puesto_id, qr_token, latitud, longitud, distancia_metros, resultado, tipo, supervisor_device_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'fichaje',$8)
       RETURNING id, registrado_en`,
      [employeeId, puestoId, token,
       latitud ?? null, longitud ?? null, distanciaMetros, resultado, deviceId]
    );

    res.json({
      ok: true,
      fichaje_id: inserted[0].id,
      resultado,
      distancia_metros: distanciaMetros,
      registrado_en: inserted[0].registrado_en,
    });
  } catch (err) {
    logger.error({ err }, "agente/fichaje: error");
    res.status(500).json({ error: "Error registrando fichaje" });
  }
});

// POST /api/agente/supervision — registrar supervisión (requiere dispositivo tipo 'supervisor')
agenteFichajeRouter.post("/agente/supervision", async (req, res) => {
  const { token, checks, calificacion, observaciones, latitud, longitud, device_uuid, device_token } = req.body;
  if (!token) return res.status(400).json({ error: "token requerido" });

  // Validar dispositivo de supervisor
  if (!device_uuid || !device_token) {
    return res.status(401).json({ error: "dispositivo_no_autorizado", mensaje: "Este teléfono no está registrado como dispositivo de supervisor" });
  }

  try {
    const { rows: devRows } = await pool.query(
      `SELECT id, tipo, device_token_hash, supervisor_nombre, activo
       FROM supervisor_devices WHERE device_uuid = $1 AND activo = TRUE`,
      [device_uuid]
    );
    if (!devRows[0] || devRows[0].device_token_hash !== hashToken(device_token)) {
      return res.status(403).json({ error: "dispositivo_no_autorizado", mensaje: "Dispositivo no autorizado o token incorrecto" });
    }
    if (!["supervisor", "maestro"].includes(devRows[0].tipo)) {
      return res.status(403).json({ error: "tipo_incorrecto", mensaje: "Este dispositivo no está configurado para supervisiones" });
    }
    const deviceId = devRows[0].id;
    const supervisorNombre = devRows[0].supervisor_nombre;
    await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [deviceId]);

    // Obtener empleado
    const { rows: tkRows } = await pool.query(
      `SELECT aqt.employee_id, aqt.activo FROM agente_qr_tokens aqt WHERE aqt.qr_token = $1`,
      [token]
    );
    if (!tkRows[0] || !tkRows[0].activo) return res.status(404).json({ error: "QR no válido" });
    const employeeId = tkRows[0].employee_id;

    const { rows: poRows } = await pool.query(
      `SELECT id FROM puestos_operativos WHERE agente_id = $1 AND estado = 'cubierto' LIMIT 1`,
      [employeeId]
    );
    const puestoId = poRows[0]?.id ?? null;

    let distanciaMetros: number | null = null;
    if (latitud != null && longitud != null && puestoId) {
      const { rows: gpsRows } = await pool.query(
        `SELECT latitud, longitud FROM puestos_gps WHERE puesto_id = $1`,
        [puestoId]
      );
      if (gpsRows[0]) {
        distanciaMetros = Math.round(
          haversineMetros(Number(latitud), Number(longitud),
            Number(gpsRows[0].latitud), Number(gpsRows[0].longitud))
        );
      }
    }

    const { rows: inserted } = await pool.query(
      `INSERT INTO agente_fichajes
         (employee_id, puesto_id, qr_token, latitud, longitud, distancia_metros,
          resultado, tipo, supervisor_nombre, supervisor_device_id, checks, calificacion, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,'ok','supervision',$7,$8,$9,$10,$11)
       RETURNING id, registrado_en`,
      [
        employeeId, puestoId, token,
        latitud ?? null, longitud ?? null, distanciaMetros,
        supervisorNombre, deviceId,
        checks ? JSON.stringify(checks) : null,
        calificacion ?? null, observaciones ?? null,
      ]
    );

    res.json({
      ok: true,
      supervision_id: inserted[0].id,
      registrado_en: inserted[0].registrado_en,
    });
  } catch (err) {
    logger.error({ err }, "agente/supervision: error");
    res.status(500).json({ error: "Error registrando supervisión" });
  }
});

// POST /api/agente/ronda-check — marcar ronda en puesto (solo dispositivo maestro)
agenteFichajeRouter.post("/agente/ronda-check", async (req, res) => {
  const { token, latitud, longitud, device_uuid, device_token, observaciones } = req.body;
  if (!token) return res.status(400).json({ error: "token requerido" });
  if (!device_uuid || !device_token) {
    return res.status(401).json({ error: "dispositivo_no_autorizado" });
  }
  try {
    const { rows: devRows } = await pool.query(
      `SELECT id, tipo, device_token_hash, supervisor_nombre, activo
       FROM supervisor_devices WHERE device_uuid = $1 AND activo = TRUE`,
      [device_uuid]
    );
    if (!devRows[0] || devRows[0].device_token_hash !== hashToken(device_token)) {
      return res.status(403).json({ error: "dispositivo_no_autorizado" });
    }
    if (devRows[0].tipo !== "maestro") {
      return res.status(403).json({ error: "tipo_incorrecto", mensaje: "Solo el dispositivo maestro puede marcar rondas desde una credencial de agente" });
    }
    const deviceId = devRows[0].id;
    const supervisorNombre = devRows[0].supervisor_nombre;
    await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [deviceId]);

    const { rows: tkRows } = await pool.query(
      `SELECT aqt.employee_id, aqt.activo FROM agente_qr_tokens aqt WHERE aqt.qr_token = $1`,
      [token]
    );
    if (!tkRows[0] || !tkRows[0].activo) return res.status(404).json({ error: "QR no válido" });
    const employeeId = tkRows[0].employee_id;

    const { rows: poRows } = await pool.query(
      `SELECT id FROM puestos_operativos WHERE agente_id = $1 AND estado = 'cubierto' LIMIT 1`,
      [employeeId]
    );
    const puestoId = poRows[0]?.id ?? null;

    let distanciaMetros: number | null = null;
    if (latitud != null && longitud != null && puestoId) {
      const { rows: gpsRows } = await pool.query(
        `SELECT latitud, longitud FROM puestos_gps WHERE puesto_id = $1`,
        [puestoId]
      );
      if (gpsRows[0]) {
        distanciaMetros = Math.round(
          haversineMetros(Number(latitud), Number(longitud),
            Number(gpsRows[0].latitud), Number(gpsRows[0].longitud))
        );
      }
    }

    const { rows: inserted } = await pool.query(
      `INSERT INTO agente_fichajes
         (employee_id, puesto_id, qr_token, latitud, longitud, distancia_metros,
          resultado, tipo, supervisor_nombre, supervisor_device_id, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,'ok','ronda',$7,$8,$9)
       RETURNING id, registrado_en`,
      [employeeId, puestoId, token,
       latitud ?? null, longitud ?? null, distanciaMetros,
       supervisorNombre, deviceId, observaciones ?? null]
    );

    res.json({ ok: true, ronda_id: inserted[0].id, registrado_en: inserted[0].registrado_en });
  } catch (err) {
    logger.error({ err }, "agente/ronda-check: error");
    res.status(500).json({ error: "Error registrando ronda" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — gestión de tokens de agentes y consulta de fichajes
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/agente/tokens
agenteFichajeRouter.get("/agente/tokens", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.id AS employee_id, e.nombre_completo, e.puesto AS cargo,
             e.tipo_personal, e.estado_laboral,
             aqt.id AS token_id, aqt.qr_token, aqt.activo, aqt.created_at,
             po.nombre AS puesto_nombre, po.cliente_nombre
      FROM employees e
      LEFT JOIN agente_qr_tokens aqt ON aqt.employee_id = e.id AND aqt.activo = TRUE
      LEFT JOIN puestos_operativos po ON po.agente_id = e.id AND po.estado = 'cubierto'
      WHERE e.estado_laboral = 'activo'
        AND COALESCE(e.tipo_personal, 'guardia') NOT IN ('administrativo', 'supervisor_externo')
      ORDER BY e.nombre_completo
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "agente/tokens GET: error");
    res.status(500).json({ error: "Error obteniendo tokens" });
  }
});

// POST /api/agente/tokens/generate
agenteFichajeRouter.post("/agente/tokens/generate", async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "employee_id requerido" });
  try {
    await pool.query(
      `UPDATE agente_qr_tokens SET activo = FALSE WHERE employee_id = $1`,
      [employee_id]
    );
    const token = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO agente_qr_tokens (employee_id, qr_token, activo)
       VALUES ($1,$2,TRUE) RETURNING id, qr_token, created_at`,
      [employee_id, token]
    );
    res.json({ ok: true, token: rows[0] });
  } catch (err) {
    logger.error({ err }, "agente/tokens/generate: error");
    res.status(500).json({ error: "Error generando token" });
  }
});

// DELETE /api/agente/tokens/:id
agenteFichajeRouter.delete("/agente/tokens/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE agente_qr_tokens SET activo = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error revocando token" });
  }
});

// GET /api/agente/fichajes
agenteFichajeRouter.get("/agente/fichajes", async (req, res) => {
  const { tipo, employee_id, fecha_desde, fecha_hasta, limit = "50" } = req.query as Record<string, string>;
  try {
    const params: (string | number)[] = [];
    const clauses: string[] = [];

    if (tipo) { params.push(tipo); clauses.push(`af.tipo = $${params.length}`); }
    if (employee_id) { params.push(Number(employee_id)); clauses.push(`af.employee_id = $${params.length}`); }
    if (fecha_desde) { params.push(fecha_desde); clauses.push(`af.registrado_en >= $${params.length}`); }
    if (fecha_hasta) { params.push(fecha_hasta); clauses.push(`af.registrado_en <= $${params.length}`); }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(Number(limit));

    const { rows } = await pool.query(`
      SELECT af.id, af.tipo, af.resultado, af.distancia_metros,
             af.calificacion, af.checks, af.observaciones,
             af.registrado_en, af.supervisor_nombre,
             e.nombre_completo, e.puesto AS cargo,
             po.nombre AS puesto_nombre, po.cliente_nombre,
             sd.tipo AS device_tipo, sd.descripcion AS device_descripcion
      FROM agente_fichajes af
      JOIN employees e ON e.id = af.employee_id
      LEFT JOIN puestos_operativos po ON po.id = af.puesto_id
      LEFT JOIN supervisor_devices sd ON sd.id = af.supervisor_device_id
      ${where}
      ORDER BY af.registrado_en DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "agente/fichajes GET: error");
    res.status(500).json({ error: "Error obteniendo fichajes" });
  }
});

// GET /api/puestos-gps
agenteFichajeRouter.get("/puestos-gps", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT po.id, po.nombre, po.cliente_nombre, po.agente_nombre, po.estado,
             pg.id AS gps_id, pg.latitud, pg.longitud, pg.radio_metros, pg.updated_at
      FROM puestos_operativos po
      LEFT JOIN puestos_gps pg ON pg.puesto_id = po.id
      WHERE po.estado = 'cubierto'
      ORDER BY po.cliente_nombre, po.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo puestos GPS" });
  }
});

// PUT /api/puestos-gps/:puesto_id
agenteFichajeRouter.put("/puestos-gps/:puesto_id", async (req, res) => {
  const { latitud, longitud, radio_metros = 50 } = req.body;
  const puestoId = Number(req.params.puesto_id);
  if (!latitud || !longitud) return res.status(400).json({ error: "latitud y longitud requeridos" });
  try {
    await pool.query(`
      INSERT INTO puestos_gps (puesto_id, latitud, longitud, radio_metros, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (puesto_id)
      DO UPDATE SET latitud=$2, longitud=$3, radio_metros=$4, updated_at=NOW()
    `, [puestoId, latitud, longitud, radio_metros]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error guardando GPS del puesto" });
  }
});
