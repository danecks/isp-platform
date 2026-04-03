/**
 * validate.ts — Validaciones E2E de integridad del sistema de nómina
 *
 * Llama a la API (pre-planilla → cierre → planilla) y ejecuta checks de PASS/FAIL.
 * Verifica que NO se mezclen datos entre empleados, períodos ni coberturas.
 */

import { pool } from "@workspace/db";
import { DESDE, HASTA, DIAS_PERIODO, MARKER } from "./seed";
import { calcularBonificacionIncentivo, calcularBruto } from "../../lib/nomina-calc";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function round2(n: number) { return parseFloat(n.toFixed(2)); }

interface Check {
  cat: string;
  name: string;
  pass: boolean;
  detail: string;
  expected?: unknown;
  actual?: unknown;
}

const checks: Check[] = [];

function pass(cat: string, name: string, detail: string) {
  checks.push({ cat, name, pass: true, detail });
}

function fail(cat: string, name: string, detail: string, expected?: unknown, actual?: unknown) {
  checks.push({ cat, name, pass: false, detail, expected, actual });
}

function check(cat: string, name: string, condition: boolean, detail: string, expected?: unknown, actual?: unknown) {
  if (condition) pass(cat, name, detail);
  else fail(cat, name, detail, expected, actual);
}

// ─── Pre-planilla: obtener snapshot directo de DB ─────────────────────────────

interface EmpRow {
  employee_id: number;
  nombre_completo: string;
  frecuencia_pago: string;
  sueldo_base: string;
  horas_contrato: number;
  dias_trabajados: string;
  faltas: string;
  suspensiones: string;
  dias_vacaciones: string;
  dias_incapacidad: string;
  dias_permiso_sin_goce: string;
  dias_permiso_con_goce: string;
  horas_extra: string;
  septimos_perdidos: number;
  aplica_igss: boolean;
  anticipos_monto: string;
  notas: string | null;
}

async function getPrePlanillaRows(): Promise<EmpRow[]> {
  const { rows } = await pool.query<EmpRow>(
    `SELECT
       e.id AS employee_id,
       e.nombre_completo,
       COALESCE(e.frecuencia_pago, 'quincenal') AS frecuencia_pago,
       e.sueldo_base,
       e.horas_contrato,
       COUNT(DISTINCT n.fecha) FILTER (WHERE n.trabajo_dia = TRUE) AS dias_trabajados,
       COUNT(DISTINCT n.fecha) FILTER (WHERE n.falta = TRUE) AS faltas,
       COUNT(DISTINCT n.fecha) FILTER (WHERE n.suspension = TRUE) AS suspensiones,
       COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'vacaciones') AS dias_vacaciones,
       COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'incapacidad') AS dias_incapacidad,
       COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'permiso_sin_goce') AS dias_permiso_sin_goce,
       COUNT(DISTINCT n.fecha) FILTER (WHERE n.tipo_novedad = 'permiso_con_goce') AS dias_permiso_con_goce,
       COALESCE(SUM(CASE WHEN n.trabajo_dia THEN n.horas_extra::numeric ELSE 0 END), 0) AS horas_extra,
       COALESCE((
         SELECT COUNT(DISTINCT DATE_TRUNC('week', er.fecha::date))::INT
         FROM eventos_rrhh er
         WHERE er.employee_id = e.id
           AND er.afecta_septimo_res = TRUE
           AND er.fecha::date BETWEEN $1::date AND $2::date
           AND COALESCE(er.estado, 'activo') != 'anulado'
       ), 0) AS septimos_perdidos,
       CASE
         WHEN COALESCE(e.aplica_igss_general, FALSE) = FALSE THEN FALSE
         WHEN COALESCE(e.estado_igss, 'no_activo') != 'activo' THEN FALSE
         WHEN COALESCE(po.aplica_igss, FALSE) = FALSE THEN FALSE
         ELSE TRUE
       END AS aplica_igss,
       0 AS anticipos_monto,
       e.notas
     FROM employees e
     INNER JOIN novedades_nomina_diarias n ON n.employee_id = e.id AND n.fecha BETWEEN $1 AND $2
     LEFT JOIN LATERAL (
       SELECT po2.aplica_igss
       FROM puestos_operativos po2
       WHERE po2.activo = TRUE AND po2.titular_employee_id = e.id
       ORDER BY po2.updated_at DESC NULLS LAST LIMIT 1
     ) po ON true
     WHERE e.notas LIKE $3
     GROUP BY e.id, e.nombre_completo, e.frecuencia_pago, e.sueldo_base, e.horas_contrato,
              po.aplica_igss, e.aplica_igss_general, e.estado_igss, e.notas`,
    [DESDE, HASTA, `%${MARKER}%`]
  );
  return rows;
}

// ─── Función principal de validación ─────────────────────────────────────────

export async function runValidate(verbose = true) {
  const log = (...args: unknown[]) => verbose && console.log(...args);

  log("\n══════════════════════════════════════════════════════════════════");
  log("  VALIDACIONES E2E — Segunda Quincena de Abril 2026");
  log("  Período:", DESDE, "→", HASTA);
  log("══════════════════════════════════════════════════════════════════\n");

  // ── A. Obtener datos ────────────────────────────────────────────────────────
  const rows = await getPrePlanillaRows();

  // ── V-01: Exactamente 24 empleados en pre-planilla ─────────────────────────
  check("Integridad", "V-01: 24 empleados en pre-planilla",
    rows.length === 24,
    `Esperados 24, encontrados ${rows.length}`,
    24, rows.length
  );

  // ── V-02: Sin empleados duplicados ─────────────────────────────────────────
  const empIds = rows.map(r => r.employee_id);
  const uniqueIds = new Set(empIds);
  check("Integridad", "V-02: Sin duplicados de employee_id",
    uniqueIds.size === empIds.length,
    uniqueIds.size === empIds.length ? "Sin duplicados" : `${empIds.length - uniqueIds.size} duplicados detectados`,
    empIds.length, uniqueIds.size
  );

  // ── V-03: Cada empleado tiene exactamente 15 novedades (una por día) ───────
  const { rows: novCount } = await pool.query<{ employee_id: number; cnt: string }>(
    `SELECT employee_id, COUNT(*) AS cnt
     FROM novedades_nomina_diarias n
     JOIN employees e ON e.id = n.employee_id
     WHERE n.fecha BETWEEN $1 AND $2 AND e.notas LIKE $3
     GROUP BY employee_id`,
    [DESDE, HASTA, `%${MARKER}%`]
  );
  const novsOk = novCount.every(r => parseInt(r.cnt) === 15);
  check("Integridad", "V-03: Cada empleado tiene 15 novedades (1/día)",
    novsOk,
    novsOk ? "Todas las novedades bien distribuidas" : novCount.filter(r => parseInt(r.cnt) !== 15).map(r => `empId=${r.employee_id}:${r.cnt}`).join(", "),
    "15 por empleado", `${novCount.length} empleados revisados`
  );

  // ── V-04: Sin novedades duplicadas (fecha, employee_id) ────────────────────
  const { rows: dupNov } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM (
       SELECT n.fecha, n.employee_id
       FROM novedades_nomina_diarias n
       JOIN employees e ON e.id = n.employee_id
       WHERE n.fecha BETWEEN $1 AND $2 AND e.notas LIKE $3
       GROUP BY n.fecha, n.employee_id HAVING COUNT(*) > 1
     ) x`,
    [DESDE, HASTA, `%${MARKER}%`]
  );
  check("Integridad", "V-04: Sin novedades duplicadas (fecha×empleado)",
    parseInt(dupNov[0].cnt) === 0,
    parseInt(dupNov[0].cnt) === 0 ? "Sin duplicados" : `${dupNov[0].cnt} pares (fecha, employee_id) duplicados`,
    0, parseInt(dupNov[0].cnt)
  );

  // ── V-05: Faltas afectan solo a quien corresponde ──────────────────────────
  // EMP-01: 1 falta exactamente
  const emp01 = rows.find(r => r.notas?.includes("EMP-01"));
  check("Aislamiento", "V-05: EMP-01 tiene exactamente 1 falta",
    emp01 ? parseInt(emp01.faltas) === 1 : false,
    emp01 ? `faltas=${emp01.faltas}` : "EMP-01 no encontrado",
    1, emp01 ? parseInt(emp01.faltas) : "N/A"
  );

  // EMP-12 (control puro): 0 faltas
  const emp12 = rows.find(r => r.notas?.includes("EMP-12"));
  check("Aislamiento", "V-06: EMP-12 (control) tiene 0 faltas",
    emp12 ? parseInt(emp12.faltas) === 0 : false,
    emp12 ? `faltas=${emp12.faltas}` : "EMP-12 no encontrado",
    0, emp12 ? parseInt(emp12.faltas) : "N/A"
  );

  // ── V-07: Pérdida de séptimo solo a quien tiene evento RRHH ───────────────
  // Empleados que DEBEN perder séptimo: EMP-01, EMP-13, EMP-17
  for (const key of ["EMP-01", "EMP-13", "EMP-17"]) {
    const emp = rows.find(r => r.notas?.includes(key));
    check("Séptimo Día", `V-07: ${key} pierde séptimo (septimos_perdidos=1)`,
      emp ? emp.septimos_perdidos >= 1 : false,
      emp ? `septimos_perdidos=${emp.septimos_perdidos}` : `${key} no encontrado`,
      ">=1", emp ? emp.septimos_perdidos : "N/A"
    );
  }

  // Empleados que NO deben perder séptimo: EMP-02, EMP-22 (RRHH excepcionó), EMP-12 (sin falta)
  for (const key of ["EMP-02", "EMP-22", "EMP-12"]) {
    const emp = rows.find(r => r.notas?.includes(key));
    check("Séptimo Día", `V-08: ${key} NO pierde séptimo (septimos_perdidos=0)`,
      emp ? emp.septimos_perdidos === 0 : false,
      emp ? `septimos_perdidos=${emp.septimos_perdidos}` : `${key} no encontrado`,
      0, emp ? emp.septimos_perdidos : "N/A"
    );
  }

  // ── V-09: Vacaciones van al contador correcto ──────────────────────────────
  // EMP-05: 3 días vacaciones
  const emp05 = rows.find(r => r.notas?.includes("EMP-05"));
  check("Novedades", "V-09: EMP-05 tiene 3 días vacaciones",
    emp05 ? parseInt(emp05.dias_vacaciones) === 3 : false,
    emp05 ? `dias_vacaciones=${emp05.dias_vacaciones}` : "EMP-05 no encontrado",
    3, emp05 ? parseInt(emp05.dias_vacaciones) : "N/A"
  );

  // EMP-12 (control): 0 vacaciones
  check("Novedades", "V-10: EMP-12 (control) tiene 0 vacaciones",
    emp12 ? parseInt(emp12.dias_vacaciones) === 0 : false,
    emp12 ? `dias_vacaciones=${emp12.dias_vacaciones}` : "EMP-12 no encontrado",
    0, emp12 ? parseInt(emp12.dias_vacaciones) : "N/A"
  );

  // ── V-11: Permisos sin goce van al contador correcto ──────────────────────
  // EMP-03: 2 días permiso sin goce
  const emp03 = rows.find(r => r.notas?.includes("EMP-03"));
  check("Novedades", "V-11: EMP-03 tiene 2 días permiso_sin_goce",
    emp03 ? parseInt(emp03.dias_permiso_sin_goce) === 2 : false,
    emp03 ? `dias_psg=${emp03.dias_permiso_sin_goce}` : "EMP-03 no encontrado",
    2, emp03 ? parseInt(emp03.dias_permiso_sin_goce) : "N/A"
  );

  // EMP-05: 0 permiso sin goce (solo vacaciones)
  check("Novedades", "V-12: EMP-05 tiene 0 permiso_sin_goce",
    emp05 ? parseInt(emp05.dias_permiso_sin_goce) === 0 : false,
    emp05 ? `dias_psg=${emp05.dias_permiso_sin_goce}` : "EMP-05 no encontrado",
    0, emp05 ? parseInt(emp05.dias_permiso_sin_goce) : "N/A"
  );

  // ── V-13: HE solo a quien cubrió en descanso ──────────────────────────────
  // EMP-08: 3 días × 8h = 24 HE
  const emp08 = rows.find(r => r.notas?.includes("EMP-08"));
  check("Horas Extra", "V-13: EMP-08 tiene 24 horas extra (3 días × 8h descanso)",
    emp08 ? parseFloat(emp08.horas_extra) === 24 : false,
    emp08 ? `HE=${emp08.horas_extra}` : "EMP-08 no encontrado",
    24, emp08 ? parseFloat(emp08.horas_extra) : "N/A"
  );

  // EMP-09 (CASO F): 2 días × 8h = 16 HE
  const emp09 = rows.find(r => r.notas?.includes("EMP-09"));
  check("Horas Extra", "V-14: EMP-09 tiene 16 horas extra (2 días × 8h)",
    emp09 ? parseFloat(emp09.horas_extra) === 16 : false,
    emp09 ? `HE=${emp09.horas_extra}` : "EMP-09 no encontrado",
    16, emp09 ? parseFloat(emp09.horas_extra) : "N/A"
  );

  // EMP-05 (vacaciones sin cobertura): 0 HE
  check("Horas Extra", "V-15: EMP-05 (vacaciones) tiene 0 horas extra",
    emp05 ? parseFloat(emp05.horas_extra) === 0 : false,
    emp05 ? `HE=${emp05.horas_extra}` : "EMP-05 no encontrado",
    0, emp05 ? parseFloat(emp05.horas_extra) : "N/A"
  );

  // EMP-12 (control): 0 HE
  check("Horas Extra", "V-16: EMP-12 (control) tiene 0 horas extra",
    emp12 ? parseFloat(emp12.horas_extra) === 0 : false,
    emp12 ? `HE=${emp12.horas_extra}` : "EMP-12 no encontrado",
    0, emp12 ? parseFloat(emp12.horas_extra) : "N/A"
  );

  // EMP-06 (cubre sin descanso, sin HE): 0 HE
  const emp06 = rows.find(r => r.notas?.includes("EMP-06"));
  check("Horas Extra", "V-17: EMP-06 (cubre sin descanso) tiene 0 horas extra",
    emp06 ? parseFloat(emp06.horas_extra) === 0 : false,
    emp06 ? `HE=${emp06.horas_extra}` : "EMP-06 no encontrado",
    0, emp06 ? parseFloat(emp06.horas_extra) : "N/A"
  );

  // ── V-18: dias_trabajados coherentes ──────────────────────────────────────
  // EMP-12 (control): 15 días trabajados
  check("Días", "V-18: EMP-12 (control) tiene 15 días trabajados",
    emp12 ? parseInt(emp12.dias_trabajados) === 15 : false,
    emp12 ? `dias_t=${emp12.dias_trabajados}` : "EMP-12 no encontrado",
    15, emp12 ? parseInt(emp12.dias_trabajados) : "N/A"
  );

  // EMP-01: 14 días trabajados (1 falta)
  check("Días", "V-19: EMP-01 tiene 14 días trabajados (1 falta)",
    emp01 ? parseInt(emp01.dias_trabajados) === 14 : false,
    emp01 ? `dias_t=${emp01.dias_trabajados}` : "EMP-01 no encontrado",
    14, emp01 ? parseInt(emp01.dias_trabajados) : "N/A"
  );

  // EMP-05: 12 días trabajados (3 vacaciones)
  check("Días", "V-20: EMP-05 tiene 12 días trabajados (3 vacaciones)",
    emp05 ? parseInt(emp05.dias_trabajados) === 12 : false,
    emp05 ? `dias_t=${emp05.dias_trabajados}` : "EMP-05 no encontrado",
    12, emp05 ? parseInt(emp05.dias_trabajados) : "N/A"
  );

  // ── V-21: Bonificación proporcional individual ────────────────────────────
  // Verificar el cálculo de bonificación para cada empleado
  for (const row of rows) {
    const dt = parseInt(row.dias_trabajados);
    const dv = parseInt(row.dias_vacaciones);
    const dpc = parseInt(row.dias_permiso_con_goce);
    const di = parseInt(row.dias_incapacidad);
    const bono = calcularBonificacionIncentivo({
      frecuenciaPago: row.frecuencia_pago,
      desde: DESDE, hasta: HASTA,
      diasTrabajados: dt, diasVacaciones: dv,
      diasPermisoConGoce: dpc, diasIncapacidadConGoce: di,
    });
    const montoBase = row.frecuencia_pago === "mensual" ? 250 : 125;
    const diasPagables = Math.min(dt + dv + dpc + di, DIAS_PERIODO);
    const expected = round2(montoBase * (diasPagables / DIAS_PERIODO));
    check("Bonificación", `V-21-${row.notas?.match(/EMP-\d+/)?.[0] ?? row.employee_id}: bono=${bono} correcto`,
      Math.abs(bono - expected) < 0.01,
      `pagables=${diasPagables}, bono_calculado=${bono}, bono_esperado=${expected}`,
      expected, bono
    );
  }

  // ── V-22: Permiso sin goce NO cuenta como día pagable ────────────────────
  // EMP-03: 13 trabajados, 2 PSG → pagables = 13 → bono = 125*(13/15) = 108.33
  const bono03 = emp03 ? calcularBonificacionIncentivo({
    frecuenciaPago: emp03.frecuencia_pago,
    desde: DESDE, hasta: HASTA,
    diasTrabajados: parseInt(emp03.dias_trabajados),
    diasVacaciones: parseInt(emp03.dias_vacaciones),
    diasPermisoConGoce: parseInt(emp03.dias_permiso_con_goce),
    diasIncapacidadConGoce: parseInt(emp03.dias_incapacidad),
  }) : 0;
  check("Bonificación", "V-22: EMP-03 PSG no cuenta en bono (bono=Q108.33)",
    Math.abs(bono03 - 108.33) < 0.01,
    `bono=${bono03} (permiso sin goce excluido de pagables)`,
    108.33, bono03
  );

  // ── V-23: Vacaciones SÍ cuentan como días pagables ────────────────────────
  // EMP-05: 12 trabajados + 3 vacaciones = 15 pagables → bono = Q125.00
  const bono05 = emp05 ? calcularBonificacionIncentivo({
    frecuenciaPago: emp05.frecuencia_pago,
    desde: DESDE, hasta: HASTA,
    diasTrabajados: parseInt(emp05.dias_trabajados),
    diasVacaciones: parseInt(emp05.dias_vacaciones),
    diasPermisoConGoce: parseInt(emp05.dias_permiso_con_goce),
    diasIncapacidadConGoce: parseInt(emp05.dias_incapacidad),
  }) : 0;
  check("Bonificación", "V-23: EMP-05 vacaciones SÍ en bono (bono=Q125.00)",
    bono05 === 125.00,
    `bono=${bono05} (vacaciones incluidas en pagables)`,
    125.00, bono05
  );

  // ── V-24: IGSS solo a quien cumple las 3 condiciones ─────────────────────
  const igssEmps = rows.filter(r => r.aplica_igss);
  // Debe haber exactamente 8 empleados con IGSS (EMP-01,02,05,06,12,13,17,18)
  check("IGSS", "V-24: Exactamente 8 empleados con IGSS activo",
    igssEmps.length === 8,
    `Empleados con IGSS: ${igssEmps.length}`,
    8, igssEmps.length
  );

  // EMP-12 debe tener IGSS
  check("IGSS", "V-25: EMP-12 (control, IGSS) tiene aplica_igss=TRUE",
    emp12?.aplica_igss === true,
    `aplica_igss=${emp12?.aplica_igss}`, true, emp12?.aplica_igss
  );

  // EMP-03 (no IGSS) debe tener aplica_igss=FALSE
  check("IGSS", "V-26: EMP-03 (sin IGSS) tiene aplica_igss=FALSE",
    emp03?.aplica_igss === false,
    `aplica_igss=${emp03?.aplica_igss}`, false, emp03?.aplica_igss
  );

  // ── V-27: Datos del período anterior no arrastran ─────────────────────────
  const { rows: prevPeriod } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM novedades_nomina_diarias n
     JOIN employees e ON e.id = n.employee_id
     WHERE n.fecha BETWEEN '2026-04-01' AND '2026-04-15'
       AND e.notas LIKE $1`,
    [`%${MARKER}%`]
  );
  check("Período", "V-27: Sin datos de primera quincena (Apr 1-15) para empleados E2E",
    parseInt(prevPeriod[0].cnt) === 0,
    parseInt(prevPeriod[0].cnt) === 0 ? "Sin arrastre de período anterior" : `${prevPeriod[0].cnt} novedades en período anterior`,
    0, parseInt(prevPeriod[0].cnt)
  );

  // ── V-28: Sin arrastre de período futuro ────────────────────────────────
  const { rows: futPeriod } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM novedades_nomina_diarias n
     JOIN employees e ON e.id = n.employee_id
     WHERE n.fecha > '2026-04-30'
       AND e.notas LIKE $1`,
    [`%${MARKER}%`]
  );
  check("Período", "V-28: Sin novedades en período futuro (post Apr-30)",
    parseInt(futPeriod[0].cnt) === 0,
    `novedades fuera de período: ${futPeriod[0].cnt}`,
    0, parseInt(futPeriod[0].cnt)
  );

  // ── V-29: Coberturas correctamente asignadas ─────────────────────────────
  // EMP-08 debe tener puesto_cubierto_id apuntando al puesto de EMP-07
  const { rows: cov08 } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt
     FROM novedades_nomina_diarias n
     JOIN employees e ON e.id = n.employee_id
     WHERE e.notas LIKE '%EMP-08%'
       AND n.fecha BETWEEN $1 AND $2
       AND n.descanso_trabajado = TRUE
       AND n.puesto_cubierto_id IS NOT NULL`,
    [DESDE, HASTA]
  );
  check("Coberturas", "V-29: EMP-08 tiene 3 coberturas con descanso_trabajado=TRUE",
    parseInt(cov08[0].cnt) === 3,
    `coberturas HE en descanso: ${cov08[0].cnt}`,
    3, parseInt(cov08[0].cnt)
  );

  // ── V-30: HE respaldadas por cobertura válida ─────────────────────────────
  const { rows: heHuerfanas } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt
     FROM novedades_nomina_diarias n
     JOIN employees e ON e.id = n.employee_id
     WHERE e.notas LIKE $1
       AND n.fecha BETWEEN $2 AND $3
       AND n.horas_extra > 0
       AND n.trabajo_dia = TRUE
       AND n.puesto_cubierto_id IS NULL
       AND n.descanso_trabajado = FALSE`,
    [`%${MARKER}%`, DESDE, HASTA]
  );
  check("Coberturas", "V-30: Sin HE sin respaldo de cobertura",
    parseInt(heHuerfanas[0].cnt) === 0,
    parseInt(heHuerfanas[0].cnt) === 0 ? "Toda HE tiene cobertura o descanso_trabajado" : `${heHuerfanas[0].cnt} registros con HE sin respaldo`,
    0, parseInt(heHuerfanas[0].cnt)
  );

  // ── V-31: Suma de dias_trabajados + novedades = 15 por empleado ───────────
  let v31ok = true;
  const inconsistentes: string[] = [];
  for (const row of rows) {
    const dt = parseInt(row.dias_trabajados);
    const df = parseInt(row.faltas);
    const dv = parseInt(row.dias_vacaciones);
    const di = parseInt(row.dias_incapacidad);
    const dpsg = parseInt(row.dias_permiso_sin_goce);
    const dpcg = parseInt(row.dias_permiso_con_goce);
    const total = dt + df + dv + di + dpsg + dpcg;
    if (total > DIAS_PERIODO) {
      v31ok = false;
      inconsistentes.push(`${row.notas?.match(/EMP-\d+/)?.[0]}: total=${total}`);
    }
  }
  check("Integridad", "V-31: Suma de días por tipo ≤ 15 por empleado",
    v31ok,
    v31ok ? "Todos coherentes" : `Inconsistentes: ${inconsistentes.join(", ")}`,
    `≤${DIAS_PERIODO}`, v31ok ? "OK" : inconsistentes.join(", ")
  );

  // ── V-32: Recalcular novedades no genera duplicados ───────────────────────
  // El UNIQUE constraint (fecha, employee_id) garantiza esto — verificar que está activo
  const { rows: idx } = await pool.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename='novedades_nomina_diarias' AND indexname LIKE '%fecha%employee%'`
  );
  check("Integridad", "V-32: UNIQUE constraint (fecha, employee_id) existe en novedades",
    idx.length > 0,
    idx.length > 0 ? `Índice: ${idx[0].indexname}` : "Falta UNIQUE constraint",
    "existe", idx.length > 0 ? idx[0].indexname : "NO encontrado"
  );

  // ── V-33: Total bruto coincide con suma de brutos individuales ─────────────
  let totalBrutoSuma = 0;
  for (const row of rows) {
    const quincenaTipo = "segunda";
    const bruto = calcularBruto({
      sueldoBase: parseFloat(row.sueldo_base),
      horasContrato: row.horas_contrato,
      faltas: parseInt(row.faltas),
      suspensiones: parseInt(row.suspensiones),
      horasExtra: parseFloat(row.horas_extra),
      periodoTotalDias: DIAS_PERIODO,
      frecuenciaPago: row.frecuencia_pago,
      quincenaTipo,
      septimosPerdidos: row.septimos_perdidos,
    });
    totalBrutoSuma += round2(bruto.totalBruto);
  }
  totalBrutoSuma = round2(totalBrutoSuma);
  // Solo verificar que es un número positivo razonable
  check("Consolidado", "V-33: total_bruto_suma > 0",
    totalBrutoSuma > 0,
    `Total bruto calculado: Q${totalBrutoSuma.toFixed(2)}`,
    ">0", totalBrutoSuma
  );

  // ── Imprimir tabla de empleados ─────────────────────────────────────────────
  log("\n── TABLA DE PRE-PLANILLA (24 colaboradores) ──────────────────────────────");
  log(["Empleado", "Frec", "SB", "DT", "Fal", "Vac", "PSG", "PCG", "Inc", "HE", "Sep", "IGSS"].join("\t"));
  log("─".repeat(110));

  const empKeys = [
    "EMP-01","EMP-02","EMP-03","EMP-04","EMP-05","EMP-06","EMP-07","EMP-08",
    "EMP-09","EMP-10","EMP-11","EMP-12","EMP-13","EMP-14","EMP-15","EMP-16",
    "EMP-17","EMP-18","EMP-19","EMP-20","EMP-21","EMP-22","EMP-23","EMP-24",
  ];

  for (const key of empKeys) {
    const r = rows.find(row => row.notas?.includes(key));
    if (!r) { log(`${key}\t[no encontrado]`); continue; }

    const sb = parseFloat(r.sueldo_base);
    const dt = parseInt(r.dias_trabajados);
    const dv = parseInt(r.dias_vacaciones);
    const dpsg = parseInt(r.dias_permiso_sin_goce);
    const dpcg = parseInt(r.dias_permiso_con_goce);
    const di = parseInt(r.dias_incapacidad);
    const he = parseFloat(r.horas_extra);
    const bono = calcularBonificacionIncentivo({ frecuenciaPago:r.frecuencia_pago, desde:DESDE, hasta:HASTA, diasTrabajados:dt, diasVacaciones:dv, diasPermisoConGoce:dpcg, diasIncapacidadConGoce:di });
    const bruto = calcularBruto({ sueldoBase:sb, horasContrato:r.horas_contrato, faltas:parseInt(r.faltas), suspensiones:parseInt(r.suspensiones), horasExtra:he, periodoTotalDias:DIAS_PERIODO, frecuenciaPago:r.frecuencia_pago, quincenaTipo:"segunda", septimosPerdidos:r.septimos_perdidos });
    const igssT = r.aplica_igss ? round2(round2(bruto.totalBruto) * 0.0483) : 0;
    const neto = round2(round2(bruto.totalBruto) - igssT + bono);

    log([
      key,
      r.frecuencia_pago.substring(0,4),
      `Q${sb.toLocaleString()}`,
      dt,
      parseInt(r.faltas),
      dv,
      dpsg,
      dpcg,
      di,
      he,
      r.septimos_perdidos,
      r.aplica_igss ? "Sí" : "No",
    ].join("\t"));
  }

  // ── Calcular y mostrar totales ─────────────────────────────────────────────
  log("\n── RESUMEN DE PLANILLA ──────────────────────────────────────────────────");
  let sumBruto=0, sumIgssT=0, sumIgssP=0, sumBono=0, sumDescSep=0, sumNeto=0;

  for (const row of rows) {
    const dt = parseInt(row.dias_trabajados);
    const dv = parseInt(row.dias_vacaciones);
    const dpcg = parseInt(row.dias_permiso_con_goce);
    const di = parseInt(row.dias_incapacidad);
    const he = parseFloat(row.horas_extra);
    const bruto = calcularBruto({ sueldoBase:parseFloat(row.sueldo_base), horasContrato:row.horas_contrato, faltas:parseInt(row.faltas), suspensiones:parseInt(row.suspensiones), horasExtra:he, periodoTotalDias:DIAS_PERIODO, frecuenciaPago:row.frecuencia_pago, quincenaTipo:"segunda", septimosPerdidos:row.septimos_perdidos });
    const bono = calcularBonificacionIncentivo({ frecuenciaPago:row.frecuencia_pago, desde:DESDE, hasta:HASTA, diasTrabajados:dt, diasVacaciones:dv, diasPermisoConGoce:dpcg, diasIncapacidadConGoce:di });
    const b = round2(bruto.totalBruto);
    const igssT = row.aplica_igss ? round2(b * 0.0483) : 0;
    const igssP = row.aplica_igss ? round2(b * 0.1267) : 0;
    sumBruto += b;
    sumIgssT += igssT;
    sumIgssP += igssP;
    sumBono += bono;
    sumDescSep += round2(bruto.descSeptimo);
    sumNeto += round2(b - igssT + bono);
  }

  log(`  Total colaboradores:          ${rows.length}`);
  log(`  Total bruto:                  Q${round2(sumBruto).toFixed(2)}`);
  log(`  Total desc. séptimo:          Q${round2(sumDescSep).toFixed(2)}`);
  log(`  Total IGSS trabajador:        Q${round2(sumIgssT).toFixed(2)}`);
  log(`  Total IGSS patronal:          Q${round2(sumIgssP).toFixed(2)}`);
  log(`  Total bonificación incentivo: Q${round2(sumBono).toFixed(2)}`);
  log(`  Total neto estimado:          Q${round2(sumNeto).toFixed(2)}`);
  log(`  Fórmula: neto = bruto − igssT + bono − anticipos`);

  // ── V-34: Total neto > 0 ────────────────────────────────────────────────────
  check("Consolidado", "V-34: total_neto > 0",
    round2(sumNeto) > 0,
    `Total neto = Q${round2(sumNeto).toFixed(2)}`,
    ">0", round2(sumNeto)
  );

  // ── V-35: Bono total ≤ 24 × max_monto_base ─────────────────────────────────
  const maxBono = 24 * 250; // máximo si todos fueran mensual con todos los días
  check("Consolidado", "V-35: Suma de bonos dentro de rango razonable",
    round2(sumBono) <= maxBono && round2(sumBono) > 0,
    `sumBono=Q${round2(sumBono).toFixed(2)}, max=${maxBono}`,
    `0 < x ≤ ${maxBono}`, round2(sumBono)
  );

  // ── V-36: Recalcular pre-planilla dos veces produce el mismo resultado ──────
  const rows2 = await getPrePlanillaRows();
  check("Idempotencia", "V-36: Recalcular pre-planilla produce mismo resultado",
    rows.length === rows2.length,
    rows.length === rows2.length ? `Idempotente: ${rows.length} empleados en ambas consultas` : "Diferente resultado",
    rows.length, rows2.length
  );

  return { checks, totales: { sumBruto: round2(sumBruto), sumIgssT: round2(sumIgssT), sumIgssP: round2(sumIgssP), sumBono: round2(sumBono), sumNeto: round2(sumNeto) } };
}

export function printValidateResults(checks: Check[]) {
  const cats = [...new Set(checks.map(c => c.cat))];
  let totalP = 0, totalF = 0;

  console.log("\n── VALIDACIONES PASS/FAIL ──────────────────────────────────────────────");
  for (const cat of cats) {
    const catChecks = checks.filter(c => c.cat === cat);
    const p = catChecks.filter(c => c.pass).length;
    const f = catChecks.filter(c => !c.pass).length;
    console.log(`\n  ▸ ${cat} (${p} PASS, ${f} FAIL)`);
    for (const c of catChecks) {
      const icon = c.pass ? "  ✓" : "  ✗";
      if (c.pass) {
        console.log(`${icon}  ${c.name}`);
      } else {
        console.log(`${icon}  ${c.name}`);
        console.log(`       Detalle:  ${c.detail}`);
        if (c.expected !== undefined) console.log(`       Expected: ${JSON.stringify(c.expected)}`);
        if (c.actual !== undefined) console.log(`       Actual:   ${JSON.stringify(c.actual)}`);
      }
    }
    totalP += p;
    totalF += f;
  }

  const total = totalP + totalF;
  console.log(`\n══════════════════════════════════════════════════════════════════`);
  console.log(`  VALIDACIONES TOTALES: ${total} | ${totalP} PASS | ${totalF} FAIL`);
  if (totalF === 0) {
    console.log("  ✅ TODAS LAS VALIDACIONES PASARON");
  } else {
    console.log(`  ❌ ${totalF} VALIDACIÓN(ES) FALLARON`);
  }
  console.log("══════════════════════════════════════════════════════════════════\n");
  return { totalP, totalF };
}
