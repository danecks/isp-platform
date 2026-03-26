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

  logger.info("Auto-seed completado");
}
