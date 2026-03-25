import { useState } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { mockLeads } from "../mocks/comercial";
import type { EstadoLeadType } from "../types";
import { Briefcase, Filter } from "lucide-react";

const ESTADOS: (EstadoLeadType | "todos")[] = ["todos", "nuevo", "contactado", "cotizado", "ganado", "perdido"];

export default function Comercial() {
  const [filtro, setFiltro] = useState<EstadoLeadType | "todos">("todos");

  const filtrados = filtro === "todos" ? mockLeads : mockLeads.filter((l) => l.estado === filtro);

  return (
    <AdminLayout title="Gestión Comercial — Leads">
      <div className="space-y-6 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["nuevo", "contactado", "cotizado", "ganado", "perdido"] as EstadoLeadType[]).map((e) => {
            const count = mockLeads.filter((l) => l.estado === e).length;
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
              <Briefcase className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Pipeline Comercial</p>
            </div>
            <span className="text-xs text-white/30">{filtrados.length} leads</span>
          </div>
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
                    <td className="px-5 py-3 text-primary font-mono font-semibold">{l.id}</td>
                    <td className="px-3 py-3 text-white/80 font-medium max-w-[150px] truncate">{l.empresa}</td>
                    <td className="px-3 py-3 text-white/60">{l.contacto}</td>
                    <td className="px-3 py-3 text-white/50">{l.servicio}</td>
                    <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{l.ubicacion}</td>
                    <td className="px-3 py-3"><StatusBadge value={l.canal} /></td>
                    <td className="px-3 py-3"><StatusBadge value={l.estado} /></td>
                    <td className="px-3 py-3 text-white/50">{l.ejecutivo}</td>
                    <td className="px-3 py-3 text-white/30">{l.fecha}</td>
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
