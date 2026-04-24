/**
 * planilla.ts — Planilla Final de Nómina
 *
 * ─── FLUJO COMPLETO ─────────────────────────────────────────────────────────
 *   Operación diaria → Novedades → Pre-Planilla → [CIERRE] → Planilla Final
 *
 * ─── CONTROL DE DOBLE DESCUENTO ─────────────────────────────────────────────
 *   Al generar la planilla, todos los anticipos del empleado con estado
 *   'pendiente' o 'aprobada' y planilla_id IS NULL se vinculan:
 *     • anticipos.planilla_id = planilla.id
 *     • anticipos.estado = 'descontado'
 *   Si un anticipo ya está vinculado, el PATCH lo rechaza con 409.
 *   Esto garantiza que ningún anticipo se descuente dos veces.
 *
 * ─── CORRECCIÓN DE PLANILLA ──────────────────────────────────────────────────
 *   DELETE /api/nomina/planilla/:id (solo si estado != 'pagada'):
 *     1. Desvincula anticipos (planilla_id = NULL, estado = 'aprobada')
 *     2. Marca el cierre como anulado (pre_planilla_cierres.anulado = TRUE)
 *     3. Reabre las revisiones (pre_planilla_revision.periodo_cerrado = FALSE)
 *     4. Elimina la planilla (CASCADE borra planilla_lineas)
 *   Luego RRHH puede corregir en pre-planilla, re-cerrar y regenerar.
 *
 * ─── TRAZABILIDAD ────────────────────────────────────────────────────────────
 *   planilla_lineas.anticipo_ids  → JSONB: IDs de anticipos vinculados a este empleado
 *   planilla_lineas.novedad_ids   → JSONB: IDs de novedades que originaron datos (reservado)
 *   planilla_lineas.segmento_ids  → JSONB: IDs de segmentos de cobertura (reservado)
 *
 * ─── PREPARACIÓN PARA DEDUCCIONES FUTURAS ────────────────────────────────────
 *   planilla_lineas contiene (en 0 por ahora, sin cálculo):
 *     • igss_trabajador   → 4.83% del total bruto (Guatemala)
 *     • igss_patronal     → 12.67% del total bruto
 *     • otros_descuentos  → campo libre
 *
 * ─── DEDUCCIONES IMPLEMENTADAS ───────────────────────────────────────────────
 *   ✅ IGSS trabajador 4.83% (aplica según elegibilidad en employees/puestos_operativos)
 *   ✅ IGSS patronal 12.67% (costo empresa, almacenado en planilla_lineas.igss_patronal)
 *   ✅ Séptimo día (RRHH-driven via eventos_rrhh.afecta_septimo_res)
 *   ❌ Bonificación incentivo no incluida aún
 *
 * ENDPOINTS:
 *   GET    /api/nomina/planillas            → Lista todas las planillas activas
 *   POST   /api/nomina/planilla             → Genera planilla desde snapshot cerrado
 *   GET    /api/nomina/planilla/:id         → Detalle de planilla + líneas
 *   PATCH  /api/nomina/planilla/:id/estado  → Avanza estado (borrador→revisada→aprobada→pagada)
 *   DELETE /api/nomina/planilla/:id         → Revierte planilla (no pagada)
 *   GET    /api/nomina/planilla/:id/export  → Exporta CSV con BOM
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { calcularBruto, calcularBonificacionIncentivo, calcularISRQuincenal, toNum, toInt } from "../lib/nomina-calc";
import { buildUniformeCuotaMap, descontarCuotaUniforme } from "./uniformes";
import { buildBarracaCuotaMap } from "./barracas";

export const planillaRouter = Router();

// ─── Detecta si un período es primera o segunda quincena ─────────────────────
function detectarQuincena(hasta: string): "primera" | "segunda" {
  const d = new Date(hasta);
  return d.getUTCDate() <= 15 ? "primera" : "segunda";
}

// ─── Cálculo por colaborador ─────────────────────────────────────────────────
// Usa calcularBruto() de nomina-calc.ts (fuente única de verdad compartida con
// pre-planilla) para garantizar que total_estimado == total_bruto.
// Usa calcularBonificacionIncentivo() para la bonificación proporcional.
function calcularLinea(
  row: Record<string, unknown>,
  periodoTotalDias: number,
  igssData: { aplica_igss: boolean; motivo_exclusion_igss: string | null },
  quincenaTipo: "primera" | "segunda",
  desde: string,
  hasta: string,
  uniformeMonto: number = 0,
  tarifasHE?: Map<string, { tarifa: number; horas_turno: number }>,
  barracaMonto: number = 0,
  seguroMontoPeriodo: number = 0,
  amonestacionesMonto: number = 0,
) {
  const sb        = toNum(row.sueldo_base);
  const hc        = toNum(row.horas_contrato);
  const faltas    = toInt(row.faltas);
  const susp      = toInt(row.suspensiones);
  const he        = toNum(row.horas_extra);
  const anticipo  = toNum(row.anticipos_monto);
  const frecuencia = String(row.frecuencia_pago ?? "quincenal");
  // septimosPerdidos: determinado por RRHH (eventos_rrhh.afecta_septimo_res = TRUE)
  // viene del snapshot del cierre, que a su vez viene de QUERY_CONSOLIDADO
  const septimos  = toInt(row.septimos_perdidos);

  const jornada = String(row.jornada ?? (row.turno_horas_trabajo ? `${row.turno_horas_trabajo}h` : "12h"));
  const tarifaConf = tarifasHE?.get(jornada) ?? tarifasHE?.get("12h");
  const turnosHECount = tarifaConf && he > 0 ? he / (tarifaConf.horas_turno || 12) : undefined;

  const bruto = calcularBruto({
    sueldoBase:       sb,
    horasContrato:    hc,
    faltas,
    suspensiones:     susp,
    horasExtra:       he,
    periodoTotalDias,
    frecuenciaPago:   frecuencia,
    quincenaTipo,
    septimosPerdidos: septimos,
    tarifaFijaTurnoHE: tarifaConf?.tarifa ?? null,
    turnosHE:         turnosHECount ?? null,
  });

  // IGSS Guatemala (Acuerdo 1118 IGSS):
  //   Trabajador: 4.83% del bruto (retención del colaborador)
  //   Patronal:   12.67% del bruto (costo empresa, no es descuento al colaborador)
  // Solo aplica si el colaborador está activo en IGSS y su puesto está en régimen IGSS.
  const totalBrutoRnd = parseFloat(bruto.totalBruto.toFixed(2));
  const igssT = igssData.aplica_igss ? parseFloat((totalBrutoRnd * 0.0483).toFixed(2)) : 0;
  const igssP = igssData.aplica_igss ? parseFloat((totalBrutoRnd * 0.1267).toFixed(2)) : 0;

  // Bonificación incentivo Decreto 78-89 Art. 7 (Guatemala) — PROPORCIONAL.
  // Base: Q125/quincena (quincenal) | Q250/mes (mensual).
  // Proporcional a los días con derecho: trabajados + vacaciones + permiso_con_goce + incapacidad.
  // NO incluye permiso_sin_goce, ausencias injustificadas ni suspensiones.
  // Cálculo centralizado en calcularBonificacionIncentivo() de nomina-calc.ts.
  const bonificacion_incentivo = calcularBonificacionIncentivo({
    frecuenciaPago:         frecuencia,
    desde,
    hasta,
    diasTrabajados:         toInt(row.dias_trabajados),
    diasVacaciones:         toInt(row.dias_vacaciones),
    diasPermisoConGoce:     toInt(row.dias_permiso_con_goce),
    diasIncapacidadConGoce: toInt(row.dias_incapacidad),
  });

  const bonProporcional = (base: number) => {
    if (base <= 0) return 0;
    const d1 = new Date(desde + "T00:00:00Z");
    const d2 = new Date(hasta + "T00:00:00Z");
    const diasPeriodo = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    if (diasPeriodo <= 0) return 0;
    // Misma regla que calcularBonificacionIncentivo: solo días trabajados + permiso con goce.
    // (Vacaciones e incapacidad NO devengan bonificaciones — decisión empresa abr 2026)
    const diasPagables = Math.max(0, Math.min(diasPeriodo, toInt(row.dias_trabajados) + toInt(row.dias_permiso_con_goce)));
    const mensual = base;
    const diario = mensual / 30;
    return parseFloat((diario * diasPagables).toFixed(2));
  };

  const bonificacion_1 = bonProporcional(toNum(row.bon_1_base));
  const bonificacion_2 = bonProporcional(toNum(row.bon_2_base));
  const bonificacion_3 = bonProporcional(toNum(row.bon_3_base));

  const isr = calcularISRQuincenal(sb, igssData.aplica_igss);

  const uniforme = parseFloat(uniformeMonto.toFixed(2));
  const barraca = parseFloat(barracaMonto.toFixed(2));
  const seguro = parseFloat(seguroMontoPeriodo.toFixed(2));
  // Amonestaciones económicas: monto agregado de las activas pendientes del período.
  // Este monto se cobra al colaborador (rebaja el neto) y se vincula a la planilla
  // en el endpoint POST /nomina/planilla (UPDATE amonestaciones SET descontado=TRUE).
  const otrosDescuentos = parseFloat(Math.max(0, amonestacionesMonto).toFixed(2));
  const totalBonificaciones = bonificacion_incentivo + bonificacion_1 + bonificacion_2 + bonificacion_3;
  const totalNeto = parseFloat(Math.max(0, totalBrutoRnd - igssT - isr + totalBonificaciones - anticipo - uniforme - barraca - seguro - otrosDescuentos).toFixed(2));

  return {
    sueldo_base:      sb,
    horas_contrato:   hc,
    frecuencia_pago:  frecuencia,
    periodo_dias:     periodoTotalDias,
    dias_trabajados:  toInt(row.dias_trabajados),
    faltas,
    suspensiones:     susp,
    horas_trabajadas: toNum(row.horas_trabajadas),
    horas_extra:      he,
    septimos_perdidos: septimos,
    sueldo_periodo:   parseFloat(bruto.sueldoPeriodo.toFixed(2)),
    desc_faltas:      parseFloat(bruto.descFaltas.toFixed(2)),
    desc_septimo:     parseFloat(bruto.descSeptimo.toFixed(2)),
    valor_he:         parseFloat(bruto.valorHE.toFixed(2)),
    total_bruto:      totalBrutoRnd,
    anticipos:        parseFloat(anticipo.toFixed(2)),
    igss_trabajador:  igssT,
    igss_patronal:    igssP,
    isr,
    bonificacion_incentivo,
    bonificacion_1,
    bonificacion_2,
    bonificacion_3,
    total_neto:       totalNeto,
    aplica_igss:           igssData.aplica_igss,
    motivo_exclusion_igss: igssData.motivo_exclusion_igss,
    otros_descuentos:      otrosDescuentos,
    descuentos_uniforme:   uniforme,
    descuento_barraca:     barraca,
    descuento_seguro_vida: seguro,
  };
}

// ─── Clasificación IGSS por empleado ─────────────────────────────────────────
// Consulta la situación actual del colaborador y su puesto titular para
// determinar si aplica IGSS en esta planilla y por qué motivo no aplica.

async function clasificarIgss(employeeId: number | null): Promise<{
  aplica_igss: boolean;
  motivo_exclusion_igss: string | null;
}> {
  if (!employeeId) {
    return { aplica_igss: false, motivo_exclusion_igss: "Sin ID de empleado vinculado" };
  }
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(e.aplica_igss_general, FALSE)  AS aplica_igss_general,
        COALESCE(e.estado_igss, 'no_activo')    AS estado_igss,
        COALESCE(po.aplica_igss, FALSE)         AS puesto_aplica_igss,
        COALESCE(po.regimen_igss, 'no_aplica')  AS puesto_regimen_igss
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT po2.aplica_igss, po2.regimen_igss
        FROM puestos_operativos po2
        WHERE po2.titular_employee_id = e.id AND po2.activo = TRUE
        ORDER BY po2.updated_at DESC NULLS LAST
        LIMIT 1
      ) po ON TRUE
      WHERE e.id = $1
    `, [employeeId]);

    if (!rows.length) {
      return { aplica_igss: false, motivo_exclusion_igss: "Empleado no encontrado" };
    }
    const r = rows[0];

    if (!r.aplica_igss_general) {
      return { aplica_igss: false, motivo_exclusion_igss: "Colaborador sin IGSS activado" };
    }
    if (r.estado_igss === "pendiente_regularizacion") {
      return { aplica_igss: false, motivo_exclusion_igss: "Colaborador en proceso de regularización IGSS" };
    }
    if (r.estado_igss !== "activo") {
      return { aplica_igss: false, motivo_exclusion_igss: "Estado IGSS del colaborador: no activo" };
    }
    if (!r.puesto_aplica_igss) {
      return { aplica_igss: false, motivo_exclusion_igss: "Servicio/puesto no incluye IGSS (tarifa)" };
    }
    return { aplica_igss: true, motivo_exclusion_igss: null };
  } catch {
    return { aplica_igss: false, motivo_exclusion_igss: "Error al verificar elegibilidad IGSS" };
  }
}

// ─── GET /api/nomina/planillas ────────────────────────────────────────────────

planillaRouter.get("/nomina/planillas", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, ppc.cerrado_por, ppc.cerrado_at, ppc.anulado AS cierre_anulado
      FROM planillas p
      JOIN pre_planilla_cierres ppc ON ppc.id = p.cierre_id
      WHERE p.anulada = FALSE
      ORDER BY p.fecha_generacion DESC
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/planillas error");
    res.status(500).json({ error: "Error al obtener planillas" });
  }
});

// ─── POST /api/nomina/planilla ────────────────────────────────────────────────

planillaRouter.post("/nomina/planilla", async (req, res) => {
  const { desde, hasta, generadoPor, observaciones } = req.body ?? {};

  if (!desde || !hasta || !generadoPor) {
    return res.status(400).json({ error: "desde, hasta y generadoPor son requeridos" });
  }

  try {
    // Verificar que el período esté cerrado y no anulado
    const { rows: cierres } = await pool.query(
      `SELECT * FROM pre_planilla_cierres
       WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
      [desde, hasta]
    );
    if (!cierres.length) {
      return res.status(422).json({
        error: "El período no está cerrado. Debes cerrar la pre-planilla primero.",
      });
    }
    const cierre = cierres[0];

    // Verificar que no exista ya una planilla activa para este período
    const { rows: existing } = await pool.query(
      `SELECT id FROM planillas WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulada = FALSE`,
      [desde, hasta]
    );
    if (existing.length) {
      return res.status(409).json({
        error: "Ya existe una planilla para este período.",
        planilla_id: existing[0].id,
      });
    }

    // Calcular días del período y detectar quincena
    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    const periodoTotalDias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    const quincenaTipo = detectarQuincena(hasta);

    // Leer snapshot del cierre (ya filtrado por quincena desde el cierre)
    const snapshot: Record<string, unknown>[] = cierre.snapshot ?? [];
    if (!snapshot.length) {
      return res.status(422).json({ error: "El snapshot del cierre está vacío." });
    }

    // Clasificar IGSS para cada colaborador (consulta actual de DB, independiente del snapshot)
    const igssMap = new Map<number, { aplica_igss: boolean; motivo_exclusion_igss: string | null }>();
    const empIds = [...new Set(
      snapshot
        .map((r) => r.employee_id as number | null)
        .filter((id): id is number => id != null)
    )];
    if (empIds.length > 0) {
      const { rows: igssRows } = await pool.query(`
        SELECT
          e.id                                        AS employee_id,
          COALESCE(e.aplica_igss_general, FALSE)      AS aplica_igss_general,
          COALESCE(e.estado_igss, 'no_activo')        AS estado_igss,
          COALESCE(po.aplica_igss, FALSE)             AS puesto_aplica_igss
        FROM employees e
        LEFT JOIN LATERAL (
          SELECT po2.aplica_igss
          FROM puestos_operativos po2
          WHERE po2.titular_employee_id = e.id AND po2.activo = TRUE
          ORDER BY po2.updated_at DESC NULLS LAST
          LIMIT 1
        ) po ON TRUE
        WHERE e.id = ANY($1::int[])
      `, [empIds]);

      for (const r of igssRows) {
        let aplica = false;
        let motivo: string | null = null;
        if (!r.aplica_igss_general) {
          motivo = "Colaborador sin IGSS activado";
        } else if (r.estado_igss === "pendiente_regularizacion") {
          motivo = "Colaborador en proceso de regularización IGSS";
        } else if (r.estado_igss !== "activo") {
          motivo = "Estado IGSS del colaborador: no activo";
        } else if (!r.puesto_aplica_igss) {
          motivo = "Servicio/puesto no incluye IGSS (tarifa)";
        } else {
          aplica = true;
        }
        igssMap.set(r.employee_id as number, { aplica_igss: aplica, motivo_exclusion_igss: motivo });
      }
    }

    // Construir mapa de cuotas de uniforme pendientes por empleado
    const unifMap = await buildUniformeCuotaMap(empIds);

    // Construir mapa de cuotas de barraca por empleado
    const barracaMap = await buildBarracaCuotaMap(empIds);

    // ── Mapa de amonestaciones económicas a cobrar (AMON-01) ──────────────────
    // Agrega el monto de las amonestaciones activas/pendientes del período por
    // empleado, usando exactamente los mismos criterios del UPDATE que las
    // marca como descontadas (más abajo). Esto garantiza que lo que se cobra
    // == lo que se vincula como descontado en BD.
    const amonestacionesMap = new Map<number, number>();
    if (empIds.length > 0) {
      const { rows: amonRows } = await pool.query(
        `SELECT employee_id, SUM(monto)::float AS monto
           FROM amonestaciones
          WHERE tipo = 'economica'
            AND estado = 'activa'
            AND descontado = FALSE
            AND fecha BETWEEN $1::date AND $2::date
            AND employee_id = ANY($3::int[])
          GROUP BY employee_id`,
        [desde, hasta, empIds]
      );
      for (const r of amonRows) {
        amonestacionesMap.set(r.employee_id as number, parseFloat(r.monto ?? 0));
      }
    }

    // Cargar prima mensual de seguro de vida vigente al fin del período (SEG-02)
    let primaSeguroMensual = 0;
    try {
      const { rows: segRows } = await pool.query(
        `SELECT prima_mensual::float AS prima FROM seguros_config
         WHERE vigente_desde <= $1::date
         ORDER BY vigente_desde DESC, id DESC LIMIT 1`,
        [hasta]
      );
      primaSeguroMensual = segRows[0]?.prima ?? 0;
    } catch { /* tabla aún no existe — sin descuento */ }

    // Cargar tarifas de HE configurables
    const tarifasHE = new Map<string, { tarifa: number; horas_turno: number }>();
    try {
      const { rows: tarifaRows } = await pool.query(`SELECT jornada, tarifa, horas_turno FROM config_tarifa_he`);
      for (const tr of tarifaRows) {
        tarifasHE.set(String(tr.jornada), { tarifa: parseFloat(tr.tarifa), horas_turno: parseInt(tr.horas_turno) });
      }
    } catch { /* tabla aún no existe — usa cálculo legal */ }

    // Calcular líneas por colaborador
    const lineas = snapshot.map((row) => {
      const empId = row.employee_id as number | null;
      const igssData = empId && igssMap.has(empId)
        ? igssMap.get(empId)!
        : { aplica_igss: false, motivo_exclusion_igss: empId ? "Sin datos IGSS" : "Sin ID de empleado" };
      const uniformeMonto = empId ? (unifMap.get(empId)?.monto ?? 0) : 0;
      const barracaInfo = empId ? barracaMap.get(empId) : undefined;
      const barracaCuotaMensual = barracaInfo?.cuota ?? 0;
      const frecPago = String(row.frecuencia_pago ?? "quincenal");
      const barracaMonto = frecPago === "quincenal" ? parseFloat((barracaCuotaMensual / 2).toFixed(2)) : barracaCuotaMensual;
      // Seguro de vida (SEG-02): mitad de la prima mensual si quincenal, completo si mensual
      const seguroMontoPeriodo = frecPago === "quincenal"
        ? parseFloat((primaSeguroMensual / 2).toFixed(2))
        : parseFloat(primaSeguroMensual.toFixed(2));
      const amonestacionesMonto = empId ? (amonestacionesMap.get(empId) ?? 0) : 0;
      return {
        employee_id:        empId,
        nombre_completo:    String(row.nombre_completo ?? ""),
        dpi:                row.dpi as string | null,
        puesto:             (row.puesto_titular_nombre ?? row.puesto_empleado) as string | null,
        sede:               row.sede as string | null,
        cliente:            row.cliente_principal as string | null,
        tipo_jornada:       row.tipo_jornada as string | null,
        revision_estado:    row.revision_estado as string | null,
        observaciones_rrhh: row.revision_observaciones as string | null,
        ...calcularLinea(row, periodoTotalDias, igssData, quincenaTipo, desde, hasta, uniformeMonto, tarifasHE, barracaMonto, seguroMontoPeriodo, amonestacionesMonto),
      };
    });

    // Totales de planilla
    const totales = lineas.reduce(
      (acc, l) => ({
        total_sueldo_periodo:         acc.total_sueldo_periodo         + l.sueldo_periodo,
        total_desc_faltas:            acc.total_desc_faltas            + l.desc_faltas,
        total_desc_septimo:           acc.total_desc_septimo           + l.desc_septimo,
        total_valor_he:               acc.total_valor_he               + l.valor_he,
        total_bruto:                  acc.total_bruto                  + l.total_bruto,
        total_igss_trabajador:        acc.total_igss_trabajador        + l.igss_trabajador,
        total_igss_patronal:          acc.total_igss_patronal          + l.igss_patronal,
        total_isr:                    acc.total_isr                    + l.isr,
        total_bonificacion_incentivo: acc.total_bonificacion_incentivo + l.bonificacion_incentivo,
        total_bonificacion_1:         acc.total_bonificacion_1         + l.bonificacion_1,
        total_bonificacion_2:         acc.total_bonificacion_2         + l.bonificacion_2,
        total_bonificacion_3:         acc.total_bonificacion_3         + l.bonificacion_3,
        total_anticipos:              acc.total_anticipos              + l.anticipos,
        total_descuento_seguro_vida:  acc.total_descuento_seguro_vida  + l.descuento_seguro_vida,
        total_neto:                   acc.total_neto                   + l.total_neto,
      }),
      {
        total_sueldo_periodo: 0, total_desc_faltas: 0, total_desc_septimo: 0,
        total_valor_he: 0, total_bruto: 0,
        total_igss_trabajador: 0, total_igss_patronal: 0, total_isr: 0,
        total_bonificacion_incentivo: 0, total_bonificacion_1: 0, total_bonificacion_2: 0, total_bonificacion_3: 0,
        total_anticipos: 0, total_descuento_seguro_vida: 0, total_neto: 0,
      }
    );

    // Insertar planilla
    const { rows: planRows } = await pool.query(`
      INSERT INTO planillas
        (periodo_desde, periodo_hasta, cierre_id, generado_por, observaciones,
         total_colaboradores, total_sueldo_periodo, total_desc_faltas, total_desc_septimo,
         total_valor_he, total_bruto, total_igss_trabajador, total_igss_patronal,
         total_isr, total_bonificacion_incentivo, total_anticipos, total_neto)
      VALUES ($1::date, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `, [
      desde, hasta, cierre.id, generadoPor, observaciones ?? null,
      lineas.length,
      totales.total_sueldo_periodo.toFixed(2),
      totales.total_desc_faltas.toFixed(2),
      totales.total_desc_septimo.toFixed(2),
      totales.total_valor_he.toFixed(2),
      totales.total_bruto.toFixed(2),
      totales.total_igss_trabajador.toFixed(2),
      totales.total_igss_patronal.toFixed(2),
      totales.total_isr.toFixed(2),
      totales.total_bonificacion_incentivo.toFixed(2),
      totales.total_anticipos.toFixed(2),
      totales.total_neto.toFixed(2),
    ]);

    const planillaId = planRows[0].id;

    // Insertar líneas con trazabilidad de anticipos y cuotas de uniforme
    let totalAnticiposVinculados = 0;
    let totalCuotasUniforme = 0;

    for (const l of lineas) {
      // ── Anticipos (con soporte de cuotas e interés) ──────────────────────────
      let anticipoIds: number[] = [];
      if (l.employee_id) {
        const { rows: antRows } = await pool.query(`
          SELECT id, cantidad, num_cuotas, cuotas_pagadas, cuota_monto, monto_cobro
          FROM anticipos
          WHERE employee_id = $1
            AND estado IN ('pendiente', 'aprobada')
            AND COALESCE(cuotas_pagadas, 0) < COALESCE(num_cuotas, 1)
          ORDER BY fecha_solicitud ASC
        `, [l.employee_id]);
        anticipoIds = antRows.map((r: Record<string, unknown>) => r.id as number);
        totalAnticiposVinculados += anticipoIds.length;

        for (const ant of antRows) {
          const numCuotas = Number(ant.num_cuotas) || 1;
          const cuotasPagadas = Number(ant.cuotas_pagadas) || 0;
          const nuevasCuotasPagadas = cuotasPagadas + 1;
          const esUltimaCuota = nuevasCuotasPagadas >= numCuotas;

          await pool.query(`
            UPDATE anticipos
            SET planilla_id = $1,
                cuotas_pagadas = $2,
                estado = CASE WHEN $3 THEN 'descontado' ELSE estado END,
                updated_at = NOW()
            WHERE id = $4
          `, [planillaId, nuevasCuotasPagadas, esUltimaCuota, ant.id]);
        }
      }

      // ── Cuota de uniforme ─────────────────────────────────────────────────────
      let uniformeCuotaIds: number[] = [];
      if (l.employee_id && l.descuentos_uniforme > 0) {
        const unifData = unifMap.get(l.employee_id);
        if (unifData) {
          await descontarCuotaUniforme(unifData.cuotaId, planillaId);
          uniformeCuotaIds = [unifData.cuotaId];
          totalCuotasUniforme += 1;
        }
      }

      await pool.query(`
        INSERT INTO planilla_lineas
          (planilla_id, employee_id, nombre_completo, dpi, puesto, sede, cliente,
           tipo_jornada, horas_contrato, frecuencia_pago, sueldo_base, periodo_dias,
           dias_trabajados, faltas, suspensiones, horas_trabajadas, horas_extra,
           sueldo_periodo, desc_faltas, desc_septimo, valor_he, total_bruto, anticipos,
           aplica_igss, motivo_exclusion_igss,
           igss_trabajador, igss_patronal, isr, bonificacion_incentivo,
           bonificacion_1, bonificacion_2, bonificacion_3,
           otros_descuentos, total_neto,
           anticipo_ids, novedad_ids, segmento_ids,
           revision_estado, observaciones_rrhh,
           descuentos_uniforme, uniforme_cuota_ids,
           descuento_barraca, descuento_seguro_vida)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43)
      `, [
        planillaId, l.employee_id, l.nombre_completo, l.dpi, l.puesto, l.sede, l.cliente,
        l.tipo_jornada, l.horas_contrato, l.frecuencia_pago, l.sueldo_base, l.periodo_dias,
        l.dias_trabajados, l.faltas, l.suspensiones,
        l.horas_trabajadas, l.horas_extra,
        l.sueldo_periodo, l.desc_faltas, l.desc_septimo, l.valor_he, l.total_bruto, l.anticipos,
        l.aplica_igss, l.motivo_exclusion_igss,
        l.igss_trabajador, l.igss_patronal, l.isr, l.bonificacion_incentivo,
        l.bonificacion_1, l.bonificacion_2, l.bonificacion_3,
        l.otros_descuentos, l.total_neto,
        JSON.stringify(anticipoIds), JSON.stringify([]), JSON.stringify([]),
        l.revision_estado, l.observaciones_rrhh,
        l.descuentos_uniforme, JSON.stringify(uniformeCuotaIds),
        l.descuento_barraca, l.descuento_seguro_vida,
      ]);
    }

    // ── Marcar amonestaciones económicas activas como descontadas (AMON-01) ──
    // Vincula a esta planilla todas las amonestaciones del rango cuyos
    // colaboradores efectivamente entraron en líneas; quedan inmunes a
    // futuros cierres y trazables al revertir la planilla.
    const empIdsLineas = lineas.map((l: { employee_id?: number }) => l.employee_id).filter(Boolean);
    let totalAmonestacionesVinculadas = 0;
    if (empIdsLineas.length > 0) {
      const { rowCount } = await pool.query(
        `UPDATE amonestaciones
            SET descontado = TRUE,
                planilla_id = $1,
                updated_at = NOW()
          WHERE tipo = 'economica'
            AND estado = 'activa'
            AND descontado = FALSE
            AND fecha BETWEEN $2::date AND $3::date
            AND employee_id = ANY($4::int[])`,
        [planillaId, desde, hasta, empIdsLineas]
      );
      totalAmonestacionesVinculadas = rowCount ?? 0;
    }

    // Registrar en auditoría
    await pool.query(`
      INSERT INTO pre_planilla_auditoria
        (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_generada', $3, $4, $5)
    `, [
      desde, hasta, generadoPor, observaciones ?? null,
      JSON.stringify({
        planilla_id: planillaId,
        total_colaboradores: lineas.length,
        total_neto: totales.total_neto.toFixed(2),
        anticipos_vinculados: totalAnticiposVinculados,
        amonestaciones_vinculadas: totalAmonestacionesVinculadas,
      }),
    ]);

    res.status(201).json({
      id: planillaId,
      periodo_desde: desde,
      periodo_hasta: hasta,
      total_colaboradores: lineas.length,
      total_neto: totales.total_neto.toFixed(2),
      anticipos_vinculados: totalAnticiposVinculados,
      mensaje: `Planilla generada para el período ${desde} — ${hasta}. ${totalAnticiposVinculados} anticipo(s) vinculado(s) y marcado(s) como descontados.`,
    });
  } catch (err) {
    logger.error({ err }, "POST /nomina/planilla error");
    res.status(500).json({ error: "Error al generar planilla" });
  }
});

// ─── GET /api/nomina/planilla/:id ─────────────────────────────────────────────

planillaRouter.get("/nomina/planilla/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: plan } = await pool.query(`
      SELECT p.*, ppc.cerrado_por, ppc.cerrado_at, ppc.anulado AS cierre_anulado
      FROM planillas p
      JOIN pre_planilla_cierres ppc ON ppc.id = p.cierre_id
      WHERE p.id = $1
    `, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const { rows: lineas } = await pool.query(`
      SELECT * FROM planilla_lineas WHERE planilla_id = $1 ORDER BY nombre_completo
    `, [id]);

    res.json({ ...plan[0], lineas });
  } catch (err) {
    logger.error({ err }, "GET /nomina/planilla/:id error");
    res.status(500).json({ error: "Error al obtener planilla" });
  }
});

// ─── PATCH /api/nomina/planilla/:id/estado ────────────────────────────────────

planillaRouter.patch("/nomina/planilla/:id/estado", async (req, res) => {
  const id = parseInt(req.params.id);
  const { estado, aprobadoPor, observaciones } = req.body ?? {};

  if (isNaN(id) || !estado) return res.status(400).json({ error: "id y estado son requeridos" });

  const estadosValidos = ["borrador", "revisada", "aprobada", "pagada"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(", ")}` });
  }

  try {
    const { rows: current } = await pool.query(
      `SELECT estado, anulada FROM planillas WHERE id = $1`, [id]
    );
    if (!current.length) return res.status(404).json({ error: "Planilla no encontrada" });
    if (current[0].anulada) return res.status(409).json({ error: "La planilla está anulada y no puede modificarse." });

    const { rows } = await pool.query(
      `UPDATE planillas SET estado = $1, observaciones = COALESCE($2, observaciones) WHERE id = $3 RETURNING *`,
      [estado, observaciones ?? null, id]
    );

    // Auditoría
    const p = rows[0];
    await pool.query(`
      INSERT INTO pre_planilla_auditoria
        (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_estado', $3, $4, $5)
    `, [
      p.periodo_desde, p.periodo_hasta,
      aprobadoPor ?? "sistema", observaciones ?? null,
      JSON.stringify({ planilla_id: id, estado }),
    ]);

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /nomina/planilla/:id/estado error");
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

// ─── DELETE /api/nomina/planilla/:id ─────────────────────────────────────────
// Revierte la planilla:
//   1. Solo si estado != 'pagada'
//   2. Desvincula anticipos → planilla_id = NULL, estado = 'aprobada'
//   3. Marca el cierre como anulado → permite re-cerrar pre-planilla
//   4. Reabre revisiones RRHH del período → periodo_cerrado = FALSE
//   5. Anula la planilla (soft delete) + borra líneas via CASCADE

planillaRouter.delete("/nomina/planilla/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { anuladoPor, motivo } = req.body ?? {};

  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  if (!anuladoPor) return res.status(400).json({ error: "anuladoPor es requerido" });

  try {
    const { rows: plan } = await pool.query(`SELECT * FROM planillas WHERE id = $1`, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const p = plan[0];

    if (p.anulada) {
      return res.status(409).json({ error: "La planilla ya fue anulada anteriormente." });
    }

    if (p.estado === "pagada") {
      return res.status(409).json({
        error: "No se puede revertir una planilla que ya fue pagada. Contacta al administrador.",
      });
    }

    // 1. Desvincular anticipos: volver a 'aprobada', decrementar cuotas_pagadas, limpiar planilla_id
    await pool.query(`
      UPDATE anticipos
      SET planilla_id = NULL,
          estado = 'aprobada',
          cuotas_pagadas = GREATEST(0, COALESCE(cuotas_pagadas, 0) - 1),
          updated_at = NOW()
      WHERE planilla_id = $1
    `, [id]);

    // 1b. Liberar amonestaciones económicas vinculadas a esta planilla (AMON-01)
    await pool.query(`
      UPDATE amonestaciones
      SET descontado = FALSE, planilla_id = NULL, updated_at = NOW()
      WHERE planilla_id = $1
    `, [id]);

    // 2. Marcar cierre como anulado → reabre la pre-planilla
    await pool.query(`
      UPDATE pre_planilla_cierres
      SET anulado = TRUE, anulado_por = $1, anulado_at = NOW()
      WHERE id = $2
    `, [anuladoPor, p.cierre_id]);

    // 3. Reabrir revisiones RRHH del período
    await pool.query(`
      UPDATE pre_planilla_revision
      SET periodo_cerrado = FALSE, updated_at = NOW()
      WHERE periodo_desde = $1::date AND periodo_hasta = $2::date
    `, [p.periodo_desde, p.periodo_hasta]);

    // 4. Anular planilla (soft delete) — planilla_lineas se borran via CASCADE en DELETE
    //    Usamos soft delete para conservar el registro de auditoría
    await pool.query(`
      UPDATE planillas
      SET anulada = TRUE, anulada_por = $1, anulada_at = NOW(),
          estado = 'borrador', observaciones = COALESCE($2, observaciones)
      WHERE id = $3
    `, [anuladoPor, motivo ?? null, id]);

    // Borrar líneas de esta planilla (por claridad, aunque podría hacerse por CASCADE)
    await pool.query(`DELETE FROM planilla_lineas WHERE planilla_id = $1`, [id]);

    // 5. Auditoría
    await pool.query(`
      INSERT INTO pre_planilla_auditoria
        (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_revertida', $3, $4, $5)
    `, [
      p.periodo_desde, p.periodo_hasta, anuladoPor, motivo ?? null,
      JSON.stringify({ planilla_id: id, estado_previo: p.estado, cierre_id: p.cierre_id }),
    ]);

    res.json({
      mensaje: `Planilla del período ${p.periodo_desde}—${p.periodo_hasta} revertida correctamente.
La pre-planilla está abierta nuevamente. Los anticipos quedan disponibles.
Corrige en pre-planilla, re-cierra el período y genera una nueva planilla.`,
      planilla_id: id,
      periodo_desde: p.periodo_desde,
      periodo_hasta: p.periodo_hasta,
    });
  } catch (err) {
    logger.error({ err }, "DELETE /nomina/planilla/:id error");
    res.status(500).json({ error: "Error al revertir planilla" });
  }
});

// ─── GET /api/nomina/planilla/:id/export ──────────────────────────────────────

planillaRouter.get("/nomina/planilla/:id/export", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: plan } = await pool.query(`SELECT * FROM planillas WHERE id = $1`, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const { rows: lineas } = await pool.query(`
      SELECT * FROM planilla_lineas WHERE planilla_id = $1 ORDER BY nombre_completo
    `, [id]);

    const p = plan[0];
    const BOM = "\uFEFF";
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const fmtQ = (v: unknown) => `Q ${parseFloat(String(v ?? 0)).toFixed(2)}`;

    // Calcular anticipo count por línea
    const anticCountMap = new Map<number, number>();
    for (const l of lineas) {
      const ids: number[] = Array.isArray(l.anticipo_ids) ? l.anticipo_ids : [];
      anticCountMap.set(l.id, ids.length);
    }

    const headers = [
      "ID", "Nombre", "DPI",
      "Puesto", "Sede", "Cliente", "Jornada", "Hrs/Sem",
      "Sueldo Base (Q)", "Días Período", "Días Trabajados",
      "Faltas", "Suspensiones", "H. Trabajadas", "H. Extra",
      "Sueldo Período (Q)", "Desc. Faltas (Q)", "Valor HE (Q)",
      "IGSS Trab. (Q)", "IGSS Pat. (Q)", "ISR (Q)", "Otros Desc. (Q)",
      "Total Bruto (Q)", "Anticipos (Q)", "# Anticipos",
      "Total Neto (Q)", "Revisión RRHH",
    ];

    const csvLines = [
      [`PLANILLA FINAL — ${p.periodo_desde} — ${p.periodo_hasta} — Estado: ${p.estado.toUpperCase()} — Generado por: ${p.generado_por}`].map(esc).join(","),
      "",
      headers.map(esc).join(","),
      ...lineas.map((l) => [
        l.employee_id ? `EMP-${String(l.employee_id).padStart(4, "0")}` : "—",
        l.nombre_completo, l.dpi ?? "",
        l.puesto ?? "", l.sede ?? "", l.cliente ?? "",
        l.tipo_jornada ?? "", l.horas_contrato ?? "",
        fmtQ(l.sueldo_base), l.periodo_dias, l.dias_trabajados,
        l.faltas, l.suspensiones,
        parseFloat(l.horas_trabajadas || 0).toFixed(2),
        parseFloat(l.horas_extra || 0).toFixed(2),
        fmtQ(l.sueldo_periodo), fmtQ(l.desc_faltas), fmtQ(l.valor_he),
        fmtQ(l.igss_trabajador ?? 0), fmtQ(l.igss_patronal ?? 0), fmtQ(l.isr ?? 0), fmtQ(l.otros_descuentos ?? 0),
        fmtQ(l.total_bruto), fmtQ(l.anticipos),
        anticCountMap.get(l.id) ?? 0,
        fmtQ(l.total_neto), l.revision_estado ?? "",
      ].map(esc).join(",")),
      "",
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
       fmtQ(p.total_sueldo_periodo), fmtQ(p.total_desc_faltas), fmtQ(p.total_valor_he),
       "—", "—", fmtQ(p.total_isr ?? 0), "—",
       fmtQ(p.total_bruto), fmtQ(p.total_anticipos), "",
       fmtQ(p.total_neto), "TOTALES"].map(esc).join(","),
    ];

    const filename = `planilla_${p.periodo_desde}_${p.periodo_hasta}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(BOM + csvLines.join("\r\n"));
  } catch (err) {
    logger.error({ err }, "GET /nomina/planilla/:id/export error");
    res.status(500).json({ error: "Error al exportar planilla" });
  }
});

// ─── Transferencias bancarias (un archivo CSV por banco) ────────────────────
// Genera un archivo CSV por cada banco al que se le debe pagar por
// transferencia. NO consolida bancos: cada portal del banco recibe solo las
// cuentas de su propia institución.

function slugBanco(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "banco";
}

function nombrePeriodoConcepto(desde: string, hasta: string) {
  // Devuelve algo como "1ra quincena abril 2026" o "abril 2026"
  const d = new Date(desde + "T00:00:00");
  const h = new Date(hasta + "T00:00:00");
  if (isNaN(d.getTime()) || isNaN(h.getTime())) return `${desde} a ${hasta}`;
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  if (d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear()) {
    const mes = meses[d.getMonth()];
    const anio = d.getFullYear();
    if (d.getDate() <= 5 && h.getDate() >= 14 && h.getDate() <= 16) return `1ra quincena ${mes} ${anio}`;
    if (d.getDate() >= 14 && d.getDate() <= 17) return `2da quincena ${mes} ${anio}`;
    return `${mes} ${anio}`;
  }
  return `${desde} a ${hasta}`;
}

planillaRouter.get("/nomina/planilla/:id/transferencias-resumen", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const { rows } = await pool.query(`
      SELECT pl.id, pl.nombre_completo, pl.dpi, pl.total_neto,
             e.banco, e.cuenta_bancaria, e.tipo_cuenta, e.forma_pago
      FROM planilla_lineas pl
      LEFT JOIN employees e ON e.id = pl.employee_id
      WHERE pl.planilla_id = $1
      ORDER BY pl.nombre_completo
    `, [id]);

    type Bucket = { banco: string; bancoSlug: string; empleados: number; monto: number };
    const buckets = new Map<string, Bucket>();
    let otrosCount = 0;
    let otrosMonto = 0;
    const sinDatos: { id:number; nombre:string; dpi:string; razon:string; monto:number }[] = [];

    for (const l of rows) {
      const fp = String(l.forma_pago ?? "").toLowerCase();
      const monto = parseFloat(l.total_neto ?? 0) || 0;
      if (fp !== "transferencia") {
        otrosCount++;
        otrosMonto += monto;
        continue;
      }
      const banco  = String(l.banco ?? "").trim();
      const cuenta = String(l.cuenta_bancaria ?? "").trim();
      if (!banco || !cuenta) {
        sinDatos.push({
          id: l.id,
          nombre: l.nombre_completo,
          dpi: l.dpi ?? "",
          razon: !banco && !cuenta ? "sin banco ni cuenta" : !banco ? "sin banco" : "sin cuenta",
          monto,
        });
        continue;
      }
      const key = banco.toLowerCase();
      const b = buckets.get(key) ?? { banco, bancoSlug: slugBanco(banco), empleados: 0, monto: 0 };
      b.empleados += 1;
      b.monto += monto;
      buckets.set(key, b);
    }

    res.json({
      bancos: Array.from(buckets.values()).sort((a, b) => b.monto - a.monto),
      otrosPagos: { empleados: otrosCount, monto: otrosMonto },
      sinDatos,
    });
  } catch (err) {
    logger.error({ err }, "GET /nomina/planilla/:id/transferencias-resumen error");
    res.status(500).json({ error: "Error al calcular resumen de transferencias" });
  }
});

planillaRouter.get("/nomina/planilla/:id/transferencias", async (req, res) => {
  const id = parseInt(req.params.id);
  const banco = String(req.query.banco ?? "").trim();
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  if (!banco)   return res.status(400).json({ error: "Falta parámetro banco" });

  try {
    const { rows: plan } = await pool.query(`SELECT * FROM planillas WHERE id = $1`, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });
    const p = plan[0];

    const { rows: lineas } = await pool.query(`
      SELECT pl.nombre_completo, pl.dpi, pl.total_neto,
             e.banco, e.cuenta_bancaria, e.tipo_cuenta
      FROM planilla_lineas pl
      JOIN employees e ON e.id = pl.employee_id
      WHERE pl.planilla_id = $1
        AND LOWER(e.forma_pago) = 'transferencia'
        AND LOWER(TRIM(e.banco)) = LOWER($2)
        AND e.cuenta_bancaria IS NOT NULL
        AND TRIM(e.cuenta_bancaria) <> ''
      ORDER BY pl.nombre_completo
    `, [id, banco]);

    if (!lineas.length) {
      return res.status(404).json({ error: `No hay empleados con transferencia a "${banco}" en esta planilla` });
    }

    const concepto = `Planilla ${nombrePeriodoConcepto(p.periodo_desde, p.periodo_hasta)}`;
    const BOM = "\uFEFF";
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const headers = ["Nombre completo", "DPI", "Banco", "Tipo de cuenta", "Número de cuenta", "Monto (Q)", "Concepto"];
    const filas = lineas.map((l: any) => [
      l.nombre_completo,
      l.dpi ?? "",
      l.banco,
      l.tipo_cuenta ?? "",
      String(l.cuenta_bancaria),
      (parseFloat(l.total_neto ?? 0) || 0).toFixed(2),
      concepto,
    ]);
    const total = filas.reduce((s, r) => s + parseFloat(r[5]), 0);

    const csv = [
      headers.map(esc).join(","),
      ...filas.map(r => r.map(esc).join(",")),
      "",
      ["TOTAL", "", "", "", `${filas.length} empleados`, total.toFixed(2), concepto].map(esc).join(","),
    ].join("\r\n");

    const filename = `transferencias_${slugBanco(banco)}_${p.periodo_desde}_${p.periodo_hasta}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(BOM + csv);
  } catch (err) {
    logger.error({ err }, "GET /nomina/planilla/:id/transferencias error");
    res.status(500).json({ error: "Error al generar archivo de transferencias" });
  }
});

// ─── Tarifas de Horas Extra ──────────────────────────────────────────────────

planillaRouter.get("/nomina/tarifas-he", async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, jornada, horas_turno, tarifa, descripcion, updated_at, updated_by FROM config_tarifa_he ORDER BY horas_turno`);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/tarifas-he error");
    res.status(500).json({ error: "Error al obtener tarifas" });
  }
});

planillaRouter.put("/nomina/tarifas-he/:id", async (req, res) => {
  try {
    const { tarifa, descripcion, usuario } = req.body;
    if (tarifa == null || isNaN(Number(tarifa)) || Number(tarifa) < 0) {
      return res.status(400).json({ error: "Tarifa inválida" });
    }
    const { rows } = await pool.query(
      `UPDATE config_tarifa_he SET tarifa = $1, descripcion = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4 RETURNING *`,
      [Number(tarifa), descripcion ?? null, usuario ?? "sistema", req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Tarifa no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PUT /nomina/tarifas-he/:id error");
    res.status(500).json({ error: "Error al actualizar tarifa" });
  }
});
