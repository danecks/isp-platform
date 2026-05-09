import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// LEADS — oportunidades comerciales entrantes
// ─────────────────────────────────────────────────────────────────────────────
export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  empresa: varchar("empresa", { length: 255 }).notNull(),
  contacto: varchar("contacto", { length: 255 }).notNull(),
  telefono: varchar("telefono", { length: 50 }),
  correo: varchar("correo", { length: 255 }),
  servicio: varchar("servicio", { length: 255 }).notNull(),
  ubicacion: varchar("ubicacion", { length: 255 }),
  canal: varchar("canal", { length: 50 }).notNull().default("web"),
  estado: varchar("estado", { length: 50 }).notNull().default("nuevo"),
  ejecutivo: varchar("ejecutivo", { length: 255 }).default("Sin asignar"),
  notas: text("notas"),
  tareaAsociada: varchar("tarea_asociada", { length: 255 }),  // URL tarjeta Trello
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATIONS — postulaciones de reclutamiento externo
// ─────────────────────────────────────────────────────────────────────────────
export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  telefono: varchar("telefono", { length: 50 }).notNull(),
  correo: varchar("correo", { length: 255 }),
  experiencia: varchar("experiencia", { length: 100 }),
  ubicacion: varchar("ubicacion", { length: 255 }),
  puesto: varchar("puesto", { length: 255 }).default("Agente de Seguridad"),
  canal: varchar("canal", { length: 50 }).notNull().default("web"),
  estado: varchar("estado", { length: 50 }).notNull().default("recibido"),
  notas: text("notas"),
  tareaAsociada: varchar("tarea_asociada", { length: 255 }),  // URL tarjeta Trello
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Zod insert schemas ──────────────────────────────────────────────────────
export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, createdAt: true, updatedAt: true });

// ── Types ───────────────────────────────────────────────────────────────────
export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Application = typeof applicationsTable.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
