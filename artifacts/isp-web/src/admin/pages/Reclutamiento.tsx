import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { applicationsApi } from "@/lib/api";
import { Users, Filter, Loader2, RefreshCw, ExternalLink, Send, CheckCircle2, UserCheck } from "lucide-react";

type EstadoPostulante = "recibido" | "en_revision" | "entrevista" | "aprobado" | "descartado";
type CanalFilter = "todos" | "whatsapp" | "web" | "otro";

const ESTADOS: (EstadoPostulante | "todos")[] = ["todos", "recibido", "en_revision", "entrevista", "aprobado", "descartado"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

const API = "/api";

async function sendApplicationToTrello(id: number): Promise<{ ok: boolean; url?: string; msg?: string }> {
  try {
    const r = await fetch(`${API}/trello/send-application/${id}`, { method: "POST" });
    const data = await r.json();
    if (r.status === 409) return { ok: true, url: data.trelloUrl, msg: "Ya existe" };
    if (!r.ok) throw new Error(data.error || "Error");
    return { ok: true, url: data.card?.shortUrl };
  } catch (err) {
    return { ok: false, msg: (err as Error).message };
  }
}

async function contratarPostulante(id: number): Promise<{ ok: boolean; empleadoId?: number; numEmpleado?: string; msg?: string }> {
  try {
    const r = await fetch(`${API}/applications/${id}/contratar`, { method: "POST" });
    const data = await r.json();
    if (!r.ok) return { ok: false, msg: data.error || "Error al contratar" };
    return { ok: true, empleadoId: data.empleadoId, numEmpleado: data.numEmpleado };
  } catch (err) {
    return { ok: false, msg: (err as Error).message };
  }
}

export default function Reclutamiento() {
  const [filtro, setFiltro] = useState<EstadoPostulante | "todos">("todos");
  const [canalFiltro, setCanalFiltro] = useState<CanalFilter>("todos");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [contratando, setContratando] = useState<number | null>(null);
  const [trelloUrls, setTrelloUrls] = useState<Record<number, string>>({});
  const [contratados, setContratados] = useState<Record<number, { empleadoId: number; numEmpleado: string }>>({});
  const [errores, setErrores] = useState<Record<number, string>>({});

  const { data: postulantes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["applications"],
    queryFn: applicationsApi.getAll,
    refetchInterval: 30000,
  });

  const filtrados = postulantes.filter((p) => {
    if (filtro !== "todos" && p.estado !== filtro) return false;
    if (canalFiltro === "whatsapp" && p.canal !== "whatsapp") return false;
    if (canalFiltro === "web" && p.canal !== "web") return false;
    if (canalFiltro === "otro" && (p.canal === "whatsapp" || p.canal === "web")) return false;
    return true;
  });

  const waCount = postulantes.filter((p) => p.canal === "whatsapp").length;

  return (
    <AdminLayout title="Gestión de Reclutamiento">
      <div className="space-y-6 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["recibido", "en_revision", "entrevista", "aprobado", "descartado"] as EstadoPostulante[]).map((e) => {
            const cnt = postulantes.filter((p) => p.estado === e).length;
            return (
              <button
                key={e}
                onClick={() => setFiltro(filtro === e ? "todos" : e)}
                className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                  filtro === e ? "border-primary/40" : "border-white/5 hover:border-white/10"
                }`}
              >
                <p className="text-2xl font-bold text-white">{isLoading ? "—" : cnt}</p>
                <div className="mt-1"><StatusBadge value={e} /></div>
              </button>
            );
          })}
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-start gap-3">
          <Filter className="w-4 h-4 text-white/30 mt-1 shrink-0" />

          <div className="flex-1 flex flex-col gap-2">
            {/* Fila 1: Estado */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-white/25 uppercase tracking-widest w-14 shrink-0">Estado</span>
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    filtro === e
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                  }`}
                >
                  {e === "todos" ? "Todos" : <StatusBadge value={e} />}
                </button>
              ))}
            </div>

            {/* Fila 2: Canal */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-white/25 uppercase tracking-widest w-14 shrink-0">Canal</span>
              {(["todos", "whatsapp", "web", "otro"] as CanalFilter[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCanalFiltro(canalFiltro === c ? "todos" : c)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    canalFiltro === c
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                  }`}
                >
                  {c === "todos" ? (
                    <span>Todos</span>
                  ) : (
                    <StatusBadge value={c as any} />
                  )}
                </button>
              ))}
              {waCount > 0 && (
                <span className="text-[10px] text-[#25D366]/70 bg-[#25D366]/8 border border-[#25D366]/15 px-2 py-0.5 rounded-full">
                  {waCount} via WhatsApp
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="ml-auto flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Actualizar
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Postulantes</p>
              <span className="text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full font-semibold ml-1">Base de datos real</span>
            </div>
            <span className="text-xs text-white/30">{filtrados.length} registros</span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Cargando postulantes...</span>
            </div>
          )}

          {isError && (
            <div className="py-10 text-center text-xs text-red-400">
              Error al cargar postulantes. Verifique la conexión con el API.
            </div>
          )}

          {!isLoading && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-5 py-3">ID</th>
                    <th className="text-left px-3 py-3">Nombre</th>
                    <th className="text-left px-3 py-3">Teléfono</th>
                    <th className="text-left px-3 py-3">DPI</th>
                    <th className="text-left px-3 py-3">Correo</th>
                    <th className="text-left px-3 py-3">Puesto</th>
                    <th className="text-left px-3 py-3">Experiencia</th>
                    <th className="text-left px-3 py-3">Ubicación</th>
                    <th className="text-left px-3 py-3">Canal</th>
                    <th className="text-left px-3 py-3">Estado</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                    <th className="text-left px-3 py-3">Trello</th>
                    <th className="text-left px-3 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => {
                    const trelloUrl = trelloUrls[p.id] || (p as any).tareaAsociada;
                    const contratado = contratados[p.id];
                    const error = errores[p.id];
                    return (
                    <tr
                      key={p.id}
                      className={`border-b border-white/3 hover:bg-white/2 transition-colors ${
                        p.canal === "whatsapp" ? "bg-[#25D366]/3" : ""
                      }`}
                    >
                      <td className="px-5 py-3 text-primary font-mono font-semibold">#{p.id}</td>
                      <td className="px-3 py-3 text-white/80 font-medium">{p.nombre}</td>
                      <td className="px-3 py-3 text-white/50">{p.telefono}</td>
                      <td className="px-3 py-3 text-white/40 font-mono text-[11px]">
                        {(p as any).dpi
                          ? <span className="text-emerald-400/70">{(p as any).dpi}</span>
                          : <span className="text-red-400/50 text-[10px]">Sin DPI</span>
                        }
                      </td>
                      <td className="px-3 py-3 text-white/40 max-w-[140px] truncate">{p.correo ?? "—"}</td>
                      <td className="px-3 py-3 text-white/60 max-w-[140px] truncate">{p.puesto}</td>
                      <td className="px-3 py-3 text-white/50">{p.experiencia}</td>
                      <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{p.ubicacion}</td>
                      <td className="px-3 py-3"><StatusBadge value={p.canal as any} /></td>
                      <td className="px-3 py-3"><StatusBadge value={p.estado} /></td>
                      <td className="px-3 py-3 text-white/30 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {trelloUrl ? (
                          <a href={trelloUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0079BF] hover:text-blue-300 text-xs">
                            <CheckCircle2 size={12} className="text-green-400" />
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <button
                            onClick={async () => {
                              setSendingId(p.id);
                              const res = await sendApplicationToTrello(p.id);
                              if (res.ok && res.url) setTrelloUrls(prev => ({ ...prev, [p.id]: res.url! }));
                              setSendingId(null);
                            }}
                            disabled={sendingId === p.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#0079BF]/20 hover:bg-[#0079BF]/30 text-[#0079BF] hover:text-blue-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                            title="Enviar a Trello"
                          >
                            {sendingId === p.id ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {p.estado === "aprobado" && (
                          contratado ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
                              <CheckCircle2 size={11} />
                              {contratado.numEmpleado}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={async () => {
                                  setContratando(p.id);
                                  setErrores(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                  const res = await contratarPostulante(p.id);
                                  if (res.ok && res.empleadoId && res.numEmpleado) {
                                    setContratados(prev => ({
                                      ...prev,
                                      [p.id]: { empleadoId: res.empleadoId!, numEmpleado: res.numEmpleado! },
                                    }));
                                  } else {
                                    setErrores(prev => ({ ...prev, [p.id]: res.msg ?? "Error" }));
                                  }
                                  setContratando(null);
                                }}
                                disabled={contratando === p.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 hover:text-blue-200 text-[11px] rounded-lg border border-blue-500/20 transition-colors disabled:opacity-50"
                                title="Contratar — crear empleado"
                              >
                                {contratando === p.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <UserCheck size={11} />}
                                <span>Contratar</span>
                              </button>
                              {error && (
                                <span className="text-[10px] text-red-400/70 max-w-[120px] truncate" title={error}>{error}</span>
                              )}
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-5 py-10 text-center text-white/30 text-xs">
                        No hay postulantes con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
