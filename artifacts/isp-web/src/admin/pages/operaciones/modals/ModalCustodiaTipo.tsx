import { createPortal } from "react-dom";

export function ModalCustodiaTipo({
  agenteNombre,
  slotNumero,
  onElegir,
  onCancel,
}: {
  agenteNombre: string;
  slotNumero: number;
  onElegir: (soloCobertura: boolean) => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md mx-4 bg-[#0c1829] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-base font-bold text-white">¿Cómo asignar este agente?</h3>
          <p className="text-xs text-white/40 mt-1">
            <span className="text-white/70 font-medium">{agenteNombre}</span> → Custodio {slotNumero}
          </p>
        </div>

        <div className="p-5 space-y-3">
          <button
            onClick={() => onElegir(false)}
            className="w-full text-left px-4 py-3 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-300">Asignar como TITULAR</p>
                <p className="text-[11px] text-green-200/60 mt-0.5">
                  Queda fijo en este slot. Aparecerá todos los días en la fuerza esperada.
                </p>
              </div>
              <span className="text-[10px] font-bold text-green-300 px-2 py-0.5 bg-green-500/20 rounded">FIJO</span>
            </div>
          </button>

          <button
            onClick={() => onElegir(true)}
            className="w-full text-left px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-300">Solo COBERTURA de hoy</p>
                <p className="text-[11px] text-blue-200/60 mt-0.5">
                  Cubre el slot únicamente hoy. No se vuelve titular fijo.
                </p>
              </div>
              <span className="text-[10px] font-bold text-blue-300 px-2 py-0.5 bg-blue-500/20 rounded">EXTRA</span>
            </div>
          </button>
        </div>

        <div className="px-5 pb-4">
          <button
            onClick={onCancel}
            className="w-full text-xs text-white/50 hover:text-white/80 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

