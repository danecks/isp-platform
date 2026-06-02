import { useState, useEffect, useRef } from "react";
  import { useQuery } from "@tanstack/react-query";
  import { getSessionToken } from "@/lib/httpClient";

  export const API_BASE = "/api";

  // Helper para enviar el header de sesión admin en todos los fetches.
  export const sessionHeader = () => ({ "x-isp-session": getSessionToken() });
  
export interface Empleado {
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

export interface KpiData {
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

export interface Asignacion {
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

export interface UserVinculado {
  id: number;
  nombre: string;
  username: string;
  correo: string | null;
  rol: string;
  estado: string;
  telefono: string | null;
  created_at: string;
}

export interface PuestoTitular {
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

export interface HistorialRelevo {
  fecha_hora: string;
  cliente_nombre: string;
  puesto_nombre: string;
  tipo: string;
  motivo: string | null;
  agente_saliente_nombre: string | null;
}

export interface OperacionData {
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

export interface EventoKPIFront {
  id: number;
  tipoEvento: string;
  fecha: string;
  estado: string;
  anulado: boolean;
  clienteNombre: string | null;
  puestoNombre: string | null;
  observaciones: string | null;
}

export interface KPIDisciplinario {
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

export interface MovimientoRotacion {
  id: number;
  tipo: string;
  rol: "entrante" | "saliente";
  clienteNombre: string | null;
  puestoNombre: string | null;
  contraparte: string | null;
  fechaHora: string;
}

export interface KPIRotacion {
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

export interface FormState {
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
  // Datos para contrato (fuera del schema Drizzle)
  estadoCivil: string;
  sexo: string;
  nit: string;
  direccion: string;
  lugarNacimiento: string;
  municipio: string;
  departamento: string;
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

export interface AsignacionOperativa {
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

export function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "?";
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

export function fmtFecha(iso: string | null) {
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

export function fmtRelativa(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const días = Math.floor(diff / 86400000);
  if (días === 0) return "hoy";
  if (días === 1) return "ayer";
  if (días < 30) return `hace ${días} días`;
  if (días < 365) return `hace ${Math.floor(días / 30)} meses`;
  return `hace ${Math.floor(días / 365)} año(s)`;
}

export function fmtQ(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n as number)) return "Q0.00";
  return `Q${(n as number).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
}

export function maskDpi(dpi: string | null): string {
  if (!dpi) return "—";
  if (dpi.length <= 4) return "****";
  return `****${dpi.slice(-4)}`;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

export const ESTADO_LAB: Record<string, { label: string; color: string; dot: string }> = {
  activo:     { label: "Activo",     color: "text-green-400 bg-green-400/10 border-green-400/20",   dot: "bg-green-400" },
  suspendido: { label: "Suspendido", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", dot: "bg-yellow-400" },
  baja:       { label: "Baja",       color: "text-red-400 bg-red-400/10 border-red-400/20",         dot: "bg-red-400" },
  licencia:   { label: "Licencia",   color: "text-blue-400 bg-blue-400/10 border-blue-400/20",      dot: "bg-blue-400" },
  inactivo:   { label: "Inactivo",   color: "text-gray-400 bg-gray-400/10 border-gray-400/20",      dot: "bg-gray-400" },
};

export const AVATAR_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-teal-600", "bg-orange-600",
  "bg-rose-600", "bg-emerald-600", "bg-indigo-600", "bg-amber-600",
];

export function avatarColor(nombre: string | null | undefined) {
  if (!nombre) return AVATAR_COLORS[0];
  const sum = nombre.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export const FORM_EMPTY: FormState = {
  nombreCompleto: "", dpi: "", telefono: "", telefonoSecundario: "",
  correo: "", area: "", estadoLaboral: "activo",
  fechaIngreso: "", fechaNacimiento: "", notas: "",
  estadoCivil: "", sexo: "", nit: "", direccion: "",
  lugarNacimiento: "", municipio: "", departamento: "",
  sueldoBase: "", tipoJornada: "", diaDescanso: "", horasContrato: "",
  frecuenciaPago: "quincenal",
  limiteAnticipo: "", tipoLimitePeriodo: "quincenal",
  tipoPersonal: "guardia",
  bonificacionIncentivo: "", bonificacion1: "", bonificacion2: "", bonificacion3: "",
  banco: "", cuentaBancaria: "", tipoCuenta: "", formaPago: "cheque",
};

export const TIPO_PERSONAL_CFG = {
  guardia:               { label: "Guardia",         color: "text-blue-300 bg-blue-500/10 border-blue-500/20"     },
  supervisor:            { label: "Supervisor",      color: "text-violet-300 bg-violet-500/10 border-violet-500/20" },
  jefe_servicio:         { label: "Jefe Servicio",   color: "text-orange-300 bg-orange-500/10 border-orange-500/20" },
  administrativo_bodega: { label: "Bodega",          color: "text-amber-300 bg-amber-500/10 border-amber-500/20"  },
  administrativo_rrhh:   { label: "RRHH",            color: "text-teal-300 bg-teal-500/10 border-teal-500/20"     },
  gerencia:              { label: "Gerencia",        color: "text-rose-300 bg-rose-500/10 border-rose-500/20"     },
  administrativo:        { label: "Administrativo",  color: "text-amber-300 bg-amber-500/10 border-amber-500/20"  },
  disponible:            { label: "Disponible (ISP)", color: "text-white/50 bg-white/5 border-white/10"           },
} as const;

export const VALID_TIPOS_PERSONAL = ["guardia", "supervisor", "jefe_servicio", "administrativo_bodega", "administrativo_rrhh", "gerencia", "administrativo"] as const;

// Tipo del catálogo configurable (Configuración → Usuarios → Tipos de Personal)
export interface TipoPersonalConfig {
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
export function useTiposPersonal() {
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

export function TipoPersonalBadge({ tipo }: { tipo: string }) {
  const cfg = TIPO_PERSONAL_CFG[tipo as keyof typeof TIPO_PERSONAL_CFG]
    ?? { label: tipo, color: "text-white/40 bg-white/5 border-white/10" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_LAB[estado] ?? { label: estado, color: "text-white/40 bg-white/5 border-white/10", dot: "bg-white/40" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export function KpiCard({
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

export function ProgressBar({ label, value, total, color = "bg-blue-500" }: {
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

