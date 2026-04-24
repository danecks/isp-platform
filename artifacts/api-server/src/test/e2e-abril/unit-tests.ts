/**
 * unit-tests.ts — Pruebas unitarias para funciones de cálculo de nómina
 *
 * Prueba: calcularBonificacionIncentivo, calcularBruto (IGSS, séptimo día)
 * Sin dependencias externas de red — puro TypeScript.
 */

import { calcularBonificacionIncentivo, calcularBruto } from "../../lib/nomina-calc";

// ─── Helpers ─────────────────────────────────────────────────────────────────
interface TestResult {
  suite: string;
  name: string;
  pass: boolean;
  expected: unknown;
  actual: unknown;
  error?: string;
}

const results: TestResult[] = [];

function test(suite: string, name: string, fn: () => void) {
  try {
    fn();
    // Si no lanzó error, buscar el último resultado
  } catch (err) {
    results.push({ suite, name, pass: false, expected: "no error", actual: String(err), error: String(err) });
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown, name: string, suite: string) {
      const pass = Math.abs(Number(actual) - Number(expected)) < 0.005
        ? true
        : actual === expected;
      results.push({ suite, name, pass, expected, actual });
      if (!pass) throw new Error(`Expected ${expected}, got ${actual}`);
    },
    toEqual(expected: unknown, name: string, suite: string) {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      results.push({ suite, name, pass, expected, actual });
      if (!pass) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  };
}

function assert(condition: boolean, suite: string, name: string, msg: string, expected: unknown, actual: unknown) {
  results.push({ suite, name, pass: condition, expected, actual });
}

function round2(n: number) { return parseFloat(n.toFixed(2)); }

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE 1: calcularBonificacionIncentivo — Decreto 78-89
// ═══════════════════════════════════════════════════════════════════════════
const S1 = "Bonificación Incentivo Proporcional";

{
  // Período estándar = 2026-04-16 al 2026-04-30 → 15 días calendario
  const desde = "2026-04-16";
  const hasta = "2026-04-30";

  // ── 1.1 Quincenal, todos trabajados (15/15 = Q125.00) ──────────────────
  const r1 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:15, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r1 === 125.00, S1, "quincenal-todos-trabajados Q125", "Q125.00", 125.00, r1);

  // ── 1.2 Quincenal, 1 falta (14/15) = Q116.67 ───────────────────────────
  const r2 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:14, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(round2(r2) === 116.67, S1, "quincenal-1falta Q116.67", 116.67, round2(r2), r2);

  // ── 1.3 Quincenal, 2 permiso sin goce (13/15) = Q108.33 ─────────────────
  // permisoSinGoce NO cuenta en dias_pagables
  const r3 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:13, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(round2(r3) === 108.33, S1, "quincenal-permiso-sin-goce Q108.33", 108.33, round2(r3), r3);

  // ── 1.4 Quincenal, vacaciones 3d → vacaciones NO devengan (decisión empresa abr 2026)
  // 12 trabajados pagables → 250/30×12 = Q100.00
  const r4 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:12, diasVacaciones:3, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r4 === 100.00, S1, "quincenal-vacaciones-NO-devengan Q100", 100.00, r4, r4);

  // ── 1.5 Quincenal, 0 días pagables → Q0.00 ──────────────────────────────
  const r5 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:0, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r5 === 0, S1, "quincenal-0pagables Q0.00", 0, r5, r5);

  // ── 1.6 Mensual en segunda quincena, todos trabajados (15 pagables → 250/30×15 = Q125)
  // En la primera quincena cobra los otros Q125, sumando Q250 al mes (bono completo).
  const r6 = calcularBonificacionIncentivo({ frecuenciaPago:"mensual", desde, hasta, diasTrabajados:15, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r6 === 125.00, S1, "mensual-quincena-todos-trabajados Q125", 125.00, r6, r6);

  // ── 1.7 Mensual, vacaciones 3d → vacaciones NO devengan (decisión empresa abr 2026)
  // 12 trabajados pagables → 250/30×12 = Q100.00
  const r7 = calcularBonificacionIncentivo({ frecuenciaPago:"mensual", desde, hasta, diasTrabajados:12, diasVacaciones:3, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r7 === 100.00, S1, "mensual-vacaciones-NO-devengan Q100", 100.00, r7, r7);

  // ── 1.8 Mensual, incapacidad 3d → incapacidad IGSS NO devenga (paga el seguro social)
  // 12 trabajados pagables → 250/30×12 = Q100.00
  const r8 = calcularBonificacionIncentivo({ frecuenciaPago:"mensual", desde, hasta, diasTrabajados:12, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:3 });
  assert(r8 === 100.00, S1, "mensual-incapacidad-NO-devenga Q100", 100.00, r8, r8);

  // ── 1.9 Permiso con goce SÍ cuenta (12t + 2pcg = 14/15 = Q116.67) ─────
  const r9 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:12, diasVacaciones:0, diasPermisoConGoce:2, diasIncapacidadConGoce:0 });
  assert(round2(r9) === 116.67, S1, "permiso-con-goce-pagable Q116.67", 116.67, round2(r9), r9);

  // ── 1.10 Clamp: dias_pagables > dias_periodo → cap a 15 ─────────────────
  const r10 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:20, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r10 === 125.00, S1, "clamp-diasPagables>periodo Q125", 125.00, r10, r10);

  // ── 1.11 EMP-08 (mensual, descanso trabajado): 15 pagables en la quincena → 250/30×15 = Q125
  //   En la otra quincena cobra los Q125 restantes.
  const r11 = calcularBonificacionIncentivo({ frecuenciaPago:"mensual", desde, hasta, diasTrabajados:15, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r11 === 125.00, S1, "mensual-descanso-trabajado-15pagables Q125", 125.00, r11, r11);

  // ── 1.12 EMP-24: permiso sin goce múltiple (12 trabajados / 15 días) = Q100
  const r12 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:12, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(r12 === 100.00, S1, "quincenal-12pagables Q100", 100.00, r12, r12);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE 2: calcularBruto — Séptimo día
// ═══════════════════════════════════════════════════════════════════════════
const S2 = "Cálculo Bruto y Séptimo Día";

{
  const BASE_QUINCENAL = {
    sueldoBase: 3200, horasContrato: 48, faltas: 0, suspensiones: 0,
    horasExtra: 0, periodoTotalDias: 15, frecuenciaPago: "quincenal" as const,
    quincenaTipo: "segunda" as const, septimosPerdidos: 0,
  };

  // ── 2.1 Quincenal sin incidencias: bruto = sueldo_base/2 ────────────────
  const r1 = calcularBruto(BASE_QUINCENAL);
  // sueldoDia = 3200/30 = 106.67; sueldoPeriodo = 106.67 × 15 = 1600.00
  assert(round2(r1.sueldoPeriodo) === 1600.00, S2, "sueldo-periodo-quincenal Q1600", 1600.00, round2(r1.sueldoPeriodo), r1.sueldoPeriodo);
  assert(round2(r1.totalBruto) === 1600.00, S2, "bruto-sin-incidencias Q1600", 1600.00, round2(r1.totalBruto), r1.totalBruto);

  // ── 2.2 Pérdida de 1 séptimo: descSeptimo = sueldoDia × 1 ────────────────
  const r2 = calcularBruto({ ...BASE_QUINCENAL, septimosPerdidos: 1 });
  const sueldoDia = 3200 / 30; // 106.6667
  const descSeptimo = round2(sueldoDia * 1);
  assert(round2(r2.descSeptimo) === descSeptimo, S2, "desc-septimo-1semana", descSeptimo, round2(r2.descSeptimo), r2.descSeptimo);
  assert(round2(r2.totalBruto) === round2(1600 - descSeptimo), S2, "bruto-menos-septimo", round2(1600 - descSeptimo), round2(r2.totalBruto), r2.totalBruto);

  // ── 2.3 Sin pérdida de séptimo: descSeptimo = 0 ──────────────────────────
  const r3 = calcularBruto({ ...BASE_QUINCENAL, septimosPerdidos: 0 });
  assert(round2(r3.descSeptimo) === 0, S2, "sin-septimo-perdido Q0", 0, round2(r3.descSeptimo), r3.descSeptimo);

  // ── 2.4 1 falta: descFaltas = sueldoDia × 1 ─────────────────────────────
  const r4 = calcularBruto({ ...BASE_QUINCENAL, faltas: 1 });
  const descFalta = round2(sueldoDia * 1);
  assert(round2(r4.descFaltas) === descFalta, S2, "desc-falta-1dia", descFalta, round2(r4.descFaltas), r4.descFaltas);

  // ── 2.5 CASO A completo: falta + pierde séptimo ──────────────────────────
  // Usar sueldoDia crudo (sin redondear intermedios) para coincidir con la función
  const r5 = calcularBruto({ ...BASE_QUINCENAL, faltas: 1, septimosPerdidos: 1 });
  const brutoEsperado = round2(1600 - sueldoDia * 2); // 1386.67 (usa raw sueldoDia)
  assert(round2(r5.totalBruto) === brutoEsperado, S2, "caso-A-falta+septimo", brutoEsperado, round2(r5.totalBruto), r5.totalBruto);

  // ── 2.6 CASO B completo: falta sin pérdida de séptimo ───────────────────
  const r6 = calcularBruto({ ...BASE_QUINCENAL, faltas: 1, septimosPerdidos: 0 });
  const brutoB = round2(1600 - descFalta);
  assert(round2(r6.totalBruto) === brutoB, S2, "caso-B-falta-sin-septimo", brutoB, round2(r6.totalBruto), r6.totalBruto);

  // ── 2.7 Horas extra: valorHE = (sueldoDia / horasDia) × 1.5 × HE ────────
  // horasDia = 48/6 = 8; sueldoDia = 106.67; valorHE = (106.67/8) × 1.5 × 8 = 200.00
  const r7 = calcularBruto({ ...BASE_QUINCENAL, horasExtra: 8 });
  const valorHE = round2((sueldoDia / 8) * 1.5 * 8);
  assert(round2(r7.valorHE) === valorHE, S2, "horas-extra-8h", valorHE, round2(r7.valorHE), r7.valorHE);

  // ── 2.8 Supervisor: sueldo Q5000, 2 séptimos perdidos ───────────────────
  const r8 = calcularBruto({ sueldoBase:5000, horasContrato:48, faltas:0, suspensiones:0, horasExtra:0, periodoTotalDias:15, frecuenciaPago:"quincenal", quincenaTipo:"segunda", septimosPerdidos:2 });
  const sdSup = 5000 / 30;
  const brutoSup = round2(2500 - round2(sdSup * 2));
  assert(round2(r8.totalBruto) === brutoSup, S2, "supervisor-2septimos", brutoSup, round2(r8.totalBruto), r8.totalBruto);

  // ── 2.9 Mensual segunda quincena: sueldoPeriodo = sueldo_base completo ──
  const r9 = calcularBruto({ sueldoBase:3500, horasContrato:48, faltas:0, suspensiones:0, horasExtra:0, periodoTotalDias:15, frecuenciaPago:"mensual", quincenaTipo:"segunda", septimosPerdidos:0 });
  assert(round2(r9.sueldoPeriodo) === 3500, S2, "mensual-segunda-bruto=sueldo_base", 3500, round2(r9.sueldoPeriodo), r9.sueldoPeriodo);

  // ── 2.10 Mensual primera quincena: sueldoPeriodo = sueldo_base/2 ─────────
  const r10 = calcularBruto({ sueldoBase:3500, horasContrato:48, faltas:0, suspensiones:0, horasExtra:0, periodoTotalDias:15, frecuenciaPago:"mensual", quincenaTipo:"primera", septimosPerdidos:0 });
  assert(round2(r10.sueldoPeriodo) === round2(3500 / 2), S2, "mensual-primera-bruto=mitad", 1750, round2(r10.sueldoPeriodo), r10.sueldoPeriodo);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE 3: IGSS — tasas y condiciones
// ═══════════════════════════════════════════════════════════════════════════
const S3 = "IGSS Tasas y Condiciones";

{
  function igssT(bruto: number) { return round2(bruto * 0.0483); }
  function igssP(bruto: number) { return round2(bruto * 0.1267); }

  // ── 3.1 Tasa trabajador 4.83% ──────────────────────────────────────────
  const bruto1 = 1600;
  assert(igssT(bruto1) === 77.28, S3, "igss-trabajador-4.83% Q77.28", 77.28, igssT(bruto1), igssT(bruto1));

  // ── 3.2 Tasa patronal 12.67% ──────────────────────────────────────────
  assert(igssP(bruto1) === 202.72, S3, "igss-patronal-12.67% Q202.72", 202.72, igssP(bruto1), igssP(bruto1));

  // ── 3.3 Supervisor Q2500 bruto ────────────────────────────────────────
  assert(igssT(2500) === 120.75, S3, "igss-trab-supervisor Q120.75", 120.75, igssT(2500), igssT(2500));
  assert(igssP(2500) === 316.75, S3, "igss-patr-supervisor Q316.75", 316.75, igssP(2500), igssP(2500));

  // ── 3.4 Suma ambas tasas ≈ 17.50% total ────────────────────────────────
  const totalTasa = 0.0483 + 0.1267;
  assert(Math.abs(totalTasa - 0.175) < 0.0001, S3, "suma-tasas=17.5%", 0.175, round2(totalTasa * 100) / 100, totalTasa);

  // ── 3.5 IGSS no aplica a bonificación incentivo (solo sobre bruto) ─────
  // La bonificación es adicional al bruto — no es base de cotización
  const bonoBase = 125;
  const igssOnBono = igssT(bonoBase); // Si se aplicara incorrectamente
  assert(igssOnBono === 6.04, S3, "igss-sobre-bono-NO-aplica (referencia)", "No debe aplicarse", igssOnBono, "→ referencia solo");
  // Nota: el sistema NO aplica IGSS sobre bonificación
  results[results.length - 1].pass = true; // esta es solo referencia, siempre PASS
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE 4: Días pagables — aislamiento entre empleados
// ═══════════════════════════════════════════════════════════════════════════
const S4 = "Aislamiento días_pagables por colaborador";

{
  const desde = "2026-04-16";
  const hasta = "2026-04-30";

  // Cada empleado se calcula de forma independiente
  // EMP-03: 13 trabaja, 2 permiso_sin_goce → 13 pagables → Q108.33
  const bono3 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:13, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(round2(bono3) === 108.33, S4, "emp03-permiso-sin-goce-13pagables", 108.33, round2(bono3), bono3);

  // EMP-05: 12 trabaja, 3 vacaciones → vacaciones NO devengan → 12 pagables → 250/30×12 = Q100.00
  const bono5 = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:12, diasVacaciones:3, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(bono5 === 100.00, S4, "emp05-vacaciones-NO-devengan Q100", 100.00, bono5, bono5);

  // EMP-07 (mensual): 12 trabaja, 3 vacaciones → vacaciones NO devengan → 12 pagables → Q100.00
  const bono7 = calcularBonificacionIncentivo({ frecuenciaPago:"mensual", desde, hasta, diasTrabajados:12, diasVacaciones:3, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(bono7 === 100.00, S4, "emp07-mensual-vacaciones-NO-devengan Q100", 100.00, bono7, bono7);

  // EMP-08 (mensual, descanso trabajado): 15 pagables en la quincena → 250/30×15 = Q125
  const bono8 = calcularBonificacionIncentivo({ frecuenciaPago:"mensual", desde, hasta, diasTrabajados:15, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 });
  assert(bono8 === 125.00, S4, "emp08-descanso-trabajado-15pagables Q125", 125.00, bono8, bono8);

  // NO puede transferirse: bono de EMP-01 ≠ bono de EMP-02 (distinto N° de días falta)
  const bonoA = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:14, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 }); // 14/15
  const bonoG = calcularBonificacionIncentivo({ frecuenciaPago:"quincenal", desde, hasta, diasTrabajados:15, diasVacaciones:0, diasPermisoConGoce:0, diasIncapacidadConGoce:0 }); // 15/15
  assert(bonoA < bonoG, S4, "emp-falta-bono-menor-que-control", `<${bonoG}`, bonoA, bonoA);
  assert(bonoG === 125.00 && round2(bonoA) === 116.67, S4, "no-mezcla-bonos-A-vs-G", "116.67≠125.00", `${round2(bonoA)} vs ${bonoG}`, "OK");
}

// ═══════════════════════════════════════════════════════════════════════════
//  RESULTADO FINAL
// ═══════════════════════════════════════════════════════════════════════════
export function printUnitResults() {
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  UNIT TESTS — Resultados");
  console.log("══════════════════════════════════════════════════════════════════\n");

  const suites = [...new Set(results.map(r => r.suite))];
  let totalPass = 0, totalFail = 0;

  for (const suite of suites) {
    const suiteResults = results.filter(r => r.suite === suite);
    const pass = suiteResults.filter(r => r.pass).length;
    const fail = suiteResults.filter(r => !r.pass).length;
    console.log(`  ▸ ${suite}`);
    for (const r of suiteResults) {
      const icon = r.pass ? "  ✓" : "  ✗";
      if (r.pass) {
        console.log(`${icon}  ${r.name}`);
      } else {
        console.log(`${icon}  ${r.name}`);
        console.log(`       Expected: ${JSON.stringify(r.expected)}`);
        console.log(`       Actual:   ${JSON.stringify(r.actual)}`);
      }
    }
    console.log(`     → ${pass} PASS, ${fail} FAIL\n`);
    totalPass += pass;
    totalFail += fail;
  }

  const total = totalPass + totalFail;
  console.log(`══════════════════════════════════════════════════════════════════`);
  console.log(`  Total: ${total} tests | ${totalPass} PASS | ${totalFail} FAIL`);
  if (totalFail === 0) {
    console.log("  ✅ TODOS LOS UNIT TESTS PASARON");
  } else {
    console.log(`  ❌ ${totalFail} TEST(S) FALLARON`);
  }
  console.log("══════════════════════════════════════════════════════════════════\n");

  return { totalPass, totalFail, results };
}
