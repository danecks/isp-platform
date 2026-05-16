/**
 * Modo REAL — handlers que SÍ persisten en la base de datos.
 *
 * Cada handler devuelve `{ respuesta, entidad }` donde `entidad` se asigna
 * directamente a `debug.entidad`. Todos los registros se marcan con
 * canal/origen `simulador_admin` para distinguirlos de tráfico real.
 */

import {
  db,
  pool,
  incidentsTable,
  applicationsTable,
  leadsTable,
} from "@workspace/db";
import { getWaMessage } from "../wa-config.service";
import type { DebugInfo } from "./types";
import { generarIdIncidencia } from "./utils";

interface HandlerResult {
  respuesta: string;
  entidad: DebugInfo["entidad"];
}

export async function crearIncidenciaReal(nombre: string, mensaje: string): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "incidencia_registrada",
    "🚨 Incidencia recibida. Nuestro equipo fue notificado y tomará acción inmediata. ID: {id}"
  );
  const id = await generarIdIncidencia();
  const inserted = await db.insert(incidentsTable).values({
    id,
    cliente: nombre,
    tipo: "Alerta WhatsApp",
    origen: "simulador_admin",
    ubicacion: "Por confirmar",
    prioridad: "alta",
    estado: "abierta",
    responsable: "Sin asignar",
    descripcion: `[SIM:${Date.now()}] ${mensaje}`,
  }).returning();
  return {
    respuesta: tpl.replace("{id}", inserted[0].id),
    entidad: { creada: true, tabla: "incidentes", id: inserted[0].id, dryRun: false },
  };
}

export async function consultarTareasReal(telefono: string): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "tarea_consulta_bot",
    "📋 *Tus tareas pendientes:*\n\n{lista}\n\n_Para ver detalles de una tarea, escribe el ID._"
  );
  const { rows } = await pool.query<{
    id: number; titulo: string; estado: string; prioridad: string; fecha_limite: string | null;
  }>(`
    SELECT t.id, t.titulo, t.estado, t.prioridad, t.fecha_limite
    FROM tareas t
    JOIN users u ON u.id = t.asignado_id
    WHERE u.telefono = $1
      AND t.estado NOT IN ('completada', 'cancelada')
    ORDER BY t.prioridad DESC, t.created_at ASC
    LIMIT 5
  `, [telefono.replace("+", "")]);

  const lista = rows.length > 0
    ? rows.map((t, i) => {
        const fecha = t.fecha_limite
          ? ` | Límite: ${new Date(t.fecha_limite).toLocaleDateString("es-GT")}`
          : "";
        return `${i + 1}. *#${t.id}* ${t.titulo}\n   Estado: ${t.estado} | Prioridad: ${t.prioridad}${fecha}`;
      }).join("\n\n")
    : "✅ No tienes tareas pendientes asignadas.";

  return {
    respuesta: tpl.replace("{lista}", lista),
    entidad: { creada: false, tabla: "tareas", id: rows.length, dryRun: false },
  };
}

export async function crearPostulacionReal(
  nombre: string,
  telefono: string,
  mensaje: string,
): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "postulacion_registrada",
    "✅ Tu solicitud fue registrada exitosamente. Te contactaremos en los próximos días para continuar el proceso de selección."
  );
  const inserted = await db.insert(applicationsTable).values({
    nombre,
    telefono,
    correo: null,
    experiencia: "Por evaluar",
    ubicacion: "Guatemala",
    puesto: "Agente de Seguridad",
    canal: "simulador_admin",
    notas: mensaje,
  }).returning();
  return {
    respuesta: tpl,
    entidad: { creada: true, tabla: "postulaciones", id: inserted[0].id, dryRun: false },
  };
}

export async function crearContactoAsesorReal(
  nombre: string,
  telefono: string,
  mensaje: string,
): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "contacto_asesor_externo",
    "📞 Entendido. Uno de nuestros asesores se pondrá en contacto contigo a la brevedad.\n\n" +
    "También puedes comunicarte directamente al (502) 2220-0000 de lunes a viernes de 8:00 a 17:00 horas."
  );
  const inserted = await db.insert(leadsTable).values({
    empresa: nombre,
    contacto: nombre,
    telefono,
    correo: null,
    servicio: "Asesoría",
    ubicacion: "Guatemala",
    canal: "simulador_admin",
    notas: `[ASESOR] ${mensaje}`,
  }).returning();
  return {
    respuesta: tpl,
    entidad: { creada: true, tabla: "leads", id: inserted[0].id, dryRun: false },
  };
}

export async function crearLeadInfoReal(
  nombre: string,
  telefono: string,
  mensaje: string,
): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "info_servicios_externo",
    "ℹ️ ISP — Investigaciones y Seguridad Profesional S.A. ofrece:\n\n" +
    "🔒 Seguridad física y vigilancia\n" +
    "🚐 Custodia y transporte de valores\n" +
    "📹 Monitoreo y respuesta a alarmas\n" +
    "🏢 Seguridad corporativa e industrial\n\n" +
    "¿Te gustaría solicitar una cotización?\n" +
    "Escríbenos o llama al (502) 2220-0000."
  );
  const inserted = await db.insert(leadsTable).values({
    empresa: nombre,
    contacto: nombre,
    telefono,
    correo: null,
    servicio: "Información General",
    ubicacion: "Guatemala",
    canal: "simulador_admin",
    notas: `[INFO] ${mensaje}`,
  }).returning();
  return {
    respuesta: tpl,
    entidad: { creada: true, tabla: "leads", id: inserted[0].id, dryRun: false },
  };
}

export async function crearLeadGenericoReal(
  nombre: string,
  telefono: string,
  mensaje: string,
): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "lead_registrado",
    "Gracias por contactarnos. Un ejecutivo de ISP, S.A. se comunicará con usted a la brevedad para atender su solicitud."
  );
  const inserted = await db.insert(leadsTable).values({
    empresa: nombre,
    contacto: nombre,
    telefono,
    correo: null,
    servicio: "Por definir",
    ubicacion: "Guatemala",
    canal: "simulador_admin",
    notas: mensaje,
  }).returning();
  return {
    respuesta: tpl,
    entidad: { creada: true, tabla: "leads", id: inserted[0].id, dryRun: false },
  };
}
