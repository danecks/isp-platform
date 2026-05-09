import { Router } from "express";
import { pool } from "@workspace/db";

export const reportesArmeriaRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// REPORTERÍA DE ARMAMENTO POR FECHA
// 5 endpoints de read-only para la pestaña "Reportes":
//   1) /armeria/reportes/custodia-diaria?fecha=YYYY-MM-DD
//   2) /armeria/reportes/movimientos?desde=&hasta=
//   3) /armeria/reportes/municion?desde=&hasta=
//   4) /armeria/reportes/sincronizaciones?desde=&hasta=
//   5) /armeria/reportes/inventario?fecha=YYYY-MM-DD
// Todos los filtros opcionales se aplican con WHERE ... AND (... OR $X IS NULL).
// ═══════════════════════════════════════════════════════════════════════════

// Hoy en formato YYYY-MM-DD según la zona horaria de Guatemala (UTC-6, sin DST).
const _gtFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guatemala",
  year: "numeric", month: "2-digit", day: "2-digit",
});
function parseFecha(s: any, def?: string): string {
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (def) return def;
  return _gtFmt.format(new Date());
}

// 1) Custodia diaria — qué arma tuvo cada agente en una fecha específica
reportesArmeriaRouter.get("/armeria/reportes/custodia-diaria", async (req, res) => {
  try {
    const fecha = parseFecha(req.query.fecha);
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : null;

    const { rows } = await pool.query(`
      SELECT
        ac.id,
        ac.fecha_inicio,
        ac.fecha_fin,
        ac.tipo_origen,
        ac.notas,
        a.id            AS arma_id,
        a.codigo        AS arma_codigo,
        a.serie,
        a.tipo,
        a.marca,
        a.modelo,
        a.calibre,
        a.numero_tenencia,
        e.id            AS employee_id,
        e.nombre_completo AS empleado_nombre,
        e.dpi           AS empleado_dpi,
        po.id           AS puesto_id,
        po.nombre       AS puesto_nombre,
        po.cliente_nombre,
        po.cliente_id
      FROM arma_custodia ac
      JOIN armas a               ON a.id  = ac.arma_id
      LEFT JOIN employees e      ON e.id  = ac.employee_id
      LEFT JOIN puestos_operativos po ON po.id = ac.puesto_id
      WHERE ac.fecha_inicio::date <= $1::date
        AND (ac.fecha_fin IS NULL OR ac.fecha_fin::date >= $1::date)
        AND ($2::int IS NULL OR po.cliente_id = $2::int)
      ORDER BY po.cliente_nombre NULLS LAST, a.codigo
      LIMIT 5000
    `, [fecha, clienteId]);

    res.json({ fecha, total: rows.length, registros: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2) Movimientos — alta y cierre de custodias en un rango de fechas
reportesArmeriaRouter.get("/armeria/reportes/movimientos", async (req, res) => {
  try {
    const hasta = parseFecha(req.query.hasta);
    const desde = parseFecha(req.query.desde, hasta);
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : null;

    const { rows } = await pool.query(`
      SELECT * FROM (
        SELECT
          ac.id                AS evento_id,
          'alta_custodia'      AS evento,
          ac.fecha_inicio      AS fecha_evento,
          a.id                 AS arma_id,
          a.codigo             AS arma_codigo,
          a.serie, a.tipo, a.marca, a.modelo,
          e.nombre_completo    AS empleado_nombre,
          po.nombre            AS puesto_nombre,
          po.cliente_nombre,
          po.cliente_id,
          ac.tipo_origen,
          ac.registrado_por
        FROM arma_custodia ac
        JOIN armas a               ON a.id  = ac.arma_id
        LEFT JOIN employees e      ON e.id  = ac.employee_id
        LEFT JOIN puestos_operativos po ON po.id = ac.puesto_id
        WHERE ac.fecha_inicio::date BETWEEN $1::date AND $2::date

        UNION ALL

        SELECT
          ac.id                AS evento_id,
          'cierre_custodia'    AS evento,
          ac.fecha_fin         AS fecha_evento,
          a.id                 AS arma_id,
          a.codigo             AS arma_codigo,
          a.serie, a.tipo, a.marca, a.modelo,
          e.nombre_completo    AS empleado_nombre,
          po.nombre            AS puesto_nombre,
          po.cliente_nombre,
          po.cliente_id,
          ac.tipo_origen,
          ac.registrado_por
        FROM arma_custodia ac
        JOIN armas a               ON a.id  = ac.arma_id
        LEFT JOIN employees e      ON e.id  = ac.employee_id
        LEFT JOIN puestos_operativos po ON po.id = ac.puesto_id
        WHERE ac.fecha_fin IS NOT NULL
          AND ac.fecha_fin::date BETWEEN $1::date AND $2::date
      ) sub
      WHERE ($3::int IS NULL OR sub.cliente_id = $3::int)
      ORDER BY fecha_evento DESC
      LIMIT 1000
    `, [desde, hasta, clienteId]);

    res.json({ desde, hasta, total: rows.length, registros: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3) Munición — cambios de asignación de munición a puestos en un rango
reportesArmeriaRouter.get("/armeria/reportes/municion", async (req, res) => {
  try {
    const hasta = parseFecha(req.query.hasta);
    const desde = parseFecha(req.query.desde, hasta);
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : null;

    const { rows } = await pool.query(`
      SELECT
        pm.id,
        pm.descripcion,
        pm.cantidad_asignada,
        pm.activo,
        pm.created_at,
        pm.updated_at,
        po.id            AS puesto_id,
        po.nombre        AS puesto_nombre,
        po.cliente_nombre,
        po.cliente_id
      FROM puesto_municion pm
      JOIN puestos_operativos po ON po.id = pm.puesto_id
      WHERE (pm.created_at::date BETWEEN $1::date AND $2::date
          OR pm.updated_at::date BETWEEN $1::date AND $2::date)
        AND ($3::int IS NULL OR po.cliente_id = $3::int)
      ORDER BY pm.updated_at DESC
      LIMIT 1000
    `, [desde, hasta, clienteId]);

    res.json({ desde, hasta, total: rows.length, registros: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4) Sincronizaciones — log de cierres/sincronizaciones de custodia en rango
reportesArmeriaRouter.get("/armeria/reportes/sincronizaciones", async (req, res) => {
  try {
    const hasta = parseFecha(req.query.hasta);
    const desde = parseFecha(req.query.desde, hasta);

    const { rows } = await pool.query(`
      SELECT
        csl.id,
        csl.fecha,
        csl.tipo_activo,
        csl.activo_id,
        csl.activo_codigo,
        csl.custodio_anterior_id,
        csl.custodio_anterior_nombre,
        csl.custodio_nuevo_id,
        csl.custodio_nuevo_nombre,
        csl.referencia_nombre,
        csl.origen,
        csl.usuario,
        csl.creado_en
      FROM custodia_sync_log csl
      WHERE csl.tipo_activo = 'arma'
        AND csl.fecha BETWEEN $1::date AND $2::date
      ORDER BY csl.creado_en DESC
      LIMIT 1000
    `, [desde, hasta]);

    res.json({ desde, hasta, total: rows.length, registros: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 5) Inventario en una fecha pasada — estado del armamento ese día
//    Para cada arma activa al día F: a quién estaba asignada (custodia activa
//    en F), su puesto y cliente.
reportesArmeriaRouter.get("/armeria/reportes/inventario", async (req, res) => {
  try {
    const fecha = parseFecha(req.query.fecha);
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : null;

    const { rows } = await pool.query(`
      SELECT
        a.id,
        a.codigo,
        a.serie,
        a.tipo, a.marca, a.modelo, a.calibre,
        a.estado,
        a.activo,
        a.created_at,
        a.numero_tenencia,
        a.fecha_vencimiento_tenencia,
        a.numero_portacion,
        a.fecha_vencimiento_portacion,
        ac.fecha_inicio,
        ac.fecha_fin,
        ac.tipo_origen,
        e.id              AS custodio_id,
        e.nombre_completo AS custodio_nombre,
        po.id             AS puesto_id,
        po.nombre         AS puesto_nombre,
        po.cliente_nombre,
        po.cliente_id
      FROM armas a
      LEFT JOIN LATERAL (
        SELECT *
        FROM arma_custodia ac
        WHERE ac.arma_id = a.id
          AND ac.fecha_inicio::date <= $1::date
          AND (ac.fecha_fin IS NULL OR ac.fecha_fin::date >= $1::date)
        ORDER BY ac.fecha_inicio DESC
        LIMIT 1
      ) ac ON TRUE
      LEFT JOIN employees e ON e.id = ac.employee_id
      LEFT JOIN puestos_operativos po ON po.id = ac.puesto_id
      WHERE a.created_at::date <= $1::date
        AND ($2::int IS NULL OR po.cliente_id = $2::int)
      ORDER BY a.codigo
      LIMIT 5000
    `, [fecha, clienteId]);

    const totales = {
      total:        rows.length,
      asignadas:    rows.filter(r => r.custodio_id).length,
      sin_custodio: rows.filter(r => !r.custodio_id).length,
      en_mantenimiento: rows.filter(r => r.estado === 'en_mantenimiento').length,
      baja:         rows.filter(r => r.estado === 'baja').length,
    };

    res.json({ fecha, totales, registros: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
