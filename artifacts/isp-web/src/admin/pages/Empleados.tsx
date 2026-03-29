import { useState, useEffect, type ElementType } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Users, Search, X, Loader2, RefreshCw,
  Building2, MapPin, Phone, Mail, Calendar, Hash,
  Shield, Briefcase, BarChart2, CheckSquare, Wallet,
  AlertTriangle, Zap, Activity, Clock, TrendingUp,
  UserCheck, BadgeCheck, Plus, Pencil, LayoutList,
  LayoutGrid, ChevronDown, UserX, UserCheck2, MessageSquare,
  Link2, Unlink, Lock, Save, Banknote, MessageCircle, XCircle,
  TrendingDown, Minus, ShieldAlert, ShieldCheck, ShieldOff,
  ArrowUpRight, ArrowDownRight, Repeat2, ArrowLeftRight, MapPinned, Map, History,
  UserCog,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Empleado {
  id: number;
  nombreCompleto: string;
  dpi: string | null;
  telefono: string | null;
  telefonoSecundario: string | null;
  correo: string | null;
  puesto: string | null;
  tipoServicio: string | null;
  area: string | null;
  estadoLaboral: string;
  sede: string | null;
  supervisorNombre: string | null;
  supervisorId: number | null;
  clienteId: number | null;
  waAutorizado: boolean;
  telefonoVerificadoAt: string | null;
  fechaIngreso: string | null;
  notas: string | null;
  sourceSystem: string;
  syncStatus: string;
  externalId: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  // Datos laborales / nómina
  sueldoBase: string | null;
  tipoJornada: string | null;
  diaDescanso: string | null;
  horasContrato: number | null;
  limiteAnticipo: number | null;
  tipoLimitePeriodo: string | null;
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

interface UserVinculado {
  id: number;
  nombre: string;
  username: string;
  correo: string | null;
  rol: string;
  estado: string;
  telefono: string | null;
  created_at: string;
}

interface PuestoTitular {
  id: number;
  puesto_nombre: string;
  cliente_nombre: string;
  turno: string | null;
  horario: string | null;
  jornada: string | null;
  estado_puesto: string;
  agente_id: number | null;
  agente_nombre: string | null;
  sede_nombre: string | null;
}

interface HistorialRelevo {
  fecha_hora: string;
  cliente_nombre: string;
  puesto_nombre: string;
  tipo: string;
  motivo: string | null;
  agente_saliente_nombre: string | null;
}

interface OperacionData {
  tareas: {
    id: string; titulo: string; estado: string; prioridad: string;
    fecha_vencimiento: string | null; created_at: string;
  }[];
  incidencias: {
    id: string; tipo: string; cliente: string; estado: string;
    prioridad: string; es_emergencia: boolean; created_at: string;
  }[];
  anticipos: {
    id: number; cantidad: number; estado: string;
    periodo: string | null; fecha_solicitud: string; origen: string;
  }[];
  puestoTitular: PuestoTitular | null;
  historialRelevos: HistorialRelevo[];
}

interface EventoKPIFront {
  id: number;
  tipoEvento: string;
  fecha: string;
  estado: string;
  anulado: boolean;
  clienteNombre: string | null;
  puestoNombre: string | null;
  observaciones: string | null;
}

interface KPIDisciplinario {
  score: number;
  clasificacion: "excelente" | "regular" | "riesgo";
  nivelRiesgo: "bajo" | "medio" | "alto";
  totalFaltas: number;
  totalSuspensiones: number;
  faltas30d: number;
  faltas90d: number;
  suspensiones90d: number;
  tendencia: "sube" | "baja" | "estable";
  alertas: string[];
  eventos: EventoKPIFront[];
}

interface MovimientoRotacion {
  id: number;
  tipo: string;
  rol: "entrante" | "saliente";
  clienteNombre: string | null;
  puestoNombre: string | null;
  contraparte: string | null;
  fechaHora: string;
}

interface KPIRotacion {
  score: number;
  nivel: "bajo" | "medio" | "alto";
  totalMovimientos: number;
  totalSalidas: number;
  totalEntradas: number;
  sustituciones: number;
  puestosDistintos: number;
  clientesDistintos: number;
  movimientos90d: number;
  movimientosPrev90d: number;
  tendencia: "sube" | "baja" | "estable";
  ultimoMovimiento: string | null;
  alertas: string[];
  historial: MovimientoRotacion[];
}

interface FormState {
  nombreCompleto: string;
  dpi: string;
  telefono: string;
  telefonoSecundario: string;
  correo: string;
  area: string;
  estadoLaboral: string;
  fechaIngreso: string;
  notas: string;
  // Datos laborales / nómina
  sueldoBase: string;
  tipoJornada: string;
  diaDescanso: string;
  horasContrato: string;
  limiteAnticipo: string;
  tipoLimitePeriodo: string;
}

interface AsignacionOperativa {
  id?: number;
  sin_asignacion?: boolean;
  tipo_asignacion: string;
  puesto_id: number | null;
  sede_id: number | null;
  cliente_id: number | null;
  zona_operativa_id: number | null;
  tipo_turno_id: number | null;
  fecha_inicio: string | null;
  notas: string | null;
  // Derivados (solo lectura)
  puesto_nombre?: string | null;
  sede_nombre?: string | null;
  cliente_nombre?: string | null;
  zona_nombre?: string | null;
  turno_nombre?: string | null;
  turno_horas_trabajo?: number | null;
  turno_horas_descanso?: number | null;
  supervisor_id?: number | null;
  supervisor_nombre?: string | null;
  supervisor_telefono?: string | null;
  supervisor_puesto?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciales(nombre: string) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
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

function maskDpi(dpi: string | null): string {
  if (!dpi) return "—";
  if (dpi.length <= 4) return "****";
  return `****${dpi.slice(-4)}`;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_LAB: Record<string, { label: string; color: string; dot: string }> = {
  activo:     { label: "Activo",     color: "text-green-400 bg-green-400/10 border-green-400/20",   dot: "bg-green-400" },
  suspendido: { label: "Suspendido", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", dot: "bg-yellow-400" },
  baja:       { label: "Baja",       color: "text-red-400 bg-red-400/10 border-red-400/20",         dot: "bg-red-400" },
  licencia:   { label: "Licencia",   color: "text-blue-400 bg-blue-400/10 border-blue-400/20",      dot: "bg-blue-400" },
  inactivo:   { label: "Inactivo",   color: "text-gray-400 bg-gray-400/10 border-gray-400/20",      dot: "bg-gray-400" },
};

const AVATAR_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-teal-600", "bg-orange-600",
  "bg-rose-600", "bg-emerald-600", "bg-indigo-600", "bg-amber-600",
];

function avatarColor(nombre: string) {
  const sum = nombre.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const FORM_EMPTY: FormState = {
  nombreCompleto: "", dpi: "", telefono: "", telefonoSecundario: "",
  correo: "", area: "", estadoLaboral: "activo",
  fechaIngreso: "", notas: "",
  sueldoBase: "", tipoJornada: "", diaDescanso: "", horasContrato: "",
  limiteAnticipo: "", tipoLimitePeriodo: "quincenal",
};

// ─── Badges ───────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_LAB[estado] ?? { label: estado, color: "text-white/40 bg-white/5 border-white/10", dot: "bg-white/40" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
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

// ─── Tab: KPI ─────────────────────────────────────────────────────────────────

// ── Helpers visuales del KPI disciplinario ──────────────────────────────────

const CLASIFICACION_CFG = {
  excelente: { label: "Excelente", color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20",  icon: ShieldCheck },
  regular:   { label: "Regular",   color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", icon: ShieldAlert  },
  riesgo:    { label: "Riesgo",    color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20",       icon: ShieldOff    },
} as const;

const RIESGO_CFG = {
  bajo:  { label: "Bajo",  color: "text-green-400",  dot: "bg-green-400"  },
  medio: { label: "Medio", color: "text-yellow-400", dot: "bg-yellow-500" },
  alto:  { label: "Alto",  color: "text-red-400",    dot: "bg-red-400"    },
} as const;

const TENDENCIA_CFG = {
  sube:    { label: "Sube",    icon: ArrowUpRight,   color: "text-red-400"    },
  baja:    { label: "Baja",    icon: ArrowDownRight, color: "text-green-400"  },
  estable: { label: "Estable", icon: Minus,          color: "text-white/40"   },
} as const;

const TIPO_EVENTO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  falta:      { label: "Falta",      color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  suspension: { label: "Suspensión", color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20"       },
};

const ROTACION_NIVEL_CFG = {
  bajo:  { label: "Estable",    color: "text-green-400",  dot: "bg-green-400",  bg: "bg-green-400/10 border-green-400/20"  },
  medio: { label: "Moderada",   color: "text-yellow-400", dot: "bg-yellow-500", bg: "bg-yellow-400/10 border-yellow-400/20" },
  alto:  { label: "Alta",       color: "text-red-400",    dot: "bg-red-400",    bg: "bg-red-400/10 border-red-400/20"       },
} as const;

const ROL_MOV_CFG = {
  entrante: { label: "Asignado",   color: "text-teal-400",   bg: "bg-teal-400/10 border-teal-400/20"   },
  saliente: { label: "Removido",   color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
} as const;

// ─── Sección KPI de Rotación Operativa ────────────────────────────────────────

function SeccionRotacion({ empId }: { empId: number }) {
  const { data: rot, isLoading } = useQuery<KPIRotacion>({
    queryKey: ["employee-rotation", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/rotation`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-white/30 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando KPI de rotación…
      </div>
    );
  }
  if (!rot) return null;

  const nivelCfg = ROTACION_NIVEL_CFG[rot.nivel];
  const tendCfg  = TENDENCIA_CFG[rot.tendencia];
  const TendIcon = tendCfg.icon;

  return (
    <div className="space-y-4">
      {/* Separador */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/25 uppercase tracking-widest flex items-center gap-1.5">
          <Repeat2 className="w-3 h-3" /> KPI Rotación Operativa
        </span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      {/* Alertas */}
      {rot.alertas.length > 0 && (
        <div className="space-y-1.5">
          {rot.alertas.map((alerta, i) => (
            <div key={i} className="flex items-start gap-2 bg-orange-400/5 border border-orange-400/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300">{alerta}</p>
            </div>
          ))}
        </div>
      )}

      {/* Score estabilidad + Nivel de rotación */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 text-center ${nivelCfg.bg}`}>
          <Repeat2 className={`w-5 h-5 mx-auto mb-1 ${nivelCfg.color}`} />
          <p className={`text-3xl font-bold ${nivelCfg.color}`}>{rot.score}</p>
          <p className={`text-[10px] mt-0.5 font-semibold uppercase tracking-wider ${nivelCfg.color}`}>
            Estabilidad
          </p>
          <p className="text-[9px] text-white/25 mt-1">Score / 100</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
          <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-1.5 ${nivelCfg.dot}`} />
          <p className={`text-lg font-bold ${nivelCfg.color}`}>{nivelCfg.label}</p>
          <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">Rotación</p>
          <div className={`flex items-center justify-center gap-1 mt-2 text-[10px] ${tendCfg.color}`}>
            <TendIcon className="w-3 h-3" />
            <span>Tendencia: {tendCfg.label}</span>
          </div>
          {rot.ultimoMovimiento && (
            <p className="text-[9px] text-white/20 mt-1.5">
              Último mov.: {fmtRelativa(rot.ultimoMovimiento)}
            </p>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.totalMovimientos === 0 ? "text-white/30" : rot.totalMovimientos >= 5 ? "text-red-400" : "text-blue-400"}`}>
            {rot.totalMovimientos}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Movimientos totales</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.totalSalidas === 0 ? "text-white/30" : rot.totalSalidas >= 3 ? "text-red-400" : "text-orange-400"}`}>
            {rot.totalSalidas}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Salidas de puesto</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.sustituciones === 0 ? "text-white/30" : "text-teal-400"}`}>
            {rot.sustituciones}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Sustituciones</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.movimientos90d === 0 ? "text-white/30" : rot.movimientos90d >= 4 ? "text-red-400" : "text-yellow-400"}`}>
            {rot.movimientos90d}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Movim. · 90 días</p>
        </div>
      </div>

      {/* Cobertura */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <MapPinned className="w-3 h-3" /> Cobertura registrada
        </p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className={`text-xl font-bold ${rot.clientesDistintos >= 4 ? "text-red-400" : rot.clientesDistintos >= 3 ? "text-yellow-400" : "text-white/70"}`}>
              {rot.clientesDistintos}
            </p>
            <p className="text-[10px] text-white/30">Clientes distintos</p>
          </div>
          <div>
            <p className={`text-xl font-bold ${rot.puestosDistintos >= 5 ? "text-red-400" : rot.puestosDistintos >= 3 ? "text-yellow-400" : "text-white/70"}`}>
              {rot.puestosDistintos}
            </p>
            <p className="text-[10px] text-white/30">Puestos distintos</p>
          </div>
        </div>
      </div>

      {/* Historial de movimientos */}
      {rot.historial.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Historial de movimientos ({rot.totalMovimientos})
          </p>
          <div className="space-y-1.5">
            {rot.historial.map((mov) => {
              const rolCfg = ROL_MOV_CFG[mov.rol];
              return (
                <div key={mov.id} className={`rounded-lg px-3 py-2.5 border flex items-center gap-3 ${rolCfg.bg}`}>
                  <ArrowLeftRight className={`w-3.5 h-3.5 shrink-0 ${rolCfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${rolCfg.color}`}>
                        {rolCfg.label}
                      </span>
                      {mov.tipo === "sustitucion" && (
                        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 rounded px-1.5">SUSTITUCIóN</span>
                      )}
                      {mov.puestoNombre && (
                        <span className="text-[10px] text-white/40">{mov.puestoNombre}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {mov.clienteNombre && (
                        <span className="text-[10px] text-white/25">{mov.clienteNombre}</span>
                      )}
                      {mov.contraparte && (
                        <span className="text-[10px] text-white/20">↔ {mov.contraparte}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-white/25 shrink-0">
                    {new Date(mov.fechaHora).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              );
            })}
            {rot.totalMovimientos > 15 && (
              <p className="text-[10px] text-white/20 text-center pt-1">
                +{rot.totalMovimientos - 15} movimientos más en el historial
              </p>
            )}
          </div>
        </div>
      )}

      {rot.historial.length === 0 && (
        <div className="text-center py-4">
          <Repeat2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/25">Sin movimientos operativos registrados</p>
        </div>
      )}

      {/* Leyenda */}
      <p className="text-[10px] text-white/15 border-t border-white/5 pt-3 leading-relaxed">
        Score = 100 − (salidas × 15) − (sustituciones extra × 8) − (clientes extra × 10) − (puestos extra × 5) · Estable ≥ 80 · Moderada 60–79 · Alta &lt; 60
      </p>
    </div>
  );
}

// ─── Resumen de dimensiones KPI ────────────────────────────────────────────────

function ResumenDimensionesKPI({ empId }: { empId: number }) {
  const { data: disc } = useQuery<KPIDisciplinario>({
    queryKey: ["employee-disciplinary", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/disciplinary`).then((r) => r.json()),
    staleTime: 60_000,
  });
  const { data: rot } = useQuery<KPIRotacion>({
    queryKey: ["employee-rotation", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/rotation`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const dimDisc = disc
    ? { label: "Disciplinario", score: disc.score, nivel: CLASIFICACION_CFG[disc.clasificacion].label, color: CLASIFICACION_CFG[disc.clasificacion].color, icon: ShieldCheck }
    : null;
  const dimRot = rot
    ? { label: "Rotación", score: rot.score, nivel: ROTACION_NIVEL_CFG[rot.nivel].label, color: ROTACION_NIVEL_CFG[rot.nivel].color, icon: Repeat2 }
    : null;

  if (!dimDisc && !dimRot) return null;

  const dims = [dimDisc, dimRot].filter(Boolean) as NonNullable<typeof dimDisc>[];

  return (
    <div className="bg-[#0a1628] border border-white/8 rounded-xl p-4">
      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <BarChart2 className="w-3 h-3" /> Resumen de dimensiones KPI
      </p>
      <div className="grid grid-cols-2 gap-3">
        {dims.map((d) => {
          const Icon = d.icon;
          const pct = Math.max(0, Math.min(100, d.score));
          const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
          return (
            <div key={d.label} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${d.color}`} />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">{d.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-xl font-bold ${d.color}`}>{d.score}</p>
                <span className={`text-[10px] font-semibold ${d.color}`}>{d.nivel}</span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeccionDisciplinaria({ empId }: { empId: number }) {
  const { data: disc, isLoading } = useQuery<KPIDisciplinario>({
    queryKey: ["employee-disciplinary", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/disciplinary`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-white/30 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando KPI disciplinario…
      </div>
    );
  }
  if (!disc) return null;

  const cls  = CLASIFICACION_CFG[disc.clasificacion];
  const rsg  = RIESGO_CFG[disc.nivelRiesgo];
  const tend = TENDENCIA_CFG[disc.tendencia];
  const TendIcon = tend.icon;
  const ClsIcon  = cls.icon;

  return (
    <div className="space-y-4">
      {/* Separador */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/25 uppercase tracking-widest">KPI Disciplinario</span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      {/* Alertas automáticas */}
      {disc.alertas.length > 0 && (
        <div className="space-y-1.5">
          {disc.alertas.map((alerta, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{alerta}</p>
            </div>
          ))}
        </div>
      )}

      {/* Score + Nivel de riesgo */}
      <div className="grid grid-cols-2 gap-3">
        {/* Puntuación */}
        <div className={`rounded-xl border p-4 text-center ${cls.bg}`}>
          <ClsIcon className={`w-5 h-5 mx-auto mb-1 ${cls.color}`} />
          <p className={`text-3xl font-bold ${cls.color}`}>{disc.score}</p>
          <p className={`text-[10px] mt-0.5 font-semibold uppercase tracking-wider ${cls.color}`}>{cls.label}</p>
          <p className="text-[9px] text-white/25 mt-1">Puntuación / 100</p>
        </div>
        {/* Nivel de riesgo */}
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
          <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-1.5 ${rsg.dot}`} />
          <p className={`text-lg font-bold ${rsg.color}`}>{rsg.label}</p>
          <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">Nivel de riesgo</p>
          <div className={`flex items-center justify-center gap-1 mt-2 text-[10px] ${tend.color}`}>
            <TendIcon className="w-3 h-3" />
            <span>Tendencia: {tend.label}</span>
          </div>
        </div>
      </div>

      {/* Métricas disciplinarias */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{disc.totalFaltas}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Faltas totales</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{disc.totalSuspensiones}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Suspensiones</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${disc.faltas30d >= 3 ? "text-red-400" : disc.faltas30d >= 1 ? "text-yellow-400" : "text-white/30"}`}>
            {disc.faltas30d}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Faltas · 30 días</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${disc.faltas90d >= 5 ? "text-red-400" : disc.faltas90d >= 3 ? "text-yellow-400" : "text-white/30"}`}>
            {disc.faltas90d}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Faltas · 90 días</p>
        </div>
      </div>

      {/* Historial de eventos disciplinarios */}
      {disc.eventos.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Historial disciplinario ({disc.eventos.length})
          </p>
          <div className="space-y-1.5">
            {disc.eventos.slice(0, 10).map((ev) => {
              const cfg = TIPO_EVENTO_CFG[ev.tipoEvento] ?? { label: ev.tipoEvento, color: "text-white/50", bg: "bg-white/5 border-white/10" };
              return (
                <div key={ev.id} className={`rounded-lg px-3 py-2.5 border flex items-center gap-3 ${ev.anulado ? "opacity-40" : cfg.bg}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                      {ev.anulado && <span className="text-[10px] bg-white/5 border border-white/10 text-white/30 rounded px-1.5">ANULADO</span>}
                      {ev.puestoNombre && <span className="text-[10px] text-white/30">{ev.puestoNombre}</span>}
                    </div>
                    {ev.observaciones && (
                      <p className="text-[10px] text-white/30 mt-0.5 truncate">{ev.observaciones}</p>
                    )}
                  </div>
                  <p className="text-[10px] text-white/25 shrink-0">
                    {new Date(ev.fecha).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              );
            })}
            {disc.eventos.length > 10 && (
              <p className="text-[10px] text-white/20 text-center pt-1">
                +{disc.eventos.length - 10} eventos más en el historial
              </p>
            )}
          </div>
        </div>
      )}

      {disc.eventos.length === 0 && (
        <div className="text-center py-4">
          <ShieldCheck className="w-8 h-8 text-green-400/20 mx-auto mb-2" />
          <p className="text-xs text-white/25">Sin eventos disciplinarios registrados</p>
        </div>
      )}

      {/* Leyenda de cálculo */}
      <p className="text-[10px] text-white/15 border-t border-white/5 pt-3 leading-relaxed">
        Score = 100 − (faltas × 10) − (suspensiones × 20) · Excelente ≥ 90 · Regular 70–89 · Riesgo &lt; 70
      </p>
    </div>
  );
}

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
    return <div className="text-center py-16 text-white/30 text-sm">No se pudo cargar el KPI.</div>;
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
            una vez que el colaborador registre actividad.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={CheckSquare} label="Tareas asignadas" value={0} color="text-white/40" />
          <KpiCard icon={TrendingUp} label="Completadas" value={0} color="text-white/40" />
          <KpiCard icon={Wallet} label="Anticipos" value={0} color="text-white/40" />
          <KpiCard icon={AlertTriangle} label="Incidencias" value={0} color="text-white/40" />
          <KpiCard icon={Zap} label="Emergencias" value={0} color="text-white/40" />
          <KpiCard icon={Shield} label="Asignaciones activas" value={kpi.asignaciones.activas} color="text-white/40" />
        </div>
        <SeccionDisciplinaria empId={empId} />
        <SeccionRotacion empId={empId} />
        <ResumenDimensionesKPI empId={empId} />
      </div>
    );
  }

  const tasaCompletadas = kpi.tareas.asignadas > 0
    ? Math.round((kpi.tareas.completadas / kpi.tareas.asignadas) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-white/35">
        <Clock className="w-3.5 h-3.5" />
        <span>Métricas de los {kpi.periodo}</span>
        {kpi.ultimaActividad && (
          <span className="text-white/25">· última actividad {fmtRelativa(kpi.ultimaActividad)}</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard icon={CheckSquare} label="Tareas asignadas" value={kpi.tareas.asignadas}
          sub={kpi.tareas.ultimaTarea ? `última: ${fmtRelativa(kpi.tareas.ultimaTarea)}` : null}
          color="text-blue-400" />
        <KpiCard icon={TrendingUp} label="Completadas" value={kpi.tareas.completadas}
          sub={`${tasaCompletadas}% de tasa`}
          color={tasaCompletadas >= 70 ? "text-green-400" : tasaCompletadas >= 40 ? "text-yellow-400" : "text-red-400"} />
        <KpiCard icon={Wallet} label="Anticipos solicitados" value={kpi.anticipos.solicitados}
          sub={kpi.anticipos.montoTotal > 0 ? `Total: ${fmtQ(kpi.anticipos.montoTotal)}` : null}
          color="text-yellow-400" />
        <KpiCard icon={AlertTriangle} label="Incidencias relacionadas" value={kpi.incidencias.relacionadas}
          sub={kpi.incidencias.ultimaIncidencia ? fmtRelativa(kpi.incidencias.ultimaIncidencia) : null}
          color={kpi.incidencias.relacionadas > 5 ? "text-red-400" : "text-orange-400"} />
        <KpiCard icon={Zap} label="Emergencias reportadas" value={kpi.emergencias.reportadas}
          sub={kpi.emergencias.ultimaEmergencia ? fmtRelativa(kpi.emergencias.ultimaEmergencia) : null}
          color={kpi.emergencias.reportadas > 0 ? "text-rose-400" : "text-white/40"} />
        <KpiCard icon={Shield} label="Asignaciones activas" value={kpi.asignaciones.activas}
          sub={`de ${kpi.asignaciones.total} total`} color="text-teal-400" />
      </div>
      {kpi.tareas.asignadas > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-3">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-widest">Desglose de tareas</p>
          <ProgressBar label="Completadas" value={kpi.tareas.completadas} total={kpi.tareas.asignadas} color="bg-green-500" />
          <ProgressBar label="En proceso" value={kpi.tareas.enProceso} total={kpi.tareas.asignadas} color="bg-blue-500" />
          <ProgressBar label="Pendientes" value={kpi.tareas.pendientes} total={kpi.tareas.asignadas} color="bg-yellow-500" />
        </div>
      )}
      {kpi.anticipos.solicitados > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-3">Anticipos en el período</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-lg font-bold text-yellow-400">{kpi.anticipos.solicitados}</p><p className="text-[10px] text-white/35">Solicitados</p></div>
            <div><p className="text-lg font-bold text-green-400">{kpi.anticipos.aprobados}</p><p className="text-[10px] text-white/35">Aprobados</p></div>
            <div><p className="text-lg font-bold text-white/60">{kpi.anticipos.pendientes}</p><p className="text-[10px] text-white/35">Pendientes</p></div>
          </div>
        </div>
      )}
      <SeccionDisciplinaria empId={empId} />
      <SeccionRotacion empId={empId} />
      <ResumenDimensionesKPI empId={empId} />
      <p className="text-[11px] text-white/20 border-t border-white/5 pt-3">
        KPI alimentado desde: Tareas (vía usuario) · Anticipos (FK directa) · Incidencias (por nombre de responsable) · Movimientos operativos
      </p>
    </div>
  );
}

// ─── Tab: Asignaciones ────────────────────────────────────────────────────────

function TabAsignaciones({ empId }: { empId: number }) {
  const { data: asignaciones = [], isLoading } = useQuery<Asignacion[]>({
    queryKey: ["employee-asignaciones", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/asignaciones`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
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
        <div key={a.id} className={`border rounded-xl p-4 ${a.estado === "activo" ? "bg-teal-500/5 border-teal-500/20" : "bg-[#0c1929] border-white/8"}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold text-white">{a.puesto ?? "Agente de Seguridad"}</p>
              <p className="text-xs text-white/40">{a.servicio ?? "Seguridad General"}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${a.estado === "activo" ? "text-teal-400 bg-teal-400/10 border-teal-400/20" : "text-gray-400 bg-gray-400/10 border-gray-400/20"}`}>
              {a.estado}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/40">
            {a.ubicacion && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span>{a.ubicacion}</span></div>}
            {a.cliente_id && <div className="flex items-center gap-1"><Building2 className="w-3 h-3" /><span>Cliente: {a.cliente_id}</span></div>}
            {a.supervisor_nombre && <div className="flex items-center gap-1"><UserCheck className="w-3 h-3" /><span>Sup: {a.supervisor_nombre}</span></div>}
            {a.fecha_inicio && <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span>Desde: {fmtFecha(a.fecha_inicio)}</span></div>}
          </div>
          {a.notas && <p className="text-xs text-white/30 mt-2 border-t border-white/5 pt-2">{a.notas}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Perfil ──────────────────────────────────────────────────────────────

function TabPerfil({ emp }: { emp: Empleado }) {
  function Row({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string | null | undefined }) {
    if (!value || value === "—") return null;
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
        <Icon className="w-3.5 h-3.5 text-white/25 shrink-0" />
        <span className="text-xs text-white/40 w-36 shrink-0">{label}</span>
        <span className="text-sm text-white/80 flex-1 text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* A — Datos personales */}
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Datos personales</p>
        <div className="space-y-0">
          <Row icon={Hash}      label="DPI"                value={emp.dpi ? maskDpi(emp.dpi) : null} />
          <Row icon={Phone}     label="Teléfono principal" value={emp.telefono} />
          <Row icon={Phone}     label="Teléfono secundario" value={emp.telefonoSecundario} />
          <Row icon={Mail}      label="Correo"             value={emp.correo} />
          <Row icon={MessageSquare} label="WhatsApp"       value={emp.waAutorizado ? "Autorizado" : null} />
          <Row icon={Building2} label="Área / Depto."      value={emp.area} />
          <Row icon={Calendar}  label="Fecha de ingreso"   value={fmtFecha(emp.fechaIngreso)} />
        </div>
      </div>

      {/* B — Datos laborales */}
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Datos laborales</p>
        <div className="grid grid-cols-2 gap-2">
          {emp.sueldoBase && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Sueldo base</p>
              <p className="text-sm font-semibold text-white">Q{Number(emp.sueldoBase).toLocaleString("es-GT")}</p>
            </div>
          )}
          {emp.horasContrato && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Horas / semana</p>
              <p className="text-sm font-semibold text-white">{emp.horasContrato} h</p>
            </div>
          )}
          {emp.tipoJornada && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Tipo de jornada</p>
              <p className="text-sm text-white/80 capitalize">{emp.tipoJornada}</p>
            </div>
          )}
          {emp.diaDescanso && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Día de descanso</p>
              <p className="text-sm text-white/80 capitalize">{emp.diaDescanso}</p>
            </div>
          )}
        </div>
      </div>

      {/* C — Indicación a tab Asignación */}
      <div className="bg-[#0c1929] border border-primary/10 rounded-xl p-3 flex items-center gap-3">
        <MapPinned className="w-4 h-4 text-primary/50 shrink-0" />
        <p className="text-xs text-white/40">
          Cliente, puesto, sede, zona y supervisor — ver tab <span className="text-primary font-medium">Asignación</span>
        </p>
      </div>

      {/* D — Notas */}
      {emp.notas && (
        <div className="bg-[#0c1929] border border-white/8 rounded-lg p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notas internas</p>
          <p className="text-xs text-white/60 leading-relaxed">{emp.notas}</p>
        </div>
      )}
    </div>
  );
}

// ─── Áreas internas que requieren usuario obligatorio ────────────────────────
const AREAS_INTERNAS = new Set([
  "administración", "administracion", "rrhh", "recursos humanos",
  "operaciones", "gerencia", "bodega", "comercial",
  "supervisión", "supervision", "facturación", "facturacion",
  "contabilidad", "compras", "sistemas", "legal",
]);

// ─── Modal rápido: Crear usuario para un colaborador ─────────────────────────
function ModalCrearUsuarioColaborador({ emp, onClose, onCreated }: {
  emp: Empleado;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    nombre: emp.nombreCompleto,
    username: emp.nombreCompleto.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "").slice(0, 30),
    password: "", confirmPassword: "",
    rol: emp.area?.toLowerCase().includes("supervisor") ? "supervisor" as const
       : emp.area?.toLowerCase().includes("rrhh") || emp.area?.toLowerCase().includes("recursos") ? "rrhh" as const
       : emp.area?.toLowerCase().includes("comercial") ? "comercial" as const
       : "operaciones" as const,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    if (form.password.length < 4) { setError("Contraseña mínimo 4 caracteres"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "" },
        body: JSON.stringify({ nombre: form.nombre, username: form.username, password: form.password, rol: form.rol, employeeId: emp.id, estado: "activo" }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Error al crear usuario"); }
      toast({ title: "Usuario creado", description: `${form.nombre} ya tiene acceso al sistema.` });
      qc.invalidateQueries({ queryKey: ["employee-user", emp.id] });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold text-white">Crear usuario del sistema</h3>
            <p className="text-[10px] text-white/40 mt-0.5">{emp.nombreCompleto}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50">Nombre completo</label>
            <input value={form.nombre} onChange={e => set("nombre", e.target.value)} required
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Username *</label>
              <input value={form.username} onChange={e => set("username", e.target.value.toLowerCase())} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50 font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Rol</label>
              <select value={form.rol} onChange={e => set("rol", e.target.value)}
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none">
                <option value="operaciones">Operaciones</option>
                <option value="rrhh">RRHH</option>
                <option value="comercial">Comercial</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
                <option value="guardia">Guardia</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Contraseña *</label>
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50" placeholder="Mínimo 4 car." />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Confirmar *</label>
              <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50" placeholder="Repita" />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 flex items-center gap-1"><span>⚠</span>{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 border border-white/10 text-white/60 rounded-md text-xs hover:text-white">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 h-9 bg-primary text-[#050d1a] font-bold rounded-md text-xs hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Tab: Sistema ─────────────────────────────────────────────────────────────

function TabSistema({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const [showCrearModal, setShowCrearModal] = useState(false);
  const { data: user, isLoading } = useQuery<UserVinculado | null>({
    queryKey: ["employee-user", emp.id],
    queryFn: () => fetch(`${API_BASE}/employees/${emp.id}/user`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const ROL_LABELS: Record<string, string> = {
    admin: "Administrador", operaciones: "Operaciones", rrhh: "RRHH",
    comercial: "Comercial", supervisor: "Supervisor", guardia: "Guardia", cliente: "Cliente",
  };

  const esAreaInterna = emp.area ? AREAS_INTERNAS.has(emp.area.toLowerCase()) : false;
  const requiereUsuario = esAreaInterna && emp.estadoLaboral === "activo";

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* IDs de sistema */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Identifiers</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Employee ID</span>
          <code className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">EMP-{emp.id}</code>
        </div>
        {emp.externalId && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">External ID</span>
            <code className="text-xs text-white/60 bg-white/5 px-2 py-0.5 rounded">{emp.externalId}</code>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Fuente</span>
          <span className="text-xs text-white/60">{emp.sourceSystem}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Sync status</span>
          <span className="text-xs text-white/60">{emp.syncStatus}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Actualizado</span>
          <span className="text-xs text-white/60">{fmtFecha(emp.updatedAt)}</span>
        </div>
      </div>

      {/* Usuario vinculado */}
      {/* Alerta: área interna sin usuario */}
      {requiereUsuario && !user && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-400">Inconsistencia: requiere usuario</p>
            <p className="text-[10px] text-amber-400/70 mt-1">
              Este colaborador está en el área <strong>{emp.area}</strong> — catalogada como interna obligatoria.
              Debe tener una cuenta de sistema activa.
            </p>
            <button
              onClick={() => setShowCrearModal(true)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg text-[11px] font-semibold hover:bg-amber-500/25 transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />
              Crear usuario ahora
            </button>
          </div>
        </div>
      )}

      {user ? (
        <div className="bg-[#0c1929] border border-green-500/15 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-green-400" />
              <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">Usuario vinculado</p>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
              user.estado === "activo"
                ? "text-green-400 bg-green-400/10 border-green-400/20"
                : "text-red-400 bg-red-400/10 border-red-400/20"
            }`}>{user.estado.toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Nombre</span>
            <span className="text-sm text-white/80">{user.nombre}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Username</span>
            <code className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">@{user.username}</code>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Rol</span>
            <span className="text-xs text-white/70">{ROL_LABELS[user.rol] ?? user.rol}</span>
          </div>
          {user.correo && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/40">Correo</span>
              <span className="text-xs text-white/60">{user.correo}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Cuenta creada</span>
            <span className="text-xs text-white/40">{fmtFecha(user.created_at)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-5 text-center">
          <Unlink className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm font-medium">Sin cuenta de sistema</p>
          {!requiereUsuario && (
            <p className="text-white/20 text-xs mt-1">
              Este colaborador no requiere usuario obligatorio según su área.
            </p>
          )}
          {!requiereUsuario && (
            <button
              onClick={() => setShowCrearModal(true)}
              className="mt-3 mx-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 rounded-lg text-xs hover:text-white hover:bg-white/8 transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />Crear usuario
            </button>
          )}
        </div>
      )}

      {/* Modal crear usuario */}
      {showCrearModal && (
        <ModalCrearUsuarioColaborador
          emp={emp}
          onClose={() => setShowCrearModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["employee-user", emp.id] })}
        />
      )}

      {/* Permisos WA */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">WhatsApp</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Número autorizado</span>
          <span className={`text-xs font-semibold ${emp.waAutorizado ? "text-green-400" : "text-white/30"}`}>
            {emp.waAutorizado ? "Sí" : "No"}
          </span>
        </div>
        {emp.telefonoVerificadoAt && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Verificado</span>
            <span className="text-xs text-white/60">{fmtFecha(emp.telefonoVerificadoAt)}</span>
          </div>
        )}
        {emp.telefonoSecundario && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Tel. secundario</span>
            <span className="text-xs text-white/60">{emp.telefonoSecundario}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Operación ───────────────────────────────────────────────────────────

interface ZonaBasic {
  id: number;
  nombre: string;
  descripcion: string | null;
  total_puestos: number;
  total_clientes: number;
  estado: string;
}

function TabOperacion({ empId }: { empId: number }) {
  const { data, isLoading } = useQuery<OperacionData>({
    queryKey: ["employee-operacion", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/operacion`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: todasZonas = [] } = useQuery<ZonaBasic[]>({
    queryKey: ["zonas-all"],
    queryFn: () => fetch(`${API_BASE}/operaciones/zonas`).then((r) => r.json()),
    staleTime: 120_000,
  });

  const zonasSupervisa = (Array.isArray(todasZonas) ? todasZonas : []).filter(
    (z: any) => z.supervisor_employee_id === empId
  ) as ZonaBasic[];

  const ESTADO_TAREA: Record<string, string> = {
    pendiente: "text-yellow-400", en_proceso: "text-blue-400",
    completada: "text-green-400", cancelada: "text-gray-400",
  };
  const ESTADO_INC: Record<string, string> = {
    abierta: "text-yellow-400", en_proceso: "text-blue-400",
    cerrada: "text-green-400", resuelta: "text-green-400",
  };
  const ESTADO_ANT: Record<string, string> = {
    pendiente: "text-yellow-400", aprobada: "text-green-400",
    rechazada: "text-red-400", pagada: "text-teal-400",
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }
  if (!data) {
    return <div className="text-center py-10 text-white/30 text-sm">Error al cargar actividad operativa.</div>;
  }

  const hayActividad = data.tareas.length > 0 || data.incidencias.length > 0 || data.anticipos.length > 0;

  return (
    <div className="space-y-5">

      {/* ── Asignación Titular ───────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> Asignación operativa base
        </p>
        {data.puestoTitular ? (
          <div className={`border rounded-xl p-4 ${
            data.puestoTitular.agente_id ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"
          }`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{data.puestoTitular.puesto_nombre}</p>
                <p className="text-xs text-white/40">{data.puestoTitular.cliente_nombre}</p>
                {data.puestoTitular.sede_nombre && (
                  <p className="text-[11px] text-white/30 mt-0.5">Sede: {data.puestoTitular.sede_nombre}</p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${
                data.puestoTitular.agente_id
                  ? "text-green-400 bg-green-400/10 border-green-400/20"
                  : "text-amber-400 bg-amber-400/10 border-amber-400/20"
              }`}>
                {data.puestoTitular.agente_id ? "Cubierto" : "Descubierto hoy"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {data.puestoTitular.turno && (
                <div className="bg-white/4 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-white/30 text-[9px] uppercase">Turno</p>
                  <p className="text-white/70 font-semibold">{data.puestoTitular.turno}</p>
                </div>
              )}
              {data.puestoTitular.jornada && (
                <div className="bg-white/4 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-white/30 text-[9px] uppercase">Jornada</p>
                  <p className="text-white/70 font-semibold">{data.puestoTitular.jornada}</p>
                </div>
              )}
              {data.puestoTitular.horario && (
                <div className="bg-white/4 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-white/30 text-[9px] uppercase">Horario</p>
                  <p className="text-white/70 font-semibold">{data.puestoTitular.horario}</p>
                </div>
              )}
            </div>
            {data.puestoTitular.agente_id && data.puestoTitular.agente_id !== empId && (
              <div className="mt-2 text-[10px] text-amber-300/60 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Cubierto por relevo hoy: {data.puestoTitular.agente_nombre}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
            <Shield className="w-6 h-6 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/30">Sin asignación titular en el pizarrón operativo</p>
          </div>
        )}
      </div>

      {/* ── Zonas bajo supervisión ──────────────────────────────────────── */}
      {zonasSupervisa.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Map className="w-3 h-3" /> Zonas operativas supervisadas
          </p>
          <div className="space-y-1.5">
            {zonasSupervisa.map((z) => (
              <div key={z.id} className="bg-[#0c1929] border border-primary/10 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Map className="w-3 h-3 text-primary/40 shrink-0" />
                    <p className="text-xs font-semibold text-white/80">{z.nombre}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/30">
                    <span>{z.total_puestos} puestos</span>
                    {z.total_clientes > 0 && <span>· {z.total_clientes} clientes</span>}
                  </div>
                </div>
                {z.descripcion && (
                  <p className="text-[10px] text-white/25 mt-1 ml-5">{z.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Historial de Relevos ─────────────────────────────────────────── */}
      {data.historialRelevos.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <ArrowLeftRight className="w-3 h-3" /> Relevos realizados (últimos 5)
          </p>
          <div className="space-y-1.5">
            {data.historialRelevos.map((r, i) => (
              <div key={i} className="bg-[#0c1929] border border-white/6 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-white/60 truncate">{r.cliente_nombre} · {r.puesto_nombre}</p>
                  <span className="text-[10px] text-amber-400/60 shrink-0">{new Date(r.fecha_hora).toLocaleDateString("es-GT")}</span>
                </div>
                {r.motivo && <p className="text-[10px] text-white/30 mt-0.5">Motivo: {r.motivo}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hayActividad && !data.puestoTitular && data.historialRelevos.length === 0 && (
        <div className="text-center py-14">
          <Activity className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">Sin actividad operativa registrada</p>
          <p className="text-white/15 text-xs mt-1">Las tareas, incidencias y anticipos aparecerán aquí.</p>
        </div>
      )}

      {/* Tareas */}
      {data.tareas.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <CheckSquare className="w-3 h-3" /> Tareas recientes ({data.tareas.length})
          </p>
          <div className="space-y-1.5">
            {data.tareas.map((t) => (
              <div key={t.id} className="bg-[#0c1929] border border-white/6 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <p className="text-xs text-white/70 truncate flex-1">{t.titulo}</p>
                <span className={`text-[10px] font-semibold shrink-0 ${ESTADO_TAREA[t.estado] ?? "text-white/30"}`}>
                  {t.estado.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incidencias */}
      {data.incidencias.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> Incidencias relacionadas ({data.incidencias.length})
          </p>
          <div className="space-y-1.5">
            {data.incidencias.map((i) => (
              <div key={i.id} className="bg-[#0c1929] border border-white/6 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {i.es_emergencia && <Zap className="w-3 h-3 text-rose-400 shrink-0" />}
                  <p className="text-xs text-white/70 truncate">{i.tipo} — {i.cliente}</p>
                </div>
                <span className={`text-[10px] font-semibold shrink-0 ${ESTADO_INC[i.estado] ?? "text-white/30"}`}>
                  {i.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anticipos */}
      {data.anticipos.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Wallet className="w-3 h-3" /> Anticipos ({data.anticipos.length})
          </p>
          <div className="space-y-1.5">
            {data.anticipos.map((a) => (
              <div key={a.id} className="bg-[#0c1929] border border-white/6 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-white/70">{fmtQ(a.cantidad)}</p>
                  {a.periodo && <span className="text-[10px] text-white/30">{a.periodo}</span>}
                </div>
                <span className={`text-[10px] font-semibold ${ESTADO_ANT[a.estado] ?? "text-white/30"}`}>
                  {a.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Anticipos ────────────────────────────────────────────────────────────

interface AnticipoDB {
  id: number;
  cantidad: number;
  estado: string;
  periodo: string | null;
  origen: string;
  fechaSolicitud: string;
  observaciones: string | null;
}

interface AnticiposEmpleadoData {
  config: {
    limiteAnticipo: number | null;
    tipoLimitePeriodo: string;
    ultimaActualizacionLimiteAt: string | null;
  };
  periodoActual: {
    limite: number | null;
    solicitado: number;
    restante: number | null;
    tieneLimite: boolean;
    periodo: string | null;
  };
  historial: AnticipoDB[];
}

const ESTADO_ANT_COLOR: Record<string, string> = {
  pendiente: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  aprobada:  "text-green-400 bg-green-400/10 border-green-400/20",
  rechazada: "text-red-400 bg-red-400/10 border-red-400/20",
  pagada:    "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

function TabAnticipo({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editandoLimite, setEditandoLimite] = useState(false);
  const [nuevoLimite, setNuevoLimite] = useState<string>("");
  const [guardandoLimite, setGuardandoLimite] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<AnticiposEmpleadoData>({
    queryKey: ["employee-anticipos", emp.id],
    queryFn: () => fetch(`${API_BASE}/employees/${emp.id}/anticipos`).then((r) => r.json()),
    staleTime: 30_000,
  });

  async function guardarLimite() {
    setGuardandoLimite(true);
    try {
      const valor = nuevoLimite.trim() === "" ? null : parseInt(nuevoLimite);
      if (valor !== null && (isNaN(valor) || valor < 0)) {
        toast({ title: "Error", description: "El límite debe ser un número positivo.", variant: "destructive" });
        return;
      }
      const r = await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limiteAnticipo: valor }),
      });
      if (!r.ok) throw new Error("Error");
      toast({ title: "Límite actualizado", description: valor === null ? "Sin límite configurado" : `Q${valor.toLocaleString("es-GT")}` });
      setEditandoLimite(false);
      qc.invalidateQueries({ queryKey: ["employee-anticipos", emp.id] });
      qc.invalidateQueries({ queryKey: ["empleados"] });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el límite.", variant: "destructive" });
    } finally {
      setGuardandoLimite(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }
  if (isError || !data) {
    return <div className="text-center py-10 text-white/30 text-sm">Error al cargar información de anticipos.</div>;
  }

  const { config, periodoActual, historial } = data;
  const pct = periodoActual.tieneLimite && periodoActual.limite
    ? Math.min(100, Math.round((periodoActual.solicitado / periodoActual.limite) * 100))
    : 0;

  return (
    <div className="space-y-5">

      {/* ── Configuración de límite ── */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            Configuración de anticipos
          </h3>
          {!editandoLimite && (
            <button
              onClick={() => { setNuevoLimite(config.limiteAnticipo?.toString() ?? ""); setEditandoLimite(true); }}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-primary transition-colors"
            >
              <Pencil className="w-3 h-3" /> Editar límite
            </button>
          )}
        </div>

        {editandoLimite ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-white/40 text-sm">Q</div>
            <input
              type="number"
              min="0"
              value={nuevoLimite}
              onChange={(e) => setNuevoLimite(e.target.value)}
              placeholder="Ej: 500 (vacío = sin límite)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={guardarLimite}
              disabled={guardandoLimite}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {guardandoLimite ? "..." : "Guardar"}
            </button>
            <button
              onClick={() => setEditandoLimite(false)}
              className="px-2 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/3 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary">
                {config.limiteAnticipo !== null ? `Q${config.limiteAnticipo.toLocaleString("es-GT")}` : "—"}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Límite autorizado</p>
            </div>
            <div className="bg-white/3 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-yellow-400">
                Q{periodoActual.solicitado.toLocaleString("es-GT")}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Solicitado en período</p>
            </div>
            <div className="bg-white/3 rounded-lg p-3 text-center">
              <p className={`text-lg font-bold ${
                !periodoActual.tieneLimite ? "text-white/30"
                : (periodoActual.restante ?? 0) > 0 ? "text-green-400" : "text-red-400"
              }`}>
                {!periodoActual.tieneLimite ? "∞"
                  : `Q${(periodoActual.restante ?? 0).toLocaleString("es-GT")}`}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Disponible</p>
            </div>
          </div>
        )}

        {periodoActual.tieneLimite && periodoActual.limite && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/40">
              <span>Uso del período</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-white/8 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {periodoActual.periodo && (
              <p className="text-[10px] text-white/25">Período activo: {periodoActual.periodo.replace("-dia", " — día ")}</p>
            )}
          </div>
        )}

        {config.ultimaActualizacionLimiteAt && (
          <p className="text-[10px] text-white/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Límite actualizado: {new Date(config.ultimaActualizacionLimiteAt).toLocaleDateString("es-GT")}
          </p>
        )}
      </div>

      {/* ── Historial ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Historial de anticipos ({historial.length})
          </h3>
          <button onClick={() => refetch()} className="text-white/20 hover:text-white/60 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {historial.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/25">Sin anticipos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historial.map((a) => (
              <div key={a.id} className="bg-[#0c1929] border border-white/6 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white">Q{a.cantidad.toLocaleString("es-GT")}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${ESTADO_ANT_COLOR[a.estado] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                      {a.estado}
                    </span>
                    {a.origen === "whatsapp" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
                        <MessageCircle className="w-2.5 h-2.5" /> WA
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/20">Manual</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-white/30">
                      {new Date(a.fechaSolicitud).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {a.periodo && <span className="text-[10px] text-white/20 font-mono">{a.periodo.replace("-dia", " día")}</span>}
                  </div>
                  {a.observaciones && (
                    <p className="text-[10px] text-white/25 mt-0.5 truncate">{a.observaciones}</p>
                  )}
                </div>
                <p className="text-xs font-mono text-white/20 shrink-0">ANT-{a.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Asignación Operativa ────────────────────────────────────────────────

const TIPO_ASIG_CFG: Record<string, { label: string; color: string; bg: string }> = {
  titular:       { label: "Titular",         color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
  disponible:    { label: "Disponible",       color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20" },
  pool_relevo:   { label: "Pool de relevos",  color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  sin_asignacion:{ label: "Sin asignación",   color: "text-white/40",   bg: "bg-white/5 border-white/10" },
};

interface PuestoBasic { id: number; nombre: string; cliente_nombre: string; sede_id: number | null; sede_nombre: string | null; zona_operativa_id: number | null; }
interface ZonaBasicEOA { id: number; nombre: string; supervisor_nombre: string | null; }
interface TurnoBasicEOA { id: number; nombre: string; horas_trabajo: number; horas_descanso: number; }

interface TitularHistorialRow {
  id: number;
  puesto_id: number;
  puesto_nombre: string;
  puesto_codigo?: string;
  cliente_nombre?: string;
  sede_nombre?: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo?: string;
  creado_por?: string;
}

function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function HistorialTitularEmp({ empId }: { empId: number }) {
  const getSession = () => sessionStorage.getItem("isp_admin_session_v2") ?? "";
  const [rows, setRows] = useState<TitularHistorialRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function load() {
    if (loaded) return;
    setLoaded(true);
    fetch(`${API_BASE}/employees/${empId}/titular-historico`, {
      headers: { "x-isp-session": getSession() },
    }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => {});
  }

  const activo = rows.find(r => !r.fecha_fin);
  const anteriores = rows.filter(r => r.fecha_fin);

  return (
    <div className="bg-[#0c1929] border border-white/6 rounded-xl overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/2 transition-colors"
        onClick={() => { setExpanded(e => !e); load(); }}
      >
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-semibold text-white/60">Historial de titularidad</span>
          {activo && <span className="text-[10px] text-green-400/70 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">titular activo</span>}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-white/6 divide-y divide-white/4">
          {rows.length === 0 && (
            <p className="px-4 py-3 text-xs text-white/30 text-center">Sin historial de titularidad registrado</p>
          )}
          {activo && (
            <div className="px-4 py-3 bg-green-500/5">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{activo.puesto_nombre}</p>
                  {activo.cliente_nombre && <p className="text-[10px] text-white/40 truncate">{activo.cliente_nombre}{activo.sede_nombre ? ` · ${activo.sede_nombre}` : ""}</p>}
                  <p className="text-[10px] text-green-400/60 mt-0.5">Titular desde {fmtFechaCorta(activo.fecha_inicio)}</p>
                  {activo.motivo && <p className="text-[10px] text-white/25 mt-0.5 capitalize">{activo.motivo.replace(/_/g, " ")}</p>}
                </div>
              </div>
            </div>
          )}
          {anteriores.map(r => (
            <div key={r.id} className="px-4 py-2.5">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white/15 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60 truncate">{r.puesto_nombre}</p>
                  {r.cliente_nombre && <p className="text-[10px] text-white/30 truncate">{r.cliente_nombre}{r.sede_nombre ? ` · ${r.sede_nombre}` : ""}</p>}
                  <p className="text-[10px] text-white/25 mt-0.5">{fmtFechaCorta(r.fecha_inicio)} → {fmtFechaCorta(r.fecha_fin)}</p>
                  {r.motivo && <p className="text-[10px] text-white/20 mt-0.5 capitalize">{r.motivo.replace(/_/g, " ")}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabAsignacionOperativa({ empId }: { empId: number }) {
  const getSession = () => sessionStorage.getItem("isp_admin_session_v2") ?? "";
  const h = () => ({ "Content-Type": "application/json", "x-isp-session": getSession() });

  const [asig, setAsig] = useState<AsignacionOperativa | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Catálogos para el formulario
  const [puestos, setPuestos] = useState<PuestoBasic[]>([]);
  const [zonas, setZonas] = useState<ZonaBasicEOA[]>([]);
  const [turnos, setTurnos] = useState<TurnoBasicEOA[]>([]);
  const [formAsig, setFormAsig] = useState<{
    tipo_asignacion: string; puesto_id: string; sede_id: string;
    zona_operativa_id: string; tipo_turno_id: string; notas: string;
  }>({ tipo_asignacion: "sin_asignacion", puesto_id: "", sede_id: "", zona_operativa_id: "", tipo_turno_id: "", notas: "" });

  function loadAsig() {
    setLoading(true);
    fetch(`${API_BASE}/employees/${empId}/asignacion-operativa`, { headers: h() })
      .then((r) => r.json())
      .then((d) => { setAsig(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadAsig();
    // Catálogos
    fetch(`${API_BASE}/operaciones/todos-puestos`, { headers: h() }).then((r) => r.ok ? r.json() : []).then(setPuestos).catch(() => {});
    fetch(`${API_BASE}/operaciones/zonas`, { headers: h() }).then((r) => r.ok ? r.json() : []).then(setZonas).catch(() => {});
    fetch(`${API_BASE}/turnos`, { headers: h() }).then((r) => r.ok ? r.json() : []).then((d) => setTurnos((d ?? []).filter((t: any) => t.activo))).catch(() => {});
  }, [empId]);

  function openEdit() {
    setFormAsig({
      tipo_asignacion: asig?.tipo_asignacion ?? "sin_asignacion",
      puesto_id: asig?.puesto_id ? String(asig.puesto_id) : "",
      sede_id: asig?.sede_id ? String(asig.sede_id) : "",
      zona_operativa_id: asig?.zona_operativa_id ? String(asig.zona_operativa_id) : "",
      tipo_turno_id: asig?.tipo_turno_id ? String(asig.tipo_turno_id) : "",
      notas: asig?.notas ?? "",
    });
    setSaveErr(""); setEditOpen(true);
  }

  async function saveAsig() {
    setSaving(true); setSaveErr("");
    try {
      const r = await fetch(`${API_BASE}/employees/${empId}/asignacion-operativa`, {
        method: "PUT",
        headers: h(),
        body: JSON.stringify({
          tipo_asignacion: formAsig.tipo_asignacion,
          puesto_id: formAsig.puesto_id ? Number(formAsig.puesto_id) : null,
          sede_id: formAsig.sede_id ? Number(formAsig.sede_id) : null,
          zona_operativa_id: formAsig.zona_operativa_id ? Number(formAsig.zona_operativa_id) : null,
          tipo_turno_id: formAsig.tipo_turno_id ? Number(formAsig.tipo_turno_id) : null,
          notas: formAsig.notas || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setEditOpen(false); loadAsig();
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  }

  const sel = (key: string, v: string) => setFormAsig((p) => ({ ...p, [key]: v }));
  const selCls = "w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50";

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const cfg = TIPO_ASIG_CFG[asig?.tipo_asignacion ?? "sin_asignacion"] ?? TIPO_ASIG_CFG.sin_asignacion;
  const sinAsig = !asig || asig.sin_asignacion || asig.tipo_asignacion === "sin_asignacion";

  return (
    <div className="space-y-4">
      {/* Badge de tipo + botón editar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
          {asig?.fecha_inicio && (
            <span className="text-[10px] text-white/30">desde {fmtFecha(asig.fecha_inicio)}</span>
          )}
        </div>
        <button
          onClick={openEdit}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-primary bg-white/5 hover:bg-primary/10 border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Editar asignación
        </button>
      </div>

      {sinAsig ? (
        <div className="bg-[#0c1929] border border-white/6 rounded-xl p-5 text-center">
          <MapPinned className="w-8 h-8 text-white/15 mx-auto mb-2" />
          <p className="text-sm text-white/40">Sin asignación operativa registrada</p>
          <p className="text-xs text-white/25 mt-1">Use el botón "Editar asignación" para asignar un puesto, zona o turno a este colaborador.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Puesto */}
          {asig?.puesto_nombre && (
            <div className="bg-[#0c1929] border border-white/6 rounded-xl p-4">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Puesto titular</p>
              <p className="text-sm font-semibold text-white">{asig.puesto_nombre}</p>
              {asig.cliente_nombre && <p className="text-xs text-white/50 mt-0.5">{asig.cliente_nombre}</p>}
              {asig.sede_nombre && (
                <p className="flex items-center gap-1 text-xs text-white/35 mt-1">
                  <MapPin className="w-3 h-3" />{asig.sede_nombre}
                </p>
              )}
            </div>
          )}

          {/* Zona y Supervisor */}
          <div className="grid grid-cols-2 gap-3">
            {asig?.zona_nombre && (
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-4">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Zona operativa</p>
                <p className="text-sm text-white/80">{asig.zona_nombre}</p>
              </div>
            )}
            {asig?.supervisor_nombre && (
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-4">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Supervisor (derivado)</p>
                <p className="text-sm text-white/80">{asig.supervisor_nombre}</p>
                {asig.supervisor_telefono && (
                  <p className="flex items-center gap-1 text-xs text-white/35 mt-1">
                    <Phone className="w-3 h-3" />{asig.supervisor_telefono}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Turno de nómina */}
          {asig?.turno_nombre && (
            <div className="bg-[#0c1929] border border-primary/10 rounded-xl p-4">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Turno de nómina</p>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">{asig.turno_nombre}</span>
                {asig.turno_horas_trabajo && (
                  <span className="text-xs text-white/40">{asig.turno_horas_trabajo}h trabajo + {asig.turno_horas_descanso}h descanso</span>
                )}
              </div>
            </div>
          )}

          {/* Notas */}
          {asig?.notas && (
            <div className="bg-[#0c1929] border border-white/6 rounded-xl p-4">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notas</p>
              <p className="text-xs text-white/60">{asig.notas}</p>
            </div>
          )}
        </div>
      )}

      {/* Historial de titularidad */}
      <HistorialTitularEmp empId={empId} />

      {/* Modal de edición */}
      {editOpen && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h3 className="text-sm font-bold text-white">Editar asignación operativa</h3>
              <button onClick={() => setEditOpen(false)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {saveErr && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">{saveErr}</div>}

              {/* Tipo de asignación */}
              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">Tipo de asignación</label>
                <select value={formAsig.tipo_asignacion} onChange={(e) => sel("tipo_asignacion", e.target.value)} className={selCls}>
                  <option value="titular">Titular — puesto fijo asignado</option>
                  <option value="disponible">Disponible — sin puesto fijo actualmente</option>
                  <option value="pool_relevo">Pool de relevos — disponible para cobertura</option>
                  <option value="sin_asignacion">Sin asignación</option>
                </select>
              </div>

              {/* Puesto */}
              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">Puesto titular</label>
                <select
                  value={formAsig.puesto_id}
                  onChange={(e) => {
                    const pId = e.target.value;
                    const p = puestos.find((x) => String(x.id) === pId);
                    setFormAsig((prev) => ({
                      ...prev,
                      puesto_id: pId,
                      sede_id: p?.sede_id ? String(p.sede_id) : prev.sede_id,
                      zona_operativa_id: p?.zona_operativa_id ? String(p.zona_operativa_id) : prev.zona_operativa_id,
                    }));
                  }}
                  className={selCls}
                >
                  <option value="">Sin puesto asignado</option>
                  {puestos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} — {p.cliente_nombre}{p.sede_nombre ? ` (${p.sede_nombre})` : ""}</option>
                  ))}
                </select>
              </div>

              {/* Zona operativa */}
              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">Zona operativa</label>
                <select value={formAsig.zona_operativa_id} onChange={(e) => sel("zona_operativa_id", e.target.value)} className={selCls}>
                  <option value="">Sin zona asignada</option>
                  {zonas.map((z) => (
                    <option key={z.id} value={z.id}>{z.nombre}{z.supervisor_nombre ? ` — Sup: ${z.supervisor_nombre}` : ""}</option>
                  ))}
                </select>
                <p className="text-[10px] text-white/25">El supervisor se deriva automáticamente de la zona</p>
              </div>

              {/* Turno de nómina */}
              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">Turno de nómina</label>
                <select value={formAsig.tipo_turno_id} onChange={(e) => sel("tipo_turno_id", e.target.value)} className={selCls}>
                  <option value="">Sin turno asignado</option>
                  {turnos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre} ({t.horas_trabajo}h + {t.horas_descanso}h)</option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">Notas</label>
                <textarea
                  rows={3}
                  value={formAsig.notas}
                  onChange={(e) => sel("notas", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
                  placeholder="Observaciones sobre la asignación..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/8">
              <button onClick={() => setEditOpen(false)} className="text-xs text-white/50 hover:text-white px-4 py-2 border border-white/10 rounded-lg transition-colors">Cancelar</button>
              <button
                onClick={saveAsig}
                disabled={saving}
                className="flex items-center gap-2 text-xs bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Modal: Ficha de Empleado (5 pestañas) ────────────────────────────────────

function FichaModal({
  emp,
  onClose,
  onEdit,
  onEstado,
}: {
  emp: Empleado;
  onClose: () => void;
  onEdit: (e: Empleado) => void;
  onEstado: (e: Empleado, estado: string) => void;
}) {
  const [tab, setTab] = useState<"perfil" | "asignacion-op" | "asignaciones" | "sistema" | "operacion" | "kpi" | "anticipos">("perfil");
  const [showEstado, setShowEstado] = useState(false);
  const est = ESTADO_LAB[emp.estadoLaboral] ?? { label: emp.estadoLaboral, color: "text-white/40 bg-white/5 border-white/10", dot: "bg-white/40" };

  const tabs = [
    { key: "perfil",        label: "Perfil",         icon: UserCheck },
    { key: "asignacion-op", label: "Asignación",     icon: MapPinned },
    { key: "asignaciones",  label: "Portal",         icon: Briefcase },
    { key: "sistema",       label: "Sistema",        icon: Lock },
    { key: "operacion",     label: "Operación",      icon: Activity },
    { key: "kpi",           label: "KPI",            icon: BarChart2 },
    { key: "anticipos",     label: "Anticipos",      icon: Wallet },
  ] as const;

  const ESTADOS_CAMBIO = ["activo", "suspendido", "baja", "licencia"].filter((e) => e !== emp.estadoLaboral);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-8 overflow-auto">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-white/8">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0 ${avatarColor(emp.nombreCompleto)}`}>
            {iniciales(emp.nombreCompleto)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">{emp.nombreCompleto}</h2>
            <p className="text-xs text-white/50 mt-0.5">{emp.puesto ?? "Colaborador"} · {emp.area ?? "—"}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <EstadoBadge estado={emp.estadoLaboral} />
              {emp.sede && (
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <MapPin className="w-3 h-3" />{emp.sede}
                </span>
              )}
              {emp.dpi && (
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <Hash className="w-3 h-3" />{maskDpi(emp.dpi)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Cambio rápido de estado */}
            <div className="relative">
              <button
                onClick={() => setShowEstado(!showEstado)}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Estado
              </button>
              {showEstado && (
                <div className="absolute right-0 top-full mt-1 bg-[#07111f] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden min-w-[130px]">
                  {ESTADOS_CAMBIO.map((e) => {
                    const cfg = ESTADO_LAB[e];
                    return (
                      <button
                        key={e}
                        onClick={() => { onEstado(emp, e); setShowEstado(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/5 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg?.dot ?? "bg-white/40"}`} />
                        {cfg?.label ?? e}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={() => onEdit(emp)}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                tab === key ? "text-primary border-b-2 border-primary" : "text-white/40 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {tab === "perfil" && <TabPerfil emp={emp} />}
          {tab === "asignacion-op" && <TabAsignacionOperativa empId={emp.id} />}
          {tab === "asignaciones" && <TabAsignaciones empId={emp.id} />}
          {tab === "sistema" && <TabSistema emp={emp} />}
          {tab === "operacion" && <TabOperacion empId={emp.id} />}
          {tab === "kpi" && <TabKPI empId={emp.id} />}
          {tab === "anticipos" && <TabAnticipo emp={emp} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Formulario CRUD ───────────────────────────────────────────────────

function FormModal({
  modo,
  emp,
  onClose,
  onSave,
}: {
  modo: "crear" | "editar";
  emp?: Empleado;
  onClose: () => void;
  onSave: (data: Partial<FormState>) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    nombreCompleto: emp?.nombreCompleto ?? "",
    dpi: emp?.dpi ?? "",
    telefono: emp?.telefono ?? "",
    telefonoSecundario: emp?.telefonoSecundario ?? "",
    correo: emp?.correo ?? "",
    area: emp?.area ?? "",
    estadoLaboral: emp?.estadoLaboral ?? "activo",
    fechaIngreso: emp?.fechaIngreso ? emp.fechaIngreso.split("T")[0] : "",
    notas: emp?.notas ?? "",
    sueldoBase: emp?.sueldoBase ?? "",
    tipoJornada: emp?.tipoJornada ?? "",
    diaDescanso: emp?.diaDescanso ?? "",
    horasContrato: emp?.horasContrato != null ? String(emp.horasContrato) : "",
    limiteAnticipo: emp?.limiteAnticipo != null ? String(emp.limiteAnticipo) : "",
    tipoLimitePeriodo: emp?.tipoLimitePeriodo ?? "quincenal",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.nombreCompleto.trim()) { setError("El nombre completo es requerido."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof FormState, type = "text", opts?: { placeholder?: string; required?: boolean }) => (
    <div className="space-y-1">
      <label className="text-xs text-white/50 font-medium">{label}{opts?.required && <span className="text-rose-400 ml-0.5">*</span>}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts?.placeholder ?? ""}
        className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/75 backdrop-blur-sm p-4 pt-8 overflow-auto">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h3 className="text-sm font-bold text-white">
            {modo === "crear" ? "Nuevo Colaborador" : "Editar Colaborador"}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Datos personales */}
          <p className="text-[10px] text-white/30 uppercase tracking-widest">Datos personales</p>
          <div className="grid grid-cols-1 gap-3">
            {field("Nombre completo", "nombreCompleto", "text", { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("DPI", "dpi", "text", { placeholder: "Número de DPI" })}
            {field("Fecha de ingreso", "fechaIngreso", "date")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Teléfono principal", "telefono", "tel", { placeholder: "+502 XXXX XXXX" })}
            {field("Teléfono secundario", "telefonoSecundario", "tel", { placeholder: "+502 XXXX XXXX" })}
          </div>
          {field("Correo electrónico", "correo", "email", { placeholder: "correo@ejemplo.com" })}
          {field("Área / Departamento", "area", "text", { placeholder: "Ops, Administración…" })}

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Estado laboral</label>
            <select
              value={form.estadoLaboral}
              onChange={(e) => set("estadoLaboral", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="licencia">Licencia</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Datos laborales / nómina */}
          <p className="text-[10px] text-white/30 uppercase tracking-widest pt-2">Datos laborales</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Sueldo base (Q)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sueldoBase}
                onChange={(e) => set("sueldoBase", e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Horas contrato / semana</label>
              <input
                type="number"
                min="1"
                max="84"
                step="1"
                value={form.horasContrato}
                onChange={(e) => set("horasContrato", e.target.value)}
                placeholder="48"
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Tipo de jornada</label>
              <select
                value={form.tipoJornada}
                onChange={(e) => set("tipoJornada", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin especificar —</option>
                <option value="completa">Completa</option>
                <option value="parcial">Parcial</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Día de descanso</label>
              <select
                value={form.diaDescanso}
                onChange={(e) => set("diaDescanso", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin especificar —</option>
                <option value="domingo">Domingo</option>
                <option value="lunes">Lunes</option>
                <option value="martes">Martes</option>
                <option value="miercoles">Miércoles</option>
                <option value="jueves">Jueves</option>
                <option value="viernes">Viernes</option>
                <option value="sabado">Sábado</option>
              </select>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={3}
              placeholder="Observaciones adicionales…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {modo === "crear" ? "Crear colaborador" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Tarjeta de Empleado ──────────────────────────────────────────────────────

function EmpleadoCard({ emp, onClick }: { emp: Empleado; onClick: () => void }) {
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
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          <EstadoBadge estado={emp.estadoLaboral} />
          {emp.area && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border text-white/40 bg-white/4 border-white/8">
              {emp.area}
            </span>
          )}
        </div>
        {emp.telefono && (
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <Phone className="w-2.5 h-2.5" />
            {emp.telefono}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Fila de Empleado (tabla) ─────────────────────────────────────────────────

function EmpleadoRow({ emp, onClick, onEdit }: { emp: Empleado; onClick: () => void; onEdit: () => void }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/2 transition-colors group cursor-pointer" onClick={onClick}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(emp.nombreCompleto)}`}>
            {iniciales(emp.nombreCompleto)}
          </div>
          <div>
            <p className="text-sm text-white font-medium group-hover:text-primary transition-colors">{emp.nombreCompleto}</p>
            {emp.correo && <p className="text-[11px] text-white/30">{emp.correo}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <code className="text-xs text-white/40 font-mono">{maskDpi(emp.dpi)}</code>
      </td>
      <td className="px-4 py-3">
        <div>
          {emp.telefono ? <p className="text-xs text-white/70">{emp.telefono}</p> : <span className="text-xs text-white/20">—</span>}
          {emp.telefonoSecundario && <p className="text-[10px] text-white/30">{emp.telefonoSecundario}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-xs text-white/70">{emp.puesto ?? "—"}</p>
          {emp.area && <p className="text-[10px] text-white/35">{emp.area}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-white/60">{emp.supervisorNombre ?? "—"}</p>
      </td>
      <td className="px-4 py-3">
        <EstadoBadge estado={emp.estadoLaboral} />
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onEdit}
          className="text-white/25 hover:text-primary transition-colors p-1"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Empleados() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroArea, setFiltroArea] = useState<string>("todos");
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tabla");
  const [fichaAbierta, setFichaAbierta] = useState<Empleado | null>(null);
  const [formModal, setFormModal] = useState<{ modo: "crear" | "editar"; emp?: Empleado } | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: empleados = [], isLoading, isError, refetch } = useQuery<Empleado[]>({
    queryKey: ["empleados"],
    queryFn: () => fetch(`${API_BASE}/employees`).then((r) => r.json()),
    staleTime: 60_000,
  });

  // ─── Mutaciones ──────────────────────────────────────────────────────────────

  async function apiCall(url: string, method: string, body?: object) {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Error desconocido" }));
      throw new Error(err.error ?? "Error al guardar");
    }
    return r.json();
  }

  async function handleSave(data: Partial<FormState>) {
    if (formModal?.modo === "crear") {
      await apiCall(`${API_BASE}/employees`, "POST", data);
      toast({ title: "Colaborador creado", description: data.nombreCompleto });
    } else if (formModal?.emp) {
      await apiCall(`${API_BASE}/employees/${formModal.emp.id}`, "PATCH", data);
      toast({ title: "Colaborador actualizado", description: data.nombreCompleto });
    }
    qc.invalidateQueries({ queryKey: ["empleados"] });
  }

  async function handleEstado(emp: Empleado, estado: string) {
    try {
      const updated = await apiCall(`${API_BASE}/employees/${emp.id}/estado`, "PATCH", { estadoLaboral: estado });
      toast({ title: "Estado actualizado", description: `${emp.nombreCompleto} → ${ESTADO_LAB[estado]?.label ?? estado}` });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      if (fichaAbierta?.id === emp.id) setFichaAbierta(updated);
    } catch (e) {
      toast({ title: "Error", description: "No se pudo cambiar el estado", variant: "destructive" });
    }
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────────

  const areas = Array.from(new Set(empleados.map((e) => e.area).filter(Boolean))) as string[];

  const filtrados = empleados.filter((e) => {
    if (filtroEstado !== "todos" && e.estadoLaboral !== filtroEstado) return false;
    if (filtroArea !== "todos" && e.area !== filtroArea) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        e.nombreCompleto.toLowerCase().includes(q) ||
        e.puesto?.toLowerCase().includes(q) ||
        e.area?.toLowerCase().includes(q) ||
        e.sede?.toLowerCase().includes(q) ||
        e.dpi?.includes(q) ||
        e.telefono?.includes(q) ||
        e.telefonoSecundario?.includes(q)
      );
    }
    return true;
  });

  // ─── Stats rápidas ───────────────────────────────────────────────────────────

  const total = empleados.length;
  const activos = empleados.filter((e) => e.estadoLaboral === "activo").length;
  const suspendidos = empleados.filter((e) => e.estadoLaboral === "suspendido" || e.estadoLaboral === "baja").length;
  const conDpi = empleados.filter((e) => e.dpi).length;

  return (
    <AdminLayout title="Colaboradores">
      <div className="space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{total}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Total</p>
          </div>
          <div className="bg-[#0c1929] border border-green-500/15 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{activos}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Activos</p>
          </div>
          <div className="bg-[#0c1929] border border-yellow-500/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{suspendidos}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Suspendidos / Baja</p>
          </div>
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{conDpi}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Con DPI registrado</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Buscar por nombre, DPI, teléfono, área…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-[#0c1929] border border-white/8 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-primary/40"
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
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
            <option value="suspendido">Suspendido</option>
            <option value="baja">Baja</option>
            <option value="licencia">Licencia</option>
            <option value="inactivo">Inactivo</option>
          </select>

          {areas.length > 0 && (
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer"
            >
              <option value="todos">Todas las áreas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          {/* Toggle vista */}
          <div className="flex items-center bg-[#0c1929] border border-white/8 rounded-lg overflow-hidden">
            <button
              onClick={() => setVista("tabla")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${vista === "tabla" ? "bg-primary/20 text-primary" : "text-white/40 hover:text-white"}`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Tabla
            </button>
            <button
              onClick={() => setVista("tarjetas")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${vista === "tarjetas" ? "bg-primary/20 text-primary" : "text-white/40 hover:text-white"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Tarjetas
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white border border-white/8 rounded-lg px-3 py-2 transition-colors bg-[#0c1929]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setFormModal({ modo: "crear" })}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg px-3 py-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo
          </button>
        </div>

        {/* Resultados */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-white/40">Cargando colaboradores…</span>
          </div>
        )}

        {isError && (
          <div className="text-center py-10">
            <p className="text-red-400 text-sm">Error al cargar datos.</p>
          </div>
        )}

        {!isLoading && !isError && filtrados.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">
              {empleados.length === 0 ? "No hay colaboradores registrados." : "Sin resultados para los filtros aplicados."}
            </p>
            {empleados.length === 0 && (
              <button
                onClick={() => setFormModal({ modo: "crear" })}
                className="mt-4 flex items-center gap-2 mx-auto text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4" /> Crear primer colaborador
              </button>
            )}
          </div>
        )}

        {/* Vista tabla */}
        {!isLoading && !isError && filtrados.length > 0 && vista === "tabla" && (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <p className="text-xs text-white/40">{filtrados.length} colaboradore{filtrados.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Colaborador</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">DPI</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Teléfono</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Puesto / Área</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Supervisor</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Estado</th>
                    <th className="px-4 py-2.5 text-right text-[10px] text-white/30 uppercase tracking-widest font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((e) => (
                    <EmpleadoRow
                      key={e.id}
                      emp={e}
                      onClick={() => setFichaAbierta(e)}
                      onEdit={() => setFormModal({ modo: "editar", emp: e })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vista tarjetas */}
        {!isLoading && !isError && filtrados.length > 0 && vista === "tarjetas" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtrados.map((e) => (
              <EmpleadoCard key={e.id} emp={e} onClick={() => setFichaAbierta(e)} />
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      {fichaAbierta && (
        <FichaModal
          emp={fichaAbierta}
          onClose={() => setFichaAbierta(null)}
          onEdit={(e) => { setFichaAbierta(null); setFormModal({ modo: "editar", emp: e }); }}
          onEstado={handleEstado}
        />
      )}

      {formModal && (
        <FormModal
          modo={formModal.modo}
          emp={formModal.emp}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  );
}
