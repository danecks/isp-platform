/**
 * Seed de asignaciones y incidencias para portal de clientes
 *
 * Crea:
 * - 4 asignaciones de agentes para CLI-001 (Distribuidora Nacional)
 * - 8 incidencias de demostración vinculadas a CLI-001 (clienteRefId)
 *
 * Uso: cd artifacts/api-server && pnpm exec tsx src/seed/asignaciones.ts
 */

import { db, agentAssignmentsTable, incidentsTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CLIENTE_ID = "CLI-001";
const EMPRESA_NOMBRE = "Distribuidora Nacional";

async function seedAssignments() {
  console.log("🔗 Iniciando seed de asignaciones para portal...");
  console.log(`   Cliente: ${EMPRESA_NOMBRE} (${CLIENTE_ID})`);

  // ── Obtener IDs de empleados existentes ─────────────────────────────────────
  const employees = await db.select({ id: employeesTable.id, nombre: employeesTable.nombreCompleto })
    .from(employeesTable);

  const find = (nombre: string) => employees.find((e) => e.nombre.includes(nombre));

  const pedro = find("Pedro Ajú");
  const ana = find("Ana Lucía");
  const jose = find("José Miguel");
  const sandra = find("Sandra Patricia");

  if (!pedro || !ana || !jose || !sandra) {
    console.error("❌ Faltan empleados. Ejecuta primero seed-employees.ts");
    console.log("   Empleados disponibles:", employees.map((e) => e.nombre));
    process.exit(1);
  }

  // ── Asignaciones para CLI-001 ───────────────────────────────────────────────
  const assignments = [
    {
      employeeId: pedro.id,
      clienteId: CLIENTE_ID,
      codigoAsignacion: "ISP-AGNT-C001-001",
      puesto: "Agente de Vigilancia",
      servicio: "Vigilancia Fija",
      ubicacion: "Bodega Central — Km. 12 Carretera a Mixco",
      supervisorNombre: "Roberto García Ajú",
      fechaInicio: new Date("2023-03-01"),
      estado: "activo",
    },
    {
      employeeId: ana.id,
      clienteId: CLIENTE_ID,
      codigoAsignacion: "ISP-AGNT-C001-002",
      puesto: "Agente de Control de Acceso",
      servicio: "Control de Acceso",
      ubicacion: "Oficinas Corporativas — Zona 10",
      supervisorNombre: "Roberto García Ajú",
      fechaInicio: new Date("2023-06-15"),
      estado: "activo",
    },
    {
      employeeId: jose.id,
      clienteId: CLIENTE_ID,
      codigoAsignacion: "ISP-AGNT-C001-003",
      puesto: "Conductor de Custodia de Valores",
      servicio: "Custodia y Transporte",
      ubicacion: "Ruta: Ciudad de Guatemala — Escuintla",
      supervisorNombre: "Carlos Eduardo Rodríguez López",
      fechaInicio: new Date("2023-01-10"),
      estado: "activo",
    },
    {
      employeeId: sandra.id,
      clienteId: CLIENTE_ID,
      codigoAsignacion: "ISP-AGNT-C001-004",
      puesto: "Oficial de Seguridad Senior",
      servicio: "Vigilancia Perimetral",
      ubicacion: "Planta de Producción — Zona 12",
      supervisorNombre: "Roberto García Ajú",
      fechaInicio: new Date("2022-09-01"),
      estado: "activo",
    },
  ];

  console.log("\n  Insertando asignaciones de agentes...");
  for (const a of assignments) {
    const existing = await db
      .select({ id: agentAssignmentsTable.id })
      .from(agentAssignmentsTable)
      .where(eq(agentAssignmentsTable.codigoAsignacion, a.codigoAsignacion!))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭️  Asignación ${a.codigoAsignacion} ya existe`);
    } else {
      await db.insert(agentAssignmentsTable).values(a);
      console.log(`  ✅ ${a.codigoAsignacion} — ${a.puesto} @ ${a.ubicacion}`);
    }
  }

  // ── Incidencias demo para CLI-001 ───────────────────────────────────────────
  console.log("\n  Insertando incidencias de demo para el portal...");

  const portalIncidents = [
    {
      id: "INC-CLI-001",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Acceso no autorizado",
      prioridad: "alta",
      estado: "cerrada",
      ubicacion: "Bodega Central — Km. 12",
      responsable: "Pedro Ajú Coy",
      descripcion: "Persona sin identificación intentó ingresar a bodega en horario nocturno. Detenida y entregada a PNC.",
      fecha: new Date("2024-11-05T22:30:00Z"),
      origen: "campo",
    },
    {
      id: "INC-CLI-002",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Robo de mercadería",
      prioridad: "alta",
      estado: "cerrada",
      ubicacion: "Ruta: Ciudad — Escuintla",
      responsable: "José Miguel Solís",
      descripcion: "Durante traslado, se detectó seguimiento de vehículo sospechoso. Se activó protocolo de evasión y se notificó a PNC.",
      fecha: new Date("2024-12-12T14:15:00Z"),
      origen: "campo",
    },
    {
      id: "INC-CLI-003",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Falla de sistema de alarma",
      prioridad: "media",
      estado: "cerrada",
      ubicacion: "Planta de Producción — Zona 12",
      responsable: "Sandra Patricia Morales",
      descripcion: "Alarma perimetral presentó falla técnica. Se notificó al área de mantenimiento y se realizó ronda manual de verificación.",
      fecha: new Date("2025-01-08T06:45:00Z"),
      origen: "manual",
    },
    {
      id: "INC-CLI-004",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Incidente de tránsito",
      prioridad: "media",
      estado: "cerrada",
      ubicacion: "Km. 45 Carretera Escuintla",
      responsable: "José Miguel Solís",
      descripcion: "Vehículo de custodia involucrado en colisión menor con otro vehículo. Sin heridos. Reporte de daños enviado.",
      fecha: new Date("2025-01-20T11:00:00Z"),
      origen: "campo",
    },
    {
      id: "INC-CLI-005",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Intento de extorsión",
      prioridad: "alta",
      estado: "en_proceso",
      ubicacion: "Oficinas Corporativas — Zona 10",
      responsable: "Ana Lucía Tzoc",
      descripcion: "Llamada amenazante recibida en recepción. Protocolo de seguridad activado. Caso reportado al MP y PNC.",
      fecha: new Date("2025-02-03T09:20:00Z"),
      origen: "manual",
    },
    {
      id: "INC-CLI-006",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Daño a instalaciones",
      prioridad: "baja",
      estado: "cerrada",
      ubicacion: "Bodega Central — Km. 12",
      responsable: "Pedro Ajú Coy",
      descripcion: "Puerta perimetral dañada por impacto de vehículo de carga. Sin intención maliciosa. Reparación coordinada.",
      fecha: new Date("2025-02-15T16:30:00Z"),
      origen: "campo",
    },
    {
      id: "INC-CLI-007",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Acceso no autorizado",
      prioridad: "media",
      estado: "abierta",
      ubicacion: "Planta de Producción — Zona 12",
      responsable: "Sandra Patricia Morales",
      descripcion: "Cámara detectó persona en área restringida de almacenamiento. En investigación.",
      fecha: new Date("2025-03-10T23:45:00Z"),
      origen: "sistema",
    },
    {
      id: "INC-CLI-008",
      cliente: EMPRESA_NOMBRE,
      clienteRefId: CLIENTE_ID,
      tipo: "Conducta sospechosa",
      prioridad: "baja",
      estado: "abierta",
      ubicacion: "Oficinas Corporativas — Zona 10",
      responsable: "Ana Lucía Tzoc",
      descripcion: "Individuo fotografiando instalaciones desde la calle. Datos capturados, reportado a seguridad corporativa.",
      fecha: new Date("2025-03-18T10:15:00Z"),
      origen: "campo",
    },
  ];

  for (const inc of portalIncidents) {
    const existing = await db
      .select({ id: incidentsTable.id })
      .from(incidentsTable)
      .where(eq(incidentsTable.id, inc.id))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭️  Incidencia ${inc.id} ya existe`);
    } else {
      await db.insert(incidentsTable).values(inc);
      console.log(`  ✅ ${inc.id} — ${inc.tipo} (${inc.estado})`);
    }
  }

  console.log(`
✅ Seed de portal completado para ${EMPRESA_NOMBRE} (${CLIENTE_ID}):
  • 4 agentes asignados (ISP-AGNT-C001-001 a 004)
  • 8 incidencias de demo (INC-CLI-001 a 008)
    - 5 cerradas / 1 en proceso / 2 abiertas

Credenciales de prueba:
  usuario: cliente01   contraseña: Cliente2024!
  rol: cliente         clienteId: CLI-001

URL del portal: /portal/dashboard
`);

  process.exit(0);
}

seedAssignments().catch((err) => {
  console.error("❌ Error en seed de asignaciones:", err);
  process.exit(1);
});
