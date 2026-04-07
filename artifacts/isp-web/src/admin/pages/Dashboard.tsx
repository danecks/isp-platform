import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import {
  dashboardApi, rrhhAlertasApi,
  leadsApi, applicationsApi, incidentsApi, tareasApi,
  type DashboardSummary, type AlertaRRHH,
  type Incident, type Lead, type Application,
} from "@/lib/api";
import {
  AlertTriangle, Users, Briefcase, CheckSquare, Truck,
  ShieldCheck, Timer, Siren, BellRing, Wallet, UserCheck,
  TrendingDown, HardHat, Landmark, FileSpreadsheet,
  ChevronRight, BarChart3, UserSearch,
  QrCode, Package, Wrench, CalendarDays, Trash2, LogIn,
} from "lucide-react";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
}

const PRIORIDAD_COLOR: Record<string, string> = {
  alta:   "text-red-400 bg-red-400/10 border-red-400/20",
  media:  "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  baja:   "text-blue-400 bg-blue-400/10 border-blue-400/20",
};
const TIPO_ALERTA_LABEL: Record<string, string> = {
  contrato_por_vencer:   "Contrato por vencer",
  vacaciones_pendientes: "Vacaciones pendientes",
  sin_anticipo:          "Sin anticipo",
  baja_reciente:         "Baja reciente",
  salario_bajo:          "Salario bajo",
};

// ─── Quick-link card ──────────────────────────────────────────────────────────
function QuickLink({ href, icon: Icon, label, sub, color = "blue" }: {
  href: string; icon: React.ElementType; label: string; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue:   "border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5",
    purple: "border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5",
    green:  "border-green-500/20 hover:border-green-500/40 hover:bg-green-500/5",
    orange: "border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5",
    gold:   "border-yellow-500/20 hover:border-yellow-500/40 hover:bg-yellow-500/5",
    red:    "border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5",
  };
  const iconMap: Record<string, string> = {
    blue: "text-blue-400", purple: "text-purple-400", green: "text-green-400",
    orange: "text-orange-400", gold: "text-yellow-400", red: "text-red-400",
  };
  return (
    <Link href={href}>
      <a className={`flex items-center gap-3 bg-[#0c1829] border rounded-xl px-4 py-3 transition-all cursor-pointer group ${colorMap[color] ?? colorMap.blue}`}>
        <Icon className={`w-4 h-4 shrink-0 ${iconMap[color] ?? iconMap.blue}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 group-hover:text-white truncate">{label}</p>
          {sub && <p className="text-[10px] text-white/30 truncate">{sub}</p>}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 shrink-0" />
      </a>
    </Link>
  );
}

// ─── ADMIN dashboard ──────────────────────────────────────────────────────────
function DashboardAdmin({
  summary, incidencias, leads, applications,
}: {
  summary: DashboardSummary | undefined;
  incidencias: Incident[];
  leads: Lead[];
  applications: Application[];
}) {
  const s = summary;
  const emergenciasActivas = s?.operaciones.emergencias_activas ?? 0;

  const eventosRecientes = [
    ...incidencias.slice(0, 3).map((i) => ({
      tipo: "Incidencia", desc: `${i.tipo} — ${i.cliente}`,
      origen: i.origen, estado: i.estado, tiempo: fmtTime(i.fecha),
    })),
    ...leads.slice(0, 2).map((l) => ({
      tipo: "Lead", desc: `Nueva solicitud — ${l.empresa}`,
      origen: l.canal, estado: l.estado, tiempo: fmtTime(l.createdAt),
    })),
    ...applications.slice(0, 2).map((p) => ({
      tipo: "Postulación", desc: `${p.nombre} — ${p.puesto}`,
      origen: p.canal, estado: p.estado, tiempo: fmtTime(p.createdAt),
    })),
  ].slice(0, 8);

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* ALERTA EMERGENCIAS */}
      {emergenciasActivas > 0 && (
        <Link href="/admin/incidencias">
          <a className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 hover:bg-red-500/15 transition-colors">
            <div className="relative">
              <Siren className="w-5 h-5 text-red-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-300">
                {emergenciasActivas} emergencia{emergenciasActivas !== 1 ? "s" : ""} activa{emergenciasActivas !== 1 ? "s" : ""} — atención inmediata
              </p>
              <p className="text-[10px] text-red-400/70">Ver en módulo de Incidencias →</p>
            </div>
          </a>
        </Link>
      )}

      {/* STATS — OPERACIONES */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Operaciones</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Incidencias Activas"  value={s?.operaciones.incidencias_activas ?? "—"} sub="Abiertas o en proceso" color="red"    href="/admin/incidencias" />
          <StatCard icon={Siren}         label="Emergencias Activas"  value={s?.operaciones.emergencias_activas ?? "—"} sub="Atención inmediata"   color="red"    href="/admin/incidencias" />
          <StatCard icon={CheckSquare}   label="Tareas Pendientes"    value={s?.operaciones.tareas_pendientes ?? "—"}   sub="Por atender"          color="purple" href="/admin/tareas" />
          <StatCard icon={ShieldCheck}   label="SLA Cumplido"         value="98%"                                       sub="Mes actual"           color="green" />
        </div>
      </div>

      {/* STATS — RRHH */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">RRHH & Personal</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={HardHat}      label="Colaboradores Activos"  value={s?.rrhh.empleados_activos ?? "—"}        sub="En plantilla activa"         color="blue"   href="/admin/empleados" />
          <StatCard icon={TrendingDown} label="Bajas Este Mes"         value={s?.rrhh.bajas_este_mes ?? "—"}           sub="Colaboradores dados de baja"  color="red"    href="/admin/empleados" />
          <StatCard icon={BellRing}     label="Alertas RRHH Activas"   value={s?.rrhh.alertas_activas ?? "—"}          sub="Requieren atención"           color="gold"   href="/admin/rrhh/alertas" />
          <StatCard icon={Wallet}       label="Anticipos Pendientes"   value={s?.rrhh.anticipos_pendientes ?? "—"}     sub="Por aprobar"                  color="purple" href="/admin/anticipos" />
        </div>
      </div>

      {/* STATS — COMERCIAL */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Comercial & Reclutamiento</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Briefcase}   label="Leads Nuevos"            value={s?.comercial.leads_nuevos ?? "—"}         sub="Sin asignar"              color="gold"   href="/admin/comercial" />
          <StatCard icon={Users}       label="Postulaciones Nuevas"    value={s?.comercial.postulaciones_nuevas ?? "—"} sub="Sin revisar"              color="blue"   href="/admin/reclutamiento" />
          <StatCard icon={Timer}       label="Resp. Promedio"          value="12 min"                                   sub="Tiempo de respuesta"      color="gold" />
          <StatCard icon={Landmark}    label="Liquidaciones Activas"   value={s?.rrhh.liquidaciones_confirmadas ?? "—"} sub="Confirmadas / pendientes"  color="purple" href="/admin/rrhh/prestaciones" />
        </div>
      </div>

      {/* STATS — CONTROL QR & LOGÍSTICA */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Control Operativo QR & Logística</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard icon={LogIn}         label="Fichajes Hoy"             value={s?.control_qr?.fichajes_hoy ?? "—"}          sub="Entradas registradas"         color="green"  href="/admin/control-operativo-qr" />
          <StatCard icon={QrCode}        label="Agentes en Turno"         value={s?.control_qr?.agentes_en_turno ?? "—"}      sub="Activos en este momento"      color="blue"   href="/admin/control-operativo-qr" />
          <StatCard icon={Package}       label="Solicitudes Bodega"       value={s?.bodega?.solicitudes_pendientes ?? "—"}    sub="Pendientes de despacho"       color="orange" href="/admin/bodega" />
          <StatCard icon={Wrench}        label="Armas en Reparación"      value={s?.bodega?.armas_en_reparacion ?? "—"}       sub="Órdenes de servicio abiertas" color="red"    href="/admin/armeria" />
          <StatCard icon={CalendarDays}  label="Vacaciones Pendientes"    value={s?.rrhh?.vacaciones_pendientes ?? "—"}       sub="Por aprobar"                  color="purple" href="/admin/rrhh/vacaciones" />
          <StatCard icon={Trash2}        label="Eliminaciones Pendientes" value={s?.sistema?.eliminaciones_pendientes ?? "—"} sub="Por revisar"                  color="red"    href="/admin/sistema/eliminaciones" />
        </div>
      </div>

      {/* QUICK LINKS — TODOS LOS MÓDULOS */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Accesos Rápidos — Todos los Módulos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <QuickLink href="/admin/control-operativo-qr"  icon={QrCode}         label="Control QR"          sub="Fichajes y rondas"       color="green"  />
          <QuickLink href="/admin/operaciones"           icon={BarChart3}      label="Pizarrón Operativo"  sub="Estado del servicio"     color="blue"   />
          <QuickLink href="/admin/incidencias"           icon={AlertTriangle}  label="Incidencias"         sub="Gestionar activas"       color="red"    />
          <QuickLink href="/admin/bodega"                icon={Package}        label="Bodega"              sub="Stock y solicitudes"     color="orange" />
          <QuickLink href="/admin/armeria"               icon={Wrench}         label="Armería"             sub="Armas y munición"        color="red"    />
          <QuickLink href="/admin/rrhh/vacaciones"       icon={CalendarDays}   label="Vacaciones"          sub="Aprobar solicitudes"     color="purple" />
          <QuickLink href="/admin/comercial"             icon={Briefcase}      label="Comercial"           sub="Leads y propuestas"      color="gold"   />
          <QuickLink href="/admin/reclutamiento"         icon={UserSearch}     label="Reclutamiento"       sub="Postulaciones"           color="green"  />
          <QuickLink href="/admin/anticipos"             icon={Wallet}         label="Anticipos"           sub="Aprobar / rechazar"      color="purple" />
          <QuickLink href="/admin/tareas"                icon={CheckSquare}    label="Tareas"              sub="Ver pendientes"          color="purple" />
          <QuickLink href="/admin/empleados"             icon={HardHat}        label="Colaboradores"       sub="Ficha y gestión"         color="blue"   />
          <QuickLink href="/admin/sistema/eliminaciones" icon={Trash2}         label="Solicitudes Elim."   sub="Revisar y aprobar"       color="red"    />
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
                      e.tipo === "Lead"       ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                                               "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}>{e.tipo}</span>
                  </td>
                  <td className="px-3 py-3 text-white/70 max-w-xs truncate">{e.desc}</td>
                  <td className="px-3 py-3"><StatusBadge value={e.origen as any} /></td>
                  <td className="px-3 py-3"><StatusBadge value={e.estado as any} /></td>
                  <td className="px-3 py-3 text-white/30">{e.tiempo}</td>
                </tr>
              ))}
              {eventosRecientes.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-white/20 text-xs">Sin eventos recientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INCIDENCIAS + LEADS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Incidencias Recientes</p>
            <Link href="/admin/incidencias">
              <a className="text-[10px] text-primary/60 hover:text-primary transition-colors">Ver todas →</a>
            </Link>
          </div>
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
                  <td className="px-3 py-3"><StatusBadge value={inc.prioridad as any} /></td>
                  <td className="px-3 py-3"><StatusBadge value={inc.estado as any} /></td>
                </tr>
              ))}
              {incidencias.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Sin incidencias</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Leads Recientes</p>
            <Link href="/admin/comercial">
              <a className="text-[10px] text-primary/60 hover:text-primary transition-colors">Ver todos →</a>
            </Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-3 py-3">Servicio</th>
                <th className="text-left px-3 py-3">Estado</th>
                <th className="text-left px-3 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 5).map((l) => (
                <tr key={l.id} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-3 text-white/70 max-w-[130px] truncate">{l.empresa}</td>
                  <td className="px-3 py-3 text-white/50 max-w-[120px] truncate">{l.servicio}</td>
                  <td className="px-3 py-3"><StatusBadge value={l.estado as any} /></td>
                  <td className="px-3 py-3 text-white/30">{fmtFecha(l.createdAt)}</td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Sin leads</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── RRHH dashboard ───────────────────────────────────────────────────────────
function DashboardRRHH({
  summary, alertas, applications,
}: {
  summary: DashboardSummary | undefined;
  alertas: AlertaRRHH[];
  applications: Application[];
}) {
  const s = summary?.rrhh;

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard icon={HardHat}      label="Colaboradores Activos"  value={s?.empleados_activos ?? "—"}         sub="En plantilla activa"     color="blue"   href="/admin/empleados" />
        <StatCard icon={TrendingDown} label="Bajas Este Mes"         value={s?.bajas_este_mes ?? "—"}            sub="Dados de baja este mes"  color="red"    href="/admin/empleados" />
        <StatCard icon={BellRing}     label="Alertas Activas"        value={s?.alertas_activas ?? "—"}           sub="Requieren atención"      color="gold"   href="/admin/rrhh/alertas" />
        <StatCard icon={Wallet}       label="Anticipos Pendientes"   value={s?.anticipos_pendientes ?? "—"}      sub="Por aprobar"             color="purple" href="/admin/anticipos" />
        <StatCard icon={Users}        label="Postulaciones Nuevas"   value={s?.postulaciones_nuevas ?? "—"}      sub="Sin revisar"             color="blue"   href="/admin/reclutamiento" />
        <StatCard icon={CalendarDays} label="Vacaciones Pendientes"  value={s?.vacaciones_pendientes ?? "—"}     sub="Por aprobar"             color="orange" href="/admin/rrhh/vacaciones" />
        <StatCard icon={Landmark}     label="Liquidaciones Activas"  value={s?.liquidaciones_confirmadas ?? "—"} sub="Confirmadas pendientes"  color="gold"   href="/admin/rrhh/prestaciones" />
      </div>

      {/* QUICK LINKS */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Accesos Rápidos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <QuickLink href="/admin/empleados"            icon={HardHat}         label="Colaboradores"       sub="Ficha y gestión"       color="blue"   />
          <QuickLink href="/admin/rrhh/alertas"         icon={BellRing}        label="Alertas RRHH"        sub="Revisar activas"       color="gold"   />
          <QuickLink href="/admin/anticipos"            icon={Wallet}          label="Anticipos"           sub="Aprobar / rechazar"    color="purple" />
          <QuickLink href="/admin/reclutamiento"        icon={UserSearch}      label="Reclutamiento"       sub="Postulaciones"         color="green"  />
          <QuickLink href="/admin/rrhh/prestaciones"    icon={Landmark}        label="Prestaciones"        sub="Liquidaciones"         color="orange" />
          <QuickLink href="/admin/rrhh/vacaciones"      icon={CalendarDays}    label="Vacaciones"          sub="Solicitudes"           color="orange" />
          <QuickLink href="/admin/rrhh/pre-planilla"    icon={FileSpreadsheet} label="Pre-Planilla"        sub="Revisión nómina"       color="blue"   />
        </div>
      </div>

      {/* ALERTAS RRHH RECIENTES */}
      <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">Alertas RRHH Activas</p>
            {(s?.alertas_activas ?? 0) > 0 && (
              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                {s?.alertas_activas}
              </span>
            )}
          </div>
          <Link href="/admin/rrhh/alertas">
            <a className="text-[10px] text-primary/60 hover:text-primary transition-colors">Ver todas →</a>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-3 py-3">Tipo</th>
                <th className="text-left px-3 py-3">Prioridad</th>
                <th className="text-left px-3 py-3">Sugerencia</th>
                <th className="text-left px-3 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {alertas.slice(0, 6).map((a) => (
                <tr key={a.id} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-3 text-white/70 max-w-[150px] truncate">{a.employeeNombre}</td>
                  <td className="px-3 py-3 text-white/60">{TIPO_ALERTA_LABEL[a.tipo] ?? a.tipo}</td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORIDAD_COLOR[a.prioridad] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                      {a.prioridad}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-white/40 max-w-[200px] truncate">{a.sugerencia ?? "—"}</td>
                  <td className="px-3 py-3 text-white/30">{fmtFecha(a.generadaAt)}</td>
                </tr>
              ))}
              {alertas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <UserCheck className="w-6 h-6 text-green-400/40 mx-auto mb-2" />
                    <p className="text-white/20 text-xs">Sin alertas activas — todo en orden</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POSTULACIONES RECIENTES */}
      <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <p className="text-sm font-bold text-white">Postulaciones Recientes</p>
          <Link href="/admin/reclutamiento">
            <a className="text-[10px] text-primary/60 hover:text-primary transition-colors">Ver todas →</a>
          </Link>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
              <th className="text-left px-4 py-3">Postulante</th>
              <th className="text-left px-3 py-3">Puesto</th>
              <th className="text-left px-3 py-3">Estado</th>
              <th className="text-left px-3 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {applications.slice(0, 5).map((p) => (
              <tr key={p.id} className="border-b border-white/3 hover:bg-white/2">
                <td className="px-4 py-3 text-white/70 max-w-[150px] truncate">{p.nombre}</td>
                <td className="px-3 py-3 text-white/50 max-w-[130px] truncate">{p.puesto}</td>
                <td className="px-3 py-3"><StatusBadge value={p.estado as any} /></td>
                <td className="px-3 py-3 text-white/30">{fmtFecha(p.createdAt)}</td>
              </tr>
            ))}
            {applications.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Sin postulaciones recientes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── OPERACIONES / SUPERVISOR dashboard ───────────────────────────────────────
function DashboardOperaciones({
  summary, incidencias,
}: {
  summary: DashboardSummary | undefined;
  incidencias: Incident[];
}) {
  const s = summary?.operaciones;
  const emergenciasActivas = s?.emergencias_activas ?? 0;

  return (
    <div className="space-y-8 max-w-[1400px]">
      {emergenciasActivas > 0 && (
        <Link href="/admin/incidencias">
          <a className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 hover:bg-red-500/15 transition-colors">
            <div className="relative">
              <Siren className="w-5 h-5 text-red-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-300">
                {emergenciasActivas} emergencia{emergenciasActivas !== 1 ? "s" : ""} activa{emergenciasActivas !== 1 ? "s" : ""} — atención inmediata
              </p>
              <p className="text-[10px] text-red-400/70">Ver en módulo de Incidencias →</p>
            </div>
          </a>
        </Link>
      )}

      {/* STATS OPERATIVAS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={AlertTriangle} label="Incidencias Activas"  value={s?.incidencias_activas ?? "—"}                        sub="Abiertas o en proceso"   color="red"    href="/admin/incidencias" />
        <StatCard icon={Siren}         label="Emergencias Activas"  value={s?.emergencias_activas ?? "—"}                        sub="Atención inmediata"      color="red"    href="/admin/incidencias" />
        <StatCard icon={CheckSquare}   label="Tareas Pendientes"    value={s?.tareas_pendientes ?? "—"}                          sub="Por atender"             color="purple" href="/admin/tareas" />
        <StatCard icon={Truck}         label="Custodias Activas"    value="—"                                                    sub="En ruta o planificadas"  color="blue"   href="/admin/custodias" />
        <StatCard icon={LogIn}         label="Fichajes Hoy"         value={summary?.control_qr?.fichajes_hoy ?? "—"}             sub="Entradas registradas"    color="green"  href="/admin/control-operativo-qr" />
        <StatCard icon={QrCode}        label="Agentes en Turno"     value={summary?.control_qr?.agentes_en_turno ?? "—"}         sub="Activos ahora"           color="blue"   href="/admin/control-operativo-qr" />
      </div>

      {/* QUICK LINKS */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Módulos Operativos</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickLink href="/admin/control-operativo-qr" icon={QrCode}        label="Control QR"         sub="Fichajes y rondas"    color="green"  />
          <QuickLink href="/admin/incidencias"          icon={AlertTriangle}  label="Incidencias"        sub="Gestionar activas"   color="red"    />
          <QuickLink href="/admin/tareas"               icon={CheckSquare}    label="Tareas"             sub="Ver pendientes"      color="purple" />
          <QuickLink href="/admin/operaciones"          icon={BarChart3}      label="Pizarrón Operativo" sub="Estado del servicio" color="blue"   />
          <QuickLink href="/admin/custodias"            icon={Truck}          label="Custodias"          sub="En ruta"             color="blue"   />
          <QuickLink href="/admin/bodega"               icon={Package}        label="Bodega"             sub="Stock y solicitudes" color="orange" />
        </div>
      </div>

      <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <p className="text-sm font-bold text-white">Incidencias Activas</p>
          <Link href="/admin/incidencias">
            <a className="text-[10px] text-primary/60 hover:text-primary transition-colors">Ver todas →</a>
          </Link>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-3 py-3">Tipo</th>
              <th className="text-left px-3 py-3">Cliente</th>
              <th className="text-left px-3 py-3">Prioridad</th>
              <th className="text-left px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {incidencias
              .filter((i) => i.estado === "abierta" || i.estado === "en_proceso")
              .slice(0, 8)
              .map((inc) => (
                <tr key={inc.id} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-3 text-primary font-mono font-semibold text-[10px]">{inc.id}</td>
                  <td className="px-3 py-3 text-white/70 max-w-[120px] truncate">{inc.tipo}</td>
                  <td className="px-3 py-3 text-white/50 max-w-[130px] truncate">{inc.cliente}</td>
                  <td className="px-3 py-3"><StatusBadge value={inc.prioridad as any} /></td>
                  <td className="px-3 py-3"><StatusBadge value={inc.estado as any} /></td>
                </tr>
              ))}
            {incidencias.filter((i) => i.estado === "abierta" || i.estado === "en_proceso").length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/20 text-xs">Sin incidencias activas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── COMERCIAL dashboard ──────────────────────────────────────────────────────
function DashboardComercial({
  summary, leads, applications,
}: {
  summary: DashboardSummary | undefined;
  leads: Lead[];
  applications: Application[];
}) {
  const s = summary?.comercial;

  return (
    <div className="space-y-8 max-w-[1400px]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Briefcase}   label="Leads Nuevos"          value={s?.leads_nuevos ?? "—"}         sub="Sin asignar"         color="gold"   href="/admin/comercial" />
        <StatCard icon={Users}       label="Postulaciones Nuevas"  value={s?.postulaciones_nuevas ?? "—"} sub="Sin revisar"         color="blue"   href="/admin/reclutamiento" />
        <StatCard icon={ShieldCheck} label="SLA Cumplido"          value="98%"                            sub="Mes actual"          color="green" />
        <StatCard icon={Timer}       label="Resp. Promedio"        value="12 min"                         sub="Tiempo de respuesta" color="gold" />
      </div>

      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Accesos Rápidos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink href="/admin/comercial"     icon={Briefcase}  label="Leads & CRM"       sub="Gestionar oportunidades" color="gold"   />
          <QuickLink href="/admin/reclutamiento" icon={UserSearch} label="Reclutamiento"      sub="Ver postulaciones"       color="blue"   />
          <QuickLink href="/admin/clientes"      icon={HardHat}    label="Clientes"           sub="Base de clientes"        color="green"  />
          <QuickLink href="/admin/reportes"      icon={BarChart3}  label="Reportería"         sub="Indicadores"             color="purple" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Leads Recientes</p>
            <Link href="/admin/comercial">
              <a className="text-[10px] text-primary/60 hover:text-primary transition-colors">Ver todos →</a>
            </Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-3 py-3">Servicio</th>
                <th className="text-left px-3 py-3">Estado</th>
                <th className="text-left px-3 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 6).map((l) => (
                <tr key={l.id} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-3 text-white/70 max-w-[140px] truncate">{l.empresa}</td>
                  <td className="px-3 py-3 text-white/50 max-w-[120px] truncate">{l.servicio}</td>
                  <td className="px-3 py-3"><StatusBadge value={l.estado as any} /></td>
                  <td className="px-3 py-3 text-white/30">{fmtFecha(l.createdAt)}</td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Sin leads</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Postulaciones Recientes</p>
            <Link href="/admin/reclutamiento">
              <a className="text-[10px] text-primary/60 hover:text-primary transition-colors">Ver todas →</a>
            </Link>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                <th className="text-left px-4 py-3">Postulante</th>
                <th className="text-left px-3 py-3">Puesto</th>
                <th className="text-left px-3 py-3">Estado</th>
                <th className="text-left px-3 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {applications.slice(0, 6).map((p) => (
                <tr key={p.id} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-3 text-white/70 max-w-[140px] truncate">{p.nombre}</td>
                  <td className="px-3 py-3 text-white/50 max-w-[120px] truncate">{p.puesto}</td>
                  <td className="px-3 py-3"><StatusBadge value={p.estado as any} /></td>
                  <td className="px-3 py-3 text-white/30">{fmtFecha(p.createdAt)}</td>
                </tr>
              ))}
              {applications.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-white/20 text-xs">Sin postulaciones</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD COMPONENT ─────────────────────────────────────────────────
export default function Dashboard() {
  const { currentUser } = useAuth();
  const rol = currentUser?.rol ?? "admin";

  const dashboardTitles: Record<string, string> = {
    admin:       "Dashboard General",
    rrhh:        "Dashboard RRHH",
    operaciones: "Dashboard Operativo",
    supervisor:  "Dashboard Supervisor",
    comercial:   "Dashboard Comercial",
  };

  const isOps      = rol === "operaciones" || rol === "supervisor";
  const isRrhh     = rol === "rrhh";
  const isComercial = rol === "comercial";
  const isAdmin    = rol === "admin";

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 30000,
  });

  const { data: incidencias = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: incidentsApi.getAll,
    refetchInterval: 15000,
    enabled: isAdmin || isOps,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: leadsApi.getAll,
    refetchInterval: 30000,
    enabled: isAdmin || isComercial,
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: applicationsApi.getAll,
    refetchInterval: 30000,
    enabled: isAdmin || isComercial || isRrhh,
  });

  const { data: alertasData } = useQuery({
    queryKey: ["rrhh-alertas-dashboard"],
    queryFn: () => rrhhAlertasApi.getActivas(8),
    refetchInterval: 60000,
    enabled: isAdmin || isRrhh,
  });
  const alertas = alertasData?.alertas ?? [];

  return (
    <AdminLayout title={dashboardTitles[rol] ?? "Dashboard"}>
      {isRrhh ? (
        <DashboardRRHH summary={summary} alertas={alertas} applications={applications} />
      ) : isOps ? (
        <DashboardOperaciones summary={summary} incidencias={incidencias} />
      ) : isComercial ? (
        <DashboardComercial summary={summary} leads={leads} applications={applications} />
      ) : (
        <DashboardAdmin summary={summary} incidencias={incidencias} leads={leads} applications={applications} />
      )}
    </AdminLayout>
  );
}
