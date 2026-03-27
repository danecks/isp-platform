import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import CerrarTareaModal from "../components/CerrarTareaModal";
import { tareasApi, type Tarea } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckSquare, Filter, Trello, CheckCircle2, AlertCircle,
  Ban, ExternalLink, Image, User, Calendar, FileText, Loader2,
  RefreshCw, Eye, Lock, Clock
} from "lucide-react";

type EstadoFiltro = "todos" | "pendiente" | "en_proceso" | "completada" | "cancelada";

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  completada: "Completada",
  cancelada: "Cancelada",
};

const PRIORIDAD_CLS: Record<string, string> = {
  alta: "text-red-400 bg-red-500/8 border-red-500/15",
  media: "text-yellow-400 bg-yellow-500/8 border-yellow-500/15",
  baja: "text-green-400 bg-green-500/8 border-green-500/15",
};

export default function Tareas() {
  const { currentUser: user } = useAuth();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoFiltro>("todos");
  const [tareaACerrar, setTareaACerrar] = useState<Tarea | null>(null);
  const [fotoViewer, setFotoViewer] = useState<{
    url: string;
    supervisor: string;
    fecha: string;
    comentario: string;
  } | null>(null);

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

  useEffect(() => {
    cargarTareas();
  }, [cargarTareas]);

  const filtradas = filtro === "todos" ? tareas : tareas.filter((t) => t.estado === filtro);

  const stats = {
    pendiente: tareas.filter((t) => t.estado === "pendiente").length,
    en_proceso: tareas.filter((t) => t.estado === "en_proceso").length,
    completada: tareas.filter((t) => t.estado === "completada").length,
    cancelada: tareas.filter((t) => t.estado === "cancelada").length,
  };

  const fmtFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
  };

  const fmtFechaHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-GT", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const cierresConEvidencia = tareas.filter((t) => t.estado === "completada" && t.evidencia);

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

        {/* BANNERS: Trello + Cierre */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#0c1829] border border-blue-500/15 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Trello className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white">Trello — Integración activa</p>
                  <span className="text-[10px] text-blue-400/70 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">Fase 1.5</span>
                </div>
                <p className="text-[10px] text-white/35 leading-relaxed">
                  Tarjetas de Trello se crean desde incidencias. Fase 2: al cerrar con evidencia, la tarjeta se mueve a <strong className="text-white/50">Resuelto</strong> automáticamente.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0c1829] border border-green-500/15 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white">Cierre con Evidencia</p>
                  {esSupervisorOAdmin ? (
                    <span className="text-[10px] text-green-400/70 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Habilitado</span>
                  ) : (
                    <span className="text-[10px] text-yellow-400/70 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />Solo supervisor
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/35 leading-relaxed">
                  Foto de evidencia + comentario obligatorios. Trazabilidad completa: quién cerró, cuándo y por qué canal (admin / WhatsApp).
                </p>
              </div>
            </div>
          </div>
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
                    <th className="text-left px-3 py-3">Evidencia</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                    <th className="text-left px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((t) => {
                    const completada = t.estado === "completada";
                    const cancelada = t.estado === "cancelada";
                    const tieneEvidencia = completada && !!t.evidencia;

                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-white/3 transition-colors ${
                          tieneEvidencia
                            ? "bg-green-500/3 hover:bg-green-500/5"
                            : cancelada
                            ? "opacity-40"
                            : "hover:bg-white/2"
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
                          {t.trelloCardUrl ? (
                            <a
                              href={t.trelloCardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400/60 hover:text-blue-400 text-[10px] mt-0.5"
                            >
                              <Trello className="w-2.5 h-2.5" />
                              {t.trelloCardId}
                              <ExternalLink className="w-2 h-2" />
                            </a>
                          ) : t.trelloCardId ? (
                            <span className="text-blue-400/40 text-[10px] font-mono mt-0.5 block">{t.trelloCardId}</span>
                          ) : null}
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

                        <td className="px-3 py-3">
                          {tieneEvidencia && t.evidencia ? (
                            <button
                              onClick={() => setFotoViewer({
                                url: t.evidencia!.fotoUrl,
                                supervisor: t.evidencia!.supervisorNombre,
                                fecha: t.evidencia!.fechaCierre,
                                comentario: t.evidencia!.comentario,
                              })}
                              className="flex items-center gap-1.5 text-green-400/80 hover:text-green-300 transition-colors group"
                              title={`Cerrada por ${t.evidencia.supervisorNombre}`}
                            >
                              <Image className="w-3.5 h-3.5" />
                              <span className="text-[10px] group-hover:underline">Ver foto</span>
                            </button>
                          ) : completada ? (
                            <span className="text-yellow-400/40 text-[10px]">Sin foto</span>
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-white/30">{fmtFecha(t.createdAt)}</td>

                        <td className="px-3 py-3">
                          {!completada && !cancelada && esSupervisorOAdmin ? (
                            <button
                              onClick={() => setTareaACerrar(t)}
                              data-testid={`btn-cerrar-${t.id}`}
                              className="flex items-center gap-1.5 text-[10px] text-green-400/80 hover:text-green-300 bg-green-500/8 hover:bg-green-500/15 border border-green-500/15 hover:border-green-500/30 px-2.5 py-1.5 rounded-lg transition-all"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Cerrar
                            </button>
                          ) : completada ? (
                            <div className="flex items-center gap-1 text-[10px] text-green-400/50">
                              <CheckCircle2 className="w-3 h-3" />
                              Cerrada
                            </div>
                          ) : !esSupervisorOAdmin && !completada && !cancelada ? (
                            <div className="flex items-center gap-1 text-[10px] text-white/20">
                              <Lock className="w-3 h-3" />
                              Solo sup.
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* HISTORIAL DE CIERRES CON EVIDENCIA */}
        {cierresConEvidencia.length > 0 && (
          <div className="bg-[#0c1829] border border-green-500/15 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="text-sm font-bold text-white">Historial de Cierres con Evidencia</p>
              <span className="text-[10px] text-green-400/60 bg-green-500/8 border border-green-500/15 px-2 py-0.5 rounded-full">
                {cierresConEvidencia.length} {cierresConEvidencia.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            <div className="divide-y divide-white/4">
              {cierresConEvidencia.map((t) => (
                <div key={t.id} className="px-5 py-4 flex items-start gap-4">
                  {/* Miniatura foto */}
                  <button
                    onClick={() => setFotoViewer({
                      url: t.evidencia!.fotoUrl,
                      supervisor: t.evidencia!.supervisorNombre,
                      fecha: t.evidencia!.fechaCierre,
                      comentario: t.evidencia!.comentario,
                    })}
                    className="shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-white/10 hover:border-green-500/30 transition-colors group relative"
                  >
                    <img
                      src={t.evidencia!.fotoUrl}
                      alt="Evidencia"
                      className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </button>

                  {/* Detalle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-primary font-mono">{t.id}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${PRIORIDAD_CLS[t.prioridad] ?? ""}`}>
                        {t.prioridad}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                        t.evidencia!.canal === "whatsapp"
                          ? "text-green-400/80 bg-green-500/8 border-green-500/15"
                          : "text-blue-400/60 bg-blue-500/8 border-blue-500/15"
                      }`}>
                        {t.evidencia!.canal}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-white/80 truncate">{t.titulo}</p>
                    <p className="text-[11px] text-white/45 mt-1 line-clamp-2 italic">
                      &ldquo;{t.evidencia!.comentario}&rdquo;
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-white/40">
                        <User className="w-3 h-3" />
                        <span>{t.evidencia!.supervisorNombre}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-white/30">
                        <Calendar className="w-3 h-3" />
                        <span>{fmtFechaHora(t.evidencia!.fechaCierre)}</span>
                      </div>
                      {t.incidenciaId && (
                        <div className="flex items-center gap-1 text-[10px] text-red-400/50">
                          <FileText className="w-3 h-3" />
                          <span>{t.incidenciaId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: Cerrar tarea */}
      {tareaACerrar && (
        <CerrarTareaModal
          tarea={tareaACerrar}
          onClose={() => setTareaACerrar(null)}
          onCerrada={() => {
            setTareaACerrar(null);
            cargarTareas();
          }}
        />
      )}

      {/* VISOR DE FOTO */}
      {fotoViewer && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setFotoViewer(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-[#0a1525] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div>
                <p className="text-xs font-bold text-white">Evidencia fotográfica</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-white/40 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {fotoViewer.supervisor}
                  </span>
                  <span className="text-[10px] text-white/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fmtFechaHora(fotoViewer.fecha)}
                  </span>
                </div>
                {fotoViewer.comentario && (
                  <p className="text-[11px] text-white/50 mt-1 italic max-w-sm truncate">
                    &ldquo;{fotoViewer.comentario}&rdquo;
                  </p>
                )}
              </div>
              <button
                onClick={() => setFotoViewer(null)}
                className="text-white/30 hover:text-white/70 transition-colors p-1"
              >
                <Ban className="w-4 h-4" />
              </button>
            </div>
            <img
              src={fotoViewer.url}
              alt="Evidencia de cierre"
              className="w-full max-h-[70vh] object-contain bg-black/20"
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
