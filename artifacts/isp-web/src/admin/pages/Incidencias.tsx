import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { NuevaIncidenciaModal } from "../components/NuevaIncidenciaModal";
import { EditarIncidenciaModal } from "../components/EditarIncidenciaModal";
import { incidentsApi, type Incident } from "@/lib/api";
import { AlertTriangle, Filter, Loader2, Plus, RefreshCw, ChevronRight, Siren } from "lucide-react";

type EstadoFilter = "todos" | "abierta" | "en_proceso" | "resuelta" | "cerrada";
type PrioridadFilter = "todos" | "urgente" | "alta" | "media" | "baja";
type OrigenFilter = "todos" | "manual" | "web" | "whatsapp" | "llamada" | "portal";

const ESTADOS: EstadoFilter[] = ["todos", "abierta", "en_proceso", "resuelta", "cerrada"];
const PRIORIDADES: PrioridadFilter[] = ["todos", "urgente", "alta", "media", "baja"];
const ORIGENES: OrigenFilter[] = ["todos", "manual", "web", "whatsapp", "llamada", "portal"];

const ESTADO_COUNTS: { key: Exclude<EstadoFilter, "todos">; label: string }[] = [
  { key: "abierta", label: "Abiertas" },
  { key: "en_proceso", label: "En Proceso" },
  { key: "resuelta", label: "Resueltas" },
  { key: "cerrada", label: "Cerradas" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function FilterPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-all whitespace-nowrap ${
        active
          ? "bg-primary/15 border-primary/30 text-primary"
          : "bg-white/3 border-white/8 text-white/40 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

export default function Incidencias() {
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFilter>("todos");
  const [prioridadFiltro, setPrioridadFiltro] = useState<PrioridadFilter>("todos");
  const [origenFiltro, setOrigenFiltro] = useState<OrigenFilter>("todos");
  const [soloEmergencias, setSoloEmergencias] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showNuevaEmergencia, setShowNuevaEmergencia] = useState(false);
  const [editando, setEditando] = useState<Incident | null>(null);

  const { data: incidencias = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["incidents"],
    queryFn: incidentsApi.getAll,
    refetchInterval: 15000,
  });

  const emergenciasAbiertas = incidencias.filter((i) => i.esEmergencia && i.estado === "abierta").length;
  const totalEmergencias = incidencias.filter((i) => i.esEmergencia).length;

  const filtradas = incidencias.filter((i) => {
    if (soloEmergencias && !i.esEmergencia) return false;
    if (estadoFiltro !== "todos" && i.estado !== estadoFiltro) return false;
    if (prioridadFiltro !== "todos" && i.prioridad !== prioridadFiltro) return false;
    if (origenFiltro !== "todos" && i.origen !== origenFiltro) return false;
    return true;
  });

  function toggleEstado(e: Exclude<EstadoFilter, "todos">) {
    setEstadoFiltro((prev) => (prev === e ? "todos" : e));
  }

  return (
    <AdminLayout title="Gestión de Incidencias">
      <div className="space-y-6 max-w-[1400px]">

        {/* ALERTA DE EMERGENCIAS ACTIVAS */}
        {!isLoading && emergenciasAbiertas > 0 && (
          <div
            className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 cursor-pointer hover:bg-red-500/15 transition-colors"
            onClick={() => setSoloEmergencias(true)}
          >
            <div className="relative">
              <Siren className="w-5 h-5 text-red-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-300">
                {emergenciasAbiertas} emergencia{emergenciasAbiertas !== 1 ? "s" : ""} activa{emergenciasAbiertas !== 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-red-400/70">Haga clic para filtrar — atención inmediata requerida</p>
            </div>
            {soloEmergencias && (
              <button
                onClick={(e) => { e.stopPropagation(); setSoloEmergencias(false); }}
                className="text-[10px] text-red-400/60 hover:text-red-300 underline underline-offset-2"
              >
                Ver todas
              </button>
            )}
          </div>
        )}

        {/* STAT CARDS — clicables para filtrar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Card emergencias */}
          <button
            onClick={() => setSoloEmergencias((v) => !v)}
            className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer group ${
              soloEmergencias ? "border-red-500/40 bg-red-500/5" : "border-white/5 hover:border-red-500/20"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Siren className="w-3 h-3 text-red-400" />
              {emergenciasAbiertas > 0 && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <p className="text-2xl font-bold text-red-300">{isLoading ? "—" : totalEmergencias}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-red-400/70">Emergencias</span>
              {soloEmergencias && (
                <span className="text-[9px] text-red-400/60 uppercase tracking-wide">Filtrado</span>
              )}
            </div>
          </button>

          {ESTADO_COUNTS.map(({ key, label }) => {
            const cnt = incidencias.filter((i) => i.estado === key).length;
            const isActive = estadoFiltro === key;
            return (
              <button
                key={key}
                onClick={() => toggleEstado(key)}
                className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer group ${
                  isActive ? "border-primary/40 bg-primary/5" : "border-white/5 hover:border-white/12"
                }`}
              >
                <p className="text-2xl font-bold text-white">{isLoading ? "—" : cnt}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge value={key} />
                  {isActive && (
                    <span className="text-[9px] text-primary/60 uppercase tracking-wide">Filtrado</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* FILTROS + BOTÓN NUEVA */}
        <div className="flex flex-wrap items-start gap-3">
          <Filter className="w-4 h-4 text-white/30 mt-1 shrink-0" />

          <div className="flex-1 flex flex-col gap-2">
            {/* Fila 1: Estado */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-white/25 uppercase tracking-widest w-14 shrink-0">Estado</span>
              {ESTADOS.map((e) => (
                <FilterPill
                  key={e}
                  active={estadoFiltro === e}
                  onClick={() => setEstadoFiltro(e)}
                >
                  {e === "todos" ? <span>Todos</span> : <StatusBadge value={e} />}
                </FilterPill>
              ))}
            </div>

            {/* Fila 2: Prioridad */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-white/25 uppercase tracking-widest w-14 shrink-0">Prioridad</span>
              {PRIORIDADES.map((p) => (
                <FilterPill
                  key={p}
                  active={prioridadFiltro === p}
                  onClick={() => setPrioridadFiltro(p)}
                >
                  {p === "todos" ? <span>Toda</span> : <StatusBadge value={p} />}
                </FilterPill>
              ))}
            </div>

            {/* Fila 3: Origen */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-white/25 uppercase tracking-widest w-14 shrink-0">Origen</span>
              {ORIGENES.map((o) => (
                <FilterPill
                  key={o}
                  active={origenFiltro === o}
                  onClick={() => setOrigenFiltro(o)}
                >
                  {o === "todos" ? <span>Todos</span> : <StatusBadge value={o} />}
                </FilterPill>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors px-3 py-2"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button
              onClick={() => setShowNuevaEmergencia(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Siren className="w-3.5 h-3.5" />
              Emergencia
            </button>
            <button
              onClick={() => setShowNueva(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-[#0a1628] text-xs font-bold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Incidencia
            </button>
          </div>
        </div>

        {/* TABLA */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Registro de Incidencias</p>
              <span className="text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full font-semibold ml-1">
                Base de datos real
              </span>
            </div>
            <span className="text-xs text-white/30">{filtradas.length} de {incidencias.length} registros</span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-20 text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Cargando incidencias...</span>
            </div>
          )}

          {isError && (
            <div className="py-12 text-center">
              <p className="text-xs text-red-400 mb-3">Error al cargar incidencias. Verifique la conexión con el API.</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-primary/60 hover:text-primary underline underline-offset-2"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-5 py-3">ID</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                    <th className="text-left px-3 py-3">Origen</th>
                    <th className="text-left px-3 py-3">Cliente</th>
                    <th className="text-left px-3 py-3">Ubicación</th>
                    <th className="text-left px-3 py-3">Tipo</th>
                    <th className="text-left px-3 py-3">Prioridad</th>
                    <th className="text-left px-3 py-3">Estado</th>
                    <th className="text-left px-3 py-3">Responsable</th>
                    <th className="px-3 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((inc) => {
                    const isUrgente = inc.prioridad === "urgente";
                    const esEmerg = inc.esEmergencia === true;
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => setEditando(inc)}
                        className={`border-b border-white/3 hover:bg-white/3 transition-colors cursor-pointer group ${
                          esEmerg ? "bg-red-500/5 hover:bg-red-500/8" : isUrgente ? "bg-red-500/3" : ""
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {esEmerg && (
                              <span className="relative flex-shrink-0" aria-label="Emergencia activa" role="img" title="Emergencia">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60 animate-ping" />
                                <Siren className="w-3 h-3 text-red-400 relative" aria-hidden="true" />
                              </span>
                            )}
                            <span className="text-primary font-mono font-semibold text-[10px]">{inc.id}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-white/50 whitespace-nowrap">{fmtDate(inc.fecha)}</td>
                        <td className="px-3 py-3"><StatusBadge value={inc.origen as any} /></td>
                        <td className="px-3 py-3 text-white/80 font-medium max-w-[140px] truncate">{inc.cliente}</td>
                        <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{inc.ubicacion ?? "—"}</td>
                        <td className="px-3 py-3 text-white/60 max-w-[130px] truncate">
                          {esEmerg && <span className="text-red-400 font-semibold mr-1">⚡</span>}
                          {inc.tipo}
                        </td>
                        <td className="px-3 py-3"><StatusBadge value={inc.prioridad as any} /></td>
                        <td className="px-3 py-3"><StatusBadge value={inc.estado as any} /></td>
                        <td className="px-3 py-3 text-white/50">
                          {inc.responsable ?? "Sin asignar"}
                          {esEmerg && inc.reportadoPor && (
                            <div className="text-[9px] text-red-400/60 truncate max-w-[80px]">
                              Rep: {inc.reportadoPor}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-primary/50 transition-colors" />
                        </td>
                      </tr>
                    );
                  })}

                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center text-white/25 text-xs">
                        {incidencias.length === 0
                          ? 'No hay incidencias registradas. Use el botón "Nueva Incidencia" para crear la primera.'
                          : "No se encontraron incidencias con los filtros aplicados."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* HINT CLICK */}
          {filtradas.length > 0 && !isLoading && (
            <div className="px-5 py-3 border-t border-white/3">
              <p className="text-[10px] text-white/20">
                Haga clic en cualquier fila para ver el detalle y editar estado, prioridad, responsable o notas.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL — NUEVA INCIDENCIA */}
      {showNueva && (
        <NuevaIncidenciaModal onClose={() => setShowNueva(false)} />
      )}

      {/* MODAL — NUEVA EMERGENCIA */}
      {showNuevaEmergencia && (
        <NuevaIncidenciaModal
          onClose={() => setShowNuevaEmergencia(false)}
          defaultEmergencia
        />
      )}

      {/* MODAL — EDITAR INCIDENCIA */}
      {editando && (
        <EditarIncidenciaModal
          incidencia={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </AdminLayout>
  );
}
