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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  // Referencia al clienteId del portal (nullable, no rompe filas existentes)
  clienteRefId: varchar("cliente_ref_id", { length: 100 }),
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

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEES — colaboradores/empleados de ISP, S.A.
// Ver services/hr-sync/HR-SYNC-README.md para futura integración con RH.
// ─────────────────────────────────────────────────────────────────────────────
export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  externalId: varchar("external_id", { length: 100 }),
  sourceSystem: varchar("source_system", { length: 50 }).notNull().default("manual"),
  syncStatus: varchar("sync_status", { length: 20 }).notNull().default("manual"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  nombreCompleto: varchar("nombre_completo", { length: 255 }).notNull(),
  dpi: varchar("dpi", { length: 20 }),
  telefono: varchar("telefono", { length: 50 }),
  correo: varchar("correo", { length: 255 }),
  puesto: varchar("puesto", { length: 255 }),
  area: varchar("area", { length: 100 }),
  estadoLaboral: varchar("estado_laboral", { length: 50 }).notNull().default("activo"),
  sede: varchar("sede", { length: 100 }),
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }),
  fechaIngreso: timestamp("fecha_ingreso", { withTimezone: true }),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENT ASSIGNMENTS — asignación de agentes/empleados a cuentas de cliente
//
// PROPÓSITO:
//   Representa los agentes desplegados para un cliente específico.
//   Permite al portal de clientes ver sus agentes asignados de forma segura.
//
// FUTURA INTEGRACIÓN RH:
//   Cuando el módulo de RH externo esté activo, las asignaciones se crearán
//   automáticamente al hacer sync de employees. Los campos employeeId y clienteId
//   corresponden a employees.id y users.clienteId respectivamente.
//
// PRIVACIDAD:
//   La API del portal solo expone nombre, puesto, ubicacion, supervisor y estado.
//   DPI, teléfono, correo y otros datos sensibles NO se envían al cliente.
// ─────────────────────────────────────────────────────────────────────────────
export const agentAssignmentsTable = pgTable("agent_assignments", {
  id: serial("id").primaryKey(),
  // Referencias
  employeeId: integer("employee_id").notNull(),      // → employees.id
  clienteId: varchar("cliente_id", { length: 100 }).notNull(), // → users.clienteId

  // Datos de la asignación (pueden diferir de los datos base del empleado)
  puesto: varchar("puesto", { length: 255 }),         // Puesto en esta asignación específica
  servicio: varchar("servicio", { length: 100 }),     // Tipo de servicio (custodia, vigilancia, etc.)
  ubicacion: varchar("ubicacion", { length: 255 }),   // Ubicación del puesto de trabajo
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }),
  codigoAsignacion: varchar("codigo_asignacion", { length: 50 }), // Código interno (ISP-AGNT-XXX)

  // Vigencia
  fechaInicio: timestamp("fecha_inicio", { withTimezone: true }).notNull().defaultNow(),
  fechaFin: timestamp("fecha_fin", { withTimezone: true }),    // NULL = activo indefinidamente

  // Estado de la asignación
  estado: varchar("estado", { length: 50 }).notNull().default("activo"),
  // 'activo' | 'suspendido' | 'finalizado'

  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ANTICIPOS — solicitudes de anticipo salarial de colaboradores
//
// FLUJO WA:
//   1. Colaborador envía "quiero anticipo" por WhatsApp
//   2. Sistema valida número → employees.telefono (normalizado)
//   3. Sistema valida fecha → días habilitados (10 y 25 de cada mes ±1 día)
//   4. Sistema valida duplicado → no hay anticipo pendiente en el mismo período
//   5. Solicita DPI (si no existe en employees) y monto
//   6. Guarda con origen="whatsapp", estado="pendiente"
//
// PERÍODO: formato "YYYY-MM-dia10" o "YYYY-MM-dia25"
// ─────────────────────────────────────────────────────────────────────────────
export const anticiposTable = pgTable("anticipos", {
  id: serial("id").primaryKey(),
  // Referencia al empleado (nullable: si en futuro se flexibiliza)
  employeeId: integer("employee_id"),                    // → employees.id
  // Datos del colaborador (capturados en el momento de la solicitud)
  nombre: varchar("nombre", { length: 255 }).notNull(),
  puesto: varchar("puesto", { length: 255 }),
  dpi: varchar("dpi", { length: 20 }),
  telefono: varchar("telefono", { length: 50 }),
  // Solicitud
  cantidad: integer("cantidad").notNull(),               // Monto en Quetzales (entero)
  origen: varchar("origen", { length: 50 }).notNull().default("manual"), // "whatsapp" | "manual"
  estado: varchar("estado", { length: 50 }).notNull().default("pendiente"),
  // "pendiente" | "aprobada" | "rechazada" | "pagada"
  periodo: varchar("periodo", { length: 30 }),           // "2026-03-dia10"
  fechaSolicitud: timestamp("fecha_solicitud", { withTimezone: true }).notNull().defaultNow(),
  observaciones: text("observaciones"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Zod insert schemas
// ─────────────────────────────────────────────────────────────────────────────
export const insertAnticipSchema = createInsertSchema(anticiposTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAgentAssignmentSchema = createInsertSchema(agentAssignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript types
// ─────────────────────────────────────────────────────────────────────────────
export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Application = typeof applicationsTable.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type AgentAssignment = typeof agentAssignmentsTable.$inferSelect;
export type InsertAgentAssignment = z.infer<typeof insertAgentAssignmentSchema>;
export type Anticipo = typeof anticiposTable.$inferSelect;
export type InsertAnticipo = z.infer<typeof insertAnticipSchema>;
