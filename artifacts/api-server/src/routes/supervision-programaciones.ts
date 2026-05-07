import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// SUPERV-PROG-01 — CRUD de visitas/recorridos programados a supervisores.
// La PWA del supervisor lee estas filas como su agenda al escanear su carnet.

export const supervisionProgramacionesRouter = Router();

const TIPOS = new Set(["rutina", "extraordinaria", "comision"]);
const PRIORIDADES = new Set(["baja", "normal", "alta", "urgente"]);
const ESTADOS = new Set(["pendiente", "en_curso", "completada", "cancelada", "no_realizada"]);

const auth = (req: any, res: any): boolean => {
  if (!req.headers["x-isp-session"]) { res.status(401).json({ error: "No autorizado" }); return false; }
  return true;
};

const SELECT_BASE = `
  SELECT
    sp.id, sp.supervisor_employee_id, sp.cliente_id, sp.puesto_id, sp.zona_id,
    to_char(sp.fecha_planificada, 'YYYY-MM-DD') AS fecha_planificada,
    to_char(sp.ventana_inicio, 'HH24:MI') AS ventana_inicio,
    to_char(sp.ventana_fin,    'HH24:MI') AS ventana_fin,
    sp.tipo, sp.prioridad, sp.instrucciones, sp.estado,
    sp.visita_id, sp.iniciada_at, sp.completada_at,
    sp.created_by_user_id, sp.created_at, sp.updated_at,
    e.nombre_completo AS supervisor_nombre,
    e.tipo_personal   AS supervisor_tipo_personal,
    c.nombre          AS cliente_nombre,
    po.nombre         AS puesto_nombre,
    z.nombre          AS zona_nombre
  FROM supervision_visitas_programadas sp
  JOIN employees e ON e.id = sp.supervisor_employee_id
  LEFT JOIN clients c            ON c.id  = sp.cliente_id
  LEFT JOIN puestos_operativos po ON po.id = sp.puesto_id
  LEFT JOIN operational_zones z   ON z.id  = sp.zona_id
`;

// ─── GET /api/supervision-programaciones ────────────────────────────────────
// Filtros: ?supervisor=ID&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=...&tipo=...
supervisionProgramacionesRouter.get("/supervision-programaciones", async (req, res) => {
  if (!auth(req, res)) return;
  try {
    const params: any[] = [];
    const where: string[] = [];
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (req.query.supervisor) {
      const sup = Number(req.query.supervisor);
      if (!Number.isInteger(sup) || sup <= 0) return res.status(400).json({ error: "supervisor inválido" });
      params.push(sup);
      where.push(`sp.supervisor_employee_id = $${params.length}`);
    }
    if (req.query.desde) {
      const d = String(req.query.desde);
      if (!ISO_DATE.test(d)) return res.status(400).json({ error: "desde inválido (YYYY-MM-DD)" });
      params.push(d); where.push(`sp.fecha_planificada >= $${params.length}`);
    }
    if (req.query.hasta) {
      const d = String(req.query.hasta);
      if (!ISO_DATE.test(d)) return res.status(400).json({ error: "hasta inválido (YYYY-MM-DD)" });
      params.push(d); where.push(`sp.fecha_planificada <= $${params.length}`);
    }
    if (req.query.estado) {
      const est = String(req.query.estado);
      if (!ESTADOS.has(est)) return res.status(400).json({ error: "estado inválido" });
      params.push(est); where.push(`sp.estado = $${params.length}`);
    }
    if (req.query.tipo) {
      const t = String(req.query.tipo);
      if (!TIPOS.has(t)) return res.status(400).json({ error: "tipo inválido" });
      params.push(t); where.push(`sp.tipo = $${params.length}`);
    }
    const sql = `${SELECT_BASE} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY sp.fecha_planificada ASC, sp.ventana_inicio ASC NULLS LAST, sp.id ASC LIMIT 500`;
    const { rows } = await pool.query(sql, params);
    res.json({ programaciones: rows });
  } catch (err) {
    logger.error({ err }, "GET /supervision-programaciones error");
    res.status(500).json({ error: "Error al listar programaciones" });
  }
});

// ─── GET /api/supervision-programaciones/:id ────────────────────────────────
supervisionProgramacionesRouter.get("/supervision-programaciones/:id", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
  try {
    const { rows } = await pool.query(`${SELECT_BASE} WHERE sp.id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: "No encontrada" });
    res.json({ programacion: rows[0] });
  } catch (err) {
    logger.error({ err }, "GET /supervision-programaciones/:id error");
    res.status(500).json({ error: "Error al obtener programación" });
  }
});

// ─── POST /api/supervision-programaciones ───────────────────────────────────
supervisionProgramacionesRouter.post("/supervision-programaciones", async (req, res) => {
  if (!auth(req, res)) return;
  const b = req.body || {};
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const HHMM = /^\d{2}:\d{2}(:\d{2})?$/;
  const supId = Number(b.supervisor_employee_id);
  if (!Number.isInteger(supId) || supId <= 0) return res.status(400).json({ error: "supervisor_employee_id inválido" });
  if (!b.fecha_planificada || !ISO_DATE.test(String(b.fecha_planificada))) {
    return res.status(400).json({ error: "fecha_planificada inválida (YYYY-MM-DD)" });
  }
  if (b.ventana_inicio && !HHMM.test(String(b.ventana_inicio))) {
    return res.status(400).json({ error: "ventana_inicio inválida (HH:MM)" });
  }
  if (b.ventana_fin && !HHMM.test(String(b.ventana_fin))) {
    return res.status(400).json({ error: "ventana_fin inválida (HH:MM)" });
  }
  if (b.ventana_inicio && b.ventana_fin && String(b.ventana_fin) < String(b.ventana_inicio)) {
    return res.status(400).json({ error: "ventana_fin debe ser posterior a ventana_inicio" });
  }
  const tipo = String(b.tipo || "rutina");
  if (!TIPOS.has(tipo)) return res.status(400).json({ error: "tipo inválido" });
  const prioridad = String(b.prioridad || "normal");
  if (!PRIORIDADES.has(prioridad)) return res.status(400).json({ error: "prioridad inválida" });
  if (!b.cliente_id && !b.puesto_id && !b.zona_id) {
    return res.status(400).json({ error: "Debe especificar al menos cliente, puesto o zona" });
  }
  for (const k of ["cliente_id", "puesto_id", "zona_id"] as const) {
    if (b[k] != null && b[k] !== "") {
      const n = Number(b[k]);
      if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: `${k} inválido` });
    }
  }

  try {
    // Validar que el empleado sea supervisor
    const { rows: emp } = await pool.query(
      `SELECT id, tipo_personal, estado_laboral FROM employees WHERE id = $1`, [supId]
    );
    if (!emp[0]) return res.status(404).json({ error: "Supervisor no encontrado" });
    if (emp[0].tipo_personal !== "supervisor") {
      return res.status(400).json({ error: "El empleado no es supervisor" });
    }

    const { rows } = await pool.query(
      `INSERT INTO supervision_visitas_programadas
        (supervisor_employee_id, cliente_id, puesto_id, zona_id,
         fecha_planificada, ventana_inicio, ventana_fin,
         tipo, prioridad, instrucciones, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        supId,
        b.cliente_id ? Number(b.cliente_id) : null,
        b.puesto_id  ? Number(b.puesto_id)  : null,
        b.zona_id    ? Number(b.zona_id)    : null,
        b.fecha_planificada,
        b.ventana_inicio || null,
        b.ventana_fin || null,
        tipo, prioridad,
        b.instrucciones || null,
        (req as any).user?.id || null,
      ]
    );
    const { rows: full } = await pool.query(`${SELECT_BASE} WHERE sp.id = $1`, [rows[0].id]);
    res.status(201).json({ programacion: full[0] });
  } catch (err) {
    logger.error({ err }, "POST /supervision-programaciones error");
    res.status(500).json({ error: "Error al crear programación" });
  }
});

// ─── PUT /api/supervision-programaciones/:id ────────────────────────────────
supervisionProgramacionesRouter.put("/supervision-programaciones/:id", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
  const b = req.body || {};
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const HHMM = /^\d{2}:\d{2}(:\d{2})?$/;
  const sets: string[] = [];
  const params: any[] = [];
  const push = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  const intOrNull = (v: any) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`valor entero inválido: ${v}`);
    return n;
  };

  try {
    if (b.fecha_planificada !== undefined) {
      if (!ISO_DATE.test(String(b.fecha_planificada))) return res.status(400).json({ error: "fecha_planificada inválida" });
      push("fecha_planificada", b.fecha_planificada);
    }
    if (b.ventana_inicio !== undefined) {
      if (b.ventana_inicio && !HHMM.test(String(b.ventana_inicio))) return res.status(400).json({ error: "ventana_inicio inválida" });
      push("ventana_inicio", b.ventana_inicio || null);
    }
    if (b.ventana_fin !== undefined) {
      if (b.ventana_fin && !HHMM.test(String(b.ventana_fin))) return res.status(400).json({ error: "ventana_fin inválida" });
      push("ventana_fin", b.ventana_fin || null);
    }
    if (b.ventana_inicio && b.ventana_fin && String(b.ventana_fin) < String(b.ventana_inicio)) {
      return res.status(400).json({ error: "ventana_fin debe ser posterior a ventana_inicio" });
    }
    if (b.cliente_id    !== undefined) push("cliente_id", intOrNull(b.cliente_id));
    if (b.puesto_id     !== undefined) push("puesto_id", intOrNull(b.puesto_id));
    if (b.zona_id       !== undefined) push("zona_id", intOrNull(b.zona_id));
    if (b.instrucciones !== undefined) push("instrucciones", b.instrucciones || null);
    if (b.tipo !== undefined) {
      if (!TIPOS.has(String(b.tipo))) return res.status(400).json({ error: "tipo inválido" });
      push("tipo", b.tipo);
    }
    if (b.prioridad !== undefined) {
      if (!PRIORIDADES.has(String(b.prioridad))) return res.status(400).json({ error: "prioridad inválida" });
      push("prioridad", b.prioridad);
    }
    if (b.estado !== undefined) {
      if (!ESTADOS.has(String(b.estado))) return res.status(400).json({ error: "estado inválido" });
      push("estado", b.estado);
      if (b.estado === "en_curso")   sets.push(`iniciada_at = COALESCE(iniciada_at, NOW())`);
      if (b.estado === "completada") sets.push(`completada_at = COALESCE(completada_at, NOW())`);
    }
    if (b.supervisor_employee_id !== undefined) {
      const newSup = Number(b.supervisor_employee_id);
      if (!Number.isInteger(newSup) || newSup <= 0) return res.status(400).json({ error: "supervisor_employee_id inválido" });
      const { rows: emp } = await pool.query(
        `SELECT tipo_personal FROM employees WHERE id = $1`, [newSup]
      );
      if (!emp[0]) return res.status(404).json({ error: "Supervisor no encontrado" });
      if (emp[0].tipo_personal !== "supervisor") {
        return res.status(400).json({ error: "El empleado no es supervisor" });
      }
      push("supervisor_employee_id", newSup);
    }
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Datos inválidos" });
  }

  if (!sets.length) return res.status(400).json({ error: "Sin cambios" });
  sets.push(`updated_at = NOW()`);
  params.push(id);

  try {
    const { rowCount } = await pool.query(
      `UPDATE supervision_visitas_programadas SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params
    );
    if (!rowCount) return res.status(404).json({ error: "No encontrada" });
    const { rows } = await pool.query(`${SELECT_BASE} WHERE sp.id = $1`, [id]);
    res.json({ programacion: rows[0] });
  } catch (err) {
    logger.error({ err }, "PUT /supervision-programaciones/:id error");
    res.status(500).json({ error: "Error al actualizar" });
  }
});

// ─── DELETE /api/supervision-programaciones/:id ─────────────────────────────
supervisionProgramacionesRouter.delete("/supervision-programaciones/:id", async (req, res) => {
  if (!auth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM supervision_visitas_programadas WHERE id = $1`, [id]
    );
    if (!rowCount) return res.status(404).json({ error: "No encontrada" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /supervision-programaciones/:id error");
    res.status(500).json({ error: "Error al eliminar" });
  }
});
