import React from "react";
import { Ban, CheckCircle2, Clock } from "lucide-react";

export const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pendiente_aprobacion: {
    label: "Pendiente aprobación",
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: <Clock className="w-3 h-3" />,
  },
  aprobado: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rechazado: {
    label: "Rechazado",
    className: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: <Ban className="w-3 h-3" />,
  },
  pagado_efectivo: {
    label: "Pagado en efectivo",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  anulado: {
    label: "ANULADO",
    className: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: <Ban className="w-3 h-3" />,
  },
  pendiente: {
    label: "Pendiente aprobación",
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: <Clock className="w-3 h-3" />,
  },
  activo: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  en_proceso: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cerrado: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

export const TIPO_CONFIG: Record<string, { label: string; className: string }> = {
  falta:                { label: "Falta injustificada",          className: "text-red-400 bg-red-400/10 border-red-400/20" },
  falta_injustificada:  { label: "Falta injustificada",          className: "text-red-400 bg-red-400/10 border-red-400/20" },
  suspension:           { label: "Suspensión",                   className: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  incapacidad:          { label: "Incapacidad",                  className: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  permiso_goce_sueldo:  { label: "Permiso con goce de sueldo",  className: "text-green-400 bg-green-400/10 border-green-400/20" },
  amonestacion:         { label: "Amonestación",                 className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  vacaciones:           { label: "Vacaciones",                   className: "text-teal-400 bg-teal-400/10 border-teal-400/20" },
  horas_extra:          { label: "Horas Extra (cobertura)",      className: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  permiso_sin_goce:     { label: "Permiso sin goce de sueldo",   className: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  permiso_con_goce:     { label: "Permiso con goce de sueldo",   className: "text-green-400 bg-green-400/10 border-green-400/20" },
  abandono_parcial:     { label: "Abandono parcial",             className: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  suspension_disciplinaria: { label: "Suspensión disciplinaria", className: "text-red-500 bg-red-500/10 border-red-500/20" },
  anulacion_falta:      { label: "Anulación de falta",          className: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
};

export const TIPOS_EVENTO = [
  { value: "falta",              label: "Falta injustificada" },
  { value: "suspension",         label: "Suspensión" },
  { value: "incapacidad",        label: "Incapacidad" },
  { value: "permiso_goce_sueldo",label: "Permiso con goce de sueldo" },
  { value: "amonestacion",       label: "Amonestación verbal/escrita" },
  { value: "vacaciones",         label: "Vacaciones" },
];
