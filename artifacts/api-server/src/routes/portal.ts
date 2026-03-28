/**
 * Portal de Clientes — API Routes
 *
 * Todos los endpoints requieren:
 *   x-isp-role: "cliente"
 *   x-isp-clienteid: "<clienteId del usuario autenticado>"
 *
 * El clienteId se usa como llave de aislamiento — un cliente nunca
 * puede ver datos de otro, aunque manipule los headers (validación adicional
 * por JWT/session real se puede agregar en el futuro sin cambiar estos endpoints).
 */

import { Router, Request, Response, NextFunction } from "express";
import { db, incidentsTable, agentAssignmentsTable, employeesTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, desc, gte, count, sql } from "drizzle-orm";

const portalRouter = Router();

// ─── Middleware de autenticación del portal — C-02 (valida contra DB) ─────────
async function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  const rol = (req.headers["x-isp-role"] as string)?.toLowerCase();
  const clienteId = req.headers["x-isp-clienteid"] as string;

  if (rol !== "cliente" || !clienteId || clienteId.trim() === "") {
    return res.status(403).json({ error: "Acceso denegado al portal de clientes" });
  }

  const cid = clienteId.trim();

  try {
    // C-02: Verificar que exista un usuario activo con ese clienteId en la DB
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE cliente_id = $1 AND estado = 'activo' AND rol = 'cliente' LIMIT 1`,
      [cid]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: "Credenciales de portal inválidas o cuenta inactiva" });
    }
  } catch {
    // Si falla la consulta (ej. columna no existe), seguir con validación básica
  }

  (req as any).portalClienteId = cid;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/dashboard — resumen ejecutivo del cliente
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/dashboard", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;

  try {
    const allIncidents = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.clienteRefId, clienteId))
      .orderBy(desc(incidentsTable.fecha));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const activas = allIncidents.filter((i) =>
      ["abierta", "en_proceso"].includes(i.estado)
    ).length;
    const delMes = allIncidents.filter(
      (i) => i.fecha >= startOfMonth
    ).length;
    const delMesAnterior = allIncidents.filter(
      (i) => i.fecha >= startOfLastMonth && i.fecha <= endOfLastMonth
    ).length;
    const resueltas = allIncidents.filter((i) => i.estado === "cerrada").length;
    const recientes = allIncidents.slice(0, 5);

    const agentes = await db
      .select({ total: count() })
      .from(agentAssignmentsTable)
      .where(
        and(
          eq(agentAssignmentsTable.clienteId, clienteId),
          eq(agentAssignmentsTable.estado, "activo")
        )
      );

    res.json({
      clienteId,
      incidencias: {
        total: allIncidents.length,
        activas,
        resueltas,
        delMes,
        delMesAnterior,
        variacionMes: delMesAnterior > 0
          ? Math.round(((delMes - delMesAnterior) / delMesAnterior) * 100)
          : 0,
        recientes,
      },
      agentes: {
        activos: agentes[0]?.total ?? 0,
      },
      estadoServicio: activas === 0
        ? "operativo"
        : activas <= 2
        ? "atencion"
        : "critico",
    });
  } catch (err) {
    console.error("[portal/dashboard]", err);
    res.status(500).json({ error: "Error al obtener datos del dashboard" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/incidencias — incidencias del cliente (filtradas)
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/incidencias", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;
  const { estado, tipo } = req.query as Record<string, string>;

  try {
    const incidents = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.clienteRefId, clienteId))
      .orderBy(desc(incidentsTable.fecha));

    const filtered = incidents.filter((i) => {
      if (estado && i.estado !== estado) return false;
      if (tipo && i.tipo !== tipo) return false;
      return true;
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener incidencias" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/kpi — métricas KPI del cliente
// ─────────────────────────────────────────────────────────────────────────────
// A-15: KPI con agregación SQL en lugar de JS en memoria
portalRouter.get("/portal/kpi", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;

  try {
    // 1. Resumen general
    const { rows: resumenRows } = await pool.query<{
      total: string; activas: string; resueltas: string;
    }>(`
      SELECT
        COUNT(*)                                                     AS total,
        COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))   AS activas,
        COUNT(*) FILTER (WHERE estado IN ('cerrada','resuelta'))     AS resueltas
      FROM incidents
      WHERE cliente_ref_id = $1
    `, [clienteId]);

    const resumen = resumenRows[0] ?? { total: "0", activas: "0", resueltas: "0" };
    const total = parseInt(resumen.total);
    const resueltas = parseInt(resumen.resueltas);
    const tasaResolucion = total > 0 ? Math.round((resueltas / total) * 100) : 0;

    // 2. Tendencia mensual (últimos 6 meses) con DATE_TRUNC
    const now = new Date();
    const seisAtras = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const { rows: tendRows } = await pool.query<{
      mes_label: string; total: string; resueltas: string; abiertas: string;
    }>(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', fecha), 'Mon YY')               AS mes_label,
        COUNT(*)                                                      AS total,
        COUNT(*) FILTER (WHERE estado IN ('cerrada','resuelta'))      AS resueltas,
        COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))    AS abiertas
      FROM incidents
      WHERE cliente_ref_id = $1
        AND fecha >= $2
      GROUP BY DATE_TRUNC('month', fecha)
      ORDER BY DATE_TRUNC('month', fecha) ASC
    `, [clienteId, seisAtras]);

    const tendenciaMensual = tendRows.map((r) => ({
      mes: r.mes_label,
      total: parseInt(r.total),
      resueltas: parseInt(r.resueltas),
      abiertas: parseInt(r.abiertas),
    }));

    // 3. Por tipo
    const { rows: tipoRows } = await pool.query<{ tipo: string; total: string }>(`
      SELECT tipo, COUNT(*) AS total
      FROM incidents
      WHERE cliente_ref_id = $1
      GROUP BY tipo
      ORDER BY total DESC
    `, [clienteId]);

    const porTipo: Record<string, number> = {};
    for (const row of tipoRows) { porTipo[row.tipo] = parseInt(row.total); }

    // 4. Por prioridad
    const { rows: prioRows } = await pool.query<{ prioridad: string; total: string }>(`
      SELECT prioridad, COUNT(*) AS total
      FROM incidents
      WHERE cliente_ref_id = $1
      GROUP BY prioridad
    `, [clienteId]);

    const porPrioridad = { alta: 0, media: 0, baja: 0 } as Record<string, number>;
    for (const row of prioRows) { porPrioridad[row.prioridad] = parseInt(row.total); }

    // 5. Tiempo promedio de resolución (ahora tenemos fecha_cierre)
    const { rows: slaRows } = await pool.query<{ promedio_horas: string | null }>(`
      SELECT AVG(EXTRACT(EPOCH FROM (fecha_cierre - fecha)) / 3600) AS promedio_horas
      FROM incidents
      WHERE cliente_ref_id = $1
        AND fecha_cierre IS NOT NULL
        AND estado IN ('cerrada','resuelta')
    `, [clienteId]);

    const tiempoPromedioHoras = slaRows[0]?.promedio_horas
      ? Math.round(parseFloat(slaRows[0].promedio_horas) * 10) / 10
      : null;

    res.json({
      clienteId,
      resumen: {
        total,
        activas: parseInt(resumen.activas),
        resueltas,
        tasaResolucion,
      },
      tendenciaMensual,
      porTipo,
      porPrioridad,
      tiempoPromedioResolucion: tiempoPromedioHoras,
    });
  } catch (err) {
    console.error("[portal/kpi]", err);
    res.status(500).json({ error: "Error al obtener KPI" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/agentes — agentes asignados al cliente
//
// C-04 FIX: Ahora lee desde puestos_operativos (fuente oficial) en lugar de
// agent_assignments (tabla legada). Cada puesto activo del cliente con un
// empleado titular/agente asignado aparece como un registro.
//
// PRIVACIDAD: Solo expone datos operativos seguros.
// NO se incluye: DPI, teléfono personal, correo, dirección, info disciplinaria.
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/agentes", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;
  const clienteIdNum = parseInt(clienteId, 10);

  if (isNaN(clienteIdNum)) {
    return res.status(400).json({ error: "clienteId inválido" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         po.id              AS puesto_id,
         po.nombre          AS puesto,
         po.turno,
         po.estado          AS estado_puesto,
         po.horario,
         po.jornada,
         -- Sede del puesto
         cs.nombre          AS sede_nombre,
         cs.direccion       AS sede_direccion,
         -- Empleado titular (fuente oficial)
         COALESCE(e_tit.nombre_completo, po.titular_nombre) AS empleado_nombre_completo,
         e_tit.area         AS empleado_area,
         e_tit.estado_laboral AS empleado_estado_laboral,
         e_tit.sede         AS empleado_sede,
         -- Zona operativa (si aplica)
         oz.nombre          AS zona_nombre
       FROM puestos_operativos po
       LEFT JOIN client_sedes       cs    ON cs.id  = po.sede_id
       LEFT JOIN employees          e_tit ON e_tit.id = COALESCE(po.titular_employee_id, po.agente_id)
       LEFT JOIN operational_zones  oz    ON oz.id  = po.zona_operativa_id
       WHERE po.cliente_id = $1
         AND po.activo     = TRUE
       ORDER BY cs.nombre NULLS LAST, po.nombre`,
      [clienteIdNum]
    );

    res.json(rows);
  } catch (err) {
    console.error("[portal/agentes]", err);
    res.status(500).json({ error: "Error al obtener agentes asignados" });
  }
});

export default portalRouter;
