import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";
import { snakeToCamel, validDate } from "./_helpers";

const router = Router();

// ── PATCH /api/employees/:id/self-update — actualización pública de datos (kiosco) ──
router.patch("/employees/:id/self-update", async (req, res) => {
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
// Cuando se cambia a 'suspendido' DESDE LA FICHA del empleado (Forma A),
// se crea automáticamente el evento RRHH equivalente al de RRHH > Eventos
// (Forma B), de modo que la suspensión se descuenta correctamente en nómina
// y aparece en planilla IGSS con fechas reales.
router.patch("/employees/:id/estado", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { estadoLaboral, fechaDesde, fechaHasta, observaciones } = req.body ?? {};
  const ESTADOS_VALIDOS = ["activo", "suspendido", "baja", "licencia"];
  if (!estadoLaboral || !ESTADOS_VALIDOS.includes(estadoLaboral)) {
    return res.status(400).json({
      error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(", ")}`,
    });
  }

  // Validación específica para 'suspendido' — siempre debe traer fechas
  // para crear el evento RRHH y descontar días de nómina.
  // Validamos formato + fecha de calendario real (ej. 2026-13-40 falla aquí
  // y devuelve 400, no 500 al castear en SQL).
  if (estadoLaboral === "suspendido") {
    if (!validDate(fechaDesde)) {
      return res.status(400).json({ error: "fechaDesde inválida (YYYY-MM-DD, calendario real)" });
    }
    if (!validDate(fechaHasta)) {
      return res.status(400).json({ error: "fechaHasta inválida (YYYY-MM-DD, calendario real)" });
    }
    if (fechaDesde > fechaHasta) {
      return res.status(400).json({ error: "fechaDesde no puede ser mayor que fechaHasta" });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Datos del empleado (lock) — incluye estado actual para detectar reactivación
    const { rows: empRows } = await client.query(
      `SELECT id, nombre_completo, dpi, area, puesto, estado_laboral
         FROM employees WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!empRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    const emp = empRows[0];
    const estadoAnterior = emp.estado_laboral as string;

    // Update estado_laboral
    await client.query(
      `UPDATE employees SET estado_laboral = $1, updated_at = NOW() WHERE id = $2`,
      [estadoLaboral, id]
    );

    const usuarioGenerador =
      (req as any).user?.username ?? (req as any).user?.email ?? "ficha_empleado";

    // ── Caso 1: NUEVA SUSPENSIÓN ──────────────────────────────────────────────
    if (estadoLaboral === "suspendido") {
      // Idempotencia: no duplicar evento si ya existe uno aprobado (no anulado)
      // que solape con el rango pedido.
      const { rows: dupRows } = await client.query(
        `SELECT id, fecha::date AS fecha, fecha_fin
           FROM eventos_rrhh
          WHERE employee_id = $1
            AND tipo_evento = 'suspension'
            AND estado      = 'aprobado'
            AND anulado_at  IS NULL
            AND COALESCE(fecha_fin, fecha::date) >= $2::date
            AND fecha::date                       <= $3::date
          LIMIT 1`,
        [emp.id, fechaDesde, fechaHasta]
      );
      if (dupRows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error:
            `Ya existe un evento de suspensión aprobado (#${dupRows[0].id}) que solapa con el rango. Anúlelo primero o ajuste las fechas.`,
        });
      }

      // Buscar puesto titular para vincular novedades (puede no existir).
      // Usamos clients.nombre_comercial (la columna razon_social NO existe en este schema).
      const { rows: puestoRows } = await client.query(
        `SELECT po.id, po.nombre,
                COALESCE(c.nombre_comercial, c.nombre) AS cliente_nombre
           FROM puestos_operativos po
           LEFT JOIN clients c ON c.id = po.client_id
          WHERE po.titular_employee_id = $1 AND po.activo = TRUE
          LIMIT 1`,
        [id]
      );
      const puestoTitularId = puestoRows[0]?.id ?? null;
      const puestoTitularNombre = puestoRows[0]?.nombre ?? emp.puesto ?? null;
      const clienteNombre = puestoRows[0]?.cliente_nombre ?? null;

      // Crear evento RRHH aprobado
      const { rows: evRows } = await client.query(
        `INSERT INTO eventos_rrhh
           (employee_id, employee_nombre, employee_dpi,
            tipo_evento, cliente_nombre, puesto_nombre,
            generado_desde, estado, observaciones, usuario_generador,
            documentos_generados, fecha, fecha_fin)
         VALUES ($1,$2,$3,'suspension',$4,$5,'ficha_empleado','aprobado',$6,$7,
                 '[]',$8::date,$9::date)
         RETURNING id`,
        [
          emp.id,
          emp.nombre_completo,
          emp.dpi || null,
          clienteNombre,
          puestoTitularNombre,
          observaciones || null,
          usuarioGenerador,
          fechaDesde,
          fechaHasta,
        ]
      );
      const eventoId = evRows[0].id;

      // UPSERT novedad para cada día del rango (clip TZ-safe en SQL)
      await client.query(
        `INSERT INTO novedades_nomina_diarias
           (fecha, employee_id, empleado_nombre,
            trabajo_dia, horas_trabajadas, horas_extra,
            falta, suspension, descuento_dia,
            puesto_titular_id, puesto_titular_nombre, fuente)
         SELECT d::date, $1, $2,
                FALSE, 0, 0,
                FALSE, TRUE, TRUE,
                $3, $4, 'rrhh_manual'
           FROM generate_series($5::date, $6::date, INTERVAL '1 day') d
         ON CONFLICT (fecha, employee_id) DO UPDATE SET
           suspension    = TRUE,
           descuento_dia = TRUE,
           trabajo_dia   = FALSE,
           updated_at    = NOW()`,
        [
          emp.id,
          emp.nombre_completo,
          puestoTitularId,
          puestoTitularNombre,
          fechaDesde,
          fechaHasta,
        ]
      );

      logger.info(
        { employeeId: emp.id, eventoId, fechaDesde, fechaHasta },
        "RRHH: suspensión creada desde ficha empleado (evento + novedades)"
      );
    }

    // ── Caso 2: REACTIVACIÓN desde 'suspendido' → 'activo' ────────────────────
    // Cerrar suspensiones aprobadas vigentes y revertir novedades futuras
    // para que la nómina/IGSS deje de descontar a partir de hoy.
    if (estadoAnterior === "suspendido" && estadoLaboral === "activo") {
      const motivo = `Cerrado por reactivación desde ficha (${usuarioGenerador})`;
      // 1) Truncar fecha_fin de eventos cuya cobertura llega a hoy o futuro.
      //    Si la suspensión ya empezó: cerrar con fecha_fin = ayer.
      //    Si aún no empezaba (futuro): anular.
      const { rows: cerrados } = await client.query(
        `UPDATE eventos_rrhh
            SET fecha_fin = (CURRENT_DATE - INTERVAL '1 day')::date,
                observaciones = CONCAT_WS(E'\n', observaciones, $2),
                updated_at    = NOW()
          WHERE employee_id = $1
            AND tipo_evento = 'suspension'
            AND estado      = 'aprobado'
            AND anulado_at  IS NULL
            AND fecha::date <= CURRENT_DATE
            AND COALESCE(fecha_fin, fecha::date) >= CURRENT_DATE
          RETURNING id`,
        [id, motivo]
      );
      const { rows: anulados } = await client.query(
        `UPDATE eventos_rrhh
            SET estado            = 'anulado',
                anulado_por       = $2,
                anulado_at        = NOW(),
                motivo_anulacion  = $3,
                estado_anterior   = 'aprobado',
                updated_at        = NOW()
          WHERE employee_id = $1
            AND tipo_evento = 'suspension'
            AND estado      = 'aprobado'
            AND anulado_at  IS NULL
            AND fecha::date > CURRENT_DATE
          RETURNING id`,
        [id, usuarioGenerador, motivo]
      );

      // 2) Limpiar novedades futuras de suspensión (incluido hoy) generadas por RRHH.
      const { rowCount: novFuturas } = await client.query(
        `DELETE FROM novedades_nomina_diarias
          WHERE employee_id = $1
            AND fecha       >= CURRENT_DATE
            AND fuente      = 'rrhh_manual'
            AND suspension  = TRUE`,
        [id]
      );

      logger.info(
        {
          employeeId: id,
          eventosCerrados: cerrados.length,
          eventosAnulados: anulados.length,
          novedadesFuturasBorradas: novFuturas,
        },
        "RRHH: reactivación desde ficha — eventos suspension cerrados/anulados",
      );
    }

    // Devolver empleado actualizado
    const { rows: outRows } = await client.query(
      `SELECT * FROM employees WHERE id = $1`, [id]
    );
    await client.query("COMMIT");

    // Camel-case mínimo para el front
    const out = outRows[0];
    res.json({
      ...out,
      nombreCompleto: out.nombre_completo,
      estadoLaboral: out.estado_laboral,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err, id }, "PATCH /employees/:id/estado error");
    res.status(500).json({ error: "Error al actualizar estado" });
  } finally {
    client.release();
  }
});

// ─── POST /api/employees/:id/renovar-suspension ─────────────────────────────
// Extiende la fecha_fin de un evento de suspensión aprobado vigente y crea
// las novedades_nomina_diarias correspondientes para los días añadidos.
// Resuelve también las alertas de tipo 'suspension_proxima_vencer' del evento.
//
// Body: { eventoId: number, nuevaFechaHasta: 'YYYY-MM-DD', observaciones?: string }
router.post("/employees/:id/renovar-suspension", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { eventoId, nuevaFechaHasta, observaciones } = req.body ?? {};
  const evtId = parseInt(eventoId);
  if (isNaN(evtId)) return res.status(400).json({ error: "eventoId inválido" });

  if (!validDate(nuevaFechaHasta)) {
    return res.status(400).json({ error: "nuevaFechaHasta inválida (YYYY-MM-DD, calendario real)" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Advisory lock por empleado: serializa todas las operaciones de
    // suspensión del mismo empleado (renovación + Forma A + Forma B),
    // evitando write-skew en la validación de solapamiento.
    await client.query(`SELECT pg_advisory_xact_lock(42001, $1)`, [id]);

    // Datos del empleado (lock)
    const { rows: empRows } = await client.query(
      `SELECT id, nombre_completo, dpi, puesto, estado_laboral
         FROM employees WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!empRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    const emp = empRows[0];

    // Evento existente: debe ser suspension aprobada, no anulada y pertenecer al empleado
    const { rows: evRows } = await client.query(
      `SELECT id, employee_id, tipo_evento, estado, anulado_at,
              fecha::date          AS fecha_inicio,
              fecha_fin::date      AS fecha_fin,
              observaciones,
              cliente_nombre,
              puesto_nombre
         FROM eventos_rrhh
        WHERE id = $1
        FOR UPDATE`,
      [evtId]
    );
    if (!evRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Evento de suspensión no encontrado" });
    }
    const ev = evRows[0];
    if (ev.employee_id !== emp.id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El evento no pertenece a este empleado" });
    }
    if (ev.tipo_evento !== "suspension") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El evento no es una suspensión" });
    }
    if (ev.estado !== "aprobado" || ev.anulado_at !== null) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El evento no está aprobado (o fue anulado). No se puede renovar." });
    }
    if (!ev.fecha_fin) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El evento no tiene fecha_fin (suspensión indefinida). Edite primero la fecha." });
    }

    // La nueva fecha debe ser estrictamente mayor a la fecha_fin actual
    const fechaFinActual: string = ev.fecha_fin instanceof Date
      ? ev.fecha_fin.toISOString().slice(0, 10)
      : String(ev.fecha_fin);
    if (nuevaFechaHasta <= fechaFinActual) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `La nueva fecha (${nuevaFechaHasta}) debe ser posterior a la fecha actual de fin (${fechaFinActual})`,
      });
    }

    // Guardarrail 1: el evento debe estar vigente (fecha_fin >= hoy en BD).
    // Renovar una suspensión que ya terminó hace tiempo no tiene sentido y
    // afectaría días históricos en novedades_nomina_diarias (impacto IGSS/planilla).
    const { rows: vigRows } = await client.query(
      `SELECT (fecha_fin::date >= CURRENT_DATE) AS vigente, CURRENT_DATE::text AS hoy
         FROM eventos_rrhh WHERE id = $1`,
      [evtId]
    );
    if (!vigRows[0]?.vigente) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `La suspensión ya venció (fecha_fin ${fechaFinActual} < hoy ${vigRows[0]?.hoy}). Cree una suspensión nueva en lugar de renovarla.`,
      });
    }

    // Guardarrail 2: límite máximo de extensión = 90 días desde la fecha_fin actual.
    // Evita renovaciones absurdas que generen rangos enormes en generate_series.
    const { rows: limRows } = await client.query(
      `SELECT ($1::date - $2::date)::int AS diff_dias`,
      [nuevaFechaHasta, fechaFinActual]
    );
    const diffDias = limRows[0]?.diff_dias ?? 0;
    if (diffDias > 90) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `La renovación no puede extenderse más de 90 días sobre la fecha_fin actual (${fechaFinActual}). Solicitado: ${diffDias} días.`,
      });
    }

    // Idempotencia: que el rango ampliado no choque con OTRO evento aprobado
    const { rows: dupRows } = await client.query(
      `SELECT id FROM eventos_rrhh
        WHERE employee_id = $1
          AND id          <> $2
          AND tipo_evento = 'suspension'
          AND estado      = 'aprobado'
          AND anulado_at  IS NULL
          AND fecha::date <= $3::date
          AND COALESCE(fecha_fin, fecha::date) >= ($4::date + INTERVAL '1 day')::date
        LIMIT 1`,
      [emp.id, evtId, nuevaFechaHasta, fechaFinActual]
    );
    if (dupRows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `La extensión choca con otra suspensión aprobada (#${dupRows[0].id}). Anúlela o ajuste la fecha.`,
      });
    }

    const usuarioGenerador =
      (req as any).user?.username ?? (req as any).user?.email ?? "ficha_empleado";

    // Buscar puesto titular para vincular novedades nuevas (puede no existir)
    const { rows: puestoRows } = await client.query(
      `SELECT po.id, po.nombre
         FROM puestos_operativos po
        WHERE po.titular_employee_id = $1 AND po.activo = TRUE
        LIMIT 1`,
      [id]
    );
    const puestoTitularId = puestoRows[0]?.id ?? null;
    const puestoTitularNombre = puestoRows[0]?.nombre ?? ev.puesto_nombre ?? emp.puesto ?? null;

    const motivo =
      `Renovada el ${new Date().toISOString().slice(0, 10)} por ${usuarioGenerador}: ${fechaFinActual} → ${nuevaFechaHasta}` +
      (observaciones ? `. ${observaciones}` : "");

    // 1) Extender fecha_fin del evento + agregar nota en observaciones
    await client.query(
      `UPDATE eventos_rrhh
          SET fecha_fin     = $2::date,
              observaciones = CONCAT_WS(E'\n', observaciones, $3),
              updated_at    = NOW()
        WHERE id = $1`,
      [evtId, nuevaFechaHasta, motivo]
    );

    // 2) Crear/actualizar novedades para los días nuevos
    //    [fechaFinActual + 1, nuevaFechaHasta]
    const { rowCount: novedadesCreadas } = await client.query(
      `INSERT INTO novedades_nomina_diarias
         (fecha, employee_id, empleado_nombre,
          trabajo_dia, horas_trabajadas, horas_extra,
          falta, suspension, descuento_dia,
          puesto_titular_id, puesto_titular_nombre, fuente, evento_rrhh_id)
       SELECT d::date, $1, $2,
              FALSE, 0, 0,
              FALSE, TRUE, TRUE,
              $3, $4, 'rrhh_manual', $7
         FROM generate_series(
                ($5::date + INTERVAL '1 day')::date,
                $6::date,
                INTERVAL '1 day'
              ) d
       ON CONFLICT (fecha, employee_id) DO UPDATE SET
         suspension     = TRUE,
         descuento_dia  = TRUE,
         trabajo_dia    = FALSE,
         evento_rrhh_id = COALESCE(novedades_nomina_diarias.evento_rrhh_id, EXCLUDED.evento_rrhh_id),
         updated_at     = NOW()`,
      [
        emp.id,
        emp.nombre_completo,
        puestoTitularId,
        puestoTitularNombre,
        fechaFinActual,
        nuevaFechaHasta,
        evtId,
      ]
    );

    // 3) Resolver alertas de suspension_proxima_vencer asociadas a este evento
    //    (extracción exacta por JSONB para evitar matches de substring).
    const { rowCount: alertasResueltas } = await client.query(
      `UPDATE rrhh_alertas
          SET estado       = 'resuelta',
              resuelta_at  = NOW(),
              resuelta_por = $2
        WHERE employee_id  = $1
          AND tipo         = 'suspension_proxima_vencer'
          AND estado      != 'resuelta'
          AND (datos_clave::jsonb ->> 'evento_id')::int = $3`,
      [emp.id, usuarioGenerador, evtId]
    );

    await client.query("COMMIT");

    logger.info(
      { employeeId: emp.id, eventoId: evtId, fechaFinAnterior: fechaFinActual, nuevaFechaHasta, novedadesCreadas, alertasResueltas },
      "RRHH: suspensión renovada (fecha_fin extendida + novedades + alertas)"
    );

    res.json({
      ok: true,
      eventoId: evtId,
      fechaFinAnterior: fechaFinActual,
      nuevaFechaHasta,
      novedadesCreadas: novedadesCreadas ?? 0,
      alertasResueltas: alertasResueltas ?? 0,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err, id, evtId }, "POST /employees/:id/renovar-suspension error");
    res.status(500).json({ error: "Error al renovar suspensión" });
  } finally {
    client.release();
  }
});

// POST /api/employees/:id/reingreso — reactivar empleado dado de baja ───────
// Resetea: vacaciones, prestaciones acumuladas, contrato (nueva alta legal)
// Conserva: datos personales, historial de períodos, liquidaciones previas, eventos RRHH
router.post("/employees/:id/reingreso", async (req, res) => {
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

export default router;
