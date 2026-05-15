import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, UserMinus } from "lucide-react";
import { Puesto } from "../types";

export function ModalQuitarTitularidad({
  puesto,
  employeeNombre,
  onConfirm,
  onClose,
}: {
  puesto: Puesto;
  employeeNombre: string;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("rotacion");
  const [notas, setNotas] = useState("");
  const [confirmTexto, setConfirmTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const esperado = "QUITAR";
  const valido = confirmTexto.trim().toUpperCase() === esperado;

  async function handleConfirm() {
    if (!valido) return;
    const motivoFinal = notas.trim() ? `${motivo}: ${notas.trim()}` : motivo;
    setLoading(true);
    try { await onConfirm(motivoFinal); }
    finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-rose-500/25 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserMinus className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white">Quitar titularidad</h3>
        </div>

        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-xs text-white/60 space-y-1">
          <p><span className="text-white/85 font-semibold">{employeeNombre}</span> dejará de ser titular de</p>
          <p className="text-white/45">{puesto.cliente_nombre} · {puesto.nombre}</p>
        </div>

        <div className="bg-rose-500/8 border border-rose-500/20 rounded-lg p-3 text-[11px] text-rose-200/80 leading-snug space-y-1">
          <p>• El historial de titularidad y movimientos queda preservado.</p>
          <p>• El colaborador vuelve al pool de <span className="font-semibold">Disponibles</span>.</p>
          <p>• Se cierra el período de titularidad con fecha de hoy.</p>
          <p>• El puesto quedará sin titular hasta asignar uno nuevo.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Motivo</label>
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none"
          >
            <option value="rotacion">Rotación / cambio de puesto</option>
            <option value="renuncia">Renuncia / baja</option>
            <option value="reasignacion">Reasignación operativa</option>
            <option value="solicitud_cliente">Solicitud del cliente</option>
            <option value="disciplinario">Motivo disciplinario</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            placeholder="Detalle adicional del cambio…"
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Escriba <span className="font-mono text-rose-300">{esperado}</span> para confirmar</label>
          <input
            value={confirmTexto}
            onChange={e => setConfirmTexto(e.target.value)}
            placeholder={esperado}
            className={`w-full bg-[#060e1c] border rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors
              ${valido ? "border-rose-500/50 text-rose-200" : confirmTexto ? "border-red-500/30 text-white" : "border-white/10 text-white"}`}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!valido || loading}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
            Quitar titularidad
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

