/**
 * WA CONFIG SERVICE — ISP, S.A.
 *
 * Servicio que lee la configuración del bot de WhatsApp desde la base de datos
 * en lugar de valores hardcodeados. Implementa caché en memoria con TTL de 5 min.
 *
 * USO:
 *   import { getWaMessage, getWaConfig, setWaMessage, setWaConfig } from "./wa-config.service";
 *   const msg = await getWaMessage("anticipo_fuera_fecha", "No disponible en estas fechas.");
 *
 * CLAVES DE CONFIGURACIÓN GENERAL (wa_config):
 *   nombre_asistente     — nombre del bot
 *   estado_bot           — activo | mantenimiento | solo_lectura
 *   mensaje_bienvenida   — texto de bienvenida
 *   mensaje_fuera_horario — texto fuera de horario
 *   mensaje_error        — texto de error genérico
 *   horario_inicio       — "HH:MM" (24h)
 *   horario_fin          — "HH:MM" (24h)
 *
 * CLAVES DE MENSAJES (wa_messages):
 *   usuario_no_registrado | anticipo_fuera_fecha | anticipo_duplicado
 *   incidencia_registrada | emergencia_recibida | lead_registrado
 *   postulacion_registrada | sin_coincidencia
 */

import { db } from "@workspace/db";
import {
  waConfigTable,
  waMessagesTable,
  waMenuOptionsTable,
  waAuditLogTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Cache ────────────────────────────────────────────────────────────────────
const TTL_MS = 5 * 60 * 1000; // 5 minutos

let _configCache: Record<string, string> | null = null;
let _configTs = 0;

let _messagesCache: Record<string, string> | null = null;
let _messagesTs = 0;

export function invalidateCache(): void {
  _configCache = null;
  _messagesCache = null;
}

// ─── Lectura de config general ────────────────────────────────────────────────

export async function getAllConfigRows() {
  const rows = await db.select().from(waConfigTable).orderBy(waConfigTable.clave);
  return rows;
}

export async function getWaConfig(clave: string, fallback = ""): Promise<string> {
  const now = Date.now();
  if (!_configCache || now - _configTs > TTL_MS) {
    const rows = await db.select().from(waConfigTable);
    _configCache = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
    _configTs = now;
  }
  return _configCache[clave] ?? fallback;
}

// ─── Lectura de mensajes ──────────────────────────────────────────────────────

export async function getAllMessageRows() {
  const rows = await db.select().from(waMessagesTable).orderBy(waMessagesTable.clave);
  return rows;
}

export async function getWaMessage(clave: string, fallback = ""): Promise<string> {
  const now = Date.now();
  if (!_messagesCache || now - _messagesTs > TTL_MS) {
    const rows = await db.select().from(waMessagesTable);
    _messagesCache = Object.fromEntries(rows.map((r) => [r.clave, r.texto]));
    _messagesTs = now;
  }
  return _messagesCache[clave] ?? fallback;
}

// ─── Lectura de menús ─────────────────────────────────────────────────────────

export async function getMenuOptions(rol?: string) {
  const rows = await db
    .select()
    .from(waMenuOptionsTable)
    .orderBy(waMenuOptionsTable.rol, waMenuOptionsTable.orden);
  if (rol) return rows.filter((r) => r.rol === rol && r.activo);
  return rows;
}

// ─── Escritura de config + auditoría ─────────────────────────────────────────

export async function setWaConfig(
  clave: string,
  valor: string,
  usuario?: string
): Promise<void> {
  const existing = await db
    .select()
    .from(waConfigTable)
    .where(eq(waConfigTable.clave, clave));

  const valorAnterior = existing[0]?.valor ?? null;

  await db
    .update(waConfigTable)
    .set({ valor, updatedAt: new Date() })
    .where(eq(waConfigTable.clave, clave));

  await db.insert(waAuditLogTable).values({
    modulo: "wa_config",
    clave,
    valorAnterior,
    valorNuevo: valor,
    usuario: usuario ?? "sistema",
  });

  invalidateCache();
}

export async function setWaMessage(
  clave: string,
  texto: string,
  usuario?: string
): Promise<void> {
  const existing = await db
    .select()
    .from(waMessagesTable)
    .where(eq(waMessagesTable.clave, clave));

  const valorAnterior = existing[0]?.texto ?? null;

  await db
    .update(waMessagesTable)
    .set({ texto, updatedAt: new Date() })
    .where(eq(waMessagesTable.clave, clave));

  await db.insert(waAuditLogTable).values({
    modulo: "wa_messages",
    clave,
    valorAnterior,
    valorNuevo: texto,
    usuario: usuario ?? "sistema",
  });

  invalidateCache();
}

export async function setWaMenuOption(
  id: number,
  updates: { activo?: boolean; texto?: string; orden?: number },
  clave: string,
  usuario?: string
): Promise<void> {
  const existing = await db
    .select()
    .from(waMenuOptionsTable)
    .where(eq(waMenuOptionsTable.id, id));

  const valorAnterior = existing[0] ? JSON.stringify(existing[0]) : null;

  await db
    .update(waMenuOptionsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(waMenuOptionsTable.id, id));

  await db.insert(waAuditLogTable).values({
    modulo: "wa_menu_options",
    clave,
    valorAnterior,
    valorNuevo: JSON.stringify(updates),
    usuario: usuario ?? "sistema",
  });
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

export async function getAuditLog(limit = 50) {
  const rows = await db
    .select()
    .from(waAuditLogTable)
    .orderBy(waAuditLogTable.createdAt)
    .limit(limit);
  return rows.reverse(); // más reciente primero
}
