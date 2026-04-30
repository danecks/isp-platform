/**
 * VISITAS — Control de entradas y salidas en puestos
 *
 * Endpoints:
 *  AGENTE (PWA, autenticación por device_uuid + device_token):
 *    POST  /api/agente/visitas/extraer-dpi       → IA OCR del DPI (valida device)
 *    GET   /api/agente/visitas/abiertas          → lista lo que está adentro en su puesto
 *    POST  /api/agente/visitas/entrada           → registra entrada
 *    POST  /api/agente/visitas/salida            → busca por DPI/placa y marca salida
 *
 *  ADMIN (panel web, header x-isp-role: admin/operaciones/supervisor):
 *    GET   /api/admin/visitas                    → lista con filtros
 *    GET   /api/admin/visitas/estadisticas       → KPIs mensuales
 *
 *  PORTAL CLIENTE (header x-isp-clienteid + x-isp-userid):
 *    GET   /api/portal-cliente/visitas           → lista filtrada por cliente
 *    GET   /api/portal-cliente/visitas/estadisticas → KPIs mensuales del cliente
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";
import { createHash } from "node:crypto";
import { logger } from "../lib/logger";

export const visitasRouter = Router();

const MAX_FOTO_BYTES = 6 * 1024 * 1024; // 6 MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Helpers de autenticación ─────────────────────────────────────────────────

interface DeviceCtx {
  device_id: number;
  puesto_id: number | null;
  cliente_id: number | null;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
}

async function validarDeviceQuery(req: Request, res: Response): Promise<DeviceCtx | null> {
  const device_uuid = String(req.query.device_uuid ?? "");
  const device_token = String(req.query.device_token ?? "");
  if (!device_uuid || !device_token) {
    res.status(400).json({ error: "device_credentials_requeridas" });
    return null;
  }
  if (!UUID_RE.test(device_uuid)) {
    res.status(403).json({ error: "dispositivo_no_autorizado" });
    return null;
  }
  const { rows } = await pool.query(
    `SELECT sd.id, sd.tipo, sd.device_token_hash, sd.activo,
            sd.puesto_id, sd.cliente_id,
            po.nombre AS puesto_nombre,
            COALESCE(po.cliente_nombre, c.nombre_comercial, c.nombre) AS cliente_nombre,
            po.cliente_id AS po_cliente_id
       FROM supervisor_devices sd
       LEFT JOIN puestos_operativos po ON po.id = sd.puesto_id
       LEFT JOIN clients c ON c.id = sd.cliente_id
      WHERE sd.device_uuid = $1`,
    [device_uuid]
  );
  if (!rows[0] || !rows[0].activo) {
    res.status(403).json({ error: "dispositivo_no_autorizado" });
    return null;
  }
  if (rows[0].device_token_hash !== hashToken(device_token)) {
    res.status(403).json({ error: "token_incorrecto" });
    return null;
  }
  await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [rows[0].id]);
  return {
    device_id: rows[0].id,
    puesto_id: rows[0].puesto_id,
    cliente_id: rows[0].cliente_id ?? rows[0].po_cliente_id ?? null,
    puesto_nombre: rows[0].puesto_nombre,
    cliente_nombre: rows[0].cliente_nombre,
  };
}

async function validarDeviceBody(req: Request, res: Response): Promise<DeviceCtx | null> {
  const { device_uuid, device_token } = req.body ?? {};
  if (!device_uuid || !device_token) {
    res.status(400).json({ error: "device_credentials_requeridas" });
    return null;
  }
  if (!UUID_RE.test(String(device_uuid))) {
    res.status(403).json({ error: "dispositivo_no_autorizado" });
    return null;
  }
  const { rows } = await pool.query(
    `SELECT sd.id, sd.tipo, sd.device_token_hash, sd.activo,
            sd.puesto_id, sd.cliente_id,
            po.nombre AS puesto_nombre,
            COALESCE(po.cliente_nombre, c.nombre_comercial, c.nombre) AS cliente_nombre,
            po.cliente_id AS po_cliente_id
       FROM supervisor_devices sd
       LEFT JOIN puestos_operativos po ON po.id = sd.puesto_id
       LEFT JOIN clients c ON c.id = sd.cliente_id
      WHERE sd.device_uuid = $1`,
    [device_uuid]
  );
  if (!rows[0] || !rows[0].activo) {
    res.status(403).json({ error: "dispositivo_no_autorizado" });
    return null;
  }
  if (rows[0].device_token_hash !== hashToken(device_token)) {
    res.status(403).json({ error: "token_incorrecto" });
    return null;
  }
  await pool.query(`UPDATE supervisor_devices SET ultimo_uso = NOW() WHERE id = $1`, [rows[0].id]);
  return {
    device_id: rows[0].id,
    puesto_id: rows[0].puesto_id,
    cliente_id: rows[0].cliente_id ?? rows[0].po_cliente_id ?? null,
    puesto_nombre: rows[0].puesto_nombre,
    cliente_nombre: rows[0].cliente_nombre,
  };
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const rol = String(req.headers["x-isp-role"] ?? "").toLowerCase();
  if (!["admin", "operaciones", "supervisor", "rrhh", "comercial"].includes(rol)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

async function requireCliente(req: Request, res: Response, next: NextFunction) {
  const rol = String(req.headers["x-isp-role"] ?? "").toLowerCase();
  const cidStr = String(req.headers["x-isp-clienteid"] ?? "");
  if (rol !== "cliente" || !cidStr) {
    return res.status(403).json({ error: "Acceso denegado al portal de clientes" });
  }
  try {
    const userIdHeader = req.headers["x-isp-userid"] as string | undefined;
    const userId = userIdHeader ? parseInt(userIdHeader) : NaN;
    if (isNaN(userId)) {
      return res.status(403).json({ error: "Sesión de cliente requerida" });
    }
    const { rows } = await pool.query<{ id: number }>(
      `SELECT u.id
         FROM users u
         JOIN usuarios_clientes uc ON uc.user_id = u.id
        WHERE u.id = $1
          AND uc.portal_cliente_id = $2
          AND u.estado = 'activo'
          AND u.rol = 'cliente'
        LIMIT 1`,
      [userId, cidStr]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: "Usuario no vinculado a este cliente" });
    }
    const { rows: clientRows } = await pool.query<{ id: number }>(
      `SELECT id FROM clients WHERE portal_cliente_id = $1 LIMIT 1`,
      [cidStr]
    );
    if (clientRows.length === 0) {
      return res.status(403).json({ error: "Cliente no encontrado" });
    }
    (req as any).portalClienteIntId = clientRows[0].id;
    (req as any).portalClienteId = cidStr;
    next();
  } catch (err) {
    logger.error({ err }, "visitas: requireCliente error");
    res.status(500).json({ error: "Error de autenticación" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTE — PWA del puesto
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/agente/visitas/extraer-dpi — IA OCR del DPI
//   Requiere device_uuid + device_token válidos para evitar abuso del servicio de IA.
visitasRouter.post("/agente/visitas/extraer-dpi", async (req, res) => {
  const ctx = await validarDeviceBody(req, res);
  if (!ctx) return;
  try {
    const { imagen } = req.body ?? {};
    if (!imagen || typeof imagen !== "string") {
      return res.status(400).json({ error: "imagen requerida (base64 data URL)" });
    }
    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!baseUrl || !apiKey) {
      return res.status(503).json({ error: "Integración de IA no configurada" });
    }
    const imageUrl = imagen.startsWith("data:") ? imagen : `data:image/jpeg;base64,${imagen}`;

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Eres un asistente que extrae datos del Documento Personal de Identificación (DPI/CUI) de Guatemala.
Analiza la imagen y extrae estos campos. El DPI muestra los apellidos antes que los nombres, pero debes devolverlos en orden NOMBRE APELLIDO (primero el nombre de pila, luego los apellidos).
Responde SOLO con un JSON válido con estas claves (deja vacío "" si no puedes leer el campo):
{
  "nombre_completo": "nombres de pila seguidos de los apellidos (ej: Juan Carlos Pérez García)",
  "dpi": "los 13 dígitos del CUI sin espacios",
  "fecha_nacimiento": "YYYY-MM-DD",
  "genero": "Masculino o Femenino"
}
No incluyas explicaciones, solo el JSON.`,
              },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      logger.error({ status: aiRes.status, errText }, "visitas/extraer-dpi: AI error");
      return res.status(502).json({ error: "Error del servicio de IA" });
    }

    const aiData = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
    const content = aiData.choices?.[0]?.message?.content ?? "";

    let datos: Record<string, string> = {};
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) datos = JSON.parse(match[0]);
    } catch {
      logger.warn({ content }, "visitas/extraer-dpi: no se pudo parsear JSON");
    }

    if (datos.nombre_completo) {
      datos.nombre_completo = datos.nombre_completo
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
    }
    if (datos.dpi) datos.dpi = datos.dpi.replace(/\D/g, "");

    res.json({ datos });
  } catch (err) {
    logger.error({ err }, "visitas/extraer-dpi error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// GET /api/agente/visitas/abiertas — lista personas y vehículos adentro en mi puesto
visitasRouter.get("/agente/visitas/abiertas", async (req, res) => {
  const ctx = await validarDeviceQuery(req, res);
  if (!ctx) return;
  if (!ctx.puesto_id) {
    return res.json({ personas: [], vehiculos: [], puesto_nombre: ctx.puesto_nombre, cliente_nombre: ctx.cliente_nombre });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, dpi_numero, nombre_completo, placa, marca_vehiculo, color_vehiculo,
              conductor_nombre, motivo, a_quien_visita, entrada_at,
              foto_persona_url, foto_vehiculo_url
         FROM visitas
        WHERE puesto_id = $1
          AND salida_at IS NULL
        ORDER BY entrada_at DESC`,
      [ctx.puesto_id]
    );
    res.json({
      puesto_nombre: ctx.puesto_nombre,
      cliente_nombre: ctx.cliente_nombre,
      personas: rows.filter(r => r.tipo === "persona"),
      vehiculos: rows.filter(r => r.tipo === "vehiculo"),
    });
  } catch (err) {
    logger.error({ err }, "agente/visitas/abiertas error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// POST /api/agente/visitas/entrada — registra entrada
visitasRouter.post("/agente/visitas/entrada", async (req, res) => {
  const ctx = await validarDeviceBody(req, res);
  if (!ctx) return;
  if (!ctx.puesto_id) {
    return res.status(400).json({ error: "Este teléfono no está vinculado a un puesto" });
  }

  const {
    tipo, employee_id,
    // persona
    dpi_numero, nombre_completo, fecha_nacimiento, genero, dpi_frente_url, foto_persona_url,
    // vehículo
    placa, marca_vehiculo, color_vehiculo, foto_vehiculo_url,
    conductor_dpi_numero, conductor_nombre, conductor_dpi_frente_url,
    // comunes
    motivo, a_quien_visita, observaciones,
  } = req.body ?? {};

  if (!tipo || !["persona", "vehiculo"].includes(tipo)) {
    return res.status(400).json({ error: "tipo inválido (persona o vehiculo)" });
  }

  // Validaciones por tipo
  if (tipo === "persona") {
    if (!dpi_numero || String(dpi_numero).trim().length < 5) {
      return res.status(400).json({ error: "DPI requerido" });
    }
  } else {
    if (!placa || String(placa).trim().length < 3) {
      return res.status(400).json({ error: "Placa requerida" });
    }
  }

  // Verificar duplicado abierto: misma persona o vehículo ya está adentro en este puesto
  if (tipo === "persona" && dpi_numero) {
    const { rows: dup } = await pool.query(
      `SELECT id FROM visitas WHERE puesto_id = $1 AND dpi_numero = $2 AND salida_at IS NULL LIMIT 1`,
      [ctx.puesto_id, String(dpi_numero).trim()]
    );
    if (dup.length > 0) {
      return res.status(409).json({ error: "Esta persona ya está registrada como adentro en este puesto", visita_id: dup[0].id });
    }
  }
  if (tipo === "vehiculo" && placa) {
    const placaNorm = String(placa).trim().toUpperCase().replace(/\s+/g, "");
    const { rows: dup } = await pool.query(
      `SELECT id FROM visitas WHERE puesto_id = $1 AND UPPER(REPLACE(placa,' ','')) = $2 AND salida_at IS NULL LIMIT 1`,
      [ctx.puesto_id, placaNorm]
    );
    if (dup.length > 0) {
      return res.status(409).json({ error: "Este vehículo ya está registrado como adentro en este puesto", visita_id: dup[0].id });
    }
  }

  // Resolver nombre del agente (si vino employee_id)
  let employeeNombre: string | null = null;
  if (employee_id) {
    const { rows } = await pool.query(`SELECT nombre_completo FROM employees WHERE id = $1`, [employee_id]);
    employeeNombre = rows[0]?.nombre_completo ?? null;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO visitas (
         tipo, puesto_id, cliente_id, cliente_nombre, puesto_nombre,
         dpi_numero, nombre_completo, fecha_nacimiento, genero, dpi_frente_url, foto_persona_url,
         placa, marca_vehiculo, color_vehiculo, foto_vehiculo_url,
         conductor_dpi_numero, conductor_nombre, conductor_dpi_frente_url,
         motivo, a_quien_visita, observaciones,
         entrada_at, entrada_employee_id, entrada_employee_nombre, entrada_device_id
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18,
         $19, $20, $21,
         NOW(), $22, $23, $24
       )
       RETURNING id, entrada_at`,
      [
        tipo, ctx.puesto_id, ctx.cliente_id, ctx.cliente_nombre, ctx.puesto_nombre,
        tipo === "persona" ? String(dpi_numero).trim() : null,
        tipo === "persona" ? (nombre_completo ?? null) : null,
        tipo === "persona" ? (fecha_nacimiento || null) : null,
        tipo === "persona" ? (genero ?? null) : null,
        tipo === "persona" ? (dpi_frente_url ?? null) : null,
        tipo === "persona" ? (foto_persona_url ?? null) : null,
        tipo === "vehiculo" ? String(placa).trim().toUpperCase() : null,
        tipo === "vehiculo" ? (marca_vehiculo ?? null) : null,
        tipo === "vehiculo" ? (color_vehiculo ?? null) : null,
        tipo === "vehiculo" ? (foto_vehiculo_url ?? null) : null,
        tipo === "vehiculo" ? (conductor_dpi_numero ?? null) : null,
        tipo === "vehiculo" ? (conductor_nombre ?? null) : null,
        tipo === "vehiculo" ? (conductor_dpi_frente_url ?? null) : null,
        motivo ?? null, a_quien_visita ?? null, observaciones ?? null,
        employee_id ?? null, employeeNombre, ctx.device_id,
      ]
    );
    res.json({ ok: true, id: rows[0].id, entrada_at: rows[0].entrada_at });
  } catch (err) {
    logger.error({ err }, "agente/visitas/entrada error");
    res.status(500).json({ error: "Error registrando entrada" });
  }
});

// POST /api/agente/visitas/salida — busca por DPI o placa y marca salida
visitasRouter.post("/agente/visitas/salida", async (req, res) => {
  const ctx = await validarDeviceBody(req, res);
  if (!ctx) return;
  if (!ctx.puesto_id) {
    return res.status(400).json({ error: "Este teléfono no está vinculado a un puesto" });
  }

  const { tipo, dpi_numero, placa, employee_id, observaciones, visita_id } = req.body ?? {};

  let row: any = null;

  // Si vino el id directo
  if (visita_id) {
    const { rows } = await pool.query(
      `SELECT * FROM visitas WHERE id = $1 AND puesto_id = $2 AND salida_at IS NULL LIMIT 1`,
      [visita_id, ctx.puesto_id]
    );
    row = rows[0];
  } else if (tipo === "persona" && dpi_numero) {
    const { rows } = await pool.query(
      `SELECT * FROM visitas
        WHERE puesto_id = $1 AND dpi_numero = $2 AND salida_at IS NULL
        ORDER BY entrada_at DESC LIMIT 1`,
      [ctx.puesto_id, String(dpi_numero).trim()]
    );
    row = rows[0];
  } else if (tipo === "vehiculo" && placa) {
    const placaNorm = String(placa).trim().toUpperCase().replace(/\s+/g, "");
    const { rows } = await pool.query(
      `SELECT * FROM visitas
        WHERE puesto_id = $1 AND UPPER(REPLACE(placa,' ','')) = $2 AND salida_at IS NULL
        ORDER BY entrada_at DESC LIMIT 1`,
      [ctx.puesto_id, placaNorm]
    );
    row = rows[0];
  } else {
    return res.status(400).json({ error: "Falta DPI o placa" });
  }

  if (!row) {
    return res.status(404).json({
      error: "no_encontrado",
      mensaje: "No hay una entrada abierta para esta persona o vehículo. Debe registrarse primero la entrada."
    });
  }

  // Resolver nombre del agente
  let employeeNombre: string | null = null;
  if (employee_id) {
    const { rows: e } = await pool.query(`SELECT nombre_completo FROM employees WHERE id = $1`, [employee_id]);
    employeeNombre = e[0]?.nombre_completo ?? null;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE visitas
          SET salida_at = NOW(),
              salida_employee_id = $1,
              salida_employee_nombre = $2,
              salida_device_id = $3,
              observaciones = COALESCE($4, observaciones)
        WHERE id = $5
        RETURNING id, salida_at, entrada_at, tipo, dpi_numero, nombre_completo, placa`,
      [employee_id ?? null, employeeNombre, ctx.device_id, observaciones ?? null, row.id]
    );
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    logger.error({ err }, "agente/visitas/salida error");
    res.status(500).json({ error: "Error registrando salida" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Panel web
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/visitas — listado con filtros
visitasRouter.get("/admin/visitas", requireAdmin, async (req, res) => {
  const desde = String(req.query.fecha_desde ?? "");
  const hasta = String(req.query.fecha_hasta ?? "");
  const cliente_id = req.query.cliente_id ? Number(req.query.cliente_id) : null;
  const puesto_id = req.query.puesto_id ? Number(req.query.puesto_id) : null;
  const tipo = String(req.query.tipo ?? "").toLowerCase();
  const estado = String(req.query.estado ?? ""); // "abiertas" | "cerradas" | ""
  const q = String(req.query.q ?? "").trim();

  const where: string[] = [];
  const params: any[] = [];

  if (desde) { params.push(desde); where.push(`(entrada_at AT TIME ZONE 'America/Guatemala')::date >= $${params.length}::date`); }
  if (hasta) { params.push(hasta); where.push(`(entrada_at AT TIME ZONE 'America/Guatemala')::date <= $${params.length}::date`); }
  if (cliente_id) { params.push(cliente_id); where.push(`cliente_id = $${params.length}`); }
  if (puesto_id) { params.push(puesto_id); where.push(`puesto_id = $${params.length}`); }
  if (tipo === "persona" || tipo === "vehiculo") { params.push(tipo); where.push(`tipo = $${params.length}`); }
  if (estado === "abiertas") where.push(`salida_at IS NULL`);
  if (estado === "cerradas") where.push(`salida_at IS NOT NULL`);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(dpi_numero ILIKE $${params.length} OR nombre_completo ILIKE $${params.length} OR placa ILIKE $${params.length} OR conductor_nombre ILIKE $${params.length} OR a_quien_visita ILIKE $${params.length})`);
  }

  const sql = `
    SELECT id, tipo, puesto_id, puesto_nombre, cliente_id, cliente_nombre,
           dpi_numero, nombre_completo, fecha_nacimiento, genero,
           placa, marca_vehiculo, color_vehiculo, conductor_nombre, conductor_dpi_numero,
           motivo, a_quien_visita, observaciones,
           entrada_at, entrada_employee_nombre,
           salida_at, salida_employee_nombre,
           (foto_persona_url IS NOT NULL) AS tiene_foto_persona,
           (foto_vehiculo_url IS NOT NULL) AS tiene_foto_vehiculo,
           (dpi_frente_url IS NOT NULL) AS tiene_foto_dpi,
           (conductor_dpi_frente_url IS NOT NULL) AS tiene_foto_conductor_dpi
      FROM visitas
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY entrada_at DESC
     LIMIT 5000
  `;

  try {
    const { rows } = await pool.query(sql, params);
    res.json({ visitas: rows, total: rows.length });
  } catch (err) {
    logger.error({ err }, "admin/visitas error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// GET /api/admin/visitas/foto/:id/:tipo — sirve la foto guardada (data URL)
visitasRouter.get("/admin/visitas/foto/:id/:tipo", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const tipo = String(req.params.tipo);
  const colMap: Record<string, string> = {
    persona: "foto_persona_url",
    vehiculo: "foto_vehiculo_url",
    dpi: "dpi_frente_url",
    conductor_dpi: "conductor_dpi_frente_url",
  };
  const col = colMap[tipo];
  if (!col) return res.status(400).json({ error: "tipo inválido" });
  try {
    const { rows } = await pool.query(`SELECT ${col} AS url FROM visitas WHERE id = $1`, [id]);
    if (!rows[0] || !rows[0].url) return res.status(404).json({ error: "no encontrada" });
    res.json({ url: rows[0].url });
  } catch (err) {
    logger.error({ err }, "admin/visitas/foto error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// GET /api/admin/visitas/estadisticas?anio&mes&cliente_id?&puesto_id?
visitasRouter.get("/admin/visitas/estadisticas", requireAdmin, async (req, res) => {
  const ahoraGT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const anio = req.query.anio ? Number(req.query.anio) : ahoraGT.getFullYear();
  const mes = req.query.mes ? Number(req.query.mes) : ahoraGT.getMonth() + 1;
  const cliente_id = req.query.cliente_id ? Number(req.query.cliente_id) : null;
  const puesto_id = req.query.puesto_id ? Number(req.query.puesto_id) : null;

  try {
    // WHERE dinámico: $1=anio, $2=mes, luego cliente_id y puesto_id si vienen
    function buildFiltro(startIdx: number) {
      const extras: string[] = [];
      const extraParams: any[] = [];
      let idx = startIdx;
      if (cliente_id) { extras.push(`AND cliente_id = $${idx++}`); extraParams.push(cliente_id); }
      if (puesto_id)  { extras.push(`AND puesto_id  = $${idx++}`); extraParams.push(puesto_id); }
      return { sql: extras.join(" "), params: extraParams };
    }
    const f = buildFiltro(3);
    const params: any[] = [anio, mes, ...f.params];

    // KPIs del mes
    const { rows: kpis } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo = 'persona')   AS personas_mes,
         COUNT(*) FILTER (WHERE tipo = 'vehiculo')  AS vehiculos_mes,
         COUNT(*)                                    AS total_mes
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         ${f.sql}`,
      params
    );

    // Mes anterior para comparar
    const mesAnt = mes === 1 ? 12 : mes - 1;
    const anioAnt = mes === 1 ? anio - 1 : anio;
    const paramsAnt: any[] = [anioAnt, mesAnt, ...f.params];
    const { rows: kpisAnt } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo = 'persona')   AS personas_mes,
         COUNT(*) FILTER (WHERE tipo = 'vehiculo')  AS vehiculos_mes,
         COUNT(*)                                    AS total_mes
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         ${f.sql}`,
      paramsAnt
    );

    // Por día del mes
    const { rows: porDia } = await pool.query(
      `SELECT
         EXTRACT(DAY FROM entrada_at AT TIME ZONE 'America/Guatemala')::int AS dia,
         COUNT(*) FILTER (WHERE tipo = 'persona')   AS personas,
         COUNT(*) FILTER (WHERE tipo = 'vehiculo')  AS vehiculos
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         ${f.sql}
       GROUP BY dia
       ORDER BY dia ASC`,
      params
    );

    // Top 5 puestos (sede)
    const { rows: topPuestos } = await pool.query(
      `SELECT puesto_id, puesto_nombre, cliente_nombre,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE tipo = 'persona') AS personas,
              COUNT(*) FILTER (WHERE tipo = 'vehiculo') AS vehiculos
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         ${f.sql}
       GROUP BY puesto_id, puesto_nombre, cliente_nombre
       ORDER BY total DESC
       LIMIT 5`,
      params
    );

    res.json({
      anio, mes,
      cliente_id, puesto_id,
      kpis: kpis[0] ?? { personas_mes: 0, vehiculos_mes: 0, total_mes: 0 },
      kpis_mes_anterior: kpisAnt[0] ?? { personas_mes: 0, vehiculos_mes: 0, total_mes: 0 },
      por_dia: porDia,
      top_puestos: topPuestos,
    });
  } catch (err) {
    logger.error({ err }, "admin/visitas/estadisticas error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// GET /api/admin/visitas/filtros?cliente_id?
// Devuelve lista de clientes activos y, si se pasa cliente_id, sus sedes (puestos operativos).
visitasRouter.get("/admin/visitas/filtros", requireAdmin, async (req, res) => {
  const cliente_id = req.query.cliente_id ? Number(req.query.cliente_id) : null;
  try {
    const { rows: clientes } = await pool.query(
      `SELECT id, COALESCE(nombre_comercial, nombre) AS nombre
         FROM clients
        WHERE estado = 'activo'
        ORDER BY nombre`
    );
    let puestos: any[] = [];
    if (cliente_id) {
      const { rows } = await pool.query(
        `SELECT id, nombre
           FROM puestos_operativos
          WHERE cliente_id = $1 AND activo = TRUE
          ORDER BY nombre`,
        [cliente_id]
      );
      puestos = rows;
    }
    res.json({ clientes, puestos });
  } catch (err) {
    logger.error({ err }, "admin/visitas/filtros error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL CLIENTE
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/portal-cliente/visitas
visitasRouter.get("/portal-cliente/visitas", requireCliente, async (req, res) => {
  const cidInt = (req as any).portalClienteIntId as number;
  const desde = String(req.query.fecha_desde ?? "");
  const hasta = String(req.query.fecha_hasta ?? "");
  const puesto_id = req.query.puesto_id ? Number(req.query.puesto_id) : null;
  const tipo = String(req.query.tipo ?? "").toLowerCase();
  const q = String(req.query.q ?? "").trim();

  const where: string[] = [`cliente_id = $1`];
  const params: any[] = [cidInt];

  if (desde) { params.push(desde); where.push(`(entrada_at AT TIME ZONE 'America/Guatemala')::date >= $${params.length}::date`); }
  if (hasta) { params.push(hasta); where.push(`(entrada_at AT TIME ZONE 'America/Guatemala')::date <= $${params.length}::date`); }
  if (puesto_id) { params.push(puesto_id); where.push(`puesto_id = $${params.length}`); }
  if (tipo === "persona" || tipo === "vehiculo") { params.push(tipo); where.push(`tipo = $${params.length}`); }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(dpi_numero ILIKE $${params.length} OR nombre_completo ILIKE $${params.length} OR placa ILIKE $${params.length} OR conductor_nombre ILIKE $${params.length} OR a_quien_visita ILIKE $${params.length})`);
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, puesto_id, puesto_nombre,
              dpi_numero, nombre_completo, placa, marca_vehiculo, color_vehiculo,
              conductor_nombre, motivo, a_quien_visita,
              entrada_at, entrada_employee_nombre,
              salida_at, salida_employee_nombre
         FROM visitas
        WHERE ${where.join(" AND ")}
        ORDER BY entrada_at DESC
        LIMIT 5000`,
      params
    );
    res.json({ visitas: rows, total: rows.length });
  } catch (err) {
    logger.error({ err }, "portal-cliente/visitas error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// GET /api/portal-cliente/visitas/estadisticas
visitasRouter.get("/portal-cliente/visitas/estadisticas", requireCliente, async (req, res) => {
  const cidInt = (req as any).portalClienteIntId as number;
  const ahoraGT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const anio = req.query.anio ? Number(req.query.anio) : ahoraGT.getFullYear();
  const mes = req.query.mes ? Number(req.query.mes) : ahoraGT.getMonth() + 1;

  try {
    const params = [anio, mes, cidInt];

    const { rows: kpis } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo = 'persona')   AS personas_mes,
         COUNT(*) FILTER (WHERE tipo = 'vehiculo')  AS vehiculos_mes,
         COUNT(*)                                    AS total_mes
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         AND cliente_id = $3`,
      params
    );

    const mesAnt = mes === 1 ? 12 : mes - 1;
    const anioAnt = mes === 1 ? anio - 1 : anio;
    const { rows: kpisAnt } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo = 'persona')   AS personas_mes,
         COUNT(*) FILTER (WHERE tipo = 'vehiculo')  AS vehiculos_mes,
         COUNT(*)                                    AS total_mes
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         AND cliente_id = $3`,
      [anioAnt, mesAnt, cidInt]
    );

    const { rows: porDia } = await pool.query(
      `SELECT
         EXTRACT(DAY FROM entrada_at AT TIME ZONE 'America/Guatemala')::int AS dia,
         COUNT(*) FILTER (WHERE tipo = 'persona')   AS personas,
         COUNT(*) FILTER (WHERE tipo = 'vehiculo')  AS vehiculos
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         AND cliente_id = $3
       GROUP BY dia
       ORDER BY dia ASC`,
      params
    );

    const { rows: topPuestos } = await pool.query(
      `SELECT puesto_id, puesto_nombre,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE tipo = 'persona') AS personas,
              COUNT(*) FILTER (WHERE tipo = 'vehiculo') AS vehiculos
       FROM visitas
       WHERE EXTRACT(YEAR FROM entrada_at AT TIME ZONE 'America/Guatemala') = $1
         AND EXTRACT(MONTH FROM entrada_at AT TIME ZONE 'America/Guatemala') = $2
         AND cliente_id = $3
       GROUP BY puesto_id, puesto_nombre
       ORDER BY total DESC
       LIMIT 5`,
      params
    );

    res.json({
      anio, mes,
      kpis: kpis[0] ?? { personas_mes: 0, vehiculos_mes: 0, total_mes: 0 },
      kpis_mes_anterior: kpisAnt[0] ?? { personas_mes: 0, vehiculos_mes: 0, total_mes: 0 },
      por_dia: porDia,
      top_puestos: topPuestos,
    });
  } catch (err) {
    logger.error({ err }, "portal-cliente/visitas/estadisticas error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default visitasRouter;
