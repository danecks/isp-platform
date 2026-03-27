/**
 * SERVICIO DE NOTIFICACIONES WHATSAPP — ISP, S.A.
 *
 * Envía mensajes automáticos por WhatsApp cuando se producen eventos
 * relevantes en el sistema (ej: tarea asignada, emergencia, etc).
 *
 * ─── MODO ACTUAL (sin API real) ───────────────────────────────────────────
 *   Las notificaciones se SIMULAN: se genera el mensaje, se registra en
 *   la tabla wa_notificaciones_log con estado="simulado" y se loguea en
 *   consola. No se envía nada por red.
 *
 * ─── PARA CONECTAR WHATSAPP REAL ──────────────────────────────────────────
 *   1. Implementar `sendWhatsAppMessage(phone, message)` en este archivo.
 *      Opciones: Meta Cloud API, Twilio, 360Dialog, etc.
 *   2. Cambiar el estado del log de "simulado" a "enviado" o "error".
 *   3. Las llamadas en tareas.ts no necesitan modificarse.
 *
 * ─── CUÁNDO SE DISPARA ────────────────────────────────────────────────────
 *   - POST /api/tareas → si hay asignadoId, se notifica al crearse
 *   - PATCH /api/tareas/:id → si asignadoId CAMBIÓ, se notifica
 *   No se envía si:
 *     · El usuario está inactivo
 *     · El usuario no tiene teléfono registrado
 *     · El asignadoId no cambió (PATCH sin cambio de responsable)
 *
 * ─── VARIABLES DEL MENSAJE tarea_nueva_asignada ───────────────────────────
 *   {titulo}    — título de la tarea
 *   {id}        — identificador de la tarea (ej: TASK-240315-1234)
 *   {prioridad} — alta | media | baja
 *   {cliente}   — incidenciaId si existe, o "Sin cliente/puesto asociado"
 */

import { pool, db, waNotificacionesLogTable } from "@workspace/db";
import { getWaMessage } from "./wa-config.service";
import { logger } from "../../lib/logger";

// ─── Tipo interno ─────────────────────────────────────────────────────────────

interface TareaInfo {
  id: string;
  titulo: string;
  prioridad: string;
  incidenciaId?: string | null;
  asignado?: string | null;
}

// ─── Envío real (stub preparado para producción) ──────────────────────────────

/**
 * sendWhatsAppMessage — envía un mensaje real por WhatsApp.
 *
 * ACTUALMENTE: solo simula (modo desarrollo).
 * Para producción: implementar llamada a la API elegida y retornar
 * { ok: true } o lanzar un error.
 */
async function sendWhatsAppMessage(
  _phone: string,
  _message: string
): Promise<{ ok: boolean; messageId?: string }> {
  // ── STUB ──────────────────────────────────────────────────────────────────
  // TODO: reemplazar con llamada real, ej:
  //
  // const res = await fetch("https://graph.facebook.com/v19.0/PHONE_ID/messages", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     "Authorization": `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
  //   },
  //   body: JSON.stringify({
  //     messaging_product: "whatsapp",
  //     to: phone,
  //     type: "text",
  //     text: { body: message },
  //   }),
  // });
  // if (!res.ok) throw new Error(`WhatsApp API error: ${res.status}`);
  // const data = await res.json();
  // return { ok: true, messageId: data.messages?.[0]?.id };
  //
  // ──────────────────────────────────────────────────────────────────────────
  return { ok: true }; // simulado
}

// ─── Función principal exportada ──────────────────────────────────────────────

/**
 * notifyTareaAsignada — notifica al responsable de una tarea recién asignada.
 *
 * @param tarea    Información de la tarea
 * @param usuarioId  ID del usuario asignado (users.id)
 *
 * Reglas:
 *   - No notifica si el usuario no existe, está inactivo o no tiene teléfono.
 *   - El mensaje se toma de wa_messages con clave "tarea_nueva_asignada".
 *   - Siempre registra el intento en wa_notificaciones_log.
 *   - Nunca lanza excepción hacia el llamador — el fallo se loguea.
 */
export async function notifyTareaAsignada(
  tarea: TareaInfo,
  usuarioId: number
): Promise<void> {
  try {
    // 1. Obtener datos del usuario asignado
    const { rows } = await pool.query<{
      id: number;
      nombre: string;
      telefono: string | null;
      estado: string;
    }>(
      `SELECT id, nombre, telefono, estado FROM users WHERE id = $1 LIMIT 1`,
      [usuarioId]
    );

    const usuario = rows[0];

    if (!usuario) {
      logger.warn({ usuarioId }, "notifyTareaAsignada: usuario no encontrado, omitiendo notificación");
      return;
    }

    if (usuario.estado !== "activo") {
      logger.info(
        { usuarioId, nombre: usuario.nombre, estado: usuario.estado },
        "notifyTareaAsignada: usuario inactivo, omitiendo notificación"
      );
      await registrarLog({
        tareaId: tarea.id,
        usuarioId,
        telefono: usuario.telefono ?? null,
        mensaje: null,
        evento: "tarea_asignada",
        estado: "omitido",
        errorMsg: "Usuario inactivo",
      });
      return;
    }

    if (!usuario.telefono) {
      logger.info(
        { usuarioId, nombre: usuario.nombre },
        "notifyTareaAsignada: usuario sin teléfono WhatsApp, omitiendo"
      );
      await registrarLog({
        tareaId: tarea.id,
        usuarioId,
        telefono: null,
        mensaje: null,
        evento: "tarea_asignada",
        estado: "omitido",
        errorMsg: "Sin número de teléfono",
      });
      return;
    }

    // 2. Construir el mensaje desde la plantilla configurable
    const plantilla = await getWaMessage(
      "tarea_nueva_asignada",
      "📌 Tienes una nueva tarea asignada en ISP, S.A.\n🧾 Tarea: {titulo}\n🔑 ID: {id}\n⚠ Prioridad: {prioridad}\n📍 Referencia: {cliente}\nPor favor ingresa al sistema o responde para continuar."
    );

    const mensaje = plantilla
      .replace("{titulo}", tarea.titulo)
      .replace("{id}", tarea.id)
      .replace("{prioridad}", tarea.prioridad)
      .replace("{cliente}", tarea.incidenciaId ?? "Sin referencia asociada");

    // 3. Intentar envío (simulado o real según implementación)
    logger.info(
      {
        tareaId: tarea.id,
        usuarioId,
        telefono: usuario.telefono,
        nombre: usuario.nombre,
      },
      "notifyTareaAsignada: enviando notificación WA (simulado)"
    );

    let estado: string = "simulado";
    let errorMsg: string | null = null;

    try {
      const result = await sendWhatsAppMessage(usuario.telefono, mensaje);
      estado = result.ok ? "simulado" : "error";
    } catch (sendErr: unknown) {
      estado = "error";
      errorMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      logger.error({ sendErr, tareaId: tarea.id }, "notifyTareaAsignada: error en envío WA");
    }

    // 4. Registrar en log
    await registrarLog({
      tareaId: tarea.id,
      usuarioId,
      telefono: usuario.telefono,
      mensaje,
      evento: "tarea_asignada",
      estado,
      errorMsg,
    });

    logger.info(
      { tareaId: tarea.id, estado, telefono: usuario.telefono },
      "notifyTareaAsignada: notificación registrada"
    );
  } catch (err) {
    // No propagar error al llamador para no romper la creación/actualización de tarea
    logger.error({ err, tareaId: tarea.id }, "notifyTareaAsignada: error inesperado");
  }
}

// ─── Helper de log ────────────────────────────────────────────────────────────

interface LogEntry {
  tareaId: string;
  usuarioId: number;
  telefono: string | null;
  mensaje: string | null;
  evento: string;
  estado: string;
  errorMsg: string | null;
}

async function registrarLog(entry: LogEntry): Promise<void> {
  try {
    await db.insert(waNotificacionesLogTable).values({
      tareaId: entry.tareaId,
      usuarioId: entry.usuarioId,
      telefono: entry.telefono,
      mensaje: entry.mensaje,
      evento: entry.evento,
      estado: entry.estado,
      errorMsg: entry.errorMsg,
    });
  } catch (err) {
    logger.error({ err }, "notifyTareaAsignada: error guardando log");
  }
}
