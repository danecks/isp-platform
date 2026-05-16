import { Shield, ChevronRight, Edit2 } from "lucide-react";
import type { Pool, Agente, JefeServicioPool } from "../types";
import { avatarColor, iniciales } from "../utils";

interface Props {
  pool: Pool;
  agenteSeleccionado: Agente | null;
  onSelectAgente: (a: Agente | ((prev: Agente | null) => Agente | null)) => void;
  fechaVistaCerrada: boolean;
  colJefes: boolean;
  onToggleJefes: () => void;
  onEditarPlantilla: (data: { empleadoId: number; empleadoNombre: string; tipo: "jefe_servicio" }) => void;
}

export function PanelJefesServicioHoy({
  pool, agenteSeleccionado, onSelectAgente, fechaVistaCerrada,
  colJefes, onToggleJefes, onEditarPlantilla,
}: Props) {
  if ((pool.jefes_servicio?.length ?? 0) === 0) return null;
  const jefesHoy     = pool.jefes_servicio.filter(js => js.trabaja_hoy === true);
  const jefesMañana  = pool.jefes_servicio.filter(js => js.trabaja_mañana === true && js.trabaja_hoy !== true);
  const jefesDescanso = pool.jefes_servicio.filter(js => js.trabaja_hoy === false && js.estado_ciclo === "descansando_ciclo");
  const jefesOtros   = pool.jefes_servicio.filter(js => js.trabaja_hoy === null || js.estado_ciclo === "sin_turno");

  const JefeCard = ({ js, variante }: { js: JefeServicioPool; variante: "hoy" | "mañana" | "descanso" | "otro" }) => {
    const esSeleccionado = agenteSeleccionado?.id === js.id;
    const seleccionable = variante === "descanso" && !fechaVistaCerrada;
    const badgeCls = variante === "hoy"
      ? "text-orange-200/90 bg-orange-500/20 border-orange-400/35"
      : variante === "mañana"
        ? "text-amber-300/70 bg-amber-500/10 border-amber-500/20"
        : "text-white/25 bg-white/3 border-white/8";
    const badgeLabel = variante === "hoy" ? "EN TURNO" : variante === "mañana" ? "MAÑANA" : variante === "descanso" ? "DESCANSO" : "SIN TURNO";

    const handleClick = seleccionable ? () => {
      const agente = pool.descansandoCiclo.find(a => a.id === js.id);
      if (agente) onSelectAgente(prev => prev?.id === agente.id ? null : agente);
    } : undefined;

    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all select-none ${esSeleccionado ? "border-orange-400/60 bg-orange-500/15 ring-1 ring-orange-400/30" : seleccionable ? "border-orange-500/20 bg-orange-500/5 cursor-pointer hover:border-orange-400/40" : variante === "hoy" ? "border-orange-500/25 bg-orange-500/6" : "border-white/5 bg-transparent"}`}
        onClick={handleClick}
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(js.nombre_completo)} ${variante === "hoy" ? "ring-1 ring-orange-400/35" : ""} ${esSeleccionado ? "ring-2 ring-orange-400/50" : ""}`}>
          {iniciales(js.nombre_completo)}
        </div>
        <p className={`text-[11px] font-medium truncate max-w-[88px] ${variante === "hoy" ? "text-white/90" : "text-white/40"}`}>{js.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}>{badgeLabel}</span>
        {esSeleccionado && <span className="text-[8px] text-orange-300 animate-pulse shrink-0">✓</span>}
        <button
          onClick={e => { e.stopPropagation(); onEditarPlantilla({ empleadoId: js.id, empleadoNombre: js.nombre_completo, tipo: "jefe_servicio" }); }}
          title="Editar plantilla de turno"
          className="text-orange-300/60 hover:text-orange-200 hover:bg-orange-500/15 border border-orange-500/20 rounded p-0.5 shrink-0">
          <Edit2 className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-[#060f1a] border border-orange-500/15 rounded-xl overflow-hidden">
      <button
        onClick={onToggleJefes}
        className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-orange-500/5 transition-colors"
      >
        <Shield className="w-3 h-3 text-orange-400/60 shrink-0" />
        <span className="text-[11px] font-bold text-orange-300/65 uppercase tracking-widest">Jefes de Servicio</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[10px]">
          {jefesHoy.length > 0 && (
            <span className="text-emerald-400/80 font-semibold">🟢 {jefesHoy.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>
          )}
          {jefesDescanso.length > 0 && (
            <span className="text-blue-400/60">🔵 {jefesDescanso.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>
          )}
          {jefesHoy.length === 0 && jefesDescanso.length === 0 && (
            <span className="text-white/20">Sin turno activo</span>
          )}
        </div>
        <ChevronRight className={`w-3 h-3 text-orange-400/25 group-hover:text-orange-400/50 ml-2 shrink-0 transition-transform ${colJefes ? "" : "rotate-90"}`} />
      </button>
      {!colJefes && (
        <div className="border-t border-orange-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {[...jefesHoy.map(js => ({ js, variante: "hoy" as const })), ...jefesMañana.map(js => ({ js, variante: "mañana" as const })), ...jefesDescanso.map(js => ({ js, variante: "descanso" as const })), ...jefesOtros.map(js => ({ js, variante: "otro" as const }))].map(({ js, variante }) => (
            <JefeCard key={js.id} js={js} variante={variante} />
          ))}
        </div>
      )}
    </div>
  );
}
