import { Router } from "express";
import { pool } from "@workspace/db";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

export const agenteFichajeRouter = Router();

// ── Haversine ────────────────────────────────────────────────────────────────
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
// PÚBLICO — no requiere sesión
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/agente/scan/:token — info del agente al escanear el QR
agenteFichajeRouter.get("/agente/scan/:token", async (req, res) => {
  const { token } = req.params;
  try {
    // 1) Obtener empleado desde el token
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

    // 2) Puesto operativo actual del agente
    const { rows: poRows } = await pool.query(
      `SELECT po.id, po.nombre, po.cliente_nombre, po.horario,
              po.hora_entrada, po.hora_salida, po.turno, po.jornada
       FROM puestos_operativos po
       WHERE po.agente_id = $1
         AND po.estado = 'cubierto'
       LIMIT 1`,
      [emp.employee_id]
    );
    const puesto = poRows[0] ?? null;

    // 3) GPS del puesto (si existe)
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

    // 4) Armamento asignado al puesto
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

    // 5) ¿Ya fichó hoy?
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

// POST /api/agente/fichaje — registrar fichaje (llegada al puesto)
agenteFichajeRouter.post("/agente/fichaje", async (req, res) => {
  const { token, latitud, longitud, precision_metros } = req.body;
  if (!token) return res.status(400).json({ error: "token requerido" });

  try {
    // Obtener empleado y puesto
    const { rows: tkRows } = await pool.query(
      `SELECT aqt.employee_id, aqt.activo
       FROM agente_qr_tokens aqt
       WHERE aqt.qr_token = $1`,
      [token]
    );
    if (!tkRows[0] || !tkRows[0].activo) {
      return res.status(404).json({ error: "QR no válido" });
    }
    const employeeId = tkRows[0].employee_id;

    // Puesto del agente
    const { rows: poRows } = await pool.query(
      `SELECT po.id FROM puestos_operativos po
       WHERE po.agente_id = $1 AND po.estado = 'cubierto' LIMIT 1`,
      [employeeId]
    );
    const puestoId = poRows[0]?.id ?? null;

    // Verificar duplicado del día
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

    // Validar GPS vs puesto
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
        resultado = "ok"; // No hay GPS configurado → se permite
      }
    } else if (latitud != null && longitud != null) {
      resultado = "ok"; // Hay GPS pero no hay puesto configurado → se permite
    }

    if (resultado === "fuera_de_zona") {
      return res.status(403).json({
        error: "fuera_de_zona",
        distancia_metros: distanciaMetros,
        mensaje: `Estás a ${distanciaMetros} m del puesto. Debes estar dentro del radio permitido.`,
      });
    }

    // Registrar fichaje
    const { rows: inserted } = await pool.query(
      `INSERT INTO agente_fichajes
         (employee_id, puesto_id, qr_token, latitud, longitud, distancia_metros, resultado, tipo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'fichaje')
       RETURNING id, registrado_en`,
      [employeeId, puestoId, token,
       latitud ?? null, longitud ?? null, distanciaMetros, resultado]
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

// ═══════════════════════════════════════════════════════════════════════════════
// SUPERVISIÓN — requiere sesión activa de supervisor/admin
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/agente/supervision
agenteFichajeRouter.post("/agente/supervision", async (req, res) => {
  const session = (req as any).session;
  if (!session?.userId) {
    return res.status(401).json({ error: "Sesión de supervisor requerida" });
  }

  const { token, checks, calificacion, observaciones, latitud, longitud } = req.body;
  if (!token) return res.status(400).json({ error: "token requerido" });

  try {
    // Verificar que el usuario es supervisor/admin
    const { rows: userRows } = await pool.query(
      `SELECT u.id, u.nombre, u.rol FROM users u WHERE u.id = $1`,
      [session.userId]
    );
    if (!userRows[0]) return res.status(403).json({ error: "Usuario no encontrado" });
    const user = userRows[0];
    const rolesPermitidos = ["admin", "supervisor", "operaciones"];
    if (!rolesPermitidos.includes(user.rol)) {
      return res.status(403).json({ error: "No tienes permiso para registrar supervisiones" });
    }

    // Obtener empleado
    const { rows: tkRows } = await pool.query(
      `SELECT aqt.employee_id, aqt.activo FROM agente_qr_tokens aqt WHERE aqt.qr_token = $1`,
      [token]
    );
    if (!tkRows[0] || !tkRows[0].activo) {
      return res.status(404).json({ error: "QR no válido" });
    }
    const employeeId = tkRows[0].employee_id;

    // Puesto del agente
    const { rows: poRows } = await pool.query(
      `SELECT id FROM puestos_operativos WHERE agente_id = $1 AND estado = 'cubierto' LIMIT 1`,
      [employeeId]
    );
    const puestoId = poRows[0]?.id ?? null;

    // GPS validation (optional — supervisors may be mobile)
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
          resultado, tipo, supervisor_id, supervisor_nombre, checks, calificacion, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,'ok','supervision',$7,$8,$9,$10,$11)
       RETURNING id, registrado_en`,
      [
        employeeId, puestoId, token,
        latitud ?? null, longitud ?? null, distanciaMetros,
        user.id, user.nombre,
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

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — gestión de tokens y consulta de fichajes
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/agente/tokens — lista de empleados con su token QR
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

// POST /api/agente/tokens/generate — generar token para un empleado
agenteFichajeRouter.post("/agente/tokens/generate", async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "employee_id requerido" });

  try {
    // Desactivar token anterior si existe
    await pool.query(
      `UPDATE agente_qr_tokens SET activo = FALSE WHERE employee_id = $1`,
      [employee_id]
    );
    // Insertar nuevo token
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

// DELETE /api/agente/tokens/:id — revocar token
agenteFichajeRouter.delete("/agente/tokens/:id", async (req, res) => {
  try {
    await pool.query(
      `UPDATE agente_qr_tokens SET activo = FALSE WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error revocando token" });
  }
});

// GET /api/agente/fichajes — historial de fichajes y supervisiones
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
             po.nombre AS puesto_nombre, po.cliente_nombre
      FROM agente_fichajes af
      JOIN employees e ON e.id = af.employee_id
      LEFT JOIN puestos_operativos po ON po.id = af.puesto_id
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

// GET /api/puestos-gps — puestos con y sin GPS configurado
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

// PUT /api/puestos-gps/:puesto_id — configurar GPS de un puesto
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
