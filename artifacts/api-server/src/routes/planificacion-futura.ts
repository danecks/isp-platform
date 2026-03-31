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
