import { X, Lock, Unlock, AlertTriangle, Plus, History, FileText, MapPin, RefreshCw } from "lucide-react";
import { avatarColor, iniciales } from "../utils";
import { formatFechaVista } from "../helpers";
import { useOperacionesContext } from "../OperacionesContext";

export function BarraAcciones() {
  const {
    puestosCubiertos, puestosDescubiertos, coberturaGlobal,
    pool, agenteSeleccionado, setAgenteSeleccionado,
    esFuturo, fechaVista, fechaVistaCerrada, bloqueadoPorPendientes, primerDiaPendiente,
    esAdmin, esSupervisorOAdmin, historialAbierto, setHistorialAbierto,
    setNuevoPuestoData, handleRefrescar, cierre,
  } = useOperacionesContext();

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <div className="flex items-center gap-3 bg-[#0c1929] border border-white/8 rounded-xl px-4 py-2">
        <div className="text-center">
          <p className="text-lg font-bold text-white leading-none">{coberturaGlobal}%</p>
          <p className="text-[10px] text-white/30 mt-0.5">Cobertura</p>
        </div>
        <div className="w-px h-8 bg-white/8" />
        <div className="text-center">
          <p className="text-lg font-bold text-green-400 leading-none">{puestosCubiertos}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Cubiertos</p>
        </div>
        <div className="w-px h-8 bg-white/8" />
        <div className="text-center">
          <p className={`text-lg font-bold leading-none ${puestosDescubiertos > 0 ? "text-red-400 animate-pulse" : "text-white/30"}`}>{puestosDescubiertos}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Descubiertos</p>
        </div>
        <div className="w-px h-8 bg-white/8" />
        <div className="text-center">
          <p className="text-lg font-bold text-blue-400 leading-none">{pool?.disponibles?.length ?? 0}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Libres</p>
        </div>
      </div>

      <div className="flex-1" />

      {agenteSeleccionado && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-xl px-3 py-2">
          <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(agenteSeleccionado.nombre_completo)}`}>
            {iniciales(agenteSeleccionado.nombre_completo)}
          </div>
          <span className="text-xs text-white/80 font-medium">{agenteSeleccionado.nombre_completo}</span>
          <span className="text-[10px] text-primary/70">seleccionado → toca un puesto</span>
          <button onClick={() => setAgenteSeleccionado(null)} className="text-white/30 hover:text-white ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!esFuturo && (
        fechaVistaCerrada ? (
          <>
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-300">Cerrado</span>
              <span className="text-[10px] text-amber-400/50">·</span>
              <span className="text-[10px] text-amber-400/60 font-mono">{formatFechaVista(fechaVista)}</span>
            </div>
            {esAdmin && (
              <button
                onClick={() => cierre.setModalReabrir(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl px-3 py-2 transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" /> Reabrir
              </button>
            )}
          </>
        ) : bloqueadoPorPendientes ? (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2" title={`Cierra primero: ${primerDiaPendiente?.fechaStr}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-[11px] font-semibold text-red-300">
              Cierra primero el <span className="font-bold text-red-200">{primerDiaPendiente?.fechaStr}</span>
            </span>
          </div>
        ) : esSupervisorOAdmin ? (
          <button
            onClick={() => cierre.setModalCierre(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-300/80 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 rounded-xl px-3 py-2 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" /> Cerrar {formatFechaVista(fechaVista)}
          </button>
        ) : null
      )}

      {!fechaVistaCerrada && !esFuturo && (
        <button
          onClick={() => setNuevoPuestoData("nuevo")}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl px-3 py-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo puesto
        </button>
      )}

      <button
        onClick={() => setHistorialAbierto(!historialAbierto)}
        className={`flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border transition-colors
          ${historialAbierto
            ? "bg-white/8 border-white/15 text-white"
            : "bg-[#0c1929] border-white/8 text-white/40 hover:text-white"}`}
      >
        <History className="w-3.5 h-3.5" /> Historial
      </button>

      <a
        href="/admin/operaciones/cierres"
        className="flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border bg-[#0c1929] border-white/8 text-white/40 hover:text-white transition-colors"
        title="Ver historial de cierres"
      >
        <FileText className="w-3.5 h-3.5" /> Cierres
      </a>

      <a
        href="/admin/operaciones/zonas"
        className="flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border bg-[#0c1929] border-white/8 text-white/40 hover:text-white transition-colors"
        title="Administrar zonas operativas"
      >
        <MapPin className="w-3.5 h-3.5" /> Zonas
      </a>

      <button
        onClick={handleRefrescar}
        className="text-white/30 hover:text-white border border-white/8 rounded-xl px-2.5 py-2 bg-[#0c1929] transition-colors"
        title="Refrescar"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
