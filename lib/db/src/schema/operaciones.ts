import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENTS — incidencias operativas de seguridad
//
// Campo clienteRefId (nullable): vincula la incidencia al clienteId del
// usuario del portal (users.clienteId). Permite filtrado en el portal de
// clientes sin afectar el flujo del admin que usa el campo `cliente` (nombre).
// ─────────────────────────────────────────────────────────────────────────────
export const incidentsTable = pgTable("incidents", {
  id: varchar("id", { length: 20 }).primaryKey(),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  origen: varchar("origen", { length: 50 }).notNull().default("manual"),
  cliente: varchar("cliente", { length: 255 }).notNull(),
  clienteRefId: varchar("cliente_ref_id", { length: 100 }),
  // C-05: FK real al registro en clients (INTEGER).
  clientId: integer("client_id"),
  ubicacion: varchar("ubicacion", { length: 255 }),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  prioridad: varchar("prioridad", { length: 20 }).notNull().default("media"),
  estado: varchar("estado", { length: 50 }).notNull().default("abierta"),
  responsable: varchar("responsable", { length: 255 }).default("Sin asignar"),
  tareaAsociada: varchar("tarea_asociada", { length: 50 }),
  descripcion: text("descripcion"),
  // ── Emergencias ─────────────────────────────────────────────────────────
  esEmergencia: boolean("es_emergencia").notNull().default(false),
  reportadoPor: varchar("reportado_por", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENT ASSIGNMENTS — asignación de agentes/empleados a cuentas de cliente
// ─────────────────────────────────────────────────────────────────────────────
export const agentAssignmentsTable = pgTable("agent_assignments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),      // → employees.id
  clienteId: varchar("cliente_id", { length: 100 }).notNull(), // → users.clienteId
  puesto: varchar("puesto", { length: 255 }),
  servicio: varchar("servicio", { length: 100 }),
  ubicacion: varchar("ubicacion", { length: 255 }),
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }),
  codigoAsignacion: varchar("codigo_asignacion", { length: 50 }),
  fechaInicio: timestamp("fecha_inicio", { withTimezone: true }).notNull().defaultNow(),
  fechaFin: timestamp("fecha_fin", { withTimezone: true }),
  estado: varchar("estado", { length: 50 }).notNull().default("activo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TAREAS — tareas operativas (con cierre por evidencia)
// ─────────────────────────────────────────────────────────────────────────────
export const tareasTable = pgTable("tareas", {
  id: varchar("id", { length: 20 }).primaryKey(),
  titulo: varchar("titulo", { length: 500 }).notNull(),
  descripcion: text("descripcion"),
  incidenciaId: varchar("incidencia_id", { length: 20 }),
  prioridad: varchar("prioridad", { length: 20 }).notNull().default("media"),
  estado: varchar("estado", { length: 50 }).notNull().default("pendiente"),
  asignado: varchar("asignado", { length: 255 }),
  asignadoId: integer("asignado_id"),
  trelloCardId: varchar("trello_card_id", { length: 100 }),
  trelloCardUrl: varchar("trello_card_url", { length: 500 }),
  fechaVencimiento: timestamp("fecha_vencimiento", { withTimezone: true }),
  canal: varchar("canal", { length: 50 }).notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK_EVIDENCIAS — evidencia de cierre con foto y comentario (1:1 con tarea)
// ─────────────────────────────────────────────────────────────────────────────
export const taskEvidenciasTable = pgTable("task_evidencias", {
  id: serial("id").primaryKey(),
  tareaId: varchar("tarea_id", { length: 20 }).notNull(),
  supervisorId: integer("supervisor_id"),
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }).notNull(),
  comentario: text("comentario").notNull(),
  fotoUrl: text("foto_url").notNull(),
  canal: varchar("canal", { length: 50 }).notNull().default("admin"),
  fechaCierre: timestamp("fecha_cierre", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_NOTIFICACIONES_LOG — registro de notificaciones WhatsApp enviadas
// ─────────────────────────────────────────────────────────────────────────────
export const waNotificacionesLogTable = pgTable("wa_notificaciones_log", {
  id: serial("id").primaryKey(),
  tareaId: varchar("tarea_id", { length: 20 }),
  usuarioId: integer("usuario_id"),
  telefono: varchar("telefono", { length: 20 }),
  mensaje: text("mensaje"),
  evento: varchar("evento", { length: 80 }).notNull().default("tarea_asignada"),
  estado: varchar("estado", { length: 20 }).notNull().default("simulado"),
  errorMsg: text("error_msg"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Zod insert schemas ──────────────────────────────────────────────────────
export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ createdAt: true, updatedAt: true });
export const insertAgentAssignmentSchema = createInsertSchema(agentAssignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTareaSchema = createInsertSchema(tareasTable).omit({ createdAt: true, updatedAt: true });
export const insertTaskEvidenciaSchema = createInsertSchema(taskEvidenciasTable).omit({ id: true, createdAt: true });

// ── Types ───────────────────────────────────────────────────────────────────
export type Incident = typeof incidentsTable.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type AgentAssignment = typeof agentAssignmentsTable.$inferSelect;
export type InsertAgentAssignment = z.infer<typeof insertAgentAssignmentSchema>;
export type Tarea = typeof tareasTable.$inferSelect;
export type InsertTarea = z.infer<typeof insertTareaSchema>;
export type TaskEvidencia = typeof taskEvidenciasTable.$inferSelect;
export type InsertTaskEvidencia = z.infer<typeof insertTaskEvidenciaSchema>;
export type WaNotificacionLog = typeof waNotificacionesLogTable.$inferSelect;
