/**
 * Tipos compartidos por la UI del simulador de WhatsApp.
 * Coinciden con la respuesta del endpoint POST /api/simulador.
 */

export interface UsuarioSimulador {
  id: number;
  nombre: string;
  rol: string;
  telefono: string | null;
  estado: string;
}

export interface DebugInfo {
  validacion: { telefono: string; autorizado: boolean; motivo: string | null };
  usuario: {
    id: number | null;
    nombre: string | null;
    rol: string | null;
    estado: string | null;
    tieneTelefono: boolean;
  } | null;
  clasificacion: { intencion: string; mensajeOriginal: string };
  sesion: {
    activa: boolean;
    estado: string | null;
    limiteTotal?: number | null;
    limiteRestante?: number | null;
    montoSolicitado?: number | null;
  };
  entidad: { creada: boolean; tabla: string | null; id: string | number | null; dryRun: boolean };
  alias: string | null;
  persistencia: "real" | "simulado";
  errores: string[];
  duracionMs: number;
}

export interface ChatMessage {
  id: string;
  from: "user" | "bot";
  text: string;
  ts: Date;
  tipo?: string;
  debug?: DebugInfo;
  error?: boolean;
}

export interface QuickScenario {
  label: string;
  icon: string;
  msg: string;
  color: string;
  group: "interno" | "externo" | "dpi";
  skipValidacion?: boolean;
}
