import { pool } from "@workspace/db";

async function main() {
  // 1. Reemplazar UNIQUE constraint por índice parcial (solo bloquea duplicados no-anulados)
  await pool.query(`ALTER TABLE pre_planilla_cierres DROP CONSTRAINT IF EXISTS pre_planilla_cierres_periodo_desde_periodo_hasta_key`);
  await pool.query(`DROP INDEX IF EXISTS idx_cierres_periodo_unico`);
  await pool.query(`
    CREATE UNIQUE INDEX idx_cierres_periodo_unico
    ON pre_planilla_cierres (periodo_desde, periodo_hasta)
    WHERE anulado = FALSE
  `);
  console.log("✅ Constraint reemplazado por índice parcial (solo activos)");

  // 2. Mostrar estado actual
  const { rows } = await pool.query(
    "SELECT id, anulado, total_estimado, periodo_desde, periodo_hasta FROM pre_planilla_cierres ORDER BY id"
  );
  console.log("Cierres en BD:", rows);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
