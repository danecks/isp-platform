import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Lock, X, Loader2, AlertOctagon, AlertTriangle, CheckCheck, XCircle, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "./helpers";
import type { Validacion } from "./types";

export function CierreModal({
  desde, hasta,
  validacion,
  validacionLoading,
  onClose,
  onCerrado,
}: {
  desde: string;
  hasta: string;
  validacion: Validacion | null;
  validacionLoading: boolean;
  onClose: () => void;
  onCerrado: () => void;
}) {
  const { toast } = useToast();
  const [obs, setObs] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [forzar, setForzar] = useState(false);

  const puedeEnviar = !cerrando && !validacionLoading && validacion != null &&
    (validacion.resumen.puede_cerrar || forzar);

  async function ejecutarCierre() {
    setCerrando(true);
    try {
      const cerradoPor = sessionStorage.getItem("isp_admin_usuario") ?? "admin";
      await apiFetch("/api/nomina/pre-planilla/cierre", {
        method: "POST",
        body: JSON.stringify({ desde, hasta, cerradoPor, observaciones: obs || null, forzar }),
      });
      toast({ title: "Pre-planilla cerrada", description: `Período ${desde} — ${hasta} congelado correctamente.` });
      onCerrado();
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error al cerrar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCerrando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#07111f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#060e1c]">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Cerrar pre-planilla del período</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          <div className="bg-white/4 border border-white/8 rounded-lg px-4 py-3">
            <p className="text-[10px] text-white/40 mb-1">Período a cerrar</p>
            <p className="text-sm font-semibold text-white">{desde} — {hasta}</p>
          </div>

          {validacionLoading && (
            <div className="flex items-center gap-2 text-sm text-white/40 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />Ejecutando validaciones automáticas…
            </div>
          )}
          {validacion && !validacionLoading && (
            <div className="space-y-3">
              <div className={`rounded-lg px-4 py-3 border ${
                validacion.resumen.errores > 0 ? "bg-red-500/8 border-red-500/30" :
                validacion.resumen.alertas > 0 ? "bg-amber-500/8 border-amber-500/25" :
                "bg-green-500/8 border-green-500/25"
              }`}>
                <div className="flex items-center gap-2">
                  {validacion.resumen.errores > 0
                    ? <AlertOctagon className="w-4 h-4 text-red-400" />
                    : validacion.resumen.alertas > 0
                    ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                    : <CheckCheck className="w-4 h-4 text-green-400" />}
                  <span className="text-xs font-semibold text-white/80">
                    {validacion.resumen.total_colaboradores} colaboradores · {validacion.resumen.errores} error{validacion.resumen.errores !== 1 ? "es" : ""} crítico{validacion.resumen.errores !== 1 ? "s" : ""} · {validacion.resumen.alertas} alerta{validacion.resumen.alertas !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {validacion.errores_criticos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Errores críticos — deben resolverse</p>
                  {validacion.errores_criticos.slice(0, 4).map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-300/80">
                      <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{e.mensaje}
                    </div>
                  ))}
                  {validacion.errores_criticos.length > 4 && (
                    <p className="text-[10px] text-red-400/60">…y {validacion.errores_criticos.length - 4} más</p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs text-amber-400/80">
                    <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)}
                      className="accent-amber-400" />
                    Cerrar de todas formas (requiere supervisión)
                  </label>
                </div>
              )}

              {validacion.alertas.length > 0 && validacion.errores_criticos.length === 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Alertas — el cierre procederá con advertencias</p>
                  {validacion.alertas.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-300/70">
                      <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />{a.mensaje}
                    </div>
                  ))}
                  {validacion.alertas.length > 3 && (
                    <p className="text-[10px] text-amber-400/60">…y {validacion.alertas.length - 3} más</p>
                  )}
                </div>
              )}

              {validacion.errores_criticos.length === 0 && validacion.alertas.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCheck className="w-4 h-4" />
                  Sin errores ni alertas. La pre-planilla está lista para cerrar.
                </div>
              )}
            </div>
          )}

          <div className="bg-white/3 border border-white/8 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">Qué ocurre al cerrar</p>
            {[
              "Los datos quedan congelados en un snapshot de solo lectura",
              "No se podrán modificar revisiones de RRHH del período",
              "El snapshot queda disponible para generar la planilla final",
              "Se registra en auditoría quién cerró y cuándo",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-white/50">
                <ChevronRight className="w-3 h-3 text-primary/60 mt-0.5 shrink-0" />{t}
              </div>
            ))}
          </div>

          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
            placeholder="Observaciones del cierre (opcional)…"
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none" />

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-semibold hover:bg-white/10 transition-colors">
              Cancelar
            </button>
            <button onClick={ejecutarCierre} disabled={!puedeEnviar}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                puedeEnviar ? "bg-primary text-white hover:bg-primary/90" : "bg-white/5 text-white/25 cursor-not-allowed"
              }`}>
              {cerrando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Lock className="w-3.5 h-3.5" />Confirmar cierre
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
