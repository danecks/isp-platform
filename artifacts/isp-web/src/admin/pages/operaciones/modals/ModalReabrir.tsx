import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Unlock, AlertCircle } from "lucide-react";
import { CierreDiaRecord } from "../types";

export function ModalReabrir({
  cierre,
  fechaParaReabrir,
  onConfirm,
  onClose,
}: {
  cierre: CierreDiaRecord | null;
  fechaParaReabrir: string;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}) {
  const esperado = `REABRIR ${fechaParaReabrir}`;
  const [texto,  setTexto]  = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const valido = texto === esperado && motivo.trim().length >= 5;

  async function handleConfirm() {
    if (!valido) return;
    setLoading(true);
    try { await onConfirm(motivo.trim()); }
    finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-red-500/20 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/15 bg-red-500/5">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">Reabrir día operativo</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {cierre && (
            <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-xs text-white/50 space-y-1">
              <p>Cerrado por: <span className="text-white/80">{cierre.cerrado_por}</span></p>
              <p>Fecha/hora: <span className="text-white/80">{new Date(cierre.cerrado_en).toLocaleString("es-GT")}</span></p>
              {cierre.comentario && <p>Comentario: <span className="text-white/80">{cierre.comentario}</span></p>}
            </div>
          )}

          <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 text-xs text-red-300/80">
            <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 text-red-400" />
            Esta acción requiere justificación y queda registrada en auditoría.
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">Motivo de reapertura <span className="text-red-400">*</span></label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describe el motivo de la reapertura…"
              rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/40 resize-none"
            />
            {motivo.trim().length > 0 && motivo.trim().length < 5 && (
              <p className="text-[10px] text-red-400">Mínimo 5 caracteres</p>
            )}
          </div>

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
                ${texto === esperado ? "border-green-500/50 text-green-300" : texto ? "border-red-500/30 text-white" : "border-white/10 text-white"}`}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!valido || loading}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
              Reabrir día
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Quitar titularidad ──────────────────────────────────────────────
