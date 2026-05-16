import type { Agente } from "../types";
import { avatarColor, iniciales } from "../utils";

interface Props {
  agente: Agente;
}

export function DragOverlayAgente({ agente }: Props) {
  return (
    <div className="bg-[#07111f] border border-primary/40 rounded-xl px-3 py-2 shadow-2xl shadow-primary/20 flex items-center gap-2 opacity-95 rotate-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(agente.nombre_completo)}`}>
        {iniciales(agente.nombre_completo)}
      </div>
      <div>
        <p className="text-xs font-semibold text-white">{agente.nombre_completo}</p>
        <p className="text-[10px] text-white/40">{agente.puesto ?? "Agente"}</p>
      </div>
    </div>
  );
}
