import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, AlertTriangle, CheckCircle2, ShieldCheck, Lock } from "lucide-react";
import { API_BASE, getSession } from "../utils";
import { CierreResumen, PreviewCustodia } from "../types";

export function ModalCierre({
  resumen,
  advertencias,
  fechaActivaStr,
  fechaIso,
  onConfirm,
  onClose,
}: {
  resumen: CierreResumen;
  advertencias: string[];
  fechaActivaStr: string;
  fechaIso?: string;
  onConfirm: (comentario: string, sincronizarCustodias: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const hoy      = fechaActivaStr;
  const esperado = `CERRAR ${hoy}`;
  const [texto,         setTexto]         = useState("");
  const [comentario,    setComentario]    = useState("");
  const [loading,       setLoading]       = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewArmas,   setPreviewArmas]   = useState<PreviewCustodia[]>([]);
  const [previewVeh,     setPreviewVeh]     = useState<PreviewCustodia[]>([]);
  const [resumenDia,     setResumenDia]     = useState<CierreResumen>(resumen);
  const valido = texto === esperado;
  const totalCambios = previewArmas.length + previewVeh.length;

  useEffect(() => {
    const ctrl = new AbortController();
    const qp = fechaIso ? `?fecha=${fechaIso}` : "";
    fetch(`${API_BASE}/operaciones/cierre/preview-custodias${qp}`, { signal: ctrl.signal, headers: { "x-isp-session": getSession() } })
      .then(r => r.json())
      .then(d => {
        setPreviewArmas(d.armas ?? []);
        setPreviewVeh(d.vehiculos ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingPreview(false));
    return () => ctrl.abort();
  }, [fechaIso]);

  // El resumen del día se calcula por fecha en el backend. Así también un cierre
  // retroactivo (fecha pasada) muestra números reales en vez de todo en ceros.
  useEffect(() => {
    if (!fechaIso) { setResumenDia(resumen); return; }
    const ctrl = new AbortController();
    fetch(`${API_BASE}/operaciones/cierre-resumen?fecha=${fechaIso}`, { signal: ctrl.signal, headers: { "x-isp-session": getSession() } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setResumenDia(d); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [fechaIso]);

  async function handleConfirm(sincronizarCustodias: boolean) {
    if (!valido) return;
    setLoading(true);
    try { await onConfirm(comentario, sincronizarCustodias); }
    finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Cerrar día operativo</h3>
            <span className="text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">{hoy}</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumen */}
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-2 font-semibold">Resumen del día</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Puestos totales",    value: resumenDia.totalPuestos,        color: "text-white" },
                { label: "Cubiertos titular",  value: resumenDia.cubiertosPorTitular, color: "text-green-400" },
                { label: "Cubiertos relevo",   value: resumenDia.cubiertosPorRelevo,  color: "text-yellow-400" },
                { label: "Descubiertos",        value: resumenDia.descubiertos,        color: resumenDia.descubiertos > 0 ? "text-red-400" : "text-white/30" },
                { label: "Ausencias",           value: resumenDia.ausencias,           color: resumenDia.ausencias > 0 ? "text-orange-400" : "text-white/30" },
                { label: "Horas extra",         value: resumenDia.horasExtra,          color: "text-blue-400" },
                ...((resumenDia as any).totalCustodiaSlots > 0 ? [
                  { label: "Custodia slots", value: (resumenDia as any).totalCustodiaSlots, color: "text-amber-400" },
                  { label: "Custodia cubiertos", value: (resumenDia as any).custodiaCubiertos ?? 0, color: "text-amber-300" },
                  { label: "Custodia desc.", value: (resumenDia as any).custodiaDescubiertos ?? 0, color: ((resumenDia as any).custodiaDescubiertos ?? 0) > 0 ? "text-red-400" : "text-white/30" },
                ] : []),
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#0c1929] border border-white/6 rounded-xl p-2.5 text-center">
                  <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
                  <p className="text-[9px] text-white/30 mt-1 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Advertencias */}
          {advertencias.length > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-400">Advertencias (no bloquean el cierre)</span>
              </div>
              {advertencias.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-300/80">
                  <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* Comentario opcional */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Comentario del cierre (opcional)</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Observaciones del día, novedades…"
              rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {/* Confirmación por texto */}
          <div className="space-y-2">
            <label className="text-xs text-white/40">
              Para confirmar, escribe exactamente:
              <span className="text-white font-bold ml-1 font-mono">{esperado}</span>
            </label>
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={esperado}
              className={`w-full bg-[#060e1c] border rounded-lg px-3 py-2.5 text-sm font-mono placeholder-white/15 outline-none transition-colors
                ${valido ? "border-green-500/50 text-green-300" : texto ? "border-red-500/30 text-white" : "border-white/10 text-white"}`}
            />
            {valido && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmación válida
              </div>
            )}
          </div>

          {/* Preview de custodias */}
          <div className="rounded-xl border border-white/8 bg-[#060e1c] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/6">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">Custodias a sincronizar</span>
              {loadingPreview && <Loader2 className="w-3 h-3 animate-spin text-white/30 ml-auto" />}
              {!loadingPreview && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${totalCambios > 0 ? "bg-teal-500/20 text-teal-400" : "bg-white/5 text-white/30"}`}>
                  {totalCambios} cambio{totalCambios !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {!loadingPreview && totalCambios === 0 && (
              <p className="text-[11px] text-white/30 px-3 py-2">Sin cambios pendientes de custodia.</p>
            )}
            {!loadingPreview && totalCambios > 0 && (
              <div className="divide-y divide-white/4 max-h-36 overflow-y-auto">
                {[...previewArmas, ...previewVeh].map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${c.tipo === "arma" ? "bg-orange-500/15 text-orange-400" : "bg-blue-500/15 text-blue-400"}`}>
                      {c.tipo === "arma" ? "Arma" : "Vehículo"}
                    </span>
                    <span className="font-mono text-white/80 font-semibold">{c.codigo}</span>
                    <span className="text-white/30 truncate flex-1 text-[10px]">{c.referencaNombre}</span>
                    <span className="text-white/40 text-[10px] shrink-0">{c.custodioAnteriorNombre.split(" ")[0]}</span>
                    <span className="text-white/20 text-[10px]">→</span>
                    <span className="text-teal-400 text-[10px] shrink-0 font-semibold">{c.custodioNuevoNombre.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleConfirm(false)}
              disabled={!valido || loading}
              className="flex-1 py-2.5 rounded-xl border border-amber-500/30 bg-amber-600/10 hover:bg-amber-600/20 text-sm text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Solo cerrar
            </button>
            <button
              onClick={() => handleConfirm(true)}
              disabled={!valido || loading || totalCambios === 0}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              title={totalCambios === 0 ? "Sin custodias que sincronizar" : `Cerrar y sincronizar ${totalCambios} custodia(s)`}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Cerrar + custodias
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Reabrir día ───────────────────────────────────────────────────────

