/**
 * TAREAS — API de tareas operativas con cierre de evidencia
 *
 * ENDPOINTS:
 *   GET    /api/tareas              → Lista todas las tareas (con evidencia si completada)
 *   GET    /api/tareas/:id          → Detalle de tarea + evidencia
 *   POST   /api/tareas              → Crear tarea
 *   PATCH  /api/tareas/:id          → Actualizar campos básicos (estado, prioridad, etc.)
 *   POST   /api/tareas/:id/cerrar   → Cerrar con evidencia (foto + comentario obligatorios)
 *                                     Solo supervisor o admin. Canal: "admin" o "whatsapp".
 *   DELETE /api/tareas/:id          → Cancelar tarea (solo admin)
 *
 * PERMISOS DE CIERRE:
 *   Roles con permiso: "supervisor", "admin"
 *   El rol se pasa en el body como "rolSupervisor" (temporal — sin middleware de sesión aún).
 *   En la siguiente fase se validará vía middleware de sesión.
 *
 * INTEGRACIÓN WHATSAPP (preparado, no conectado):
 *   POST /api/tareas/:id/cerrar con canal="whatsapp" — mismo endpoint, mismo resultado.
 *   El servicio de WA enviará fotoUrl como URL pública de la foto recibida.
 *   Variables del mensaje "tarea_cerrada_ok": {id}, {supervisor}, {fecha}
 */

import { Router } from "express";
import { db, tareasTable, taskEvidenciasTable, waNotificacionesLogTable, usersTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { notifyTareaAsignada } from "../services/whatsapp/notificaciones.service";

const router = Router();

const ROLES_CON_PERMISO_CIERRE = ["supervisor", "admin"];

// ── Helper: recalcular estado_general SSA según las 3 áreas ──────────────────
// Misma lógica que en solicitudes-servicio.ts para mantener consistencia.
function calcEstadoGeneralSSA(
  ops: string,
  rrhh: string,
  comercial: string,
  estadoActual: string,
): string {
  if (ops === "no_viable") return "cancelada";
  if (comercial === "cobrado") return "cerrada";
  if (comercial === "facturado" || comercial === "pendiente_cobro") return "pendiente_facturacion";
  if (ops === "cubierta" && rrhh !== "pendiente" && comercial !== "pendiente") return "cubierta";
  if (ops === "en_proceso") return "pendiente_operaciones";
  if (["en_proceso", "requiere_contratacion", "requiere_reasignacion"].includes(rrhh)) return "pendiente_rrhh";
  if (rrhh === "viable") return "en_revision";
  return estadoActual;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genTareaId(): string {
  const now = new Date();
  const yymmdd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `TASK-${yymmdd}-${rand}`;
}

// Enriquecer tarea con evidencia si está cerrada
async function getTareaConEvidencia(id: string) {
  const [tarea] = await db.select().from(tareasTable).where(eq(tareasTable.id, id));
  if (!tarea) return null;

  let evidencia = null;
  if (tarea.estado === "completada") {
    const rows = await db
      .select()
      .from(taskEvidenciasTable)
      .where(eq(taskEvidenciasTable.tareaId, id))
      .limit(1);
    if (rows.length > 0) evidencia = rows[0];
  }

  return { ...tarea, evidencia };
}

// ─── GET /api/tareas ──────────────────────────────────────────────────────────
router.get("/tareas", async (_req, res) => {
  try {
    const tareas = await db
      .select()
      .from(tareasTable)
      .orderBy(desc(tareasTable.createdAt));

    // M-05: Filtrar evidencias solo para las tareas completadas, no cargar todas
    const completadasIds = tareas
      .filter((t) => t.estado === "completada")
      .map((t) => t.id);

    let evidenciasMap: Record<string, typeof taskEvidenciasTable.$inferSelect> = {};

    if (completadasIds.length > 0) {
      // Traer solo evidencias de las tareas completadas (filtro en SQL con IN)
      const { rows: evRows } = await pool.query(
        `SELECT * FROM task_evidencias
         WHERE tarea_id = ANY($1::varchar[])
         ORDER BY fecha_cierre DESC`,
        [completadasIds]
      );
      for (const ev of evRows) {
        const tid = ev.tarea_id;
        if (!evidenciasMap[tid]) {
          evidenciasMap[tid] = ev;
        }
      }
    }

    const result = tareas.map((t) => ({
      ...t,
      evidencia: evidenciasMap[t.id] ?? null,
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /api/tareas error");
    res.status(500).json({ error: "Error al obtener tareas" });
  }
});

// ─── GET /api/notificaciones ──────────────────────────────────────────────────
// Log de notificaciones WhatsApp automáticas (ej: tarea asignada)
// Query params: ?limit=50&tareaId=TASK-240315-1234
router.get("/notificaciones", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
    const tareaId = req.query.tareaId as string | undefined;

    let query = `
      SELECT
        n.id,
        n.tarea_id    AS "tareaId",
        n.usuario_id  AS "usuarioId",
        n.telefono,
        n.mensaje,
        n.evento,
        n.estado,
        n.error_msg   AS "errorMsg",
        n.created_at  AS "createdAt",
        u.nombre      AS "usuarioNombre"
      FROM wa_notificaciones_log n
      LEFT JOIN users u ON u.id = n.usuario_id
    `;
    const params: unknown[] = [];

    if (tareaId) {
      query += ` WHERE n.tarea_id = $1`;
      params.push(tareaId);
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /api/notificaciones error");
    res.status(500).json({ error: "Error al obtener log de notificaciones" });
  }
});

// ─── GET /api/tareas/stats ────────────────────────────────────────────────────
router.get("/tareas/stats", async (_req, res) => {
  try {
    const rows = await pool.query(`
      SELECT estado, COUNT(*) as total
      FROM tareas
      GROUP BY estado
    `);

    const stats: Record<string, number> = {
      pendiente: 0,
      en_proceso: 0,
      completada: 0,
      cancelada: 0,
    };

    for (const row of rows.rows) {
      stats[row.estado] = parseInt(row.total);
    }

    res.json(stats);
  } catch (err) {
    logger.error({ err }, "GET /api/tareas/stats error");
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// ─── GET /api/tareas/:id ──────────────────────────────────────────────────────
router.get("/tareas/:id", async (req, res) => {
  try {
    const tarea = await getTareaConEvidencia(req.params.id);
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });
    res.json(tarea);
  } catch (err) {
    logger.error({ err }, "GET /api/tareas/:id error");
    res.status(500).json({ error: "Error al obtener tarea" });
  }
});

// ─── POST /api/tareas ─────────────────────────────────────────────────────────
router.post("/tareas", async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      incidenciaId,
      prioridad = "media",
      estado = "pendiente",
      asignado,
      asignadoId,
      fechaVencimiento,
      canal = "manual",
    } = req.body;

    if (!titulo?.trim()) {
      return res.status(400).json({ error: "El título es obligatorio" });
    }

    const id = genTareaId();
    const now = new Date();

    // A-07: auto-derivar nombre del asignado desde la tabla de usuarios
    let resolvedAsignado = asignado?.trim() || null;
    const parsedAsignadoId = asignadoId ? parseInt(String(asignadoId), 10) : null;
    if (parsedAsignadoId && !isNaN(parsedAsignadoId)) {
      const { rows: uRows } = await pool.query<{ nombre: string }>(
        `SELECT nombre FROM users WHERE id = $1 LIMIT 1`, [parsedAsignadoId]
      );
      if (uRows[0]) resolvedAsignado = uRows[0].nombre;
    }

    const [tarea] = await db
      .insert(tareasTable)
      .values({
        id,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        incidenciaId: incidenciaId?.trim() || null,
        prioridad,
        estado,
        asignado: resolvedAsignado,
        asignadoId: parsedAsignadoId,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        canal,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info({ id }, "Tarea creada");
    res.status(201).json(tarea);

    // ── Notificación WhatsApp al responsable (no bloquea la respuesta) ────────
    if (asignadoId) {
      notifyTareaAsignada(
        {
          id: tarea.id,
          titulo: tarea.titulo,
          prioridad: tarea.prioridad,
          incidenciaId: tarea.incidenciaId,
          asignado: tarea.asignado,
        },
        parseInt(asignadoId)
      ).catch(() => {}); // silenciar — ya se loguea internamente
    }
  } catch (err) {
    logger.error({ err }, "POST /api/tareas error");
    res.status(500).json({ error: "Error al crear tarea" });
  }
});

// ─── PATCH /api/tareas/:id ────────────────────────────────────────────────────
router.patch("/tareas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(tareasTable).where(eq(tareasTable.id, id));
    if (!existing) return res.status(404).json({ error: "Tarea no encontrada" });

    const allowed = ["titulo", "descripcion", "prioridad", "estado", "asignado",
                     "asignadoId", "fechaVencimiento"] as const;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "asignadoId") {
          patch.asignadoId = req.body[key] ? parseInt(req.body[key]) : null;
        } else {
          patch[key] = req.body[key];
        }
      }
    }

    // A-07: auto-derivar asignado (texto) cuando cambia asignadoId
    if (patch.asignadoId && typeof patch.asignadoId === "number") {
      const { rows: uRows } = await pool.query<{ nombre: string }>(
        `SELECT nombre FROM users WHERE id = $1 LIMIT 1`, [patch.asignadoId]
      );
      if (uRows[0]) patch.asignado = uRows[0].nombre;
    }

    const [updated] = await db
      .update(tareasTable)
      .set(patch)
      .where(eq(tareasTable.id, id))
      .returning();

    res.json(updated);

    // ── Notificación WA si el responsable cambió ────────────────────────────
    const nuevoAsignadoId = patch.asignadoId as number | null | undefined;
    const anteriorAsignadoId = existing.asignadoId;
    if (
      nuevoAsignadoId &&
      nuevoAsignadoId !== anteriorAsignadoId
    ) {
      notifyTareaAsignada(
        {
          id: updated.id,
          titulo: updated.titulo,
          prioridad: updated.prioridad,
          incidenciaId: updated.incidenciaId,
          asignado: updated.asignado,
        },
        nuevoAsignadoId
      ).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, "PATCH /api/tareas/:id error");
    res.status(500).json({ error: "Error al actualizar tarea" });
  }
});

// ─── PATCH /api/tareas/:id/paso ───────────────────────────────────────────────
/**
 * Marca/desmarca un paso del checklist de una tarea (modelo SSA de 3 pasos).
 * Body: { key: "operaciones"|"rrhh"|"comercial", done: boolean }
 * Sincroniza el estado de la solicitud SSA vinculada y recalcula estado_general.
 */
router.patch("/tareas/:id/paso", async (req, res) => {
  try {
    const { id } = req.params;
    const { key, done } = req.body as { key?: string; done?: boolean };
    if (!key || typeof done !== "boolean") {
      return res.status(400).json({ error: "key y done son obligatorios" });
    }

    const [tarea] = await db.select().from(tareasTable).where(eq(tareasTable.id, id));
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

    const pasos = Array.isArray(tarea.pasos)
      ? (tarea.pasos as Array<{ key: string; label: string; done: boolean; doneAt: string | null }>)
      : [];
    const idx = pasos.findIndex((p) => p.key === key);
    if (idx === -1) return res.status(404).json({ error: "Paso no encontrado" });

    pasos[idx] = { ...pasos[idx], done, doneAt: done ? new Date().toISOString() : null };

    const total = pasos.length;
    const hechos = pasos.filter((p) => p.done).length;
    const nuevoEstadoTarea =
      total > 0 && hechos === total ? "completada" : hechos > 0 ? "en_proceso" : "pendiente";

    const [updated] = await db
      .update(tareasTable)
      .set({ pasos, estado: nuevoEstadoTarea, updatedAt: new Date() })
      .where(eq(tareasTable.id, id))
      .returning();

    // ── Sincronizar SSA vinculada (no bloqueante) ──────────────────────────────
    try {
      const { rows } = await pool.query(
        `SELECT id, estado_operaciones, estado_rrhh, estado_comercial,
                estado_facturacion, estado_general
         FROM solicitudes_servicio_adicional
         WHERE tarea_operaciones_id = $1 OR tarea_rrhh_id = $1 OR tarea_comercial_id = $1
         LIMIT 1`,
        [id],
      );
      if (rows.length > 0) {
        const s = rows[0];
        let newOps        = s.estado_operaciones;
        let newRrhh       = s.estado_rrhh;
        let newComercial  = s.estado_comercial;
        let newFacturacion: string | null = null;

        if (key === "operaciones") newOps = done ? "cubierta" : "en_proceso";
        if (key === "rrhh") newRrhh = done ? "viable" : "pendiente";
        if (key === "comercial") {
          newComercial = done ? "facturado" : "pendiente";
          newFacturacion = done ? "facturado" : "pendiente";
        }

        const nuevoEstadoGeneral = calcEstadoGeneralSSA(newOps, newRrhh, newComercial, s.estado_general);

        await pool.query(
          `UPDATE solicitudes_servicio_adicional
           SET estado_operaciones = $2,
               estado_rrhh        = $3,
               estado_comercial   = $4,
               estado_facturacion = COALESCE($5, estado_facturacion),
               estado_general     = $6,
               updated_at = NOW()
           WHERE id = $1`,
          [s.id, newOps, newRrhh, newComercial, newFacturacion, nuevoEstadoGeneral],
        );
      }
    } catch (syncErr) {
      logger.error({ syncErr, tareaId: id }, "SSA sync tras toggle de paso — error (no bloqueante)");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /api/tareas/:id/paso error");
    return res.status(500).json({ error: "Error al actualizar el paso" });
  }
});

// ─── POST /api/tareas/:id/cerrar ──────────────────────────────────────────────
/**
 * Cierra una tarea con evidencia real (foto + comentario).
 *
 * Body:
 *   supervisorNombre  string  OBLIGATORIO — nombre del supervisor
 *   supervisorId      number  Opcional    — ID del usuario en la BD
 *   rolSupervisor     string  OBLIGATORIO — "supervisor" | "admin"
 *   comentario        string  OBLIGATORIO — descripción del cierre
 *   fotoUrl           string  OBLIGATORIO — base64 data URL o URL pública
 *   canal             string  Opcional    — "admin" (default) | "whatsapp"
 *
 * Responde con: { tarea, evidencia }
 *
 * INTEGRACIÓN WHATSAPP:
 *   Este mismo endpoint recibe el cierre cuando el supervisor lo hace vía WA.
 *   El servicio de WhatsApp debe:
 *   1. Detectar el intento de cierre (opción "1. Cerrar con evidencia")
 *   2. Solicitar foto (mensaje: tarea_pedir_foto)
 *   3. Recibir foto → subirla y obtener URL pública
 *   4. Solicitar comentario (mensaje: tarea_pedir_comentario)
 *   5. Llamar POST /api/tareas/:id/cerrar con canal="whatsapp"
 *   6. Responder con mensaje "tarea_cerrada_ok"
 */
router.post("/tareas/:id/cerrar", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supervisorNombre,
      supervisorId,
      rolSupervisor,
      comentario,
      fotoUrl,
      canal = "admin",
    } = req.body;

    // 1. Validar rol — M-02: verificar desde la DB si se proporciona supervisorId,
    //    no confiar únicamente en el valor enviado desde el cliente.
    let rolVerificado: string = rolSupervisor ?? "";

    if (supervisorId && canal !== "whatsapp") {
      const [usuario] = await db
        .select({ rol: usersTable.rol })
        .from(usersTable)
        .where(eq(usersTable.id, parseInt(supervisorId)));

      if (usuario) {
        rolVerificado = usuario.rol;
      } else {
        return res.status(403).json({ error: "Usuario supervisor no encontrado" });
      }
    }

    if (!ROLES_CON_PERMISO_CIERRE.includes(rolVerificado)) {
      return res.status(403).json({
        error: "Solo supervisores y administradores pueden cerrar tareas con evidencia",
        rolRequerido: ROLES_CON_PERMISO_CIERRE,
      });
    }

    // 2. Validar campos obligatorios
    if (!supervisorNombre?.trim()) {
      return res.status(400).json({ error: "El nombre del supervisor es obligatorio" });
    }
    if (!comentario?.trim()) {
      return res.status(400).json({ error: "El comentario de cierre es obligatorio" });
    }
    if (!fotoUrl?.trim()) {
      return res.status(400).json({ error: "La foto de evidencia es obligatoria" });
    }

    // 3. Verificar que la tarea existe
    const [tarea] = await db.select().from(tareasTable).where(eq(tareasTable.id, id));
    if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

    if (tarea.estado === "completada") {
      return res.status(409).json({ error: "La tarea ya está completada" });
    }
    if (tarea.estado === "cancelada") {
      return res.status(409).json({ error: "No se puede cerrar una tarea cancelada" });
    }

    // 4. Crear evidencia
    const now = new Date();
    const [evidencia] = await db
      .insert(taskEvidenciasTable)
      .values({
        tareaId: id,
        supervisorId: supervisorId ? parseInt(supervisorId) : null,
        supervisorNombre: supervisorNombre.trim(),
        comentario: comentario.trim(),
        fotoUrl: fotoUrl.trim(),
        canal,
        fechaCierre: now,
        createdAt: now,
      })
      .returning();

    // 5. Actualizar estado de la tarea a "completada"
    const [tareaActualizada] = await db
      .update(tareasTable)
      .set({ estado: "completada", updatedAt: now })
      .where(eq(tareasTable.id, id))
      .returning();

    logger.info({
      tareaId: id,
      supervisorNombre,
      canal,
      evidenciaId: evidencia.id,
    }, "Tarea cerrada con evidencia");

    // 6. Sincronizar estado de área en SSA vinculada (si aplica)
    // Cuando una tarea de Operaciones, RRHH o Comercial se cierra,
    // el área correspondiente en el SSA debe reflejar el nuevo estado.
    try {
      const { rows: ssaLink } = await pool.query<{
        id: number;
        tarea_operaciones_id: string | null;
        tarea_rrhh_id: string | null;
        tarea_comercial_id: string | null;
        estado_general: string;
        estado_operaciones: string;
        estado_rrhh: string;
        estado_comercial: string;
      }>(
        `SELECT id, tarea_operaciones_id, tarea_rrhh_id, tarea_comercial_id,
                estado_general, estado_operaciones, estado_rrhh, estado_comercial
         FROM solicitudes_servicio_adicional
         WHERE tarea_operaciones_id = $1
            OR tarea_rrhh_id       = $1
            OR tarea_comercial_id  = $1
         LIMIT 1`,
        [id],
      );

      if (ssaLink.length > 0) {
        const s = ssaLink[0];
        let newOps       = s.estado_operaciones;
        let newRrhh      = s.estado_rrhh;
        let newComercial = s.estado_comercial;
        let newFacturacion: string | null = null;

        const combinada =
          s.tarea_operaciones_id === id &&
          s.tarea_rrhh_id === id &&
          s.tarea_comercial_id === id;
        if (combinada) {
          // Tarea única con checklist: cerrarla completa las 3 áreas
          newOps         = "cubierta";
          newRrhh        = "viable";
          newComercial   = "facturado";
          newFacturacion = "facturado";
        } else if (s.tarea_operaciones_id === id) {
          newOps = "cubierta";
        } else if (s.tarea_rrhh_id === id) {
          newRrhh = "viable";
        } else if (s.tarea_comercial_id === id) {
          newComercial   = "facturado";
          newFacturacion = "facturado";
        }

        const nuevoEstadoGeneral = calcEstadoGeneralSSA(newOps, newRrhh, newComercial, s.estado_general);

        await pool.query(
          `UPDATE solicitudes_servicio_adicional
           SET estado_operaciones = $1,
               estado_rrhh        = $2,
               estado_comercial   = $3,
               estado_facturacion = CASE WHEN $5::TEXT IS NOT NULL THEN $5 ELSE estado_facturacion END,
               estado_general     = $4,
               updated_at         = NOW()
           WHERE id = $6`,
          [newOps, newRrhh, newComercial, nuevoEstadoGeneral, newFacturacion, s.id],
        );

        logger.info(
          { tareaId: id, ssaId: s.id, nuevoEstadoGeneral },
          "SSA: estado de área sincronizado tras cierre de tarea",
        );
      }
    } catch (syncErr) {
      // No bloqueante — la tarea ya quedó completada
      logger.error({ syncErr, tareaId: id }, "SSA sync tras cierre de tarea — error (no bloqueante)");
    }

    res.status(201).json({
      tarea: tareaActualizada,
      evidencia,
    });
  } catch (err) {
    logger.error({ err }, "POST /api/tareas/:id/cerrar error");
    res.status(500).json({ error: "Error al cerrar la tarea" });
  }
});

// ─── DELETE /api/tareas/:id ───────────────────────────────────────────────────
router.delete("/tareas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(tareasTable).where(eq(tareasTable.id, id));
    if (!existing) return res.status(404).json({ error: "Tarea no encontrada" });

    await db
      .update(tareasTable)
      .set({ estado: "cancelada", updatedAt: new Date() })
      .where(eq(tareasTable.id, id));

    res.json({ ok: true, mensaje: "Tarea cancelada" });
  } catch (err) {
    logger.error({ err }, "DELETE /api/tareas/:id error");
    res.status(500).json({ error: "Error al cancelar tarea" });
  }
});

export default router;
