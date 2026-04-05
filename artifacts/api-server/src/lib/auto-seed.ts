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
    // Tabla system_config — flags de configuración del sistema (ej. demo_seed_disabled)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: tabla 'system_config' verificada/creada");

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
    // C-05: FK real a clients.id (INTEGER) — corrige el campo varchar sin FK
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL`);
    // Backfill: si cliente_ref_id contiene un número válido, sincronizar con client_id
    await pool.query(`
      UPDATE incidents
      SET client_id = CAST(cliente_ref_id AS INTEGER)
      WHERE cliente_ref_id ~ '^[0-9]+$'
        AND client_id IS NULL
        AND EXISTS (SELECT 1 FROM clients WHERE id = CAST(cliente_ref_id AS INTEGER))
    `);
    logger.info("Auto-migrate: columnas extra en 'incidents' verificadas");

    // Columnas de emergencia en incidents y users
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS es_emergencia BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reportado_por VARCHAR(255)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_report_emergency BOOLEAN`);
    logger.info("Auto-migrate: columnas de emergencia en 'incidents' y 'users' verificadas");

    // Clasificación de personal: guardia | supervisor | jefe_servicio | administrativo_bodega | administrativo_rrhh | gerencia
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_personal VARCHAR(20) NOT NULL DEFAULT 'guardia'`);
    await pool.query(`ALTER TABLE employees ALTER COLUMN tipo_personal TYPE VARCHAR(30)`);
    logger.info("Auto-migrate: columna 'employees.tipo_personal' verificada (VARCHAR(30))");

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
  // En producción no se crean datos de muestra (empleados, clientes, puestos)
  const isProduction = process.env.NODE_ENV === "production";

  // Si el admin ejecutó un reset limpio, el flag demo_seed_disabled bloquea el re-seed
  // de datos de muestra (empleados, clientes, puestos). Los usuarios sí se re-crean.
  let demoSeedDisabled = false;
  try {
    const { rows } = await pool.query(
      `SELECT value FROM system_config WHERE key = 'demo_seed_disabled' LIMIT 1`,
    );
    demoSeedDisabled = rows[0]?.value === "true";
    if (demoSeedDisabled) {
      logger.info("Auto-seed: demo_seed_disabled=true — omitiendo seed de empleados/clientes/puestos");
    }
  } catch {
    // La tabla system_config aún no existe — se crea durante las migraciones; ignorar aquí
  }

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
    if (Number(empCount) === 0 && !isProduction && !demoSeedDisabled) {
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
    if (Number(assignCount) === 0 && !isProduction && !demoSeedDisabled) {
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
    if (Number(clientCount) === 0 && !isProduction && !demoSeedDisabled) {
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

    // 3. Seed de tareas iniciales si la tabla está vacía (omitido si demo_seed_disabled=true)
    const [{ tareaCount }] = await db.select({ tareaCount: count() }).from(tareasTable);
    if (tareaCount === 0 && !demoSeedDisabled) {
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

    // Seed inicial de puestos si existen clientes y empleados (omitido si demo_seed_disabled=true)
    const { rows: _sflagP } = await pool.query(
      `SELECT value FROM system_config WHERE key = 'demo_seed_disabled' LIMIT 1`,
    );
    const _seedDisabledP = _sflagP[0]?.value === "true";
    const clientCount = await pool.query(`SELECT COUNT(*) FROM clients WHERE estado='activo'`);
    const puestoCount = await pool.query(`SELECT COUNT(*) FROM puestos_operativos`);
    if (!_seedDisabledP && parseInt(clientCount.rows[0].count) > 0 && parseInt(puestoCount.rows[0].count) === 0) {
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
        retroactivo       BOOLEAN NOT NULL DEFAULT FALSE,
        reabierto_por_id  INTEGER,
        reabierto_por     VARCHAR(100),
        reabierto_en      TIMESTAMPTZ,
        motivo_reapertura TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      ALTER TABLE cierre_operativo_diario
        ADD COLUMN IF NOT EXISTS retroactivo BOOLEAN NOT NULL DEFAULT FALSE
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

  // ── Segmentos de cobertura (multi-persona, tramos horarios por puesto/día) ─
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cobertura_segmentos (
        id                   SERIAL PRIMARY KEY,
        fecha                DATE         NOT NULL,
        puesto_id            INTEGER      REFERENCES puestos_operativos(id) ON DELETE CASCADE,
        client_id            INTEGER      REFERENCES clients(id) ON DELETE SET NULL,
        sede_id              INTEGER      REFERENCES client_sedes(id) ON DELETE SET NULL,
        employee_id          INTEGER      REFERENCES employees(id) ON DELETE SET NULL,
        empleado_nombre      VARCHAR(255),
        tipo_cobertura       VARCHAR(20)  NOT NULL DEFAULT 'relevo',
        hora_inicio          VARCHAR(5),
        hora_fin             VARCHAR(5),
        horas_calculadas     NUMERIC(5,2),
        motivo               VARCHAR(100),
        fue_en_dia_descanso  BOOLEAN      NOT NULL DEFAULT FALSE,
        genera_horas_extra   BOOLEAN      NOT NULL DEFAULT FALSE,
        observaciones        TEXT,
        usuario_registro     VARCHAR(100),
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS cobertura_segmentos_fecha_puesto ON cobertura_segmentos(fecha, puesto_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS cobertura_segmentos_employee ON cobertura_segmentos(fecha, employee_id)`);
    logger.info("Auto-migrate: tabla 'cobertura_segmentos' verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en cobertura_segmentos");
  }

  // ── Novedades de nómina diarias (consolidado por empleado al cierre) ───────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS novedades_nomina_diarias (
        id                    SERIAL PRIMARY KEY,
        fecha                 DATE         NOT NULL,
        employee_id           INTEGER      REFERENCES employees(id) ON DELETE SET NULL,
        empleado_nombre       VARCHAR(255),
        trabajo_dia           BOOLEAN      NOT NULL DEFAULT FALSE,
        horas_trabajadas      NUMERIC(5,2) NOT NULL DEFAULT 0,
        horas_extra           NUMERIC(5,2) NOT NULL DEFAULT 0,
        falta                 BOOLEAN      NOT NULL DEFAULT FALSE,
        suspension            BOOLEAN      NOT NULL DEFAULT FALSE,
        descanso_trabajado    BOOLEAN      NOT NULL DEFAULT FALSE,
        afecta_septimo        BOOLEAN      NOT NULL DEFAULT FALSE,
        descuento_dia         BOOLEAN      NOT NULL DEFAULT FALSE,
        puesto_titular_id     INTEGER      REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        puesto_titular_nombre VARCHAR(255),
        puesto_cubierto_id    INTEGER      REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        puesto_cubierto_nombre VARCHAR(255),
        num_puestos_cubiertos INTEGER      NOT NULL DEFAULT 0,
        observaciones         TEXT,
        fuente                VARCHAR(50)  NOT NULL DEFAULT 'cierre_operativo',
        cierre_id             INTEGER,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(fecha, employee_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS novedades_nomina_fecha ON novedades_nomina_diarias(fecha)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS novedades_nomina_employee ON novedades_nomina_diarias(employee_id)`);
    logger.info("Auto-migrate: tabla 'novedades_nomina_diarias' verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: error en novedades_nomina_diarias");
  }

  // ── A-01: FK entre agent_assignments.cliente_id y clients.portal_cliente_id ─
  try {
    // 1. Índice único en clients.portal_cliente_id (requerido para referenciar)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'clients_portal_cliente_id_unique'
            AND table_name = 'clients'
        ) THEN
          ALTER TABLE clients
            ADD CONSTRAINT clients_portal_cliente_id_unique UNIQUE (portal_cliente_id);
        END IF;
      END $$;
    `);
    // 2. FK desde agent_assignments.cliente_id → clients.portal_cliente_id
    //    NOT VALID = no comprueba filas existentes (seguro en producción)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_agent_assignments_cliente'
            AND table_name = 'agent_assignments'
        ) THEN
          ALTER TABLE agent_assignments
            ADD CONSTRAINT fk_agent_assignments_cliente
            FOREIGN KEY (cliente_id) REFERENCES clients(portal_cliente_id)
            NOT VALID;
        END IF;
      END $$;
    `);
    logger.info("Auto-migrate: A-01 FK agent_assignments.cliente_id → clients.portal_cliente_id aplicado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: A-01 FK constraint — error (no bloqueante)");
  }

  // ── P-01: columna responsable_id en incidents (FK a employees) ───────────────
  try {
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS responsable_id INTEGER REFERENCES employees(id) ON DELETE SET NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS incidents_responsable_id ON incidents(responsable_id)`);
    logger.info("Auto-migrate: P-01 columna responsable_id en incidents verificada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-01 responsable_id — error (no bloqueante)");
  }

  // ── Fase 2 - A-05: puesto_id, sede_id y fecha_cierre en incidents ─────────────
  try {
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS puesto_id INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS sede_id INTEGER REFERENCES client_sedes(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMPTZ`);
    await pool.query(`CREATE INDEX IF NOT EXISTS incidents_puesto_id ON incidents(puesto_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS incidents_sede_id ON incidents(sede_id)`);
    logger.info("Auto-migrate: Fase2-A05 columnas puesto_id, sede_id, fecha_cierre en incidents verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: Fase2-A05 incidents — error (no bloqueante)");
  }

  // ── Fase 2 - A-06: cliente_id y puesto_id en tareas ──────────────────────────
  try {
    await pool.query(`ALTER TABLE tareas ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clients(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE tareas ADD COLUMN IF NOT EXISTS puesto_id INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE tareas ADD COLUMN IF NOT EXISTS sede_id INTEGER REFERENCES client_sedes(id) ON DELETE SET NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS tareas_cliente_id ON tareas(cliente_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS tareas_puesto_id ON tareas(puesto_id)`);
    logger.info("Auto-migrate: Fase2-A06 columnas cliente_id, puesto_id, sede_id en tareas verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: Fase2-A06 tareas — error (no bloqueante)");
  }

  // ── Fase 2 - A-12: campo dpi en applications ─────────────────────────────────
  try {
    await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS dpi VARCHAR(15)`);
    logger.info("Auto-migrate: Fase2-A12 columna dpi en applications verificada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: Fase2-A12 applications.dpi — error (no bloqueante)");
  }

  // ── P-NOM-01: Campos laborales/nómina en employees ────────────────────────────
  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS sueldo_base    NUMERIC(12,2)`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_jornada   VARCHAR(20)`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS dia_descanso   VARCHAR(20)`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS horas_contrato SMALLINT`);
    logger.info("Auto-migrate: P-NOM-01 campos laborales en employees verificados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-NOM-01 employees laborales — error (no bloqueante)");
  }

  // ── P-NOM-02: UNIQUE INDEX en employees.dpi (con dedup seguro) ────────────────
  try {
    // Antes de crear el índice, neutralizar DPIs duplicados: conservar el más reciente
    // y poner NULL en los anteriores para no perder el registro.
    await pool.query(`
      UPDATE employees e
      SET dpi = NULL
      WHERE dpi IS NOT NULL
        AND id NOT IN (
          SELECT MAX(id)
          FROM employees
          WHERE dpi IS NOT NULL
          GROUP BY dpi
          HAVING COUNT(*) > 1
        )
        AND dpi IN (
          SELECT dpi FROM employees
          WHERE dpi IS NOT NULL
          GROUP BY dpi
          HAVING COUNT(*) > 1
        )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS employees_dpi_unique
      ON employees(dpi)
      WHERE dpi IS NOT NULL
    `);
    logger.info("Auto-migrate: P-NOM-02 UNIQUE INDEX en employees.dpi aplicado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-NOM-02 employees.dpi unique — error (no bloqueante)");
  }

  // ── P-NOM-03: campo planilla_id en anticipos ──────────────────────────────────
  try {
    await pool.query(`ALTER TABLE anticipos ADD COLUMN IF NOT EXISTS planilla_id INTEGER`);
    logger.info("Auto-migrate: P-NOM-03 anticipos.planilla_id verificado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-NOM-03 anticipos.planilla_id — error (no bloqueante)");
  }

  // ── T-01: tabla turnos (catálogo de tipos de turno) ───────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS turnos (
        id              SERIAL PRIMARY KEY,
        nombre          VARCHAR(60) NOT NULL UNIQUE,
        descripcion     TEXT,
        horas_trabajo   NUMERIC(5,2) NOT NULL,
        horas_descanso  NUMERIC(5,2) NOT NULL DEFAULT 0,
        activo          BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Seed turnos estándar
    await pool.query(`
      INSERT INTO turnos (nombre, descripcion, horas_trabajo, horas_descanso) VALUES
        ('12x12', 'Turno de 12 horas diarias (diurno o nocturno). El colaborador trabaja todos los días, 12 horas por jornada.', 12, 12),
        ('24x24', 'Turno de 24 horas continuas seguido de 24 horas de descanso. Alterna: trabaja / descansa.', 24, 24),
        ('24x48', 'Turno de 24 horas continuas seguido de 48 horas de descanso. Trabaja 1 día, descansa 2 días.', 24, 48),
        ('8 horas', 'Jornada ordinaria de 8 horas diarias. El día de descanso semanal se define en el puesto o empleado.', 8, 0),
        ('12x36', 'Turno de 12 horas continuas seguido de 36 horas de descanso. Trabaja 1 turno, descansa 1.5 días.', 12, 36)
      ON CONFLICT (nombre) DO NOTHING
    `);
    logger.info("Auto-migrate: T-01 tabla turnos verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: T-01 turnos — error (no bloqueante)");
  }

  // ── T-02: campos de turno en puestos_operativos ────────────────────────────
  try {
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS tipo_turno_id     INTEGER REFERENCES turnos(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS fecha_inicio_ciclo DATE`);
    logger.info("Auto-migrate: T-02 tipo_turno_id y fecha_inicio_ciclo en puestos_operativos verificados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: T-02 puestos_operativos turno — error (no bloqueante)");
  }

  // ── T-02b: columna num_titulares en turnos ─────────────────────────────────
  try {
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS num_titulares INTEGER NOT NULL DEFAULT 2`);
    // Actualiza los valores correctos para cada turno existente
    await pool.query(`
      UPDATE turnos SET num_titulares = CASE
        WHEN nombre = '12x12'  THEN 1
        WHEN nombre = '8 horas' THEN 1
        WHEN nombre = '24x24'  THEN 2
        WHEN nombre = '24x48'  THEN 2
        WHEN nombre = '12x36'  THEN 2
        WHEN nombre = '24x72'  THEN 2
        WHEN nombre = '8x8'    THEN 2
        ELSE 2
      END
    `);
    logger.info("Auto-migrate: T-02b num_titulares en turnos verificado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: T-02b num_titulares — error (no bloqueante)");
  }

  // ── T-03: campos de turno en novedades_nomina_diarias ──────────────────────
  try {
    await pool.query(`ALTER TABLE novedades_nomina_diarias ADD COLUMN IF NOT EXISTS tipo_turno_id    INTEGER REFERENCES turnos(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE novedades_nomina_diarias ADD COLUMN IF NOT EXISTS horas_esperadas  NUMERIC(6,2)`);
    await pool.query(`ALTER TABLE novedades_nomina_diarias ADD COLUMN IF NOT EXISTS trabajo_esperado BOOLEAN`);
    logger.info("Auto-migrate: T-03 campos turno en novedades_nomina_diarias verificados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: T-03 novedades turno — error (no bloqueante)");
  }

  // ── P-NOM-07: tabla pre_planilla_revision (estado de revisión por RRHH) ───────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pre_planilla_revision (
        id            SERIAL PRIMARY KEY,
        employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        periodo_desde DATE    NOT NULL,
        periodo_hasta DATE    NOT NULL,
        estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        -- 'pendiente' | 'revisada' | 'observada'
        observaciones TEXT,
        revisado_por  VARCHAR(100),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(employee_id, periodo_desde, periodo_hasta)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ppr_periodo_idx ON pre_planilla_revision(periodo_desde, periodo_hasta)`);
    logger.info("Auto-migrate: P-NOM-07 tabla pre_planilla_revision verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-NOM-07 pre_planilla_revision — error (no bloqueante)");
  }

  // ── P-NOM-08: columnas de aprobación y cierre en pre_planilla_revision ────────
  try {
    await pool.query(`ALTER TABLE pre_planilla_revision ADD COLUMN IF NOT EXISTS aprobado_por VARCHAR(100)`);
    await pool.query(`ALTER TABLE pre_planilla_revision ADD COLUMN IF NOT EXISTS aprobado_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE pre_planilla_revision ADD COLUMN IF NOT EXISTS periodo_cerrado BOOLEAN NOT NULL DEFAULT FALSE`);
    logger.info("Auto-migrate: P-NOM-08 columnas aprobación/cierre en pre_planilla_revision verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-NOM-08 pre_planilla_revision extra cols — error (no bloqueante)");
  }

  // ── P-NOM-09: tabla pre_planilla_cierres (snapshot de período cerrado) ────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pre_planilla_cierres (
        id               SERIAL PRIMARY KEY,
        periodo_desde    DATE          NOT NULL,
        periodo_hasta    DATE          NOT NULL,
        cerrado_por      VARCHAR(100)  NOT NULL,
        cerrado_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        observaciones    TEXT,
        snapshot         JSONB         NOT NULL DEFAULT '[]',
        total_colaboradores INTEGER    NOT NULL DEFAULT 0,
        total_estimado   NUMERIC(12,2) NOT NULL DEFAULT 0,
        UNIQUE(periodo_desde, periodo_hasta)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ppc_periodo_idx ON pre_planilla_cierres(periodo_desde, periodo_hasta)`);
    logger.info("Auto-migrate: P-NOM-09 tabla pre_planilla_cierres verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-NOM-09 pre_planilla_cierres — error (no bloqueante)");
  }

  // ── P-NOM-10: tabla pre_planilla_auditoria (registro de decisiones) ────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pre_planilla_auditoria (
        id            SERIAL PRIMARY KEY,
        periodo_desde DATE          NOT NULL,
        periodo_hasta DATE          NOT NULL,
        employee_id   INTEGER       REFERENCES employees(id) ON DELETE SET NULL,
        accion        VARCHAR(50)   NOT NULL,
        usuario       VARCHAR(100)  NOT NULL,
        observaciones TEXT,
        metadata      JSONB,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ppa_periodo_idx ON pre_planilla_auditoria(periodo_desde, periodo_hasta)`);
    logger.info("Auto-migrate: P-NOM-10 tabla pre_planilla_auditoria verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: P-NOM-10 pre_planilla_auditoria — error (no bloqueante)");
  }

  // ── EOA-01: tabla employee_operational_assignments ───────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_operational_assignments (
        id                SERIAL PRIMARY KEY,
        employee_id       INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        puesto_id         INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        sede_id           INTEGER REFERENCES client_sedes(id) ON DELETE SET NULL,
        cliente_id        INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        zona_operativa_id INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL,
        tipo_turno_id     INTEGER REFERENCES turnos(id) ON DELETE SET NULL,
        tipo_asignacion   VARCHAR(30) NOT NULL DEFAULT 'sin_asignacion',
        activa            BOOLEAN NOT NULL DEFAULT TRUE,
        fecha_inicio      TIMESTAMPTZ DEFAULT NOW(),
        notas             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS eoa_employee_idx ON employee_operational_assignments(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS eoa_activa_idx ON employee_operational_assignments(employee_id, activa)`);
    logger.info("Auto-migrate: EOA-01 tabla employee_operational_assignments verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: EOA-01 employee_operational_assignments — error (no bloqueante)");
  }

  // ── EOA-02: seed desde puestos_operativos existentes ────────────────────────
  try {
    const { rows: sinAsignacion } = await pool.query(`
      SELECT COUNT(*) FROM employee_operational_assignments
    `);
    if (parseInt(sinAsignacion[0].count) === 0) {
      // Migrar titulares desde puestos_operativos
      await pool.query(`
        INSERT INTO employee_operational_assignments
          (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id, tipo_asignacion, activa, fecha_inicio)
        SELECT
          po.titular_employee_id,
          po.id,
          po.sede_id,
          po.cliente_id,
          po.zona_operativa_id,
          po.tipo_turno_id,
          'titular',
          TRUE,
          NOW()
        FROM puestos_operativos po
        WHERE po.titular_employee_id IS NOT NULL
          AND po.activo = TRUE
        ON CONFLICT DO NOTHING
      `);
      logger.info("Auto-migrate: EOA-02 seed titulares desde puestos_operativos completado");
    } else {
      logger.info("Auto-migrate: EOA-02 ya existen asignaciones operativas, seed omitido");
    }
  } catch (err) {
    logger.error({ err }, "Auto-migrate: EOA-02 seed asignaciones — error (no bloqueante)");
  }

  // ── TH-01: tabla puesto_titular_historico ───────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS puesto_titular_historico (
        id            SERIAL PRIMARY KEY,
        puesto_id     INTEGER NOT NULL REFERENCES puestos_operativos(id) ON DELETE CASCADE,
        employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        fecha_inicio  DATE    NOT NULL,
        fecha_fin     DATE,
        motivo        VARCHAR(120),
        creado_por    VARCHAR(100),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pth_puesto ON puesto_titular_historico(puesto_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pth_employee ON puesto_titular_historico(employee_id)`);
    logger.info("Auto-migrate: TH-01 tabla puesto_titular_historico verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: TH-01 puesto_titular_historico — error (no bloqueante)");
  }

  // ── TH-02: seed historial desde titulares actuales ──────────────────────────
  try {
    const { rows: yaTiene } = await pool.query(`SELECT COUNT(*) FROM puesto_titular_historico`);
    if (parseInt(yaTiene[0].count) === 0) {
      await pool.query(`
        INSERT INTO puesto_titular_historico (puesto_id, employee_id, fecha_inicio, motivo, creado_por)
        SELECT po.id, po.titular_employee_id, CURRENT_DATE, 'titular_inicial', 'sistema'
        FROM puestos_operativos po
        WHERE po.titular_employee_id IS NOT NULL AND po.activo = TRUE
        ON CONFLICT DO NOTHING
      `);
      logger.info("Auto-migrate: TH-02 seed historial titulares iniciales completado");
    } else {
      logger.info("Auto-migrate: TH-02 historial ya existe, seed omitido");
    }
  } catch (err) {
    logger.error({ err }, "Auto-migrate: TH-02 seed historial titulares — error (no bloqueante)");
  }

  // ── SCO-01: tabla solicitudes_cambio_operativo ──────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_cambio_operativo (
        id                          SERIAL PRIMARY KEY,
        employee_id                 INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        origen_modulo               VARCHAR(50)  NOT NULL,
        tipo_cambio                 VARCHAR(80)  NOT NULL,
        estado                      VARCHAR(50)  NOT NULL DEFAULT 'pendiente_rrhh',
        datos_antes                 JSONB,
        datos_despues               JSONB,
        creado_por                  VARCHAR(100),
        motivo                      TEXT,
        validado_por_rrhh           VARCHAR(100),
        validado_por_operaciones    VARCHAR(100),
        decidido_por_admin          VARCHAR(100),
        notas_rrhh                  TEXT,
        notas_operaciones           TEXT,
        notas_admin                 TEXT,
        fecha_validacion_rrhh       TIMESTAMPTZ,
        fecha_validacion_operaciones TIMESTAMPTZ,
        fecha_decision_admin        TIMESTAMPTZ,
        puesto_id                   INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sco_employee ON solicitudes_cambio_operativo(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sco_estado  ON solicitudes_cambio_operativo(estado)`);
    logger.info("Auto-migrate: SCO-01 tabla solicitudes_cambio_operativo verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SCO-01 solicitudes_cambio_operativo — error (no bloqueante)");
  }

  // ── SSA-01: Pipeline de solicitudes de servicio adicional ─────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_servicio_adicional (
        id                        VARCHAR(30) PRIMARY KEY,
        cliente_id                INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        sede_id                   INTEGER REFERENCES client_sedes(id) ON DELETE SET NULL,
        puesto_id                 INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        tipo_solicitud            VARCHAR(50)  NOT NULL,
        fecha                     DATE         NOT NULL,
        hora_inicio               VARCHAR(5),
        hora_fin                  VARCHAR(5),
        cantidad_guardias         INTEGER      NOT NULL DEFAULT 1,
        descripcion               TEXT,
        prioridad                 VARCHAR(20)  NOT NULL DEFAULT 'normal',
        contacto_solicitante      VARCHAR(255),
        acepta_cobro_adicional    BOOLEAN      NOT NULL DEFAULT FALSE,
        origen                    VARCHAR(30)  NOT NULL DEFAULT 'portal_cliente',
        estado_general            VARCHAR(30)  NOT NULL DEFAULT 'nueva',
        estado_operaciones        VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
        estado_rrhh               VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
        estado_comercial          VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
        observaciones_operaciones TEXT,
        observaciones_rrhh        TEXT,
        observaciones_comercial   TEXT,
        monto_estimado            NUMERIC(10,2),
        tarifa_aplicada           VARCHAR(100),
        estado_facturacion        VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
        cubierta_con              VARCHAR(100),
        tarea_operaciones_id      VARCHAR(20),
        tarea_rrhh_id             VARCHAR(20),
        tarea_comercial_id        VARCHAR(20),
        solicitado_por_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        solicitado_por_nombre     VARCHAR(255),
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ssa_cliente  ON solicitudes_servicio_adicional(cliente_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ssa_estado   ON solicitudes_servicio_adicional(estado_general)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ssa_fecha    ON solicitudes_servicio_adicional(fecha)`);
    logger.info("Auto-migrate: SSA-01 tabla solicitudes_servicio_adicional verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-01 solicitudes_servicio_adicional — error (no bloqueante)");
  }

  // ── SSA-02: Columnas de tarjeta operativa, agente, resumen final ───────────
  try {
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS agente_id INTEGER REFERENCES employees(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS agente_nombre VARCHAR(255)`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS tipo_cobertura VARCHAR(50)`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS fecha_fin DATE`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS tarjeta_activa BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS estado_contabilidad VARCHAR(30) NOT NULL DEFAULT 'pendiente_autorizacion'`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS fecha_inicio_real TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS fecha_fin_real TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS resumen_final TEXT`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS resumen_generado_at TIMESTAMPTZ`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ssa_tarjeta  ON solicitudes_servicio_adicional(tarjeta_activa) WHERE tarjeta_activa = TRUE`);
    logger.info("Auto-migrate: SSA-02 columnas tarjeta operativa verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-02 columnas tarjeta — error (no bloqueante)");
  }

  // ── SSA-03: Campos de integración Pre-Planilla ──────────────────────────────
  // estado_preplanilla: pendiente | incluido | validado
  // enviado_preplanilla_at: fecha en que se generó novedad en novedades_nomina_diarias
  try {
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS estado_preplanilla     VARCHAR(30) NOT NULL DEFAULT 'pendiente'`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS enviado_preplanilla_at TIMESTAMPTZ`);
    logger.info("Auto-migrate: SSA-03 campos pre-planilla verificados/creados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-03 pre-planilla — error (no bloqueante)");
  }

  // ── SSA-04: Elegibilidad del pool de agentes ────────────────────────────────
  // elegible_pool: TRUE = aparece en pool operativo del pizarrón
  //                FALSE = supervisor/jefe/admin — excluido del pool general
  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS elegible_pool BOOLEAN NOT NULL DEFAULT TRUE`);
    // Marcar como NO elegibles a perfiles de supervisión y dirección
    await pool.query(`
      UPDATE employees
      SET elegible_pool = FALSE
      WHERE (
        puesto ILIKE '%supervisor%'
        OR puesto ILIKE '%jefe%'
        OR puesto ILIKE '%director%'
        OR puesto ILIKE '%gerente%'
        OR area  ILIKE 'supervisión'
        OR area  ILIKE 'supervision'
        OR area  ILIKE 'administración'
        OR area  ILIKE 'administracion'
        OR area  ILIKE 'rrhh'
        OR area  ILIKE 'comercial'
        OR area  ILIKE 'contabilidad'
      )
      AND elegible_pool = TRUE
    `);
    logger.info("Auto-migrate: SSA-04 elegible_pool verificado/creado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-04 elegible_pool — error (no bloqueante)");
  }

  // ── SSA-05: Historial de cambios + trazabilidad de remoción ────────────────
  // Nuevas columnas en solicitudes_servicio_adicional + tabla ssa_historial_cambios
  try {
    await pool.query(`
      ALTER TABLE solicitudes_servicio_adicional
        ADD COLUMN IF NOT EXISTS motivo_ultima_remocion VARCHAR(50),
        ADD COLUMN IF NOT EXISTS agentes_rechazados     JSONB NOT NULL DEFAULT '[]'
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ssa_historial_cambios (
        id               SERIAL PRIMARY KEY,
        ssa_id           VARCHAR NOT NULL,
        tipo_evento      VARCHAR(30) NOT NULL,
        agente_id        INTEGER,
        agente_nombre    VARCHAR(255),
        motivo           VARCHAR(50),
        notas            TEXT,
        usuario_sesion   VARCHAR(100),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ssa_hist_ssa_id ON ssa_historial_cambios(ssa_id)`);
    logger.info("Auto-migrate: SSA-05 historial/trazabilidad verificado/creado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-05 historial — error (no bloqueante)");
  }

  // ── SSA-06: Activar tarjeta para SSAs que ya tienen agente asignado ─────────
  // Fix retroactivo: cualquier SSA con agente_id pero tarjeta_activa=FALSE pasa a TRUE
  try {
    const { rowCount } = await pool.query(
      `UPDATE solicitudes_servicio_adicional
       SET tarjeta_activa = TRUE, updated_at = NOW()
       WHERE agente_id IS NOT NULL
         AND tarjeta_activa = FALSE
         AND estado_general NOT IN ('cancelada', 'cerrada')`
    );
    if (rowCount && rowCount > 0) {
      logger.info({ rowCount }, "Auto-migrate: SSA-06 tarjeta_activa activada para SSAs con agente asignado");
    }
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-06 tarjeta_activa fix — error (no bloqueante)");
  }

  // ── IGSS-01: campos de elegibilidad IGSS en employees ────────────────────────
  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS aplica_igss_general BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS estado_igss VARCHAR(30) NOT NULL DEFAULT 'no_activo'`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS fecha_inicio_igss DATE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS observaciones_igss TEXT`);
    logger.info("Auto-migrate: IGSS-01 campos IGSS en employees verificados/creados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: IGSS-01 — error (no bloqueante)");
  }

  // ── IGSS-02: campos de elegibilidad IGSS en puestos_operativos ───────────────
  // A nivel de servicio: ¿este puesto/servicio soporta IGSS dado el costo de tarifa?
  try {
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS aplica_igss BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS regimen_igss VARCHAR(30) NOT NULL DEFAULT 'no_aplica'`);
    // 'aplica' | 'no_aplica' | 'en_transicion'
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS notas_igss TEXT`);
    logger.info("Auto-migrate: IGSS-02 campos IGSS en puestos_operativos verificados/creados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: IGSS-02 — error (no bloqueante)");
  }

  // ── IGSS-03: clasificación IGSS por línea de planilla ────────────────────────
  try {
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS aplica_igss BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS motivo_exclusion_igss TEXT`);
    logger.info("Auto-migrate: IGSS-03 clasificación IGSS en planilla_lineas verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: IGSS-03 — error (no bloqueante)");
  }

  // ── PLAN-03: columnas de trazabilidad y deducciones futuras en planilla_lineas ─
  try {
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS anticipo_ids JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS novedad_ids JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS segmento_ids JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS igss_trabajador NUMERIC(10,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS igss_patronal NUMERIC(10,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS otros_descuentos NUMERIC(10,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS otros_descuentos_detalle TEXT`);
    logger.info("Auto-migrate: PLAN-03 columnas trazabilidad/deducciones en planilla_lineas verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PLAN-03 — error (no bloqueante)");
  }

  // ── PLAN-04: campo anulado en pre_planilla_cierres (permite reversión) ─────────
  try {
    await pool.query(`ALTER TABLE pre_planilla_cierres ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE pre_planilla_cierres ADD COLUMN IF NOT EXISTS anulado_por VARCHAR(100)`);
    await pool.query(`ALTER TABLE pre_planilla_cierres ADD COLUMN IF NOT EXISTS anulado_at TIMESTAMPTZ`);
    logger.info("Auto-migrate: PLAN-04 columnas anulado en pre_planilla_cierres verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PLAN-04 — error (no bloqueante)");
  }

  // ── PLAN-05: campo anulado en planillas (permite auditoría de reversiones) ────
  try {
    await pool.query(`ALTER TABLE planillas ADD COLUMN IF NOT EXISTS anulada BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE planillas ADD COLUMN IF NOT EXISTS anulada_por VARCHAR(100)`);
    await pool.query(`ALTER TABLE planillas ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMPTZ`);
    logger.info("Auto-migrate: PLAN-05 columnas anulada en planillas verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PLAN-05 — error (no bloqueante)");
  }

  // ── PLAN-06: índice único parcial en planillas (permite re-generar tras reversión) ─
  // DEBE ir después de PLAN-05 (que agrega la columna anulada) y después de PLAN-01 (que crea la tabla)
  try {
    await pool.query(`ALTER TABLE planillas DROP CONSTRAINT IF EXISTS planillas_periodo_desde_periodo_hasta_key`);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS planillas_periodo_activa_idx
      ON planillas(periodo_desde, periodo_hasta)
      WHERE anulada = FALSE
    `);
    logger.info("Auto-migrate: PLAN-06 índice único parcial en planillas verificado/creado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PLAN-06 — error (no bloqueante)");
  }

  // ── PLAN-01: tabla planillas (encabezado de planilla final) ──────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planillas (
        id               SERIAL PRIMARY KEY,
        periodo_desde    DATE          NOT NULL,
        periodo_hasta    DATE          NOT NULL,
        cierre_id        INTEGER       NOT NULL REFERENCES pre_planilla_cierres(id) ON DELETE RESTRICT,
        fecha_generacion TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        generado_por     VARCHAR(100)  NOT NULL,
        estado           VARCHAR(20)   NOT NULL DEFAULT 'borrador',
        -- 'borrador' | 'revisada' | 'aprobada' | 'pagada'
        observaciones    TEXT,
        total_colaboradores INTEGER    NOT NULL DEFAULT 0,
        total_sueldo_periodo NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_desc_faltas    NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_valor_he       NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_bruto          NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_anticipos      NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_neto           NUMERIC(12,2) NOT NULL DEFAULT 0,
        UNIQUE(periodo_desde, periodo_hasta)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS plan_estado_idx ON planillas(estado)`);
    logger.info("Auto-migrate: PLAN-01 tabla planillas verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PLAN-01 planillas — error (no bloqueante)");
  }

  // ── PLAN-02: tabla planilla_lineas (línea por colaborador) ───────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planilla_lineas (
        id               SERIAL PRIMARY KEY,
        planilla_id      INTEGER       NOT NULL REFERENCES planillas(id) ON DELETE CASCADE,
        employee_id      INTEGER,
        nombre_completo  VARCHAR(200)  NOT NULL,
        dpi              VARCHAR(20),
        puesto           VARCHAR(200),
        sede             VARCHAR(200),
        cliente          VARCHAR(200),
        tipo_jornada     VARCHAR(50),
        horas_contrato   NUMERIC(5,1),
        sueldo_base      NUMERIC(10,2) NOT NULL DEFAULT 0,
        periodo_dias     INTEGER       NOT NULL DEFAULT 0,
        dias_trabajados  INTEGER       NOT NULL DEFAULT 0,
        faltas           INTEGER       NOT NULL DEFAULT 0,
        suspensiones     INTEGER       NOT NULL DEFAULT 0,
        horas_trabajadas NUMERIC(8,2)  NOT NULL DEFAULT 0,
        horas_extra      NUMERIC(8,2)  NOT NULL DEFAULT 0,
        sueldo_periodo   NUMERIC(10,2) NOT NULL DEFAULT 0,
        desc_faltas      NUMERIC(10,2) NOT NULL DEFAULT 0,
        valor_he         NUMERIC(10,2) NOT NULL DEFAULT 0,
        total_bruto      NUMERIC(10,2) NOT NULL DEFAULT 0,
        anticipos        NUMERIC(10,2) NOT NULL DEFAULT 0,
        total_neto       NUMERIC(10,2) NOT NULL DEFAULT 0,
        revision_estado  VARCHAR(30),
        observaciones_rrhh TEXT
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS planl_planilla_idx ON planilla_lineas(planilla_id)`);
    logger.info("Auto-migrate: PLAN-02 tabla planilla_lineas verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PLAN-02 planilla_lineas — error (no bloqueante)");
  }

  // ── FREQ-01: frecuencia_pago en employees ────────────────────────────────────
  try {
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS frecuencia_pago VARCHAR(20) NOT NULL DEFAULT 'quincenal'
    `);
    logger.info("Auto-migrate: FREQ-01 frecuencia_pago en employees verificado/creado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: FREQ-01 — error (no bloqueante)");
  }

  // ── FREQ-02: frecuencia_pago en planilla_lineas ───────────────────────────────
  try {
    await pool.query(`
      ALTER TABLE planilla_lineas
        ADD COLUMN IF NOT EXISTS frecuencia_pago VARCHAR(20) NOT NULL DEFAULT 'quincenal'
    `);
    logger.info("Auto-migrate: FREQ-02 frecuencia_pago en planilla_lineas verificado/creado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: FREQ-02 — error (no bloqueante)");
  }

  // ── CONT-01: tabla contratos_empleados ────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contratos_empleados (
        id                   SERIAL PRIMARY KEY,
        employee_id          INTEGER       NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        tipo_contrato        VARCHAR(50)   NOT NULL DEFAULT 'inicial',
        etiqueta             VARCHAR(100)  NOT NULL,
        fecha_contrato       DATE          NOT NULL,
        fecha_inicio         DATE          NOT NULL,
        fecha_fin            DATE,
        puesto               VARCHAR(200),
        sueldo_base          NUMERIC(10,2),
        observaciones        TEXT,
        generado_automatico  BOOLEAN       NOT NULL DEFAULT FALSE,
        metadata             JSONB,
        created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS contratos_emp_idx ON contratos_empleados(employee_id)`);
    logger.info("Auto-migrate: CONT-01 tabla contratos_empleados verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: CONT-01 — error (no bloqueante)");
  }

  // ── HEX-01: horas_extra_calculadas en cobertura_segmentos ────────────────────
  // Almacena las horas extra netas (sobre el turno regular) calculadas al cerrar
  try {
    await pool.query(`
      ALTER TABLE cobertura_segmentos
        ADD COLUMN IF NOT EXISTS horas_extra_calculadas NUMERIC(5,2)
    `);
    logger.info("Auto-migrate: HEX-01 horas_extra_calculadas en cobertura_segmentos");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: HEX-01 — error (no bloqueante)");
  }

  // ── MOV-01: tipo_novedad y cobertura_alcance en cobertura_segmentos ──────────
  // Clasifica el motivo operativo de cada segmento (falta_total, vacaciones, etc.)
  try {
    await pool.query(`
      ALTER TABLE cobertura_segmentos
        ADD COLUMN IF NOT EXISTS tipo_novedad   VARCHAR(60),
        ADD COLUMN IF NOT EXISTS cobertura_alcance VARCHAR(20) DEFAULT 'completo'
    `);
    logger.info("Auto-migrate: MOV-01 tipo_novedad+cobertura_alcance en cobertura_segmentos");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: MOV-01 — error (no bloqueante)");
  }

  // ── MOV-02: tipo_novedad en novedades_nomina_diarias ─────────────────────────
  // Permite propagar el motivo operativo a planilla y pre-planilla
  try {
    await pool.query(`
      ALTER TABLE novedades_nomina_diarias
        ADD COLUMN IF NOT EXISTS tipo_novedad VARCHAR(60)
    `);
    logger.info("Auto-migrate: MOV-02 tipo_novedad en novedades_nomina_diarias");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: MOV-02 — error (no bloqueante)");
  }

  // ── MOV-03: estado_operativo_puesto en puestos_operativos ────────────────────
  // Refleja el estado real del puesto más allá de cubierto/descubierto
  try {
    await pool.query(`
      ALTER TABLE puestos_operativos
        ADD COLUMN IF NOT EXISTS estado_operativo_puesto VARCHAR(50) DEFAULT 'normal'
    `);
    logger.info("Auto-migrate: MOV-03 estado_operativo_puesto en puestos_operativos");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: MOV-03 — error (no bloqueante)");
  }

  // ── PF-01: tabla planificacion_futura ────────────────────────────────────────
  // Planificación futura de ausencias y coberturas desde el Pizarrón Operativo
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planificacion_futura (
        id                  SERIAL PRIMARY KEY,
        fecha               DATE        NOT NULL,
        puesto_id           INTEGER     NOT NULL REFERENCES puestos_operativos(id) ON DELETE CASCADE,
        tipo_evento         TEXT        NOT NULL DEFAULT 'ausencia',
        tipo_ausencia       TEXT,
        titular_ausente_id  INTEGER     REFERENCES employees(id) ON DELETE SET NULL,
        relevo_id           INTEGER     REFERENCES employees(id) ON DELETE SET NULL,
        motivo              TEXT,
        notas               TEXT,
        estado              TEXT        NOT NULL DEFAULT 'programado',
        fuente              TEXT        NOT NULL DEFAULT 'operaciones',
        creado_por          TEXT,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_planificacion_futura_fecha
        ON planificacion_futura(fecha)
    `);
    logger.info("Auto-migrate: PF-01 tabla planificacion_futura verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PF-01 — error (no bloqueante)");
  }

  // ── TRN-SEED-01: asignar turnos a puestos operativos existentes ──────────────
  // Ejecuta SOLO si hay puestos sin tipo_turno_id asignado
  try {
    const { rows: sinTurno } = await pool.query(`
      SELECT COUNT(*) AS cnt FROM puestos_operativos WHERE activo = TRUE AND tipo_turno_id IS NULL
    `);
    if (parseInt(sinTurno[0].cnt) > 0) {
      // Fecha de inicio de ciclo: 2026-01-01 como referencia estable
      await pool.query(`
        UPDATE puestos_operativos
        SET
          tipo_turno_id     = t.id,
          fecha_inicio_ciclo = '2026-01-01'
        FROM (
          SELECT id, nombre FROM turnos WHERE activo = TRUE
        ) t
        WHERE puestos_operativos.activo = TRUE
          AND puestos_operativos.tipo_turno_id IS NULL
          AND (
            (puestos_operativos.nombre ILIKE '%garita principal%'   AND t.nombre = '12x12') OR
            (puestos_operativos.nombre ILIKE '%garita norte%'        AND t.nombre = '12x12') OR
            (puestos_operativos.nombre ILIKE '%garita secundaria%'   AND t.nombre = '12x12') OR
            (puestos_operativos.nombre ILIKE '%control de acceso%'   AND t.nombre = '24x24') OR
            (puestos_operativos.nombre ILIKE '%ronda%'               AND t.nombre = '12x36') OR
            (puestos_operativos.nombre ILIKE '%bodega%'              AND t.nombre = '8 horas') OR
            (puestos_operativos.nombre ILIKE '%acceso vehicular%'    AND t.nombre = '12x12') OR
            (puestos_operativos.nombre ILIKE '%torre%'               AND t.nombre = '24x48') OR
            (puestos_operativos.nombre ILIKE '%recepci%'             AND t.nombre = '8 horas')
          )
      `);
      // Asignar turno genérico 12x12 a cualquier puesto que aún quede sin turno
      await pool.query(`
        UPDATE puestos_operativos
        SET tipo_turno_id     = (SELECT id FROM turnos WHERE nombre = '12x12' LIMIT 1),
            fecha_inicio_ciclo = '2026-01-01'
        WHERE activo = TRUE AND tipo_turno_id IS NULL
      `);
      logger.info("Auto-migrate: TRN-SEED-01 turnos asignados a puestos operativos");
    } else {
      logger.info("Auto-migrate: TRN-SEED-01 puestos ya tienen turno asignado");
    }
  } catch (err) {
    logger.error({ err }, "Auto-migrate: TRN-SEED-01 — error (no bloqueante)");
  }

  // ── CLI-001-SEED: garantizar cliente y usuario portal CLI-001 ────────────────────
  // Este bloque se omite si demo_seed_disabled=true (post-reset limpio)
  try {
    const { rows: seedFlagRows } = await pool.query(
      `SELECT value FROM system_config WHERE key = 'demo_seed_disabled' LIMIT 1`,
    );
    if (seedFlagRows[0]?.value === "true") {
      logger.info("Auto-migrate: CLI-001-SEED omitido (demo_seed_disabled=true)");
    } else {
    // a) Usuario portal cliente01
    const { rows: userCheck } = await pool.query(
      `SELECT id FROM users WHERE username = 'cliente01' LIMIT 1`,
    );
    if (userCheck.length === 0) {
      const portalHash = await bcrypt.hash("Cliente2024!", 10);
      await pool.query(
        `INSERT INTO users (username, password_hash, rol, cliente_id, nombre, correo, telefono)
         VALUES ('cliente01', $1, 'cliente', 'CLI-001', 'Cliente Distribuidora', 'contacto@distnac.gt', '50230001111')
         ON CONFLICT (username) DO NOTHING`,
        [portalHash],
      );
      logger.info("Auto-migrate: CLI-001-SEED usuario cliente01 creado");
    } else {
      logger.info("Auto-migrate: CLI-001-SEED usuario cliente01 ya existe");
    }

    // b) Cliente con portal_cliente_id='CLI-001'
    const { rows: cli001 } = await pool.query(
      `SELECT id FROM clients WHERE portal_cliente_id = 'CLI-001' LIMIT 1`,
    );
    if (cli001.length === 0) {
      // Verificar si existe "Distribuidora Nacional" sin portal_cliente_id
      const { rows: existing } = await pool.query(
        `SELECT id FROM clients WHERE LOWER(nombre) LIKE '%distribuidora%' LIMIT 1`,
      );
      if (existing.length > 0) {
        await pool.query(
          `UPDATE clients SET portal_cliente_id = 'CLI-001' WHERE id = $1`,
          [existing[0].id],
        );
        logger.info("Auto-migrate: CLI-001-SEED portal_cliente_id actualizado en cliente existente");
      } else {
        await pool.query(`
          INSERT INTO clients (nombre, nombre_comercial, nit, sector, estado, portal_cliente_id, notas)
          VALUES (
            'Distribuidora Nacional S.A.',
            'DistNac',
            'CF-004',
            'comercio',
            'activo',
            'CLI-001',
            'Vinculado al portal. Múltiples bodegas y rutas de distribución.'
          )
          ON CONFLICT (portal_cliente_id) DO NOTHING
        `);
        logger.info("Auto-migrate: CLI-001-SEED cliente Distribuidora Nacional creado con portal_cliente_id=CLI-001");
      }
    } else {
      logger.info("Auto-migrate: CLI-001-SEED portal_cliente_id CLI-001 ya existe");
    }
    } // end else (demoSeedDisabled === false)
  } catch (err) {
    logger.error({ err }, "Auto-migrate: CLI-001-SEED — error (no bloqueante)");
  }

  // ── EV-FIN-01: fecha_fin en eventos_rrhh para rangos (vacaciones, incapacidades) ──────────────────
  try {
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS fecha_fin DATE`);
    logger.info("Auto-migrate: EV-FIN-01 fecha_fin en eventos_rrhh verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: EV-FIN-01 — error (no bloqueante)");
  }

  // ── INC-01: tabla incentivos_cash_cobertura ───────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incentivos_cash_cobertura (
        id                SERIAL PRIMARY KEY,
        employee_id       INTEGER       NOT NULL,
        employee_nombre   VARCHAR(200)  NOT NULL,
        fecha             DATE          NOT NULL,
        cliente_id        INTEGER,
        cliente_nombre    VARCHAR(200),
        sede_id           INTEGER,
        puesto_id         INTEGER,
        puesto_nombre     VARCHAR(200),
        segmento_id       INTEGER,
        tipo              VARCHAR(50)   NOT NULL,
        monto             NUMERIC(10,2) NOT NULL,
        motivo            TEXT,
        autorizado_por    VARCHAR(100),
        pagado_por        VARCHAR(100),
        metodo_pago       VARCHAR(50),
        estado            VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
        observaciones     TEXT,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS inc_cash_employee_idx ON incentivos_cash_cobertura(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS inc_cash_fecha_idx     ON incentivos_cash_cobertura(fecha)`);
    logger.info("Auto-migrate: INC-01 tabla incentivos_cash_cobertura verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: INC-01 — error (no bloqueante)");
  }

  // ── SSA-MA-01: Tabla ssa_agentes para multi-agente SSA ────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ssa_agentes (
        id           SERIAL PRIMARY KEY,
        ssa_id       VARCHAR(30) NOT NULL REFERENCES solicitudes_servicio_adicional(id) ON DELETE CASCADE,
        employee_id  INTEGER NOT NULL REFERENCES employees(id),
        estado       VARCHAR(20) NOT NULL DEFAULT 'asignado',
        notas        TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ssa_agentes_ssa_id ON ssa_agentes(ssa_id)`);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ssa_agentes_ssa_emp_activo
      ON ssa_agentes(ssa_id, employee_id)
      WHERE estado = 'asignado'
    `);
    logger.info("Auto-migrate: SSA-MA-01 tabla ssa_agentes creada/verificada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-MA-01 — error (no bloqueante)");
  }

  // ── PF-02: Ampliar planificacion_futura para soportar SSA ─────────────────
  try {
    // Hacer puesto_id nullable para permitir planes SSA (sin puesto fijo)
    await pool.query(`ALTER TABLE planificacion_futura ALTER COLUMN puesto_id DROP NOT NULL`);
    await pool.query(`ALTER TABLE planificacion_futura ADD COLUMN IF NOT EXISTS ssa_id VARCHAR(30) REFERENCES solicitudes_servicio_adicional(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE planificacion_futura ADD COLUMN IF NOT EXISTS tipo_cobertura_futura TEXT NOT NULL DEFAULT 'relevo_ausencia'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pf_ssa_id ON planificacion_futura(ssa_id) WHERE ssa_id IS NOT NULL`);
    logger.info("Auto-migrate: PF-02 planificacion_futura ampliada para SSA (ssa_id + tipo_cobertura_futura)");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PF-02 — error (no bloqueante)");
  }

  // ── SP-01: Vista unificada servicios_programados_v ────────────────────────
  // Une clientes nuevos (inicio_cliente) y SSA pendientes/activos (ssa)
  // para dar una visión común de lo que está programado a futuro.
  try {
    await pool.query(`
      CREATE OR REPLACE VIEW servicios_programados_v AS
      -- Clientes nuevos con fecha de inicio futura o hoy
      SELECT
        'inicio_cliente'                  AS tipo,
        NULL                              AS ssa_id,
        NULL                              AS tipo_solicitud,
        c.id                              AS cliente_id,
        c.nombre                          AS cliente_nombre,
        c.nombre_comercial                AS cliente_nombre_comercial,
        c.sector,
        c.fecha_inicio_contrato           AS fecha_servicio,
        NULL                              AS descripcion,
        NULL                              AS hora_inicio,
        NULL                              AS hora_fin,
        NULL                              AS estado_ssa,
        c.created_at                      AS created_at
      FROM clients c
      WHERE c.fecha_inicio_contrato IS NOT NULL

      UNION ALL

      -- SSA no canceladas y no cubiertas
      SELECT
        'ssa'                             AS tipo,
        s.id                              AS ssa_id,
        s.tipo_solicitud,
        s.cliente_id,
        c.nombre                          AS cliente_nombre,
        c.nombre_comercial                AS cliente_nombre_comercial,
        c.sector,
        s.fecha                           AS fecha_servicio,
        s.descripcion,
        s.hora_inicio,
        s.hora_fin,
        s.estado_general                  AS estado_ssa,
        s.created_at
      FROM solicitudes_servicio_adicional s
      JOIN clients c ON c.id = s.cliente_id
      WHERE s.estado_general NOT IN ('cancelada', 'cubierta')
    `);
    logger.info("Auto-migrate: SP-01 vista servicios_programados_v verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SP-01 servicios_programados_v — error (no bloqueante)");
  }

  // ── VAC-01: Generar alertas de aniversario de vacaciones (30/15/7 días) ─────
  try {
    const { rows: proximosAniversarios } = await pool.query(`
      SELECT
        e.id AS employee_id,
        e.nombre_completo,
        (e.fecha_ingreso + INTERVAL '1 year')::date AS fecha_aniversario,
        ((e.fecha_ingreso + INTERVAL '1 year')::date - CURRENT_DATE)::int AS dias_restantes
      FROM employees e
      WHERE e.estado_laboral = 'activo'
        AND e.fecha_ingreso IS NOT NULL
        AND (e.fecha_ingreso + INTERVAL '1 year')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    `);

    let alertasGeneradas = 0;
    for (const emp of proximosAniversarios) {
      const d = emp.dias_restantes;
      if (![7, 15, 30].includes(d)) continue;

      // No duplicar: verificar si ya existe alerta activa del mismo tipo/empleado para esta fecha
      const { rows: existe } = await pool.query(`
        SELECT id FROM rrhh_alertas
        WHERE employee_id = $1
          AND tipo = 'aniversario_vacaciones'
          AND estado != 'resuelta'
          AND datos_clave LIKE $2
      `, [emp.employee_id, `%${emp.fecha_aniversario}%`]);

      if (existe.length > 0) continue;

      const prioridad = d <= 7 ? "alta" : d <= 15 ? "media" : "baja";
      const sugerencia = `${emp.nombre_completo} cumple 1 año el ${emp.fecha_aniversario} (en ${d} días). Programar vacaciones.`;

      await pool.query(`
        INSERT INTO rrhh_alertas (employee_id, employee_nombre, tipo, prioridad, estado, datos_clave, sugerencia)
        VALUES ($1, $2, 'aniversario_vacaciones', $3, 'nueva', $4, $5)
      `, [
        emp.employee_id,
        emp.nombre_completo,
        prioridad,
        JSON.stringify({ fecha_aniversario: emp.fecha_aniversario, dias_restantes: d }),
        sugerencia,
      ]);
      alertasGeneradas++;
    }
    if (alertasGeneradas > 0) {
      logger.info({ alertasGeneradas }, "VAC-01: alertas de aniversario de vacaciones generadas");
    }
  } catch (err) {
    logger.warn({ err }, "VAC-01: error al generar alertas de aniversario (no bloqueante)");
  }

  // ── VEH-01: Módulo de vehículos de supervisión ───────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehiculos (
        id                 SERIAL PRIMARY KEY,
        placa              VARCHAR(15) UNIQUE NOT NULL,
        tipo               VARCHAR(30) NOT NULL,
        marca              VARCHAR(50),
        modelo             VARCHAR(50),
        color              VARCHAR(30),
        anio               SMALLINT,
        estado             VARCHAR(20) NOT NULL DEFAULT 'activo',
        activo             BOOLEAN NOT NULL DEFAULT true,
        zona_operativa_id  INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL,
        observaciones      TEXT,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS vehiculos_zona ON vehiculos(zona_operativa_id)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehiculo_custodia (
        id                 SERIAL PRIMARY KEY,
        vehiculo_id        INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
        employee_id        INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        zona_operativa_id  INTEGER REFERENCES operational_zones(id) ON DELETE SET NULL,
        fecha_inicio       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fecha_fin          TIMESTAMPTZ,
        tipo_relevo        VARCHAR(20) NOT NULL DEFAULT 'manual',
        notas              TEXT,
        registrado_por     VARCHAR(100),
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS vc_vehiculo ON vehiculo_custodia(vehiculo_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS vc_employee ON vehiculo_custodia(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS vc_activa ON vehiculo_custodia(vehiculo_id) WHERE fecha_fin IS NULL`);
    logger.info("Auto-migrate: VEH-01 tablas vehiculos + vehiculo_custodia verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: VEH-01 — error (no bloqueante)");
  }

  // ── ARM-01: Módulo de Armería ──────────────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS armas (
        id            SERIAL PRIMARY KEY,
        codigo        VARCHAR(30) UNIQUE NOT NULL,
        tipo          VARCHAR(30) NOT NULL DEFAULT 'pistola',
        marca         VARCHAR(50),
        modelo        VARCHAR(50),
        calibre       VARCHAR(20),
        serie         VARCHAR(60),
        estado        VARCHAR(25) NOT NULL DEFAULT 'activo',
        activo        BOOLEAN NOT NULL DEFAULT true,
        puesto_id     INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        observaciones TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS armas_puesto ON armas(puesto_id)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arma_custodia (
        id             SERIAL PRIMARY KEY,
        arma_id        INTEGER NOT NULL REFERENCES armas(id) ON DELETE CASCADE,
        employee_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        puesto_id      INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        fecha_inicio   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fecha_fin      TIMESTAMPTZ,
        tipo_origen    VARCHAR(30) NOT NULL DEFAULT 'turno_normal',
        notas          TEXT,
        registrado_por VARCHAR(100),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ac_arma ON arma_custodia(arma_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS ac_employee ON arma_custodia(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS ac_activa ON arma_custodia(arma_id) WHERE fecha_fin IS NULL`);
    logger.info("Auto-migrate: ARM-01 tablas armas + arma_custodia verificadas/creadas");

    // Seed de armas de muestra y asignación automática (omitido si demo_seed_disabled=true)
    const { rows: _sflagA } = await pool.query(
      `SELECT value FROM system_config WHERE key = 'demo_seed_disabled' LIMIT 1`,
    );
    const _seedDisabledA = _sflagA[0]?.value === "true";
    const { rows: cntArmas } = await pool.query(`SELECT COUNT(*) AS c FROM armas`);
    if (!_seedDisabledA && parseInt(cntArmas[0].c) === 0) {
      // Tomar los primeros 4 puestos activos con agente asignado
      const { rows: puestos } = await pool.query(
        `SELECT id FROM puestos_operativos WHERE activo=TRUE AND agente_id IS NOT NULL ORDER BY id LIMIT 4`
      );
      const seedArmas = [
        { codigo: "A-001", tipo: "pistola",  marca: "Glock",   modelo: "17",   calibre: "9mm",    serie: "ISP-SN-001" },
        { codigo: "A-002", tipo: "pistola",  marca: "Beretta", modelo: "92FS", calibre: "9mm",    serie: "ISP-SN-002" },
        { codigo: "A-003", tipo: "revolver", marca: "Taurus",  modelo: "85",   calibre: ".38 SPL",serie: "ISP-SN-003" },
        { codigo: "A-004", tipo: "escopeta", marca: "Mossberg",modelo: "500",  calibre: "12 GA",  serie: "ISP-SN-004" },
      ];
      for (let i = 0; i < seedArmas.length; i++) {
        const a = seedArmas[i];
        const pId = puestos[i]?.id ?? null;
        await pool.query(
          `INSERT INTO armas (codigo, tipo, marca, modelo, calibre, serie, puesto_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (codigo) DO NOTHING`,
          [a.codigo, a.tipo, a.marca, a.modelo, a.calibre, a.serie, pId]
        );
      }
      logger.info("Auto-seed: ARM-01 armas de muestra insertadas");
    }

    // ARM-01-FILL: asignar pistola a todos los puestos activos que no tengan arma (omitido si demo_seed_disabled)
    if (!_seedDisabledA) {
      const { rowCount: fillCount } = await pool.query(`
        INSERT INTO armas (codigo, tipo, marca, modelo, calibre, puesto_id)
        SELECT
          'P-' || LPAD(po.id::text, 3, '0'),
          'pistola',
          'Glock',
          '17',
          '9mm',
          po.id
        FROM puestos_operativos po
        WHERE po.activo = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM armas a WHERE a.puesto_id = po.id AND a.activo = TRUE
          )
        ON CONFLICT (codigo) DO NOTHING
      `);
      if ((fillCount ?? 0) > 0) {
        logger.info(`Auto-seed: ARM-01-FILL ${fillCount} pistolas asignadas a puestos sin arma`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Auto-migrate: ARM-01 — error (no bloqueante)");
  }

  // ── PT-01: tabla puesto_titulares — multi-titular por puesto ─────────────────
  // Soporta: 24x24 (2 titulares), 24x48 (2), 24x72 (2), 8x8 (2), 12x12 (1)
  // Cada titular tiene su propia fecha_inicio_ciclo para el motor de ciclos.
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS puesto_titulares (
        id                SERIAL PRIMARY KEY,
        puesto_id         INTEGER  NOT NULL REFERENCES puestos_operativos(id) ON DELETE CASCADE,
        employee_id       INTEGER  NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        orden             SMALLINT NOT NULL DEFAULT 1,
        fecha_inicio_ciclo DATE,
        activo            BOOLEAN  NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (puesto_id, employee_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pt_puesto   ON puesto_titulares(puesto_id)   WHERE activo = TRUE`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pt_employee ON puesto_titulares(employee_id) WHERE activo = TRUE`);
    logger.info("Auto-migrate: PT-01 tabla puesto_titulares verificada/creada");

    // PT-02: seed inicial desde puestos_operativos activos (puestos sin " Par B")
    // Idempotente: solo corre si la tabla está vacía.
    const { rows: ptCount } = await pool.query(`SELECT COUNT(*) AS c FROM puesto_titulares`);
    if (parseInt(ptCount[0].c) === 0) {
      await pool.query(`
        INSERT INTO puesto_titulares (puesto_id, employee_id, orden, fecha_inicio_ciclo)
        SELECT po.id, po.titular_employee_id, 1, po.fecha_inicio_ciclo
        FROM puestos_operativos po
        WHERE po.activo = TRUE
          AND po.titular_employee_id IS NOT NULL
          AND po.nombre NOT ILIKE '% Par B'
        ON CONFLICT DO NOTHING
      `);
      logger.info("Auto-migrate: PT-02 seed titulares orden=1 desde puestos_operativos completado");
    }
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PT-01 puesto_titulares — error (no bloqueante)");
  }

  // DEL-01: tabla de solicitudes de eliminación
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_eliminacion (
        id                   SERIAL PRIMARY KEY,
        entidad              VARCHAR(50)  NOT NULL,
        entidad_id           INTEGER      NOT NULL,
        entidad_descripcion  TEXT         NOT NULL,
        motivo               TEXT         NOT NULL,
        solicitante_username VARCHAR(100) NOT NULL,
        estado               VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
        revisado_por         VARCHAR(100),
        revisado_at          TIMESTAMPTZ,
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auto-migrate: DEL-01 tabla solicitudes_eliminacion verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: DEL-01 — error (no bloqueante)");
  }

  // ARM-02: campos documentales de tenencia en armas
  try {
    await pool.query(`ALTER TABLE armas ADD COLUMN IF NOT EXISTS numero_tenencia TEXT`);
    await pool.query(`ALTER TABLE armas ADD COLUMN IF NOT EXISTS fecha_vencimiento_tenencia DATE`);
    logger.info("Auto-migrate: ARM-02 campos de tenencia en armas verificados/creados");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: ARM-02 — error (no bloqueante)");
  }

  // CUST-01: tabla de auditoría de sincronizaciones de custodia al cierre
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custodia_sync_log (
        id                       SERIAL PRIMARY KEY,
        cierre_id                INTEGER REFERENCES cierre_operativo_diario(id),
        fecha                    DATE NOT NULL,
        tipo_activo              TEXT NOT NULL CHECK (tipo_activo IN ('arma','vehiculo')),
        activo_id                INTEGER NOT NULL,
        activo_codigo            TEXT,
        custodio_anterior_id     INTEGER,
        custodio_anterior_nombre TEXT,
        custodio_nuevo_id        INTEGER,
        custodio_nuevo_nombre    TEXT,
        referencia_nombre        TEXT,
        origen                   TEXT NOT NULL DEFAULT 'cierre_operativo',
        usuario                  TEXT,
        usuario_id               INTEGER,
        creado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_csl_cierre  ON custodia_sync_log(cierre_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_csl_fecha   ON custodia_sync_log(fecha)`);
    logger.info("Auto-migrate: CUST-01 tabla custodia_sync_log verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: CUST-01 custodia_sync_log — error (no bloqueante)");
  }

  // CUST-02: campo tipo_puesto en puestos_operativos
  try {
    await pool.query(`
      ALTER TABLE puestos_operativos
        ADD COLUMN IF NOT EXISTS tipo_puesto VARCHAR(20) NOT NULL DEFAULT 'normal'
    `);
    await pool.query(`
      ALTER TABLE puestos_operativos
        DROP CONSTRAINT IF EXISTS chk_tipo_puesto
    `);
    await pool.query(`
      ALTER TABLE puestos_operativos
        ADD CONSTRAINT chk_tipo_puesto CHECK (tipo_puesto IN ('normal','custodia'))
    `);
    logger.info("Auto-migrate: CUST-02 tipo_puesto en puestos_operativos verificado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: CUST-02 tipo_puesto — error (no bloqueante)");
  }

  // SAL-01: Control de cambios salariales por asignación de puesto
  try {
    await pool.query(`ALTER TABLE puestos_operativos ADD COLUMN IF NOT EXISTS salario_puesto NUMERIC(12,2)`);
    logger.info("Auto-migrate: SAL-01 salario_puesto en puestos_operativos verificado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SAL-01 salario_puesto — error (no bloqueante)");
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cambios_salariales (
        id                    SERIAL PRIMARY KEY,
        movimiento_id         INTEGER REFERENCES movimientos_operativos(id) ON DELETE SET NULL,
        employee_id           INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        empleado_nombre       VARCHAR(255) NOT NULL,
        puesto_id             INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        puesto_nombre         VARCHAR(255),
        cliente_nombre        VARCHAR(255),
        fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
        salario_actual        NUMERIC(12,2) NOT NULL,
        salario_puesto        NUMERIC(12,2) NOT NULL,
        diferencia            NUMERIC(12,2) NOT NULL,
        tipo_impacto          VARCHAR(20) NOT NULL CHECK (tipo_impacto IN ('aumento','disminucion')),
        estado                VARCHAR(30) NOT NULL DEFAULT 'pendiente_rrhh'
                              CHECK (estado IN ('pendiente_rrhh','aprobado','rechazado','modificado')),
        valor_aprobado        NUMERIC(12,2),
        rrhh_notas            TEXT,
        rrhh_usuario          VARCHAR(100),
        rrhh_resuelto_at      TIMESTAMPTZ,
        operacion_usuario     VARCHAR(100),
        tipo_movimiento       VARCHAR(30),
        snapshot_puesto       JSONB,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cs_employee  ON cambios_salariales(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cs_estado    ON cambios_salariales(estado)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cs_fecha     ON cambios_salariales(fecha)`);
    logger.info("Auto-migrate: SAL-01 tabla cambios_salariales verificada/creada");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SAL-01 cambios_salariales — error (no bloqueante)");
  }

  // NRRHH-01: Flujo de revisión de incidencias RRHH — columnas en novedades + eventos
  try {
    await pool.query(`ALTER TABLE novedades_nomina_diarias ADD COLUMN IF NOT EXISTS impacto_nomina VARCHAR(30)`);
    await pool.query(`ALTER TABLE novedades_nomina_diarias ADD COLUMN IF NOT EXISTS requiere_revision_rrhh BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE novedades_nomina_diarias ADD COLUMN IF NOT EXISTS evento_rrhh_id INTEGER REFERENCES eventos_rrhh(id) ON DELETE SET NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_nnd_revision ON novedades_nomina_diarias(requiere_revision_rrhh, impacto_nomina) WHERE requiere_revision_rrhh = TRUE`);
    logger.info("Auto-migrate: NRRHH-01 columnas novedades_nomina_diarias verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: NRRHH-01 novedades — error (no bloqueante)");
  }

  try {
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS tipo_resolucion VARCHAR(50)`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS afecta_nomina BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS cantidad_horas NUMERIC(5,2)`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS cantidad_dias NUMERIC(5,2)`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS afecta_septimo_res BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS rrhh_resuelto_por VARCHAR(100)`);
    await pool.query(`ALTER TABLE eventos_rrhh ADD COLUMN IF NOT EXISTS rrhh_resuelto_at TIMESTAMPTZ`);
    logger.info("Auto-migrate: NRRHH-01 columnas eventos_rrhh verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: NRRHH-01 eventos_rrhh — error (no bloqueante)");
  }

  // ── SSA-CAN-01: columnas de cancelación en solicitudes_servicio_adicional ─────
  try {
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(100)`);
    await pool.query(`ALTER TABLE solicitudes_servicio_adicional ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ`);
    logger.info("Auto-migrate: SSA-CAN-01 columnas cancelación verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SSA-CAN-01 — error (no bloqueante)");
  }

  // ── SEP-01: columnas de séptimo día en eventos_rrhh, planilla_lineas y planillas ─────────────
  // impacto_septimo: nivel de impacto que decide RRHH (mantiene/pierde/proporcional)
  // desc_septimo: descuento efectivo aplicado en la línea de planilla
  // total_desc_septimo: suma de desc_septimo en el encabezado de planilla
  try {
    await pool.query(`ALTER TABLE eventos_rrhh      ADD COLUMN IF NOT EXISTS impacto_septimo     VARCHAR(20) DEFAULT 'pierde'`);
    await pool.query(`ALTER TABLE planilla_lineas   ADD COLUMN IF NOT EXISTS desc_septimo        NUMERIC(10,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE planillas         ADD COLUMN IF NOT EXISTS total_desc_septimo  NUMERIC(12,2) DEFAULT 0`);
    logger.info("Auto-migrate: SEP-01 columnas séptimo día verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: SEP-01 — error (no bloqueante)");
  }

  // ── PLAN-CUN-01: índice parcial en pre_planilla_cierres para permitir re-cierre tras anulación ──
  // Reemplaza el UNIQUE constraint global por uno que solo bloquea (periodo_desde, periodo_hasta)
  // cuando anulado = FALSE. Permite crear un nuevo cierre para el mismo período si el anterior
  // fue anulado. Sin este índice, anular y re-cerrar falla con duplicate key.
  try {
    await pool.query(`ALTER TABLE pre_planilla_cierres DROP CONSTRAINT IF EXISTS pre_planilla_cierres_periodo_desde_periodo_hasta_key`);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cierres_periodo_unico
      ON pre_planilla_cierres (periodo_desde, periodo_hasta)
      WHERE anulado = FALSE
    `);
    logger.info("Auto-migrate: PLAN-CUN-01 índice parcial en pre_planilla_cierres verificado/creado");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PLAN-CUN-01 — error (no bloqueante)");
  }

  // ── IGSS-02: columnas de totales IGSS en planillas ───────────────────────────
  // total_igss_trabajador: suma de descuentos IGSS trabajador (4.83%) de todas las líneas
  // total_igss_patronal:   suma de cuota patronal IGSS (12.67%) — costo empresa, no es descuento
  // Ambas vienen del cálculo en planilla.ts (calcularLinea). La elegibilidad IGSS se
  // determina al momento de generar la planilla desde el estado actual de employees y puestos_operativos.
  try {
    await pool.query(`ALTER TABLE planillas ADD COLUMN IF NOT EXISTS total_igss_trabajador NUMERIC(12,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE planillas ADD COLUMN IF NOT EXISTS total_igss_patronal   NUMERIC(12,2) NOT NULL DEFAULT 0`);
    logger.info("Auto-migrate: IGSS-02 columnas totales IGSS en planillas verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: IGSS-02 — error (no bloqueante)");
  }

  // ── BONO-01: bonificación incentivo Decreto 78-89 en planilla_lineas y planillas ──────────────
  // bonificacion_incentivo en línea: Q125/quincena, Q250/mensual segunda quincena
  // No aplica IGSS (Decreto 78-89, Art. 7 — es un beneficio laboral adicional al salario base)
  try {
    await pool.query(`ALTER TABLE planilla_lineas ADD COLUMN IF NOT EXISTS bonificacion_incentivo NUMERIC(10,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE planillas       ADD COLUMN IF NOT EXISTS total_bonificacion_incentivo NUMERIC(12,2) NOT NULL DEFAULT 0`);
    logger.info("Auto-migrate: BONO-01 columnas bonificación incentivo verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: BONO-01 — error (no bloqueante)");
  }

  // ── PREST-01: Módulo de Prestaciones Laborales (Guatemala) ──────────────────────
  // Tablas para aguinaldo, bono14, vacaciones, indemnización, liquidación y provisiones.
  // Toda la lógica de cálculo está en prestaciones-calc.ts; estas tablas solo persisten.
  try {
    // Configuración por empresa/cliente
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prestaciones_config (
        id                           SERIAL PRIMARY KEY,
        client_id                    INTEGER,
        aguinaldo_base               VARCHAR(30)  NOT NULL DEFAULT 'salario_actual',
        bono14_base                  VARCHAR(30)  NOT NULL DEFAULT 'promedio_periodo',
        vacaciones_dias_primer_anio  INTEGER      NOT NULL DEFAULT 15,
        vacaciones_dias_quinquenio   INTEGER      NOT NULL DEFAULT 20,
        vacaciones_dias_elegibilidad INTEGER      NOT NULL DEFAULT 150,
        indemnizacion_solo_legal     BOOLEAN      NOT NULL DEFAULT TRUE,
        redondeo_decimales           INTEGER      NOT NULL DEFAULT 2,
        activo                       BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Índice único para evitar configuraciones duplicadas por client_id (admite NULL)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_prestaciones_config_client
      ON prestaciones_config (COALESCE(client_id, 0))
    `);

    // Acumulados anuales por empleado y tipo
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prestaciones_acumulados (
        id               SERIAL PRIMARY KEY,
        employee_id      INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        tipo             VARCHAR(30)  NOT NULL,
        anio             INTEGER      NOT NULL,
        dias_acumulados  NUMERIC(10,4) NOT NULL DEFAULT 0,
        monto_acumulado  NUMERIC(12,2) NOT NULL DEFAULT 0,
        monto_pagado     NUMERIC(12,2) NOT NULL DEFAULT 0,
        monto_pendiente  NUMERIC(12,2) NOT NULL DEFAULT 0,
        UNIQUE(employee_id, tipo, anio)
      )
    `);

    // Historial completo de movimientos (trazabilidad total)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prestaciones_movimientos (
        id                    SERIAL PRIMARY KEY,
        employee_id           INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        empleado_nombre       TEXT,
        tipo_prestacion       VARCHAR(30)  NOT NULL,
        subtipo               VARCHAR(30),
        periodo_inicio        DATE,
        periodo_fin           DATE,
        fecha_calculo         DATE         NOT NULL DEFAULT CURRENT_DATE,
        base_calculo          TEXT,
        monto                 NUMERIC(12,2) NOT NULL,
        dias_base             NUMERIC(10,4),
        dias_aplicados        NUMERIC(10,4),
        salario_referencia    NUMERIC(12,2),
        promedio_referencia   NUMERIC(12,2),
        origen                VARCHAR(60),
        referencia_origen_id  INTEGER,
        observaciones         TEXT,
        version_calculo       INTEGER      NOT NULL DEFAULT 1,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Provisiones periódicas (idempotentes por unique constraint)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prestaciones_provisiones (
        id                  SERIAL PRIMARY KEY,
        periodo_desde       DATE         NOT NULL,
        periodo_hasta       DATE         NOT NULL,
        tipo                VARCHAR(30)  NOT NULL,
        employee_id         INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        empleado_nombre     TEXT,
        sede                TEXT,
        puesto              TEXT,
        client_id           INTEGER,
        dias_periodo        NUMERIC(10,4),
        salario_referencia  NUMERIC(12,2),
        monto_provision     NUMERIC(12,2) NOT NULL,
        observaciones       TEXT,
        generado_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(periodo_desde, periodo_hasta, tipo, employee_id)
      )
    `);

    // Liquidaciones finales (encabezado)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prestaciones_liquidaciones (
        id                      SERIAL PRIMARY KEY,
        employee_id             INTEGER      NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        empleado_nombre         TEXT,
        fecha_egreso            DATE         NOT NULL,
        causal_egreso           VARCHAR(40)  NOT NULL,
        fecha_ingreso           DATE         NOT NULL,
        anios_servicio          NUMERIC(10,4),
        dias_servicio           INTEGER,
        salario_actual          NUMERIC(12,2),
        promedio_salario        NUMERIC(12,2),
        total_salario_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_vacaciones        NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_aguinaldo         NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_bono14            NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_indemnizacion     NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_otros             NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_general           NUMERIC(12,2) NOT NULL DEFAULT 0,
        estado                  VARCHAR(20)  NOT NULL DEFAULT 'confirmada',
        simulacion              BOOLEAN      NOT NULL DEFAULT FALSE,
        observaciones           TEXT,
        version                 INTEGER      NOT NULL DEFAULT 1,
        created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Detalle por rubro de cada liquidación
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prestaciones_liquidacion_detalle (
        id                  SERIAL PRIMARY KEY,
        liquidacion_id      INTEGER      NOT NULL REFERENCES prestaciones_liquidaciones(id) ON DELETE CASCADE,
        rubro               VARCHAR(40)  NOT NULL,
        descripcion         TEXT,
        periodo_inicio      DATE,
        periodo_fin         DATE,
        dias_base           NUMERIC(10,4),
        salario_referencia  NUMERIC(12,2),
        monto               NUMERIC(12,2) NOT NULL,
        base_calculo        TEXT,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Saldo de vacaciones por empleado (tabla de estado actual)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vacaciones_saldos (
        id                        SERIAL PRIMARY KEY,
        employee_id               INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        dias_ganados              NUMERIC(10,4) NOT NULL DEFAULT 0,
        dias_gozados              NUMERIC(10,4) NOT NULL DEFAULT 0,
        dias_disponibles          NUMERIC(10,4) NOT NULL DEFAULT 0,
        dias_pendientes_pago      NUMERIC(10,4) NOT NULL DEFAULT 0,
        fecha_ultima_actualizacion TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(employee_id)
      )
    `);

    // Movimientos de vacaciones (histórico detallado)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vacaciones_movimientos (
        id             SERIAL PRIMARY KEY,
        employee_id    INTEGER      NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        tipo           VARCHAR(20)  NOT NULL,
        dias           NUMERIC(10,4) NOT NULL,
        fecha          DATE         NOT NULL,
        periodo_inicio DATE,
        periodo_fin    DATE,
        referencia     TEXT,
        observaciones  TEXT,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Índices de performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prest_mov_employee   ON prestaciones_movimientos(employee_id, tipo_prestacion)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prest_prov_periodo   ON prestaciones_provisiones(periodo_desde, periodo_hasta, tipo)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prest_liq_employee   ON prestaciones_liquidaciones(employee_id, estado)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vac_mov_employee     ON vacaciones_movimientos(employee_id, fecha)`);

    logger.info("Auto-migrate: PREST-01 tablas de prestaciones creadas/verificadas (8 tablas)");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PREST-01 — error (no bloqueante)");
  }

  // ── BJ-01: columnas fecha_baja y motivo_baja en employees ──────────────────────
  try {
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS fecha_baja DATE`);
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS motivo_baja VARCHAR(100)`);
    logger.info("Auto-migrate: BJ-01 columnas fecha_baja/motivo_baja en employees verificadas/creadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: BJ-01 — error (no bloqueante)");
  }

  // ── PESP-01: Planillas Especiales (Bono 14 y Aguinaldo) ──────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planillas_especiales (
        id                  SERIAL PRIMARY KEY,
        tipo                VARCHAR(20)   NOT NULL CHECK (tipo IN ('bono14', 'aguinaldo')),
        anio                INTEGER       NOT NULL,
        periodo_inicio      DATE          NOT NULL,
        periodo_fin         DATE          NOT NULL,
        num_pagos           INTEGER       NOT NULL DEFAULT 1 CHECK (num_pagos BETWEEN 1 AND 3),
        estado              VARCHAR(20)   NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador', 'aprobada', 'completada', 'anulada')),
        total_colaboradores INTEGER       NOT NULL DEFAULT 0,
        total_bruto         NUMERIC(14,2) NOT NULL DEFAULT 0,
        generado_por        TEXT,
        observaciones       TEXT,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS planillas_especiales_lineas (
        id                    SERIAL PRIMARY KEY,
        planilla_especial_id  INTEGER       NOT NULL REFERENCES planillas_especiales(id) ON DELETE CASCADE,
        employee_id           INTEGER       REFERENCES employees(id) ON DELETE SET NULL,
        nombre_completo       TEXT          NOT NULL,
        puesto                TEXT,
        sede                  TEXT,
        cliente               TEXT,
        fecha_ingreso         DATE          NOT NULL,
        fecha_egreso_emp      DATE,
        dias_periodo_total    INTEGER       NOT NULL,
        dias_laborados        INTEGER       NOT NULL,
        salario_referencia    NUMERIC(12,2) NOT NULL,
        monto_total           NUMERIC(12,2) NOT NULL,
        monto_ya_pagado       NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS planillas_especiales_pagos (
        id                    SERIAL PRIMARY KEY,
        planilla_especial_id  INTEGER       NOT NULL REFERENCES planillas_especiales(id) ON DELETE CASCADE,
        numero_pago           INTEGER       NOT NULL CHECK (numero_pago >= 1),
        porcentaje            NUMERIC(6,2)  NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
        fecha_programada      DATE,
        estado                VARCHAR(20)   NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN ('pendiente', 'pagado')),
        total_este_pago       NUMERIC(14,2) NOT NULL DEFAULT 0,
        pagado_por            TEXT,
        pagado_at             TIMESTAMPTZ,
        observaciones         TEXT,
        created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (planilla_especial_id, numero_pago)
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pesp_lineas_employee
      ON planillas_especiales_lineas(employee_id, planilla_especial_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pesp_pagos_estado
      ON planillas_especiales_pagos(planilla_especial_id, estado)`);
    await pool.query(`DROP INDEX IF EXISTS planillas_especiales_tipo_anio_key`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_planillas_esp_tipo_anio_activa
      ON planillas_especiales(tipo, anio) WHERE estado != 'anulada'`);

    logger.info("Auto-migrate: PESP-01 tablas planillas_especiales creadas/verificadas");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: PESP-01 — error (no bloqueante)");
  }

  // ── BDG-01: Módulo de Bodega / Inventario ────────────────────────────────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bodega_categorias (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(80)  NOT NULL,
        descripcion TEXT,
        activo      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bodega_articulos (
        id               SERIAL PRIMARY KEY,
        categoria_id     INTEGER REFERENCES bodega_categorias(id) ON DELETE SET NULL,
        nombre           VARCHAR(120) NOT NULL,
        descripcion      TEXT,
        codigo_prefijo   VARCHAR(6)   NOT NULL,
        tipo_rastreo     VARCHAR(20)  NOT NULL DEFAULT 'seriado',
        tipo_asignacion  VARCHAR(20)  NOT NULL DEFAULT 'colaborador',
        activo           BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ba_cat ON bodega_articulos(categoria_id)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bodega_unidades (
        id                SERIAL PRIMARY KEY,
        articulo_id       INTEGER NOT NULL REFERENCES bodega_articulos(id) ON DELETE RESTRICT,
        codigo_inventario VARCHAR(30) UNIQUE NOT NULL,
        numero_serie      VARCHAR(80),
        condicion         VARCHAR(20) NOT NULL DEFAULT 'bueno',
        estado            VARCHAR(30) NOT NULL DEFAULT 'disponible',
        puesto_id         INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        employee_id       INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        notas             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS bu_art  ON bodega_unidades(articulo_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS bu_psto ON bodega_unidades(puesto_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS bu_emp  ON bodega_unidades(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS bu_est  ON bodega_unidades(estado)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bodega_movimientos (
        id                SERIAL PRIMARY KEY,
        unidad_id         INTEGER NOT NULL REFERENCES bodega_unidades(id) ON DELETE CASCADE,
        tipo              VARCHAR(30) NOT NULL,
        puesto_id         INTEGER REFERENCES puestos_operativos(id) ON DELETE SET NULL,
        employee_id       INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        condicion_antes   VARCHAR(20),
        condicion_despues VARCHAR(20),
        notas             TEXT,
        registrado_por    VARCHAR(100),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS bm_unid ON bodega_movimientos(unidad_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS bm_date ON bodega_movimientos(created_at DESC)`);
    logger.info("Auto-migrate: BDG-01 tablas bodega creadas/verificadas (4 tablas)");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: BDG-01 — error (no bloqueante)");
  }

  // ── DOT-01: Dotación / Kit de Ingreso / Órdenes de Compra ──────────────────
  try {
    // Extender tablas existentes (columnas opcionales, no rompen nada)
    await pool.query(`ALTER TABLE bodega_articulos ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS num_puestos INTEGER`);
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS tipo_jornada VARCHAR(30)`);

    // Artículos de dotación vinculados a un lead comercial
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_dotacion_items (
        id                  SERIAL PRIMARY KEY,
        lead_id             INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        articulo_id         INTEGER REFERENCES bodega_articulos(id) ON DELETE SET NULL,
        nombre_articulo     VARCHAR(200) NOT NULL,
        es_equipo_personal  BOOLEAN NOT NULL DEFAULT FALSE,
        cantidad_por_puesto NUMERIC(8,2) NOT NULL DEFAULT 1,
        costo_unitario      NUMERIC(12,2) NOT NULL DEFAULT 0,
        notas               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS ldi_lead ON lead_dotacion_items(lead_id)`);

    // Kit global de ingreso (configuración única, todos los empleados nuevos lo reciben)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kit_ingreso_items (
        id              SERIAL PRIMARY KEY,
        articulo_id     INTEGER REFERENCES bodega_articulos(id) ON DELETE SET NULL,
        nombre_articulo VARCHAR(200) NOT NULL,
        cantidad        INTEGER NOT NULL DEFAULT 1,
        activo          BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Dotaciones pendientes de entrega a empleados nuevos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dotacion_pendiente (
        id          SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        lead_id     INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        estado      VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        notas       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS dp_emp ON dotacion_pendiente(employee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS dp_est ON dotacion_pendiente(estado)`);

    // Ítems individuales de cada dotación pendiente
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dotacion_pendiente_items (
        id              SERIAL PRIMARY KEY,
        dotacion_id     INTEGER NOT NULL REFERENCES dotacion_pendiente(id) ON DELETE CASCADE,
        articulo_id     INTEGER REFERENCES bodega_articulos(id) ON DELETE SET NULL,
        nombre_articulo VARCHAR(200) NOT NULL,
        cantidad        INTEGER NOT NULL DEFAULT 1,
        entregado       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS dpi_dot ON dotacion_pendiente_items(dotacion_id)`);

    // Órdenes de compra generadas cuando falta stock para un contrato
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ordenes_compra (
        id         SERIAL PRIMARY KEY,
        lead_id    INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        cliente_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        estado     VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        total      NUMERIC(14,2) NOT NULL DEFAULT 0,
        notas      TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS oc_lead ON ordenes_compra(lead_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS oc_est  ON ordenes_compra(estado)`);

    // Ítems de cada orden de compra
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ordenes_compra_items (
        id              SERIAL PRIMARY KEY,
        orden_id        INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
        articulo_id     INTEGER REFERENCES bodega_articulos(id) ON DELETE SET NULL,
        nombre_articulo VARCHAR(200) NOT NULL,
        cantidad        INTEGER NOT NULL DEFAULT 1,
        costo_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS oci_ord ON ordenes_compra_items(orden_id)`);

    logger.info("Auto-migrate: DOT-01 tablas dotación, kit ingreso, órdenes de compra (7 tablas + 3 columnas nuevas)");
  } catch (err) {
    logger.error({ err }, "Auto-migrate: DOT-01 — error (no bloqueante)");
  }

  logger.info("Auto-seed completado");
}
