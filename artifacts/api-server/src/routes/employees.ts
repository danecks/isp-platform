import { Router } from "express";
import { db, employeesTable, usersTable, anticiposTable, pool } from "@workspace/db";
import { eq, asc, or, ilike, and, ne, desc } from "drizzle-orm";
import { calcularLimiteAnticipo } from "../services/anticipo-limite";
import { getPeriodoActivo } from "../services/whatsapp/anticipo-session";
import { calcularKPIDisciplinario } from "../services/disciplinary-kpi";
import { calcularKPIRotacion } from "../services/rotation-kpi";

const employeesRouter = Router();

// GET /api/employees — list all employees with optional filters
// M-01: Todos los filtros se aplican en SQL, no en memoria
employeesRouter.get("/employees", async (req, res) => {
  try {
    const {
      syncStatus, estadoLaboral, area, sourceSystem,
      clienteId, supervisorId, q,
    } = req.query as Record<string, string>;

    // Construir condiciones de filtro directamente en SQL
    const conditions = [];
    if (syncStatus)    conditions.push(eq(employeesTable.syncStatus, syncStatus));
    if (estadoLaboral) conditions.push(eq(employeesTable.estadoLaboral, estadoLaboral));
    if (area)          conditions.push(eq(employeesTable.area, area));
    if (sourceSystem)  conditions.push(eq(employeesTable.sourceSystem, sourceSystem));
    if (clienteId)     conditions.push(eq(employeesTable.clienteId, parseInt(clienteId)));
    if (supervisorId)  conditions.push(eq(employeesTable.supervisorId, parseInt(supervisorId)));
    if (q) {
      // Búsqueda de texto en múltiples columnas a nivel de DB
      conditions.push(
        or(
          ilike(employeesTable.nombreCompleto, `%${q}%`),
          ilike(employeesTable.dpi,            `%${q}%`),
          ilike(employeesTable.telefono,        `%${q}%`),
          ilike(employeesTable.puesto,          `%${q}%`),
          ilike(employeesTable.area,            `%${q}%`),
        )
      );
    }

    const filtered = await db
      .select()
      .from(employeesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(employeesTable.nombreCompleto));

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener empleados" });
  }
});

// GET /api/employees/sync/status — summary of sync state (must be before /:id)
// M-04: Conteos agregados en SQL en lugar de cargar todos los empleados en memoria
employeesRouter.get("/employees/sync/status", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE source_system = 'manual')               AS source_manual,
        COUNT(*) FILTER (WHERE source_system = 'hr_sql_external')      AS source_hr,
        COUNT(*) FILTER (WHERE source_system = 'api')                  AS source_api,
        COUNT(*) FILTER (WHERE sync_status = 'manual')                 AS sync_manual,
        COUNT(*) FILTER (WHERE sync_status = 'synced')                 AS sync_synced,
        COUNT(*) FILTER (WHERE sync_status = 'pending')                AS sync_pending,
        COUNT(*) FILTER (WHERE sync_status = 'error')                  AS sync_error,
        MAX(last_sync_at)                                              AS last_sync_at
      FROM employees
    `);
    const r = rows[0];
    const summary = {
      total:        parseInt(r.total),
      bySource: {
        manual:         parseInt(r.source_manual),
        hr_sql_external:parseInt(r.source_hr),
        api:            parseInt(r.source_api),
      },
      bySyncStatus: {
        manual:  parseInt(r.sync_manual),
        synced:  parseInt(r.sync_synced),
        pending: parseInt(r.sync_pending),
        error:   parseInt(r.sync_error),
      },
      lastSyncAt: r.last_sync_at ?? null,
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

// GET /api/employees/:id/user — usuario vinculado al empleado
employeesRouter.get("/employees/:id/user", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const { rows } = await pool.query<{
      id: number;
      nombre: string;
      username: string;
      correo: string | null;
      rol: string;
      estado: string;
      telefono: string | null;
      last_login: Date | null;
      created_at: Date;
    }>(`
      SELECT
        u.id,
        u.nombre,
        u.username,
        u.correo,
        u.rol,
        u.estado,
        u.telefono,
        u.created_at
      FROM users u
      WHERE u.employee_id = $1
      LIMIT 1
    `, [empId]);

    if (!rows.length) {
      return res.json(null);
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("[Employee/user] Error:", err);
    res.status(500).json({ error: "Error al obtener usuario vinculado" });
  }
});

// GET /api/employees/:id/operacion — actividad operativa reciente del empleado
employeesRouter.get("/employees/:id/operacion", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [emp] = await db
      .select({ nombreCompleto: employeesTable.nombreCompleto })
      .from(employeesTable)
      .where(eq(employeesTable.id, empId))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });

    const nombre = emp.nombreCompleto;

    // Tareas asignadas (via users.employee_id)
    const { rows: tareas } = await pool.query<{
      id: string;
      titulo: string;
      estado: string;
      prioridad: string;
      fecha_vencimiento: Date | null;
      created_at: Date;
    }>(`
      SELECT
        t.id, t.titulo, t.estado, t.prioridad, t.fecha_vencimiento, t.created_at
      FROM tareas t
      JOIN users u ON t.asignado_id = u.id
      WHERE u.employee_id = $1
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [empId]);

    // Incidencias relacionadas por nombre
    const { rows: incidencias } = await pool.query<{
      id: string;
      tipo: string;
      cliente: string;
      estado: string;
      prioridad: string;
      es_emergencia: boolean;
      created_at: Date;
    }>(`
      SELECT
        id, tipo, cliente, estado, prioridad, es_emergencia, created_at
      FROM incidents
      WHERE LOWER(responsable) LIKE LOWER($1)
      ORDER BY created_at DESC
      LIMIT 10
    `, [`%${nombre}%`]);

    // Anticipos del empleado
    const { rows: anticipos } = await pool.query<{
      id: number;
      cantidad: number;
      estado: string;
      periodo: string | null;
      fecha_solicitud: Date;
      origen: string;
    }>(`
      SELECT id, cantidad, estado, periodo, fecha_solicitud, origen
      FROM anticipos
      WHERE employee_id = $1
      ORDER BY fecha_solicitud DESC
      LIMIT 10
    `, [empId]);

    // Puesto operativo titular (asignación base)
    const { rows: puestoTitularRows } = await pool.query(`
      SELECT po.id, po.nombre AS puesto_nombre, po.cliente_nombre, po.turno,
             po.horario, po.jornada, po.estado AS estado_puesto,
             po.agente_id, po.agente_nombre,
             cs.nombre AS sede_nombre
      FROM puestos_operativos po
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      WHERE po.titular_employee_id = $1 AND po.activo = TRUE
      LIMIT 1
    `, [empId]);

    // Historial de relevos (cubrió como relevo)
    const { rows: historialRelevosRows } = await pool.query(`
      SELECT mo.fecha_hora, mo.cliente_nombre, mo.puesto_nombre, mo.tipo, mo.motivo,
             mo.agente_saliente_nombre
      FROM movimientos_operativos mo
      WHERE mo.agente_entrante_id = $1
        AND mo.tipo = 'sustitucion'
      ORDER BY mo.fecha_hora DESC
      LIMIT 5
    `, [empId]);

    res.json({
      tareas,
      incidencias,
      anticipos,
      puestoTitular: puestoTitularRows[0] ?? null,
      historialRelevos: historialRelevosRows,
    });
  } catch (err) {
    console.error("[Employee/operacion] Error:", err);
    res.status(500).json({ error: "Error al obtener actividad operativa" });
  }
});

// PATCH /api/employees/:id/estado — cambio rápido de estado laboral
employeesRouter.patch("/employees/:id/estado", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { estadoLaboral } = req.body ?? {};
  const ESTADOS_VALIDOS = ["activo", "suspendido", "baja", "licencia"];
  if (!estadoLaboral || !ESTADOS_VALIDOS.includes(estadoLaboral)) {
    return res.status(400).json({
      error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(", ")}`,
    });
  }

  try {
    const [emp] = await db
      .update(employeesTable)
      .set({ estadoLaboral, updatedAt: new Date() })
      .where(eq(employeesTable.id, id))
      .returning();

    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar estado" });
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
    nombreCompleto, dpi, telefono, telefonoSecundario, correo,
    puesto, tipoServicio, area, estadoLaboral, sede,
    supervisorNombre, supervisorId, clienteId, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus,
    sueldoBase, tipoJornada, diaDescanso, horasContrato,
  } = req.body ?? {};

  if (!nombreCompleto) {
    return res.status(400).json({ error: "nombreCompleto es requerido" });
  }

  // Validar unicidad de DPI
  if (dpi) {
    const [existing] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.dpi, dpi))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: "Ya existe un empleado con ese DPI" });
    }
  }

  try {
    const [emp] = await db
      .insert(employeesTable)
      .values({
        nombreCompleto,
        dpi: dpi || null,
        telefono: telefono || null,
        telefonoSecundario: telefonoSecundario || null,
        correo: correo || null,
        puesto: puesto || null,
        tipoServicio: tipoServicio || null,
        area: area || null,
        estadoLaboral: estadoLaboral || "activo",
        sede: sede || null,
        supervisorNombre: supervisorNombre || null,
        supervisorId: supervisorId ? parseInt(supervisorId) : null,
        clienteId: clienteId ? parseInt(clienteId) : null,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
        notas: notas || null,
        externalId: externalId || null,
        sourceSystem: sourceSystem || "manual",
        syncStatus: syncStatus || "manual",
        sueldoBase: sueldoBase != null && sueldoBase !== "" ? String(sueldoBase) : null,
        tipoJornada: tipoJornada || null,
        diaDescanso: diaDescanso || null,
        horasContrato: horasContrato ? parseInt(horasContrato) : null,
      })
      .returning();

    res.status(201).json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al crear empleado" });
  }
});

// GET /api/employees/:id/disciplinary — KPI disciplinario ────────────────────
employeesRouter.get("/employees/:id/disciplinary", async (req, res) => {
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
employeesRouter.get("/employees/:id/rotation", async (req, res) => {
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
employeesRouter.get("/employees/:id/anticipos", async (req, res) => {
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

    // Límite del período activo (si existe)
    const periodoActual = getPeriodoActivo();
    const limiteInfo = periodoActual
      ? await calcularLimiteAnticipo(id, periodoActual)
      : {
          limite: emp.limiteAnticipo,
          tipoLimitePeriodo: emp.tipoLimitePeriodo ?? "quincenal",
          solicitado: 0,
          restante: emp.limiteAnticipo,
          tieneLimite: emp.limiteAnticipo !== null,
          periodo: null,
        };

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

// PATCH /api/employees/:id — update employee
employeesRouter.patch("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    nombreCompleto, dpi, telefono, telefonoSecundario, correo,
    puesto, tipoServicio, area, estadoLaboral, sede,
    supervisorNombre, supervisorId, clienteId, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus, lastSyncAt,
    limiteAnticipo, tipoLimitePeriodo,
    sueldoBase, tipoJornada, diaDescanso, horasContrato,
  } = req.body ?? {};

  // Validar unicidad de DPI (excluir el propio empleado)
  if (dpi) {
    const [existing] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.dpi, dpi), ne(employeesTable.id, id)))
      .limit(1);
    if (existing) {
      return res.status(409).json({ error: "Ya existe otro empleado con ese DPI" });
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (nombreCompleto !== undefined) updates.nombreCompleto = nombreCompleto;
  if (dpi !== undefined) updates.dpi = dpi || null;
  if (telefono !== undefined) updates.telefono = telefono || null;
  if (telefonoSecundario !== undefined) updates.telefonoSecundario = telefonoSecundario || null;
  if (correo !== undefined) updates.correo = correo || null;
  if (puesto !== undefined) updates.puesto = puesto || null;
  if (tipoServicio !== undefined) updates.tipoServicio = tipoServicio || null;
  if (area !== undefined) updates.area = area || null;
  if (estadoLaboral !== undefined) updates.estadoLaboral = estadoLaboral;
  if (sede !== undefined) updates.sede = sede || null;
  if (supervisorNombre !== undefined) updates.supervisorNombre = supervisorNombre || null;
  if (supervisorId !== undefined) updates.supervisorId = supervisorId ? parseInt(supervisorId) : null;
  if (clienteId !== undefined) updates.clienteId = clienteId ? parseInt(clienteId) : null;
  if (fechaIngreso !== undefined) updates.fechaIngreso = fechaIngreso ? new Date(fechaIngreso) : null;
  if (notas !== undefined) updates.notas = notas || null;
  if (externalId !== undefined) updates.externalId = externalId || null;
  if (sourceSystem !== undefined) updates.sourceSystem = sourceSystem;
  if (syncStatus !== undefined) updates.syncStatus = syncStatus;
  if (lastSyncAt !== undefined) updates.lastSyncAt = lastSyncAt ? new Date(lastSyncAt) : null;
  if (limiteAnticipo !== undefined) {
    updates.limiteAnticipo = limiteAnticipo === null || limiteAnticipo === "" ? null : parseInt(limiteAnticipo);
    updates.ultimaActualizacionLimiteAt = new Date();
  }
  if (tipoLimitePeriodo !== undefined) updates.tipoLimitePeriodo = tipoLimitePeriodo || "quincenal";
  if (sueldoBase !== undefined) updates.sueldoBase = sueldoBase === null || sueldoBase === "" ? null : String(sueldoBase);
  if (tipoJornada !== undefined) updates.tipoJornada = tipoJornada || null;
  if (diaDescanso !== undefined) updates.diaDescanso = diaDescanso || null;
  if (horasContrato !== undefined) updates.horasContrato = horasContrato === null || horasContrato === "" ? null : parseInt(horasContrato);

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
