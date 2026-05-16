import { Shield, ChevronRight } from "lucide-react";
import { avatarColor, iniciales } from "../utils";
import { useOperacionesContext } from "../OperacionesContext";

export function PanelSupervisoresFuturo() {
  const { poolFuturo, esFuturo, colSupers, toggleColSupers } = useOperacionesContext();
  if (!esFuturo || !poolFuturo) return null;
  const svTurno    = poolFuturo.trabajando.filter(a => a.tipo_personal === "supervisor");
  const svDescanso = poolFuturo.descansando.filter(a => a.tipo_personal === "supervisor");
  if (svTurno.length + svDescanso.length === 0) return null;
  return (
    <div className="bg-[#060f1a] border border-violet-500/15 rounded-xl overflow-hidden">
      <button
        onClick={toggleColSupers}
        className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-violet-500/5 transition-colors"
      >
        <Shield className="w-3 h-3 text-violet-400/60 shrink-0" />
        <span className="text-[11px] font-bold text-violet-300/65 uppercase tracking-widest">Supervisores</span>
        <span className="text-[9px] text-violet-400/45 font-bold bg-violet-500/10 border border-violet-500/15 px-1 py-0.5 rounded-full">{svTurno.length + svDescanso.length}</span>
        <div className="flex-1" />
        {svTurno.length > 0 && <span className="text-emerald-400/80 text-[10px] font-semibold">🟢 {svTurno.length} turno</span>}
        {svDescanso.length > 0 && <span className="text-blue-400/60 text-[10px]">🔵 {svDescanso.length} descanso</span>}
        <ChevronRight className={`w-3 h-3 text-violet-400/25 group-hover:text-violet-400/50 ml-2 shrink-0 transition-transform ${colSupers ? "" : "rotate-90"}`} />
      </button>
      {!colSupers && (
        <div className="border-t border-violet-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {[...svTurno, ...svDescanso].map(ag => {
            const enTurno = svTurno.some(s => s.id === ag.id);
            return (
              <div key={ag.id} className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${enTurno ? "border-violet-500/25 bg-violet-500/6" : "border-white/5"}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${enTurno ? "" : "opacity-50"} ${avatarColor(ag.nombre_completo)}`}>
                  {iniciales(ag.nombre_completo)}
                </div>
                <p className={`text-[11px] font-medium truncate max-w-[88px] ${enTurno ? "text-white/85" : "text-white/40"}`}>{ag.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${enTurno ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" : "text-white/25 bg-white/3 border-white/8"}`}>{enTurno ? "EN TURNO" : "DESCANSO"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
