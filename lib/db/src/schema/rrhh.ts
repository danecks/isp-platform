import { pgTable, serial, integer, smallint, numeric, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  telefonoSecundario: varchar("telefono_secundario", { length: 50 }),
  correo: varchar("correo", { length: 255 }),
  fotoUrl: text("foto_url"),
  puesto: varchar("puesto", { length: 255 }),
  tipoServicio: varchar("tipo_servicio", { length: 100 }),
  area: varchar("area", { length: 100 }),
  estadoLaboral: varchar("estado_laboral", { length: 50 }).notNull().default("activo"),
  // 'activo' | 'suspendido' | 'baja' | 'licencia'
  tipoPersonal: varchar("tipo_personal", { length: 30 }).notNull().default("guardia"),
  // 'guardia' | 'supervisor' | 'jefe_servicio' | 'administrativo_bodega' | 'administrativo_rrhh' | 'gerencia'
  sede: varchar("sede", { length: 100 }),
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }),
  supervisorId: integer("supervisor_id"),
  clienteId: integer("cliente_id"),
  waAutorizado: boolean("wa_autorizado").notNull().default(false),
  telefonoVerificadoAt: timestamp("telefono_verificado_at", { withTimezone: true }),
  fechaIngreso: timestamp("fecha_ingreso", { withTimezone: true }),
  notas: text("notas"),
  // ── Configuración de anticipos ───────────────────────────────────────────
  limiteAnticipo: integer("limite_anticipo"),
  tipoLimitePeriodo: varchar("tipo_limite_periodo", { length: 30 }).default("quincenal"),
  ultimaActualizacionLimiteAt: timestamp("ultima_actualizacion_limite_at", { withTimezone: true }),
  // ── Datos laborales / nómina ─────────────────────────────────────────────
  sueldoBase: numeric("sueldo_base", { precision: 12, scale: 2 }),
  tipoJornada: varchar("tipo_jornada", { length: 20 }),
  diaDescanso: varchar("dia_descanso", { length: 20 }),
  horasContrato: smallint("horas_contrato"),
  // ── Bonificaciones ───────────────────────────────────────────────────────
  bonificacionIncentivo: numeric("bonificacion_incentivo", { precision: 10, scale: 2 }),
  bonificacion1: numeric("bonificacion_1", { precision: 10, scale: 2 }),
  bonificacion2: numeric("bonificacion_2", { precision: 10, scale: 2 }),
  bonificacion3: numeric("bonificacion_3", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ANTICIPOS — solicitudes de anticipo salarial de colaboradores
// ─────────────────────────────────────────────────────────────────────────────
export const anticiposTable = pgTable("anticipos", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id"),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  puesto: varchar("puesto", { length: 255 }),
  dpi: varchar("dpi", { length: 20 }),
  telefono: varchar("telefono", { length: 50 }),
  cantidad: integer("cantidad").notNull(),
  montoCobro: numeric("monto_cobro", { precision: 10, scale: 2 }),
  numCuotas: integer("num_cuotas").default(1),
  cuotaMonto: numeric("cuota_monto", { precision: 10, scale: 2 }),
  cuotasPagadas: integer("cuotas_pagadas").default(0),
  origen: varchar("origen", { length: 50 }).notNull().default("manual"),
  estado: varchar("estado", { length: 50 }).notNull().default("pendiente"),
  periodo: varchar("periodo", { length: 30 }),
  fechaSolicitud: timestamp("fecha_solicitud", { withTimezone: true }).notNull().defaultNow(),
  observaciones: text("observaciones"),
  planillaId: integer("planilla_id"),
  // Anticipo extraordinario: autorizado por el director (admin) saltándose el
  // tope dinámico. autorizadoPor guarda el username del admin que lo aprobó.
  extraordinario: boolean("extraordinario").notNull().default(false),
  autorizadoPor: varchar("autorizado_por", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLAS DE CONTRATO LABORAL — editor de plantillas (inicial / post_prueba)
// ─────────────────────────────────────────────────────────────────────────────
export const plantillasContratoTable = pgTable("plantillas_contrato", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 32 }).notNull(),
  version: integer("version").notNull().default(1),
  activa: boolean("activa").notNull().default(false),
  titulo: varchar("titulo", { length: 255 }).notNull().default("CONTRATO INDIVIDUAL DE TRABAJO"),
  subtitulo: varchar("subtitulo", { length: 255 }),
  encabezado: text("encabezado").notNull(),
  clausulas: text("clausulas").notNull(),
  cierre: text("cierre").notNull(),
  notas: text("notas"),
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Zod insert schemas ──────────────────────────────────────────────────────
export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnticipSchema = createInsertSchema(anticiposTable).omit({ id: true, createdAt: true, updatedAt: true });

// ── Types ───────────────────────────────────────────────────────────────────
export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Anticipo = typeof anticiposTable.$inferSelect;
export type InsertAnticipo = z.infer<typeof insertAnticipSchema>;
