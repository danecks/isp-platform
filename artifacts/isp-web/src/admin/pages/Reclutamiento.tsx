import { useState } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { StatCard } from "../components/StatCard";
import { mockPostulantes } from "../mocks/reclutamiento";
import type { EstadoPostulanteType } from "../types";
import { Users, Filter } from "lucide-react";

const ESTADOS: (EstadoPostulanteType | "todos")[] = ["todos", "recibido", "en_revision", "entrevista", "aprobado", "descartado"];

const expLabel: Record<string, string> = {
  none: "Sin experiencia",
  "1-2": "1-2 años",
  "3-5": "3-5 años",
  "5+": "Más de 5 años",
};

export default function Reclutamiento() {
  const [filtro, setFiltro] = useState<EstadoPostulanteType | "todos">("todos");

  const filtrados = filtro === "todos" ? mockPostulantes : mockPostulantes.filter((p) => p.estado === filtro);

  return (
    <AdminLayout title="Gestión de Reclutamiento">
      <div className="space-y-6 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["recibido", "en_revision", "entrevista", "aprobado", "descartado"] as EstadoPostulanteType[]).map((e) => {
            const count = mockPostulantes.filter((p) => p.estado === e).length;
            return (
              <button
                key={e}
                onClick={() => setFiltro(filtro === e ? "todos" : e)}
                className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                  filtro === e ? "border-primary/40" : "border-white/5 hover:border-white/10"
                }`}
              >
                <p className="text-2xl font-bold text-white">{count}</p>
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
        </div>

        {/* TABLE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Postulantes</p>
            </div>
            <span className="text-xs text-white/30">{filtrados.length} registros</span>
          </div>
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
                    <td className="px-5 py-3 text-primary font-mono font-semibold">{p.id}</td>
                    <td className="px-3 py-3 text-white/80 font-medium">{p.nombre}</td>
                    <td className="px-3 py-3 text-white/50">{p.telefono}</td>
                    <td className="px-3 py-3 text-white/40 max-w-[140px] truncate">{p.correo}</td>
                    <td className="px-3 py-3 text-white/60 max-w-[140px] truncate">{p.puesto}</td>
                    <td className="px-3 py-3 text-white/50">{expLabel[p.experiencia] || p.experiencia}</td>
                    <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{p.ubicacion}</td>
                    <td className="px-3 py-3"><StatusBadge value={p.canal} /></td>
                    <td className="px-3 py-3"><StatusBadge value={p.estado} /></td>
                    <td className="px-3 py-3 text-white/30">{p.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
