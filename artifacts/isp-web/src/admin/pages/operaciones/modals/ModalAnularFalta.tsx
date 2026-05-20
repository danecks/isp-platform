import { useState } from "react";
import { Undo2, X } from "lucide-react";

interface Props {
  puestoNombre: string;
  titularNombre: string;
  onConfirm: (motivo: string) => void | Promise<void>;
  onClose: () => void;
}

export function ModalAnularFalta({ puestoNombre, titularNombre, onConfirm, onClose }: Props) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const trimmed = motivo.trim();
  const tooLong = trimmed.length > 500;
  const puedeEnviar = trimmed.length > 0 && !tooLong && !enviando;

  async function handleConfirm() {
    if (!puedeEnviar) return;
    setEnviando(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Anular falta</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-white/80">
          <p>
            Vas a anular la falta de <span className="font-semibold text-white">{titularNombre}</span>{" "}
            en <span className="font-semibold text-white">{puestoNombre}</span>.
          </p>
          <p className="text-xs text-white/50">
            El slot quedará en estado <span className="text-cyan-300">Descubierto</span>. No se toca nómina ni
            horas extra. RRHH debe aprobar la anulación; si la rechaza, la falta se restaura.
          </p>
          <label className="block text-xs font-semibold text-white/70 mt-3">
            Motivo (obligatorio)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={520}
            placeholder="Ej. Operaciones marcó la falta por error, el agente sí asistió."
            className="w-full bg-[#04090f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40"
          />
          <div className={`text-[10px] text-right ${tooLong ? "text-red-400" : "text-white/30"}`}>
            {trimmed.length}/500
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5">
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-xs font-semibold text-white/60 hover:text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!puedeEnviar}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-white/30 rounded-lg px-4 py-1.5 transition-colors"
          >
            <Undo2 className="w-3 h-3" /> Anular falta
          </button>
        </div>
      </div>
    </div>
  );
}
