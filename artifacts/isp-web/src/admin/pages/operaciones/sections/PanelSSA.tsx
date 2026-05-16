import { Zap, ChevronRight, AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { TarjetaSSAPendiente } from "../types";
import { TarjetaSSACard } from "../components/TarjetaSSACard";

interface Props {
  tarjetasSSA: TarjetaSSAPendiente[];
  ssaSinAgente: TarjetaSSAPendiente[];
  ssaCubierta: TarjetaSSAPendiente[];
  ssaTabActivo: "sin_asignar" | "cubierta";
  onSetSsaTab: (t: "sin_asignar" | "cubierta") => void;
  colSSA: boolean;
  onToggleSSA: () => void;
  fechaVistaCerrada: boolean;
  onAsignar: (t: TarjetaSSAPendiente) => void;
  onRemover: (t: TarjetaSSAPendiente, motivo: string, notas?: string) => void;
}

export function PanelSSA({
  tarjetasSSA, ssaSinAgente, ssaCubierta, ssaTabActivo, onSetSsaTab,
  colSSA, onToggleSSA, fechaVistaCerrada, onAsignar, onRemover,
}: Props) {
  if (tarjetasSSA.length === 0) return null;
  return (
    <div className="bg-[#06101c] border border-white/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6">
        <button
          onClick={onToggleSSA}
          className="flex items-center gap-2 flex-1 text-left group"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-white/70">Servicios Especiales Activos</span>
          <span className="text-[10px] text-white/25 bg-white/6 px-2 py-0.5 rounded-full">{tarjetasSSA.length}</span>
          {colSSA && <span className="text-[10px] text-white/20 ml-1">— minimizado</span>}
          <ChevronRight className={`w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-all ml-auto shrink-0 ${colSSA ? "" : "rotate-90"}`} />
        </button>
        <a
          href="/admin/tablero-servicios"
          className="text-[10px] text-primary/60 hover:text-primary transition-colors flex items-center gap-1 shrink-0"
        >
          Ver completo <ChevronRight className="w-3 h-3" />
        </a>
      </div>
      {!colSSA && (
        <>
          <div className="flex border-b border-white/6">
            <button
              onClick={() => onSetSsaTab("sin_asignar")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                ssaTabActivo === "sin_asignar"
                  ? "border-amber-400 text-amber-300 bg-amber-500/5"
                  : "border-transparent text-white/30 hover:text-white/60"
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              Sin asignar
              {ssaSinAgente.length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  ssaTabActivo === "sin_asignar" ? "bg-amber-400/20 text-amber-300" : "bg-white/8 text-white/30"
                }`}>{ssaSinAgente.length}</span>
              )}
            </button>
            <button
              onClick={() => onSetSsaTab("cubierta")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                ssaTabActivo === "cubierta"
                  ? "border-green-400 text-green-300 bg-green-500/5"
                  : "border-transparent text-white/30 hover:text-white/60"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Cubierta / Pre-Planilla
              {ssaCubierta.length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  ssaTabActivo === "cubierta" ? "bg-green-400/20 text-green-300" : "bg-white/8 text-white/30"
                }`}>{ssaCubierta.length}</span>
              )}
            </button>
          </div>
          <div className="flex flex-col gap-2 px-3 py-3 max-h-64 overflow-y-auto">
            {ssaTabActivo === "sin_asignar" && (
              ssaSinAgente.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-white/25 py-1">
                  <CheckCircle2 className="w-4 h-4 text-green-400/50" />
                  Todos los servicios tienen guardia asignado
                </div>
              ) : (
                ssaSinAgente.map((t) => <TarjetaSSACard key={t.id} t={t} onAsignar={() => onAsignar(t)} />)
              )
            )}
            {ssaTabActivo === "cubierta" && (
              ssaCubierta.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-white/25 py-1">
                  <Info className="w-4 h-4 text-white/20" />
                  No hay servicios cubiertos activos
                </div>
              ) : (
                ssaCubierta.map((t) => (
                  <TarjetaSSACard
                    key={t.id}
                    t={t}
                    onAsignar={() => onAsignar(t)}
                    onRemover={fechaVistaCerrada ? undefined : (motivo, notas) => onRemover(t, motivo, notas)}
                  />
                ))
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
