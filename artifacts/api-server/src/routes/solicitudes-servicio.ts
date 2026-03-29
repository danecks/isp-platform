import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const solicitudesServicioRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SSA-${yy}${mm}${dd}-${rnd}`;
}

function genTareaId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TASK-${yy}${mm}${dd}-${rnd}`;
}

const TIPO_LABELS: Record<string, string> = {
  guardia_extra: "Guardia Extra",
  ampliacion_horario: "Ampliación de Horario",
  cobertura_evento: "Cobertura de Evento",
  custodia_extra: "Custodia Extra",
  apoyo_temporal: "Apoyo Temporal",
};

const PRIORIDAD_LABELS: Record<string, string> = {
  urgente: "URGENTE",
  alta: "Alta",
  normal: "Normal",
  baja: "Baja",
};

// ── Auto-crear 3 tareas por solicitud ─────────────────────────────────────────
async function crearTareasParaSolicitud(
  solicitudId: string,
  clienteNombre: string,
  tipoSolicitud: string,
  fecha: string,
  prioridad: string,
  clienteId: number | null,
  sedeId: number | null,
  puestoId: number | null,
): Promise<{ tareaOpsId: string; tareaRrhhId: string; tareaComercialId: string }> {
  const tipoLabel = TIPO_LABELS[tipoSolicitud] ?? tipoSolicitud;
  const prioLabel = PRIORIDAD_LABELS[prioridad] ?? prioridad;
  const fechaLabel = new Date(fecha + "T12:00:00").toLocaleDateString("es-GT", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const tareaOpsId = genTareaId();
  const tareaRrhhId = genTareaId();
  const tareaComercialId = genTareaId();

  await pool.query(
    `INSERT INTO tareas (id, titulo, descripcion, prioridad, estado, asignado, canal, cliente_id, sede_id, puesto_id)
     VALUES ($1, $2, $3, $4, 'pendiente', 'Operaciones', 'sistema', $5, $6, $7)`,
    [
      tareaOpsId,
      `[Ops] ${tipoLabel} — ${clienteNombre} (${fechaLabel})`,
      `Solicitud ${solicitudId} | Prioridad: ${prioLabel}\nRevisar si puede cubrirse con personal disponible o relevos. Coordinar asignación en el pizarrón operativo.`,
      prioridad === "urgente" ? "alta" : prioridad,
      clienteId,
      sedeId,
      puestoId,
    ],
  );

  await pool.query(
    `INSERT INTO tareas (id, titulo, descripcion, prioridad, estado, asignado, canal, cliente_id, sede_id, puesto_id)
     VALUES ($1, $2, $3, $4, 'pendiente', 'RRHH', 'sistema', $5, $6, $7)`,
    [
      tareaRrhhId,
      `[RRHH] Validación personal — ${tipoLabel} | ${clienteNombre} (${fechaLabel})`,
      `Solicitud ${solicitudId} | Prioridad: ${prioLabel}\nValidar disponibilidad de personal. Indicar si se cubre con pool, requiere contratación o reasignación.`,
      prioridad === "urgente" ? "alta" : prioridad,
      clienteId,
      sedeId,
      puestoId,
    ],
  );

  await pool.query(
    `INSERT INTO tareas (id, titulo, descripcion, prioridad, estado, asignado, canal, cliente_id, sede_id, puesto_id)
     VALUES ($1, $2, $3, $4, 'pendiente', 'Comercial', 'sistema', $5, $6, $7)`,
    [
      tareaComercialId,
      `[Comercial] Facturación servicio extra — ${clienteNombre} (${fechaLabel})`,
      `Solicitud ${solicitudId} | Tipo: ${tipoLabel} | Prioridad: ${prioLabel}\nRegistrar tarifa, monto estimado y seguimiento de cobro del servicio adicional.`,
      prioridad === "urgente" ? "alta" : prioridad,
      clienteId,
      sedeId,
      puestoId,
    ],
  );

  return { tareaOpsId, tareaRrhhId, tareaComercialId };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/solicitudes-servicio — listar todas (admin)
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.get("/solicitudes-servicio", async (req, res) => {
  try {
    const { estado, clienteId, desde, hasta, limit = "100" } = req.query as Record<string, string>;

    let where = "WHERE 1=1";
    const params: unknown[] = [];
    let n = 1;

    if (estado) { where += ` AND s.estado_general = $${n++}`; params.push(estado); }
    if (clienteId) { where += ` AND s.cliente_id = $${n++}`; params.push(Number(clienteId)); }
    if (desde) { where += ` AND s.fecha >= $${n++}`; params.push(desde); }
    if (hasta) { where += ` AND s.fecha <= $${n++}`; params.push(hasta); }

    const { rows } = await pool.query(
      `SELECT
         s.*,
         c.nombre AS cliente_nombre,
         c.portal_cliente_id AS cliente_portal_id,
         cs.nombre AS sede_nombre,
         po.nombre AS puesto_nombre,
         t1.estado AS tarea_ops_estado,
         t2.estado AS tarea_rrhh_estado,
         t3.estado AS tarea_comercial_estado
       FROM solicitudes_servicio_adicional s
       LEFT JOIN clients c ON c.id = s.cliente_id
       LEFT JOIN client_sedes cs ON cs.id = s.sede_id
       LEFT JOIN puestos_operativos po ON po.id = s.puesto_id
       LEFT JOIN tareas t1 ON t1.id = s.tarea_operaciones_id
       LEFT JOIN tareas t2 ON t2.id = s.tarea_rrhh_id
       LEFT JOIN tareas t3 ON t3.id = s.tarea_comercial_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${n}`,
      [...params, Number(limit)],
    );

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: GET list error");
    return res.status(500).json({ error: "Error al obtener solicitudes" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/solicitudes-servicio/tablero — tarjetas activas (must be before /:id)
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.get("/solicitudes-servicio/tablero", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id, s.tipo_solicitud, s.fecha, s.fecha_fin, s.hora_inicio, s.hora_fin,
        s.cantidad_guardias, s.prioridad, s.descripcion,
        s.estado_general, s.estado_operaciones, s.estado_rrhh, s.estado_comercial, s.estado_facturacion,
        s.agente_id, s.agente_nombre, s.tipo_cobertura, s.cubierta_con,
        s.monto_estimado, s.tarifa_aplicada,
        s.observaciones_operaciones, s.observaciones_comercial,
        s.tarjeta_activa, s.resumen_final, s.resumen_generado_at,
        s.fecha_inicio_real, s.fecha_fin_real,
        c.nombre AS cliente_nombre, c.portal_cliente_id AS cliente_portal_id,
        cs.nombre AS sede_nombre, cs.direccion AS sede_direccion,
        po.nombre AS puesto_nombre,
        e.nombre_completo AS agente_nombre_completo,
        e.telefono AS agente_telefono,
        t1.estado AS tarea_ops_estado,
        t2.estado AS tarea_rrhh_estado,
        t3.estado AS tarea_comercial_estado
      FROM solicitudes_servicio_adicional s
      LEFT JOIN clients c ON c.id = s.cliente_id
      LEFT JOIN client_sedes cs ON cs.id = s.sede_id
      LEFT JOIN puestos_operativos po ON po.id = s.puesto_id
      LEFT JOIN employees e ON e.id = s.agente_id
      LEFT JOIN tareas t1 ON t1.id = s.tarea_operaciones_id
      LEFT JOIN tareas t2 ON t2.id = s.tarea_rrhh_id
      LEFT JOIN tareas t3 ON t3.id = s.tarea_comercial_id
      WHERE s.tarjeta_activa = TRUE
        AND s.estado_general NOT IN ('cancelada', 'cerrada')
      ORDER BY s.prioridad DESC, s.fecha ASC
    `);
    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: GET tablero error");
    return res.status(500).json({ error: "Error al obtener tablero" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/solicitudes-servicio/stats — estadísticas para dashboard
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.get("/solicitudes-servicio/stats", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                             AS total,
        COUNT(*) FILTER (WHERE estado_general = 'nueva')                    AS nuevas,
        COUNT(*) FILTER (WHERE estado_general = 'en_revision')              AS en_revision,
        COUNT(*) FILTER (WHERE estado_general IN ('pendiente_rrhh','pendiente_operaciones','pendiente_facturacion')) AS en_proceso,
        COUNT(*) FILTER (WHERE estado_general = 'cubierta')                 AS cubiertas,
        COUNT(*) FILTER (WHERE estado_general = 'cerrada')                  AS cerradas,
        COUNT(*) FILTER (WHERE estado_general = 'cancelada')                AS canceladas,
        COUNT(*) FILTER (WHERE prioridad = 'urgente')                       AS urgentes
      FROM solicitudes_servicio_adicional
    `);
    const r = rows[0];
    return res.json({
      total: Number(r.total),
      nuevas: Number(r.nuevas),
      en_revision: Number(r.en_revision),
      en_proceso: Number(r.en_proceso),
      cubiertas: Number(r.cubiertas),
      cerradas: Number(r.cerradas),
      canceladas: Number(r.canceladas),
      urgentes: Number(r.urgentes),
    });
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: GET stats error");
    return res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/solicitudes-servicio/:id — detalle
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.get("/solicitudes-servicio/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT
         s.*,
         c.nombre AS cliente_nombre,
         c.portal_cliente_id AS cliente_portal_id,
         cs.nombre AS sede_nombre,
         po.nombre AS puesto_nombre,
         t1.id AS top_id, t1.titulo AS top_titulo, t1.estado AS top_estado, t1.asignado AS top_asignado,
         t2.id AS trrhh_id, t2.titulo AS trrhh_titulo, t2.estado AS trrhh_estado, t2.asignado AS trrhh_asignado,
         t3.id AS tcom_id, t3.titulo AS tcom_titulo, t3.estado AS tcom_estado, t3.asignado AS tcom_asignado
       FROM solicitudes_servicio_adicional s
       LEFT JOIN clients c ON c.id = s.cliente_id
       LEFT JOIN client_sedes cs ON cs.id = s.sede_id
       LEFT JOIN puestos_operativos po ON po.id = s.puesto_id
       LEFT JOIN tareas t1 ON t1.id = s.tarea_operaciones_id
       LEFT JOIN tareas t2 ON t2.id = s.tarea_rrhh_id
       LEFT JOIN tareas t3 ON t3.id = s.tarea_comercial_id
       WHERE s.id = $1`,
      [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: GET detail error");
    return res.status(500).json({ error: "Error al obtener solicitud" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/solicitudes-servicio — crear desde panel admin
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.post("/solicitudes-servicio", async (req, res) => {
  try {
    const {
      clienteId, sedeId, puestoId,
      tipoSolicitud, fecha, horaInicio, horaFin,
      cantidadGuardias = 1, descripcion, prioridad = "normal",
      contactoSolicitante, aceptaCobroAdicional = false,
      origen = "admin", solicitadoPorNombre,
    } = req.body;

    if (!tipoSolicitud || !fecha) {
      return res.status(400).json({ error: "Tipo de solicitud y fecha son requeridos" });
    }

    // Obtener nombre del cliente para las tareas
    let clienteNombre = "Cliente";
    if (clienteId) {
      const { rows } = await pool.query(`SELECT nombre FROM clients WHERE id = $1`, [clienteId]);
      if (rows.length > 0) clienteNombre = rows[0].nombre;
    }

    const id = genId();
    const { tareaOpsId, tareaRrhhId, tareaComercialId } = await crearTareasParaSolicitud(
      id, clienteNombre, tipoSolicitud, fecha, prioridad,
      clienteId ?? null, sedeId ?? null, puestoId ?? null,
    );

    await pool.query(
      `INSERT INTO solicitudes_servicio_adicional
         (id, cliente_id, sede_id, puesto_id, tipo_solicitud, fecha, hora_inicio, hora_fin,
          cantidad_guardias, descripcion, prioridad, contacto_solicitante, acepta_cobro_adicional,
          origen, estado_general, tarea_operaciones_id, tarea_rrhh_id, tarea_comercial_id,
          solicitado_por_nombre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'en_revision',$15,$16,$17,$18)`,
      [
        id, clienteId ?? null, sedeId ?? null, puestoId ?? null,
        tipoSolicitud, fecha, horaInicio ?? null, horaFin ?? null,
        cantidadGuardias, descripcion ?? null, prioridad,
        contactoSolicitante ?? null, aceptaCobroAdicional,
        origen, tareaOpsId, tareaRrhhId, tareaComercialId,
        solicitadoPorNombre ?? null,
      ],
    );

    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS cliente_nombre
       FROM solicitudes_servicio_adicional s
       LEFT JOIN clients c ON c.id = s.cliente_id
       WHERE s.id = $1`,
      [id],
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: POST create error");
    return res.status(500).json({ error: "Error al crear solicitud" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solicitudes-servicio/:id/operaciones — área de operaciones
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.patch("/solicitudes-servicio/:id/operaciones", async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoOperaciones, observaciones, cubiertaCon } = req.body;

    const allowed = ["pendiente", "en_proceso", "viable", "no_viable", "cubierta"];
    if (estadoOperaciones && !allowed.includes(estadoOperaciones)) {
      return res.status(400).json({ error: "Estado de operaciones inválido" });
    }

    // Actualizar estado_operaciones y recalcular estado_general
    const { rows: curr } = await pool.query(
      `SELECT estado_general, estado_rrhh, estado_comercial FROM solicitudes_servicio_adicional WHERE id = $1`,
      [id],
    );
    if (curr.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });

    const newEstadoOps = estadoOperaciones ?? curr[0].estado_operaciones;
    const estadoRrhh = curr[0].estado_rrhh;
    const estadoComercial = curr[0].estado_comercial;

    let nuevoEstadoGeneral = curr[0].estado_general;
    if (newEstadoOps === "cubierta" && estadoRrhh !== "pendiente" && estadoComercial !== "pendiente") {
      nuevoEstadoGeneral = "cubierta";
    } else if (newEstadoOps === "no_viable") {
      nuevoEstadoGeneral = "cancelada";
    } else if (newEstadoOps === "en_proceso") {
      nuevoEstadoGeneral = "pendiente_operaciones";
    }

    await pool.query(
      `UPDATE solicitudes_servicio_adicional
       SET estado_operaciones = COALESCE($1, estado_operaciones),
           observaciones_operaciones = COALESCE($2, observaciones_operaciones),
           cubierta_con = COALESCE($3, cubierta_con),
           estado_general = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [estadoOperaciones ?? null, observaciones ?? null, cubiertaCon ?? null, nuevoEstadoGeneral, id],
    );

    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS cliente_nombre
       FROM solicitudes_servicio_adicional s LEFT JOIN clients c ON c.id = s.cliente_id WHERE s.id = $1`,
      [id],
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: PATCH ops error");
    return res.status(500).json({ error: "Error al actualizar operaciones" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solicitudes-servicio/:id/rrhh — área de RRHH
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.patch("/solicitudes-servicio/:id/rrhh", async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoRrhh, observaciones } = req.body;

    const allowed = ["pendiente", "en_proceso", "viable", "requiere_contratacion", "requiere_reasignacion", "no_viable"];
    if (estadoRrhh && !allowed.includes(estadoRrhh)) {
      return res.status(400).json({ error: "Estado RRHH inválido" });
    }

    const { rows: curr } = await pool.query(
      `SELECT estado_general, estado_operaciones, estado_comercial FROM solicitudes_servicio_adicional WHERE id = $1`,
      [id],
    );
    if (curr.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });

    const newEstadoRrhh = estadoRrhh ?? curr[0].estado_rrhh;
    let nuevoEstadoGeneral = curr[0].estado_general;

    if (newEstadoRrhh === "en_proceso" || newEstadoRrhh === "requiere_contratacion" || newEstadoRrhh === "requiere_reasignacion") {
      nuevoEstadoGeneral = "pendiente_rrhh";
    } else if (newEstadoRrhh === "viable") {
      nuevoEstadoGeneral = "en_revision";
    }

    await pool.query(
      `UPDATE solicitudes_servicio_adicional
       SET estado_rrhh = COALESCE($1, estado_rrhh),
           observaciones_rrhh = COALESCE($2, observaciones_rrhh),
           estado_general = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [estadoRrhh ?? null, observaciones ?? null, nuevoEstadoGeneral, id],
    );

    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS cliente_nombre
       FROM solicitudes_servicio_adicional s LEFT JOIN clients c ON c.id = s.cliente_id WHERE s.id = $1`,
      [id],
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: PATCH rrhh error");
    return res.status(500).json({ error: "Error al actualizar RRHH" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solicitudes-servicio/:id/comercial — área comercial/facturación
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.patch("/solicitudes-servicio/:id/comercial", async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoComercial, estadoFacturacion, montoEstimado, tarifaAplicada, observaciones } = req.body;

    const allowedComercial = ["pendiente", "registrado", "pendiente_cobro", "facturado", "cobrado"];
    if (estadoComercial && !allowedComercial.includes(estadoComercial)) {
      return res.status(400).json({ error: "Estado comercial inválido" });
    }

    const { rows: curr } = await pool.query(
      `SELECT estado_general FROM solicitudes_servicio_adicional WHERE id = $1`, [id],
    );
    if (curr.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });

    let nuevoEstadoGeneral = curr[0].estado_general;
    // Activar tarjeta operativa cuando comercial registra la solicitud
    const activarTarjeta = estadoComercial === "registrado";
    if (estadoComercial === "registrado" || estadoComercial === "pendiente_cobro") {
      nuevoEstadoGeneral = "pendiente_facturacion";
    } else if (estadoComercial === "cobrado") {
      nuevoEstadoGeneral = "cerrada";
    }

    await pool.query(
      `UPDATE solicitudes_servicio_adicional
       SET estado_comercial = COALESCE($1, estado_comercial),
           estado_facturacion = COALESCE($2, estado_facturacion),
           monto_estimado = COALESCE($3, monto_estimado),
           tarifa_aplicada = COALESCE($4, tarifa_aplicada),
           observaciones_comercial = COALESCE($5, observaciones_comercial),
           estado_general = $6,
           tarjeta_activa = CASE WHEN $7 THEN TRUE ELSE tarjeta_activa END,
           updated_at = NOW()
       WHERE id = $8`,
      [estadoComercial ?? null, estadoFacturacion ?? null, montoEstimado ?? null,
       tarifaAplicada ?? null, observaciones ?? null, nuevoEstadoGeneral, activarTarjeta, id],
    );

    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS cliente_nombre
       FROM solicitudes_servicio_adicional s LEFT JOIN clients c ON c.id = s.cliente_id WHERE s.id = $1`,
      [id],
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: PATCH comercial error");
    return res.status(500).json({ error: "Error al actualizar comercial" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solicitudes-servicio/:id/cancelar — cancelar
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.patch("/solicitudes-servicio/:id/cancelar", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE solicitudes_servicio_adicional SET estado_general = 'cancelada', updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: PATCH cancelar error");
    return res.status(500).json({ error: "Error al cancelar solicitud" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solicitudes-servicio/:id/asignar-agente — asignar cobertura
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.patch("/solicitudes-servicio/:id/asignar-agente", async (req, res) => {
  try {
    const { id } = req.params;
    const { agenteId, tipoCobertura, fechaInicioReal, fechaFinReal, observaciones } = req.body;

    const TIPOS_VALIDOS = ["disponible", "relevo", "horas_extra", "cambio_titular", "contratacion_nueva"];
    if (tipoCobertura && !TIPOS_VALIDOS.includes(tipoCobertura)) {
      return res.status(400).json({ error: "Tipo de cobertura inválido" });
    }

    const { rows: curr } = await pool.query(
      `SELECT id, tarea_operaciones_id, tarea_rrhh_id FROM solicitudes_servicio_adicional WHERE id = $1`, [id],
    );
    if (curr.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });

    let agenteNombre: string | null = null;
    if (agenteId) {
      const { rows: emp } = await pool.query(`SELECT nombre_completo FROM employees WHERE id = $1`, [agenteId]);
      if (emp.length > 0) agenteNombre = emp[0].nombre_completo;
    }

    // Cuando se asigna agente:
    //   estado_operaciones → 'cubierta'
    //   estado_general     → 'pendiente_facturacion' (queda pendiente la etapa administrativa)
    await pool.query(
      `UPDATE solicitudes_servicio_adicional
       SET agente_id = COALESCE($1, agente_id),
           agente_nombre = COALESCE($2, agente_nombre),
           tipo_cobertura = COALESCE($3, tipo_cobertura),
           estado_operaciones = 'cubierta',
           estado_general = 'pendiente_facturacion',
           cubierta_con = COALESCE($3, tipo_cobertura),
           fecha_inicio_real = COALESCE($4, fecha_inicio_real),
           fecha_fin_real = COALESCE($5, fecha_fin_real),
           observaciones_operaciones = COALESCE($6, observaciones_operaciones),
           updated_at = NOW()
       WHERE id = $7`,
      [agenteId ?? null, agenteNombre, tipoCobertura ?? null,
       fechaInicioReal ?? null, fechaFinReal ?? null,
       observaciones ?? null, id],
    );

    // Auto-completar tarea de operaciones
    if (curr[0].tarea_operaciones_id) {
      await pool.query(
        `UPDATE tareas SET estado = 'completada', updated_at = NOW() WHERE id = $1 AND estado != 'completada'`,
        [curr[0].tarea_operaciones_id],
      ).catch(() => {}); // no bloqueante
    }

    // Si RRHH ya no necesita acción (tipo de cobertura con disponible o relevo), actualizar RRHH
    if (tipoCobertura === "disponible" || tipoCobertura === "relevo" || tipoCobertura === "cambio_titular") {
      await pool.query(
        `UPDATE solicitudes_servicio_adicional SET estado_rrhh = 'completado', updated_at = NOW() WHERE id = $1 AND estado_rrhh = 'pendiente'`,
        [id],
      ).catch(() => {});
      if (curr[0].tarea_rrhh_id) {
        await pool.query(
          `UPDATE tareas SET estado = 'completada', updated_at = NOW() WHERE id = $1 AND estado = 'pendiente'`,
          [curr[0].tarea_rrhh_id],
        ).catch(() => {});
      }
    }

    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS cliente_nombre, e.nombre_completo AS agente_nombre_completo, cs.nombre AS sede_nombre
       FROM solicitudes_servicio_adicional s
       LEFT JOIN clients c ON c.id = s.cliente_id
       LEFT JOIN employees e ON e.id = s.agente_id
       LEFT JOIN client_sedes cs ON cs.id = s.sede_id
       WHERE s.id = $1`, [id],
    );
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: PATCH asignar-agente error");
    return res.status(500).json({ error: "Error al asignar agente" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/solicitudes-servicio/:id/resumen — generar resumen final
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.post("/solicitudes-servicio/:id/resumen", async (req, res) => {
  try {
    const { id } = req.params;
    const { observacionesFinales } = req.body ?? {};

    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS cliente_nombre, c.portal_cliente_id AS cliente_portal_id,
              cs.nombre AS sede_nombre, cs.direccion AS sede_direccion,
              po.nombre AS puesto_nombre,
              e.nombre_completo AS agente_nombre_completo, e.dpi AS agente_dpi
       FROM solicitudes_servicio_adicional s
       LEFT JOIN clients c ON c.id = s.cliente_id
       LEFT JOIN client_sedes cs ON cs.id = s.sede_id
       LEFT JOIN puestos_operativos po ON po.id = s.puesto_id
       LEFT JOIN employees e ON e.id = s.agente_id
       WHERE s.id = $1`, [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });

    const s = rows[0];
    const tipoLabel: Record<string, string> = {
      guardia_extra: "Guardia Extra", ampliacion_horario: "Ampliación de Horario",
      cobertura_evento: "Cobertura de Evento", custodia_extra: "Custodia Extra",
      apoyo_temporal: "Apoyo Temporal", servicio_especial: "Servicio Especial",
      guardia_extraordinario: "Cobertura Extraordinaria",
    };
    const coberturaLabel: Record<string, string> = {
      disponible: "Agente disponible del pool", relevo: "Relevo temporal",
      horas_extra: "Horas extra al titular", cambio_titular: "Cambio de titular",
      contratacion_nueva: "Contratación nueva",
    };

    const resumen = {
      id,
      generado_en: new Date().toISOString(),
      cliente: s.cliente_nombre,
      sede: s.sede_nombre,
      puesto: s.puesto_nombre,
      tipo_servicio: tipoLabel[s.tipo_solicitud] ?? s.tipo_solicitud,
      fecha_inicio: s.fecha,
      fecha_fin: s.fecha_fin ?? s.fecha,
      hora_inicio: s.hora_inicio,
      hora_fin: s.hora_fin,
      fecha_inicio_real: s.fecha_inicio_real,
      fecha_fin_real: s.fecha_fin_real,
      cantidad_guardias: s.cantidad_guardias,
      agente: s.agente_nombre_completo ?? s.agente_nombre ?? "No asignado",
      tipo_cobertura: coberturaLabel[s.tipo_cobertura] ?? s.tipo_cobertura ?? "No especificado",
      hubo_horas_extra: s.tipo_cobertura === "horas_extra",
      monto_estimado: s.monto_estimado,
      tarifa_aplicada: s.tarifa_aplicada,
      estado_final: s.estado_general,
      estado_facturacion: s.estado_facturacion,
      acepta_cobro_adicional: s.acepta_cobro_adicional,
      descripcion_original: s.descripcion,
      observaciones_operaciones: s.observaciones_operaciones,
      observaciones_finales: observacionesFinales ?? null,
      // Estado inicial para contabilidad
      estado_contabilidad: "pendiente_autorizacion",
    };

    await pool.query(
      `UPDATE solicitudes_servicio_adicional
       SET resumen_final = $1,
           resumen_generado_at = NOW(),
           estado_contabilidad = 'pendiente_autorizacion',
           estado_general = CASE WHEN estado_general = 'cubierta' THEN 'cerrada' ELSE estado_general END,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(resumen), id],
    );

    return res.status(201).json(resumen);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: POST resumen error");
    return res.status(500).json({ error: "Error al generar resumen" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/solicitudes-servicio/:id/contabilidad — estado contable
// ─────────────────────────────────────────────────────────────────────────────
solicitudesServicioRouter.patch("/solicitudes-servicio/:id/contabilidad", async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoContabilidad } = req.body;
    const ALLOWED = ["pendiente_autorizacion", "autorizado", "facturado", "cobrado"];
    if (!estadoContabilidad || !ALLOWED.includes(estadoContabilidad)) {
      return res.status(400).json({ error: "Estado de contabilidad inválido. Opciones: " + ALLOWED.join(", ") });
    }

    let nuevoEstadoGeneral: string | null = null;
    if (estadoContabilidad === "cobrado") nuevoEstadoGeneral = "cerrada";

    await pool.query(
      `UPDATE solicitudes_servicio_adicional
       SET estado_contabilidad = $1,
           estado_facturacion = CASE WHEN $1 = 'facturado' THEN 'facturado' WHEN $1 = 'cobrado' THEN 'cobrado' ELSE estado_facturacion END,
           estado_general = COALESCE($2, estado_general),
           updated_at = NOW()
       WHERE id = $3`,
      [estadoContabilidad, nuevoEstadoGeneral, id],
    );

    const { rows } = await pool.query(
      `SELECT s.*, c.nombre AS cliente_nombre FROM solicitudes_servicio_adicional s LEFT JOIN clients c ON c.id = s.cliente_id WHERE s.id = $1`, [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "solicitudes-servicio: PATCH contabilidad error");
    return res.status(500).json({ error: "Error al actualizar contabilidad" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Portal endpoints — GET/POST para cliente autenticado
// ─────────────────────────────────────────────────────────────────────────────

function requirePortalAuth(req: any, res: any, next: any) {
  const rol = (req.headers["x-isp-role"] as string)?.toLowerCase();
  const clienteId = req.headers["x-isp-clienteid"] as string;
  if (rol !== "cliente" || !clienteId?.trim()) {
    return res.status(403).json({ error: "Acceso denegado al portal de clientes" });
  }
  req.portalClienteId = clienteId.trim();
  next();
}

// GET /api/portal/solicitudes-servicio — historial del cliente (incluye resumen público)
solicitudesServicioRouter.get("/portal/solicitudes-servicio", requirePortalAuth, async (req: any, res) => {
  try {
    const portalClienteId = req.portalClienteId;
    const { rows } = await pool.query(
      `SELECT
         s.id, s.tipo_solicitud, s.fecha, s.fecha_fin, s.hora_inicio, s.hora_fin,
         s.cantidad_guardias, s.descripcion, s.prioridad, s.estado_general,
         s.contacto_solicitante, s.acepta_cobro_adicional,
         s.agente_nombre, s.tipo_cobertura,
         s.created_at,
         s.resumen_generado_at,
         s.resumen_final,
         cs.nombre AS sede_nombre,
         po.nombre AS puesto_nombre
       FROM solicitudes_servicio_adicional s
       JOIN clients c ON c.id = s.cliente_id
       LEFT JOIN client_sedes cs ON cs.id = s.sede_id
       LEFT JOIN puestos_operativos po ON po.id = s.puesto_id
       WHERE c.portal_cliente_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [portalClienteId],
    );

    // Filtrar campos internos del resumen para el portal del cliente
    const sanitized = rows.map(r => {
      if (r.resumen_final) {
        try {
          const rf = JSON.parse(r.resumen_final);
          // Solo exponer campos públicos
          r.resumen_final = JSON.stringify({
            id: rf.id,
            tipo_servicio: rf.tipo_servicio,
            fecha_inicio: rf.fecha_inicio,
            fecha_fin: rf.fecha_fin,
            hora_inicio: rf.hora_inicio,
            hora_fin: rf.hora_fin,
            agente: rf.agente,
            tipo_cobertura: rf.tipo_cobertura,
            hubo_horas_extra: rf.hubo_horas_extra,
            estado_final: rf.estado_final,
            acepta_cobro_adicional: rf.acepta_cobro_adicional,
            generado_en: rf.generado_en,
          });
        } catch { r.resumen_final = null; }
      }
      return r;
    });

    return res.json(sanitized);
  } catch (err) {
    logger.error({ err }, "portal solicitudes-servicio: GET error");
    return res.status(500).json({ error: "Error al obtener solicitudes" });
  }
});

// POST /api/portal/solicitudes-servicio — cliente crea solicitud
solicitudesServicioRouter.post("/portal/solicitudes-servicio", requirePortalAuth, async (req: any, res) => {
  try {
    const portalClienteId = req.portalClienteId;

    const { rows: clienteRows } = await pool.query(
      `SELECT id, nombre FROM clients WHERE portal_cliente_id = $1 LIMIT 1`,
      [portalClienteId],
    );
    if (clienteRows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }
    const cliente = clienteRows[0];

    const {
      sedeId, puestoId,
      tipoSolicitud, fecha, horaInicio, horaFin,
      cantidadGuardias = 1, descripcion, prioridad = "normal",
      contactoSolicitante, aceptaCobroAdicional = false,
    } = req.body;

    if (!tipoSolicitud || !fecha) {
      return res.status(400).json({ error: "Tipo de solicitud y fecha son requeridos" });
    }

    const TIPOS_VALIDOS = ["guardia_extra", "ampliacion_horario", "cobertura_evento", "custodia_extra", "apoyo_temporal"];
    if (!TIPOS_VALIDOS.includes(tipoSolicitud)) {
      return res.status(400).json({ error: "Tipo de solicitud inválido" });
    }

    const id = genId();
    const { tareaOpsId, tareaRrhhId, tareaComercialId } = await crearTareasParaSolicitud(
      id, cliente.nombre, tipoSolicitud, fecha, prioridad,
      cliente.id, sedeId ?? null, puestoId ?? null,
    );

    await pool.query(
      `INSERT INTO solicitudes_servicio_adicional
         (id, cliente_id, sede_id, puesto_id, tipo_solicitud, fecha, hora_inicio, hora_fin,
          cantidad_guardias, descripcion, prioridad, contacto_solicitante, acepta_cobro_adicional,
          origen, estado_general, tarea_operaciones_id, tarea_rrhh_id, tarea_comercial_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'portal_cliente','nueva',$14,$15,$16)`,
      [
        id, cliente.id, sedeId ?? null, puestoId ?? null,
        tipoSolicitud, fecha, horaInicio ?? null, horaFin ?? null,
        cantidadGuardias, descripcion ?? null, prioridad,
        contactoSolicitante ?? null, aceptaCobroAdicional,
        tareaOpsId, tareaRrhhId, tareaComercialId,
      ],
    );

    return res.status(201).json({
      id,
      mensaje: "Solicitud enviada correctamente. El equipo de ISP se comunicará con usted.",
    });
  } catch (err) {
    logger.error({ err }, "portal solicitudes-servicio: POST error");
    return res.status(500).json({ error: "Error al crear solicitud" });
  }
});

