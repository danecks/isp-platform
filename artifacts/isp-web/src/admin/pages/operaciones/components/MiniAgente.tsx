import type { Agente } from "../types";
import { avatarColor, iniciales } from "../utils";

export function MiniAgente({ agente, compact = false }: { agente: Agente; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : ""}`}>
      <div className={`${compact ? "w-7 h-7 text-xs" : "w-8 h-8 text-xs"} rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${avatarColor(agente.nombre_completo)}`}>
        {iniciales(agente.nombre_completo)}
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90 truncate leading-none">{agente.nombre_completo}</p>
          {agente.puesto && <p className="text-[10px] text-white/35 truncate mt-0.5">{agente.puesto}</p>}
        </div>
      )}
    </div>
  );
}
