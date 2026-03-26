import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { leadsApi } from "@/lib/api";
import { Briefcase, Filter, Loader2, RefreshCw } from "lucide-react";

type EstadoLead = "nuevo" | "contactado" | "cotizado" | "ganado" | "perdido";
const ESTADOS: (EstadoLead | "todos")[] = ["todos", "nuevo", "contactado", "cotizado", "ganado", "perdido"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Comercial() {
  const [filtro, setFiltro] = useState<EstadoLead | "todos">("todos");

  const { data: leads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads"],
    queryFn: leadsApi.getAll,
    refetchInterval: 30000,
  });

  const filtrados = filtro === "todos" ? leads : leads.filter((l) => l.estado === filtro);

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
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-white/30" />
          <div className="flex flex-wrap gap-2">
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
          <button
            onClick={() => refetch()}
            className="ml-auto flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors"
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
                    <tr key={l.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3 text-primary font-mono font-semibold">#{l.id}</td>
                      <td className="px-3 py-3 text-white/80 font-medium max-w-[150px] truncate">{l.empresa}</td>
                      <td className="px-3 py-3 text-white/60">{l.contacto}</td>
                      <td className="px-3 py-3 text-white/50">{l.servicio}</td>
                      <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{l.ubicacion}</td>
                      <td className="px-3 py-3"><StatusBadge value={l.canal} /></td>
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
