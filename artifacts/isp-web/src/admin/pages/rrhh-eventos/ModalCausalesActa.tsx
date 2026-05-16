import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, FileText, Loader2, X } from "lucide-react";
import type { EventoRrhh } from "@/lib/pdfRrhh";
import { fmtFecha } from "./helpers";
import { TIPO_CONFIG } from "./constants";

export function ModalCausalesActa({
  evento,
  onGenerar,
  onClose,
}: {
  evento: EventoRrhh;
  onGenerar: (causales: string[], hechosExtra?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [causales, setCausales] = useState<string[]>(() => {
    if (evento.tipo_evento === "falta" || evento.tipo_evento === "falta_injustificada") return ["falta_injustificada"];
    if (evento.tipo_evento === "abandono_parcial") return ["ausencia_sin_permiso"];
    return [];
  });
  const [hechosExtra, setHechosExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [allCausales, setAllCausales] = useState<Array<{ id: string; label: string; desc: string; articulo: string }>>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    import("../../../lib/pdfRrhh")
      .then(m => setAllCausales([...m.CAUSALES_ACTA]))
      .catch(() => setLoadError(true));
  }, []);

  const toggle = (id: string) => {
    setCausales(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  async function handleConfirm() {
    if (causales.length === 0) return;
    setLoading(true);
    try {
      await onGenerar(causales, hechosExtra || undefined);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-amber-500/20 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-amber-500/10 bg-amber-500/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Generar Acta Administrativa</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 space-y-1">
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Evento base</p>
            <p className="text-sm text-white font-medium">{evento.employee_nombre}</p>
            <p className="text-xs text-white/40">
              {TIPO_CONFIG[evento.tipo_evento]?.label ?? evento.tipo_evento} · {fmtFecha(evento.fecha)}
              {evento.cliente_nombre && ` · ${evento.cliente_nombre}`}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 mb-2">Causales del Código de Trabajo</p>
            {loadError && <p className="text-[10px] text-red-400 py-2">Error al cargar causales. Recarga la página.</p>}
            {!loadError && allCausales.length === 0 && (
              <div className="flex items-center gap-2 py-3 text-white/30 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" /> Cargando causales…</div>
            )}
            <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {allCausales.map(c => {
                const active = causales.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
                    className={`text-left rounded-lg px-3 py-2 border transition-colors ${active ? "bg-amber-500/10 border-amber-500/25 text-amber-200" : "bg-white/3 border-white/8 text-white/50 hover:bg-white/5"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? "bg-amber-500 border-amber-500" : "border-white/20"}`}>
                        {active && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-[10px] font-semibold">{c.label}</span>
                      <span className="text-[9px] text-white/25 ml-auto">{c.articulo}</span>
                    </div>
                    {active && <p className="text-[9px] text-white/30 mt-1 ml-5">{c.desc}</p>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 block mb-1">Hechos adicionales (opcional)</label>
            <textarea
              value={hechosExtra}
              onChange={e => setHechosExtra(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20"
              placeholder="Describir hechos específicos o dejar en blanco para texto automático…"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/8 flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 text-xs text-white/40 hover:text-white/60 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={loading || causales.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg py-2 disabled:opacity-40 transition-colors">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {loading ? "Generando…" : `Generar Acta (${causales.length} causal${causales.length !== 1 ? "es" : ""})`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
