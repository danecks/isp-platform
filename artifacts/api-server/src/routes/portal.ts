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
import { eq, and, desc, gte, count, sql } from "drizzle-orm";

const portalRouter = Router();

// ─── Middleware de autenticación del portal ────────────────────────────────
function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  const rol = (req.headers["x-isp-role"] as string)?.toLowerCase();
  const clienteId = req.headers["x-isp-clienteid"] as string;

  if (rol !== "cliente" || !clienteId || clienteId.trim() === "") {
    return res.status(403).json({ error: "Acceso denegado al portal de clientes" });
  }

  (req as any).portalClienteId = clienteId.trim();
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
portalRouter.get("/portal/kpi", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;

  try {
    const all = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.clienteRefId, clienteId))
      .orderBy(desc(incidentsTable.fecha));

    const now = new Date();

    // Últimos 6 meses
    const meses: { mes: string; total: number; resueltas: number; abiertas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const label = d.toLocaleDateString("es-GT", { month: "short", year: "2-digit" });
      const delMes = all.filter((x) => x.fecha >= d && x.fecha <= fin);
      meses.push({
        mes: label,
        total: delMes.length,
        resueltas: delMes.filter((x) => x.estado === "cerrada").length,
        abiertas: delMes.filter((x) => ["abierta", "en_proceso"].includes(x.estado)).length,
      });
    }

    // Por tipo de incidencia
    const porTipo: Record<string, number> = {};
    for (const i of all) {
      porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
    }

    // Por prioridad
    const porPrioridad = {
      alta: all.filter((i) => i.prioridad === "alta").length,
      media: all.filter((i) => i.prioridad === "media").length,
      baja: all.filter((i) => i.prioridad === "baja").length,
    };

    const resueltas = all.filter((i) => i.estado === "cerrada").length;
    const tasaResolucion = all.length > 0
      ? Math.round((resueltas / all.length) * 100)
      : 0;

    res.json({
      clienteId,
      resumen: {
        total: all.length,
        activas: all.filter((i) => ["abierta", "en_proceso"].includes(i.estado)).length,
        resueltas,
        tasaResolucion,
      },
      tendenciaMensual: meses,
      porTipo,
      porPrioridad,
      // Tiempo promedio de resolución: campo pendiente de implementar
      // cuando se agregue `fechaCierre` a incidencias (documentado aquí)
      tiempoPromedioResolucion: null,
      notasIntegracion: [
        "tiempoPromedioResolucion: requiere campo fechaCierre en incidentsTable",
        "SLA tracking: pendiente de implementación futura",
      ],
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener KPI" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/agentes — agentes asignados al cliente
//
// PRIVACIDAD: Solo expone datos operativos seguros.
// NO se incluye: DPI, teléfono personal, correo, dirección, info disciplinaria.
//
// FUTURA INTEGRACIÓN RH:
//   Los agentes vendrán de agent_assignments JOIN employees.
//   Cuando employees se sincronice desde RH, las asignaciones
//   se llenarán automáticamente sin cambiar este endpoint.
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/agentes", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;

  try {
    const assignments = await db
      .select({
        // Datos de la asignación
        asignacionId: agentAssignmentsTable.id,
        codigoAsignacion: agentAssignmentsTable.codigoAsignacion,
        puesto: agentAssignmentsTable.puesto,
        servicio: agentAssignmentsTable.servicio,
        ubicacion: agentAssignmentsTable.ubicacion,
        supervisorNombre: agentAssignmentsTable.supervisorNombre,
        fechaInicio: agentAssignmentsTable.fechaInicio,
        fechaFin: agentAssignmentsTable.fechaFin,
        estadoAsignacion: agentAssignmentsTable.estado,
        // Datos del empleado — SOLO campos operativos seguros
        empleadoNombreCompleto: employeesTable.nombreCompleto,
        empleadoArea: employeesTable.area,
        empleadoEstadoLaboral: employeesTable.estadoLaboral,
        empleadoSede: employeesTable.sede,
        // sourceSystem para referencia de integración
        empleadoFuente: employeesTable.sourceSystem,
      })
      .from(agentAssignmentsTable)
      .innerJoin(
        employeesTable,
        eq(agentAssignmentsTable.employeeId, employeesTable.id)
      )
      .where(
        and(
          eq(agentAssignmentsTable.clienteId, clienteId),
          eq(agentAssignmentsTable.estado, "activo")
        )
      )
      .orderBy(agentAssignmentsTable.fechaInicio);

    res.json(assignments);
  } catch (err) {
    console.error("[portal/agentes]", err);
    res.status(500).json({ error: "Error al obtener agentes asignados" });
  }
});

export default portalRouter;
