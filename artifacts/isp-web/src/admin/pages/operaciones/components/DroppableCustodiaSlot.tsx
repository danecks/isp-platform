import { useDroppable } from "@dnd-kit/core";
import { Truck } from "lucide-react";
import { Puesto } from "../types";

export function DroppableCustodiaSlot({
  puesto,
  isAgenteSeleccionado,
  onClick,
  onRegistrarFalta,
}: {
  puesto: Puesto;
  isAgenteSeleccionado: boolean;
  onClick: () => void;
  onRegistrarFalta?: (puesto: Puesto, titularId: number, titularNombre: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `puesto-${puesto.id}` });
  const cubierto = puesto.estado === "cubierto" && puesto.agente_id;
  const tieneTitular = !!puesto.titular_employee_id;
  const titularFaltando = (puesto as any).titular_faltando === true;
  const esRelevo = cubierto && tieneTitular && puesto.agente_id !== puesto.titular_employee_id;
  const slotVacio = (puesto as any).tiene_slot_vacio === true;

  const borderClass = isOver
    ? "border-amber-400/50 bg-amber-500/10 scale-[1.02]"
    : esRelevo
      ? "border-amber-500/30 bg-[#0f1208] hover:border-amber-400/40"
      : cubierto
        ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-400/30"
        : titularFaltando
          ? "border-red-500/30 bg-red-500/5 hover:border-red-400/40"
          : isAgenteSeleccionado
            ? "border-dashed border-white/20 bg-white/[0.02] animate-pulse"
            : "border-white/8 bg-white/[0.02] hover:border-white/15";

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`relative rounded-xl border px-2.5 py-2 cursor-pointer transition-all group ${borderClass}`}
    >
      <div className="flex items-center gap-2">
        <Truck className={`w-3.5 h-3.5 shrink-0 ${
          cubierto ? "text-amber-400" : titularFaltando ? "text-red-400" : "text-white/20"
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-white/40 font-medium">Custodio {puesto.slot_numero}</p>
            {puesto.arma_codigo && (
              <span className="text-[8px] bg-white/8 text-white/50 px-1 py-0.5 rounded font-mono">{puesto.arma_codigo}</span>
            )}
          </div>
          {cubierto ? (
            <>
              <p className="text-xs text-white font-semibold truncate">{puesto.agente_nombre}</p>
              {esRelevo && (
                <p className="text-[9px] text-amber-400/70 truncate">
                  Relevo → Titular: {puesto.titular_nombre}
                </p>
              )}
            </>
          ) : titularFaltando ? (
            <>
              <p className="text-[11px] text-red-400 font-medium truncate">Faltante</p>
              <p className="text-[9px] text-red-400/60 truncate">Titular: {puesto.titular_nombre}</p>
            </>
          ) : slotVacio ? (
            <p className="text-[11px] text-white/25 italic">Sin titular asignado</p>
          ) : (
            <p className="text-[11px] text-white/25 italic">Sin asignar</p>
          )}
          {puesto.arma_codigo && puesto.arma_tipo && (
            <p className="text-[8px] text-white/30 truncate mt-0.5">
              {puesto.arma_tipo}{puesto.arma_marca ? ` ${puesto.arma_marca}` : ""}{(puesto as any).arma_serie ? ` · S: ${(puesto as any).arma_serie}` : ""}
            </p>
          )}
        </div>
        {cubierto ? (
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        ) : titularFaltando ? (
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-red-400/50 shrink-0 animate-pulse" />
        )}
      </div>
      {tieneTitular && !titularFaltando && onRegistrarFalta && (
        <button
          onClick={e => { e.stopPropagation(); onRegistrarFalta(puesto, puesto.titular_employee_id!, puesto.titular_nombre!); }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-[9px] bg-red-500/20 hover:bg-red-500/40 text-red-300 px-1.5 py-0.5 rounded transition-all"
          title="Registrar falta"
        >
          Falta
        </button>
      )}
    </div>
  );
}

