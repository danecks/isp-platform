import { useState } from "react";
import { Repeat, X } from "lucide-react";

interface Props {
  puestoNombre: string;
  titularNombre: string;
  onConfirm: (motivo: string) => void | Promise<void>;
  onClose: () => void;
}

export function ModalReactivarFalta({ puestoNombre, titularNombre, onConfirm, onClose }: Props) {
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
      <div className="bg-[#07111f] border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-500/10 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Reactivar falta</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-white/80">
          <p>
            Vas a reactivar la falta de <span className="font-semibold text-white">{titularNombre}</span>{" "}
            en <span className="font-semibold text-white">{puestoNombre}</span>.
          </p>
          <p className="text-xs text-white/50">
            El puesto vuelve a quedar como <span className="text-emerald-300">faltando</span> y se repone el
            evento de falta y su hora extra. Usar solo si la anulación se hizo por error.
          </p>
          <label className="block text-xs font-semibold text-white/70 mt-3">
            Motivo (obligatorio)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={520}
            placeholder="Ej. La anulación fue un error, el agente sí faltó."
            className="w-full bg-[#04090f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40"
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
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 rounded-lg px-4 py-1.5 transition-colors"
          >
            <Repeat className="w-3 h-3" /> Reactivar falta
          </button>
        </div>
      </div>
    </div>
  );
}
