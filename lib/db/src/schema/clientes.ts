import { pgTable, serial, integer, smallint, varchar, text, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS — clientes operativos de ISP, S.A.
// ─────────────────────────────────────────────────────────────────────────────
export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  nombreComercial: varchar("nombre_comercial", { length: 255 }),
  nit: varchar("nit", { length: 50 }),
  sector: varchar("sector", { length: 100 }),
  estado: varchar("estado", { length: 20 }).notNull().default("activo"),
  portalClienteId: varchar("portal_cliente_id", { length: 100 }),
  notas: text("notas"),
  fechaInicioContrato: date("fecha_inicio_contrato"),
  // ── Campos IGSS (centro de trabajo) ────────────────────────────────────────
  igssAplica: boolean("igss_aplica").default(false),
  igssCodigoCentro: varchar("igss_codigo_centro", { length: 10 }),
  igssDireccion: text("igss_direccion"),
  igssZona: varchar("igss_zona", { length: 10 }),
  igssDepartamento: smallint("igss_departamento"),
  igssMunicipio: smallint("igss_municipio"),
  igssCodigoActividad: varchar("igss_codigo_actividad", { length: 20 }),
  igssContacto: varchar("igss_contacto", { length: 200 }),
  igssFax: varchar("igss_fax", { length: 50 }),
  igssEmail: varchar("igss_email", { length: 200 }),
  igssTelefono: varchar("igss_telefono", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT_ALIASES — alias y nombres comunes para cada cliente
// ─────────────────────────────────────────────────────────────────────────────
export const clientAliasesTable = pgTable("client_aliases", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  alias: varchar("alias", { length: 255 }).notNull(),
  tipoAlias: varchar("tipo_alias", { length: 50 }).notNull().default("comun"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE_LOCATIONS — puestos, rutas y servicios por cliente
// ─────────────────────────────────────────────────────────────────────────────
export const serviceLocationsTable = pgTable("service_locations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  nombrePuesto: varchar("nombre_puesto", { length: 255 }).notNull(),
  ubicacion: varchar("ubicacion", { length: 255 }),
  tipo: varchar("tipo", { length: 50 }).notNull().default("vigilancia"),
  estado: varchar("estado", { length: 20 }).notNull().default("activo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POSITION_ALIASES — alias para puestos/rutas específicos
// ─────────────────────────────────────────────────────────────────────────────
export const positionAliasesTable = pgTable("position_aliases", {
  id: serial("id").primaryKey(),
  puestoId: integer("puesto_id").notNull(),
  alias: varchar("alias", { length: 255 }).notNull(),
  tipoAlias: varchar("tipo_alias", { length: 50 }).notNull().default("comun"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Zod insert schemas ──────────────────────────────────────────────────────
export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientAliasSchema = createInsertSchema(clientAliasesTable).omit({ id: true, createdAt: true });
export const insertServiceLocationSchema = createInsertSchema(serviceLocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPositionAliasSchema = createInsertSchema(positionAliasesTable).omit({ id: true, createdAt: true });

// ── Types ───────────────────────────────────────────────────────────────────
export type Client = typeof clientsTable.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type ClientAlias = typeof clientAliasesTable.$inferSelect;
export type InsertClientAlias = z.infer<typeof insertClientAliasSchema>;
export type ServiceLocation = typeof serviceLocationsTable.$inferSelect;
export type InsertServiceLocation = z.infer<typeof insertServiceLocationSchema>;
export type PositionAlias = typeof positionAliasesTable.$inferSelect;
export type InsertPositionAlias = z.infer<typeof insertPositionAliasSchema>;
