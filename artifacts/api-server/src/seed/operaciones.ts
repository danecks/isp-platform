import { db, leadsTable, applicationsTable, incidentsTable } from "@workspace/db";

async function seed() {
  console.log("🌱 Iniciando seed de datos ISP S.A. ...");

  // Clear existing data
  await db.delete(incidentsTable);
  await db.delete(leadsTable);
  await db.delete(applicationsTable);
  console.log("🗑️  Datos anteriores eliminados");

  // --- LEADS ---
  await db.insert(leadsTable).values([
    { empresa: "Distribuidora Nacional S.A.", contacto: "Roberto Morales", telefono: "50230001111", correo: "rmorales@distnac.gt", servicio: "Seguridad Física", ubicacion: "Zona Industrial, Guatemala", canal: "web", estado: "cotizado", ejecutivo: "Carlos Méndez" },
    { empresa: "Banco Metropolitano", contacto: "Lucía Estrada", telefono: "50240002222", correo: "lestrada@bancometro.gt", servicio: "Custodia de Valores", ubicacion: "Centro Financiero, Zona 4", canal: "web", estado: "nuevo", ejecutivo: "Sin asignar" },
    { empresa: "Cervecería Centro Americana", contacto: "Diego Fuentes", telefono: "50250003333", correo: "dfuentes@cca.gt", servicio: "Seguridad Perimetral", ubicacion: "Zona 12, Guatemala", canal: "whatsapp", estado: "contactado", ejecutivo: "Ana López" },
    { empresa: "Walmart Guatemala", contacto: "Sandra Pérez", telefono: "50260004444", correo: "sperez@walmart.gt", servicio: "Seguridad Física - 5 puestos", ubicacion: "Mixco, Guatemala", canal: "web", estado: "ganado", ejecutivo: "Carlos Méndez" },
    { empresa: "Pollo Campero Corporativo", contacto: "José Ajú", telefono: "50270005555", correo: "jau@campero.gt", servicio: "Seguridad Física Múltiple", ubicacion: "Zona 10, Guatemala", canal: "manual", estado: "nuevo", ejecutivo: "Sin asignar" },
    { empresa: "Agropecuaria El Río", contacto: "Mario Solís", telefono: "50280006666", correo: "msolis@agrorío.gt", servicio: "Custodia Transporte", ubicacion: "Escuintla", canal: "web", estado: "cotizado", ejecutivo: "Ana López" },
  ]);
  console.log("✅ 6 Leads insertados");

  // --- APPLICATIONS ---
  await db.insert(applicationsTable).values([
    { nombre: "Juan Carlos Pérez López", telefono: "50231112233", correo: "jcperez@gmail.com", experiencia: "2-4 años", ubicacion: "Villa Nueva, Guatemala", puesto: "Agente de Seguridad", canal: "web", estado: "en_revision" },
    { nombre: "María Fernanda Ortiz", telefono: "50232223344", correo: "mfortiz@gmail.com", experiencia: "Sin experiencia", ubicacion: "Mixco, Guatemala", puesto: "Agente de Seguridad", canal: "web", estado: "recibido" },
    { nombre: "Roberto Ajú Coy", telefono: "50233334455", correo: "raju@gmail.com", experiencia: "5+ años", ubicacion: "Guatemala, Zona 6", puesto: "Supervisor de Seguridad", canal: "web", estado: "entrevista" },
    { nombre: "Carlos Domingo Tzoc", telefono: "50234445566", correo: "cdtzoc@hotmail.com", experiencia: "1-2 años", ubicacion: "San Lucas Sacatepéquez", puesto: "Agente de Seguridad", canal: "whatsapp", estado: "recibido" },
    { nombre: "Ana Lucía González", telefono: "50235556677", correo: "agonzalez@gmail.com", experiencia: "4-5 años", ubicacion: "Antigua Guatemala", puesto: "Oficial de Seguridad", canal: "web", estado: "aprobado" },
    { nombre: "Pedro Ramírez Pac", telefono: "50236667788", correo: "pramirpac@gmail.com", experiencia: "Sin experiencia", ubicacion: "Chimaltenango", puesto: "Agente de Seguridad", canal: "web", estado: "descartado" },
  ]);
  console.log("✅ 6 Postulaciones insertadas");

  // --- INCIDENTS ---
  const now = new Date();
  const d = (days: number) => new Date(now.getTime() - days * 86400000);
  await db.insert(incidentsTable).values([
    { id: "INC-2603-0001", fecha: d(0), origen: "whatsapp", cliente: "Distribuidora Nacional S.A.", ubicacion: "Bodega Principal, Zona 12", tipo: "Intrusión detectada", prioridad: "alta", estado: "en_proceso", responsable: "Supervisor García", descripcion: "Alarma activada en acceso posterior, agente reporta persona no autorizada." },
    { id: "INC-2603-0002", fecha: d(1), origen: "web", cliente: "Cervecería Centro Americana", ubicacion: "Planta Producción, Zona 12", tipo: "Alarma activada", prioridad: "media", estado: "resuelta", responsable: "Agente López", descripcion: "Alarma activada por error humano durante mantenimiento." },
    { id: "INC-2603-0003", fecha: d(2), origen: "manual", cliente: "Walmart Guatemala - Mixco", ubicacion: "Estacionamiento", tipo: "Incidente con cliente", prioridad: "baja", estado: "cerrada", responsable: "Supervisor Fuentes", descripcion: "Discusión verbal entre cliente y empleado, intervenida sin escalada." },
    { id: "INC-2603-0004", fecha: d(3), origen: "whatsapp", cliente: "Banco Metropolitano", ubicacion: "Sucursal Zona 4", tipo: "Sospechoso en área", prioridad: "alta", estado: "abierta", responsable: "Sin asignar", descripcion: "Cliente reporta individuo sospechoso rondando el cajero exterior." },
    { id: "INC-2603-0005", fecha: d(5), origen: "web", cliente: "Pollo Campero Corporativo", ubicacion: "Local Zona 10", tipo: "Robo menor", prioridad: "alta", estado: "en_proceso", responsable: "Agente Ajú", descripcion: "Hurto de producto reportado. Revisión de cámaras en proceso." },
    { id: "INC-2603-0006", fecha: d(7), origen: "manual", cliente: "Agropecuaria El Río", ubicacion: "Ruta Escuintla-Puerto", tipo: "Incidente vehículo custodia", prioridad: "media", estado: "resuelta", responsable: "Agente Solis", descripcion: "Pinchazo durante ruta. Protocolo ejecutado, sin pérdida de carga." },
  ]);
  console.log("✅ 6 Incidencias insertadas");

  console.log("\n🎉 Seed completado. Datos de prueba listos en la base de datos.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
