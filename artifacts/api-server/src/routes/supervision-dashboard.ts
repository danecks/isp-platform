import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// Fase D — Dashboard de Supervisión: KPIs y desglose por supervisor.
// También expone tracking GPS asociado al fichaje del supervisor durante la visita.

export const supervisionDashboardRouter = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const auth = (req: any, res: any): boolean => {
  if (!req.headers["x-isp-session"]) { res.status(401).json({ error: "No autorizado" }); return false; }
  return true;
};

// ── GET /api/supervision-dashboard?desde=&hasta=&supervisor= ──
supervisionDashboardRouter.get("/supervision-dashboard", async (req, res) => {
  if (!auth(req, res)) return;

  const desde = String(req.query.desde ?? "");
  const hasta = String(req.query.hasta ?? "");
  const sup = req.query.supervisor ? Number(req.query.supervisor) : null;
  if (desde && !ISO_DATE.test(desde)) return res.status(400).json({ error: "desde inválido" });
  if (hasta && !ISO_DATE.test(hasta)) return res.status(400).json({ error: "hasta inválido" });
  if (sup !== null && (!Number.isInteger(sup) || sup <= 0)) {
    return res.status(400).json({ error: "supervisor inválido" });
  }

  try {
    const params: any[] = [];
    const where: string[] = [];
    if (desde) { params.push(desde); where.push(`sp.fecha_planificada >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`sp.fecha_planificada <= $${params.length}`); }
    if (!desde && !hasta) {
      where.push(`sp.fecha_planificada >= (CURRENT_DATE - INTERVAL '7 days')`);
      where.push(`sp.fecha_planificada <= CURRENT_DATE`);
    }
    if (sup) { params.push(sup); where.push(`sp.supervisor_employee_id = $${params.length}`); }
    const W = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows: kpiRows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         SUM(CASE WHEN sp.estado = 'pendiente'    THEN 1 ELSE 0 END)::int AS pendientes,
         SUM(CASE WHEN sp.estado = 'en_curso'     THEN 1 ELSE 0 END)::int AS en_curso,
         SUM(CASE WHEN sp.estado = 'completada'   THEN 1 ELSE 0 END)::int AS completadas,
         SUM(CASE WHEN sp.estado = 'no_realizada' THEN 1 ELSE 0 END)::int AS no_realizadas,
         SUM(CASE WHEN sp.estado = 'cancelada'    THEN 1 ELSE 0 END)::int AS canceladas,
         SUM(CASE WHEN sp.tipo  = 'rutina'          THEN 1 ELSE 0 END)::int AS rutinas,
         SUM(CASE WHEN sp.tipo  = 'comision'        THEN 1 ELSE 0 END)::int AS comisiones,
         SUM(CASE WHEN sp.tipo  = 'extraordinaria'  THEN 1 ELSE 0 END)::int AS extraordinarias
       FROM supervision_visitas_programadas sp ${W}`,
      params
    );
    const k = kpiRows[0] || {};
    const cumplimiento = k.total > 0 ? Math.round((k.completadas / k.total) * 1000) / 10 : 0;

    // SUPERV-NOV-02: contador y listado breve de abandonos de puesto
    // detectados en el rango (o últimos 7 días si no se filtra). Se
    // calcula sobre supervision_novedades.tipo = 'abandono_puesto'
    // aplicando los mismos filtros de fecha/supervisor del KPI principal.
    const novParams: any[] = [];
    const novWhere: string[] = [`n.tipo = 'abandono_puesto'`];
    if (desde) { novParams.push(desde); novWhere.push(`n.fecha >= $${novParams.length}`); }
    if (hasta) { novParams.push(hasta); novWhere.push(`n.fecha <= $${novParams.length}`); }
    if (!desde && !hasta) {
      novWhere.push(`n.fecha >= (CURRENT_DATE - INTERVAL '7 days')`);
      novWhere.push(`n.fecha <= CURRENT_DATE`);
    }
    if (sup) { novParams.push(sup); novWhere.push(`n.supervisor_employee_id = $${novParams.length}`); }
    const NW = `WHERE ${novWhere.join(" AND ")}`;

    const { rows: abandonoRows } = await pool.query(
      `SELECT n.id,
              to_char(n.generada_at, 'YYYY-MM-DD HH24:MI') AS generada_at,
              n.observaciones,
              po.nombre AS puesto_nombre,
              c.nombre  AS cliente_nombre,
              e.nombre_completo AS supervisor_nombre,
              n.datos_consolidados AS datos
         FROM supervision_novedades n
         LEFT JOIN puestos_operativos po ON po.id = n.puesto_id
         LEFT JOIN clients c             ON c.id  = n.cliente_id
         LEFT JOIN employees e           ON e.id  = n.supervisor_employee_id
         ${NW}
         ORDER BY n.generada_at DESC
         LIMIT 10`,
      novParams
    );
    const totalAbandonos = abandonoRows.length === 0 ? 0 : (await pool.query(
      `SELECT COUNT(*)::int AS n FROM supervision_novedades n ${NW}`,
      novParams
    )).rows[0]?.n ?? 0;

    const { rows: porSupervisor } = await pool.query(
      `SELECT
         sp.supervisor_employee_id AS id,
         e.nombre_completo AS nombre,
         COUNT(*)::int AS total,
         SUM(CASE WHEN sp.estado = 'completada' THEN 1 ELSE 0 END)::int AS completadas,
         SUM(CASE WHEN sp.estado = 'pendiente'  THEN 1 ELSE 0 END)::int AS pendientes,
         SUM(CASE WHEN sp.estado = 'en_curso'   THEN 1 ELSE 0 END)::int AS en_curso,
         SUM(CASE WHEN sp.estado = 'no_realizada' THEN 1 ELSE 0 END)::int AS no_realizadas
       FROM supervision_visitas_programadas sp
       JOIN employees e ON e.id = sp.supervisor_employee_id
       ${W}
       GROUP BY sp.supervisor_employee_id, e.nombre_completo
       ORDER BY total DESC, completadas DESC`,
      params
    );

    res.json({
      kpis: { ...k, cumplimiento_pct: cumplimiento, abandonos: totalAbandonos },
      por_supervisor: porSupervisor,
      abandonos_recientes: abandonoRows,
    });
  } catch (err) {
    logger.error({ err }, "GET /supervision-dashboard error");
    res.status(500).json({ error: "Error al calcular dashboard" });
  }
});

// ── GET /api/supervision-tracking/en-vivo ──
// Última posición conocida (≤ 30 min) de cada supervisor con jornada activa.
// UNIFICA dos fuentes de jornada/GPS:
//   (a) Sistema NUEVO (PWA supervisor): supervision_sesiones + supervision_gps_tracks
//   (b) Sistema LEGACY (fichaje turno):  agente_fichajes + agente_recorrido_gps
// Si un supervisor tiene actividad en ambos, gana la lectura GPS más reciente.
supervisionDashboardRouter.get("/supervision-tracking/en-vivo", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const { rows } = await pool.query(`
      WITH activos_nuevo AS (
        SELECT DISTINCT ON (s.supervisor_employee_id)
               s.supervisor_employee_id AS employee_id,
               s.id                     AS sesion_id,
               s.hora_inicio_real       AS turno_inicio
          FROM supervision_sesiones s
         WHERE s.estado = 'activa'
         ORDER BY s.supervisor_employee_id, s.hora_inicio_real DESC
      ),
      activos_legacy AS (
        SELECT DISTINCT ON (f.employee_id)
               f.employee_id,
               f.id                AS fichaje_id,
               f.registrado_en     AS turno_inicio
          FROM agente_fichajes f
          JOIN employees e ON e.id = f.employee_id
         WHERE f.tipo = 'inicio_turno'
           AND f.turno_cerrado_en IS NULL
           AND e.tipo_personal = 'supervisor'
           AND f.registrado_en >= NOW() - INTERVAL '24 hours'
         ORDER BY f.employee_id, f.registrado_en DESC
      ),
      activos AS (
        SELECT employee_id,
               MIN(turno_inicio) AS turno_inicio,
               MAX(sesion_id)    AS sesion_id,
               MAX(fichaje_id)   AS fichaje_id
          FROM (
            SELECT employee_id, turno_inicio, sesion_id, NULL::int AS fichaje_id
              FROM activos_nuevo
            UNION ALL
            SELECT employee_id, turno_inicio, NULL::int AS sesion_id, fichaje_id
              FROM activos_legacy
          ) u
         GROUP BY employee_id
      ),
      ultimo_nuevo AS (
        SELECT DISTINCT ON (g.sesion_id)
               g.sesion_id,
               g.lat                 AS latitud,
               g.lng                 AS longitud,
               g.accuracy_m          AS precision_metros,
               NULL::double precision AS velocidad_mps,
               g.registrado_at       AS capturado_en
          FROM supervision_gps_tracks g
          JOIN activos_nuevo a ON a.sesion_id = g.sesion_id
         WHERE g.registrado_at >= NOW() - INTERVAL '30 minutes'
         ORDER BY g.sesion_id, g.registrado_at DESC
      ),
      ultimo_legacy AS (
        SELECT DISTINCT ON (g.fichaje_id)
               g.fichaje_id,
               g.latitud, g.longitud, g.precision_metros,
               g.velocidad_mps, g.capturado_en
          FROM agente_recorrido_gps g
          JOIN activos_legacy a ON a.fichaje_id = g.fichaje_id
         WHERE g.capturado_en >= NOW() - INTERVAL '30 minutes'
         ORDER BY g.fichaje_id, g.capturado_en DESC
      ),
      ultimo AS (
        SELECT DISTINCT ON (employee_id)
               employee_id, latitud, longitud, precision_metros,
               velocidad_mps, capturado_en
          FROM (
            SELECT a.employee_id, n.latitud, n.longitud, n.precision_metros,
                   n.velocidad_mps, n.capturado_en
              FROM activos_nuevo a
              JOIN ultimo_nuevo n ON n.sesion_id = a.sesion_id
            UNION ALL
            SELECT a.employee_id, l.latitud, l.longitud, l.precision_metros,
                   l.velocidad_mps, l.capturado_en
              FROM activos_legacy a
              JOIN ultimo_legacy l ON l.fichaje_id = a.fichaje_id
          ) u
         ORDER BY employee_id, capturado_en DESC
      ),
      visita_activa AS (
        SELECT DISTINCT ON (sp.supervisor_employee_id)
               sp.supervisor_employee_id, sp.id AS programacion_id,
               sp.cliente_id, sp.puesto_id, sp.zona_id,
               c.nombre  AS cliente_nombre,
               po.nombre AS puesto_nombre,
               z.nombre  AS zona_nombre
          FROM supervision_visitas_programadas sp
          LEFT JOIN clients c             ON c.id  = sp.cliente_id
          LEFT JOIN puestos_operativos po ON po.id = sp.puesto_id
          LEFT JOIN operational_zones z   ON z.id  = sp.zona_id
         WHERE sp.estado = 'en_curso'
         ORDER BY sp.supervisor_employee_id, sp.iniciada_at DESC
      )
      SELECT
        a.employee_id        AS supervisor_id,
        e.nombre_completo    AS supervisor_nombre,
        a.fichaje_id,
        a.sesion_id,
        a.turno_inicio,
        u.latitud, u.longitud, u.precision_metros, u.velocidad_mps, u.capturado_en,
        v.programacion_id, v.cliente_nombre, v.puesto_nombre, v.zona_nombre,
        EXTRACT(EPOCH FROM (NOW() - u.capturado_en))::int AS hace_segundos
      FROM activos a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN ultimo u        ON u.employee_id              = a.employee_id
      LEFT JOIN visita_activa v ON v.supervisor_employee_id   = a.employee_id
      ORDER BY e.nombre_completo
    `);
    res.json({ supervisores: rows, server_now: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /supervision-tracking/en-vivo error");
    res.status(500).json({ error: "Error al cargar tracking" });
  }
});

// ── GET /api/supervision-geofence-eventos?supervisor=&desde=&hasta=&limit= ──
// Eventos de geofencing recientes (entry/exit en puestos). Por defecto las
// últimas 24h. Sirve para el panel del admin (TabMapaEnVivo) que muestra
// "X llegó al puesto Y a las HH:MM".
supervisionDashboardRouter.get("/supervision-geofence-eventos", async (req, res) => {
  if (!auth(req, res)) return;

  const sup = req.query.supervisor ? Number(req.query.supervisor) : null;
  const desde = String(req.query.desde ?? "");
  const hasta = String(req.query.hasta ?? "");
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
  if (sup !== null && (!Number.isInteger(sup) || sup <= 0)) {
    return res.status(400).json({ error: "supervisor inválido" });
  }
  if (desde && !ISO_DATE.test(desde)) return res.status(400).json({ error: "desde inválido" });
  if (hasta && !ISO_DATE.test(hasta)) return res.status(400).json({ error: "hasta inválido" });

  try {
    const params: any[] = [];
    const where: string[] = [];
    if (sup) { params.push(sup); where.push(`g.supervisor_employee_id = $${params.length}`); }
    if (desde) { params.push(desde); where.push(`g.ocurrido_at >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); where.push(`g.ocurrido_at <  ($${params.length}::date + INTERVAL '1 day')`); }
    if (!desde && !hasta) {
      where.push(`g.ocurrido_at >= NOW() - INTERVAL '24 hours'`);
    }
    const W = where.length ? `WHERE ${where.join(" AND ")}` : "";
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT g.id, g.sesion_id, g.tipo,
              g.supervisor_employee_id, e.nombre_completo AS supervisor_nombre,
              g.puesto_id, po.nombre AS puesto_nombre,
              g.cliente_id, c.nombre AS cliente_nombre,
              g.programacion_id,
              g.lat, g.lng, g.accuracy_m, g.distancia_m, g.radio_m,
              g.ocurrido_at,
              EXTRACT(EPOCH FROM (NOW() - g.ocurrido_at))::int AS hace_segundos
         FROM supervision_geofence_eventos g
         JOIN employees e             ON e.id  = g.supervisor_employee_id
         LEFT JOIN puestos_operativos po ON po.id = g.puesto_id
         LEFT JOIN clients c           ON c.id  = g.cliente_id
         ${W}
        ORDER BY g.ocurrido_at DESC
        LIMIT $${params.length}`,
      params
    );
    res.json({ eventos: rows, server_now: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /supervision-geofence-eventos error");
    res.status(500).json({ error: "Error al cargar eventos de geofence" });
  }
});

// ── GET /api/supervision-programaciones/:id/gps ──
// Devuelve puntos GPS del recorrido del supervisor entre iniciada_at y completada_at.
supervisionDashboardRouter.get("/supervision-programaciones/:id/gps", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: prog } = await pool.query(
      `SELECT id, supervisor_employee_id, iniciada_at, completada_at, fichaje_supervisor_id
         FROM supervision_visitas_programadas WHERE id = $1`,
      [id]
    );
    if (!prog[0]) return res.status(404).json({ error: "No encontrada" });
    if (!prog[0].iniciada_at) return res.json({ puntos: [], info: "Aún no iniciada" });

    let fichajeId = prog[0].fichaje_supervisor_id;
    if (!fichajeId) {
      const { rows } = await pool.query(
        `SELECT id FROM agente_fichajes
          WHERE employee_id = $1 AND tipo = 'inicio_turno'
            AND registrado_en <= $2
            AND (turno_cerrado_en IS NULL OR turno_cerrado_en >= $2)
          ORDER BY registrado_en DESC LIMIT 1`,
        [prog[0].supervisor_employee_id, prog[0].iniciada_at]
      );
      fichajeId = rows[0]?.id || null;
    }
    if (!fichajeId) return res.json({ puntos: [], info: "Sin turno activo asociado" });

    const hasta = prog[0].completada_at || new Date();
    const { rows: puntos } = await pool.query(
      `SELECT latitud, longitud, precision_metros, velocidad_mps, capturado_en
         FROM agente_recorrido_gps
        WHERE fichaje_id = $1
          AND capturado_en BETWEEN $2 AND $3
        ORDER BY capturado_en ASC
        LIMIT 5000`,
      [fichajeId, prog[0].iniciada_at, hasta]
    );
    res.json({
      puntos,
      fichaje_id: fichajeId,
      iniciada_at: prog[0].iniciada_at,
      completada_at: prog[0].completada_at,
    });
  } catch (err) {
    logger.error({ err }, "GET /supervision-programaciones/:id/gps error");
    res.status(500).json({ error: "Error al cargar GPS" });
  }
});

// ── GET /api/supervision-programaciones/:id/geofence-eventos ────────────────
// Devuelve los eventos entry/exit asociados a una visita programada con la
// información necesaria para dibujar markers sobre el mapa: timestamp, lat/lng,
// distancia al centro del puesto y radio. También calcula la permanencia total
// dentro del geofence (suma de pares entry → exit) y detecta si la visita fue
// auto-iniciada por un entry (cuando el primer entry coincide con iniciada_at).
supervisionDashboardRouter.get("/supervision-programaciones/:id/geofence-eventos", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: prog } = await pool.query(
      `SELECT vp.id, vp.supervisor_employee_id, vp.puesto_id, vp.iniciada_at, vp.completada_at,
              po.nombre        AS puesto_nombre,
              pg.latitud       AS puesto_lat,
              pg.longitud      AS puesto_lng,
              pg.radio_metros  AS puesto_radio_m
         FROM supervision_visitas_programadas vp
         LEFT JOIN puestos_operativos po ON po.id = vp.puesto_id
         LEFT JOIN puestos_gps       pg ON pg.puesto_id = vp.puesto_id
        WHERE vp.id = $1`,
      [id]
    );
    if (!prog[0]) return res.status(404).json({ error: "No encontrada" });

    const puesto = prog[0].puesto_id != null && prog[0].puesto_lat != null && prog[0].puesto_lng != null
      ? {
          id: prog[0].puesto_id as number,
          nombre: prog[0].puesto_nombre as string | null,
          lat: Number(prog[0].puesto_lat),
          lng: Number(prog[0].puesto_lng),
          radio_m: prog[0].puesto_radio_m != null ? Number(prog[0].puesto_radio_m) : null,
        }
      : null;

    // Filtramos eventos por programacion_id directo y, como fallback (para
    // datos antiguos donde el evento se guardó sin programacion_id), también
    // por supervisor + puesto dentro de la ventana de la visita. El fallback
    // SÓLO se activa si la visita ya tiene iniciada_at — si está pendiente
    // (iniciada_at = NULL), correlacionar por supervisor+puesto traería
    // eventos históricos de visitas anteriores, contaminando la permanencia
    // y la lista de llegadas/salidas.
    const desde: Date | null = prog[0].iniciada_at ? new Date(prog[0].iniciada_at) : null;
    const hasta: Date = prog[0].completada_at ? new Date(prog[0].completada_at) : new Date();

    type EventoRow = {
      id: number;
      tipo: "entry" | "exit";
      lat: number;
      lng: number;
      accuracy_m: number | null;
      distancia_m: number | null;
      radio_m: number | null;
      ocurrido_at: string;
      puesto_id: number | null;
      puesto_nombre: string | null;
    };

    const { rows: eventos } = await pool.query<EventoRow>(
      `SELECT g.id, g.tipo, g.lat, g.lng, g.accuracy_m, g.distancia_m, g.radio_m,
              g.ocurrido_at, g.puesto_id,
              po.nombre AS puesto_nombre
         FROM supervision_geofence_eventos g
         LEFT JOIN puestos_operativos po ON po.id = g.puesto_id
        WHERE g.programacion_id = $1
           OR (
             $2::int IS NOT NULL
             AND $4::timestamptz IS NOT NULL
             AND g.programacion_id IS NULL
             AND g.supervisor_employee_id = $3
             AND g.puesto_id = $2
             AND g.ocurrido_at >= $4::timestamptz - INTERVAL '5 minutes'
             AND g.ocurrido_at <= $5::timestamptz + INTERVAL '5 minutes'
           )
        ORDER BY g.ocurrido_at ASC`,
      [id, prog[0].puesto_id, prog[0].supervisor_employee_id, desde, hasta]
    );

    // Permanencia: emparejamos entry → exit consecutivos. Si la visita sigue
    // abierta y el último evento es entry, sumamos hasta NOW.
    let permanenciaSeg = 0;
    let abierto: Date | null = null;
    for (const ev of eventos) {
      const t = new Date(ev.ocurrido_at).getTime();
      if (ev.tipo === "entry" && abierto == null) {
        abierto = new Date(t);
      } else if (ev.tipo === "exit" && abierto != null) {
        permanenciaSeg += Math.max(0, Math.round((t - abierto.getTime()) / 1000));
        abierto = null;
      }
    }
    if (abierto != null) {
      const fin = prog[0].completada_at ? new Date(prog[0].completada_at).getTime() : Date.now();
      permanenciaSeg += Math.max(0, Math.round((fin - abierto.getTime()) / 1000));
    }

    // Auto-iniciada: el primer entry está a ≤ 60s de iniciada_at (el handler
    // de geofence-evento es quien marca iniciada_at en ese caso).
    let autoIniciada = false;
    if (prog[0].iniciada_at && eventos.length > 0) {
      const primerEntry = eventos.find((e) => e.tipo === "entry");
      if (primerEntry) {
        const dt = Math.abs(
          new Date(primerEntry.ocurrido_at).getTime() -
          new Date(prog[0].iniciada_at).getTime()
        );
        autoIniciada = dt <= 60_000;
      }
    }

    res.json({
      eventos,
      permanencia_segundos: permanenciaSeg,
      auto_iniciada: autoIniciada,
      iniciada_at: prog[0].iniciada_at,
      completada_at: prog[0].completada_at,
      puesto,
    });
  } catch (err) {
    logger.error({ err }, "GET /supervision-programaciones/:id/geofence-eventos error");
    res.status(500).json({ error: "Error al cargar eventos de geofence" });
  }
});
