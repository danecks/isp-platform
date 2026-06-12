import { Router } from "express";
import { db, employeesTable, anticiposTable, pool } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { calcularLimiteAnticipo } from "../../services/anticipo-limite";
import { getPeriodoActivo } from "../../services/whatsapp/anticipo-session";
import { calcularKPIDisciplinario } from "../../services/disciplinary-kpi";
import { calcularKPIRotacion } from "../../services/rotation-kpi";

const router = Router();

// GET /api/employees/:id/kpi — KPI individual del empleado
router.get("/employees/:id/kpi", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, empId))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });

    const nombre = emp.nombreCompleto;
    const periodo = 90;

    // ── Tareas (via users.employee_id → tareas.asignado_id) ─────────────────
    const { rows: tareasRows } = await pool.query<{
      asignadas: string;
      completadas: string;
      en_proceso: string;
      pendientes: string;
      ultima_tarea: Date | null;
    }>(`
      SELECT
        COUNT(*)::int                                                   AS asignadas,
        COUNT(CASE WHEN t.estado = 'completada' THEN 1 END)::int       AS completadas,
        COUNT(CASE WHEN t.estado IN ('en_progreso','en_proceso') THEN 1 END)::int AS en_proceso,
        COUNT(CASE WHEN t.estado = 'pendiente' THEN 1 END)::int        AS pendientes,
        MAX(t.created_at)                                               AS ultima_tarea
      FROM tareas t
      JOIN users u ON t.asignado_id = u.id
      WHERE u.employee_id = $1
        AND t.created_at >= NOW() - ($2 || ' days')::interval
    `, [empId, periodo]);

    const tareas = tareasRows[0] ?? {
      asignadas: 0, completadas: 0, en_proceso: 0, pendientes: 0, ultima_tarea: null,
    };

    // ── Anticipos (FK directa employeeId) ────────────────────────────────────
    const { rows: anticiposRows } = await pool.query<{
      solicitados: string;
      aprobados: string;
      pendientes_ant: string;
      monto_total: string;
      ultima_solicitud: Date | null;
    }>(`
      SELECT
        COUNT(*)::int                                                    AS solicitados,
        COUNT(CASE WHEN estado = 'aprobada' THEN 1 END)::int            AS aprobados,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END)::int           AS pendientes_ant,
        COALESCE(SUM(cantidad), 0)::int                                 AS monto_total,
        MAX(fecha_solicitud)                                             AS ultima_solicitud
      FROM anticipos
      WHERE employee_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
    `, [empId, periodo]);

    const anticipos = anticiposRows[0] ?? {
      solicitados: 0, aprobados: 0, pendientes_ant: 0, monto_total: 0, ultima_solicitud: null,
    };

    // ── Incidencias relacionadas (por nombre en campo responsable) ───────────
    const { rows: incidenciasRows } = await pool.query<{
      relacionadas: string;
      ultima_incidencia: Date | null;
    }>(`
      SELECT
        COUNT(*)::int        AS relacionadas,
        MAX(created_at)      AS ultima_incidencia
      FROM incidents
      WHERE LOWER(responsable) LIKE LOWER($1)
        AND es_emergencia = false
        AND created_at >= NOW() - ($2 || ' days')::interval
    `, [`%${nombre}%`, periodo]);

    const incidencias = incidenciasRows[0] ?? { relacionadas: 0, ultima_incidencia: null };

    // ── Emergencias (incidencias con esEmergencia = true) ─────────────────────
    const { rows: emergenciasRows } = await pool.query<{
      reportadas: string;
      ultima_emergencia: Date | null;
    }>(`
      SELECT
        COUNT(*)::int        AS reportadas,
        MAX(created_at)      AS ultima_emergencia
      FROM incidents
      WHERE LOWER(responsable) LIKE LOWER($1)
        AND es_emergencia = true
        AND created_at >= NOW() - ($2 || ' days')::interval
    `, [`%${nombre}%`, periodo]);

    const emergencias = emergenciasRows[0] ?? { reportadas: 0, ultima_emergencia: null };

    // ── Asignaciones activas ──────────────────────────────────────────────────
    const { rows: asignacionesRows } = await pool.query<{
      activas: string;
      total: string;
    }>(`
      SELECT
        COUNT(CASE WHEN estado = 'activo' THEN 1 END)::int AS activas,
        COUNT(*)::int                                       AS total
      FROM agent_assignments
      WHERE employee_id = $1
    `, [empId]);

    const asignaciones = asignacionesRows[0] ?? { activas: 0, total: 0 };

    const timestamps = [
      tareas.ultima_tarea,
      anticipos.ultima_solicitud,
      incidencias.ultima_incidencia,
      emergencias.ultima_emergencia,
    ].filter(Boolean) as Date[];

    const ultimaActividad = timestamps.length
      ? new Date(Math.max(...timestamps.map((d) => new Date(d).getTime())))
      : null;

    const tieneDatos =
      Number(tareas.asignadas) > 0 ||
      Number(anticipos.solicitados) > 0 ||
      Number(incidencias.relacionadas) > 0 ||
      Number(emergencias.reportadas) > 0;

    res.json({
      empleadoId: empId,
      nombreCompleto: nombre,
      periodo: `últimos ${periodo} días`,
      periodoLabel: `${periodo}d`,
      tieneDatos,
      tareas: {
        asignadas: Number(tareas.asignadas),
        completadas: Number(tareas.completadas),
        enProceso: Number(tareas.en_proceso),
        pendientes: Number(tareas.pendientes),
        ultimaTarea: tareas.ultima_tarea ?? null,
      },
      anticipos: {
        solicitados: Number(anticipos.solicitados),
        aprobados: Number(anticipos.aprobados),
        pendientes: Number(anticipos.pendientes_ant),
        montoTotal: Number(anticipos.monto_total),
        ultimaSolicitud: anticipos.ultima_solicitud ?? null,
      },
      incidencias: {
        relacionadas: Number(incidencias.relacionadas),
        ultimaIncidencia: incidencias.ultima_incidencia ?? null,
      },
      emergencias: {
        reportadas: Number(emergencias.reportadas),
        ultimaEmergencia: emergencias.ultima_emergencia ?? null,
      },
      asignaciones: {
        activas: Number(asignaciones.activas),
        total: Number(asignaciones.total),
      },
      ultimaActividad,
    });
  } catch (err) {
    console.error("[KPI] Error:", err);
    res.status(500).json({ error: "Error al calcular KPI del empleado" });
  }
});

// GET /api/employees/:id/disciplinary — KPI disciplinario ────────────────────
router.get("/employees/:id/disciplinary", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [emp] = await db
      .select({ id: employeesTable.id, nombre: employeesTable.nombreCompleto })
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    const kpi = await calcularKPIDisciplinario(id);
    res.json(kpi);
  } catch (err) {
    res.status(500).json({ error: "Error al calcular KPI disciplinario" });
  }
});

// GET /api/employees/:id/rotation — KPI de rotación operativa ────────────────
router.get("/employees/:id/rotation", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [emp] = await db
      .select({ id: employeesTable.id, nombre: employeesTable.nombreCompleto })
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    const kpi = await calcularKPIRotacion(id);
    res.json(kpi);
  } catch (err) {
    res.status(500).json({ error: "Error al calcular KPI de rotación" });
  }
});

// GET /api/employees/:id/anticipos — historial + config de límite ────────────
router.get("/employees/:id/anticipos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    // Verificar que el empleado existe
    const [emp] = await db
      .select({
        id: employeesTable.id,
        nombre: employeesTable.nombreCompleto,
        limiteAnticipo: employeesTable.limiteAnticipo,
        tipoLimitePeriodo: employeesTable.tipoLimitePeriodo,
        ultimaActualizacionLimiteAt: employeesTable.ultimaActualizacionLimiteAt,
      })
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);

    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });

    // Historial completo de anticipos
    const historial = await db
      .select()
      .from(anticiposTable)
      .where(eq(anticiposTable.employeeId, id))
      .orderBy(desc(anticiposTable.fechaSolicitud));

    // Tope dinámico (liquidación acumulada × 30% × KPI). Es una propiedad de la
    // persona, no de la quincena: se calcula siempre, no solo en días hábiles.
    const periodoActual = getPeriodoActivo()
      ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-manual`;
    const limiteInfo = await calcularLimiteAnticipo(id, periodoActual);

    res.json({
      config: {
        limiteAnticipo: emp.limiteAnticipo,
        tipoLimitePeriodo: emp.tipoLimitePeriodo ?? "quincenal",
        ultimaActualizacionLimiteAt: emp.ultimaActualizacionLimiteAt,
      },
      periodoActual: limiteInfo,
      historial,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener anticipos del empleado" });
  }
});

export default router;
