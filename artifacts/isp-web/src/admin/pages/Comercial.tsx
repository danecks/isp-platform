import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { leadsApi } from "@/lib/api";
import { Briefcase, Filter, Loader2, RefreshCw } from "lucide-react";

type EstadoLead = "nuevo" | "contactado" | "cotizado" | "ganado" | "perdido";
type CanalFilter = "todos" | "whatsapp" | "web" | "otro";

const ESTADOS: (EstadoLead | "todos")[] = ["todos", "nuevo", "contactado", "cotizado", "ganado", "perdido"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Comercial() {
  const [filtro, setFiltro] = useState<EstadoLead | "todos">("todos");
  const [canalFiltro, setCanalFiltro] = useState<CanalFilter>("todos");

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
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((l) => (
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
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-white/30 text-xs">
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
