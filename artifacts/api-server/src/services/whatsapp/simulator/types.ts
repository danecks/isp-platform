/**
 * Tipos compartidos por el simulador de WhatsApp.
 */

export interface DebugInfo {
  validacion: {
    telefono: string;
    autorizado: boolean;
    motivo: string | null;
  };
  usuario: {
    id: number | null;
    nombre: string | null;
    rol: string | null;
    estado: string | null;
    tieneTelefono: boolean;
  } | null;
  clasificacion: {
    intencion: string;
    mensajeOriginal: string;
  };
  sesion: {
    activa: boolean;
    estado: string | null;
    limiteTotal?: number | null;
    limiteRestante?: number | null;
    montoSolicitado?: number | null;
  };
  entidad: {
    creada: boolean;
    tabla: string | null;
    id: string | number | null;
    dryRun: boolean;
  };
  alias: string | null;
  persistencia: "real" | "simulado";
  errores: string[];
  duracionMs: number;
}

export interface SimularParams {
  telefono: string;
  nombre: string;
  mensaje: string;
  persistir: boolean;
  skipValidacion?: boolean;
}

export interface SimularResult {
  respuesta: string | null;
  tipo: string;
  debug: DebugInfo;
}

export function makeDebug(telefono: string, mensaje: string, persistir: boolean): DebugInfo {
  return {
    validacion: { telefono, autorizado: true, motivo: null },
    usuario: null,
    clasificacion: { intencion: "pendiente", mensajeOriginal: mensaje },
    sesion: { activa: false, estado: null },
    entidad: { creada: false, tabla: null, id: null, dryRun: !persistir },
    alias: null,
    persistencia: persistir ? "real" : "simulado",
    errores: [],
    duracionMs: 0,
  };
}
