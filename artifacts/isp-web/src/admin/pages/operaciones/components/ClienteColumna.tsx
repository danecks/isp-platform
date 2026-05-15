import { useState, useEffect } from "react";
import { Plus, X, ChevronRight, Truck } from "lucide-react";
import { Puesto, ClienteBoard, PlanFuturo } from "../types";
import { DroppableCustodiaSlot } from "../components/DroppableCustodiaSlot";
import { DroppablePuesto } from "../components/DroppablePuesto";

export function ClienteColumna({
  cliente,
  agenteSeleccionadoId,
  onPuestoClick,
  onLiberar,
  onRegistrarFalta,
  onNuevoPuesto,
  onEliminarPuesto,
  onAbrirSegmentos,
  onConfigTurno,
  onQuitarTitular,
  cambiosFuturosProximos,
  planFuturoPorPuesto,
  resaltado,
  colGlobal,
  puestoContextoId,
  isDeleteMode,
}: {
  cliente: ClienteBoard;
  agenteSeleccionadoId: number | null;
  onPuestoClick: (puesto: Puesto) => void;
  onLiberar: (puesto: Puesto) => void;
  onRegistrarFalta?: (puesto: Puesto, titularId: number, titularNombre: string) => void;
  onNuevoPuesto: (cliente: ClienteBoard) => void;
  onEliminarPuesto: (puesto: Puesto) => void;
  onAbrirSegmentos: (puesto: Puesto) => void;
  onConfigTurno?: (puesto: Puesto) => void;
  onQuitarTitular?: (puesto: Puesto, employeeId: number, employeeNombre: string) => void;
  cambiosFuturosProximos?: Record<number, PlanFuturo[]>;
  planFuturoPorPuesto?: Record<number, PlanFuturo>;
  resaltado?: boolean;
  colGlobal?: { v: number; val: boolean };
  puestoContextoId?: number | null;
  isDeleteMode?: boolean;
}) {
  const ssKey = `piz_col_cli_${cliente.clienteId ?? cliente.clienteNombre}`;
  const [colapsado, setColapsado] = useState(() => {
    try { return sessionStorage.getItem(ssKey) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (colGlobal && colGlobal.v > 0) {
      setColapsado(colGlobal.val);
      try { sessionStorage.setItem(ssKey, colGlobal.val ? "1" : "0"); } catch {}
    }
  }, [colGlobal?.v]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCol = () => setColapsado(prev => {
    const next = !prev;
    try { sessionStorage.setItem(ssKey, next ? "1" : "0"); } catch {}
    return next;
  });

  // Cobertura por relevo manual (agente_id asignado) cuenta SIEMPRE — incluso si
  // el titular está de vacaciones o de baja, porque el relevo lo está cubriendo.
  // Cobertura por titular del ciclo (24x24 sin agente_id) solo cuenta si el
  // titular activo NO está en vacaciones / dado de baja / faltando.
  const esPuestoCubierto = (p: typeof cliente.puestos[0]) => {
    const cubiertoManual  = p.estado === "cubierto" && !!p.agente_id;
    const cubiertoTitular = p.es_par_24x24
      && (p.par_trabajando as any)?.trabaja_hoy
      && (p.par_trabajando as any)?.employee_id
      && !p.titular_faltando
      && !p.titular_en_vacaciones
      && !p.titular_dado_de_baja;
    return cubiertoManual || cubiertoTitular;
  };
  const cubiertos      = cliente.puestos.filter(esPuestoCubierto).length;
  const descansoCicloN = cliente.puestos.filter((p) => p.descanso_por_ciclo === true && !esPuestoCubierto(p)).length;
  const descubiertoN   = cliente.puestos.filter((p) => !esPuestoCubierto(p) && !p.descanso_por_ciclo).length;
  const total          = cliente.puestos.length;
  const pct         = total > 0 ? Math.round(((cubiertos + descansoCicloN) / total) * 100) : 0;
  const colorBarra  = descubiertoN > 0 ? "bg-red-500" : pct === 100 ? "bg-green-500" : "bg-indigo-500";

  const borderClass = resaltado
    ? "border-2 border-amber-400/70 ring-2 ring-amber-400/30 shadow-[0_0_24px_4px_rgba(251,191,36,0.18)]"
    : cliente.iniciaHoy
    ? "border border-emerald-500/40 ring-1 ring-emerald-500/20"
    : "border border-white/8";

  if (colapsado) {
    return (
      <div
        className={`flex-shrink-0 w-10 bg-[#060f1a] rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200 cursor-pointer group ${borderClass}`}
        onClick={toggleCol}
        title={`${cliente.clienteNombre} — ${cubiertos}/${total} cubiertos. Clic para expandir`}
      >
        {/* Indicador de alertas arriba */}
        {descubiertoN > 0 && (
          <div className="w-full h-1 bg-red-500 shrink-0" />
        )}
        {descubiertoN === 0 && pct === 100 && (
          <div className="w-full h-1 bg-green-500 shrink-0" />
        )}
        {/* Nombre vertical */}
        <div className="flex-1 flex items-center justify-center py-3 min-h-0 overflow-hidden">
          <span
            className="text-[10px] font-bold text-white/50 group-hover:text-white/80 transition-colors leading-none"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
          >
            {cliente.clienteNombre.length > 20 ? cliente.clienteNombre.slice(0, 18) + "…" : cliente.clienteNombre}
          </span>
        </div>
        {/* Conteo abajo */}
        <div className="shrink-0 flex flex-col items-center gap-0.5 py-2 border-t border-white/6">
          <span className={`text-[9px] font-bold ${descubiertoN > 0 ? "text-red-400" : "text-green-400"}`}>{cubiertos}</span>
          <div className="w-px h-2 bg-white/10" />
          <span className="text-[9px] text-white/20">{total}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-shrink-0 w-64 bg-[#060f1a] rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200 ${borderClass}`}>
      {/* Badge de inicio de proyecto */}
      {resaltado && (
        <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/25 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">Próximo arranque</span>
        </div>
      )}
      {!resaltado && cliente.iniciaHoy && (
        <div className="px-3 py-1.5 bg-emerald-500/15 border-b border-emerald-500/25 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">Nuevo servicio · Inicia hoy</span>
        </div>
      )}
      {/* Header cliente */}
      <div className="px-3 py-3 border-b border-white/8">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button
            onClick={toggleCol}
            className="min-w-0 text-left flex-1 group/col"
            title="Colapsar columna"
          >
            <h3 className="text-xs font-bold text-white truncate group-hover/col:text-white/70 transition-colors flex items-center gap-1.5">
              {cliente.tipoServicio === "custodia" && <Truck className="w-3 h-3 text-amber-400 shrink-0" />}
              {cliente.clienteNombre}
            </h3>
            <p className="text-[10px] text-white/35 mt-0.5">
              {cubiertos}/{total} cubiertos
              {descansoCicloN > 0 && <span className="ml-1 text-indigo-400/50">· {descansoCicloN} en ciclo</span>}
              {descubiertoN > 0 && <span className="ml-1 text-red-400/60">· {descubiertoN} descubiertos</span>}
            </p>
          </button>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <button
              onClick={toggleCol}
              className="text-white/15 hover:text-white/50 transition-colors"
              title="Colapsar columna"
            >
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
            <button
              onClick={() => onNuevoPuesto(cliente)}
              className="text-white/20 hover:text-primary transition-colors"
              title="Agregar puesto"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Barra de cobertura */}
        <div className="h-1 bg-white/8 rounded-full overflow-hidden">
          <div className={`h-full ${colorBarra} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Puestos */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cliente.puestos.map((p) => (
          <div key={p.id} className="group/puesto relative">
            {p.es_custodia ? (
              <DroppableCustodiaSlot
                puesto={p}
                isAgenteSeleccionado={agenteSeleccionadoId !== null}
                onClick={() => onPuestoClick(p)}
                onRegistrarFalta={onRegistrarFalta}
              />
            ) : (
              <DroppablePuesto
                puesto={p}
                isAgenteSeleccionado={agenteSeleccionadoId !== null}
                onClick={() => onPuestoClick(p)}
                onLiberar={() => onLiberar(p)}
                onRegistrarFalta={onRegistrarFalta}
                onAbrirSegmentos={() => onAbrirSegmentos(p)}
                onConfigTurno={onConfigTurno ? () => onConfigTurno(p) : undefined}
                onQuitarTitular={onQuitarTitular}
                cambiosProximos={cambiosFuturosProximos?.[p.id]}
                planFuturo={planFuturoPorPuesto?.[p.id] ?? null}
                puestoContextoId={puestoContextoId}
              />
            )}
            {/* Botón eliminar puesto — solo visible en modo eliminación */}
            {isDeleteMode && !p.es_custodia && (
              <button
                onClick={(e) => { e.stopPropagation(); onEliminarPuesto(p); }}
                className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/puesto:opacity-100 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-0.5 transition-all z-10"
                title="Eliminar puesto"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
        {cliente.puestos.length === 0 && (
          <div className="text-center py-4">
            <p className="text-[11px] text-white/20">Sin puestos</p>
            <button
              onClick={() => onNuevoPuesto(cliente)}
              className="text-[10px] text-primary/60 hover:text-primary mt-1 transition-colors"
            >
              Agregar puesto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel lateral: Historial + Pool info ─────────────────────────────────────

