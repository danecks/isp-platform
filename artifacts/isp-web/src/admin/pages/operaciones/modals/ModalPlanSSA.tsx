import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Trash2, Shield, Info, UserCheck, AlertCircle } from "lucide-react";
import { PlanAgenteSSA, InicioProyecto, EmpleadoBusqueda, TIPO_SSA_LABELS } from "../types";
import { SlotAgentePlan } from "../components/SlotAgentePlan";

export function ModalPlanSSA({
  ssa,
  fecha,
  planAgentes,
  onClose,
  onGuardar,
  onEliminar,
}: {
  ssa: InicioProyecto;
  fecha: string;
  planAgentes: PlanAgenteSSA[];
  onClose: () => void;
  onGuardar: (agentes: Array<{ id: number | null }>) => Promise<void>;
  onEliminar?: () => void;
}) {
  const totalSlots = Math.max(ssa.total_puestos ?? 1, 1);
  const [guardando, setGuardando] = useState(false);

  // Inicializar slots con planes existentes
  const [slots, setSlots] = useState<Array<EmpleadoBusqueda | null>>(() => {
    const init: Array<EmpleadoBusqueda | null> = Array(totalSlots).fill(null);
    planAgentes.slice(0, totalSlots).forEach((pa, i) => {
      if (pa.relevo_id && pa.relevo_nombre) {
        init[i] = { id: pa.relevo_id, nombreCompleto: pa.relevo_nombre, puesto: null, area: null };
      }
    });
    return init;
  });

  const idsOcupados = slots.filter(Boolean).map((s) => s!.id);
  const [y, m, d] = fecha.split("-");
  const fechaDisplay = `${d}-${m}-${y}`;
  const tipoLabel = TIPO_SSA_LABELS[ssa.tipo_solicitud ?? ""] ?? ssa.tipo_solicitud ?? "SSA";
  const hayPlanesExistentes = planAgentes.length > 0;
  const agentesSeleccionados = slots.filter(Boolean).length;

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar(slots.map((s) => ({ id: s?.id ?? null })));
    } finally {
      setGuardando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#060e1c] border border-blue-500/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-blue-300/70 font-semibold uppercase tracking-widest">
                {hayPlanesExistentes ? "Editar planificación" : "Planificar SSA"} · {fechaDisplay}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate">{tipoLabel}</h2>
            <p className="text-[11px] text-white/35">
              {ssa.cliente_nombre_comercial || ssa.cliente_nombre}
              {ssa.hora_inicio ? ` · ${ssa.hora_inicio}–${ssa.hora_fin ?? ""}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar modal" className="text-white/30 hover:text-white transition-colors mt-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Info del SSA */}
          {ssa.descripcion && (
            <div className="flex items-start gap-2.5 bg-blue-500/6 border border-blue-500/15 rounded-xl px-3 py-2.5">
              <Info className="w-3.5 h-3.5 text-blue-400/60 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-200/60 leading-relaxed">{ssa.descripcion}</p>
            </div>
          )}

          {/* Resumen de cobertura */}
          <div className="flex items-center justify-between bg-white/3 border border-white/6 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{totalSlots} {totalSlots === 1 ? "guardia requerido" : "guardias requeridos"}</span>
            </div>
            {agentesSeleccionados > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                agentesSeleccionados >= totalSlots
                  ? "bg-green-500/15 border border-green-500/25 text-green-400"
                  : "bg-amber-500/12 border border-amber-500/20 text-amber-400"
              }`}>
                {agentesSeleccionados}/{totalSlots}
              </span>
            )}
          </div>

          {/* Slots de agentes */}
          <div className="space-y-3">
            {slots.map((slot, i) => (
              <SlotAgentePlan
                key={i}
                slotIdx={i}
                totalSlots={totalSlots}
                fecha={fecha}
                agenteSel={slot}
                idsOcupados={idsOcupados.filter((_, j) => j !== i ? true : false)}
                onSelect={(emp) => {
                  const next = [...slots];
                  next[i] = emp;
                  setSlots(next);
                }}
                onClear={() => {
                  const next = [...slots];
                  next[i] = null;
                  setSlots(next);
                }}
              />
            ))}
          </div>

          {/* Advertencia cobertura incompleta */}
          {agentesSeleccionados > 0 && agentesSeleccionados < totalSlots && (
            <div className="flex items-start gap-2 bg-amber-500/6 border border-amber-500/15 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300/60">
                Cobertura parcial: {agentesSeleccionados} de {totalSlots} guardias planificados. Puedes guardar de todas formas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <div>
            {hayPlanesExistentes && onEliminar && (
              <button
                onClick={onEliminar}
                className="flex items-center gap-1.5 text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Cancelar todo
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-[11px] text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
            >
              Cerrar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/25 border border-blue-500/40 text-[11px] font-semibold text-blue-200 hover:bg-blue-600/35 transition-all disabled:opacity-50"
            >
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
              {hayPlanesExistentes ? "Actualizar" : "Guardar plan"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

