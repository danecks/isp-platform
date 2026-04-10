/**
 * reset-datos.ts
 * POST /api/admin/reset-datos
 * Borra toda la data operacional/demo, conserva usuarios, roles y configuración.
 * Solo accesible por administradores.
 */

import { Router } from "express";
import { pool } from "@workspace/db";

export const resetDatosRouter = Router();

function getSession(req: any) {
  try { return JSON.parse(req.headers["x-isp-session"] as string); }
  catch { return null; }
}

// Orden de borrado: hijos antes que padres (respeta FK constraints)
const TABLAS_BORRAR: string[] = [
  // ── Nómina / Planilla ────────────────────────────────────────────────────
  "planilla_lineas",
  "detalle_prestaciones_odbc",
  "novedades_nomina_diarias",
  "planillas_especiales_lineas",
  "planillas_especiales",
  "pre_planilla_cierres",
  "planillas",

  // ── Prestaciones ─────────────────────────────────────────────────────────
  "prestaciones_pagos",
  "prestaciones_periodos",

  // ── IGSS / Libro de salarios ─────────────────────────────────────────────
  "detalle_lib_sal",
  "historial_lib_sal",
  "igss_lib_sal_config",
  "historial_prestaciones_externas",
  "igss_config_patrono",

  // ── Bodega ───────────────────────────────────────────────────────────────
  "bodega_movimientos",
  "bodega_solicitudes",
  "bodega_articulos",
  "bodega_categorias",

  // ── Armería ──────────────────────────────────────────────────────────────
  "arma_ordenes_servicio",
  "arma_sugerencias",
  "arma_custodia",
  "puesto_municion",
  "armas",

  // ── Vehículos ────────────────────────────────────────────────────────────
  "vehiculo_custodia",
  "vehiculos",

  // ── Operaciones / Cobertura ──────────────────────────────────────────────
  "incentivos_cash_cobertura",
  "relevo_equipo_novedades",
  "cobertura_segmentos",
  "reporte_turno",
  "incidents",

  // ── QR / Control ────────────────────────────────────────────────────────
  "fichajes_qr",
  "rondas_qr",
  "agente_qr_tokens",
  "supervisor_devices",

  // ── RRHH ────────────────────────────────────────────────────────────────
  "cambios_salariales",
  "contratos_empleados",
  "eventos_rrhh",
  "rrhh_alertas",
  "solicitudes_cambio_turno",
  "solicitudes_eliminacion",
  "solicitudes_vacaciones",

  // ── SSA / Planificación ──────────────────────────────────────────────────
  "ssa_agentes",
  "planificacion_futura",

  // ── Anticipos ────────────────────────────────────────────────────────────
  "anticipos",

  // ── Reclutamiento ────────────────────────────────────────────────────────
  "solicitudes_empleo",
  "applications",
  "leads",

  // ── Asignaciones / Puestos ───────────────────────────────────────────────
  "agent_assignments",
  "puesto_titulares",
  "puesto_slots",
  "position_aliases",    // referencia service_locations (FK a clients)
  "service_locations",   // referencia clients
  "puestos_operativos",  // referencia clients y turnos
  "turnos",

  // ── Clientes y alias ─────────────────────────────────────────────────────
  "client_aliases",
  "clients",

  // ── Empleados — al final (referenciado por casi todo lo anterior) ─────────
  "employees",
];

resetDatosRouter.post("/admin/reset-datos", async (req: any, res: any) => {
  const session = getSession(req);
  if (!session || session.rol !== "admin") {
    return res.status(403).json({ error: "Solo administradores pueden ejecutar este reset" });
  }

  const client = await pool.connect();
  const eliminados: { tabla: string; filas: number }[] = [];
  const errores: { tabla: string; error: string }[] = [];
  let totalFilas = 0;

  try {
    for (const tabla of TABLAS_BORRAR) {
      try {
        const r = await client.query(`DELETE FROM ${tabla}`);
        const filas = r.rowCount ?? 0;
        if (filas > 0) {
          eliminados.push({ tabla, filas });
          totalFilas += filas;
        }
      } catch (e: any) {
        if (e.code === "42P01") {
          // tabla no existe — ignorar silenciosamente
        } else {
          errores.push({ tabla, error: e.message });
        }
      }
    }

    // Reiniciar secuencias de las tablas principales a 1
    const seqTablas = [
      "employees", "clients", "puestos_operativos", "turnos",
      "armas", "vehiculos", "anticipos", "planillas", "planilla_lineas",
      "pre_planilla_cierres", "novedades_nomina_diarias",
      "bodega_categorias", "bodega_articulos", "incidents",
    ];
    for (const t of seqTablas) {
      try {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${t}', 'id'), 1, false)`
        );
      } catch { /* no existe */ }
    }

    // Marcar demo_seed_disabled = true para no re-sembrar datos de ejemplo al reiniciar
    await client.query(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES ('demo_seed_disabled', 'true', NOW())
      ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
    `);

    res.json({
      ok: true,
      totalFilas,
      eliminados,
      errores,
      mensaje: `Reset completo: ${totalFilas} registros eliminados. ${errores.length > 0 ? errores.length + " tablas con error (ver campo errores)." : "Sin errores."}`,
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
