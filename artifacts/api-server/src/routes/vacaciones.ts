import { Router } from "express";
import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino({ name: "vacaciones" });
export const vacacionesRouter = Router();

// ─── Constantes ───────────────────────────────────────────────────────────────
const TIPOS_VALIDOS = ["vacaciones", "vacaciones_programadas", "vacaciones_trabajadas"] as const;
type TipoVacacion = typeof TIPOS_VALIDOS[number];

const DIAS_HABILES_POR_LEY = 15; // Guatemala: 15 días hábiles

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Genera un array de fechas ISO entre inicio y fin (inclusive), excluyendo domingos
function diasEntreFechas(inicio: string, fin: string): string[] {
  const dias: string[] = [];
  const current = new Date(inicio + "T12:00:00Z");
  const end = new Date(fin + "T12:00:00Z");
  while (current <= end) {
    const dow = current.getUTCDay();
    if (dow !== 0) { // 0 = domingo
      dias.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dias;
}

// ─── GET /api/vacaciones/elegibilidad ─────────────────────────────────────────
// Lista empleados con elegibilidad, faltas, días usados y estado actual
vacacionesRouter.get("/vacaciones/elegibilidad", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo,
        COALESCE(e.tipo_personal, 'guardia') AS tipo_personal,
        e.fecha_ingreso,
        e.puesto,
        e.area,
        e.sede,
        e.estado_laboral,
        -- Aniversario de 1 año
        (e.fecha_ingreso + INTERVAL '1 year')::date AS fecha_aniversario,
        -- Días hasta/desde el aniversario (negativo = ya pasó)
        ((e.fecha_ingreso + INTERVAL '1 year')::date - CURRENT_DATE)::int AS dias_para_aniversario,
        -- Ya es elegible (cumplió 1 año)
        ((e.fecha_ingreso + INTERVAL '1 year')::date <= CURRENT_DATE) AS es_elegible,
        -- Años de servicio completos
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.fecha_ingreso::date))::int AS anios_servicio,
        -- Faltas en el último año (alerta de muchas faltas)
        COALESCE((
          SELECT COUNT(*)::int
          FROM eventos_rrhh ev
          WHERE ev.employee_id = e.id
            AND ev.tipo_evento IN ('falta', 'abandono_parcial')
            AND ev.estado != 'anulado'
            AND ev.fecha >= NOW() - INTERVAL '1 year'
        ), 0) AS faltas_ultimo_anio,
        -- Días de vacaciones consumidos este año
        COALESCE((
          SELECT SUM(
            GREATEST(1,
              CASE
                WHEN er.fecha_fin IS NULL THEN 1
                ELSE (er.fecha_fin::date - er.fecha::date + 1)
              END
            )
          )::int
          FROM eventos_rrhh er
          WHERE er.employee_id = e.id
            AND er.tipo_evento IN ('vacaciones', 'vacaciones_trabajadas')
            AND er.estado NOT IN ('anulado', 'cancelado')
            AND EXTRACT(YEAR FROM er.fecha) = EXTRACT(YEAR FROM CURRENT_DATE)
        ), 0) AS dias_vacaciones_usados_anio,
        -- Estado de vacaciones actual
        (
          SELECT er2.tipo_evento
          FROM eventos_rrhh er2
          WHERE er2.employee_id = e.id
            AND er2.tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')
            AND er2.estado NOT IN ('anulado', 'cancelado')
            AND er2.fecha::date <= CURRENT_DATE
            AND (er2.fecha_fin IS NULL OR er2.fecha_fin >= CURRENT_DATE)
          ORDER BY er2.created_at DESC
          LIMIT 1
        ) AS vacacion_activa_tipo,
        (
          SELECT er2.id
          FROM eventos_rrhh er2
          WHERE er2.employee_id = e.id
            AND er2.tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')
            AND er2.estado NOT IN ('anulado', 'cancelado')
            AND er2.fecha::date <= CURRENT_DATE
            AND (er2.fecha_fin IS NULL OR er2.fecha_fin >= CURRENT_DATE)
          ORDER BY er2.created_at DESC
          LIMIT 1
        ) AS vacacion_activa_id,
        (
          SELECT er2.fecha::date
          FROM eventos_rrhh er2
          WHERE er2.employee_id = e.id
            AND er2.tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')
            AND er2.estado NOT IN ('anulado', 'cancelado')
            AND er2.fecha::date <= CURRENT_DATE
            AND (er2.fecha_fin IS NULL OR er2.fecha_fin >= CURRENT_DATE)
          ORDER BY er2.created_at DESC
          LIMIT 1
        ) AS vacacion_activa_inicio,
        (
          SELECT er2.fecha_fin
          FROM eventos_rrhh er2
          WHERE er2.employee_id = e.id
            AND er2.tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')
            AND er2.estado NOT IN ('anulado', 'cancelado')
            AND er2.fecha::date <= CURRENT_DATE
            AND (er2.fecha_fin IS NULL OR er2.fecha_fin >= CURRENT_DATE)
          ORDER BY er2.created_at DESC
          LIMIT 1
        ) AS vacacion_activa_fin,
        -- Próximas vacaciones programadas
        (
          SELECT er3.fecha::date
          FROM eventos_rrhh er3
          WHERE er3.employee_id = e.id
            AND er3.tipo_evento = 'vacaciones_programadas'
            AND er3.estado NOT IN ('anulado', 'cancelado')
            AND er3.fecha::date > CURRENT_DATE
          ORDER BY er3.fecha ASC
          LIMIT 1
        ) AS proximas_programadas_inicio
      FROM employees e
      WHERE e.estado_laboral IN ('activo', 'licencia', 'suspendido')
        AND e.fecha_ingreso IS NOT NULL
        AND COALESCE(e.tipo_personal, 'guardia') NOT IN ('gerencia')
      ORDER BY
        -- Primero elegibles, luego por cercanía al aniversario
        ((e.fecha_ingreso + INTERVAL '1 year')::date <= CURRENT_DATE) DESC,
        ABS(((e.fecha_ingreso + INTERVAL '1 year')::date - CURRENT_DATE)) ASC,
        e.nombre_completo ASC
    `);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /vacaciones/elegibilidad error");
    res.status(500).json({ error: "Error al calcular elegibilidad" });
  }
});

// ─── GET /api/vacaciones/alertas ──────────────────────────────────────────────
// Retorna alertas de aniversario próximas (30/15/7 días)
vacacionesRouter.get("/vacaciones/alertas", async (req, res) => {
  try {
    // Generar alertas en tiempo real de empleados que cumplen 1 año pronto
    const { rows: proximos } = await pool.query(`
      SELECT
        e.id AS employee_id,
        e.nombre_completo,
        COALESCE(e.tipo_personal, 'guardia') AS tipo_personal,
        (e.fecha_ingreso + INTERVAL '1 year')::date AS fecha_aniversario,
        ((e.fecha_ingreso + INTERVAL '1 year')::date - CURRENT_DATE)::int AS dias_restantes,
        -- Ya tiene vacaciones programadas?
        EXISTS(
          SELECT 1 FROM eventos_rrhh er
          WHERE er.employee_id = e.id
            AND er.tipo_evento IN ('vacaciones_programadas', 'vacaciones')
            AND er.estado NOT IN ('anulado', 'cancelado')
            AND EXTRACT(YEAR FROM er.fecha) >= EXTRACT(YEAR FROM CURRENT_DATE)
        ) AS ya_tiene_programadas
      FROM employees e
      WHERE e.estado_laboral = 'activo'
        AND e.fecha_ingreso IS NOT NULL
        AND COALESCE(e.tipo_personal, 'guardia') NOT IN ('gerencia')
        AND (e.fecha_ingreso + INTERVAL '1 year')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY dias_restantes ASC
    `);

    // También devolver alertas persistidas en rrhh_alertas
    const { rows: alertasDB } = await pool.query(`
      SELECT * FROM rrhh_alertas
      WHERE tipo = 'aniversario_vacaciones'
        AND estado != 'resuelta'
      ORDER BY generada_at DESC
      LIMIT 50
    `);

    res.json({ proximos, alertasDB });
  } catch (err) {
    logger.error({ err }, "GET /vacaciones/alertas error");
    res.status(500).json({ error: "Error al obtener alertas" });
  }
});

// ─── GET /api/vacaciones ──────────────────────────────────────────────────────
// Lista todos los eventos de vacaciones (activos, programados, pasados)
vacacionesRouter.get("/vacaciones", async (req, res) => {
  try {
    const { year, employee_id, tipo, estado } = req.query;
    const anio = year ? Number(year) : new Date().getFullYear();

    let whereClause = `er.tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')`;
    const params: any[] = [];
    let idx = 1;

    whereClause += ` AND EXTRACT(YEAR FROM er.fecha) = $${idx++}`;
    params.push(anio);

    if (employee_id) {
      whereClause += ` AND er.employee_id = $${idx++}`;
      params.push(Number(employee_id));
    }
    if (tipo) {
      whereClause += ` AND er.tipo_evento = $${idx++}`;
      params.push(tipo);
    }
    if (estado) {
      whereClause += ` AND er.estado = $${idx++}`;
      params.push(estado);
    }

    const { rows } = await pool.query(`
      SELECT
        er.id,
        er.employee_id,
        er.employee_nombre,
        er.tipo_evento,
        er.fecha::date AS fecha_inicio,
        er.fecha_fin,
        er.estado,
        er.observaciones,
        er.notas,
        er.usuario_generador,
        er.created_at,
        er.updated_at,
        e.tipo_personal,
        e.puesto,
        e.area,
        e.fecha_ingreso,
        -- Días laborables (excluyendo domingos)
        (
          SELECT COUNT(*)::int
          FROM generate_series(
            er.fecha::date,
            COALESCE(er.fecha_fin, er.fecha::date),
            '1 day'::interval
          ) gs(d)
          WHERE EXTRACT(DOW FROM gs.d) != 0
        ) AS dias_habiles_calculados
      FROM eventos_rrhh er
      LEFT JOIN employees e ON e.id = er.employee_id
      WHERE ${whereClause}
      ORDER BY er.fecha DESC, er.employee_nombre ASC
    `, params);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /vacaciones error");
    res.status(500).json({ error: "Error al obtener vacaciones" });
  }
});

// ─── POST /api/vacaciones ─────────────────────────────────────────────────────
// Crear evento de vacaciones + generar novedades de nómina por día
vacacionesRouter.post("/vacaciones", async (req, res) => {
  const {
    employee_id,
    tipo,          // 'vacaciones' | 'vacaciones_programadas' | 'vacaciones_trabajadas'
    fecha_inicio,  // YYYY-MM-DD
    fecha_fin,     // YYYY-MM-DD
    observaciones,
    notas,
    usuario,
    consume_vacaciones, // para vacaciones_trabajadas: ¿consume días?
  } = req.body;

  if (!employee_id || !tipo || !fecha_inicio) {
    return res.status(400).json({ error: "employee_id, tipo y fecha_inicio son requeridos" });
  }
  if (!TIPOS_VALIDOS.includes(tipo as TipoVacacion)) {
    return res.status(400).json({ error: `tipo inválido. Válidos: ${TIPOS_VALIDOS.join(", ")}` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Obtener datos del empleado
    const { rows: empRows } = await client.query(
      `SELECT id, nombre_completo, tipo_personal, fecha_ingreso
       FROM employees WHERE id = $1`,
      [employee_id]
    );
    if (!empRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    const emp = empRows[0];

    // Verificar elegibilidad (solo para vacaciones reales)
    if (tipo === "vacaciones") {
      if (!emp.fecha_ingreso) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "El empleado no tiene fecha de ingreso registrada" });
      }
      const aniversario = new Date(emp.fecha_ingreso);
      aniversario.setFullYear(aniversario.getFullYear() + 1);
      if (aniversario > new Date()) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `El empleado aún no cumple 1 año. Aniversario: ${aniversario.toISOString().slice(0, 10)}`,
          fecha_aniversario: aniversario.toISOString().slice(0, 10),
        });
      }
    }

    // Verificar que no tenga vacaciones activas solapadas
    const { rows: activos } = await client.query(`
      SELECT id, tipo_evento, fecha::date, fecha_fin
      FROM eventos_rrhh
      WHERE employee_id = $1
        AND tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')
        AND estado NOT IN ('anulado', 'cancelado')
        AND fecha::date <= $3::date
        AND (fecha_fin IS NULL OR fecha_fin >= $2::date)
    `, [employee_id, fecha_inicio, fecha_fin ?? fecha_inicio]);

    if (activos.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "El empleado ya tiene vacaciones en ese período",
        conflicto: activos[0],
      });
    }

    // Estado inicial
    const estadoInicial = tipo === "vacaciones_programadas" ? "pendiente" : "aprobado";

    // Metadatos para vacaciones_trabajadas
    const notasJson = tipo === "vacaciones_trabajadas"
      ? JSON.stringify({ consume_vacaciones: consume_vacaciones ?? false, ...(notas ? { notas } : {}) })
      : (notas ?? null);

    // Crear evento en eventos_rrhh
    const { rows: eventoRows } = await client.query(`
      INSERT INTO eventos_rrhh (
        employee_id, employee_nombre, tipo_evento,
        fecha, fecha_fin, estado,
        observaciones, notas, usuario_generador,
        generado_desde
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'rrhh')
      RETURNING *
    `, [
      employee_id, emp.nombre_completo, tipo,
      fecha_inicio + "T12:00:00Z",
      fecha_fin ?? null,
      estadoInicial,
      observaciones ?? null,
      notasJson,
      usuario ?? "rrhh",
    ]);
    const evento = eventoRows[0];

    // Para vacaciones activas (no programadas): generar novedades por día
    if (tipo !== "vacaciones_programadas") {
      const dias = diasEntreFechas(fecha_inicio, fecha_fin ?? fecha_inicio);
      const tipoNovedad = tipo === "vacaciones_trabajadas" ? "vacaciones_trabajadas" : "vacaciones";

      for (const dia of dias) {
        // Solo insertar si el día no está en el futuro lejano (>90 días) para no sobrecargar
        const diffDays = (new Date(dia).getTime() - Date.now()) / 86400000;
        if (diffDays > 90) continue;

        // Obtener puesto titular del empleado para ese día
        const { rows: puestoRows } = await client.query(`
          SELECT po.id, po.nombre
          FROM puestos_operativos po
          WHERE po.titular_employee_id = $1 AND po.activo = TRUE
          LIMIT 1
        `, [employee_id]);
        const puestoTitularId = puestoRows[0]?.id ?? null;
        const puestoTitularNombre = puestoRows[0]?.nombre ?? null;

        await client.query(`
          INSERT INTO novedades_nomina_diarias (
            fecha, employee_id, empleado_nombre,
            tipo_novedad, trabajo_dia, falta, descuento_dia,
            puesto_titular_id, puesto_titular_nombre,
            horas_trabajadas, fuente, observaciones
          ) VALUES ($1, $2, $3, $4,
            $5, FALSE, FALSE,
            $6, $7, 0, 'vacaciones', $8)
          ON CONFLICT (fecha, employee_id) DO UPDATE SET
            tipo_novedad    = EXCLUDED.tipo_novedad,
            trabajo_dia     = FALSE,
            falta           = FALSE,
            descuento_dia   = FALSE,
            observaciones   = COALESCE(novedades_nomina_diarias.observaciones, '') || ' [Vacaciones #' || $9 || ']',
            updated_at      = NOW()
        `, [
          dia, employee_id, emp.nombre_completo,
          tipoNovedad,
          tipo === "vacaciones_trabajadas", // trabajo_dia=true si trabajó
          puestoTitularId, puestoTitularNombre,
          `Vacaciones registradas (Evento RRHH #${evento.id})`,
          evento.id,
        ]);
      }

      logger.info({ empleado: emp.nombre_completo, dias: dias.length, tipo },
        "Novedades de vacaciones generadas");
    }

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      evento,
      mensaje: tipo === "vacaciones_programadas"
        ? `Vacaciones programadas registradas para ${emp.nombre_completo}`
        : `Vacaciones aprobadas para ${emp.nombre_completo}`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /vacaciones error");
    res.status(500).json({ error: "Error al crear vacaciones" });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/vacaciones/:id ────────────────────────────────────────────────
// Actualizar estado o datos de una vacación
vacacionesRouter.patch("/vacaciones/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { estado, observaciones, notas, usuario } = req.body;

  const ESTADOS_VALIDOS = ["pendiente", "aprobado", "cancelado", "completado"];

  try {
    const { rows: check } = await pool.query(
      `SELECT er.*, e.nombre_completo AS emp_nombre
       FROM eventos_rrhh er
       LEFT JOIN employees e ON e.id = er.employee_id
       WHERE er.id = $1
         AND er.tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')`,
      [id]
    );
    if (!check.length) return res.status(404).json({ error: "Evento de vacaciones no encontrado" });
    const ev = check[0];

    if (ev.estado === "anulado") {
      return res.status(409).json({ error: "No se puede modificar un evento anulado" });
    }
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(", ")}` });
    }

    const { rows } = await pool.query(`
      UPDATE eventos_rrhh
      SET estado       = COALESCE($1, estado),
          observaciones= COALESCE($2, observaciones),
          notas        = COALESCE($3, notas),
          updated_at   = NOW()
      WHERE id = $4
      RETURNING *
    `, [estado || null, observaciones || null, notas || null, id]);

    // Si se cancela/anula, limpiar novedades generadas
    if (estado === "cancelado" || estado === "anulado") {
      await pool.query(`
        UPDATE novedades_nomina_diarias
        SET tipo_novedad  = NULL,
            trabajo_dia   = FALSE,
            falta         = FALSE,
            updated_at    = NOW()
        WHERE employee_id = $1
          AND fecha::date BETWEEN $2::date AND COALESCE($3::date, $2::date)
          AND fuente = 'vacaciones'
      `, [ev.employee_id, ev.fecha, ev.fecha_fin ?? ev.fecha]);

      logger.info({ id, empleado: ev.employee_id }, "Novedades de vacaciones revertidas por cancelación");
    }

    res.json({ ok: true, evento: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /vacaciones/:id error");
    res.status(500).json({ error: "Error al actualizar vacaciones" });
  }
});

// ─── POST /api/vacaciones/:id/aprobar ────────────────────────────────────────
// Aprobar vacaciones programadas → activa las novedades de nómina
vacacionesRouter.post("/vacaciones/:id/aprobar", async (req, res) => {
  const id = Number(req.params.id);
  const { usuario } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: check } = await client.query(
      `SELECT er.*, e.nombre_completo AS emp_nombre
       FROM eventos_rrhh er
       LEFT JOIN employees e ON e.id = er.employee_id
       WHERE er.id = $1 AND er.tipo_evento = 'vacaciones_programadas'`,
      [id]
    );
    if (!check.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vacación programada no encontrada" });
    }
    const ev = check[0];
    if (ev.estado !== "pendiente") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `Estado actual: ${ev.estado}. Solo se pueden aprobar las pendientes.` });
    }

    // Cambiar tipo a 'vacaciones' y estado a 'aprobado'
    await client.query(`
      UPDATE eventos_rrhh
      SET tipo_evento = 'vacaciones',
          estado = 'aprobado',
          notas = COALESCE(notas, '') || ' [Aprobado por ' || $1 || ']',
          updated_at = NOW()
      WHERE id = $2
    `, [usuario ?? "rrhh", id]);

    // Generar novedades para cada día
    const fechaInicio = new Date(ev.fecha).toISOString().slice(0, 10);
    const fechaFin = ev.fecha_fin
      ? new Date(ev.fecha_fin).toISOString().slice(0, 10)
      : fechaInicio;
    const dias = diasEntreFechas(fechaInicio, fechaFin);

    for (const dia of dias) {
      const diffDays = (new Date(dia).getTime() - Date.now()) / 86400000;
      if (diffDays > 90) continue;

      const { rows: puestoRows } = await client.query(`
        SELECT po.id, po.nombre FROM puestos_operativos po
        WHERE po.titular_employee_id = $1 AND po.activo = TRUE LIMIT 1
      `, [ev.employee_id]);

      await client.query(`
        INSERT INTO novedades_nomina_diarias (
          fecha, employee_id, empleado_nombre,
          tipo_novedad, trabajo_dia, falta, descuento_dia,
          puesto_titular_id, puesto_titular_nombre,
          horas_trabajadas, fuente, observaciones
        ) VALUES ($1, $2, $3, 'vacaciones', FALSE, FALSE, FALSE, $4, $5, 0, 'vacaciones', $6)
        ON CONFLICT (fecha, employee_id) DO UPDATE SET
          tipo_novedad = 'vacaciones',
          trabajo_dia  = FALSE,
          falta        = FALSE,
          updated_at   = NOW()
      `, [
        dia, ev.employee_id, ev.emp_nombre,
        puestoRows[0]?.id ?? null, puestoRows[0]?.nombre ?? null,
        `Vacaciones aprobadas (Evento #${id})`,
      ]);
    }

    await client.query("COMMIT");
    res.json({ ok: true, mensaje: `Vacaciones aprobadas para ${ev.emp_nombre}`, dias_generados: dias.length });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /vacaciones/:id/aprobar error");
    res.status(500).json({ error: "Error al aprobar vacaciones" });
  } finally {
    client.release();
  }
});

// ─── GET /api/vacaciones/resumen ─────────────────────────────────────────────
// Resumen para dashboard: activas hoy, programadas, alertas próximas
vacacionesRouter.get("/vacaciones/resumen", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE er.tipo_evento = 'vacaciones'
            AND er.estado = 'aprobado'
            AND er.fecha::date <= CURRENT_DATE
            AND (er.fecha_fin IS NULL OR er.fecha_fin >= CURRENT_DATE)
        )::int AS activas_hoy,
        COUNT(*) FILTER (
          WHERE er.tipo_evento = 'vacaciones_trabajadas'
            AND er.estado = 'aprobado'
            AND er.fecha::date <= CURRENT_DATE
            AND (er.fecha_fin IS NULL OR er.fecha_fin >= CURRENT_DATE)
        )::int AS trabajadas_hoy,
        COUNT(*) FILTER (
          WHERE er.tipo_evento = 'vacaciones_programadas'
            AND er.estado = 'pendiente'
            AND er.fecha::date > CURRENT_DATE
        )::int AS programadas_pendientes,
        COUNT(DISTINCT e.id) FILTER (
          WHERE (e.fecha_ingreso + INTERVAL '1 year')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
            AND e.estado_laboral = 'activo'
        )::int AS proximos_aniversarios_30d
      FROM eventos_rrhh er
      FULL OUTER JOIN employees e ON TRUE
      WHERE e.fecha_ingreso IS NOT NULL
        OR er.tipo_evento IN ('vacaciones', 'vacaciones_programadas', 'vacaciones_trabajadas')
    `);

    res.json(rows[0] ?? { activas_hoy: 0, trabajadas_hoy: 0, programadas_pendientes: 0, proximos_aniversarios_30d: 0 });
  } catch (err) {
    logger.error({ err }, "GET /vacaciones/resumen error");
    res.status(500).json({ error: "Error al obtener resumen" });
  }
});
