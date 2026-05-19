import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// USERS — cuentas de acceso al sistema (admin + portal clientes)
// ─────────────────────────────────────────────────────────────────────────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  correo: varchar("correo", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  rol: varchar("rol", { length: 50 }).notNull().default("operaciones"),
  estado: varchar("estado", { length: 20 }).notNull().default("activo"),
  telefono: varchar("telefono", { length: 50 }),
  clienteId: varchar("cliente_id", { length: 100 }),
  employeeId: integer("employee_id"),
  // Permisos explícitos (null = derivado del rol)
  canReportEmergency: boolean("can_report_emergency"),
  canRequestAdvance: boolean("can_request_advance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PUSH_TOKENS — tokens FCM/APNs asociados a un usuario para notificaciones push.
//
// Cada dispositivo (APK Android, en el futuro iOS) genera un token único en el
// arranque y lo registra contra el usuario logueado. Cuando ocurren eventos
// (emergencias, asignaciones, aprobaciones), el api-server consulta esta tabla
// para saber a qué dispositivos enviar la notificación.
//
// - token: identificador único entregado por el servicio (FCM en Android).
// - userId: cuenta a la que está asociado. Si el mismo dispositivo cambia de
//   usuario (logout + login), el token se reasigna (ON CONFLICT update).
// - platform: "android" | "ios" | "web" (este último reservado para futuro
//   soporte de Web Push).
// - lastSeenAt: refresca cada vez que el cliente vuelve a registrar el token.
//   Se usa para podar tokens viejos (>90 días sin actividad) y para detectar
//   cuentas inactivas.
// ─────────────────────────────────────────────────────────────────────────────
export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 512 }).notNull().unique(),
  userId: integer("user_id").notNull(),
  platform: varchar("platform", { length: 20 }).notNull().default("android"),
  appVersion: varchar("app_version", { length: 50 }),
  deviceModel: varchar("device_model", { length: 100 }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({ id: true, createdAt: true, lastSeenAt: true });

export type PushToken = typeof pushTokensTable.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PUSH_ENVIOS — historial de notificaciones push enviadas (auditoría).
//
// Cada vez que el api-server intenta enviar una push (vía sendPushToTokens),
// se inserta una fila por token destino con el resultado de FCM. Permite al
// admin diagnosticar "¿se envió la push de la emergencia X?" desde el panel,
// sin necesidad de abrir los logs del servidor.
//
// - userId: cuenta destinataria (null si el token no se pudo mapear).
// - tokenPreview: token enmascarado (primeros 12 + últimos 6 chars) para no
//   exponer el token completo en el panel.
// - evento: clasificación del envío ("test", "emergencia", "anticipo", etc.).
// - estado: "ok" | "error" | "simulated" (modo stub sin credenciales).
// - errorCode / errorMessage: detalle del error de FCM cuando estado="error".
// - messageId: id devuelto por FCM cuando estado="ok".
// - data: payload data adjunto (JSON serializado) por si hay que reproducirlo.
// ─────────────────────────────────────────────────────────────────────────────
export const pushEnviosTable = pgTable("push_envios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  tokenPreview: varchar("token_preview", { length: 64 }),
  title: varchar("title", { length: 200 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  evento: varchar("evento", { length: 50 }).notNull().default("manual"),
  estado: varchar("estado", { length: 20 }).notNull(),
  errorCode: varchar("error_code", { length: 100 }),
  errorMessage: text("error_message"),
  messageId: varchar("message_id", { length: 255 }),
  data: text("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPushEnvioSchema = createInsertSchema(pushEnviosTable).omit({ id: true, createdAt: true });

export type PushEnvio = typeof pushEnviosTable.$inferSelect;
export type InsertPushEnvio = z.infer<typeof insertPushEnvioSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE_REPORTS — qué versión nativa (APK) y bundle OTA corre cada dispositivo.
//
// Cada cliente (APK o navegador) genera un `deviceId` aleatorio que persiste en
// almacenamiento local y lo reporta al backend al hacer login y luego de cada
// chequeo OTA. Permite al panel admin ver de un vistazo qué celulares se
// quedaron en una versión vieja y a qué usuario contactar.
//
// Esta tabla NO reemplaza a push_tokens — un dispositivo puede no tener token
// FCM (Firebase no configurado, permiso denegado, navegador) pero igual
// queremos saber su versión.
// ─────────────────────────────────────────────────────────────────────────────
export const deviceReportsTable = pgTable("device_reports", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 100 }).notNull().unique(),
  userId: integer("user_id"),
  platform: varchar("platform", { length: 20 }).notNull().default("web"),
  nativeVersion: varchar("native_version", { length: 50 }),
  bundleVersion: varchar("bundle_version", { length: 50 }),
  bundleId: varchar("bundle_id", { length: 100 }),
  deviceModel: varchar("device_model", { length: 100 }),
  lastOtaCheckAt: timestamp("last_ota_check_at", { withTimezone: true }),
  lastOtaStatus: varchar("last_ota_status", { length: 50 }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeviceReport = typeof deviceReportsTable.$inferSelect;
