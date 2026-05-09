/**
 * nomina.ts — Endpoints de novedades de nómina diarias
 *
 * ENDPOINTS:
 *   GET  /api/nomina/novedades          → Novedades de una fecha (con filtros)
 *   POST /api/nomina/novedades/generar  → Genera/regenera novedades desde cobertura_segmentos
 *   GET  /api/nomina/novedades/resumen  → Resumen por período (para pre-planilla)
 *
 * FLUJO:
 *   1. El pizarrón registra segmentos en cobertura_segmentos
 *   2. Al cerrar el día, se llama internamente a generarNovedades(fecha, cierreId)
 *   3. Las novedades quedan en novedades_nomina_diarias para uso de planilla
 */

import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../lib/logger";
import { getLunesISO } from "../lib/turno-calc";
import { generarNovedades } from "../services/nomina/generar-novedades";

// Re-export para compatibilidad con código que sigue importando
// `generarNovedades` desde "../nomina" (p. ej. routes/operaciones/cierre.ts).
// El cuerpo de la función vive ahora en services/nomina/generar-novedades.ts.
export { generarNovedades };

export const nominaRouter = Router();


// ─── GET /api/nomina/novedades ────────────────────────────────────────────────
// Novedades diarias por fecha o rango, con filtro por empleado
nominaRouter.get("/nomina/novedades", async (req, res) => {
  try {
    const fecha      = req.query.fecha      as string | undefined;
    const desde      = req.query.desde      as string | undefined;
    const hasta      = req.query.hasta      as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    const clauses: string[] = [];
    const params: unknown[]  = [];

    if (fecha) {
      params.push(fecha);
      clauses.push(`n.fecha = $${params.length}`);
    } else if (desde || hasta) {
      const d = desde || hasta!;
      const h = hasta  || desde!;
      params.push(d, h);
      clauses.push(`n.fecha BETWEEN $${params.length - 1} AND $${params.length}`);
    } else {
      params.push(todayGT());
      clauses.push(`n.fecha = $${params.length}`);
    }

    if (employeeId) {
      params.push(Number(employeeId));
      clauses.push(`n.employee_id = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT n.*,
             e.nombre_completo AS nombre_empleado_join,
             e.puesto          AS puesto_empleado,
             e.area            AS area_empleado
      FROM novedades_nomina_diarias n
      LEFT JOIN employees e ON e.id = n.employee_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY n.fecha DESC, n.empleado_nombre
    `, params);

    // Resumen agregado
    const resumen = {
      total:              rows.length,
      trabajaron:         rows.filter((r: any) => r.trabajo_dia).length,
      faltas:             rows.filter((r: any) => r.falta).length,
      suspensiones:       rows.filter((r: any) => r.suspension).length,
      descansosTrabajos:  rows.filter((r: any) => r.descanso_trabajado).length,
      totalHoras:         rows.reduce((s: number, r: any) => s + parseFloat(r.horas_trabajadas ?? 0), 0).toFixed(2),
      totalHorasExtra:    rows.reduce((s: number, r: any) => s + parseFloat(r.horas_extra ?? 0), 0).toFixed(2),
      afectanSeptimo:     rows.filter((r: any) => r.afecta_septimo).length,
    };

    res.json({ novedades: rows, resumen });
  } catch (err) {
    logger.error({ err }, "GET /nomina/novedades error");
    res.status(500).json({ error: "Error al cargar novedades de nómina" });
  }
});

// ─── POST /api/nomina/novedades/generar ──────────────────────────────────────
// Genera o regenera manualmente las novedades para una fecha
nominaRouter.post("/nomina/novedades/generar", async (req, res) => {
  const { fecha, usuarioRol } = req.body;
  if (!fecha) return res.status(400).json({ error: "fecha es requerida" });
  if (!["admin", "supervisor"].includes(usuarioRol ?? "")) {
    return res.status(403).json({ error: "Solo supervisores y admin pueden generar novedades" });
  }

  try {
    const count = await generarNovedades(fecha, null);
    res.json({ ok: true, generadas: count, fecha });
  } catch (err) {
    logger.error({ err }, "POST /nomina/novedades/generar error");
    res.status(500).json({ error: "Error al generar novedades" });
  }
});

// ─── PUT /api/nomina/novedades/:id ───────────────────────────────────────────
// Editar manualmente una novedad antes de enviar a planilla
nominaRouter.put("/nomina/novedades/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    trabajo_dia, horas_trabajadas, horas_extra,
    falta, suspension, descanso_trabajado,
    afecta_septimo, descuento_dia, observaciones,
  } = req.body;

  try {
    const { rows } = await pool.query(`
      UPDATE novedades_nomina_diarias
      SET trabajo_dia        = COALESCE($1, trabajo_dia),
          horas_trabajadas   = COALESCE($2, horas_trabajadas),
          horas_extra        = COALESCE($3, horas_extra),
          falta              = COALESCE($4, falta),
          suspension         = COALESCE($5, suspension),
          descanso_trabajado = COALESCE($6, descanso_trabajado),
          afecta_septimo     = COALESCE($7, afecta_septimo),
          descuento_dia      = COALESCE($8, descuento_dia),
          observaciones      = COALESCE($9, observaciones),
          fuente             = 'correccion_manual',
          updated_at         = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      trabajo_dia   ?? null,
      horas_trabajadas  != null ? Number(horas_trabajadas)  : null,
      horas_extra       != null ? Number(horas_extra)       : null,
      falta         ?? null,
      suspension    ?? null,
      descanso_trabajado ?? null,
      afecta_septimo ?? null,
      descuento_dia  ?? null,
      observaciones  ?? null,
      id,
    ]);

    if (!rows.length) return res.status(404).json({ error: "Novedad no encontrada" });
    res.json({ ok: true, novedad: rows[0] });
  } catch (err) {
    logger.error({ err }, "PUT /nomina/novedades/:id error");
    res.status(500).json({ error: "Error al actualizar novedad" });
  }
});

// ─── GET /api/nomina/novedades/resumen-periodo ────────────────────────────────
// Resumen consolidado por período para pre-planilla
nominaRouter.get("/nomina/novedades/resumen-periodo", async (req, res) => {
  try {
    const desde = (req.query.desde as string) || todayGT();
    const hasta = (req.query.hasta as string) || desde;

    const { rows } = await pool.query(`
      SELECT
        n.employee_id,
        n.empleado_nombre,
        e.nombre_completo               AS nombre_empleado_join,
        COUNT(*)                        AS dias_periodo,
        SUM(CASE WHEN n.trabajo_dia THEN 1 ELSE 0 END) AS dias_trabajados,
        SUM(CASE WHEN n.falta       THEN 1 ELSE 0 END) AS dias_falta,
        SUM(CASE WHEN n.suspension  THEN 1 ELSE 0 END) AS dias_suspension,
        SUM(CASE WHEN n.descanso_trabajado THEN 1 ELSE 0 END) AS dias_descanso_trabajado,
        SUM(CASE WHEN n.afecta_septimo    THEN 1 ELSE 0 END) AS dias_afectan_septimo,
        SUM(n.horas_trabajadas)         AS total_horas,
        SUM(n.horas_extra)              AS total_horas_extra
      FROM novedades_nomina_diarias n
      LEFT JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
      GROUP BY n.employee_id, n.empleado_nombre, e.nombre_completo
      ORDER BY n.empleado_nombre
    `, [desde, hasta]);

    res.json({ desde, hasta, empleados: rows });
  } catch (err) {
    logger.error({ err }, "GET /nomina/novedades/resumen-periodo error");
    res.status(500).json({ error: "Error al generar resumen de período" });
  }
});
