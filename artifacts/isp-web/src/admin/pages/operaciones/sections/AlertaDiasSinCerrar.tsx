import { AlertTriangle, Lock } from "lucide-react";
import { formatFechaVista } from "../helpers";
import { useOperacionesContext } from "../OperacionesContext";

export function AlertaDiasSinCerrar() {
  const { diasPendientesCierre, fechaVista, esPasado, irAFecha, cierre } = useOperacionesContext();
  if (diasPendientesCierre.length === 0) return null;
  const primerDiaPendiente = diasPendientesCierre[0];
  const onCerrarDia = (dia: typeof diasPendientesCierre[number]) => cierre.setDiaPendienteSeleccionado(dia);

  return (
    <div className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300 leading-tight">
            {diasPendientesCierre.length === 1
              ? `1 día sin cerrar — ${primerDiaPendiente.fechaStr}`
              : `${diasPendientesCierre.length} días sin cerrar`}
          </p>
          <p className="text-xs text-amber-400/70 mt-0.5">
            Selecciona un día para revisar su pizarrón y cerrarlo cuando esté cuadrado.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {diasPendientesCierre.map((dia) => {
          const esViendo = fechaVista === dia.fecha;
          return (
            <div key={dia.fecha} className={`flex items-center gap-1 rounded-lg border text-xs font-medium overflow-hidden ${esViendo ? "border-amber-400/60 bg-amber-500/20" : "border-white/10 bg-white/5"}`}>
              <button
                onClick={() => irAFecha(dia.fecha)}
                className={`px-3 py-1.5 transition-colors ${esViendo ? "text-amber-200" : "text-white/70 hover:text-white"}`}
              >
                {esViendo && <span className="mr-1 text-amber-400">▶</span>}
                {dia.fechaStr}
              </button>
              <button
                onClick={() => onCerrarDia(dia)}
                title={`Cerrar ${dia.fechaStr}`}
                className="px-2 py-1.5 border-l border-white/10 text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
              >
                <Lock className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      {esPasado && diasPendientesCierre.some(d => d.fecha === fechaVista) && (
        <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
          <p className="text-xs text-amber-400/80 flex-1">
            Estás viendo el pizarrón del <span className="font-bold text-amber-300">{formatFechaVista(fechaVista)}</span>.
            Cuadra la cobertura y ciérralo cuando esté listo.
          </p>
          <button
            onClick={() => {
              const dia = diasPendientesCierre.find(d => d.fecha === fechaVista);
              if (dia) onCerrarDia(dia);
            }}
            className="shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            Cerrar {formatFechaVista(fechaVista)}
          </button>
        </div>
      )}
    </div>
  );
}
