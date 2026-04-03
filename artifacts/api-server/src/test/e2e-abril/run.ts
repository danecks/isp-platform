/**
 * run.ts — Orquestador del test integral E2E: Segunda Quincena de Abril 2026
 *
 * Uso:
 *   pnpm --filter @workspace/api-server test:e2e-payroll-april
 *
 * Secuencia:
 *   1. Seed — crea datos de prueba
 *   2. Unit tests — valida funciones de cálculo
 *   3. Validaciones E2E — verifica integridad con datos reales
 *
 * Salida:
 *   Informe consolidado PASS/FAIL en consola
 */

import { runSeed } from "./seed";
import { printUnitResults } from "./unit-tests";
import { runValidate, printValidateResults } from "./validate";

async function main() {
  const start = Date.now();

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║     PRUEBA INTEGRAL E2E — NÓMINA SEGUNDA QUINCENA ABRIL 2026      ║");
  console.log("║     Período: 2026-04-16 → 2026-04-30  (15 días calendario)        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  // ── FASE 1: Seed ──────────────────────────────────────────────────────────
  console.log("\n▶ FASE 1 — Creando datos de prueba (seed)...");
  try {
    await runSeed(true);
    console.log("  ✅ Seed completado\n");
  } catch (err) {
    console.error("  ❌ SEED FALLÓ:", err);
    process.exit(1);
  }

  // ── FASE 2: Unit Tests ────────────────────────────────────────────────────
  console.log("\n▶ FASE 2 — Unit Tests (funciones de cálculo)...");
  const unitResult = printUnitResults();

  // ── FASE 3: Validaciones E2E ──────────────────────────────────────────────
  console.log("\n▶ FASE 3 — Validaciones E2E (integridad de datos en BD)...");
  let e2eResult: ReturnType<typeof printValidateResults>;
  try {
    const { checks, totales } = await runValidate(true);
    e2eResult = printValidateResults(checks);

    console.log("\n── TOTALES DE PLANILLA (calculados desde datos reales) ─────────────");
    console.log(`  Total bruto:              Q${totales.sumBruto.toFixed(2)}`);
    console.log(`  Total IGSS trabajador:    Q${totales.sumIgssT.toFixed(2)}`);
    console.log(`  Total IGSS patronal:      Q${totales.sumIgssP.toFixed(2)}`);
    console.log(`  Total bonificación:       Q${totales.sumBono.toFixed(2)}`);
    console.log(`  Total neto estimado:      Q${totales.sumNeto.toFixed(2)}`);
  } catch (err) {
    console.error("  ❌ VALIDACIONES FALLARON CON ERROR:", err);
    process.exit(1);
  }

  // ── Resumen final ────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const totalPass = unitResult.totalPass + e2eResult.totalP;
  const totalFail = unitResult.totalFail + e2eResult.totalF;
  const totalTests = totalPass + totalFail;

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  RESUMEN FINAL                                                     ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  console.log(`║  Unit tests:    ${String(unitResult.totalPass).padStart(3)} PASS  ${String(unitResult.totalFail).padStart(2)} FAIL                              ║`);
  console.log(`║  Validaciones:  ${String(e2eResult.totalP).padStart(3)} PASS  ${String(e2eResult.totalF).padStart(2)} FAIL                              ║`);
  console.log(`║  TOTAL:         ${String(totalPass).padStart(3)} PASS  ${String(totalFail).padStart(2)} FAIL  (${totalTests} tests en ${elapsed}s)          ║`);
  console.log("╠══════════════════════════════════════════════════════════════════╣");

  if (totalFail === 0) {
    console.log("║  ✅  TODAS LAS PRUEBAS PASARON — sistema íntegro                    ║");
  } else {
    console.log(`║  ❌  ${totalFail} PRUEBA(S) FALLARON — revisar detalles arriba           ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
