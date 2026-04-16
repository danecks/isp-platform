import { Router } from "express";
import { db, employeesTable, usersTable, anticiposTable, pool } from "@workspace/db";
import { eq, asc, or, ilike, and, ne, desc } from "drizzle-orm";
import { calcularLimiteAnticipo } from "../services/anticipo-limite";
import { getPeriodoActivo } from "../services/whatsapp/anticipo-session";
import { calcularKPIDisciplinario } from "../services/disciplinary-kpi";
import { calcularKPIRotacion } from "../services/rotation-kpi";
import { logger } from "../lib/logger";

const employeesRouter = Router();

// Convierte un objeto con keys snake_case a camelCase (un nivel)
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ]),
  );
}

// GET /api/employees — list all employees with optional filters
// M-01: SQL directo para incluir elegible_pool (campo fuera del schema Drizzle)
employeesRouter.get("/employees", async (req, res) => {
  try {
    const {
      syncStatus, estadoLaboral, area, sourceSystem,
      clienteId, supervisorId, q, tipoPersonal,
    } = req.query as Record<string, string>;

    const clauses: string[] = [];
    const params: unknown[]  = [];

    if (syncStatus)    { params.push(syncStatus);           clauses.push(`e.sync_status = $${params.length}`); }
    if (estadoLaboral) { params.push(estadoLaboral);        clauses.push(`e.estado_laboral = $${params.length}`); }
    if (area)          { params.push(area);                 clauses.push(`e.area = $${params.length}`); }
    if (sourceSystem)  { params.push(sourceSystem);         clauses.push(`e.source_system = $${params.length}`); }
    if (clienteId)     { params.push(parseInt(clienteId));  clauses.push(`e.cliente_id = $${params.length}`); }
    if (supervisorId)  { params.push(parseInt(supervisorId)); clauses.push(`e.supervisor_id = $${params.length}`); }
    if (tipoPersonal)  { params.push(tipoPersonal);         clauses.push(`e.tipo_personal = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      clauses.push(`(e.nombre_completo ILIKE $${i} OR e.dpi ILIKE $${i} OR e.telefono ILIKE $${i} OR e.puesto ILIKE $${i} OR e.area ILIKE $${i})`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const { rows } = await pool.query(`
      SELECT e.*,
             COALESCE(e.tipo_personal, 'guardia') AS tipo_personal,
             COALESCE(e.elegible_pool, TRUE) AS elegible_pool,
             COALESCE(e.aplica_igss_general, FALSE) AS aplica_igss_general,
             COALESCE(e.estado_igss, 'no_activo') AS estado_igss,
             e.fecha_inicio_igss,
             e.observaciones_igss,
             COALESCE(e.frecuencia_pago, 'quincenal') AS frecuencia_pago,
             c.nombre AS cliente_nombre
      FROM employees e
      LEFT JOIN clients c ON c.id = e.cliente_id
      ${where}
      ORDER BY e.tipo_personal, e.nombre_completo
    `, params);

    res.json(rows.map(snakeToCamel));
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

// ── GET /api/employees/:id/historial-asignaciones ─────────────────────────────
employeesRouter.get("/employees/:id/historial-asignaciones", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });

  const desde = typeof req.query.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde)
    ? req.query.desde : null;
  const hasta = typeof req.query.hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta)
    ? req.query.hasta : null;

  try {
    const { rows: coberturas } = await pool.query(`
      SELECT
        cs.fecha,
        cs.puesto_id,
        po.nombre AS puesto_nombre,
        cs.client_id,
        COALESCE(po.cliente_nombre, c.nombre) AS cliente_nombre,
        cs.tipo_cobertura,
        cs.hora_inicio,
        cs.hora_fin,
        cs.horas_calculadas,
        cs.horas_extra_calculadas,
        cs.genera_horas_extra,
        cs.fue_en_dia_descanso,
        cs.motivo,
        cs.cubriendo_a_nombre,
        cs.observaciones,
        cs.created_at
      FROM cobertura_segmentos cs
      LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
      LEFT JOIN clients c ON c.id = cs.client_id
      WHERE cs.employee_id = $1
        AND ($2::date IS NULL OR cs.fecha >= $2::date)
        AND ($3::date IS NULL OR cs.fecha <= $3::date)
      ORDER BY cs.fecha DESC, cs.created_at DESC
    `, [empId, desde, hasta]);

    const { rows: titularidades } = await pool.query(`
      SELECT
        pth.puesto_id,
        po.nombre AS puesto_nombre,
        po.cliente_nombre,
        pth.fecha_inicio,
        pth.fecha_fin,
        pth.motivo,
        pth.created_at
      FROM puesto_titular_historico pth
      LEFT JOIN puestos_operativos po ON po.id = pth.puesto_id
      WHERE pth.employee_id = $1
        AND ($2::date IS NULL OR pth.fecha_inicio >= $2::date OR (pth.fecha_fin IS NULL OR pth.fecha_fin >= $2::date))
        AND ($3::date IS NULL OR pth.fecha_inicio <= $3::date)
      ORDER BY pth.fecha_inicio DESC, pth.created_at DESC
    `, [empId, desde, hasta]);

    const { rows: titularActual } = await pool.query(`
      SELECT
        pt.puesto_id,
        po.nombre AS puesto_nombre,
        po.cliente_nombre,
        pt.created_at AS fecha_inicio
      FROM puesto_titulares pt
      JOIN puestos_operativos po ON po.id = pt.puesto_id AND po.activo = TRUE
      WHERE pt.employee_id = $1 AND pt.activo = TRUE
      ORDER BY pt.orden
    `, [empId]);

    res.json({
      coberturas,
      titularidades,
      titularActual: titularActual[0] ?? null,
    });
  } catch (err) {
    console.error("[Employee/historial-asignaciones] Error:", err);
    res.status(500).json({ error: "Error al obtener historial de asignaciones" });
  }
});

// ── GET /api/employees/by-dpi/:dpi — búsqueda pública por DPI (kiosco actualización) ──
employeesRouter.get("/employees/by-dpi/:dpi", async (req, res) => {
  const dpi = req.params.dpi?.trim();
  if (!dpi) return res.status(400).json({ error: "DPI requerido" });
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre_completo, dpi, telefono, telefono_secundario, correo,
              direccion, municipio, departamento, foto_url,
              banco, cuenta_bancaria, forma_pago, tipo_cuenta,
              nombre_contacto_emergencia, telefono_emergencia, parentesco_emergencia,
              dpi_frente_url, dpi_reverso_url, estado_laboral, puesto, tipo_personal
       FROM employees WHERE dpi = $1 LIMIT 1`,
      [dpi]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrado en el sistema" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar empleado" });
  }
});

// ── PATCH /api/employees/:id/self-update — actualización pública de datos (kiosco) ──
employeesRouter.patch("/employees/:id/self-update", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const {
    telefono, telefono_secundario, correo,
    direccion, municipio, departamento,
    banco, forma_pago, tipo_cuenta, cuenta_bancaria,
    nombre_contacto_emergencia, telefono_emergencia, parentesco_emergencia,
    dpi_frente_url, dpi_reverso_url, foto_url,
  } = req.body ?? {};
  try {
    await pool.query(
      `UPDATE employees SET
        telefono                    = COALESCE($1,  telefono),
        telefono_secundario         = COALESCE($2,  telefono_secundario),
        correo                      = COALESCE($3,  correo),
        direccion                   = COALESCE($4,  direccion),
        municipio                   = COALESCE($5,  municipio),
        departamento                = COALESCE($6,  departamento),
        banco                       = COALESCE($7,  banco),
        forma_pago                  = COALESCE($8,  forma_pago),
        tipo_cuenta                 = COALESCE($9,  tipo_cuenta),
        cuenta_bancaria             = COALESCE($10, cuenta_bancaria),
        nombre_contacto_emergencia  = COALESCE($11, nombre_contacto_emergencia),
        telefono_emergencia         = COALESCE($12, telefono_emergencia),
        parentesco_emergencia       = COALESCE($13, parentesco_emergencia),
        dpi_frente_url              = COALESCE($14, dpi_frente_url),
        dpi_reverso_url             = COALESCE($15, dpi_reverso_url),
        foto_url                    = COALESCE($16, foto_url),
        updated_at                  = NOW()
       WHERE id = $17`,
      [
        telefono || null,
        telefono_secundario || null,
        correo || null,
        direccion || null,
        municipio || null,
        departamento || null,
        banco || null,
        forma_pago || null,
        tipo_cuenta || null,
        cuenta_bancaria || null,
        nombre_contacto_emergencia || null,
        telefono_emergencia || null,
        parentesco_emergencia || null,
        dpi_frente_url || null,
        dpi_reverso_url || null,
        foto_url || null,
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar datos" });
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
    // enriquecer con campo frecuencia_pago (fuera del schema Drizzle)
    const { rows: [extra] } = await pool.query(
      `SELECT COALESCE(frecuencia_pago, 'quincenal') AS "frecuenciaPago" FROM employees WHERE id = $1`, [id]
    );
    res.json({ ...emp, frecuenciaPago: extra?.frecuenciaPago ?? "quincenal" });
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
    frecuenciaPago, tipoPersonal,
  } = req.body ?? {};

  if (!nombreCompleto || !String(nombreCompleto).trim()) {
    return res.status(400).json({ error: "El nombre completo del empleado es requerido" });
  }
  if (!dpi || !String(dpi).trim()) {
    return res.status(400).json({ error: "El DPI del empleado es requerido" });
  }
  const nombreCompletoLimpio = String(nombreCompleto).trim();
  const dpiLimpio = String(dpi).trim();

  // Validar unicidad de DPI — distinguir entre activo y de baja (reingreso disponible)
  {
    const { rows: dup } = await pool.query(
      `SELECT id, nombre_completo, estado_laboral, fecha_ingreso, fecha_baja, motivo_baja, puesto, area
         FROM employees WHERE dpi = $1 LIMIT 1`,
      [dpiLimpio]
    );
    if (dup[0]) {
      const e = dup[0];
      if (e.estado_laboral === "baja") {
        // Conteo de períodos previos para mostrar al usuario
        const { rows: cnt } = await pool.query(
          `SELECT COUNT(*)::int AS n FROM empleados_periodos_laborales WHERE employee_id = $1`,
          [e.id]
        );
        return res.status(409).json({
          code: "REINGRESO_DISPONIBLE",
          error: `Ya existe un empleado con ese DPI dado de baja. Puede registrar un reingreso.`,
          empleado: {
            id: e.id,
            nombreCompleto: e.nombre_completo,
            estadoLaboral: e.estado_laboral,
            fechaIngreso: e.fecha_ingreso,
            fechaBaja: e.fecha_baja,
            motivoBaja: e.motivo_baja,
            puesto: e.puesto,
            area: e.area,
            periodosPrevios: cnt[0]?.n ?? 0,
          },
        });
      }
      return res.status(409).json({
        code: "DPI_DUPLICADO_ACTIVO",
        error: `Ya existe un empleado activo con ese DPI: ${e.nombre_completo}`,
        empleado: { id: e.id, nombreCompleto: e.nombre_completo, estadoLaboral: e.estado_laboral },
      });
    }
  }

  try {
    const [emp] = await db
      .insert(employeesTable)
      .values({
        nombreCompleto: nombreCompletoLimpio,
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
        tipoPersonal: ["guardia", "supervisor", "jefe_servicio", "administrativo_bodega", "administrativo_rrhh", "gerencia"].includes(tipoPersonal) ? tipoPersonal : "guardia",
      })
      .returning();

    // FREQ: persist frecuencia_pago (fuera del schema Drizzle)
    const freqVal = ["quincenal", "mensual"].includes(frecuenciaPago) ? frecuenciaPago : "quincenal";
    await pool.query(`UPDATE employees SET frecuencia_pago = $1 WHERE id = $2`, [freqVal, emp.id]);

    // CONT: auto-generar 2 contratos al contratar
    const fechaBase: Date = fechaIngreso ? new Date(fechaIngreso) : new Date();
    const fechaPostPrueba = new Date(fechaBase);
    fechaPostPrueba.setMonth(fechaPostPrueba.getMonth() + 2);
    const puestoContrato = puesto || null;
    const sueldoContrato = sueldoBase != null && sueldoBase !== "" ? parseFloat(String(sueldoBase)) : null;

    await pool.query(`
      INSERT INTO contratos_empleados
        (employee_id, tipo_contrato, etiqueta, fecha_contrato, fecha_inicio, puesto, sueldo_base, observaciones, generado_automatico)
      VALUES
        ($1, 'inicial',    'Contrato inicial',                   $2, $2, $3, $4, 'Generado automáticamente al ingresar colaborador.', TRUE),
        ($1, 'post_prueba','Contrato post período de prueba',     $5, $5, $3, $4, 'Generado automáticamente. Fecha tentativa de confirmación (+2 meses).', TRUE)
    `, [emp.id, fechaBase, puestoContrato, sueldoContrato, fechaPostPrueba]);

    const { rows: empCompleto } = await pool.query(
      `SELECT *, COALESCE(frecuencia_pago, 'quincenal') AS frecuencia_pago FROM employees WHERE id = $1`, [emp.id]
    );

    // DOT-KIT: si hay un kit de ingreso configurado, generar dotación pendiente para bodega
    try {
      const { rows: kitItems } = await pool.query(
        `SELECT * FROM kit_ingreso_items WHERE activo = TRUE ORDER BY id`
      );
      if (kitItems.length > 0) {
        const { rows: [dotPend] } = await pool.query(`
          INSERT INTO dotacion_pendiente (employee_id, estado, notas)
          VALUES ($1, 'pendiente', $2) RETURNING id
        `, [emp.id, `Kit de ingreso generado automáticamente al dar de alta a ${nombreCompletoLimpio}`]);
        for (const item of kitItems) {
          await pool.query(`
            INSERT INTO dotacion_pendiente_items (dotacion_id, articulo_id, nombre_articulo, cantidad)
            VALUES ($1, $2, $3, $4)
          `, [dotPend.id, item.articulo_id || null, item.nombre_articulo, item.cantidad]);
        }
      }
    } catch (kitErr) {
      logger.warn({ kitErr }, "DOT-KIT: no se pudo crear dotación pendiente (no bloqueante)");
    }

    res.status(201).json(snakeToCamel(empCompleto[0] ?? emp as unknown as Record<string, unknown>));
  } catch (err) {
    logger.error({ err }, "POST /employees error");
    res.status(500).json({ error: "Error al crear empleado" });
  }
});

// GET /api/employees/:id/periodos — historial de períodos laborales ─────────
employeesRouter.get("/employees/:id/periodos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(
      `SELECT p.*, l.id AS liq_id, l.total_neto AS liq_total
         FROM empleados_periodos_laborales p
         LEFT JOIN prestaciones_liquidaciones l ON l.id = p.liquidacion_id
        WHERE p.employee_id = $1
        ORDER BY p.numero_periodo ASC`,
      [id]
    );
    res.json({ rows });
  } catch (err) {
    logger.error({ err }, "GET /employees/:id/periodos error");
    res.status(500).json({ error: "Error al obtener períodos" });
  }
});

// POST /api/employees/:id/reingreso — reactivar empleado dado de baja ───────
// Resetea: vacaciones, prestaciones acumuladas, contrato (nueva alta legal)
// Conserva: datos personales, historial de períodos, liquidaciones previas, eventos RRHH
employeesRouter.post("/employees/:id/reingreso", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    fechaIngreso, sueldoBase, tipoJornada, diaDescanso, horasContrato,
    frecuenciaPago, tipoPersonal, puesto, area, telefono, telefonoSecundario,
    correo, notas,
  } = req.body ?? {};

  if (!fechaIngreso) {
    return res.status(400).json({ error: "La fecha de ingreso del reingreso es requerida" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar que el empleado existe y está de baja
    const { rows: empRows } = await client.query(
      `SELECT id, nombre_completo, estado_laboral FROM employees WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!empRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    if (empRows[0].estado_laboral !== "baja") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El empleado no está de baja — no aplica reingreso" });
    }

    // Obtener siguiente número de período
    const { rows: maxRows } = await client.query(
      `SELECT COALESCE(MAX(numero_periodo), 0) AS max_n FROM empleados_periodos_laborales WHERE employee_id = $1`,
      [id]
    );
    const siguientePeriodo = (maxRows[0]?.max_n ?? 0) + 1;

    // Abrir nuevo período
    await client.query(
      `INSERT INTO empleados_periodos_laborales (employee_id, numero_periodo, fecha_ingreso, notas)
       VALUES ($1, $2, $3, $4)`,
      [id, siguientePeriodo, fechaIngreso, notas || `Reingreso #${siguientePeriodo}`]
    );

    // Reactivar empleado: estado activo, nueva fecha_ingreso, limpiar baja, actualizar opcionales
    await client.query(
      `UPDATE employees SET
         estado_laboral      = 'activo',
         fecha_ingreso       = $1,
         fecha_baja          = NULL,
         motivo_baja         = NULL,
         puesto              = COALESCE($2, puesto),
         area                = COALESCE($3, area),
         telefono            = COALESCE($4, telefono),
         telefono_secundario = COALESCE($5, telefono_secundario),
         correo              = COALESCE($6, correo),
         sueldo_base         = COALESCE($7, sueldo_base),
         tipo_jornada        = COALESCE($8, tipo_jornada),
         dia_descanso        = COALESCE($9, dia_descanso),
         horas_contrato      = COALESCE($10, horas_contrato),
         frecuencia_pago     = COALESCE($11, frecuencia_pago),
         tipo_personal       = COALESCE($12, tipo_personal),
         updated_at          = NOW()
       WHERE id = $13`,
      [
        fechaIngreso,
        puesto || null, area || null, telefono || null, telefonoSecundario || null, correo || null,
        sueldoBase != null && sueldoBase !== "" ? String(sueldoBase) : null,
        tipoJornada || null, diaDescanso || null,
        horasContrato ? parseInt(horasContrato) : null,
        frecuenciaPago && ["quincenal", "mensual"].includes(frecuenciaPago) ? frecuenciaPago : null,
        tipoPersonal && ["guardia", "supervisor", "jefe_servicio", "administrativo_bodega", "administrativo_rrhh", "gerencia"].includes(tipoPersonal) ? tipoPersonal : null,
        id,
      ]
    );

    // RESET vacaciones — nueva alta empieza con saldo en 0
    await client.query(
      `UPDATE vacaciones_saldos
         SET dias_ganados = 0, dias_gozados = 0, dias_disponibles = 0,
             dias_pendientes_pago = 0, fecha_ultima_actualizacion = NOW()
       WHERE employee_id = $1`,
      [id]
    );

    // RESET prestaciones acumuladas — nueva alta empieza con acumulados en 0
    await client.query(
      `DELETE FROM prestaciones_acumulados WHERE employee_id = $1`,
      [id]
    );

    // Generar nuevos contratos (inicial + post-prueba) para esta nueva alta
    const fechaBase = new Date(fechaIngreso);
    const fechaPostPrueba = new Date(fechaBase);
    fechaPostPrueba.setMonth(fechaPostPrueba.getMonth() + 2);
    const sueldoContrato = sueldoBase != null && sueldoBase !== "" ? parseFloat(String(sueldoBase)) : null;

    await client.query(`
      INSERT INTO contratos_empleados
        (employee_id, tipo_contrato, etiqueta, fecha_contrato, fecha_inicio, puesto, sueldo_base, observaciones, generado_automatico)
      VALUES
        ($1, 'inicial',    $6,                                                        $2, $2, $3, $4, $7, TRUE),
        ($1, 'post_prueba','Contrato post período de prueba (reingreso)',             $5, $5, $3, $4, 'Generado automáticamente. Confirmación tentativa (+2 meses).', TRUE)
    `, [
      id, fechaBase, puesto || null, sueldoContrato, fechaPostPrueba,
      `Contrato inicial — Reingreso #${siguientePeriodo}`,
      `Generado automáticamente al reingresar al colaborador (período laboral #${siguientePeriodo}).`,
    ]);

    await client.query("COMMIT");

    const { rows: empCompleto } = await pool.query(
      `SELECT *, COALESCE(frecuencia_pago, 'quincenal') AS frecuencia_pago FROM employees WHERE id = $1`, [id]
    );
    logger.info({ employeeId: id, numeroPeriodo: siguientePeriodo }, "Reingreso registrado");
    res.status(200).json({
      ok: true,
      numeroPeriodo: siguientePeriodo,
      empleado: snakeToCamel(empCompleto[0] ?? {}),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /employees/:id/reingreso error");
    res.status(500).json({ error: "Error al registrar reingreso" });
  } finally {
    client.release();
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

  // Control de permisos: operaciones/jefe_servicio no pueden editar personal administrativo
  const sessionRaw = req.headers["x-isp-session"] as string | undefined;
  let rolSesion = "desconocido";
  if (sessionRaw) {
    try { rolSesion = (JSON.parse(sessionRaw)?.rol ?? "").toLowerCase(); } catch { /* ignorar */ }
  }
  const ROLES_OPS_SOLO = ["operaciones", "jefe_servicio", "ops"];

  // Verificar tipo_personal actual del empleado para el guard
  if (ROLES_OPS_SOLO.includes(rolSesion)) {
    const { rows: [empActual] } = await pool.query(
      `SELECT COALESCE(tipo_personal, 'guardia') AS tipo_personal FROM employees WHERE id = $1`, [id]
    );
    const TIPOS_PROTEGIDOS = ["administrativo_bodega", "administrativo_rrhh", "gerencia", "administrativo"];
    if (TIPOS_PROTEGIDOS.includes(empActual?.tipo_personal ?? "")) {
      return res.status(403).json({ error: "Sin permiso para modificar personal administrativo o gerencia. Contacte a RRHH." });
    }
  }

  const {
    nombreCompleto, dpi, telefono, telefonoSecundario, correo,
    puesto, tipoServicio, area, estadoLaboral, sede,
    supervisorNombre, supervisorId, clienteId, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus, lastSyncAt,
    limiteAnticipo, tipoLimitePeriodo,
    sueldoBase, tipoJornada, diaDescanso, horasContrato,
    frecuenciaPago, tipoPersonal,
    bonificacionIncentivo, bonificacion1, bonificacion2, bonificacion3,
    // IGSS — elegibilidad por colaborador
    aplicaIgssGeneral, estadoIgss, fechaInicioIgss, observacionesIgss,
  } = req.body ?? {};

  // Validar que nombreCompleto no se borre si se envía
  if (nombreCompleto !== undefined && !String(nombreCompleto).trim()) {
    return res.status(400).json({ error: "El nombre completo no puede quedar vacío" });
  }

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

  if (nombreCompleto !== undefined) updates.nombreCompleto = String(nombreCompleto).trim();
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
  const toNum = (v: unknown) => v === null || v === "" || v === undefined ? null : parseFloat(String(v));
  if (bonificacionIncentivo !== undefined) updates.bonificacionIncentivo = toNum(bonificacionIncentivo);
  if (bonificacion1        !== undefined) updates.bonificacion1         = toNum(bonificacion1);
  if (bonificacion2        !== undefined) updates.bonificacion2         = toNum(bonificacion2);
  if (bonificacion3        !== undefined) updates.bonificacion3         = toNum(bonificacion3);
  const VALID_TIPOS = ["guardia", "supervisor", "jefe_servicio", "administrativo_bodega", "administrativo_rrhh", "gerencia", "administrativo"];
  if (tipoPersonal !== undefined && VALID_TIPOS.includes(tipoPersonal)) {
    updates.tipoPersonal = tipoPersonal;
  }

  try {
    const [emp] = await db
      .update(employeesTable)
      .set(updates)
      .where(eq(employeesTable.id, id))
      .returning();

    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });

    // IGSS fields están fuera del schema Drizzle — actualizar con SQL directo si se envían
    const igssUpdates: string[] = [];
    const igssParams: unknown[] = [id];
    if (aplicaIgssGeneral !== undefined) {
      igssParams.push(!!aplicaIgssGeneral);
      igssUpdates.push(`aplica_igss_general = $${igssParams.length}`);
    }
    if (estadoIgss !== undefined) {
      const validEstados = ["activo", "no_activo", "pendiente_regularizacion"];
      if (!validEstados.includes(estadoIgss)) return res.status(400).json({ error: "estado_igss inválido" });
      igssParams.push(estadoIgss);
      igssUpdates.push(`estado_igss = $${igssParams.length}`);
    }
    if (fechaInicioIgss !== undefined) {
      igssParams.push(fechaInicioIgss || null);
      igssUpdates.push(`fecha_inicio_igss = $${igssParams.length}`);
    }
    if (observacionesIgss !== undefined) {
      igssParams.push(observacionesIgss || null);
      igssUpdates.push(`observaciones_igss = $${igssParams.length}`);
    }
    if (igssUpdates.length > 0) {
      await pool.query(
        `UPDATE employees SET ${igssUpdates.join(", ")} WHERE id = $1`,
        igssParams
      );
    }

    // FREQ: persistir frecuencia_pago si se envió
    if (frecuenciaPago !== undefined) {
      const freqVal = ["quincenal", "mensual"].includes(frecuenciaPago) ? frecuenciaPago : "quincenal";
      await pool.query(`UPDATE employees SET frecuencia_pago = $1 WHERE id = $2`, [freqVal, id]);
    }

    // Devolver el registro completo incluyendo campos IGSS y frecuencia_pago
    const { rows: full } = await pool.query(
      `SELECT *, COALESCE(aplica_igss_general, FALSE) AS aplica_igss_general,
               COALESCE(estado_igss, 'no_activo') AS estado_igss,
               fecha_inicio_igss, observaciones_igss,
               COALESCE(frecuencia_pago, 'quincenal') AS frecuencia_pago
       FROM employees WHERE id = $1`,
      [id]
    );
    res.json(full[0] ? snakeToCamel(full[0]) : snakeToCamel(emp as unknown as Record<string, unknown>));
  } catch (err) {
    logger.error({ err }, "PATCH /employees/:id error");
    res.status(500).json({ error: "Error al actualizar empleado" });
  }
});

// ─── GET /api/employees/:id/asignacion-operativa ─────────────────────────────
employeesRouter.get("/employees/:id/asignacion-operativa", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const { rows } = await pool.query(`
      SELECT
        eoa.id,
        eoa.employee_id,
        eoa.puesto_id,
        eoa.sede_id,
        eoa.cliente_id,
        eoa.zona_operativa_id,
        eoa.tipo_turno_id,
        eoa.tipo_asignacion,
        eoa.activa,
        eoa.fecha_inicio,
        eoa.notas,
        eoa.created_at,
        eoa.updated_at,
        -- Datos derivados del puesto
        po.nombre          AS puesto_nombre,
        po.turno           AS puesto_turno_texto,
        po.horario         AS puesto_horario,
        po.jornada         AS puesto_jornada,
        po.estado          AS puesto_estado,
        -- Datos derivados de la sede
        cs.nombre          AS sede_nombre,
        -- Datos derivados del cliente
        c.nombre           AS cliente_nombre,
        c.portal_cliente_id AS cliente_portal_id,
        -- Datos derivados de la zona
        oz.nombre          AS zona_nombre,
        -- Turno de nómina
        t.nombre           AS turno_nombre,
        t.horas_trabajo    AS turno_horas_trabajo,
        t.horas_descanso   AS turno_horas_descanso,
        -- Supervisor derivado de la zona operativa
        e_sup.id           AS supervisor_id,
        e_sup.nombre_completo AS supervisor_nombre,
        e_sup.telefono     AS supervisor_telefono,
        e_sup.puesto       AS supervisor_puesto
      FROM employee_operational_assignments eoa
      LEFT JOIN puestos_operativos po    ON po.id = eoa.puesto_id
      LEFT JOIN client_sedes cs          ON cs.id = eoa.sede_id
      LEFT JOIN clients c                ON c.id  = eoa.cliente_id
      LEFT JOIN operational_zones oz     ON oz.id = eoa.zona_operativa_id
      LEFT JOIN turnos t                 ON t.id  = eoa.tipo_turno_id
      LEFT JOIN employees e_sup          ON e_sup.id = oz.supervisor_employee_id
      WHERE eoa.employee_id = $1 AND eoa.activa = TRUE
      ORDER BY eoa.created_at DESC
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      return res.json({ sin_asignacion: true, tipo_asignacion: "sin_asignacion" });
    }
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /employees/:id/asignacion-operativa error");
    return res.status(500).json({ error: "Error al obtener asignación operativa" });
  }
});

// ─── PUT /api/employees/:id/asignacion-operativa ──────────────────────────────
employeesRouter.put("/employees/:id/asignacion-operativa", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
    tipo_asignacion = "sin_asignacion", notas, fecha_inicio,
  } = req.body;

  try {
    // Verificar que el empleado existe
    const { rows: emp } = await pool.query(`SELECT id FROM employees WHERE id = $1`, [id]);
    if (emp.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });

    // Obtener asignación activa anterior (para saber qué puesto limpiar en el pizarrón)
    const { rows: prevAsig } = await pool.query(`
      SELECT puesto_id FROM employee_operational_assignments
      WHERE employee_id = $1 AND activa = TRUE
      LIMIT 1
    `, [id]);
    const prevPuestoId: number | null = prevAsig[0]?.puesto_id ?? null;

    // Desactivar asignación activa anterior
    await pool.query(`
      UPDATE employee_operational_assignments
      SET activa = FALSE, updated_at = NOW()
      WHERE employee_id = $1 AND activa = TRUE
    `, [id]);

    // ── Sincronizar pizarrón operativo (puestos_operativos) ──────────────────
    // 1. Si el empleado tenía titular en otro puesto, limpiar ese puesto
    if (prevPuestoId && prevPuestoId !== (puesto_id || null)) {
      await pool.query(`
        UPDATE puestos_operativos
        SET titular_employee_id = NULL, estado = 'descubierto', updated_at = NOW()
        WHERE id = $1 AND titular_employee_id = $2
      `, [prevPuestoId, id]);
    }
    // 2. Si este empleado ya era titular en algún otro puesto distinto, limpiarlo también
    await pool.query(`
      UPDATE puestos_operativos
      SET titular_employee_id = NULL, estado = 'descubierto', updated_at = NOW()
      WHERE titular_employee_id = $1 AND id != $2
    `, [id, puesto_id || 0]);
    // 3. Asignar como titular en el nuevo puesto (solo si tipo_asignacion = 'titular' y hay puesto)
    if (tipo_asignacion === "titular" && puesto_id) {
      await pool.query(`
        UPDATE puestos_operativos
        SET titular_employee_id = $1, estado = 'cubierto', updated_at = NOW()
        WHERE id = $2
      `, [id, puesto_id]);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Crear nueva asignación
    const { rows } = await pool.query(`
      INSERT INTO employee_operational_assignments
        (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
         tipo_asignacion, activa, fecha_inicio, notas, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,NOW(),NOW())
      RETURNING *
    `, [
      id,
      puesto_id || null,
      sede_id || null,
      cliente_id || null,
      zona_operativa_id || null,
      tipo_turno_id || null,
      tipo_asignacion,
      fecha_inicio ? new Date(fecha_inicio) : new Date(),
      notas || null,
    ]);

    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PUT /employees/:id/asignacion-operativa error");
    return res.status(500).json({ error: "Error al guardar asignación operativa" });
  }
});

// ─── GET /api/employees/:id/titular-historico ────────────────────────────────
// Historial de puestos donde el colaborador fue o es titular
employeesRouter.get("/employees/:id/titular-historico", async (req, res) => {
  const empId = parseInt(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT
         pth.id,
         pth.puesto_id,
         pth.employee_id,
         TO_CHAR(pth.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
         TO_CHAR(pth.fecha_fin,   'YYYY-MM-DD') AS fecha_fin,
         pth.motivo,
         pth.creado_por,
         po.nombre           AS puesto_nombre,
         c.nombre            AS cliente_nombre,
         cs.nombre           AS sede_nombre
       FROM puesto_titular_historico pth
       JOIN puestos_operativos po ON po.id = pth.puesto_id
       LEFT JOIN clients        c  ON c.id  = po.cliente_id
       LEFT JOIN client_sedes   cs ON cs.id = po.sede_id
       WHERE pth.employee_id = $1
       ORDER BY pth.fecha_inicio DESC`,
      [empId]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /employees/:id/titular-historico error");
    res.status(500).json({ error: "Error al cargar historial de titularidad" });
  }
});

// ─── GET /api/employees/:id/contratos ────────────────────────────────────────
employeesRouter.get("/employees/:id/contratos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(`
      SELECT id, employee_id, tipo_contrato, etiqueta,
             TO_CHAR(fecha_contrato, 'YYYY-MM-DD') AS fecha_contrato,
             TO_CHAR(fecha_inicio,   'YYYY-MM-DD') AS fecha_inicio,
             TO_CHAR(fecha_fin,      'YYYY-MM-DD') AS fecha_fin,
             puesto, sueldo_base, observaciones,
             generado_automatico, metadata, created_at
      FROM contratos_empleados
      WHERE employee_id = $1
      ORDER BY fecha_contrato ASC, id ASC
    `, [id]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /employees/:id/contratos error");
    res.status(500).json({ error: "Error al obtener contratos" });
  }
});

// ─── POST /api/employees/:id/contratos ───────────────────────────────────────
employeesRouter.post("/employees/:id/contratos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { tipoContrato, etiqueta, fechaContrato, fechaInicio, fechaFin, puesto, sueldoBase, observaciones } = req.body ?? {};
  if (!etiqueta || !fechaContrato || !fechaInicio) {
    return res.status(400).json({ error: "etiqueta, fechaContrato y fechaInicio son requeridos" });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO contratos_empleados
        (employee_id, tipo_contrato, etiqueta, fecha_contrato, fecha_inicio, fecha_fin, puesto, sueldo_base, observaciones, generado_automatico)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
      RETURNING *
    `, [id, tipoContrato ?? "inicial", etiqueta, fechaContrato, fechaInicio, fechaFin ?? null, puesto ?? null, sueldoBase ?? null, observaciones ?? null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /employees/:id/contratos error");
    res.status(500).json({ error: "Error al crear contrato" });
  }
});

// ─── PATCH /api/employees/:id/foto ───────────────────────────────────────────
// Actualiza la foto_url del empleado (ruta del objeto en GCS)
employeesRouter.patch("/employees/:id/foto", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { foto_url } = req.body ?? {};
  if (!foto_url) return res.status(400).json({ error: "foto_url requerida" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE employees SET foto_url = $1, updated_at = NOW() WHERE id = $2`,
      [foto_url, id]
    );
    if (!rowCount) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /employees/:id/foto error");
    res.status(500).json({ error: "Error actualizando foto" });
  }
});

export default employeesRouter;
