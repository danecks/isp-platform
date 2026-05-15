import { createPortal } from "react-dom";
import { Loader2, X, History, Activity } from "lucide-react";
import { fmtHora, TIPO_MOV } from "../utils";
import { Movimiento } from "../types";

export function PanelHistorial({
  movimientos,
  isLoading,
  onClose,
}: {
  movimientos: Movimiento[];
  isLoading: boolean;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-[#06111e] border-l border-white/8 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-bold text-white">Historial de movimientos</h3>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
        {!isLoading && movimientos.length === 0 && (
          <div className="text-center py-10 text-white/25 text-xs">
            Sin movimientos registrados aún
          </div>
        )}
        {movimientos.map((m) => {
          const cfg = TIPO_MOV[m.tipo] ?? { label: m.tipo, icon: Activity, color: "text-white/40" };
          const Icon = cfg.icon;
          return (
            <div key={m.id} className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-white/25 ml-auto">{fmtHora(m.fecha_hora)}</span>
              </div>
              <p className="text-[11px] text-white/60 font-medium">
                {m.cliente_nombre} · {m.puesto_nombre}
              </p>
              {m.tipo === "sustitucion" && (
                <p className="text-[10px] text-white/35 mt-0.5">
                  {m.agente_saliente_nombre} → {m.agente_entrante_nombre}
                </p>
              )}
              {m.tipo === "asignacion" && (
                <p className="text-[10px] text-white/35 mt-0.5">
                  Asignado: {m.agente_entrante_nombre}
                </p>
              )}
              {m.tipo === "liberacion" && (
                <p className="text-[10px] text-white/35 mt-0.5">
                  Removido: {m.agente_saliente_nombre}
                </p>
              )}
              {m.motivo && (
                <p className="text-[10px] text-white/25 mt-0.5">Motivo: {m.motivo}</p>
              )}
              <p className="text-[9px] text-white/20 mt-1">por {m.usuario_cambio}</p>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Elige tipo de cobertura (pool → puesto vacío) ────────────────────
// Aparece cuando un agente NO-titular va a un puesto sin agente actual.
// Pregunta: ¿Solo cobertura temporal o convertir en titular?

