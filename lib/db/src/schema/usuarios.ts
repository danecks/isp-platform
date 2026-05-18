import { pgTable, serial, integer, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
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
