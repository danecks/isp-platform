import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// Reportería del módulo Supervisión.
// GET /api/supervision/reportes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&cliente_id?
// Devuelve KPIs, fallas por ítem de catálogo (uniformes/equipo/presentación),
// alertas de armas por tipo y top de puestos con más problemas.

export const supervisionReportesRouter = Router();

function parseFecha(s: any, fallback: string): string {
  const v = String(s || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
}
function hace30(): string {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

supervisionReportesRouter.get("/supervision/reportes", async (req, res) => {
  const desde = parseFecha(req.query.desde, hace30());
  const hasta = parseFecha(req.query.hasta, hoy());
  const clienteId = Number(req.query.cliente_id);
  const filtroCliente = Number.isInteger(clienteId) && clienteId > 0 ? clienteId : null;

  try {
    // ── KPIs generales ────────────────────────────────────────────────────
    const { rows: kpiRows } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM supervision_inspecciones
            WHERE realizada_at::date BETWEEN $1 AND $2
              AND ($3::int IS NULL OR cliente_id = $3))                     AS total_inspecciones,
         (SELECT COUNT(DISTINCT agente_employee_id)::int FROM supervision_inspecciones
            WHERE realizada_at::date BETWEEN $1 AND $2
              AND ($3::int IS NULL OR cliente_id = $3))                     AS agentes_inspeccionados,
         (SELECT COUNT(*)::int FROM supervision_novedades
            WHERE fecha BETWEEN $1 AND $2
              AND ($3::int IS NULL OR cliente_id = $3))                     AS total_novedades,
         (SELECT COUNT(*)::int FROM armas_alertas aa
            JOIN supervision_inspecciones si ON si.id = aa.inspeccion_id
            WHERE si.realizada_at::date BETWEEN $1 AND $2
              AND ($3::int IS NULL OR si.cliente_id = $3))                  AS total_alertas_armas,
         (SELECT COUNT(*)::int FROM armas_alertas aa
            JOIN supervision_inspecciones si ON si.id = aa.inspeccion_id
            WHERE si.realizada_at::date BETWEEN $1 AND $2
              AND aa.estado = 'abierta'
              AND ($3::int IS NULL OR si.cliente_id = $3))                  AS alertas_armas_abiertas`,
      [desde, hasta, filtroCliente]
    );

    // ── Fallas por ítem de catálogo (boolean = false) ─────────────────────
    // Cuenta cuántas inspecciones registraron CADA clave como FALSE.
    // Se cruza con el catálogo (cliente o global) para etiqueta y categoría.
    const { rows: fallas } = await pool.query(
      `WITH expandido AS (
         SELECT i.cliente_id, k.key AS clave, k.value
           FROM supervision_inspecciones i,
                LATERAL jsonb_each(i.datos) AS k
          WHERE i.realizada_at::date BETWEEN $1 AND $2
            AND ($3::int IS NULL OR i.cliente_id = $3)
            AND jsonb_typeof(k.value) = 'boolean'
            AND k.value = 'false'::jsonb
       ),
       cat AS (
         SELECT DISTINCT ON (clave) clave, etiqueta, categoria
           FROM supervision_catalogo_items
          ORDER BY clave, cliente_id NULLS LAST
       )
       SELECT e.clave,
              COALESCE(c.etiqueta, e.clave)  AS etiqueta,
              COALESCE(c.categoria, 'otro')  AS categoria,
              COUNT(*)::int                  AS fallas
         FROM expandido e
         LEFT JOIN cat c ON c.clave = e.clave
        GROUP BY e.clave, c.etiqueta, c.categoria
        ORDER BY fallas DESC, etiqueta ASC
        LIMIT 50`,
      [desde, hasta, filtroCliente]
    );

    // ── Alertas de armas por tipo ─────────────────────────────────────────
    const { rows: alertasPorTipo } = await pool.query(
      `SELECT aa.tipo,
              COUNT(*)::int                                            AS total,
              COUNT(*) FILTER (WHERE aa.estado = 'abierta')::int       AS abiertas,
              COUNT(*) FILTER (WHERE aa.estado = 'cerrada')::int       AS cerradas
         FROM armas_alertas aa
         JOIN supervision_inspecciones si ON si.id = aa.inspeccion_id
        WHERE si.realizada_at::date BETWEEN $1 AND $2
          AND ($3::int IS NULL OR si.cliente_id = $3)
        GROUP BY aa.tipo
        ORDER BY total DESC`,
      [desde, hasta, filtroCliente]
    );

    // ── Top puestos con más problemas (fallas + alertas armas) ────────────
    const { rows: topPuestos } = await pool.query(
      `WITH fallas_p AS (
         SELECT i.puesto_id, COUNT(*)::int AS fallas
           FROM supervision_inspecciones i,
                LATERAL jsonb_each(i.datos) AS k
          WHERE i.realizada_at::date BETWEEN $1 AND $2
            AND ($3::int IS NULL OR i.cliente_id = $3)
            AND jsonb_typeof(k.value) = 'boolean'
            AND k.value = 'false'::jsonb
            AND i.puesto_id IS NOT NULL
          GROUP BY i.puesto_id
       ),
       alertas_p AS (
         SELECT si.puesto_id, COUNT(*)::int AS alertas
           FROM armas_alertas aa
           JOIN supervision_inspecciones si ON si.id = aa.inspeccion_id
          WHERE si.realizada_at::date BETWEEN $1 AND $2
            AND ($3::int IS NULL OR si.cliente_id = $3)
            AND si.puesto_id IS NOT NULL
          GROUP BY si.puesto_id
       ),
       insp_p AS (
         SELECT puesto_id, COUNT(*)::int AS inspecciones
           FROM supervision_inspecciones
          WHERE realizada_at::date BETWEEN $1 AND $2
            AND ($3::int IS NULL OR cliente_id = $3)
            AND puesto_id IS NOT NULL
          GROUP BY puesto_id
       )
       SELECT po.id                                AS puesto_id,
              po.nombre                            AS puesto_nombre,
              c.nombre                             AS cliente_nombre,
              COALESCE(ip.inspecciones, 0)         AS inspecciones,
              COALESCE(fp.fallas, 0)               AS fallas_equipo,
              COALESCE(ap.alertas, 0)              AS alertas_armas,
              COALESCE(fp.fallas, 0) + COALESCE(ap.alertas, 0) AS total_problemas
         FROM puestos_operativos po
         LEFT JOIN clients c ON c.id = po.cliente_id
         LEFT JOIN fallas_p  fp ON fp.puesto_id = po.id
         LEFT JOIN alertas_p ap ON ap.puesto_id = po.id
         LEFT JOIN insp_p    ip ON ip.puesto_id = po.id
        WHERE COALESCE(fp.fallas, 0) + COALESCE(ap.alertas, 0) > 0
        ORDER BY total_problemas DESC, inspecciones DESC
        LIMIT 15`,
      [desde, hasta, filtroCliente]
    );

    // ── Novedades recientes ───────────────────────────────────────────────
    const { rows: novedades } = await pool.query(
      `SELECT n.id, n.fecha,
              n.observaciones,
              po.nombre AS puesto_nombre,
              c.nombre  AS cliente_nombre,
              e.nombre_completo AS supervisor_nombre,
              n.datos_consolidados AS datos,
              to_char(n.generada_at, 'YYYY-MM-DD HH24:MI') AS generada_at
         FROM supervision_novedades n
         LEFT JOIN puestos_operativos po ON po.id = n.puesto_id
         LEFT JOIN clients c             ON c.id  = n.cliente_id
         LEFT JOIN employees e           ON e.id  = n.supervisor_employee_id
        WHERE n.fecha BETWEEN $1 AND $2
          AND ($3::int IS NULL OR n.cliente_id = $3)
        ORDER BY n.generada_at DESC
        LIMIT 30`,
      [desde, hasta, filtroCliente]
    );

    // ── Alertas de armas recientes ────────────────────────────────────────
    const { rows: alertasRecientes } = await pool.query(
      `SELECT aa.id, aa.tipo, aa.descripcion, aa.estado,
              to_char(aa.abierta_at, 'YYYY-MM-DD HH24:MI') AS abierta_at,
              ar.codigo AS arma_codigo, ar.tipo AS arma_tipo,
              e_ag.nombre_completo AS agente_nombre,
              e_sup.nombre_completo AS supervisor_nombre,
              po.nombre AS puesto_nombre,
              c.nombre  AS cliente_nombre
         FROM armas_alertas aa
         JOIN supervision_inspecciones si ON si.id = aa.inspeccion_id
         LEFT JOIN armas ar              ON ar.id  = aa.arma_id
         LEFT JOIN employees e_ag        ON e_ag.id  = aa.agente_employee_id
         LEFT JOIN employees e_sup       ON e_sup.id = aa.supervisor_employee_id
         LEFT JOIN puestos_operativos po ON po.id   = si.puesto_id
         LEFT JOIN clients c             ON c.id    = si.cliente_id
        WHERE si.realizada_at::date BETWEEN $1 AND $2
          AND ($3::int IS NULL OR si.cliente_id = $3)
        ORDER BY aa.abierta_at DESC
        LIMIT 30`,
      [desde, hasta, filtroCliente]
    );

    res.json({
      ok: true,
      rango: { desde, hasta },
      kpis: kpiRows[0] || {},
      fallas_por_item: fallas,
      alertas_armas_por_tipo: alertasPorTipo,
      top_puestos_problematicos: topPuestos,
      novedades_recientes: novedades,
      alertas_armas_recientes: alertasRecientes,
    });
  } catch (err) {
    logger.error({ err }, "GET /supervision/reportes error");
    res.status(500).json({ error: "Error al cargar reportes de supervisión" });
  }
});
