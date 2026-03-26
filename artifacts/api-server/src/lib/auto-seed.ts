import { db, usersTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const SALT_ROUNDS = 10;

const SEED_USERS = [
  {
    nombre: "Daniel Administrador",
    username: "dan2336",
    correo: "dan@isp.gt",
    password: "1234",
    rol: "admin" as const,
    telefono: "50220001111",
  },
  {
    nombre: "Administrador ISP",
    username: "admin",
    correo: "admin@isp.gt",
    password: "Admin2024!",
    rol: "admin" as const,
    telefono: "50220001100",
  },
  {
    nombre: "Carlos Operaciones",
    username: "ops01",
    correo: "carlos.ops@isp.gt",
    password: "Ops2024!",
    rol: "operaciones" as const,
    telefono: "50220002222",
  },
  {
    nombre: "María Recursos Humanos",
    username: "rrhh01",
    correo: "maria.rrhh@isp.gt",
    password: "RRHH2024!",
    rol: "rrhh" as const,
    telefono: "50220003333",
  },
  {
    nombre: "Roberto Comercial",
    username: "comercial01",
    correo: "roberto.comercial@isp.gt",
    password: "Comercial2024!",
    rol: "comercial" as const,
    telefono: "50220004444",
  },
  {
    nombre: "Supervisor García",
    username: "supervisor01",
    correo: "garcia.sup@isp.gt",
    password: "Supervisor2024!",
    rol: "supervisor" as const,
    telefono: "50220005555",
  },
  {
    nombre: "Cliente Distribuidora",
    username: "cliente01",
    correo: "contacto@distnac.gt",
    password: "Cliente2024!",
    rol: "cliente" as const,
    telefono: "50230001111",
    clienteId: "CLI-001",
  },
];

export async function runAutoSeed(): Promise<void> {
  try {
    const [{ total }] = await db
      .select({ total: count() })
      .from(usersTable);

    if (Number(total) > 0) {
      logger.info({ usersCount: total }, "Auto-seed: usuarios ya existen, omitiendo");
      return;
    }

    logger.info("Auto-seed: tabla usuarios vacía — creando usuarios iniciales...");

    for (const u of SEED_USERS) {
      const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
      await db.insert(usersTable).values({
        nombre: u.nombre,
        username: u.username,
        correo: u.correo,
        passwordHash,
        rol: u.rol,
        estado: "activo",
        telefono: u.telefono ?? null,
        clienteId: (u as any).clienteId ?? null,
      });
      logger.info({ username: u.username, rol: u.rol }, "Auto-seed: usuario creado");
    }

    logger.info("Auto-seed completado — 7 usuarios listos");
  } catch (err) {
    logger.error({ err }, "Auto-seed falló — continuando de todas formas");
  }
}
