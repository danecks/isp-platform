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

// ─────────────────────────────────────────────────────────────────────────────
// WA_ANTICIPO_SESSIONS — sesiones multi-turno del flujo de anticipo del bot.
// Persistidas en DB para sobrevivir reinicios y permitir escalado horizontal.
// La columna `telefono` (normalizado) es la PK natural; `expires_at` se usa
// para invalidar/limpiar sesiones inactivas (TTL).
// ─────────────────────────────────────────────────────────────────────────────
export const waAnticipoSessionsTable = pgTable("wa_anticipo_sessions", {
  telefono: varchar("telefono", { length: 32 }).primaryKey(),
  state: varchar("state", { length: 32 }).notNull(),
  employeeId: integer("employee_id").notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  puesto: varchar("puesto", { length: 255 }),
  dpi: varchar("dpi", { length: 32 }),
  periodo: varchar("periodo", { length: 32 }).notNull(),
  limiteRestante: integer("limite_restante"),
  limiteTotal: integer("limite_total"),
  montoSolicitado: integer("monto_solicitado"),
  lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_PHONE_REG_SESSIONS — sesiones del flujo de registro de teléfono por DPI.
// Mismo patrón que wa_anticipo_sessions: PK por teléfono normalizado y TTL.
// ─────────────────────────────────────────────────────────────────────────────
export const waPhoneRegSessionsTable = pgTable("wa_phone_reg_sessions", {
  telefono: varchar("telefono", { length: 32 }).primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  state: varchar("state", { length: 32 }).notNull(),
  intentos: integer("intentos").notNull().default(0),
  empleadoId: integer("empleado_id"),
  empleadoNombre: varchar("empleado_nombre", { length: 255 }),
  userId: integer("user_id"),
  dpiValidado: varchar("dpi_validado", { length: 32 }),
  telefonoAnterior: varchar("telefono_anterior", { length: 32 }),
  intencionOriginal: varchar("intencion_original", { length: 64 }).notNull(),
  lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type WaConfig = typeof waConfigTable.$inferSelect;
export type WaMessage = typeof waMessagesTable.$inferSelect;
export type WaMenuOption = typeof waMenuOptionsTable.$inferSelect;
export type WaAuditLog = typeof waAuditLogTable.$inferSelect;
export type WaSimulatorScenario = typeof waSimulatorScenariosTable.$inferSelect;
