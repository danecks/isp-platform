import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Users, Search, Filter, X, Loader2, RefreshCw,
  Building2, MapPin, Phone, Mail, Calendar, Hash,
  Shield, Briefcase, BarChart2, CheckSquare, Wallet,
  AlertTriangle, Zap, Activity, Clock, TrendingUp,
  ChevronRight, UserCheck, ExternalLink, BadgeCheck,
} from "lucide-react";

const API_BASE = "/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Empleado {
  id: number;
  nombreCompleto: string;
  dpi: string | null;
  telefono: string | null;
  correo: string | null;
  puesto: string | null;
  area: string | null;
  estadoLaboral: string;
  sede: string | null;
  supervisorNombre: string | null;
  fechaIngreso: string | null;
  notas: string | null;
  sourceSystem: string;
  syncStatus: string;
  updatedAt: string | null;
}

interface KpiData {
  empleadoId: number;
  nombreCompleto: string;
  periodo: string;
  tieneDatos: boolean;
  tareas: { asignadas: number; completadas: number; enProceso: number; pendientes: number; ultimaTarea: string | null };
  anticipos: { solicitados: number; aprobados: number; pendientes: number; montoTotal: number; ultimaSolicitud: string | null };
  incidencias: { relacionadas: number; ultimaIncidencia: string | null };
  emergencias: { reportadas: number; ultimaEmergencia: string | null };
  asignaciones: { activas: number; total: number };
  ultimaActividad: string | null;
}

interface Asignacion {
  id: number;
  cliente_id: string;
  puesto: string | null;
  servicio: string | null;
  ubicacion: string | null;
  supervisor_nombre: string | null;
  codigo_asignacion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  notas: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-GT", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtRelativa(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const días = Math.floor(diff / 86400000);
  if (días === 0) return "hoy";
  if (días === 1) return "ayer";
  if (días < 30) return `hace ${días} días`;
  if (días < 365) return `hace ${Math.floor(días / 30)} meses`;
  return `hace ${Math.floor(días / 365)} año(s)`;
}

function fmtQ(n: number) {
  return `Q${n.toLocaleString("es-GT")}`;
}

const ESTADO_LAB: Record<string, { label: string; color: string }> = {
  activo:      { label: "Activo",      color: "text-green-400 bg-green-400/10 border-green-400/20" },
  inactivo:    { label: "Inactivo",    color: "text-gray-400 bg-gray-400/10 border-gray-400/20" },
  licencia:    { label: "Licencia",    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  suspendido:  { label: "Suspendido",  color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

const AVATAR_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-teal-600", "bg-orange-600",
  "bg-rose-600", "bg-emerald-600", "bg-indigo-600", "bg-amber-600",
];

function avatarColor(nombre: string) {
  const sum = nombre.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color = "text-white",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string | null;
  color?: string;
}) {
  return (
    <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-white/40 text-xs">
        <Icon className="w-3.5 h-3.5" />
        <span className="uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/35">{sub}</p>}
    </div>
  );
}

// ─── KPI Progress Bar ─────────────────────────────────────────────────────────

function ProgressBar({ label, value, total, color = "bg-blue-500" }: {
  label: string; value: number; total: number; color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span>{value}/{total} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Pestaña KPI ──────────────────────────────────────────────────────────────

function TabKPI({ empId }: { empId: number }) {
  const { data: kpi, isLoading, isError } = useQuery<KpiData>({
    queryKey: ["employee-kpi", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/kpi`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-white/40">Calculando KPI…</span>
      </div>
    );
  }
  if (isError || !kpi) {
    return (
      <div className="text-center py-16 text-white/30 text-sm">
        No se pudo cargar el KPI. Intente nuevamente.
      </div>
    );
  }

  if (!kpi.tieneDatos) {
    return (
      <div className="space-y-4">
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-6 text-center">
          <Activity className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/50 text-sm font-medium">Sin actividad trazable en el período</p>
          <p className="text-white/25 text-xs mt-1">{kpi.periodo}</p>
          <p className="text-white/20 text-xs mt-3">
            Los KPI se alimentan automáticamente desde Tareas, Anticipos e Incidencias
            una vez que el colaborador registre actividad en el sistema.
          </p>
        </div>
        {/* Mostrar métricas en 0 igualmente */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={CheckSquare} label="Tareas asignadas" value={0} color="text-white/40" />
          <KpiCard icon={TrendingUp} label="Completadas" value={0} color="text-white/40" />
          <KpiCard icon={Wallet} label="Anticipos" value={0} color="text-white/40" />
          <KpiCard icon={AlertTriangle} label="Incidencias" value={0} color="text-white/40" />
          <KpiCard icon={Zap} label="Emergencias" value={0} color="text-white/40" />
          <KpiCard icon={Shield} label="Asignaciones activas" value={kpi.asignaciones.activas} color="text-white/40" />
        </div>
      </div>
    );
  }

  const tasaCompletadas = kpi.tareas.asignadas > 0
    ? Math.round((kpi.tareas.completadas / kpi.tareas.asignadas) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Período */}
      <div className="flex items-center gap-2 text-xs text-white/35">
        <Clock className="w-3.5 h-3.5" />
        <span>Métricas de los {kpi.periodo}</span>
        {kpi.ultimaActividad && (
          <span className="text-white/25">· última actividad {fmtRelativa(kpi.ultimaActividad)}</span>
        )}
      </div>

      {/* Tarjetas principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          icon={CheckSquare}
          label="Tareas asignadas"
          value={kpi.tareas.asignadas}
          sub={kpi.tareas.ultimaTarea ? `última: ${fmtRelativa(kpi.tareas.ultimaTarea)}` : null}
          color="text-blue-400"
        />
        <KpiCard
          icon={TrendingUp}
          label="Completadas"
          value={kpi.tareas.completadas}
          sub={`${tasaCompletadas}% de tasa`}
          color={tasaCompletadas >= 70 ? "text-green-400" : tasaCompletadas >= 40 ? "text-yellow-400" : "text-red-400"}
        />
        <KpiCard
          icon={Wallet}
          label="Anticipos solicitados"
          value={kpi.anticipos.solicitados}
          sub={kpi.anticipos.montoTotal > 0 ? `Total: ${fmtQ(kpi.anticipos.montoTotal)}` : null}
          color="text-yellow-400"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Incidencias relacionadas"
          value={kpi.incidencias.relacionadas}
          sub={kpi.incidencias.ultimaIncidencia ? fmtRelativa(kpi.incidencias.ultimaIncidencia) : null}
          color={kpi.incidencias.relacionadas > 5 ? "text-red-400" : "text-orange-400"}
        />
        <KpiCard
          icon={Zap}
          label="Emergencias reportadas"
          value={kpi.emergencias.reportadas}
          sub={kpi.emergencias.ultimaEmergencia ? fmtRelativa(kpi.emergencias.ultimaEmergencia) : null}
          color={kpi.emergencias.reportadas > 0 ? "text-rose-400" : "text-white/40"}
        />
        <KpiCard
          icon={Shield}
          label="Asignaciones activas"
          value={kpi.asignaciones.activas}
          sub={`de ${kpi.asignaciones.total} total`}
          color="text-teal-400"
        />
      </div>

      {/* Desglose tareas */}
      {kpi.tareas.asignadas > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-3">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-widest">Desglose de tareas</p>
          <ProgressBar
            label="Completadas"
            value={kpi.tareas.completadas}
            total={kpi.tareas.asignadas}
            color="bg-green-500"
          />
          <ProgressBar
            label="En proceso"
            value={kpi.tareas.enProceso}
            total={kpi.tareas.asignadas}
            color="bg-blue-500"
          />
          <ProgressBar
            label="Pendientes"
            value={kpi.tareas.pendientes}
            total={kpi.tareas.asignadas}
            color="bg-yellow-500"
          />
        </div>
      )}

      {/* Anticipos desglose */}
      {kpi.anticipos.solicitados > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-3">Anticipos en el período</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-yellow-400">{kpi.anticipos.solicitados}</p>
              <p className="text-[10px] text-white/35">Solicitados</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-400">{kpi.anticipos.aprobados}</p>
              <p className="text-[10px] text-white/35">Aprobados</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white/60">{kpi.anticipos.pendientes}</p>
              <p className="text-[10px] text-white/35">Pendientes</p>
            </div>
          </div>
        </div>
      )}

      {/* Nota de alimentación */}
      <p className="text-[11px] text-white/20 border-t border-white/5 pt-3">
        KPI individual alimentado desde: Tareas (vía asignación de usuario) · Anticipos (FK directa) · Incidencias (por nombre de responsable) · Emergencias (incidencias críticas) · Asignaciones operativas
      </p>
    </div>
  );
}

// ─── Pestaña Asignaciones ─────────────────────────────────────────────────────

function TabAsignaciones({ empId }: { empId: number }) {
  const { data: asignaciones = [], isLoading } = useQuery<Asignacion[]>({
    queryKey: ["employee-asignaciones", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/asignaciones`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!asignaciones.length) {
    return (
      <div className="text-center py-14">
        <Briefcase className="w-8 h-8 text-white/10 mx-auto mb-3" />
        <p className="text-white/30 text-sm">Sin asignaciones registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {asignaciones.map((a) => (
        <div
          key={a.id}
          className={`border rounded-xl p-4 ${
            a.estado === "activo"
              ? "bg-teal-500/5 border-teal-500/20"
              : "bg-[#0c1929] border-white/8"
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold text-white">{a.puesto ?? "Agente de Seguridad"}</p>
              <p className="text-xs text-white/40">{a.servicio ?? "Seguridad General"}</p>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                a.estado === "activo"
                  ? "text-teal-400 bg-teal-400/10 border-teal-400/20"
                  : "text-gray-400 bg-gray-400/10 border-gray-400/20"
              }`}
            >
              {a.estado}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/40">
            {a.ubicacion && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{a.ubicacion}</span>
              </div>
            )}
            {a.cliente_id && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>Cliente: {a.cliente_id}</span>
              </div>
            )}
            {a.supervisor_nombre && (
              <div className="flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                <span>Sup: {a.supervisor_nombre}</span>
              </div>
            )}
            {a.fecha_inicio && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Desde: {fmtFecha(a.fecha_inicio)}</span>
              </div>
            )}
            {a.codigo_asignacion && (
              <div className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                <span>{a.codigo_asignacion}</span>
              </div>
            )}
          </div>
          {a.notas && (
            <p className="text-xs text-white/30 mt-2 border-t border-white/5 pt-2">{a.notas}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Pestaña Perfil ───────────────────────────────────────────────────────────

function TabPerfil({ emp }: { emp: Empleado }) {
  const rows = [
    { icon: Hash, label: "DPI", value: emp.dpi },
    { icon: Phone, label: "Teléfono", value: emp.telefono },
    { icon: Mail, label: "Correo", value: emp.correo },
    { icon: Briefcase, label: "Puesto", value: emp.puesto },
    { icon: Building2, label: "Área", value: emp.area },
    { icon: MapPin, label: "Sede", value: emp.sede },
    { icon: UserCheck, label: "Supervisor", value: emp.supervisorNombre },
    { icon: Calendar, label: "Fecha de ingreso", value: fmtFecha(emp.fechaIngreso) },
    { icon: Activity, label: "Fuente", value: emp.sourceSystem },
    { icon: BadgeCheck, label: "Estado sync", value: emp.syncStatus },
  ];

  return (
    <div className="space-y-1">
      {rows.map(({ icon: Icon, label, value }) => (
        value && value !== "—" ? (
          <div key={label} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
            <Icon className="w-3.5 h-3.5 text-white/25 shrink-0" />
            <span className="text-xs text-white/40 w-28 shrink-0">{label}</span>
            <span className="text-sm text-white/80 flex-1 text-right">{value}</span>
          </div>
        ) : null
      ))}
      {emp.notas && (
        <div className="bg-[#0c1929] border border-white/8 rounded-lg p-3 mt-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notas</p>
          <p className="text-xs text-white/60 leading-relaxed">{emp.notas}</p>
        </div>
      )}
    </div>
  );
}

// ─── Modal de Ficha ───────────────────────────────────────────────────────────

function FichaModal({ emp, onClose }: { emp: Empleado; onClose: () => void }) {
  const [tab, setTab] = useState<"perfil" | "asignaciones" | "kpi">("perfil");
  const est = ESTADO_LAB[emp.estadoLaboral] ?? { label: emp.estadoLaboral, color: "text-white/40 bg-white/5 border-white/10" };

  const tabs = [
    { key: "perfil",       label: "Perfil",        icon: UserCheck },
    { key: "asignaciones", label: "Asignaciones",   icon: Briefcase },
    { key: "kpi",          label: "KPI Individual", icon: BarChart2 },
  ] as const;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-8 overflow-auto">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-white/8">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0 ${avatarColor(emp.nombreCompleto)}`}>
            {iniciales(emp.nombreCompleto)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">{emp.nombreCompleto}</h2>
            <p className="text-xs text-white/50 mt-0.5">{emp.puesto ?? "Colaborador"} · {emp.area ?? "—"}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${est.color}`}>
                {est.label}
              </span>
              {emp.sede && (
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <MapPin className="w-3 h-3" />
                  {emp.sede}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white mt-0.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors flex-1 justify-center ${
                tab === key
                  ? "text-primary border-b-2 border-primary"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === "perfil" && <TabPerfil emp={emp} />}
          {tab === "asignaciones" && <TabAsignaciones empId={emp.id} />}
          {tab === "kpi" && <TabKPI empId={emp.id} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Tarjeta de Empleado ──────────────────────────────────────────────────────

function EmpleadoCard({ emp, onClick }: { emp: Empleado; onClick: () => void }) {
  const est = ESTADO_LAB[emp.estadoLaboral] ?? { label: emp.estadoLaboral, color: "text-white/40 bg-white/5 border-white/10" };
  return (
    <div
      onClick={onClick}
      className="bg-[#0c1929] border border-white/8 rounded-xl p-4 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(emp.nombreCompleto)}`}>
          {iniciales(emp.nombreCompleto)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
            {emp.nombreCompleto}
          </p>
          <p className="text-[11px] text-white/40 truncate">{emp.puesto ?? "Colaborador"}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary/60 transition-colors shrink-0" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${est.color}`}>
            {est.label}
          </span>
          {emp.area && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border text-white/40 bg-white/4 border-white/8">
              {emp.area}
            </span>
          )}
        </div>
        {emp.sede && (
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <MapPin className="w-2.5 h-2.5" />
            {emp.sede}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Empleados() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroArea, setFiltroArea] = useState<string>("todos");
  const [fichaAbierta, setFichaAbierta] = useState<Empleado | null>(null);

  const { data: empleados = [], isLoading, isError, refetch } = useQuery<Empleado[]>({
    queryKey: ["empleados"],
    queryFn: () => fetch(`${API_BASE}/employees`).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Áreas únicas para filtro
  const areas = Array.from(new Set(empleados.map((e) => e.area).filter(Boolean))) as string[];

  // Filtrado
  const filtrados = empleados.filter((e) => {
    if (filtroEstado !== "todos" && e.estadoLaboral !== filtroEstado) return false;
    if (filtroArea !== "todos" && e.area !== filtroArea) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        e.nombreCompleto.toLowerCase().includes(q) ||
        e.puesto?.toLowerCase().includes(q) ||
        e.area?.toLowerCase().includes(q) ||
        e.sede?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Estadísticas rápidas
  const total = empleados.length;
  const activos = empleados.filter((e) => e.estadoLaboral === "activo").length;
  const conAsignacion = empleados.filter((e) => e.sourceSystem !== "manual").length;

  return (
    <AdminLayout title="Colaboradores">
      <div className="space-y-5">

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 md:grid-cols-3 gap-3">
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{total}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Total colaboradores</p>
          </div>
          <div className="bg-[#0c1929] border border-green-500/15 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{activos}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Activos</p>
          </div>
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{areas.length}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Áreas</p>
          </div>
        </div>

        {/* Barra de búsqueda y filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Buscar por nombre, puesto, área…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-[#0c1929] border border-white/8 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-primary/40"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="licencia">Licencia</option>
            <option value="suspendido">Suspendido</option>
          </select>

          {areas.length > 0 && (
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer"
            >
              <option value="todos">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-[#0c1929] border border-white/8 text-white/40 hover:text-white transition-colors"
            title="Actualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Contador */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">
            {filtrados.length} colaborador{filtrados.length !== 1 ? "es" : ""} mostrado{filtrados.length !== 1 ? "s" : ""}
            {(filtroEstado !== "todos" || filtroArea !== "todos" || busqueda) && " (filtrado)"}
          </p>
          <p className="text-[10px] text-white/20">Clic en un colaborador para ver su ficha y KPI</p>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-red-400/70 text-sm">
            Error al cargar colaboradores. Recarga la página.
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No se encontraron colaboradores</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtrados.map((emp) => (
              <EmpleadoCard key={emp.id} emp={emp} onClick={() => setFichaAbierta(emp)} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de ficha */}
      {fichaAbierta && (
        <FichaModal emp={fichaAbierta} onClose={() => setFichaAbierta(null)} />
      )}
    </AdminLayout>
  );
}
