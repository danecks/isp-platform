import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
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
// APPLICATIONS — postulaciones de reclutamiento externo (formulario web/WA)
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
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEES — colaboradores/empleados de ISP, S.A.
//
// PROPÓSITO:
//   Representa al personal interno de la empresa. Estos registros pueden
//   crearse manualmente (sourceSystem='manual') o sincronizarse en el futuro
//   desde la base SQL externa de Recursos Humanos (sourceSystem='hr_sql_external').
//
// DIFERENCIA CLAVE:
//   • employees = persona física que trabaja en ISP, S.A.
//   • users     = cuenta de acceso al sistema operativo (puede o no estar vinculada a un employee)
//   • leads     = contacto de empresa cliente potencial (externos)
//
// FUTURA INTEGRACIÓN RH:
//   Cuando la base SQL de RH esté disponible, el servicio hr-sync leerá registros
//   de esa fuente y los upsertará aquí usando externalId + sourceSystem como llave.
//   Ver: artifacts/api-server/src/services/hr-sync/
// ─────────────────────────────────────────────────────────────────────────────
export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),

  // ── Campos de integración con sistema externo de RH ──────────────────────
  // Cuando sourceSystem='hr_sql_external', externalId contiene el ID del empleado
  // en la base de RH. Este par (externalId, sourceSystem) identifica unívocamente
  // al empleado en su sistema de origen y se usa para hacer upsert en sincronizaciones.
  externalId: varchar("external_id", { length: 100 }),
  sourceSystem: varchar("source_system", { length: 50 }).notNull().default("manual"),
  // 'manual'          → creado manualmente en este sistema
  // 'hr_sql_external' → importado desde la base SQL de RH
  // 'api'             → importado vía API externa

  syncStatus: varchar("sync_status", { length: 20 }).notNull().default("manual"),
  // 'manual'  → no sincronizado, creado localmente
  // 'synced'  → coincide con la fuente de RH (última sync exitosa)
  // 'pending' → pendiente de sincronizar (cola de sync)
  // 'error'   → última sincronización falló (ver notas)

  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),

  // ── Datos personales del colaborador ─────────────────────────────────────
  nombreCompleto: varchar("nombre_completo", { length: 255 }).notNull(),
  dpi: varchar("dpi", { length: 20 }),                    // Documento Personal de Identificación (Guatemala)
  telefono: varchar("telefono", { length: 50 }),
  correo: varchar("correo", { length: 255 }),

  // ── Datos laborales ───────────────────────────────────────────────────────
  puesto: varchar("puesto", { length: 255 }),             // Cargo/posición
  area: varchar("area", { length: 100 }),                 // Área o departamento
  estadoLaboral: varchar("estado_laboral", { length: 50 }).notNull().default("activo"),
  // 'activo' | 'inactivo' | 'licencia' | 'suspendido' | 'baja'

  sede: varchar("sede", { length: 100 }),                 // Ciudad/sitio de trabajo
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }), // Nombre del supervisor directo
  fechaIngreso: timestamp("fecha_ingreso", { withTimezone: true }),

  // ── Notas adicionales (errores de sync, observaciones, etc.) ─────────────
  notas: text("notas"),

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS — cuentas de acceso al sistema operativo de ISP, S.A.
//
// PROPÓSITO:
//   Gestiona la autenticación y autorización de personas que usan el sistema.
//   Un usuario puede ser un empleado (vinculado via employeeId) o un acceso
//   externo (cliente, proveedor, auditor) sin empleado asociado.
//
// RELACIÓN CON EMPLOYEES:
//   users.employeeId → employees.id  (nullable, sin FK hard en DB)
//   La relación es soft para permitir crear usuarios sin necesidad de
//   tener el registro de empleado, y vice-versa.
//
// ROLES DEL SISTEMA:
//   admin | operaciones | rrhh | comercial | supervisor | cliente
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
  // Vínculo opcional con la tabla employees (soft reference, nullable)
  // Si este campo tiene valor, indica que el usuario es un empleado interno.
  // Si es NULL, puede ser un cliente, proveedor, o acceso externo.
  employeeId: integer("employee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Zod insert schemas
// ─────────────────────────────────────────────────────────────────────────────
export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });

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
