import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Puesto } from "../types";

export function ModalRegistrarFalta({
  puesto,
  titularId: _titularId,
  titularNombre,
  onConfirm,
  onClose,
}: {
  puesto: Puesto;
  titularId: number;
  titularNombre: string;
  onConfirm: (motivo: string, notas?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("inasistencia");
  const [notas, setNotas]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(motivo, notas.trim() || undefined);
    } finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Registrar inasistencia</h3>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-xs text-white/60 space-y-0.5">
          <p><span className="text-white/80">{titularNombre}</span> — titular de</p>
          <p className="text-white/40">{puesto.cliente_nombre} · {puesto.nombre}</p>
          {puesto.es_par_24x24 && (
            <p className="text-[9px] text-amber-300/50 mt-1">Puesto 24x24: solo se registra el evento RRHH (el ciclo se restablece mañana automáticamente)</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Tipo de inasistencia</label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none"
          >
            <option value="inasistencia">Inasistencia injustificada</option>
            <option value="abandono">Abandono de puesto</option>
            <option value="tardanza">Tardanza / llegada tarde</option>
            <option value="enfermedad">Enfermedad / incapacidad</option>
            <option value="accidente">Accidente</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Notas adicionales (opcional)</label>
          <input
            type="text"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Comentario breve…"
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/40 placeholder:text-white/15"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Registrar falta
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Cerrar día ────────────────────────────────────────────────────────

