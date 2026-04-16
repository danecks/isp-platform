import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const adminResetRouter = Router();

// POST /api/admin/reset-produccion
// Limpia TODA la base de datos. Conserva únicamente:
//   • El usuario dan2336 (con su hash de contraseña original)
//   • La tabla system_config (se mantiene + se activa demo_seed_disabled)
// Después del reset el auto-seed NO volverá a crear datos de muestra.
adminResetRouter.post("/admin/reset-produccion", async (req, res) => {
  const { password } = req.body as { password?: string };

  if (password !== "RESET-ISP-2024") {
    return res.status(403).json({ error: "Contraseña incorrecta" });
  }

  try {
    // ── Verificar que dan2336 existe antes de cualquier cosa ─────────
    const { rows: adminCheck } = await pool.query(
      `SELECT id, username FROM users WHERE username = 'dan2336' LIMIT 1`,
    );
    if (adminCheck.length === 0) {
      return res.status(400).json({
        error:
          "El usuario dan2336 no existe en esta base de datos. Reset abortado para evitar quedarse sin acceso.",
      });
    }

    // ── Paso 0: contar registros antes (muestra de tablas clave) ─────
    const conteos: Record<string, number> = {};
    const tablasContar = [
      "employees",
      "clients",
      "puestos_operativos",
      "solicitudes_servicio_adicional",
      "planillas",
      "vehiculos",
      "armas",
      "eventos_rrhh",
      "barracas",
      "custodia_titulares",
      "empleados_periodos_laborales",
    ];
    for (const t of tablasContar) {
      try {
        const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${t}`);
        conteos[t] = parseInt(rows[0].n ?? "0", 10);
      } catch {
        conteos[t] = -1;
      }
    }

    // ── Paso 1: listar TODAS las tablas públicas excepto las que se conservan
    const { rows: allTables } = await pool.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('system_config', 'users')
      ORDER BY tablename
    `);
    const tableNames = allTables.map((r) => `"${r.tablename}"`).join(", ");

    // ── Paso 2: TRUNCATE CASCADE dinámico (respeta FKs, reinicia IDs)
    if (tableNames) {
      await pool.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE`);
    }

    // ── Paso 3: users — borrar todos excepto dan2336 ─────────────────
    await pool.query(`DELETE FROM users WHERE username <> 'dan2336'`);
    const { rows: usuariosRestantes } = await pool.query(
      `SELECT id, username, rol FROM users ORDER BY username`,
    );

    // ── Paso 4: asegurar system_config y activar anti-re-seed ────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES ('demo_seed_disabled', 'true', NOW())
      ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
    `);

    logger.warn(
      { conteos, usuariosRestantes, tablasLimpiadas: allTables.length },
      "Admin reset: base de datos limpiada (solo dan2336 conservado)",
    );

    res.json({
      ok: true,
      mensaje:
        "Base de datos limpiada. Solo queda el usuario dan2336. El auto-seed NO volverá a crear datos de prueba.",
      tablas_limpiadas_total: allTables.length,
      tablas_limpiadas: allTables.map((r) => r.tablename),
      tablas_conservadas: ["users (solo dan2336)", "system_config"],
      registros_antes: conteos,
      usuarios_restantes: usuariosRestantes.map((u) => ({
        id: u.id,
        username: u.username,
        rol: u.rol,
      })),
      ids_reiniciados: true,
    });
  } catch (err) {
    logger.error({ err }, "Admin reset: error");
    res.status(500).json({ error: String(err) });
  }
});

export default adminResetRouter;
