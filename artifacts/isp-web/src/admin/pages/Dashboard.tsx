import { AdminLayout } from "../layout/AdminLayout";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { mockIncidencias } from "../mocks/incidencias";
import { mockPostulantes } from "../mocks/reclutamiento";
import { mockLeads } from "../mocks/comercial";
import { mockTareas } from "../mocks/tareas";
import { mockCustodias } from "../mocks/custodias";
import { mockKPI } from "../mocks/kpi";
import {
  AlertTriangle,
  Users,
  Briefcase,
  CheckSquare,
  Truck,
  ShieldCheck,
  Timer,
  Zap,
  MessageSquare,
  Trello,
  Globe,
} from "lucide-react";

export default function Dashboard() {
  const abiertas = mockIncidencias.filter((i) => i.estado === "abierta" || i.estado === "en_proceso").length;
  const nuevasPostulaciones = mockPostulantes.filter((p) => p.estado === "recibido").length;
  const leadsNuevos = mockLeads.filter((l) => l.estado === "nuevo").length;
  const tareasPendientes = mockTareas.filter((t) => t.estado === "pendiente" || t.estado === "en_proceso").length;
  const custodiasActivas = mockCustodias.filter((c) => c.estado === "en_ruta" || c.estado === "planificada").length;

  const eventosRecientes = [
    ...mockIncidencias.slice(0, 3).map((i) => ({
      tipo: "Incidencia",
      desc: `${i.tipo} — ${i.cliente}`,
      origen: i.origen,
      estado: i.estado,
      tiempo: i.fecha.split(" ")[1] || i.fecha,
      id: i.id,
    })),
    ...mockLeads.slice(0, 2).map((l) => ({
      tipo: "Lead",
      desc: `Nueva solicitud — ${l.empresa}`,
      origen: l.canal,
      estado: l.estado,
      tiempo: l.fecha,
      id: l.id,
    })),
    ...mockPostulantes.slice(0, 2).map((p) => ({
      tipo: "Postulación",
      desc: `${p.nombre} — ${p.puesto}`,
      origen: p.canal,
      estado: p.estado,
      tiempo: p.fecha,
      id: p.id,
    })),
  ].slice(0, 8);

  return (
    <AdminLayout title="Dashboard de Operaciones">
      <div className="space-y-8 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Incidencias Activas" value={abiertas} sub="Abiertas o en proceso" color="red" />
          <StatCard icon={Users} label="Postulaciones Nuevas" value={nuevasPostulaciones} sub="Sin revisar" color="blue" />
          <StatCard icon={Briefcase} label="Leads Nuevos" value={leadsNuevos} sub="Sin asignar" color="gold" />
          <StatCard icon={CheckSquare} label="Tareas Pendientes" value={tareasPendientes} sub="Por atender" color="purple" />
          <StatCard icon={Truck} label="Custodias Activas" value={custodiasActivas} sub="En ruta o planificadas" color="blue" />
          <StatCard icon={ShieldCheck} label="SLA Cumplido" value={`${mockKPI.slaCumplido}%`} sub="Mes actual" color="green" />
          <StatCard icon={Timer} label="Resp. Promedio" value={`${mockKPI.tiempoRespuestaPromedio} min`} sub="Tiempo de respuesta" color="gold" />
          <StatCard icon={CheckSquare} label="Tareas Cerradas" value={mockKPI.tareasCerradas} sub="Este mes" color="green" />
        </div>

        {/* INFO BLOCK FUTURO */}
        <div className="bg-[#0c1829] border border-primary/15 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white mb-1">Alimentación automática — Próxima Fase</p>
              <p className="text-xs text-white/40 leading-relaxed max-w-3xl">
                En el futuro, los eventos capturados desde formularios web y WhatsApp alimentarán automáticamente estos módulos internos. Cada incidencia reportada, postulación recibida o cotización solicitada por cualquier canal quedará registrada aquí sin intervención manual.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="flex items-center gap-1.5 text-[10px] text-white/30 bg-white/3 border border-white/5 rounded-full px-2.5 py-1">
                  <Globe className="w-3 h-3" /> Formularios Web
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-white/30 bg-white/3 border border-white/5 rounded-full px-2.5 py-1">
                  <MessageSquare className="w-3 h-3" /> Canal WhatsApp
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-white/30 bg-white/3 border border-white/5 rounded-full px-2.5 py-1">
                  <Trello className="w-3 h-3" /> Trello Sync
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* EVENTOS RECIENTES */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Eventos Recientes</p>
            <span className="text-[10px] text-white/30">Todos los canales</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-5 py-3">Tipo</th>
                  <th className="text-left px-3 py-3">Descripción</th>
                  <th className="text-left px-3 py-3">Canal</th>
                  <th className="text-left px-3 py-3">Estado</th>
                  <th className="text-left px-3 py-3">Hora</th>
                </tr>
              </thead>
              <tbody>
                {eventosRecientes.map((e, i) => (
                  <tr key={i} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        e.tipo === "Incidencia" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        e.tipo === "Lead" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}>
                        {e.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-white/70 max-w-xs truncate">{e.desc}</td>
                    <td className="px-3 py-3"><StatusBadge value={e.origen as any} /></td>
                    <td className="px-3 py-3"><StatusBadge value={e.estado as any} /></td>
                    <td className="px-3 py-3 text-white/30">{e.tiempo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* INCIDENCIAS RECIENTES */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-sm font-bold text-white">Incidencias Recientes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-4 py-3">ID</th>
                    <th className="text-left px-3 py-3">Cliente</th>
                    <th className="text-left px-3 py-3">Prioridad</th>
                    <th className="text-left px-3 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {mockIncidencias.slice(0, 5).map((inc) => (
                    <tr key={inc.id} className="border-b border-white/3 hover:bg-white/2">
                      <td className="px-4 py-3 text-primary font-mono font-semibold">{inc.id}</td>
                      <td className="px-3 py-3 text-white/70 max-w-[140px] truncate">{inc.cliente}</td>
                      <td className="px-3 py-3"><StatusBadge value={inc.prioridad} /></td>
                      <td className="px-3 py-3"><StatusBadge value={inc.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TAREAS RECIENTES */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-sm font-bold text-white">Tareas Recientes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-4 py-3">Tarea</th>
                    <th className="text-left px-3 py-3">Asignado</th>
                    <th className="text-left px-3 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {mockTareas.slice(0, 5).map((t) => (
                    <tr key={t.id} className="border-b border-white/3 hover:bg-white/2">
                      <td className="px-4 py-3 text-white/70 max-w-[180px]">
                        <p className="truncate">{t.titulo}</p>
                        <p className="text-[9px] text-white/25 mt-0.5">{t.id}</p>
                      </td>
                      <td className="px-3 py-3 text-white/50">{t.asignado}</td>
                      <td className="px-3 py-3"><StatusBadge value={t.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
