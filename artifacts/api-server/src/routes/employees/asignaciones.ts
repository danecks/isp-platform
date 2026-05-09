import { Router } from "express";
import { db, employeesTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/employees/:id/asignaciones — asignaciones del empleado
router.get("/employees/:id/asignaciones", async (req, res) => {
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

// GET /api/employees/:id/operacion — actividad operativa reciente del empleado
router.get("/employees/:id/operacion", async (req, res) => {
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
router.get("/employees/:id/historial-asignaciones", async (req, res) => {
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

// ─── GET /api/employees/:id/asignacion-operativa ─────────────────────────────
router.get("/employees/:id/asignacion-operativa", async (req, res) => {
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
        e_sup.puesto       AS supervisor_puesto,
        FALSE              AS derivada_de_pizarron
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

    if (rows.length > 0) {
      return res.json(rows[0]);
    }

    // ── Fallback: titular en el Pizarrón Operativo (puestos_operativos.titular_employee_id)
    // Cuando se asignó al empleado como titular desde el Pizarrón (drag&drop u otro flujo
    // de Operaciones), aún no existe la fila en employee_operational_assignments.
    // Inferimos la asignación desde puestos_operativos para evitar mostrar "Sin asignación"
    // cuando en realidad sí lo está.
    const { rows: po1 } = await pool.query(`
      SELECT
        NULL::int             AS id,
        $1::int               AS employee_id,
        po.id                 AS puesto_id,
        po.sede_id,
        po.cliente_id,
        po.zona_operativa_id,
        po.tipo_turno_id,
        'titular'             AS tipo_asignacion,
        TRUE                  AS activa,
        po.fecha_inicio_ciclo AS fecha_inicio,
        NULL::text            AS notas,
        po.created_at,
        po.updated_at,
        po.nombre             AS puesto_nombre,
        po.turno              AS puesto_turno_texto,
        po.horario            AS puesto_horario,
        po.jornada            AS puesto_jornada,
        po.estado             AS puesto_estado,
        cs.nombre             AS sede_nombre,
        c.nombre              AS cliente_nombre,
        c.portal_cliente_id   AS cliente_portal_id,
        oz.nombre             AS zona_nombre,
        t.nombre              AS turno_nombre,
        t.horas_trabajo       AS turno_horas_trabajo,
        t.horas_descanso      AS turno_horas_descanso,
        e_sup.id              AS supervisor_id,
        e_sup.nombre_completo AS supervisor_nombre,
        e_sup.telefono        AS supervisor_telefono,
        e_sup.puesto          AS supervisor_puesto,
        TRUE                  AS derivada_de_pizarron
      FROM puestos_operativos po
      LEFT JOIN client_sedes cs       ON cs.id = po.sede_id
      LEFT JOIN clients c             ON c.id  = po.cliente_id
      LEFT JOIN operational_zones oz  ON oz.id = po.zona_operativa_id
      LEFT JOIN turnos t              ON t.id  = po.tipo_turno_id
      LEFT JOIN employees e_sup       ON e_sup.id = oz.supervisor_employee_id
      WHERE po.titular_employee_id = $1 AND COALESCE(po.activo, TRUE) = TRUE
      ORDER BY po.updated_at DESC NULLS LAST, po.id ASC
      LIMIT 1
    `, [id]);

    if (po1.length > 0) {
      return res.json(po1[0]);
    }

    // ── Fallback 2: titular en puesto_titulares (sistema multi-titular del Pizarrón)
    const { rows: pt1 } = await pool.query(`
      SELECT
        NULL::int             AS id,
        $1::int               AS employee_id,
        po.id                 AS puesto_id,
        po.sede_id,
        po.cliente_id,
        po.zona_operativa_id,
        po.tipo_turno_id,
        'titular'             AS tipo_asignacion,
        TRUE                  AS activa,
        pt.fecha_inicio_ciclo AS fecha_inicio,
        NULL::text            AS notas,
        po.created_at,
        po.updated_at,
        po.nombre             AS puesto_nombre,
        po.turno              AS puesto_turno_texto,
        po.horario            AS puesto_horario,
        po.jornada            AS puesto_jornada,
        po.estado             AS puesto_estado,
        cs.nombre             AS sede_nombre,
        c.nombre              AS cliente_nombre,
        c.portal_cliente_id   AS cliente_portal_id,
        oz.nombre             AS zona_nombre,
        t.nombre              AS turno_nombre,
        t.horas_trabajo       AS turno_horas_trabajo,
        t.horas_descanso      AS turno_horas_descanso,
        e_sup.id              AS supervisor_id,
        e_sup.nombre_completo AS supervisor_nombre,
        e_sup.telefono        AS supervisor_telefono,
        e_sup.puesto          AS supervisor_puesto,
        TRUE                  AS derivada_de_pizarron
      FROM puesto_titulares pt
      JOIN puestos_operativos po       ON po.id = pt.puesto_id
      LEFT JOIN client_sedes cs        ON cs.id = po.sede_id
      LEFT JOIN clients c              ON c.id  = po.cliente_id
      LEFT JOIN operational_zones oz   ON oz.id = po.zona_operativa_id
      LEFT JOIN turnos t               ON t.id  = po.tipo_turno_id
      LEFT JOIN employees e_sup        ON e_sup.id = oz.supervisor_employee_id
      WHERE pt.employee_id = $1
        AND COALESCE(pt.activo, TRUE) = TRUE
        AND COALESCE(po.activo, TRUE) = TRUE
      ORDER BY pt.orden ASC, pt.id ASC
      LIMIT 1
    `, [id]);

    if (pt1.length > 0) {
      return res.json(pt1[0]);
    }

    return res.json({ sin_asignacion: true, tipo_asignacion: "sin_asignacion", derivada_de_pizarron: false });
  } catch (err) {
    logger.error({ err }, "GET /employees/:id/asignacion-operativa error");
    return res.status(500).json({ error: "Error al obtener asignación operativa" });
  }
});

// ─── PUT /api/employees/:id/asignacion-operativa ──────────────────────────────
router.put("/employees/:id/asignacion-operativa", async (req, res) => {
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
router.get("/employees/:id/titular-historico", async (req, res) => {
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

export default router;
