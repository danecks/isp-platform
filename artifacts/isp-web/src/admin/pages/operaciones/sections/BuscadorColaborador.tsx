import { Search, X, ChevronRight } from "lucide-react";
import { useOperacionesContext } from "../OperacionesContext";

export function BuscadorColaborador() {
  const {
    busquedaPersona, setBusquedaPersona, totalPuestosFiltrados,
    tableroFiltrado, colGlobal, toggleColGlobal,
  } = useOperacionesContext();
  const hayTablero = tableroFiltrado.length > 0;
  const colGlobalVal = colGlobal.val;

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      <div className={`relative flex items-center transition-all ${busquedaPersona ? "w-72" : "w-52"}`}>
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-white/25 pointer-events-none" />
        <input
          type="text"
          value={busquedaPersona}
          onChange={(e) => setBusquedaPersona(e.target.value)}
          placeholder="Buscar colaborador en el pizarrón…"
          className={`w-full bg-[#0c1929] border rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-all ${
            busquedaPersona ? "border-primary/40 bg-primary/5" : "border-white/8 focus:border-white/20"
          }`}
        />
        {busquedaPersona && (
          <button
            onClick={() => setBusquedaPersona("")}
            className="absolute right-2.5 text-white/30 hover:text-white transition-colors"
            title="Limpiar búsqueda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {busquedaPersona.trim() && (
        <span className={`text-[11px] font-medium whitespace-nowrap ${totalPuestosFiltrados === 0 ? "text-red-400/70" : "text-primary/80"}`}>
          {totalPuestosFiltrados === 0
            ? "Sin resultados"
            : `${totalPuestosFiltrados} puesto${totalPuestosFiltrados !== 1 ? "s" : ""} encontrado${totalPuestosFiltrados !== 1 ? "s" : ""}`}
        </span>
      )}

      {hayTablero && <div className="w-px h-5 bg-white/10 mx-1 self-center" />}

      {hayTablero && (
        <button
          onClick={toggleColGlobal}
          className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/80 transition-colors px-2.5 py-1.5 border border-white/8 hover:border-white/20 rounded-xl whitespace-nowrap"
          title={colGlobalVal ? "Expandir todas las columnas" : "Colapsar todas las columnas"}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${colGlobalVal ? "rotate-0" : "rotate-90"}`} />
          {colGlobalVal ? "Expandir todo" : "Colapsar todo"}
        </button>
      )}
    </div>
  );
}
