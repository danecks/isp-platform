import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { StatCard } from "../components/StatCard";
import { mockClientes } from "../mocks/clientes";
import { Building2, Users, AlertTriangle, Timer } from "lucide-react";

export default function Clientes() {
  const totalAgentes = mockClientes.reduce((s, c) => s + c.agentesAsignados, 0);
  const totalIncidencias = mockClientes.reduce((s, c) => s + c.incidenciasMes, 0);
  const activos = mockClientes.filter((c) => c.estado === "activo").length;

  return (
    <AdminLayout title="Cartera de Clientes">
      <div className="space-y-6 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="Clientes Activos" value={activos} sub="Contratos vigentes" color="gold" />
          <StatCard icon={Users} label="Agentes Asignados" value={totalAgentes} sub="Total en campo" color="blue" />
          <StatCard icon={AlertTriangle} label="Incidencias del Mes" value={totalIncidencias} sub="Todos los clientes" color="red" />
          <StatCard icon={Timer} label="Resp. Promedio" value="11 min" sub="Tiempo de respuesta" color="green" />
        </div>

        {/* TABLE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Ficha de Clientes</p>
            </div>
            <span className="text-xs text-white/30">{mockClientes.length} clientes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-5 py-3">Empresa</th>
                  <th className="text-left px-3 py-3">Servicios Activos</th>
                  <th className="text-left px-3 py-3">Agentes</th>
                  <th className="text-left px-3 py-3">Incid. Mes</th>
                  <th className="text-left px-3 py-3">T. Respuesta</th>
                  <th className="text-left px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {mockClientes.map((c) => (
                  <tr key={c.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-white">{c.empresa}</p>
                      <p className="text-[10px] text-white/30 font-mono">{c.id}</p>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-1">
                        {c.servicios.map((s) => (
                          <span key={s} className="text-[10px] bg-white/5 border border-white/8 text-white/50 px-2 py-0.5 rounded-full">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-white font-bold">{c.agentesAsignados}</span>
                    </td>
                    <td className="px-3 py-4">
                      <span className={c.incidenciasMes >= 3 ? "text-red-400 font-bold" : "text-white/60"}>
                        {c.incidenciasMes}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-white/60">{c.tiempoPromedio}</td>
                    <td className="px-3 py-4"><StatusBadge value={c.estado} /></td>
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
