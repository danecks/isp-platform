import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useOperacionesContext } from "../OperacionesContext";

export function BarraNavegacionFecha() {
  const {
    fechaVista, esFuturo, esPasado, esOtraFecha,
    diasPendientesCierre, navFecha, onCambiarFecha, volverHoy,
  } = useOperacionesContext();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => navFecha(-1)}
        disabled={fechaVista <= "2026-04-01"}
        className="text-white/30 hover:text-white disabled:opacity-20 border border-white/8 rounded-xl px-2 py-1.5 bg-[#0c1929] transition-colors"
        title="Día anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border text-xs font-medium transition-colors ${
        esFuturo  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"  :
        esPasado  ? "bg-amber-500/10  border-amber-500/30  text-amber-300"   :
                    "bg-[#0c1929] border-white/8 text-white/60"
      }`}>
        <Calendar className="w-3 h-3" />
        <input
          type="date"
          value={fechaVista}
          min="2026-04-01"
          onChange={(e) => onCambiarFecha(e.target.value)}
          className="bg-transparent outline-none cursor-pointer text-inherit font-mono"
        />
        {esFuturo && (
          <span className="text-indigo-400/70 text-[10px] font-semibold ml-1">PLANIFICACIÓN</span>
        )}
        {esPasado && diasPendientesCierre.some(d => d.fecha === fechaVista) && (
          <span className="text-amber-400/70 text-[10px] font-semibold ml-1">CUADRE</span>
        )}
      </div>

      <button
        onClick={() => navFecha(1)}
        className="text-white/30 hover:text-white border border-white/8 rounded-xl px-2 py-1.5 bg-[#0c1929] transition-colors"
        title="Día siguiente"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {esOtraFecha && (
        <button
          onClick={volverHoy}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white bg-[#0c1929] border border-white/8 hover:border-white/20 rounded-xl px-3 py-1.5 transition-colors"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
