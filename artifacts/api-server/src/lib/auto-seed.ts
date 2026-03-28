import {
  db,
  usersTable,
  employeesTable,
  agentAssignmentsTable,
  anticiposTable,
  clientsTable,
  clientAliasesTable,
  serviceLocationsTable,
  positionAliasesTable,
  waConfigTable,
  waMessagesTable,
  waMenuOptionsTable,
  tareasTable,
} from "@workspace/db";
import { pool } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const SALT_ROUNDS = 10;

// ═══════════════════════════════════════════════════════════════════════
// AUTO-MIGRACIÓN — crea tablas faltantes en producción
// Usa CREATE TABLE IF NOT EXISTS para que sea seguro en cualquier entorno
// ═══════════════════════════════════════════════════════════════════════
export async function runAutoMigrations(): Promise<void> {
  logger.info("Auto-migrate: verificando tablas...");
  try {
    // Tabla anticipos (nueva en Fase 1 de anticipos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS anticipos (
        id              SERIAL PRIMARY KEY,
        employee_id     INTEGER,
        nombre          VARCHAR(255) NOT NULL,
        puesto          VARCHAR(255),
        dpi             VARCHAR(20),
        telefono        VARCHAR(50),
        cantidad        INTEGER NOT NULL,
        origen          VARCHAR(50) NOT NULL DEFAULT 'manual',
        estado          VARCHAR(50) NOT NULL DEFAULT 'pendiente',
        periodo         VARCHAR(30),
        fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        observaciones   TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'anticipos' verificada/creada");

    // Tablas del sistema de alias (Fase 1 — alias de clientes y puestos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id                  SERIAL PRIMARY KEY,
        nombre              VARCHAR(255) NOT NULL,
        nombre_comercial    VARCHAR(255),
        nit                 VARCHAR(50),
        sector              VARCHAR(100),
        estado              VARCHAR(20) NOT NULL DEFAULT 'activo',
        portal_cliente_id   VARCHAR(100),
        notas               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'clients' verificada/creada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_aliases (
        id          SERIAL PRIMARY KEY,
        client_id   INTEGER NOT NULL,
        alias       VARCHAR(255) NOT NULL,
        tipo_alias  VARCHAR(50) NOT NULL DEFAULT 'comun',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'client_aliases' verificada/creada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_locations (
        id              SERIAL PRIMARY KEY,
        client_id       INTEGER NOT NULL,
        nombre_puesto   VARCHAR(255) NOT NULL,
        ubicacion       VARCHAR(255),
        tipo            VARCHAR(50) NOT NULL DEFAULT 'vigilancia',
        estado          VARCHAR(20) NOT NULL DEFAULT 'activo',
        notas           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'service_locations' verificada/creada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS position_aliases (
        id          SERIAL PRIMARY KEY,
        puesto_id   INTEGER NOT NULL,
        alias       VARCHAR(255) NOT NULL,
        tipo_alias  VARCHAR(50) NOT NULL DEFAULT 'comun',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'position_aliases' verificada/creada");

    // Columna tarea_asociada en leads
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS tarea_asociada VARCHAR(255)`);
    logger.info("Auto-migrate: columna 'leads.tarea_asociada' verificada");

    // Columna tarea_asociada en applications
    await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS tarea_asociada VARCHAR(255)`);
    logger.info("Auto-migrate: columna 'applications.tarea_asociada' verificada");

    // Columna clienteRefId e tarea_asociada en incidents (si no existen)
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS cliente_ref_id VARCHAR(100)`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tarea_asociada VARCHAR(255)`);
    logger.info("Auto-migrate: columnas extra en 'incidents' verificadas");

    // Columnas de emergencia en incidents y users
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS es_emergencia BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reportado_por VARCHAR(255)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_report_emergency BOOLEAN`);
    logger.info("Auto-migrate: columnas de emergencia en 'incidents' y 'users' verificadas");

    // Columnas adicionales en users (WhatsApp identity management)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_request_advance BOOLEAN`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER`);
    // Índice único en teléfono (excluyendo NULLs para permitir usuarios sin teléfono)
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_telefono_unique ON users(telefono) WHERE telefono IS NOT NULL`);
    logger.info("Auto-migrate: columnas WhatsApp identity en 'users' verificadas");

    // Tablas de configuración WA
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wa_config (
        id          SERIAL PRIMARY KEY,
        clave       VARCHAR(100) NOT NULL UNIQUE,
        valor       TEXT NOT NULL,
        tipo        VARCHAR(50) NOT NULL DEFAULT 'texto',
        descripcion VARCHAR(255),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'wa_config' verificada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wa_messages (
        id          SERIAL PRIMARY KEY,
        clave       VARCHAR(100) NOT NULL UNIQUE,
        texto       TEXT NOT NULL,
        descripcion VARCHAR(255),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'wa_messages' verificada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wa_menu_options (
        id          SERIAL PRIMARY KEY,
        rol         VARCHAR(50) NOT NULL,
        texto       VARCHAR(255) NOT NULL,
        accion      VARCHAR(100) NOT NULL,
        activo      BOOLEAN NOT NULL DEFAULT TRUE,
        orden       INTEGER NOT NULL DEFAULT 0,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'wa_menu_options' verificada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wa_audit_log (
        id              SERIAL PRIMARY KEY,
        modulo          VARCHAR(50) NOT NULL,
        clave           VARCHAR(100) NOT NULL,
        valor_anterior  TEXT,
        valor_nuevo     TEXT NOT NULL,
        usuario         VARCHAR(100),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'wa_audit_log' verificada");

  } catch (err) {
    logger.error({ err }, "Auto-migrate: error — continuando de todas formas");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// USUARIOS SEED
// ═══════════════════════════════════════════════════════════════════════
const SEED_USERS = [
  { nombre: "Daniel Administrador",   username: "dan2336",      correo: "dan@isp.gt",                password: "1234",           rol: "admin"       as const, telefono: "50220001111" },
  { nombre: "Administrador ISP",      username: "admin",        correo: "admin@isp.gt",              password: "Admin2024!",     rol: "admin"       as const, telefono: "50220001100" },
  { nombre: "Carlos Operaciones",     username: "ops01",        correo: "carlos.ops@isp.gt",         password: "Ops2024!",       rol: "operaciones" as const, telefono: "50220002222" },
  { nombre: "María Recursos Humanos", username: "rrhh01",       correo: "maria.rrhh@isp.gt",         password: "RRHH2024!",      rol: "rrhh"        as const, telefono: "50220003333" },
  { nombre: "Roberto Comercial",      username: "comercial01",  correo: "roberto.comercial@isp.gt",  password: "Comercial2024!", rol: "comercial"   as const, telefono: "50220004444" },
  { nombre: "Supervisor García",      username: "supervisor01", correo: "garcia.sup@isp.gt",         password: "Supervisor2024!",rol: "supervisor"  as const, telefono: "50220005555" },
  { nombre: "Cliente Distribuidora",  username: "cliente01",    correo: "contacto@distnac.gt",       password: "Cliente2024!",   rol: "cliente"     as const, telefono: "50230001111", clienteId: "CLI-001" },
];

// ═══════════════════════════════════════════════════════════════════════
// EMPLEADOS SEED — agentes y supervisores de muestra
// ═══════════════════════════════════════════════════════════════════════
const SEED_EMPLOYEES = [
  {
    nombreCompleto: "Carlos Eduardo Rodríguez López",
    dpi: "1234567890101",
    telefono: "50220002222",
    correo: "carlos.ops@isp.gt",
    puesto: "Jefe de Operaciones",
    area: "Operaciones",
    sede: "Ciudad de Guatemala",
    supervisorNombre: "Daniel Administrador",
    fechaIngreso: new Date("2021-03-15"),
  },
  {
    nombreCompleto: "Marco Antonio Tzoc López",
    dpi: "2345678901202",
    telefono: "50220010001",
    correo: "marco.tzoc@isp.gt",
    puesto: "Agente de Seguridad",
    area: "Operaciones",
    sede: "Zona 10",
    supervisorNombre: "Carlos Eduardo Rodríguez López",
    fechaIngreso: new Date("2022-06-01"),
  },
  {
    nombreCompleto: "Lucía Ajú Samayoa",
    dpi: "3456789012303",
    telefono: "50220010002",
    correo: "lucia.aju@isp.gt",
    puesto: "Agente de Seguridad",
    area: "Operaciones",
    sede: "Zona 10",
    supervisorNombre: "Carlos Eduardo Rodríguez López",
    fechaIngreso: new Date("2022-08-15"),
  },
  {
    nombreCompleto: "Pedro Pablo Cux Xicay",
    dpi: "4567890123404",
    telefono: "50220010003",
    correo: "pedro.cux@isp.gt",
    puesto: "Agente de Seguridad",
    area: "Operaciones",
    sede: "Mixco",
    supervisorNombre: "Carlos Eduardo Rodríguez López",
    fechaIngreso: new Date("2023-01-10"),
  },
  {
    nombreCompleto: "Supervisor García",
    dpi: "5678901234505",
    telefono: "50220005555",
    correo: "garcia.sup@isp.gt",
    puesto: "Supervisor de Seguridad",
    area: "Supervisión",
    sede: "Ciudad de Guatemala",
    supervisorNombre: "Daniel Administrador",
    fechaIngreso: new Date("2020-07-20"),
  },
];

// ═══════════════════════════════════════════════════════════════════════
// ASIGNACIONES DE AGENTES SEED — para cliente CLI-001
// ═══════════════════════════════════════════════════════════════════════
// Se crean después del seed de empleados usando sus IDs reales.
const SEED_ASSIGNMENTS_CLI001 = [
  {
    // Marco Antonio — puerta principal
    empleadoNombre: "Marco Antonio Tzoc López",
    puesto: "Agente de Guardia — Puerta Principal",
    servicio: "vigilancia",
    ubicacion: "Distribuidora Nacional — Puerta Principal, Zona 10",
    supervisorNombre: "Carlos Eduardo Rodríguez López",
    codigoAsignacion: "ISP-AGNT-001",
    estado: "activo" as const,
  },
  {
    // Lucía Ajú — bodega
    empleadoNombre: "Lucía Ajú Samayoa",
    puesto: "Agente de Guardia — Área de Bodega",
    servicio: "vigilancia",
    ubicacion: "Distribuidora Nacional — Bodega Central, Zona 10",
    supervisorNombre: "Carlos Eduardo Rodríguez López",
    codigoAsignacion: "ISP-AGNT-002",
    estado: "activo" as const,
  },
  {
    // Pedro Pablo — turno nocturno
    empleadoNombre: "Pedro Pablo Cux Xicay",
    puesto: "Agente Nocturno — Perimetral",
    servicio: "custodia",
    ubicacion: "Distribuidora Nacional — Ronda Perimetral, Zona 10",
    supervisorNombre: "Carlos Eduardo Rodríguez López",
    codigoAsignacion: "ISP-AGNT-003",
    estado: "activo" as const,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
export async function runAutoSeed(): Promise<void> {

  // ── 1. Usuarios ──────────────────────────────────────────────────────
  try {
    const [{ total: userCount }] = await db.select({ total: count() }).from(usersTable);
    if (Number(userCount) === 0) {
      logger.info("Auto-seed: creando usuarios iniciales...");
      for (const u of SEED_USERS) {
        const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
        await db.insert(usersTable).values({
          nombre: u.nombre, username: u.username, correo: u.correo,
          passwordHash, rol: u.rol, estado: "activo",
          telefono: u.telefono ?? null, clienteId: (u as any).clienteId ?? null,
        });
      }
      logger.info({ count: SEED_USERS.length }, "Auto-seed: usuarios creados");
    } else {
      logger.info({ count: userCount }, "Auto-seed: usuarios ya existen");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed: error en usuarios");
  }

  // ── 2. Empleados ─────────────────────────────────────────────────────
  try {
    const [{ total: empCount }] = await db.select({ total: count() }).from(employeesTable);
    if (Number(empCount) === 0) {
      logger.info("Auto-seed: creando empleados de muestra...");
      for (const e of SEED_EMPLOYEES) {
        await db.insert(employeesTable).values({
          nombreCompleto: e.nombreCompleto,
          dpi: e.dpi,
          telefono: e.telefono,
          correo: e.correo,
          puesto: e.puesto,
          area: e.area,
          estadoLaboral: "activo",
          sede: e.sede,
          supervisorNombre: e.supervisorNombre,
          fechaIngreso: e.fechaIngreso,
          sourceSystem: "manual",
          syncStatus: "manual",
        });
      }
      logger.info({ count: SEED_EMPLOYEES.length }, "Auto-seed: empleados creados");
    } else {
      logger.info({ count: empCount }, "Auto-seed: empleados ya existen");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed: error en empleados");
  }

  // ── 3. Asignaciones de agentes para CLI-001 ──────────────────────────
  try {
    const [{ total: assignCount }] = await db.select({ total: count() }).from(agentAssignmentsTable);
    if (Number(assignCount) === 0) {
      // Obtener IDs reales de los empleados recién sembrados
      const empleados = await db.select().from(employeesTable);
      if (empleados.length > 0) {
        logger.info("Auto-seed: creando asignaciones de agentes para CLI-001...");
        for (const asn of SEED_ASSIGNMENTS_CLI001) {
          const emp = empleados.find((e) => e.nombreCompleto === asn.empleadoNombre);
          if (!emp) continue;
          await db.insert(agentAssignmentsTable).values({
            employeeId: emp.id,
            clienteId: "CLI-001",
            puesto: asn.puesto,
            servicio: asn.servicio,
            ubicacion: asn.ubicacion,
            supervisorNombre: asn.supervisorNombre,
            codigoAsignacion: asn.codigoAsignacion,
            estado: asn.estado,
            fechaInicio: new Date("2024-01-01"),
            notas: "Asignación inicial — datos de prueba ISP, S.A.",
          });
        }
        logger.info({ count: SEED_ASSIGNMENTS_CLI001.length }, "Auto-seed: asignaciones creadas");
      }
    } else {
      logger.info({ count: assignCount }, "Auto-seed: asignaciones ya existen");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed: error en asignaciones");
  }

  // ── 4. Alias de clientes y puestos ───────────────────────────────────
  try {
    const [{ total: clientCount }] = await db.select({ total: count() }).from(clientsTable);
    if (Number(clientCount) === 0) {
      logger.info("Auto-seed: creando clientes y alias de muestra...");

      // ── Cervecería Centro Americana ──────────────────────────────────
      const [cerveceria] = await db.insert(clientsTable).values({
        nombre: "Cervecería Centro Americana S.A.",
        nombreComercial: "Cervecería / Gallo",
        nit: "CF-001",
        sector: "industria",
        estado: "activo",
        notas: "Cliente premium. Múltiples puestos de custodia y vigilancia.",
      }).returning();

      await db.insert(clientAliasesTable).values([
        { clientId: cerveceria.id, alias: "gallo", tipoAlias: "comun" },
        { clientId: cerveceria.id, alias: "cerveceria", tipoAlias: "comercial" },
        { clientId: cerveceria.id, alias: "cervecería centro americana", tipoAlias: "comercial" },
        { clientId: cerveceria.id, alias: "custodio gallo", tipoAlias: "operativo" },
        { clientId: cerveceria.id, alias: "ruta gallo", tipoAlias: "operativo" },
        { clientId: cerveceria.id, alias: "cc", tipoAlias: "comun" },
      ]);

      const [ppGallo] = await db.insert(serviceLocationsTable).values({
        clientId: cerveceria.id,
        nombrePuesto: "Puerta Principal — Planta Central",
        ubicacion: "Cervecería Centro Americana, Zona 12, Guatemala",
        tipo: "puerta",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: ppGallo.id, alias: "puerta gallo", tipoAlias: "operativo" },
        { puestoId: ppGallo.id, alias: "entrada gallo", tipoAlias: "comun" },
        { puestoId: ppGallo.id, alias: "puerta principal gallo", tipoAlias: "operativo" },
      ]);

      const [bodGallo] = await db.insert(serviceLocationsTable).values({
        clientId: cerveceria.id,
        nombrePuesto: "Bodega Central",
        ubicacion: "Planta de Producción — Zona 12",
        tipo: "bodega",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: bodGallo.id, alias: "bodega gallo", tipoAlias: "operativo" },
        { puestoId: bodGallo.id, alias: "bodega cerveceria", tipoAlias: "comun" },
      ]);

      const [rutaGallo] = await db.insert(serviceLocationsTable).values({
        clientId: cerveceria.id,
        nombrePuesto: "Ruta de Distribución Norte",
        ubicacion: "Ruta al Atlántico — Zona Vial Norte",
        tipo: "ruta",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: rutaGallo.id, alias: "ruta norte gallo", tipoAlias: "operativo" },
        { puestoId: rutaGallo.id, alias: "custodio ruta norte", tipoAlias: "comun" },
        { puestoId: rutaGallo.id, alias: "ruta norte", tipoAlias: "comun" },
      ]);

      // ── Embotelladora Salvavidas ─────────────────────────────────────
      const [salvavidas] = await db.insert(clientsTable).values({
        nombre: "Embotelladora La Mariposa S.A. (Salvavidas)",
        nombreComercial: "Salvavidas",
        nit: "CF-002",
        sector: "industria",
        estado: "activo",
        notas: "Custodia de valores y vigilancia en planta.",
      }).returning();

      await db.insert(clientAliasesTable).values([
        { clientId: salvavidas.id, alias: "salvavidas", tipoAlias: "comun" },
        { clientId: salvavidas.id, alias: "agua salvavidas", tipoAlias: "comercial" },
        { clientId: salvavidas.id, alias: "mariposa", tipoAlias: "comun" },
        { clientId: salvavidas.id, alias: "embotelladora", tipoAlias: "comercial" },
        { clientId: salvavidas.id, alias: "agua pura", tipoAlias: "comun" },
      ]);

      const [plantaSV] = await db.insert(serviceLocationsTable).values({
        clientId: salvavidas.id,
        nombrePuesto: "Planta de Producción",
        ubicacion: "Embotelladora La Mariposa — Villa Nueva",
        tipo: "planta",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: plantaSV.id, alias: "planta salvavidas", tipoAlias: "operativo" },
        { puestoId: plantaSV.id, alias: "planta villa nueva", tipoAlias: "comun" },
      ]);

      const [despachoSV] = await db.insert(serviceLocationsTable).values({
        clientId: salvavidas.id,
        nombrePuesto: "Área de Despacho",
        ubicacion: "Zona de Carga — Planta Villa Nueva",
        tipo: "bodega",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: despachoSV.id, alias: "despacho salvavidas", tipoAlias: "operativo" },
        { puestoId: despachoSV.id, alias: "carga salvavidas", tipoAlias: "comun" },
      ]);

      // ── Tienda La Dolores ────────────────────────────────────────────
      const [dolores] = await db.insert(clientsTable).values({
        nombre: "Tienda La Dolores S.A.",
        nombreComercial: "La Dolores",
        nit: "CF-003",
        sector: "comercio",
        estado: "activo",
        notas: "Vigilancia perimetral y control de acceso.",
      }).returning();

      await db.insert(clientAliasesTable).values([
        { clientId: dolores.id, alias: "dolores", tipoAlias: "comun" },
        { clientId: dolores.id, alias: "tienda dolores", tipoAlias: "comercial" },
        { clientId: dolores.id, alias: "la dolores", tipoAlias: "comun" },
      ]);

      const [entradaDolores] = await db.insert(serviceLocationsTable).values({
        clientId: dolores.id,
        nombrePuesto: "Entrada Principal",
        ubicacion: "Tienda La Dolores — Zona 1",
        tipo: "puerta",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: entradaDolores.id, alias: "puerta dolores", tipoAlias: "operativo" },
        { puestoId: entradaDolores.id, alias: "entrada dolores", tipoAlias: "comun" },
      ]);

      // ── Distribuidora Nacional (portal CLI-001) ──────────────────────
      const [distnac] = await db.insert(clientsTable).values({
        nombre: "Distribuidora Nacional S.A.",
        nombreComercial: "DistNac",
        nit: "CF-004",
        sector: "comercio",
        estado: "activo",
        portalClienteId: "CLI-001",
        notas: "Vinculado al portal. Múltiples bodegas y rutas de distribución.",
      }).returning();

      await db.insert(clientAliasesTable).values([
        { clientId: distnac.id, alias: "distnac", tipoAlias: "comun" },
        { clientId: distnac.id, alias: "distribuidora", tipoAlias: "comercial" },
        { clientId: distnac.id, alias: "distribuidora nacional", tipoAlias: "comercial" },
        { clientId: distnac.id, alias: "nacional", tipoAlias: "comun" },
        { clientId: distnac.id, alias: "cli-001", tipoAlias: "operativo" },
      ]);

      const [bodDistnac] = await db.insert(serviceLocationsTable).values({
        clientId: distnac.id,
        nombrePuesto: "Bodega Central — Zona 10",
        ubicacion: "Distribuidora Nacional — Bodega Zona 10",
        tipo: "bodega",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: bodDistnac.id, alias: "bodega distnac", tipoAlias: "operativo" },
        { puestoId: bodDistnac.id, alias: "bodega zona 10", tipoAlias: "comun" },
        { puestoId: bodDistnac.id, alias: "distnac zona 10", tipoAlias: "comun" },
      ]);

      const [puerteDistNac] = await db.insert(serviceLocationsTable).values({
        clientId: distnac.id,
        nombrePuesto: "Puerta Principal — Oficinas",
        ubicacion: "Distribuidora Nacional — Oficinas Zona 10",
        tipo: "puerta",
        estado: "activo",
      }).returning();
      await db.insert(positionAliasesTable).values([
        { puestoId: puerteDistNac.id, alias: "puerta distnac", tipoAlias: "operativo" },
        { puestoId: puerteDistNac.id, alias: "oficinas distnac", tipoAlias: "comun" },
      ]);

      logger.info("Auto-seed: clientes y alias creados (4 clientes, alias y puestos)");
    } else {
      logger.info({ count: clientCount }, "Auto-seed: clientes ya existen");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed: error en clientes/alias");
  }

  // ── 6. WA Config — configuración general del bot ──────────────────────
  try {
    const [{ total: cfgCount }] = await db.select({ total: count() }).from(waConfigTable);
    if (Number(cfgCount) === 0) {
      logger.info("Auto-seed: creando configuración inicial de WhatsApp...");
      await db.insert(waConfigTable).values([
        { clave: "nombre_asistente",      valor: "Asistente ISP",     tipo: "texto",  descripcion: "Nombre del bot en respuestas automáticas" },
        { clave: "estado_bot",            valor: "activo",            tipo: "enum",   descripcion: "Estado del bot: activo | mantenimiento | solo_lectura" },
        { clave: "horario_inicio",        valor: "06:00",             tipo: "hora",   descripcion: "Hora de inicio de atención (24h, GT)" },
        { clave: "horario_fin",           valor: "20:00",             tipo: "hora",   descripcion: "Hora de fin de atención (24h, GT)" },
        { clave: "mensaje_bienvenida",    valor: "Bienvenido a ISP — Investigaciones y Seguridad Profesional S.A. ¿En qué le podemos ayudar?", tipo: "texto", descripcion: "Mensaje inicial de bienvenida" },
        { clave: "mensaje_fuera_horario", valor: "Gracias por contactarnos. En este momento estamos fuera del horario de atención (6:00–20:00 hrs). Su mensaje será atendido el próximo día hábil.", tipo: "texto", descripcion: "Mensaje enviado fuera de horario" },
        { clave: "mensaje_error",         valor: "Lo sentimos, ocurrió un error procesando su solicitud. Por favor intente de nuevo o comuníquese al PBX (502) 2220-0000.", tipo: "texto", descripcion: "Mensaje de error genérico" },
        { clave: "max_reintentos",        valor: "3",                 tipo: "texto",  descripcion: "Número máximo de opciones inválidas antes de transferir a humano" },
      ]);
      logger.info("Auto-seed: wa_config creada (8 entradas)");

      await db.insert(waMessagesTable).values([
        { clave: "usuario_no_registrado",  texto: "Su número no está registrado en nuestro sistema. Para registrarse o verificar su información, comuníquese al (502) 2220-0000.", descripcion: "El número WA no está en la BD" },
        { clave: "anticipo_fuera_fecha",   texto: "Las solicitudes de anticipo se procesan únicamente entre el 1 y el 10 de cada mes. Fuera de ese período no es posible gestionar solicitudes.", descripcion: "Anticipo fuera del período permitido" },
        { clave: "anticipo_duplicado",     texto: "Usted ya tiene un anticipo pendiente o aprobado en este período. Solo se permite una solicitud activa por colaborador.", descripcion: "Ya existe anticipo activo en el período" },
        { clave: "anticipo_registrado",    texto: "Su solicitud de anticipo ha sido registrada. El área de RRHH la revisará y le notificará el resultado en 1-2 días hábiles.", descripcion: "Confirmación de anticipo registrado" },
        { clave: "anticipo_aprobado",      texto: "Su anticipo ha sido aprobado. El depósito se realizará en el próximo procesamiento de planilla. Consultas comuníquese con RRHH.", descripcion: "Anticipo aprobado" },
        { clave: "anticipo_rechazado",     texto: "Su solicitud de anticipo no pudo ser aprobada. Para mayor información comuníquese directamente con el área de Recursos Humanos.", descripcion: "Anticipo rechazado" },
        { clave: "incidencia_registrada",  texto: "Incidencia registrada exitosamente (Código: {codigo}). Nuestro equipo operativo fue notificado y tomará acciones correspondientes.", descripcion: "Confirmación de incidencia desde WA" },
        { clave: "emergencia_recibida",    texto: "EMERGENCIA RECIBIDA. Su alerta fue enviada al equipo de respuesta inmediata ISP. Manténgase seguro. En peligro inmediato llame al 110 (PNC) o 122 (Bomberos).", descripcion: "Confirmación de emergencia" },
        { clave: "lead_registrado",        texto: "Gracias por su interés en ISP S.A. Hemos registrado su solicitud. Un asesor comercial le contactará en las próximas 24 horas hábiles.", descripcion: "Confirmación de lead desde WA" },
        { clave: "postulacion_registrada", texto: "Gracias por su interés en ISP S.A. Su postulación fue registrada. El equipo de RRHH revisará su perfil y le contactará si cumple el perfil requerido.", descripcion: "Confirmación de postulación desde WA" },
        { clave: "sin_coincidencia",       texto: "No encontré una opción válida. Por favor seleccione una opción del menú o comuníquese al PBX (502) 2220-0000.", descripcion: "Opción no reconocida" },
        { clave: "opcion_invalida",        texto: "La opción ingresada no es válida. Por favor elija una de las opciones disponibles.", descripcion: "Opción de menú fuera de rango" },
      ]);
      logger.info("Auto-seed: wa_messages creados (12 mensajes)");

      await db.insert(waMenuOptionsTable).values([
        { rol: "externo",    texto: "Solicitar cotización de servicios de seguridad", accion: "lead",           activo: true, orden: 1 },
        { rol: "externo",    texto: "Postularme como agente de seguridad",            accion: "postulacion",    activo: true, orden: 2 },
        { rol: "externo",    texto: "Información general sobre ISP S.A.",             accion: "info_general",   activo: true, orden: 3 },
        { rol: "externo",    texto: "Contactar con un asesor",                        accion: "contacto_humano",activo: true, orden: 4 },
        { rol: "guardia",    texto: "Solicitar anticipo salarial",                    accion: "anticipo",       activo: true, orden: 1 },
        { rol: "guardia",    texto: "Reportar incidencia en mi puesto",               accion: "incidencia",     activo: true, orden: 2 },
        { rol: "guardia",    texto: "Reportar emergencia",                            accion: "emergencia",     activo: true, orden: 3 },
        { rol: "guardia",    texto: "Consultar estado de mi anticipo",                accion: "estado_anticipo",activo: true, orden: 4 },
        { rol: "guardia",    texto: "Hablar con RRHH",                                accion: "contacto_rrhh",  activo: true, orden: 5 },
        { rol: "supervisor", texto: "Registrar incidencia operativa",                 accion: "incidencia",     activo: true, orden: 1 },
        { rol: "supervisor", texto: "Reportar emergencia",                            accion: "emergencia",     activo: true, orden: 2 },
        { rol: "supervisor", texto: "Consultar asignaciones de agentes",              accion: "asignaciones",   activo: true, orden: 3 },
        { rol: "supervisor", texto: "Solicitar anticipo colaborador",                 accion: "anticipo",       activo: true, orden: 4 },
        { rol: "supervisor", texto: "Contactar con operaciones",                      accion: "contacto_ops",   activo: true, orden: 5 },
        { rol: "cliente",    texto: "Ver mis agentes asignados",                      accion: "mis_agentes",    activo: true, orden: 1 },
        { rol: "cliente",    texto: "Reportar incidencia en mi empresa",              accion: "incidencia",     activo: true, orden: 2 },
        { rol: "cliente",    texto: "Reportar emergencia",                            accion: "emergencia",     activo: true, orden: 3 },
        { rol: "cliente",    texto: "Solicitar cotización de servicio adicional",     accion: "lead",           activo: true, orden: 4 },
        { rol: "cliente",    texto: "Hablar con mi ejecutivo de cuenta",              accion: "contacto_humano",activo: true, orden: 5 },
      ]);
      logger.info("Auto-seed: wa_menu_options creadas (19 opciones, 4 roles)");
    } else {
      logger.info({ count: cfgCount }, "Auto-seed: wa_config ya existe");
    }

    // Mensajes de emergencia — insertar si no existen (ON CONFLICT DO NOTHING)
    // Esto permite actualizar instalaciones existentes sin duplicar mensajes.
    await pool.query(`
      INSERT INTO wa_messages (clave, texto, descripcion) VALUES
        ('emergencia_no_autorizado', 'Su cuenta no tiene permiso para reportar emergencias por este canal. En caso de emergencia real llame al 110 (PNC) o 122 (Bomberos). Para habilitar este permiso contacte al administrador del sistema.', 'Usuario sin permiso de emergencia'),
        ('emergencia_ambiguedad', 'Se encontraron varias ubicaciones que coinciden. Por favor indique: {opciones}. Responda con el número de la opción correcta.', 'Confirmación de alias ambiguo en emergencia'),
        ('emergencia_pedir_ubicacion', 'Por favor indique su ubicación exacta o el nombre del puesto/cliente (ej: Gallo Zona 12, Puerta principal Mariposa).', 'Solicitar ubicación en flujo de emergencia'),
        ('emergencia_pedir_tipo', 'Seleccione el tipo de emergencia:\n1. Robo / Asalto\n2. Intrusión no autorizada\n3. Incidente armado\n4. Emergencia médica\n5. Incendio\n6. Evacuación\n7. Disturbio\n8. Otro', 'Solicitar tipo de emergencia al usuario')
      ON CONFLICT (clave) DO NOTHING
    `);
    logger.info("Auto-migrate: mensajes de emergencia verificados en wa_messages");
  } catch (err) {
    logger.error({ err }, "Auto-seed: error en wa_config/mensajes/menús");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TAREAS Y EVIDENCIAS — Fase: Supervisores con evidencia y cierre de tarea
  // ═══════════════════════════════════════════════════════════════════════
  try {
    // 1. Crear tablas si no existen (seguro en cualquier entorno)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tareas (
        id                VARCHAR(20) PRIMARY KEY,
        titulo            VARCHAR(500) NOT NULL,
        descripcion       TEXT,
        incidencia_id     VARCHAR(20),
        prioridad         VARCHAR(20) NOT NULL DEFAULT 'media',
        estado            VARCHAR(50) NOT NULL DEFAULT 'pendiente',
        asignado          VARCHAR(255),
        asignado_id       INTEGER,
        trello_card_id    VARCHAR(100),
        trello_card_url   VARCHAR(500),
        fecha_vencimiento TIMESTAMPTZ,
        canal             VARCHAR(50) NOT NULL DEFAULT 'manual',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'tareas' verificada/creada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_evidencias (
        id                  SERIAL PRIMARY KEY,
        tarea_id            VARCHAR(20) NOT NULL,
        supervisor_id       INTEGER,
        supervisor_nombre   VARCHAR(255) NOT NULL,
        comentario          TEXT NOT NULL,
        foto_url            TEXT NOT NULL,
        canal               VARCHAR(50) NOT NULL DEFAULT 'admin',
        fecha_cierre        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'task_evidencias' verificada/creada");

    // 2. Mensajes WA para flujo de cierre con evidencia (supervisor vía WhatsApp)
    await pool.query(`
      INSERT INTO wa_messages (clave, texto, descripcion) VALUES
        ('tarea_ver_lista',       'Tiene {total} tareas asignadas:\n{lista}\n\nResponda con el número de la tarea que desea gestionar.', 'Lista de tareas asignadas al supervisor'),
        ('tarea_detalle',         'Tarea {id}: {titulo}\nEstado: {estado} | Prioridad: {prioridad}\nIncidencia: {incidencia}\n\nRespuesta:\n1. Cerrar con evidencia\n2. Actualizar estado\n3. Volver', 'Detalle de tarea para el supervisor'),
        ('tarea_pedir_foto',      'Envíe una foto como evidencia del cierre de la tarea {id}. La imagen debe mostrar claramente el estado final de la situación.', 'Solicitar foto de cierre al supervisor'),
        ('tarea_pedir_comentario','Foto recibida. Ahora escriba un comentario de cierre describiendo qué se realizó y el estado actual.', 'Solicitar comentario de cierre al supervisor'),
        ('tarea_cerrada_ok',      'Tarea {id} cerrada exitosamente.\nSupervisor: {supervisor}\nFecha: {fecha}\n\nEvidencia registrada en el sistema ISP.', 'Confirmación de tarea cerrada vía WA'),
        ('tarea_sin_permiso',     'No tiene permiso para cerrar tareas. Esta acción está reservada para supervisores y administradores. Contacte a su coordinador.', 'Sin permiso para cerrar tarea')
      ON CONFLICT (clave) DO NOTHING
    `);
    logger.info("Auto-migrate: mensajes WA de tareas verificados (6 mensajes)");

    // 2b. Mensajes WA de control de acceso por número de teléfono
    await pool.query(`
      INSERT INTO wa_messages (clave, texto, descripcion) VALUES
        ('acceso_no_autorizado', '⛔ Tu número no está autorizado para usar este sistema. Comunícate con ISP, S.A. al (502) 2220-0000 para solicitar acceso.', 'Número no registrado en el sistema'),
        ('acceso_inactivo',      '🚫 Tu acceso al sistema ha sido desactivado temporalmente. Contacta a tu supervisor o llama al (502) 2220-0000.', 'Usuario con cuenta inactiva')
      ON CONFLICT (clave) DO NOTHING
    `);
    logger.info("Auto-migrate: mensajes WA de control de acceso verificados");

    // 2c. Mensajes para usuarios externos (números no registrados con intención válida)
    await pool.query(`
      INSERT INTO wa_messages (clave, texto, descripcion) VALUES
        ('bienvenida_externo',
         '👋 ¡Bienvenido a ISP — Investigaciones y Seguridad Profesional S.A.!\n\nSoy el asistente virtual de ISP. ¿En qué puedo ayudarte hoy?\n\n1️⃣ Información sobre nuestros servicios\n2️⃣ Solicitar cotización\n3️⃣ Postularme a una plaza de trabajo\n4️⃣ Hablar con un asesor\n\nEscribe el número de opción o cuéntanos tu necesidad.',
         'Menú de bienvenida para números desconocidos'),
        ('no_autorizado_interno',
         '🔒 Esta función es exclusiva para colaboradores y clientes registrados de ISP, S.A.\n\nSin embargo, puedo ayudarte con:\n\n1️⃣ Información sobre nuestros servicios\n2️⃣ Solicitar cotización de seguridad\n3️⃣ Postularte a una plaza de trabajo\n4️⃣ Hablar con un asesor\n\nEscribe el número de opción o cuéntanos en qué podemos ayudarte.',
         'Respuesta cuando externo intenta función interna (anticipo, emergencia, etc.)'),
        ('info_servicios_externo',
         'ℹ️ ISP — Investigaciones y Seguridad Profesional S.A. ofrece:\n\n🔒 Seguridad física y vigilancia\n🚐 Custodia y transporte de valores\n📹 Monitoreo y respuesta a alarmas\n🏢 Seguridad corporativa e industrial\n\n¿Te gustaría solicitar una cotización?\nEscríbenos o llama al (502) 2220-0000.',
         'Información de servicios para visitantes externos'),
        ('contacto_asesor_externo',
         '📞 Entendido. Uno de nuestros asesores se pondrá en contacto contigo a la brevedad.\n\nTambién puedes comunicarte directamente al (502) 2220-0000 de lunes a viernes de 8:00 a 17:00 horas.',
         'Respuesta cuando externo solicita hablar con asesor')
      ON CONFLICT (clave) DO NOTHING
    `);
    logger.info("Auto-migrate: mensajes WA para usuarios externos verificados (4 mensajes)");

    // 3. Seed de tareas iniciales si la tabla está vacía
    const [{ tareaCount }] = await db.select({ tareaCount: count() }).from(tareasTable);
    if (tareaCount === 0) {
      await db.insert(tareasTable).values([
        {
          id: "TASK-0091",
          titulo: "Investigar acceso no autorizado — Bodega Retalhuleu",
          descripcion: "Se detectó acceso a la bodega principal fuera del horario autorizado. Revisar cámaras, verificar bitácora de guardias y emitir informe.",
          incidenciaId: "INC-0406",
          prioridad: "alta",
          estado: "pendiente",
          asignado: "Sup. García",
          trelloCardId: "trello-card-8821",
          trelloCardUrl: null,
          canal: "manual",
        },
        {
          id: "TASK-0090",
          titulo: "Refuerzo de agentes en bodega norte Zona 12",
          descripcion: "Desplegar 2 agentes adicionales en turno nocturno durante los próximos 5 días. Coordinar con jefe de zona.",
          incidenciaId: "INC-0412",
          prioridad: "alta",
          estado: "en_proceso",
          asignado: "Sup. Ramírez",
          trelloCardId: "trello-card-8820",
          trelloCardUrl: null,
          canal: "manual",
        },
        {
          id: "TASK-0089",
          titulo: "Seguimiento intrusión Distribuidora Nacional",
          descripcion: "Dar seguimiento a intrusión reportada. Coordinación con cliente y PNC. Informe de hallazgos en 48 horas.",
          incidenciaId: "INC-0412",
          prioridad: "alta",
          estado: "en_proceso",
          asignado: "Sup. Ramírez",
          trelloCardId: "trello-card-8819",
          trelloCardUrl: null,
          canal: "manual",
        },
        {
          id: "TASK-0088",
          titulo: "Revisión sistema de alarmas Cervecería Centro Americana",
          descripcion: "Revisión completa del sistema de alarmas instalado. Verificar sensores, panel central y comunicación con monitoreo.",
          incidenciaId: "INC-0411",
          prioridad: "media",
          estado: "completada",
          asignado: "Sup. López",
          trelloCardId: "trello-card-8815",
          trelloCardUrl: null,
          canal: "manual",
        },
        {
          id: "TASK-0087",
          titulo: "Renovación de contrato — Banco Industrial Q1",
          descripcion: "Gestionar renovación de contrato de servicios de seguridad para el primer trimestre. Incluir revisión de tarifas.",
          incidenciaId: null,
          prioridad: "media",
          estado: "pendiente",
          asignado: "Ejecutivo A. Fuentes",
          trelloCardId: null,
          trelloCardUrl: null,
          canal: "manual",
        },
        {
          id: "TASK-0086",
          titulo: "Entrevista candidatos Quetzaltenango — lote marzo",
          descripcion: "Coordinar entrevistas presenciales para lote de 8 candidatos en sede Xela. Incluir prueba física y psicométrica.",
          incidenciaId: null,
          prioridad: "baja",
          estado: "en_proceso",
          asignado: "RRHH Coordinación",
          trelloCardId: null,
          trelloCardUrl: null,
          canal: "manual",
        },
        {
          id: "TASK-0085",
          titulo: "Informe mensual Banco Industrial — Marzo 2024",
          descripcion: "Elaborar y entregar informe mensual de operaciones de seguridad al cliente. Incluir incidencias, métricas de respuesta y recomendaciones.",
          incidenciaId: "INC-0409",
          prioridad: "media",
          estado: "pendiente",
          asignado: "Sup. Morales",
          trelloCardId: "trello-card-8810",
          trelloCardUrl: null,
          canal: "manual",
        },
        {
          id: "TASK-0084",
          titulo: "Capacitación manejo de crisis — agentes nuevos",
          descripcion: "Sesión de capacitación para 12 agentes nuevos. Temas: manejo de crisis, comunicación de emergencias, protocolos ISP.",
          incidenciaId: null,
          prioridad: "baja",
          estado: "completada",
          asignado: "Coordinación Operativa",
          trelloCardId: null,
          trelloCardUrl: null,
          canal: "manual",
        },
      ]);
      logger.info("Auto-seed: 8 tareas iniciales creadas");
    } else {
      logger.info({ count: tareaCount }, "Auto-seed: tareas ya existen");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed: error en tablas de tareas/evidencias");
  }

  // ── CMS: tabla page_content ─────────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_content (
        page_key        VARCHAR(80)   PRIMARY KEY,
        content_json    JSONB         NOT NULL DEFAULT '{}',
        seo_title       VARCHAR(255),
        seo_description TEXT,
        status          VARCHAR(20)   NOT NULL DEFAULT 'draft',
        updated_by      VARCHAR(100),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'page_content' verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en tabla page_content");
  }

  // ── WA_NOTIFICACIONES_LOG: registro de notificaciones automáticas ───────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wa_notificaciones_log (
        id          SERIAL PRIMARY KEY,
        tarea_id    VARCHAR(20),
        usuario_id  INTEGER,
        telefono    VARCHAR(20),
        mensaje     TEXT,
        evento      VARCHAR(80) NOT NULL DEFAULT 'tarea_asignada',
        estado      VARCHAR(20) NOT NULL DEFAULT 'simulado',
        error_msg   TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'wa_notificaciones_log' verificada/creada");

    // Sembrar mensaje plantilla para notificación de tarea asignada
    await pool.query(`
      INSERT INTO wa_messages (clave, texto, descripcion)
      VALUES (
        'tarea_nueva_asignada',
        '📌 Tienes una nueva tarea asignada en ISP, S.A.
🧾 Tarea: {titulo}
🔑 ID: {id}
⚠ Prioridad: {prioridad}
📍 Referencia: {cliente}
Por favor ingresa al sistema o responde para continuar.',
        'Notificación automática al responsable cuando se le asigna una tarea nueva'
      )
      ON CONFLICT (clave) DO NOTHING
    `);
    logger.info("Auto-seed: mensaje 'tarea_nueva_asignada' verificado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en wa_notificaciones_log");
  }

  // ── PHONE AUTH LOG: auditoría de registro de teléfonos vía DPI ────────────
  try {
    // Nuevas columnas en users para gestión de WhatsApp
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono_secundario VARCHAR(50)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_autorizado BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono_verificado_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_phone_update_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_source VARCHAR(20)`);
    logger.info("Auto-migrate: columnas phone-auth en 'users' verificadas");

    // Tabla de auditoría de registro de teléfonos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phone_auth_log (
        id                  SERIAL PRIMARY KEY,
        user_id             INTEGER,
        empleado_id         INTEGER NOT NULL DEFAULT 0,
        dpi                 VARCHAR(20),
        numero_anterior     VARCHAR(50),
        numero_nuevo        VARCHAR(50) NOT NULL,
        accion              VARCHAR(30) NOT NULL,
        metodo_validacion   VARCHAR(20) NOT NULL DEFAULT 'dpi',
        notas               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'phone_auth_log' verificada/creada");

    // Mensajes WA para flujo DPI de registro de número
    await pool.query(`
      INSERT INTO wa_messages (clave, texto, descripcion) VALUES
        ('wa_dpi_solicitud',
         '🔐 Para acceder a funciones exclusivas de colaboradores, necesitas verificar tu identidad.\n\nEnvía tu número de *DPI* (Documento Personal de Identificación) para continuar.',
         'Solicitar DPI cuando número desconocido intenta función interna'),
        ('wa_dpi_invalido',
         '❌ El DPI no tiene el formato correcto (debe ser de 8 a 15 dígitos numéricos).\n\nVerifica e intenta de nuevo. Intentos restantes: {restantes}',
         'Error de formato de DPI — muestra intentos restantes'),
        ('wa_dpi_no_encontrado',
         '❌ No encontramos ese DPI en nuestra base de datos.\n\nVerifica el número e intenta de nuevo. ({restantes} intento{s} restante{s})',
         'DPI no encontrado en employees — muestra intentos restantes'),
        ('wa_dpi_max_intentos',
         '🔒 Máximo de intentos de verificación alcanzado. Por seguridad la sesión fue cancelada.\n\nContacta a tu supervisor o a RRHH para acceder al sistema.',
         'Sesión cancelada tras 3 intentos fallidos de DPI'),
        ('wa_dpi_valido_registrar',
         '✅ Identidad verificada como *{nombre}*.\n\n¿Deseas registrar este número como tu número autorizado de WhatsApp?\n\nResponde *SI* para registrar o *NO* para continuar sin guardar.',
         'DPI válido, sin número previo — preguntar SI/NO para registrar'),
        ('wa_dpi_numero_anterior',
         '✅ Identidad verificada como *{nombre}*.\n\nYa tienes registrado el número {anterior}.\n\n¿Qué deseas hacer con este número nuevo?\n\n1️⃣ Reemplazar el número anterior\n2️⃣ Guardar como número secundario\n3️⃣ Cancelar\n\nResponde 1, 2 o 3.',
         'DPI válido, con número previo diferente — preguntar reemplazar/secundario/cancelar'),
        ('wa_numero_registrado_ok',
         '✅ ¡Número registrado exitosamente como número principal de WhatsApp!\n\nA partir de ahora puedes usar todas las funciones de ISP, S.A. desde este número sin necesidad de volver a validar tu DPI.\n\nPuedes continuar con tu solicitud.',
         'Confirmación de registro de número como principal'),
        ('wa_numero_reemplazado_ok',
         '✅ Número actualizado exitosamente.\n\nEl número anterior ({anterior}) fue guardado como referencia.\n\nPuedes continuar con tu solicitud.',
         'Confirmación de reemplazo de número — anterior queda como secundario'),
        ('wa_numero_secundario_ok',
         '✅ Número guardado como contacto secundario de referencia.\n\nTu número principal registrado no fue modificado. Tienes acceso temporal por esta sesión.',
         'Confirmación de número guardado como secundario'),
        ('wa_numero_no_guardado',
         'Entendido. El número no fue guardado en tu perfil.\n\nTienes acceso temporal por esta sesión. Puedes continuar con tu solicitud.',
         'Colaborador eligió NO registrar el número'),
        ('wa_registro_cancelado',
         'Registro cancelado. Tu número anterior no fue modificado.\n\nTienes acceso temporal por esta sesión. Puedes continuar.',
         'Flujo de registro cancelado por el colaborador')
      ON CONFLICT (clave) DO NOTHING
    `);
    logger.info("Auto-migrate: mensajes WA para flujo DPI verificados (11 mensajes)");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en phone_auth_log o mensajes DPI");
  }

  // ── EMPLOYEES: nuevos campos del módulo de gestión de colaboradores ─────────
  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS telefono_secundario VARCHAR(50)`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_servicio VARCHAR(100)`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS supervisor_id INTEGER`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS cliente_id INTEGER`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS wa_autorizado BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS telefono_verificado_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS limite_anticipo INTEGER`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_limite_periodo VARCHAR(30) DEFAULT 'quincenal'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ultima_actualizacion_limite_at TIMESTAMPTZ`);
    logger.info("Auto-migrate: columnas de gestión de colaboradores en 'employees' verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en columnas de employees (módulo colaboradores)");
  }

  // ── PIZARRÓN OPERATIVO: puestos_operativos + movimientos_operativos ─────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS puestos_operativos (
        id              SERIAL PRIMARY KEY,
        cliente_id      INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        cliente_nombre  VARCHAR(255) NOT NULL DEFAULT '',
        nombre          VARCHAR(150) NOT NULL,
        turno           VARCHAR(20)  NOT NULL DEFAULT 'día',
        agente_id       INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        agente_nombre   VARCHAR(255),
        estado          VARCHAR(30)  NOT NULL DEFAULT 'descubierto',
        orden           INTEGER      NOT NULL DEFAULT 0,
        activo          BOOLEAN      NOT NULL DEFAULT TRUE,
        notas           TEXT,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'puestos_operativos' verificada/creada");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS movimientos_operativos (
        id                      SERIAL PRIMARY KEY,
        puesto_id               INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        cliente_nombre          VARCHAR(255),
        puesto_nombre           VARCHAR(150),
        agente_saliente_id      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        agente_saliente_nombre  VARCHAR(255),
        agente_entrante_id      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        agente_entrante_nombre  VARCHAR(255),
        tipo                    VARCHAR(30) NOT NULL DEFAULT 'asignacion',
        motivo                  VARCHAR(50),
        usuario_cambio          VARCHAR(100),
        notas                   TEXT,
        fecha_hora              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'movimientos_operativos' verificada/creada");

    // Seed inicial de puestos si existen clientes y empleados
    const clientCount = await pool.query(`SELECT COUNT(*) FROM clients WHERE estado='activo'`);
    const puestoCount = await pool.query(`SELECT COUNT(*) FROM puestos_operativos`);
    if (parseInt(clientCount.rows[0].count) > 0 && parseInt(puestoCount.rows[0].count) === 0) {
      const clients = await pool.query(`SELECT id, nombre, nombre_comercial FROM clients WHERE estado='activo' LIMIT 4`);
      const empleados = await pool.query(`SELECT id, nombre_completo FROM employees WHERE estado_laboral='activo' LIMIT 8`);
      let orden = 0;
      let empIdx = 0;
      const puestoTemplates = ["Garita Principal", "Garita Secundaria", "Recepción", "Bodega"];
      const turnos = ["día", "noche", "día", "noche"];
      for (const cli of clients.rows) {
        for (let i = 0; i < 2; i++) {
          const nombrePuesto = puestoTemplates[orden % puestoTemplates.length];
          const turno = turnos[orden % turnos.length];
          const agente = empleados.rows[empIdx];
          const agenteId = agente?.id ?? null;
          const agenteNombre = agente?.nombre_completo ?? null;
          await pool.query(
            `INSERT INTO puestos_operativos (cliente_id, cliente_nombre, nombre, turno, agente_id, agente_nombre, estado, orden)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [cli.id, cli.nombre_comercial || cli.nombre, nombrePuesto, turno, agenteId, agenteNombre, agenteId ? 'cubierto' : 'descubierto', orden]
          );
          orden++;
          if (agenteId) empIdx++;
        }
      }
      logger.info(`Auto-seed: puestos_operativos iniciales creados (${orden})`);
    }
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en pizarrón operativo");
  }

  // ── EVENTOS RRHH: registro de faltas y suspensiones con documentos ──────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS eventos_rrhh (
        id                  SERIAL PRIMARY KEY,
        employee_id         INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        employee_nombre     VARCHAR(255) NOT NULL,
        employee_dpi        VARCHAR(20),
        tipo_evento         VARCHAR(50)  NOT NULL DEFAULT 'falta',
        fecha               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        cliente_nombre      VARCHAR(255),
        puesto_nombre       VARCHAR(150),
        supervisor_nombre   VARCHAR(255),
        generado_desde      VARCHAR(50)  NOT NULL DEFAULT 'operaciones',
        movimiento_id       INTEGER REFERENCES movimientos_operativos(id) ON DELETE SET NULL,
        estado              VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
        observaciones       TEXT,
        notas               TEXT,
        usuario_generador   VARCHAR(100),
        documentos_generados JSONB       NOT NULL DEFAULT '[]',
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'eventos_rrhh' verificada/creada");

    // Columnas de auditoría de anulación (pueden no existir en instancias anteriores)
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS anulado_por       VARCHAR(100)`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS anulado_at        TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS motivo_anulacion  TEXT`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS estado_anterior   VARCHAR(30)`);
    logger.info("Auto-migrate: columnas de anulación verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en tabla eventos_rrhh");
  }

  // ── ALERTAS RRHH ─────────────────────────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rrhh_alertas (
        id                SERIAL PRIMARY KEY,
        employee_id       INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        employee_nombre   VARCHAR(255),
        tipo              VARCHAR(30)  NOT NULL,
        prioridad         VARCHAR(10)  NOT NULL DEFAULT 'media',
        estado            VARCHAR(20)  NOT NULL DEFAULT 'nueva',
        datos_clave       TEXT,
        sugerencia        TEXT,
        generada_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        vista_at          TIMESTAMPTZ,
        resuelta_at       TIMESTAMPTZ,
        resuelta_por      VARCHAR(100)
      )
    `);
    logger.info("Auto-migrate: tabla 'rrhh_alertas' verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en tabla rrhh_alertas");
  }

  // ── SEDES OPERATIVAS Y COBERTURA DIARIA ──────────────────────────────────────
  try {
    // 1) Tabla de sedes por cliente
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_sedes (
        id          SERIAL PRIMARY KEY,
        client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        nombre      VARCHAR(255) NOT NULL,
        direccion   TEXT,
        ciudad      VARCHAR(100),
        contacto    VARCHAR(255),
        telefono    VARCHAR(30),
        activo      BOOLEAN      NOT NULL DEFAULT TRUE,
        notas       TEXT,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'client_sedes' verificada/creada");

    // 2) Nuevas columnas en puestos_operativos (titular, sede, horario, jornada, costo)
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS sede_id              INTEGER REFERENCES client_sedes(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS titular_employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS titular_nombre       VARCHAR(255)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS horario              VARCHAR(100)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS jornada              VARCHAR(30)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS costo_hora           NUMERIC(10,2)`);
    logger.info("Auto-migrate: columnas de titular/sede/horario en puestos_operativos verificadas");

    // 3) Migración de datos: los agentes actuales se convierten en titulares si no hay titular definido
    await pool.query(`
      UPDATE puestos_operativos
      SET titular_employee_id = agente_id,
          titular_nombre      = agente_nombre
      WHERE agente_id IS NOT NULL
        AND titular_employee_id IS NULL
    `);
    logger.info("Auto-migrate: titulares migrados desde agente_id existentes");

    // 4) Tabla de cobertura diaria
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cobertura_diaria (
        id                     SERIAL PRIMARY KEY,
        fecha                  DATE         NOT NULL,
        puesto_id              INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        client_id              INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        sede_id                INTEGER REFERENCES client_sedes(id) ON DELETE SET NULL,
        cliente_nombre         VARCHAR(255),
        puesto_nombre          VARCHAR(150),
        titular_employee_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        titular_nombre         VARCHAR(255),
        cobertura_employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        cobertura_nombre       VARCHAR(255),
        tipo_cobertura         VARCHAR(20)  NOT NULL DEFAULT 'titular',
        motivo                 VARCHAR(50),
        horas_trabajadas       NUMERIC(5,2),
        horas_extra            NUMERIC(5,2),
        observaciones          TEXT,
        usuario_registro       VARCHAR(100),
        created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'cobertura_diaria' verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en sedes/cobertura operativa");
  }

  // ── MODELO MAESTRO OPERATIVO — campos contractuales/operativos ────────────
  try {
    // Hacer turno opcional en puestos_operativos (era NOT NULL, ahora es opcional)
    await pool.query(`ALTER TABLE puestos_operativos ALTER COLUMN turno DROP NOT NULL`);

    // Campos contractuales en clients
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS observaciones_contractuales TEXT`);
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS fecha_inicio_contrato       DATE`);
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS tarifa_base_mensual         NUMERIC(12,2)`);
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS estado_contrato             VARCHAR(30) DEFAULT 'activo'`);

    // Campos operativos + comerciales en puestos_operativos
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS cantidad_contratada  SMALLINT    DEFAULT 1`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS tarifa_puesto         NUMERIC(12,2)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS hora_entrada          VARCHAR(5)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS hora_salida           VARCHAR(5)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS descanso_inicio       VARCHAR(5)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS descanso_fin          VARCHAR(5)`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS elegible_horas_extra  BOOLEAN     DEFAULT FALSE`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS tipo_servicio         VARCHAR(50)`);

    logger.info("Auto-migrate: campos del Modelo Maestro Operativo verificados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en campos Modelo Maestro Operativo");
  }

  // ── CIERRE OPERATIVO DIARIO ──────────────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cierre_operativo_diario (
        id                SERIAL PRIMARY KEY,
        fecha             DATE NOT NULL UNIQUE,
        estado            VARCHAR(20)  NOT NULL DEFAULT 'abierto',
        resumen_json      JSONB,
        cerrado_por_id    INTEGER,
        cerrado_por       VARCHAR(100),
        cerrado_en        TIMESTAMPTZ,
        comentario        TEXT,
        reabierto_por_id  INTEGER,
        reabierto_por     VARCHAR(100),
        reabierto_en      TIMESTAMPTZ,
        motivo_reapertura TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cierre_auditoria (
        id            SERIAL PRIMARY KEY,
        cierre_id     INTEGER REFERENCES cierre_operativo_diario(id),
        fecha_accion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accion        VARCHAR(50) NOT NULL,
        user_id       INTEGER,
        user_nombre   VARCHAR(100),
        detalle       TEXT
      )
    `);
    logger.info("Auto-migrate: cierre_operativo_diario y cierre_auditoria OK");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en cierre_operativo_diario");
  }

  // ── ZONAS OPERATIVAS GLOBALES ─────────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_zones (
        id                      SERIAL PRIMARY KEY,
        nombre                  VARCHAR(100) NOT NULL,
        descripcion             TEXT,
        supervisor_employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        supervisor_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
        estado                  VARCHAR(20)  NOT NULL DEFAULT 'activo',
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS zona_operativa_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL`);
    logger.info("Auto-migrate: tabla 'operational_zones' y columna zona_operativa_id verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en operational_zones");
  }

  logger.info("Auto-seed completado");
}
