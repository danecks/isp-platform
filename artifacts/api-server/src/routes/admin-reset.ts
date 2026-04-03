import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const adminResetRouter = Router();

// POST /api/admin/reset-produccion
// Limpia TODOS los datos operativos dejando solo los usuarios dan2336 y admin.
// Después de este reset el auto-seed NO volverá a crear datos de muestra.
adminResetRouter.post("/admin/reset-produccion", async (req, res) => {
  const { password } = req.body as { password?: string };

  if (password !== "RESET-ISP-2024") {
    return res.status(403).json({ error: "Contraseña incorrecta" });
  }

  try {
    const conteos: Record<string, number> = {};

    // ── Paso 0: contar registros antes del borrado ─────────────────────
    const tablasContar = [
      "employees", "clients", "puestos_operativos", "solicitudes_servicio_adicional",
      "planillas", "vehiculos", "armas", "eventos_rrhh",
    ];
    for (const t of tablasContar) {
      try {
        const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${t}`);
        conteos[t] = parseInt(rows[0].n ?? "0", 10);
      } catch {
        conteos[t] = -1;
      }
    }

    // ── Paso 1: tablas de nómina y planilla ───────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        planilla_lineas,
        planillas,
        pre_planilla_auditoria,
        pre_planilla_cierres,
        pre_planilla_revision,
        novedades_nomina_diarias,
        anticipos
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 2: cobertura y operaciones ───────────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        cobertura_segmentos,
        cobertura_diaria,
        cierre_operativo_diario,
        cierre_auditoria,
        movimientos_operativos,
        incentivos_cash_cobertura
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 3: RRHH ──────────────────────────────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        eventos_rrhh,
        rrhh_alertas
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 4: SSA y planificación futura ───────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        ssa_agentes,
        solicitudes_servicio_adicional,
        planificacion_futura
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 5: solicitudes de cambio ─────────────────────────────────
    await pool.query(`
      TRUNCATE TABLE solicitudes_cambio_operativo RESTART IDENTITY CASCADE
    `);

    // ── Paso 6: titularidad y asignaciones ────────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        puesto_titular_historico,
        employee_operational_assignments
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 7: puestos ───────────────────────────────────────────────
    await pool.query(`TRUNCATE TABLE puestos_operativos RESTART IDENTITY CASCADE`);

    // ── Paso 8: armería ───────────────────────────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        arma_custodia,
        armas
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 9: vehículos ─────────────────────────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        vehiculo_custodia,
        vehiculos
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 10: empleados y contratos ────────────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        contratos_empleados,
        agent_assignments
      RESTART IDENTITY CASCADE
    `);
    await pool.query(`TRUNCATE TABLE employees RESTART IDENTITY CASCADE`);

    // ── Paso 11: tareas, leads, aplicaciones, incidentes ─────────────
    await pool.query(`
      TRUNCATE TABLE
        task_evidencias,
        tareas,
        leads,
        applications,
        incidents
      RESTART IDENTITY CASCADE
    `);

    // ── Paso 12: clientes y alias ─────────────────────────────────────
    await pool.query(`
      TRUNCATE TABLE
        client_aliases,
        position_aliases,
        service_locations,
        client_sedes
      RESTART IDENTITY CASCADE
    `);
    await pool.query(`TRUNCATE TABLE clients RESTART IDENTITY CASCADE`);

    // ── Paso 13: usuarios — conservar solo dan2336 y admin ────────────
    await pool.query(`
      DELETE FROM users
      WHERE username NOT IN ('dan2336', 'admin')
    `);
    const { rows: usuariosRestantes } = await pool.query(
      `SELECT id, username, rol FROM users ORDER BY username`,
    );

    // ── Paso 14: marcar seed como bloqueado ────────────────────────────
    // Crea tabla system_config si no existe y activa el flag anti-re-seed
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

    logger.info({ conteos, usuariosRestantes }, "Admin reset: base de datos limpiada");

    res.json({
      ok: true,
      mensaje: "Sistema limpiado. Solo quedan los usuarios dan2336 y admin. El auto-seed NO volverá a crear datos de prueba.",
      tablas_limpiadas: {
        nomina: ["planilla_lineas", "planillas", "pre_planilla_auditoria", "pre_planilla_cierres", "pre_planilla_revision", "novedades_nomina_diarias", "anticipos"],
        cobertura: ["cobertura_segmentos", "cobertura_diaria", "cierre_operativo_diario", "cierre_auditoria", "movimientos_operativos", "incentivos_cash_cobertura"],
        rrhh: ["eventos_rrhh", "rrhh_alertas"],
        ssa: ["ssa_agentes", "solicitudes_servicio_adicional", "planificacion_futura"],
        puestos: ["puestos_operativos", "puesto_titular_historico", "employee_operational_assignments", "solicitudes_cambio_operativo"],
        armeria: ["arma_custodia", "armas"],
        vehiculos: ["vehiculo_custodia", "vehiculos"],
        personal: ["contratos_empleados", "agent_assignments", "employees"],
        misc: ["task_evidencias", "tareas", "leads", "applications", "incidents"],
        clientes: ["client_aliases", "position_aliases", "service_locations", "client_sedes", "clients"],
      },
      registros_antes: conteos,
      usuarios_restantes: usuariosRestantes.map((u) => ({ id: u.id, username: u.username, rol: u.rol })),
      ids_reiniciados: true,
    });
  } catch (err) {
    logger.error({ err }, "Admin reset: error");
    res.status(500).json({ error: String(err) });
  }
});

export default adminResetRouter;
