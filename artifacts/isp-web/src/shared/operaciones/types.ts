/**
 * Tipos de dominio compartidos entre Admin, Portal Cliente y PWA Agente.
 *
 * Antes cada pantalla redefinía interfaces casi idénticas para Visita, Fichaje,
 * RondaEvento y Puesto, cada una con sus campos propios. Centralizamos acá
 * sólo el subconjunto común para evitar drift; cada layer puede extender el
 * tipo si necesita campos extra (responsable, esEmergencia, foto_url, etc).
 */

// ─── Visitas (entrada/salida de personas y vehículos en puestos) ─────────────

export interface VisitaCore {
  id: number;
  tipo: "persona" | "vehiculo";
  puesto_id: number;
  puesto_nombre: string | null;
  dpi_numero: string | null;
  nombre_completo: string | null;
  placa: string | null;
  marca_vehiculo: string | null;
  color_vehiculo: string | null;
  conductor_nombre: string | null;
  motivo: string | null;
  a_quien_visita: string | null;
  entrada_at: string;
  entrada_employee_nombre: string | null;
  salida_at: string | null;
  salida_employee_nombre: string | null;
}

// ─── Fichajes QR (entrada/salida de agentes en puestos) ──────────────────────

export interface FichajeCore {
  id: number;
  tipo: string;
  resultado: string;
  registrado_en: string;
  distancia_metros: number | null;
  employee_id: number | null;
  nombres: string | null;
  apellidos: string | null;
  empl_numero: string | null;
  puesto_id: number;
  puesto_nombre: string;
}

// ─── Rondas QR (escaneos de puntos físicos durante recorridos) ───────────────

export interface RondaEventoCore {
  id: number;
  escaneado_en: string;
  resultado: string;
  distancia_metros: number | null;
  punto_id: number;
  punto_nombre: string;
  ronda_id: number;
  ronda_nombre: string;
  user_id: number | null;
  user_nombre: string | null;
  username: string | null;
}

// ─── Cumplimiento (resumen agregado de fichajes/rondas por puesto/punto) ────

export interface CumplimientoFichajes {
  total_puestos: number;
  puestos_con_fichaje: number;
  pct_cobertura: number | null;
  detalle: Array<{
    puesto_id: number;
    puesto_nombre: string;
    total_fichajes: number;
    fichajes_ok: number;
    ultimo: string | null;
  }>;
}

export interface CumplimientoRondas {
  total_puntos: number;
  puntos_con_escaneo: number;
  pct_cumplimiento: number | null;
  detalle: Array<{
    punto_id: number;
    punto_nombre: string;
    escaneos: number;
    ultimo: string | null;
  }>;
}

// ─── Cobertura de puestos (estado actual de plazas contratadas) ─────────────

export interface PuestoCobertura {
  puesto_id: number;
  puesto_nombre: string;
  turno: string | null;
  jornada: string | null;
  horario: string | null;
  estado: string | null;
  sede_nombre: string | null;
  sede_direccion: string | null;
  zona_nombre: string | null;
  titular_nombre: string | null;
  titular_area: string | null;
  en_servicio_nombre?: string | null;
  en_servicio_desde?: string | null;
}

// ─── Recorridos GPS de custodios ─────────────────────────────────────────────

export interface PuntoGPS {
  lat: number;
  lng: number;
  precision_metros: number | null;
  velocidad_mps: number | null;
  rumbo_grados: number | null;
  bateria_pct: number | null;
  capturado_en: string;
}

// ─── Períodos para selector de filtro ────────────────────────────────────────

export type Periodo = "hoy" | "7d" | "15d";
