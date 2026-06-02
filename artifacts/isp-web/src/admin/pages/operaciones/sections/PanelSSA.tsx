import { useState } from "react";
import { Zap, ChevronRight, AlertCircle, CheckCircle2, Info, Plus, Inbox, Loader2 } from "lucide-react";
import { TarjetaSSACard } from "../components/TarjetaSSACard";
import { useOperacionesContext } from "../OperacionesContext";
import { useToast } from "@/hooks/use-toast";

const TIPO_LABELS: Record<string, string> = {
  guardia_extra: "Guardia extra",
  ampliacion_horario: "Ampliación de horario",
  cobertura_evento: "Cobertura de evento",
  custodia_extra: "Custodia extra",
  apoyo_temporal: "Apoyo temporal",
};

function fmtFecha(f: string) {
  try {
    return new Date(f + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
  } catch {
    return f;
  }
}

export function PanelSSA() {
  const {
    tarjetasSSA, ssaSinAgente, ssaCubierta, ssaTabActivo, setSsaTabActivo,
    colSSA, toggleColSSA, fechaVistaCerrada, setModalAsignarSSA, assignment,
    ssaPorActivar, activarSSA, setModalCrearSSA,
  } = useOperacionesContext();
  const { toast } = useToast();
  const [activandoId, setActivandoId] = useState<string | null>(null);

  const onAsignar = (t: typeof tarjetasSSA[number]) => setModalAsignarSSA(t);
  const onRemover = (t: typeof tarjetasSSA[number], motivo: string, notas?: string) =>
    assignment.removerAgenteSSA(t, motivo, notas);

  async function onActivar(id: string) {
    setActivandoId(id);
    try {
      await activarSSA(id);
      toast({ title: "Solicitud activada", description: "Ya aparece en el pizarrón para asignar." });
    } catch {
      toast({ title: "Error al activar", variant: "destructive" });
    } finally {
      setActivandoId(null);
    }
  }

  const totalVisible = tarjetasSSA.length + ssaPorActivar.length;

  return (
    <div className="bg-[#06101c] border border-white/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6">
        <button
          onClick={toggleColSSA}
          className="flex items-center gap-2 flex-1 text-left group"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-white/70">Servicios Especiales Activos</span>
          <span className="text-[10px] text-white/25 bg-white/6 px-2 py-0.5 rounded-full">{totalVisible}</span>
          {colSSA && <span className="text-[10px] text-white/20 ml-1">— minimizado</span>}
          <ChevronRight className={`w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-all ml-auto shrink-0 ${colSSA ? "" : "rotate-90"}`} />
        </button>
        <button
          onClick={() => setModalCrearSSA(true)}
          className="text-[10px] font-semibold text-[#060e1c] bg-primary hover:bg-primary/90 transition-colors flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg"
        >
          <Plus className="w-3 h-3" /> Nueva solicitud
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
              onClick={() => setSsaTabActivo("por_activar")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                ssaTabActivo === "por_activar"
                  ? "border-sky-400 text-sky-300 bg-sky-500/5"
                  : "border-transparent text-white/30 hover:text-white/60"
              }`}
            >
              <Inbox className="w-3 h-3" />
              Por activar
              {ssaPorActivar.length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  ssaTabActivo === "por_activar" ? "bg-sky-400/20 text-sky-300" : "bg-white/8 text-white/30"
                }`}>{ssaPorActivar.length}</span>
              )}
            </button>
            <button
              onClick={() => setSsaTabActivo("sin_asignar")}
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
              onClick={() => setSsaTabActivo("cubierta")}
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
            {ssaTabActivo === "por_activar" && (
              ssaPorActivar.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-white/25 py-1">
                  <Info className="w-4 h-4 text-white/20" />
                  No hay solicitudes nuevas por activar
                </div>
              ) : (
                ssaPorActivar.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/85 truncate">
                        {TIPO_LABELS[t.tipo_solicitud] ?? t.tipo_solicitud}
                        <span className="text-white/40 font-normal"> · {fmtFecha(t.fecha)}</span>
                      </p>
                      <p className="text-[10px] text-white/40 truncate">
                        {t.cliente_nombre ?? "Sin cliente"}
                        {t.cantidad_guardias > 1 && ` · ${t.cantidad_guardias} guardias`}
                      </p>
                    </div>
                    <button
                      onClick={() => onActivar(t.id)}
                      disabled={activandoId === t.id}
                      className="shrink-0 text-[10px] font-bold text-[#060e1c] bg-sky-400 hover:bg-sky-300 disabled:opacity-50 transition-colors flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                    >
                      {activandoId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Activar
                    </button>
                  </div>
                ))
              )
            )}
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
