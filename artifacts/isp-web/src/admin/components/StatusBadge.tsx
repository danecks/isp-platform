import { MessageCircle } from "lucide-react";
import type {
  EstadoIncidenciaType,
  EstadoPostulanteType,
  EstadoLeadType,
  EstadoTareaType,
  EstadoCustodiaType,
  EstadoClienteType,
  OrigenType,
  PrioridadType,
} from "../types";

type BadgeVariant =
  | EstadoIncidenciaType
  | EstadoPostulanteType
  | EstadoLeadType
  | EstadoTareaType
  | EstadoCustodiaType
  | EstadoClienteType
  | OrigenType
  | PrioridadType;

const config: Record<string, { label: string; className: string; icon?: "whatsapp" }> = {
  abierta:     { label: "Abierta",     className: "bg-red-500/15 text-red-400 border-red-500/20" },
  en_proceso:  { label: "En Proceso",  className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  resuelta:    { label: "Resuelta",    className: "bg-green-500/15 text-green-400 border-green-500/20" },
  cerrada:     { label: "Cerrada",     className: "bg-white/5 text-white/40 border-white/10" },
  recibido:    { label: "Recibido",    className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  en_revision: { label: "En Revisión", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  entrevista:  { label: "Entrevista",  className: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  aprobado:    { label: "Aprobado",    className: "bg-green-500/15 text-green-400 border-green-500/20" },
  descartado:  { label: "Descartado",  className: "bg-white/5 text-white/40 border-white/10" },
  nuevo:       { label: "Nuevo",       className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  contactado:  { label: "Contactado",  className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  cotizado:    { label: "Cotizado",    className: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  ganado:      { label: "Ganado",      className: "bg-green-500/15 text-green-400 border-green-500/20" },
  perdido:     { label: "Perdido",     className: "bg-red-500/15 text-red-400 border-red-500/20" },
  pendiente:   { label: "Pendiente",   className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  completada:  { label: "Completada",  className: "bg-green-500/15 text-green-400 border-green-500/20" },
  cancelada:   { label: "Cancelada",   className: "bg-white/5 text-white/40 border-white/10" },
  planificada: { label: "Planificada", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  en_ruta:     { label: "En Ruta",     className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  incidente:   { label: "Incidente",   className: "bg-red-500/15 text-red-400 border-red-500/20" },
  activo:      { label: "Activo",      className: "bg-green-500/15 text-green-400 border-green-500/20" },
  revision:    { label: "En Revisión", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  inactivo:    { label: "Inactivo",    className: "bg-white/5 text-white/40 border-white/10" },
  web:         { label: "Web",         className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  llamada:     { label: "Llamada",     className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  portal:      { label: "Portal",      className: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
  manual:      { label: "Manual",      className: "bg-white/5 text-white/50 border-white/10" },
  whatsapp:    { label: "WhatsApp",    className: "bg-[#25D366]/12 text-[#25D366] border-[#25D366]/25", icon: "whatsapp" },
  alta:        { label: "Alta",        className: "bg-red-500/15 text-red-400 border-red-500/20" },
  media:       { label: "Media",       className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  baja:        { label: "Baja",        className: "bg-white/5 text-white/50 border-white/10" },
  urgente:     { label: "Urgente",     className: "bg-red-600/20 text-red-300 border-red-500/30 font-bold" },
};

interface StatusBadgeProps {
  value: BadgeVariant;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const def = config[value] ?? { label: value, className: "bg-white/5 text-white/40 border-white/10" };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${def.className}`}
    >
      {def.icon === "whatsapp" && (
        <MessageCircle className="w-2.5 h-2.5 shrink-0" strokeWidth={2.5} />
      )}
      {def.label}
    </span>
  );
}
