/**
 * Shared types and helpers for the Cliente ficha tabs and modals.
 * Extracted from `FichaCliente.tsx` (Fase 4) to keep files manageable.
 */
import { getSessionToken } from "@/lib/httpClient";

export const API = "/api";
export const getSession = () => getSessionToken();
export const h = () => ({
  "x-isp-session": getSession(),
  "Content-Type": "application/json",
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ClienteFicha {
  id: number;
  nombre: string;
  nombreComercial: string | null;
  nit: string | null;
  sector: string | null;
  estado: string;
  observaciones_contractuales: string | null;
  fecha_inicio_contrato: string | null;
  tarifa_base_mensual: string | null;
  estado_contrato: string | null;
  notas: string | null;
  dotacion_uniforme_num: number | null;
  dotacion_uniforme_frecuencia_meses: number | null;
  contrato_sin_prueba: boolean;
  tipo_servicio: string;
  igss_aplica: boolean;
  igss_codigo_centro: string | null;
  igss_direccion: string | null;
  igss_zona: string | null;
  igss_departamento: number | null;
  igss_municipio: number | null;
  igss_codigo_actividad: string | null;
  igss_contacto: string | null;
  igss_fax: string | null;
  igss_email: string | null;
  igss_telefono: string | null;
}

export interface Sede {
  id: number;
  client_id: number;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  contacto: string | null;
  telefono: string | null;
  activo: boolean;
  notas: string | null;
  total_puestos: number;
  puestos_cubiertos: number;
  puestos_con_titular: number;
}

export interface Puesto {
  id: number;
  nombre: string;
  turno: string | null;
  jornada: string | null;
  horario: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  descanso_inicio: string | null;
  descanso_fin: string | null;
  cantidad_contratada: number;
  tarifa_puesto: string | null;
  tipo_servicio: string | null;
  elegible_horas_extra: boolean;
  costo_hora: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  titular_employee_id: number | null;
  titular_nombre: string | null;
  titular_nombre_completo: string | null;
  titular_telefono: string | null;
  titular_estado_laboral: string | null;
  agente_id: number | null;
  agente_nombre: string | null;
  estado: string;
  notas: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  tipo_turno_id: number | null;
  tipo_turno_nombre: string | null;
  fecha_inicio_ciclo: string | null;
  direccion: string | null;
}

export interface PuestoSlot {
  id: number;
  puesto_id: number;
  puesto_nombre: string;
  sede_id: number | null;
  sede_nombre: string | null;
  slot_numero: number;
  horas_turno: number;
  hora_entrada: string;
  dias_trabajo: number[];
  dias_medio_turno: number[];
  longitud_ciclo: number;
  fecha_inicio_ciclo: string | null;
  empleado_id: number | null;
  empleado_nombre: string | null;
  empleado_estado: string | null;
  empleado_telefono: string | null;
  notas: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const fmtQ = (v: string | null | number) =>
  v ? `Q ${Number(v).toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—";

// Ciclo de 14 días: D1..D14
export const DIAS_SEM_FC = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DIAS_CICLO = Array.from({ length: 14 }, (_, i) => ({
  n: i + 1,
  label: DIAS_SEM_FC[i % 7],
}));
export const SEMANA1 = DIAS_CICLO.slice(0, 7);
export const SEMANA2 = DIAS_CICLO.slice(7, 14);
