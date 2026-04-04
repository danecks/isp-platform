/**
 * unit-tests.ts — Tests unitarios del motor de cálculo de prestaciones
 *
 * Tests:
 *  UT-001…010  Aguinaldo
 *  UT-011…020  Bono 14
 *  UT-021…030  Vacaciones
 *  UT-031…040  Indemnización
 *  UT-041…050  Liquidación final + provisiones
 */

import {
  calcularAguinaldo,
  calcularBono14,
  calcularIndemnizacion,
  calcularLiquidacionFinal,
  calcularProvisionPeriodo,
  calcularVacacionesDevengadas,
  calcularVacacionesPago,
  calcularVacacionesSaldo,
  diasEntreFechas,
  diasLaboradosEnPeriodo,
  periodoAguinaldoGuatemala,
  periodoBono14Guatemala,
} from "../../lib/prestaciones-calc";

// ─── Runner ───────────────────────────────────────────────────────────────────
let PASS = 0;
let FAIL = 0;
const FAILURES: string[] = [];

function assert(id: string, description: string, actual: unknown, expected: unknown, tolerance = 0) {
  const pass =
    typeof expected === "number" && typeof actual === "number"
      ? Math.abs(actual - expected) <= tolerance
      : actual === expected;

  if (pass) {
    PASS++;
    console.log(`  ✅ ${id} ${description}`);
  } else {
    FAIL++;
    FAILURES.push(`${id} ${description} — esperado: ${expected}, obtenido: ${actual}`);
    console.log(`  ❌ ${id} ${description} — esperado: ${expected}, obtenido: ${actual}`);
  }
}

function assertBool(id: string, description: string, cond: boolean) {
  if (cond) {
    PASS++;
    console.log(`  ✅ ${id} ${description}`);
  } else {
    FAIL++;
    FAILURES.push(`${id} ${description} — condición falsa`);
    console.log(`  ❌ ${id} ${description} — condición falsa`);
  }
}

export async function runUnitTests(): Promise<{ pass: number; fail: number; failures: string[] }> {
  PASS = 0; FAIL = 0; FAILURES.length = 0;

  console.log("\n=== UNIT TESTS — MÓDULO PRESTACIONES ===\n");

  // ── Utilidades de fecha ───────────────────────────────────────────────────
  console.log("— Utilidades de fecha");
  assert("UT-000a", "diasEntreFechas mismo día = 1", diasEntreFechas("2026-01-01", "2026-01-01"), 1);
  assert("UT-000b", "diasEntreFechas abril = 30", diasEntreFechas("2026-04-01", "2026-04-30"), 30);
  assert("UT-000c", "diasLaboradosEnPeriodo ingreso en medio del período",
    diasLaboradosEnPeriodo("2026-04-16", "2026-04-01", "2026-04-30"), 15);
  assert("UT-000d", "periodoAguinaldoGuatemala 2026",
    periodoAguinaldoGuatemala(2026).inicio, "2025-12-01");
  assert("UT-000e", "periodoBono14Guatemala 2026",
    periodoBono14Guatemala(2026).inicio, "2025-07-01");

  // ── UT-001…010: Aguinaldo ─────────────────────────────────────────────────
  console.log("\n— UT-001…010: Aguinaldo");

  // UT-001: Año completo
  {
    const r = calcularAguinaldo({
      sueldoMensual:  3_000,
      fechaIngreso:   "2024-12-01",
      periodoInicio:  "2025-12-01",
      periodoFin:     "2026-11-30",
    });
    assert("UT-001", "Aguinaldo año completo = sueldo mensual", r.montoTotal, 3_000, 0.01);
    assert("UT-001b", "Aguinaldo año completo esAnioCompleto=true", r.esAnioCompleto, true);
  }

  // UT-002: Proporcional — 6 meses trabajados (Jul→Dic inclusive)
  {
    const r = calcularAguinaldo({
      sueldoMensual:  3_000,
      fechaIngreso:   "2026-06-01",   // entra a mitad del período
      periodoInicio:  "2025-12-01",
      periodoFin:     "2026-11-30",
      fechaEgreso:    "2026-11-30",
    });
    // Jun 1 – Nov 30 = 183 días de período restante
    const diasPer  = diasEntreFechas("2025-12-01", "2026-11-30");
    const diasLab  = diasLaboradosEnPeriodo("2026-06-01", "2025-12-01", "2026-11-30", "2026-11-30");
    const esperado = parseFloat((3_000 * diasLab / diasPer).toFixed(2));
    assert("UT-002", `Aguinaldo proporcional (${diasLab}/${diasPer} días)`, r.montoTotal, esperado, 0.01);
    assert("UT-002b", "esAnioCompleto=false", r.esAnioCompleto, false);
  }

  // UT-003: Promedio usado cuando config = promedio_periodo
  {
    const r = calcularAguinaldo({
      sueldoMensual:  3_000,
      promedioSalario:3_200,
      fechaIngreso:   "2024-12-01",
      periodoInicio:  "2025-12-01",
      periodoFin:     "2026-11-30",
      config:         { aguinaldoBase: "promedio_periodo" },
    });
    assert("UT-003", "Aguinaldo con promedio usa 3200 (no 3000)", r.salarioReferencia, 3_200);
    assert("UT-003b", "Monto usa promedio", r.montoTotal, 3_200, 0.01);
  }

  // UT-004: Sin promedio y config=promedio_periodo → usa sueldo actual
  {
    const r = calcularAguinaldo({
      sueldoMensual:  2_500,
      fechaIngreso:   "2024-12-01",
      periodoInicio:  "2025-12-01",
      periodoFin:     "2026-11-30",
      config:         { aguinaldoBase: "promedio_periodo" },
    });
    assert("UT-004", "Sin promedio → fallback a sueldo actual", r.salarioReferencia, 2_500);
  }

  // UT-005: Ingreso posterior a fin de período → 0 días
  {
    const r = calcularAguinaldo({
      sueldoMensual:  3_000,
      fechaIngreso:   "2027-01-01",
      periodoInicio:  "2025-12-01",
      periodoFin:     "2026-11-30",
    });
    assert("UT-005", "Ingreso fuera del período → diasLaborados=0", r.diasLaborados, 0);
    assert("UT-005b", "Monto = 0", r.montoTotal, 0);
  }

  // ── UT-011…020: Bono 14 ───────────────────────────────────────────────────
  console.log("\n— UT-011…020: Bono 14 (Decreto 42-92)");

  // UT-011: Año completo
  {
    const r = calcularBono14({
      sueldoMensual:  2_800,
      promedioSalario:2_800,
      fechaIngreso:   "2024-07-01",
      periodoInicio:  "2025-07-01",
      periodoFin:     "2026-06-30",
    });
    assert("UT-011", "Bono14 año completo = promedio mensual", r.montoTotal, 2_800, 0.01);
  }

  // UT-012: Proporcional 3 meses
  {
    const r = calcularBono14({
      sueldoMensual:  2_800,
      promedioSalario:2_800,
      fechaIngreso:   "2026-04-01",
      periodoInicio:  "2025-07-01",
      periodoFin:     "2026-06-30",
    });
    const diasPer  = diasEntreFechas("2025-07-01", "2026-06-30");
    const diasLab  = diasLaboradosEnPeriodo("2026-04-01", "2025-07-01", "2026-06-30");
    const esperado = parseFloat((2_800 * diasLab / diasPer).toFixed(2));
    assert("UT-012", `Bono14 proporcional (${diasLab}/${diasPer})`, r.montoTotal, esperado, 0.01);
  }

  // UT-013: Config salario_actual ignora promedio
  {
    const r = calcularBono14({
      sueldoMensual:  2_800,
      promedioSalario:3_500,
      fechaIngreso:   "2024-07-01",
      periodoInicio:  "2025-07-01",
      periodoFin:     "2026-06-30",
      config:         { bono14Base: "salario_actual" },
    });
    assert("UT-013", "Config salario_actual usa sueldo 2800 (no promedio 3500)", r.salarioReferencia, 2_800);
  }

  // UT-014: Sueldo variable → promedio menor
  {
    const r = calcularBono14({
      sueldoMensual:  3_000,
      promedioSalario:2_600,
      fechaIngreso:   "2024-07-01",
      periodoInicio:  "2025-07-01",
      periodoFin:     "2026-06-30",
      config:         { bono14Base: "promedio_periodo" },
    });
    assert("UT-014", "Promedio menor que sueldo actual → usa promedio", r.salarioReferencia, 2_600);
    assert("UT-014b", "Monto = promedio para año completo", r.montoTotal, 2_600, 0.01);
  }

  // ── UT-021…030: Vacaciones ────────────────────────────────────────────────
  console.log("\n— UT-021…030: Vacaciones");

  // UT-021: Devengadas primer año (15 días/365)
  {
    const r = calcularVacacionesDevengadas({ diasTrabajados: 365, aniosServicio: 0 });
    assert("UT-021", "365 días trabajados primer año = 15 días ganados", r.diasGanados, 15, 0.001);
    assert("UT-021b", "Tasa anual = 15", r.tasaAnual, 15);
  }

  // UT-022: Devengadas quinquenio (20 días/365)
  {
    const r = calcularVacacionesDevengadas({ diasTrabajados: 365, aniosServicio: 5 });
    assert("UT-022", "365 días quinquenio = 20 días ganados", r.diasGanados, 20, 0.001);
    assert("UT-022b", "Tasa anual = 20", r.tasaAnual, 20);
  }

  // UT-023: Proporcional — 180 días en primer año
  {
    const r = calcularVacacionesDevengadas({ diasTrabajados: 180, aniosServicio: 0 });
    const esp = parseFloat((180 * 15 / 365).toFixed(6));
    assert("UT-023", `180 días → ${esp} días ganados`, r.diasGanados, esp, 0.0001);
  }

  // UT-024: Saldo = ganados - gozados
  {
    const r = calcularVacacionesSaldo({ diasGanados: 12.5, diasGozados: 7 });
    assert("UT-024", "Saldo = 12.5 - 7 = 5.5", r.diasDisponibles, 5.5, 0.001);
  }

  // UT-025: Saldo mínimo 0 (gozados > ganados)
  {
    const r = calcularVacacionesSaldo({ diasGanados: 5, diasGozados: 8 });
    assert("UT-025", "Saldo no negativo cuando gozados > ganados", r.diasDisponibles, 0);
  }

  // UT-026: Pago de vacaciones (sueldoDia × dias)
  {
    const r = calcularVacacionesPago({ sueldoMensual: 3_000, diasVacaciones: 15 });
    assert("UT-026", "Pago 15 días = 3000/30×15 = 1500", r.montoPago, 1_500, 0.01);
  }

  // UT-027: Pago proporcional
  {
    const r = calcularVacacionesPago({ sueldoMensual: 2_400, diasVacaciones: 7.5 });
    const esp = parseFloat((2_400 / 30 * 7.5).toFixed(2));
    assert("UT-027", `Pago proporcional 7.5 días = ${esp}`, r.montoPago, esp, 0.01);
  }

  // ── UT-031…040: Indemnización ─────────────────────────────────────────────
  console.log("\n— UT-031…040: Indemnización");

  // UT-031: Renuncia → 0
  {
    const r = calcularIndemnizacion({
      sueldoMensual:  3_000,
      fechaIngreso:   "2021-01-01",
      fechaEgreso:    "2026-01-01",
      causalEgreso:   "renuncia",
    });
    assert("UT-031", "Renuncia → indemnización = 0", r.montoTotal, 0);
    assert("UT-031b", "aplicaIndemnizacion = false", r.aplicaIndemnizacion, false);
  }

  // UT-032: Despido justificado → 0
  {
    const r = calcularIndemnizacion({
      sueldoMensual:  3_000,
      fechaIngreso:   "2021-01-01",
      fechaEgreso:    "2026-01-01",
      causalEgreso:   "despido_justificado",
    });
    assert("UT-032", "Despido justificado → indemnización = 0", r.montoTotal, 0);
  }

  // UT-033: Despido injustificado — 5 años exactos
  {
    const r = calcularIndemnizacion({
      sueldoMensual:  3_000,
      fechaIngreso:   "2021-01-01",
      fechaEgreso:    "2026-01-01",
      causalEgreso:   "despido_injustificado",
    });
    // 5 años exactos (1826 días en período con 2024 bisiesto)
    const esperado = parseFloat((3_000 * r.aniosDecimal).toFixed(2));
    assertBool("UT-033", "Despido injustificado → aplicaIndemnizacion=true", r.aplicaIndemnizacion);
    assert("UT-033b", "Monto proporcional correcto", r.montoTotal, esperado, 0.01);
  }

  // UT-034: Indemnización con promedio < sueldo actual
  {
    const r = calcularIndemnizacion({
      sueldoMensual:          3_000,
      promedioUltimos6Meses:  2_800,
      fechaIngreso:           "2023-01-01",
      fechaEgreso:            "2026-01-01",
      causalEgreso:           "despido_injustificado",
    });
    assert("UT-034", "Usa promedio de 6 meses (2800)", r.salarioReferencia, 2_800);
  }

  // UT-035: Proporcional por meses (menos de 1 año)
  {
    const r = calcularIndemnizacion({
      sueldoMensual:  2_400,
      fechaIngreso:   "2025-07-01",
      fechaEgreso:    "2026-01-01",
      causalEgreso:   "despido_injustificado",
    });
    // ~184 días / 365 ≈ 0.5041 años
    assertBool("UT-035", "Fracción de año < 1", r.aniosDecimal < 1);
    assertBool("UT-035b", "Monto > 0", r.montoTotal > 0);
  }

  // UT-036: Mutuo acuerdo → sin indemnización legal
  {
    const r = calcularIndemnizacion({
      sueldoMensual:  3_000,
      fechaIngreso:   "2021-01-01",
      fechaEgreso:    "2026-01-01",
      causalEgreso:   "mutuo_acuerdo",
    });
    assert("UT-036", "Mutuo acuerdo → 0", r.montoTotal, 0);
  }

  // ── UT-041…050: Liquidación final + provisiones ────────────────────────────
  console.log("\n— UT-041…050: Liquidación final y provisiones");

  // UT-041: Liquidación renuncia — sin indemnización, con prestaciones prop.
  {
    const r = calcularLiquidacionFinal({
      sueldoMensual:            3_000,
      fechaIngreso:             "2022-01-01",
      fechaEgreso:              "2026-07-15",
      causalEgreso:             "renuncia",
      diasSalarioPendiente:     15,
      diasVacacionesPendientes: 10,
      periodoAguinaldoInicio:   "2025-12-01",
      periodoAguinaldoFin:      "2026-11-30",
      periodoBono14Inicio:      "2025-07-01",
      periodoBono14Fin:         "2026-06-30",
    });
    assert("UT-041", "Indemnización = 0 (renuncia)", r.totalIndemnizacion, 0);
    assertBool("UT-041b", "Aguinaldo proporcional > 0", r.totalAguinaldo > 0);
    assertBool("UT-041c", "Bono14 proporcional > 0", r.totalBono14 > 0);
    assert("UT-041d", "Vacaciones = 10 × (3000/30) = 1000", r.totalVacaciones, 1_000, 0.01);
    assert("UT-041e", "Salario pendiente = 15 × (3000/30) = 1500", r.totalSalarioPendiente, 1_500, 0.01);
  }

  // UT-042: Liquidación despido injustificado — incluye indemnización
  {
    const r = calcularLiquidacionFinal({
      sueldoMensual:            4_000,
      fechaIngreso:             "2021-03-01",
      fechaEgreso:              "2026-03-01",
      causalEgreso:             "despido_injustificado",
      diasSalarioPendiente:     10,
      diasVacacionesPendientes: 5,
      periodoAguinaldoInicio:   "2025-12-01",
      periodoAguinaldoFin:      "2026-11-30",
      periodoBono14Inicio:      "2025-07-01",
      periodoBono14Fin:         "2026-06-30",
    });
    assertBool("UT-042", "Indemnización > 0 (despido injustificado)", r.totalIndemnizacion > 0);
    assertBool("UT-042b", "Total general > indemnización sola", r.totalGeneral > r.totalIndemnizacion);
    assertBool("UT-042c", "Tiene 5 rubros", r.rubros.length === 5);
  }

  // UT-043: Total general = suma de rubros
  {
    const r = calcularLiquidacionFinal({
      sueldoMensual:            3_500,
      fechaIngreso:             "2023-06-15",
      fechaEgreso:              "2026-06-14",
      causalEgreso:             "despido_injustificado",
      diasSalarioPendiente:     7,
      diasVacacionesPendientes: 8,
      periodoAguinaldoInicio:   "2025-12-01",
      periodoAguinaldoFin:      "2026-11-30",
      periodoBono14Inicio:      "2025-07-01",
      periodoBono14Fin:         "2026-06-30",
    });
    const sumaRubros = parseFloat(r.rubros.reduce((a, b) => a + b.monto, 0).toFixed(2));
    assert("UT-043", "totalGeneral = suma de rubros", r.totalGeneral, sumaRubros, 0.01);
  }

  // UT-044: Provisión aguinaldo — 15 días de nómina
  {
    const r = calcularProvisionPeriodo({ sueldoMensual: 3_000, diasPeriodo: 15, tipo: "aguinaldo" });
    const esp = parseFloat((3_000 * 15 / 365).toFixed(2));
    assert("UT-044", `Provisión aguinaldo 15 días = ${esp}`, r.montoProvision, esp, 0.01);
  }

  // UT-045: Provisión bono14 — quincena
  {
    const r = calcularProvisionPeriodo({ sueldoMensual: 2_800, diasPeriodo: 15, tipo: "bono14" });
    const esp = parseFloat((2_800 * 15 / 365).toFixed(2));
    assert("UT-045", `Provisión bono14 15 días = ${esp}`, r.montoProvision, esp, 0.01);
  }

  // UT-046: Provisión vacaciones primer año (15 días/año)
  {
    const r = calcularProvisionPeriodo({ sueldoMensual: 3_000, diasPeriodo: 15, tipo: "vacaciones", aniosServicio: 0 });
    // costo = (3000/30)*15 = 1500/año → 1500×15/365
    const costoAnual = (3_000 / 30) * 15;
    const esp = parseFloat((costoAnual * 15 / 365).toFixed(2));
    assert("UT-046", `Provisión vacaciones primer año 15 días = ${esp}`, r.montoProvision, esp, 0.01);
  }

  // UT-047: Provisión vacaciones quinquenio (20 días/año)
  {
    const r = calcularProvisionPeriodo({ sueldoMensual: 3_000, diasPeriodo: 15, tipo: "vacaciones", aniosServicio: 5 });
    const costoAnual = (3_000 / 30) * 20;
    const esp = parseFloat((costoAnual * 15 / 365).toFixed(2));
    assert("UT-047", `Provisión vacaciones quinquenio 15 días = ${esp}`, r.montoProvision, esp, 0.01);
  }

  // UT-048: Provisión indemnización — 15 días
  {
    const r = calcularProvisionPeriodo({ sueldoMensual: 3_000, diasPeriodo: 15, tipo: "indemnizacion" });
    const esp = parseFloat((3_000 * 15 / 365).toFixed(2));
    assert("UT-048", `Provisión indemnización 15 días = ${esp}`, r.montoProvision, esp, 0.01);
  }

  // UT-049: Liquidación con promedio < sueldo actual
  {
    const r = calcularLiquidacionFinal({
      sueldoMensual:            4_000,
      promedioUltimos6Meses:    3_600,
      fechaIngreso:             "2020-01-01",
      fechaEgreso:              "2026-01-01",
      causalEgreso:             "despido_injustificado",
      diasSalarioPendiente:     0,
      diasVacacionesPendientes: 0,
      periodoAguinaldoInicio:   "2025-12-01",
      periodoAguinaldoFin:      "2026-11-30",
      periodoBono14Inicio:      "2025-07-01",
      periodoBono14Fin:         "2026-06-30",
    });
    // El rubro de indemnización debe usar el promedio (3600)
    const rubIndem = r.rubros.find(rb => rb.rubro === "indemnizacion");
    assert("UT-049", "Indemnización usa promedio 3600", rubIndem?.salarioReferencia, 3_600);
  }

  // UT-050: Idempotencia — mismo input → mismo resultado
  {
    const params = {
      sueldoMensual: 3_200, promedioSalario: 3_200,
      fechaIngreso: "2025-01-01",
      periodoInicio: "2025-12-01", periodoFin: "2026-11-30",
    };
    const r1 = calcularAguinaldo(params);
    const r2 = calcularAguinaldo(params);
    assert("UT-050", "Idempotencia: mismo resultado dos llamadas", r1.montoTotal, r2.montoTotal);
  }

  return { pass: PASS, fail: FAIL, failures: FAILURES.slice() };
}
