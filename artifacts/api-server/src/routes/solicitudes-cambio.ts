import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  notificarAprobacionPendientePush,
  ROLES_APROBADORES_RRHH,
  ROLES_APROBADORES_OPERACIONES,
} from "../services/push-notificaciones";

export const solicitudesCambioRouter = Router();

const SELECT_BASE = `
  SELECT
    s.id,
    s.employee_id,
    e.nombre_completo                                        AS employee_nombre,
    s.origen_modulo,
    s.tipo_cambio,
    s.estado,
    s.datos_antes,
    s.datos_despues,
    s.creado_por,
    s.motivo,
    s.validado_por_rrhh,
    s.validado_por_operaciones,
    s.decidido_por_admin,
    s.notas_rrhh,
    s.notas_operaciones,
    s.notas_admin,
    TO_CHAR(s.fecha_validacion_rrhh        AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI') AS fecha_validacion_rrhh_str,
    TO_CHAR(s.fecha_validacion_operaciones  AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI') AS fecha_validacion_operaciones_str,
    TO_CHAR(s.fecha_decision_admin          AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI') AS fecha_decision_admin_str,
    s.fecha_validacion_rrhh,
    s.fecha_validacion_operaciones,
    s.fecha_decision_admin,
    s.puesto_id,
    po.nombre                                               AS puesto_nombre,
    po.cliente_id,
    cl.nombre                                               AS cliente_nombre,
    TO_CHAR(s.created_at AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI') AS created_at_str,
    s.created_at,
    s.updated_at
  FROM solicitudes_cambio_operativo s
  JOIN employees e   ON e.id  = s.employee_id
  LEFT JOIN puestos_operativos po ON po.id = s.puesto_id
  LEFT JOIN clients cl ON cl.id = po.cliente_id
`;

// ─── GET /api/solicitudes-cambio ─────────────────────────────────────────────
solicitudesCambioRouter.get("/solicitudes-cambio", async (req, res) => {
  const { estado, tipo, modulo, employee_id, limit = "100", offset = "0" } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (estado)      { conditions.push(`s.estado = $${idx++}`);         values.push(estado); }
  if (tipo)        { conditions.push(`s.tipo_cambio = $${idx++}`);    values.push(tipo); }
  if (modulo)      { conditions.push(`s.origen_modulo = $${idx++}`);  values.push(modulo); }
  if (employee_id) { conditions.push(`s.employee_id = $${idx++}`);    values.push(Number(employee_id)); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} ${where} ORDER BY s.created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, Number(limit), Number(offset)]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /solicitudes-cambio error");
    res.status(500).json({ error: "Error al cargar solicitudes" });
  }
});

// ─── GET /api/solicitudes-cambio/stats ───────────────────────────────────────
solicitudesCambioRouter.get("/solicitudes-cambio/stats", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT estado, COUNT(*) AS total
       FROM solicitudes_cambio_operativo
       GROUP BY estado`
    );
    const stats: Record<string, number> = {};
    for (const r of rows) stats[r.estado] = Number(r.total);
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "GET /solicitudes-cambio/stats error");
    res.status(500).json({ error: "Error al cargar estadísticas" });
  }
});

// ─── GET /api/solicitudes-cambio/:id ─────────────────────────────────────────
solicitudesCambioRouter.get("/solicitudes-cambio/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const { rows } = await pool.query(`${SELECT_BASE} WHERE s.id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /solicitudes-cambio/:id error");
    res.status(500).json({ error: "Error al cargar solicitud" });
  }
});

// ─── POST /api/solicitudes-cambio ────────────────────────────────────────────
// Crear una solicitud de cambio estructural
solicitudesCambioRouter.post("/solicitudes-cambio", async (req, res) => {
  const {
    employee_id,
    origen_modulo,
    tipo_cambio,
    estado = "pendiente_rrhh",
    datos_antes,
    datos_despues,
    creado_por,
    motivo,
    puesto_id,
  } = req.body;

  if (!employee_id || !origen_modulo || !tipo_cambio) {
    return res.status(400).json({ error: "employee_id, origen_modulo y tipo_cambio son requeridos" });
  }

  const ESTADOS_VALIDOS = ["pendiente_rrhh", "pendiente_operaciones", "aprobado", "rechazado", "escalado_admin"];
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO solicitudes_cambio_operativo
         (employee_id, origen_modulo, tipo_cambio, estado, datos_antes, datos_despues,
          creado_por, motivo, puesto_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        employee_id,
        origen_modulo,
        tipo_cambio,
        estado,
        datos_antes ? JSON.stringify(datos_antes) : null,
        datos_despues ? JSON.stringify(datos_despues) : null,
        creado_por || null,
        motivo || null,
        puesto_id || null,
      ]
    );
    const { rows: full } = await pool.query(`${SELECT_BASE} WHERE s.id = $1`, [rows[0].id]);
    const solicitud = full[0];

    // Push a aprobadores según el estado inicial — fire and forget.
    const rolesAprob =
      solicitud.estado === "pendiente_operaciones"
        ? ROLES_APROBADORES_OPERACIONES
        : solicitud.estado === "escalado_admin"
          ? (["admin"] as const)
          : ROLES_APROBADORES_RRHH;
    if (["pendiente_rrhh", "pendiente_operaciones", "escalado_admin"].includes(solicitud.estado)) {
      notificarAprobacionPendientePush({
        tipo: "solicitud_cambio",
        solicitudId: solicitud.id,
        empleadoNombre: solicitud.employee_nombre,
        resumen: `${solicitud.tipo_cambio} (${solicitud.origen_modulo})`,
        roles: rolesAprob,
      }).catch((err) => {
        logger.warn({ err, solicitudId: solicitud.id }, "Push de solicitud-cambio pendiente falló (no bloqueante)");
      });
    }

    res.status(201).json(solicitud);
  } catch (err) {
    logger.error({ err }, "POST /solicitudes-cambio error");
    res.status(500).json({ error: "Error al crear solicitud" });
  }
});

// ─── PATCH /api/solicitudes-cambio/:id/aprobar ───────────────────────────────
// Aprobar por parte de RRHH o Operaciones
solicitudesCambioRouter.patch("/solicitudes-cambio/:id/aprobar", async (req, res) => {
  const id = parseInt(req.params.id);
  const { area, usuario, notas } = req.body; // area: "rrhh" | "operaciones"

  if (!area || !["rrhh", "operaciones"].includes(area)) {
    return res.status(400).json({ error: "area debe ser 'rrhh' o 'operaciones'" });
  }

  try {
    const { rows: cur } = await pool.query(
      `SELECT estado, validado_por_rrhh, validado_por_operaciones FROM solicitudes_cambio_operativo WHERE id = $1`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: "No encontrada" });

    const sol = cur[0];
    let nuevoEstado = sol.estado;

    if (area === "rrhh") {
      await pool.query(
        `UPDATE solicitudes_cambio_operativo
         SET validado_por_rrhh = $1, notas_rrhh = $2, fecha_validacion_rrhh = NOW(),
             estado = CASE
               WHEN estado = 'pendiente_rrhh' AND validado_por_operaciones IS NOT NULL THEN 'aprobado'
               WHEN estado = 'pendiente_rrhh' THEN 'aprobado'
               ELSE estado END,
             updated_at = NOW()
         WHERE id = $3`,
        [usuario || "rrhh", notas || null, id]
      );
    } else {
      await pool.query(
        `UPDATE solicitudes_cambio_operativo
         SET validado_por_operaciones = $1, notas_operaciones = $2, fecha_validacion_operaciones = NOW(),
             estado = CASE
               WHEN estado = 'pendiente_operaciones' AND validado_por_rrhh IS NOT NULL THEN 'aprobado'
               WHEN estado = 'pendiente_operaciones' THEN 'aprobado'
               ELSE estado END,
             updated_at = NOW()
         WHERE id = $3`,
        [usuario || "operaciones", notas || null, id]
      );
    }

    const { rows } = await pool.query(`${SELECT_BASE} WHERE s.id = $1`, [id]);
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /solicitudes-cambio/:id/aprobar error");
    res.status(500).json({ error: "Error al aprobar" });
  }
});

// ─── PATCH /api/solicitudes-cambio/:id/rechazar ──────────────────────────────
solicitudesCambioRouter.patch("/solicitudes-cambio/:id/rechazar", async (req, res) => {
  const id = parseInt(req.params.id);
  const { area, usuario, notas } = req.body;

  try {
    if (area === "rrhh") {
      await pool.query(
        `UPDATE solicitudes_cambio_operativo
         SET validado_por_rrhh = $1, notas_rrhh = $2, fecha_validacion_rrhh = NOW(),
             estado = 'rechazado', updated_at = NOW()
         WHERE id = $3`,
        [usuario || "rrhh", notas || null, id]
      );
    } else if (area === "operaciones") {
      await pool.query(
        `UPDATE solicitudes_cambio_operativo
         SET validado_por_operaciones = $1, notas_operaciones = $2, fecha_validacion_operaciones = NOW(),
             estado = 'rechazado', updated_at = NOW()
         WHERE id = $3`,
        [usuario || "operaciones", notas || null, id]
      );
    } else {
      await pool.query(
        `UPDATE solicitudes_cambio_operativo
         SET estado = 'rechazado', notas_admin = $1, updated_at = NOW()
         WHERE id = $2`,
        [notas || null, id]
      );
    }
    const { rows } = await pool.query(`${SELECT_BASE} WHERE s.id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /solicitudes-cambio/:id/rechazar error");
    res.status(500).json({ error: "Error al rechazar" });
  }
});

// ─── PATCH /api/solicitudes-cambio/:id/escalar ───────────────────────────────
solicitudesCambioRouter.patch("/solicitudes-cambio/:id/escalar", async (req, res) => {
  const id = parseInt(req.params.id);
  const { usuario, motivo } = req.body;
  try {
    await pool.query(
      `UPDATE solicitudes_cambio_operativo
       SET estado = 'escalado_admin', notas_admin = $1, updated_at = NOW()
       WHERE id = $2`,
      [motivo || `Escalado por ${usuario || "usuario"}`, id]
    );
    const { rows } = await pool.query(`${SELECT_BASE} WHERE s.id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /solicitudes-cambio/:id/escalar error");
    res.status(500).json({ error: "Error al escalar" });
  }
});

// ─── PATCH /api/solicitudes-cambio/:id/decidir ───────────────────────────────
// Decisión final de Admin
solicitudesCambioRouter.patch("/solicitudes-cambio/:id/decidir", async (req, res) => {
  const id = parseInt(req.params.id);
  const { decision, usuario, notas } = req.body; // decision: "aprobado" | "rechazado"
  if (!["aprobado", "rechazado"].includes(decision)) {
    return res.status(400).json({ error: "decision debe ser 'aprobado' o 'rechazado'" });
  }
  try {
    await pool.query(
      `UPDATE solicitudes_cambio_operativo
       SET estado = $1, decidido_por_admin = $2, notas_admin = $3,
           fecha_decision_admin = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [decision, usuario || "admin", notas || null, id]
    );
    const { rows } = await pool.query(`${SELECT_BASE} WHERE s.id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /solicitudes-cambio/:id/decidir error");
    res.status(500).json({ error: "Error al decidir" });
  }
});
