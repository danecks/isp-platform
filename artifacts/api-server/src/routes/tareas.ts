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
import { db, tareasTable, taskEvidenciasTable, waNotificacionesLogTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { notifyTareaAsignada } from "../services/whatsapp/notificaciones.service";

const router = Router();

const ROLES_CON_PERMISO_CIERRE = ["supervisor", "admin"];

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

    // Buscar evidencias para todas las completadas
    const completadasIds = tareas
      .filter((t) => t.estado === "completada")
      .map((t) => t.id);

    let evidenciasMap: Record<string, typeof taskEvidenciasTable.$inferSelect> = {};

    if (completadasIds.length > 0) {
      // Query simple: traer todas las evidencias de las tareas completadas
      const evidencias = await db
        .select()
        .from(taskEvidenciasTable)
        .orderBy(desc(taskEvidenciasTable.fechaCierre));

      for (const ev of evidencias) {
        if (!evidenciasMap[ev.tareaId]) {
          evidenciasMap[ev.tareaId] = ev;
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
      trelloCardId,
      trelloCardUrl,
      fechaVencimiento,
      canal = "manual",
    } = req.body;

    if (!titulo?.trim()) {
      return res.status(400).json({ error: "El título es obligatorio" });
    }

    const id = genTareaId();
    const now = new Date();

    const [tarea] = await db
      .insert(tareasTable)
      .values({
        id,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        incidenciaId: incidenciaId?.trim() || null,
        prioridad,
        estado,
        asignado: asignado?.trim() || null,
        asignadoId: asignadoId ? parseInt(asignadoId) : null,
        trelloCardId: trelloCardId?.trim() || null,
        trelloCardUrl: trelloCardUrl?.trim() || null,
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
                     "asignadoId", "trelloCardId", "trelloCardUrl", "fechaVencimiento"] as const;

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

    // No permitir cambio a "completada" sin evidencia
    if (patch.estado === "completada") {
      const ev = await db
        .select({ id: taskEvidenciasTable.id })
        .from(taskEvidenciasTable)
        .where(eq(taskEvidenciasTable.tareaId, id))
        .limit(1);
      if (ev.length === 0) {
        return res.status(400).json({
          error: "Para completar una tarea se requiere evidencia. Use POST /api/tareas/:id/cerrar",
        });
      }
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
 *
 * INTEGRACIÓN TRELLO (futura):
 *   Al cerrar exitosamente, si tarea.trelloCardId existe, llamar a
 *   Trello API para mover la tarjeta a la lista "Resuelto" / "Done".
 *   Endpoint Trello: PUT /1/cards/{cardId} con { idList: LIST_ID_RESUELTO }
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

    // 1. Validar rol
    if (!ROLES_CON_PERMISO_CIERRE.includes(rolSupervisor)) {
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

    // TODO (Trello):
    // if (tarea.trelloCardId && process.env.TRELLO_API_KEY) {
    //   await moverTarjetaTrelloAResuelto(tarea.trelloCardId);
    // }

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
