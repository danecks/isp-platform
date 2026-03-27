import { Router } from "express";
import { db, employeesTable, usersTable, pool } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const employeesRouter = Router();

// GET /api/employees — list all employees
employeesRouter.get("/employees", async (req, res) => {
  try {
    const { syncStatus, estadoLaboral, area, sourceSystem } = req.query as Record<string, string>;

    const results = await db
      .select()
      .from(employeesTable)
      .orderBy(asc(employeesTable.nombreCompleto));

    const filtered = results.filter((e) => {
      if (syncStatus && e.syncStatus !== syncStatus) return false;
      if (estadoLaboral && e.estadoLaboral !== estadoLaboral) return false;
      if (area && e.area !== area) return false;
      if (sourceSystem && e.sourceSystem !== sourceSystem) return false;
      return true;
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener empleados" });
  }
});

// GET /api/employees/sync/status — summary of sync state (must be before /:id)
employeesRouter.get("/employees/sync/status", async (_req, res) => {
  try {
    const all = await db.select().from(employeesTable);
    const summary = {
      total: all.length,
      bySource: {
        manual: all.filter((e) => e.sourceSystem === "manual").length,
        hr_sql_external: all.filter((e) => e.sourceSystem === "hr_sql_external").length,
        api: all.filter((e) => e.sourceSystem === "api").length,
      },
      bySyncStatus: {
        manual: all.filter((e) => e.syncStatus === "manual").length,
        synced: all.filter((e) => e.syncStatus === "synced").length,
        pending: all.filter((e) => e.syncStatus === "pending").length,
        error: all.filter((e) => e.syncStatus === "error").length,
      },
      lastSyncAt: all
        .filter((e) => e.lastSyncAt)
        .sort((a, b) => b.lastSyncAt!.getTime() - a.lastSyncAt!.getTime())
        .at(0)?.lastSyncAt ?? null,
    };
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estado de sync" });
  }
});

// GET /api/employees/:id/kpi — KPI individual del empleado
employeesRouter.get("/employees/:id/kpi", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });

  try {
    // Obtener datos del empleado
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, empId))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });

    const nombre = emp.nombreCompleto;
    const periodo = 90; // días

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

    // ── Última actividad global ───────────────────────────────────────────────
    const timestamps = [
      tareas.ultima_tarea,
      anticipos.ultima_solicitud,
      incidencias.ultima_incidencia,
      emergencias.ultima_emergencia,
    ].filter(Boolean) as Date[];

    const ultimaActividad = timestamps.length
      ? new Date(Math.max(...timestamps.map((d) => new Date(d).getTime())))
      : null;

    // ── tieneDatos ────────────────────────────────────────────────────────────
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

// GET /api/employees/:id/asignaciones — asignaciones del empleado
employeesRouter.get("/employees/:id/asignaciones", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const { rows } = await pool.query<{
      id: number;
      cliente_id: string;
      puesto: string | null;
      servicio: string | null;
      ubicacion: string | null;
      supervisor_nombre: string | null;
      codigo_asignacion: string | null;
      fecha_inicio: Date | null;
      fecha_fin: Date | null;
      estado: string;
      notas: string | null;
      created_at: Date;
    }>(`
      SELECT
        aa.id,
        aa.cliente_id,
        aa.puesto,
        aa.servicio,
        aa.ubicacion,
        aa.supervisor_nombre,
        aa.codigo_asignacion,
        aa.fecha_inicio,
        aa.fecha_fin,
        aa.estado,
        aa.notas,
        aa.created_at
      FROM agent_assignments aa
      WHERE aa.employee_id = $1
      ORDER BY aa.estado ASC, aa.fecha_inicio DESC NULLS LAST
    `, [empId]);

    res.json(rows);
  } catch (err) {
    console.error("[Asignaciones] Error:", err);
    res.status(500).json({ error: "Error al obtener asignaciones" });
  }
});

// GET /api/employees/:id — single employee
employeesRouter.get("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener empleado" });
  }
});

// POST /api/employees — create employee (manual entry)
employeesRouter.post("/employees", async (req, res) => {
  const {
    nombreCompleto, dpi, telefono, correo, puesto, area,
    estadoLaboral, sede, supervisorNombre, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus,
  } = req.body ?? {};

  if (!nombreCompleto) {
    return res.status(400).json({ error: "nombreCompleto es requerido" });
  }

  try {
    const [emp] = await db
      .insert(employeesTable)
      .values({
        nombreCompleto,
        dpi: dpi || null,
        telefono: telefono || null,
        correo: correo || null,
        puesto: puesto || null,
        area: area || null,
        estadoLaboral: estadoLaboral || "activo",
        sede: sede || null,
        supervisorNombre: supervisorNombre || null,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
        notas: notas || null,
        externalId: externalId || null,
        sourceSystem: sourceSystem || "manual",
        syncStatus: syncStatus || "manual",
      })
      .returning();

    res.status(201).json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al crear empleado" });
  }
});

// PATCH /api/employees/:id — update employee
employeesRouter.patch("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    nombreCompleto, dpi, telefono, correo, puesto, area,
    estadoLaboral, sede, supervisorNombre, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus, lastSyncAt,
  } = req.body ?? {};

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (nombreCompleto !== undefined) updates.nombreCompleto = nombreCompleto;
  if (dpi !== undefined) updates.dpi = dpi || null;
  if (telefono !== undefined) updates.telefono = telefono || null;
  if (correo !== undefined) updates.correo = correo || null;
  if (puesto !== undefined) updates.puesto = puesto || null;
  if (area !== undefined) updates.area = area || null;
  if (estadoLaboral !== undefined) updates.estadoLaboral = estadoLaboral;
  if (sede !== undefined) updates.sede = sede || null;
  if (supervisorNombre !== undefined) updates.supervisorNombre = supervisorNombre || null;
  if (fechaIngreso !== undefined) updates.fechaIngreso = fechaIngreso ? new Date(fechaIngreso) : null;
  if (notas !== undefined) updates.notas = notas || null;
  if (externalId !== undefined) updates.externalId = externalId || null;
  if (sourceSystem !== undefined) updates.sourceSystem = sourceSystem;
  if (syncStatus !== undefined) updates.syncStatus = syncStatus;
  if (lastSyncAt !== undefined) updates.lastSyncAt = lastSyncAt ? new Date(lastSyncAt) : null;

  try {
    const [emp] = await db
      .update(employeesTable)
      .set(updates)
      .where(eq(employeesTable.id, id))
      .returning();

    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar empleado" });
  }
});

export default employeesRouter;
