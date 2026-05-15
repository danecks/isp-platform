import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, UserMinus } from "lucide-react";
import { Puesto } from "../types";

export function ModalLiberar({
  puesto,
  onConfirm,
  onClose,
}: {
  puesto: Puesto;
  onConfirm: (motivo: string, horaFin?: string, generarEventoFalta?: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const ahoraHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };
  const [motivo, setMotivo] = useState("descanso");
  const [horaFin, setHoraFin] = useState(ahoraHHMM());
  const [generarEventoFalta, setGenerarEventoFalta] = useState(true);
  const [loading, setLoading] = useState(false);
  const esFalta = motivo === "falta" || motivo === "suspension";

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(motivo, horaFin || undefined, esFalta ? generarEventoFalta : false);
    } finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserMinus className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-bold text-white">Remover agente del puesto</h3>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-xs text-white/60">
          <p><span className="text-white/80">{puesto.agente_nombre}</span> será removido de</p>
          <p className="text-white/40 mt-0.5">{puesto.cliente_nombre} · {puesto.nombre}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Motivo</label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none"
          >
            <option value="descanso">Descanso</option>
            <option value="falta">Falta</option>
            <option value="suspension">Suspensión</option>
            <option value="rotacion">Rotación</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Hora de salida</label>
          <input
            type="time"
            value={horaFin}
            onChange={e => setHoraFin(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono text-center outline-none focus:border-red-500/40"
          />
          <p className="text-[9px] text-white/20">Cierra el segmento de cobertura del día</p>
        </div>

        {esFalta && (
          <button
            onClick={() => setGenerarEventoFalta(p => !p)}
            className={`w-full text-left rounded-xl p-3 border transition-all flex items-start gap-2.5 ${
              generarEventoFalta
                ? "bg-red-500/10 border-red-500/30"
                : "bg-white/3 border-white/8 hover:border-white/15"
            }`}
          >
            <div className={`w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border transition-all ${
              generarEventoFalta ? "bg-red-500 border-red-500" : "border-white/20"
            }`}>
              {generarEventoFalta && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80">Registrar falta en RRHH</p>
              <p className="text-[10px] text-white/35 mt-0.5 leading-snug">
                Genera evento de falta + descuento de día en nómina.
                No se pagará ese día al colaborador.
              </p>
            </div>
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Remover
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Registrar falta de titular ───────────────────────────────────────

