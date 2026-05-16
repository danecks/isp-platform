import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Ban, Loader2 } from "lucide-react";
import type { EventoRrhh } from "@/lib/pdfRrhh";
import { MOTIVO_ANULACION_LABELS } from "@/lib/pdfRrhh";
import { fmtFecha } from "./helpers";
import { TIPO_CONFIG } from "./constants";

export function ModalAnulacion({
  evento,
  onConfirm,
  onClose,
}: {
  evento: EventoRrhh;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("error_registro");
  const [loading, setLoading] = useState(false);
  const numEvento = `ERH-${String(evento.id).padStart(4, "0")}`;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(motivo);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-red-500/20 rounded-2xl w-full max-w-md shadow-2xl">

        <div className="px-5 py-4 border-b border-red-500/10 bg-red-500/5">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">Anular evento RRHH</h3>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300 mb-1">Acción irreversible</p>
                <p className="text-xs text-red-300/70 leading-relaxed">
                  Esta acción anulará el evento <span className="font-mono font-bold">{numEvento}</span> y
                  dejará sin efecto legal los documentos generados (boleta de descuento y acta administrativa).
                  El registro histórico se conserva para auditoría. Esta acción quedará registrada.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Evento a anular</p>
            <p className="text-sm text-white font-medium">{evento.employee_nombre}</p>
            <p className="text-xs text-white/40">
              {TIPO_CONFIG[evento.tipo_evento]?.label ?? evento.tipo_evento} ·{" "}
              {fmtFecha(evento.fecha)}
              {evento.cliente_nombre && ` · ${evento.cliente_nombre}`}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">
              Motivo de anulación <span className="text-red-400">*</span>
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-red-500/40 appearance-none"
            >
              {Object.entries(MOTIVO_ANULACION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Ban className="w-3.5 h-3.5" />
              Confirmar anulación
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
