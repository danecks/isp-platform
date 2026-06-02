import { useState, useEffect, useCallback, Fragment } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { tareasApi, type Tarea } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckSquare, Filter, CheckCircle2, AlertCircle,
  Ban, Lock, Loader2, RefreshCw, ChevronRight, Square,
} from "lucide-react";

type EstadoFiltro = "todos" | "pendiente" | "en_proceso" | "completada" | "cancelada";

const ESTADO_LABEL: Record<string, string> = {
  pendiente:   "Pendiente",
  en_proceso:  "En Proceso",
  completada:  "Completada",
  cancelada:   "Cancelada",
};

const PRIORIDAD_CLS: Record<string, string> = {
  alta:  "text-red-400 bg-red-500/8 border-red-500/15",
  media: "text-yellow-400 bg-yellow-500/8 border-yellow-500/15",
  baja:  "text-green-400 bg-green-500/8 border-green-500/15",
};

export default function Tareas() {
  const { currentUser: user } = useAuth();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoFiltro>("todos");
  const [actualizando, setActualizando] = useState<string | null>(null);

  const esSupervisorOAdmin = user && ["supervisor", "admin"].includes(user.rol ?? "");

  const cargarTareas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tareasApi.getAll();
      setTareas(data);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => { cargarTareas(); }, [cargarTareas]);

  const cambiarEstado = useCallback(async (tarea: Tarea, nuevoEstado: string) => {
    setActualizando(tarea.id);
    try {
      await tareasApi.update(tarea.id, { estado: nuevoEstado });
      setTareas((prev) =>
        prev.map((t) => t.id === tarea.id ? { ...t, estado: nuevoEstado as Tarea["estado"] } : t)
      );
    } catch (e: any) {
      setError(e.message ?? "Error al actualizar tarea");
    } finally {
      setActualizando(null);
    }
  }, []);

  const togglePaso = useCallback(async (tarea: Tarea, key: string, done: boolean) => {
    setActualizando(tarea.id);
    try {
      const actualizada = await tareasApi.togglePaso(tarea.id, key, done);
      setTareas((prev) => prev.map((t) => t.id === tarea.id ? { ...t, ...actualizada } : t));
    } catch (e: any) {
      setError(e.message ?? "Error al actualizar paso");
    } finally {
      setActualizando(null);
    }
  }, []);

  const filtradas = filtro === "todos" ? tareas : tareas.filter((t) => t.estado === filtro);

  const stats = {
    pendiente:  tareas.filter((t) => t.estado === "pendiente").length,
    en_proceso: tareas.filter((t) => t.estado === "en_proceso").length,
    completada: tareas.filter((t) => t.estado === "completada").length,
    cancelada:  tareas.filter((t) => t.estado === "cancelada").length,
  };

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <AdminLayout title="Gestión de Tareas">
      <div className="space-y-6 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["pendiente", "en_proceso", "completada", "cancelada"] as const).map((e) => (
            <button
              key={e}
              onClick={() => setFiltro(filtro === e ? "todos" : e)}
              className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                filtro === e
                  ? "border-primary/40 shadow-sm shadow-primary/10"
                  : "border-white/5 hover:border-white/10"
              }`}
            >
              <p className="text-2xl font-bold text-white">{stats[e]}</p>
              <div className="mt-1 flex items-center justify-between">
                <StatusBadge value={e} />
                {filtro === e && (
                  <span className="text-[9px] text-primary/70 bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
                    Filtrado
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* FILTROS */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-white/30" />
            <div className="flex flex-wrap gap-2">
              {(["todos", "pendiente", "en_proceso", "completada", "cancelada"] as EstadoFiltro[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    filtro === e
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                  }`}
                >
                  {e === "todos" ? "Todas" : ESTADO_LABEL[e]}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={cargarTareas}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={cargarTareas} className="ml-auto text-xs text-red-400 hover:text-red-200">
              Reintentar
            </button>
          </div>
        )}

        {/* TABLA */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Registro de Tareas</p>
            </div>
            <span className="text-xs text-white/30">{filtradas.length} tareas</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando tareas...</span>
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-20 text-white/20 text-sm">
              No hay tareas{filtro !== "todos" ? ` con estado "${ESTADO_LABEL[filtro]}"` : ""}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-5 py-3">ID</th>
                    <th className="text-left px-3 py-3">Título</th>
                    <th className="text-left px-3 py-3">Incidencia</th>
                    <th className="text-left px-3 py-3">Prioridad</th>
                    <th className="text-left px-3 py-3">Estado</th>
                    <th className="text-left px-3 py-3">Asignado</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                    <th className="text-left px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((t) => {
                    const completada = t.estado === "completada";
                    const cancelada  = t.estado === "cancelada";
                    const enProceso  = t.estado === "en_proceso";
                    const pendiente  = t.estado === "pendiente";
                    const cargando   = actualizando === t.id;
                    const pasos      = t.pasos ?? [];
                    const tienePasos = pasos.length > 0;
                    const pasosHechos = pasos.filter((p) => p.done).length;
                    const puedeEditarPasos = esSupervisorOAdmin && !completada && !cancelada;

                    return (
                      <Fragment key={t.id}>
                      <tr
                        className={`border-b border-white/3 transition-colors ${
                          tienePasos ? "border-b-0" : ""
                        } ${
                          completada ? "opacity-50 hover:opacity-70" :
                          cancelada  ? "opacity-30" :
                          "hover:bg-white/2"
                        }`}
                      >
                        <td className="px-5 py-3">
                          <span className="text-primary font-mono font-semibold text-[10px]">{t.id}</span>
                        </td>

                        <td className="px-3 py-3 max-w-[220px]">
                          <p className="text-white/80 font-medium truncate">{t.titulo}</p>
                          {t.descripcion && (
                            <p className="text-white/30 text-[10px] mt-0.5 truncate">{t.descripcion}</p>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {t.incidenciaId
                            ? <span className="text-red-400/70 font-mono text-[10px]">{t.incidenciaId}</span>
                            : <span className="text-white/20">—</span>
                          }
                        </td>

                        <td className="px-3 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${PRIORIDAD_CLS[t.prioridad] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                            {t.prioridad}
                          </span>
                        </td>

                        <td className="px-3 py-3"><StatusBadge value={t.estado} /></td>

                        <td className="px-3 py-3 text-white/50">{t.asignado ?? "—"}</td>

                        <td className="px-3 py-3 text-white/30">{fmtFecha(t.createdAt)}</td>

                        <td className="px-3 py-3">
                          {cargando ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />
                          ) : completada ? (
                            <div className="flex items-center gap-1 text-[10px] text-green-400/50">
                              <CheckCircle2 className="w-3 h-3" />
                              Completada
                            </div>
                          ) : cancelada ? (
                            <div className="flex items-center gap-1 text-[10px] text-white/20">
                              <Ban className="w-3 h-3" />
                              Cancelada
                            </div>
                          ) : !esSupervisorOAdmin ? (
                            <div className="flex items-center gap-1 text-[10px] text-white/20">
                              <Lock className="w-3 h-3" />
                              Solo sup.
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {/* Avanzar al siguiente estado */}
                              {pendiente && (
                                <button
                                  onClick={() => cambiarEstado(t, "en_proceso")}
                                  className="flex items-center gap-1 text-[10px] text-blue-400/80 hover:text-blue-300 bg-blue-500/8 hover:bg-blue-500/15 border border-blue-500/15 hover:border-blue-500/30 px-2 py-1.5 rounded-lg transition-all"
                                  title="Pasar a En Proceso"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                  Iniciar
                                </button>
                              )}
                              {(pendiente || enProceso) && (
                                <button
                                  onClick={() => cambiarEstado(t, "completada")}
                                  className="flex items-center gap-1 text-[10px] text-green-400/80 hover:text-green-300 bg-green-500/8 hover:bg-green-500/15 border border-green-500/15 hover:border-green-500/30 px-2 py-1.5 rounded-lg transition-all"
                                  title="Marcar como completada"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Completar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {tienePasos && (
                        <tr
                          className={`border-b border-white/3 ${
                            completada ? "opacity-50" : cancelada ? "opacity-30" : ""
                          }`}
                        >
                          <td></td>
                          <td colSpan={7} className="px-3 pb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-white/30 uppercase tracking-wide mr-1">
                                Checklist {pasosHechos}/{pasos.length}
                              </span>
                              {pasos.map((p) => (
                                <button
                                  key={p.key}
                                  onClick={() => puedeEditarPasos && togglePaso(t, p.key, !p.done)}
                                  disabled={!puedeEditarPasos || cargando}
                                  title={puedeEditarPasos ? (p.done ? "Desmarcar paso" : "Marcar paso") : "Solo supervisor/admin"}
                                  className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${
                                    p.done
                                      ? "text-green-300 bg-green-500/10 border-green-500/25"
                                      : "text-white/50 bg-white/3 border-white/8 hover:border-white/20"
                                  } ${puedeEditarPasos && !cargando ? "cursor-pointer" : "cursor-default"}`}
                                >
                                  {p.done
                                    ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    : <Square className="w-3 h-3 shrink-0" />}
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
