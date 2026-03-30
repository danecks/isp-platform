/**
 * pre-planilla.ts — Pre-planilla operativa por período
 *
 * ENDPOINTS:
 *   GET  /api/nomina/pre-planilla            → Consolidado por colaborador (período)
 *   GET  /api/nomina/pre-planilla/detalle/:id → Novedades diarias + anticipos del colaborador
 *   PATCH /api/nomina/pre-planilla/revision/:id → Marcar estado de revisión RRHH
 *   GET  /api/nomina/pre-planilla/export      → Exportar CSV con BOM para Excel
 *
 * FUENTES:
 *   - novedades_nomina_diarias  (operativo diario consolidado)
 *   - employees                 (datos del colaborador + campos laborales)
 *   - anticipos                 (anticipos aprobados/pagados del período)
 *   - agent_assignments + clients (cliente principal)
 *   - pre_planilla_revision     (estado de revisión RRHH, creado por este módulo)
 *
 * NO CALCULA AÚN:
 *   - Bonificación incentivo / decreto 78-89
 *   - IGSS (cuota patronal y laboral)
 *   - Descuento legal por ausencias (proporcional)
 *   - Séptimo día
 *   - Indemnización / liquidación
 *   - Neto a pagar
 *
 * PREPARADO PARA SIGUIENTE FASE:
 *   La estructura devuelta incluye sueldo_base, horas_contrato, tipo_jornada,
 *   faltas, suspensiones y anticipos. Con esos campos la planilla final
 *   puede calcular descuentos proporcionales, IGSS, séptimo y neto.
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const prePlanillaRouter = Router();

// ─── Query principal (reutilizada en GET y export) ────────────────────────────
const QUERY_CONSOLIDADO = `
  SELECT
    e.id                                                                        AS employee_id,
    e.nombre_completo,
    e.dpi,
    e.sueldo_base,
    e.tipo_jornada,
    e.dia_descanso,
    e.horas_contrato,
    e.estado_laboral,
    e.puesto                                                                    AS puesto_empleado,
    e.area,
    e.sede,
    e.supervisor_nombre,

    -- Métricas del período desde novedades_nomina_diarias
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.trabajo_dia = TRUE)                 AS dias_trabajados,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.falta = TRUE)                       AS faltas,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.suspension = TRUE)                  AS suspensiones,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.descanso_trabajado = TRUE)          AS descansos_trabajados,
    COALESCE(SUM(CASE WHEN n.trabajo_dia THEN n.horas_trabajadas::numeric ELSE 0 END), 0) AS horas_trabajadas,
    COALESCE(SUM(CASE WHEN n.trabajo_dia THEN n.horas_extra::numeric ELSE 0 END), 0)      AS horas_extra,

    -- Relevos: días en que el colaborador cubrió un puesto distinto al suyo titular
    COUNT(DISTINCT n.fecha) FILTER (
      WHERE n.trabajo_dia = TRUE
        AND n.puesto_cubierto_id IS NOT NULL
        AND n.puesto_cubierto_id IS DISTINCT FROM n.puesto_titular_id
    )                                                                           AS relevos,

    -- Alertas: días marcados como trabajados pero sin horas registradas
    COUNT(DISTINCT n.fecha) FILTER (
      WHERE n.trabajo_dia = TRUE
        AND (n.horas_trabajadas IS NULL OR n.horas_trabajadas::numeric = 0)
    )                                                                           AS dias_sin_horas,

    -- Puesto titular base del período
    MAX(n.puesto_titular_nombre)                                                AS puesto_titular_nombre,

    -- Turno (del puesto titular)
    MAX(t.id)                                                                   AS tipo_turno_id,
    MAX(t.nombre)                                                               AS tipo_turno_nombre,
    MAX(t.horas_trabajo::numeric)                                               AS turno_horas_trabajo,
    MAX(po.fecha_inicio_ciclo::text)                                            AS turno_fecha_inicio_ciclo,

    -- Horas esperadas (si el turno está configurado, viene de novedades; sino es NULL)
    NULLIF(SUM(n.horas_esperadas::numeric), 0)                                  AS horas_esperadas_total,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.trabajo_esperado = TRUE)            AS dias_esperados_trabajo,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.trabajo_esperado = FALSE)           AS dias_esperados_descanso,

    -- Anticipos aprobados o pagados del período
    COALESCE((
      SELECT SUM(a.cantidad)
      FROM anticipos a
      WHERE a.employee_id = e.id
        AND DATE(a.fecha_solicitud) BETWEEN $1 AND $2
        AND a.estado IN ('aprobada', 'pagada')
    ), 0)                                                                       AS anticipos_monto,
    COALESCE((
      SELECT COUNT(a.id)
      FROM anticipos a
      WHERE a.employee_id = e.id
        AND DATE(a.fecha_solicitud) BETWEEN $1 AND $2
        AND a.estado IN ('aprobada', 'pagada')
    ), 0)                                                                       AS anticipos_count,

    -- Estado de revisión RRHH
    COALESCE(pr.estado, 'pendiente')                                            AS revision_estado,
    pr.observaciones                                                            AS revision_observaciones,
    pr.revisado_por                                                             AS revision_por,
    pr.updated_at                                                               AS revision_at,

    -- Incentivos cash del período (NO van a planilla — solo referencia)
    COALESCE((
      SELECT SUM(ic.monto)
      FROM incentivos_cash_cobertura ic
      WHERE ic.employee_id = e.id
        AND ic.fecha BETWEEN $1 AND $2
        AND ic.estado != 'cancelado'
    ), 0)                                                                       AS incentivos_cash_monto,
    COALESCE((
      SELECT COUNT(ic.id)
      FROM incentivos_cash_cobertura ic
      WHERE ic.employee_id = e.id
        AND ic.fecha BETWEEN $1 AND $2
        AND ic.estado != 'cancelado'
    ), 0)                                                                       AS incentivos_cash_count,

    -- Cliente principal (primera asignación activa)
    (
      SELECT c.nombre
      FROM agent_assignments aa
      JOIN clients c ON c.portal_cliente_id = aa.cliente_id
      WHERE aa.employee_id = e.id AND aa.estado = 'activo'
      LIMIT 1
    )                                                                           AS cliente_principal

  FROM employees e
  INNER JOIN novedades_nomina_diarias n
    ON n.employee_id = e.id
    AND n.fecha BETWEEN $1 AND $2
  LEFT JOIN puestos_operativos po
    ON po.titular_employee_id = e.id AND po.activo = TRUE
  LEFT JOIN turnos t
    ON t.id = po.tipo_turno_id
  LEFT JOIN pre_planilla_revision pr
    ON pr.employee_id = e.id
    AND pr.periodo_desde = $1::date
    AND pr.periodo_hasta = $2::date
  GROUP BY
    e.id, e.nombre_completo, e.dpi, e.sueldo_base, e.tipo_jornada,
    e.dia_descanso, e.horas_contrato, e.estado_laboral, e.puesto,
    e.area, e.sede, e.supervisor_nombre,
    pr.estado, pr.observaciones, pr.revisado_por, pr.updated_at
  ORDER BY e.nombre_completo
`;

// ─── GET /api/nomina/pre-planilla ─────────────────────────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) {
    return res.status(400).json({ error: "desde y hasta son requeridos (YYYY-MM-DD)" });
  }

  try {
    const { rows } = await pool.query(QUERY_CONSOLIDADO, [desde, hasta]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla error");
    res.status(500).json({ error: "Error al generar pre-planilla" });
  }
});

// ─── GET /api/nomina/pre-planilla/detalle/:employeeId ─────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla/detalle/:employeeId", async (req, res) => {
  const employeeId = parseInt(req.params.employeeId);
  const { desde, hasta } = req.query as Record<string, string>;

  if (isNaN(employeeId) || !desde || !hasta) {
    return res.status(400).json({ error: "employeeId, desde y hasta son requeridos" });
  }

  try {
    const [{ rows: novedades }, { rows: anticipos }, { rows: emps }, { rows: incentivos }] = await Promise.all([
      pool.query(`
        SELECT
          n.*,
          e.nombre_completo, e.dpi, e.puesto AS puesto_empleado,
          e.sueldo_base, e.tipo_jornada, e.dia_descanso, e.horas_contrato
        FROM novedades_nomina_diarias n
        JOIN employees e ON e.id = n.employee_id
        WHERE n.employee_id = $1
          AND n.fecha BETWEEN $2 AND $3
        ORDER BY n.fecha ASC
      `, [employeeId, desde, hasta]),

      pool.query(`
        SELECT id, cantidad, estado, periodo, origen, observaciones,
               fecha_solicitud, nombre, planilla_id
        FROM anticipos
        WHERE employee_id = $1
          AND DATE(fecha_solicitud) BETWEEN $2 AND $3
        ORDER BY fecha_solicitud DESC
      `, [employeeId, desde, hasta]),

      pool.query(`
        SELECT id, nombre_completo, dpi, puesto, area, sede, sueldo_base,
               tipo_jornada, dia_descanso, horas_contrato, estado_laboral,
               supervisor_nombre, fecha_ingreso
        FROM employees WHERE id = $1
      `, [employeeId]),

      pool.query(`
        SELECT ic.*, po.nombre AS puesto_nombre_join
        FROM incentivos_cash_cobertura ic
        LEFT JOIN puestos_operativos po ON po.id = ic.puesto_id
        WHERE ic.employee_id = $1
          AND ic.fecha BETWEEN $2 AND $3
          AND ic.estado != 'cancelado'
        ORDER BY ic.fecha ASC
      `, [employeeId, desde, hasta]),
    ]);

    res.json({
      empleado: emps[0] ?? null,
      novedades,
      anticipos,
      incentivos,
    });
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/detalle error");
    res.status(500).json({ error: "Error al obtener detalle" });
  }
});

// ─── PATCH /api/nomina/pre-planilla/revision/:employeeId ─────────────────────
prePlanillaRouter.patch("/nomina/pre-planilla/revision/:employeeId", async (req, res) => {
  const employeeId = parseInt(req.params.employeeId);
  const { desde, hasta, estado, observaciones, revisadoPor } = req.body ?? {};

  if (isNaN(employeeId) || !desde || !hasta || !estado) {
    return res.status(400).json({ error: "employeeId, desde, hasta y estado son requeridos" });
  }

  const estadosValidos = ["pendiente", "revisada", "observada"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(", ")}` });
  }

  try {
    const { rows } = await pool.query(`
      INSERT INTO pre_planilla_revision
        (employee_id, periodo_desde, periodo_hasta, estado, observaciones, revisado_por, updated_at)
      VALUES ($1, $2::date, $3::date, $4, $5, $6, NOW())
      ON CONFLICT (employee_id, periodo_desde, periodo_hasta)
      DO UPDATE SET
        estado        = EXCLUDED.estado,
        observaciones = EXCLUDED.observaciones,
        revisado_por  = EXCLUDED.revisado_por,
        updated_at    = NOW()
      RETURNING *
    `, [employeeId, desde, hasta, estado, observaciones ?? null, revisadoPor ?? null]);

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /nomina/pre-planilla/revision error");
    res.status(500).json({ error: "Error al guardar revisión" });
  }
});

// ─── GET /api/nomina/pre-planilla/export ─────────────────────────────────────
// CSV con UTF-8 BOM para apertura directa en Excel
prePlanillaRouter.get("/nomina/pre-planilla/export", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) {
    return res.status(400).json({ error: "desde y hasta son requeridos" });
  }

  try {
    const { rows } = await pool.query(QUERY_CONSOLIDADO, [desde, hasta]);

    const BOM = "\uFEFF";
    const headers = [
      "ID", "Nombre Completo", "DPI",
      "Puesto", "Área", "Sede", "Cliente Principal",
      "Sueldo Base (Q)", "Tipo Jornada", "Día Descanso", "Hrs/Semana",
      "Estado Laboral", "Días Trabajados", "Faltas", "Suspensiones",
      "Descansos Trabajados", "Horas Trabajadas", "Horas Extra", "Relevos",
      "Anticipos (Q)", "# Anticipos",
      "Estado Revisión", "Observaciones RRHH",
    ];

    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const lines = [
      headers.map(esc).join(","),
      ...rows.map((r) => [
        r.employee_id, r.nombre_completo, r.dpi ?? "",
        r.puesto_empleado ?? "", r.area ?? "", r.sede ?? "", r.cliente_principal ?? "",
        r.sueldo_base ?? "", r.tipo_jornada ?? "", r.dia_descanso ?? "", r.horas_contrato ?? "",
        r.estado_laboral,
        r.dias_trabajados, r.faltas, r.suspensiones, r.descansos_trabajados,
        parseFloat(r.horas_trabajadas || 0).toFixed(2),
        parseFloat(r.horas_extra || 0).toFixed(2),
        r.relevos,
        r.anticipos_monto, r.anticipos_count,
        r.revision_estado, r.revision_observaciones ?? "",
      ].map(esc).join(",")),
    ];

    const filename = `pre-planilla_${desde}_${hasta}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(BOM + lines.join("\r\n"));
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/export error");
    res.status(500).json({ error: "Error al generar exportación" });
  }
});
