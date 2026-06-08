import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertTriangle, Undo2 } from "lucide-react";

export function ModalFaltaPersonal({
  modo,
  nombre,
  cargo,
  onConfirm,
  onClose,
}: {
  modo: "registrar" | "anular";
  nombre: string;
  cargo: string;
  onConfirm: (motivo: string, notas?: string) => Promise<void>;
  onClose: () => void;
}) {
  const esAnular = modo === "anular";
  const [motivo, setMotivo] = useState(esAnular ? "" : "inasistencia");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);

  const motivoValido = esAnular ? motivo.trim().length > 0 : true;

  async function handleConfirm() {
    if (!motivoValido) return;
    setLoading(true);
    try {
      await onConfirm(motivo.trim(), notas.trim() || undefined);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          {esAnular
            ? <Undo2 className="w-4 h-4 text-sky-400" />
            : <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <h3 className="text-sm font-bold text-white">
            {esAnular ? "Anular falta" : "Registrar inasistencia"}
          </h3>
        </div>

        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-xs text-white/60 space-y-0.5">
          <p className="text-white/80">{nombre}</p>
          <p className="text-white/40">{cargo}</p>
        </div>

        {esAnular ? (
          <div className="space-y-1">
            <label className="text-xs text-white/40">Motivo de la anulación</label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej. registrada por error…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40 placeholder:text-white/15"
            />
          </div>
        ) : (
          <>
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
          </>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !motivoValido}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${esAnular ? "bg-sky-600 hover:bg-sky-500" : "bg-amber-600 hover:bg-amber-500"}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {esAnular ? "Anular falta" : "Registrar falta"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
