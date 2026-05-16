/**
 * Validación de número y flujo previo a la clasificación de intención.
 *
 * Cubre tres casos especiales que cortan el procesamiento normal:
 *   1. Sesión DPI activa  → continuar el flujo de registro de teléfono.
 *   2. Usuario inactivo   → bloqueo total con mensaje de acceso revocado.
 *   3. Número desconocido → flujo DPI / menú de bienvenida según la intención.
 *
 * Cada handler devuelve `null` cuando NO consume el mensaje (continuar al
 * pipeline normal) o un `SimularResult` cuando sí lo consume.
 */

import {
  classifyMessage,
  INTERNAL_INTENTS,
  type MessageClassification,
} from "../classifier";
import {
  getPhoneRegSession,
  startPhoneRegSession,
  procesarPhoneRegStep,
} from "../phone-registration-session";
import { getWaMessage } from "../wa-config.service";
import type { DebugInfo, SimularResult } from "./types";
import type { UsuarioRow } from "./utils";

export async function handlePhoneRegSession(
  telefono: string,
  mensaje: string,
  debug: DebugInfo,
  t0: number,
): Promise<SimularResult | null> {
  const regSession = getPhoneRegSession(telefono);
  if (!regSession) return null;

  debug.validacion.autorizado = false;
  debug.validacion.motivo = "sesion_dpi_activa";
  debug.clasificacion.intencion = `dpi_${regSession.state.toLowerCase()}`;
  debug.sesion.activa = true;
  debug.sesion.estado = `REG:${regSession.state}`;

  const resultado = await procesarPhoneRegStep(regSession, mensaje);
  debug.clasificacion.intencion = resultado.tipo;

  // Refrescar estado de sesión después del paso (puede haberse limpiado)
  const sesionPostProceso = getPhoneRegSession(telefono);
  debug.sesion.activa = !!sesionPostProceso;
  debug.sesion.estado = sesionPostProceso ? `REG:${sesionPostProceso.state}` : null;
  debug.duracionMs = Date.now() - t0;
  return { respuesta: resultado.respuesta, tipo: resultado.tipo, debug };
}

export async function handleInactiveUser(
  usuario: UsuarioRow | null,
  debug: DebugInfo,
  t0: number,
): Promise<SimularResult | null> {
  if (!usuario || usuario.estado === "activo") return null;

  debug.validacion.autorizado = false;
  debug.validacion.motivo = "inactivo";
  const msg = await getWaMessage(
    "acceso_inactivo",
    "🚫 Tu acceso al sistema ha sido desactivado temporalmente. Contacta a tu supervisor o llama al (502) 2220-0000."
  );
  debug.clasificacion.intencion = "inactivo";
  debug.duracionMs = Date.now() - t0;
  return { respuesta: msg, tipo: "inactivo", debug };
}

/**
 * Para números desconocidos: clasifica la intención y decide si lanzar el flujo
 * DPI, un menú de bienvenida o dejar pasar el mensaje a procesamiento normal
 * como externo (lead / postulación / info / contacto).
 */
export async function handleUnknownUser(
  telefono: string,
  nombre: string,
  mensaje: string,
  debug: DebugInfo,
  t0: number,
): Promise<SimularResult | null> {
  debug.validacion.autorizado = false;
  debug.validacion.motivo = "no_registrado";

  const intencionPrevia: MessageClassification = classifyMessage(mensaje);
  debug.clasificacion.intencion = intencionPrevia;

  // Función interna desde número externo → iniciar flujo DPI
  if (INTERNAL_INTENTS.includes(intencionPrevia)) {
    const msg = await getWaMessage(
      "wa_dpi_solicitud",
      "🔐 Para acceder a funciones exclusivas de colaboradores, necesitas verificar tu identidad.\n\n" +
      "Envía tu número de *DPI* (Documento Personal de Identificación) para continuar."
    );
    startPhoneRegSession(telefono, nombre, intencionPrevia);
    debug.clasificacion.intencion = "dpi_solicitado";
    debug.sesion.activa = true;
    debug.sesion.estado = "REG:WAIT_DPI";
    debug.duracionMs = Date.now() - t0;
    return { respuesta: msg, tipo: "dpi_solicitado", debug };
  }

  // Saludo genérico → menú de bienvenida externo
  if (intencionPrevia === "saludo_externo") {
    const msg = await getWaMessage(
      "bienvenida_externo",
      "👋 ¡Bienvenido a ISP — Investigaciones y Seguridad Profesional S.A.!\n\n" +
      "Soy el asistente virtual de ISP. ¿En qué puedo ayudarte hoy?\n\n" +
      "1️⃣ Información sobre nuestros servicios\n" +
      "2️⃣ Solicitar cotización\n" +
      "3️⃣ Postularme a una plaza de trabajo\n" +
      "4️⃣ Hablar con un asesor\n\n" +
      "Escribe el número de opción o cuéntanos tu necesidad."
    );
    debug.clasificacion.intencion = "saludo_externo";
    debug.duracionMs = Date.now() - t0;
    return { respuesta: msg, tipo: "saludo_externo", debug };
  }

  // Intenciones externas válidas (lead / postulacion / info / contacto):
  // dejamos `autorizado=false` pero seguimos al pipeline de procesamiento.
  return null;
}
