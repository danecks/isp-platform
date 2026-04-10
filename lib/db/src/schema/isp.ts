import { pgTable, serial, integer, smallint, numeric, varchar, text, timestamp, boolean, date } from "drizzle-orm/pg-core";
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
  // C-05: FK real al registro en clients (INTEGER). Rellena automáticamente
  // al crear un incidente cuando se provee clienteId como número.
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
  reportadoPor: varchar("reportado_por", { length: 255 }),   // nombre o teléfono del reportante
  // ────────────────────────────────────────────────────────────────────────
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
  telefonoSecundario: varchar("telefono_secundario", { length: 50 }),
  correo: varchar("correo", { length: 255 }),
  fotoUrl: text("foto_url"),                                  // URL del objeto en GCS (path relativo /objects/...)
  puesto: varchar("puesto", { length: 255 }),
  tipoServicio: varchar("tipo_servicio", { length: 100 }),
  area: varchar("area", { length: 100 }),
  estadoLaboral: varchar("estado_laboral", { length: 50 }).notNull().default("activo"),
  // 'activo' | 'suspendido' | 'baja' | 'licencia'
  tipoPersonal: varchar("tipo_personal", { length: 30 }).notNull().default("guardia"),
  // 'guardia' | 'supervisor' | 'jefe_servicio' | 'administrativo_bodega' | 'administrativo_rrhh' | 'gerencia'
  sede: varchar("sede", { length: 100 }),
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }),
  supervisorId: integer("supervisor_id"),   // → employees.id (self-ref, nullable)
  clienteId: integer("cliente_id"),         // → clients.id (nullable)
  waAutorizado: boolean("wa_autorizado").notNull().default(false),
  telefonoVerificadoAt: timestamp("telefono_verificado_at", { withTimezone: true }),
  fechaIngreso: timestamp("fecha_ingreso", { withTimezone: true }),
  notas: text("notas"),
  // ── Configuración de anticipos ───────────────────────────────────────────
  limiteAnticipo: integer("limite_anticipo"),                 // null = sin límite configurado
  tipoLimitePeriodo: varchar("tipo_limite_periodo", { length: 30 }).default("quincenal"),
  ultimaActualizacionLimiteAt: timestamp("ultima_actualizacion_limite_at", { withTimezone: true }),
  // ── Datos laborales / nómina ─────────────────────────────────────────────
  sueldoBase: numeric("sueldo_base", { precision: 12, scale: 2 }),  // salario mensual en GTQ
  tipoJornada: varchar("tipo_jornada", { length: 20 }),             // "completa" | "parcial" | "mixta"
  diaDescanso: varchar("dia_descanso", { length: 20 }),             // "domingo" | "sabado" | "lunes" etc.
  horasContrato: smallint("horas_contrato"),                        // horas semanales contratadas
  // ── Bonificaciones ───────────────────────────────────────────────────────────
  bonificacionIncentivo: numeric("bonificacion_incentivo", { precision: 10, scale: 2 }), // Dto. 78-89 (Q250/mes)
  bonificacion1: numeric("bonificacion_1", { precision: 10, scale: 2 }),                 // Bonificación adicional 1
  bonificacion2: numeric("bonificacion_2", { precision: 10, scale: 2 }),                 // Bonificación adicional 2
  bonificacion3: numeric("bonificacion_3", { precision: 10, scale: 2 }),                 // Bonificación adicional 3
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
  // Permiso explícito para reportar emergencias (null = derivado del rol)
  // Roles con permiso por defecto: admin, operaciones, supervisor
  // Roles que requieren habilitación explícita: cliente, rrhh, comercial, guardia
  canReportEmergency: boolean("can_report_emergency"),
  // Permiso explícito para solicitar anticipos vía WhatsApp
  canRequestAdvance: boolean("can_request_advance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS — clientes operativos de ISP, S.A.
//
// Entidad central del sistema de alias. Separada de `users` (que maneja acceso
// al portal). Un client puede vincularse opcionalmente al portal via portalClienteId.
// ─────────────────────────────────────────────────────────────────────────────
export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),          // Nombre legal
  nombreComercial: varchar("nombre_comercial", { length: 255 }), // Nombre comercial
  nit: varchar("nit", { length: 50 }),
  sector: varchar("sector", { length: 100 }),                    // industria | comercio | banca | salud | gobierno
  estado: varchar("estado", { length: 20 }).notNull().default("activo"),
  portalClienteId: varchar("portal_cliente_id", { length: 100 }), // → users.clienteId (ej: "CLI-001")
  notas: text("notas"),
  // Fecha en que inicia operaciones el contrato/proyecto del cliente.
  fechaInicioContrato: date("fecha_inicio_contrato"),
  // ── Campos IGSS (centro de trabajo) ────────────────────────────────────────
  igssAplica: boolean("igss_aplica").default(false),               // ¿Este cliente es un centro de trabajo IGSS?
  igssCodigoCentro: varchar("igss_codigo_centro", { length: 10 }), // Código secuencial del centro (ej: "1", "2")
  igssDireccion: text("igss_direccion"),                            // Dirección física para el IGSS
  igssZona: varchar("igss_zona", { length: 10 }),                   // Zona (ej: "10")
  igssDepartamento: smallint("igss_departamento"),                  // Código departamento Guatemala 1-22
  igssMunicipio: smallint("igss_municipio"),                        // Código municipio
  igssCodigoActividad: varchar("igss_codigo_actividad", { length: 20 }), // Ej: "803011"
  igssContacto: varchar("igss_contacto", { length: 200 }),          // Persona de contacto IGSS
  igssFax: varchar("igss_fax", { length: 50 }),
  igssEmail: varchar("igss_email", { length: 200 }),
  igssTelefono: varchar("igss_telefono", { length: 100 }),
  // ───────────────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT_ALIASES — alias y nombres comunes para cada cliente
//
// Permite que agentes usen términos como "gallo", "custodio gallo" o "salvavidas"
// y el sistema los mapee al cliente legal correcto.
// ─────────────────────────────────────────────────────────────────────────────
export const clientAliasesTable = pgTable("client_aliases", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),   // → clients.id
  alias: varchar("alias", { length: 255 }).notNull(),
  tipoAlias: varchar("tipo_alias", { length: 50 }).notNull().default("comun"),
  // 'comercial' | 'operativo' | 'comun'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE_LOCATIONS — puestos, rutas y servicios por cliente
//
// Representa cada punto operativo donde ISP brinda servicio a un cliente.
// ─────────────────────────────────────────────────────────────────────────────
export const serviceLocationsTable = pgTable("service_locations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),   // → clients.id
  nombrePuesto: varchar("nombre_puesto", { length: 255 }).notNull(),
  ubicacion: varchar("ubicacion", { length: 255 }),
  tipo: varchar("tipo", { length: 50 }).notNull().default("vigilancia"),
  // 'puerta' | 'bodega' | 'ruta' | 'planta' | 'perimetral' | 'vigilancia'
  estado: varchar("estado", { length: 20 }).notNull().default("activo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POSITION_ALIASES — alias para puestos/rutas específicos
//
// Permite que "ruta norte gallo", "bodega gallo" o "puerta dolores" apunten
// al puesto correcto dentro del cliente correspondiente.
// ─────────────────────────────────────────────────────────────────────────────
export const positionAliasesTable = pgTable("position_aliases", {
  id: serial("id").primaryKey(),
  puestoId: integer("puesto_id").notNull(),   // → service_locations.id
  alias: varchar("alias", { length: 255 }).notNull(),
  tipoAlias: varchar("tipo_alias", { length: 50 }).notNull().default("comun"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_CONFIG — configuración general del asistente de WhatsApp
//
// Tabla clave-valor. Permite editar el comportamiento del bot desde el admin
// sin tocar código. Tipos soportados: texto | enum | hora | booleano
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
// WA_MESSAGES — mensajes automáticos configurables del bot
//
// Cada clave corresponde a un evento del flujo WA (anticipo_fuera_fecha,
// usuario_no_registrado, etc.). El backend lee estos textos en runtime.
// ─────────────────────────────────────────────────────────────────────────────
export const waMessagesTable = pgTable("wa_messages", {
  id: serial("id").primaryKey(),
  clave: varchar("clave", { length: 100 }).notNull().unique(),
  texto: text("texto").notNull(),
  descripcion: varchar("descripcion", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_MENU_OPTIONS — opciones de menú del bot por rol
//
// Roles: externo | guardia | supervisor | cliente
// Permite activar/desactivar opciones y cambiar su orden desde admin.
// ─────────────────────────────────────────────────────────────────────────────
export const waMenuOptionsTable = pgTable("wa_menu_options", {
  id: serial("id").primaryKey(),
  rol: varchar("rol", { length: 50 }).notNull(),   // externo | guardia | supervisor | cliente
  texto: varchar("texto", { length: 255 }).notNull(),
  accion: varchar("accion", { length: 100 }).notNull(),  // clave interna: anticipo, incidencia, emergencia...
  activo: boolean("activo").notNull().default(true),
  orden: integer("orden").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_AUDIT_LOG — auditoría de cambios en configuración
//
// Registra quién cambió qué y cuándo, con el valor anterior y el nuevo.
// ─────────────────────────────────────────────────────────────────────────────
export const waAuditLogTable = pgTable("wa_audit_log", {
  id: serial("id").primaryKey(),
  modulo: varchar("modulo", { length: 50 }).notNull(),   // wa_config | wa_messages | wa_menu_options
  clave: varchar("clave", { length: 100 }).notNull(),
  valorAnterior: text("valor_anterior"),
  valorNuevo: text("valor_nuevo").notNull(),
  usuario: varchar("usuario", { length: 100 }),           // username del admin
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  cantidad: integer("cantidad").notNull(),               // Monto solicitado en Quetzales
  montoCobro: numeric("monto_cobro", { precision: 10, scale: 2 }),  // Monto a descontar (cantidad + 10%)
  origen: varchar("origen", { length: 50 }).notNull().default("manual"), // "whatsapp" | "manual"
  estado: varchar("estado", { length: 50 }).notNull().default("pendiente"),
  // "pendiente" | "aprobada" | "rechazada" | "pagada"
  periodo: varchar("periodo", { length: 30 }),           // "2026-03-dia10"
  fechaSolicitud: timestamp("fecha_solicitud", { withTimezone: true }).notNull().defaultNow(),
  observaciones: text("observaciones"),
  // ── Futura planilla ────────────────────────────────────────────────────────
  planillaId: integer("planilla_id"),                    // FK a tabla planilla cuando exista
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TAREAS — tareas operativas de ISP, S.A.
//
// Reemplaza el mock de tareas. Cada tarea puede estar ligada a una incidencia
// y opcionalmente a una tarjeta de Trello.
//
// CIERRE CON EVIDENCIA:
//   Para marcar estado = "completada", se requiere registrar una entrada en
//   task_evidencias con foto y comentario. El endpoint POST /tareas/:id/cerrar
//   valida esto antes de actualizar el estado.
//
// INTEGRACIÓN FUTURA WHATSAPP:
//   El servicio de WA puede hacer POST /tareas/:id/cerrar con canal="whatsapp"
//   una vez que se reciban foto y comentario del supervisor.
// ─────────────────────────────────────────────────────────────────────────────
export const tareasTable = pgTable("tareas", {
  id: varchar("id", { length: 20 }).primaryKey(),
  titulo: varchar("titulo", { length: 500 }).notNull(),
  descripcion: text("descripcion"),
  incidenciaId: varchar("incidencia_id", { length: 20 }),   // → incidents.id (nullable)
  prioridad: varchar("prioridad", { length: 20 }).notNull().default("media"),
  estado: varchar("estado", { length: 50 }).notNull().default("pendiente"),
  // "pendiente" | "en_proceso" | "completada" | "cancelada"
  asignado: varchar("asignado", { length: 255 }),            // Nombre del supervisor/responsable
  asignadoId: integer("asignado_id"),                        // → users.id (nullable)
  trelloCardId: varchar("trello_card_id", { length: 100 }),
  trelloCardUrl: varchar("trello_card_url", { length: 500 }),
  fechaVencimiento: timestamp("fecha_vencimiento", { withTimezone: true }),
  canal: varchar("canal", { length: 50 }).notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK_EVIDENCIAS — evidencia de cierre de tareas con foto y comentario
//
// REGLAS:
//   - foto_url y comentario son OBLIGATORIOS para cerrar una tarea
//   - Solo supervisor o admin pueden crear evidencias
//   - Una tarea puede tener como máximo una evidencia de cierre (relación 1:1)
//
// FOTO:
//   Almacenada como data URL base64 (jpeg/png). Tamaño máximo recomendado: 1MB.
//   Para producción migrar a object storage (S3/GCS) y guardar solo la URL.
// ─────────────────────────────────────────────────────────────────────────────
export const taskEvidenciasTable = pgTable("task_evidencias", {
  id: serial("id").primaryKey(),
  tareaId: varchar("tarea_id", { length: 20 }).notNull(),    // → tareas.id
  supervisorId: integer("supervisor_id"),                     // → users.id (nullable: puede venir de WA)
  supervisorNombre: varchar("supervisor_nombre", { length: 255 }).notNull(),
  comentario: text("comentario").notNull(),
  fotoUrl: text("foto_url").notNull(),                       // base64 data URL o URL externa
  canal: varchar("canal", { length: 50 }).notNull().default("admin"),
  // "admin" | "whatsapp"
  fechaCierre: timestamp("fecha_cierre", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WA_NOTIFICACIONES_LOG — registro de notificaciones WhatsApp enviadas
//
// Registra cada intento de notificación automática (ej: tarea asignada).
//   estado: "simulado" | "enviado" | "error"
//   "simulado" = modo actual sin integración real
//   "enviado"  = cuando se conecte la API de WhatsApp real
//   "error"    = falla en el envío
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

// ─────────────────────────────────────────────────────────────────────────────
// Zod insert schemas
// ─────────────────────────────────────────────────────────────────────────────
export const insertTareaSchema = createInsertSchema(tareasTable).omit({ createdAt: true, updatedAt: true });
export const insertTaskEvidenciaSchema = createInsertSchema(taskEvidenciasTable).omit({ id: true, createdAt: true });
export const insertAnticipSchema = createInsertSchema(anticiposTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientAliasSchema = createInsertSchema(clientAliasesTable).omit({ id: true, createdAt: true });
export const insertServiceLocationSchema = createInsertSchema(serviceLocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPositionAliasSchema = createInsertSchema(positionAliasesTable).omit({ id: true, createdAt: true });
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
export type Client = typeof clientsTable.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type ClientAlias = typeof clientAliasesTable.$inferSelect;
export type InsertClientAlias = z.infer<typeof insertClientAliasSchema>;
export type ServiceLocation = typeof serviceLocationsTable.$inferSelect;
export type InsertServiceLocation = z.infer<typeof insertServiceLocationSchema>;
export type PositionAlias = typeof positionAliasesTable.$inferSelect;
export type InsertPositionAlias = z.infer<typeof insertPositionAliasSchema>;
export type WaConfig = typeof waConfigTable.$inferSelect;
export type WaMessage = typeof waMessagesTable.$inferSelect;
export type WaMenuOption = typeof waMenuOptionsTable.$inferSelect;
export type WaAuditLog = typeof waAuditLogTable.$inferSelect;

export type Tarea = typeof tareasTable.$inferSelect;
export type WaNotificacionLog = typeof waNotificacionesLogTable.$inferSelect;
export type InsertTarea = z.infer<typeof insertTareaSchema>;
export type TaskEvidencia = typeof taskEvidenciasTable.$inferSelect;
export type InsertTaskEvidencia = z.infer<typeof insertTaskEvidenciaSchema>;
