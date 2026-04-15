/**
 * pre-planilla.ts — Pre-planilla operativa por período
 *
 * ENDPOINTS:
 *   GET  /api/nomina/pre-planilla                         → Consolidado por colaborador (período)
 *   GET  /api/nomina/pre-planilla/detalle/:id             → Novedades diarias + anticipos del colaborador
 *   PATCH /api/nomina/pre-planilla/revision/:id           → Marcar estado de revisión RRHH
 *   GET  /api/nomina/pre-planilla/validacion              → Errores/alertas automáticas del período
 *   GET  /api/nomina/pre-planilla/cierres                 → Lista de períodos cerrados
 *   GET  /api/nomina/pre-planilla/cierre/:id              → Snapshot de un cierre específico
 *   POST /api/nomina/pre-planilla/cierre                  → Cerrar y congelar período
 *   GET  /api/nomina/pre-planilla/export                  → Exportar CSV con BOM para Excel
 *
 * FLUJO DE CIERRE:
 *   1. RRHH revisa cada colaborador (estado: pendiente → revisada → aprobado_rrhh | observada)
 *   2. Se corre validación automática (GET /validacion)
 *   3. Si no hay errores críticos → se puede cerrar el período (POST /cierre)
 *   4. El cierre congela los datos en un snapshot JSONB e impide edición posterior
 *   5. El snapshot sirve de base para generar la planilla final
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
import { calcularBruto, toNum, toInt } from "../lib/nomina-calc";
import { calcularProvisionPeriodo, diasEntreFechas } from "../lib/prestaciones-calc";

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
    COALESCE(e.tipo_personal, 'guardia')                                        AS tipo_personal,
    COALESCE(e.frecuencia_pago, 'quincenal')                                    AS frecuencia_pago,
    COALESCE(e.bonificacion_incentivo, 250)                                      AS bon_incentivo_base,
    COALESCE(e.bonificacion_1, 0)                                                AS bon_1_base,
    COALESCE(e.bonificacion_2, 0)                                                AS bon_2_base,
    COALESCE(e.bonificacion_3, 0)                                                AS bon_3_base,

    -- Métricas del período desde novedades_nomina_diarias
    COUNT(DISTINCT n.fecha)                                                     AS dias_cerrados,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.trabajo_dia = TRUE)                 AS dias_trabajados,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.falta = TRUE)                       AS faltas,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.suspension = TRUE)                  AS suspensiones,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.descanso_trabajado = TRUE)          AS descansos_trabajados,

    COUNT(DISTINCT n.fecha) FILTER (
      WHERE n.trabajo_dia = FALSE
        AND n.falta = FALSE
        AND n.suspension = FALSE
        AND n.requiere_revision_rrhh = TRUE
        AND COALESCE(n.impacto_nomina, 'pendiente') = 'pendiente'
        AND COALESCE(n.tipo_novedad, 'falta_total') IN ('falta_total', 'abandono_parcial', 'permiso_sin_goce')
    )                                                                           AS faltas_pendientes_rrhh,

    -- Contadores de novedades especiales (para referencia en pre-planilla y reportes)
    -- Fuente: novedades_nomina_diarias.tipo_novedad
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'vacaciones')        AS dias_vacaciones,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'incapacidad')       AS dias_incapacidad,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'permiso_sin_goce')  AS dias_permiso_sin_goce,
    COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'permiso_con_goce')  AS dias_permiso_con_goce,
    COALESCE(SUM(CASE WHEN n.trabajo_dia THEN n.horas_trabajadas::numeric ELSE 0 END), 0) AS horas_trabajadas,
    COALESCE(SUM(CASE
      WHEN n.trabajo_dia
       AND (n.requiere_revision_rrhh IS NOT TRUE OR n.impacto_nomina = 'aprobado_rrhh' OR n.horas_extra_estado = 'aprobado')
       AND COALESCE(n.impacto_nomina, '') <> 'pagado_efectivo'
       AND COALESCE(n.horas_extra_estado, 'pendiente') NOT IN ('rechazado', 'pagado_efectivo')
      THEN n.horas_extra::numeric ELSE 0 END), 0)                                        AS horas_extra,

    COALESCE(SUM(CASE
      WHEN n.trabajo_dia
       AND n.horas_extra::numeric > 0
       AND COALESCE(n.horas_extra_estado, 'pendiente') = 'pendiente'
       AND n.requiere_revision_rrhh = TRUE
      THEN n.horas_extra::numeric ELSE 0 END), 0)                                        AS horas_extra_pendientes,

    -- Total días de descuento por faltas (según turno: 3d para 24h, 2d para 12h)
    COALESCE(SUM(CASE WHEN n.falta = TRUE AND COALESCE(n.impacto_nomina,'pendiente') != 'rechazado_rrhh'
                      THEN COALESCE(n.dias_descuento, 1) ELSE 0 END), 0)        AS total_dias_descuento,

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

    -- Anticipos: descuento por cuota (con interés) o monto_cobro si 1 cuota
    COALESCE((
      SELECT SUM(
        CASE
          WHEN COALESCE(a.num_cuotas, 1) > 1 AND a.cuota_monto IS NOT NULL
            THEN a.cuota_monto
          ELSE COALESCE(a.monto_cobro, a.cantidad * 1.10)
        END
      )
      FROM anticipos a
      WHERE a.employee_id = e.id
        AND DATE(a.fecha_solicitud) BETWEEN $1 AND $2
        AND a.estado IN ('aprobada', 'pagada')
        AND COALESCE(a.cuotas_pagadas, 0) < COALESCE(a.num_cuotas, 1)
    ), 0)                                                                       AS anticipos_monto,
    COALESCE((
      SELECT COUNT(a.id)
      FROM anticipos a
      WHERE a.employee_id = e.id
        AND DATE(a.fecha_solicitud) BETWEEN $1 AND $2
        AND a.estado IN ('aprobada', 'pagada')
        AND COALESCE(a.cuotas_pagadas, 0) < COALESCE(a.num_cuotas, 1)
    ), 0)                                                                       AS anticipos_count,

    -- Próxima cuota de uniforme pendiente (UNIF-01)
    COALESCE((
      SELECT euc.monto::float
      FROM entregas_uniforme_cuotas euc
      JOIN entregas_uniforme eu ON eu.id = euc.entrega_id
      WHERE eu.employee_id = e.id
        AND euc.descontado = FALSE
        AND eu.tipo_cargo = 'cargo_empleado'
        AND eu.estado = 'activo'
      ORDER BY euc.num_cuota ASC
      LIMIT 1
    ), 0)                                                                       AS cuota_uniforme_monto,

    -- Estado de revisión RRHH
    COALESCE(pr.estado, 'pendiente')                                            AS revision_estado,
    pr.observaciones                                                            AS revision_observaciones,
    pr.revisado_por                                                             AS revision_por,
    pr.updated_at                                                               AS revision_at,
    pr.aprobado_por                                                             AS revision_aprobado_por,
    pr.aprobado_at                                                              AS revision_aprobado_at,

    -- Cierre del período (solo cierres activos, no anulados por reversión de planilla)
    (SELECT ppc.id FROM pre_planilla_cierres ppc
     WHERE ppc.periodo_desde = $1::date AND ppc.periodo_hasta = $2::date
       AND ppc.anulado = FALSE
     LIMIT 1)                                                                   AS cierre_id,

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

    -- Cliente principal (puesto operativo del empleado — fuente de verdad)
    po.cliente_nombre                                                           AS cliente_principal,

    -- IGSS — elegibilidad del colaborador
    COALESCE(e.aplica_igss_general, FALSE)                                      AS aplica_igss_general,
    COALESCE(e.estado_igss, 'no_activo')                                        AS estado_igss,
    e.fecha_inicio_igss,

    -- IGSS — régimen del puesto/servicio titular
    COALESCE(po.aplica_igss, FALSE)                                             AS puesto_aplica_igss,
    COALESCE(po.regimen_igss, 'no_aplica')                                      AS puesto_regimen_igss,

    -- IGSS — clasificación final para este período
    CASE
      WHEN COALESCE(e.aplica_igss_general, FALSE) = FALSE
        THEN FALSE
      WHEN COALESCE(e.estado_igss, 'no_activo') != 'activo'
        THEN FALSE
      WHEN COALESCE(po.aplica_igss, FALSE) = FALSE
        THEN FALSE
      ELSE TRUE
    END                                                                         AS aplica_igss,

    CASE
      WHEN COALESCE(e.aplica_igss_general, FALSE) = FALSE
        THEN 'Colaborador sin IGSS activado'
      WHEN COALESCE(e.estado_igss, 'no_activo') = 'pendiente_regularizacion'
        THEN 'Colaborador en proceso de regularización IGSS'
      WHEN COALESCE(e.estado_igss, 'no_activo') != 'activo'
        THEN 'Estado IGSS del colaborador: no activo'
      WHEN COALESCE(po.aplica_igss, FALSE) = FALSE
        THEN 'Servicio/puesto no incluye IGSS (tarifa)'
      ELSE NULL
    END                                                                         AS motivo_exclusion_igss,

    -- Séptimo día — resolución RRHH
    -- Número de semanas ISO del período en las que RRHH determinó pérdida del séptimo.
    -- Fuente autoritativa: eventos_rrhh.afecta_septimo_res = TRUE.
    -- descSeptimo en planilla = sueldoDia × septimos_perdidos (ver nomina-calc.ts).
    COALESCE((
      SELECT COUNT(DISTINCT DATE_TRUNC('week', er.fecha::date))::INT
      FROM eventos_rrhh er
      WHERE er.employee_id = e.id
        AND er.afecta_septimo_res = TRUE
        AND er.fecha::date BETWEEN $1::date AND $2::date
        AND COALESCE(er.estado, 'activo') != 'anulado'
    ), 0)                                                                       AS septimos_perdidos

  FROM employees e
  LEFT JOIN novedades_nomina_diarias n
    ON n.employee_id = e.id
    AND n.fecha BETWEEN $1 AND $2
  -- TH: buscar el puesto del que fue titular durante el período ($1=desde, $2=hasta)
  -- Primero busca en puesto_titular_historico; fallback a titular_employee_id actual
  LEFT JOIN LATERAL (
    SELECT po2.aplica_igss, po2.regimen_igss, po2.fecha_inicio_ciclo, po2.tipo_turno_id,
           po2.cliente_nombre
    FROM puestos_operativos po2
    WHERE po2.activo = TRUE
      AND (
        EXISTS (
          SELECT 1 FROM puesto_titular_historico pth
          WHERE pth.puesto_id = po2.id
            AND pth.employee_id = e.id
            AND pth.fecha_inicio <= $2::date
            AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
        )
        OR po2.titular_employee_id = e.id
      )
    ORDER BY po2.updated_at DESC NULLS LAST
    LIMIT 1
  ) po ON TRUE
  LEFT JOIN turnos t
    ON t.id = po.tipo_turno_id
  LEFT JOIN pre_planilla_revision pr
    ON pr.employee_id = e.id
    AND pr.periodo_desde = $1::date
    AND pr.periodo_hasta = $2::date
  WHERE (e.fecha_baja IS NULL OR e.fecha_baja >= $1::date)
    AND NOT EXISTS (
      SELECT 1 FROM prestaciones_liquidaciones pl
      WHERE pl.employee_id = e.id AND pl.estado = 'confirmada'
    )
  GROUP BY
    e.id, e.nombre_completo, e.dpi, e.sueldo_base, e.tipo_jornada,
    e.dia_descanso, e.horas_contrato, e.estado_laboral, e.puesto,
    e.area, e.sede, e.supervisor_nombre, e.frecuencia_pago,
    e.bonificacion_incentivo, e.bonificacion_1, e.bonificacion_2, e.bonificacion_3,
    e.aplica_igss_general, e.estado_igss, e.fecha_inicio_igss,
    po.aplica_igss, po.regimen_igss, po.cliente_nombre,
    pr.estado, pr.observaciones, pr.revisado_por, pr.updated_at,
    pr.aprobado_por, pr.aprobado_at
  ORDER BY e.nombre_completo
`;

// ─── Detecta si un período es primera o segunda quincena ─────────────────────
// Primera quincena: periodo_hasta día <= 15
// Segunda quincena: periodo_hasta día > 15
function detectarQuincena(hasta: string): "primera" | "segunda" {
  const d = new Date(hasta);
  return d.getUTCDate() <= 15 ? "primera" : "segunda";
}

// ─── GET /api/nomina/pre-planilla ─────────────────────────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) {
    return res.status(400).json({ error: "desde y hasta son requeridos (YYYY-MM-DD)" });
  }

  try {
    const { rows } = await pool.query(QUERY_CONSOLIDADO, [desde, hasta]);
    const quincena = detectarQuincena(hasta);

    // Anotar colaboradores excluidos por frecuencia de pago
    const annotated = rows.map((row) => {
      const freq = row.frecuencia_pago ?? "quincenal";
      const excluido = quincena === "primera" && freq === "mensual";
      return {
        ...row,
        quincena_tipo: quincena,
        excluido_frecuencia_pago: excluido,
        motivo_exclusion_frecuencia_pago: excluido
          ? "Colaborador mensual — solo aparece en la segunda quincena"
          : null,
      };
    });
    res.json(annotated);
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
  const { desde, hasta, estado, observaciones, revisadoPor, aprobadoPor } = req.body ?? {};

  if (isNaN(employeeId) || !desde || !hasta || !estado) {
    return res.status(400).json({ error: "employeeId, desde, hasta y estado son requeridos" });
  }

  const estadosValidos = ["pendiente", "revisada", "observada", "aprobado_rrhh"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(", ")}` });
  }

  try {
    // Verificar que el período no esté cerrado (ignorar cierres anulados)
    const { rows: cierre } = await pool.query(
      `SELECT id FROM pre_planilla_cierres WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
      [desde, hasta]
    );
    if (cierre.length > 0) {
      return res.status(409).json({ error: "El período está cerrado. No se pueden modificar revisiones." });
    }

    const isAprobacion = estado === "aprobado_rrhh";
    const { rows } = await pool.query(`
      INSERT INTO pre_planilla_revision
        (employee_id, periodo_desde, periodo_hasta, estado, observaciones, revisado_por, aprobado_por, aprobado_at, updated_at)
      VALUES ($1, $2::date, $3::date, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (employee_id, periodo_desde, periodo_hasta)
      DO UPDATE SET
        estado        = EXCLUDED.estado,
        observaciones = EXCLUDED.observaciones,
        revisado_por  = EXCLUDED.revisado_por,
        aprobado_por  = CASE WHEN EXCLUDED.estado = 'aprobado_rrhh' THEN EXCLUDED.aprobado_por ELSE pre_planilla_revision.aprobado_por END,
        aprobado_at   = CASE WHEN EXCLUDED.estado = 'aprobado_rrhh' THEN NOW() ELSE pre_planilla_revision.aprobado_at END,
        updated_at    = NOW()
      RETURNING *
    `, [
      employeeId, desde, hasta, estado,
      observaciones ?? null,
      revisadoPor ?? null,
      isAprobacion ? (aprobadoPor ?? revisadoPor ?? null) : null,
      isAprobacion ? new Date() : null,
    ]);

    // Registrar en auditoría
    const accion = estado === "aprobado_rrhh" ? "aprobacion" : estado === "observada" ? "observacion" : "revision";
    await pool.query(`
      INSERT INTO pre_planilla_auditoria (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, $3, $4, $5, $6, $7)
    `, [desde, hasta, employeeId, accion, revisadoPor ?? aprobadoPor ?? "sistema", observaciones ?? null, JSON.stringify({ estado })]);

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /nomina/pre-planilla/revision error");
    res.status(500).json({ error: "Error al guardar revisión" });
  }
});

// ─── GET /api/nomina/pre-planilla/validacion ──────────────────────────────────
// Detecta errores críticos y alertas automáticas antes de permitir el cierre
prePlanillaRouter.get("/nomina/pre-planilla/validacion", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son requeridos" });

  try {
    // Verificar si ya está cerrado (ignorar cierres anulados — período reabierto)
    const { rows: cierreExistente } = await pool.query(
      `SELECT id, cerrado_por, cerrado_at FROM pre_planilla_cierres WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
      [desde, hasta]
    );
    if (cierreExistente.length > 0) {
      const c = cierreExistente[0];
      return res.json({
        periodo_cerrado: true,
        cierre_id: c.id,
        cerrado_por: c.cerrado_por,
        cerrado_at: c.cerrado_at,
        errores_criticos: [],
        alertas: [],
        resumen: { total_colaboradores: 0, errores: 0, alertas: 0 },
      });
    }

    // Error crítico 1: falta=TRUE y trabajo_dia=TRUE el mismo día
    const { rows: errFaltaTrabajo } = await pool.query(`
      SELECT n.fecha, e.nombre_completo, e.id AS employee_id
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.falta = TRUE AND n.trabajo_dia = TRUE
      ORDER BY n.fecha, e.nombre_completo
    `, [desde, hasta]);

    // Error crítico 2: trabajo_dia=TRUE y horas_trabajadas=0 o NULL
    const { rows: errSinHoras } = await pool.query(`
      SELECT n.fecha, e.nombre_completo, e.id AS employee_id
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.trabajo_dia = TRUE
        AND (n.horas_trabajadas IS NULL OR n.horas_trabajadas::numeric = 0)
      ORDER BY n.fecha, e.nombre_completo
    `, [desde, hasta]);

    // Error crítico 3: permiso_con_goce con falta=TRUE (mal clasificado)
    const { rows: errPermisoConFalta } = await pool.query(`
      SELECT n.fecha, e.nombre_completo, e.id AS employee_id, n.tipo_novedad
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.tipo_novedad IN ('permiso_con_goce', 'vacaciones', 'incapacidad', 'relevo_vacaciones')
        AND (n.falta = TRUE OR n.descuento_dia = TRUE)
      ORDER BY n.fecha, e.nombre_completo
    `, [desde, hasta]);

    // Alerta 1: colaborador activo (o con baja dentro del período) sin ningún registro en el período
    const { rows: alertaSinRegistros } = await pool.query(`
      SELECT e.id AS employee_id, e.nombre_completo, e.puesto, e.sede
      FROM employees e
      WHERE (e.fecha_baja IS NULL OR e.fecha_baja >= $1::date)
        AND NOT EXISTS (
          SELECT 1 FROM prestaciones_liquidaciones pl
          WHERE pl.employee_id = e.id AND pl.estado = 'confirmada'
        )
        AND e.id NOT IN (
          SELECT DISTINCT n.employee_id FROM novedades_nomina_diarias n
          WHERE n.fecha BETWEEN $1 AND $2
        )
      ORDER BY e.nombre_completo
    `, [desde, hasta]);

    // Alerta 2a: abandonos parciales en el período (requieren revisión)
    const { rows: alertasAbandono } = await pool.query(`
      SELECT DISTINCT e.id AS employee_id, e.nombre_completo,
             COUNT(*) AS veces
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.tipo_novedad = 'abandono_parcial'
      GROUP BY e.id, e.nombre_completo
      ORDER BY e.nombre_completo
    `, [desde, hasta]);

    // Alerta 2b: permisos sin goce en el período
    const { rows: alertasPermisoSinGoce } = await pool.query(`
      SELECT DISTINCT e.id AS employee_id, e.nombre_completo,
             COUNT(*) AS veces
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.tipo_novedad = 'permiso_sin_goce'
      GROUP BY e.id, e.nombre_completo
      ORDER BY e.nombre_completo
    `, [desde, hasta]);

    // Alerta: HE pendientes de aprobación RRHH
    const { rows: alertasHEPendientes } = await pool.query(`
      SELECT DISTINCT e.id AS employee_id, e.nombre_completo,
             SUM(n.horas_extra::numeric) AS horas_pendientes
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.requiere_revision_rrhh = TRUE
        AND n.impacto_nomina = 'pendiente'
        AND n.horas_extra > 0
      GROUP BY e.id, e.nombre_completo
      ORDER BY e.nombre_completo
    `, [desde, hasta]);

    // Alerta 2: colaboradores pendientes de revisión RRHH (no aprobados)
    const { rows: alertasPendientes } = await pool.query(`
      SELECT e.id AS employee_id, e.nombre_completo,
             COALESCE(pr.estado, 'pendiente') AS estado
      FROM employees e
      INNER JOIN novedades_nomina_diarias n ON n.employee_id = e.id AND n.fecha BETWEEN $1 AND $2
      LEFT JOIN pre_planilla_revision pr ON pr.employee_id = e.id AND pr.periodo_desde = $1::date AND pr.periodo_hasta = $2::date
      WHERE COALESCE(pr.estado, 'pendiente') NOT IN ('revisada', 'aprobado_rrhh')
      GROUP BY e.id, e.nombre_completo, pr.estado
      ORDER BY e.nombre_completo
    `, [desde, hasta]);

    const erroresCriticos = [
      ...errFaltaTrabajo.map(r => ({
        tipo: "falta_y_trabajo",
        severidad: "critico",
        mensaje: `${r.nombre_completo} — falta registrada el mismo día que trabajo (${r.fecha?.toISOString?.().slice(0,10) ?? r.fecha})`,
        employee_id: r.employee_id,
        fecha: r.fecha,
      })),
      ...errSinHoras.map(r => ({
        tipo: "trabajo_sin_horas",
        severidad: "critico",
        mensaje: `${r.nombre_completo} — día trabajado sin horas registradas (${r.fecha?.toISOString?.().slice(0,10) ?? r.fecha})`,
        employee_id: r.employee_id,
        fecha: r.fecha,
      })),
      ...errPermisoConFalta.map(r => ({
        tipo: "exento_con_descuento",
        severidad: "critico",
        mensaje: `${r.nombre_completo} — ${r.tipo_novedad} no debe generar descuento (${r.fecha?.toISOString?.().slice(0,10) ?? r.fecha})`,
        employee_id: r.employee_id,
        fecha: r.fecha,
        tipo_novedad: r.tipo_novedad,
      })),
    ];

    const alertas = [
      ...alertaSinRegistros.map(r => ({
        tipo: "sin_registros",
        severidad: "alerta",
        mensaje: `${r.nombre_completo} — colaborador activo sin registros en el período`,
        employee_id: r.employee_id,
      })),
      ...alertasPendientes.map(r => ({
        tipo: "pendiente_revision",
        severidad: "alerta",
        mensaje: `${r.nombre_completo} — revisión pendiente (estado: ${r.estado})`,
        employee_id: r.employee_id,
        estado: r.estado,
      })),
      ...alertasAbandono.map(r => ({
        tipo: "abandono_parcial",
        severidad: "alerta",
        mensaje: `${r.nombre_completo} — ${r.veces} abandono(s) parcial(es) en el período. Verificar horas descontadas.`,
        employee_id: r.employee_id,
        veces: Number(r.veces),
      })),
      ...alertasPermisoSinGoce.map(r => ({
        tipo: "permiso_sin_goce",
        severidad: "alerta",
        mensaje: `${r.nombre_completo} — ${r.veces} permiso(s) sin goce de sueldo. Verificar autorización documentada.`,
        employee_id: r.employee_id,
        veces: Number(r.veces),
      })),
      ...alertasHEPendientes.map(r => ({
        tipo: "he_pendiente_rrhh",
        severidad: "alerta",
        mensaje: `${r.nombre_completo} — ${Number(r.horas_pendientes).toFixed(1)}h extra pendientes de aprobación RRHH. No se incluirán en planilla hasta validación.`,
        employee_id: r.employee_id,
        horas_pendientes: Number(r.horas_pendientes),
      })),
    ];

    // Total colaboradores con registros
    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(DISTINCT employee_id) AS total FROM novedades_nomina_diarias WHERE fecha BETWEEN $1 AND $2`,
      [desde, hasta]
    );

    res.json({
      periodo_cerrado: false,
      errores_criticos: erroresCriticos,
      alertas,
      resumen: {
        total_colaboradores: parseInt(totalRows[0]?.total ?? "0"),
        errores: erroresCriticos.length,
        alertas: alertas.length,
        puede_cerrar: erroresCriticos.length === 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/validacion error");
    res.status(500).json({ error: "Error al validar pre-planilla" });
  }
});

// ─── GET /api/nomina/pre-planilla/cierres ─────────────────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla/cierres", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, periodo_desde, periodo_hasta, cerrado_por, cerrado_at,
             observaciones, total_colaboradores, total_estimado
      FROM pre_planilla_cierres
      ORDER BY cerrado_at DESC
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/cierres error");
    res.status(500).json({ error: "Error al obtener cierres" });
  }
});

// ─── GET /api/nomina/pre-planilla/cierre/:id ──────────────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla/cierre/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM pre_planilla_cierres WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Cierre no encontrado" });

    const cierre = rows[0];
    // Obtener auditoría del período
    const { rows: auditoria } = await pool.query(`
      SELECT ppa.*, e.nombre_completo
      FROM pre_planilla_auditoria ppa
      LEFT JOIN employees e ON e.id = ppa.employee_id
      WHERE ppa.periodo_desde = $1 AND ppa.periodo_hasta = $2
      ORDER BY ppa.created_at DESC
    `, [cierre.periodo_desde, cierre.periodo_hasta]);

    res.json({ ...cierre, auditoria });
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/cierre/:id error");
    res.status(500).json({ error: "Error al obtener cierre" });
  }
});

// ─── POST /api/nomina/pre-planilla/cierre ─────────────────────────────────────
// Cierra el período: valida, crea snapshot, congela datos
prePlanillaRouter.post("/nomina/pre-planilla/cierre", async (req, res) => {
  const { desde, hasta, cerradoPor, observaciones, forzar } = req.body ?? {};
  if (!desde || !hasta || !cerradoPor) {
    return res.status(400).json({ error: "desde, hasta y cerradoPor son requeridos" });
  }

  try {
    // Verificar que no esté ya cerrado (ignorar cierres anulados — permite re-cerrar tras reversión)
    const { rows: existente } = await pool.query(
      `SELECT id FROM pre_planilla_cierres WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
      [desde, hasta]
    );
    if (existente.length > 0) {
      return res.status(409).json({ error: "El período ya está cerrado.", cierre_id: existente[0].id });
    }

    // Ejecutar validaciones
    const { rows: errFaltaTrabajo } = await pool.query(`
      SELECT COUNT(*) AS cnt FROM novedades_nomina_diarias
      WHERE fecha BETWEEN $1 AND $2 AND falta = TRUE AND trabajo_dia = TRUE
    `, [desde, hasta]);
    const { rows: errSinHoras } = await pool.query(`
      SELECT COUNT(*) AS cnt FROM novedades_nomina_diarias
      WHERE fecha BETWEEN $1 AND $2 AND trabajo_dia = TRUE
        AND (horas_trabajadas IS NULL OR horas_trabajadas::numeric = 0)
    `, [desde, hasta]);
    const { rows: errExentos } = await pool.query(`
      SELECT COUNT(*) AS cnt FROM novedades_nomina_diarias
      WHERE fecha BETWEEN $1 AND $2
        AND tipo_novedad IN ('permiso_con_goce', 'vacaciones', 'incapacidad', 'relevo_vacaciones')
        AND (falta = TRUE OR descuento_dia = TRUE)
    `, [desde, hasta]);

    const totalErrores = parseInt(errFaltaTrabajo[0]?.cnt ?? "0")
      + parseInt(errSinHoras[0]?.cnt ?? "0")
      + parseInt(errExentos[0]?.cnt ?? "0");

    if (totalErrores > 0 && !forzar) {
      return res.status(422).json({
        error: "Hay errores críticos que deben resolverse antes de cerrar.",
        errores_criticos: totalErrores,
        detalle: "Usa GET /api/nomina/pre-planilla/validacion para ver el detalle.",
      });
    }

    // Generar snapshot completo y filtrar por frecuencia de pago
    const { rows: allRows } = await pool.query(QUERY_CONSOLIDADO, [desde, hasta]);
    const quincenaTipo = detectarQuincena(hasta);

    // Primera quincena: excluir colaboradores mensuales
    const snapshotRows = quincenaTipo === "primera"
      ? allRows.filter(r => (r.frecuencia_pago ?? "quincenal") === "quincenal")
      : allRows;

    // Período en días del rango
    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    const periodoDias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;

    // Calcular total estimado usando calcularBruto() de nomina-calc.ts
    // (misma función que usa la planilla final → total_estimado == total_bruto)
    let totalEstimado = 0;
    for (const row of snapshotRows) {
      const anticipo = toNum(row.anticipos_monto);
      const { totalBruto } = calcularBruto({
        sueldoBase:       toNum(row.sueldo_base),
        horasContrato:    toNum(row.horas_contrato),
        faltas:           toInt(row.faltas),
        suspensiones:     toInt(row.suspensiones),
        diasDescuento:    toNum(row.total_dias_descuento),
        horasExtra:       toNum(row.horas_extra),
        periodoTotalDias: periodoDias,
        frecuenciaPago:   String(row.frecuencia_pago ?? "quincenal"),
        quincenaTipo,
        septimosPerdidos: toInt(row.septimos_perdidos),
      });
      // Redondear por línea antes de acumular (igual que planilla.ts) → convergencia exacta
      totalEstimado += parseFloat(Math.max(0, totalBruto - anticipo).toFixed(2));
    }

    // Guardar cierre
    const { rows: cierreRows } = await pool.query(`
      INSERT INTO pre_planilla_cierres (periodo_desde, periodo_hasta, cerrado_por, observaciones, snapshot, total_colaboradores, total_estimado)
      VALUES ($1::date, $2::date, $3, $4, $5::jsonb, $6, $7)
      RETURNING id, periodo_desde, periodo_hasta, cerrado_por, cerrado_at, total_colaboradores, total_estimado
    `, [desde, hasta, cerradoPor, observaciones ?? null, JSON.stringify(snapshotRows), snapshotRows.length, totalEstimado.toFixed(2)]);

    // Marcar revisiones como cerradas
    await pool.query(`
      UPDATE pre_planilla_revision SET periodo_cerrado = TRUE
      WHERE periodo_desde = $1::date AND periodo_hasta = $2::date
    `, [desde, hasta]);

    // Registrar en auditoría
    await pool.query(`
      INSERT INTO pre_planilla_auditoria (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'cierre', $3, $4, $5)
    `, [desde, hasta, cerradoPor, observaciones ?? null, JSON.stringify({ total_colaboradores: snapshotRows.length, total_estimado: totalEstimado.toFixed(2), forzar: !!forzar })]);

    // ── Auto-provisionar prestaciones al cerrar la pre-planilla ──────────────
    // Operación best-effort: un error no cancela el cierre, sólo se registra.
    let provisionResult: { empleados: number; provisiones: number } | null = null;
    try {
      const diasPeriodo = diasEntreFechas(desde, hasta);
      const tiposCalc: Array<"aguinaldo" | "bono14" | "vacaciones" | "indemnizacion"> =
        ["aguinaldo", "bono14", "vacaciones", "indemnizacion"];

      const { rows: empleados } = await pool.query<{
        id: number; nombre_completo: string; sueldo_base: string;
        sede: string | null; puesto: string | null; fecha_ingreso: string;
        frecuencia_pago: string; client_id: number;
      }>(
        `SELECT e.id, e.nombre_completo, e.sueldo_base, e.sede, e.puesto,
                e.fecha_ingreso, e.frecuencia_pago,
                COALESCE(e.cliente_id, 0) AS client_id
         FROM employees e
         WHERE (e.fecha_baja IS NULL OR e.fecha_baja >= $1::date)
           AND NOT EXISTS (
             SELECT 1 FROM prestaciones_liquidaciones pl
             WHERE pl.employee_id = e.id AND pl.estado = 'confirmada'
           )`, [desde]
      );

      const db = await pool.connect();
      let provisionesCount = 0;
      try {
        await db.query("BEGIN");
        for (const emp of empleados) {
          const sueldo = parseFloat(emp.sueldo_base);
          if (!isFinite(sueldo) || sueldo <= 0) continue;
          const fechaIngreso = new Date(emp.fecha_ingreso);
          const hoy = new Date(hasta);
          const aniosServ = Math.max(0, hoy.getUTCFullYear() - fechaIngreso.getUTCFullYear());
          for (const tipo of tiposCalc) {
            try {
              const result = calcularProvisionPeriodo({ sueldoMensual: sueldo, diasPeriodo, tipo, aniosServicio: aniosServ });
              await db.query(
                `INSERT INTO prestaciones_provisiones
                   (periodo_desde, periodo_hasta, tipo, employee_id, empleado_nombre, sede, puesto,
                    client_id, dias_periodo, salario_referencia, monto_provision, generado_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
                 ON CONFLICT (periodo_desde, periodo_hasta, tipo, employee_id) DO UPDATE SET
                   monto_provision=EXCLUDED.monto_provision, salario_referencia=EXCLUDED.salario_referencia,
                   dias_periodo=EXCLUDED.dias_periodo, generado_at=NOW()`,
                [desde, hasta, tipo, emp.id, emp.nombre_completo,
                 emp.sede ?? null, emp.puesto ?? null, emp.client_id,
                 diasPeriodo, sueldo, result.montoProvision]
              );
              provisionesCount++;
            } catch { /* skip single employee/tipo error */ }
          }
        }
        await db.query("COMMIT");
        provisionResult = { empleados: empleados.length, provisiones: provisionesCount };
        logger.info({ desde, hasta, provisionResult }, "Auto-provisionamiento al cierre completado");
      } catch (provErr) {
        await db.query("ROLLBACK");
        logger.error({ provErr }, "Auto-provisionamiento al cierre — ROLLBACK (cierre no afectado)");
      } finally {
        db.release();
      }
    } catch (provErr) {
      logger.error({ provErr }, "Auto-provisionamiento al cierre — error no bloqueante");
    }

    res.status(201).json({
      ...cierreRows[0],
      mensaje: `Pre-planilla del período ${desde} — ${hasta} cerrada correctamente.`,
      provisiones_generadas: provisionResult,
    });
  } catch (err) {
    logger.error({ err }, "POST /nomina/pre-planilla/cierre error");
    res.status(500).json({ error: "Error al cerrar pre-planilla" });
  }
});

// ─── POST /api/nomina/pre-planilla/reabrir ───────────────────────────────────
prePlanillaRouter.post("/nomina/pre-planilla/reabrir", async (req, res) => {
  const { desde, hasta, usuario } = req.body;
  if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son requeridos" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE pre_planilla_cierres SET anulado = TRUE, anulado_por = $3, anulado_at = NOW()
       WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
      [desde, hasta, usuario ?? "admin"]
    );
    if (!rowCount) return res.status(404).json({ error: "No hay cierre activo para este período" });
    await pool.query(
      `UPDATE pre_planilla_revision SET periodo_cerrado = FALSE
       WHERE periodo_desde = $1::date AND periodo_hasta = $2::date`, [desde, hasta]
    );
    res.json({ ok: true, mensaje: "Período reabierto correctamente." });
  } catch (err) {
    logger.error({ err }, "POST /nomina/pre-planilla/reabrir error");
    res.status(500).json({ error: "Error al reabrir período" });
  }
});

// ─── GET /api/nomina/pre-planilla/anexo/horas-extra ──────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla/anexo/horas-extra", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son requeridos" });
  try {
    const { rows } = await pool.query(`
      SELECT
        n.id,
        n.fecha,
        n.horas_extra::numeric                                            AS horas_extra,
        n.horas_trabajadas::numeric                                       AS horas_trabajadas,
        n.puesto_titular_nombre,
        n.puesto_cubierto_nombre,
        n.descanso_trabajado,
        n.observaciones,
        n.fuente,
        n.horas_extra_estado,
        n.horas_extra_aprobadas_por,
        n.horas_extra_aprobadas_at,
        CASE
          WHEN n.puesto_cubierto_id IS NOT NULL
            AND n.puesto_cubierto_id IS DISTINCT FROM n.puesto_titular_id THEN 'relevo'
          WHEN n.descanso_trabajado THEN 'descanso_trabajado'
          ELSE 'normal'
        END                                                               AS tipo,
        e.id                                                              AS employee_id,
        e.nombre_completo,
        e.sede,
        COALESCE(
          (SELECT po.cliente_nombre FROM puestos_operativos po
           WHERE po.id = n.puesto_titular_id LIMIT 1),
          (SELECT po.cliente_nombre FROM puestos_operativos po
           WHERE po.titular_employee_id = e.id AND po.activo = TRUE LIMIT 1)
        )                                                                 AS cliente_nombre
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.horas_extra IS NOT NULL
        AND n.horas_extra::numeric > 0
      ORDER BY n.fecha ASC, e.nombre_completo
    `, [desde, hasta]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/anexo/horas-extra error");
    res.status(500).json({ error: "Error al obtener horas extra" });
  }
});

// ─── GET /api/nomina/pre-planilla/anexo/faltas ────────────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla/anexo/faltas", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son requeridos" });
  try {
    const { rows } = await pool.query(`
      SELECT
        n.id,
        n.fecha,
        n.falta,
        n.suspension,
        n.descuento_dia,
        n.dias_descuento,
        n.puesto_titular_nombre,
        n.puesto_cubierto_nombre,
        n.observaciones,
        n.fuente,
        n.tipo_novedad,
        e.id    AS employee_id,
        e.nombre_completo,
        e.dpi,
        e.sede
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND (n.falta = TRUE OR n.suspension = TRUE)
        AND NOT EXISTS (
          SELECT 1 FROM prestaciones_liquidaciones pl
          WHERE pl.employee_id = e.id AND pl.estado = 'confirmada'
        )
      ORDER BY n.fecha ASC, e.nombre_completo
    `, [desde, hasta]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/anexo/faltas error");
    res.status(500).json({ error: "Error al obtener faltas" });
  }
});

// ─── GET /api/nomina/pre-planilla/anexo/anticipos ────────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla/anexo/anticipos", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son requeridos" });
  try {
    const { rows } = await pool.query(`
      SELECT
        a.id,
        a.cantidad,
        a.estado,
        a.periodo,
        a.origen,
        a.observaciones,
        a.fecha_solicitud,
        a.nombre,
        a.planilla_id,
        e.id    AS employee_id,
        e.nombre_completo,
        e.dpi,
        e.sede
      FROM anticipos a
      JOIN employees e ON e.id = a.employee_id
      WHERE DATE(a.fecha_solicitud) BETWEEN $1 AND $2
        AND a.estado IN ('aprobada', 'pagada')
      ORDER BY a.fecha_solicitud DESC, e.nombre_completo
    `, [desde, hasta]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/anexo/anticipos error");
    res.status(500).json({ error: "Error al obtener anticipos" });
  }
});

// ─── GET /api/nomina/pre-planilla/anexo/coberturas ───────────────────────────
prePlanillaRouter.get("/nomina/pre-planilla/anexo/coberturas", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) return res.status(400).json({ error: "desde y hasta son requeridos" });
  try {
    const { rows } = await pool.query(`
      SELECT
        n.id,
        n.fecha,
        n.horas_trabajadas::numeric                                       AS horas,
        n.horas_extra::numeric                                            AS horas_extra,
        n.puesto_titular_nombre,
        n.puesto_cubierto_nombre,
        n.descanso_trabajado,
        n.observaciones,
        n.num_puestos_cubiertos,
        CASE
          WHEN n.puesto_cubierto_id IS NOT NULL
            AND n.puesto_cubierto_id IS DISTINCT FROM n.puesto_titular_id THEN 'relevo'
          WHEN n.descanso_trabajado THEN 'descanso_trabajado'
          ELSE 'cobertura'
        END                                                               AS tipo_cobertura,
        e.id    AS employee_id,
        e.nombre_completo,
        e.sede,
        COALESCE(
          (SELECT po.cliente_nombre FROM puestos_operativos po
           WHERE po.id = n.puesto_cubierto_id LIMIT 1),
          (SELECT po.cliente_nombre FROM puestos_operativos po
           WHERE po.titular_employee_id = e.id AND po.activo = TRUE LIMIT 1)
        )                                                                 AS cliente_nombre
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
        AND n.trabajo_dia = TRUE
        AND (
          (n.puesto_cubierto_id IS NOT NULL AND n.puesto_cubierto_id IS DISTINCT FROM n.puesto_titular_id)
          OR n.descanso_trabajado = TRUE
        )
      ORDER BY n.fecha ASC, e.nombre_completo
    `, [desde, hasta]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/anexo/coberturas error");
    res.status(500).json({ error: "Error al obtener coberturas" });
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
      "Estado Laboral", "Días Cerrados", "Días Trabajados", "Faltas", "Días Descuento", "Suspensiones",
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
        r.dias_cerrados, r.dias_trabajados, r.faltas, r.total_dias_descuento, r.suspensiones, r.descansos_trabajados,
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
