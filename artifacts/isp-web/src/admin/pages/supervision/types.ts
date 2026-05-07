// Tipos compartidos del módulo Supervisión (admin).

export type ProgTipo = "rutina" | "extraordinaria" | "comision";
export type ProgPrioridad = "baja" | "normal" | "alta" | "urgente";
export type ProgEstado = "pendiente" | "en_curso" | "completada" | "cancelada" | "no_realizada";

export interface SupervisionProgramacion {
  id: number;
  supervisor_employee_id: number;
  supervisor_nombre: string;
  supervisor_tipo_personal: string;
  cliente_id: number | null;
  cliente_nombre: string | null;
  puesto_id: number | null;
  puesto_nombre: string | null;
  zona_id: number | null;
  zona_nombre: string | null;
  fecha_planificada: string;       // YYYY-MM-DD
  ventana_inicio: string | null;   // HH:MM
  ventana_fin: string | null;      // HH:MM
  tipo: ProgTipo;
  prioridad: ProgPrioridad;
  estado: ProgEstado;
  instrucciones: string | null;
  visita_id: number | null;
  iniciada_at: string | null;
  completada_at: string | null;
  observaciones: string | null;
  bono_monto: string | number | null;
  bono_pagado: boolean;
  bono_pagado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupervisorDisponible {
  id: number;
  nombre_completo: string;
  telefono: string | null;
  estado_laboral: string;
}

export interface ZonaConSupervisores {
  zona_id: number;
  zona_nombre: string;
  zona_descripcion: string | null;
  supervisores: Array<{
    asignacion_id: number;
    employee_id: number;
    nombre_completo: string;
    telefono: string | null;
    estado_laboral: string;
    asignado_at: string;
  }>;
}

export const TIPO_LABEL: Record<ProgTipo, string> = {
  rutina: "Rutina",
  extraordinaria: "Extraordinaria",
  comision: "Comisión",
};

export const ESTADO_LABEL: Record<ProgEstado, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
  no_realizada: "No realizada",
};

export const PRIORIDAD_LABEL: Record<ProgPrioridad, string> = {
  baja: "Baja",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const ESTADO_COLOR: Record<ProgEstado, string> = {
  pendiente:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  en_curso:     "bg-blue-500/15 text-blue-300 border-blue-500/30",
  completada:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelada:    "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  no_realizada: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const PRIORIDAD_COLOR: Record<ProgPrioridad, string> = {
  baja:    "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  normal:  "bg-sky-500/15 text-sky-300 border-sky-500/30",
  alta:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  urgente: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
