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
import { calcularBruto, calcularValorHE, toNum, toInt } from "../lib/nomina-calc";
import { calcularProvisionPeriodo, diasEntreFechas } from "../lib/prestaciones-calc";
import { igssAplicaCaseSql, igssMotivoCaseSql, igssTitularChainSQL } from "../lib/igss-clasificacion";

export const prePlanillaRouter = Router();

// "Puesto cubre IGSS" = flag del propio puesto (po.aplica_igss) O cliente
// registrado como Centro de Trabajo IGSS (clients.igss_aplica, expuesto como
// po.cliente_igss_aplica vía el LATERAL `po` de QUERY_CONSOLIDADO).
const PUESTO_CUBRE_IGSS_SQL =
  "(COALESCE(po.aplica_igss, FALSE) OR COALESCE(po.cliente_igss_aplica, FALSE))";

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

    -- Descuento de barraca (vivienda empresarial BARR-01)
    COALESCE((
      SELECT b.cuota_mensual::float
      FROM barraca_asignaciones ba
      JOIN barracas b ON b.id = ba.barraca_id
      WHERE ba.employee_id = e.id
        AND ba.activo = TRUE
        AND b.activo = TRUE
      LIMIT 1
    ), 0)                                                                       AS barraca_monto,
    (SELECT b.nombre FROM barraca_asignaciones ba JOIN barracas b ON b.id = ba.barraca_id
     WHERE ba.employee_id = e.id AND ba.activo = TRUE AND b.activo = TRUE LIMIT 1) AS barraca_nombre,

    -- Prima mensual de seguro de vida vigente al período (SEG-02)
    -- El monto del período (mitad si quincenal, completo si mensual) se calcula en TS
    COALESCE((
      SELECT sc.prima_mensual::float
      FROM seguros_config sc
      WHERE sc.vigente_desde <= $2::date
      ORDER BY sc.vigente_desde DESC, sc.id DESC
      LIMIT 1
    ), 0)                                                                        AS seguro_prima_mensual,

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

    -- Pago por feriados/asuetos nacionales trabajados (concepto aparte, default Q0).
    -- Lo asigna el encargado de nómina por colaborador en la pestaña "Feriados
    -- trabajados" de la pre-planilla. Suma escalar correlacionada por empleado y período.
    COALESCE((
      SELECT SUM(fp.monto)
      FROM nomina_feriado_pago fp
      WHERE fp.employee_id = e.id
        AND fp.periodo_desde = $1::date
        AND fp.periodo_hasta = $2::date
        -- Solo cuenta si existe un feriado activo en esa fecha y período que
        -- APLIQUE a este empleado (nacional o local del cliente de su puesto
        -- titular). Mismo scoping que la pestaña GET: si el encargado lo desactiva
        -- o el feriado era de otro cliente, el monto deja de impactar el bruto.
        -- El registro se conserva. (El pago se modela por fecha, igual que la UI.)
        AND EXISTS (
          SELECT 1 FROM nomina_feriados nf
          WHERE nf.fecha = fp.feriado_fecha
            AND nf.activo = TRUE
            AND nf.fecha BETWEEN $1::date AND $2::date
            -- po.cliente_nombre = cliente canónico del empleado en el período
            -- (LATERAL po: histórico con fallback al titular actual).
            AND (nf.cliente_nombre IS NULL OR nf.cliente_nombre = po.cliente_nombre)
        )
    ), 0)                                                                       AS pago_feriados,

    -- IGSS — elegibilidad del colaborador
    COALESCE(e.aplica_igss_general, FALSE)                                      AS aplica_igss_general,
    COALESCE(e.estado_igss, 'no_activo')                                        AS estado_igss,
    e.fecha_inicio_igss,

    -- IGSS — régimen del puesto/servicio titular
    ${PUESTO_CUBRE_IGSS_SQL}                                                    AS puesto_aplica_igss,
    COALESCE(po.regimen_igss, 'no_aplica')                                      AS puesto_regimen_igss,

    -- IGSS — clasificación final para este período
    -- (Reglas centralizadas en lib/igss-clasificacion.ts; ver igss*CaseSql)
    ${igssAplicaCaseSql(PUESTO_CUBRE_IGSS_SQL)}                                 AS aplica_igss,
    ${igssMotivoCaseSql(PUESTO_CUBRE_IGSS_SQL)}                                 AS motivo_exclusion_igss,

    -- Amonestaciones económicas activas y pendientes de descuento (AMON-01)
    COALESCE((
      SELECT SUM(am.monto)::float
        FROM amonestaciones am
       WHERE am.employee_id = e.id
         AND am.tipo = 'economica'
         AND am.estado = 'activa'
         AND am.descontado = FALSE
         AND am.fecha BETWEEN $1::date AND $2::date
    ), 0)                                                                       AS amonestaciones_monto,
    COALESCE((
      SELECT COUNT(am.id)::int
        FROM amonestaciones am
       WHERE am.employee_id = e.id
         AND am.tipo = 'economica'
         AND am.estado = 'activa'
         AND am.descontado = FALSE
         AND am.fecha BETWEEN $1::date AND $2::date
    ), 0)                                                                       AS amonestaciones_count,

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
  -- TH: puesto del que el empleado es titular durante el período ($1=desde, $2=hasta).
  -- Resolución unificada por prioridad (misma lógica que clienteEmpleadoSQL):
  -- histórico vigente > slots del Pizarrón > titulares intermedios > legacy.
  LEFT JOIN LATERAL (
    SELECT po2.aplica_igss, po2.regimen_igss, po2.fecha_inicio_ciclo, po2.tipo_turno_id,
           po2.cliente_nombre, cl.igss_aplica AS cliente_igss_aplica
    FROM ${igssTitularChainSQL("e.id", "$1", "$2")}
    JOIN puestos_operativos po2 ON po2.id = tu.puesto_id AND po2.activo = TRUE
    LEFT JOIN clients cl ON cl.id = po2.cliente_id
    ORDER BY tu.prio ASC, tu.orden ASC, po2.updated_at DESC NULLS LAST
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
    po.aplica_igss, po.cliente_igss_aplica, po.regimen_igss, po.cliente_nombre,
    pr.estado, pr.observaciones, pr.revisado_por, pr.updated_at,
    pr.aprobado_por, pr.aprobado_at
  ORDER BY e.nombre_completo
`;

// ─── Cliente del puesto del que el empleado fue titular durante el período ────
// Misma resolución que el LATERAL `po` de QUERY_CONSOLIDADO: busca en
// puesto_titular_historico (vigente en el período) con fallback al titular
// actual. Devuelve un sub-SELECT escalar; `emp`, `desde` y `hasta` son las
// referencias SQL (columna o $N) que correspondan a la consulta que lo usa.
function clienteEmpleadoSQL(emp: string, desde: string, hasta: string): string {
  return `(
    SELECT po2.cliente_nombre
    FROM (
      -- Prioridad 0: titular histórico vigente en el período (lo más exacto para
      -- planillas de quincenas pasadas).
      SELECT pth.puesto_id, 0 AS prio, 0 AS orden
        FROM puesto_titular_historico pth
        WHERE pth.employee_id = ${emp}
          AND pth.fecha_inicio <= ${hasta}::date
          AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= ${desde}::date)
      UNION ALL
      -- Prioridad 1: slots del Pizarrón Operativo (modelo vigente 24x24).
      SELECT ps.puesto_id, 1 AS prio, ps.slot_numero AS orden
        FROM puesto_slots ps
        WHERE ps.empleado_id = ${emp} AND ps.activo = TRUE
      UNION ALL
      -- Prioridad 2: sistema intermedio multi-titular.
      SELECT pt.puesto_id, 2 AS prio, COALESCE(pt.orden, 99) AS orden
        FROM puesto_titulares pt
        WHERE pt.employee_id = ${emp} AND pt.activo = TRUE
      UNION ALL
      -- Prioridad 3: campo legacy titular_employee_id.
      SELECT po3.id AS puesto_id, 3 AS prio, 0 AS orden
        FROM puestos_operativos po3
        WHERE po3.titular_employee_id = ${emp} AND po3.activo = TRUE
    ) tu
    JOIN puestos_operativos po2 ON po2.id = tu.puesto_id AND po2.activo = TRUE
    ORDER BY tu.prio ASC, tu.orden ASC, po2.updated_at DESC NULLS LAST
    LIMIT 1
  )`;
}

// ─── Detecta si un período es primera o segunda quincena ─────────────────────
// Primera quincena: periodo_hasta día <= 15
// Segunda quincena: periodo_hasta día > 15
function detectarQuincena(hasta: string): "primera" | "segunda" {
  const d = new Date(hasta);
  return d.getUTCDate() <= 15 ? "primera" : "segunda";
}

// ─── Días anticipados (pago por adelantado) y su reconciliación ──────────────
// Un "día anticipado" = día dentro del período que aún NO está cerrado en el
// pizarrón (cierre_operativo_diario.estado != 'cerrado'): se paga por adelantado
// al cerrar antes del fin real de la quincena. En la quincena siguiente, si el
// agente faltó ese día, se descuenta (clawback) usando dias_descuento ya
// calculado en novedades_nomina_diarias (3d para turno 24h, 2d para 12h).

// Carga la tabla config_tarifa_he (12h→Q150, 24h→Q300) como Map jornada→{tarifa,horas_turno}.
// La pre-planilla y la planilla final la usan para que el valor de HE coincida.
async function cargarTarifasHE(): Promise<Map<string, { tarifa: number; horas_turno: number }>> {
  const m = new Map<string, { tarifa: number; horas_turno: number }>();
  try {
    const { rows } = await pool.query(`SELECT jornada, tarifa, horas_turno FROM config_tarifa_he`);
    for (const r of rows) {
      m.set(String(r.jornada), { tarifa: parseFloat(r.tarifa), horas_turno: parseInt(r.horas_turno) });
    }
  } catch { /* tabla aún no existe → cálculo legal */ }
  return m;
}

async function diasNoCerradosEnPeriodo(desde: string, hasta: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT d::date::text AS fecha
       FROM generate_series($1::date, $2::date, '1 day') d
      WHERE NOT EXISTS (
        SELECT 1 FROM cierre_operativo_diario cod
        WHERE cod.fecha = d::date AND cod.estado = 'cerrado'
      )
      ORDER BY d`,
    [desde, hasta]
  );
  return rows.map((r) => r.fecha as string);
}

interface AjusteAnticipadoEmpleado {
  employee_id: number;
  nombre_completo: string;
  dias_descuento: number;
  detalle: { fecha: string; dias: number }[];
}

// Registros anticipados pendientes (de cierres previos) cuya fecha YA está
// cerrada en el pizarrón. Devuelve el descuento por empleado (clawback) y los
// registros fuente para marcarlos reconciliados al cerrar el período actual.
async function reconciliarAnticipados(desde: string): Promise<{
  porEmpleado: Map<number, AjusteAnticipadoEmpleado>;
  registros: { id: number; fecha: string; periodo_desde: string; periodo_hasta: string }[];
}> {
  const { rows: regs } = await pool.query(
    `SELECT a.id, a.cierre_id, a.fecha::text AS fecha,
            a.periodo_desde::text AS periodo_desde, a.periodo_hasta::text AS periodo_hasta
       FROM pre_planilla_dias_anticipados a
      WHERE a.estado = 'pendiente'
        AND a.fecha < $1::date
        AND EXISTS (
          SELECT 1 FROM cierre_operativo_diario cod
          WHERE cod.fecha = a.fecha AND cod.estado = 'cerrado'
        )
      ORDER BY a.fecha`,
    [desde]
  );
  const porEmpleado = new Map<number, AjusteAnticipadoEmpleado>();
  if (regs.length === 0) return { porEmpleado, registros: [] };

  // Elegibilidad: el clawback SOLO aplica a quienes realmente fueron pagados "de
  // fe" en el cierre que adelantó el día. El snapshot del cierre contiene exactos
  // los empleados pagados (p.ej. excluye mensuales en 1ª quincena). Mapeamos
  // fecha → conjunto de employee_id elegibles. null = sin restricción (registro
  // sin cierre/snapshot, comportamiento heredado seguro).
  const cierreIds = [...new Set(
    regs.map((r) => r.cierre_id).filter((x: unknown): x is number => x != null)
  )];
  const snapByCierre = new Map<number, Set<number>>();
  if (cierreIds.length > 0) {
    const { rows: snaps } = await pool.query(
      `SELECT id, snapshot FROM pre_planilla_cierres WHERE id = ANY($1::int[])`,
      [cierreIds]
    );
    for (const s of snaps) {
      const ids = new Set<number>();
      try {
        const arr = Array.isArray(s.snapshot) ? s.snapshot : JSON.parse(s.snapshot ?? "[]");
        for (const row of arr) ids.add(Number(row.employee_id));
      } catch { /* snapshot ilegible → se trata como sin restricción abajo */ }
      if (ids.size > 0) snapByCierre.set(Number(s.id), ids);
    }
  }
  const fechaElegibles = new Map<string, Set<number> | null>();
  for (const r of regs) {
    const elig = r.cierre_id != null ? snapByCierre.get(Number(r.cierre_id)) ?? null : null;
    const prev = fechaElegibles.get(r.fecha);
    if (prev === null) continue; // ya es sin restricción
    if (!elig) { fechaElegibles.set(r.fecha, null); continue; }
    fechaElegibles.set(r.fecha, prev ? new Set([...prev, ...elig]) : new Set(elig));
  }

  const fechas = regs.map((r) => r.fecha);
  const { rows: faltas } = await pool.query(
    `SELECT n.employee_id, e.nombre_completo, n.fecha::text AS fecha,
            COALESCE(n.dias_descuento, 1)::numeric AS dias
       FROM novedades_nomina_diarias n
       JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha = ANY($1::date[])
        AND n.falta = TRUE
        AND COALESCE(n.impacto_nomina, 'pendiente') != 'rechazado_rrhh'`,
    [fechas]
  );
  for (const f of faltas) {
    const id = Number(f.employee_id);
    // Saltar a quien NO fue pagado de fe ese día (no estaba en el snapshot).
    const elegibles = fechaElegibles.get(f.fecha);
    if (elegibles && !elegibles.has(id)) continue;
    const dias = Number(f.dias) || 0;
    let e = porEmpleado.get(id);
    if (!e) {
      e = { employee_id: id, nombre_completo: f.nombre_completo, dias_descuento: 0, detalle: [] };
      porEmpleado.set(id, e);
    }
    e.dias_descuento += dias;
    e.detalle.push({ fecha: f.fecha, dias });
  }
  return {
    porEmpleado,
    registros: regs.map((r) => ({
      id: r.id, fecha: r.fecha, periodo_desde: r.periodo_desde, periodo_hasta: r.periodo_hasta,
    })),
  };
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
    // Clawback por días anticipados de cierres previos ya confirmados en el pizarrón
    const { porEmpleado: ajustesAnt } = await reconciliarAnticipados(desde);
    // Tarifa fija de HE por turno (12h→Q150, 24h→Q300) — misma que la planilla final
    const tarifasHE = await cargarTarifasHE();

    // Anotar colaboradores excluidos por frecuencia de pago
    const annotated = rows.map((row) => {
      const freq = row.frecuencia_pago ?? "quincenal";
      const excluido = quincena === "primera" && freq === "mensual";
      const aj = ajustesAnt.get(Number(row.employee_id));
      const extraDesc = aj ? aj.dias_descuento : 0;
      const { valorHE } = calcularValorHE({
        sueldoBase:        toNum(row.sueldo_base),
        horasContrato:     toNum(row.horas_contrato),
        horasExtra:        toNum(row.horas_extra),
        jornada:           row.jornada,
        turnoHorasTrabajo: toNum(row.turno_horas_trabajo),
        tarifasHE,
      });
      return {
        ...row,
        valor_he: valorHE,
        // El descuento por días anticipados se suma a los días de descuento del
        // período para que el bruto (calculado en el front) ya lo refleje.
        total_dias_descuento: toNum(row.total_dias_descuento) + extraDesc,
        dias_descuento_anticipados: extraDesc,
        ajuste_anticipado_detalle: aj?.detalle ?? [],
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
    const [{ rows: novedades }, { rows: anticipos }, { rows: emps }, { rows: incentivos }, { rows: puestosHistorial }] = await Promise.all([
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

      pool.query(`
        SELECT
          cs.fecha,
          cs.puesto_id,
          po.nombre AS puesto_nombre,
          po.cliente_nombre,
          cs.tipo_cobertura,
          cs.hora_inicio,
          cs.hora_fin,
          cs.horas_calculadas,
          cs.genera_horas_extra,
          cs.cobertura_alcance,
          cs.tipo_novedad
        FROM cobertura_segmentos cs
        LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
        WHERE cs.employee_id = $1
          AND cs.fecha BETWEEN $2 AND $3
        ORDER BY cs.fecha ASC, cs.hora_inicio ASC
      `, [employeeId, desde, hasta]),
    ]);

    const { rows: titularPuestos } = await pool.query(`
      SELECT po.id, po.nombre, po.cliente_nombre, po.jornada, po.turno AS turno_nombre
      FROM puestos_operativos po
      WHERE po.titular_employee_id = $1 AND po.activo = TRUE
      ORDER BY po.nombre
    `, [employeeId]);

    res.json({
      empleado: emps[0] ?? null,
      novedades,
      anticipos,
      incentivos,
      puestosHistorial,
      titularPuestos,
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

    // Días del período que aún NO están cerrados en el pizarrón: se pagarán por
    // adelantado al cerrar y quedarán pendientes de reconciliar la próxima quincena.
    const diasAnticipadosPago = await diasNoCerradosEnPeriodo(desde, hasta);
    // Ajustes (clawback) por días anticipados de cierres previos ya confirmados.
    const { porEmpleado: ajustesAntMap } = await reconciliarAnticipados(desde);
    const ajustesAnticipados = Array.from(ajustesAntMap.values());

    res.json({
      periodo_cerrado: false,
      errores_criticos: erroresCriticos,
      alertas,
      dias_anticipados_pago: diasAnticipadosPago,
      ajustes_anticipados: ajustesAnticipados,
      resumen: {
        total_colaboradores: parseInt(totalRows[0]?.total ?? "0"),
        errores: erroresCriticos.length,
        alertas: alertas.length,
        dias_anticipados: diasAnticipadosPago.length,
        ajustes_anticipados: ajustesAnticipados.length,
        puede_cerrar: erroresCriticos.length === 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/validacion error");
    res.status(500).json({ error: "Error al validar pre-planilla" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FERIADOS TRABAJADOS — módulo dentro de la pre-planilla
// ════════════════════════════════════════════════════════════════════════════
// Permite asignar el pago por feriados/asuetos nacionales (y locales) trabajados,
// por colaborador, mientras la quincena esté ABIERTA. Default Q0, editable. El
// monto suma al bruto como concepto aparte (QUERY_CONSOLIDADO → pago_feriados) y
// se congela en el snapshot del cierre.
//
// Permiso: estas rutas viven bajo /nomina/* → el middleware las protege con el
// módulo "nomina" (el prefijo más largo que matchea es "/nomina"). No requiere
// permiso nuevo: quien ya administra nómina administra los feriados.

// Helper: ¿el período está cerrado? (ignora cierres anulados por reversión)
async function periodoCerrado(desde: string, hasta: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM pre_planilla_cierres WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
    [desde, hasta]
  );
  return rows.length > 0;
}

// ─── GET /api/nomina/pre-planilla/feriados ────────────────────────────────────
// Devuelve los feriados del período + colaboradores que trabajaron algún feriado
// (agrupables por cliente en el frontend) con el monto actual por feriado.
prePlanillaRouter.get("/nomina/pre-planilla/feriados", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string>;
  if (!desde || !hasta) {
    return res.status(400).json({ error: "desde y hasta son requeridos (YYYY-MM-DD)" });
  }
  try {
    // Feriados activos cuya fecha cae dentro del período
    const { rows: feriados } = await pool.query(`
      SELECT id, fecha::text AS fecha, nombre, tipo, cliente_nombre
      FROM nomina_feriados
      WHERE activo = TRUE AND fecha BETWEEN $1::date AND $2::date
      ORDER BY fecha ASC, nombre ASC
    `, [desde, hasta]);

    const fechasFeriado: string[] = feriados.map((f) => f.fecha);

    // Colaboradores que trabajaron al menos un feriado del período, o que ya
    // tienen un pago de feriado registrado para el período (para que no
    // desaparezcan montos asignados aunque cambie el operativo).
    //
    // Scoping por cliente: un feriado nacional (cliente_nombre NULL) aplica a
    // todos; un feriado LOCAL acotado a un cliente solo aparece para los
    // colaboradores de ese cliente (resuelto igual que el consolidado:
    // puesto_titular_historico vigente en el período, con fallback al titular).
    let colaboradores: Record<string, unknown>[] = [];
    if (fechasFeriado.length > 0) {
      const { rows } = await pool.query(`
        WITH emp_cliente AS (
          SELECT
            e.id AS employee_id,
            e.nombre_completo,
            ${clienteEmpleadoSQL("e.id", "$1", "$2")} AS cliente
          FROM employees e
          WHERE (e.fecha_baja IS NULL OR e.fecha_baja >= $1::date)
        ),
        trabajaron AS (
          SELECT DISTINCT n.employee_id, n.fecha::date AS feriado_fecha
          FROM novedades_nomina_diarias n
          WHERE n.trabajo_dia = TRUE
            AND n.fecha = ANY($3::date[])
          UNION
          SELECT fp.employee_id, fp.feriado_fecha
          FROM nomina_feriado_pago fp
          WHERE fp.periodo_desde = $1::date AND fp.periodo_hasta = $2::date
        )
        -- Una fila por (colaborador, FECHA), no por feriado: si dos feriados
        -- caen el mismo día (p. ej. nacional + local del mismo cliente) el pago
        -- se modela por fecha, así que se colapsan con GROUP BY para no duplicar
        -- montos ni totales frente al consolidado/bruto.
        SELECT
          ec.employee_id,
          ec.nombre_completo,
          ec.cliente,
          f.fecha::text AS feriado_fecha,
          COALESCE((
            SELECT fp.monto FROM nomina_feriado_pago fp
            WHERE fp.employee_id = ec.employee_id
              AND fp.periodo_desde = $1::date AND fp.periodo_hasta = $2::date
              AND fp.feriado_fecha = f.fecha
          ), 0) AS monto
        FROM nomina_feriados f
        JOIN trabajaron t ON t.feriado_fecha = f.fecha
        JOIN emp_cliente ec ON ec.employee_id = t.employee_id
        WHERE f.activo = TRUE
          AND f.fecha BETWEEN $1::date AND $2::date
          AND (f.cliente_nombre IS NULL OR f.cliente_nombre = ec.cliente)
        GROUP BY ec.employee_id, ec.nombre_completo, ec.cliente, f.fecha
        ORDER BY ec.cliente NULLS LAST, ec.nombre_completo, f.fecha
      `, [desde, hasta, fechasFeriado]);
      colaboradores = rows;
    }

    res.json({
      periodo_cerrado: await periodoCerrado(desde, hasta),
      feriados,
      colaboradores,
    });
  } catch (err) {
    logger.error({ err }, "GET /nomina/pre-planilla/feriados error");
    res.status(500).json({ error: "Error al obtener feriados del período" });
  }
});

// ─── PUT /api/nomina/pre-planilla/feriados/pago ───────────────────────────────
// Asigna/edita el monto de un colaborador para un feriado del período.
prePlanillaRouter.put("/nomina/pre-planilla/feriados/pago", async (req, res) => {
  const { desde, hasta, employee_id, feriado_fecha, monto, editadoPor } = req.body ?? {};
  const empId = parseInt(String(employee_id));
  const montoNum = Number(monto);
  if (!desde || !hasta || isNaN(empId) || !feriado_fecha || !Number.isFinite(montoNum)) {
    return res.status(400).json({ error: "desde, hasta, employee_id, feriado_fecha y monto son requeridos" });
  }
  if (montoNum < 0) {
    return res.status(400).json({ error: "El monto no puede ser negativo" });
  }
  try {
    if (await periodoCerrado(desde, hasta)) {
      return res.status(409).json({ error: "El período está cerrado. No se pueden editar feriados." });
    }
    // El feriado debe estar activo, en el período y aplicar a ESTE empleado:
    // nacional (cliente NULL) o local cuyo cliente coincide con el del puesto
    // titular vigente del colaborador. Evita pagos invisibles por feriados de
    // otro cliente.
    const { rows: feriadoOk } = await pool.query(`
      SELECT 1 FROM nomina_feriados nf
      WHERE nf.activo = TRUE AND nf.fecha = $1::date
        AND nf.fecha BETWEEN $2::date AND $3::date
        AND (
          nf.cliente_nombre IS NULL
          OR nf.cliente_nombre = ${clienteEmpleadoSQL("$4", "$2", "$3")}
        )
      LIMIT 1
    `, [feriado_fecha, desde, hasta, empId]);
    if (feriadoOk.length === 0) {
      return res.status(400).json({ error: "Ese feriado no aplica a este colaborador en el período." });
    }
    await pool.query(`
      INSERT INTO nomina_feriado_pago
        (employee_id, periodo_desde, periodo_hasta, feriado_fecha, monto, editado_por, updated_at)
      VALUES ($1, $2::date, $3::date, $4::date, $5, $6, NOW())
      ON CONFLICT (employee_id, periodo_desde, periodo_hasta, feriado_fecha)
      DO UPDATE SET monto = EXCLUDED.monto, editado_por = EXCLUDED.editado_por, updated_at = NOW()
    `, [empId, desde, hasta, feriado_fecha, montoNum.toFixed(2), editadoPor ?? null]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /nomina/pre-planilla/feriados/pago error");
    res.status(500).json({ error: "Error al guardar el pago del feriado" });
  }
});

// ─── PUT /api/nomina/pre-planilla/feriados/pago-bulk ──────────────────────────
// Aplica un monto a TODOS los colaboradores de un cliente que trabajaron un
// feriado del período (atajo: "este cliente paga Q X por este feriado").
prePlanillaRouter.put("/nomina/pre-planilla/feriados/pago-bulk", async (req, res) => {
  const { desde, hasta, cliente, feriado_fecha, monto, editadoPor } = req.body ?? {};
  const montoNum = Number(monto);
  if (!desde || !hasta || !feriado_fecha || !Number.isFinite(montoNum)) {
    return res.status(400).json({ error: "desde, hasta, feriado_fecha y monto son requeridos" });
  }
  if (montoNum < 0) {
    return res.status(400).json({ error: "El monto no puede ser negativo" });
  }
  try {
    if (await periodoCerrado(desde, hasta)) {
      return res.status(409).json({ error: "El período está cerrado. No se pueden editar feriados." });
    }
    // El feriado debe existir, estar activo, caer en el período y aplicar a ese
    // cliente (nacional = aplica a todos; local = debe coincidir el cliente).
    const { rows: feriadoOk } = await pool.query(`
      SELECT 1 FROM nomina_feriados
      WHERE activo = TRUE AND fecha = $1::date
        AND fecha BETWEEN $2::date AND $3::date
        AND (cliente_nombre IS NULL OR cliente_nombre = $4::text)
      LIMIT 1
    `, [feriado_fecha, desde, hasta, cliente ?? null]);
    if (feriadoOk.length === 0) {
      return res.status(400).json({ error: "Ese feriado no aplica al cliente/período indicado." });
    }
    // Empleados que trabajaron ese feriado, filtrados por cliente (NULL = todos).
    // El cliente se resuelve igual que el consolidado (histórico + fallback).
    const { rows: empleados } = await pool.query(`
      SELECT DISTINCT n.employee_id
      FROM novedades_nomina_diarias n
      JOIN employees e ON e.id = n.employee_id
      WHERE n.trabajo_dia = TRUE
        AND n.fecha = $3::date
        AND (e.fecha_baja IS NULL OR e.fecha_baja >= $1::date)
        AND (
          $4::text IS NULL
          OR ${clienteEmpleadoSQL("e.id", "$1", "$2")} = $4::text
        )
    `, [desde, hasta, feriado_fecha, cliente ?? null]);

    let aplicados = 0;
    for (const row of empleados) {
      await pool.query(`
        INSERT INTO nomina_feriado_pago
          (employee_id, periodo_desde, periodo_hasta, feriado_fecha, monto, editado_por, updated_at)
        VALUES ($1, $2::date, $3::date, $4::date, $5, $6, NOW())
        ON CONFLICT (employee_id, periodo_desde, periodo_hasta, feriado_fecha)
        DO UPDATE SET monto = EXCLUDED.monto, editado_por = EXCLUDED.editado_por, updated_at = NOW()
      `, [row.employee_id, desde, hasta, feriado_fecha, montoNum.toFixed(2), editadoPor ?? null]);
      aplicados++;
    }
    res.json({ ok: true, aplicados });
  } catch (err) {
    logger.error({ err }, "PUT /nomina/pre-planilla/feriados/pago-bulk error");
    res.status(500).json({ error: "Error al aplicar el pago por cliente" });
  }
});

// ─── POST /api/nomina/pre-planilla/feriados ───────────────────────────────────
// Agrega un feriado local (Semana Santa, feria del municipio, etc.).
prePlanillaRouter.post("/nomina/pre-planilla/feriados", async (req, res) => {
  const { fecha, nombre, cliente_nombre, clientes, createdPor, desde, hasta } = req.body ?? {};
  if (!fecha || !nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: "fecha y nombre son requeridos" });
  }
  if (!desde || !hasta) {
    return res.status(400).json({ error: "desde y hasta son requeridos (período de la quincena)" });
  }
  // Lista de clientes a los que aplica el feriado local. Se acepta un arreglo
  // `clientes` (selección múltiple) o el campo legacy `cliente_nombre`. Si tras
  // limpiar queda vacío, el feriado es nacional (cliente_nombre NULL → todos).
  const limpios = Array.isArray(clientes)
    ? Array.from(new Set(clientes.map((c: unknown) => String(c ?? "").trim()).filter(Boolean)))
    : [];
  const legacy = cliente_nombre && String(cliente_nombre).trim() ? String(cliente_nombre).trim() : null;
  const lista: (string | null)[] = limpios.length > 0 ? limpios : [legacy];
  const client = await pool.connect();
  try {
    if (await periodoCerrado(desde, hasta)) {
      return res.status(409).json({ error: "El período está cerrado. No se pueden agregar feriados." });
    }
    await client.query("BEGIN");
    const creados = [];
    for (const cn of lista) {
      const { rows } = await client.query(`
        INSERT INTO nomina_feriados (fecha, nombre, tipo, cliente_nombre, created_por)
        VALUES ($1::date, $2, 'local', $3, $4)
        ON CONFLICT (fecha, nombre, COALESCE(cliente_nombre, ''))
        DO UPDATE SET activo = TRUE
        RETURNING id, fecha::text AS fecha, nombre, tipo, cliente_nombre
      `, [fecha, String(nombre).trim(), cn, createdPor ?? null]);
      creados.push(rows[0]);
    }
    await client.query("COMMIT");
    res.status(201).json(creados.length === 1 ? creados[0] : creados);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => { /* conexión ya rota */ });
    logger.error({ err }, "POST /nomina/pre-planilla/feriados error");
    res.status(500).json({ error: "Error al agregar el feriado" });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/nomina/pre-planilla/feriados/:id ─────────────────────────────
// Desactiva un feriado (soft delete). El re-seed no lo reactiva (ON CONFLICT
// DO NOTHING), así que también sirve para ocultar un feriado nacional que no
// aplique. No borra los pagos ya asignados a colaboradores.
prePlanillaRouter.delete("/nomina/pre-planilla/feriados/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { desde, hasta } = req.query as Record<string, string>;
  if (isNaN(id)) {
    return res.status(400).json({ error: "id inválido" });
  }
  if (!desde || !hasta) {
    return res.status(400).json({ error: "desde y hasta son requeridos (período de la quincena)" });
  }
  try {
    if (await periodoCerrado(desde, hasta)) {
      return res.status(409).json({ error: "El período está cerrado. No se pueden quitar feriados." });
    }
    const { rowCount } = await pool.query(
      `UPDATE nomina_feriados SET activo = FALSE WHERE id = $1`,
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: "Feriado no encontrado" });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /nomina/pre-planilla/feriados/:id error");
    res.status(500).json({ error: "Error al desactivar el feriado" });
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

    // Clawback por días anticipados de cierres previos ya confirmados: se suma a
    // los días de descuento de cada empleado ANTES de calcular el bruto, y se
    // congela en el snapshot para que la planilla refleje exactamente lo pagado.
    const { porEmpleado: ajustesAnt, registros: regsAnt } = await reconciliarAnticipados(desde);
    const snapshotRowsAdj = snapshotRows.map((r) => {
      const aj = ajustesAnt.get(Number(r.employee_id));
      const extra = aj ? aj.dias_descuento : 0;
      return {
        ...r,
        total_dias_descuento: toNum(r.total_dias_descuento) + extra,
        dias_descuento_anticipados: extra,
        ajuste_anticipado_detalle: aj?.detalle ?? [],
      };
    });

    // Período en días del rango
    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    const periodoDias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;

    // Calcular total estimado usando calcularBruto() de nomina-calc.ts
    // (misma función que usa la planilla final → total_estimado == total_bruto)
    let totalEstimado = 0;
    const tarifasHECierre = await cargarTarifasHE();
    for (const row of snapshotRowsAdj) {
      const anticipo = toNum(row.anticipos_monto);
      const amonestaciones = toNum(row.amonestaciones_monto);
      const heCalc = calcularValorHE({
        sueldoBase:        toNum(row.sueldo_base),
        horasContrato:     toNum(row.horas_contrato),
        horasExtra:        toNum(row.horas_extra),
        jornada:           row.jornada,
        turnoHorasTrabajo: toNum(row.turno_horas_trabajo),
        tarifasHE:         tarifasHECierre,
      });
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
        tarifaFijaTurnoHE: heCalc.tarifaFijaTurnoHE,
        turnosHE:         heCalc.turnosHE,
        pagoFeriados:     toNum(row.pago_feriados),
      });
      // Redondear por línea antes de acumular (igual que planilla.ts) → convergencia exacta
      totalEstimado += parseFloat(Math.max(0, totalBruto - anticipo - amonestaciones).toFixed(2));
    }

    // Guardar cierre + días anticipados + reconciliación en UNA transacción
    // ACID. Si algo falla a mitad, se revierte todo (evita estado parcial que
    // duplicaría clawbacks en quincenas siguientes).
    const diasAnticipados = await diasNoCerradosEnPeriodo(desde, hasta);
    let cierreRows: any[];
    const tx = await pool.connect();
    try {
      await tx.query("BEGIN");

      const ins = await tx.query(`
        INSERT INTO pre_planilla_cierres (periodo_desde, periodo_hasta, cerrado_por, observaciones, snapshot, total_colaboradores, total_estimado)
        VALUES ($1::date, $2::date, $3, $4, $5::jsonb, $6, $7)
        RETURNING id, periodo_desde, periodo_hasta, cerrado_por, cerrado_at, total_colaboradores, total_estimado
      `, [desde, hasta, cerradoPor, observaciones ?? null, JSON.stringify(snapshotRowsAdj), snapshotRowsAdj.length, totalEstimado.toFixed(2)]);
      cierreRows = ins.rows;
      const cierreId: number = cierreRows[0].id;

      // ── Días anticipados (pago por adelantado) ─────────────────────────────
      // 1) Registrar los días de ESTE período que aún no están cerrados en el
      //    pizarrón: se pagan de fe y quedan pendientes de reconciliar.
      for (const fecha of diasAnticipados) {
        await tx.query(
          `INSERT INTO pre_planilla_dias_anticipados (cierre_id, periodo_desde, periodo_hasta, fecha, estado)
           VALUES ($1, $2::date, $3::date, $4::date, 'pendiente')
           ON CONFLICT (periodo_desde, periodo_hasta, fecha)
           DO UPDATE SET cierre_id = EXCLUDED.cierre_id`,
          [cierreId, desde, hasta, fecha]
        );
      }

      // 2) Marcar como reconciliados los registros anticipados de cierres previos
      //    cuyo descuento (clawback) ya quedó aplicado en este cierre.
      if (regsAnt.length > 0) {
        const perFecha = new Map<string, { dias: number; empleados: Set<number> }>();
        for (const aj of ajustesAnt.values()) {
          for (const d of aj.detalle) {
            let pf = perFecha.get(d.fecha);
            if (!pf) { pf = { dias: 0, empleados: new Set() }; perFecha.set(d.fecha, pf); }
            pf.dias += d.dias;
            pf.empleados.add(aj.employee_id);
          }
        }
        for (const reg of regsAnt) {
          const pf = perFecha.get(reg.fecha);
          await tx.query(
            `UPDATE pre_planilla_dias_anticipados
                SET estado = 'reconciliado',
                    reconciliado_periodo_desde = $2::date,
                    reconciliado_periodo_hasta = $3::date,
                    reconciliado_cierre_id = $4,
                    reconciliado_at = NOW(),
                    dias_descuento_aplicados = $5,
                    empleados_afectados = $6
              WHERE id = $1`,
            [reg.id, desde, hasta, cierreId, pf?.dias ?? 0, pf?.empleados.size ?? 0]
          );
        }
      }

      // Marcar revisiones como cerradas
      await tx.query(`
        UPDATE pre_planilla_revision SET periodo_cerrado = TRUE
        WHERE periodo_desde = $1::date AND periodo_hasta = $2::date
      `, [desde, hasta]);

      // Registrar en auditoría
      await tx.query(`
        INSERT INTO pre_planilla_auditoria (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
        VALUES ($1::date, $2::date, NULL, 'cierre', $3, $4, $5)
      `, [desde, hasta, cerradoPor, observaciones ?? null, JSON.stringify({ total_colaboradores: snapshotRows.length, total_estimado: totalEstimado.toFixed(2), forzar: !!forzar })]);

      await tx.query("COMMIT");
    } catch (txErr) {
      await tx.query("ROLLBACK");
      throw txErr;
    } finally {
      tx.release();
    }

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
      dias_anticipados_registrados: diasAnticipados.length,
      ajustes_anticipados_aplicados: regsAnt.length,
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
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    const { rowCount } = await tx.query(
      `UPDATE pre_planilla_cierres SET anulado = TRUE, anulado_por = $3, anulado_at = NOW()
       WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
      [desde, hasta, usuario ?? "admin"]
    );
    if (!rowCount) {
      await tx.query("ROLLBACK");
      return res.status(404).json({ error: "No hay cierre activo para este período" });
    }
    await tx.query(
      `UPDATE pre_planilla_revision SET periodo_cerrado = FALSE
       WHERE periodo_desde = $1::date AND periodo_hasta = $2::date`, [desde, hasta]
    );

    // Revertir el efecto del cierre sobre los días anticipados:
    const { rows: cierresPeriodo } = await tx.query(
      `SELECT id FROM pre_planilla_cierres WHERE periodo_desde = $1::date AND periodo_hasta = $2::date`,
      [desde, hasta]
    );
    const cierreIds = cierresPeriodo.map((r) => r.id);
    if (cierreIds.length > 0) {
      // 1) Borrar los registros anticipados creados por este período (se vuelven
      //    a registrar al re-cerrar).
      await tx.query(
        `DELETE FROM pre_planilla_dias_anticipados WHERE cierre_id = ANY($1::int[])`,
        [cierreIds]
      );
      // 2) Devolver a 'pendiente' los registros que este período reconcilió, para
      //    que el clawback se vuelva a aplicar en el próximo cierre.
      await tx.query(
        `UPDATE pre_planilla_dias_anticipados
            SET estado = 'pendiente',
                reconciliado_periodo_desde = NULL,
                reconciliado_periodo_hasta = NULL,
                reconciliado_cierre_id = NULL,
                reconciliado_at = NULL,
                dias_descuento_aplicados = 0,
                empleados_afectados = 0
          WHERE reconciliado_cierre_id = ANY($1::int[])`,
        [cierreIds]
      );
    }

    await tx.query("COMMIT");
    res.json({ ok: true, mensaje: "Período reabierto correctamente." });
  } catch (err) {
    await tx.query("ROLLBACK");
    logger.error({ err }, "POST /nomina/pre-planilla/reabrir error");
    res.status(500).json({ error: "Error al reabrir período" });
  } finally {
    tx.release();
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
    // Clawback por días anticipados de cierres previos ya confirmados.
    const { porEmpleado: ajustesAnt } = await reconciliarAnticipados(desde);

    const BOM = "\uFEFF";
    const headers = [
      "ID", "Nombre Completo", "DPI",
      "Puesto", "Área", "Sede", "Cliente Principal",
      "Sueldo Base (Q)", "Tipo Jornada", "Día Descanso", "Hrs/Semana",
      "Estado Laboral", "Días Cerrados", "Días Trabajados", "Faltas",
      "Descuento Días Ant.", "Días Descuento", "Suspensiones",
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
      ...rows.map((r) => {
        const aj = ajustesAnt.get(Number(r.employee_id));
        const extraDesc = aj ? aj.dias_descuento : 0;
        return [
          r.employee_id, r.nombre_completo, r.dpi ?? "",
          r.puesto_empleado ?? "", r.area ?? "", r.sede ?? "", r.cliente_principal ?? "",
          r.sueldo_base ?? "", r.tipo_jornada ?? "", r.dia_descanso ?? "", r.horas_contrato ?? "",
          r.estado_laboral,
          r.dias_cerrados, r.dias_trabajados, r.faltas,
          extraDesc, toNum(r.total_dias_descuento) + extraDesc, r.suspensiones, r.descansos_trabajados,
          parseFloat(r.horas_trabajadas || 0).toFixed(2),
          parseFloat(r.horas_extra || 0).toFixed(2),
          r.relevos,
          r.anticipos_monto, r.anticipos_count,
          r.revision_estado, r.revision_observaciones ?? "",
        ].map(esc).join(",");
      }),
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
