import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const incidentsTable = pgTable("incidents", {
  id: varchar("id", { length: 20 }).primaryKey(),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  origen: varchar("origen", { length: 50 }).notNull().default("manual"),
  cliente: varchar("cliente", { length: 255 }).notNull(),
  ubicacion: varchar("ubicacion", { length: 255 }),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  prioridad: varchar("prioridad", { length: 20 }).notNull().default("media"),
  estado: varchar("estado", { length: 50 }).notNull().default("abierta"),
  responsable: varchar("responsable", { length: 255 }).default("Sin asignar"),
  tareaAsociada: varchar("tarea_asociada", { length: 50 }),
  descripcion: text("descripcion"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ createdAt: true, updatedAt: true });

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Application = typeof applicationsTable.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
