import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const planificacionFuturaRouter = Router();

// ─── GET /api/operaciones/planificacion-futura?fecha=YYYY-MM-DD ───────────────
// Devuelve todos los planes para una fecha específica, con nombres de empleados
planificacionFuturaRouter.get("/operaciones/planificacion-futura", async (req, res) => {
  const { fecha } = req.query as { fecha?: string };
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Parámetro 'fecha' requerido en formato YYYY-MM-DD" });
  }
  try {
    const { rows } = await pool.query(`
      SELECT
        pf.id,
        pf.fecha,
        pf.puesto_id,
        po.nombre             AS puesto_nombre,
        po.cliente_nombre,
        po.titular_employee_id,
        pf.tipo_evento,
        pf.tipo_ausencia,
        pf.titular_ausente_id,
        ea.nombre_completo    AS titular_ausente_nombre,
        pf.relevo_id,
        er.nombre_completo    AS relevo_nombre,
        pf.motivo,
        pf.notas,
        pf.estado,
        pf.fuente,
        pf.creado_por,
        pf.created_at
      FROM planificacion_futura pf
      JOIN puestos_operativos po ON po.id = pf.puesto_id
      LEFT JOIN employees ea ON ea.id = pf.titular_ausente_id
      LEFT JOIN employees er ON er.id  = pf.relevo_id
      WHERE pf.fecha = $1
        AND pf.estado != 'cancelado'
      ORDER BY po.cliente_nombre, po.nombre
    `, [fecha]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/planificacion-futura error");
    res.status(500).json({ error: "Error al cargar planificación futura" });
  }
});

// ─── GET /api/operaciones/planificacion-futura/proximos ───────────────────────
// Devuelve los próximos 30 días de planes, agrupados por puesto_id
// Útil para mostrar badges en el Pizarrón del día actual
planificacionFuturaRouter.get("/operaciones/planificacion-futura/proximos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        pf.id,
        pf.fecha,
        pf.puesto_id,
        po.nombre             AS puesto_nombre,
        po.cliente_nombre,
        pf.tipo_evento,
        pf.tipo_ausencia,
        pf.titular_ausente_id,
        ea.nombre_completo    AS titular_ausente_nombre,
        pf.relevo_id,
        er.nombre_completo    AS relevo_nombre,
        pf.motivo,
        pf.estado
      FROM planificacion_futura pf
      JOIN puestos_operativos po ON po.id = pf.puesto_id
      LEFT JOIN employees ea ON ea.id = pf.titular_ausente_id
      LEFT JOIN employees er ON er.id  = pf.relevo_id
      WHERE pf.fecha > CURRENT_DATE
        AND pf.fecha <= CURRENT_DATE + INTERVAL '30 days'
        AND pf.estado != 'cancelado'
      ORDER BY pf.fecha ASC
    `);

    // Agrupar por puesto_id para que el frontend haga lookup O(1)
    const porPuesto: Record<number, typeof rows> = {};
    for (const row of rows) {
      if (!porPuesto[row.puesto_id]) porPuesto[row.puesto_id] = [];
      porPuesto[row.puesto_id].push(row);
    }
    res.json(porPuesto);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/planificacion-futura/proximos error");
    res.status(500).json({ error: "Error al cargar próximos cambios" });
  }
});

// ─── POST /api/operaciones/planificacion-futura ───────────────────────────────
// Crea un nuevo plan futuro
planificacionFuturaRouter.post("/operaciones/planificacion-futura", async (req, res) => {
  const {
    fecha,
    puestoId,
    tipoEvento = "ausencia",
    tipoAusencia,
    titularAusenteId,
    relevId,
    motivo,
    notas,
    estado = "programado",
    fuente = "operaciones",
    creadoPor,
  } = req.body as {
    fecha: string;
    puestoId: number;
    tipoEvento?: string;
    tipoAusencia?: string;
    titularAusenteId?: number | null;
    relevId?: number | null;
    motivo?: string;
    notas?: string;
    estado?: string;
    fuente?: string;
    creadoPor?: string;
  };

  if (!fecha || !puestoId) {
    return res.status(400).json({ error: "fecha y puestoId son requeridos" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" });
  }

  try {
    const { rows } = await pool.query(`
      INSERT INTO planificacion_futura
        (fecha, puesto_id, tipo_evento, tipo_ausencia, titular_ausente_id, relevo_id,
         motivo, notas, estado, fuente, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [fecha, puestoId, tipoEvento, tipoAusencia ?? null, titularAusenteId ?? null,
        relevId ?? null, motivo ?? null, notas ?? null, estado, fuente, creadoPor ?? null]);

    logger.info({ id: rows[0].id, fecha, puestoId }, "Planificación futura creada");
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /operaciones/planificacion-futura error");
    res.status(500).json({ error: "Error al crear planificación futura" });
  }
});

// ─── PATCH /api/operaciones/planificacion-futura/:id ─────────────────────────
// Actualiza un plan: puede asignar relevo, cambiar estado o notas
planificacionFuturaRouter.patch("/operaciones/planificacion-futura/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    relevId,
    estado,
    notas,
    motivo,
    tipoAusencia,
    titularAusenteId,
  } = req.body as {
    relevId?: number | null;
    estado?: string;
    notas?: string;
    motivo?: string;
    tipoAusencia?: string;
    titularAusenteId?: number | null;
  };

  try {
    const sets: string[] = ["updated_at = NOW()"];
    const vals: unknown[] = [];
    let idx = 1;

    if (relevId !== undefined)          { sets.push(`relevo_id = $${idx++}`);           vals.push(relevId ?? null); }
    if (estado !== undefined)           { sets.push(`estado = $${idx++}`);              vals.push(estado); }
    if (notas !== undefined)            { sets.push(`notas = $${idx++}`);               vals.push(notas); }
    if (motivo !== undefined)           { sets.push(`motivo = $${idx++}`);              vals.push(motivo); }
    if (tipoAusencia !== undefined)     { sets.push(`tipo_ausencia = $${idx++}`);       vals.push(tipoAusencia); }
    if (titularAusenteId !== undefined) { sets.push(`titular_ausente_id = $${idx++}`); vals.push(titularAusenteId ?? null); }

    if (vals.length === 0) return res.status(400).json({ error: "Sin cambios que aplicar" });

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE planificacion_futura SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "Plan no encontrado" });

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/planificacion-futura/:id error");
    res.status(500).json({ error: "Error al actualizar plan" });
  }
});

// ─── DELETE /api/operaciones/planificacion-futura/:id ────────────────────────
planificacionFuturaRouter.delete("/operaciones/planificacion-futura/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query("DELETE FROM planificacion_futura WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /operaciones/planificacion-futura/:id error");
    res.status(500).json({ error: "Error al eliminar plan" });
  }
});

// ─── GET /api/operaciones/pool-futuro?fecha=YYYY-MM-DD ────────────────────────
// Calcula disponibilidad futura por turno + ausencias planificadas + eventos RRHH
planificacionFuturaRouter.get("/operaciones/pool-futuro", async (req, res) => {
  const { fecha } = req.query as { fecha?: string };
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Parámetro 'fecha' requerido en formato YYYY-MM-DD" });
  }

  try {
    // 1. Obtener todos los empleados activos con su asignación y turno
    const { rows: empleados } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo,
        e.nombre_completo AS nombre,
        e.elegible_pool,
        e.estado_laboral,
        -- Asignación operativa activa
        eoa.puesto_id,
        po.nombre        AS puesto_nombre,
        po.cliente_nombre,
        po.cliente_id,
        -- Turno del puesto
        t.id             AS turno_id,
        t.nombre         AS turno_nombre,
        CASE WHEN (t.horas_trabajo + t.horas_descanso) <= 24 THEN 'diario' ELSE 'alternado' END AS tipo_ciclo,
        t.horas_trabajo,
        t.horas_descanso,
        po.fecha_inicio_ciclo,
        -- Ausencia en planificacion_futura como titular ausente
        pf.id            AS plan_id,
        pf.tipo_ausencia AS plan_tipo_ausencia,
        pf.relevo_id     AS plan_relevo_id,
        pf.estado        AS plan_estado,
        pf.puesto_id     AS plan_puesto_id
      FROM employees e
      LEFT JOIN employee_operational_assignments eoa
             ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN puestos_operativos po
             ON po.id = eoa.puesto_id AND po.activo = TRUE
      LEFT JOIN turnos t
             ON t.id = po.tipo_turno_id
      LEFT JOIN planificacion_futura pf
             ON pf.titular_ausente_id = e.id
            AND pf.fecha = $1
            AND pf.estado != 'cancelado'
      WHERE e.estado_laboral IN ('activo', 'suspendido', 'incapacitado')
      ORDER BY e.nombre_completo
    `, [fecha]);

    // 2. Eventos RRHH aprobados/pendientes para esa fecha
    // Soporta rangos: si fecha_fin está definido, verifica que la fecha consultada esté dentro del rango
    const { rows: eventosRrhh } = await pool.query(`
      SELECT
        employee_id,
        employee_nombre,
        tipo_evento,
        estado,
        fecha_fin
      FROM eventos_rrhh
      WHERE $1::date BETWEEN DATE(fecha) AND COALESCE(fecha_fin, DATE(fecha))
        AND estado IN ('aprobado', 'pendiente', 'activo')
        AND tipo_evento IN (
          'permiso', 'vacaciones', 'incapacidad', 'suspension',
          'falta', 'falta_injustificada', 'permiso_sin_goce',
          'permiso_con_goce', 'permiso_goce_sueldo', 'amonestacion',
          'relevo_vacaciones', 'cambio_titular'
        )
    `, [fecha]);

    const eventosMap = new Map<number, { tipo: string; estado: string }>();
    for (const ev of eventosRrhh) {
      if (!eventosMap.has(ev.employee_id)) {
        eventosMap.set(ev.employee_id, { tipo: ev.tipo_evento, estado: ev.estado });
      }
    }

    // 3. Quiénes son relevos programados para esa fecha (ya asignados como cobertura)
    const { rows: relevos } = await pool.query(`
      SELECT DISTINCT relevo_id
      FROM planificacion_futura
      WHERE fecha = $1 AND estado != 'cancelado' AND relevo_id IS NOT NULL
    `, [fecha]);
    const relevosSet = new Set(relevos.map((r: any) => r.relevo_id as number));

    // 4. Función de cálculo de turno para una fecha
    // NOTA: pg devuelve NUMERIC como string; usamos parseFloat para evitar concatenación errónea
    function calcularEstadoTurno(
      horasTrabajo: number | string | null,
      horasDescanso: number | string | null,
      fechaInicioCiclo: string | Date | null,
    ): "trabajando" | "descansando" | "sin_turno" {
      const ht = horasTrabajo != null ? parseFloat(String(horasTrabajo)) : null;
      const hd = horasDescanso != null ? parseFloat(String(horasDescanso)) : 0;
      if (!ht || !fechaInicioCiclo) return "sin_turno";
      const ciclo = ht + hd;
      if (ciclo <= 24) return "trabajando"; // turno intra-día: trabaja todos los días

      // Turno de ciclo largo (ej: 24h trabajo + 24h descanso = ciclo 48h)
      const diasTrabajo   = Math.ceil(ht / 24);
      const diasDescanso  = Math.ceil(hd / 24);
      const cicloDias     = diasTrabajo + diasDescanso;

      // Normalizar: puede llegar como Date object, ISO string, o "YYYY-MM-DD"
      const inicioISO = fechaInicioCiclo instanceof Date
        ? fechaInicioCiclo.toISOString().slice(0, 10)
        : String(fechaInicioCiclo).slice(0, 10);
      const inicio   = new Date(inicioISO + "T00:00:00Z");
      const objetivo = new Date(fecha + "T00:00:00Z");
      const diff     = Math.round((objetivo.getTime() - inicio.getTime()) / 86_400_000);
      const posicion = ((diff % cicloDias) + cicloDias) % cicloDias;

      return posicion < diasTrabajo ? "trabajando" : "descansando";
    }

    // 5. Categorizar cada empleado
    const trabajando:         typeof empleados = [];
    const descansando:        typeof empleados = [];
    const disponible:         typeof empleados = [];
    const relevoProgramado:   typeof empleados = [];
    const ausenteProgramado:  typeof empleados = [];
    const noElegible:         typeof empleados = [];

    for (const emp of empleados) {
      // Empleados suspendidos o incapacitados → siempre no elegibles (independiente de puesto)
      if (emp.estado_laboral === "suspendido" || emp.estado_laboral === "incapacitado") {
        noElegible.push({ ...emp, razon_no_elegible: emp.estado_laboral });
        continue;
      }

      // ¿Tiene evento RRHH aprobado ese día? → ausente programado (incluso si tiene puesto)
      const eventoRrhh = eventosMap.get(emp.id);
      if (eventoRrhh) {
        ausenteProgramado.push({ ...emp, fuente_ausencia: "rrhh", tipo_ausencia_rrhh: eventoRrhh.tipo });
        continue;
      }

      // ¿Tiene planificacion_futura como titular ausente?
      if (emp.plan_id && emp.plan_estado !== "cancelado") {
        ausenteProgramado.push({ ...emp, fuente_ausencia: "planificacion_futura" });
        continue;
      }

      // ¿Es relevo programado en algún puesto?
      if (relevosSet.has(emp.id)) {
        relevoProgramado.push({ ...emp });
        continue;
      }

      // ¿Tiene puesto asignado? → calcular turno (independiente de elegible_pool)
      // Los empleados en puesto fijo tienen elegible_pool=false pero igual trabajan/descansan
      if (emp.puesto_id) {
        const estado = calcularEstadoTurno(emp.horas_trabajo, emp.horas_descanso, emp.fecha_inicio_ciclo);
        if (estado === "trabajando") {
          trabajando.push({ ...emp, estado_turno: "trabajando" });
        } else if (estado === "descansando") {
          descansando.push({ ...emp, estado_turno: "descansando" });
        } else {
          // Puesto asignado pero sin turno definido → asumir trabajando
          trabajando.push({ ...emp, estado_turno: "sin_turno_asume_trabajo" });
        }
        continue;
      }

      // Sin puesto asignado: elegible_pool determina si está disponible o excluido
      if (!emp.elegible_pool) {
        noElegible.push({ ...emp, razon_no_elegible: "no_elegible_pool" });
        continue;
      }

      // Sin puesto y elegible → disponible en el pool
      disponible.push({ ...emp });
    }

    res.json({
      fecha,
      trabajando,
      descansando,
      disponible,
      relevoProgramado,
      ausenteProgramado,
      noElegible,
      totales: {
        trabajando:        trabajando.length,
        descansando:       descansando.length,
        disponible:        disponible.length,
        relevoProgramado:  relevoProgramado.length,
        ausenteProgramado: ausenteProgramado.length,
        noElegible:        noElegible.length,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/pool-futuro error");
    res.status(500).json({ error: "Error al calcular disponibilidad futura" });
  }
});
