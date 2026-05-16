/**
 * Modo DRY-RUN — handlers que NO escriben en la base de datos.
 *
 * Devuelven la misma forma `{ respuesta, entidad }` que `real.ts` para que el
 * orquestador pueda intercambiar uno por otro sin lógica condicional adicional.
 */

import { getWaMessage } from "../wa-config.service";
import type { DebugInfo } from "./types";
import { generarIdIncidencia } from "./utils";

interface HandlerResult {
  respuesta: string;
  entidad: DebugInfo["entidad"];
}

export async function crearIncidenciaSimulada(_nombre: string, _mensaje: string): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "incidencia_registrada",
    "🚨 Incidencia recibida. Nuestro equipo fue notificado y tomará acción inmediata. ID: {id}"
  );
  const simId = await generarIdIncidencia();
  return {
    respuesta: tpl.replace("{id}", simId + "-SIM"),
    entidad: { creada: false, tabla: "incidentes", id: simId + "(sim)", dryRun: true },
  };
}

export async function consultarTareasSimulada(_telefono: string): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "tarea_consulta_bot",
    "📋 *Tus tareas pendientes:*\n\n{lista}\n\n_Para ver detalles de una tarea, escribe el ID._"
  );
  const lista = "#1 Tarea de ejemplo (simulación)\n   Estado: pendiente | Prioridad: media";
  return {
    respuesta: tpl.replace("{lista}", lista),
    entidad: { creada: false, tabla: "tareas", id: null, dryRun: true },
  };
}

export async function crearPostulacionSimulada(
  _nombre: string,
  _telefono: string,
  _mensaje: string,
): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "postulacion_registrada",
    "✅ Tu solicitud fue registrada exitosamente. Te contactaremos en los próximos días para continuar el proceso de selección."
  );
  return {
    respuesta: tpl,
    entidad: { creada: false, tabla: "postulaciones", id: null, dryRun: true },
  };
}

export async function crearContactoAsesorSimulada(
  _nombre: string,
  _telefono: string,
  _mensaje: string,
): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "contacto_asesor_externo",
    "📞 Entendido. Uno de nuestros asesores se pondrá en contacto contigo a la brevedad.\n\n" +
    "También puedes comunicarte directamente al (502) 2220-0000 de lunes a viernes de 8:00 a 17:00 horas."
  );
  return {
    respuesta: tpl,
    entidad: { creada: false, tabla: "leads", id: null, dryRun: true },
  };
}

export async function crearLeadInfoSimulada(
  _nombre: string,
  _telefono: string,
  _mensaje: string,
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
  return {
    respuesta: tpl,
    entidad: { creada: false, tabla: "leads", id: null, dryRun: true },
  };
}

export async function crearLeadGenericoSimulada(
  _nombre: string,
  _telefono: string,
  _mensaje: string,
): Promise<HandlerResult> {
  const tpl = await getWaMessage(
    "lead_registrado",
    "Gracias por contactarnos. Un ejecutivo de ISP, S.A. se comunicará con usted a la brevedad para atender su solicitud."
  );
  return {
    respuesta: tpl,
    entidad: { creada: false, tabla: "leads", id: null, dryRun: true },
  };
}
