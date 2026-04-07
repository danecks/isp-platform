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
              sd.device_token_hash,
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
             po.nombre AS puesto_nombre, po.cliente_nombre, po.novedad
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

// PATCH /api/agente/puesto-novedad/:puestoId — actualizar novedad visible al agente (admin)
agenteFichajeRouter.patch("/agente/puesto-novedad/:puestoId", async (req, res) => {
  const puestoId = parseInt(req.params.puestoId, 10);
  if (isNaN(puestoId)) return res.status(400).json({ error: "puestoId inválido" });
  const { novedad } = req.body;
  try {
    const { rowCount } = await pool.query(
      `UPDATE puestos_operativos SET novedad = $1 WHERE id = $2`,
      [novedad ?? null, puestoId]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "puesto-novedad PATCH: error");
    res.status(500).json({ error: "Error actualizando novedad" });
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

// POST /api/supervisor-devices/:id/regenerate-token — genera nuevo token para un dispositivo existente (admin)
agenteFichajeRouter.post("/supervisor-devices/:id/regenerate-token", async (req, res) => {
  try {
    const plainToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(plainToken);
    const { rows } = await pool.query(
      `UPDATE supervisor_devices
       SET device_token_hash = $1, activo = TRUE
       WHERE id = $2
       RETURNING id, device_uuid, supervisor_nombre, descripcion, tipo, puesto_id, activo, created_at, ultimo_uso`,
      [tokenHash, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Dispositivo no encontrado" });
    res.json({ ok: true, device: rows[0], device_token: plainToken });
  } catch (err) {
    logger.error({ err }, "supervisor-devices/regenerate-token: error");
    res.status(500).json({ error: "Error regenerando token" });
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
              po.hora_entrada, po.hora_salida, po.turno, po.jornada, po.novedad
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

    let armamento: {
      arma_id: number | null;
      codigo: string; descripcion: string; serie: string | null; activo: boolean;
      numero_portacion: string | null; fecha_vencimiento_portacion: string | null;
      numero_tenencia: string | null; fecha_vencimiento_tenencia: string | null;
    } | null = null;
    if (puesto?.id) {
      const { rows: armaRows } = await pool.query(
        `SELECT id AS arma_id,
                codigo,
                CONCAT(COALESCE(marca,''), ' ', COALESCE(modelo,''), ' ', COALESCE(calibre,'')) AS descripcion,
                serie, activo,
                numero_portacion, fecha_vencimiento_portacion,
                numero_tenencia, fecha_vencimiento_tenencia
         FROM armas
         WHERE puesto_id = $1
         ORDER BY activo DESC
         LIMIT 1`,
        [puesto.id]
      );
      if (armaRows[0]) {
        armamento = {
          ...armaRows[0],
          activo: armaRows[0].activo === true,
          fecha_vencimiento_portacion: armaRows[0].fecha_vencimiento_portacion
            ? new Date(armaRows[0].fecha_vencimiento_portacion).toISOString().split("T")[0] : null,
          fecha_vencimiento_tenencia: armaRows[0].fecha_vencimiento_tenencia
            ? new Date(armaRows[0].fecha_vencimiento_tenencia).toISOString().split("T")[0] : null,
        };
      }
    }

    // Relevo anterior: último fichaje en este puesto de un agente diferente
    let relevo: { nombre: string; registrado_en: string } | null = null;
    // Próximo relevo: otro titular activo del mismo puesto
    let proximo_relevo: { nombre: string; cargo: string } | null = null;
    if (puesto?.id) {
      const { rows: releRows } = await pool.query(
        `SELECT e.nombre_completo AS nombre, af.registrado_en
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
         WHERE af.puesto_id = $1
           AND af.employee_id != $2
           AND af.tipo = 'fichaje'
         ORDER BY af.registrado_en DESC
         LIMIT 1`,
        [puesto.id, emp.employee_id]
      );
      if (releRows[0]) relevo = { nombre: releRows[0].nombre, registrado_en: releRows[0].registrado_en };

      // Próximo relevo desde puesto_titulares (el otro titular del puesto)
      const { rows: proxRows } = await pool.query(
        `SELECT e.nombre_completo AS nombre, e.puesto AS cargo
         FROM puesto_titulares pt
         JOIN employees e ON e.id = pt.employee_id
         WHERE pt.puesto_id = $1
           AND pt.employee_id != $2
           AND pt.activo = TRUE
         ORDER BY pt.orden
         LIMIT 1`,
        [puesto.id, emp.employee_id]
      );
      if (proxRows[0]) proximo_relevo = proxRows[0];
    }

    // Munición asignada al puesto
    let municion: { id: number; descripcion: string; cantidad_asignada: number } | null = null;
    if (puesto?.id) {
      const { rows: munRows } = await pool.query(
        `SELECT id, descripcion, cantidad_asignada FROM puesto_municion WHERE puesto_id = $1 AND activo = TRUE LIMIT 1`,
        [puesto.id]
      );
      if (munRows[0]) municion = munRows[0];
    }

    // Tallas disponibles en bodega para botas y uniformes
    let bodega_tallas_botas: string[] = [];
    let bodega_tallas_uniforme: string[] = [];
    try {
      const { rows: tallasBotas } = await pool.query(
        `SELECT DISTINCT bu.talla
         FROM bodega_unidades bu
         JOIN bodega_articulos ba ON ba.id = bu.articulo_id
         WHERE ba.tipo_equipo = 'botas'
           AND bu.estado = 'disponible'
           AND bu.talla IS NOT NULL
         ORDER BY bu.talla`
      );
      bodega_tallas_botas = tallasBotas.map((r: any) => r.talla);

      const { rows: tallasUnif } = await pool.query(
        `SELECT DISTINCT bu.talla
         FROM bodega_unidades bu
         JOIN bodega_articulos ba ON ba.id = bu.articulo_id
         WHERE ba.tipo_equipo = 'uniforme'
           AND bu.estado = 'disponible'
           AND bu.talla IS NOT NULL
         ORDER BY bu.talla`
      );
      bodega_tallas_uniforme = tallasUnif.map((r: any) => r.talla);
    } catch (_) { /* tabla puede no existir aún */ }

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
      relevo,
      proximo_relevo,
      municion,
      bodega_tallas_botas,
      bodega_tallas_uniforme,
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

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE DE TURNO — agente/supervisor reportan arma, munición y uniforme
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/agente/reporte-turno
agenteFichajeRouter.post("/agente/reporte-turno", async (req, res) => {
  const {
    fichaje_id, puesto_id, employee_id, tipo = "fichaje",
    arma_id, arma_estado, arma_observacion,
    municion_ok, municion_faltante = 0,
    uniforme_ok, uniforme_items_faltantes,
    device_uuid, device_token,
  } = req.body;

  if (!fichaje_id || !employee_id) {
    return res.status(400).json({ error: "fichaje_id y employee_id requeridos" });
  }

  try {
    // Validar dispositivo (reutiliza lógica existente)
    if (device_uuid && device_token) {
      const { rows: devRows } = await pool.query(
        `SELECT id FROM supervisor_devices WHERE device_uuid = $1 AND activo = TRUE`,
        [device_uuid]
      );
      if (!devRows[0]) return res.status(403).json({ error: "Dispositivo no autorizado" });
      const dev = devRows[0];
      const { rows: devFull } = await pool.query(
        `SELECT device_token_hash FROM supervisor_devices WHERE id = $1`,
        [dev.id]
      );
      if (devFull[0]?.device_token_hash !== hashToken(device_token)) {
        return res.status(403).json({ error: "Token de dispositivo incorrecto" });
      }
    }

    // Identificar responsable anterior de munición (último que reportó municion_ok=true en este puesto)
    let municion_responsable_anterior: number | null = null;
    if (municion_ok === false && puesto_id) {
      const { rows: prevRows } = await pool.query(
        `SELECT rt.employee_id
         FROM reporte_turno rt
         WHERE rt.puesto_id = $1
           AND rt.municion_ok = TRUE
         ORDER BY rt.registrado_en DESC
         LIMIT 1`,
        [puesto_id]
      );
      if (prevRows[0]) municion_responsable_anterior = prevRows[0].employee_id;
    }

    const { rows } = await pool.query(
      `INSERT INTO reporte_turno
         (fichaje_id, puesto_id, employee_id, tipo,
          arma_id, arma_estado, arma_observacion,
          municion_ok, municion_faltante, municion_responsable_anterior,
          uniforme_ok, uniforme_items_faltantes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        fichaje_id, puesto_id ?? null, employee_id, tipo,
        arma_id ?? null, arma_estado ?? null, arma_observacion ?? null,
        municion_ok ?? null, Number(municion_faltante),
        municion_responsable_anterior,
        uniforme_ok ?? null,
        uniforme_items_faltantes ? JSON.stringify(uniforme_items_faltantes) : null,
      ]
    );

    // Nombre del responsable anterior (para responder al frontend)
    let responsable_anterior_nombre: string | null = null;
    if (municion_responsable_anterior) {
      const { rows: respRows } = await pool.query(
        `SELECT nombre_completo FROM employees WHERE id = $1`,
        [municion_responsable_anterior]
      );
      responsable_anterior_nombre = respRows[0]?.nombre_completo ?? null;
    }

    res.json({
      ok: true,
      reporte_id: rows[0].id,
      municion_responsable_anterior,
      responsable_anterior_nombre,
    });
  } catch (err) {
    logger.error({ err }, "reporte-turno POST: error");
    res.status(500).json({ error: "Error guardando reporte de turno" });
  }
});

// GET /api/agente/reportes-turno — listado para el panel admin
agenteFichajeRouter.get("/agente/reportes-turno", async (req, res) => {
  const { puesto_id, fecha_desde, fecha_hasta, solo_alertas, limit = "100" } = req.query as Record<string, string>;
  try {
    const params: (string | number)[] = [];
    const clauses: string[] = [];

    if (puesto_id) { params.push(Number(puesto_id)); clauses.push(`rt.puesto_id = $${params.length}`); }
    if (fecha_desde) { params.push(fecha_desde); clauses.push(`rt.registrado_en >= $${params.length}`); }
    if (fecha_hasta) { params.push(fecha_hasta); clauses.push(`rt.registrado_en <= $${params.length}`); }
    if (solo_alertas === "true") {
      clauses.push(`(rt.municion_ok = FALSE OR rt.arma_estado = 'necesita_reparacion' OR rt.uniforme_ok = FALSE)`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(Number(limit));

    const { rows } = await pool.query(`
      SELECT rt.*,
             e.nombre_completo AS agente_nombre,
             e.puesto AS agente_cargo,
             po.nombre AS puesto_nombre, po.cliente_nombre,
             resp.nombre_completo AS responsable_anterior_nombre
      FROM reporte_turno rt
      LEFT JOIN employees e ON e.id = rt.employee_id
      LEFT JOIN puestos_operativos po ON po.id = rt.puesto_id
      LEFT JOIN employees resp ON resp.id = rt.municion_responsable_anterior
      ${where}
      ORDER BY rt.registrado_en DESC
      LIMIT $${params.length}
    `, params);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "reportes-turno GET: error");
    res.status(500).json({ error: "Error obteniendo reportes" });
  }
});

// ── Munición por puesto (gestión admin) ───────────────────────────────────────

// GET /api/municion-puestos
agenteFichajeRouter.get("/municion-puestos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pm.id, pm.puesto_id, pm.descripcion, pm.cantidad_asignada, pm.activo, pm.updated_at,
             po.nombre AS puesto_nombre, po.cliente_nombre
      FROM puesto_municion pm
      JOIN puestos_operativos po ON po.id = pm.puesto_id
      ORDER BY po.cliente_nombre, po.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo munición por puesto" });
  }
});

// POST /api/municion-puestos
agenteFichajeRouter.post("/municion-puestos", async (req, res) => {
  const { puesto_id, descripcion = "9mm Luger", cantidad_asignada } = req.body;
  if (!puesto_id || cantidad_asignada == null) return res.status(400).json({ error: "puesto_id y cantidad_asignada requeridos" });
  try {
    const { rows } = await pool.query(`
      INSERT INTO puesto_municion (puesto_id, descripcion, cantidad_asignada)
      VALUES ($1,$2,$3)
      ON CONFLICT ON CONSTRAINT pm_puesto_activo
      DO UPDATE SET descripcion=$2, cantidad_asignada=$3, updated_at=NOW()
      RETURNING *
    `, [puesto_id, descripcion, cantidad_asignada]);
    res.json({ ok: true, municion: rows[0] });
  } catch (err) {
    logger.error({ err }, "municion-puestos POST: error");
    res.status(500).json({ error: "Error guardando munición" });
  }
});

// DELETE /api/municion-puestos/:id
agenteFichajeRouter.delete("/municion-puestos/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE puesto_municion SET activo = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando munición" });
  }
});
