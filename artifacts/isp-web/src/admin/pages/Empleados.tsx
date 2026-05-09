import { useState, useEffect, useRef, type ElementType } from "react";
import { QRCodeSVG } from "qrcode.react";
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
  UserCog, Sun, Umbrella, CheckCircle2, Info, ChevronRight, QrCode, Download,
  ClipboardList, FileText, Scale, FileSignature, Printer, Camera,
  CalendarClock, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generarContratoLaboral, cargarPatronoDesdeConfig, type DatosContratoLaboral } from "@/lib/pdfRrhh";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import DescansoSemanalEditor from "../components/DescansoSemanalEditor";
import { getSessionToken } from "@/lib/httpClient";

const API_BASE = "/api";

// Helper para enviar el header de sesión admin en todos los fetches.
// Centralizado a nivel de archivo para que cualquier componente del archivo
// pueda usarlo sin redefinirlo.
const sessionHeader = () => ({ "x-isp-session": getSessionToken() });

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
  bonificacionIncentivo: string | null;
  bonificacion1: string | null;
  bonificacion2: string | null;
  bonificacion3: string | null;
  // Nómina — frecuencia de pago
  frecuenciaPago: string;
  // Banco / cuenta / forma de pago
  banco: string | null;
  cuentaBancaria: string | null;
  tipoCuenta: string | null;
  formaPago: string | null;
  // Tipo de personal operativo
  tipoPersonal: string;
  // Foto del empleado (objectPath en GCS)
  fotoUrl: string | null;
  // Cliente asignado
  clienteNombre: string | null;
  // Seguridad social — IGSS
  aplicaIgssGeneral: boolean;
  estadoIgss: string;
  fechaInicioIgss: string | null;
  observacionesIgss: string | null;
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
  fechaNacimiento: string;
  notas: string;
  // Datos laborales / nómina
  sueldoBase: string;
  tipoJornada: string;
  diaDescanso: string;
  horasContrato: string;
  frecuenciaPago: string;
  limiteAnticipo: string;
  tipoLimitePeriodo: string;
  tipoPersonal: string;
  bonificacionIncentivo: string;
  bonificacion1: string;
  bonificacion2: string;
  bonificacion3: string;
  // Banco / cuenta / forma de pago
  banco: string;
  cuentaBancaria: string;
  tipoCuenta: string;
  formaPago: string;
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

function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "?";
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  // Evitar bug de timezone: "2026-04-28" o "2026-04-28T00:00:00.000Z" debe
  // mostrarse como 28 abril en Guatemala (UTC-6). new Date(iso) interpreta
  // la T...Z como UTC y al pedir el día local devuelve el anterior.
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) {
    return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
  }
  return new Date(y, m - 1, d).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
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

function fmtQ(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n as number)) return "Q0.00";
  return `Q${(n as number).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
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

function avatarColor(nombre: string | null | undefined) {
  if (!nombre) return AVATAR_COLORS[0];
  const sum = nombre.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const FORM_EMPTY: FormState = {
  nombreCompleto: "", dpi: "", telefono: "", telefonoSecundario: "",
  correo: "", area: "", estadoLaboral: "activo",
  fechaIngreso: "", fechaNacimiento: "", notas: "",
  sueldoBase: "", tipoJornada: "", diaDescanso: "", horasContrato: "",
  frecuenciaPago: "quincenal",
  limiteAnticipo: "", tipoLimitePeriodo: "quincenal",
  tipoPersonal: "guardia",
  bonificacionIncentivo: "", bonificacion1: "", bonificacion2: "", bonificacion3: "",
  banco: "", cuentaBancaria: "", tipoCuenta: "", formaPago: "cheque",
};

const TIPO_PERSONAL_CFG = {
  guardia:               { label: "Guardia",         color: "text-blue-300 bg-blue-500/10 border-blue-500/20"     },
  supervisor:            { label: "Supervisor",      color: "text-violet-300 bg-violet-500/10 border-violet-500/20" },
  jefe_servicio:         { label: "Jefe Servicio",   color: "text-orange-300 bg-orange-500/10 border-orange-500/20" },
  administrativo_bodega: { label: "Bodega",          color: "text-amber-300 bg-amber-500/10 border-amber-500/20"  },
  administrativo_rrhh:   { label: "RRHH",            color: "text-teal-300 bg-teal-500/10 border-teal-500/20"     },
  gerencia:              { label: "Gerencia",        color: "text-rose-300 bg-rose-500/10 border-rose-500/20"     },
  administrativo:        { label: "Administrativo",  color: "text-amber-300 bg-amber-500/10 border-amber-500/20"  },
  disponible:            { label: "Disponible (ISP)", color: "text-white/50 bg-white/5 border-white/10"           },
} as const;

const VALID_TIPOS_PERSONAL = ["guardia", "supervisor", "jefe_servicio", "administrativo_bodega", "administrativo_rrhh", "gerencia", "administrativo"] as const;

// Tipo del catálogo configurable (Configuración → Usuarios → Tipos de Personal)
interface TipoPersonalConfig {
  clave: string;
  label: string;
  color: string;
  descripcion: string | null;
  activo: boolean;
  es_sistema: boolean;
  orden: number;
  empleados_count?: number;
}

// Hook compartido: lee el catálogo de tipos de personal desde la API
function useTiposPersonal() {
  return useQuery<TipoPersonalConfig[]>({
    queryKey: ["tipos-personal-config"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const sess = getSessionToken();
      const r = await fetch(`${base}/api/tipos-personal-config`, {
        headers: { "x-isp-session": sess },
      });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
}

function TipoPersonalBadge({ tipo }: { tipo: string }) {
  const cfg = TIPO_PERSONAL_CFG[tipo as keyof typeof TIPO_PERSONAL_CFG]
    ?? { label: tipo, color: "text-white/40 bg-white/5 border-white/10" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

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
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/rotation`, { headers: sessionHeader() }).then((r) => r.json()),
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
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/disciplinary`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });
  const { data: rot } = useQuery<KPIRotacion>({
    queryKey: ["employee-rotation", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/rotation`, { headers: sessionHeader() }).then((r) => r.json()),
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

function ActaDesdeKPI({ empId }: { empId: number }) {
  const [open, setOpen] = useState(false);
  const [causales, setCausales] = useState<string[]>([]);
  const [hechosCustom, setHechosCustom] = useState("");
  const [generando, setGenerando] = useState(false);
  const { toast } = useToast();
  const getSession = () => getSessionToken();

  const handleGenerar = async () => {
    if (causales.length === 0) {
      toast({ title: "Seleccione al menos una causal", variant: "destructive" });
      return;
    }
    setGenerando(true);
    try {
      const hdr = { "x-isp-session": getSession() };
      const [configRes, numRes] = await Promise.all([
        fetch(`${API_BASE}/actas/datos-para-pdf/${empId}`, { headers: hdr }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/actas/siguiente-numero`, { method: "POST", headers: { ...hdr, "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : null),
      ]);
      if (!configRes) throw new Error("No se pudo obtener datos del empleado");
      if (!numRes?.numero) throw new Error("No se pudo obtener número de acta");
      const cfg = configRes?.config || {};
      const emp = configRes?.empleado || {};
      const hist = (configRes?.eventos_recientes || [])
        .filter((e: any) => ["falta","falta_injustificada","llamada_atencion_1","llamada_atencion_2","acta_administrativa"].includes(e.tipo_evento))
        .slice(0, 10);

      const { generarActaAdministrativa } = await import("@/lib/pdfRrhh");
      await generarActaAdministrativa({
        numero_acta: numRes.numero,
        representante_nombre: cfg.representante_nombre || "Representante Legal",
        representante_dpi: cfg.representante_dpi || "",
        direccion_empresa: cfg.direccion_empresa || "",
        nombre_empresa: cfg.nombre_empresa || "Investigaciones y Seguridad Profesional S.A.",
        empleado_nombre: emp.nombre_completo || "Empleado",
        empleado_dpi: emp.dpi || "",
        empleado_fecha_ingreso: emp.fecha_ingreso || "",
        empleado_cargo: emp.cargo || "Agente de Seguridad",
        puesto_nombre: emp.puesto_nombre || "",
        cliente_nombre: emp.cliente_nombre || "",
        fecha_evento: new Date().toISOString(),
        hechos: hechosCustom || "Acumulación de faltas disciplinarias según historial documentado.",
        notas_sistema: [],
        causal: "INCUMPLIMIENTO LABORAL",
        articulo_legal: "Art. 77",
        eventos_historial: hist.map((e: any) => ({ fecha: e.fecha, tipo: e.tipo_evento, notas: e.notas || "" })),
        causales_seleccionadas: causales,
      });
      toast({ title: "Acta generada", description: "El PDF se descargó correctamente." });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error al generar acta", description: err?.message || "Intenta de nuevo", variant: "destructive" });
    } finally {
      setGenerando(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[10px] font-semibold text-red-300 hover:text-red-200 transition-colors bg-red-500/10 hover:bg-red-500/15 rounded-lg px-3 py-2">
        <FileText className="w-3.5 h-3.5" /> Generar Acta Administrativa
      </button>
    );
  }

  return (
    <div className="space-y-3 mt-2 bg-[#0a1628] border border-white/8 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Seleccionar Causales</p>
        <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/50"><X className="w-3.5 h-3.5" /></button>
      </div>
      <CausalSelector selected={causales} onChange={setCausales} />
      <div>
        <label className="text-[10px] text-white/30 block mb-1">Hechos adicionales (opcional)</label>
        <textarea
          value={hechosCustom}
          onChange={e => setHechosCustom(e.target.value)}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20"
          placeholder="Describir hechos específicos o dejar en blanco para texto automático…"
        />
      </div>
      <button onClick={handleGenerar} disabled={generando || causales.length === 0}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg px-3 py-2 disabled:opacity-40 transition-colors">
        {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        {generando ? "Generando…" : "Descargar Acta PDF"}
      </button>
    </div>
  );
}

function CausalSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [causales, setCausales] = useState<Array<{ id: string; label: string; desc: string; articulo: string }>>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    import("@/lib/pdfRrhh")
      .then(m => setCausales([...m.CAUSALES_ACTA]))
      .catch(() => setLoadError(true));
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  if (loadError) {
    return <p className="text-[10px] text-red-400 py-2">Error al cargar causales. Recarga la página e intenta de nuevo.</p>;
  }
  if (causales.length === 0) {
    return <div className="flex items-center gap-2 py-3 text-white/30 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" /> Cargando causales…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
      {causales.map(c => {
        const active = selected.includes(c.id);
        return (
          <button key={c.id} onClick={() => toggle(c.id)}
            className={`text-left rounded-lg px-3 py-2 border transition-colors ${active ? "bg-red-500/15 border-red-500/30 text-red-200" : "bg-white/3 border-white/8 text-white/50 hover:bg-white/5"}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${active ? "bg-red-500 border-red-500" : "border-white/20"}`}>
                {active && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className="text-[10px] font-semibold">{c.label}</span>
              <span className="text-[9px] text-white/25 ml-auto">{c.articulo}</span>
            </div>
            {active && <p className="text-[9px] text-white/30 mt-1 ml-5">{c.desc}</p>}
          </button>
        );
      })}
    </div>
  );
}

function SeccionDisciplinaria({ empId }: { empId: number }) {
  const { data: disc, isLoading } = useQuery<KPIDisciplinario>({
    queryKey: ["employee-disciplinary", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/disciplinary`, { headers: sessionHeader() }).then((r) => r.json()),
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

      {disc.score < 70 && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-red-300 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> Rendimiento bajo — Acción recomendada
          </p>
          <p className="text-[10px] text-white/30">
            El score disciplinario de este colaborador está en nivel de riesgo.
            Puede generar un acta administrativa directamente desde aquí.
          </p>
          <ActaDesdeKPI empId={empId} />
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
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/kpi`, { headers: sessionHeader() }).then((r) => r.json()),
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
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/asignaciones`, { headers: sessionHeader() }).then((r) => r.json()),
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

// ─── IGSS helpers ─────────────────────────────────────────────────────────────

const IGSS_ESTADO_CFG: Record<string, { label: string; color: string; dot: string }> = {
  activo:                   { label: "Activo",               color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  no_activo:                { label: "Sin IGSS",             color: "text-white/40 bg-white/5 border-white/10",                  dot: "bg-white/30" },
  pendiente_regularizacion: { label: "En regularización",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20",         dot: "bg-amber-400" },
};

// ─── Sección Contratos (solo lectura) ────────────────────────────────────────
interface Contrato {
  id: number;
  tipo_contrato: string;
  etiqueta: string;
  fecha_contrato: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  puesto: string | null;
  sueldo_base: string | null;
  observaciones: string | null;
  generado_automatico: boolean;
}

function ContratosSection({ empId }: { empId: number }) {
  const API_BASE = (import.meta as Record<string, unknown>).env?.VITE_API_BASE as string ?? "/api";
  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["contratos", empId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/employees/${empId}/contratos`, {
        headers: { "x-isp-session": getSessionToken() },
      });
      if (!r.ok) throw new Error("Error al cargar contratos");
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) return null;
  if (!contratos.length) return null;

  const tipoColor: Record<string, string> = {
    inicial:    "bg-primary/15 text-primary border border-primary/30",
    post_prueba:"bg-emerald-900/30 text-emerald-400 border border-emerald-700/30",
  };

  return (
    <div>
      <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Contratos</p>
      <div className="space-y-2">
        {contratos.map((c) => (
          <div key={c.id} className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-white">{c.etiqueta}</p>
              <div className="flex items-center gap-1.5">
                {c.generado_automatico && (
                  <span className="text-[9px] text-white/20 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">Auto</span>
                )}
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${tipoColor[c.tipo_contrato] ?? "bg-white/5 text-white/40 border border-white/10"}`}>
                  {c.tipo_contrato === "post_prueba" ? "Post-prueba" : "Inicial"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <p className="text-[10px] text-white/30">Fecha: <span className="text-white/60">{c.fecha_contrato}</span></p>
              <p className="text-[10px] text-white/30">Inicio: <span className="text-white/60">{c.fecha_inicio}</span></p>
              {c.puesto && <p className="text-[10px] text-white/30 col-span-2">Puesto: <span className="text-white/60">{c.puesto}</span></p>}
              {c.sueldo_base && <p className="text-[10px] text-white/30">Sueldo: <span className="text-white/60">Q{Number(c.sueldo_base).toLocaleString("es-GT")}</span></p>}
            </div>
            {c.observaciones && (
              <p className="text-[10px] text-white/25 mt-1 italic">{c.observaciones}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sección IGSS inline (con edición) ───────────────────────────────────────
function IgssSection({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    aplicaIgssGeneral: emp.aplicaIgssGeneral ?? false,
    estadoIgss:        emp.estadoIgss ?? "no_activo",
    fechaInicioIgss:   emp.fechaInicioIgss ?? "",
    observacionesIgss: emp.observacionesIgss ?? "",
  });

  const cfg = IGSS_ESTADO_CFG[emp.estadoIgss] ?? IGSS_ESTADO_CFG.no_activo;

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({
          aplicaIgssGeneral: form.aplicaIgssGeneral,
          estadoIgss:        form.estadoIgss,
          fechaInicioIgss:   form.fechaInicioIgss || null,
          observacionesIgss: form.observacionesIgss || null,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Error al guardar");
        return r.json();
      });
      toast({ title: "IGSS actualizado", description: emp.nombreCompleto });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setEditando(false);
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el IGSS", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/25 uppercase tracking-widest">Seguridad Social — IGSS</p>
        {!editando && (
          <button
            onClick={() => { setForm({ aplicaIgssGeneral: emp.aplicaIgssGeneral ?? false, estadoIgss: emp.estadoIgss ?? "no_activo", fechaInicioIgss: emp.fechaInicioIgss ?? "", observacionesIgss: emp.observacionesIgss ?? "" }); setEditando(true); }}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-primary transition-colors"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
        )}
      </div>

      {!editando ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <p className="text-[10px] text-white/30 mb-1">Estado IGSS</p>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <p className="text-[10px] text-white/30 mb-1">Aplica IGSS general</p>
            <p className={`text-sm font-semibold ${emp.aplicaIgssGeneral ? "text-emerald-400" : "text-white/40"}`}>
              {emp.aplicaIgssGeneral ? "Sí" : "No"}
            </p>
          </div>
          {emp.fechaInicioIgss && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Inicio IGSS</p>
              <p className="text-sm text-white/80">{emp.fechaInicioIgss}</p>
            </div>
          )}
          {emp.observacionesIgss && (
            <div className="col-span-2 bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Observaciones</p>
              <p className="text-xs text-white/60 leading-relaxed">{emp.observacionesIgss}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#0c1929] border border-primary/15 rounded-xl p-4 space-y-3">
          {/* Aplica IGSS */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.aplicaIgssGeneral}
              onChange={(e) => setForm((p) => ({ ...p, aplicaIgssGeneral: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs text-white/70">Aplica IGSS general (colaborador inscrito)</span>
          </label>
          {/* Estado IGSS */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Estado IGSS</label>
            <select
              value={form.estadoIgss}
              onChange={(e) => setForm((p) => ({ ...p, estadoIgss: e.target.value }))}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-primary/40 appearance-none"
            >
              <option value="no_activo">Sin IGSS</option>
              <option value="activo">Activo</option>
              <option value="pendiente_regularizacion">En proceso de regularización</option>
            </select>
          </div>
          {/* Fecha inicio */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Fecha inicio IGSS</label>
            <input
              type="date"
              value={form.fechaInicioIgss}
              onChange={(e) => setForm((p) => ({ ...p, fechaInicioIgss: e.target.value }))}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-primary/40"
            />
          </div>
          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Observaciones</label>
            <textarea
              rows={2}
              value={form.observacionesIgss}
              onChange={(e) => setForm((p) => ({ ...p, observacionesIgss: e.target.value }))}
              placeholder="Motivo, pendiente, acuerdo con cliente…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-primary/40 resize-none"
            />
          </div>
          {/* Botones */}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditando(false)} className="text-xs text-white/40 hover:text-white transition-colors px-3 py-1.5">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-primary text-black font-medium px-4 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Comprime una imagen a JPEG 480px max, calidad 0.82 (igual al kiosco/carnet).
async function comprimirFotoEmpleado(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 480;
      const cv = document.createElement("canvas");
      const sc = Math.min(1, SIZE / Math.max(img.width, img.height));
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      const ctx = cv.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Error al comprimir"))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagen inválida")); };
    img.src = url;
  });
}

// Carga segura de foto privada desde object storage (mismo patrón que CarnetesQR.SecureFoto).
function useFotoSegura(fotoUrl: string | null): string | null {
  const [src, setSrc] = useState<string | null>(
    fotoUrl && fotoUrl.startsWith("data:") ? fotoUrl : null
  );
  useEffect(() => {
    if (!fotoUrl) { setSrc(null); return; }
    if (fotoUrl.startsWith("data:")) { setSrc(fotoUrl); return; }
    if (/^https?:\/\//i.test(fotoUrl)) { setSrc(fotoUrl); return; }
    let active = true;
    const session = getSessionToken();
    fetch(`${API_BASE}/storage${fotoUrl}`, { headers: { "x-isp-session": session } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("foto no disponible"))))
      .then((blob) => { if (active) setSrc(URL.createObjectURL(blob)); })
      .catch(() => { if (active) setSrc(null); });
    return () => { active = false; };
  }, [fotoUrl]);
  return src;
}

function FotoEmpleadoEditor({ emp, onUpdated }: { emp: Empleado; onUpdated?: (fotoUrl: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoLocal, setFotoLocal] = useState<string | null>(emp.fotoUrl);
  useEffect(() => { setFotoLocal(emp.fotoUrl); }, [emp.fotoUrl]);
  const fotoSrc = useFotoSegura(fotoLocal);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Selecciona una imagen.", variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Foto muy grande", description: "Máximo 15 MB.", variant: "destructive" });
      return;
    }
    setSubiendo(true);
    try {
      const session = getSessionToken();
      // El servidor recibe la foto cruda y la procesa con sharp:
      // auto-orient EXIF, resize a 480 px, JPEG q82 → guarda data URL en BD.
      // No usa Object Storage (evita el bug del sidecar en producción).
      const upRes = await fetch(`${API_BASE}/employees/${emp.id}/foto-upload`, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-isp-session": session,
        },
        body: file,
      });
      if (!upRes.ok) {
        const txt = await upRes.text().catch(() => "");
        throw new Error(`No se pudo subir la foto (HTTP ${upRes.status}) ${txt}`);
      }
      const { fotoUrl } = await upRes.json();
      toast({ title: "Foto actualizada", description: emp.nombreCompleto });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setFotoLocal(fotoUrl);
      onUpdated?.(fotoUrl);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudo subir la foto", variant: "destructive" });
    } finally {
      setSubiendo(false);
    }
  }

  const initials = iniciales(emp.nombreCompleto);
  const colorClass = avatarColor(emp.nombreCompleto);

  return (
    <div className="flex items-center gap-4 p-4 bg-[#0c1929] border border-white/8 rounded-xl">
      <div className="relative">
        {fotoSrc ? (
          <img
            src={fotoSrc}
            alt={emp.nombreCompleto}
            className="w-20 h-20 rounded-full object-cover border-2 border-white/15"
          />
        ) : (
          <div className={`w-20 h-20 rounded-full ${colorClass} flex items-center justify-center text-white font-bold text-xl border-2 border-white/15`}>
            {initials}
          </div>
        )}
        {subiendo && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1">Fotografía</p>
        <p className="text-xs text-white/50 mb-2">
          {emp.fotoUrl ? "Foto cargada. Subir una nueva la reemplaza." : "Sin foto. Sube una imagen para usarla en carnet, listas y operativos."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={subiendo}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Camera className="w-3 h-3" />
            {subiendo ? "Subiendo…" : emp.fotoUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          <span className="text-[10px] text-white/25">JPG/PNG · se comprime automáticamente a 480 px</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}

function TabPerfil({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tiposCfg = [] } = useTiposPersonal();
  const [tipoEditing, setTipoEditing] = useState(false);
  const [tipoValue, setTipoValue] = useState(emp.tipoPersonal ?? "guardia");
  const [tipoSaving, setTipoSaving] = useState(false);

  async function saveTipo() {
    setTipoSaving(true);
    try {
      const r = await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ tipoPersonal: tipoValue }),
      });
      if (!r.ok) throw new Error("Error al guardar");
      toast({ title: "Tipo actualizado", description: `${emp.nombreCompleto} → ${tipoValue}` });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setTipoEditing(false);
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el tipo", variant: "destructive" });
    } finally {
      setTipoSaving(false);
    }
  }

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
      {/* Foto del empleado */}
      <FotoEmpleadoEditor emp={emp} />

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

        {/* Tipo de personal — edición inline */}
        <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/30">Tipo de colaborador</p>
            {!tipoEditing && (
              <button onClick={() => setTipoEditing(true)} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-primary transition-colors">
                <Pencil className="w-3 h-3" /> Cambiar
              </button>
            )}
          </div>
          {!tipoEditing ? (
            <div className="mt-1">
              <TipoPersonalBadge tipo={emp.tipoPersonal ?? "guardia"} />
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={tipoValue}
                onChange={(e) => setTipoValue(e.target.value)}
                className="flex-1 bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 appearance-none"
              >
                {tiposCfg.filter(t => t.activo).map(t => (
                  <option key={t.clave} value={t.clave}>{t.label}</option>
                ))}
                {/* Conserva el valor actual aunque esté inactivo o ya no exista en el catálogo */}
                {tipoValue && !tiposCfg.some(t => t.clave === tipoValue) && (
                  <option value={tipoValue}>{tipoValue} (no catalogado)</option>
                )}
              </select>
              <button
                onClick={saveTipo}
                disabled={tipoSaving}
                className="flex items-center gap-1 text-xs bg-primary text-black font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {tipoSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
              <button onClick={() => setTipoEditing(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {emp.sueldoBase && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Sueldo base</p>
              <p className="text-sm font-semibold text-white">Q{Number(emp.sueldoBase).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.horasContrato && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Horas / semana</p>
              <p className="text-sm font-semibold text-white">{emp.horasContrato} h</p>
            </div>
          )}
          {emp.bonificacionIncentivo && Number(emp.bonificacionIncentivo) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bon. Incentivo</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacionIncentivo).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.bonificacion1 && Number(emp.bonificacion1) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bonificación 1</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacion1).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.bonificacion2 && Number(emp.bonificacion2) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bonificación 2</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacion2).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.bonificacion3 && Number(emp.bonificacion3) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bonificación 3</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacion3).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
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
          <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <p className="text-[10px] text-white/30 mb-1">Frecuencia de pago</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              (emp.frecuenciaPago ?? "quincenal") === "mensual"
                ? "bg-violet-900/40 text-violet-300 border border-violet-700/40"
                : "bg-primary/15 text-primary border border-primary/30"
            }`}>
              {(emp.frecuenciaPago ?? "quincenal") === "mensual" ? "Mensual" : "Quincenal"}
            </span>
            <p className="text-[10px] text-white/25 mt-1">
              {(emp.frecuenciaPago ?? "quincenal") === "mensual"
                ? "Se paga una vez al mes (segunda quincena)"
                : "Se paga dos veces al mes (Q1 y Q2)"}
            </p>
          </div>
        </div>
      </div>

      {/* C — IGSS */}
      <IgssSection emp={emp} />

      {/* C2 — Contratos */}
      <ContratosSection empId={emp.id} />

      {/* D — Indicación a tab Asignación */}
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
        headers: { "Content-Type": "application/json", "x-isp-session": getSessionToken() },
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
    queryFn: () => fetch(`${API_BASE}/employees/${emp.id}/user`, { headers: sessionHeader() }).then((r) => r.json()),
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
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/operacion`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: todasZonas = [] } = useQuery<ZonaBasic[]>({
    queryKey: ["zonas-all"],
    queryFn: () => fetch(`${API_BASE}/operaciones/zonas`, { headers: sessionHeader() }).then((r) => r.json()),
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

// ─── Tab: Historial de Asignaciones ────────────────────────────────────────────

interface HistorialCobertura {
  fecha: string;
  puesto_id: number;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  tipo_cobertura: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  horas_calculadas: number | null;
  horas_extra_calculadas: number | null;
  genera_horas_extra: boolean;
  fue_en_dia_descanso: boolean;
  motivo: string | null;
  cubriendo_a_nombre: string | null;
  observaciones: string | null;
}

interface HistorialTitularidad {
  puesto_id: number;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo: string | null;
}

interface HistorialData {
  coberturas: HistorialCobertura[];
  titularidades: HistorialTitularidad[];
  titularActual: { puesto_id: number; puesto_nombre: string | null; cliente_nombre: string | null; fecha_inicio: string } | null;
}

const TIPO_COBERTURA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  relevo:                   { label: "Relevo",              color: "text-blue-300",   bg: "bg-blue-500/15 border-blue-500/25" },
  titular:                  { label: "Titular",             color: "text-green-300",  bg: "bg-green-500/15 border-green-500/25" },
  cobertura_supervisor:     { label: "Cob. Supervisor",     color: "text-orange-300", bg: "bg-orange-500/15 border-orange-500/25" },
  cobertura_jefe_servicio:  { label: "Cob. Jefe Servicio",  color: "text-amber-300",  bg: "bg-amber-500/15 border-amber-500/25" },
};

function TabHistorialAsignaciones({ empId }: { empId: number }) {
  const hoy = new Date().toISOString().split("T")[0];
  const hace30 = (() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  })();

  const [desde, setDesde] = useState(hace30);
  const [hasta, setHasta] = useState(hoy);

  const { data, isLoading, isError } = useQuery<HistorialData>({
    queryKey: ["historial-asignaciones", empId, desde, hasta],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const r = await fetch(`${API_BASE}/employees/${empId}/historial-asignaciones?${params}`, { headers: sessionHeader() });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const fmtFecha = (f: string) => {
    try {
      const raw = f.length === 10 ? f + "T12:00:00Z" : f;
      return new Date(raw).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return f; }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  if (isError) {
    return (
      <div className="text-center py-14">
        <AlertTriangle className="w-8 h-8 text-red-400/40 mx-auto mb-3" />
        <p className="text-red-300/60 text-sm">Error al cargar historial</p>
        <p className="text-white/20 text-xs mt-1">Intenta ajustar las fechas o recargar la página.</p>
      </div>
    );
  }

  const coberturas = data?.coberturas ?? [];
  const titularidades = data?.titularidades ?? [];
  const titularActual = data?.titularActual ?? null;

  const coberturasPorFecha = coberturas.reduce<Record<string, HistorialCobertura[]>>((acc, c) => {
    const key = typeof c.fecha === "string" ? c.fecha.slice(0, 10) : String(c.fecha);
    (acc[key] ??= []).push(c);
    return acc;
  }, {});
  const fechasOrdenadas = Object.keys(coberturasPorFecha).sort((a, b) => b.localeCompare(a));

  const totalHE = coberturas.filter(c => c.genera_horas_extra).length;
  const totalDias = fechasOrdenadas.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta || hoy}
            className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde || undefined} max={hoy}
            className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
        </div>
        <div className="flex items-center gap-3 ml-auto text-[10px]">
          <span className="text-white/30">{totalDias} día{totalDias !== 1 ? "s" : ""} con cobertura</span>
          {totalHE > 0 && <span className="text-amber-400 font-bold">{totalHE} con HE</span>}
        </div>
      </div>

      {titularActual && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Puesto titular actual
          </p>
          <p className="text-sm font-semibold text-white">{titularActual.puesto_nombre}</p>
          <p className="text-xs text-white/40">{titularActual.cliente_nombre}</p>
          <p className="text-[10px] text-white/25 mt-1">Desde {fmtFecha(titularActual.fecha_inicio)}</p>
        </div>
      )}

      {titularidades.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Historial de titularidades ({titularidades.length})
          </p>
          <div className="space-y-1.5">
            {titularidades.map((t, i) => (
              <div key={i} className="bg-[#0c1929] border border-white/6 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-white/70 font-semibold truncate">{t.puesto_nombre ?? `Puesto #${t.puesto_id}`}</p>
                    <p className="text-[10px] text-white/35">{t.cliente_nombre}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-white/40">{fmtFecha(t.fecha_inicio)}</p>
                    <p className="text-[10px] text-white/25">{t.fecha_fin ? `→ ${fmtFecha(t.fecha_fin)}` : "→ Actual"}</p>
                  </div>
                </div>
                {t.motivo && <p className="text-[10px] text-white/25 mt-1">Motivo: {t.motivo}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {fechasOrdenadas.length > 0 ? (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <History className="w-3 h-3" /> Coberturas realizadas ({coberturas.length})
          </p>
          <div className="space-y-3">
            {fechasOrdenadas.map(fecha => {
              const items = coberturasPorFecha[fecha];
              const tieneHE = items.some(c => c.genera_horas_extra);
              return (
                <div key={fecha} className="bg-[#0c1929] border border-white/6 rounded-xl overflow-hidden">
                  <div className={`flex items-center justify-between px-3 py-2 border-b ${tieneHE ? "border-amber-500/15 bg-amber-500/3" : "border-white/5"}`}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-white/25" />
                      <span className="text-xs font-semibold text-white/60">{fmtFecha(fecha)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {tieneHE && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold">HE</span>}
                      <span className="text-[10px] text-white/25">{items.length} asignación{items.length !== 1 ? "es" : ""}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-white/4">
                    {items.map((c, idx) => {
                      const cfg = TIPO_COBERTURA_LABELS[c.tipo_cobertura] ?? { label: c.tipo_cobertura, color: "text-white/50", bg: "bg-white/5 border-white/10" };
                      return (
                        <div key={idx} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${cfg.bg} ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <p className="text-xs text-white/70 truncate">{c.puesto_nombre ?? `Puesto #${c.puesto_id}`}</p>
                            </div>
                            {c.hora_inicio && c.hora_fin && (
                              <span className="text-[10px] text-white/30 shrink-0">{c.hora_inicio} – {c.hora_fin}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/35">{c.cliente_nombre}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {c.horas_calculadas != null && (
                              <span className="text-[9px] text-white/25">{Number(c.horas_calculadas).toFixed(1)}h</span>
                            )}
                            {c.genera_horas_extra && (
                              <span className="text-[9px] text-amber-400/70 font-bold">+HE {c.horas_extra_calculadas != null ? `${Number(c.horas_extra_calculadas).toFixed(1)}h` : ""}</span>
                            )}
                            {c.fue_en_dia_descanso && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300/60">Día descanso</span>
                            )}
                            {c.cubriendo_a_nombre && (
                              <span className="text-[9px] text-white/20">Cubriendo a: {c.cubriendo_a_nombre}</span>
                            )}
                          </div>
                          {c.motivo && <p className="text-[9px] text-white/20 mt-0.5">Motivo: {c.motivo}</p>}
                          {c.observaciones && <p className="text-[9px] text-white/15 italic mt-0.5">{c.observaciones}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !titularActual && titularidades.length === 0 && (
          <div className="text-center py-14">
            <History className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Sin historial de asignaciones en este período</p>
            <p className="text-white/15 text-xs mt-1">Ajusta las fechas para ver más registros.</p>
          </div>
        )
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

// ─── Tab: Vacaciones ──────────────────────────────────────────────────────────

interface VacSaldo {
  id: number;
  nombre_completo: string;
  fecha_ingreso: string;
  sueldo_base: string;
  estado_laboral: string;
  dias_servicio: number;
  anios_servicio: number;
  fecha_aniversario: string;
  dias_para_aniversario: number;
  es_elegible: boolean;
  dias_ganados_proporcional: string;
  dias_ganados_completo: number;
  total_autorizados: number;
  balance_proporcional: string;
  balance_completo: number;
  es_anticipada: boolean;
  dias_en_deuda: string;
  tasa_diaria: string;
  monto_en_deuda: string;
  vacacion_activa: {
    id: number; tipo_evento: string;
    fecha_inicio: string; fecha_fin: string | null;
    estado: string; dias: number;
  } | null;
  historial: Array<{
    id: number; tipo_evento: string;
    fecha_inicio: string; fecha_fin: string | null;
    estado: string; observaciones: string | null; dias: number;
  }> | null;
}

const TIPO_VAC_LABEL: Record<string, string> = {
  vacaciones:             "Vacaciones",
  vacaciones_programadas: "Programadas",
  vacaciones_trabajadas:  "Trabajadas",
};

const VAC_TIPO_COLOR: Record<string, string> = {
  vacaciones:             "bg-green-400/10 text-green-300 border-green-400/20",
  vacaciones_programadas: "bg-blue-400/10 text-blue-300 border-blue-400/20",
  vacaciones_trabajadas:  "bg-amber-400/10 text-amber-300 border-amber-400/20",
};

const VAC_EST_COLOR: Record<string, string> = {
  aprobado:   "text-green-400",
  pendiente:  "text-yellow-400",
  completado: "text-blue-400",
  cancelado:  "text-white/30 line-through",
  anulado:    "text-white/20 line-through",
};

function fmtFechaVac(d: string | null | undefined) {
  if (!d) return "—";
  const s = d.length <= 10 ? d + "T00:00:00Z" : d;
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

function TabVacaciones({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const sess       = () => getSessionToken();
  const userNombre = (() => { try { return JSON.parse(sess()).nombre ?? "rrhh"; } catch { return "rrhh"; } })();

  const [modalOpen, setModalOpen]     = useState(false);
  const [tipo, setTipo]               = useState<"vacaciones" | "vacaciones_programadas" | "vacaciones_trabajadas">("vacaciones");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin]       = useState("");
  const [obs, setObs]                 = useState("");
  const [saving, setSaving]           = useState(false);
  const [confirmarAnticipada, setConfirmarAnticipada] = useState(false);

  const { data: saldo, isLoading, isError, refetch } = useQuery<VacSaldo>({
    queryKey: ["vac-saldo-emp", emp.id],
    queryFn:  () => fetch(`${API_BASE}/vacaciones/saldo/${emp.id}`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 30_000,
  });

  function calcDiasHabiles(ini: string, fin: string): number {
    if (!ini || !fin) return 0;
    let count = 0;
    const cur = new Date(ini + "T12:00:00Z");
    const end = new Date(fin + "T12:00:00Z");
    while (cur <= end) { if (cur.getUTCDay() !== 0) count++; cur.setUTCDate(cur.getUTCDate() + 1); }
    return count;
  }

  const diasSolicitados = fechaInicio && fechaFin ? calcDiasHabiles(fechaInicio, fechaFin) : (fechaInicio ? 1 : 0);
  const balanceProp     = saldo ? parseFloat(saldo.balance_proporcional) : 0;
  const esAnticipada    = tipo === "vacaciones" && diasSolicitados > 0 && diasSolicitados > balanceProp;

  async function handleRegistrar() {
    if (!fechaInicio) {
      toast({ title: "Fecha requerida", description: "Indica la fecha de inicio.", variant: "destructive" });
      return;
    }
    if (esAnticipada && !confirmarAnticipada) { setConfirmarAnticipada(true); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        employee_id:       emp.id,
        tipo,
        fecha_inicio:      fechaInicio,
        fecha_fin:         fechaFin || fechaInicio,
        observaciones:     obs || undefined,
        usuario:           userNombre,
        forzar_anticipada: esAnticipada,
      };
      const r = await fetch(`${API_BASE}/vacaciones`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": sess() },
        body:    JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error al registrar");
      toast({ title: "Vacaciones registradas", description: data.mensaje ?? "Evento creado." });
      setModalOpen(false);
      setFechaInicio(""); setFechaFin(""); setObs("");
      setConfirmarAnticipada(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["vacaciones-lista"] });
      qc.invalidateQueries({ queryKey: ["vacaciones-elegibilidad"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const fmtQ = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );
  if (isError || !saldo) return (
    <div className="text-center py-12 text-white/30 text-sm">Error al cargar saldo de vacaciones.</div>
  );

  const proporcional = parseFloat(saldo.dias_ganados_proporcional);
  const tasaDiaria   = parseFloat(saldo.tasa_diaria);

  return (
    <div className="space-y-4">

      {/* ── Encabezado ── */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-primary" /> Estado de Vacaciones
          </h3>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-primary text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Autorizar
          </button>
        </div>

        {saldo.es_elegible ? (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Colaborador apto — {saldo.anios_servicio} año{saldo.anios_servicio !== 1 ? "s" : ""} de servicio
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <Info className="w-3.5 h-3.5" />
            Aún no cumple 1 año · aniversario {fmtFechaVac(saldo.fecha_aniversario)}
            {saldo.dias_para_aniversario > 0 && ` (faltan ${saldo.dias_para_aniversario} días)`}
          </div>
        )}

        {saldo.vacacion_activa && (
          <div className="bg-green-500/10 border border-green-400/20 rounded-lg px-3 py-2 text-xs text-green-300 flex items-center gap-2">
            <Umbrella className="w-3.5 h-3.5 shrink-0" />
            {TIPO_VAC_LABEL[saldo.vacacion_activa.tipo_evento]} desde {fmtFechaVac(saldo.vacacion_activa.fecha_inicio)}
            {saldo.vacacion_activa.fecha_fin && ` al ${fmtFechaVac(saldo.vacacion_activa.fecha_fin)}`}
            {" · "}{saldo.vacacion_activa.dias} días hábiles
          </div>
        )}

        {saldo.es_anticipada && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {parseFloat(saldo.dias_en_deuda).toFixed(1)} día(s) anticipados en deuda
            — se recuperarán {fmtQ.format(parseFloat(saldo.monto_en_deuda))} en liquidación
          </div>
        )}
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Ganado proporcional", value: proporcional.toFixed(1), color: "text-primary" },
          { label: "Total autorizado",    value: saldo.total_autorizados, color: "text-white" },
          { label: "Balance disponible",  value: Math.max(0, balanceProp).toFixed(1),
            color: balanceProp < 0 ? "text-red-400" : "text-green-400" },
        ].map((m) => (
          <div key={m.label} className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-white/50 mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-white/30 text-center">
        Tasa diaria: {fmtQ.format(tasaDiaria)} · sueldo {fmtQ.format(parseFloat(saldo.sueldo_base))}
      </div>

      {/* ── Historial ── */}
      {saldo.historial && saldo.historial.length > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/8">
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Historial
            </h4>
          </div>
          <div className="divide-y divide-white/5">
            {saldo.historial.map((ev) => (
              <div key={ev.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${VAC_TIPO_COLOR[ev.tipo_evento] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                  {TIPO_VAC_LABEL[ev.tipo_evento] ?? ev.tipo_evento}
                </span>
                <span className="text-xs text-white/70 flex-1">
                  {fmtFechaVac(ev.fecha_inicio)}
                  {ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio && ` → ${fmtFechaVac(ev.fecha_fin)}`}
                  <span className="text-white/30"> · {ev.dias} días</span>
                </span>
                <span className={`text-[10px] font-medium ${VAC_EST_COLOR[ev.estado] ?? "text-white/40"}`}>
                  {ev.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/8">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Umbrella className="w-4 h-4 text-primary" /> Autorizar Vacaciones
                <span className="text-xs font-normal text-white/40 ml-1">— {emp.nombreCompleto}</span>
              </h3>
              <button onClick={() => { setModalOpen(false); setConfirmarAnticipada(false); }}
                className="text-white/40 hover:text-white/70"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">

              {/* Alerta confirmación anticipada */}
              {confirmarAnticipada && (
                <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Vacaciones anticipadas
                  </div>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Autorizas <strong>{diasSolicitados} días</strong> pero el colaborador
                    solo ha ganado <strong>{balanceProp.toFixed(1)} días</strong> proporcionalmente.
                    El excedente de <strong>{(diasSolicitados - balanceProp).toFixed(1)} días</strong>
                    {" "}({fmtQ.format((diasSolicitados - balanceProp) * tasaDiaria)}) se
                    <strong> recuperará automáticamente en la liquidación</strong> si se
                    da de baja antes de haber ganado ese tiempo.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmarAnticipada(false)}
                      className="flex-1 text-xs text-white/50 border border-white/10 rounded-lg py-1.5 hover:bg-white/5">
                      Regresar
                    </button>
                    <button onClick={handleRegistrar} disabled={saving}
                      className="flex-1 text-xs bg-amber-500 text-black font-semibold rounded-lg py-1.5 hover:bg-amber-400 flex items-center justify-center gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Confirmar anticipadas
                    </button>
                  </div>
                </div>
              )}

              {!confirmarAnticipada && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/50">Tipo de evento</label>
                    <select value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setConfirmarAnticipada(false); }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                      <option value="vacaciones">Vacaciones (goce inmediato)</option>
                      <option value="vacaciones_programadas">Vacaciones programadas (a futuro)</option>
                      <option value="vacaciones_trabajadas">Vacaciones trabajadas (laboró en período)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/50">Fecha inicio</label>
                      <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/50">Fecha fin</label>
                      <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} min={fechaInicio}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
                    </div>
                  </div>

                  {diasSolicitados > 0 && (
                    <div className={`rounded-lg px-3 py-2 text-xs flex items-center justify-between border ${
                      esAnticipada
                        ? "bg-amber-500/10 border-amber-400/30 text-amber-300"
                        : "bg-green-500/10 border-green-400/20 text-green-300"}`}>
                      <span>{diasSolicitados} día{diasSolicitados !== 1 ? "s" : ""} hábil{diasSolicitados !== 1 ? "es" : ""} seleccionado{diasSolicitados !== 1 ? "s" : ""}</span>
                      {esAnticipada
                        ? <span className="flex items-center gap-1 font-medium"><AlertTriangle className="w-3 h-3" /> Anticipada</span>
                        : <span className="flex items-center gap-1 font-medium"><CheckCircle2 className="w-3 h-3" /> Dentro del saldo</span>}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs text-white/50">Observaciones (opcional)</label>
                    <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                      placeholder="Motivo, instrucciones adicionales…"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-primary/50" />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setModalOpen(false)}
                      className="flex-1 text-xs text-white/50 border border-white/10 rounded-lg py-2 hover:bg-white/5">
                      Cancelar
                    </button>
                    <button onClick={handleRegistrar} disabled={saving || !fechaInicio}
                      className="flex-1 text-xs bg-primary text-black font-semibold rounded-lg py-2 hover:bg-primary/90 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {esAnticipada ? "Revisar · es anticipada" : "Autorizar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function TabAnticipo({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editandoLimite, setEditandoLimite] = useState(false);
  const [nuevoLimite, setNuevoLimite] = useState<string>("");
  const [guardandoLimite, setGuardandoLimite] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<AnticiposEmpleadoData>({
    queryKey: ["employee-anticipos", emp.id],
    queryFn: () => fetch(`${API_BASE}/employees/${emp.id}/anticipos`, { headers: sessionHeader() }).then((r) => r.json()),
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
        headers: { "Content-Type": "application/json", ...sessionHeader() },
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
  const getSession = () => getSessionToken();
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
  const getSession = () => getSessionToken();
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

// ─── Modal: Dar de Baja a Empleado (desde ficha) ─────────────────────────────

// ─── Tab: Indemnización (historial disciplinario + aviso al inspector) ────────

interface CausaJusta {
  causal: string;
  articulo: string;
  descripcion: string;
  evidencia: string[];
}

interface EvalCausaJusta {
  sugerencia: string;
  causas: CausaJusta[];
  resumen: {
    total_faltas: number;
    faltas_mes_actual: number;
    llamadas_atencion_1: number;
    llamadas_atencion_2: number;
    actas_previas: number;
    total_eventos: number;
  };
}

interface HistDisciplinario {
  fecha: string;
  tipo_evento: string;
  observaciones: string | null;
  notas: string | null;
  numero_acta: number | null;
}

const LABEL_TIPO_EVENTO: Record<string, string> = {
  falta: "Falta",
  falta_injustificada: "Falta Injustificada",
  llamada_atencion_1: "Llamada de Atención 1 (verbal)",
  llamada_atencion_2: "Llamada de Atención 2 (escrita)",
  acta_administrativa: "Acta Administrativa",
  amonestacion: "Amonestación",
  suspension: "Suspensión",
  suspension_disciplinaria: "Suspensión Disciplinaria",
  abandono_parcial: "Abandono Parcial",
};

function TabIndemnizacion({ emp }: { emp: Empleado }) {
  const { toast } = useToast();
  const hdr = () => ({ "Content-Type": "application/json", "x-isp-session": getSessionToken() });
  const [evalData, setEvalData] = useState<EvalCausaJusta | null>(null);
  const [historial, setHistorial] = useState<HistDisciplinario[]>([]);
  const [loading, setLoading] = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/empleados/${emp.id}/evaluar-causa-justa`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/empleados/${emp.id}/historial-disciplinario`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
    ]).then(([ev, hist]) => {
      setEvalData(ev);
      setHistorial(hist?.historial ?? []);
    }).finally(() => setLoading(false));
  }, [emp.id]);

  async function handleGenerarAviso() {
    setGenerandoPdf(true);
    try {
      const { generarAvisoInspector } = await import("@/lib/pdfRrhh");
      const [configRes, numRes] = await Promise.all([
        fetch(`${API_BASE}/actas/datos-para-pdf/${emp.id}`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/actas/siguiente-numero`, { method: "POST", headers: hdr() }).then(r => r.ok ? r.json() : { numero: 0 }),
      ]);
      const cfg = configRes?.config || {};
      const empData = configRes?.empleado || {};
      const puesto = configRes?.puesto || {};
      const eventos = (configRes?.eventos_recientes || [])
        .filter((e: any) => ["falta","falta_injustificada","llamada_atencion_1","llamada_atencion_2","acta_administrativa","amonestacion","suspension","suspension_disciplinaria"].includes(e.tipo_evento))
        .slice(0, 15);

      const causaTexto = evalData?.causas?.map(c => `${c.descripcion} (${c.articulo})`).join("; ") || "Incumplimiento laboral reiterado";

      const datos: DatosActa = {
        numero_acta: numRes.numero || 0,
        representante_nombre: cfg.representante_nombre || "Representante Legal",
        representante_dpi: cfg.representante_dpi || "",
        direccion_empresa: cfg.direccion_empresa || "14 calle 15-52 zona 1, Barrio Gerona, Ciudad de Guatemala",
        nombre_empresa: cfg.nombre_empresa || "Investigaciones y Seguridad Profesional S.A.",
        empleado_nombre: empData.nombre_completo || emp.nombreCompleto,
        empleado_dpi: empData.dpi || emp.dpi || "",
        empleado_fecha_ingreso: empData.fecha_ingreso || emp.fechaIngreso || "",
        empleado_cargo: empData.cargo || "Agente de Seguridad",
        puesto_nombre: puesto.puesto_nombre || "",
        cliente_nombre: puesto.cliente_nombre || "",
        fecha_evento: new Date().toISOString().split("T")[0],
        hechos: causaTexto,
        notas_sistema: evalData?.causas?.flatMap(c => c.evidencia) || [],
        causal: causaTexto,
        articulo_legal: evalData?.causas?.[0]?.articulo || "Art. 77 del Código de Trabajo",
        eventos_historial: eventos.map((e: any) => ({ fecha: e.fecha, tipo: e.tipo_evento, notas: e.notas || e.observaciones || "" })),
      };

      await generarAvisoInspector(datos);
      toast({ title: "Aviso al Inspector generado", description: `Con historial de ${eventos.length} eventos disciplinarios` });
    } catch (err) {
      toast({ title: "Error al generar PDF", variant: "destructive", description: String(err) });
    } finally { setGenerandoPdf(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {evalData && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4 text-amber-400" />
            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Evaluación de Causa Justa</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white">{evalData.resumen.total_faltas}</p>
              <p className="text-[10px] text-white/40">Faltas Totales</p>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-300">{evalData.resumen.llamadas_atencion_1 + evalData.resumen.llamadas_atencion_2}</p>
              <p className="text-[10px] text-white/40">Llamadas Atención</p>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-300">{evalData.resumen.actas_previas}</p>
              <p className="text-[10px] text-white/40">Actas Previas</p>
            </div>
          </div>

          {evalData.causas.length > 0 ? (
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-red-300 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Causas Justas Detectadas ({evalData.causas.length})
              </p>
              {evalData.causas.map((c, i) => (
                <div key={i} className="bg-white/3 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80">{c.descripcion}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20 font-mono">{c.articulo}</span>
                  </div>
                  {c.evidencia.length > 0 && (
                    <div className="text-[10px] text-white/30 space-y-0.5 pl-2 border-l border-white/8">
                      {c.evidencia.slice(0, 3).map((e, j) => <p key={j}>{e}</p>)}
                      {c.evidencia.length > 3 && <p className="text-white/20">+{c.evidencia.length - 3} más</p>}
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-white/30 italic">
                Sugerencia del sistema: <span className="text-amber-300 font-semibold">{evalData.sugerencia === "despido_justificado" ? "Despido Justificado" : "Despido Injustificado"}</span>
                {" — "}la decisión final es del administrador.
              </p>
            </div>
          ) : (
            <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-xs text-green-300/80">No se detectan causas justas de despido en el historial de este colaborador.</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-white/40" />
            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Historial Disciplinario</p>
          </div>
          <span className="text-[10px] text-white/30">{historial.length} registros</span>
        </div>

        {historial.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-white/10 mb-2" />
            <p className="text-white/30 text-xs">Sin registros disciplinarios</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {historial.map((h, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-white/3 border border-white/6">
                <div className="shrink-0 text-right w-16">
                  <p className="text-[10px] text-white/40">{new Date(h.fecha).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70">{LABEL_TIPO_EVENTO[h.tipo_evento] || h.tipo_evento}</p>
                  {(h.notas || h.observaciones) && (
                    <p className="text-[10px] text-white/30 truncate">{h.notas || h.observaciones}</p>
                  )}
                </div>
                {h.numero_acta && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono shrink-0">#{h.numero_acta}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleGenerarAviso}
        disabled={generandoPdf}
        className="w-full py-2.5 flex items-center justify-center gap-2 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-semibold transition-colors disabled:opacity-50"
      >
        {generandoPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        Generar Aviso al Inspector de Trabajo
      </button>
    </div>
  );
}

// ─── Modal: Dar de Baja a Empleado (desde ficha) ─────────────────────────────

const TIPO_EGRESO_BAJA = [
  { v: "renuncia",               l: "Renuncia Voluntaria" },
  { v: "despido_justificado",    l: "Despido Justificado" },
  { v: "despido_injustificado",  l: "Despido Injustificado" },
  { v: "mutuo_acuerdo",          l: "Mutuo Acuerdo" },
  { v: "finalizacion_contrato",  l: "Finalización de Contrato" },
];

interface RubroBaja { rubro: string; descripcion: string; monto: number; }
interface SimBaja {
  empleado_nombre: string; tipo_egreso: string; fecha_egreso: string;
  rubros: RubroBaja[]; totalGeneral: number;
}

// ─── Modal: Suspender empleado (pide rango de fechas + motivo) ───────────────
// Cuando se cambia estado a "suspendido" desde la ficha, debe crear el
// evento RRHH equivalente al de RRHH > Eventos para que la nómina descuente
// los días y aparezca en planilla IGSS con fechas reales.
function ModalSuspenderEmpleado({
  emp, onClose, onConfirm,
}: {
  emp: Empleado;
  onClose: () => void;
  onConfirm: (extras: { fechaDesde: string; fechaHasta: string; observaciones: string }) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const in7d  = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; })();
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(in7d);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);

  const dias = (() => {
    if (!fechaDesde || !fechaHasta || fechaDesde > fechaHasta) return 0;
    const a = new Date(fechaDesde + "T00:00:00");
    const b = new Date(fechaHasta + "T00:00:00");
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  })();

  function submit() {
    if (!fechaDesde || !fechaHasta) { setError("Ambas fechas son requeridas"); return; }
    if (fechaDesde > fechaHasta)   { setError("La fecha desde no puede ser mayor que la fecha hasta"); return; }
    onConfirm({ fechaDesde, fechaHasta, observaciones: observaciones.trim() });
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500/40";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-amber-500/20 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Suspender Colaborador</p>
            <p className="text-[11px] text-white/40 truncate">{emp.nombreCompleto}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-300/80">
              Se creará un <span className="font-semibold">evento RRHH de suspensión aprobado</span> con las fechas indicadas. Los días del rango se descontarán automáticamente en nómina y planilla IGSS.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Suspensión desde</label>
              <input type="date" value={fechaDesde} onChange={(e) => { setError(null); setFechaDesde(e.target.value); }} className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Suspensión hasta</label>
              <input type="date" value={fechaHasta} onChange={(e) => { setError(null); setFechaHasta(e.target.value); }} min={fechaDesde} className={inputCls} />
            </div>
          </div>

          {dias > 0 && (
            <div className="text-[11px] text-white/50 text-center">
              <span className="text-amber-300 font-semibold">{dias}</span> {dias === 1 ? "día" : "días"} de suspensión
            </div>
          )}

          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Motivo / observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Ej. Suspensión por incumplimiento de procedimientos..."
              className={inputCls + " resize-none"}
            />
          </div>

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/60 transition-colors">
              Cancelar
            </button>
            <button onClick={submit} className="flex-1 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-semibold transition-colors">
              Confirmar suspensión
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalBajaEmpleado({
  emp, onClose, onSuccess,
}: {
  emp: Empleado;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep]           = useState<"form" | "preview">("form");
  const [tipoEgreso, setTipo]     = useState("renuncia");
  const [fechaEgreso, setFecha]   = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading]     = useState(false);
  const [sim, setSim]             = useState<SimBaja | null>(null);
  const [evalCausa, setEvalCausa] = useState<EvalCausaJusta | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const sess = () => getSessionToken();
  const hdr  = () => ({ "Content-Type": "application/json", "x-isp-session": sess() });

  useEffect(() => {
    setEvalLoading(true);
    fetch(`${API_BASE}/empleados/${emp.id}/evaluar-causa-justa`, { headers: hdr() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setEvalCausa(data);
        if (data?.sugerencia && data.sugerencia !== tipoEgreso) {
          setTipo(data.sugerencia);
        }
      })
      .finally(() => setEvalLoading(false));
  }, [emp.id]);

  async function handleSimular() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/prestaciones/simular-liquidacion`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ employee_id: emp.id, tipo_egreso: tipoEgreso, fecha_egreso: fechaEgreso }),
      }).then(async (res) => { if (!res.ok) throw new Error((await res.json()).error ?? "Error"); return res.json(); });
      setSim({
        empleado_nombre: r.nombre_completo,
        tipo_egreso: tipoEgreso,
        fecha_egreso: fechaEgreso,
        rubros: r.liquidacion?.rubros ?? [],
        totalGeneral: r.liquidacion?.totalGeneral ?? 0,
      });
      setStep("preview");
    } catch (e: unknown) {
      toast({ title: "Error al calcular", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleConfirmar() {
    if (!sim) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/prestaciones/liquidaciones`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ employee_id: emp.id, tipo_egreso: tipoEgreso, fecha_egreso: fechaEgreso }),
      }).then(async (res) => { if (!res.ok) throw new Error((await res.json()).error ?? "Error"); return res.json(); });
      toast({ title: "Baja confirmada", description: `${emp.nombreCompleto} ha sido dado de baja y su liquidación ha sido registrada.` });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error al confirmar baja", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-orange-500/20 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <UserX className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Dar de Baja a Colaborador</p>
            <p className="text-[11px] text-white/40 truncate">{emp.nombreCompleto}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Banner de advertencia */}
          <div className="flex items-start gap-2 bg-orange-500/8 border border-orange-500/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-orange-300/80">
              Esta acción marcará al colaborador como <span className="font-semibold text-orange-300">BAJA</span> y generará su liquidación final conforme a la ley guatemalteca.
            </p>
          </div>

          {step === "form" && (
            <>
              {/* Info del empleado */}
              <div className="bg-white/3 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/40">Colaborador</span>
                  <span className="text-white/80 font-medium">{emp.nombreCompleto}</span>
                </div>
                {emp.puesto && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Puesto</span>
                    <span className="text-white/60">{emp.puesto}</span>
                  </div>
                )}
                {emp.sueldoBase && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Sueldo Base</span>
                    <span className="text-white/60">{fmtQ(Number(emp.sueldoBase))}</span>
                  </div>
                )}
                {emp.fechaIngreso && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Ingreso</span>
                    <span className="text-white/60">{fmtFecha(emp.fechaIngreso)}</span>
                  </div>
                )}
              </div>

              {/* Sugerencia del sistema */}
              {evalLoading ? (
                <div className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />
                  <span className="text-xs text-white/30">Evaluando historial...</span>
                </div>
              ) : evalCausa && evalCausa.causas.length > 0 ? (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5 space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Sugerencia del Sistema
                  </p>
                  <p className="text-[11px] text-white/50">
                    Se detectaron <span className="text-amber-300 font-semibold">{evalCausa.causas.length}</span> causa(s) justa(s).
                    {" "}Recomendación: <span className="text-amber-300 font-semibold">{evalCausa.sugerencia === "despido_justificado" ? "Despido Justificado" : "Despido Injustificado"}</span>.
                  </p>
                  <div className="space-y-1">
                    {evalCausa.causas.slice(0, 3).map((c, i) => (
                      <p key={i} className="text-[10px] text-white/30 pl-2 border-l-2 border-amber-500/20">
                        {c.descripcion} — <span className="font-mono text-amber-300/60">{c.articulo}</span>
                      </p>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/20 italic">
                    Resumen: {evalCausa.resumen.total_faltas} faltas, {evalCausa.resumen.llamadas_atencion_1 + evalCausa.resumen.llamadas_atencion_2} llamadas atención, {evalCausa.resumen.actas_previas} actas previas.
                    La decisión final es suya.
                  </p>
                </div>
              ) : evalCausa ? (
                <div className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span className="text-[11px] text-white/40">Sin causas justas detectadas en el historial.</span>
                </div>
              ) : null}

              {/* Tipo de egreso */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Motivo de Egreso</label>
                <select value={tipoEgreso} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                  {TIPO_EGRESO_BAJA.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Fecha de baja */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Fecha de Baja</label>
                <input type="date" value={fechaEgreso} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 py-2 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSimular}
                  disabled={loading || !fechaEgreso}
                  className="flex-1 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Calcular Liquidación →
                </button>
              </div>
            </>
          )}

          {step === "preview" && sim && (
            <>
              {/* Desglose de rubros */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {sim.rubros.map((r) => (
                  <div key={r.rubro} className="flex items-start justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6 gap-2">
                    <span className="text-[11px] text-white/50 leading-tight">{r.descripcion}</span>
                    <span className="text-xs font-semibold text-white/80 shrink-0">{fmtQ(r.monto)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <span className="text-sm font-bold text-orange-300">TOTAL LIQUIDACIÓN</span>
                  <span className="text-base font-bold text-orange-300">{fmtQ(sim.totalGeneral)}</span>
                </div>
              </div>

              {/* Acción irreversible */}
              <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-300/80">
                  Al confirmar, <span className="font-semibold text-red-200">{emp.nombreCompleto}</span> quedará marcado como <span className="font-semibold text-red-200">BAJA</span> en el sistema. Esta acción es irreversible.
                </p>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep("form")} className="py-2 px-3 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-xl transition-colors">
                  ← Atrás
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={loading}
                  className="flex-1 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  Confirmar Baja y Liquidar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Ficha de Empleado (5 pestañas) ────────────────────────────────────

// ── TabAmonestacionesEmpleado ────────────────────────────────────────────────
function TabAmonestacionesEmpleado({ empId }: { empId: number }) {
  const [data, setData] = useState<any[] | "loading" | null>("loading");
  useEffect(() => {
    let cancel = false;
    fetch(`/api/amonestaciones/empleado/${empId}`, { headers: { "x-isp-session": getSessionToken() } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (!cancel) setData(j); })
      .catch(() => { if (!cancel) setData(null); });
    return () => { cancel = true; };
  }, [empId]);

  if (data === "loading") return <div className="text-white/40 text-sm">Cargando…</div>;
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-10 h-10 text-white/20 mx-auto mb-2" />
        <div className="text-white/50 text-sm">Sin amonestaciones registradas</div>
        <a href="/admin/rrhh/amonestaciones" className="text-amber-300 text-xs hover:underline mt-2 inline-block">
          Ir al módulo de amonestaciones →
        </a>
      </div>
    );
  }

  const totalEcon = data.filter(a => a.tipo === "economica" && a.estado === "activa").reduce((s, a) => s + Number(a.monto || 0), 0);
  const llamadas = data.filter(a => a.tipo === "llamada_atencion" && a.estado === "activa").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
          <div className="text-xs text-white/50">Total</div>
          <div className="text-lg text-white font-bold">{data.length}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
          <div className="text-xs text-blue-300">Llamadas atención</div>
          <div className="text-lg text-blue-200 font-bold">{llamadas}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-center">
          <div className="text-xs text-orange-300">Económicas activas</div>
          <div className="text-lg text-orange-200 font-bold">Q {totalEcon.toFixed(2)}</div>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((a: any) => (
          <div key={a.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.tipo === "economica" ? "bg-orange-500/15 text-orange-300" : "bg-blue-500/15 text-blue-300"}`}>
                    {a.tipo === "economica" ? "Económica" : "Llamada"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    a.estado === "anulada" ? "bg-gray-500/15 text-gray-300" :
                    a.descontado ? "bg-emerald-500/15 text-emerald-300" :
                    a.tipo === "economica" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-white/70"
                  }`}>
                    {a.estado === "anulada" ? "Anulada" : a.descontado ? "Descontada" : a.tipo === "economica" ? "Pendiente planilla" : "Activa"}
                  </span>
                  <span className="text-white/40 text-xs">{new Date(a.fecha).toLocaleDateString("es-GT")}</span>
                </div>
                <div className="text-white text-sm mt-1">{a.motivo}</div>
                {a.descripcion && <div className="text-white/60 text-xs mt-1">{a.descripcion}</div>}
                <div className="text-white/30 text-[10px] mt-1">
                  Por {a.creado_por_username || "—"} ({a.creado_por_rol})
                </div>
              </div>
              {a.tipo === "economica" && (
                <div className="text-orange-300 font-semibold tabular-nums">Q {Number(a.monto).toFixed(2)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TabSolicitudEmpleo ────────────────────────────────────────────────────────
function SolFila({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === "no" || value === "0") return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/30 text-xs w-40 shrink-0">{label}</span>
      <span className="text-white text-xs font-medium break-words flex-1">{value}</span>
    </div>
  );
}

function SolSeccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">{titulo}</p>
      {children}
    </div>
  );
}

function TabSolicitudEmpleo({ dpi, nombre }: { dpi: string; nombre: string }) {
  const [sol, setSol] = useState<Record<string, string> | null | "loading">("loading");

  useEffect(() => {
    if (!dpi) { setSol(null); return; }
    setSol("loading");
    fetch(`/api/solicitudes-empleo/by-dpi/${encodeURIComponent(dpi)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setSol(data))
      .catch(() => setSol(null));
  }, [dpi]);

  if (sol === "loading") return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  if (!sol) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <ClipboardList className="w-10 h-10 text-white/15" />
      <p className="text-white/40 text-sm">No se encontró solicitud de empleo asociada al DPI de este colaborador.</p>
      <p className="text-white/20 text-xs">Solo aparece si el colaborador llenó el formulario del kiosco.</p>
    </div>
  );

  const fecha = sol.created_at ? new Date(sol.created_at).toLocaleDateString("es-GT", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <span className="text-white/60 text-sm font-semibold">Formulario de Solicitud de Empleo</span>
        </div>
        <div className="flex items-center gap-2">
          {fecha && <span className="text-white/30 text-xs">{fecha}</span>}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-semibold uppercase">{sol.canal ?? "kiosco"}</span>
        </div>
      </div>

      {sol.foto_url && (
        <div className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl p-3">
          <img src={sol.foto_url} alt="Foto" className="w-14 h-14 rounded-full object-cover border-2 border-primary/40" />
          <div>
            <p className="text-white text-sm font-semibold">{nombre}</p>
            <p className="text-white/30 text-xs">Foto capturada en solicitud</p>
          </div>
        </div>
      )}

      <SolSeccion titulo="Datos Personales">
        <SolFila label="Plaza solicitada"     value={sol.puesto_solicitado} />
        <SolFila label="Nombre completo"      value={sol.nombre_completo} />
        <SolFila label="DPI"                  value={sol.dpi} />
        <SolFila label="Fecha de nacimiento"  value={sol.fecha_nacimiento} />
        <SolFila label="Género"               value={sol.genero} />
        <SolFila label="Estado civil"         value={sol.estado_civil} />
        <SolFila label="Nacionalidad"         value={sol.nacionalidad} />
        <SolFila label="Lugar de nacimiento"  value={sol.lugar_nacimiento} />
        <SolFila label="Profesión"            value={sol.profesion} />
        <SolFila label="Teléfono"             value={sol.telefono} />
        <SolFila label="Teléfono fijo"        value={sol.telefono_fijo} />
        <SolFila label="Correo"               value={sol.correo} />
        <SolFila label="NIT"                  value={sol.nit} />
        <SolFila label="IGSS"                 value={sol.igss} />
        <SolFila label="Grado de estudios"    value={sol.grado_estudios} />
      </SolSeccion>

      <SolSeccion titulo="Domicilio y Banco">
        <SolFila label="Dirección"            value={sol.direccion} />
        <SolFila label="Municipio"            value={sol.municipio} />
        <SolFila label="Departamento"         value={sol.departamento} />
        <SolFila label="Tiempo residencia"    value={sol.tiempo_residencia} />
        <SolFila label="Tipo vivienda"        value={sol.tipo_vivienda} />
        <SolFila label="Renta mensual"        value={sol.renta_mensual ? `Q${sol.renta_mensual}` : ""} />
        <SolFila label="Banco"                value={sol.banco} />
        <SolFila label="Tipo cuenta"          value={sol.tipo_cuenta} />
        <SolFila label="Núm. cuenta"          value={sol.num_cuenta} />
        <SolFila label="Forma de pago"        value={sol.forma_pago === "deposito" ? "Depósito a cuenta" : sol.forma_pago === "cheque" ? "Cheque" : sol.forma_pago} />
        <SolFila label="Licencia conducir"    value={sol.tiene_licencia === "si" ? `Sí — ${sol.tipo_licencia ?? ""} (vence: ${sol.vigencia_licencia ?? ""})` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Familia">
        <SolFila label="Padre"                value={sol.nombre_padre} />
        <SolFila label="Tel. padre"           value={sol.tel_padre} />
        <SolFila label="Madre"                value={sol.nombre_madre} />
        <SolFila label="Tel. madre"           value={sol.tel_madre} />
        <SolFila label="Cónyuge"              value={sol.nombre_conyuge} />
        <SolFila label="Ocupación cónyuge"    value={sol.ocup_conyuge} />
        <SolFila label="Tel. cónyuge"         value={sol.tel_conyuge} />
        <SolFila label="Dependientes"         value={sol.num_dependientes !== "0" ? sol.num_dependientes : ""} />
        <SolFila label="Hermano 1"            value={sol.hermano1_nombre} />
        <SolFila label="Hermano 2"            value={sol.hermano2_nombre} />
        <SolFila label="Facebook"             value={sol.facebook} />
        <SolFila label="Instagram"            value={sol.instagram} />
      </SolSeccion>

      <SolSeccion titulo="Salud">
        <SolFila label="Estatura"             value={sol.estatura ? `${sol.estatura} m` : ""} />
        <SolFila label="Peso"                 value={sol.peso ? `${sol.peso} kg` : ""} />
        <SolFila label="Enfermedad crónica"   value={sol.enfermedad_cronica === "si" ? `Sí — ${sol.enfermedad_det ?? ""}` : ""} />
        <SolFila label="Medicamentos"         value={sol.medicamento === "si" ? `Sí — ${sol.medicamento_det ?? ""}` : ""} />
        <SolFila label="Impedimento físico"   value={sol.impedimento_fisico === "si" ? `Sí — ${sol.impedimento_det ?? ""}` : ""} />
        <SolFila label="Consume alcohol"      value={sol.consume_alcohol === "si" ? "Sí" : ""} />
        <SolFila label="Consume drogas"       value={sol.consume_drogas === "si" ? "Sí" : ""} />
        <SolFila label="Tatuajes"             value={sol.tiene_tatuajes === "si" ? `Sí — ${sol.tatuajes_det ?? ""}` : ""} />
        <SolFila label="Contacto emergencia"  value={sol.nombre_contacto_emergencia} />
        <SolFila label="Tel. emergencia"      value={sol.telefono_emergencia} />
        <SolFila label="Parentesco"           value={sol.parentesco_emergencia} />
      </SolSeccion>

      <SolSeccion titulo="Antecedentes y Finanzas">
        <SolFila label="Proceso judicial"     value={sol.proceso_judicial === "si" ? `Sí — ${sol.proceso_det ?? ""}` : ""} />
        <SolFila label="Detenido antes"       value={sol.detenido === "si" ? `Sí — ${sol.detencion_det ?? ""}` : ""} />
        <SolFila label="Tiene deudas"         value={sol.tiene_deudas === "si" ? `Sí — ${sol.estado_deuda ?? ""}` : ""} />
        <SolFila label="Gastos mensuales"     value={sol.gastos_mensuales ? `Q${sol.gastos_mensuales}` : ""} />
        <SolFila label="Préstamo"             value={sol.tiene_prestamo === "si" ? `Sí — Q${sol.monto_prestamo ?? ""}` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Educación">
        <SolFila label="Primaria"             value={sol.prim_escuela ? `${sol.prim_escuela} (${sol.prim_lugar ?? ""}) — ${sol.prim_titulo ?? ""}` : ""} />
        <SolFila label="Básicos"              value={sol.bas_escuela ? `${sol.bas_escuela} (${sol.bas_lugar ?? ""}) — ${sol.bas_titulo ?? ""}` : ""} />
        <SolFila label="Diversificado"        value={sol.div_escuela ? `${sol.div_escuela} (${sol.div_lugar ?? ""}) — ${sol.div_titulo ?? ""}` : ""} />
        <SolFila label="Universidad"          value={sol.uni_escuela ? `${sol.uni_escuela} (${sol.uni_lugar ?? ""}) — ${sol.uni_titulo ?? ""}` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Experiencia Laboral">
        <SolFila label="Empresa 1"            value={sol.emp1_nombre ? `${sol.emp1_nombre} — ${sol.emp1_puesto ?? ""} (${sol.emp1_inicio ?? ""} – ${sol.emp1_fin ?? ""})` : ""} />
        <SolFila label="Empresa 2"            value={sol.emp2_nombre ? `${sol.emp2_nombre} — ${sol.emp2_puesto ?? ""} (${sol.emp2_inicio ?? ""} – ${sol.emp2_fin ?? ""})` : ""} />
        <SolFila label="Empresa 3"            value={sol.emp3_nombre ? `${sol.emp3_nombre} — ${sol.emp3_puesto ?? ""} (${sol.emp3_inicio ?? ""} – ${sol.emp3_fin ?? ""})` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Seguridad y Habilidades">
        <SolFila label="Exp. seguridad"       value={sol.experiencia_seguridad === "si" ? `Sí — ${sol.anios_experiencia ?? "0"} años` : ""} />
        <SolFila label="Empresa anterior"     value={sol.empresa_anterior} />
        <SolFila label="Tipos seguridad"      value={sol.tipos_seguridad} />
        <SolFila label="Servicio militar"     value={sol.servicio_militar === "si" ? `Sí — ${sol.rango_militar ?? ""}, ${sol.unidad_militar ?? ""}` : ""} />
        <SolFila label="Fue policía"          value={sol.fue_policia === "si" ? `Sí — ${sol.motivo_baja_policial ?? ""}` : ""} />
        <SolFila label="Habilidades"          value={sol.habilidades} />
        <SolFila label="Disponible rotativo"  value={sol.disp_rotativo === "si" ? "Sí" : ""} />
        <SolFila label="Disponible nocturno"  value={sol.disp_nocturno === "si" ? "Sí" : ""} />
        <SolFila label="Disponible fines sem." value={sol.disp_fds === "si" ? "Sí" : ""} />
        <SolFila label="Tiene vehículo"       value={sol.tiene_vehiculo === "si" ? "Sí" : ""} />
        <SolFila label="Licencia de armas"    value={sol.licencia_armas === "si" ? "Sí" : ""} />
        <SolFila label="Pretensión salarial"  value={sol.pretension_salarial ? `Q${sol.pretension_salarial}` : ""} />
        <SolFila label="Familiar en empresa"  value={sol.familiar_en_empresa === "si" ? `Sí — ${sol.nombre_familiar_empresa ?? ""}` : ""} />
        <SolFila label="Disp. exterior"       value={sol.disponible_exterior === "si" ? "Sí" : ""} />
      </SolSeccion>

      <SolSeccion titulo="Referencias Personales">
        <SolFila label="Referencia 1"         value={sol.ref1_nombre ? `${sol.ref1_nombre} — ${sol.ref1_ocupacion ?? ""} — ${sol.ref1_tel ?? ""}` : ""} />
        <SolFila label="Referencia 2"         value={sol.ref2_nombre ? `${sol.ref2_nombre} — ${sol.ref2_ocupacion ?? ""} — ${sol.ref2_tel ?? ""}` : ""} />
        <SolFila label="Referencia 3"         value={sol.ref3_nombre ? `${sol.ref3_nombre} — ${sol.ref3_ocupacion ?? ""} — ${sol.ref3_tel ?? ""}` : ""} />
      </SolSeccion>

      {(sol.dpi_frente_url || sol.dpi_reverso_url) && (
        <SolSeccion titulo="Imágenes DPI">
          <div className="flex gap-3 pt-1">
            {sol.dpi_frente_url && (
              <div className="flex-1">
                <p className="text-white/30 text-xs mb-1">Frente</p>
                <img src={sol.dpi_frente_url} alt="DPI frente" className="rounded-lg border border-white/10 w-full object-cover max-h-32" />
              </div>
            )}
            {sol.dpi_reverso_url && (
              <div className="flex-1">
                <p className="text-white/30 text-xs mb-1">Reverso</p>
                <img src={sol.dpi_reverso_url} alt="DPI reverso" className="rounded-lg border border-white/10 w-full object-cover max-h-32" />
              </div>
            )}
          </div>
        </SolSeccion>
      )}
    </div>
  );
}

// ─── Tab: Contratos del empleado ─────────────────────────────────────────────
function TabContratos({ emp }: { emp: Empleado }) {
  const { toast } = useToast();
  const [generando, setGenerando] = useState<"inicial" | "post_prueba" | null>(null);

  async function descargarContrato(tipo: "inicial" | "post_prueba") {
    setGenerando(tipo);
    try {
      // Cargar datos del empleado, contratos previos y patrono en paralelo
      const sess = getSessionToken();
      const [resEmp, resContratos, patrono] = await Promise.all([
        fetch(`${API_BASE}/employees/${emp.id}`),
        fetch(`${API_BASE}/employees/${emp.id}/contratos`, { headers: { "x-isp-session": sess } }),
        cargarPatronoDesdeConfig(),
      ]);
      const det = resEmp.ok ? await resEmp.json() : {};
      const contratosPrev: Array<{ tipo_contrato: string; fecha_inicio: string; sueldo_base: string | null }> =
        resContratos.ok ? await resContratos.json() : [];

      // Contrato más reciente como fuente de "valores heredados" (sueldo, etc.)
      const ultimoContrato = contratosPrev[0];

      const fechaIngreso = det.fecha_ingreso || emp.fechaIngreso || new Date().toISOString().slice(0, 10);
      // Fuente de verdad para la fecha de alta: SIEMPRE la ficha del
      // empleado (fecha_ingreso). NO heredar la fecha de un contrato
      // anterior, porque pudo haberse generado con datos viejos o con
      // un bug de zona horaria. Quitar la "T..." si llega en formato ISO
      // completo ("2026-04-28T00:00:00.000Z").
      const fechaAltaBase = String(fechaIngreso).split("T")[0];
      // Fecha de inicio que se imprime en el PDF:
      //  - Inicial (60 días prueba): fecha de alta + 2 meses.
      //  - Post-prueba (indefinido): fecha de alta original.
      let fechaInicio: string;
      if (tipo === "inicial") {
        const [yB, mB, dB] = fechaAltaBase.split("-").map(Number);
        const fechaPP = new Date(yB, (mB || 1) - 1, dB || 1);
        fechaPP.setMonth(fechaPP.getMonth() + 2);
        // Reconstruir YYYY-MM-DD usando getters LOCALES (no toISOString,
        // que convierte a UTC y puede desfasar el día en zonas como GT).
        const yy = fechaPP.getFullYear();
        const mm = String(fechaPP.getMonth() + 1).padStart(2, "0");
        const dd = String(fechaPP.getDate()).padStart(2, "0");
        fechaInicio = `${yy}-${mm}-${dd}`;
      } else {
        fechaInicio = fechaAltaBase;
      }

      // Sueldo: empleado → último contrato → ficha
      const sueldoStr =
        (emp.sueldoBase && emp.sueldoBase.trim()) ||
        (ultimoContrato?.sueldo_base && String(ultimoContrato.sueldo_base).trim()) ||
        (det.sueldo_base && String(det.sueldo_base).trim()) ||
        "0";

      const datos: DatosContratoLaboral = {
        empleado_nombre: emp.nombreCompleto,
        empleado_dpi: emp.dpi ?? det.dpi ?? "",
        empleado_estado_civil: det.estado_civil ?? undefined,
        empleado_direccion: det.direccion ?? undefined,
        empleado_telefono: emp.telefono ?? det.telefono ?? null,
        fecha_inicio: fechaInicio,
        puesto: emp.puesto ?? det.puesto ?? "Guardia de Seguridad",
        tipo_personal: emp.tipoPersonal ?? "guardia",
        sueldo_base: parseFloat(sueldoStr) || 0,
        tipo_contrato: tipo,
        patrono,
      };

      if (!datos.sueldo_base) {
        toast({ title: "Falta sueldo", description: "Asigna un sueldo base al empleado antes de generar el contrato.", variant: "destructive" });
        return;
      }

      await generarContratoLaboral(datos);
    } catch (err) {
      toast({ title: "Error", description: "No se pudo generar el contrato.", variant: "destructive" });
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <FileSignature className="w-4 h-4 text-emerald-400" />
        <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Contratos individuales de trabajo</p>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
        <p className="text-emerald-300 text-xs font-semibold mb-1">📄 Generador conforme al Código de Trabajo de Guatemala</p>
        <p className="text-white/50 text-[11px] leading-relaxed">
          Decreto 1441. Los contratos se generan con los datos del empleado y los datos del patrono configurados en el sistema.
          Imprime, firma con el trabajador y archiva una copia en el expediente.
        </p>
      </div>

      {/* Datos que se usarán */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
        <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Datos del empleado para el contrato</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div><span className="text-white/40">Nombre:</span> <span className="text-white/80">{emp.nombreCompleto}</span></div>
          <div><span className="text-white/40">DPI:</span> <span className="text-white/80 font-mono">{emp.dpi ?? "—"}</span></div>
          <div><span className="text-white/40">Puesto:</span> <span className="text-white/80">{emp.puesto ?? "—"}</span></div>
          <div><span className="text-white/40">Tipo:</span> <span className="text-white/80">{emp.tipoPersonal ?? "guardia"}</span></div>
          <div><span className="text-white/40">Sueldo:</span> <span className="text-white/80">{emp.sueldoBase ? `Q${Number(emp.sueldoBase).toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "— (requerido)"}</span></div>
          <div><span className="text-white/40">F. ingreso:</span> <span className="text-white/80">{emp.fechaIngreso ?? "—"}</span></div>
        </div>
      </div>

      {/* Botones de descarga */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => descargarContrato("inicial")}
          disabled={generando !== null}
          className="flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          {generando === "inicial" ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          <div className="text-left leading-tight">
            <div>Contrato Inicial</div>
            <div className="text-[10px] opacity-80 font-normal">60 días de prueba (Art. 81)</div>
          </div>
        </button>
        <button
          onClick={() => descargarContrato("post_prueba")}
          disabled={generando !== null}
          className="flex items-center justify-center gap-2 px-4 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          {generando === "post_prueba" ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          <div className="text-left leading-tight">
            <div>Contrato Post-Prueba</div>
            <div className="text-[10px] opacity-80 font-normal">Indefinido (Art. 25)</div>
          </div>
        </button>
      </div>

      <p className="text-yellow-500/80 text-[10px] italic">
        ⚠ Los datos del patrono (NIT, representante legal, dirección fiscal) se cargan desde la configuración del sistema.
        Si están en blanco, complétalos en el PDF a mano antes de firmar.
      </p>
    </div>
  );
}

// ─── PERS-SLOT-01: Pestaña "Plantilla de turno" para supervisores y administrativos ──
const DIAS_SEM_PLANTILLA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function lastMondayISO(fechaISO?: string): string {
  const d = fechaISO ? new Date(fechaISO + "T00:00:00") : new Date();
  const dow = d.getDay(); // 0=Dom .. 6=Sab
  const diff = dow === 0 ? -6 : 1 - dow; // retrocede al lunes
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

type PersonalSlot = {
  id: number;
  employee_id: number;
  tipo: "supervisor" | "administrativo";
  slot_numero: number;
  horas_turno: number;
  hora_entrada: string;
  hora_entrada_por_semana: string[] | null;
  dias_trabajo: number[];
  dias_medio_turno: number[] | null;
  longitud_ciclo: number;
  fecha_inicio_ciclo: string;
  notas: string | null;
  activo: boolean;
};

function semanasGrid(longitudCiclo: number): Array<Array<{ n: number; label: string }>> {
  const lc = [7, 14, 21, 28].includes(longitudCiclo) ? longitudCiclo : 14;
  const dias = Array.from({ length: lc }, (_, i) => ({ n: i + 1, label: DIAS_SEM_PLANTILLA[i % 7] }));
  const numSem = Math.ceil(lc / 7);
  return Array.from({ length: numSem }, (_, si) => dias.slice(si * 7, (si + 1) * 7));
}

function TabPlantillaPersonal({ emp }: { emp: Empleado }) {
  const { toast } = useToast();
  const tipoSlot: "supervisor" | "administrativo" =
    emp.tipoPersonal === "supervisor" ? "supervisor" : "administrativo";

  const [slots, setSlots] = useState<PersonalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [savingId, setSavingId] = useState<number | "new" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  // Form nuevo slot
  const [nLongitud, setNLongitud] = useState<number>(14);
  const [nHoras, setNHoras] = useState<number>(8);
  const [nHora, setNHora] = useState<string>("08:00");
  const [nFecha, setNFecha] = useState<string>(lastMondayISO());
  const [nDias, setNDias] = useState<number[]>([]);
  const [nNotas, setNNotas] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/personal/empleados/${emp.id}/slots`, { headers: sessionHeader() });
      if (r.ok) {
        const d = await r.json();
        setSlots(Array.isArray(d.slots) ? d.slots : []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [emp.id]);

  function resetForm() {
    setNLongitud(14); setNHoras(8); setNHora("08:00");
    setNFecha(lastMondayISO()); setNDias([]); setNNotas("");
  }

  function toggleDia(arr: number[], n: number): number[] {
    return arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n].sort((a, b) => a - b);
  }

  async function crear() {
    if (nDias.length === 0) {
      toast({ title: "Días requeridos", description: "Selecciona al menos un día de trabajo", variant: "destructive" });
      return;
    }
    setSavingId("new");
    try {
      const r = await fetch(`${API_BASE}/personal/empleados/${emp.id}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({
          tipo: tipoSlot,
          horas_turno: nHoras,
          hora_entrada: nHora,
          dias_trabajo: nDias,
          longitud_ciclo: nLongitud,
          fecha_inicio_ciclo: nFecha,
          notas: nNotas || null,
        }),
      });
      if (r.ok) {
        toast({ title: "Plantilla creada" });
        setShowForm(false);
        resetForm();
        await load();
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Error al crear", description: err.error || "Verifica los datos", variant: "destructive" });
      }
    } finally { setSavingId(null); }
  }

  async function actualizarDias(slot: PersonalSlot, nuevosDias: number[]) {
    setSavingId(slot.id);
    try {
      const r = await fetch(`${API_BASE}/personal-slots/${slot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ dias_trabajo: nuevosDias }),
      });
      if (r.ok) await load();
      else toast({ title: "Error al guardar", variant: "destructive" });
    } finally { setSavingId(null); }
  }

  async function eliminar(slot: PersonalSlot) {
    if (!confirm("¿Eliminar esta plantilla de turno?")) return;
    setSavingId(slot.id);
    try {
      const r = await fetch(`${API_BASE}/personal-slots/${slot.id}`, {
        method: "DELETE", headers: sessionHeader(),
      });
      if (r.ok) { toast({ title: "Plantilla eliminada" }); await load(); }
      else toast({ title: "Error al eliminar", variant: "destructive" });
    } finally { setSavingId(null); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-violet-400" />
          <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">
            Plantilla de turno {tipoSlot === "supervisor" ? "(supervisor)" : "(administrativo)"}
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-200 rounded-lg px-2.5 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Nueva plantilla
          </button>
        )}
      </div>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Define el patrón de trabajo del colaborador en un ciclo de 7, 14, 21 o 28 días.
        El día 1 del ciclo siempre es lunes. Los días marcados son los de trabajo; el resto son descanso.
        El pizarrón operativo usa esta plantilla para calcular si trabaja hoy o no.
      </p>

      {/* Form nueva plantilla */}
      {showForm && (
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-white/60">
              Longitud del ciclo
              <select value={nLongitud} onChange={e => { setNLongitud(Number(e.target.value)); setNDias([]); }}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white">
                {[7, 14, 21, 28].map(n => <option key={n} value={n}>{n} días</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              Horas de turno
              <select value={nHoras} onChange={e => setNHoras(Number(e.target.value))}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white">
                {[8, 12, 24].map(n => <option key={n} value={n}>{n} h</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              Hora de entrada
              <input type="time" value={nHora} onChange={e => setNHora(e.target.value)}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white" />
            </label>
            <label className="text-xs text-white/60">
              Inicio del ciclo (lunes)
              <input type="date" value={nFecha} onChange={e => setNFecha(lastMondayISO(e.target.value))}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white" />
            </label>
          </div>

          <div>
            <p className="text-xs text-white/60 mb-2">Días de trabajo en el ciclo</p>
            <div className="space-y-1.5">
              {semanasGrid(nLongitud).map((semana, si) => (
                <div key={si} className="flex gap-1.5">
                  <span className="text-[10px] text-white/30 w-6 pt-1.5">S{si + 1}</span>
                  {semana.map(d => {
                    const on = nDias.includes(d.n);
                    return (
                      <button key={d.n} type="button" onClick={() => setNDias(toggleDia(nDias, d.n))}
                        className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors ${
                          on ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                             : "bg-white/3 border-white/10 text-white/40 hover:bg-white/8"
                        }`}>
                        <div className="font-bold">{d.n}</div>
                        <div className="text-[9px] opacity-70">{d.label}</div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <label className="text-xs text-white/60 block">
            Notas (opcional)
            <input type="text" value={nNotas} onChange={e => setNNotas(e.target.value)} maxLength={200}
              className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white" />
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowForm(false); resetForm(); }} disabled={savingId === "new"}
              className="flex-1 py-2 text-xs text-white/60 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg">
              Cancelar
            </button>
            <button onClick={crear} disabled={savingId === "new" || nDias.length === 0}
              className="flex-1 py-2 text-xs text-white bg-violet-600/40 hover:bg-violet-600/60 border border-violet-500/40 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
              {savingId === "new" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Crear plantilla
            </button>
          </div>
        </div>
      )}

      {/* Slots existentes */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
      ) : slots.length === 0 ? (
        !showForm && (
          <div className="text-center py-8 text-white/40 text-xs border border-dashed border-white/10 rounded-xl">
            Sin plantilla de turno configurada
          </div>
        )
      ) : (
        slots.map((slot) => {
          const editing = editId === slot.id;
          const dias = editing ? slot.dias_trabajo : slot.dias_trabajo;
          return (
            <div key={slot.id} className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-white/70 space-y-0.5">
                  <div><span className="text-white/40">Slot:</span> #{slot.slot_numero} · {slot.horas_turno}h · entra {slot.hora_entrada?.slice(0, 5)}</div>
                  <div><span className="text-white/40">Ciclo:</span> {slot.longitud_ciclo} días desde {String(slot.fecha_inicio_ciclo).slice(0, 10)}</div>
                  {slot.notas && <div className="text-white/40 italic">{slot.notas}</div>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setEditId(editing ? null : slot.id)}
                    className="text-[10px] text-violet-300 hover:text-violet-100 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-md px-2 py-1">
                    {editing ? "Listo" : "Editar"}
                  </button>
                  <button onClick={() => eliminar(slot)} disabled={savingId === slot.id}
                    className="text-red-400/70 hover:text-red-300 bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 rounded-md p-1 disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {semanasGrid(slot.longitud_ciclo).map((semana, si) => (
                  <div key={si} className="flex gap-1.5">
                    <span className="text-[10px] text-white/30 w-6 pt-1.5">S{si + 1}</span>
                    {semana.map(d => {
                      const on = dias.includes(d.n);
                      const interactivo = editing;
                      const handler = interactivo
                        ? () => actualizarDias(slot, toggleDia(slot.dias_trabajo, d.n))
                        : undefined;
                      return (
                        <button key={d.n} type="button" disabled={!interactivo || savingId === slot.id} onClick={handler}
                          className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors ${
                            on ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                               : "bg-white/3 border-white/10 text-white/40"
                          } ${interactivo ? "hover:bg-emerald-500/35 cursor-pointer" : "cursor-default"}`}>
                          <div className="font-bold">{d.n}</div>
                          <div className="text-[9px] opacity-70">{d.label}</div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function FichaModal({
  emp,
  onClose,
  onEdit,
  onEstado,
}: {
  emp: Empleado;
  onClose: () => void;
  onEdit: (e: Empleado) => void;
  onEstado: (e: Empleado, estado: string, extras?: { fechaDesde?: string; fechaHasta?: string; observaciones?: string }) => void;
}) {
  const [tab, setTab] = useState<"perfil" | "asignacion-op" | "asignaciones" | "sistema" | "operacion" | "historial" | "kpi" | "anticipos" | "vacaciones" | "qr" | "solicitud" | "contratos" | "indemnizacion" | "amonestaciones" | "plantilla">("perfil");
  const [showEstado, setShowEstado] = useState(false);
  const [bajaModal, setBajaModal]   = useState(false);
  const [suspenderModal, setSuspenderModal] = useState(false);
  const est = ESTADO_LAB[emp.estadoLaboral] ?? { label: emp.estadoLaboral, color: "text-white/40 bg-white/5 border-white/10", dot: "bg-white/40" };

  const muestraPlantilla = emp.tipoPersonal === "supervisor" || emp.tipoPersonal === "administrativo";

  const tabs = [
    { key: "perfil",        label: "Perfil",         icon: UserCheck },
    { key: "asignacion-op", label: "Asignación",     icon: MapPinned },
    ...(muestraPlantilla ? [{ key: "plantilla" as const, label: "Plantilla de turno", icon: CalendarClock }] : []),
    { key: "vacaciones",    label: "Vacaciones",     icon: Sun },
    { key: "asignaciones",  label: "Portal",         icon: Briefcase },
    { key: "qr",            label: "Carnet QR",      icon: QrCode },
    { key: "sistema",       label: "Sistema",        icon: Lock },
    { key: "operacion",     label: "Operación",      icon: Activity },
    { key: "historial",     label: "Historial",      icon: History },
    { key: "kpi",           label: "KPI",            icon: BarChart2 },
    { key: "anticipos",     label: "Anticipos",      icon: Wallet },
    { key: "amonestaciones",label: "Amonestaciones", icon: AlertTriangle },
    { key: "indemnizacion", label: "Indemnización",  icon: Scale },
    { key: "contratos",     label: "Contratos",      icon: FileSignature },
    { key: "solicitud",     label: "Solicitud",      icon: ClipboardList },
  ] as const;

  // ── QR token state ─────────────────────────────────────────────────────────
  const [qrTokenData, setQrTokenData] = useState<{ id: number; qr_token: string } | null | "loading">("loading");
  const [generandoQr, setGenerandoQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== "qr") return;
    setQrTokenData("loading");
    fetch(`/api/agente/tokens`, { headers: sessionHeader() })
      .then(r => r.ok ? r.json() : [])
      .then((lista: Array<{ employee_id: number; qr_token: string | null; token_id: number | null }>) => {
        const found = lista.find(a => a.employee_id === emp.id);
        setQrTokenData(found?.token_id && found.qr_token ? { id: found.token_id, qr_token: found.qr_token } : null);
      })
      .catch(() => setQrTokenData(null));
  }, [tab, emp.id]);

  async function generarQr() {
    setGenerandoQr(true);
    try {
      const res = await fetch("/api/agente/tokens/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ employee_id: emp.id }),
      });
      const data = await res.json();
      if (data.ok && data.token) setQrTokenData({ id: data.token.id, qr_token: data.token.qr_token });
    } finally { setGenerandoQr(false); }
  }

  function descargarQr() {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const sz = 300;
    canvas.width = sz; canvas.height = sz;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, sz, sz); const a = document.createElement("a"); a.download = `qr-${emp.nombreCompleto}.png`; a.href = canvas.toDataURL(); a.click(); };
    img.src = "data:image/svg+xml;base64," + btoa(new XMLSerializer().serializeToString(svg));
  }

  const ESTADOS_CAMBIO = ["activo", "suspendido", "baja", "licencia"].filter((e) => e !== emp.estadoLaboral);

  const portal = createPortal(
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
                        onClick={() => {
                          setShowEstado(false);
                          if (e === "baja") {
                            setBajaModal(true);
                          } else if (e === "suspendido") {
                            setSuspenderModal(true);
                          } else {
                            onEstado(emp, e);
                          }
                        }}
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
          {tab === "plantilla" && <TabPlantillaPersonal emp={emp} />}
          {tab === "vacaciones" && <TabVacaciones emp={emp} />}
          {tab === "asignaciones" && <TabAsignaciones empId={emp.id} />}
          {tab === "solicitud" && <TabSolicitudEmpleo dpi={emp.dpi ?? ""} nombre={emp.nombreCompleto} />}
          {tab === "amonestaciones" && <TabAmonestacionesEmpleado empId={emp.id} />}
          {tab === "qr" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <QrCode className="w-4 h-4 text-blue-400" />
                <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Carnet QR del colaborador</p>
              </div>

              {qrTokenData === "loading" ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : qrTokenData ? (
                <>
                  <div className="flex flex-col items-center gap-4">
                    <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-xl">
                      <QRCodeSVG
                        value={`${window.location.origin}/agente?token=${qrTokenData.qr_token}`}
                        size={180}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-white/40 text-xs text-center max-w-xs leading-relaxed">
                      El agente escanea este código con cualquier cámara para fichar.
                    </p>
                  </div>

                  <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">Token activo</span>
                      <span className="text-green-400 text-xs font-semibold">● Activo</span>
                    </div>
                    <p className="text-white/30 text-xs font-mono break-all">{qrTokenData.qr_token}</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={descargarQr}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-semibold transition-colors">
                      <Download className="w-3.5 h-3.5" /> Descargar QR
                    </button>
                    <button onClick={generarQr} disabled={generandoQr}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-semibold transition-colors disabled:opacity-50">
                      {generandoQr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                      Regenerar QR
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/50 text-sm mb-1 font-semibold">Sin código QR</p>
                  <p className="text-white/30 text-xs mb-5">Este colaborador no tiene un código QR activo.</p>
                  <button onClick={generarQr} disabled={generandoQr}
                    className="px-6 py-2.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/25 rounded-xl text-sm text-blue-300 font-semibold flex items-center gap-2 mx-auto disabled:opacity-50 transition-colors">
                    {generandoQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    Generar código QR
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === "sistema" && <TabSistema emp={emp} />}
          {tab === "operacion" && <TabOperacion empId={emp.id} />}
          {tab === "historial" && <TabHistorialAsignaciones empId={emp.id} />}
          {tab === "kpi" && <TabKPI empId={emp.id} />}
          {tab === "anticipos" && <TabAnticipo emp={emp} />}
          {tab === "indemnizacion" && <TabIndemnizacion emp={emp} />}
          {tab === "contratos" && <TabContratos emp={emp} />}
        </div>
      </div>
    </div>,
    document.body
  );
  return (
    <>
      {portal}
      {bajaModal && (
        <ModalBajaEmpleado
          emp={emp}
          onClose={() => setBajaModal(false)}
          onSuccess={() => { onEstado(emp, "baja"); }}
        />
      )}
      {suspenderModal && (
        <ModalSuspenderEmpleado
          emp={emp}
          onClose={() => setSuspenderModal(false)}
          onConfirm={(extras) => {
            setSuspenderModal(false);
            onEstado(emp, "suspendido", extras);
          }}
        />
      )}
    </>
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
  const { data: tiposCfg = [] } = useTiposPersonal();
  const [form, setForm] = useState<FormState>(() => ({
    nombreCompleto: emp?.nombreCompleto ?? "",
    dpi: emp?.dpi ?? "",
    telefono: emp?.telefono ?? "",
    telefonoSecundario: emp?.telefonoSecundario ?? "",
    correo: emp?.correo ?? "",
    area: emp?.area ?? "",
    estadoLaboral: emp?.estadoLaboral ?? "activo",
    fechaIngreso: emp?.fechaIngreso ? emp.fechaIngreso.split("T")[0] : "",
    fechaNacimiento: emp?.fechaNacimiento ? String(emp.fechaNacimiento).split("T")[0] : "",
    notas: emp?.notas ?? "",
    sueldoBase: emp?.sueldoBase ?? "",
    tipoJornada: emp?.tipoJornada ?? "",
    diaDescanso: emp?.diaDescanso ?? "",
    horasContrato: emp?.horasContrato != null ? String(emp.horasContrato) : "",
    frecuenciaPago: emp?.frecuenciaPago ?? "quincenal",
    limiteAnticipo: emp?.limiteAnticipo != null ? String(emp.limiteAnticipo) : "",
    tipoLimitePeriodo: emp?.tipoLimitePeriodo ?? "quincenal",
    tipoPersonal: emp?.tipoPersonal ?? "guardia",
    bonificacionIncentivo: emp?.bonificacionIncentivo ?? "",
    bonificacion1:         emp?.bonificacion1 ?? "",
    bonificacion2:         emp?.bonificacion2 ?? "",
    bonificacion3:         emp?.bonificacion3 ?? "",
    banco:                 emp?.banco ?? "",
    cuentaBancaria:        emp?.cuentaBancaria ?? "",
    tipoCuenta:            emp?.tipoCuenta ?? "",
    formaPago:             emp?.formaPago ?? "cheque",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formScrollRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  function showError(msg: string) {
    setError(msg);
    toast({ title: "No se pudo guardar", description: msg, variant: "destructive" });
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.nombreCompleto.trim()) { showError("El nombre completo es requerido."); return; }
    if (!form.dpi.trim()) { showError("El DPI es requerido."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Error al guardar");
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

        <form ref={formScrollRef} onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
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
            {field("DPI", "dpi", "text", { placeholder: "Número de DPI", required: true })}
            {field("Fecha de nacimiento", "fechaNacimiento", "date")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Fecha de ingreso", "fechaIngreso", "date")}
            <div />
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
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Tipo de personal</label>
            <select
              value={form.tipoPersonal}
              onChange={(e) => set("tipoPersonal", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              {tiposCfg.filter(t => t.activo).map(t => (
                <option key={t.clave} value={t.clave}>
                  {t.label}{t.descripcion ? ` — ${t.descripcion}` : ""}
                </option>
              ))}
              {/* Si el valor actual ya no existe en el catálogo (o está inactivo), lo conservamos como opción extra */}
              {form.tipoPersonal && !tiposCfg.some(t => t.clave === form.tipoPersonal) && (
                <option value={form.tipoPersonal}>{form.tipoPersonal} (no catalogado)</option>
              )}
            </select>
            <p className="text-[10px] text-white/30 pt-0.5">
              ¿Falta un tipo? Agregalo en <span className="text-white/50">Configuración → Usuarios → Tipos de Personal</span>.
            </p>
          </div>
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
          {/* Bonificaciones */}
          <div>
            <p className="text-xs text-white/40 font-medium mb-2">Bonificaciones (Q / mes)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bon. Incentivo (Dto. 78-89)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacionIncentivo}
                  onChange={(e) => set("bonificacionIncentivo", e.target.value)}
                  placeholder="250.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bonificación 1</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacion1}
                  onChange={(e) => set("bonificacion1", e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bonificación 2</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacion2}
                  onChange={(e) => set("bonificacion2", e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bonificación 3</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacion3}
                  onChange={(e) => set("bonificacion3", e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Frecuencia de pago</label>
            <select
              value={form.frecuenciaPago ?? "quincenal"}
              onChange={(e) => set("frecuenciaPago", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              <option value="quincenal">Quincenal — pago dos veces al mes (Q1 y Q2)</option>
              <option value="mensual">Mensual — pago una vez al mes (solo Q2)</option>
            </select>
            <p className="text-[10px] text-white/30 pt-0.5">Mensual: el colaborador solo aparece en la segunda quincena del mes.</p>
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

          {emp?.id ? (
            <DescansoSemanalEditor employeeId={emp.id} diaDescansoDefault={form.diaDescanso} />
          ) : (
            <p className="text-[10px] text-white/30 italic">
              Guarda primero al colaborador para configurar descansos por semana.
            </p>
          )}

          {/* Banco / cuenta / forma de pago */}
          <p className="text-[10px] text-white/30 uppercase tracking-widest pt-2">Banco y forma de pago</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Banco</label>
              <select
                value={form.banco}
                onChange={(e) => set("banco", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin banco —</option>
                <option value="Banrural">Banrural</option>
                <option value="Banco Industrial">Banco Industrial</option>
                <option value="G&T Continental">G&amp;T Continental</option>
                <option value="BAC Credomatic">BAC Credomatic</option>
                <option value="Bantrab">Bantrab</option>
                <option value="Ficohsa">Ficohsa</option>
                <option value="BAM">BAM</option>
                <option value="Vivibanco">Vivibanco</option>
                {form.banco && !["Banrural","Banco Industrial","G&T Continental","BAC Credomatic","Bantrab","Ficohsa","BAM","Vivibanco"].includes(form.banco) && (
                  <option value={form.banco}>{form.banco}</option>
                )}
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Tipo de cuenta</label>
              <select
                value={form.tipoCuenta}
                onChange={(e) => set("tipoCuenta", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin especificar —</option>
                <option value="Monetaria (Cheques)">Monetaria (Cheques)</option>
                <option value="Ahorro">Ahorro</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Número de cuenta", "cuentaBancaria", "text", { placeholder: "Ej: 3-000-12345-6" })}
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Forma de pago</label>
              <select
                value={form.formaPago || "cheque"}
                onChange={(e) => set("formaPago", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="cheque">Cheque</option>
                <option value="deposito">Depósito a cuenta</option>
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
  const { active: deleteModeActive, requestDelete } = useDeleteMode();
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
        <TipoPersonalBadge tipo={emp.tipoPersonal ?? "guardia"} />
      </td>
      <td className="px-4 py-3">
        <EstadoBadge estado={emp.estadoLaboral} />
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="text-white/25 hover:text-primary transition-colors p-1"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {deleteModeActive && (
            <button
              onClick={() => requestDelete({ entidad: "empleado", entidad_id: emp.id, entidad_descripcion: emp.nombreCompleto })}
              title="Solicitar eliminación"
              className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors border border-red-500/20"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Empleados() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroArea, setFiltroArea] = useState<string>("todos");
  const [filtroTipoPersonal, setFiltroTipoPersonal] = useState<string>("todos");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroSede, setFiltroSede] = useState<string>("todos");
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tabla");
  const [fichaAbierta, setFichaAbierta] = useState<Empleado | null>(null);
  const [formModal, setFormModal] = useState<{ modo: "crear" | "editar"; emp?: Empleado } | null>(null);
  const [reingresoPending, setReingresoPending] = useState<{
    existing: {
      id: number; nombreCompleto: string; estadoLaboral: string;
      fechaIngreso: string | null; fechaBaja: string | null; motivoBaja: string | null;
      puesto: string | null; area: string | null; periodosPrevios: number;
    };
    formData: Partial<FormState>;
  } | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: empleados = [], isLoading, isError, refetch } = useQuery<Empleado[]>({
    queryKey: ["empleados"],
    queryFn: () => fetch(`${API_BASE}/employees`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Abre automáticamente la ficha si la URL tiene ?id=<employeeId>
  useEffect(() => {
    if (!empleados.length) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const emp = empleados.find((e) => String(e.id) === idParam);
    if (emp) {
      setFichaAbierta(emp);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [empleados]);

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
      // POST directo para detectar 409 con código REINGRESO_DISPONIBLE
      const r = await fetch(`${API_BASE}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify(data),
      });
      if (r.status === 409) {
        const body = await r.json().catch(() => ({}));
        if (body.code === "REINGRESO_DISPONIBLE" && body.empleado) {
          setReingresoPending({ existing: body.empleado, formData: data });
          throw new Error(`${body.error} Revise el cuadro de reingreso.`);
        }
        throw new Error(body.error ?? "DPI duplicado");
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error ?? "Error al guardar");
      }
      toast({ title: "Colaborador creado", description: data.nombreCompleto });
    } else if (formModal?.emp) {
      await apiCall(`${API_BASE}/employees/${formModal.emp.id}`, "PATCH", data);
      toast({ title: "Colaborador actualizado", description: data.nombreCompleto });
    }
    qc.invalidateQueries({ queryKey: ["empleados"] });
  }

  async function confirmarReingreso() {
    if (!reingresoPending) return;
    const { existing, formData } = reingresoPending;
    try {
      const r = await fetch(`${API_BASE}/employees/${existing.id}/reingreso`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify(formData),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al registrar reingreso");
      }
      const data = await r.json();
      toast({
        title: "Reingreso registrado",
        description: `${existing.nombreCompleto} — período laboral #${data.numeroPeriodo}`,
      });
      setReingresoPending(null);
      setFormModal(null);
      qc.invalidateQueries({ queryKey: ["empleados"] });
    } catch (e: unknown) {
      toast({
        title: "Error en reingreso",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }

  async function handleEstado(
    emp: Empleado,
    estado: string,
    extras?: { fechaDesde?: string; fechaHasta?: string; observaciones?: string },
  ) {
    try {
      const body: Record<string, unknown> = { estadoLaboral: estado };
      if (extras?.fechaDesde)    body.fechaDesde    = extras.fechaDesde;
      if (extras?.fechaHasta)    body.fechaHasta    = extras.fechaHasta;
      if (extras?.observaciones) body.observaciones = extras.observaciones;
      const updated = await apiCall(`${API_BASE}/employees/${emp.id}/estado`, "PATCH", body);
      const desc = estado === "suspendido" && extras?.fechaDesde && extras?.fechaHasta
        ? `${emp.nombreCompleto} suspendido del ${extras.fechaDesde} al ${extras.fechaHasta} — evento RRHH creado`
        : `${emp.nombreCompleto} → ${ESTADO_LAB[estado]?.label ?? estado}`;
      toast({ title: "Estado actualizado", description: desc });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      qc.invalidateQueries({ queryKey: ["rrhh-eventos"] });
      qc.invalidateQueries({ queryKey: ["novedades-nomina"] });
      if (fichaAbierta?.id === emp.id) setFichaAbierta(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cambiar el estado";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────────

  const areas = Array.from(new Set(empleados.map((e) => e.area).filter(Boolean))) as string[];
  const clientes = Array.from(new Set(empleados.map((e) => e.clienteNombre).filter(Boolean))).sort() as string[];
  // Las sedes se derivan en cascada del cliente seleccionado:
  // si hay cliente, solo mostramos sedes de ese cliente; si no, todas las sedes.
  const sedes = Array.from(new Set(
    empleados
      .filter((e) => {
        if (filtroCliente === "todos") return true;
        if (filtroCliente === "__sin_cliente__") return !e.clienteNombre;
        return e.clienteNombre === filtroCliente;
      })
      .map((e) => e.sede)
      .filter(Boolean),
  )).sort() as string[];

  const filtrados = empleados.filter((e) => {
    if (filtroEstado !== "todos" && e.estadoLaboral !== filtroEstado) return false;
    if (filtroArea !== "todos" && e.area !== filtroArea) return false;
    if (filtroTipoPersonal !== "todos" && (e.tipoPersonal ?? "guardia") !== filtroTipoPersonal) return false;
    if (filtroCliente !== "todos") {
      if (filtroCliente === "__sin_cliente__") {
        if (e.clienteNombre) return false;
      } else {
        if (e.clienteNombre !== filtroCliente) return false;
      }
    }
    if (filtroSede !== "todos") {
      if (filtroSede === "__sin_sede__") {
        if (e.sede) return false;
      } else {
        if (e.sede !== filtroSede) return false;
      }
    }
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

          <select
            value={filtroTipoPersonal}
            onChange={(e) => setFiltroTipoPersonal(e.target.value)}
            className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer"
          >
            <option value="todos">Todos los tipos</option>
            <option value="guardia">Guardia</option>
            <option value="supervisor">Supervisor</option>
            <option value="jefe_servicio">Jefe de Servicio</option>
            <option value="administrativo_bodega">Bodega</option>
            <option value="administrativo_rrhh">RRHH</option>
            <option value="gerencia">Gerencia</option>
          </select>

          {clientes.length > 0 && (
            <select
              value={filtroCliente}
              onChange={(e) => {
                setFiltroCliente(e.target.value);
                setFiltroSede("todos"); // reset sede al cambiar de cliente
              }}
              className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="todos">Todos los clientes</option>
              <option value="__sin_cliente__">— Sin cliente (disponible)</option>
              {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {sedes.length > 0 && (
            <select
              value={filtroSede}
              onChange={(e) => setFiltroSede(e.target.value)}
              className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="todos">Todas las sedes</option>
              <option value="__sin_sede__">— Sin sede asignada</option>
              {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
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
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Tipo</th>
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

      {reingresoPending && (
        <ReingresoModal
          existing={reingresoPending.existing}
          onConfirm={confirmarReingreso}
          onCancel={() => setReingresoPending(null)}
        />
      )}
    </AdminLayout>
  );
}

// ─── Modal: Confirmación de Reingreso ─────────────────────────────────────────
function ReingresoModal({
  existing,
  onConfirm,
  onCancel,
}: {
  existing: {
    id: number; nombreCompleto: string; estadoLaboral: string;
    fechaIngreso: string | null; fechaBaja: string | null; motivoBaja: string | null;
    puesto: string | null; area: string | null; periodosPrevios: number;
  };
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  async function handleConfirm() {
    setSaving(true);
    try { await onConfirm(); } finally { setSaving(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-12 overflow-auto">
      <div className="bg-[#07111f] border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Reingreso de colaborador</h3>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200/90 leading-relaxed">
            Ya existe un colaborador con ese DPI que fue dado de baja. Puede registrar este ingreso como un <b>reingreso</b> (nueva alta laboral). Se conservará su historial de períodos anteriores, pero los saldos de vacaciones y prestaciones acumuladas inician en cero.
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Empleado anterior</p>
            <div className="bg-[#060e1c] border border-white/10 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-white/50">Nombre</span><span className="text-white font-medium">{existing.nombreCompleto}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Último puesto</span><span className="text-white">{existing.puesto ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Área</span><span className="text-white">{existing.area ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Fecha ingreso anterior</span><span className="text-white">{fmtDate(existing.fechaIngreso)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Fecha de baja</span><span className="text-rose-300">{fmtDate(existing.fechaBaja)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Motivo de baja</span><span className="text-white/80">{existing.motivoBaja ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Períodos previos</span><span className="text-white">{existing.periodosPrevios}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest">Se conserva</p>
            <ul className="text-[11px] text-white/60 space-y-0.5 pl-2">
              <li>• Datos personales (DPI, contacto, foto)</li>
              <li>• Historial de períodos laborales</li>
              <li>• Liquidaciones previas pagadas</li>
              <li>• Eventos RRHH y disciplinarios</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-amber-400/70 uppercase tracking-widest">Se reinicia (nueva alta)</p>
            <ul className="text-[11px] text-white/60 space-y-0.5 pl-2">
              <li>• Saldo de vacaciones → 0 días</li>
              <li>• Prestaciones acumuladas → 0</li>
              <li>• Antigüedad para indemnización</li>
              <li>• Nuevo contrato inicial + post-prueba</li>
            </ul>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/8 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg font-medium transition-colors disabled:opacity-40"
          >
            {saving ? "Procesando…" : "Registrar reingreso"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
