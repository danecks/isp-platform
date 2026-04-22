/**
 * AMON-01 — Módulo de Amonestaciones
 *
 * Quién puede hacer qué:
 *   - RRHH:        crear, ver todas, editar, anular, resolver solicitudes de modificación
 *   - Operaciones: crear, ver todas (solo lectura), enviar solicitud de modificación
 *   - Supervisor:  crear (desde kiosko), ver solo las suyas, enviar solicitud de modificación
 *
 * Flujo principal:
 *   - Crear:    POST /amonestaciones                 (rrhh, operaciones, supervisor)
 *   - Listar:   GET  /amonestaciones                 (filtros: empleado, tipo, estado, desde/hasta, autor)
 *   - Detalle:  GET  /amonestaciones/:id
 *   - Por emp.: GET  /amonestaciones/empleado/:id    (historial completo del agente)
 *   - Editar:   PATCH /amonestaciones/:id            (solo rrhh)
 *   - Anular:   POST /amonestaciones/:id/anular      (solo rrhh)
 *   - Pedir mod.: POST /amonestaciones/:id/solicitar-modificacion (operaciones, supervisor)
 *   - Bandeja: GET  /amonestaciones/solicitudes-modificacion       (rrhh)
 *   - Resolver: POST /amonestaciones/solicitudes-modificacion/:id/resolver (rrhh)
 *   - Catálogo: GET  /amonestaciones/motivos
 *
 * Cada amonestación creada se replica a `eventos_rrhh` para que aparezca en
 * la línea de tiempo del colaborador (sin duplicar fuente de verdad — la
 * tabla maestra sigue siendo `amonestaciones`).
 *
 * Las amonestaciones de tipo `economica` con estado `activa` y descontado=FALSE
 * son consumidas por la query de pre-planilla en "otros descuentos".
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface SessionInfo {
  username?: string;
  rol?: string;
  user_id?: number;
}

function getSession(req: Request): SessionInfo {
  try {
    const raw = req.headers["x-isp-session"] as string | undefined;
    if (!raw) return {};
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return {};
  }
}

function esRRHH(rol?: string) {
  return rol === "rrhh" || rol === "admin";
}

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/motivos — catálogo de motivos sugeridos
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/motivos", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, monto_sugerido::float AS monto_sugerido, activo
         FROM amonestacion_motivos
        WHERE activo = TRUE
        ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/motivos");
    res.status(500).json({ error: "Error al obtener motivos" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/solicitudes-modificacion — bandeja RRHH
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/solicitudes-modificacion", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const estado = String(req.query.estado ?? "pendiente");
    const params: unknown[] = [];
    let where = "";
    if (estado !== "todas") {
      params.push(estado);
      where = `WHERE s.estado = $${params.length}`;
    }
    // Operaciones / Supervisor solo ven las suyas
    if (!esRRHH(session.rol)) {
      params.push(session.username ?? "");
      where += (where ? " AND " : "WHERE ") + `s.solicitada_por_username = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT s.*,
              a.empleado_nombre, a.tipo, a.motivo, a.monto::float AS monto,
              a.fecha, a.estado AS amon_estado, a.creado_por_username, a.creado_por_rol
         FROM amonestacion_solicitudes_modificacion s
         JOIN amonestaciones a ON a.id = s.amonestacion_id
         ${where}
        ORDER BY s.created_at DESC
        LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/solicitudes-modificacion");
    res.status(500).json({ error: "Error al obtener solicitudes" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/solicitudes-modificacion/:id/resolver — RRHH aprueba/rechaza
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/solicitudes-modificacion/:id/resolver", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede resolver solicitudes" });
    }
    const id = parseInt(req.params.id, 10);
    const { accion, respuesta } = req.body ?? {};
    if (!["aprobada", "rechazada"].includes(accion)) {
      return res.status(400).json({ error: "accion debe ser 'aprobada' o 'rechazada'" });
    }
    await pool.query(
      `UPDATE amonestacion_solicitudes_modificacion
          SET estado = $1, respuesta_rrhh = $2, resuelta_por = $3, resuelta_at = NOW()
        WHERE id = $4`,
      [accion, respuesta || null, session.username || "rrhh", id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/solicitudes-modificacion/:id/resolver");
    res.status(500).json({ error: "Error al resolver solicitud" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/empleado/:id — historial del colaborador
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/empleado/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT id, employee_id, empleado_nombre, creado_por_username, creado_por_rol,
              tipo, motivo, descripcion, monto::float AS monto, evidencia_url,
              cliente_nombre, puesto_nombre, fecha, estado, descontado, planilla_id,
              anulada_por, anulada_at, anulada_motivo, notas_rrhh, created_at
         FROM amonestaciones
        WHERE employee_id = $1
        ORDER BY fecha DESC, id DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/empleado/:id");
    res.status(500).json({ error: "Error al obtener amonestaciones del empleado" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones — listado con filtros
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const { empleado_id, tipo, estado, desde, hasta, autor, rol_autor } = req.query;

    const conds: string[] = [];
    const params: unknown[] = [];

    // Supervisor solo ve las suyas
    if (session.rol === "supervisor") {
      params.push(session.username ?? "");
      conds.push(`creado_por_username = $${params.length}`);
    }

    if (empleado_id) { params.push(Number(empleado_id)); conds.push(`employee_id = $${params.length}`); }
    if (tipo)        { params.push(String(tipo));        conds.push(`tipo = $${params.length}`); }
    if (estado)      { params.push(String(estado));      conds.push(`estado = $${params.length}`); }
    if (desde)       { params.push(String(desde));       conds.push(`fecha >= $${params.length}`); }
    if (hasta)       { params.push(String(hasta));       conds.push(`fecha <= $${params.length}`); }
    if (autor)       { params.push(String(autor));       conds.push(`creado_por_username = $${params.length}`); }
    if (rol_autor)   { params.push(String(rol_autor));   conds.push(`creado_por_rol = $${params.length}`); }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, employee_id, empleado_nombre, creado_por_username, creado_por_rol,
              tipo, motivo, descripcion, monto::float AS monto, evidencia_url,
              cliente_nombre, puesto_nombre, fecha, estado, descontado, planilla_id,
              anulada_por, anulada_at, created_at
         FROM amonestaciones
         ${where}
        ORDER BY fecha DESC, id DESC
        LIMIT 1000`,
      params
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones");
    res.status(500).json({ error: "Error al listar amonestaciones" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/:id
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT a.*, a.monto::float AS monto
         FROM amonestaciones a
        WHERE a.id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    const { rows: solis } = await pool.query(
      `SELECT id, solicitada_por_username, solicitada_por_rol, cambio_solicitado,
              motivo_solicitud, estado, respuesta_rrhh, resuelta_por, resuelta_at, created_at
         FROM amonestacion_solicitudes_modificacion
        WHERE amonestacion_id = $1
        ORDER BY created_at DESC`,
      [id]
    );
    res.json({ ...rows[0], solicitudes_modificacion: solis });
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/:id");
    res.status(500).json({ error: "Error al obtener amonestación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones — crear (rrhh, operaciones, supervisor)
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const session = getSession(req);
    const rol = session.rol || "rrhh";
    if (!["rrhh", "admin", "operaciones", "supervisor"].includes(rol)) {
      return res.status(403).json({ error: "Rol no autorizado" });
    }

    const {
      employee_id, tipo, motivo, descripcion, monto, evidencia_url,
      cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha,
    } = req.body ?? {};

    if (!employee_id) return res.status(400).json({ error: "employee_id requerido" });
    if (!["llamada_atencion", "economica"].includes(tipo)) {
      return res.status(400).json({ error: "tipo debe ser 'llamada_atencion' o 'economica'" });
    }
    if (!motivo || String(motivo).trim() === "") {
      return res.status(400).json({ error: "motivo requerido" });
    }
    const montoNum = tipo === "economica" ? Math.max(0, Number(monto) || 0) : 0;

    await client.query("BEGIN");

    // Nombre del empleado para snapshot
    const { rows: empRows } = await client.query(
      `SELECT nombre_completo FROM employees WHERE id = $1`,
      [employee_id]
    );
    if (empRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    const empleadoNombre = empRows[0].nombre_completo;

    const { rows: ins } = await client.query(
      `INSERT INTO amonestaciones (
         employee_id, empleado_nombre,
         creado_por_user_id, creado_por_username, creado_por_rol,
         tipo, motivo, descripcion, monto, evidencia_url,
         cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha
       ) VALUES (
         $1, $2,
         $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, COALESCE($15::date, CURRENT_DATE)
       ) RETURNING id`,
      [
        employee_id, empleadoNombre,
        session.user_id ?? null, session.username ?? null, rol,
        tipo, String(motivo).trim(), descripcion || null, montoNum, evidencia_url || null,
        cliente_id || null, cliente_nombre || null, puesto_id || null, puesto_nombre || null,
        fecha || null,
      ]
    );
    const amonId = ins[0].id;

    // Replicar a eventos_rrhh para línea de tiempo del colaborador
    let eventoId: number | null = null;
    try {
      const obs = `${tipo === "economica" ? `Amonestación económica Q${montoNum.toFixed(2)}` : "Llamada de atención"} — ${motivo}${descripcion ? `: ${descripcion}` : ""}`;
      const { rows: evIns } = await client.query(
        `INSERT INTO eventos_rrhh (
           employee_id, employee_nombre, tipo_evento, fecha,
           observaciones, cliente_nombre, puesto_nombre,
           estado, generado_desde, usuario_generador
         ) VALUES (
           $1, $2, 'amonestacion', COALESCE($3::date, CURRENT_DATE),
           $4, $5, $6,
           'aprobado', $7, $8
         ) RETURNING id`,
        [
          employee_id, empleadoNombre, fecha || null,
          obs, cliente_nombre || null, puesto_nombre || null,
          rol, session.username || null,
        ]
      );
      eventoId = evIns[0].id;
      await client.query(`UPDATE amonestaciones SET evento_rrhh_id = $1 WHERE id = $2`, [eventoId, amonId]);
    } catch (evErr) {
      // No bloqueante: si eventos_rrhh tiene constraints distintos, seguimos sin perder la amonestación
      logger.warn({ evErr }, "AMON: no se pudo replicar a eventos_rrhh (no bloqueante)");
    }

    await client.query("COMMIT");
    res.status(201).json({ id: amonId, evento_rrhh_id: eventoId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "POST /amonestaciones");
    res.status(500).json({ error: "Error al crear amonestación" });
  } finally {
    client.release();
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /amonestaciones/:id — editar (solo RRHH)
// ────────────────────────────────────────────────────────────────────────────
router.patch("/amonestaciones/:id", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede modificar amonestaciones" });
    }
    const id = parseInt(req.params.id, 10);
    const { tipo, motivo, descripcion, monto, fecha, evidencia_url, notas_rrhh } = req.body ?? {};

    const updates: string[] = [];
    const params: unknown[] = [id];
    if (tipo !== undefined) {
      if (!["llamada_atencion", "economica"].includes(tipo)) {
        return res.status(400).json({ error: "tipo inválido" });
      }
      params.push(tipo); updates.push(`tipo = $${params.length}`);
    }
    if (motivo !== undefined) { params.push(String(motivo)); updates.push(`motivo = $${params.length}`); }
    if (descripcion !== undefined) { params.push(descripcion || null); updates.push(`descripcion = $${params.length}`); }
    if (monto !== undefined) { params.push(Math.max(0, Number(monto) || 0)); updates.push(`monto = $${params.length}`); }
    if (fecha !== undefined) { params.push(fecha || null); updates.push(`fecha = $${params.length}::date`); }
    if (evidencia_url !== undefined) { params.push(evidencia_url || null); updates.push(`evidencia_url = $${params.length}`); }
    if (notas_rrhh !== undefined) { params.push(notas_rrhh || null); updates.push(`notas_rrhh = $${params.length}`); }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push(`updated_at = NOW()`);

    await pool.query(
      `UPDATE amonestaciones SET ${updates.join(", ")} WHERE id = $1`,
      params
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /amonestaciones/:id");
    res.status(500).json({ error: "Error al modificar amonestación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/:id/anular — anular (solo RRHH)
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/:id/anular", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede anular amonestaciones" });
    }
    const id = parseInt(req.params.id, 10);
    const motivoAnul = req.body?.motivo || null;

    const { rows } = await pool.query(
      `SELECT descontado, planilla_id FROM amonestaciones WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrada" });

    await pool.query(
      `UPDATE amonestaciones
          SET estado = 'anulada',
              anulada_por = $1,
              anulada_at = NOW(),
              anulada_motivo = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [session.username || "rrhh", motivoAnul, id]
    );

    const yaDescontada = rows[0].descontado === true;
    res.json({
      ok: true,
      ya_descontada: yaDescontada,
      planilla_id: rows[0].planilla_id,
      mensaje: yaDescontada
        ? "Amonestación anulada, pero ya fue descontada en una planilla cerrada. Genera un ajuste manual si aplica."
        : "Amonestación anulada. Será excluida de la próxima pre-planilla.",
    });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/:id/anular");
    res.status(500).json({ error: "Error al anular amonestación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/:id/solicitar-modificacion — operaciones / supervisor
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/:id/solicitar-modificacion", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const id = parseInt(req.params.id, 10);
    const { cambio_solicitado, motivo_solicitud } = req.body ?? {};
    if (!cambio_solicitado || !motivo_solicitud) {
      return res.status(400).json({ error: "cambio_solicitado y motivo_solicitud requeridos" });
    }
    const { rows } = await pool.query(
      `INSERT INTO amonestacion_solicitudes_modificacion (
         amonestacion_id, solicitada_por_user_id, solicitada_por_username,
         solicitada_por_rol, cambio_solicitado, motivo_solicitud
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        id, session.user_id ?? null, session.username ?? null,
        session.rol ?? null, String(cambio_solicitado), String(motivo_solicitud),
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/:id/solicitar-modificacion");
    res.status(500).json({ error: "Error al enviar solicitud" });
  }
});

export const amonestacionesRouter = router;
export default router;
