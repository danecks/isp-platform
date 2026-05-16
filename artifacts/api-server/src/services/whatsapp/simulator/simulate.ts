/**
 * Orquestador del simulador. Junta validación, sesiones y handlers (real /
 * dry-run) para producir la respuesta + debug del bot.
 */

import {
  classifyMessage,
  type MessageClassification,
} from "../classifier";
import {
  getSession,
  iniciarAnticipo,
  continuarAnticipo,
  deleteSession,
} from "../anticipo-session";
import { logger } from "../../../lib/logger";
import {
  type SimularParams,
  type SimularResult,
  makeDebug,
} from "./types";
import {
  buscarAlias,
  buscarUsuarioPorTelefono,
  normalizarTelefono,
} from "./utils";
import {
  handleInactiveUser,
  handlePhoneRegSession,
  handleUnknownUser,
} from "./validation";
import * as real from "./real";
import * as dry from "./dry-run";

export async function simularMensaje(params: SimularParams): Promise<SimularResult> {
  const t0 = Date.now();
  const { nombre, mensaje, persistir, skipValidacion } = params;
  const telefono = normalizarTelefono(params.telefono);
  const debug = makeDebug(telefono, mensaje, persistir);

  // 1. Identificar usuario por teléfono
  const usuario = await buscarUsuarioPorTelefono(telefono);
  if (usuario) {
    debug.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      estado: usuario.estado,
      tieneTelefono: true,
    };
  } else {
    debug.usuario = {
      id: null,
      nombre,
      rol: "externo",
      estado: null,
      tieneTelefono: false,
    };
  }

  // 2. Validación de número y flujos especiales
  if (!skipValidacion) {
    const reg = await handlePhoneRegSession(telefono, mensaje, debug, t0);
    if (reg) return reg;

    const inactivo = await handleInactiveUser(usuario, debug, t0);
    if (inactivo) return inactivo;

    if (!usuario) {
      const externo = await handleUnknownUser(telefono, nombre, mensaje, debug, t0);
      if (externo) return externo;
    }
  } else {
    debug.validacion.motivo = "omitido_skip";
  }

  // 3. Buscar alias en position_aliases
  debug.alias = await buscarAlias(mensaje);

  // 4. Sesión de anticipo activa
  const sesionActiva = getSession(telefono);
  if (sesionActiva) {
    debug.sesion.activa = true;
    debug.sesion.estado = sesionActiva.state;
    debug.sesion.limiteTotal = sesionActiva.limiteTotal ?? null;
    debug.sesion.limiteRestante = sesionActiva.limiteRestante ?? null;
    debug.sesion.montoSolicitado = sesionActiva.montoSolicitado ?? null;
    debug.clasificacion.intencion = "anticipo_sesion";

    const { respuesta, completada } = await continuarAnticipo(sesionActiva, mensaje);
    debug.entidad = {
      creada: completada,
      tabla: completada ? "anticipos" : null,
      id: null,
      dryRun: !persistir,
    };

    if (!persistir && completada) {
      deleteSession(telefono);
    }

    debug.duracionMs = Date.now() - t0;
    return { respuesta, tipo: "anticipo_sesion", debug };
  }

  // 5. Clasificar (o reusar la intención calculada en validación)
  const intencion: MessageClassification =
    debug.clasificacion.intencion !== "pendiente" && debug.clasificacion.intencion !== "no_registrado"
      ? (debug.clasificacion.intencion as MessageClassification)
      : classifyMessage(mensaje);

  debug.clasificacion.intencion = intencion;

  // 6. Despachar al handler según intención + modo
  let respuesta: string | null = null;
  let tipo: string = intencion;

  try {
    if (intencion === "anticipo") {
      respuesta = await iniciarAnticipo(nombre, telefono);
      debug.clasificacion.intencion = "anticipo_inicio";
      tipo = "anticipo_inicio";

      if (!persistir) {
        deleteSession(telefono);
        debug.entidad = { creada: false, tabla: "anticipos", id: null, dryRun: true };
      } else {
        debug.entidad = { creada: false, tabla: "anticipos", id: null, dryRun: false };
      }
    } else if (intencion === "incidencia") {
      const r = persistir
        ? await real.crearIncidenciaReal(nombre, mensaje)
        : await dry.crearIncidenciaSimulada(nombre, mensaje);
      respuesta = r.respuesta;
      debug.entidad = r.entidad;
    } else if (intencion === "tarea") {
      const r = persistir
        ? await real.consultarTareasReal(telefono)
        : await dry.consultarTareasSimulada(telefono);
      respuesta = r.respuesta;
      debug.entidad = r.entidad;
    } else if (intencion === "postulacion") {
      const r = persistir
        ? await real.crearPostulacionReal(nombre, telefono, mensaje)
        : await dry.crearPostulacionSimulada(nombre, telefono, mensaje);
      respuesta = r.respuesta;
      debug.entidad = r.entidad;
    } else if (intencion === "contacto_asesor") {
      const r = persistir
        ? await real.crearContactoAsesorReal(nombre, telefono, mensaje)
        : await dry.crearContactoAsesorSimulada(nombre, telefono, mensaje);
      respuesta = r.respuesta;
      debug.entidad = r.entidad;
    } else if (intencion === "info_general") {
      const r = persistir
        ? await real.crearLeadInfoReal(nombre, telefono, mensaje)
        : await dry.crearLeadInfoSimulada(nombre, telefono, mensaje);
      respuesta = r.respuesta;
      debug.entidad = r.entidad;
    } else {
      // Lead / cotización (catch-all)
      const r = persistir
        ? await real.crearLeadGenericoReal(nombre, telefono, mensaje)
        : await dry.crearLeadGenericoSimulada(nombre, telefono, mensaje);
      respuesta = r.respuesta;
      debug.entidad = r.entidad;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debug.errores.push(msg);
    logger.error({ err }, "[Simulador] Error procesando intención");
  }

  debug.duracionMs = Date.now() - t0;
  return { respuesta, tipo, debug };
}
