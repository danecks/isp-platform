import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { leadsApi } from "@/lib/api";
import { Briefcase, Filter, Loader2, RefreshCw, ExternalLink, Send, CheckCircle2, UserPlus } from "lucide-react";

type EstadoLead = "nuevo" | "contactado" | "cotizado" | "ganado" | "perdido";
type CanalFilter = "todos" | "whatsapp" | "web" | "otro";

const ESTADOS: (EstadoLead | "todos")[] = ["todos", "nuevo", "contactado", "cotizado", "ganado", "perdido"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

const API = "/api";

async function sendLeadToTrello(id: number): Promise<{ ok: boolean; url?: string; msg?: string }> {
  try {
    const r = await fetch(`${API}/trello/send-lead/${id}`, { method: "POST" });
    const data = await r.json();
    if (r.status === 409) return { ok: true, url: data.trelloUrl, msg: "Ya existe" };
    if (!r.ok) throw new Error(data.error || "Error");
    return { ok: true, url: data.card?.shortUrl };
  } catch (err) {
    return { ok: false, msg: (err as Error).message };
  }
}

async function convertirCliente(id: number): Promise<{ ok: boolean; clienteId?: number; msg?: string }> {
  try {
    const r = await fetch(`${API}/leads/${id}/convertir-cliente`, { method: "POST" });
    const data = await r.json();
    if (!r.ok) return { ok: false, msg: data.error || "Error al convertir" };
    return { ok: true, clienteId: data.clienteId };
  } catch (err) {
    return { ok: false, msg: (err as Error).message };
  }
}

export default function Comercial() {
  const [filtro, setFiltro] = useState<EstadoLead | "todos">("todos");
  const [canalFiltro, setCanalFiltro] = useState<CanalFilter>("todos");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [convirtiendo, setConvirtiendo] = useState<number | null>(null);
  const [trelloUrls, setTrelloUrls] = useState<Record<number, string>>({});
  const [convertidos, setConvertidos] = useState<Record<number, number>>({});
  const [errores, setErrores] = useState<Record<number, string>>({});

  const { data: leads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads"],
    queryFn: leadsApi.getAll,
    refetchInterval: 30000,
  });

  const filtrados = leads.filter((l) => {
    if (filtro !== "todos" && l.estado !== filtro) return false;
    if (canalFiltro === "whatsapp" && l.canal !== "whatsapp") return false;
    if (canalFiltro === "web" && l.canal !== "web") return false;
    if (canalFiltro === "otro" && (l.canal === "whatsapp" || l.canal === "web")) return false;
    return true;
  });

  const waCount = leads.filter((l) => l.canal === "whatsapp").length;

  return (
    <AdminLayout title="Gestión Comercial — Leads">
      <div className="space-y-6 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["nuevo", "contactado", "cotizado", "ganado", "perdido"] as EstadoLead[]).map((e) => {
            const cnt = leads.filter((l) => l.estado === e).length;
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
              <Briefcase className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Pipeline Comercial</p>
              <span className="text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full font-semibold ml-1">Base de datos real</span>
            </div>
            <span className="text-xs text-white/30">{filtrados.length} leads</span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Cargando leads...</span>
            </div>
          )}

          {isError && (
            <div className="py-10 text-center text-xs text-red-400">
              Error al cargar leads. Verifique la conexión con el API.
            </div>
          )}

          {!isLoading && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-5 py-3">ID</th>
                    <th className="text-left px-3 py-3">Empresa</th>
                    <th className="text-left px-3 py-3">Contacto</th>
                    <th className="text-left px-3 py-3">Servicio</th>
                    <th className="text-left px-3 py-3">Ubicación</th>
                    <th className="text-left px-3 py-3">Canal</th>
                    <th className="text-left px-3 py-3">Estado</th>
                    <th className="text-left px-3 py-3">Ejecutivo</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                    <th className="text-left px-3 py-3">Trello</th>
                    <th className="text-left px-3 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((l) => {
                    const trelloUrl = trelloUrls[l.id] || (l as any).tareaAsociada;
                    const clienteIdConv = convertidos[l.id];
                    const error = errores[l.id];
                    return (
                    <tr
                      key={l.id}
                      className={`border-b border-white/3 hover:bg-white/2 transition-colors ${
                        l.canal === "whatsapp" ? "bg-[#25D366]/3" : ""
                      }`}
                    >
                      <td className="px-5 py-3 text-primary font-mono font-semibold">#{l.id}</td>
                      <td className="px-3 py-3 text-white/80 font-medium max-w-[150px] truncate">{l.empresa}</td>
                      <td className="px-3 py-3 text-white/60">{l.contacto}</td>
                      <td className="px-3 py-3 text-white/50">{l.servicio}</td>
                      <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{l.ubicacion}</td>
                      <td className="px-3 py-3"><StatusBadge value={l.canal as any} /></td>
                      <td className="px-3 py-3"><StatusBadge value={l.estado} /></td>
                      <td className="px-3 py-3 text-white/50">{l.ejecutivo}</td>
                      <td className="px-3 py-3 text-white/30 whitespace-nowrap">{fmtDate(l.createdAt)}</td>
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
                              setSendingId(l.id);
                              const res = await sendLeadToTrello(l.id);
                              if (res.ok && res.url) setTrelloUrls(p => ({ ...p, [l.id]: res.url! }));
                              setSendingId(null);
                            }}
                            disabled={sendingId === l.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#0079BF]/20 hover:bg-[#0079BF]/30 text-[#0079BF] hover:text-blue-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                            title="Enviar a Trello"
                          >
                            {sendingId === l.id ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {l.estado === "ganado" && (
                          clienteIdConv ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
                              <CheckCircle2 size={11} />
                              Cliente #{clienteIdConv}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={async () => {
                                  setConvirtiendo(l.id);
                                  setErrores(p => { const n = { ...p }; delete n[l.id]; return n; });
                                  const res = await convertirCliente(l.id);
                                  if (res.ok && res.clienteId) {
                                    setConvertidos(p => ({ ...p, [l.id]: res.clienteId! }));
                                  } else {
                                    setErrores(p => ({ ...p, [l.id]: res.msg ?? "Error" }));
                                  }
                                  setConvirtiendo(null);
                                }}
                                disabled={convirtiendo === l.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-[11px] rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50"
                                title="Convertir a Cliente"
                              >
                                {convirtiendo === l.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <UserPlus size={11} />}
                                <span>Convertir</span>
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
                      <td colSpan={11} className="px-5 py-10 text-center text-white/30 text-xs">
                        No hay leads con los filtros aplicados.
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
