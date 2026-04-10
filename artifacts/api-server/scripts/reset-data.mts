/**
 * reset-data.mts
 * Limpia TODA la data operacional/demo del sistema.
 * Conserva: users, system_roles, rol_permisos, tipos_personal_config,
 *            wa_config, wa_messages, wa_menu_options, system_config
 *
 * Ejecutar: pnpm --filter @workspace/api-server tsx scripts/reset-data.mts
 */

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Tablas a borrar en orden seguro (hijos antes que padres)
// Usamos session_replication_role=replica para ignorar FKs temporalmente
const BUSINESS_TABLES = [
  // Planillas / nómina
  "planilla_lineas",
  "novedades_nomina_diarias",
  "pre_planilla_cierres",
  "planillas",
  "planillas_especiales_lineas",
  "planillas_especiales",
  "detalle_prestaciones_odbc",

  // Prestaciones
  "prestaciones_pagos",
  "prestaciones_periodos",

  // Bodega
  "bodega_movimientos",
  "bodega_solicitudes",
  "bodega_articulos",
  "bodega_categorias",

  // Armería
  "arma_ordenes_servicio",
  "arma_sugerencias",
  "arma_custodia",
  "armas",
  "puesto_municion",

  // Vehículos
  "vehiculo_custodia",
  "vehiculos",

  // Operaciones
  "incentivos_cash_cobertura",
  "relevo_equipo_novedades",
  "cobertura_segmentos",
  "reporte_turno",
  "incidents",

  // QR / Control
  "fichajes_qr",
  "rondas_qr",
  "agente_qr_tokens",
  "supervisor_devices",

  // RRHH
  "cambios_salariales",
  "contratos_empleados",
  "eventos_rrhh",
  "rrhh_alertas",
  "solicitudes_cambio_turno",
  "solicitudes_eliminacion",

  // SSA / Planificación
  "ssa_agentes",
  "planificacion_futura",

  // Anticipos
  "anticipos",

  // IGSS
  "historial_lib_sal",
  "detalle_lib_sal",
  "igss_lib_sal_config",
  "historial_prestaciones_externas",
  "igss_config_patrono",

  // Asignaciones y puestos
  "agent_assignments",
  "puesto_titulares",
  "puesto_slots",
  "position_aliases",
  "puestos_operativos",
  "turnos",

  // Solicitudes RRHH / Kiosco
  "solicitudes_vacaciones",
  "solicitudes_empleo",
  "applications",
  "leads",

  // Clientes
  "client_aliases",
  "service_locations",
  "clients",

  // Empleados (al final porque muchos lo referencian)
  "employees",

  // Alias de WA audit (no es sistema, es log de cambios)
  "wa_audit_log",
];

async function run() {
  const client = await pool.connect();
  try {
    console.log("⚡ Iniciando limpieza de datos...\n");

    // Deshabilitar temporalmente FK checks (solo en esta sesión)
    await client.query("SET session_replication_role = 'replica'");

    let deleted = 0;
    for (const table of BUSINESS_TABLES) {
      try {
        const r = await client.query(`DELETE FROM ${table}`);
        if (r.rowCount && r.rowCount > 0) {
          console.log(`  ✓ ${table}: ${r.rowCount} filas eliminadas`);
          deleted += r.rowCount;
        }
      } catch (e: any) {
        if (e.code === "42P01") {
          // tabla no existe — ignorar
        } else {
          console.warn(`  ⚠ ${table}: ${e.message}`);
        }
      }
    }

    // Rehabilitar FK checks
    await client.query("SET session_replication_role = 'DEFAULT'");

    // Reiniciar secuencias de las tablas principales
    const seqTables = [
      "employees", "clients", "puestos_operativos", "turnos",
      "armas", "vehiculos", "anticipos", "planillas", "planilla_lineas",
      "pre_planilla_cierres", "novedades_nomina_diarias",
      "bodega_categorias", "bodega_articulos", "bodega_movimientos",
      "incidents",
    ];
    for (const t of seqTables) {
      try {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${t}', 'id'), 1, false)`
        );
      } catch { /* tabla o secuencia no existe */ }
    }

    // Marcar demo_seed_disabled = true para no re-sembrar datos de ejemplo
    await client.query(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES ('demo_seed_disabled', 'true', NOW())
      ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
    `);
    console.log("\n  ✓ demo_seed_disabled = true (no se re-sembrarán datos demo)");

    console.log(`\n✅ Limpieza completa. Total: ${deleted} filas eliminadas.`);
    console.log("   Sistema listo para uso en producción.\n");

    // Verificar lo que quedó
    const keepTables = ["users", "system_roles", "rol_permisos", "tipos_personal_config"];
    console.log("📋 Datos del sistema conservados:");
    for (const t of keepTables) {
      try {
        const r = await client.query(`SELECT COUNT(*) AS n FROM ${t}`);
        console.log(`   ${t}: ${r.rows[0].n} registros`);
      } catch {}
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
