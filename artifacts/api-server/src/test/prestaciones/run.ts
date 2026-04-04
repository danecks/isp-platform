/**
 * run.ts — Orquestador de tests del módulo de Prestaciones
 *
 * Fases:
 *  1. Migración (verifica tablas creadas por auto-seed)
 *  2. Seed (5 empleados de prueba)
 *  3. Unit tests (lógica pura de cálculo)
 *  4. E2E tests (HTTP contra servidor real)
 *  5. Cleanup
 *  6. Reporte final
 */

import { pool } from "@workspace/db";
import { seedPrestaciones, cleanupPrestaciones, MARKER } from "./seed";
import { runUnitTests } from "./unit-tests";
import { runE2E } from "./e2e";

const SEP = "═".repeat(60);

async function verifyTables(): Promise<void> {
  const REQUIRED = [
    "prestaciones_config",
    "prestaciones_acumulados",
    "prestaciones_movimientos",
    "prestaciones_provisiones",
    "prestaciones_liquidaciones",
    "prestaciones_liquidacion_detalle",
    "vacaciones_saldos",
    "vacaciones_movimientos",
  ];

  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [REQUIRED]
  );

  const found = new Set(rows.map((r: { table_name: string }) => r.table_name));
  const missing = REQUIRED.filter(t => !found.has(t));

  if (missing.length > 0) {
    throw new Error(
      `❌ Faltan tablas de prestaciones: ${missing.join(", ")}.\n` +
      `   Reinicia el servidor para aplicar la migración PREST-01.`
    );
  }

  console.log("  ✅ Todas las tablas de prestaciones existen en la BD");
}

async function main() {
  console.log(`\n${SEP}`);
  console.log("  SUITE DE TESTS — MÓDULO PRESTACIONES");
  console.log(`  Marker: ${MARKER}`);
  console.log(`${SEP}\n`);

  // ── Fase 1: Verificar tablas ──────────────────────────────────────────────
  console.log("FASE 1 — Verificación de tablas\n");
  try {
    await verifyTables();
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }

  // ── Fase 2: Seed ──────────────────────────────────────────────────────────
  console.log("\nFASE 2 — Seed de datos de prueba\n");
  try {
    await seedPrestaciones();
    console.log("  ✅ Seed completado\n");
  } catch (err) {
    console.error("❌ Error en seed:", String(err));
    process.exit(1);
  }

  // ── Fase 3: Unit tests ────────────────────────────────────────────────────
  console.log("\nFASE 3 — Unit tests\n");
  const unitResult = await runUnitTests();

  // ── Fase 4: E2E tests ─────────────────────────────────────────────────────
  console.log("\nFASE 4 — E2E tests (HTTP)\n");
  const e2eResult = await runE2E();

  // ── Fase 5: Cleanup ───────────────────────────────────────────────────────
  console.log("\nFASE 5 — Cleanup\n");
  try {
    await cleanupPrestaciones();
    console.log("  ✅ Cleanup completado\n");
  } catch (err) {
    console.warn("  ⚠️  Cleanup parcial:", String(err));
  }

  // ── Reporte final ─────────────────────────────────────────────────────────
  const totalPass = unitResult.pass + e2eResult.pass;
  const totalFail = unitResult.fail + e2eResult.fail;
  const total     = totalPass + totalFail;

  console.log(`\n${SEP}`);
  console.log("  REPORTE FINAL");
  console.log(SEP);
  console.log(`  Unit Tests:  ${unitResult.pass}/${unitResult.pass + unitResult.fail} PASS`);
  console.log(`  E2E Tests:   ${e2eResult.pass}/${e2eResult.pass + e2eResult.fail} PASS`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL:       ${totalPass}/${total} PASS   ${totalFail > 0 ? "❌ " + totalFail + " FAIL" : "✅ TODOS PASARON"}`);
  console.log(SEP);

  if (totalFail > 0) {
    console.log("\n  FALLOS DETECTADOS:");
    for (const f of [...unitResult.failures, ...e2eResult.failures]) {
      console.log(`   ✗ ${f}`);
    }
    console.log();
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
