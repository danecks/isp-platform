import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { applicationsApi } from "@/lib/api";
import { Users, Filter, Loader2, RefreshCw } from "lucide-react";

type EstadoPostulante = "recibido" | "en_revision" | "entrevista" | "aprobado" | "descartado";
const ESTADOS: (EstadoPostulante | "todos")[] = ["todos", "recibido", "en_revision", "entrevista", "aprobado", "descartado"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Reclutamiento() {
  const [filtro, setFiltro] = useState<EstadoPostulante | "todos">("todos");

  const { data: postulantes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["applications"],
    queryFn: applicationsApi.getAll,
    refetchInterval: 30000,
  });

  const filtrados = filtro === "todos" ? postulantes : postulantes.filter((p) => p.estado === filtro);

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
                    <th className="text-left px-3 py-3">Correo</th>
                    <th className="text-left px-3 py-3">Puesto</th>
                    <th className="text-left px-3 py-3">Experiencia</th>
                    <th className="text-left px-3 py-3">Ubicación</th>
                    <th className="text-left px-3 py-3">Canal</th>
                    <th className="text-left px-3 py-3">Estado</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr key={p.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3 text-primary font-mono font-semibold">#{p.id}</td>
                      <td className="px-3 py-3 text-white/80 font-medium">{p.nombre}</td>
                      <td className="px-3 py-3 text-white/50">{p.telefono}</td>
                      <td className="px-3 py-3 text-white/40 max-w-[140px] truncate">{p.correo ?? "—"}</td>
                      <td className="px-3 py-3 text-white/60 max-w-[140px] truncate">{p.puesto}</td>
                      <td className="px-3 py-3 text-white/50">{p.experiencia}</td>
                      <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{p.ubicacion}</td>
                      <td className="px-3 py-3"><StatusBadge value={p.canal} /></td>
                      <td className="px-3 py-3"><StatusBadge value={p.estado} /></td>
                      <td className="px-3 py-3 text-white/30 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-10 text-center text-white/30 text-xs">
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
