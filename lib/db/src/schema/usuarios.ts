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
