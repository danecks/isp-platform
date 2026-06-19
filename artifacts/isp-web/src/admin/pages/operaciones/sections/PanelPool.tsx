import { Fragment } from "react";
import { Users, Loader2, X, ChevronRight, MapPin, CheckCircle2, Circle, ArrowLeftRight, XCircle } from "lucide-react";
import type { GrupoRanking } from "../types";
import { RANKING_GRUPO_CONFIG } from "../types";
import { DraggableAgente } from "../components/DraggableAgente";
import { useOperacionesContext } from "../OperacionesContext";

export function PanelPool() {
  const {
    pool, loadingPool, poolActual, poolTab, setPoolTab,
    busquedaPool, setBusquedaPool, colPool, toggleColPool,
    agenteSeleccionado, setAgenteSeleccionado,
    puestoContexto, setPuestoContexto,
    candidatosRankeados, fechaVistaCerrada,
  } = useOperacionesContext();

  return (
    <div className="shrink-0 bg-[#060f1a] border border-white/8 rounded-2xl overflow-hidden">
      {/* Header pool */}
      <div className="border-b border-white/8">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <button
            onClick={toggleColPool}
            className="flex items-center gap-2 group shrink-0"
            title={colPool ? "Expandir pool" : "Minimizar pool"}
          >
            <Users className="w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-colors" />
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest group-hover:text-white/80 transition-colors">Pool de agentes</span>
            <ChevronRight className={`w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-all ${colPool ? "" : "rotate-90"}`} />
          </button>
          {colPool && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[10px] text-green-400 font-bold">{pool?.disponibles?.length ?? 0} libres</span>
              <span className="text-white/15">·</span>
              <span className="text-[10px] text-cyan-400 font-bold">{pool?.disponiblesCubriendo?.length ?? 0} disp. cubriendo</span>
              <span className="text-white/15">·</span>
              <span className="text-[10px] text-amber-300 font-bold">{(pool?.haciendoHE?.length ?? 0) + (pool?.vacacionistasCubriendo?.length ?? 0)} desc/vac cubriendo</span>
              <span className="text-white/15">·</span>
              <span className="text-[10px] text-blue-400 font-bold">{pool?.descansandoCiclo?.length ?? 0} descanso</span>
            </div>
          )}
          <div className="flex-1" />
          {!colPool && (
            <div className="relative">
              <input
                type="text"
                value={busquedaPool}
                onChange={(e) => setBusquedaPool(e.target.value)}
                placeholder="Buscar agente…"
                className="bg-[#060e1c] border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-primary/40 w-40"
              />
              {busquedaPool && (
                <button onClick={() => setBusquedaPool("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          <span className="text-xs text-white/20 shrink-0">
            {puestoContexto
              ? (agenteSeleccionado ? "Selecciona el agente y toca el puesto para asignar" : "Selecciona un candidato recomendado")
              : (agenteSeleccionado ? "Toca un puesto en el tablero" : "Toca un puesto vacío · o selecciona un agente")}
          </span>
        </div>
        {!colPool && (
          <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto border-t border-white/5" style={{ scrollbarWidth: "none" }}>
            {[
              { key: "disponibles"             as const, label: "Disponibles",          count: pool?.disponibles?.length ?? 0,              color: "text-green-400",   dot: "bg-green-400",   sep: true  },
              { key: "disponiblesCubriendo"    as const, label: "Disp. cubriendo",      count: pool?.disponiblesCubriendo?.length ?? 0,     color: "text-cyan-400",    dot: "bg-cyan-400",    sep: false },
              { key: "haciendoHE"              as const, label: "Desc/Vac cubriendo",   count: (pool?.haciendoHE?.length ?? 0) + (pool?.vacacionistasCubriendo?.length ?? 0), color: "text-amber-300", dot: "bg-amber-300", sep: false },
              { key: "trabajando"              as const, label: "Trabaja hoy",          count: pool?.trabajando?.length ?? 0,               color: "text-orange-400",  dot: "bg-orange-400",  sep: true  },
              { key: "descansandoCiclo"        as const, label: "Descanso ciclo",       count: pool?.descansandoCiclo?.length ?? 0,         color: "text-blue-400",    dot: "bg-blue-400",    sep: false },
              { key: "faltando"                as const, label: "Faltando",             count: pool?.faltando?.length ?? 0,                 color: "text-rose-400",    dot: "bg-rose-400",    sep: true  },
              { key: "enDescanso"              as const, label: "Licencia",             count: pool?.enDescanso?.length ?? 0,               color: "text-indigo-400",  dot: "bg-indigo-400",  sep: false },
              { key: "enPuesto"                as const, label: "En puesto",            count: pool?.enPuesto?.length ?? 0,                 color: "text-teal-400",    dot: "bg-teal-400",    sep: false },
              { key: "enSSA"                   as const, label: "En SSA",               count: pool?.enSSA?.length ?? 0,                    color: "text-amber-400",   dot: "bg-amber-400",   sep: false },
              { key: "suspendidos"             as const, label: "Suspendidos",          count: pool?.suspendidos?.length ?? 0,              color: "text-red-400",     dot: "bg-red-400",     sep: false },
              { key: "enVacaciones"            as const, label: "Vacaciones",           count: pool?.enVacaciones?.length ?? 0,             color: "text-violet-400",  dot: "bg-violet-400",   sep: false },
            ].map(({ key, label, count, color, dot, sep }, idx) => (
              <Fragment key={key}>
                {sep && idx > 0 && <span className="w-px h-4 bg-white/10 shrink-0 mx-0.5" />}
                <button
                  onClick={() => setPoolTab(key)}
                  className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    poolTab === key ? "bg-white/8 text-white" : "text-white/35 hover:text-white/65"
                  }`}
                >
                  {poolTab === key && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
                  {label}
                  <span className={`text-[10px] font-bold ${color}`}>{count}</span>
                </button>
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {!colPool && (<>
        {puestoContexto && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/6 border-b border-primary/15">
            <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
            <span className="text-xs text-primary/80 font-semibold truncate">Candidatos para: {puestoContexto.nombre}</span>
            {puestoContexto.zona_nombre && (
              <span className="text-[10px] text-primary/50 shrink-0">· {puestoContexto.zona_nombre}</span>
            )}
            <button onClick={() => setPuestoContexto(null)} className="ml-auto text-white/25 hover:text-white shrink-0 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loadingPool ? (
          <div className="flex items-center justify-center min-h-[80px]">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ) : puestoContexto ? (
          candidatosRankeados.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[80px] gap-1 text-white/20 text-xs px-4 text-center">
              <span>Sin candidatos disponibles o de descanso de ciclo</span>
              <span className="text-[10px]">Usa las pestañas para explorar el pool completo</span>
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[260px] overflow-y-auto">
              {(["P1", "P2", "P3", "P4", "P5", "P6"] as GrupoRanking[]).map((grupo) => {
                const grupo_agentes = candidatosRankeados.filter(a => a.grupo === grupo);
                if (grupo_agentes.length === 0) return null;
                const cfg = RANKING_GRUPO_CONFIG[grupo];
                return (
                  <div key={grupo} className="p-3">
                    <div className={`flex items-center gap-2 mb-2 border-l-2 pl-2 ${cfg.borderColor}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.headerColor}`}>{cfg.label}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 ${cfg.headerColor} opacity-70`}>{grupo_agentes.length}</span>
                      {grupo === "P5" && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300/70 font-bold ml-auto">Solo cobertura temporal</span>
                      )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {grupo_agentes.map((agente) => (
                        <div key={agente.id} className="shrink-0 w-56">
                          <DraggableAgente
                            agente={agente}
                            isSelected={agenteSeleccionado?.id === agente.id}
                            motivos={agente.motivos}
                            onClick={() => { if (fechaVistaCerrada) return; setAgenteSeleccionado(prev => prev?.id === agente.id ? null : agente); }}
                            disabled={fechaVistaCerrada}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : poolActual.length === 0 ? (
          <div className="flex items-center justify-center min-h-[80px] text-white/20 text-xs px-4 text-center">
            {busquedaPool.trim()
              ? `No se encontró ningún agente con "${busquedaPool}" en ninguna sección`
              : poolTab === "disponibles"      ? "No hay agentes genuinamente disponibles hoy" :
                poolTab === "trabajando"       ? "Ningún agente en turno de trabajo hoy" :
                poolTab === "descansandoCiclo" ? "Ningún agente en descanso de ciclo hoy" :
                poolTab === "disponiblesCubriendo" ? "Ningún disponible está cubriendo un puesto hoy" :
                poolTab === "vacacionistasCubriendo" ? "Ningún vacacionista está cubriendo hoy" :
                poolTab === "haciendoHE"       ? "Ningún descansero o vacacionista está cubriendo hoy" :
                poolTab === "faltando"         ? "No hay ausencias registradas hoy" :
                poolTab === "enDescanso"       ? "No hay agentes en licencia" :
                poolTab === "enPuesto"         ? "Ningún agente está en puesto activo" :
                poolTab === "enSSA"            ? "Ningún agente cubre un SSA activo" :
                poolTab === "enVacaciones"     ? "Ningún agente en vacaciones hoy" :
                "No hay agentes suspendidos"}
          </div>
        ) : poolTab === "trabajando" && !busquedaPool.trim() ? (() => {
          const vacTrab = poolActual.filter(a => a.vacacion_trabajada);
          const normales = poolActual.filter(a => !a.vacacion_trabajada);
          return (
            <div className="flex flex-col divide-y divide-white/5">
              {normales.length > 0 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {normales.map((agente) => (
                    <div key={agente.id} className="shrink-0 w-52">
                      <DraggableAgente agente={agente} isSelected={agenteSeleccionado?.id === agente.id} onClick={() => {}} disabled={true} />
                    </div>
                  ))}
                </div>
              )}
              {vacTrab.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2 border-l-2 border-orange-500/40 pl-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/70">Vacaciones Trabajadas</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-300/60">{vacTrab.length}</span>
                    <span className="text-[8px] text-orange-300/40 ml-auto">Días de vacaciones trabajados</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {vacTrab.map((agente) => (
                      <div key={agente.id} className="shrink-0 w-52">
                        <DraggableAgente agente={agente} isSelected={agenteSeleccionado?.id === agente.id} onClick={() => {}} disabled={true} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div className="flex gap-2 p-3 overflow-x-auto min-h-[80px]">
            {poolActual.map((agente) => {
              const seccion = agente._seccionLabel;
              const seccionDeshabilitada = seccion === "En puesto" || seccion === "En SSA" || seccion === "Faltando" || seccion === "Vacaciones" || seccion === "Desc/Vac cubriendo";
              const seccionColor: Record<string, string> = {
                "Disponible":          "bg-emerald-500/20 text-emerald-300",
                "Disp. cubriendo":     "bg-cyan-500/20 text-cyan-300",
                "Descanso ciclo":      "bg-blue-500/20 text-blue-300",
                "Desc/Vac cubriendo":  "bg-amber-500/20 text-amber-200",
                "Trabaja hoy":         "bg-orange-500/20 text-orange-300",
                "Faltando":            "bg-rose-500/20 text-rose-300",
                "Licencia":            "bg-indigo-500/20 text-indigo-300",
                "En puesto":           "bg-teal-500/20 text-teal-300",
                "En SSA":              "bg-amber-500/20 text-amber-300",
                "Suspendido":          "bg-red-500/20 text-red-300",
                "Vacaciones":          "bg-violet-500/20 text-violet-300",
              };
              return (
                <div key={agente.id} className="shrink-0 w-52">
                  {seccion && (
                    <div className="mb-1 flex justify-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${seccionColor[seccion] ?? "bg-white/10 text-white/40"}`}>
                        {seccion}
                      </span>
                    </div>
                  )}
                  <DraggableAgente
                    agente={agente}
                    isSelected={agenteSeleccionado?.id === agente.id}
                    onClick={() => {
                      if (fechaVistaCerrada) return;
                      setAgenteSeleccionado(prev => prev?.id === agente.id ? null : agente);
                    }}
                    disabled={
                      seccion
                        ? seccionDeshabilitada || fechaVistaCerrada
                        : poolTab === "enPuesto" || poolTab === "enSSA" || poolTab === "faltando" || poolTab === "enVacaciones" || poolTab === "haciendoHE" || poolTab === "disponiblesCubriendo" || poolTab === "vacacionistasCubriendo" || fechaVistaCerrada
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/20">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-green-400" /> Cubierto</span>
          <span className="flex items-center gap-1"><Circle className="w-2.5 h-2.5 text-red-400" /> Descubierto</span>
          <span className="flex items-center gap-1"><ArrowLeftRight className="w-2.5 h-2.5" /> Click agente → click puesto</span>
          <span className="flex items-center gap-1"><XCircle className="w-2.5 h-2.5" /> Hover sobre puesto para remover</span>
          <div className="flex-1" />
          <span>Se refresca cada 30 seg automáticamente</span>
        </div>
      </>)}
    </div>
  );
}
