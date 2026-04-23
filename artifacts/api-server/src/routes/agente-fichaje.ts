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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
              sd.cliente_id, sd.slot_numero, sd.device_token_hash,
              po.nombre AS puesto_nombre,
              COALESCE(po.cliente_nombre, c.nombre_comercial, c.nombre) AS cliente_nombre
       FROM supervisor_devices sd
       LEFT JOIN puestos_operativos po ON po.id = sd.puesto_id
       LEFT JOIN clients c ON c.id = sd.cliente_id
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
      cliente_id: dev.cliente_id,
      slot_numero: dev.slot_numero,
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
             sd.tipo, sd.puesto_id, sd.cliente_id, sd.slot_numero,
             sd.activo, sd.ultimo_uso, sd.created_at,
             (sd.device_token_hash IS NOT NULL) AS tiene_token,
             po.nombre AS puesto_nombre,
             COALESCE(po.cliente_nombre, c.nombre_comercial, c.nombre) AS cliente_nombre,
             po.novedad
      FROM supervisor_devices sd
      LEFT JOIN puestos_operativos po ON po.id = sd.puesto_id
      LEFT JOIN clients c ON c.id = sd.cliente_id
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
  const { supervisor_nombre, descripcion, tipo = "supervisor", puesto_id, cliente_id, slot_numero } = req.body;
  if (!supervisor_nombre) return res.status(400).json({ error: "supervisor_nombre requerido" });
  if (!["supervisor", "puesto", "maestro", "custodia"].includes(tipo)) {
    return res.status(400).json({ error: "tipo debe ser 'supervisor', 'puesto', 'custodia' o 'maestro'" });
  }
  if (tipo === "custodia" && !cliente_id) {
    return res.status(400).json({ error: "cliente_id requerido para tipo 'custodia'" });
  }

  try {
    const plainToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(plainToken);
    const { rows } = await pool.query(
      `INSERT INTO supervisor_devices
         (supervisor_nombre, descripcion, tipo, puesto_id, cliente_id, slot_numero, device_token_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, device_uuid, supervisor_nombre, descripcion, tipo, puesto_id, cliente_id, slot_numero, created_at`,
      [
        supervisor_nombre,
        descripcion ?? null,
        tipo,
        tipo === "puesto" ? (puesto_id ?? null) : null,
        tipo === "custodia" ? (cliente_id ?? null) : null,
        tipo === "custodia" ? (slot_numero ?? null) : null,
        tokenHash,
      ]
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

// PATCH /api/supervisor-devices/:id — editar dispositivo existente (admin)
// Permite cambiar tipo, puesto/cliente/slot, nombre, descripción. NO regenera el token.
agenteFichajeRouter.patch("/supervisor-devices/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  const { supervisor_nombre, descripcion, tipo, puesto_id, cliente_id, slot_numero } = req.body ?? {};
  if (tipo && !["supervisor", "puesto", "maestro", "custodia"].includes(tipo)) {
    return res.status(400).json({ error: "tipo inválido" });
  }
  if (tipo === "custodia" && !cliente_id) {
    return res.status(400).json({ error: "cliente_id requerido para tipo 'custodia'" });
  }
  try {
    // Cargar el actual para conservar lo que no se manda
    const { rows: cur } = await pool.query(
      `SELECT supervisor_nombre, descripcion, tipo, puesto_id, cliente_id, slot_numero
         FROM supervisor_devices WHERE id = $1`,
      [id]
    );
    if (!cur[0]) return res.status(404).json({ error: "dispositivo_no_encontrado" });
    const next = {
      supervisor_nombre: supervisor_nombre ?? cur[0].supervisor_nombre,
      descripcion: descripcion !== undefined ? descripcion : cur[0].descripcion,
      tipo: tipo ?? cur[0].tipo,
      puesto_id: puesto_id !== undefined ? puesto_id : cur[0].puesto_id,
      cliente_id: cliente_id !== undefined ? cliente_id : cur[0].cliente_id,
      slot_numero: slot_numero !== undefined ? slot_numero : cur[0].slot_numero,
    };
    // Saneo según el tipo final
    if (next.tipo === "puesto") {
      next.cliente_id = null;
      next.slot_numero = null;
    } else if (next.tipo === "custodia") {
      next.puesto_id = null;
    } else {
      next.puesto_id = null;
      next.cliente_id = null;
      next.slot_numero = null;
    }
    await pool.query(
      `UPDATE supervisor_devices
          SET supervisor_nombre = $1, descripcion = $2, tipo = $3,
              puesto_id = $4, cliente_id = $5, slot_numero = $6
        WHERE id = $7`,
      [next.supervisor_nombre, next.descripcion, next.tipo,
       next.puesto_id, next.cliente_id, next.slot_numero, id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "supervisor-devices PATCH: error");
    res.status(500).json({ error: "Error actualizando dispositivo" });
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
              e.nombre_completo, e.puesto AS cargo, e.tipo_personal, e.dpi,
              e.fecha_ingreso
       FROM agente_qr_tokens aqt
       JOIN employees e ON e.id = aqt.employee_id
       WHERE aqt.qr_token = $1`,
      [token]
    );
    if (!tkRows[0]) return res.status(404).json({ error: "QR no válido" });
    if (!tkRows[0].activo) return res.status(403).json({ error: "Token desactivado" });

    const emp = tkRows[0];

    // Teléfono de emergencia / atención al cliente de la empresa (público).
    let telefono_emergencia: string | null = null;
    try {
      const { rows: cfgRows } = await pool.query(
        `SELECT telefono_empresa FROM config_empresa ORDER BY id ASC LIMIT 1`
      );
      telefono_emergencia = cfgRows[0]?.telefono_empresa ?? null;
    } catch { /* config_empresa puede no existir aún */ }

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
      fecha_ingreso: emp.fecha_ingreso
        ? new Date(emp.fecha_ingreso).toISOString().split("T")[0]
        : null,
      telefono_emergencia,
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

// GET /api/agente/puesto-del-dia — modo kiosco: teléfono vinculado a un puesto
// devuelve la info del puesto + lista de agentes que deben trabajar hoy + quién ya inició turno.
agenteFichajeRouter.get("/agente/puesto-del-dia", async (req, res) => {
  const device_uuid = String(req.query.device_uuid ?? "");
  const device_token = String(req.query.device_token ?? "");
  if (!device_uuid || !device_token) {
    return res.status(400).json({ error: "device_credentials_requeridas" });
  }
  if (!UUID_RE.test(device_uuid)) {
    return res.status(403).json({ error: "dispositivo_no_autorizado" });
  }
  try {
    const { rows: devRows } = await pool.query(
      `SELECT sd.id, sd.tipo, sd.device_token_hash, sd.puesto_id, sd.cliente_id, sd.slot_numero, sd.activo,
              po.nombre AS puesto_nombre, po.horario, po.turno,
              COALESCE(po.cliente_nombre, c.nombre_comercial, c.nombre) AS cliente_nombre
         FROM supervisor_devices sd
         LEFT JOIN puestos_operativos po ON po.id = sd.puesto_id
         LEFT JOIN clients c ON c.id = sd.cliente_id
        WHERE sd.device_uuid = $1`,
      [device_uuid]
    );
    if (!devRows[0] || !devRows[0].activo) {
      return res.status(403).json({ error: "dispositivo_no_autorizado" });
    }
    if (devRows[0].device_token_hash !== hashToken(device_token)) {
      return res.status(403).json({ error: "token_incorrecto" });
    }
    if (!["puesto", "maestro", "custodia"].includes(devRows[0].tipo)) {
      return res.status(403).json({ error: "tipo_incorrecto", mensaje: "Este dispositivo no está configurado como teléfono de puesto o de custodia." });
    }

    await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [devRows[0].id]);

    // ── Modo custodia: lista de titulares del slot (o de todos los slots del cliente si no hay slot específico) ──
    if (devRows[0].tipo === "custodia") {
      if (!devRows[0].cliente_id) {
        return res.status(404).json({ error: "sin_cliente_vinculado", mensaje: "El teléfono no está vinculado a un cliente." });
      }
      const params: any[] = [devRows[0].cliente_id];
      let slotFilter = "";
      if (devRows[0].slot_numero != null) {
        params.push(devRows[0].slot_numero);
        slotFilter = ` AND ct.slot_numero = $2`;
      }
      const { rows: ctRows } = await pool.query(
        `SELECT ct.employee_id,
                e.nombre_completo,
                e.puesto AS cargo,
                ct.slot_numero,
                af.id AS fichaje_id,
                af.registrado_en
           FROM custodia_titulares ct
           JOIN employees e ON e.id = ct.employee_id
           LEFT JOIN LATERAL (
             SELECT id, registrado_en
               FROM agente_fichajes
              WHERE employee_id = ct.employee_id
                AND tipo = 'inicio_turno'
                AND DATE((registrado_en AT TIME ZONE 'America/Guatemala')) =
                    DATE((NOW() AT TIME ZONE 'America/Guatemala'))
              ORDER BY registrado_en DESC LIMIT 1
           ) af ON TRUE
          WHERE ct.cliente_id = $1
            AND ct.activo = TRUE${slotFilter}
          ORDER BY ct.slot_numero ASC, e.nombre_completo ASC`,
        params
      );
      return res.json({
        puesto: {
          id: null,
          nombre: devRows[0].slot_numero != null
            ? `Custodio ${devRows[0].slot_numero}`
            : "Custodios",
          cliente_nombre: devRows[0].cliente_nombre,
          horario: null,
          turno: "Custodia",
          es_custodia: true,
          cliente_id: devRows[0].cliente_id,
          slot_numero: devRows[0].slot_numero,
        },
        agentes: ctRows.map(r => ({
          employee_id: r.employee_id,
          nombre: r.nombre_completo,
          cargo: r.cargo,
          orden: r.slot_numero,
          inicio_turno_hoy: r.registrado_en
            ? { fichaje_id: r.fichaje_id, registrado_en: r.registrado_en }
            : null,
        })),
      });
    }

    // ── Modo puesto/maestro ──
    if (!devRows[0].puesto_id) {
      return res.status(404).json({ error: "sin_puesto_vinculado", mensaje: "El teléfono no está vinculado a un puesto." });
    }
    const puestoId = devRows[0].puesto_id;

    // Lista de titulares activos del puesto + estado de inicio_turno hoy
    const { rows: titRows } = await pool.query(
      `SELECT pt.employee_id,
              e.nombre_completo,
              e.puesto AS cargo,
              pt.orden,
              af.id AS fichaje_id,
              af.registrado_en
         FROM puesto_titulares pt
         JOIN employees e ON e.id = pt.employee_id
         LEFT JOIN LATERAL (
           SELECT id, registrado_en
             FROM agente_fichajes
            WHERE employee_id = pt.employee_id
              AND tipo = 'inicio_turno'
              AND DATE((registrado_en AT TIME ZONE 'America/Guatemala')) =
                  DATE((NOW() AT TIME ZONE 'America/Guatemala'))
            ORDER BY registrado_en DESC LIMIT 1
         ) af ON TRUE
        WHERE pt.puesto_id = $1
          AND pt.activo = TRUE
        ORDER BY pt.orden ASC, e.nombre_completo ASC`,
      [puestoId]
    );

    res.json({
      puesto: {
        id: puestoId,
        nombre: devRows[0].puesto_nombre,
        cliente_nombre: devRows[0].cliente_nombre,
        horario: devRows[0].horario,
        turno: devRows[0].turno,
        es_custodia: false,
      },
      agentes: titRows.map(r => ({
        employee_id: r.employee_id,
        nombre: r.nombre_completo,
        cargo: r.cargo,
        orden: r.orden,
        inicio_turno_hoy: r.registrado_en
          ? { fichaje_id: r.fichaje_id, registrado_en: r.registrado_en }
          : null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "agente/puesto-del-dia: error");
    res.status(500).json({ error: "Error obteniendo puesto del día" });
  }
});

// POST /api/agente/iniciar-turno — el agente escanea su propio carnet desde la PWA
// Identidad = QR del carnet. Sin login. Resuelve el servicio del día (puesto fijo o slot de custodia)
// y registra el inicio de turno del día. GPS se valida contra el puesto si aplica.
// Si vienen device_uuid+device_token (modo kiosco), se valida que el agente pertenezca al puesto vinculado.
agenteFichajeRouter.post("/agente/iniciar-turno", async (req, res) => {
  const { qr_token, latitud, longitud, precision_metros, device_uuid, device_token } = req.body ?? {};
  if (!qr_token) return res.status(400).json({ error: "qr_token_requerido" });

  // Modo kiosco: validar device si viene
  let kioscoPuestoId: number | null = null;
  let kioscoClienteId: number | null = null;
  let kioscoSlotNumero: number | null = null;
  let kioscoTipo: string | null = null;
  if (device_uuid && device_token) {
    if (!UUID_RE.test(device_uuid)) {
      return res.status(403).json({ error: "dispositivo_no_autorizado" });
    }
    try {
      const { rows: devRows } = await pool.query(
        `SELECT id, tipo, device_token_hash, puesto_id, cliente_id, slot_numero, activo
           FROM supervisor_devices WHERE device_uuid = $1`,
        [device_uuid]
      );
      if (!devRows[0] || !devRows[0].activo) {
        return res.status(403).json({ error: "dispositivo_no_autorizado" });
      }
      if (devRows[0].device_token_hash !== hashToken(device_token)) {
        return res.status(403).json({ error: "token_incorrecto" });
      }
      if (!["puesto", "maestro", "custodia"].includes(devRows[0].tipo)) {
        return res.status(403).json({ error: "tipo_incorrecto" });
      }
      kioscoTipo = devRows[0].tipo;
      kioscoPuestoId = devRows[0].puesto_id ?? null;
      kioscoClienteId = devRows[0].cliente_id ?? null;
      kioscoSlotNumero = devRows[0].slot_numero ?? null;
    } catch (err) {
      logger.error({ err }, "agente/iniciar-turno: error validando device");
      return res.status(500).json({ error: "Error validando dispositivo" });
    }
  }

  try {
    // 1. Validar carnet → empleado
    const { rows: tkRows } = await pool.query(
      `SELECT aqt.employee_id, aqt.activo,
              e.nombre_completo, e.puesto AS cargo, e.tipo_personal, e.dpi
         FROM agente_qr_tokens aqt
         JOIN employees e ON e.id = aqt.employee_id
        WHERE aqt.qr_token = $1`,
      [qr_token]
    );
    if (!tkRows[0]) return res.status(404).json({ error: "carnet_invalido", mensaje: "Este carnet no está registrado." });
    if (!tkRows[0].activo) return res.status(403).json({ error: "carnet_desactivado", mensaje: "Este carnet está desactivado. Avise al supervisor." });
    const employeeId: number = tkRows[0].employee_id;
    const agente = {
      employee_id: employeeId,
      nombre: tkRows[0].nombre_completo,
      cargo: tkRows[0].cargo,
      tipo_personal: tkRows[0].tipo_personal,
      dpi: tkRows[0].dpi,
    };

    // 2. Duplicado del día (zona Guatemala)
    //    Solo nos interesa el último fichaje ABIERTO (no cerrado): si todos
    //    los del día ya fueron cerrados, dejamos pasar para crear un nuevo
    //    inicio_turno (caso real: se cerró por error, o el custodio sale a
    //    comer y vuelve a entrar al turno).
    const { rows: dupRows } = await pool.query(
      `SELECT id, registrado_en, cliente_id, puesto_id, tracking_token_hash,
              recorrido_padre_id, turno_cerrado_en
         FROM agente_fichajes
        WHERE employee_id = $1
          AND tipo = 'inicio_turno'
          AND turno_cerrado_en IS NULL
          AND DATE((registrado_en AT TIME ZONE 'America/Guatemala')) =
              DATE((NOW() AT TIME ZONE 'America/Guatemala'))
        ORDER BY registrado_en DESC LIMIT 1`,
      [employeeId]
    );
    if (dupRows.length > 0) {
      const fichaje = dupRows[0];
      // Co-tripulante anexado: ya marcó, no puede iniciar otro
      if (fichaje.recorrido_padre_id !== null) {
        return res.status(409).json({
          error: "ya_iniciado",
          mensaje: "Ya iniciaste tu turno hoy (anexado a otro recorrido).",
          registrado_en: fichaje.registrado_en,
        });
      }

      // ── Resolver/migrar a custodia si hoy aplica ──
      // Si el agente HOY tiene asignación de custodia (titular o pizarrón),
      // permitir reanudar/migrar el fichaje y arrancar tracking.
      const { rows: ctRows } = await pool.query(
        `SELECT ct.cliente_id, ct.slot_numero,
                COALESCE(c.nombre_comercial, c.nombre) AS cliente_nombre
           FROM custodia_titulares ct
           JOIN clients c ON c.id = ct.cliente_id
          WHERE ct.employee_id = $1 AND ct.activo = TRUE
          ORDER BY ct.slot_numero ASC LIMIT 1`,
        [employeeId]
      );
      let custodiaHoy = ctRows[0];
      if (!custodiaHoy) {
        const { rows: cadRows } = await pool.query(
          `SELECT cad.cliente_id, cad.slot_numero,
                  COALESCE(c.nombre_comercial, c.nombre) AS cliente_nombre
             FROM custodia_asignacion_diaria cad
             JOIN clients c ON c.id = cad.cliente_id
            WHERE cad.employee_id = $1
              AND cad.fecha = DATE((NOW() AT TIME ZONE 'America/Guatemala'))
            ORDER BY cad.slot_numero ASC LIMIT 1`,
          [employeeId]
        );
        custodiaHoy = cadRows[0];
      }

      const targetClienteId = custodiaHoy ? Number(custodiaHoy.cliente_id) : (fichaje.cliente_id ?? null);
      const targetClienteNombre = custodiaHoy?.cliente_nombre ?? null;
      const aplicaCustodia = targetClienteId !== null;

      if (aplicaCustodia) {
        const nuevoToken = randomBytes(32).toString("hex");
        const nuevoHash = hashToken(nuevoToken);
        await pool.query(
          `UPDATE agente_fichajes
              SET tracking_token_hash = $1,
                  cliente_id = $2,
                  puesto_id = NULL,
                  slot_numero = $3
            WHERE id = $4`,
          [nuevoHash, targetClienteId, custodiaHoy?.slot_numero ?? null, fichaje.id]
        );
        // Si la fila no traía cliente_nombre, lo buscamos
        let cliNombreFinal = targetClienteNombre;
        if (!cliNombreFinal && targetClienteId) {
          const { rows: cliRows } = await pool.query(
            `SELECT COALESCE(nombre_comercial, nombre) AS cliente_nombre FROM clients WHERE id = $1`,
            [targetClienteId]
          );
          cliNombreFinal = cliRows[0]?.cliente_nombre ?? null;
        }
        return res.json({
          ok: true,
          reanudado: true,
          fichaje_id: fichaje.id,
          registrado_en: fichaje.registrado_en,
          resultado: "reanudado",
          distancia_metros: null,
          agente,
          servicio: {
            tipo: "custodia",
            puesto_id: null,
            cliente_id: targetClienteId,
            cliente_nombre: cliNombreFinal,
            slot_numero: custodiaHoy?.slot_numero ?? null,
            titulo: "Turno reanudado",
            horario: null,
            hora_entrada: null,
            hora_salida: null,
            turno: "Custodia",
            jornada: null,
            gps_referencia: null,
          },
          arma: null,
          tracking_token: nuevoToken,
          anexado_a_recorrido: false,
          padre_fichaje_id: null,
          padre_nombre: null,
          co_custodios: null,
        });
      }

      // No es custodia hoy y ya marcó (puesto fijo): rechazar como antes.
      return res.status(409).json({
        error: "ya_iniciado",
        mensaje: "Ya iniciaste tu turno hoy.",
        registrado_en: fichaje.registrado_en,
      });
    }

    // 3. Resolver servicio del día
    //    Prioridad 1: puesto fijo (puesto_titulares activo + puesto activo)
    let servicio: {
      tipo: "puesto" | "custodia";
      puesto_id: number | null;
      cliente_id: number | null;
      cliente_nombre: string | null;
      slot_numero: number | null;
      titulo: string;
      horario: string | null;
      hora_entrada: string | null;
      hora_salida: string | null;
      turno: string | null;
      jornada: string | null;
      gps_referencia: { latitud: number; longitud: number; radio_metros: number } | null;
    } | null = null;

    const { rows: ptRows } = await pool.query(
      `SELECT po.id AS puesto_id, po.cliente_id, po.cliente_nombre, po.nombre AS puesto_nombre,
              po.horario, po.hora_entrada, po.hora_salida, po.turno, po.jornada
         FROM puesto_titulares pt
         JOIN puestos_operativos po ON po.id = pt.puesto_id
        WHERE pt.employee_id = $1
          AND pt.activo = TRUE
          AND po.activo = TRUE
        ORDER BY pt.orden ASC, pt.id ASC
        LIMIT 1`,
      [employeeId]
    );
    if (ptRows[0]) {
      let gpsRef: { latitud: number; longitud: number; radio_metros: number } | null = null;
      const { rows: gpsRows } = await pool.query(
        `SELECT latitud, longitud, radio_metros FROM puestos_gps WHERE puesto_id = $1`,
        [ptRows[0].puesto_id]
      );
      if (gpsRows[0]) {
        gpsRef = {
          latitud: Number(gpsRows[0].latitud),
          longitud: Number(gpsRows[0].longitud),
          radio_metros: Number(gpsRows[0].radio_metros),
        };
      }
      servicio = {
        tipo: "puesto",
        puesto_id: ptRows[0].puesto_id,
        cliente_id: ptRows[0].cliente_id,
        cliente_nombre: ptRows[0].cliente_nombre,
        slot_numero: null,
        titulo: ptRows[0].puesto_nombre,
        horario: ptRows[0].horario,
        hora_entrada: ptRows[0].hora_entrada,
        hora_salida: ptRows[0].hora_salida,
        turno: ptRows[0].turno,
        jornada: ptRows[0].jornada,
        gps_referencia: gpsRef,
      };
    } else {
      // Prioridad 2: custodia. Acepta tanto titular fijo (custodia_titulares)
      // como asignación del día desde el pizarrón (custodia_asignacion_diaria).
      // El titular tiene prioridad si ambos existen para el mismo agente.
      const { rows: ctRows } = await pool.query(
        `SELECT ct.cliente_id, ct.slot_numero,
                COALESCE(c.nombre_comercial, c.nombre) AS cliente_nombre,
                'titular' AS origen
           FROM custodia_titulares ct
           JOIN clients c ON c.id = ct.cliente_id
          WHERE ct.employee_id = $1 AND ct.activo = TRUE
          ORDER BY ct.slot_numero ASC
          LIMIT 1`,
        [employeeId]
      );
      let custodiaRow = ctRows[0];
      if (!custodiaRow) {
        const { rows: cadRows } = await pool.query(
          `SELECT cad.cliente_id, cad.slot_numero,
                  COALESCE(c.nombre_comercial, c.nombre) AS cliente_nombre,
                  'asignacion_diaria' AS origen
             FROM custodia_asignacion_diaria cad
             JOIN clients c ON c.id = cad.cliente_id
            WHERE cad.employee_id = $1
              AND cad.fecha = DATE((NOW() AT TIME ZONE 'America/Guatemala'))
            ORDER BY cad.slot_numero ASC
            LIMIT 1`,
          [employeeId]
        );
        custodiaRow = cadRows[0];
      }
      if (custodiaRow) {
        const esExtra = custodiaRow.origen === 'asignacion_diaria';
        servicio = {
          tipo: "custodia",
          puesto_id: null,
          cliente_id: custodiaRow.cliente_id,
          cliente_nombre: custodiaRow.cliente_nombre,
          slot_numero: Number(custodiaRow.slot_numero),
          titulo: esExtra ? `Custodio ${custodiaRow.slot_numero} (extra del día)` : `Custodio ${custodiaRow.slot_numero}`,
          horario: null,
          hora_entrada: null,
          hora_salida: null,
          turno: "Custodia",
          jornada: null,
          gps_referencia: null,
        };
      }
    }

    if (!servicio) {
      return res.status(404).json({
        error: "sin_servicio",
        mensaje: "No tienes un puesto o slot de custodia asignado. Avise al supervisor.",
        agente,
      });
    }

    // 3b. Modo kiosco: el agente debe pertenecer al puesto/cliente vinculado al teléfono
    if (kioscoTipo === "puesto" && kioscoPuestoId != null && servicio.puesto_id !== kioscoPuestoId) {
      return res.status(403).json({
        error: "puesto_no_coincide",
        mensaje: `${agente.nombre} no pertenece a este puesto. Verificá que estás en el teléfono correcto.`,
        agente,
      });
    }
    if (kioscoTipo === "custodia") {
      if (servicio.tipo !== "custodia") {
        return res.status(403).json({
          error: "tipo_no_coincide",
          mensaje: `${agente.nombre} no es custodio. Verificá que estás en el teléfono correcto.`,
          agente,
        });
      }
      if (kioscoClienteId != null && servicio.cliente_id !== kioscoClienteId) {
        return res.status(403).json({
          error: "cliente_no_coincide",
          mensaje: `${agente.nombre} no presta custodia para este cliente. Verificá que estás en el teléfono correcto.`,
          agente,
        });
      }
      if (kioscoSlotNumero != null && servicio.slot_numero !== kioscoSlotNumero) {
        return res.status(403).json({
          error: "slot_no_coincide",
          mensaje: `${agente.nombre} no es titular del slot Custodio ${kioscoSlotNumero} de este cliente.`,
          agente,
        });
      }
    }

    // 4. Validar GPS contra puesto si hay referencia
    let resultado = "sin_gps";
    let distanciaMetros: number | null = null;
    if (latitud != null && longitud != null) {
      if (servicio.gps_referencia) {
        distanciaMetros = Math.round(
          haversineMetros(Number(latitud), Number(longitud),
            servicio.gps_referencia.latitud, servicio.gps_referencia.longitud)
        );
        resultado = distanciaMetros <= servicio.gps_referencia.radio_metros ? "ok" : "fuera_de_zona";
      } else {
        resultado = "ok";
      }
    }
    if (resultado === "fuera_de_zona") {
      return res.status(403).json({
        error: "fuera_de_zona",
        distancia_metros: distanciaMetros,
        radio_metros: servicio.gps_referencia?.radio_metros ?? null,
        mensaje: `Estás a ${distanciaMetros} m del puesto. Debes estar dentro del radio permitido.`,
        agente,
        servicio,
      });
    }

    // 5. Equipo: arma asignada al puesto (si aplica)
    let arma: { codigo: string; descripcion: string; serie: string | null } | null = null;
    if (servicio.puesto_id) {
      const { rows: armaRows } = await pool.query(
        `SELECT codigo,
                CONCAT(COALESCE(marca,''), ' ', COALESCE(modelo,''), ' ', COALESCE(calibre,'')) AS descripcion,
                serie
           FROM armas
          WHERE puesto_id = $1 AND activo = TRUE
          ORDER BY id ASC LIMIT 1`,
        [servicio.puesto_id]
      );
      if (armaRows[0]) {
        arma = {
          codigo: armaRows[0].codigo,
          descripcion: String(armaRows[0].descripcion).trim(),
          serie: armaRows[0].serie,
        };
      }
    }

    // 6. Registrar el inicio de turno
    // GPS-RECO-02: si es custodia y vino de un kiosco, detectar si ya hay un recorrido activo
    // (líder) en ESTE dispositivo + cliente. Si existe, este fichaje se anexa como co-tripulante:
    // comparte el tracking del padre y NO genera tracking_token propio.
    let recorridoPadreId: number | null = null;
    let padreInfo: { id: number; agente_nombre: string } | null = null;
    if (servicio.tipo === "custodia" && device_uuid) {
      const { rows: padreRows } = await pool.query(
        `SELECT af.id, e.nombre_completo AS agente_nombre
           FROM agente_fichajes af
           JOIN employees e ON e.id = af.employee_id
          WHERE af.tipo = 'inicio_turno'
            AND af.device_uuid_origen = $1
            AND af.cliente_id = $2
            AND af.tracking_token_hash IS NOT NULL
            AND af.turno_cerrado_en IS NULL
            AND af.recorrido_padre_id IS NULL
            AND DATE((af.registrado_en AT TIME ZONE 'America/Guatemala')) =
                DATE((NOW() AT TIME ZONE 'America/Guatemala'))
          ORDER BY af.registrado_en ASC
          LIMIT 1`,
        [device_uuid, servicio.cliente_id]
      );
      if (padreRows[0]) {
        recorridoPadreId = padreRows[0].id;
        padreInfo = padreRows[0];
      }
    }

    // Sólo el LÍDER del recorrido obtiene tracking_token. Los co-tripulantes NO (comparten el del padre).
    const esLider = servicio.tipo === "custodia" && recorridoPadreId === null;
    const trackingToken = esLider ? randomBytes(32).toString("hex") : null;
    const trackingTokenHash = trackingToken ? hashToken(trackingToken) : null;

    const { rows: inserted } = await pool.query(
      `INSERT INTO agente_fichajes
         (employee_id, puesto_id, cliente_id, slot_numero, qr_token, latitud, longitud, distancia_metros, resultado, tipo, observaciones, tracking_token_hash, recorrido_padre_id, device_uuid_origen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'inicio_turno',$10,$11,$12,$13)
       RETURNING id, registrado_en`,
      [
        employeeId,
        servicio.puesto_id,
        servicio.cliente_id,
        servicio.tipo === "custodia" ? servicio.slot_numero ?? null : null,
        qr_token,
        latitud ?? null,
        longitud ?? null,
        distanciaMetros,
        resultado,
        servicio.tipo === "custodia"
          ? `cliente_id=${servicio.cliente_id} slot=${servicio.slot_numero} precision=${precision_metros ?? "?"}m${recorridoPadreId ? ` anexado_a=${recorridoPadreId}` : ""}`
          : `puesto_id=${servicio.puesto_id} precision=${precision_metros ?? "?"}m`,
        trackingTokenHash,
        recorridoPadreId,
        device_uuid ?? null,
      ]
    );

    // Si es co-tripulante, devolver lista actualizada del grupo
    let coCustodios: Array<{ employee_id: number; nombre: string; fichaje_id: number; es_lider: boolean }> | null = null;
    if (recorridoPadreId !== null) {
      const { rows: grupoRows } = await pool.query(
        `SELECT af.id AS fichaje_id, af.employee_id, e.nombre_completo AS nombre,
                (af.id = $1) AS es_lider
           FROM agente_fichajes af
           JOIN employees e ON e.id = af.employee_id
          WHERE af.id = $1 OR af.recorrido_padre_id = $1
          ORDER BY af.registrado_en ASC`,
        [recorridoPadreId]
      );
      coCustodios = grupoRows.map(r => ({
        employee_id: r.employee_id,
        nombre: r.nombre,
        fichaje_id: r.fichaje_id,
        es_lider: r.es_lider,
      }));
    }

    res.json({
      ok: true,
      fichaje_id: inserted[0].id,
      registrado_en: inserted[0].registrado_en,
      resultado,
      distancia_metros: distanciaMetros,
      agente,
      servicio,
      arma,
      tracking_token: trackingToken, // null si no es custodia o si es co-tripulante
      anexado_a_recorrido: recorridoPadreId !== null,
      padre_fichaje_id: recorridoPadreId,
      padre_nombre: padreInfo?.agente_nombre ?? null,
      co_custodios: coCustodios,
    });
  } catch (err) {
    logger.error({ err }, "agente/iniciar-turno: error");
    res.status(500).json({ error: "Error iniciando turno" });
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
  const { token, checks, calificacion, observaciones, latitud, longitud, device_uuid, device_token, accion_disciplinaria, notas_disciplinarias, amonestacion_monto, amonestacion_motivo } = req.body;
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
          resultado, tipo, supervisor_nombre, supervisor_device_id, checks, calificacion, observaciones,
          accion_disciplinaria, notas_disciplinarias)
       VALUES ($1,$2,$3,$4,$5,$6,'ok','supervision',$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, registrado_en`,
      [
        employeeId, puestoId, token,
        latitud ?? null, longitud ?? null, distanciaMetros,
        supervisorNombre, deviceId,
        checks ? JSON.stringify(checks) : null,
        calificacion ?? null, observaciones ?? null,
        accion_disciplinaria ?? null, notas_disciplinarias ?? null,
      ]
    );

    const fichajeId = inserted[0].id;

    if (accion_disciplinaria && ["llamada_atencion_1", "llamada_atencion_2", "acta_administrativa"].includes(accion_disciplinaria)) {
      try {
        const { rows: empRows } = await pool.query(
          `SELECT nombre_completo, dpi FROM employees WHERE id = $1`,
          [employeeId]
        );
        const empNombre = empRows[0]?.nombre_completo || "Desconocido";
        const empDpi = empRows[0]?.dpi || null;

        let clienteNombre: string | null = null;
        let puestoNombre: string | null = null;
        if (puestoId) {
          const { rows: poInfo } = await pool.query(
            `SELECT po.nombre, c.nombre AS cliente_nombre
             FROM puestos_operativos po
             LEFT JOIN clients c ON c.id = po.client_id
             WHERE po.id = $1`,
            [puestoId]
          );
          if (poInfo[0]) {
            puestoNombre = poInfo[0].nombre;
            clienteNombre = poInfo[0].cliente_nombre;
          }
        }

        await pool.query(
          `INSERT INTO eventos_rrhh
             (employee_id, employee_nombre, employee_dpi,
              tipo_evento, cliente_nombre, puesto_nombre,
              supervisor_nombre, generado_desde, estado,
              observaciones, notas, usuario_generador,
              documentos_generados, fecha, fichaje_origen_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'supervision','pendiente',$8,$9,$10,'[]',NOW(),$11)`,
          [
            employeeId, empNombre, empDpi,
            accion_disciplinaria, clienteNombre, puestoNombre,
            supervisorNombre, observaciones || null,
            notas_disciplinarias || null,
            supervisorNombre,
            fichajeId,
          ]
        );
        logger.info({ employeeId, accion_disciplinaria, fichajeId }, "Evento RRHH creado desde supervisión");
      } catch (evErr) {
        logger.warn({ evErr, employeeId, accion_disciplinaria }, "No se pudo crear evento RRHH desde supervisión (no bloqueante)");
      }
    }

    // Crear amonestación si el supervisor lo indicó (llamada o económica)
    if (accion_disciplinaria || (Number(amonestacion_monto) || 0) > 0) {
      try {
        const tipoAmon = (Number(amonestacion_monto) || 0) > 0 ? "economica" : "llamada_atencion";
        const montoAmon = tipoAmon === "economica" ? Math.max(0, Number(amonestacion_monto) || 0) : 0;
        const motivoAmon =
          (amonestacion_motivo && String(amonestacion_motivo).trim()) ||
          (accion_disciplinaria
            ? String(accion_disciplinaria).replace(/_/g, " ")
            : "Amonestación levantada en supervisión");
        const { rows: empRows2 } = await pool.query(
          `SELECT nombre_completo FROM employees WHERE id = $1`, [employeeId]
        );
        const empNombre2 = empRows2[0]?.nombre_completo || "Desconocido";
        let clienteNombre2: string | null = null;
        let puestoNombre2: string | null = null;
        if (puestoId) {
          const { rows: poInfo } = await pool.query(
            `SELECT po.nombre, c.nombre AS cliente_nombre
             FROM puestos_operativos po LEFT JOIN clients c ON c.id = po.client_id
             WHERE po.id = $1`, [puestoId]
          );
          if (poInfo[0]) { puestoNombre2 = poInfo[0].nombre; clienteNombre2 = poInfo[0].cliente_nombre; }
        }
        await pool.query(
          `INSERT INTO amonestaciones (
             employee_id, empleado_nombre,
             creado_por_user_id, creado_por_username, creado_por_rol,
             tipo, motivo, descripcion, monto,
             cliente_nombre, puesto_nombre, fecha
           ) VALUES (
             $1,$2, NULL,$3,'supervisor',
             $4,$5,$6,$7, $8,$9, CURRENT_DATE
           )`,
          [
            employeeId, empNombre2,
            supervisorNombre,
            tipoAmon, motivoAmon, notas_disciplinarias || null, montoAmon,
            clienteNombre2, puestoNombre2,
          ]
        );
        logger.info({ employeeId, tipoAmon, montoAmon }, "Amonestación creada desde supervisión");
      } catch (amErr) {
        logger.warn({ amErr }, "No se pudo crear amonestación desde supervisión (no bloqueante)");
      }
    }

    res.json({
      ok: true,
      supervision_id: fichajeId,
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
             e.dpi, e.empl_numero, e.foto_url,
             aqt.id AS token_id, aqt.qr_token, aqt.activo, aqt.created_at,
             aqt.carnet_impreso_at, aqt.carnet_impreso_por,
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

// POST /api/agente/tokens/:employee_id/registrar-impresion
agenteFichajeRouter.post("/agente/tokens/:employee_id/registrar-impresion", async (req, res) => {
  const employeeId = parseInt(req.params.employee_id);
  const { impresoPor } = req.body ?? {};
  if (!employeeId || isNaN(employeeId)) return res.status(400).json({ error: "employee_id inválido" });
  try {
    await pool.query(
      `UPDATE agente_qr_tokens
       SET carnet_impreso_at = NOW(), carnet_impreso_por = $1
       WHERE employee_id = $2 AND activo = TRUE`,
      [impresoPor || "Sistema", employeeId]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "registrar-impresion: error");
    res.status(500).json({ error: "Error registrando impresión" });
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

    const reporteId = rows[0].id;

    // Nombre del responsable anterior (para responder al frontend)
    let responsable_anterior_nombre: string | null = null;
    if (municion_responsable_anterior) {
      const { rows: respRows } = await pool.query(
        `SELECT nombre_completo FROM employees WHERE id = $1`,
        [municion_responsable_anterior]
      );
      responsable_anterior_nombre = respRows[0]?.nombre_completo ?? null;
    }

    // ── Auto-generar órdenes y solicitudes desde el reporte ──
    try {
      // Arma con novedad → orden de servicio en armería
      if (arma_id && arma_estado === "necesita_reparacion") {
        await pool.query(`
          INSERT INTO arma_ordenes_servicio
            (arma_id, origen, origen_id, puesto_id, reportado_por, descripcion, estado)
          VALUES ($1,'reporte_turno',$2,$3,$4,$5,'pendiente')
        `, [arma_id, reporteId, puesto_id ?? null, employee_id,
            arma_observacion ?? "Novedad reportada en relevo"]);
      }

      // Munición faltante → solicitud a bodega (discrepancia)
      if (municion_ok === false && municion_faltante > 0) {
        await pool.query(`
          INSERT INTO bodega_solicitudes
            (origen, origen_id, puesto_id, employee_id, tipo, descripcion, cantidad, estado)
          VALUES ('reporte_turno',$1,$2,$3,'discrepancia_municion',$4,$5,'pendiente')
        `, [reporteId, puesto_id ?? null, employee_id,
            `Discrepancia de munición reportada en relevo — ${municion_faltante} cartucho(s) faltante(s)`,
            municion_faltante]);
      }

      // Uniforme faltante → solicitud por cada ítem
      if (uniforme_ok === false && Array.isArray(uniforme_items_faltantes)) {
        for (const item of uniforme_items_faltantes as Array<{ tipo: string; talla: string }>) {
          await pool.query(`
            INSERT INTO bodega_solicitudes
              (origen, origen_id, puesto_id, employee_id, tipo, descripcion, talla, estado)
            VALUES ('reporte_turno',$1,$2,$3,'dotacion_uniforme',$4,$5,'pendiente')
          `, [reporteId, puesto_id ?? null, employee_id,
              `Solicitud de dotación: ${item.tipo}`, item.talla ?? null]);
        }
      }
    } catch (autoErr) {
      logger.error({ err: autoErr }, "reporte-turno: error auto-generando solicitudes (no bloqueante)");
    }

    res.json({
      ok: true,
      reporte_id: reporteId,
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
             po.zona_operativa_id AS zona_id,
             oz.nombre AS zona_nombre,
             resp.nombre_completo AS responsable_anterior_nombre
      FROM reporte_turno rt
      LEFT JOIN employees e ON e.id = rt.employee_id
      LEFT JOIN puestos_operativos po ON po.id = rt.puesto_id
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      LEFT JOIN employees resp ON resp.id = rt.municion_responsable_anterior
      ${where}
      ORDER BY po.cliente_nombre ASC, oz.nombre ASC NULLS LAST, rt.registrado_en DESC
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

// GET /api/agente/puesto/:puestoId/equipo-asignado
// Retorna todo el equipo asignado al puesto para el formulario de relevo
agenteFichajeRouter.get("/agente/puesto/:puestoId/equipo-asignado", async (req, res) => {
  const puestoId = Number(req.params.puestoId);
  if (!puestoId) return res.status(400).json({ error: "puesto_id requerido" });
  try {
    // Arma
    const { rows: armaRows } = await pool.query(`
      SELECT id, codigo, CONCAT(COALESCE(marca,''), ' ', COALESCE(modelo,''), ' ', COALESCE(calibre,'')) AS nombre
      FROM armas WHERE puesto_id = $1 AND activo = TRUE ORDER BY id LIMIT 1
    `, [puestoId]);

    // Munición
    const { rows: munRows } = await pool.query(`
      SELECT id, descripcion, cantidad_asignada FROM puesto_municion WHERE puesto_id = $1 AND activo = TRUE LIMIT 1
    `, [puestoId]);

    // Equipo de bodega asignado al puesto
    const { rows: equipoRows } = await pool.query(`
      SELECT bu.id, ba.nombre, ba.tipo_equipo, ba.categoria, bu.serie, bu.condicion
      FROM bodega_unidades bu
      JOIN bodega_articulos ba ON ba.id = bu.articulo_id
      WHERE bu.puesto_id = $1
        AND bu.estado = 'asignado_puesto'
      ORDER BY ba.categoria, ba.nombre
    `, [puestoId]);

    res.json({
      arma: armaRows[0] ?? null,
      municion: munRows[0] ?? null,
      equipo: equipoRows,
    });
  } catch (err) {
    logger.error({ err }, "equipo-asignado GET: error");
    res.status(500).json({ error: "Error obteniendo equipo del puesto" });
  }
});

// POST /api/agente/reporte-turno/equipo — registrar novedades de equipo de relevo
// Se llama DESPUÉS de crear el reporte-turno principal
agenteFichajeRouter.post("/agente/reporte-turno/:reporteId/equipo", async (req, res) => {
  const reporteId = Number(req.params.reporteId);
  const { puesto_id, employee_id, fichaje_id, items } = req.body as {
    puesto_id: number; employee_id: number; fichaje_id: number;
    items: Array<{ item_tipo: string; item_nombre: string; item_ref_id?: number; estado: "ok" | "novedad"; descripcion?: string }>;
  };

  if (!reporteId || !Array.isArray(items)) return res.status(400).json({ error: "reporteId e items requeridos" });

  try {
    const insertedIds: number[] = [];

    for (const item of items) {
      const { rows } = await pool.query(`
        INSERT INTO relevo_equipo_novedades
          (reporte_id, fichaje_id, puesto_id, employee_id, item_tipo, item_nombre, item_ref_id, estado, descripcion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
      `, [reporteId, fichaje_id ?? null, puesto_id ?? null, employee_id ?? null,
          item.item_tipo, item.item_nombre, item.item_ref_id ?? null,
          item.estado, item.descripcion ?? null]);
      insertedIds.push(rows[0].id);

      // Auto-generar solicitudes y órdenes cuando hay novedad
      if (item.estado === "novedad") {
        if (item.item_tipo === "arma") {
          // Orden de servicio en armería
          await pool.query(`
            INSERT INTO arma_ordenes_servicio
              (arma_id, origen, origen_id, puesto_id, reportado_por, descripcion, estado)
            VALUES ($1,'reporte_turno',$2,$3,$4,$5,'pendiente')
          `, [item.item_ref_id ?? null, reporteId, puesto_id ?? null, employee_id ?? null,
              item.descripcion ?? `Novedad reportada en relevo: ${item.item_nombre}`]);
        } else {
          // Solicitud a bodega (equipo, uniforme, etc.)
          await pool.query(`
            INSERT INTO bodega_solicitudes
              (origen, origen_id, puesto_id, employee_id, tipo, descripcion, estado)
            VALUES ('reporte_turno',$1,$2,$3,$4,$5,'pendiente')
          `, [reporteId, puesto_id ?? null, employee_id ?? null,
              item.item_tipo,
              item.descripcion ?? `Novedad en relevo — ${item.item_nombre}`]);
        }
      }
    }

    res.json({ ok: true, insertados: insertedIds.length });
  } catch (err) {
    logger.error({ err }, "reporte-turno/equipo POST: error");
    res.status(500).json({ error: "Error registrando novedades de equipo" });
  }
});

// Solicitudes de bodega generadas por reportes — para el panel de bodega
agenteFichajeRouter.get("/bodega-solicitudes", async (req, res) => {
  const { estado = "pendiente", tipo, limit = "100" } = req.query as Record<string, string>;
  try {
    const params: (string | number)[] = [];
    const conds: string[] = [];
    if (estado !== "todas") { params.push(estado); conds.push(`bs.estado = $${params.length}`); }
    if (tipo) { params.push(tipo); conds.push(`bs.tipo = $${params.length}`); }
    params.push(Number(limit));
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows } = await pool.query(`
      SELECT bs.*, po.nombre AS puesto_nombre, po.cliente_nombre,
             e.nombre_completo AS agente_nombre
      FROM bodega_solicitudes bs
      LEFT JOIN puestos_operativos po ON po.id = bs.puesto_id
      LEFT JOIN employees e ON e.id = bs.employee_id
      ${where}
      ORDER BY bs.created_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo solicitudes de bodega" });
  }
});

// Órdenes de servicio de armería — para el panel de armería
agenteFichajeRouter.get("/arma-ordenes-servicio", async (req, res) => {
  const { estado = "pendiente", limit = "100" } = req.query as Record<string, string>;
  try {
    const params: (string | number)[] = [];
    const conds: string[] = [];
    if (estado !== "todas") { params.push(estado); conds.push(`ao.estado = $${params.length}`); }
    params.push(Number(limit));
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows } = await pool.query(`
      SELECT ao.*, a.codigo AS arma_codigo, a.marca, a.modelo, a.calibre,
             po.nombre AS puesto_nombre, po.cliente_nombre,
             e.nombre_completo AS reportado_por_nombre
      FROM arma_ordenes_servicio ao
      LEFT JOIN armas a ON a.id = ao.arma_id
      LEFT JOIN puestos_operativos po ON po.id = ao.puesto_id
      LEFT JOIN employees e ON e.id = ao.reportado_por
      ${where}
      ORDER BY ao.created_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo órdenes de servicio" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING GPS DEL RECORRIDO DE CUSTODIOS DURANTE EL TURNO
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/agente/recorrido-ping — recibe lote de puntos GPS para un fichaje activo
// Body: { fichaje_id, tracking_token, puntos: [{lat, lng, precision, velocidad?, rumbo?, bateria?, ts}] }
agenteFichajeRouter.post("/agente/recorrido-ping", async (req, res) => {
  const { fichaje_id, tracking_token, puntos } = req.body ?? {};
  if (!fichaje_id || !tracking_token || !Array.isArray(puntos)) {
    return res.status(400).json({ error: "parametros_invalidos" });
  }
  if (puntos.length === 0) return res.json({ ok: true, guardados: 0 });
  if (puntos.length > 200) return res.status(400).json({ error: "demasiados_puntos" });

  try {
    const { rows: fRows } = await pool.query(
      `SELECT tracking_token_hash, turno_cerrado_en
         FROM agente_fichajes WHERE id = $1 AND tipo = 'inicio_turno'`,
      [fichaje_id]
    );
    if (!fRows[0]) return res.status(404).json({ error: "fichaje_no_encontrado" });
    if (!fRows[0].tracking_token_hash || fRows[0].tracking_token_hash !== hashToken(tracking_token)) {
      return res.status(403).json({ error: "token_invalido" });
    }
    if (fRows[0].turno_cerrado_en) {
      return res.status(409).json({ error: "turno_ya_cerrado" });
    }

    // Insert masivo (filtrando puntos sin lat/lng)
    let guardados = 0;
    const values: unknown[] = [];
    const placeholders: string[] = [];
    for (const p of puntos) {
      if (typeof p?.lat !== "number" || typeof p?.lng !== "number") continue;
      const ts = p.ts ? new Date(p.ts) : new Date();
      if (isNaN(ts.getTime())) continue;
      const i = values.length;
      placeholders.push(`($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8})`);
      values.push(
        fichaje_id,
        p.lat,
        p.lng,
        typeof p.precision === "number" ? Math.round(p.precision) : null,
        typeof p.velocidad === "number" ? p.velocidad : null,
        typeof p.rumbo === "number" ? p.rumbo : null,
        typeof p.bateria === "number" ? Math.round(p.bateria) : null,
        ts.toISOString(),
      );
      guardados++;
    }
    if (guardados === 0) return res.json({ ok: true, guardados: 0 });

    await pool.query(
      `INSERT INTO agente_recorrido_gps
         (fichaje_id, latitud, longitud, precision_metros, velocidad_mps, rumbo_grados, bateria_pct, capturado_en)
       VALUES ${placeholders.join(", ")}`,
      values
    );
    res.json({ ok: true, guardados });
  } catch (err) {
    logger.error({ err }, "agente/recorrido-ping: error");
    res.status(500).json({ error: "Error guardando puntos" });
  }
});

// POST /api/agente/cerrar-turno — registra el cierre de turno del custodio
// Body: { fichaje_id, tracking_token, latitud?, longitud?, precision_metros? }
agenteFichajeRouter.post("/agente/cerrar-turno", async (req, res) => {
  const { fichaje_id, tracking_token, latitud, longitud, precision_metros } = req.body ?? {};
  if (!fichaje_id || !tracking_token) return res.status(400).json({ error: "parametros_invalidos" });
  try {
    const { rows: fRows } = await pool.query(
      `SELECT employee_id, puesto_id, cliente_id, slot_numero, tracking_token_hash, turno_cerrado_en
         FROM agente_fichajes WHERE id = $1 AND tipo = 'inicio_turno'`,
      [fichaje_id]
    );
    if (!fRows[0]) return res.status(404).json({ error: "fichaje_no_encontrado" });
    if (!fRows[0].tracking_token_hash || fRows[0].tracking_token_hash !== hashToken(tracking_token)) {
      return res.status(403).json({ error: "token_invalido" });
    }
    if (fRows[0].turno_cerrado_en) {
      return res.status(409).json({ error: "turno_ya_cerrado", cerrado_en: fRows[0].turno_cerrado_en });
    }

    // GPS-RECO-02: cerrar el líder + todos los co-tripulantes en cascada (atomic)
    const client = await pool.connect();
    const cierres: Array<{ id: number; employee_id: number; registrado_en: string }> = [];
    try {
      await client.query("BEGIN");
      const { rows: hijosRows } = await client.query(
        `SELECT id, employee_id, puesto_id, cliente_id, slot_numero
           FROM agente_fichajes
          WHERE recorrido_padre_id = $1 AND turno_cerrado_en IS NULL
          FOR UPDATE`,
        [fichaje_id]
      );
      await client.query(
        `UPDATE agente_fichajes SET turno_cerrado_en = NOW()
          WHERE (id = $1 OR recorrido_padre_id = $1) AND turno_cerrado_en IS NULL`,
        [fichaje_id]
      );
      const todos = [
        {
          id: fichaje_id,
          employee_id: fRows[0].employee_id,
          puesto_id: fRows[0].puesto_id,
          cliente_id: fRows[0].cliente_id,
          slot_numero: fRows[0].slot_numero,
        },
        ...hijosRows,
      ];
      for (const t of todos) {
        const { rows: cierre } = await client.query(
          `INSERT INTO agente_fichajes
             (employee_id, puesto_id, cliente_id, slot_numero, qr_token, latitud, longitud, distancia_metros, resultado, tipo, observaciones)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,'ok','cierre_turno',$8)
           RETURNING id, registrado_en`,
          [
            t.employee_id,
            t.puesto_id,
            t.cliente_id,
            t.slot_numero,
            "__cierre_turno__",
            latitud ?? null,
            longitud ?? null,
            `cierre de fichaje_id=${t.id}${t.id !== fichaje_id ? ` (anexado a ${fichaje_id})` : ""} precision=${precision_metros ?? "?"}m`,
          ]
        );
        cierres.push({ id: cierre[0].id, employee_id: t.employee_id, registrado_en: cierre[0].registrado_en });
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    res.json({
      ok: true,
      cierre_id: cierres[0].id,
      cerrado_en: cierres[0].registrado_en,
      cierres_grupo: cierres,
      total_cerrados: cierres.length,
    });
  } catch (err) {
    logger.error({ err }, "agente/cerrar-turno: error");
    res.status(500).json({ error: "Error cerrando turno" });
  }
});

// POST /api/agente/forzar-cierre-turno — cierre administrativo (sin tracking_token)
// Body: { fichaje_id, motivo? }
// Auth: requiere sesión admin via x-isp-session (permisosMiddleware ya valida módulo control_qr).
// Cierra el turno líder + todos los co-tripulantes en cascada y deja registro de quién lo forzó.
agenteFichajeRouter.post("/agente/forzar-cierre-turno", async (req, res) => {
  const { fichaje_id, motivo } = req.body ?? {};
  if (!fichaje_id) return res.status(400).json({ error: "parametros_invalidos" });

  // Identificar al usuario y validar rol (solo admin o rrhh pueden forzar cierre)
  let adminUsername = "admin";
  let adminRol = "";
  try {
    const raw = req.headers["x-isp-session"] as string | undefined;
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.username) adminUsername = String(session.username);
      if (session?.rol) adminRol = String(session.rol).toLowerCase();
    }
  } catch {
    // sesión inválida
  }
  if (adminRol !== "admin" && adminRol !== "rrhh") {
    return res.status(403).json({
      error: "no_autorizado",
      mensaje: "Solo usuarios con rol Admin o RRHH pueden forzar el cierre de turnos.",
    });
  }

  try {
    const { rows: fRows } = await pool.query(
      `SELECT employee_id, puesto_id, cliente_id, slot_numero, turno_cerrado_en
         FROM agente_fichajes WHERE id = $1 AND tipo = 'inicio_turno'`,
      [fichaje_id]
    );
    if (!fRows[0]) return res.status(404).json({ error: "fichaje_no_encontrado" });
    if (fRows[0].turno_cerrado_en) {
      return res.status(409).json({ error: "turno_ya_cerrado", cerrado_en: fRows[0].turno_cerrado_en });
    }

    const motivoLimpio = typeof motivo === "string" ? motivo.trim().slice(0, 200) : "";
    const etiquetaMotivo = motivoLimpio || "sin motivo especificado";

    const client = await pool.connect();
    const cierres: Array<{ id: number; employee_id: number; registrado_en: string }> = [];
    try {
      await client.query("BEGIN");
      const { rows: hijosRows } = await client.query(
        `SELECT id, employee_id, puesto_id, cliente_id, slot_numero
           FROM agente_fichajes
          WHERE recorrido_padre_id = $1 AND turno_cerrado_en IS NULL
          FOR UPDATE`,
        [fichaje_id]
      );
      await client.query(
        `UPDATE agente_fichajes SET turno_cerrado_en = NOW()
          WHERE (id = $1 OR recorrido_padre_id = $1) AND turno_cerrado_en IS NULL`,
        [fichaje_id]
      );
      const todos = [
        {
          id: fichaje_id,
          employee_id: fRows[0].employee_id,
          puesto_id: fRows[0].puesto_id,
          cliente_id: fRows[0].cliente_id,
          slot_numero: fRows[0].slot_numero,
        },
        ...hijosRows,
      ];
      for (const t of todos) {
        const { rows: cierre } = await client.query(
          `INSERT INTO agente_fichajes
             (employee_id, puesto_id, cliente_id, slot_numero, qr_token, latitud, longitud, distancia_metros, resultado, tipo, observaciones)
           VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,'ok','cierre_turno',$6)
           RETURNING id, registrado_en`,
          [
            t.employee_id,
            t.puesto_id,
            t.cliente_id,
            t.slot_numero,
            "__cierre_forzado__",
            `cierre FORZADO por admin=${adminUsername} de fichaje_id=${t.id}${t.id !== fichaje_id ? ` (anexado a ${fichaje_id})` : ""} motivo=${etiquetaMotivo}`,
          ]
        );
        cierres.push({ id: cierre[0].id, employee_id: t.employee_id, registrado_en: cierre[0].registrado_en });
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    logger.warn(
      { admin: adminUsername, fichaje_id, total_cerrados: cierres.length, motivo: etiquetaMotivo },
      "agente/forzar-cierre-turno: cierre administrativo ejecutado"
    );

    res.json({
      ok: true,
      forzado_por: adminUsername,
      cierre_id: cierres[0].id,
      cerrado_en: cierres[0].registrado_en,
      cierres_grupo: cierres,
      total_cerrados: cierres.length,
    });
  } catch (err) {
    logger.error({ err }, "agente/forzar-cierre-turno: error");
    res.status(500).json({ error: "Error forzando cierre de turno" });
  }
});

// GET /api/agente/co-custodios/:fichaje_id — lista los custodios anexados a un recorrido (líder + hijos)
// Se autentica con tracking_token para no exponer la información a cualquiera.
agenteFichajeRouter.get("/agente/co-custodios/:fichaje_id", async (req, res) => {
  const fichajeId = Number(req.params.fichaje_id);
  const trackingToken = (req.query.tracking_token as string) || "";
  if (!Number.isFinite(fichajeId) || !trackingToken) {
    return res.status(400).json({ error: "parametros_invalidos" });
  }
  try {
    const { rows: f } = await pool.query(
      `SELECT tracking_token_hash FROM agente_fichajes WHERE id = $1 AND tipo = 'inicio_turno'`,
      [fichajeId]
    );
    if (!f[0] || !f[0].tracking_token_hash || f[0].tracking_token_hash !== hashToken(trackingToken)) {
      return res.status(403).json({ error: "token_invalido" });
    }
    const { rows } = await pool.query(
      `SELECT af.id AS fichaje_id, af.employee_id, e.nombre_completo AS nombre,
              (af.id = $1) AS es_lider, af.registrado_en AS inicio_en,
              af.turno_cerrado_en
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
        WHERE af.id = $1 OR af.recorrido_padre_id = $1
        ORDER BY af.registrado_en ASC`,
      [fichajeId]
    );
    res.json({ co_custodios: rows, total: rows.length });
  } catch (err) {
    logger.error({ err }, "agente/co-custodios: error");
    res.status(500).json({ error: "Error obteniendo co-custodios" });
  }
});

// GET /api/agente/recorridos-del-dia — lista los turnos de custodia con tracking del día
// Soporta filtro ?cliente_id=N (para portal cliente) y ?fecha=YYYY-MM-DD (default: hoy GT)
agenteFichajeRouter.get("/agente/recorridos-del-dia", async (req, res) => {
  const clienteId = req.query.cliente_id ? Number(req.query.cliente_id) : null;
  const fecha = typeof req.query.fecha === "string" ? req.query.fecha : null;
  try {
    const params: unknown[] = [];
    let whereFecha = `DATE((af.registrado_en AT TIME ZONE 'America/Guatemala')) = DATE((NOW() AT TIME ZONE 'America/Guatemala'))`;
    if (fecha) {
      params.push(fecha);
      whereFecha = `DATE((af.registrado_en AT TIME ZONE 'America/Guatemala')) = $${params.length}::date`;
    }
    let whereCliente = "";
    if (clienteId) {
      params.push(clienteId);
      whereCliente = `AND af.cliente_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT af.id AS fichaje_id, af.employee_id, af.cliente_id, af.slot_numero,
              af.registrado_en AS inicio_en, af.turno_cerrado_en,
              e.nombre_completo AS agente_nombre,
              c.nombre AS cliente_nombre,
              (SELECT COUNT(*) FROM agente_recorrido_gps r WHERE r.fichaje_id = af.id)::int AS total_puntos,
              (SELECT MAX(r.capturado_en) FROM agente_recorrido_gps r WHERE r.fichaje_id = af.id) AS ultimo_ping
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
         LEFT JOIN clients c ON c.id = af.cliente_id
        WHERE af.tipo = 'inicio_turno'
          AND af.tracking_token_hash IS NOT NULL
          AND ${whereFecha}
          ${whereCliente}
        ORDER BY af.turno_cerrado_en NULLS FIRST, af.registrado_en DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "agente/recorridos-del-dia: error");
    res.status(500).json({ error: "Error obteniendo recorridos" });
  }
});

// GET /api/agente/recorrido/:fichaje_id — devuelve la ruta GPS grabada de un turno
// (uso interno: admin / portal cliente para mostrar en mapa)
agenteFichajeRouter.get("/agente/recorrido/:fichaje_id", async (req, res) => {
  const fichajeId = Number(req.params.fichaje_id);
  if (!Number.isFinite(fichajeId)) return res.status(400).json({ error: "id_invalido" });
  try {
    const { rows: header } = await pool.query(
      `SELECT af.id, af.employee_id, af.cliente_id, af.slot_numero, af.puesto_id,
              af.registrado_en AS inicio_en, af.turno_cerrado_en,
              e.nombre_completo AS agente_nombre,
              c.nombre AS cliente_nombre
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
         LEFT JOIN clients c ON c.id = af.cliente_id
        WHERE af.id = $1 AND af.tipo = 'inicio_turno'`,
      [fichajeId]
    );
    if (!header[0]) return res.status(404).json({ error: "fichaje_no_encontrado" });

    const { rows: puntos } = await pool.query(
      `SELECT latitud AS lat, longitud AS lng, precision_metros, velocidad_mps,
              rumbo_grados, bateria_pct, capturado_en
         FROM agente_recorrido_gps
        WHERE fichaje_id = $1
        ORDER BY capturado_en ASC`,
      [fichajeId]
    );

    // GPS-RECO-02: lista de co-custodios (incluye al líder y a los anexados)
    const { rows: coCustodios } = await pool.query(
      `SELECT af.id AS fichaje_id, af.employee_id, e.nombre_completo AS nombre,
              (af.id = $1) AS es_lider, af.registrado_en AS inicio_en
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
        WHERE af.id = $1 OR af.recorrido_padre_id = $1
        ORDER BY af.registrado_en ASC`,
      [fichajeId]
    );

    res.json({
      turno: header[0],
      puntos,
      total_puntos: puntos.length,
      co_custodios: coCustodios,
    });
  } catch (err) {
    logger.error({ err }, "agente/recorrido: error");
    res.status(500).json({ error: "Error obteniendo recorrido" });
  }
});
