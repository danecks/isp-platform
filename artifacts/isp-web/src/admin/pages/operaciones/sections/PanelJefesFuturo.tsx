import { Shield, ChevronRight } from "lucide-react";
import type { PoolFuturoData } from "../types";
import { avatarColor, iniciales } from "../utils";

interface Props {
  poolFuturo: PoolFuturoData;
  colJefes: boolean;
  onToggleJefes: () => void;
}

export function PanelJefesFuturo({ poolFuturo, colJefes, onToggleJefes }: Props) {
  const jfTurno    = poolFuturo.trabajando.filter(a => a.tipo_personal === "jefe_servicio");
  const jfDescanso = poolFuturo.descansando.filter(a => a.tipo_personal === "jefe_servicio");
  if (jfTurno.length + jfDescanso.length === 0) return null;
  return (
    <div className="bg-[#060f1a] border border-orange-500/15 rounded-xl overflow-hidden">
      <button
        onClick={onToggleJefes}
        className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-orange-500/5 transition-colors"
      >
        <Shield className="w-3 h-3 text-orange-400/60 shrink-0" />
        <span className="text-[11px] font-bold text-orange-300/65 uppercase tracking-widest">Jefes de Servicio</span>
        <span className="text-[9px] text-orange-400/45 font-bold bg-orange-500/10 border border-orange-500/15 px-1 py-0.5 rounded-full">{jfTurno.length + jfDescanso.length}</span>
        <div className="flex-1" />
        {jfTurno.length > 0 && <span className="text-emerald-400/80 text-[10px] font-semibold">🟢 {jfTurno.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>}
        {jfDescanso.length > 0 && <span className="text-blue-400/60 text-[10px]">🔵 {jfDescanso.length} descanso</span>}
        <ChevronRight className={`w-3 h-3 text-orange-400/25 group-hover:text-orange-400/50 ml-2 shrink-0 transition-transform ${colJefes ? "" : "rotate-90"}`} />
      </button>
      {!colJefes && (
        <div className="border-t border-orange-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {[...jfTurno, ...jfDescanso].map(ag => {
            const enTurno = jfTurno.some(j => j.id === ag.id);
            return (
              <div key={ag.id} className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${enTurno ? "border-orange-500/25 bg-orange-500/6" : "border-white/5"}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${enTurno ? "ring-1 ring-orange-400/30" : "opacity-50"} ${avatarColor(ag.nombre_completo)}`}>
                  {iniciales(ag.nombre_completo)}
                </div>
                <p className={`text-[11px] font-medium truncate max-w-[88px] ${enTurno ? "text-white/90" : "text-white/40"}`}>{ag.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${enTurno ? "text-orange-200 bg-orange-500/20 border-orange-400/35" : "text-white/25 bg-white/3 border-white/8"}`}>{enTurno ? "EN TURNO" : "DESCANSO"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
