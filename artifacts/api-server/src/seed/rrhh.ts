/**
 * Seed de empleados de ejemplo — ISP, S.A.
 *
 * Crea colaboradores de prueba en la tabla `employees`:
 * - Algunos vinculados a usuarios existentes del sistema
 * - Otros sin cuenta de sistema (solo registro de empleado)
 * - Un registro marcado como proveniente de sistema externo (para demostrar el campo externalId)
 *
 * Uso: cd artifacts/api-server && pnpm exec tsx src/seed/rrhh.ts
 */

import { db, employeesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seedEmployees() {
  console.log("👷 Iniciando seed de empleados ISP, S.A. ...");

  // ─── Datos de ejemplo ──────────────────────────────────────────────────────
  const employeesSeed = [
    // ── Empleados vinculados a usuarios del sistema ─────────────────────────
    {
      username: "ops01",
      employee: {
        nombreCompleto: "Carlos Eduardo Rodríguez López",
        dpi: "1234567890101",
        telefono: "50220002222",
        correo: "carlos.ops@isp.gt",
        puesto: "Jefe de Operaciones",
        area: "Operaciones",
        estadoLaboral: "activo",
        sede: "Ciudad de Guatemala",
        supervisorNombre: "Daniel Administrador",
        fechaIngreso: new Date("2021-03-15"),
        sourceSystem: "manual",
        syncStatus: "manual",
        notas: "Responsable del turno A. Carnet ISP-OPS-001.",
      },
    },
    {
      username: "supervisor01",
      employee: {
        nombreCompleto: "Roberto García Ajú",
        dpi: "2345678901202",
        telefono: "50220005555",
        correo: "garcia.sup@isp.gt",
        puesto: "Supervisor de Zona Norte",
        area: "Operaciones",
        estadoLaboral: "activo",
        sede: "Zona 6 — Guatemala",
        supervisorNombre: "Carlos Eduardo Rodríguez López",
        fechaIngreso: new Date("2020-07-01"),
        sourceSystem: "manual",
        syncStatus: "manual",
        notas: "Supervisa 12 puestos en zona norte. Carnet ISP-SUP-008.",
      },
    },
    {
      username: "rrhh01",
      employee: {
        nombreCompleto: "María Fernanda González Castillo",
        dpi: "3456789012303",
        telefono: "50220003333",
        correo: "maria.rrhh@isp.gt",
        puesto: "Coordinadora de Recursos Humanos",
        area: "Recursos Humanos",
        estadoLaboral: "activo",
        sede: "Ciudad de Guatemala — Oficina Central",
        supervisorNombre: "Daniel Administrador",
        fechaIngreso: new Date("2022-01-10"),
        sourceSystem: "manual",
        syncStatus: "manual",
        notas: "Administra nómina, capacitaciones y proceso de selección.",
      },
    },
    {
      username: "comercial01",
      employee: {
        nombreCompleto: "Roberto Antonio Fuentes Pérez",
        dpi: "4567890123404",
        telefono: "50220004444",
        correo: "roberto.comercial@isp.gt",
        puesto: "Ejecutivo Comercial Senior",
        area: "Comercial",
        estadoLaboral: "activo",
        sede: "Ciudad de Guatemala — Zona 10",
        supervisorNombre: "Daniel Administrador",
        fechaIngreso: new Date("2021-09-01"),
        sourceSystem: "manual",
        syncStatus: "manual",
        notas: "Atiende cuentas de banca y retail. Meta: Q250,000 mensuales.",
      },
    },
  ];

  // ── Empleados sin cuenta de sistema (solo personal de campo) ──────────────
  const employeesNoUser = [
    {
      nombreCompleto: "Pedro Ajú Coy",
      dpi: "5678901234505",
      telefono: "50231001100",
      correo: null,
      puesto: "Agente de Seguridad",
      area: "Operaciones",
      estadoLaboral: "activo",
      sede: "Mixco — Walmart",
      supervisorNombre: "Roberto García Ajú",
      fechaIngreso: new Date("2023-02-20"),
      sourceSystem: "manual",
      syncStatus: "manual",
      notas: "Puesto fijo: Walmart Mixco, turno diurno.",
    },
    {
      nombreCompleto: "Ana Lucía Tzoc Méndez",
      dpi: "6789012345606",
      telefono: "50232001200",
      correo: null,
      puesto: "Agente de Seguridad",
      area: "Operaciones",
      estadoLaboral: "activo",
      sede: "Zona 4 — Banco Metropolitano",
      supervisorNombre: "Roberto García Ajú",
      fechaIngreso: new Date("2023-05-01"),
      sourceSystem: "manual",
      syncStatus: "manual",
      notas: "Puesto fijo: Banco Metropolitano, turno nocturno.",
    },
    {
      nombreCompleto: "José Miguel Solís Ramírez",
      dpi: "7890123456707",
      telefono: "50233001300",
      correo: null,
      puesto: "Conductor de Custodia",
      area: "Custodias",
      estadoLaboral: "activo",
      sede: "Base Central — Escuintla",
      supervisorNombre: "Roberto García Ajú",
      fechaIngreso: new Date("2022-11-15"),
      sourceSystem: "manual",
      syncStatus: "manual",
      notas: "Ruta Escuintla-Puerto. Licencia A+E vigente hasta 2026.",
    },
    // ── Ejemplo: empleado marcado como proveniente de sistema externo ─────────
    // (Demuestra cómo quedaría un registro después de una sync de RH)
    {
      nombreCompleto: "Sandra Patricia Morales López",
      dpi: "8901234567808",
      telefono: "50234001400",
      correo: "s.morales@isp.gt",
      puesto: "Oficial de Seguridad",
      area: "Operaciones",
      estadoLaboral: "activo",
      sede: "Cervecería Centro Americana — Zona 12",
      supervisorNombre: "Roberto García Ajú",
      fechaIngreso: new Date("2021-06-01"),
      externalId: "COLLAB-20210601-047",         // ID en la base de RH externa
      sourceSystem: "hr_sql_external",           // Marcado como proveniente de RH
      syncStatus: "synced",                      // Simulando estado de sync exitoso
      lastSyncAt: new Date("2024-01-15T03:00:00Z"),
      notas: "Registro importado desde HR SQL. Última sync: 15 ene 2024.",
    },
    {
      nombreCompleto: "Carlos Domingo Tzoc Pop",
      dpi: "9012345678909",
      telefono: "50235001500",
      correo: null,
      puesto: "Agente de Seguridad",
      area: "Operaciones",
      estadoLaboral: "licencia",
      sede: "Pollo Campero — Zona 10",
      supervisorNombre: "Roberto García Ajú",
      fechaIngreso: new Date("2022-03-01"),
      sourceSystem: "manual",
      syncStatus: "manual",
      notas: "En licencia médica desde 10 ene 2024. Reingreso estimado: marzo 2024.",
    },
  ];

  // ─── Insertar / actualizar empleados vinculados a usuarios ─────────────────
  const createdEmployeeIds: Record<string, number> = {};

  for (const { username, employee } of employeesSeed) {
    // Check if already exists by correo
    const existing = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.correo, employee.correo!))
      .limit(1);

    let empId: number;
    if (existing.length > 0) {
      empId = existing[0].id;
      console.log(`  ⏭️  Empleado '${employee.nombreCompleto}' ya existe (id=${empId})`);
    } else {
      const [created] = await db
        .insert(employeesTable)
        .values({ ...employee, fechaIngreso: employee.fechaIngreso || null })
        .returning({ id: employeesTable.id });
      empId = created.id;
      console.log(`  ✅ Empleado '${employee.nombreCompleto}' creado (id=${empId})`);
    }

    createdEmployeeIds[username] = empId;
  }

  // ─── Insertar empleados sin usuario ────────────────────────────────────────
  for (const emp of employeesNoUser) {
    const checkField = emp.externalId
      ? eq(employeesTable.externalId, emp.externalId)
      : eq(employeesTable.dpi, emp.dpi!);

    const existing = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(checkField)
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭️  Empleado '${emp.nombreCompleto}' ya existe`);
    } else {
      const [created] = await db
        .insert(employeesTable)
        .values({
          ...emp,
          externalId: (emp as any).externalId ?? null,
          lastSyncAt: (emp as any).lastSyncAt ?? null,
          correo: emp.correo ?? null,
          fechaIngreso: emp.fechaIngreso || null,
        })
        .returning({ id: employeesTable.id });
      console.log(`  ✅ Empleado '${emp.nombreCompleto}' creado (id=${created.id})`);
    }
  }

  // ─── Vincular users.employeeId para los usuarios con empleado ──────────────
  console.log("\n🔗 Vinculando usuarios con empleados...");
  for (const [username, empId] of Object.entries(createdEmployeeIds)) {
    const [user] = await db
      .select({ id: usersTable.id, employeeId: usersTable.employeeId })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (!user) {
      console.log(`  ⚠️  Usuario '${username}' no encontrado, saltando vínculo`);
      continue;
    }
    if (user.employeeId === empId) {
      console.log(`  ⏭️  ${username} ya vinculado a empleado ${empId}`);
      continue;
    }
    await db
      .update(usersTable)
      .set({ employeeId: empId, updatedAt: new Date() })
      .where(eq(usersTable.username, username));
    console.log(`  🔗 ${username} → employees.id=${empId}`);
  }

  console.log(`
✅ Seed de empleados completado.

Resumen:
  • 4 empleados vinculados a usuarios del sistema (ops01, supervisor01, rrhh01, comercial01)
  • 5 empleados sin cuenta de sistema (personal de campo)
  • 1 empleado marcado como proveniente de HR SQL externo (Sandra Morales, externalId=COLLAB-20210601-047)

Para ver el estado de sync:
  GET /api/employees/sync/status

Para ver todos los empleados:
  GET /api/employees

Para ver empleados de origen externo:
  GET /api/employees?sourceSystem=hr_sql_external
`);

  process.exit(0);
}

seedEmployees().catch((err) => {
  console.error("❌ Error en seed de empleados:", err);
  process.exit(1);
});
