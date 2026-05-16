import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// WA_CONFIG — configuración general del asistente de WhatsApp (clave-valor).
// ─────────────────────────────────────────────────────────────────────────────
export const waConfigTable = pgTable("wa_config", {
  id: serial("id").primaryKey(),
  clave: varchar("clave", { length: 100 }).notNull().unique(),
  valor: text("valor").notNull(),
  tipo: varchar("tipo", { length: 50 }).notNull().default("texto"),
  descripcion: varchar("descripcion", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_MESSAGES — mensajes automáticos configurables del bot.
// ─────────────────────────────────────────────────────────────────────────────
export const waMessagesTable = pgTable("wa_messages", {
  id: serial("id").primaryKey(),
  clave: varchar("clave", { length: 100 }).notNull().unique(),
  texto: text("texto").notNull(),
  descripcion: varchar("descripcion", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_MENU_OPTIONS — opciones de menú del bot por rol.
// ─────────────────────────────────────────────────────────────────────────────
export const waMenuOptionsTable = pgTable("wa_menu_options", {
  id: serial("id").primaryKey(),
  rol: varchar("rol", { length: 50 }).notNull(),
  texto: varchar("texto", { length: 255 }).notNull(),
  accion: varchar("accion", { length: 100 }).notNull(),
  activo: boolean("activo").notNull().default(true),
  orden: integer("orden").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_AUDIT_LOG — auditoría de cambios en configuración.
// ─────────────────────────────────────────────────────────────────────────────
export const waAuditLogTable = pgTable("wa_audit_log", {
  id: serial("id").primaryKey(),
  modulo: varchar("modulo", { length: 50 }).notNull(),
  clave: varchar("clave", { length: 100 }).notNull(),
  valorAnterior: text("valor_anterior"),
  valorNuevo: text("valor_nuevo").notNull(),
  usuario: varchar("usuario", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_SIMULATOR_SCENARIOS — escenarios rápidos del simulador de WhatsApp.
// Cada fila representa un botón en la barra de "Escenarios rápidos" del
// simulador admin. Permite a los responsables del bot agregar / editar /
// ocultar pruebas sin pasar por el equipo de desarrollo.
// ─────────────────────────────────────────────────────────────────────────────
export const waSimulatorScenariosTable = pgTable("wa_simulator_scenarios", {
  id: serial("id").primaryKey(),
  grupo: varchar("grupo", { length: 20 }).notNull(), // 'interno' | 'externo' | 'dpi'
  label: varchar("label", { length: 120 }).notNull(),
  icono: varchar("icono", { length: 16 }).notNull().default(""),
  mensaje: text("mensaje").notNull(),
  color: varchar("color", { length: 200 }).notNull().default(""),
  skipValidacion: boolean("skip_validacion").notNull().default(false),
  activo: boolean("activo").notNull().default(true),
  orden: integer("orden").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WaConfig = typeof waConfigTable.$inferSelect;
export type WaMessage = typeof waMessagesTable.$inferSelect;
export type WaMenuOption = typeof waMenuOptionsTable.$inferSelect;
export type WaAuditLog = typeof waAuditLogTable.$inferSelect;
export type WaSimulatorScenario = typeof waSimulatorScenariosTable.$inferSelect;
