import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { mockTareas } from "../mocks/tareas";
import { mockCustodias } from "../mocks/custodias";
import { mockKPI } from "../mocks/kpi";
import { leadsApi, applicationsApi, incidentsApi } from "@/lib/api";
import {
  AlertTriangle, Users, Briefcase, CheckSquare, Truck,
  ShieldCheck, Timer, Zap, MessageSquare, Trello, Globe, Database, Siren,
} from "lucide-react";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const { data: incidencias = [] } = useQuery({ queryKey: ["incidents"], queryFn: incidentsApi.getAll, refetchInterval: 15000 });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: leadsApi.getAll, refetchInterval: 30000 });
  const { data: postulantes = [] } = useQuery({ queryKey: ["applications"], queryFn: applicationsApi.getAll, refetchInterval: 30000 });

  const abiertas = incidencias.filter((i) => i.estado === "abierta" || i.estado === "en_proceso").length;
  const emergenciasActivas = incidencias.filter((i) => i.esEmergencia && (i.estado === "abierta" || i.estado === "en_proceso")).length;
  const leadsNuevos = leads.filter((l) => l.estado === "nuevo").length;
  const nuevasPostulaciones = postulantes.filter((p) => p.estado === "recibido").length;
  const tareasPendientes = mockTareas.filter((t) => t.estado === "pendiente" || t.estado === "en_proceso").length;
  const custodiasActivas = mockCustodias.filter((c) => c.estado === "en_ruta" || c.estado === "planificada").length;

  const eventosRecientes = [
    ...incidencias.slice(0, 3).map((i) => ({
      tipo: "Incidencia",
      desc: `${i.tipo} — ${i.cliente}`,
      origen: i.origen,
      estado: i.estado,
      tiempo: fmtTime(i.fecha),
    })),
    ...leads.slice(0, 2).map((l) => ({
      tipo: "Lead",
      desc: `Nueva solicitud — ${l.empresa}`,
      origen: l.canal,
      estado: l.estado,
      tiempo: fmtTime(l.createdAt),
    })),
    ...postulantes.slice(0, 2).map((p) => ({
      tipo: "Postulación",
      desc: `${p.nombre} — ${p.puesto}`,
      origen: p.canal,
      estado: p.estado,
      tiempo: fmtTime(p.createdAt),
    })),
  ].slice(0, 8);

  return (
    <AdminLayout title="Dashboard de Operaciones">
      <div className="space-y-8 max-w-[1400px]">

        {/* DB REAL BADGE */}
        <div className="flex items-center gap-2 text-xs text-primary/60">
          <Database className="w-3.5 h-3.5" />
          <span>Incidencias, Leads y Postulaciones conectados a base de datos real · Tareas, Custodias y KPI en datos de prueba</span>
        </div>

        {/* ALERTA DE EMERGENCIAS ACTIVAS */}
        {emergenciasActivas > 0 && (
          <a
            href="/admin/incidencias"
            className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 hover:bg-red-500/15 transition-colors"
          >
            <div className="relative">
              <Siren className="w-5 h-5 text-red-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-300">
                {emergenciasActivas} emergencia{emergenciasActivas !== 1 ? "s" : ""} activa{emergenciasActivas !== 1 ? "s" : ""} — atención inmediata requerida
              </p>
              <p className="text-[10px] text-red-400/70">Ver en módulo de Incidencias →</p>
            </div>
          </a>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Incidencias Activas" value={abiertas} sub="Abiertas o en proceso" color="red" />
          <StatCard icon={Siren} label="Emergencias Activas" value={emergenciasActivas} sub="Atención inmediata" color="red" />
          <StatCard icon={Users} label="Postulaciones Nuevas" value={nuevasPostulaciones} sub="Sin revisar" color="blue" />
          <StatCard icon={Briefcase} label="Leads Nuevos" value={leadsNuevos} sub="Sin asignar" color="gold" />
          <StatCard icon={CheckSquare} label="Tareas Pendientes" value={tareasPendientes} sub="Por atender" color="purple" />
          <StatCard icon={Truck} label="Custodias Activas" value={custodiasActivas} sub="En ruta o planificadas" color="blue" />
          <StatCard icon={ShieldCheck} label="SLA Cumplido" value={`${mockKPI.slaCumplido}%`} sub="Mes actual" color="green" />
          <StatCard icon={Timer} label="Resp. Promedio" value={`${mockKPI.tiempoRespuestaPromedio} min`} sub="Tiempo de respuesta" color="gold" />
        </div>

        {/* INFO BLOCK */}
        <div className="bg-[#0c1829] border border-primary/15 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white mb-1">Alimentación automática — Próxima Fase</p>
              <p className="text-xs text-white/40 leading-relaxed max-w-3xl">
                En el futuro, los eventos capturados desde formularios web y WhatsApp alimentarán automáticamente estos módulos internos. Cada incidencia reportada, postulación recibida o cotización solicitada por cualquier canal quedará registrada aquí sin intervención manual.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="flex items-center gap-1.5 text-[10px] text-green-400/70 bg-green-500/5 border border-green-500/15 rounded-full px-2.5 py-1">
                  <Globe className="w-3 h-3" /> Formularios Web ✓ Conectados
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-white/30 bg-white/3 border border-white/5 rounded-full px-2.5 py-1">
                  <MessageSquare className="w-3 h-3" /> Canal WhatsApp — Próximamente
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-white/30 bg-white/3 border border-white/5 rounded-full px-2.5 py-1">
                  <Trello className="w-3 h-3" /> Trello Sync — Próximamente
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
                {eventosRecientes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-white/20 text-xs">Cargando eventos...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* INCIDENCIAS RECIENTES — REAL */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <p className="text-sm font-bold text-white">Incidencias Recientes</p>
              <span className="text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full font-semibold">BD Real</span>
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
                  {incidencias.slice(0, 5).map((inc) => (
                    <tr key={inc.id} className="border-b border-white/3 hover:bg-white/2">
                      <td className="px-4 py-3 text-primary font-mono font-semibold text-[10px]">{inc.id}</td>
                      <td className="px-3 py-3 text-white/70 max-w-[140px] truncate">{inc.cliente}</td>
                      <td className="px-3 py-3"><StatusBadge value={inc.prioridad} /></td>
                      <td className="px-3 py-3"><StatusBadge value={inc.estado} /></td>
                    </tr>
                  ))}
                  {incidencias.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Cargando...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TAREAS RECIENTES — MOCK */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <p className="text-sm font-bold text-white">Tareas Recientes</p>
              <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full font-semibold">Datos de prueba</span>
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
