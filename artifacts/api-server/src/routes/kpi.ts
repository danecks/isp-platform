/**
 * KPI ROUTES — /api/kpi/*
 *
 * Dashboard de métricas reales calculadas desde la base de datos.
 * Reemplaza los datos estáticos del mock anterior.
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { puestoCubiertoSql } from "../lib/cobertura-puesto";

const router = Router();

// ─── GET /api/kpi/dashboard ──────────────────────────────────────────────────
router.get("/kpi/dashboard", async (_req, res) => {
  try {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Conteos principales de incidencias
    const { rows: incRowsBase } = await pool.query<{
      total: string;
      activas: string;
      resueltas: string;
      del_mes: string;
    }>(`
      SELECT
        COUNT(*)                                                       AS total,
        COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))     AS activas,
        COUNT(*) FILTER (WHERE estado IN ('cerrada','resuelta'))       AS resueltas,
        COUNT(*) FILTER (WHERE fecha >= $1 AND fecha <= $2)            AS del_mes
      FROM incidents
    `, [inicioMes, finMes]);

    const incBase = incRowsBase[0] ?? { total: "0", activas: "0", resueltas: "0", del_mes: "0" };
    const totalInc = parseInt(incBase.total);
    const resueltasInc = parseInt(incBase.resueltas);
    const tasaResolucion = totalInc > 0
      ? Math.round((resueltasInc / totalInc) * 100)
      : 0;

    // 2. Tareas cerradas este mes
    const { rows: tareasRows } = await pool.query<{ cerradas: string }>(`
      SELECT COUNT(*) FILTER (WHERE estado = 'completada' AND updated_at >= $1 AND updated_at <= $2) AS cerradas
      FROM tareas
    `, [inicioMes, finMes]);
    const tareasCerradas = parseInt(tareasRows[0]?.cerradas ?? "0");

    // 3. Leads del mes
    const { rows: leadsRows } = await pool.query<{ del_mes: string }>(`
      SELECT COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2) AS del_mes
      FROM leads
    `, [inicioMes, finMes]);
    const leadsDelMes = parseInt(leadsRows[0]?.del_mes ?? "0");

    // 4. Postulaciones del mes
    const { rows: appRows } = await pool.query<{ del_mes: string }>(`
      SELECT COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2) AS del_mes
      FROM applications
    `, [inicioMes, finMes]);
    const postulacionesDelMes = parseInt(appRows[0]?.del_mes ?? "0");

    // 5. Puestos cubiertos (custodia activa = puestos operativos con estado cubierto)
    const { rows: puestosRows } = await pool.query<{ cubiertos: string; total: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE ${puestoCubiertoSql("puestos_operativos")}) AS cubiertos,
        COUNT(*)                                    AS total
      FROM puestos_operativos
      WHERE activo = TRUE
    `);
    const custodiasActivas = parseInt(puestosRows[0]?.cubiertos ?? "0");
    const puestosTotal = parseInt(puestosRows[0]?.total ?? "0");

    // 6. Clientes activos (que tienen contratos / puestos activos)
    const { rows: clientesRows } = await pool.query<{ activos: string }>(`
      SELECT COUNT(DISTINCT cliente_id) AS activos
      FROM puestos_operativos
      WHERE activo = TRUE AND cliente_id IS NOT NULL
    `);
    const clientesActivos = parseInt(clientesRows[0]?.activos ?? "0");

    // 7. Tendencia mensual de incidencias (últimos 6 meses)
    const tendenciaInc: { mes: string; total: number; resueltas: number; abiertas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString("es-GT", { month: "short", year: "2-digit" });

      const { rows: mRows } = await pool.query<{
        total: string; resueltas: string; abiertas: string;
      }>(`
        SELECT
          COUNT(*)                                                         AS total,
          COUNT(*) FILTER (WHERE estado IN ('cerrada','resuelta'))         AS resueltas,
          COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))       AS abiertas
        FROM incidents
        WHERE fecha >= $1 AND fecha <= $2
      `, [d, fin]);

      tendenciaInc.push({
        mes: label,
        total:    parseInt(mRows[0]?.total    ?? "0"),
        resueltas: parseInt(mRows[0]?.resueltas ?? "0"),
        abiertas:  parseInt(mRows[0]?.abiertas  ?? "0"),
      });
    }

    // 8. Tendencia mensual de leads (últimos 6 meses)
    const tendenciaLeads: { mes: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString("es-GT", { month: "short", year: "2-digit" });

      const { rows: lRows } = await pool.query<{ total: string }>(`
        SELECT COUNT(*) AS total FROM leads WHERE created_at >= $1 AND created_at <= $2
      `, [d, fin]);

      tendenciaLeads.push({ mes: label, total: parseInt(lRows[0]?.total ?? "0") });
    }

    // 9. Incidencias por cliente (top 10)
    const { rows: porCliente } = await pool.query<{ cliente: string; total: string }>(`
      SELECT cliente, COUNT(*) AS total
      FROM incidents
      GROUP BY cliente
      ORDER BY total DESC
      LIMIT 10
    `);

    // 10. Incidencias por tipo (últimos 6 meses)
    const seismeses = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const { rows: porTipoRows } = await pool.query<{ tipo: string; total: string }>(`
      SELECT tipo, COUNT(*) AS total
      FROM incidents
      WHERE fecha >= $1
      GROUP BY tipo
      ORDER BY total DESC
    `, [seismeses]);

    const porTipo: Record<string, number> = {};
    for (const row of porTipoRows) {
      porTipo[row.tipo] = parseInt(row.total);
    }

    res.json({
      resumen: {
        incidenciasActivas:    parseInt(incBase.activas),
        incidenciasDelMes:     parseInt(incBase.del_mes),
        incidenciasTotal:      totalInc,
        tasaResolucion,
        tareasCerradas,
        leadsDelMes,
        postulacionesDelMes,
        custodiasActivas,
        puestosTotal,
        clientesActivos,
        slaCumplido: tasaResolucion,
        tiempoRespuestaPromedio: null,
        tiempoResolucionPromedio: null,
      },
      tendenciaIncidencias: tendenciaInc,
      tendenciaLeads,
      incidenciasPorCliente: porCliente.map((r) => ({
        cliente: r.cliente,
        total: parseInt(r.total),
      })),
      porTipo,
      notas: [
        "tiempoRespuestaPromedio: requiere campo fecha_primera_accion en incidents",
        "tiempoResolucionPromedio: requiere campo fecha_cierre en incidents",
      ],
    });
  } catch (err) {
    logger.error({ err }, "GET /api/kpi/dashboard error");
    res.status(500).json({ error: "Error al calcular KPIs" });
  }
});

export default router;
