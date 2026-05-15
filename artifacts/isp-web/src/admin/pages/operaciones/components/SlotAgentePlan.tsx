import { XCircle } from "lucide-react";
import { iniciales, avatarColor } from "../utils";
import { Agente, EmpleadoBusqueda } from "../types";
import { SelectorAgenteAgrupado } from "../components/SelectorAgenteAgrupado";

export function SlotAgentePlan({
  slotIdx,
  totalSlots,
  fecha,
  agenteSel,
  idsOcupados,
  onSelect,
  onClear,
}: {
  slotIdx: number;
  totalSlots: number;
  fecha: string;
  agenteSel: EmpleadoBusqueda | null;
  idsOcupados: number[];
  onSelect: (emp: EmpleadoBusqueda) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest block mb-1">
        Guardia {totalSlots > 1 ? slotIdx + 1 : ""} <span className="text-white/20 normal-case font-normal">(opcional)</span>
      </label>
      {agenteSel ? (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-xl px-3 py-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(agenteSel.nombreCompleto)}`}>
            {iniciales(agenteSel.nombreCompleto)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-200 truncate">{agenteSel.nombreCompleto}</p>
            <p className="text-[10px] text-blue-300/50">{agenteSel.puesto ?? "Agente"}</p>
          </div>
          <button onClick={onClear} className="text-white/25 hover:text-red-400 transition-colors">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <SelectorAgenteAgrupado
          fecha={fecha}
          idsExcluidos={idsOcupados}
          seleccionado={null}
          onSelect={(a) => onSelect({ id: a.id, nombreCompleto: a.nombre, puesto: a.detalle, area: null })}
        />
      )}
    </div>
  );
}

