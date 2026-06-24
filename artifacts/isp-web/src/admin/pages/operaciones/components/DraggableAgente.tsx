import type React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Agente } from "../types";
import { avatarColor, etiquetaInicioFuturo, iniciales, tooltipPersona } from "../utils";

export const ESTADO_PUESTO_BADGE: Record<string, { label: string; cls: string }> = {
  relevo_completo:  { label: "Falta",       cls: "bg-red-500/20 text-red-300" },
  relevo_parcial:   { label: "Parcial",     cls: "bg-amber-500/20 text-amber-300" },
  abandono_parcial: { label: "Abandono",    cls: "bg-red-500/20 text-red-300" },
  suspension:       { label: "Suspendido",  cls: "bg-orange-500/20 text-orange-300" },
  vacaciones:       { label: "Vacaciones",  cls: "bg-blue-500/20 text-blue-300" },
  incapacidad:      { label: "Incapacidad", cls: "bg-purple-500/20 text-purple-300" },
};

export function DraggableAgente({
  agente,
  onClick,
  isSelected,
  disabled,
  motivos,
}: {
  agente: Agente;
  onClick: () => void;
  isSelected: boolean;
  disabled?: boolean;
  motivos?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `agent-${agente.id}`,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        relative flex flex-col gap-1.5 p-2.5 rounded-xl border cursor-pointer
        transition-all select-none group
        ${isSelected
          ? "bg-primary/15 border-primary/40 shadow-md shadow-primary/10 ring-1 ring-primary/30"
          : "bg-[#0c1929] border-white/8 hover:border-white/15 hover:bg-white/4"}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
    >
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(agente.nombre_completo)}`}>
          {iniciales(agente.nombre_completo)}
        </div>
        <div className="flex-1 min-w-0">
          <p title={tooltipPersona(agente.nombre_completo, agente.fecha_ingreso, agente.telefono)} className="text-xs font-semibold text-white/90 truncate leading-tight">{agente.nombre_completo}</p>
          <p className="text-[10px] text-white/35 truncate leading-tight">
            {agente.nombre_puesto_titular
              ? `${agente.nombre_puesto_titular}${agente.cliente_puesto_titular ? ` · ${agente.cliente_puesto_titular}` : ""}`
              : agente.turno_nombre ? agente.turno_nombre : (agente.puesto ?? "Agente")}
          </p>
        </div>
        {isSelected && (
          <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 animate-pulse" />
        )}
      </div>
      {/* Etiqueta informativa: empleado con fecha de ingreso futura (no asignable aún) */}
      {(() => {
        const et = etiquetaInicioFuturo(agente.fecha_ingreso);
        if (!et) return null;
        return (
          <div
            className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25"
            title="Este empleado aún no inicia labores. No se le puede asignar puesto ni cobertura hasta su fecha de ingreso."
          >
            <span aria-hidden="true">⏳</span>
            {et}
          </div>
        );
      })()}
    </div>
  );
}
