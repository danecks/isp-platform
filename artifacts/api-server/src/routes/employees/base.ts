import { Router } from "express";
import { db, employeesTable, pool } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { snakeToCamel } from "./_helpers";

const router = Router();

// GET /api/employees — list all employees with optional filters
// M-01: SQL directo para incluir elegible_pool (campo fuera del schema Drizzle)
router.get("/employees", async (req, res) => {
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
      // Autocomplete: si el cliente buscó por texto y NO pidió un estado_laboral
      // específico, excluir bajas por defecto. Evita que el pizarrón / asignar usuario /
      // FichaCliente listen como "disponibles" a empleados ya dados de baja.
      if (!estadoLaboral) {
        clauses.push(`e.estado_laboral != 'baja'`);
      }
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    // PERF: solo columnas que usa el listado (Empleados.tsx + EmpleadoCard/Row).
    // El detalle completo se carga al abrir ficha vía GET /employees/:id.
    const { rows } = await pool.query(`
      SELECT e.id, e.nombre_completo, e.dpi, e.telefono, e.correo,
             e.puesto, e.area, e.sede, e.estado_laboral,
             e.cliente_id, e.supervisor_id, e.supervisor_nombre,
             e.sync_status, e.source_system, e.foto_url,
             e.sueldo_base, e.fecha_ingreso, e.fecha_baja,
             COALESCE(e.tipo_personal, 'guardia') AS tipo_personal,
             COALESCE(e.elegible_pool, TRUE) AS elegible_pool,
             COALESCE(e.aplica_igss_general, FALSE) AS aplica_igss_general,
             COALESCE(e.estado_igss, 'no_activo') AS estado_igss,
             e.fecha_inicio_igss,
             COALESCE(e.frecuencia_pago, 'quincenal') AS frecuencia_pago,
             c.nombre AS cliente_nombre
      FROM employees e
      LEFT JOIN clients c ON c.id = e.cliente_id
      ${where}
      ORDER BY e.tipo_personal, e.nombre_completo
    `, params);

    res.json(rows.map(snakeToCamel));
  } catch (err) {
    logger.error({ err }, "GET /employees error");
    res.status(500).json({ error: "Error al obtener empleados" });
  }
});

// GET /api/employees/sync/status — summary of sync state (must be before /:id)
// M-04: Conteos agregados en SQL en lugar de cargar todos los empleados en memoria
router.get("/employees/sync/status", async (_req, res) => {
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

// ── GET /api/employees/by-dpi/:dpi — búsqueda pública por DPI (kiosco actualización) ──
router.get("/employees/by-dpi/:dpi", async (req, res) => {
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

// GET /api/employees/:id — single employee
router.get("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    // enriquecer con campos que están en la tabla pero NO en el schema Drizzle.
    // Sin esto, datos como estado civil o dirección llegan vacíos al frontend
    // y los contratos PDF salen con líneas en blanco "____________".
    const { rows: [extra] } = await pool.query(
      `SELECT
         COALESCE(frecuencia_pago, 'quincenal') AS "frecuenciaPago",
         estado_civil      AS "estadoCivil",
         direccion         AS "direccion",
         telefono          AS "telefono",
         dpi               AS "dpi",
         fecha_nacimiento  AS "fechaNacimiento",
         lugar_nacimiento  AS "lugarNacimiento",
         municipio         AS "municipio",
         departamento      AS "departamento",
         sueldo_base       AS "sueldoBase",
         tipo_jornada      AS "tipoJornada",
         dia_descanso      AS "diaDescanso",
         horas_contrato    AS "horasContrato",
         tipo_personal     AS "tipoPersonal",
         nit               AS "nit",
         correo            AS "correo",
         sexo              AS "sexo",
         fecha_ingreso     AS "fechaIngreso"
       FROM employees WHERE id = $1`,
      [id]
    );
    res.json({
      ...emp,
      frecuenciaPago: extra?.frecuenciaPago ?? "quincenal",
      // También devolver los campos en snake_case para compatibilidad con
      // código del frontend que los lee como det.estado_civil, etc.
      estado_civil:    extra?.estadoCivil    ?? null,
      direccion:       extra?.direccion      ?? null,
      telefono:        extra?.telefono       ?? null,
      dpi:             extra?.dpi            ?? null,
      fecha_nacimiento: extra?.fechaNacimiento ?? null,
      lugar_nacimiento: extra?.lugarNacimiento ?? null,
      municipio:       extra?.municipio      ?? null,
      departamento:    extra?.departamento   ?? null,
      sueldo_base:     extra?.sueldoBase     ?? null,
      tipo_jornada:    extra?.tipoJornada    ?? null,
      dia_descanso:    extra?.diaDescanso    ?? null,
      horas_contrato:  extra?.horasContrato  ?? null,
      tipo_personal:   extra?.tipoPersonal   ?? null,
      nit:             extra?.nit            ?? null,
      correo:          extra?.correo        ?? null,
      sexo:            extra?.sexo          ?? null,
      fecha_ingreso:   extra?.fechaIngreso   ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener empleado" });
  }
});

// POST /api/employees — create employee (manual entry)
router.post("/employees", async (req, res) => {
  const {
    nombreCompleto, dpi, telefono, telefonoSecundario, correo,
    puesto, tipoServicio, area, estadoLaboral, sede,
    supervisorNombre, supervisorId, clienteId, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus,
    sueldoBase, tipoJornada, diaDescanso, horasContrato,
    frecuenciaPago, tipoPersonal, fechaNacimiento,
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

    // Fecha de nacimiento (fuera del schema Drizzle)
    if (fechaNacimiento !== undefined && fechaNacimiento !== null && fechaNacimiento !== "") {
      await pool.query(`UPDATE employees SET fecha_nacimiento = $1 WHERE id = $2`, [fechaNacimiento, emp.id]);
    }

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
router.get("/employees/:id/periodos", async (req, res) => {
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

// PATCH /api/employees/:id — update employee
router.patch("/employees/:id", async (req, res) => {
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
    banco, cuentaBancaria, tipoCuenta, formaPago,
    // Datos personales (para contratos) — fuera del schema Drizzle
    estadoCivil, direccion, sexo, nit, lugarNacimiento, municipio, departamento,
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

    // Fecha de nacimiento (fuera del schema Drizzle)
    if (req.body?.fechaNacimiento !== undefined) {
      const fn = req.body.fechaNacimiento;
      await pool.query(
        `UPDATE employees SET fecha_nacimiento = $1 WHERE id = $2`,
        [fn === null || fn === "" ? null : fn, id]
      );
    }

    // Banco / cuenta / forma de pago — actualizar campos individualmente si se enviaron
    const bancoUpdates: string[] = [];
    const bancoParams: unknown[] = [id];
    if (banco !== undefined) {
      bancoParams.push(banco || null);
      bancoUpdates.push(`banco = $${bancoParams.length}`);
    }
    if (cuentaBancaria !== undefined) {
      bancoParams.push(cuentaBancaria || null);
      bancoUpdates.push(`cuenta_bancaria = $${bancoParams.length}`);
    }
    if (tipoCuenta !== undefined) {
      bancoParams.push(tipoCuenta || null);
      bancoUpdates.push(`tipo_cuenta = $${bancoParams.length}`);
    }
    if (formaPago !== undefined) {
      const fpVal = ["cheque", "deposito"].includes(String(formaPago)) ? String(formaPago) : "cheque";
      bancoParams.push(fpVal);
      bancoUpdates.push(`forma_pago = $${bancoParams.length}`);
    }
    if (bancoUpdates.length > 0) {
      await pool.query(
        `UPDATE employees SET ${bancoUpdates.join(", ")} WHERE id = $1`,
        bancoParams
      );
    }

    // Datos personales (fuera del schema Drizzle) — requeridos para contratos
    const persoUpdates: string[] = [];
    const persoParams: unknown[] = [id];
    const pushPerso = (col: string, val: unknown) => {
      persoParams.push(val === "" || val === undefined ? null : val);
      persoUpdates.push(`${col} = $${persoParams.length}`);
    };
    if (estadoCivil !== undefined)     pushPerso("estado_civil", estadoCivil);
    if (direccion !== undefined)       pushPerso("direccion", direccion);
    if (sexo !== undefined)            pushPerso("sexo", sexo);
    if (nit !== undefined)             pushPerso("nit", nit);
    if (lugarNacimiento !== undefined) pushPerso("lugar_nacimiento", lugarNacimiento);
    if (municipio !== undefined)       pushPerso("municipio", municipio);
    if (departamento !== undefined)    pushPerso("departamento", departamento);
    if (persoUpdates.length > 0) {
      await pool.query(
        `UPDATE employees SET ${persoUpdates.join(", ")} WHERE id = $1`,
        persoParams
      );
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

export default router;
