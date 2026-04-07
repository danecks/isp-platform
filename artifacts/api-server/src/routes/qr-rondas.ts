import { Router } from "express";
import { pool } from "@workspace/db";
import { v4 as uuidv4 } from "uuid";

export const qrRondasRouter = Router();

// ── Utilidad: distancia Haversine en metros ────────────────────────────────
function haversineMetros(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
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

// ══════════════════════════════════════════════════════════════════════════════
// ESCANEO (interfaz guardia) — DEBE IR ANTES de las rutas /:id
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/qr-rondas/scan/:token — info del punto (pre-verificación)
qrRondasRouter.get("/qr-rondas/scan/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.radio_metros, p.activo,
              r.nombre AS ronda_nombre, r.activo AS ronda_activa
       FROM qr_ronda_puntos p
       JOIN qr_rondas r ON r.id = p.ronda_id
       WHERE p.qr_token = $1`,
      [token]
    );
    if (!rows[0]) return res.status(404).json({ error: "Código QR no válido" });
    if (!rows[0].activo || !rows[0].ronda_activa) {
      return res.status(403).json({ error: "Este punto de control no está activo" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error verificando token" });
  }
});

// POST /api/qr-rondas/scan — registrar escaneo del guardia
qrRondasRouter.post("/qr-rondas/scan", async (req, res) => {
  const { token, latitud, longitud, precision_metros } = req.body;
  if (!token) return res.status(400).json({ error: "token requerido" });

  try {
    const puntoQ = await pool.query(
      `SELECT p.*, r.activo AS ronda_activa
       FROM qr_ronda_puntos p
       JOIN qr_rondas r ON r.id = p.ronda_id
       WHERE p.qr_token = $1`,
      [token]
    );
    const punto = puntoQ.rows[0];
    if (!punto) return res.status(404).json({ error: "Código QR no válido" });
    if (!punto.activo || !punto.ronda_activa) {
      return res.status(403).json({ error: "Punto de control inactivo" });
    }

    let resultado = "sin_gps";
    let distancia_metros: number | null = null;

    if (latitud != null && longitud != null) {
      distancia_metros = Math.round(
        haversineMetros(
          Number(latitud), Number(longitud),
          Number(punto.latitud_ref), Number(punto.longitud_ref)
        )
      );
      resultado = distancia_metros <= punto.radio_metros ? "ok" : "fuera_de_rango";
    }

    const user_id = (req as any).user?.id || null;

    const { rows } = await pool.query(
      `INSERT INTO qr_ronda_eventos
         (punto_id, user_id, latitud, longitud, precision_metros, distancia_metros, resultado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [punto.id, user_id, latitud || null, longitud || null, precision_metros || null, distancia_metros, resultado]
    );

    res.json({
      resultado,
      distancia_metros,
      radio_metros: punto.radio_metros,
      nombre_punto: punto.nombre,
      evento_id: rows[0].id,
    });
  } catch (err) {
    res.status(500).json({ error: "Error registrando escaneo" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RONDAS (agrupación)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/qr-rondas — listar rondas con conteo de puntos
qrRondasRouter.get("/qr-rondas", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, c.nombre AS cliente_nombre,
             COUNT(p.id) FILTER (WHERE p.activo) AS total_puntos
      FROM qr_rondas r
      LEFT JOIN clients c ON c.id = r.cliente_id
      LEFT JOIN qr_ronda_puntos p ON p.ronda_id = r.id
      GROUP BY r.id, c.nombre
      ORDER BY r.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error listando rondas" });
  }
});

// POST /api/qr-rondas — crear ronda
qrRondasRouter.post("/qr-rondas", async (req, res) => {
  const { nombre, descripcion, cliente_id } = req.body;
  if (!nombre) return res.status(400).json({ error: "nombre requerido" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO qr_rondas (nombre, descripcion, cliente_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre, descripcion || null, cliente_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error creando ronda" });
  }
});

// GET /api/qr-rondas/estadisticas?dias=7&ronda_id=
// IMPORTANTE: debe ir ANTES de /:id para que Express no capture "estadisticas" como ID
qrRondasRouter.get("/qr-rondas/estadisticas", async (req, res) => {
  const dias    = Math.min(Math.max(parseInt(String(req.query.dias || "7")), 1), 365);
  const rondaId = req.query.ronda_id ? parseInt(String(req.query.ronda_id)) : null;

  const filtroRonda  = rondaId ? `AND p.ronda_id = ${rondaId}` : "";
  const filtroEvento = rondaId ? `AND p.ronda_id = ${rondaId}` : "";

  try {
    const [frecPunto, distribHora, tendDiaria, rankAgentes, puntosSinAct, resumen] =
      await Promise.all([

        // 1. Frecuencia por punto
        pool.query(`
          SELECT p.id AS punto_id, p.nombre AS punto_nombre,
                 r.nombre AS ronda_nombre, r.id AS ronda_id,
                 COUNT(e.id)::int                                                AS total,
                 COUNT(e.id) FILTER (WHERE e.resultado = 'ok')::int             AS ok,
                 COUNT(e.id) FILTER (WHERE e.resultado = 'fuera_de_rango')::int AS fuera_de_rango,
                 COUNT(e.id) FILTER (WHERE e.resultado = 'sin_gps')::int        AS sin_gps,
                 MAX(e.escaneado_en)                                             AS ultimo_escaneo
          FROM qr_ronda_puntos p
          JOIN qr_rondas r ON r.id = p.ronda_id
          LEFT JOIN qr_ronda_eventos e ON e.punto_id = p.id
            AND e.escaneado_en >= NOW() - INTERVAL '${dias} days'
          WHERE p.activo = true ${filtroRonda}
          GROUP BY p.id, p.nombre, r.nombre, r.id
          ORDER BY total DESC
        `),

        // 2. Distribución horaria (hora local UTC-6)
        pool.query(`
          SELECT EXTRACT(HOUR FROM (e.escaneado_en AT TIME ZONE 'America/Guatemala'))::int AS hora,
                 COUNT(*)::int AS total
          FROM qr_ronda_eventos e
          JOIN qr_ronda_puntos p ON p.id = e.punto_id
          WHERE e.escaneado_en >= NOW() - INTERVAL '${dias} days'
            ${filtroEvento}
          GROUP BY hora ORDER BY hora
        `),

        // 3. Tendencia diaria
        pool.query(`
          SELECT (e.escaneado_en AT TIME ZONE 'America/Guatemala')::date AS fecha,
                 COUNT(*)::int AS total
          FROM qr_ronda_eventos e
          JOIN qr_ronda_puntos p ON p.id = e.punto_id
          WHERE e.escaneado_en >= NOW() - INTERVAL '${dias} days'
            ${filtroEvento}
          GROUP BY fecha ORDER BY fecha
        `),

        // 4. Ranking de agentes
        pool.query(`
          SELECT COALESCE(u.nombre, 'Sin identificar') AS guardia_nombre,
                 COUNT(*)::int AS total
          FROM qr_ronda_eventos e
          LEFT JOIN users u ON u.id = e.user_id
          JOIN qr_ronda_puntos p ON p.id = e.punto_id
          WHERE e.escaneado_en >= NOW() - INTERVAL '${dias} days'
            ${filtroEvento}
          GROUP BY u.nombre ORDER BY total DESC LIMIT 15
        `),

        // 5. Puntos sin actividad reciente (más de 12h sin escaneo)
        pool.query(`
          SELECT p.id AS punto_id, p.nombre AS punto_nombre, r.nombre AS ronda_nombre,
                 MAX(e.escaneado_en) AS ultimo_escaneo,
                 ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(e.escaneado_en)))/3600)::int AS horas_sin_actividad
          FROM qr_ronda_puntos p
          JOIN qr_rondas r ON r.id = p.ronda_id
          LEFT JOIN qr_ronda_eventos e ON e.punto_id = p.id
          WHERE p.activo = true AND r.activo = true ${filtroRonda}
          GROUP BY p.id, p.nombre, r.nombre
          HAVING MAX(e.escaneado_en) < NOW() - INTERVAL '12 hours'
              OR MAX(e.escaneado_en) IS NULL
          ORDER BY ultimo_escaneo ASC NULLS FIRST
          LIMIT 20
        `),

        // 6. Resumen global
        pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM qr_ronda_eventos e
             JOIN qr_ronda_puntos p ON p.id = e.punto_id
             WHERE e.escaneado_en >= NOW() - INTERVAL '${dias} days'
               ${filtroEvento}) AS total_escaneos,
            (SELECT COUNT(*)::int FROM qr_ronda_puntos
             WHERE activo = true ${rondaId ? `AND ronda_id = ${rondaId}` : ""}) AS total_puntos_activos,
            (SELECT COUNT(*)::int FROM qr_rondas
             WHERE activo = true ${rondaId ? `AND id = ${rondaId}` : ""}) AS total_rondas_activas,
            (SELECT COUNT(DISTINCT e.punto_id)::int FROM qr_ronda_eventos e
             JOIN qr_ronda_puntos p ON p.id = e.punto_id
             WHERE e.escaneado_en >= NOW() - INTERVAL '${dias} days'
               ${filtroEvento}) AS puntos_con_actividad
        `),
      ]);

    res.json({
      frecuencia_por_punto: frecPunto.rows,
      distribucion_horaria: distribHora.rows,
      tendencia_diaria:     tendDiaria.rows,
      ranking_agentes:      rankAgentes.rows,
      puntos_sin_actividad: puntosSinAct.rows,
      resumen:              resumen.rows[0],
      parametros:           { dias, ronda_id: rondaId },
    });
  } catch (err) {
    console.error("Error estadisticas rondas:", err);
    res.status(500).json({ error: "Error calculando estadísticas" });
  }
});

// GET /api/qr-rondas/:id — detalle con puntos
qrRondasRouter.get("/qr-rondas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const ronda = await pool.query(
      `SELECT r.*, c.nombre AS cliente_nombre
       FROM qr_rondas r LEFT JOIN clients c ON c.id = r.cliente_id
       WHERE r.id = $1`,
      [id]
    );
    if (!ronda.rows[0]) return res.status(404).json({ error: "No encontrada" });
    const puntos = await pool.query(
      `SELECT * FROM qr_ronda_puntos WHERE ronda_id = $1 ORDER BY orden ASC`,
      [id]
    );
    res.json({ ...ronda.rows[0], puntos: puntos.rows });
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo ronda" });
  }
});

// PUT /api/qr-rondas/:id — actualizar ronda
qrRondasRouter.put("/qr-rondas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { nombre, descripcion, cliente_id, activo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE qr_rondas SET nombre=$1, descripcion=$2, cliente_id=$3, activo=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [nombre, descripcion || null, cliente_id || null, activo ?? true, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error actualizando ronda" });
  }
});

// DELETE /api/qr-rondas/:id — eliminar ronda
qrRondasRouter.delete("/qr-rondas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query(`DELETE FROM qr_rondas WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando ronda" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUNTOS DE CONTROL
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/qr-rondas/:id/puntos — agregar punto
qrRondasRouter.post("/qr-rondas/:id/puntos", async (req, res) => {
  const ronda_id = parseInt(req.params.id);
  if (isNaN(ronda_id)) return res.status(400).json({ error: "ID inválido" });
  const { nombre, descripcion, latitud_ref, longitud_ref, radio_metros, orden } = req.body;
  if (!nombre || latitud_ref == null || longitud_ref == null) {
    return res.status(400).json({ error: "nombre, latitud_ref y longitud_ref son requeridos" });
  }
  try {
    const qr_token = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO qr_ronda_puntos
         (ronda_id, nombre, descripcion, qr_token, latitud_ref, longitud_ref, radio_metros, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        ronda_id, nombre, descripcion || null, qr_token,
        latitud_ref, longitud_ref,
        radio_metros || 30,
        orden || 1,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error creando punto" });
  }
});

// PUT /api/qr-rondas/:id/puntos/:puntoId — actualizar punto
qrRondasRouter.put("/qr-rondas/:id/puntos/:puntoId", async (req, res) => {
  const puntoId = parseInt(req.params.puntoId);
  if (isNaN(puntoId)) return res.status(400).json({ error: "ID inválido" });
  const { nombre, descripcion, latitud_ref, longitud_ref, radio_metros, orden, activo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE qr_ronda_puntos
       SET nombre=$1, descripcion=$2, latitud_ref=$3, longitud_ref=$4,
           radio_metros=$5, orden=$6, activo=$7
       WHERE id=$8 RETURNING *`,
      [nombre, descripcion || null, latitud_ref, longitud_ref, radio_metros || 30, orden || 1, activo ?? true, puntoId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Punto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error actualizando punto" });
  }
});

// DELETE /api/qr-rondas/:id/puntos/:puntoId — eliminar punto
qrRondasRouter.delete("/qr-rondas/:id/puntos/:puntoId", async (req, res) => {
  const puntoId = parseInt(req.params.puntoId);
  if (isNaN(puntoId)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query(`DELETE FROM qr_ronda_puntos WHERE id=$1`, [puntoId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando punto" });
  }
});

// GET /api/qr-rondas/:id/eventos — historial de escaneos
qrRondasRouter.get("/qr-rondas/:id/eventos", async (req, res) => {
  const ronda_id = parseInt(req.params.id);
  if (isNaN(ronda_id)) return res.status(400).json({ error: "ID inválido" });
  const { desde, hasta } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT e.*, p.nombre AS punto_nombre, p.orden AS punto_orden,
              u.nombre AS guardia_nombre
       FROM qr_ronda_eventos e
       JOIN qr_ronda_puntos p ON p.id = e.punto_id
       LEFT JOIN users u ON u.id = e.user_id
       WHERE p.ronda_id = $1
         AND ($2::timestamptz IS NULL OR e.escaneado_en >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR e.escaneado_en <= $3::timestamptz)
       ORDER BY e.escaneado_en DESC
       LIMIT 500`,
      [ronda_id, desde || null, hasta || null]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo eventos" });
  }
});
