import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, User, Trash2, XCircle, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { iniciales, avatarColor } from "../utils";
import { Puesto, Agente, PlanFuturo, EmpleadoBusqueda, TIPOS_AUSENCIA_FUTURO } from "../types";
import { SelectorAgenteAgrupado } from "../components/SelectorAgenteAgrupado";

export function ModalPlanFuturo({
  puesto,
  fecha,
  planExistente,
  onClose,
  onGuardar,
  onEliminar,
}: {
  puesto: Puesto;
  fecha: string;
  planExistente: PlanFuturo | null;
  onClose: () => void;
  onGuardar: (data: {
    tipoAusencia: string;
    titularAusenteId: number | null;
    relevId: number | null;
    motivo: string;
    notas: string;
  }) => Promise<void>;
  onEliminar?: () => void;
}) {
  const { toast } = useToast();
  const [tipoAusencia, setTipoAusencia] = useState(planExistente?.tipo_ausencia ?? "permiso_con_goce");
  const [motivo, setMotivo]             = useState(planExistente?.motivo ?? "");
  const [notas, setNotas]               = useState(planExistente?.notas ?? "");
  const [guardando, setGuardando]       = useState(false);
  const [relevoSel, setRelevoSel]       = useState<EmpleadoBusqueda | null>(
    planExistente?.relevo_id
      ? { id: planExistente.relevo_id, nombreCompleto: planExistente.relevo_nombre ?? "", puesto: null, area: null }
      : null
  );

  const [y, m, d] = fecha.split("-");
  const fechaDisplay = `${d}-${m}-${y}`;

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar({
        tipoAusencia,
        titularAusenteId: puesto.titular_employee_id,
        relevId: relevoSel?.id ?? null,
        motivo,
        notas,
      });
    } catch {
      toast({ title: "Error al guardar el plan", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#060e1c] border border-indigo-500/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] text-indigo-300/70 font-semibold uppercase tracking-widest">
                {planExistente ? "Editar plan" : "Planificar"} · {fechaDisplay}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate">{puesto.nombre}</h2>
            <p className="text-[11px] text-white/35">{puesto.cliente_nombre}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors mt-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tipo de ausencia */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Tipo de ausencia
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TIPOS_AUSENCIA_FUTURO.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTipoAusencia(value)}
                  className={`px-3 py-2 rounded-xl border text-[11px] font-medium text-left transition-all ${
                    tipoAusencia === value
                      ? "bg-indigo-600/25 border-indigo-500/50 text-indigo-200"
                      : "bg-white/4 border-white/8 text-white/50 hover:border-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Titular */}
          <div className="flex items-center gap-2.5 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
            <User className="w-3.5 h-3.5 text-white/25 shrink-0" />
            <div>
              <p className="text-[10px] text-white/30 font-semibold">Titular del puesto</p>
              <p className="text-xs text-white/70">{puesto.titular_nombre ?? "Sin titular definido"}</p>
            </div>
          </div>

          {/* Relevo programado */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Relevo programado <span className="text-white/20 normal-case font-normal">(opcional)</span>
            </label>
            {relevoSel ? (
              <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(relevoSel.nombreCompleto)}`}>
                  {iniciales(relevoSel.nombreCompleto)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-indigo-200 truncate">{relevoSel.nombreCompleto}</p>
                  <p className="text-[10px] text-indigo-300/50">{relevoSel.puesto ?? "Agente"}</p>
                </div>
                <button onClick={() => setRelevoSel(null)} className="text-white/25 hover:text-red-400 transition-colors">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <SelectorAgenteAgrupado
                fecha={fecha}
                seleccionado={null}
                onSelect={(a) =>
                  setRelevoSel({ id: a.id, nombreCompleto: a.nombre, puesto: a.detalle ?? null, area: null })
                }
              />
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Motivo <span className="text-white/20 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. permiso autorizado por RRHH"
              className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-indigo-400/40"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Notas internas <span className="text-white/20 normal-case font-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Información adicional para el equipo de operaciones…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-indigo-400/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <div>
            {planExistente && (
              <button
                onClick={() => onEliminar?.()}
                className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Cancelar plan
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-white/50 hover:text-white border border-white/8 rounded-xl transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              {planExistente ? "Actualizar" : "Programar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal Configurar Turno de Puesto (Plantilla de Turnos unificada) ─────────

