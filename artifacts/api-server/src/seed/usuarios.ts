import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

const testUsers = [
  {
    nombre: "Daniel Administrador",
    username: "dan2336",
    correo: "dan@isp.gt",
    password: "1234",
    rol: "admin",
    telefono: "50220001111",
  },
  {
    nombre: "Administrador ISP",
    username: "admin",
    correo: "admin@isp.gt",
    password: "Admin2024!",
    rol: "admin",
    telefono: "50220001100",
  },
  {
    nombre: "Carlos Operaciones",
    username: "ops01",
    correo: "carlos.ops@isp.gt",
    password: "Ops2024!",
    rol: "operaciones",
    telefono: "50220002222",
  },
  {
    nombre: "María Recursos Humanos",
    username: "rrhh01",
    correo: "maria.rrhh@isp.gt",
    password: "RRHH2024!",
    rol: "rrhh",
    telefono: "50220003333",
  },
  {
    nombre: "Roberto Comercial",
    username: "comercial01",
    correo: "roberto.comercial@isp.gt",
    password: "Comercial2024!",
    rol: "comercial",
    telefono: "50220004444",
  },
  {
    nombre: "Supervisor García",
    username: "supervisor01",
    correo: "garcia.sup@isp.gt",
    password: "Supervisor2024!",
    rol: "supervisor",
    telefono: "50220005555",
  },
  {
    nombre: "Cliente Distribuidora",
    username: "cliente01",
    correo: "contacto@distnac.gt",
    password: "Cliente2024!",
    rol: "cliente",
    telefono: "50230001111",
    clienteId: "CLI-001",
  },
];

async function seedUsers() {
  console.log("👤 Iniciando seed de usuarios ISP, S.A. ...");

  for (const u of testUsers) {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, u.username))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭️  Usuario '${u.username}' ya existe, actualizando contraseña...`);
      const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
      await db
        .update(usersTable)
        .set({ passwordHash, nombre: u.nombre, rol: u.rol, estado: "activo", updatedAt: new Date() })
        .where(eq(usersTable.username, u.username));
    } else {
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
      console.log(`  ✅ Usuario '${u.username}' (${u.rol}) creado`);
    }
  }

  console.log("\n🎉 Usuarios de prueba listos:");
  console.log("  admin      dan2336 / 1234           (Administrador)");
  console.log("  admin      admin / Admin2024!        (Administrador ISP)");
  console.log("  operaciones ops01 / Ops2024!         (Carlos Operaciones)");
  console.log("  rrhh        rrhh01 / RRHH2024!       (María RRHH)");
  console.log("  comercial   comercial01 / Comercial2024!");
  console.log("  supervisor  supervisor01 / Supervisor2024!");
  console.log("  cliente     cliente01 / Cliente2024!");

  process.exit(0);
}

seedUsers().catch((err) => {
  console.error("❌ Error en seed de usuarios:", err);
  process.exit(1);
});
