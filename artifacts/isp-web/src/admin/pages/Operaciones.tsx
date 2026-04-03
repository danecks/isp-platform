import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Users, Loader2, RefreshCw, Plus, X, AlertTriangle,
  CheckCircle2, Clock, User, Phone, MapPin, ArrowLeftRight,
  History, Trash2, Shield, ShieldCheck, Activity, Zap, ChevronDown,
  ChevronRight, ChevronLeft, Info, Building2, Circle, GripVertical,
  UserMinus, UserPlus, UserCheck, XCircle, RotateCcw, FileText,
  Lock, Unlock, Calendar, CalendarDays, AlertCircle, CheckSquare,
  Layers, Timer, Moon, Settings2, Repeat, Sun, ExternalLink, Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ModalFichaArma } from "@/admin/components/ModalFichaArma";
import { ModalFichaVehiculo } from "@/admin/components/ModalFichaVehiculo";

const API_BASE = "/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Puesto {
  id: number;
  cliente_id: number | null;
  cliente_nombre: string;
  nombre: string;
  turno: string;
  agente_id: number | null;
  agente_nombre: string | null;
  estado: string; // cubierto | descubierto
  agente_estado_laboral: string | null;
  agente_telefono: string | null;
  agente_area: string | null;
  notas: string | null;
  orden: number;
  titular_employee_id: number | null;
  titular_nombre: string | null;
  horario: string | null;
  jornada: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  estado_operativo_puesto: string | null;
  tipo_turno_id: number | null;
  turno_nombre: string | null;
  fecha_inicio_ciclo: string | null;
  ciclo_horas: number | null;
  tipo_ciclo: "diario" | "alternado" | null;
  horas_trabajo: number | null;
  horas_descanso: number | null;
  descanso_por_ciclo?: boolean;
  /** Vacaciones activas del titular en la fecha consultada */
  titular_vac_tipo?: "vacaciones" | "vacaciones_trabajadas" | null;
  titular_vac_inicio?: string | null;
  titular_vac_fin?: string | null;
  /** Arma asignada al puesto (si existe) */
  arma_id?: number | null;
  arma_codigo?: string | null;
  arma_tipo?: string | null;
  /** Puestos con múltiples titulares (24x24 / 24x48 / etc.) */
  es_par_24x24?: boolean;
  /** Todos los titulares del puesto con su estado de ciclo individual */
  titulares?: TitularCiclo[];
  /** Titular que trabaja hoy */
  par_trabajando?: TitularCiclo;
  /** Titular que descansa hoy */
  par_descansando?: TitularCiclo;
}

/** Titular individual con su propio estado de ciclo */
interface TitularCiclo {
  employee_id: number;
  nombre: string;
  orden: number;
  fecha_inicio_ciclo: string | null;
  trabaja_hoy: boolean;
  descanso_por_ciclo: boolean;
}

interface ClienteBoard {
  clienteId: number | null;
  clienteNombre: string;
  fechaInicioContrato?: string | null;
  iniciaHoy?: boolean;
  puestos: Puesto[];
}

interface Agente {
  id: number;
  nombre_completo: string;
  estado_laboral: string;
  puesto: string | null;
  area: string | null;
  sede: string | null;
  telefono: string | null;
  wa_autorizado: boolean;
  supervisor_id: number | null;
  /** EOA: titular | disponible | pool_relevo | sin_asignacion */
  tipo_asignacion_eoa: string;
  /** Solo para agentes en categoría faltando */
  estado_puesto_titular?: string | null;
  nombre_puesto_titular?: string | null;
  cliente_puesto_titular?: string | null;
  /** Motor de turnos — disponibles post-proceso */
  disponibleHE?: boolean;
  turno_nombre?: string | null;
  /** Zona operativa del agente (desde titular o EOA) */
  zona_operativa_id?: number | null;
  zona_nombre?: string | null;
  /** Hints de experiencia previa — solo presentes cuando se provee puesto_id al pool */
  conoce_puesto?: boolean;
  conoce_cliente?: boolean;
  misma_zona_exp?: boolean;
  /** Tipo de personal — identifica supervisores/jefes inyectados como contingencia */
  tipo_personal?: string;
  /** Vacaciones activas del agente: 'vacaciones' | 'vacaciones_trabajadas' | null */
  vacacion_activa_tipo?: string | null;
  /** Flag del backend: true si el agente tiene vacaciones_trabajadas activas */
  vacacion_trabajada?: boolean;
}

// ── Tipos para ranking de candidatos ─────────────────────────────────────────
// P1–P4: guardias normales (disponible/descanso × misma/otra zona)
// P5: supervisores y jefes de servicio (contingencia operativa — menor prioridad)
type GrupoRanking = "P1" | "P2" | "P3" | "P4" | "P5";

interface AgenteRankeado extends Agente {
  grupo: GrupoRanking;
  /** Etiquetas que explican por qué aparece en esta posición */
  motivos: string[];
  score: number;
}

const RANKING_GRUPO_CONFIG: Record<GrupoRanking, { label: string; sub: string; headerColor: string; borderColor: string }> = {
  P1: { label: "Disponible · Misma zona",         sub: "Primera opción",        headerColor: "text-emerald-300",    borderColor: "border-emerald-500/25" },
  P2: { label: "Descanso de ciclo · Misma zona",  sub: "Disponible con HE",     headerColor: "text-blue-300",       borderColor: "border-blue-500/20" },
  P3: { label: "Disponible · Otras zonas",        sub: "Sin zona coincidente",  headerColor: "text-white/50",       borderColor: "border-white/8" },
  P4: { label: "Descanso de ciclo · Otras zonas", sub: "Disponible con HE",     headerColor: "text-white/30",       borderColor: "border-white/5" },
  P5: { label: "Contingencia operativa",          sub: "Supervisor / Jefe",     headerColor: "text-orange-300/80",  borderColor: "border-orange-500/15" },
};

const RANKING_MOTIVO_CONFIG: Record<string, { label: string; cls: string }> = {
  disponible:      { label: "Disponible",     cls: "text-emerald-300 bg-emerald-500/15" },
  descanso_ciclo:  { label: "HE",             cls: "text-blue-300 bg-blue-500/15" },
  misma_zona:      { label: "Misma zona",     cls: "text-primary/90 bg-primary/15" },
  zona_exp:        { label: "Zona",           cls: "text-primary/70 bg-primary/10" },
  conoce_cliente:  { label: "Conoce cliente", cls: "text-amber-300 bg-amber-500/15" },
  conoce_puesto:   { label: "Conoce puesto",  cls: "text-purple-300 bg-purple-500/15" },
  contingencia:    { label: "Contingencia",   cls: "text-orange-300 bg-orange-500/15" },
};

/** Genera la lista rankeada de candidatos elegibles para cubrir un puesto */
function rankCandidatos(pool: Pool, zonaId: number | null | undefined): AgenteRankeado[] {
  const result: AgenteRankeado[] = [];

  const toRanked = (agente: Agente, estado: "disponible" | "descansandoCiclo"): AgenteRankeado => {
    const mismaZona = !!zonaId && agente.zona_operativa_id === zonaId;

    // Supervisores y jefes de servicio → siempre P5 (contingencia operativa)
    const esContingencia = agente.tipo_personal === "supervisor" || agente.tipo_personal === "jefe_servicio";
    if (esContingencia) {
      return {
        ...agente,
        grupo: "P5",
        motivos: ["contingencia", ...(mismaZona ? ["misma_zona"] : [])],
        score: 20 + (mismaZona ? 10 : 0),
      };
    }

    const motivos: string[] = [];
    let score = estado === "disponible" ? 100 : 50;

    // Estado base
    motivos.push(estado === "disponible" ? "disponible" : "descanso_ciclo");

    // Zona
    if (mismaZona)                  { score += 40; motivos.push("misma_zona"); }
    else if (agente.misma_zona_exp) { score += 10; motivos.push("zona_exp"); }

    // Experiencia previa (más valiosa → más puntos)
    if (agente.conoce_puesto)  { score += 20; motivos.push("conoce_puesto"); }
    if (agente.conoce_cliente) { score += 12; motivos.push("conoce_cliente"); }

    let grupo: GrupoRanking;
    if      (estado === "disponible"       && mismaZona) grupo = "P1";
    else if (estado === "descansandoCiclo" && mismaZona) grupo = "P2";
    else if (estado === "disponible")                    grupo = "P3";
    else                                                 grupo = "P4";

    return { ...agente, grupo, motivos, score };
  };

  for (const a of pool.disponibles)      result.push(toRanked(a, "disponible"));
  for (const a of pool.descansandoCiclo) result.push(toRanked(a, "descansandoCiclo"));

  // Ordenar: primero por grupo (P1→P5) luego por score descendente
  const grupoOrd: Record<GrupoRanking, number> = { P1: 0, P2: 1, P3: 2, P4: 3, P5: 4 };
  return result.sort((a, b) => {
    const gd = grupoOrd[a.grupo] - grupoOrd[b.grupo];
    return gd !== 0 ? gd : b.score - a.score;
  });
}

interface SupervisorPool {
  id: number;
  nombre_completo: string;
  estado_laboral: string;
  puesto: string | null;
  area: string | null;
  sede: string | null;
  telefono: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  tipo_turno_id: number | null;
  turno_nombre: string | null;
  tipo_ciclo_turno: string | null;
  horas_trabajo_turno: string | null;
  fecha_inicio_ciclo_turno: string | null;
  estado_display: string;
  // Calculado por el motor de turnos
  trabaja_hoy: boolean | null;
  trabaja_mañana: boolean | null;
  disponible_he: boolean;
  estado_ciclo: "trabajando" | "disponible_he" | "descansando_ciclo" | "sin_turno" | "licencia" | "suspendido" | null;
  puede_cubrir: boolean;
}

interface JefeServicioPool {
  id: number;
  nombre_completo: string;
  estado_laboral: string;
  puesto: string | null;
  area: string | null;
  telefono: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  tipo_turno_id: number | null;
  turno_nombre: string | null;
  tipo_ciclo_turno: string | null;
  horas_trabajo_turno: string | null;
  fecha_inicio_ciclo_turno: string | null;
  estado_display: string;
  // Calculado por el motor de turnos en el backend
  trabaja_hoy: boolean | null;
  trabaja_mañana: boolean | null;
  estado_ciclo: "trabajando" | "descansando_ciclo" | "sin_turno" | "licencia" | "suspendido" | null;
}

interface Pool {
  trabajando: Agente[];
  descansandoCiclo: Agente[];
  disponibles: Agente[];
  enPuesto: Agente[];
  enSSA: Agente[];
  enDescanso: Agente[];
  suspendidos: Agente[];
  faltando: Agente[];
  enVacaciones: Agente[];
  supervisores: SupervisorPool[];
  jefes_servicio: JefeServicioPool[];
  fecha_hoy: string;
  fecha_mañana: string;
  total: number;
}

interface PlanFuturo {
  id: number;
  fecha: string;
  puesto_id: number | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  tipo_evento: string;
  tipo_ausencia: string | null;
  tipo_cobertura_futura: string | null;
  ssa_id: string | null;
  ssa_tipo_solicitud: string | null;
  titular_ausente_id: number | null;
  titular_ausente_nombre: string | null;
  relevo_id: number | null;
  relevo_nombre: string | null;
  motivo: string | null;
  notas: string | null;
  estado: string;
  fuente: string;
}

interface AgentePoolFuturo {
  id: number;
  nombre_completo: string;
  elegible_pool: boolean;
  estado_laboral: string;
  tipo_personal?: string;
  puesto_id: number | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  turno_nombre: string | null;
  horas_trabajo: number | null;
  horas_descanso: number | null;
  fecha_inicio_ciclo: string | null;
  estado_turno?: string;
  fuente_ausencia?: string;
  tipo_ausencia_rrhh?: string;
  razon_no_elegible?: string;
  plan_tipo_ausencia?: string | null;
}

interface PlanAgenteSSA {
  plan_id: number;
  relevo_id: number | null;
  relevo_nombre: string | null;
}

interface SsaAgente {
  id: number;
  nombre: string;
  telefono: string | null;
  estado: string;
}

interface InicioProyecto {
  tipo: "inicio_cliente" | "ssa";
  ssa_id: string | null;
  tipo_solicitud: string | null;
  cliente_id: number;
  cliente_nombre: string;
  cliente_nombre_comercial: string | null;
  sector: string | null;
  notas: string | null;
  fecha_inicio_contrato: string;
  fecha_inicio?: string;
  total_puestos: number;
  puestos_con_titular: number;
  puestos_sin_titular: number;
  dias_para_inicio?: number;
  descripcion: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado_ssa: string | null;
  plan_agentes: PlanAgenteSSA[];
  puestos: Array<{
    id: number;
    nombre: string;
    turno_nombre: string | null;
    titular_nombre: string | null;
    activo: boolean;
  }> | null;
}

interface PoolFuturoData {
  fecha: string;
  trabajando: AgentePoolFuturo[];
  descansando: AgentePoolFuturo[];
  disponible: AgentePoolFuturo[];
  relevoProgramado: AgentePoolFuturo[];
  ausenteProgramado: AgentePoolFuturo[];
  noElegible: AgentePoolFuturo[];
  iniciosProyecto: InicioProyecto[];
  totales: {
    trabajando: number;
    descansando: number;
    disponible: number;
    relevoProgramado: number;
    ausenteProgramado: number;
    noElegible: number;
    iniciosProyecto: number;
  };
}

interface Movimiento {
  id: number;
  puesto_id: number | null;
  cliente_nombre: string;
  puesto_nombre: string;
  agente_saliente_nombre: string | null;
  agente_entrante_nombre: string | null;
  tipo: string;
  motivo: string | null;
  usuario_cambio: string;
  notas: string | null;
  fecha_hora: string;
}

interface ClienteDisponible {
  id: number;
  nombre: string;
  nombre_comercial: string | null;
  portal_cliente_id: string | null;
}

interface CierreResumen {
  totalPuestos: number;
  cubiertos: number;
  descubiertos: number;
  cubiertosPorTitular: number;
  cubiertosPorRelevo: number;
  ausencias: number;
  horasExtra: number;
}

interface AgenteDeclino {
  id: number;
  nombre: string;
  motivo: string;
  fecha: string;
}

interface TarjetaSSAPendiente {
  id: string;
  tipo_solicitud: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  cantidad_guardias: number;
  prioridad: string;
  descripcion: string | null;
  estado_general: string;
  plan_agente_id: number | null;
  plan_agente_nombre: string | null;
  estado_operaciones: string;
  estado_facturacion: string;
  estado_preplanilla: string | null;
  enviado_preplanilla_at: string | null;
  agente_id: number | null;
  agente_nombre: string | null;
  agente_nombre_completo: string | null;
  tipo_cobertura: string | null;
  cliente_nombre: string | null;
  sede_nombre: string | null;
  puesto_nombre: string | null;
  monto_estimado: string | null;
  motivo_ultima_remocion: string | null;
  agentes_rechazados: AgenteDeclino[];
  agentes: SsaAgente[];
}

interface CierreDiaRecord {
  id: number;
  fecha: string;
  fecha_str?: string;
  estado: string;
  cerrado_por: string;
  cerrado_en: string;
  comentario: string | null;
  reabierto_por: string | null;
  reabierto_en: string | null;
  motivo_reapertura: string | null;
}

interface CierreHoyData {
  estado: "abierto" | "cerrado";
  cierre: CierreDiaRecord | null;
  fechaActiva: string;
  fechaActivaStr: string;
  esFechaFutura: boolean;
  cierreDeHoy: CierreDiaRecord | null;
  resumen: CierreResumen;
  advertencias: string[];
}

interface Segmento {
  id: number;
  fecha: string;
  puesto_id: number;
  employee_id: number | null;
  empleado_nombre: string | null;
  empleado_nombre_join: string | null;
  tipo_cobertura: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  horas_calculadas: string | null;
  motivo: string | null;
  fue_en_dia_descanso: boolean;
  genera_horas_extra: boolean;
  observaciones: string | null;
  puesto_nombre_join: string | null;
}

interface EmpleadoBusqueda {
  id: number;
  nombreCompleto: string;
  puesto: string | null;
  area: string | null;
  estadoLaboral?: string | null;
}

// ─── Helper: fecha de hoy en formato DD-MM-YYYY (cliente) ─────────────────
function fechaHoyStr() {
  const d  = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciales(n: string | null | undefined) {
  if (!n) return "?";
  return n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function fmtHora(iso: string) {
  return new Date(iso).toLocaleString("es-GT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

async function apiPost(url: string, body: object) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw { status: r.status, ...data };
  return data;
}

async function apiDelete(url: string) {
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error("Error al eliminar");
  return r.json();
}

const AVATAR_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-teal-600", "bg-orange-600",
  "bg-rose-600", "bg-emerald-600", "bg-indigo-600", "bg-amber-600",
];

function avatarColor(nombre: string | null | undefined) {
  if (!nombre) return AVATAR_COLORS[0];
  const sum = nombre.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const TURNO_COLORS: Record<string, string> = {
  "día":    "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "noche":  "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "24h":    "text-purple-400 bg-purple-400/10 border-purple-400/20",
  "mixto":  "text-teal-400 bg-teal-400/10 border-teal-400/20",
};

const TIPO_MOV: Record<string, { label: string; icon: React.ComponentType<{className?: string}>; color: string }> = {
  asignacion:  { label: "Asignación",  icon: UserPlus,    color: "text-green-400" },
  sustitucion: { label: "Sustitución", icon: ArrowLeftRight, color: "text-yellow-400" },
  liberacion:  { label: "Liberación",  icon: UserMinus,   color: "text-red-400" },
};

// ─── Miniatura de Agente (para pool y DragOverlay) ────────────────────────────

function MiniAgente({ agente, compact = false }: { agente: Agente; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : ""}`}>
      <div className={`${compact ? "w-7 h-7 text-xs" : "w-8 h-8 text-xs"} rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${avatarColor(agente.nombre_completo)}`}>
        {iniciales(agente.nombre_completo)}
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90 truncate leading-none">{agente.nombre_completo}</p>
          {agente.puesto && <p className="text-[10px] text-white/35 truncate mt-0.5">{agente.puesto}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Agente Draggable (pool) ──────────────────────────────────────────────────

function DraggableAgente({
  agente,
  onClick,
  isSelected,
  disabled,
  motivos,
}: {
  agente: Agente;
  onClick: () => void;
  isSelected: boolean;
  disabled?: boolean;
  /** Badges de motivo de ranking (solo en vista de candidatos rankeados) */
  motivos?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `agent-${agente.id}`,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`
        relative flex items-center gap-2.5 p-2.5 rounded-xl border cursor-grab active:cursor-grabbing
        transition-all select-none group
        ${isSelected
          ? "bg-primary/15 border-primary/40 shadow-md shadow-primary/10"
          : "bg-[#0c1929] border-white/8 hover:border-white/15 hover:bg-white/4"}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
    >
      <div {...attributes} {...listeners} className="shrink-0 text-white/15 hover:text-white/30 cursor-grab">
        <GripVertical className="w-3 h-3" />
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(agente.nombre_completo)}`}>
        {iniciales(agente.nombre_completo)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white/90 truncate">{agente.nombre_completo}</p>
        <p className="text-[10px] text-white/35 truncate">
          {agente.turno_nombre ? agente.turno_nombre : (agente.puesto ?? "Agente")}
        </p>
        {agente.estado_puesto_titular && agente.nombre_puesto_titular && (
          <p className="text-[10px] text-orange-400/80 truncate mt-0.5">
            {agente.nombre_puesto_titular}
            {agente.cliente_puesto_titular ? ` · ${agente.cliente_puesto_titular}` : ""}
          </p>
        )}
        {motivos && motivos.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {motivos.slice(0, 3).map((m) => {
              const cfg = RANKING_MOTIVO_CONFIG[m];
              if (!cfg) return null;
              return (
                <span key={m} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
                  {cfg.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {agente.disponibleHE && (
        <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
          HE
        </span>
      )}
      {agente.estado_puesto_titular && agente.estado_puesto_titular !== "normal" && (
        <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
          agente.estado_puesto_titular === "abandono_parcial" ? "bg-red-500/20 text-red-300" :
          agente.estado_puesto_titular === "suspension"       ? "bg-orange-500/20 text-orange-300" :
          agente.estado_puesto_titular === "vacaciones"       ? "bg-blue-500/20 text-blue-300" :
          agente.estado_puesto_titular === "incapacidad"      ? "bg-purple-500/20 text-purple-300" :
          "bg-red-500/20 text-red-300"
        }`}>
          {agente.estado_puesto_titular === "relevo_completo"  ? "FALTA" :
           agente.estado_puesto_titular === "abandono_parcial" ? "ABANDONO" :
           agente.estado_puesto_titular === "suspension"       ? "SUSPENDIDO" :
           agente.estado_puesto_titular === "vacaciones"       ? "VACACIONES" :
           agente.estado_puesto_titular === "incapacidad"      ? "INCAPACIDAD" :
           agente.estado_puesto_titular.toUpperCase()}
        </span>
      )}
      {agente.vacacion_trabajada && (
        <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/25 leading-tight">
          VAC.✓
        </span>
      )}
      {isSelected && (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
      )}
    </div>
  );
}

// ─── Helpers de turno/timeline ────────────────────────────────────────────────

function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function fmt2(n: number) { return String(Math.floor(n)).padStart(2, "0"); }
function minToHM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${fmt2(m / 60)}:${fmt2(m % 60)}`;
}
function turnoBounds(turno: string, horaEntrada?: string | null, horaSalida?: string | null): {
  inicioMin: number; finMin: number; totalMin: number;
} {
  if (horaEntrada && horaSalida) {
    const i = parseHM(horaEntrada);
    let f = parseHM(horaSalida);
    if (f <= i) f += 1440;
    return { inicioMin: i, finMin: f, totalMin: f - i };
  }
  const esNoche = (turno ?? "").toLowerCase() === "noche";
  return esNoche
    ? { inicioMin: 18 * 60, finMin: 30 * 60, totalMin: 12 * 60 }
    : { inicioMin: 6 * 60, finMin: 18 * 60, totalMin: 12 * 60 };
}

// ─── Modal: Tramos de cobertura (segmentos) ───────────────────────────────────

function ModalSegmentos({
  puesto,
  fecha,
  onClose,
}: {
  puesto: Puesto;
  fecha: string; // "YYYY-MM-DD"
  onClose: () => void;
}) {
  const { toast } = useToast();
  // Segmentos existentes
  const { data: segmentos = [], isLoading, refetch } = useQuery<Segmento[]>({
    queryKey: ["segmentos", fecha, puesto.id],
    queryFn: () =>
      fetch(`${API_BASE}/cobertura/segmentos?fecha=${fecha}&puestoId=${puesto.id}`)
        .then((r) => r.json()),
  });

  const [empleadoSel, setEmpleadoSel]   = useState<EmpleadoBusqueda | null>(null);
  const [tipoCobertura, setTipo]        = useState("relevo");
  const [horaInicio, setHoraInicio]     = useState("");
  const [horaFin, setHoraFin]           = useState("");
  const [motivo, setMotivo]             = useState("");
  const [guardando, setGuardando]       = useState(false);

  // Parsear fecha "YYYY-MM-DD" → "DD-MM-YYYY"
  const fechaDisplay = (() => {
    const [y, m, d] = fecha.split("-");
    return `${d}-${m}-${y}`;
  })();

  // ── Turno / timeline ──────────────────────────────────────────────────────
  const { inicioMin, finMin, totalMin } = turnoBounds(
    puesto.turno, puesto.hora_entrada, puesto.hora_salida
  );
  const turnoInicioStr = minToHM(inicioMin);
  const turnoFinStr    = minToHM(finMin);

  // Segmentos con horas → posicionados en el timeline
  const segsConHora = segmentos
    .filter((s) => s.hora_inicio && s.hora_fin)
    .map((s) => {
      let si = parseHM(s.hora_inicio!);
      let sf = parseHM(s.hora_fin!);
      if (sf < inicioMin && sf < si) sf += 1440; // overnight fin
      if (si < inicioMin) si += 1440;
      const left  = Math.max(0, ((si - inicioMin) / totalMin) * 100);
      const width = Math.max(0, Math.min(100 - left, ((sf - si) / totalMin) * 100));
      return { ...s, posLeft: left, posWidth: width, siMin: si, sfMin: sf };
    })
    .sort((a, b) => a.siMin - b.siMin);

  // Huecos en la cobertura
  const gaps: { left: number; width: number; minutos: number }[] = [];
  let cursor = inicioMin;
  for (const seg of segsConHora) {
    if (seg.siMin > cursor) {
      const gapMin = seg.siMin - cursor;
      gaps.push({
        left:  ((cursor - inicioMin) / totalMin) * 100,
        width: (gapMin / totalMin) * 100,
        minutos: gapMin,
      });
    }
    cursor = Math.max(cursor, seg.sfMin);
  }
  if (cursor < finMin) {
    const gapMin = finMin - cursor;
    gaps.push({
      left:  ((cursor - inicioMin) / totalMin) * 100,
      width: (gapMin / totalMin) * 100,
      minutos: gapMin,
    });
  }
  const totalCubierto  = segsConHora.reduce((s, sg) => s + (sg.sfMin - sg.siMin), 0);
  const totalDescubMin = gaps.reduce((s, g) => s + g.minutos, 0);

  // Auto-sugerir: horaInicio = donde termina el último tramo / horaFin = fin turno
  const ultimaFin = segsConHora.length > 0
    ? minToHM(segsConHora[segsConHora.length - 1].sfMin)
    : turnoInicioStr;
  const sugerenciaInicio = horaInicio || ultimaFin;
  const sugerenciaFin    = horaFin    || turnoFinStr;

  // Resumen de horas por agente
  const resumenHoras: { nombre: string; horas: number }[] = [];
  for (const sg of segmentos) {
    const nombre = sg.empleado_nombre_join ?? sg.empleado_nombre ?? "—";
    const h = parseFloat(sg.horas_calculadas ?? "0");
    const idx = resumenHoras.findIndex((r) => r.nombre === nombre);
    if (idx >= 0) resumenHoras[idx].horas += h;
    else resumenHoras.push({ nombre, horas: h });
  }

  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const horaInicioInvalida = horaInicio.length > 0 && !HHMM.test(horaInicio);
  const horaFinInvalida    = horaFin.length > 0    && !HHMM.test(horaFin);

  async function agregarSegmento() {
    if (!empleadoSel) { toast({ title: "Selecciona un empleado", variant: "destructive" }); return; }
    if (!horaInicio || !horaFin) {
      toast({ title: "Hora de inicio y fin son obligatorias", variant: "destructive" });
      return;
    }
    if (horaInicioInvalida || horaFinInvalida) {
      toast({ title: "Formato de hora inválido — usa HH:MM (ej: 06:00)", variant: "destructive" });
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/cobertura/segmentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          puestoId:       puesto.id,
          clientId:       puesto.cliente_id,
          sedeId:         puesto.sede_id,
          employeeId:     empleadoSel.id,
          empleadoNombre: empleadoSel.nombreCompleto,
          tipoCobertura,
          horaInicio: horaInicio || null,
          horaFin:    horaFin    || null,
          motivo:     motivo     || null,
        }),
      });
      if (!res.ok) throw await res.json();
      toast({ title: "Tramo registrado correctamente" });
      refetch();
      // Reset form
      setEmpleadoSel(null); setHoraInicio(""); setHoraFin(""); setMotivo("");
    } catch (err: any) {
      toast({ title: err?.error ?? "Error al registrar tramo", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarSegmento(id: number) {
    try {
      await apiDelete(`${API_BASE}/cobertura/segmentos/${id}`);
      toast({ title: "Tramo eliminado" });
      refetch();
    } catch {
      toast({ title: "Error al eliminar tramo", variant: "destructive" });
    }
  }

  const totalHoras = segmentos.reduce(
    (s, sg) => s + parseFloat(sg.horas_calculadas ?? "0"), 0
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-indigo-500/5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">Tramos de cobertura</h3>
              <p className="text-[11px] text-white/40 truncate">{puesto.nombre} · {fechaDisplay}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {totalHoras > 0 && (
              <span className="text-[10px] font-bold text-indigo-300/80 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                {totalHoras.toFixed(1)}h total
              </span>
            )}
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Timeline visual del turno */}
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-white/6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">
              Turno {turnoInicioStr}–{turnoFinStr} ({(totalMin / 60).toFixed(0)}h)
            </span>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-emerald-400/70">{(totalCubierto / 60).toFixed(1)}h cubiertas</span>
              {totalDescubMin > 0 && (
                <span className="text-red-400/70 font-semibold">{(totalDescubMin / 60).toFixed(1)}h sin cubrir</span>
              )}
            </div>
          </div>
          {/* Barra del turno */}
          <div className="relative h-6 bg-[#060e1c] rounded-lg overflow-hidden border border-white/8">
            {/* Huecos (primero para que queden detrás) */}
            {gaps.map((g, i) => (
              <div
                key={`gap-${i}`}
                className="absolute top-0 h-full bg-red-500/15 border-x border-red-500/20"
                style={{ left: `${g.left}%`, width: `${g.width}%` }}
                title={`Sin cubrir: ${(g.minutos / 60).toFixed(1)}h`}
              />
            ))}
            {/* Segmentos */}
            {segsConHora.map((seg) => {
              const nombre = seg.empleado_nombre_join ?? seg.empleado_nombre ?? "—";
              return (
                <div
                  key={seg.id}
                  className={`absolute top-0 h-full flex items-center justify-center overflow-hidden ${avatarColor(nombre)} opacity-80`}
                  style={{ left: `${seg.posLeft}%`, width: `${Math.max(seg.posWidth, 1)}%` }}
                  title={`${nombre}: ${seg.hora_inicio}–${seg.hora_fin}`}
                >
                  {seg.posWidth > 8 && (
                    <span className="text-[8px] text-white font-bold truncate px-1 drop-shadow">{iniciales(nombre)}</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Etiquetas de horas */}
          <div className="flex justify-between mt-0.5">
            <span className="text-[8px] text-white/20">{turnoInicioStr}</span>
            <span className="text-[8px] text-white/20">{minToHM(inicioMin + totalMin / 2)}</span>
            <span className="text-[8px] text-white/20">{turnoFinStr}</span>
          </div>
        </div>

        {/* Lista de tramos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            </div>
          )}
          {!isLoading && segmentos.length === 0 && (
            <div className="text-center py-8 text-white/25">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Sin tramos registrados para este puesto/día</p>
              <p className="text-[11px] mt-1 text-white/15">Agrega uno abajo</p>
            </div>
          )}
          {segmentos.map((sg) => {
            const nombre = sg.empleado_nombre_join ?? sg.empleado_nombre ?? "—";
            return (
              <div key={sg.id} className="flex items-center gap-3 bg-[#0c1929] border border-white/8 rounded-xl p-3 group">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(nombre)}`}>
                  {iniciales(nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-white/85 truncate">{nombre}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                      sg.tipo_cobertura === "titular"
                        ? "text-green-300/80 bg-green-500/10 border-green-500/20"
                        : "text-amber-300/80 bg-amber-500/10 border-amber-500/20"
                    }`}>
                      {sg.tipo_cobertura.toUpperCase()}
                    </span>
                    {sg.fue_en_dia_descanso && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border text-blue-300/70 bg-blue-500/10 border-blue-500/20 font-bold flex items-center gap-0.5">
                        <Moon className="w-2.5 h-2.5" /> DESCANSO
                      </span>
                    )}
                    {sg.genera_horas_extra && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border text-yellow-300/80 bg-yellow-500/10 border-yellow-500/20 font-bold flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> HE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {sg.hora_inicio && sg.hora_fin && (
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <Timer className="w-2.5 h-2.5" />
                        {sg.hora_inicio}–{sg.hora_fin}
                        {sg.horas_calculadas && (
                          <span className="text-indigo-400/70 font-semibold">({parseFloat(sg.horas_calculadas).toFixed(1)}h)</span>
                        )}
                      </span>
                    )}
                    {sg.motivo && (
                      <span className="text-[10px] text-white/30 truncate">{sg.motivo}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => eliminarSegmento(sg.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all p-1 shrink-0"
                  title="Eliminar tramo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {/* Resumen de horas por agente */}
          {resumenHoras.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/6">
              <p className="text-[9px] text-white/25 uppercase tracking-widest font-semibold mb-2">Horas registradas por colaborador</p>
              <div className="space-y-1">
                {resumenHoras.map(({ nombre, horas }) => (
                  <div key={nombre} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${avatarColor(nombre)}`}>
                      {iniciales(nombre).slice(0, 1)}
                    </div>
                    <p className="text-xs text-white/60 flex-1 truncate">{nombre}</p>
                    <span className="text-xs font-bold text-indigo-300/80">{horas.toFixed(1)}h</span>
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/50 rounded-full"
                        style={{ width: `${Math.min(100, (horas / (totalMin / 60)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-1">
                  <span className="text-[10px] text-white/25">Total turno ({(totalMin / 60).toFixed(0)}h)</span>
                  <span className={`text-[10px] font-bold ${totalDescubMin > 0 ? "text-red-400/70" : "text-emerald-400/70"}`}>
                    {(totalCubierto / 60).toFixed(1)}h / {(totalMin / 60).toFixed(0)}h
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Formulario para agregar tramo */}
        <div className="shrink-0 border-t border-white/8 p-4 space-y-3 bg-[#060e1c]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Agregar tramo</p>
            {totalDescubMin > 0 && (
              <span className="text-[9px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {(totalDescubMin / 60).toFixed(1)}h sin cubrir
              </span>
            )}
          </div>

          {/* Selector de empleado agrupado por estado */}
          {empleadoSel ? (
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2.5">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(empleadoSel.nombreCompleto)}`}>
                {iniciales(empleadoSel.nombreCompleto)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-200 truncate">{empleadoSel.nombreCompleto}</p>
                <p className="text-[10px] text-indigo-300/50">{empleadoSel.puesto ?? "Agente"}</p>
              </div>
              <button onClick={() => setEmpleadoSel(null)} className="text-white/25 hover:text-red-400 transition-colors">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <SelectorAgenteAgrupado
              fecha={fecha}
              seleccionado={null}
              puestoId={puesto.id}
              zonaId={puesto.zona_operativa_id}
              onSelect={(a) =>
                setEmpleadoSel({ id: a.id, nombreCompleto: a.nombre, puesto: a.detalle ?? null, area: null })
              }
            />
          )}

          {/* Tipo, horas, motivo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/35">Tipo</label>
              <select
                value={tipoCobertura}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none"
              >
                <option value="relevo">Relevo</option>
                <option value="titular">Titular</option>
                <option value="apoyo">Apoyo</option>
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/35">Inicio</label>
                {sugerenciaInicio && !horaInicio && (
                  <button
                    type="button"
                    onClick={() => setHoraInicio(sugerenciaInicio)}
                    className="text-[8px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    ↙ {sugerenciaInicio}
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder={sugerenciaInicio}
                maxLength={5}
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className={`w-full bg-[#060e1c] border rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-indigo-300/25 outline-none transition-colors ${horaInicioInvalida ? "border-red-500/60 focus:border-red-400" : "border-white/10 focus:border-indigo-400/40"}`}
              />
              {horaInicioInvalida && <p className="text-[9px] text-red-400">Formato HH:MM</p>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/35">Fin</label>
                {sugerenciaFin && !horaFin && (
                  <button
                    type="button"
                    onClick={() => setHoraFin(sugerenciaFin)}
                    className="text-[8px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    ↙ {sugerenciaFin}
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder={sugerenciaFin}
                maxLength={5}
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className={`w-full bg-[#060e1c] border rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-indigo-300/25 outline-none transition-colors ${horaFinInvalida ? "border-red-500/60 focus:border-red-400" : "border-white/10 focus:border-indigo-400/40"}`}
              />
              {horaFinInvalida && <p className="text-[9px] text-red-400">Formato HH:MM</p>}
            </div>
          </div>

          <input
            type="text"
            placeholder="Motivo (opcional)…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/15 outline-none focus:border-indigo-400/30"
          />

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:text-white transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={agregarSegmento}
              disabled={guardando || !empleadoSel}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
            >
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Registrar tramo
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Planificación Futura: catálogo de tipos de ausencia ──────────────────────

const TIPOS_AUSENCIA_FUTURO = [
  { value: "permiso_con_goce",  label: "Permiso con goce" },
  { value: "permiso_sin_goce",  label: "Permiso sin goce" },
  { value: "vacaciones",        label: "Vacaciones" },
  { value: "incapacidad",       label: "Incapacidad" },
  { value: "suspension",        label: "Suspensión programada" },
  { value: "otro",              label: "Otro" },
];

// ─── Modal: Planificación Futura ──────────────────────────────────────────────

// ─── Modal: Planificar cobertura para SSA futuro ──────────────────────────────
// ─── Selector Agrupado por Estado Operativo ──────────────────────────────────

type GrupoEstado = "disponible" | "descansando" | "en_puesto" | "en_ssa" | "ausente";

interface AgenteAgrupado {
  id: number;
  nombre: string;
  grupo: GrupoEstado;
  detalle: string | null;
}

const GRUPO_CONFIG: Record<GrupoEstado, {
  label: string;
  color: string;
  dot: string;
  badge: string | null;
  seleccionable: boolean;
  advertencia: string | null;
}> = {
  disponible:  { label: "Disponibles",  color: "text-green-400",       dot: "bg-green-500",    badge: null,  seleccionable: true,  advertencia: null },
  descansando: { label: "Descansando",  color: "text-blue-400",        dot: "bg-blue-400",     badge: "HE",  seleccionable: true,  advertencia: "Este agente está en período de descanso. Se asignará como horas extra." },
  en_puesto:   { label: "En puesto",    color: "text-teal-400",        dot: "bg-teal-400",     badge: null,  seleccionable: true,  advertencia: "Este agente ya está cubriendo un puesto activo. ¿Confirmar doble asignación?" },
  en_ssa:      { label: "En SSA",       color: "text-amber-400",       dot: "bg-amber-400",    badge: null,  seleccionable: true,  advertencia: "Este agente ya está asignado a otro servicio especial. ¿Confirmar igualmente?" },
  ausente:     { label: "Ausentes",     color: "text-red-400/60",      dot: "bg-red-400/50",   badge: null,  seleccionable: false, advertencia: null },
};

function normalizarPoolActual(p: Pool): AgenteAgrupado[] {
  const r: AgenteAgrupado[] = [];
  for (const a of (p.disponibles ?? []))       r.push({ id: a.id, nombre: a.nombre_completo, grupo: "disponible",  detalle: null });
  for (const a of (p.descansandoCiclo ?? []))  r.push({ id: a.id, nombre: a.nombre_completo, grupo: "descansando", detalle: a.turno_nombre ?? null });
  for (const a of (p.trabajando ?? []))        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_puesto",   detalle: a.nombre_puesto_titular ?? null });
  for (const a of (p.enDescanso ?? []))        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "descansando", detalle: "Licencia" });
  for (const a of (p.enPuesto ?? []))          r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_puesto",   detalle: a.nombre_puesto_titular ?? null });
  for (const a of (p.enSSA ?? []))             r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_ssa",      detalle: null });
  for (const a of [...(p.suspendidos ?? []), ...(p.faltando ?? [])]) r.push({ id: a.id, nombre: a.nombre_completo, grupo: "ausente", detalle: null });
  return r;
}

function poolFuturoToAgente(a: AgentePoolFuturo): Agente {
  return {
    id: a.id,
    nombre_completo: a.nombre_completo,
    estado_laboral: a.estado_laboral,
    puesto: a.puesto_nombre,
    area: null,
    sede: null,
    telefono: null,
    wa_autorizado: false,
    supervisor_id: null,
    tipo_asignacion_eoa: a.puesto_id ? "titular" : "disponible",
    tipo_personal: a.tipo_personal,
    turno_nombre: a.turno_nombre,
    disponibleHE: false,
  };
}

function normalizarPoolFuturo(p: PoolFuturoData): AgenteAgrupado[] {
  const r: AgenteAgrupado[] = [];
  for (const a of p.disponible)        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "disponible",  detalle: null });
  for (const a of p.relevoProgramado)  r.push({ id: a.id, nombre: a.nombre_completo, grupo: "disponible",  detalle: "Relevo programado" });
  for (const a of p.descansando)       r.push({ id: a.id, nombre: a.nombre_completo, grupo: "descansando", detalle: a.turno_nombre ?? null });
  for (const a of p.trabajando)        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_puesto",   detalle: a.puesto_nombre ?? null });
  for (const a of p.ausenteProgramado) r.push({ id: a.id, nombre: a.nombre_completo, grupo: "ausente",     detalle: a.plan_tipo_ausencia ?? null });
  for (const a of p.noElegible)        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "ausente",     detalle: a.razon_no_elegible ?? null });
  return r;
}

function SelectorAgenteAgrupado({
  fecha,
  idsExcluidos = [],
  seleccionado,
  onSelect,
  puestoId,
  zonaId,
}: {
  fecha: string;
  idsExcluidos?: number[];
  seleccionado: number | null;
  onSelect: (a: AgenteAgrupado) => void;
  /** Si se provee, activa el modo ranking P1-P4 basado en zona */
  puestoId?: number;
  zonaId?: number | null;
}) {
  const hoy = new Date().toISOString().split("T")[0];
  const esFuturo = fecha > hoy;
  const modoRanking = !esFuturo && !!puestoId && !!zonaId;

  const [busqueda, setBusqueda] = useState("");
  const [pendienteConf, setPendienteConf] = useState<AgenteAgrupado | null>(null);
  const [pendienteRanked, setPendienteRanked] = useState<AgenteRankeado | null>(null);

  // Pool base (sin hints de puesto)
  const { data: poolActual } = useQuery<Pool>({
    queryKey: ["operaciones-pool"],
    queryFn: () => fetch(`${API_BASE}/operaciones/pool`).then((r) => r.json()),
    enabled: !esFuturo && !modoRanking,
    staleTime: 60_000,
  });

  // Pool con hints de experiencia (para ranking)
  const { data: poolRanked } = useQuery<Pool>({
    queryKey: ["operaciones-pool", puestoId],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/pool?puesto_id=${puestoId}`).then((r) => r.json()),
    enabled: modoRanking,
    staleTime: 60_000,
  });

  const { data: poolFuturoRaw } = useQuery<PoolFuturoData>({
    queryKey: ["pool-futuro", fecha],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/pool-futuro?fecha=${fecha}`).then((r) => r.json()),
    enabled: esFuturo,
    staleTime: 120_000,
  });

  // ── Modo ranking: candidatos rankeados P1-P4 ─────────────────────────────
  const candidatosRankeados = useMemo<AgenteRankeado[]>(() => {
    if (!modoRanking || !poolRanked) return [];
    return rankCandidatos(poolRanked, zonaId);
  }, [modoRanking, poolRanked, zonaId]);

  // ── Modo estándar: agentes agrupados por estado ───────────────────────────
  const todos = useMemo<AgenteAgrupado[]>(() => {
    if (modoRanking) return [];
    if (!esFuturo && poolActual)    return normalizarPoolActual(poolActual);
    if (esFuturo   && poolFuturoRaw) return normalizarPoolFuturo(poolFuturoRaw);
    return [];
  }, [modoRanking, esFuturo, poolActual, poolFuturoRaw]);

  // Filtrado por búsqueda
  const filtradosEstandar = useMemo(() => {
    const q = busqueda.toLowerCase();
    return todos.filter(
      (a) => !idsExcluidos.includes(a.id) && (!q || a.nombre.toLowerCase().includes(q)),
    );
  }, [todos, idsExcluidos, busqueda]);

  const filtradosRanked = useMemo(() => {
    const q = busqueda.toLowerCase();
    return candidatosRankeados.filter(
      (a) => !idsExcluidos.includes(a.id) && (!q || a.nombre_completo.toLowerCase().includes(q)),
    );
  }, [candidatosRankeados, idsExcluidos, busqueda]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleClickEstandar(a: AgenteAgrupado) {
    const cfg = GRUPO_CONFIG[a.grupo];
    if (!cfg.seleccionable) return;
    if (cfg.advertencia) { setPendienteConf(a); return; }
    onSelect(a);
  }

  function handleClickRanked(ar: AgenteRankeado) {
    // P2/P4: descanso de ciclo — requiere confirmación de HE
    // P5: contingencia supervisor/jefe — siempre requiere confirmación especial
    const requiereConf = ar.grupo === "P2" || ar.grupo === "P4" || ar.grupo === "P5";
    if (requiereConf) { setPendienteRanked(ar); return; }
    onSelect({
      id: ar.id,
      nombre: ar.nombre_completo,
      grupo: "disponible",
      detalle: ar.puesto ?? null,
    } as AgenteAgrupado);
  }

  function confirmarRanked() {
    if (!pendienteRanked) return;
    onSelect({
      id: pendienteRanked.id,
      nombre: pendienteRanked.nombre_completo,
      grupo: pendienteRanked.grupo === "P5" ? "disponible" : "descansando",
      detalle: pendienteRanked.puesto ?? null,
      tipo_personal: (pendienteRanked as any).tipo_personal,
    } as AgenteAgrupado);
    setPendienteRanked(null);
  }

  // ── Render modo ranking ───────────────────────────────────────────────────
  if (modoRanking) {
    const gruposRanking = (["P1", "P2", "P3", "P4", "P5"] as GrupoRanking[])
      .map((g) => ({ g, lista: filtradosRanked.filter((a) => a.grupo === g) }))
      .filter((x) => x.lista.length > 0);

    return (
      <div className="space-y-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar agente…"
          className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-indigo-400/40"
        />

        {/* Confirmación para agente en descanso o contingencia */}
        {pendienteRanked && (
          <div className={`border rounded-xl px-3 py-2.5 space-y-2 ${pendienteRanked.grupo === "P5" ? "bg-orange-500/10 border-orange-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
            <div className="flex items-start gap-2">
              {pendienteRanked.grupo === "P5"
                ? <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
              {pendienteRanked.grupo === "P5" ? (
                <p className="text-[10px] text-orange-300/80 leading-snug">
                  <span className="font-semibold">{pendienteRanked.nombre_completo}</span> es{" "}
                  {(pendienteRanked as any).tipo_personal === "supervisor" ? "Supervisor" : "Jefe de Servicio"}.
                  {" "}Esta es una <span className="font-semibold text-orange-300">cobertura de contingencia operativa</span>. Solo cubrirá temporalmente, sin cambiar titularidad.
                </p>
              ) : (
                <p className="text-[10px] text-amber-300/80 leading-snug">
                  <span className="font-semibold">{pendienteRanked.nombre_completo}</span> está en descanso de ciclo. Asignar implicaría horas extra.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarRanked} className={`text-[10px] px-3 py-1 rounded-lg font-semibold ${pendienteRanked.grupo === "P5" ? "bg-orange-500/20 border border-orange-500/40 text-orange-300" : "bg-amber-500/20 border border-amber-500/40 text-amber-300"}`}>
                Confirmar
              </button>
              <button onClick={() => setPendienteRanked(null)} className="text-[10px] px-3 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/60">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
          {gruposRanking.length === 0 && (
            <div className="text-center py-5">
              <UserMinus className="w-5 h-5 text-white/10 mx-auto mb-1" />
              <p className="text-[11px] text-white/20">Sin candidatos disponibles</p>
            </div>
          )}
          {gruposRanking.map(({ g, lista }) => {
            const cfg = RANKING_GRUPO_CONFIG[g];
            return (
              <div key={g}>
                <div className="flex items-center gap-2 mb-1 px-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${cfg.headerColor}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[9px] text-white/25">({lista.length})</span>
                </div>
                <div className="space-y-0.5">
                  {lista.map((ar) => {
                    const selec = seleccionado === ar.id;
                    return (
                      <button
                        key={ar.id}
                        onClick={() => handleClickRanked(ar)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                          selec ? "bg-primary/15 border-primary/40" : `bg-[#0c1929] ${cfg.borderColor} hover:border-white/15`
                        }`}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(ar.nombre_completo)}`}>
                          {iniciales(ar.nombre_completo)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/85 truncate">{ar.nombre_completo}</p>
                          {ar.puesto && (
                            <p className="text-[9px] text-white/28 truncate">{ar.puesto}</p>
                          )}
                        </div>
                        {/* Badges de motivos */}
                        <div className="flex items-center gap-0.5 shrink-0 flex-wrap justify-end max-w-[90px]">
                          {ar.motivos.slice(0, 3).map((m) => {
                            const mc = RANKING_MOTIVO_CONFIG[m];
                            if (!mc) return null;
                            return (
                              <span key={m} className={`text-[7px] font-bold px-1 py-0.5 rounded ${mc.cls}`}>
                                {mc.label}
                              </span>
                            );
                          })}
                        </div>
                        {selec && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-white/18 text-right">Candidatos rankeados por zona · hoy</p>
      </div>
    );
  }

  // ── Render modo estándar ──────────────────────────────────────────────────
  const ORDEN: GrupoEstado[] = ["disponible", "descansando", "en_puesto", "en_ssa", "ausente"];
  const grupos = ORDEN
    .map((g) => ({ g, lista: filtradosEstandar.filter((a) => a.grupo === g) }))
    .filter((x) => x.lista.length > 0);

  return (
    <div className="space-y-2">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar agente…"
        className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-blue-400/40"
      />

      {/* Confirmación inline */}
      {pendienteConf && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300/80 leading-snug">
              <span className="font-semibold">{pendienteConf.nombre}</span> — {GRUPO_CONFIG[pendienteConf.grupo].advertencia}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onSelect(pendienteConf); setPendienteConf(null); }}
              className="text-[10px] px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold"
            >
              Confirmar
            </button>
            <button
              onClick={() => setPendienteConf(null)}
              className="text-[10px] px-3 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista agrupada */}
      <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
        {grupos.length === 0 && (
          <div className="text-center py-5">
            <UserMinus className="w-5 h-5 text-white/10 mx-auto mb-1" />
            <p className="text-[11px] text-white/20">Sin agentes disponibles</p>
          </div>
        )}
        {grupos.map(({ g, lista }) => {
          const cfg = GRUPO_CONFIG[g];
          return (
            <div key={g}>
              <div className="flex items-center gap-1.5 mb-1 px-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                <span className={`text-[9px] font-bold uppercase tracking-widest ${cfg.color}`}>
                  {cfg.label} ({lista.length})
                </span>
              </div>
              <div className="space-y-0.5">
                {lista.map((a) => {
                  const selec = seleccionado === a.id;
                  const bloq  = !cfg.seleccionable;
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleClickEstandar(a)}
                      disabled={bloq}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                        selec  ? "bg-primary/15 border-primary/40"
                        : bloq  ? "bg-white/2 border-white/4 opacity-40 cursor-not-allowed"
                        :         "bg-[#0c1929] border-white/6 hover:border-white/15"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(a.nombre)}`}>
                        {iniciales(a.nombre)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/85 truncate">{a.nombre}</p>
                        {a.detalle && (
                          <p className="text-[9px] text-white/28 truncate">{a.detalle}</p>
                        )}
                      </div>
                      {cfg.badge && !bloq && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 shrink-0">
                          {cfg.badge}
                        </span>
                      )}
                      {selec && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-white/18 text-right">
        {esFuturo
          ? `Proyección para ${fecha.split("-").reverse().join("-")}`
          : "Estado operativo actual · hoy"}
      </p>
    </div>
  );
}

// ─── Slot de agente para ModalPlanSSA ─────────────────────────────────────────

function SlotAgentePlan({
  slotIdx,
  totalSlots,
  fecha,
  agenteSel,
  idsOcupados,
  onSelect,
  onClear,
}: {
  slotIdx: number;
  totalSlots: number;
  fecha: string;
  agenteSel: EmpleadoBusqueda | null;
  idsOcupados: number[];
  onSelect: (emp: EmpleadoBusqueda) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest block mb-1">
        Guardia {totalSlots > 1 ? slotIdx + 1 : ""} <span className="text-white/20 normal-case font-normal">(opcional)</span>
      </label>
      {agenteSel ? (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-xl px-3 py-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(agenteSel.nombreCompleto)}`}>
            {iniciales(agenteSel.nombreCompleto)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-200 truncate">{agenteSel.nombreCompleto}</p>
            <p className="text-[10px] text-blue-300/50">{agenteSel.puesto ?? "Agente"}</p>
          </div>
          <button onClick={onClear} className="text-white/25 hover:text-red-400 transition-colors">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <SelectorAgenteAgrupado
          fecha={fecha}
          idsExcluidos={idsOcupados}
          seleccionado={null}
          onSelect={(a) => onSelect({ id: a.id, nombreCompleto: a.nombre, puesto: a.detalle, area: null })}
        />
      )}
    </div>
  );
}

function ModalPlanSSA({
  ssa,
  fecha,
  planAgentes,
  onClose,
  onGuardar,
  onEliminar,
}: {
  ssa: InicioProyecto;
  fecha: string;
  planAgentes: PlanAgenteSSA[];
  onClose: () => void;
  onGuardar: (agentes: Array<{ id: number | null }>) => Promise<void>;
  onEliminar?: () => void;
}) {
  const totalSlots = Math.max(ssa.total_puestos ?? 1, 1);
  const [guardando, setGuardando] = useState(false);

  // Inicializar slots con planes existentes
  const [slots, setSlots] = useState<Array<EmpleadoBusqueda | null>>(() => {
    const init: Array<EmpleadoBusqueda | null> = Array(totalSlots).fill(null);
    planAgentes.slice(0, totalSlots).forEach((pa, i) => {
      if (pa.relevo_id && pa.relevo_nombre) {
        init[i] = { id: pa.relevo_id, nombreCompleto: pa.relevo_nombre, puesto: null, area: null };
      }
    });
    return init;
  });

  const idsOcupados = slots.filter(Boolean).map((s) => s!.id);
  const [y, m, d] = fecha.split("-");
  const fechaDisplay = `${d}-${m}-${y}`;
  const tipoLabel = TIPO_SSA_LABELS[ssa.tipo_solicitud ?? ""] ?? ssa.tipo_solicitud ?? "SSA";
  const hayPlanesExistentes = planAgentes.length > 0;
  const agentesSeleccionados = slots.filter(Boolean).length;

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar(slots.map((s) => ({ id: s?.id ?? null })));
    } finally {
      setGuardando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#060e1c] border border-blue-500/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-blue-300/70 font-semibold uppercase tracking-widest">
                {hayPlanesExistentes ? "Editar planificación" : "Planificar SSA"} · {fechaDisplay}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate">{tipoLabel}</h2>
            <p className="text-[11px] text-white/35">
              {ssa.cliente_nombre_comercial || ssa.cliente_nombre}
              {ssa.hora_inicio ? ` · ${ssa.hora_inicio}–${ssa.hora_fin ?? ""}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar modal" className="text-white/30 hover:text-white transition-colors mt-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Info del SSA */}
          {ssa.descripcion && (
            <div className="flex items-start gap-2.5 bg-blue-500/6 border border-blue-500/15 rounded-xl px-3 py-2.5">
              <Info className="w-3.5 h-3.5 text-blue-400/60 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-200/60 leading-relaxed">{ssa.descripcion}</p>
            </div>
          )}

          {/* Resumen de cobertura */}
          <div className="flex items-center justify-between bg-white/3 border border-white/6 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{totalSlots} {totalSlots === 1 ? "guardia requerido" : "guardias requeridos"}</span>
            </div>
            {agentesSeleccionados > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                agentesSeleccionados >= totalSlots
                  ? "bg-green-500/15 border border-green-500/25 text-green-400"
                  : "bg-amber-500/12 border border-amber-500/20 text-amber-400"
              }`}>
                {agentesSeleccionados}/{totalSlots}
              </span>
            )}
          </div>

          {/* Slots de agentes */}
          <div className="space-y-3">
            {slots.map((slot, i) => (
              <SlotAgentePlan
                key={i}
                slotIdx={i}
                totalSlots={totalSlots}
                fecha={fecha}
                agenteSel={slot}
                idsOcupados={idsOcupados.filter((_, j) => j !== i ? true : false)}
                onSelect={(emp) => {
                  const next = [...slots];
                  next[i] = emp;
                  setSlots(next);
                }}
                onClear={() => {
                  const next = [...slots];
                  next[i] = null;
                  setSlots(next);
                }}
              />
            ))}
          </div>

          {/* Advertencia cobertura incompleta */}
          {agentesSeleccionados > 0 && agentesSeleccionados < totalSlots && (
            <div className="flex items-start gap-2 bg-amber-500/6 border border-amber-500/15 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300/60">
                Cobertura parcial: {agentesSeleccionados} de {totalSlots} guardias planificados. Puedes guardar de todas formas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <div>
            {hayPlanesExistentes && onEliminar && (
              <button
                onClick={onEliminar}
                className="flex items-center gap-1.5 text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Cancelar todo
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-[11px] text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
            >
              Cerrar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/25 border border-blue-500/40 text-[11px] font-semibold text-blue-200 hover:bg-blue-600/35 transition-all disabled:opacity-50"
            >
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
              {hayPlanesExistentes ? "Actualizar" : "Guardar plan"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalPlanFuturo({
  puesto,
  fecha,
  planExistente,
  onClose,
  onGuardar,
  onEliminar,
}: {
  puesto: Puesto;
  fecha: string;
  planExistente: PlanFuturo | null;
  onClose: () => void;
  onGuardar: (data: {
    tipoAusencia: string;
    titularAusenteId: number | null;
    relevId: number | null;
    motivo: string;
    notas: string;
  }) => Promise<void>;
  onEliminar?: () => void;
}) {
  const { toast } = useToast();
  const [tipoAusencia, setTipoAusencia] = useState(planExistente?.tipo_ausencia ?? "permiso_con_goce");
  const [motivo, setMotivo]             = useState(planExistente?.motivo ?? "");
  const [notas, setNotas]               = useState(planExistente?.notas ?? "");
  const [guardando, setGuardando]       = useState(false);
  const [relevoSel, setRelevoSel]       = useState<EmpleadoBusqueda | null>(
    planExistente?.relevo_id
      ? { id: planExistente.relevo_id, nombreCompleto: planExistente.relevo_nombre ?? "", puesto: null, area: null }
      : null
  );

  const [y, m, d] = fecha.split("-");
  const fechaDisplay = `${d}-${m}-${y}`;

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar({
        tipoAusencia,
        titularAusenteId: puesto.titular_employee_id,
        relevId: relevoSel?.id ?? null,
        motivo,
        notas,
      });
    } catch {
      toast({ title: "Error al guardar el plan", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#060e1c] border border-indigo-500/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] text-indigo-300/70 font-semibold uppercase tracking-widest">
                {planExistente ? "Editar plan" : "Planificar"} · {fechaDisplay}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate">{puesto.nombre}</h2>
            <p className="text-[11px] text-white/35">{puesto.cliente_nombre}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors mt-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tipo de ausencia */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Tipo de ausencia
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TIPOS_AUSENCIA_FUTURO.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTipoAusencia(value)}
                  className={`px-3 py-2 rounded-xl border text-[11px] font-medium text-left transition-all ${
                    tipoAusencia === value
                      ? "bg-indigo-600/25 border-indigo-500/50 text-indigo-200"
                      : "bg-white/4 border-white/8 text-white/50 hover:border-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Titular */}
          <div className="flex items-center gap-2.5 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
            <User className="w-3.5 h-3.5 text-white/25 shrink-0" />
            <div>
              <p className="text-[10px] text-white/30 font-semibold">Titular del puesto</p>
              <p className="text-xs text-white/70">{puesto.titular_nombre ?? "Sin titular definido"}</p>
            </div>
          </div>

          {/* Relevo programado */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Relevo programado <span className="text-white/20 normal-case font-normal">(opcional)</span>
            </label>
            {relevoSel ? (
              <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(relevoSel.nombreCompleto)}`}>
                  {iniciales(relevoSel.nombreCompleto)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-indigo-200 truncate">{relevoSel.nombreCompleto}</p>
                  <p className="text-[10px] text-indigo-300/50">{relevoSel.puesto ?? "Agente"}</p>
                </div>
                <button onClick={() => setRelevoSel(null)} className="text-white/25 hover:text-red-400 transition-colors">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <SelectorAgenteAgrupado
                fecha={fecha}
                seleccionado={null}
                onSelect={(a) =>
                  setRelevoSel({ id: a.id, nombreCompleto: a.nombre, puesto: a.detalle ?? null, area: null })
                }
              />
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Motivo <span className="text-white/20 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. permiso autorizado por RRHH"
              className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-indigo-400/40"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
              Notas internas <span className="text-white/20 normal-case font-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Información adicional para el equipo de operaciones…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-indigo-400/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <div>
            {planExistente && (
              <button
                onClick={() => onEliminar?.()}
                className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Cancelar plan
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-white/50 hover:text-white border border-white/8 rounded-xl transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              {planExistente ? "Actualizar" : "Programar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal Configurar Turno de Puesto ─────────────────────────────────────────

interface TurnoApiItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  horas_trabajo: number;
  horas_descanso: number;
  ciclo_horas: number;
  tipo_ciclo: "diario" | "alternado";
  dias_trabajo: number;
  dias_descanso: number;
  puestos_count: number;
  num_titulares: number;
}

interface TitularForm {
  employee_id: number;
  nombre_completo: string;
  fecha_inicio_ciclo: string;
}

function ModalConfigTurno({
  puesto,
  onClose,
  onSaved,
}: {
  puesto: Puesto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [turnoId, setTurnoId]         = useState<string>(String(puesto.tipo_turno_id ?? ""));
  const [fechaInicio, setFechaInicio] = useState<string>(puesto.fecha_inicio_ciclo ?? new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando]     = useState(false);

  // ── Titulares ────────────────────────────────────────────────────────────────
  const [titulares, setTitulares] = useState<TitularForm[]>(
    (puesto.titulares ?? []).map(t => ({
      employee_id:        t.employee_id,
      nombre_completo:    t.nombre,
      fecha_inicio_ciclo: t.fecha_inicio_ciclo ?? new Date().toISOString().slice(0, 10),
    }))
  );
  const [showAdd, setShowAdd]         = useState(false);
  const [nuevoEmpId, setNuevoEmpId]   = useState<string>("");
  const [nuevoFecha, setNuevoFecha]   = useState<string>(new Date().toISOString().slice(0, 10));
  const [guardandoT, setGuardandoT]   = useState(false);
  const [busqueda, setBusqueda]       = useState("");

  const { data: turnos = [], isLoading: cargandoTurnos } = useQuery<TurnoApiItem[]>({
    queryKey: ["turnos-catalogo"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/turnos`, { credentials: "include" });
      if (!r.ok) throw new Error("Error al cargar turnos");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: empleadosPool = [] } = useQuery<{id:number;nombre_completo:string}[]>({
    queryKey: ["empleados-activos-guardia"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/employees`, { credentials: "include" });
      if (!r.ok) throw new Error("Error al cargar empleados");
      const all = await r.json();
      return (all.employees ?? all)
        .filter((e: any) => e.estadoLaboral === "activo" && ["guardia","custodio"].includes(e.tipoPersonal ?? "guardia"))
        .map((e: any) => ({ id: e.id, nombre_completo: e.nombreCompleto }));
    },
    staleTime: 2 * 60_000,
  });

  const turnoSeleccionado = turnos.find(t => String(t.id) === turnoId) ?? null;
  const esTurnoAlternado  = turnoSeleccionado?.tipo_ciclo !== "diario";

  const empleadosFiltrados = empleadosPool.filter(e => {
    const yaEsTitular = titulares.some(t => t.employee_id === e.id);
    const coincide = e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase());
    return !yaEsTitular && coincide;
  });

  async function guardarTurno() {
    if (!turnoId) { toast({ title: "Selecciona un turno", variant: "destructive" }); return; }
    if (!fechaInicio) { toast({ title: "Indica la fecha de inicio de ciclo", variant: "destructive" }); return; }
    setGuardando(true);
    try {
      const r = await fetch(`${API_BASE}/operaciones/puestos/${puesto.id}/turno`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_turno_id: parseInt(turnoId), fecha_inicio_ciclo: fechaInicio }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error al guardar turno"); }
      toast({ title: "✅ Turno actualizado" });
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  async function guardarTitulares() {
    if (titulares.length === 0) {
      toast({ title: "Agrega al menos un titular", variant: "destructive" });
      return;
    }
    setGuardandoT(true);
    try {
      const r = await fetch(`${API_BASE}/operaciones/puestos/${puesto.id}/titulares`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulares: titulares.map((t, i) => ({
          employee_id: t.employee_id,
          fecha_inicio_ciclo: t.fecha_inicio_ciclo,
          orden: i + 1,
        }))}),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error al guardar titulares"); }
      toast({ title: "✅ Titulares actualizados" });
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setGuardandoT(false);
    }
  }

  function agregarTitular() {
    const emp = empleadosPool.find(e => String(e.id) === nuevoEmpId);
    if (!emp) { toast({ title: "Selecciona un colaborador de la lista", variant: "destructive" }); return; }
    if (!nuevoFecha) { toast({ title: "Indica la fecha de inicio", variant: "destructive" }); return; }
    setTitulares(prev => [...prev, { employee_id: emp.id, nombre_completo: emp.nombre_completo, fecha_inicio_ciclo: nuevoFecha }]);
    setNuevoEmpId("");
    setNuevoFecha(new Date().toISOString().slice(0, 10));
    setBusqueda("");
    setShowAdd(false);
  }

  function eliminarTitular(idx: number) {
    setTitulares(prev => prev.filter((_, i) => i !== idx));
  }

  function actualizarFechaTitular(idx: number, fecha: string) {
    setTitulares(prev => prev.map((t, i) => i === idx ? { ...t, fecha_inicio_ciclo: fecha } : t));
  }

  const hintTurno = turnoSeleccionado?.nombre === "24x24"
    ? "Titular 2: fecha = Titular 1 + 1 día"
    : turnoSeleccionado?.nombre === "24x48"
    ? "Ambas fechas deben ser lunes. Titular 2: lunes anterior o posterior al Titular 1"
    : turnoSeleccionado?.nombre === "24x72"
    ? "Titular 2: fecha = Titular 1 + 15 días"
    : null;

  const maxTitulares = turnoSeleccionado?.num_titulares ?? 2;
  const titularesLleno = titulares.length >= maxTitulares;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-[#0a1628] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0d1e38] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/90">Configurar Turno y Titulares</p>
              <p className="text-[10px] text-white/40 truncate max-w-[260px]">{puesto.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">
            {/* Turno actual */}
            {puesto.tipo_turno_id && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/4 border border-white/8 rounded-lg">
                <Repeat className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <p className="text-[11px] text-white/50">
                  Turno actual: <span className="text-white/70 font-semibold">{puesto.turno_nombre ?? "—"}</span>
                  {puesto.tipo_ciclo === "alternado" && puesto.horas_trabajo && puesto.horas_descanso && (
                    <> · {Math.ceil(puesto.horas_trabajo / 24)}d trabaja / {Math.ceil(puesto.horas_descanso / 24)}d descansa</>
                  )}
                </p>
              </div>
            )}

            {/* Selector de turno */}
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">Tipo de turno</label>
              {cargandoTurnos ? (
                <div className="flex items-center gap-2 px-3 py-2 text-white/30 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando turnos…
                </div>
              ) : (
                <select
                  value={turnoId}
                  onChange={e => setTurnoId(e.target.value)}
                  className="w-full bg-[#0d1e38] border border-white/12 text-white/80 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="">— Seleccionar turno —</option>
                  {turnos.filter(t => t.id).map(t => (
                    <option key={t.id} value={String(t.id)}>
                      {t.nombre} — {t.tipo_ciclo === "diario"
                        ? `${t.horas_trabajo}h/día`
                        : `${Math.ceil(t.horas_trabajo / 24)}d trabajo / ${Math.ceil(t.horas_descanso / 24)}d descanso`
                      }
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Info del turno seleccionado */}
            {turnoSeleccionado && (
              <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                turnoSeleccionado.tipo_ciclo === "diario"
                  ? "bg-emerald-500/6 border-emerald-500/15"
                  : "bg-indigo-500/6 border-indigo-500/15"
              }`}>
                {turnoSeleccionado.tipo_ciclo === "diario"
                  ? <Sun className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  : <Repeat className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                }
                <div>
                  <p className={`text-[10px] font-semibold ${turnoSeleccionado.tipo_ciclo === "diario" ? "text-emerald-300/80" : "text-indigo-300/80"}`}>
                    Ciclo {turnoSeleccionado.tipo_ciclo === "diario" ? "diario" : "alternado"}
                  </p>
                  {turnoSeleccionado.tipo_ciclo === "diario" ? (
                    <p className="text-[10px] text-white/40 mt-0.5">
                      El colaborador trabaja {turnoSeleccionado.horas_trabajo}h todos los días del ciclo.
                    </p>
                  ) : (
                    <p className="text-[10px] text-white/40 mt-0.5">
                      Trabaja {turnoSeleccionado.dias_trabajo} día(s) y descansa {turnoSeleccionado.dias_descanso} día(s). La fecha de inicio del Titular 1 marca el primer día de trabajo.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Fecha de inicio de ciclo (Titular 1 / referencial) */}
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1.5">
                {esTurnoAlternado ? "Fecha de inicio del ciclo — Titular 1" : "Fecha de inicio del ciclo"}
                <span className="ml-1 text-white/30 font-normal">— primer día de trabajo</span>
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full bg-[#0d1e38] border border-white/12 text-white/80 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Botón: guardar solo el turno */}
            <button
              onClick={guardarTurno}
              disabled={guardando || !turnoId || !fechaInicio}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0d1e38] hover:bg-white/5 border border-white/10 disabled:opacity-50 text-white/70 text-xs font-medium rounded-lg transition-colors"
            >
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5 opacity-60" />}
              {guardando ? "Guardando turno…" : "Guardar solo el turno"}
            </button>

            {/* ── SECCIÓN TITULARES (solo para turnos alternados) ── */}
            {esTurnoAlternado && (
              <div className="space-y-3 pt-2 border-t border-white/8">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
                    <Moon className="w-3 h-3 text-indigo-400" />
                    Titulares del puesto
                    <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${titularesLleno ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300/70"}`}>
                      {titulares.length}/{maxTitulares}
                    </span>
                  </p>
                  {hintTurno && (
                    <span className="text-[9px] text-indigo-300/50 bg-indigo-500/8 border border-indigo-500/15 px-2 py-0.5 rounded-full">
                      {hintTurno}
                    </span>
                  )}
                </div>

                {/* Lista de titulares actuales */}
                {titulares.length === 0 ? (
                  <p className="text-[10px] text-white/30 px-1">Sin titulares asignados.</p>
                ) : (
                  <div className="space-y-2">
                    {titulares.map((t, i) => (
                      <div key={t.employee_id} className="flex items-center gap-2 px-3 py-2 bg-white/3 border border-white/8 rounded-lg">
                        <div className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-indigo-300">T{i + 1}</span>
                        </div>
                        <p className="text-[11px] text-white/80 flex-1 truncate font-medium">{t.nombre_completo}</p>
                        <input
                          type="date"
                          value={t.fecha_inicio_ciclo}
                          onChange={e => actualizarFechaTitular(i, e.target.value)}
                          className="bg-[#0d1e38] border border-white/10 text-white/60 text-[10px] rounded px-2 py-1 focus:outline-none focus:border-indigo-500/50 w-32 shrink-0"
                        />
                        <button
                          onClick={() => eliminarTitular(i)}
                          className="p-1 rounded hover:bg-red-500/15 text-white/20 hover:text-red-400 transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form: agregar nuevo titular */}
                {showAdd ? (
                  <div className="space-y-2 px-3 py-3 bg-indigo-500/5 border border-indigo-500/15 rounded-lg">
                    <p className="text-[10px] font-semibold text-indigo-300/70">Nuevo titular</p>
                    <input
                      type="text"
                      placeholder="Filtrar por nombre…"
                      value={busqueda}
                      onChange={e => { setBusqueda(e.target.value); setNuevoEmpId(""); }}
                      className="w-full bg-[#0d1e38] border border-white/12 text-white/80 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50 placeholder-white/20"
                    />
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-white/8 bg-[#0a1628]">
                      {empleadosFiltrados.length === 0 ? (
                        <p className="px-3 py-2 text-[10px] text-white/30">
                          {busqueda ? "Sin resultados" : "Todos los colaboradores ya son titulares"}
                        </p>
                      ) : (
                        empleadosFiltrados.map(e => (
                          <button
                            key={e.id}
                            onClick={() => { setNuevoEmpId(String(e.id)); }}
                            className={`w-full text-left px-3 py-2 text-[11px] hover:bg-white/6 transition-colors border-b border-white/4 last:border-0 ${nuevoEmpId === String(e.id) ? "bg-indigo-500/20 text-indigo-200 font-semibold" : "text-white/70"}`}
                          >
                            {e.nombre_completo}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[9px] text-white/40 mb-0.5">Fecha inicio ciclo</label>
                        <input
                          type="date"
                          value={nuevoFecha}
                          onChange={e => setNuevoFecha(e.target.value)}
                          className="w-full bg-[#0d1e38] border border-white/12 text-white/70 text-[10px] rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <button
                        onClick={agregarTitular}
                        disabled={!nuevoEmpId || !nuevoFecha}
                        className="px-3 py-2 mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-semibold rounded-lg transition-colors shrink-0"
                      >
                        Agregar
                      </button>
                      <button
                        onClick={() => { setShowAdd(false); setBusqueda(""); setNuevoEmpId(""); }}
                        className="px-3 py-2 mt-4 bg-white/5 hover:bg-white/10 text-white/40 text-[10px] rounded-lg transition-colors shrink-0"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : titularesLleno ? (
                  <p className="text-center text-[10px] text-emerald-400/70 py-1">
                    Límite de {maxTitulares} titular{maxTitulares !== 1 ? "es" : ""} alcanzado
                  </p>
                ) : (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-indigo-500/25 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-indigo-300/50 hover:text-indigo-300/80 text-[10px] rounded-lg transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Agregar titular
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-white/8 bg-[#080f1e] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-white/50 hover:text-white/80 rounded-lg hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          {esTurnoAlternado ? (
            <button
              onClick={guardarTitulares}
              disabled={guardandoT || titulares.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {guardandoT ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Moon className="w-3.5 h-3.5" />}
              {guardandoT ? "Guardando…" : `Guardar titulares (${titulares.length})`}
            </button>
          ) : (
            <button
              onClick={async () => { await guardarTurno(); onSaved(); onClose(); }}
              disabled={guardando || !turnoId || !fechaInicio}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />}
              {guardando ? "Guardando…" : "Guardar turno"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Tarjeta de Puesto Futuro ──────────────────────────────────────────────────

const LABELS_AUSENCIA_FUTURO: Record<string, string> = {
  permiso_con_goce: "Permiso c/goce",
  permiso_sin_goce: "Permiso s/goce",
  vacaciones:       "Vacaciones",
  incapacidad:      "Incapacidad",
  suspension:       "Suspensión",
  otro:             "Ausencia",
};

function TarjetaPuestoFuturo({
  puesto,
  plan,
  estadoTitular,
  onClick,
}: {
  puesto: Puesto;
  plan: PlanFuturo | null;
  estadoTitular?: "trabajando" | "descansando" | "sin_turno" | null;
  onClick: () => void;
}) {
  const tieneRelevo = !!(plan?.relevo_id);

  // Badge de estado del titular según ciclo de turno
  const estadoBadge = estadoTitular === "trabajando"
    ? { label: "Trabaja", cls: "text-teal-300/80 bg-teal-500/10 border-teal-500/25" }
    : estadoTitular === "descansando"
    ? { label: "Descansa", cls: "text-blue-300/80 bg-blue-500/10 border-blue-500/25" }
    : null;

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl border p-3 transition-all cursor-pointer group
        ${plan
          ? tieneRelevo
            ? "bg-[#080f1c] border-indigo-500/30 hover:border-indigo-400/50"
            : "bg-[#120d08] border-amber-500/30 hover:border-amber-400/50"
          : "bg-[#07111f] border-white/6 hover:border-indigo-500/20"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 truncate">{puesto.nombre}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {/* Turno real del puesto */}
            {puesto.turno_nombre ? (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                puesto.tipo_ciclo === "alternado"
                  ? "text-indigo-300/80 bg-indigo-500/8 border-indigo-500/20"
                  : "text-emerald-300/70 bg-emerald-500/6 border-emerald-500/15"
              }`}>
                {puesto.tipo_ciclo === "alternado" && <Repeat className="w-2 h-2 inline mr-0.5 opacity-70" />}
                {puesto.turno_nombre}
              </span>
            ) : (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${TURNO_COLORS[puesto.turno] ?? "text-white/30 bg-white/5 border-white/10"}`}>
                {puesto.turno}
              </span>
            )}
            {/* Estado titular: trabaja / descansa ese día */}
            {estadoBadge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${estadoBadge.cls}`}>
                {estadoBadge.label}
              </span>
            )}
            {plan && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                tieneRelevo
                  ? "text-indigo-300/90 bg-indigo-500/10 border-indigo-500/25"
                  : "text-amber-300/90 bg-amber-500/10 border-amber-500/25"
              }`}>
                {tieneRelevo ? "CUBIERTO" : "SIN RELEVO"}
              </span>
            )}
            {!plan && !estadoBadge && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-white/20 bg-white/3 border-white/8">
                Sin cambios
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 mt-0.5">
          <Calendar className={`w-3.5 h-3.5 ${plan ? (tieneRelevo ? "text-indigo-400" : "text-amber-400") : "text-white/10"}`} />
        </div>
      </div>

      {/* Titular esperado */}
      {puesto.titular_nombre && !plan && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(puesto.titular_nombre)}`}>
            {iniciales(puesto.titular_nombre)}
          </div>
          <p className="text-[10px] text-white/50 truncate">{puesto.titular_nombre.split(" ").slice(0,3).join(" ")}</p>
          {estadoBadge && (
            <span className={`text-[8px] font-semibold ml-auto ${estadoTitular === "trabajando" ? "text-teal-400/70" : "text-blue-400/70"}`}>
              {estadoTitular === "trabajando" ? "↑ Turno" : "↓ Descanso"}
            </span>
          )}
        </div>
      )}

      {plan ? (
        <div className="space-y-1.5">
          {/* Tipo de ausencia */}
          <div className="flex items-center gap-1.5 px-1.5 py-1 bg-amber-500/6 rounded-lg border border-amber-500/15">
            <AlertCircle className="w-2.5 h-2.5 text-amber-400/60 shrink-0" />
            <p className="text-[9px] text-amber-300/60 truncate">
              <span className="text-amber-300/80 font-semibold">
                {LABELS_AUSENCIA_FUTURO[plan.tipo_ausencia ?? ""] ?? "Ausencia"}:
              </span>{" "}
              {plan.titular_ausente_nombre ?? puesto.titular_nombre ?? "Titular"}
            </p>
          </div>

          {/* Relevo */}
          {plan.relevo_nombre ? (
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(plan.relevo_nombre)}`}>
                {iniciales(plan.relevo_nombre)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-indigo-200/80 font-medium truncate">{plan.relevo_nombre}</p>
                <p className="text-[9px] text-indigo-300/40">Relevo programado</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-400/50">
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <p className="text-[10px]">Toca para asignar relevo →</p>
            </div>
          )}

          {plan.motivo && (
            <p className="text-[9px] text-white/25 truncate pt-0.5">· {plan.motivo}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-white/15">
          <User className="w-4 h-4 shrink-0" />
          <p className="text-[11px]">Sin ausencias planificadas</p>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-white/5">
        <p className="text-[9px] text-indigo-400/40 group-hover:text-indigo-400 transition-colors">
          {plan ? "Editar planificación →" : "+ Planificar ausencia o cobertura"}
        </p>
      </div>
    </div>
  );
}

// ─── Panel: Disponibilidad Futura (reemplaza el pool en vista futura) ─────────

const LABELS_FUENTE_AUSENCIA: Record<string, string> = {
  rrhh:                "RRHH",
  planificacion_futura: "Planificado",
};

const LABELS_AUSENCIA_RRHH: Record<string, string> = {
  permiso:          "Permiso",
  vacaciones:       "Vacaciones",
  incapacidad:      "Incapacidad",
  suspension:       "Suspensión",
  falta:            "Falta",
  permiso_sin_goce: "Permiso s/goce",
};

function PoolFuturoPanel({
  data,
  onAbrirPlan,
  onPlanSSA,
  onSelectAgente,
  agenteSeleccionadoId,
}: {
  data: PoolFuturoData;
  onAbrirPlan?: () => void;
  onPlanSSA?: (ip: InicioProyecto) => void;
  onSelectAgente?: (agente: Agente) => void;
  agenteSeleccionadoId?: number | null;
}) {
  const [tabActivo, setTabActivo] = useState<"descansando" | "disponible" | "ausenteProgramado" | "trabajando">("descansando");
  const [colapsado, setColapsado] = useState(false);

  const tabs = [
    {
      key: "descansando" as const,
      label: "De descanso",
      count: data.totales.descansando,
      color: "text-blue-400",
      activeBg: "border-blue-400 text-blue-300 bg-blue-500/5",
      desc: "Trabajarán otro día según su turno",
    },
    {
      key: "disponible" as const,
      label: "Disponibles",
      count: data.totales.disponible,
      color: "text-green-400",
      activeBg: "border-green-400 text-green-300 bg-green-500/5",
      desc: "Sin puesto asignado, elegibles para cobertura",
    },
    {
      key: "ausenteProgramado" as const,
      label: "Ausentes",
      count: data.totales.ausenteProgramado,
      color: "text-red-400",
      activeBg: "border-red-400 text-red-300 bg-red-500/5",
      desc: "Ausencias aprobadas o planificadas",
    },
    {
      key: "trabajando" as const,
      label: "En turno",
      count: data.totales.trabajando,
      color: "text-teal-400",
      activeBg: "border-teal-400 text-teal-300 bg-teal-500/5",
      desc: "Estarán cubriendo sus puestos ese día",
    },
  ];

  const agentesActivos = data[tabActivo] ?? [];

  return (
    <div className="shrink-0 bg-[#060f1a] border border-indigo-500/15 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setColapsado(prev => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-white/8 text-left group hover:bg-indigo-500/4 transition-colors"
      >
        <CalendarDays className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-xs font-bold text-indigo-300/80 uppercase tracking-widest group-hover:text-indigo-300 transition-colors">Pool de agentes</span>
        <span className="text-[10px] text-white/25 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full ml-1">
          {data.totales.descansando + data.totales.disponible} disponibles
        </span>
        {colapsado && (
          <div className="flex items-center gap-2 ml-1 text-[10px]">
            <span className="text-blue-400 font-bold">{data.totales.descansando} descanso</span>
            <span className="text-white/15">·</span>
            <span className="text-green-400 font-bold">{data.totales.disponible} libres</span>
            <span className="text-white/15">·</span>
            <span className="text-teal-400 font-bold">{data.totales.trabajando} en turno</span>
          </div>
        )}
        <div className="flex-1" />
        {data.totales.relevoProgramado > 0 && !colapsado && (
          <div className="flex items-center gap-1 text-[10px] text-indigo-300/60">
            <CheckCircle2 className="w-3 h-3 text-indigo-400" />
            {data.totales.relevoProgramado} relevos ya asignados
          </div>
        )}
        <ChevronRight className={`w-3.5 h-3.5 text-indigo-400/30 group-hover:text-indigo-400/60 ml-2 shrink-0 transition-transform ${colapsado ? "" : "rotate-90"}`} />
      </button>

      {!colapsado && (<>

      {/* ── Supervisores y Jefes de Servicio en esta fecha ────────────── */}
      {(() => {
        const svJfTrab = data.trabajando.filter(a => a.tipo_personal === "supervisor" || a.tipo_personal === "jefe_servicio");
        const svJfDesc = data.descansando.filter(a => a.tipo_personal === "supervisor" || a.tipo_personal === "jefe_servicio");
        if (svJfTrab.length + svJfDesc.length === 0) return null;
        return (
          <div className="border-b border-orange-500/15 bg-orange-500/3 px-3 py-2">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-3 h-3 text-orange-400/70" />
              <span className="text-[10px] font-bold text-orange-300/70 uppercase tracking-widest">Supervisores / Jefes de Servicio</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {svJfTrab.map(ag => (
                <div key={ag.id} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-orange-500/10 border border-orange-500/20 text-orange-200/80" title={`En turno · ${ag.turno_nombre ?? ""}`}>
                  <div className={`w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center shrink-0 ${avatarColor(ag.nombre_completo)}`}>
                    {iniciales(ag.nombre_completo)}
                  </div>
                  <span className="truncate max-w-[80px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold shrink-0">TURNO</span>
                </div>
              ))}
              {svJfDesc.map(ag => (
                <div key={ag.id} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-orange-500/5 border border-orange-500/10 text-orange-300/50" title={`Descanso · ${ag.turno_nombre ?? ""}`}>
                  <div className={`w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center shrink-0 opacity-60 ${avatarColor(ag.nombre_completo)}`}>
                    {iniciales(ag.nombre_completo)}
                  </div>
                  <span className="truncate max-w-[80px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-300/70 font-bold shrink-0">DESC</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex border-b border-white/6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabActivo(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-colors border-b-2 whitespace-nowrap ${
              tabActivo === t.key
                ? t.activeBg
                : "border-transparent text-white/30 hover:text-white/60"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                tabActivo === t.key ? "bg-white/10" : "bg-white/6 text-white/30"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Descripción del tab */}
      <div className="px-4 py-1.5 bg-white/2 border-b border-white/4">
        <p className="text-[10px] text-white/25 italic">
          {tabs.find(t => t.key === tabActivo)?.desc}
        </p>
      </div>

      {/* Lista de agentes */}
      <div className="flex gap-2 flex-wrap p-3 max-h-40 overflow-y-auto">
        {agentesActivos.length === 0 ? (
          <p className="text-[11px] text-white/20 py-2 px-2">Sin agentes en esta categoría</p>
        ) : agentesActivos.map((ag) => {
          const canDrag = (tabActivo === "disponible" || tabActivo === "descansando") && !!onSelectAgente;
          if (canDrag) {
            const agenteObj = poolFuturoToAgente(ag as AgentePoolFuturo);
            const isSelected = agenteSeleccionadoId === ag.id;
            return (
              <div
                key={ag.id}
                onClick={() => onSelectAgente!(agenteObj)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "ring-2 ring-primary bg-primary/15 border-primary/40 text-white scale-105"
                    : tabActivo === "descansando"
                    ? "bg-blue-500/8 border-blue-500/20 text-blue-300/80 hover:bg-blue-500/15 hover:border-blue-400/40"
                    : "bg-green-500/8 border-green-500/20 text-green-300/80 hover:bg-green-500/15 hover:border-green-400/40"
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(ag.nombre_completo)}`}>
                  {iniciales(ag.nombre_completo)}
                </div>
                <span className="truncate max-w-[100px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
                {(ag.tipo_personal === "supervisor" || ag.tipo_personal === "jefe_servicio") && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-orange-500/20 text-orange-300 shrink-0">
                    {ag.tipo_personal === "supervisor" ? "Sup." : "Jefe"}
                  </span>
                )}
              </div>
            );
          }
          return (
            <div
              key={ag.id}
              title={
                tabActivo === "ausenteProgramado"
                  ? `${ag.fuente_ausencia === "rrhh" ? LABELS_AUSENCIA_RRHH[ag.tipo_ausencia_rrhh ?? ""] ?? ag.tipo_ausencia_rrhh : LABELS_AUSENCIA_FUTURO[ag.plan_tipo_ausencia ?? ""] ?? ag.plan_tipo_ausencia ?? "Ausencia"} · ${ag.fuente_ausencia === "rrhh" ? "Aprobado por RRHH" : "Planificado en Operaciones"}`
                  : tabActivo === "trabajando"
                  ? `Puesto: ${ag.puesto_nombre ?? "—"} · ${ag.cliente_nombre ?? ""}`
                  : ""
              }
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium border transition-all cursor-default ${
                tabActivo === "ausenteProgramado"
                  ? "bg-red-500/8 border-red-500/20 text-red-300/80"
                  : "bg-teal-500/8 border-teal-500/20 text-teal-300/80"
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(ag.nombre_completo)}`}>
                {iniciales(ag.nombre_completo)}
              </div>
              <span className="truncate max-w-[100px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
              {(ag.tipo_personal === "supervisor" || ag.tipo_personal === "jefe_servicio") && (
                <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-orange-500/20 text-orange-300 shrink-0">
                  {ag.tipo_personal === "supervisor" ? "Sup." : "Jefe"}
                </span>
              )}
              {tabActivo === "ausenteProgramado" && (
                <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${ag.fuente_ausencia === "rrhh" ? "bg-orange-500/20 text-orange-300" : "bg-indigo-500/20 text-indigo-300"}`}>
                  {ag.fuente_ausencia === "rrhh" ? "RRHH" : "OP"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Servicios Programados (inicios de proyecto + SSA) ── */}
      {(data.iniciosProyecto ?? []).length > 0 && (
        <div className="border-t border-amber-500/20 bg-amber-500/3">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/15">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-300/80 uppercase tracking-widest">Servicios programados</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 border border-amber-500/25 text-amber-300">
              {data.iniciosProyecto.length} {data.iniciosProyecto.length === 1 ? "servicio" : "servicios"}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {data.iniciosProyecto.map((ip) => {
              const esSSA    = ip.tipo === "ssa";
              const itemKey  = esSSA ? `ssa_${ip.ssa_id}` : `cli_${ip.cliente_id}`;
              const cardBg   = esSSA
                ? "bg-blue-500/5 border-blue-500/20"
                : "bg-amber-500/5 border-amber-500/20";
              const iconBg   = esSSA
                ? "bg-blue-500/15 border-blue-500/25"
                : "bg-amber-500/15 border-amber-500/25";
              const nameCl   = esSSA ? "text-blue-200" : "text-amber-200";
              const sectorCl = esSSA ? "text-blue-300/50" : "text-amber-300/50";
              const badgeCl  = esSSA
                ? "bg-blue-400/15 border-blue-400/30 text-blue-300"
                : "bg-amber-400/15 border-amber-400/30 text-amber-300";
              const badgeLabel = esSSA
                ? (TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? "SSA")
                : "Inicio";
              const planAgentes = ip.plan_agentes ?? [];
              const planYaAsignado = esSSA && planAgentes.length > 0;
              const totalGuardias = ip.total_puestos ?? 1;
              const planCompleto = planAgentes.length >= totalGuardias;
              return (
              <div
                key={itemKey}
                className={`border rounded-xl p-3 flex flex-col gap-2 ${cardBg}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
                      {esSSA
                        ? <Shield className="w-3.5 h-3.5 text-blue-400" />
                        : <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${nameCl}`}>
                        {ip.cliente_nombre_comercial || ip.cliente_nombre}
                      </p>
                      {esSSA && ip.hora_inicio ? (
                        <p className={`text-[10px] capitalize ${sectorCl}`}>{ip.hora_inicio}–{ip.hora_fin ?? ""}</p>
                      ) : ip.sector ? (
                        <p className={`text-[10px] capitalize ${sectorCl}`}>{ip.sector}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${badgeCl}`}>
                    {badgeLabel}
                  </span>
                </div>

                {/* Puestos (solo para inicio_cliente) */}
                {!esSSA && (
                  <div className="flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1 text-white/50">
                      <Layers className="w-3 h-3" />
                      <span>{ip.total_puestos} {ip.total_puestos === 1 ? "puesto" : "puestos"}</span>
                    </div>
                    {ip.puestos_con_titular > 0 && (
                      <div className="flex items-center gap-1 text-green-400/70">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{ip.puestos_con_titular} con titular</span>
                      </div>
                    )}
                    {ip.puestos_sin_titular > 0 && (
                      <div className="flex items-center gap-1 text-amber-400/70">
                        <AlertCircle className="w-3 h-3" />
                        <span>{ip.puestos_sin_titular} sin asignar</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Estado del plan SSA — multi-agente */}
                {esSSA && (
                  <div className="flex flex-col gap-1.5">
                    {/* Progreso / badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {planCompleto ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 font-bold uppercase">
                            {planAgentes.length}/{totalGuardias} Planificado{planAgentes.length !== 1 ? "s" : ""}
                          </span>
                        ) : planYaAsignado ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/12 border border-amber-500/25 text-amber-400 font-bold uppercase">
                            {planAgentes.length}/{totalGuardias} Parcial
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-orange-300/60">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>Sin agentes planificados</span>
                          </div>
                        )}
                      </div>
                      {onPlanSSA && (
                        <button
                          onClick={() => onPlanSSA(ip)}
                          className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                            planYaAsignado
                              ? "bg-blue-500/10 border-blue-500/25 text-blue-300 hover:bg-blue-500/20"
                              : "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20"
                          }`}
                        >
                          <UserCheck className="w-3 h-3" />
                          {planYaAsignado ? "Editar" : "Planificar"}
                        </button>
                      )}
                    </div>
                    {/* Lista de agentes planificados */}
                    {planAgentes.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {planAgentes.map((pa) => (
                          <div key={pa.plan_id} className="flex items-center gap-1 text-[10px]">
                            <CheckCircle2 className="w-2.5 h-2.5 text-green-400 shrink-0" />
                            <span className="text-green-300/80 font-medium truncate">
                              {pa.relevo_nombre?.split(" ").slice(0, 2).join(" ") ?? "Agente planificado"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de puestos si hay pocos (inicio_cliente) */}
                {!esSSA && ip.puestos && ip.puestos.length > 0 && ip.puestos.length <= 4 && (
                  <div className="flex flex-col gap-1">
                    {ip.puestos.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 text-[10px] text-white/40">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.titular_nombre ? "bg-green-400/60" : "bg-amber-400/50"}`} />
                        <span className="truncate">{p.nombre}</span>
                        {p.turno_nombre && <span className="text-white/25 shrink-0">· {p.turno_nombre}</span>}
                        {!p.titular_nombre && <span className="text-amber-400/50 shrink-0">sin titular</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}

// ─── Columna de Cliente — Vista Futura ────────────────────────────────────────

function ClienteColumnaFutura({
  cliente,
  planPorPuesto,
  onAbrirPlan,
  poolFuturo,
  colGlobal,
}: {
  cliente: ClienteBoard;
  fecha?: string;
  planPorPuesto: Record<number, PlanFuturo>;
  onAbrirPlan: (puesto: Puesto) => void;
  poolFuturo?: PoolFuturoData | null;
  colGlobal?: { v: number; val: boolean };
}) {
  const total     = cliente.puestos.length;
  const conPlan   = cliente.puestos.filter((p) => planPorPuesto[p.id]).length;
  const conRelevo = cliente.puestos.filter((p) => planPorPuesto[p.id]?.relevo_id).length;
  const sinCambios = total - conPlan;

  // Collapse — misma lógica que ClienteColumna pero con prefijo _fut_
  const ssKey = `piz_col_cli_fut_${cliente.clienteId ?? cliente.clienteNombre}`;
  const [colapsado, setColapsado] = useState(() => {
    try { return sessionStorage.getItem(ssKey) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (colGlobal && colGlobal.v > 0) {
      setColapsado(colGlobal.val);
      try { sessionStorage.setItem(ssKey, colGlobal.val ? "1" : "0"); } catch {}
    }
  }, [colGlobal?.v]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCol = () => setColapsado(prev => {
    const next = !prev;
    try { sessionStorage.setItem(ssKey, next ? "1" : "0"); } catch {}
    return next;
  });

  // Lookup: empleado_id → estado en pool-futuro
  const estadoPorEmpleado = useMemo<Map<number, "trabajando" | "descansando" | "ausenteProgramado">>(() => {
    const m = new Map<number, "trabajando" | "descansando" | "ausenteProgramado">();
    if (!poolFuturo) return m;
    for (const a of poolFuturo.trabajando)        m.set(a.id, "trabajando");
    for (const a of poolFuturo.descansando)       m.set(a.id, "descansando");
    for (const a of poolFuturo.ausenteProgramado) m.set(a.id, "ausenteProgramado");
    return m;
  }, [poolFuturo]);

  const colorBarra = conRelevo === total ? "bg-indigo-500" : conPlan > 0 ? "bg-amber-500/60" : "bg-white/10";

  // ── Estado colapsado: tira vertical igual que ClienteColumna ────────────────
  if (colapsado) {
    return (
      <div
        className="flex-shrink-0 w-10 bg-[#060f1a] border border-indigo-500/15 rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200 cursor-pointer group"
        onClick={toggleCol}
        title={`${cliente.clienteNombre} — ${conRelevo}/${total} con relevo · clic para expandir`}
      >
        {conPlan > 0 && (
          <div className="w-full h-1 bg-indigo-500/60 shrink-0" />
        )}
        <div className="flex-1 flex items-center justify-center py-3 min-h-0 overflow-hidden">
          <span
            className="text-[10px] font-bold text-white/40 group-hover:text-white/70 transition-colors leading-none"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
          >
            {cliente.clienteNombre.length > 20 ? cliente.clienteNombre.slice(0, 18) + "…" : cliente.clienteNombre}
          </span>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-0.5 py-2 border-t border-white/6">
          <span className="text-[9px] font-bold text-indigo-400">{conRelevo}</span>
          <div className="w-px h-2 bg-white/10" />
          <span className="text-[9px] text-white/20">{total}</span>
        </div>
      </div>
    );
  }

  // ── Estado expandido ─────────────────────────────────────────────────────────
  return (
    <div className="flex-shrink-0 w-64 bg-[#060f1a] border border-indigo-500/12 rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/8">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button
            onClick={toggleCol}
            className="min-w-0 text-left flex-1 group/col"
            title="Colapsar columna"
          >
            <h3 className="text-xs font-bold text-white truncate group-hover/col:text-white/70 transition-colors">
              {cliente.clienteNombre}
            </h3>
            <p className="text-[10px] text-indigo-300/50 mt-0.5">
              {conPlan > 0
                ? `${conRelevo}/${total} con relevo · ${sinCambios} sin cambios`
                : `${total} puestos — sin cambios planificados`}
            </p>
          </button>
          <button
            onClick={toggleCol}
            className="text-white/15 hover:text-indigo-300/50 transition-colors mt-0.5 shrink-0"
            title="Colapsar columna"
          >
            <ChevronRight className="w-3 h-3 rotate-90" />
          </button>
        </div>
        <div className="h-1 bg-white/8 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorBarra} rounded-full transition-all`}
            style={{ width: `${total > 0 ? Math.round((conRelevo / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cliente.puestos.map((p) => {
          const estadoTitular = p.titular_employee_id
            ? (estadoPorEmpleado.get(p.titular_employee_id) ?? null)
            : null;
          return (
            <TarjetaPuestoFuturo
              key={p.id}
              puesto={p}
              plan={planPorPuesto[p.id] ?? null}
              estadoTitular={estadoTitular === "ausenteProgramado" ? null : estadoTitular}
              onClick={() => onAbrirPlan(p)}
            />
          );
        })}
        {cliente.puestos.length === 0 && (
          <div className="text-center py-4">
            <p className="text-[11px] text-white/20">Sin puestos</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tarjeta de Puesto (droppable) ────────────────────────────────────────────

function DroppablePuesto({
  puesto,
  isAgenteSeleccionado,
  onClick,
  onLiberar,
  onAbrirSegmentos,
  onConfigTurno,
  cambiosProximos,
  puestoContextoId,
  planFuturo,
}: {
  puesto: Puesto;
  isAgenteSeleccionado: boolean;
  onClick: () => void;
  onLiberar: () => void;
  onAbrirSegmentos: () => void;
  onConfigTurno?: () => void;
  cambiosProximos?: PlanFuturo[];
  puestoContextoId?: number | null;
  planFuturo?: PlanFuturo | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `puesto-${puesto.id}` });
  const [fichaArmaId, setFichaArmaId] = useState<number | null>(null);
  const cubierto       = puesto.estado === "cubierto" && puesto.agente_id;
  const esRelevo       = cubierto && puesto.titular_employee_id && puesto.agente_id !== puesto.titular_employee_id;
  const titularAusente = !puesto.agente_id && !!puesto.titular_employee_id;
  const descansoCiclo  = !cubierto && (puesto.descanso_por_ciclo === true);
  const vacacionesTitular = !cubierto && puesto.titular_vac_tipo === "vacaciones";
  const vacacionesTrabajadas = puesto.titular_vac_tipo === "vacaciones_trabajadas";
  const expanded = puestoContextoId === puesto.id;
  const dimmed   = puestoContextoId !== null && puestoContextoId !== undefined && !expanded;

  // ─── Renderizado especial para puestos con múltiples titulares (24x24) ───
  if (puesto.es_par_24x24 && puesto.par_trabajando && puesto.par_descansando) {
    const activo      = puesto.par_trabajando;   // TitularCiclo — trabaja hoy
    const descansando = puesto.par_descansando;  // TitularCiclo — descansa hoy
    // Cobertura:
    // cubiertoManual  = alguien fue asignado explícitamente vía agente_id (relevo/pool)
    // cubiertoTitular = el titular configurado para hoy cubre el puesto (sin override)
    const cubiertoManual  = puesto.estado === "cubierto" && !!puesto.agente_id;
    const cubiertoTitular = !cubiertoManual && activo.trabaja_hoy && !!activo.employee_id;
    const activoCubierto  = cubiertoManual || cubiertoTitular;
    const activoRelevo    = cubiertoManual && !!activo.employee_id &&
                            puesto.agente_id !== activo.employee_id;
    const activoSinCob    = !activoCubierto;
    const arma     = puesto.arma_codigo;
    const armaId   = puesto.arma_id;
    const armaTipo = puesto.arma_tipo;

    const statusStrip = activoCubierto
      ? (activoRelevo ? "bg-amber-400" : "bg-violet-400")
      : "bg-red-500 animate-pulse";

    const borde24 = isOver
      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]"
      : activoRelevo
        ? "bg-[#0f1208] border-amber-500/30 hover:border-amber-400/40"
        : activoCubierto
          ? "bg-[#071520] border-violet-500/25 hover:border-violet-400/35"
          : "bg-[#0c0a16] border-red-500/25 hover:border-red-400/35";

    return (
      <div
        ref={setNodeRef}
        onClick={onClick}
        className={`relative rounded-xl border p-3 transition-all cursor-pointer group ${borde24} ${isAgenteSeleccionado && !activoCubierto ? "ring-1 ring-primary/50 border-primary/30" : ""} ${dimmed ? "opacity-25 hover:opacity-70" : ""}`}
      >
        {/* Badge cambios futuros */}
        {cambiosProximos && cambiosProximos.length > 0 && (
          <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-0.5 bg-indigo-700/90 border border-indigo-400/40 rounded-full px-1.5 py-0.5" title={`${cambiosProximos.length} cambio(s) futuro(s)`}>
            <Calendar className="w-2.5 h-2.5 text-indigo-200" />
            <span className="text-[8px] text-indigo-100 font-bold leading-none">{cambiosProximos.length}</span>
          </div>
        )}

        {/* ── COMPACT: siempre visible ── */}
        <div className="flex gap-2">
          <div className={`w-1 self-stretch rounded-full shrink-0 ${statusStrip}`} />
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white/80 truncate leading-tight">{puesto.nombre}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-violet-300/50 flex items-center gap-0.5">
                    <Repeat className="w-2 h-2 opacity-50" />{puesto.turno_nombre ?? "24x24"}
                  </span>
                  {activoRelevo && <span className="text-[8px] px-1 py-0.5 bg-amber-500/15 border border-amber-500/20 rounded text-amber-300/70 font-bold">REL</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {onConfigTurno && (
                  <button onClick={e => { e.stopPropagation(); onConfigTurno(); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="Configurar turno">
                    <Settings2 className="w-2.5 h-2.5 text-white/30 hover:text-indigo-400" />
                  </button>
                )}
                {activoCubierto
                  ? <CheckCircle2 className={`w-3.5 h-3.5 ${activoRelevo ? "text-amber-400" : "text-violet-400"}`} />
                  : <Circle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                }
              </div>
            </div>

            {/* Agente activo — PROMINENTE */}
            <div className="mt-1.5">
              {cubiertoManual && puesto.agente_nombre ? (
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(puesto.agente_nombre)}`}>
                    {iniciales(puesto.agente_nombre)}
                  </div>
                  <p className="text-[13px] font-semibold text-white/90 truncate">{puesto.agente_nombre}</p>
                </div>
              ) : cubiertoTitular && activo.nombre ? (
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(activo.nombre)}`}>
                    {iniciales(activo.nombre)}
                  </div>
                  <p className="text-[13px] font-semibold text-white/90 truncate">{activo.nombre}</p>
                </div>
              ) : activoSinCob ? (
                <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/20"}`}>
                  <User className="w-4 h-4 shrink-0" />
                  <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Sin cobertura"}</p>
                </div>
              ) : null}
            </div>

            {/* ── EXPANDED: detalles completos ── */}
            {expanded && (
              <div className="mt-2.5 pt-2 border-t border-white/8 space-y-2">
                {/* Descansa hoy */}
                <div className="flex items-center gap-2">
                  <div className="w-1 h-full min-h-[18px] rounded-full bg-indigo-500/20 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-indigo-400/40 font-semibold uppercase tracking-wider mb-0.5">Descansa hoy</p>
                    {descansando.nombre ? (
                      <div className="flex items-center gap-1.5">
                        <Moon className="w-3 h-3 text-indigo-400/30 shrink-0" />
                        <p className="text-[11px] text-white/30 truncate">{descansando.nombre}</p>
                      </div>
                    ) : <p className="text-[11px] text-white/15">Sin titular</p>}
                  </div>
                </div>

                {/* Arma */}
                {arma && armaId && (
                  <button onClick={e => { e.stopPropagation(); setFichaArmaId(armaId); }} title={`Ver ficha: ${arma} — ${armaTipo ?? ""}`} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/8 border border-blue-500/15 rounded-md w-fit hover:bg-blue-500/15 hover:border-blue-500/30 transition-colors">
                    <Shield className="w-2.5 h-2.5 text-blue-400/60 shrink-0" />
                    <span className="text-[9px] font-mono font-semibold text-blue-300/70">{arma}</span>
                    {armaTipo && <span className="text-[9px] text-blue-300/40 capitalize ml-0.5">{armaTipo}</span>}
                  </button>
                )}

                {/* Liberar — solo si hay agente asignado manualmente (no titular automático) */}
                {cubiertoManual && (
                  <button onClick={e => { e.stopPropagation(); onLiberar(); }} className="flex items-center gap-1 text-[9px] text-red-400/60 hover:text-red-400 transition-colors" title="Remover del puesto">
                    <XCircle className="w-3 h-3" /><span>Remover agente</span>
                  </button>
                )}

                {/* Tramos */}
                <button onClick={e => { e.stopPropagation(); onAbrirSegmentos(); }} className="flex items-center gap-1 text-[9px] text-indigo-400/50 hover:text-indigo-400 transition-colors" title="Tramos de cobertura">
                  <Layers className="w-3 h-3" /><span>Tramos</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Plan futuro (modo planificación) */}
        {planFuturo && (
          <div className={`mt-2 pt-2 border-t border-white/6 flex items-center gap-1.5 ${planFuturo.relevo_id ? "text-indigo-300/70" : "text-amber-300/70"}`}>
            {planFuturo.relevo_id ? (
              <>
                <div className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center shrink-0 ${avatarColor(planFuturo.relevo_nombre ?? "")}`}>
                  {iniciales(planFuturo.relevo_nombre ?? "")}
                </div>
                <p className="text-[10px] font-medium truncate flex-1">{planFuturo.relevo_nombre}</p>
                <span className="text-[8px] shrink-0 opacity-60 font-bold">RELEVO</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 shrink-0" />
                <p className="text-[10px] truncate">{LABELS_AUSENCIA_FUTURO[planFuturo.tipo_ausencia ?? ""] ?? "Ausencia"} · sin relevo</p>
              </>
            )}
          </div>
        )}

        {isOver && <div className="absolute inset-0 rounded-xl border-2 border-primary border-dashed pointer-events-none" />}
        {fichaArmaId && <ModalFichaArma armaId={fichaArmaId} onClose={() => setFichaArmaId(null)} />}
      </div>
    );
  }
  // ─── Fin renderizado 24x24 agrupado ──────────────────────────────────────

  const borderClass = isOver
    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]"
    : esRelevo
      ? "bg-[#0f1208] border-amber-500/30 hover:border-amber-400/40"
      : cubierto
        ? "bg-[#071a0f] border-green-500/20 hover:border-green-400/30"
        : descansoCiclo
          ? "bg-[#08101a] border-indigo-500/25 hover:border-indigo-400/35"
          : "bg-[#0c0a16] border-red-500/25 hover:border-red-400/35";

  const statusStrip = cubierto
    ? (esRelevo ? "bg-amber-400" : "bg-green-400")
    : descansoCiclo
      ? "bg-indigo-400"
      : "bg-red-500 animate-pulse";

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`relative rounded-xl border p-3 transition-all cursor-pointer group ${borderClass} ${isAgenteSeleccionado && !cubierto ? "ring-1 ring-primary/50 border-primary/30" : ""} ${dimmed ? "opacity-25 hover:opacity-70" : ""}`}
    >
      {/* Badge cambios futuros */}
      {cambiosProximos && cambiosProximos.length > 0 && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-0.5 bg-indigo-700/90 border border-indigo-400/40 rounded-full px-1.5 py-0.5" title={`${cambiosProximos.length} cambio(s) futuro(s) programado(s)`}>
          <Calendar className="w-2.5 h-2.5 text-indigo-200" />
          <span className="text-[8px] text-indigo-100 font-bold leading-none">{cambiosProximos.length}</span>
        </div>
      )}
      {vacacionesTitular && (
        <div className="absolute -top-1.5 -left-1.5 z-10 flex items-center gap-0.5 bg-emerald-900/90 border border-emerald-500/40 rounded-full px-1.5 py-0.5" title={`Titular en vacaciones${puesto.titular_vac_inicio ? ` desde ${puesto.titular_vac_inicio}` : ""}${puesto.titular_vac_fin ? ` hasta ${puesto.titular_vac_fin}` : ""}`}>
          <span className="text-[8px] text-emerald-300 font-bold leading-none">VAC</span>
        </div>
      )}
      {vacacionesTrabajadas && (
        <div className="absolute -top-1.5 -left-1.5 z-10 flex items-center gap-0.5 bg-orange-900/90 border border-orange-500/40 rounded-full px-1.5 py-0.5" title="Titular trabajando días de vacaciones">
          <span className="text-[8px] text-orange-300 font-bold leading-none">VAC✓</span>
        </div>
      )}

      {/* ── COMPACT: siempre visible ── */}
      <div className="flex gap-2">
        <div className={`w-1 self-stretch rounded-full shrink-0 ${statusStrip}`} />
        <div className="flex-1 min-w-0">
          {/* Fila superior: nombre + turno + estado */}
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white/80 truncate leading-tight">{puesto.nombre}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {puesto.tipo_turno_id ? (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold cursor-pointer ${puesto.tipo_ciclo === "alternado" ? "text-indigo-300/70 bg-indigo-500/8 border-indigo-500/20" : "text-emerald-300/60 bg-emerald-500/6 border-emerald-500/15"}`} onClick={e => { e.stopPropagation(); onConfigTurno?.(); }} title="Clic para cambiar turno">
                    {puesto.tipo_ciclo === "alternado" ? <Repeat className="w-2 h-2 inline mr-0.5 opacity-70" /> : null}{puesto.turno_nombre}
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-amber-300/60 bg-amber-500/6 border-amber-500/15 cursor-pointer" onClick={e => { e.stopPropagation(); onConfigTurno?.(); }} title="Sin turno — clic para configurar">
                    {puesto.turno ?? "Sin turno"}
                  </span>
                )}
                {esRelevo && (() => {
                  const ep = puesto.estado_operativo_puesto;
                  const estadoLabel: Record<string, { label: string; cls: string }> = {
                    relevo_completo:  { label: "RELEVO",      cls: "text-amber-300/80 bg-amber-500/10 border-amber-500/25" },
                    relevo_parcial:   { label: "REL. PARCIAL",cls: "text-orange-300/80 bg-orange-500/10 border-orange-500/25" },
                    vacaciones:       { label: "VACACIONES",  cls: "text-emerald-300/80 bg-emerald-500/10 border-emerald-500/25" },
                    incapacidad:      { label: "INCAPACIDAD", cls: "text-teal-300/80 bg-teal-500/10 border-teal-500/25" },
                    suspension:       { label: "SUSPENSIÓN",  cls: "text-red-300/80 bg-red-500/10 border-red-500/25" },
                    abandono_parcial: { label: "ABANDONO",    cls: "text-rose-300/80 bg-rose-500/10 border-rose-500/25" },
                    horas_extra:      { label: "HRS EXTRA",   cls: "text-purple-300/80 bg-purple-500/10 border-purple-500/25" },
                    servicio_especial:{ label: "SSA",         cls: "text-violet-300/80 bg-violet-500/10 border-violet-500/25" },
                  };
                  const info = ep ? estadoLabel[ep] : null;
                  return <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${info ? info.cls : "text-amber-300/80 bg-amber-500/10 border-amber-500/25"}`}>{info ? info.label : "RELEVO"}</span>;
                })()}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {onConfigTurno && (
                <button onClick={e => { e.stopPropagation(); onConfigTurno(); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="Configurar turno">
                  <Settings2 className="w-2.5 h-2.5 text-white/30 hover:text-indigo-400" />
                </button>
              )}
              {cubierto
                ? <CheckCircle2 className={`w-3.5 h-3.5 ${esRelevo ? "text-amber-400" : "text-green-400"}`} />
                : descansoCiclo
                  ? <Moon className="w-3.5 h-3.5 text-indigo-400/70" title="Descanso de ciclo" />
                  : <Circle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              }
            </div>
          </div>

          {/* Agente activo — PROMINENTE */}
          <div className="mt-1.5">
            {cubierto && puesto.agente_nombre ? (
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(puesto.agente_nombre)}`}>
                  {iniciales(puesto.agente_nombre)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-[13px] font-semibold text-white/90 truncate">{puesto.agente_nombre}</p>
                    {!esRelevo && <span className="text-[8px] text-green-400/70 font-bold shrink-0">T</span>}
                  </div>
                </div>
              </div>
            ) : descansoCiclo ? (
              <div className="flex items-center gap-2 text-indigo-300/50">
                <Moon className="w-4 h-4 shrink-0" />
                <p className="text-sm">Descanso de turno</p>
              </div>
            ) : vacacionesTitular ? (
              <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-emerald-400/60"}`}>
                <User className="w-4 h-4 shrink-0" />
                <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "En vacaciones"}</p>
              </div>
            ) : titularAusente ? (
              <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/25"}`}>
                <User className="w-4 h-4 shrink-0" />
                <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Sin cobertura hoy"}</p>
              </div>
            ) : (
              <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/20"}`}>
                <User className="w-4 h-4 shrink-0" />
                <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Puesto descubierto"}</p>
              </div>
            )}
          </div>

          {/* ── EXPANDED: detalles completos ── */}
          {expanded && (
            <div className="mt-2.5 pt-2 border-t border-white/8 space-y-2">
              {/* Relevo: titular ausente */}
              {esRelevo && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-white/4 rounded-lg border border-white/5">
                  <User className="w-2.5 h-2.5 text-white/25 shrink-0" />
                  <p className="text-[9px] text-white/35 truncate">Titular ausente: <span className="text-white/50">{puesto.titular_nombre}</span></p>
                </div>
              )}
              {/* Descanso ciclo: titular */}
              {descansoCiclo && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-indigo-500/5 border border-indigo-500/15 rounded-lg">
                  <User className="w-2.5 h-2.5 text-indigo-400/40 shrink-0" />
                  <p className="text-[9px] text-indigo-300/50 truncate">Descansando: <span className="text-indigo-300/70">{puesto.titular_nombre}</span> <span className="text-indigo-400/50 font-bold">HE ✓</span></p>
                </div>
              )}
              {/* Vacaciones: titular */}
              {vacacionesTitular && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                  <User className="w-2.5 h-2.5 text-emerald-400/40 shrink-0" />
                  <p className="text-[9px] text-emerald-300/50 truncate">Vacaciones: <span className="text-emerald-300/70">{puesto.titular_nombre}</span></p>
                </div>
              )}
              {/* Titular sin cobertura (no descanso, no vac) */}
              {titularAusente && !descansoCiclo && !vacacionesTitular && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <User className="w-2.5 h-2.5 text-red-400/40 shrink-0" />
                  <p className="text-[9px] text-red-300/50 truncate">Titular: <span className="text-red-300/70">{puesto.titular_nombre}</span></p>
                </div>
              )}
              {/* Teléfono */}
              {cubierto && puesto.agente_telefono && (
                <p className="text-[9px] text-white/25 truncate">{puesto.agente_telefono}</p>
              )}
              {/* Arma */}
              {puesto.arma_codigo && puesto.arma_id && (
                <button onClick={e => { e.stopPropagation(); setFichaArmaId(puesto.arma_id!); }} title={`Ver ficha: ${puesto.arma_codigo} — ${puesto.arma_tipo ?? ""}`} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/8 border border-blue-500/15 rounded-md w-fit hover:bg-blue-500/15 hover:border-blue-500/30 transition-colors">
                  <Shield className="w-2.5 h-2.5 text-blue-400/60 shrink-0" />
                  <span className="text-[9px] font-mono font-semibold text-blue-300/70">{puesto.arma_codigo}</span>
                  {puesto.arma_tipo && <span className="text-[9px] text-blue-300/40 capitalize ml-0.5">{puesto.arma_tipo}</span>}
                </button>
              )}
              {/* Liberar */}
              {cubierto && (
                <button onClick={e => { e.stopPropagation(); onLiberar(); }} className="flex items-center gap-1 text-[9px] text-red-400/60 hover:text-red-400 transition-colors" title="Remover del puesto">
                  <XCircle className="w-3 h-3" /><span>Remover agente</span>
                </button>
              )}
              {/* Tramos */}
              <button onClick={e => { e.stopPropagation(); onAbrirSegmentos(); }} className="flex items-center gap-1 text-[9px] text-indigo-400/50 hover:text-indigo-400 transition-colors" title="Tramos de cobertura">
                <Layers className="w-3 h-3" /><span>Tramos</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Plan futuro (modo planificación) */}
      {planFuturo && (
        <div className={`mt-2 pt-2 border-t border-white/6 flex items-center gap-1.5 ${planFuturo.relevo_id ? "text-indigo-300/70" : "text-amber-300/70"}`}>
          {planFuturo.relevo_id ? (
            <>
              <div className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center shrink-0 ${avatarColor(planFuturo.relevo_nombre ?? "")}`}>
                {iniciales(planFuturo.relevo_nombre ?? "")}
              </div>
              <p className="text-[10px] font-medium truncate flex-1">{planFuturo.relevo_nombre}</p>
              <span className="text-[8px] shrink-0 opacity-60 font-bold">RELEVO</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 shrink-0" />
              <p className="text-[10px] truncate">{LABELS_AUSENCIA_FUTURO[planFuturo.tipo_ausencia ?? ""] ?? "Ausencia"} · sin relevo</p>
            </>
          )}
        </div>
      )}

      {isOver && <div className="absolute inset-0 rounded-xl border-2 border-primary border-dashed pointer-events-none" />}
      {fichaArmaId && <ModalFichaArma armaId={fichaArmaId} onClose={() => setFichaArmaId(null)} />}
    </div>
  );
}

// ─── Columna de Cliente ───────────────────────────────────────────────────────

function ClienteColumna({
  cliente,
  agenteSeleccionadoId,
  onPuestoClick,
  onLiberar,
  onNuevoPuesto,
  onEliminarPuesto,
  onAbrirSegmentos,
  onConfigTurno,
  cambiosFuturosProximos,
  planFuturoPorPuesto,
  resaltado,
  colGlobal,
  puestoContextoId,
}: {
  cliente: ClienteBoard;
  agenteSeleccionadoId: number | null;
  onPuestoClick: (puesto: Puesto) => void;
  onLiberar: (puesto: Puesto) => void;
  onNuevoPuesto: (cliente: ClienteBoard) => void;
  onEliminarPuesto: (puesto: Puesto) => void;
  onAbrirSegmentos: (puesto: Puesto) => void;
  onConfigTurno?: (puesto: Puesto) => void;
  cambiosFuturosProximos?: Record<number, PlanFuturo[]>;
  planFuturoPorPuesto?: Record<number, PlanFuturo>;
  resaltado?: boolean;
  colGlobal?: { v: number; val: boolean };
  puestoContextoId?: number | null;
}) {
  const ssKey = `piz_col_cli_${cliente.clienteId ?? cliente.clienteNombre}`;
  const [colapsado, setColapsado] = useState(() => {
    try { return sessionStorage.getItem(ssKey) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (colGlobal && colGlobal.v > 0) {
      setColapsado(colGlobal.val);
      try { sessionStorage.setItem(ssKey, colGlobal.val ? "1" : "0"); } catch {}
    }
  }, [colGlobal?.v]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCol = () => setColapsado(prev => {
    const next = !prev;
    try { sessionStorage.setItem(ssKey, next ? "1" : "0"); } catch {}
    return next;
  });

  const cubiertos      = cliente.puestos.filter((p) => p.estado === "cubierto" && p.agente_id).length;
  const descansoCicloN = cliente.puestos.filter((p) => p.descanso_por_ciclo === true && !(p.estado === "cubierto" && p.agente_id)).length;
  const descubiertoN   = cliente.puestos.filter((p) => !(p.estado === "cubierto" && p.agente_id) && !p.descanso_por_ciclo).length;
  const total          = cliente.puestos.length;
  const pct         = total > 0 ? Math.round(((cubiertos + descansoCicloN) / total) * 100) : 0;
  const colorBarra  = descubiertoN > 0 ? "bg-red-500" : pct === 100 ? "bg-green-500" : "bg-indigo-500";

  const borderClass = resaltado
    ? "border-2 border-amber-400/70 ring-2 ring-amber-400/30 shadow-[0_0_24px_4px_rgba(251,191,36,0.18)]"
    : cliente.iniciaHoy
    ? "border border-emerald-500/40 ring-1 ring-emerald-500/20"
    : "border border-white/8";

  if (colapsado) {
    return (
      <div
        className={`flex-shrink-0 w-10 bg-[#060f1a] rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200 cursor-pointer group ${borderClass}`}
        onClick={toggleCol}
        title={`${cliente.clienteNombre} — ${cubiertos}/${total} cubiertos. Clic para expandir`}
      >
        {/* Indicador de alertas arriba */}
        {descubiertoN > 0 && (
          <div className="w-full h-1 bg-red-500 shrink-0" />
        )}
        {descubiertoN === 0 && pct === 100 && (
          <div className="w-full h-1 bg-green-500 shrink-0" />
        )}
        {/* Nombre vertical */}
        <div className="flex-1 flex items-center justify-center py-3 min-h-0 overflow-hidden">
          <span
            className="text-[10px] font-bold text-white/50 group-hover:text-white/80 transition-colors leading-none"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
          >
            {cliente.clienteNombre.length > 20 ? cliente.clienteNombre.slice(0, 18) + "…" : cliente.clienteNombre}
          </span>
        </div>
        {/* Conteo abajo */}
        <div className="shrink-0 flex flex-col items-center gap-0.5 py-2 border-t border-white/6">
          <span className={`text-[9px] font-bold ${descubiertoN > 0 ? "text-red-400" : "text-green-400"}`}>{cubiertos}</span>
          <div className="w-px h-2 bg-white/10" />
          <span className="text-[9px] text-white/20">{total}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-shrink-0 w-64 bg-[#060f1a] rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200 ${borderClass}`}>
      {/* Badge de inicio de proyecto */}
      {resaltado && (
        <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/25 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">Próximo arranque</span>
        </div>
      )}
      {!resaltado && cliente.iniciaHoy && (
        <div className="px-3 py-1.5 bg-emerald-500/15 border-b border-emerald-500/25 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">Nuevo servicio · Inicia hoy</span>
        </div>
      )}
      {/* Header cliente */}
      <div className="px-3 py-3 border-b border-white/8">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button
            onClick={toggleCol}
            className="min-w-0 text-left flex-1 group/col"
            title="Colapsar columna"
          >
            <h3 className="text-xs font-bold text-white truncate group-hover/col:text-white/70 transition-colors">{cliente.clienteNombre}</h3>
            <p className="text-[10px] text-white/35 mt-0.5">
              {cubiertos}/{total} cubiertos
              {descansoCicloN > 0 && <span className="ml-1 text-indigo-400/50">· {descansoCicloN} en ciclo</span>}
              {descubiertoN > 0 && <span className="ml-1 text-red-400/60">· {descubiertoN} descubiertos</span>}
            </p>
          </button>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <button
              onClick={toggleCol}
              className="text-white/15 hover:text-white/50 transition-colors"
              title="Colapsar columna"
            >
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
            <button
              onClick={() => onNuevoPuesto(cliente)}
              className="text-white/20 hover:text-primary transition-colors"
              title="Agregar puesto"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Barra de cobertura */}
        <div className="h-1 bg-white/8 rounded-full overflow-hidden">
          <div className={`h-full ${colorBarra} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Puestos */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cliente.puestos.map((p) => (
          <div key={p.id} className="group/puesto relative">
            <DroppablePuesto
              puesto={p}
              isAgenteSeleccionado={agenteSeleccionadoId !== null}
              onClick={() => onPuestoClick(p)}
              onLiberar={() => onLiberar(p)}
              onAbrirSegmentos={() => onAbrirSegmentos(p)}
              onConfigTurno={onConfigTurno ? () => onConfigTurno(p) : undefined}
              cambiosProximos={cambiosFuturosProximos?.[p.id]}
              planFuturo={planFuturoPorPuesto?.[p.id] ?? null}
              puestoContextoId={puestoContextoId}
            />
            {/* Botón eliminar puesto */}
            <button
              onClick={(e) => { e.stopPropagation(); onEliminarPuesto(p); }}
              className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/puesto:opacity-100 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-0.5 transition-all z-10"
              title="Eliminar puesto"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {cliente.puestos.length === 0 && (
          <div className="text-center py-4">
            <p className="text-[11px] text-white/20">Sin puestos</p>
            <button
              onClick={() => onNuevoPuesto(cliente)}
              className="text-[10px] text-primary/60 hover:text-primary mt-1 transition-colors"
            >
              Agregar puesto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel lateral: Historial + Pool info ─────────────────────────────────────

function PanelHistorial({
  movimientos,
  isLoading,
  onClose,
}: {
  movimientos: Movimiento[];
  isLoading: boolean;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-[#06111e] border-l border-white/8 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-bold text-white">Historial de movimientos</h3>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
        {!isLoading && movimientos.length === 0 && (
          <div className="text-center py-10 text-white/25 text-xs">
            Sin movimientos registrados aún
          </div>
        )}
        {movimientos.map((m) => {
          const cfg = TIPO_MOV[m.tipo] ?? { label: m.tipo, icon: Activity, color: "text-white/40" };
          const Icon = cfg.icon;
          return (
            <div key={m.id} className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-white/25 ml-auto">{fmtHora(m.fecha_hora)}</span>
              </div>
              <p className="text-[11px] text-white/60 font-medium">
                {m.cliente_nombre} · {m.puesto_nombre}
              </p>
              {m.tipo === "sustitucion" && (
                <p className="text-[10px] text-white/35 mt-0.5">
                  {m.agente_saliente_nombre} → {m.agente_entrante_nombre}
                </p>
              )}
              {m.tipo === "asignacion" && (
                <p className="text-[10px] text-white/35 mt-0.5">
                  Asignado: {m.agente_entrante_nombre}
                </p>
              )}
              {m.tipo === "liberacion" && (
                <p className="text-[10px] text-white/35 mt-0.5">
                  Removido: {m.agente_saliente_nombre}
                </p>
              )}
              {m.motivo && (
                <p className="text-[10px] text-white/25 mt-0.5">Motivo: {m.motivo}</p>
              )}
              <p className="text-[9px] text-white/20 mt-1">por {m.usuario_cambio}</p>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Elige tipo de cobertura (pool → puesto vacío) ────────────────────
// Aparece cuando un agente NO-titular va a un puesto sin agente actual.
// Pregunta: ¿Solo cobertura temporal o convertir en titular?

type OldTitularAccion = "disponible" | "pool_relevo" | "sin_asignacion";

const MOTIVOS_TITULAR = [
  { value: "cobertura_definitiva",    label: "Cobertura definitiva" },
  { value: "reemplazo_permanente",    label: "Reemplazo permanente" },
  { value: "baja_titular_anterior",   label: "Baja del titular anterior" },
  { value: "reestructuracion",        label: "Reestructuración" },
  { value: "ascenso",                 label: "Ascenso / promoción" },
  { value: "otro",                    label: "Otro" },
];

function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}

// ─── Modal: ¿A quién sustituye? (puestos multi-titular) ───────────────────────
function ModalSustituyeTitular({
  puesto,
  agente,
  onConfirm,
  onCancel,
}: {
  puesto: Puesto;
  agente: Agente;
  onConfirm: (titularSustituidoId: number, motivo: string, horaInstalacion: string) => void;
  onCancel: () => void;
}) {
  const t1 = puesto.par_trabajando;
  const t2 = puesto.par_descansando;
  const defaultId = t1?.employee_id ?? t2?.employee_id ?? 0;

  const [seleccionado, setSeleccionado] = useState<number>(defaultId);
  const [motivo, setMotivo] = useState("falta_total");
  const ahoraHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };
  const [hora, setHora] = useState(ahoraHHMM);

  const MOTIVOS_RAPIDOS = [
    { value: "falta_total",      label: "Falta total",      color: "text-red-300" },
    { value: "incapacidad",      label: "Incapacidad IGSS", color: "text-orange-300" },
    { value: "permiso_con_goce", label: "Permiso c/goce",   color: "text-emerald-300" },
    { value: "permiso_sin_goce", label: "Permiso s/goce",   color: "text-yellow-300" },
    { value: "vacaciones",       label: "Vacaciones",        color: "text-sky-300" },
    { value: "relevo_completo",  label: "Relevo completo",  color: "text-violet-300" },
    { value: "abandono_parcial", label: "Abandono parcial", color: "text-red-400" },
  ];

  function TitularOpcion({ tc, label }: { tc: TitularCiclo; label: string }) {
    const activo = seleccionado === tc.employee_id;
    return (
      <button
        type="button"
        onClick={() => setSeleccionado(tc.employee_id)}
        className={`w-full text-left p-3 rounded-lg border transition-all ${
          activo
            ? "border-violet-500 bg-violet-500/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all ${
            activo ? "border-violet-400 bg-violet-400" : "border-white/30"
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{tc.nombre}</p>
            <p className={`text-[11px] font-medium ${label === "Trabaja hoy" ? "text-green-400" : "text-blue-400"}`}>
              {label}
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/8">
          <p className="text-[11px] text-white/40 uppercase tracking-widest mb-1">Relevo en {puesto.nombre}</p>
          <h2 className="text-lg font-bold text-white">¿A quién sustituye?</h2>
          <p className="text-xs text-white/50 mt-1">
            <span className="text-violet-300 font-medium">{agente.nombre_completo}</span> reemplazará al titular ausente
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Selección de titular */}
          <div className="space-y-2">
            {t1 && <TitularOpcion tc={t1} label="Trabaja hoy" />}
            {t2 && <TitularOpcion tc={t2} label="Descansa hoy" />}
          </div>

          {/* Motivo */}
          <div>
            <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">Motivo de ausencia</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MOTIVOS_RAPIDOS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMotivo(m.value)}
                  className={`text-left px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition-all ${
                    motivo === m.value
                      ? `${m.color} border-current bg-current/10`
                      : "text-white/40 border-white/10 hover:text-white/70 hover:border-white/20"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hora de instalación */}
          <div>
            <p className="text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wider">Hora de instalación</p>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-white/15 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!seleccionado}
            onClick={() => onConfirm(seleccionado, motivo, hora)}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold text-white transition-all"
          >
            Confirmar relevo
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalEligeCobertura({
  puesto,
  agente,
  onElegir,
  onCancel,
}: {
  puesto: Puesto;
  agente: Agente;
  onElegir: (soloCobertura: boolean, oldTitularAccion?: OldTitularAccion, fechaEfectiva?: string, motivoCambio?: string, horaInstalacion?: string) => void;
  onCancel: () => void;
}) {
  // Supervisores y jefes de servicio → siempre cobertura temporal, nunca titular
  const esContingencia = agente.tipo_personal === "supervisor" || agente.tipo_personal === "jefe_servicio";

  const hayTitularPrevio = !!puesto.titular_employee_id;
  const hoy = toISODate(new Date());
  const manana = toISODate(new Date(Date.now() + 86400000));

  const ahoraHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  // Para contingencia: saltar directamente al paso de hora (soloCobertura forzado)
  const [paso, setPaso] = useState<"elige" | "detalles" | "titularPrevio" | "horaInstalacion">(
    () => esContingencia ? "horaInstalacion" : "elige"
  );
  const [oldTitularAccion, setOldTitularAccion] = useState<OldTitularAccion>("disponible");
  const [opcionFecha, setOpcionFecha] = useState<"hoy" | "manana" | "personalizada">("hoy");
  const [fechaPersonalizada, setFechaPersonalizada] = useState(hoy);
  const [motivo, setMotivo] = useState("cobertura_definitiva");
  const [soloCoberturaPendiente, setSoloCoberturaPendiente] = useState(() => esContingencia);
  const [horaInstalacion, setHoraInstalacion] = useState(ahoraHHMM());

  const fechaEfectiva = opcionFecha === "hoy" ? hoy
    : opcionFecha === "manana" ? manana
    : fechaPersonalizada;

  function avanzarDesdeDetalles() {
    if (hayTitularPrevio) {
      setPaso("titularPrevio");
    } else {
      setPaso("horaInstalacion");
    }
  }

  function confirmarConHora() {
    onElegir(soloCoberturaPendiente, soloCoberturaPendiente ? undefined : oldTitularAccion,
             soloCoberturaPendiente ? undefined : fechaEfectiva,
             soloCoberturaPendiente ? undefined : motivo,
             horaInstalacion || undefined);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className={`px-5 py-4 border-b ${esContingencia ? "border-orange-500/15 bg-orange-500/3" : "border-white/8"}`}>
          <div className="flex items-center gap-2">
            {esContingencia
              ? <ShieldCheck className="w-4 h-4 text-orange-400" />
              : <Layers className="w-4 h-4 text-primary" />}
            <h3 className="text-sm font-bold text-white flex-1">
              {esContingencia ? "Cobertura de contingencia" : "¿Cómo registrar esta asignación?"}
            </h3>
            <button
              onClick={onCancel}
              className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5"
              aria-label="Cancelar y cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-white/35 mt-1.5">
            <span className="text-white/60 font-medium">{agente.nombre_completo}</span>
            {" · "}
            <span className={esContingencia ? "text-orange-300/60" : "capitalize text-white/35"}>
              {esContingencia
                ? (agente.tipo_personal === "supervisor" ? "Supervisor" : "Jefe de Servicio")
                : (agente.tipo_asignacion_eoa?.replace("_", " ") ?? "pool")}
            </span>
          </p>
        </div>

        {/* ── Paso 1: Elige tipo ────────────────────────────────────────── */}
        {paso === "elige" && (
          <div className="p-5 space-y-3">
            <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 flex items-center gap-2">
              <Building2 className="w-3 h-3 text-white/25 shrink-0" />
              <span className="text-xs text-white/50">{puesto.cliente_nombre} · {puesto.nombre}</span>
              {hayTitularPrevio && puesto.titular_nombre && (
                <span className="ml-auto text-[10px] text-amber-400/70 shrink-0">Titular: {puesto.titular_nombre}</span>
              )}
            </div>

            <button
              onClick={() => { setSoloCoberturaPendiente(true); setHoraInstalacion(ahoraHHMM()); setPaso("horaInstalacion"); }}
              className="w-full text-left bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/50 rounded-xl p-4 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Timer className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-amber-200 transition-colors">Solo cobertura temporal</p>
                  <p className="text-[11px] text-white/35 mt-0.5 leading-snug">
                    Cubre el puesto hoy. Su asignación base y el titular del puesto no cambian.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setPaso("detalles")}
              className="w-full text-left bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/50 rounded-xl p-4 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-blue-200 transition-colors">Convertir en titular del puesto</p>
                  <p className="text-[11px] text-white/35 mt-0.5 leading-snug">
                    Asignación permanente. Queda registrado con fecha efectiva y motivo.
                  </p>
                </div>
              </div>
            </button>

            <button onClick={onCancel} className="w-full py-2 text-xs text-white/35 hover:text-white/60 transition-colors">
              Cancelar
            </button>
          </div>
        )}

        {/* ── Paso 2: Fecha efectiva + motivo ──────────────────────────── */}
        {paso === "detalles" && (
          <div className="p-5 space-y-4">
            {/* Fecha efectiva */}
            <div>
              <p className="text-xs font-semibold text-white/70 mb-2">¿Desde cuándo aplica esta titularidad?</p>
              <div className="space-y-1.5">
                {([
                  { val: "hoy",          label: "Desde hoy",             sub: hoy },
                  { val: "manana",       label: "Desde mañana",          sub: manana },
                  { val: "personalizada", label: "Fecha personalizada",   sub: null },
                ] as { val: "hoy"|"manana"|"personalizada"; label: string; sub: string|null }[]).map(({ val, label, sub }) => (
                  <button
                    key={val}
                    onClick={() => setOpcionFecha(val)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all flex items-center justify-between ${
                      opcionFecha === val ? "bg-blue-500/15 border-blue-500/40" : "border-white/8 hover:border-white/20"
                    }`}
                  >
                    <p className="text-xs font-medium text-white">{label}</p>
                    {sub && <p className="text-[10px] text-white/35">{sub}</p>}
                  </button>
                ))}
                {opcionFecha === "personalizada" && (
                  <input
                    type="date"
                    value={fechaPersonalizada}
                    min={hoy}
                    onChange={e => setFechaPersonalizada(e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 border border-white/15 bg-[#0c1929] text-xs text-white focus:outline-none focus:border-blue-500/50"
                  />
                )}
              </div>
            </div>

            {/* Motivo */}
            <div>
              <p className="text-xs font-semibold text-white/70 mb-2">Motivo del cambio</p>
              <select
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 border border-white/15 bg-[#0c1929] text-xs text-white focus:outline-none focus:border-blue-500/50"
              >
                {MOTIVOS_TITULAR.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setPaso("elige")} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
                Atrás
              </button>
              <button
                onClick={avanzarDesdeDetalles}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: ¿Qué hacemos con el titular previo? ──────────────── */}
        {paso === "titularPrevio" && (
          <div className="p-5 space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300">El puesto ya tiene un titular</p>
                <p className="text-[11px] text-amber-300/70 mt-0.5">
                  <span className="font-medium">{puesto.titular_nombre}</span> dejará de ser titular.
                  ¿A qué estado lo movemos?
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {([
                { val: "disponible",     label: "Mover a Disponibles",    desc: "Queda en el pool sin puesto fijo",    color: "green" },
                { val: "pool_relevo",    label: "Mover a Pool de relevos", desc: "Queda disponible para cubrir otros",  color: "purple" },
                { val: "sin_asignacion", label: "Dejar sin asignación",   desc: "Sin categoría activa por el momento", color: "gray" },
              ] as { val: OldTitularAccion; label: string; desc: string; color: string }[]).map(({ val, label, desc, color }) => (
                <button
                  key={val}
                  onClick={() => setOldTitularAccion(val)}
                  className={`w-full text-left rounded-xl p-3 border transition-all ${
                    oldTitularAccion === val
                      ? color === "green"   ? "bg-green-500/15 border-green-500/40"
                        : color === "purple" ? "bg-purple-500/15 border-purple-500/40"
                        : "bg-white/10 border-white/30"
                      : "border-white/8 hover:border-white/20"
                  }`}
                >
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setPaso("detalles")} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
                Atrás
              </button>
              <button
                onClick={() => { setSoloCoberturaPendiente(false); setPaso("horaInstalacion"); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── Paso final: Hora de instalación ──────────────────────────── */}
        {paso === "horaInstalacion" && (
          <div className="p-5 space-y-4">
            {/* Banner de contingencia operativa */}
            {esContingencia && (
              <div className="flex items-start gap-2 bg-orange-500/8 border border-orange-500/20 rounded-xl px-3 py-2">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-orange-300">Contingencia operativa</p>
                  <p className="text-[10px] text-orange-300/60 leading-snug">
                    {agente.tipo_personal === "supervisor" ? "Supervisor" : "Jefe de Servicio"} cubriendo temporalmente. No cambia titular del puesto. Se registrará con tipo <span className="font-mono">cobertura_{agente.tipo_personal}</span>.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <div>
                <p className="text-xs text-white/70 font-medium">{agente.nombre_completo}</p>
                <p className="text-[10px] text-white/35">{puesto.cliente_nombre} · {puesto.nombre}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/80">¿A qué hora se instaló el servicio?</p>
              <p className="text-[11px] text-white/35 leading-snug">
                Esta hora se usa para calcular las horas reales trabajadas y detectar horas extra.
              </p>
              <input
                type="time"
                value={horaInstalacion}
                onChange={e => setHoraInstalacion(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-3 text-base text-white text-center font-mono outline-none focus:border-primary/50 tracking-widest"
              />
              <p className="text-[10px] text-white/25 text-center">
                Turno {puesto.turno ?? "día"} — fin estimado: {(puesto.turno ?? "día").toLowerCase() === "noche" ? "06:00" : "18:00"}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              {esContingencia ? (
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Cancelar
                </button>
              ) : (
                <button
                  onClick={() => setPaso(soloCoberturaPendiente ? "elige" : (hayTitularPrevio ? "titularPrevio" : "detalles"))}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Atrás
                </button>
              )}
              <button
                onClick={confirmarConHora}
                className={`py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${esContingencia ? "flex-1 bg-orange-600 hover:bg-orange-500" : "flex-1 bg-primary hover:bg-primary/90"}`}
              >
                Confirmar cobertura →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Confirmar Sustitución / Asignación ────────────────────────────────

// ─── Catálogo de tipos de novedad ─────────────────────────────────────────────
const TIPOS_NOVEDAD: {
  value: string;
  label: string;
  grupo: "descuento" | "sin_descuento" | "cobertura" | "especial";
  genera_rrhh?: boolean;
}[] = [
  { value: "falta_total",      label: "Falta total",        grupo: "descuento",     genera_rrhh: true },
  { value: "abandono_parcial", label: "Abandono parcial",   grupo: "descuento",     genera_rrhh: true },
  { value: "suspension",       label: "Suspensión",         grupo: "descuento",     genera_rrhh: true },
  { value: "vacaciones",       label: "Vacaciones",         grupo: "sin_descuento", genera_rrhh: true },
  { value: "incapacidad",      label: "Incapacidad IGSS",   grupo: "sin_descuento", genera_rrhh: true },
  { value: "permiso_con_goce", label: "Permiso c/goce",     grupo: "sin_descuento" },
  { value: "permiso_sin_goce", label: "Permiso s/goce",     grupo: "descuento" },
  { value: "relevo_completo",  label: "Relevo completo",    grupo: "cobertura" },
  { value: "relevo_parcial",   label: "Relevo parcial",     grupo: "cobertura" },
  { value: "relevo_vacaciones",label: "Cob. vacaciones",    grupo: "cobertura" },
  { value: "horas_extra_puras",label: "Horas extra",        grupo: "especial" },
  { value: "ssa_externo",      label: "Servicio especial",  grupo: "especial" },
  { value: "cambio_titular",   label: "Cambio de titular",  grupo: "especial" },
];

const GRUPO_COLORS: Record<string, string> = {
  descuento:     "text-red-300 bg-red-500/10 border-red-500/25 data-[active]:bg-red-500/25 data-[active]:border-red-500/60",
  sin_descuento: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25 data-[active]:bg-emerald-500/25 data-[active]:border-emerald-500/60",
  cobertura:     "text-amber-300 bg-amber-500/10 border-amber-500/25 data-[active]:bg-amber-500/25 data-[active]:border-amber-500/60",
  especial:      "text-purple-300 bg-purple-500/10 border-purple-500/25 data-[active]:bg-purple-500/25 data-[active]:border-purple-500/60",
};

function ModalSustitucion({
  puesto,
  agenteEntrante,
  onConfirm,
  onCancel,
  advertencia,
}: {
  puesto: Puesto;
  agenteEntrante: Agente;
  onConfirm: (motivo: string, notas: string, forzar: boolean, tipoSustitucion: string, tipoNovedad: string, coberturaTipo: string) => Promise<void>;
  onCancel: () => void;
  advertencia?: string;
}) {
  const [tipoNovedad, setTipoNovedad] = useState("falta_total");
  const [coberturaTipo, setCoberturaTipo] = useState<"completo" | "parcial">("completo");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [tipoSustitucion, setTipoSustitucion] = useState<"relevo" | "reasignacion">("relevo");
  const esSustitucion = !!puesto.agente_id;

  const tipoSeleccionado = TIPOS_NOVEDAD.find((t) => t.value === tipoNovedad);
  const generaRrhh = esSustitucion && !!tipoSeleccionado?.genera_rrhh;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(tipoNovedad, notas, !!advertencia, tipoSustitucion, tipoNovedad, coberturaTipo);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            {esSustitucion
              ? <ArrowLeftRight className="w-4 h-4 text-yellow-400" />
              : <UserPlus className="w-4 h-4 text-green-400" />
            }
            <h3 className="text-sm font-bold text-white">
              {esSustitucion ? "Confirmar sustitución" : "Confirmar asignación"}
            </h3>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Advertencia de conflicto */}
          {advertencia && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300/80">{advertencia}</p>
            </div>
          )}

          {/* Aviso de generación RRHH */}
          {generaRrhh && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-start gap-2">
              <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-purple-300 mb-0.5">Se generará un evento RRHH</p>
                <p className="text-[11px] text-purple-300/70">
                  Esta acción creará automáticamente una boleta de descuento y un acta administrativa
                  disponibles en el módulo de Eventos RRHH.
                </p>
              </div>
            </div>
          )}

          {/* Resumen del movimiento */}
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-3 h-3 text-white/25" />
              <span className="text-xs text-white/50">{puesto.cliente_nombre} · {puesto.nombre}</span>
            </div>
            {esSustitucion && puesto.agente_nombre && (
              <div className="flex items-center gap-2">
                <UserMinus className="w-3 h-3 text-red-400/60" />
                <span className="text-xs text-white/50">Sale: <span className="text-white/70">{puesto.agente_nombre}</span></span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <UserPlus className="w-3 h-3 text-green-400/60" />
              <span className="text-xs text-white/50">Entra: <span className="text-white/70">{agenteEntrante.nombre_completo}</span></span>
            </div>
          </div>

          {/* Tipo de sustitución: Relevo temporal vs Reasignación permanente */}
          {esSustitucion && puesto.titular_employee_id && (
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Tipo de movimiento</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTipoSustitucion("relevo")}
                  className={`py-2 px-2 rounded-lg border text-[11px] font-semibold transition-all ${
                    tipoSustitucion === "relevo"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "border-white/10 text-white/35 hover:text-white/60"
                  }`}
                >
                  Relevo temporal
                </button>
                <button
                  type="button"
                  onClick={() => setTipoSustitucion("reasignacion")}
                  className={`py-2 px-2 rounded-lg border text-[11px] font-semibold transition-all ${
                    tipoSustitucion === "reasignacion"
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                      : "border-white/10 text-white/35 hover:text-white/60"
                  }`}
                >
                  Reasignación
                </button>
              </div>
              <p className="text-[10px] text-white/25">
                {tipoSustitucion === "relevo"
                  ? `El titular (${puesto.titular_nombre}) sigue siendo titular. Solo cambia la cobertura de hoy.`
                  : `${agenteEntrante.nombre_completo} se convierte en el nuevo titular permanente del puesto.`
                }
              </p>
            </div>
          )}

          {/* Tipo de novedad — selector estructurado */}
          {esSustitucion && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/40">Tipo de movimiento</label>
                <div className="flex items-center gap-1">
                  {tipoSeleccionado && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                      tipoSeleccionado.grupo === "descuento"     ? "text-red-300 bg-red-500/10 border-red-500/30" :
                      tipoSeleccionado.grupo === "sin_descuento" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
                      tipoSeleccionado.grupo === "cobertura"     ? "text-amber-300 bg-amber-500/10 border-amber-500/30" :
                      "text-purple-300 bg-purple-500/10 border-purple-500/30"
                    }`}>
                      {tipoSeleccionado.grupo === "descuento" ? "Con descuento" :
                       tipoSeleccionado.grupo === "sin_descuento" ? "Sin descuento" :
                       tipoSeleccionado.grupo === "cobertura" ? "Cobertura" : "Especial"}
                    </span>
                  )}
                </div>
              </div>

              {/* Grupos */}
              {(["descuento","sin_descuento","cobertura","especial"] as const).map((grupo) => {
                const items = TIPOS_NOVEDAD.filter((t) => t.grupo === grupo);
                const grupoLabel = grupo === "descuento" ? "Con descuento salarial" :
                                   grupo === "sin_descuento" ? "Sin descuento" :
                                   grupo === "cobertura" ? "Cobertura / Relevo" : "Especial";
                return (
                  <div key={grupo}>
                    <p className="text-[9px] text-white/25 uppercase tracking-wide mb-1">{grupoLabel}</p>
                    <div className="flex flex-wrap gap-1">
                      {items.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          data-active={tipoNovedad === t.value ? "" : undefined}
                          onClick={() => setTipoNovedad(t.value)}
                          className={`px-2 py-1 rounded-md border text-[10px] font-semibold transition-all ${GRUPO_COLORS[grupo]} ${
                            tipoNovedad === t.value ? "opacity-100 scale-[1.03]" : "opacity-60 hover:opacity-90"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Alcance: parcial / completo (solo para relevos) */}
              {["relevo_parcial","abandono_parcial","permiso_con_goce","permiso_sin_goce"].includes(tipoNovedad) && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-white/35">Alcance:</span>
                  {(["completo","parcial"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setCoberturaTipo(a)}
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold transition-all ${
                        coberturaTipo === a
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                          : "border-white/10 text-white/30 hover:text-white/50"
                      }`}
                    >
                      {a === "completo" ? "Turno completo" : "Turno parcial"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observación adicional…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors flex items-center justify-center gap-2
                ${esSustitucion
                  ? "bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50"
                  : "bg-green-600 hover:bg-green-500 disabled:opacity-50"}`}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {advertencia ? "Forzar y confirmar" : esSustitucion ? "Confirmar sustitución" : "Asignar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Nuevo Puesto ──────────────────────────────────────────────────────

function ModalNuevoPuesto({
  clientePreseleccionado,
  clientes,
  onSave,
  onClose,
}: {
  clientePreseleccionado?: ClienteBoard;
  clientes: ClienteDisponible[];
  onSave: (data: {
    clienteId: number | null;
    clienteNombre: string;
    nombre: string;
    turno: string;
    notas: string;
    tipoTurnoId: number;
    fechaInicioCiclo: string;
    zonaOperativaId: number;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [clienteId, setClienteId]     = useState<string>(clientePreseleccionado?.clienteId?.toString() ?? "");
  const [clienteNombreCustom, setClienteNombreCustom] = useState(clientePreseleccionado?.clienteNombre ?? "");
  const [nombre, setNombre]           = useState("");
  const [notas, setNotas]             = useState("");
  const [tipoTurnoId, setTipoTurnoId] = useState<string>("");
  const [zonaId, setZonaId]           = useState<string>("");
  const hoy = new Date().toISOString().split("T")[0];
  const [fechaInicioCiclo, setFechaInicioCiclo] = useState<string>(hoy);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // Cargar catálogo de turnos
  const { data: turnosCatalogo = [], isLoading: cargandoTurnos } = useQuery<TurnoApiItem[]>({
    queryKey: ["turnos-catalogo"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/turnos`, { credentials: "include" });
      if (!r.ok) throw new Error("Error al cargar turnos");
      return r.json();
    },
  });

  // Cargar catálogo de zonas
  const { data: zonasCatalogo = [], isLoading: cargandoZonas } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ["zonas-catalogo"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/zonas`, { credentials: "include" });
      if (!r.ok) throw new Error("Error al cargar zonas");
      const data = await r.json();
      return Array.isArray(data) ? data : (data.zonas ?? []);
    },
  });

  // Resolver nombre del cliente seleccionado
  const clienteSeleccionado = clientes.find((c) => c.id.toString() === clienteId);
  const clienteNombreFinal  = clienteSeleccionado
    ? (clienteSeleccionado.nombre_comercial || clienteSeleccionado.nombre)
    : clienteNombreCustom;

  const turnoSeleccionado = turnosCatalogo.find(t => String(t.id) === tipoTurnoId) ?? null;

  async function handleSave() {
    if (!nombre.trim()) { setError("El nombre del puesto es requerido."); return; }
    if (!clienteNombreFinal.trim()) { setError("Selecciona o escribe un cliente."); return; }
    if (!tipoTurnoId) { setError("Debes seleccionar un tipo de turno."); return; }
    if (!zonaId) { setError("Debes asignar una zona operativa al puesto."); return; }
    if (!fechaInicioCiclo) { setError("La fecha de inicio del ciclo es requerida."); return; }
    setLoading(true);
    setError("");
    try {
      await onSave({
        clienteId: clienteId ? parseInt(clienteId) : null,
        clienteNombre: clienteNombreFinal,
        nombre: nombre.trim(),
        turno: turnoSeleccionado?.nombre ?? "día",
        notas,
        tipoTurnoId: parseInt(tipoTurnoId),
        fechaInicioCiclo,
        zonaOperativaId: parseInt(zonaId),
      });
      onClose();
    } catch (e: any) {
      setError(e.error ?? e.message ?? "Error al crear puesto");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Nuevo Puesto</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-400">{error}</div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              <option value="">— Escribir manualmente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre_comercial || c.nombre}</option>
              ))}
            </select>
          </div>
          {!clienteId && (
            <div className="space-y-1">
              <label className="text-xs text-white/40">Nombre del cliente (manual)</label>
              <input
                type="text"
                value={clienteNombreCustom}
                onChange={(e) => setClienteNombreCustom(e.target.value)}
                placeholder="Nombre del cliente…"
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Nombre del puesto <span className="text-rose-400">*</span></label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Garita Principal, Recepción…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            />
          </div>

          {/* Tipo de turno — requerido */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">
              Tipo de turno <span className="text-rose-400">*</span>
            </label>
            {cargandoTurnos ? (
              <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando turnos…
              </div>
            ) : (
              <select
                value={tipoTurnoId}
                onChange={(e) => setTipoTurnoId(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Selecciona un turno —</option>
                {turnosCatalogo.filter(t => t.id).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {t.ciclo_horas}h ({t.tipo_ciclo})
                  </option>
                ))}
              </select>
            )}
            {turnoSeleccionado && (
              <p className="text-[10px] text-indigo-300/50 mt-1">
                {turnoSeleccionado.horas_trabajo}h trabajo / {turnoSeleccionado.horas_descanso}h descanso
                {turnoSeleccionado.tipo_ciclo === "alternado" ? " · ciclo alternado" : " · ciclo diario"}
              </p>
            )}
          </div>

          {/* Zona operativa — obligatoria */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">
              Zona operativa <span className="text-rose-400">*</span>
            </label>
            {cargandoZonas ? (
              <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando zonas…
              </div>
            ) : zonasCatalogo.length === 0 ? (
              <p className="text-xs text-amber-400/70 py-1">
                No hay zonas creadas. Crea una zona operativa primero.
              </p>
            ) : (
              <select
                value={zonaId}
                onChange={(e) => setZonaId(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Selecciona una zona —</option>
                {zonasCatalogo.map((z) => (
                  <option key={z.id} value={z.id}>{z.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha de inicio del ciclo */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">
              Fecha inicio del ciclo <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              value={fechaInicioCiclo}
              onChange={(e) => setFechaInicioCiclo(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
            />
            <p className="text-[10px] text-white/25">
              Fecha desde la que el ciclo de turno empieza a contar.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones especiales…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !tipoTurnoId || !zonaId}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear puesto
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Liberar agente ────────────────────────────────────────────────────

function ModalLiberar({
  puesto,
  onConfirm,
  onClose,
}: {
  puesto: Puesto;
  onConfirm: (motivo: string, horaFin?: string, generarEventoFalta?: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const ahoraHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };
  const [motivo, setMotivo] = useState("descanso");
  const [horaFin, setHoraFin] = useState(ahoraHHMM());
  const [generarEventoFalta, setGenerarEventoFalta] = useState(true);
  const [loading, setLoading] = useState(false);
  const esFalta = motivo === "falta" || motivo === "suspension";

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(motivo, horaFin || undefined, esFalta ? generarEventoFalta : false);
    } finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserMinus className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-bold text-white">Remover agente del puesto</h3>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-xs text-white/60">
          <p><span className="text-white/80">{puesto.agente_nombre}</span> será removido de</p>
          <p className="text-white/40 mt-0.5">{puesto.cliente_nombre} · {puesto.nombre}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Motivo</label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none"
          >
            <option value="descanso">Descanso</option>
            <option value="falta">Falta</option>
            <option value="suspension">Suspensión</option>
            <option value="rotacion">Rotación</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/40">Hora de salida</label>
          <input
            type="time"
            value={horaFin}
            onChange={e => setHoraFin(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono text-center outline-none focus:border-red-500/40"
          />
          <p className="text-[9px] text-white/20">Cierra el segmento de cobertura del día</p>
        </div>

        {esFalta && (
          <button
            onClick={() => setGenerarEventoFalta(p => !p)}
            className={`w-full text-left rounded-xl p-3 border transition-all flex items-start gap-2.5 ${
              generarEventoFalta
                ? "bg-red-500/10 border-red-500/30"
                : "bg-white/3 border-white/8 hover:border-white/15"
            }`}
          >
            <div className={`w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border transition-all ${
              generarEventoFalta ? "bg-red-500 border-red-500" : "border-white/20"
            }`}>
              {generarEventoFalta && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80">Registrar falta en RRHH</p>
              <p className="text-[10px] text-white/35 mt-0.5 leading-snug">
                Genera evento de falta + descuento de día en nómina.
                No se pagará ese día al colaborador.
              </p>
            </div>
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Remover
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Cerrar día ────────────────────────────────────────────────────────

function ModalCierre({
  resumen,
  advertencias,
  fechaActivaStr,
  onConfirm,
  onClose,
}: {
  resumen: CierreResumen;
  advertencias: string[];
  fechaActivaStr: string;
  onConfirm: (comentario: string) => Promise<void>;
  onClose: () => void;
}) {
  const hoy      = fechaActivaStr;
  const esperado = `CERRAR ${hoy}`;
  const [texto,      setTexto]      = useState("");
  const [comentario, setComentario] = useState("");
  const [loading,    setLoading]    = useState(false);
  const valido = texto === esperado;

  async function handleConfirm() {
    if (!valido) return;
    setLoading(true);
    try { await onConfirm(comentario); }
    finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Cerrar día operativo</h3>
            <span className="text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">{hoy}</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumen */}
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-2 font-semibold">Resumen del día</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Puestos totales",    value: resumen.totalPuestos,        color: "text-white" },
                { label: "Cubiertos titular",  value: resumen.cubiertosPorTitular, color: "text-green-400" },
                { label: "Cubiertos relevo",   value: resumen.cubiertosPorRelevo,  color: "text-yellow-400" },
                { label: "Descubiertos",        value: resumen.descubiertos,        color: resumen.descubiertos > 0 ? "text-red-400" : "text-white/30" },
                { label: "Ausencias",           value: resumen.ausencias,           color: resumen.ausencias > 0 ? "text-orange-400" : "text-white/30" },
                { label: "Horas extra",         value: resumen.horasExtra,          color: "text-blue-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#0c1929] border border-white/6 rounded-xl p-2.5 text-center">
                  <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
                  <p className="text-[9px] text-white/30 mt-1 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Advertencias */}
          {advertencias.length > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-400">Advertencias (no bloquean el cierre)</span>
              </div>
              {advertencias.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-300/80">
                  <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* Comentario opcional */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Comentario del cierre (opcional)</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Observaciones del día, novedades…"
              rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {/* Confirmación por texto */}
          <div className="space-y-2">
            <label className="text-xs text-white/40">
              Para confirmar, escribe exactamente:
              <span className="text-white font-bold ml-1 font-mono">{esperado}</span>
            </label>
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={esperado}
              className={`w-full bg-[#060e1c] border rounded-lg px-3 py-2.5 text-sm font-mono placeholder-white/15 outline-none transition-colors
                ${valido ? "border-green-500/50 text-green-300" : texto ? "border-red-500/30 text-white" : "border-white/10 text-white"}`}
            />
            {valido && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmación válida
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!valido || loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Cerrar día
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Reabrir día ───────────────────────────────────────────────────────

function ModalReabrir({
  cierre,
  fechaParaReabrir,
  onConfirm,
  onClose,
}: {
  cierre: CierreDiaRecord | null;
  fechaParaReabrir: string;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}) {
  const esperado = `REABRIR ${fechaParaReabrir}`;
  const [texto,  setTexto]  = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const valido = texto === esperado && motivo.trim().length >= 5;

  async function handleConfirm() {
    if (!valido) return;
    setLoading(true);
    try { await onConfirm(motivo.trim()); }
    finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-red-500/20 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/15 bg-red-500/5">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">Reabrir día operativo</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {cierre && (
            <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-xs text-white/50 space-y-1">
              <p>Cerrado por: <span className="text-white/80">{cierre.cerrado_por}</span></p>
              <p>Fecha/hora: <span className="text-white/80">{new Date(cierre.cerrado_en).toLocaleString("es-GT")}</span></p>
              {cierre.comentario && <p>Comentario: <span className="text-white/80">{cierre.comentario}</span></p>}
            </div>
          )}

          <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 text-xs text-red-300/80">
            <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 text-red-400" />
            Esta acción requiere justificación y queda registrada en auditoría.
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">Motivo de reapertura <span className="text-red-400">*</span></label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describe el motivo de la reapertura…"
              rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/40 resize-none"
            />
            {motivo.trim().length > 0 && motivo.trim().length < 5 && (
              <p className="text-[10px] text-red-400">Mínimo 5 caracteres</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/40">
              Para confirmar, escribe exactamente:
              <span className="text-white font-bold ml-1 font-mono">{esperado}</span>
            </label>
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={esperado}
              className={`w-full bg-[#060e1c] border rounded-lg px-3 py-2.5 text-sm font-mono placeholder-white/15 outline-none transition-colors
                ${texto === esperado ? "border-green-500/50 text-green-300" : texto ? "border-red-500/30 text-white" : "border-white/10 text-white"}`}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!valido || loading}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
              Reabrir día
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Operaciones() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // ── Roles ─────────────────────────────────────────────────────────────────
  const esAdmin             = currentUser?.rol === "admin";
  const esSupervisorOAdmin  = esAdmin || currentUser?.rol === "supervisor";

  // ── Estado UI ──────────────────────────────────────────────────────────────
  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(null);
  const [draggingAgente, setDraggingAgente]         = useState<Agente | null>(null);
  const [historialAbierto, setHistorialAbierto]     = useState(false);
  const [nuevoPuestoData, setNuevoPuestoData]        = useState<ClienteBoard | null | "nuevo">(null);
  const [modalSustitucion, setModalSustitucion]      = useState<{ puesto: Puesto; agente: Agente; advertencia?: string } | null>(null);
  const [modalEligeCobertura, setModalEligeCobertura] = useState<{ puesto: Puesto; agente: Agente } | null>(null);
  const [modalSustituyeTitular, setModalSustituyeTitular] = useState<{ puesto: Puesto; agente: Agente } | null>(null);
  const [modalIncentivo, setModalIncentivo]           = useState<{
    agenteId: number; agenteName: string;
    puestoId: number; puestoName: string;
    clienteId: number | null; clienteNombre: string | null;
    sedeId: number | null; fecha: string;
  } | null>(null);
  const [modalLiberar, setModalLiberar]              = useState<Puesto | null>(null);
  const [poolTab, setPoolTab]                        = useState<"disponibles" | "trabajando" | "descansandoCiclo" | "enDescanso" | "suspendidos" | "enPuesto" | "enSSA" | "faltando" | "enVacaciones">("disponibles");
  const [busquedaPool, setBusquedaPool]              = useState("");
  const [busquedaPersona, setBusquedaPersona]        = useState("");
  const [colGlobal, setColGlobal]                    = useState<{ v: number; val: boolean }>({ v: 0, val: false });
  const [puestoContexto, setPuestoContexto]          = useState<Puesto | null>(null);
  const [modalCierre, setModalCierre]                = useState(false);
  const [modalReabrir, setModalReabrir]              = useState(false);
  const [filtroZona, setFiltroZona]                  = useState<string>("");
  const [filtroCliente, setFiltroCliente]            = useState<string>("");
  const [modalSegmentos, setModalSegmentos]          = useState<Puesto | null>(null);
  const [modalAsignarSSA, setModalAsignarSSA]        = useState<TarjetaSSAPendiente | null>(null);
  const [ssaTabActivo, setSsaTabActivo]              = useState<"sin_asignar" | "cubierta">("sin_asignar");
  const [fichaVehiculoId, setFichaVehiculoId]        = useState<number | null>(null);

  // ── Estado de colapso de paneles (persiste en sessionStorage) ─────────────
  function initCollapse(key: string, defaultVal = false) {
    const v = sessionStorage.getItem(key);
    return v === null ? defaultVal : v === "1";
  }
  function togglePanel(key: string, cur: boolean, setter: (v: boolean) => void) {
    const next = !cur;
    sessionStorage.setItem(key, next ? "1" : "0");
    setter(next);
  }
  const [colSSA,       setColSSA]       = useState(() => initCollapse("piz_col_ssa"));
  const [colArranques, setColArranques] = useState(() => initCollapse("piz_col_arr"));
  const [colSupers,    setColSupers]    = useState(() => initCollapse("piz_col_supers"));
  const [colJefes,     setColJefes]     = useState(() => initCollapse("piz_col_jefes"));
  const [colPool,      setColPool]      = useState(() => initCollapse("piz_col_pool"));
  const [colAdmin,     setColAdmin]     = useState(() => initCollapse("piz_col_admin", true));

  // ── Planificación futura ───────────────────────────────────────────────────
  const hoyISO = toISODate(new Date());

  // Leer ?pizarronFecha=YYYY-MM-DD de la URL para navegación directa desde el banner
  const fechaDesdeURL = (() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get("pizarronFecha");
    return f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= hoyISO ? f : null;
  })();

  const [fechaVista, setFechaVista]           = useState<string>(fechaDesdeURL ?? hoyISO);
  const esFuturo = fechaVista > hoyISO;
  const [modalPlanFuturo, setModalPlanFuturo] = useState<{ puesto: Puesto; plan: PlanFuturo | null } | null>(null);
  const [modalPlanSSA, setModalPlanSSA]       = useState<InicioProyecto | null>(null);
  const [puestoParaTurno, setPuestoParaTurno] = useState<Puesto | null>(null);

  // Cliente a resaltar cuando el usuario navega desde el banner de arranques
  const [clienteResaltado, setClienteResaltado] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("clienteId");
    return id ? Number(id) : null;
  });
  const resaltadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-limpiar el resaltado después de 4 segundos
  useEffect(() => {
    if (clienteResaltado !== null) {
      if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current);
      resaltadoTimerRef.current = setTimeout(() => setClienteResaltado(null), 4000);
    }
    return () => { if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current); };
  }, [clienteResaltado]);

  // Función para navegar al pizarrón en una fecha específica y resaltar un cliente
  function irAFecha(fecha: string, clienteId?: number) {
    if (fecha >= hoyISO) {
      setFechaVista(fecha);
      if (clienteId) setClienteResaltado(clienteId);
      // Actualizar URL sin recargar para que sea compartible
      const params = new URLSearchParams(window.location.search);
      params.set("pizarronFecha", fecha);
      if (clienteId) params.set("clienteId", String(clienteId));
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    }
  }

  function navFecha(delta: number) {
    const d = new Date(fechaVista + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const nuevo = toISODate(d);
    if (nuevo < hoyISO) return;
    setFechaVista(nuevo);
    // Limpiar params de URL al navegar manualmente
    window.history.replaceState({}, "", window.location.pathname);
  }
  function volverHoy() {
    setFechaVista(hoyISO);
    setClienteResaltado(null);
    window.history.replaceState({}, "", window.location.pathname);
  }
  function formatFechaVista(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  }

  // ── Sensores DnD ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: tablero = [], isLoading: loadingTablero, refetch: refetchTablero } = useQuery<ClienteBoard[]>({
    queryKey: ["operaciones-tablero", esFuturo ? fechaVista : "hoy"],
    queryFn: () => {
      const url = esFuturo
        ? `${API_BASE}/operaciones/tablero?fecha=${fechaVista}`
        : `${API_BASE}/operaciones/tablero`;
      return fetch(url).then((r) => r.json());
    },
    refetchInterval: esFuturo ? false : 30_000,
  });

  const { data: pool, isLoading: loadingPool, refetch: refetchPool } = useQuery<Pool>({
    queryKey: ["operaciones-pool", puestoContexto?.id ?? null],
    queryFn: () => {
      const url = puestoContexto
        ? `${API_BASE}/operaciones/pool?puesto_id=${puestoContexto.id}`
        : `${API_BASE}/operaciones/pool`;
      return fetch(url).then((r) => r.json());
    },
    refetchInterval: 30_000,
  });

  interface AdminPersonal {
    id: number; nombre_completo: string; estado_laboral: string;
    puesto: string | null; area: string | null; sede: string | null;
    tipo_personal: string; turno_nombre: string | null;
    trabaja_hoy: boolean | null; estado_ciclo: string;
  }
  interface AdminTablero {
    fecha: string;
    empleados: AdminPersonal[];
    grupos: {
      gerencia: AdminPersonal[];
      administrativo_rrhh: AdminPersonal[];
      administrativo_bodega: AdminPersonal[];
    };
  }
  const { data: adminTablero } = useQuery<AdminTablero>({
    queryKey: ["operaciones-admin", esFuturo ? fechaVista : "hoy"],
    queryFn: () => {
      const url = esFuturo
        ? `${API_BASE}/operaciones/tablero/administracion?fecha=${fechaVista}`
        : `${API_BASE}/operaciones/tablero/administracion`;
      return fetch(url).then((r) => r.json());
    },
    refetchInterval: esFuturo ? false : 60_000,
  });

  const { data: historial = [], isLoading: loadingHistorial } = useQuery<Movimiento[]>({
    queryKey: ["operaciones-historial"],
    queryFn: () => fetch(`${API_BASE}/operaciones/historial?limit=80`).then((r) => r.json()),
    enabled: historialAbierto,
    refetchInterval: historialAbierto ? 15_000 : false,
  });

  const { data: clientesDisponibles = [] } = useQuery<ClienteDisponible[]>({
    queryKey: ["operaciones-clientes"],
    queryFn: () => fetch(`${API_BASE}/operaciones/clientes-disponibles`).then((r) => r.json()),
  });

  const { data: cierreHoy, refetch: refetchCierre } = useQuery<CierreHoyData>({
    queryKey: ["operaciones-cierre-hoy"],
    queryFn: () => fetch(`${API_BASE}/operaciones/cierre-hoy`).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: tarjetasSSA = [] } = useQuery<TarjetaSSAPendiente[]>({
    queryKey: ["ssa-tablero-pizarron"],
    queryFn: () => fetch(`${API_BASE}/solicitudes-servicio/tablero`, {
      headers: { "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "" },
    }).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  // ── Query: puestos sin zona (alerta operativa) ───────────────────────────
  const { data: sinZonaData } = useQuery<{ total: number; puestos: { id: number; nombre: string; cliente: string }[] }>({
    queryKey: ["puestos-sin-zona"],
    queryFn: () => fetch(`${API_BASE}/operaciones/puestos/sin-zona`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 120_000,
  });
  const puestosSinZonaCount = sinZonaData?.total ?? 0;

  // ── Queries: planificación futura ────────────────────────────────────────
  const { data: planFuturoDia = [], refetch: refetchPlanFuturo } = useQuery<PlanFuturo[]>({
    queryKey: ["planificacion-futura", fechaVista],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/planificacion-futura?fecha=${fechaVista}`)
        .then((r) => r.json()),
    enabled: esFuturo,
    refetchInterval: esFuturo ? 30_000 : false,
  });

  const { data: cambiosFuturosProximos = {} } = useQuery<Record<number, PlanFuturo[]>>({
    queryKey: ["planificacion-futura-proximos"],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/planificacion-futura/proximos`)
        .then((r) => r.json()),
    refetchInterval: 60_000,
  });

  // Lookup para la vista futura: puestoId → plan del día
  const planFuturoPorPuesto: Record<number, PlanFuturo> = {};
  for (const p of planFuturoDia) {
    planFuturoPorPuesto[p.puesto_id] = p;
  }

  const { data: poolFuturo, isLoading: loadingPoolFuturo } = useQuery<PoolFuturoData>({
    queryKey: ["pool-futuro", fechaVista],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/pool-futuro?fecha=${fechaVista}`)
        .then((r) => { if (!r.ok) throw new Error("pool-futuro error"); return r.json(); }),
    enabled: esFuturo,
    refetchInterval: esFuturo ? 60_000 : false,
    retry: 1,
  });

  const { data: proximosArranques } = useQuery<{ arranques: InicioProyecto[]; total: number }>({
    queryKey: ["proximos-arranques"],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/proximos-arranques?dias=60`)
        .then((r) => r.json()),
    refetchInterval: 300_000,
    retry: 1,
  });

  // Etapas SSA para el panel del Pizarrón (multi-agente)
  const ssaSinAgente = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados < (t.cantidad_guardias ?? 1);
  });
  const ssaCubierta = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados >= (t.cantidad_guardias ?? 1);
  });

  // isCerrado: la fecha ACTIVA está cerrada (prácticamente nunca true con nuevo modelo de fecha activa)
  const isCerrado = cierreHoy?.estado === "cerrado";
  // diaHoyCerrado: el día de hoy en el calendario fue cerrado y operamos ya en el siguiente
  const diaHoyCerrado = !!(cierreHoy?.esFechaFutura && cierreHoy?.cierreDeHoy);
  // Fecha activa formateada para mostrar en UI (usa la del API si está disponible)
  const fechaActivaStr = cierreHoy?.fechaActivaStr ?? fechaHoyStr();
  // Fecha del día cerrado (para reabrir cuando diaHoyCerrado)
  const fechaCierreParaReabrir = diaHoyCerrado
    ? (cierreHoy!.cierreDeHoy!.fecha_str ?? fechaHoyStr())
    : fechaHoyStr();

  // ── Invalidar y refrescar ─────────────────────────────────────────────────
  function invalidate() {
    qc.invalidateQueries({ queryKey: ["operaciones-tablero"] });
    qc.invalidateQueries({ queryKey: ["operaciones-pool"] });
    qc.invalidateQueries({ queryKey: ["operaciones-historial"] });
    qc.invalidateQueries({ queryKey: ["ssa-tablero-pizarron"] });
    qc.invalidateQueries({ queryKey: ["pool-disponibilidad"] });
  }

  function invalidateFuture() {
    qc.invalidateQueries({ queryKey: ["planificacion-futura"] });
    qc.invalidateQueries({ queryKey: ["planificacion-futura-proximos"] });
    qc.invalidateQueries({ queryKey: ["pool-futuro"] });
  }

  // ── Handlers: planificación futura ───────────────────────────────────────
  async function guardarPlanFuturo(data: {
    tipoAusencia: string;
    titularAusenteId: number | null;
    relevId: number | null;
    motivo: string;
    notas: string;
  }) {
    if (!modalPlanFuturo) return;
    const { puesto, plan } = modalPlanFuturo;
    if (plan) {
      await fetch(`${API_BASE}/operaciones/planificacion-futura/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data }),
      });
      toast({ title: "Plan actualizado", description: `${puesto.nombre} · ${formatFechaVista(fechaVista)}` });
    } else {
      await fetch(`${API_BASE}/operaciones/planificacion-futura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaVista,
          puestoId: puesto.id,
          tipoEvento: "ausencia",
          ...data,
          creadoPor: currentUser?.username ?? "sistema",
        }),
      });
      toast({ title: "Planificación guardada", description: `${puesto.nombre} · ${formatFechaVista(fechaVista)}` });
    }
    setModalPlanFuturo(null);
    invalidateFuture();
  }

  async function eliminarPlanFuturo(planId: number) {
    await fetch(`${API_BASE}/operaciones/planificacion-futura/${planId}`, { method: "DELETE" });
    toast({ title: "Plan cancelado" });
    setModalPlanFuturo(null);
    invalidateFuture();
  }

  async function guardarPlanSSA(agentesSeleccionados: Array<{ id: number | null }>) {
    if (!modalPlanSSA) return;
    const ip = modalPlanSSA;
    const res = await fetch(`${API_BASE}/operaciones/planificacion-futura/ssa-batch`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: fechaVista,
        ssaId: ip.ssa_id,
        agentes: agentesSeleccionados.filter((a) => a.id),
        creadoPor: currentUser?.username ?? "sistema",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Error al guardar", description: body.error ?? "Error desconocido", variant: "destructive" });
      return;
    }
    const n = agentesSeleccionados.filter((a) => a.id).length;
    toast({
      title: n > 0 ? "Planificación SSA guardada" : "Planes SSA cancelados",
      description: n > 0 ? `${ip.cliente_nombre} · ${n} agente(s) planificado(s)` : `${ip.cliente_nombre} · sin agentes planificados`,
    });
    setModalPlanSSA(null);
    invalidateFuture();
  }

  async function eliminarPlanSSA() {
    if (!modalPlanSSA) return;
    await guardarPlanSSA([]);
  }

  // ── Remover agente de un SSA ─────────────────────────────────────────────
  async function removerAgenteSSA(t: TarjetaSSAPendiente, motivo?: string, notas?: string) {
    try {
      const r = await fetch(`${API_BASE}/solicitudes-servicio/${t.id}/remover-agente`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "",
        },
        body: JSON.stringify({ motivo: motivo ?? null, notas: notas ?? null }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Error al remover agente", description: err.error ?? "Error desconocido", variant: "destructive" });
        return;
      }
      const descripcionToast = motivo === "agente_declino"
        ? "El agente declinó. Queda registrado y el SSA volvió a Pendiente Operaciones."
        : "El agente fue desvinculado del servicio y volvió al pool.";
      toast({ title: "Agente removido", description: descripcionToast });
      invalidate();
    } catch {
      toast({ title: "Error de red", description: "No se pudo conectar con el servidor.", variant: "destructive" });
    }
  }

  // ── DnD: inicio ───────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    if (isCerrado) return;
    const agenteId = parseInt(event.active.id.toString().replace("agent-", ""));
    const agente = [
      ...(pool?.disponibles ?? []),
      ...(pool?.trabajando ?? []),
      ...(pool?.descansandoCiclo ?? []),
      ...(pool?.enDescanso ?? []),
      ...(pool?.suspendidos ?? []),
      ...(pool?.enPuesto ?? []),
      ...(pool?.enSSA ?? []),
    ].find((a) => a.id === agenteId);
    if (agente) setDraggingAgente(agente);
  }

  // ── DnD: fin ──────────────────────────────────────────────────────────────
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingAgente(null);

    if (isCerrado) return;
    if (!over) return;

    const agenteId = parseInt(active.id.toString().replace("agent-", ""));
    const puestoId = parseInt(over.id.toString().replace("puesto-", ""));

    const agente = [
      ...(pool?.disponibles ?? []),
      ...(pool?.trabajando ?? []),
      ...(pool?.descansandoCiclo ?? []),
      ...(pool?.enDescanso ?? []),
      ...(pool?.suspendidos ?? []),
      ...(pool?.enPuesto ?? []),
      ...(pool?.enSSA ?? []),
    ].find((a) => a.id === agenteId);

    const puesto = tablero.flatMap((c) => c.puestos).find((p) => p.id === puestoId);

    if (!agente || !puesto) return;

    await iniciarAsignacion(puesto, agente);
  }

  // ── Helper: es agente del pool (no titular en EOA) ───────────────────────
  function esAgentePool(agente: Agente) {
    const eoa = agente.tipo_asignacion_eoa ?? "sin_asignacion";
    return eoa !== "titular";
  }

  // ── Lógica de asignación/sustitución ─────────────────────────────────────
  async function iniciarAsignacion(puesto: Puesto, agente: Agente) {
    // Si ya tiene el mismo agente, no hacer nada
    if (puesto.agente_id === agente.id) return;

    // ── Puesto multi-titular sin relevo manual activo ─────────────────────────
    // Preguntamos A QUIÉN sustituye antes de continuar
    if (!puesto.agente_id && puesto.es_par_24x24 && (puesto.par_trabajando || puesto.par_descansando)) {
      setModalSustituyeTitular({ puesto, agente });
      return;
    }

    // ── NUEVO: Agente de pool → puesto SIN agente activo ─────────────────────
    // Preguntamos si es cobertura temporal o cambio de titular
    if (!puesto.agente_id && esAgentePool(agente)) {
      setModalEligeCobertura({ puesto, agente });
      return;
    }

    // Flujo normal: verificar disponibilidad y mostrar modal de confirmación
    try {
      const disp = await fetch(`${API_BASE}/operaciones/agentes/${agente.id}/disponibilidad`).then((r) => r.json());
      if (disp.puestosActivos.length > 0) {
        const yaTiene = disp.puestosActivos[0];
        setModalSustitucion({
          puesto,
          agente,
          advertencia: `${agente.nombre_completo} ya está en ${yaTiene.cliente_nombre} — ${yaTiene.nombre}. ¿Forzar?`,
        });
      } else {
        setModalSustitucion({ puesto, agente });
      }
    } catch {
      setModalSustitucion({ puesto, agente });
    }
  }

  // ── Confirmar elección de cobertura (pool → puesto vacío) ────────────────
  async function confirmarEligeCobertura(soloCobertura: boolean, oldTitularAccion?: OldTitularAccion, fechaEfectiva?: string, motivoCambio?: string, horaInstalacion?: string) {
    if (!modalEligeCobertura) return;
    const { puesto, agente } = modalEligeCobertura;
    setModalEligeCobertura(null);
    try {
      await apiPost(`${API_BASE}/operaciones/asignar`, {
        puestoId: puesto.id,
        agenteId: agente.id,
        soloCobertura,
        oldTitularAccion: oldTitularAccion ?? null,
        fechaEfectiva: fechaEfectiva ?? null,
        motivoCambio: motivoCambio ?? null,
        horaInstalacion: horaInstalacion ?? null,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
      });
      if (soloCobertura) {
        const horaLabel = horaInstalacion ? ` desde las ${horaInstalacion}` : "";
        toast({ title: "Cobertura temporal registrada", description: `${agente.nombre_completo} cubre ${puesto.nombre}${horaLabel}` });
        setModalIncentivo({
          agenteId: agente.id,
          agenteName: agente.nombre_completo,
          puestoId: puesto.id,
          puestoName: puesto.nombre,
          clienteId: puesto.cliente_id,
          clienteNombre: puesto.cliente_nombre ?? null,
          sedeId: puesto.sede_id,
          fecha: fechaActivaStr,
        });
      } else {
        const motLabel = motivoCambio ? ` · ${motivoCambio.replace(/_/g, " ")}` : "";
        const fechaLabel = fechaEfectiva ? ` desde ${fechaEfectiva}` : "";
        toast({ title: "Nuevo titular asignado", description: `${agente.nombre_completo} → ${puesto.nombre}${fechaLabel}${motLabel}` });
        fetch(`${API_BASE}/solicitudes-cambio`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
          body: JSON.stringify({
            employee_id: agente.id,
            puesto_id: puesto.id,
            origen_modulo: "operaciones",
            tipo_cambio: "cambio_titular",
            estado: "pendiente_rrhh",
            motivo: motivoCambio
              ? `${motivoCambio.replace(/_/g, " ")}${fechaEfectiva ? " (efectivo " + fechaEfectiva + ")" : ""}`
              : `Nuevo titular desde pizarrón${fechaEfectiva ? " efectivo " + fechaEfectiva : ""}`,
            datos_antes: puesto.agente_id ? { agente_id: puesto.agente_id, agente: puesto.nombre ?? "" } : null,
            datos_despues: { agente_id: agente.id, agente: agente.nombre_completo, fecha_efectiva: fechaEfectiva ?? "inmediata" },
            creado_por: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          }),
        }).catch(() => {});
      }
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
      }
    }
  }

  // ── Confirmar selección de titular a sustituir (multi-titular) ───────────
  async function confirmarSustituyeTitular(titularSustituidoId: number, motivo: string, horaInstalacion: string) {
    if (!modalSustituyeTitular) return;
    const { puesto, agente } = modalSustituyeTitular;
    setModalSustituyeTitular(null);
    try {
      await apiPost(`${API_BASE}/operaciones/asignar`, {
        puestoId: puesto.id,
        agenteId: agente.id,
        soloCobertura: true,
        titularSustituidoId,
        motivoCambio: motivo,
        horaInstalacion: horaInstalacion || null,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
      });
      toast({ title: "Relevo registrado", description: `${agente.nombre_completo} cubre ${puesto.nombre} desde las ${horaInstalacion}` });
      setModalIncentivo({
        agenteId: agente.id,
        agenteName: agente.nombre_completo,
        puestoId: puesto.id,
        puestoName: puesto.nombre,
        clienteId: puesto.cliente_id,
        clienteNombre: puesto.cliente_nombre ?? null,
        sedeId: puesto.sede_id,
        fecha: fechaActivaStr,
      });
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
      }
    }
  }

  // ── Click en puesto: asignar agente seleccionado ──────────────────────────
  async function handlePuestoClick(puesto: Puesto) {
    if (isCerrado) return;
    // En modo planificación: click en puesto abre el modal de plan futuro
    if (esFuturo) {
      if (agenteSeleccionado) {
        // Asignar como relevo en planificación
        setModalPlanFuturo({ puesto, plan: planFuturoPorPuesto[puesto.id] ?? null });
      } else {
        setModalPlanFuturo({ puesto, plan: planFuturoPorPuesto[puesto.id] ?? null });
      }
      return;
    }
    if (!agenteSeleccionado) {
      // Sin agente: contextualizar el pool para recomendar candidatos de este puesto
      setPuestoContexto(prev => prev?.id === puesto.id ? null : puesto);
      if (poolTab !== "disponibles" && poolTab !== "descansandoCiclo") setPoolTab("disponibles");
      return;
    }
    await iniciarAsignacion(puesto, agenteSeleccionado);
  }

  // ── Confirmar sustitución / asignación ───────────────────────────────────
  async function confirmarSustitucion(motivo: string, notas: string, forzar: boolean, tipoSustitucion: string = "relevo", tipoNovedad?: string, coberturaTipo?: string) {
    if (!modalSustitucion) return;
    const { puesto, agente } = modalSustitucion;

    try {
      if (puesto.agente_id) {
        const resp = await apiPost(`${API_BASE}/operaciones/sustituir`, {
          puestoId: puesto.id,
          agenteEntranteId: agente.id,
          motivo,
          notas,
          forzar,
          tipoSustitucion,
          tipoNovedad: tipoNovedad ?? null,
          coberturaTipo: coberturaTipo ?? "completo",
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
        const labelNov = TIPOS_NOVEDAD.find((t) => t.value === (tipoNovedad ?? ""))?.label ?? tipoNovedad ?? "";
        if (resp?.eventoRrhhGenerado) {
          toast({
            title: `Sustitución registrada · ${labelNov}`,
            description: `Evento RRHH generado. Boleta disponible en Eventos RRHH.`,
          });
        } else {
          toast({ title: `Sustitución registrada · ${labelNov}`, description: `${puesto.agente_nombre} → ${agente.nombre_completo}` });
        }
        if (tipoSustitucion === "relevo") {
          setModalIncentivo({
            agenteId: agente.id,
            agenteName: agente.nombre_completo,
            puestoId: puesto.id,
            puestoName: puesto.nombre,
            clienteId: puesto.cliente_id,
            clienteNombre: puesto.cliente_nombre ?? null,
            sedeId: puesto.sede_id,
            fecha: fechaActivaStr,
          });
        }
      } else {
        await apiPost(`${API_BASE}/operaciones/asignar`, {
          puestoId: puesto.id,
          agenteId: agente.id,
          notas,
          forzar,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
        toast({ title: "Agente asignado", description: `${agente.nombre_completo} → ${puesto.nombre}` });
      }
      setModalSustitucion(null);
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        // Conflicto SSA: no se puede forzar — mostrar aviso claro
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
        setModalSustitucion(null);
        return;
      }
      if (e.advertencia) {
        setModalSustitucion((prev) => prev ? { ...prev, advertencia: e.error } : null);
        return;
      }
      toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
    }
  }

  // ── Confirmar liberación ──────────────────────────────────────────────────
  async function confirmarLiberar(motivo: string, horaFin?: string, generarEventoFalta?: boolean) {
    if (!modalLiberar) return;
    try {
      await apiPost(`${API_BASE}/operaciones/liberar`, {
        puestoId: modalLiberar.id,
        motivo,
        horaFin: horaFin ?? null,
        generarEventoFalta: generarEventoFalta ?? false,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
      });
      const extra = generarEventoFalta ? " · Falta registrada en RRHH" : "";
      toast({ title: "Puesto liberado", description: `${modalLiberar.agente_nombre} removido de ${modalLiberar.nombre}${extra}` });
      setModalLiberar(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.error ?? "Error al liberar", variant: "destructive" });
    }
  }

  // ── Crear puesto ──────────────────────────────────────────────────────────
  async function crearPuesto(data: {
    clienteId: number | null;
    clienteNombre: string;
    nombre: string;
    turno: string;
    notas: string;
    tipoTurnoId: number;
    fechaInicioCiclo: string;
    zonaOperativaId: number;
  }) {
    await apiPost(`${API_BASE}/operaciones/puestos`, data);
    toast({ title: "Puesto creado", description: `${data.nombre} — ${data.clienteNombre}` });
    invalidate();
  }

  // ── Cerrar día ─────────────────────────────────────────────────────────────
  async function cerrarDia(comentario: string) {
    try {
      await apiPost(`${API_BASE}/operaciones/cierre`, {
        confirmacion: `CERRAR ${fechaActivaStr}`,
        comentario,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
      });
      toast({ title: "Día operativo cerrado", description: `Cierre de ${fechaActivaStr} registrado` });
      setModalCierre(false);
      refetchCierre();
    } catch (e: any) {
      toast({ title: "Error al cerrar", description: e.error ?? "Error desconocido", variant: "destructive" });
      throw e;
    }
  }

  // ── Reabrir día ────────────────────────────────────────────────────────────
  async function reabrirDia(motivo: string) {
    const fechaISO = diaHoyCerrado
      ? cierreHoy!.cierreDeHoy!.fecha.substring(0, 10)
      : (cierreHoy?.cierre?.fecha?.substring(0, 10) ?? undefined);
    try {
      await apiPost(`${API_BASE}/operaciones/reabrir`, {
        confirmacion: `REABRIR ${fechaCierreParaReabrir}`,
        motivo,
        fecha: fechaISO,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
      });
      toast({ title: "Día reabierto", description: `El día ${fechaCierreParaReabrir} está activo nuevamente` });
      setModalReabrir(false);
      refetchCierre();
    } catch (e: any) {
      toast({ title: "Error al reabrir", description: e.error ?? "Error desconocido", variant: "destructive" });
      throw e;
    }
  }

  // ── Eliminar puesto ───────────────────────────────────────────────────────
  async function eliminarPuesto(puesto: Puesto) {
    if (!confirm(`¿Eliminar el puesto "${puesto.nombre}" de ${puesto.cliente_nombre}?`)) return;
    try {
      await apiDelete(`${API_BASE}/operaciones/puestos/${puesto.id}`);
      toast({ title: "Puesto eliminado" });
      invalidate();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  }

  // ── Pool filtrado ─────────────────────────────────────────────────────────
  const poolActual: Agente[] = (() => {
    if (!pool) return [];
    let lista = pool[poolTab] ?? [];
    if (busquedaPool.trim()) {
      const q = busquedaPool.toLowerCase();
      lista = lista.filter((a) =>
        a.nombre_completo.toLowerCase().includes(q) ||
        a.puesto?.toLowerCase().includes(q) ||
        a.area?.toLowerCase().includes(q)
      );
    }
    return lista;
  })();

  // ── Ranking de candidatos para el puesto contextualizado ─────────────────
  // Se activa cuando hay puestoContexto (independiente de si tiene zona o no).
  // Combina disponibles + descansandoCiclo en una lista ordenada por prioridad.
  const candidatosRankeados: AgenteRankeado[] = puestoContexto && pool
    ? rankCandidatos(pool, puestoContexto.zona_operativa_id)
    : [];

  // ── Derivar zonas y clientes únicos para filtros ──────────────────────────
  const zonasDisponibles = (() => {
    const mapa: Record<string, string> = {};
    tablero.flatMap((c) => c.puestos).forEach((p) => {
      if (p.zona_operativa_id && p.zona_nombre) {
        mapa[String(p.zona_operativa_id)] = p.zona_nombre;
      }
    });
    return Object.entries(mapa).map(([id, nombre]) => ({ id, nombre }));
  })();

  const clientesDisponiblesFiltro = tablero.map((c) => ({ id: String(c.clienteId), nombre: c.clienteNombre }));

  // ── Tablero filtrado ──────────────────────────────────────────────────────
  const tableroFiltrado: typeof tablero = (() => {
    let result = tablero;
    if (filtroCliente) {
      result = result.filter((c) => String(c.clienteId) === filtroCliente);
    }
    if (filtroZona) {
      result = result
        .map((c) => ({ ...c, puestos: c.puestos.filter((p) => String(p.zona_operativa_id) === filtroZona) }))
        .filter((c) => c.puestos.length > 0);
    }
    if (busquedaPersona.trim()) {
      const q = busquedaPersona.toLowerCase().trim();
      result = result
        .map((c) => ({
          ...c,
          puestos: c.puestos.filter((p) => {
            const campos: (string | null | undefined)[] = [
              p.agente_nombre,
              p.titular_nombre,
              planFuturoPorPuesto[p.id]?.relevo_nombre,
              planFuturoPorPuesto[p.id]?.titular_ausente_nombre,
            ];
            return campos.some((v) => v && v.toLowerCase().includes(q));
          }),
        }))
        .filter((c) => c.puestos.length > 0);
    }
    return result;
  })();

  // ── Stats generales ───────────────────────────────────────────────────────
  const totalPuestos   = tableroFiltrado.flatMap((c) => c.puestos).length;
  const puestosCubiertos = tableroFiltrado.flatMap((c) => c.puestos).filter((p) => p.estado === "cubierto").length;
  const puestosDescubiertos = totalPuestos - puestosCubiertos;
  const coberturaGlobal = totalPuestos > 0 ? Math.round((puestosCubiertos / totalPuestos) * 100) : 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Pizarrón Operativo">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col h-full gap-4" style={{ minHeight: 0 }}>

          {/* ── Barra de acciones ────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Stats */}
            <div className="flex items-center gap-3 bg-[#0c1929] border border-white/8 rounded-xl px-4 py-2">
              <div className="text-center">
                <p className="text-lg font-bold text-white leading-none">{coberturaGlobal}%</p>
                <p className="text-[10px] text-white/30 mt-0.5">Cobertura</p>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div className="text-center">
                <p className="text-lg font-bold text-green-400 leading-none">{puestosCubiertos}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Cubiertos</p>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div className="text-center">
                <p className={`text-lg font-bold leading-none ${puestosDescubiertos > 0 ? "text-red-400 animate-pulse" : "text-white/30"}`}>{puestosDescubiertos}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Descubiertos</p>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div className="text-center">
                <p className="text-lg font-bold text-blue-400 leading-none">{pool?.disponibles?.length ?? 0}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Libres</p>
              </div>
            </div>

            <div className="flex-1" />

            {agenteSeleccionado && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-xl px-3 py-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(agenteSeleccionado.nombre_completo)}`}>
                  {iniciales(agenteSeleccionado.nombre_completo)}
                </div>
                <span className="text-xs text-white/80 font-medium">{agenteSeleccionado.nombre_completo}</span>
                <span className="text-[10px] text-primary/70">seleccionado → toca un puesto</span>
                <button onClick={() => setAgenteSeleccionado(null)} className="text-white/30 hover:text-white ml-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ── Fecha operativa activa ──────────────────────────────── */}
            <div className="flex items-center gap-1.5 text-[11px] text-white/30 bg-[#0c1929] border border-white/8 rounded-xl px-3 py-2">
              <Calendar className="w-3 h-3 text-white/20" />
              <span className="text-white/50 font-mono">{fechaActivaStr}</span>
              {diaHoyCerrado && (
                <span className="text-amber-400/60 font-semibold ml-0.5">↑ siguiente</span>
              )}
            </div>

            {/* ── Cierre operativo ────────────────────────────────────── */}
            {isCerrado ? (
              <>
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300">Día cerrado</span>
                  <span className="text-[10px] text-amber-400/50">•</span>
                  <span className="text-[10px] text-amber-400/60">{fechaActivaStr}</span>
                  {cierreHoy?.cierre?.cerrado_por && (
                    <span className="text-[10px] text-amber-400/40 hidden sm:inline">por {cierreHoy.cierre.cerrado_por}</span>
                  )}
                </div>
                {esAdmin && (
                  <button
                    onClick={() => setModalReabrir(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl px-3 py-2 transition-colors"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Reabrir
                  </button>
                )}
              </>
            ) : diaHoyCerrado ? (
              <>
                <div className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2">
                  <CheckSquare className="w-3.5 h-3.5 text-amber-400/80" />
                  <span className="text-[11px] font-semibold text-amber-300/80">
                    {cierreHoy!.cierreDeHoy!.fecha_str ?? "Ayer"} cerrado
                  </span>
                  {cierreHoy!.cierreDeHoy!.cerrado_por && (
                    <span className="text-[10px] text-amber-400/40 hidden sm:inline">
                      por {cierreHoy!.cierreDeHoy!.cerrado_por}
                    </span>
                  )}
                </div>
                {esAdmin && (
                  <button
                    onClick={() => setModalReabrir(true)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-red-300/70 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 rounded-xl px-2.5 py-2 transition-colors"
                  >
                    <Unlock className="w-3 h-3" /> Reabrir
                  </button>
                )}
                {esSupervisorOAdmin && (
                  <button
                    onClick={() => setModalCierre(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-300/80 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 rounded-xl px-3 py-2 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" /> Cerrar {fechaActivaStr}
                  </button>
                )}
              </>
            ) : (
              <>
                {esSupervisorOAdmin && (
                  <button
                    onClick={() => setModalCierre(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-300/80 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 rounded-xl px-3 py-2 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" /> Cerrar día
                  </button>
                )}
              </>
            )}

            {!isCerrado && (
              <button
                onClick={() => setNuevoPuestoData("nuevo")}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl px-3 py-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo puesto
              </button>
            )}

            <button
              onClick={() => setHistorialAbierto(!historialAbierto)}
              className={`flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border transition-colors
                ${historialAbierto
                  ? "bg-white/8 border-white/15 text-white"
                  : "bg-[#0c1929] border-white/8 text-white/40 hover:text-white"}`}
            >
              <History className="w-3.5 h-3.5" /> Historial
            </button>

            <a
              href="/admin/operaciones/cierres"
              className="flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border bg-[#0c1929] border-white/8 text-white/40 hover:text-white transition-colors"
              title="Ver historial de cierres"
            >
              <FileText className="w-3.5 h-3.5" /> Cierres
            </a>

            <a
              href="/admin/operaciones/zonas"
              className="flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border bg-[#0c1929] border-white/8 text-white/40 hover:text-white transition-colors"
              title="Administrar zonas operativas"
            >
              <MapPin className="w-3.5 h-3.5" /> Zonas
            </a>

            <button
              onClick={() => { refetchTablero(); refetchPool(); refetchCierre(); }}
              className="text-white/30 hover:text-white border border-white/8 rounded-xl px-2.5 py-2 bg-[#0c1929] transition-colors"
              title="Refrescar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Barra de planificación futura ───────────────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navFecha(-1)}
              disabled={fechaVista <= hoyISO}
              className="text-white/30 hover:text-white disabled:opacity-20 border border-white/8 rounded-xl px-2 py-1.5 bg-[#0c1929] transition-colors"
              title="Día anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border text-xs font-medium transition-colors ${esFuturo ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-[#0c1929] border-white/8 text-white/60"}`}>
              <Calendar className="w-3 h-3" />
              <input
                type="date"
                value={fechaVista}
                min={hoyISO}
                onChange={(e) => {
                  if (e.target.value >= hoyISO) {
                    setFechaVista(e.target.value);
                    window.history.replaceState({}, "", window.location.pathname);
                  }
                }}
                className="bg-transparent outline-none cursor-pointer text-inherit font-mono"
              />
              {esFuturo && (
                <span className="text-indigo-400/70 text-[10px] font-semibold ml-1">PLANIFICACIÓN</span>
              )}
            </div>

            <button
              onClick={() => navFecha(1)}
              className="text-white/30 hover:text-white border border-white/8 rounded-xl px-2 py-1.5 bg-[#0c1929] transition-colors"
              title="Día siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {esFuturo && (
              <button
                onClick={volverHoy}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white bg-[#0c1929] border border-white/8 hover:border-white/20 rounded-xl px-3 py-1.5 transition-colors"
              >
                Hoy
              </button>
            )}
          </div>

          {/* ── Filtros de zona y cliente ─────────────────────────────── */}
          {(zonasDisponibles.length > 0 || clientesDisponiblesFiltro.length > 1) && (
            <div className="flex items-center gap-2 flex-wrap">
              {zonasDisponibles.length > 0 && (
                <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-1.5 py-1">
                  <MapPin className="w-3 h-3 text-white/20 ml-1" />
                  <select
                    value={filtroZona}
                    onChange={(e) => setFiltroZona(e.target.value)}
                    className="bg-transparent text-xs text-white/60 outline-none pr-1"
                  >
                    <option value="">Todas las zonas</option>
                    {zonasDisponibles.map((z) => (
                      <option key={z.id} value={z.id}>{z.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {clientesDisponiblesFiltro.length > 1 && (
                <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-1.5 py-1">
                  <Building2 className="w-3 h-3 text-white/20 ml-1" />
                  <select
                    value={filtroCliente}
                    onChange={(e) => setFiltroCliente(e.target.value)}
                    className="bg-transparent text-xs text-white/60 outline-none pr-1"
                  >
                    <option value="">Todos los clientes</option>
                    {clientesDisponiblesFiltro.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {(filtroZona || filtroCliente) && (
                <button
                  onClick={() => { setFiltroZona(""); setFiltroCliente(""); }}
                  className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors px-2 py-1.5 border border-amber-500/20 rounded-xl"
                >
                  <X className="w-3 h-3" /> Limpiar filtros
                </button>
              )}
              {(filtroZona || filtroCliente) && (
                <span className="text-[10px] text-white/20">
                  Mostrando {tableroFiltrado.flatMap((c) => c.puestos).length} puestos
                </span>
              )}

            </div>
          )}

          {/* ── Buscador de colaborador + Colapsar/Expandir todo ─────── */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className={`relative flex items-center transition-all ${busquedaPersona ? "w-72" : "w-52"}`}>
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={busquedaPersona}
                onChange={(e) => setBusquedaPersona(e.target.value)}
                placeholder="Buscar colaborador en el pizarrón…"
                className={`w-full bg-[#0c1929] border rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-all ${
                  busquedaPersona ? "border-primary/40 bg-primary/5" : "border-white/8 focus:border-white/20"
                }`}
              />
              {busquedaPersona && (
                <button
                  onClick={() => setBusquedaPersona("")}
                  className="absolute right-2.5 text-white/30 hover:text-white transition-colors"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {busquedaPersona.trim() && (
              <span className={`text-[11px] font-medium whitespace-nowrap ${tableroFiltrado.length === 0 ? "text-red-400/70" : "text-primary/80"}`}>
                {tableroFiltrado.length === 0
                  ? "Sin resultados"
                  : `${tableroFiltrado.flatMap((c) => c.puestos).length} puesto${tableroFiltrado.flatMap((c) => c.puestos).length !== 1 ? "s" : ""} encontrado${tableroFiltrado.flatMap((c) => c.puestos).length !== 1 ? "s" : ""}`}
              </span>
            )}

            {/* Separador */}
            {tableroFiltrado.length > 0 && (
              <div className="w-px h-5 bg-white/10 mx-1 self-center" />
            )}

            {/* Colapsar / Expandir todo */}
            {tableroFiltrado.length > 0 && (
              <button
                onClick={() => setColGlobal(prev => ({ v: prev.v + 1, val: !colGlobal.val }))}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/80 transition-colors px-2.5 py-1.5 border border-white/8 hover:border-white/20 rounded-xl whitespace-nowrap"
                title={colGlobal.val ? "Expandir todas las columnas" : "Colapsar todas las columnas"}
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${colGlobal.val ? "rotate-0" : "rotate-90"}`} />
                {colGlobal.val ? "Expandir todo" : "Colapsar todo"}
              </button>
            )}
          </div>

          {/* ── Alerta: pool sin disponibles + puestos descubiertos ─────── */}
          {(pool?.disponibles?.length ?? 0) === 0 && puestosDescubiertos > 0 && !isCerrado && (
            <div className="shrink-0 flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <p className="text-xs font-semibold text-red-300">
                Sin agentes disponibles en el pool
              </p>
              <span className="text-[10px] text-red-400/60">·</span>
              <p className="text-xs text-red-400/70">
                Hay {puestosDescubiertos} puesto{puestosDescubiertos !== 1 ? "s" : ""} descubierto{puestosDescubiertos !== 1 ? "s" : ""} y ningún agente libre para asignar. Considera liberar un agente de su puesto actual o verificar el estado de los suspendidos.
              </p>
            </div>
          )}

          {/* ── Alerta: puestos activos sin zona operativa ───────────── */}
          {puestosSinZonaCount > 0 && esSupervisorOAdmin && (
            <div className="shrink-0 flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-300">
                  {puestosSinZonaCount} puesto{puestosSinZonaCount !== 1 ? "s" : ""} sin zona operativa
                </p>
                <p className="text-[10px] text-amber-400/60 mt-0.5">
                  Los nuevos puestos requieren zona. Asigna zona a los puestos existentes desde{" "}
                  <a href="/admin/operaciones/zonas" className="underline hover:text-amber-300 transition-colors">
                    Zonas Operativas
                  </a>{" "}
                  para activar el sistema de recomendación.
                </p>
              </div>
            </div>
          )}

          {/* ── Cuerpo: pool ↑ · tablero · supervisión ↓ ─────────────────── */}
          <div className="flex flex-col flex-1 gap-3 min-h-0">

          {/* ── TOP: Pool de agentes (ancho completo) ────────────────────── */}
          {esFuturo && poolFuturo ? (
            <PoolFuturoPanel
              data={poolFuturo}
              onPlanSSA={(ip) => setModalPlanSSA(ip)}
              onSelectAgente={(ag) =>
                setAgenteSeleccionado(prev => prev?.id === ag.id ? null : ag)
              }
              agenteSeleccionadoId={agenteSeleccionado?.id ?? null}
            />
          ) : esFuturo && loadingPoolFuturo ? (
            <div className="shrink-0 bg-[#060f1a] border border-indigo-500/15 rounded-2xl flex items-center justify-center px-6 py-4 gap-2 text-xs text-indigo-300/50">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando disponibilidad futura…
            </div>
          ) : (
          <div className="shrink-0 bg-[#060f1a] border border-white/8 rounded-2xl overflow-hidden">
            {/* Header pool */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8">
              <button
                onClick={() => togglePanel("piz_col_pool", colPool, setColPool)}
                className="flex items-center gap-2 group shrink-0"
                title={colPool ? "Expandir pool" : "Minimizar pool"}
              >
                <Users className="w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-colors" />
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest group-hover:text-white/80 transition-colors">Pool de agentes</span>
                <ChevronRight className={`w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-all ${colPool ? "" : "rotate-90"}`} />
              </button>
              {colPool && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[10px] text-green-400 font-bold">{pool?.disponibles?.length ?? 0} libres</span>
                  <span className="text-white/15">·</span>
                  <span className="text-[10px] text-orange-400 font-bold">{pool?.trabajando?.length ?? 0} trabajando</span>
                  <span className="text-white/15">·</span>
                  <span className="text-[10px] text-blue-400 font-bold">{pool?.descansandoCiclo?.length ?? 0} descanso</span>
                </div>
              )}
              <div className="flex-1" />

              {!colPool && (<>
              {/* Tabs del pool */}
              {[
                { key: "disponibles"      as const, label: "Disponibles",    count: pool?.disponibles?.length ?? 0,      color: "text-green-400"  },
                { key: "trabajando"       as const, label: "Trabaja hoy",    count: pool?.trabajando?.length ?? 0,       color: "text-orange-400" },
                { key: "descansandoCiclo" as const, label: "Descanso ciclo", count: pool?.descansandoCiclo?.length ?? 0, color: "text-blue-400"   },
                { key: "faltando"         as const, label: "Faltando",       count: pool?.faltando?.length ?? 0,         color: "text-rose-400"   },
                { key: "enDescanso"       as const, label: "Licencia",       count: pool?.enDescanso?.length ?? 0,       color: "text-indigo-400" },
                { key: "enPuesto"         as const, label: "En puesto",      count: pool?.enPuesto?.length ?? 0,         color: "text-teal-400"   },
                { key: "enSSA"            as const, label: "En SSA",         count: pool?.enSSA?.length ?? 0,            color: "text-amber-400"  },
                { key: "suspendidos"      as const, label: "Suspendidos",    count: pool?.suspendidos?.length ?? 0,      color: "text-red-400"    },
                { key: "enVacaciones"     as const, label: "Vacaciones",     count: pool?.enVacaciones?.length ?? 0,     color: "text-violet-400" },
              ].map(({ key, label, count, color }) => (
                <button
                  key={key}
                  onClick={() => setPoolTab(key)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${poolTab === key ? "bg-white/8 text-white" : "text-white/30 hover:text-white/60"}`}
                >
                  {label}
                  <span className={`text-[10px] font-bold ${color}`}>{count}</span>
                </button>
              ))}

              {/* Búsqueda en pool */}
              <div className="relative">
                <input
                  type="text"
                  value={busquedaPool}
                  onChange={(e) => setBusquedaPool(e.target.value)}
                  placeholder="Buscar agente…"
                  className="bg-[#060e1c] border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-primary/40 w-36"
                />
                {busquedaPool && (
                  <button onClick={() => setBusquedaPool("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              </>)}

              <span className="text-xs text-white/20">
                {puestoContexto
                  ? (agenteSeleccionado ? "Selecciona el agente y toca el puesto para asignar" : "Selecciona un candidato recomendado")
                  : (agenteSeleccionado ? "Toca un puesto en el tablero" : "Toca un puesto vacío · o selecciona un agente")}
              </span>
            </div>

            {!colPool && (<>
            {/* Banner contextual: candidatos para un puesto específico */}
            {puestoContexto && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/6 border-b border-primary/15">
                <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                <span className="text-xs text-primary/80 font-semibold truncate">Candidatos para: {puestoContexto.nombre}</span>
                {puestoContexto.zona_nombre && (
                  <span className="text-[10px] text-primary/50 shrink-0">· {puestoContexto.zona_nombre}</span>
                )}
                <button onClick={() => setPuestoContexto(null)} className="ml-auto text-white/25 hover:text-white shrink-0 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Agentes en el pool */}
            {loadingPool ? (
              <div className="flex items-center justify-center min-h-[80px]">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : puestoContexto ? (
              candidatosRankeados.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[80px] gap-1 text-white/20 text-xs px-4 text-center">
                  <span>Sin candidatos disponibles o de descanso de ciclo</span>
                  <span className="text-[10px]">Usa las pestañas para explorar el pool completo</span>
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[260px] overflow-y-auto">
                  {(["P1", "P2", "P3", "P4", "P5"] as GrupoRanking[]).map((grupo) => {
                    const grupo_agentes = candidatosRankeados.filter(a => a.grupo === grupo);
                    if (grupo_agentes.length === 0) return null;
                    const cfg = RANKING_GRUPO_CONFIG[grupo];
                    return (
                      <div key={grupo} className="p-3">
                        <div className={`flex items-center gap-2 mb-2 border-l-2 pl-2 ${cfg.borderColor}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.headerColor}`}>{cfg.label}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 ${cfg.headerColor} opacity-70`}>{grupo_agentes.length}</span>
                          {grupo === "P5" && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300/70 font-bold ml-auto">Solo cobertura temporal</span>
                          )}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {grupo_agentes.map((agente) => (
                            <div key={agente.id} className="shrink-0 w-56">
                              <DraggableAgente
                                agente={agente}
                                isSelected={agenteSeleccionado?.id === agente.id}
                                motivos={agente.motivos}
                                onClick={() => { if (isCerrado) return; setAgenteSeleccionado(agenteSeleccionado?.id === agente.id ? null : agente); }}
                                disabled={isCerrado}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : poolActual.length === 0 ? (
              <div className="flex items-center justify-center min-h-[80px] text-white/20 text-xs px-4 text-center">
                {poolTab === "disponibles"      ? "No hay agentes genuinamente disponibles hoy" :
                 poolTab === "trabajando"       ? "Ningún agente en turno de trabajo hoy" :
                 poolTab === "descansandoCiclo" ? "Ningún agente en descanso de ciclo hoy" :
                 poolTab === "faltando"         ? "No hay ausencias registradas hoy" :
                 poolTab === "enDescanso"       ? "No hay agentes en licencia" :
                 poolTab === "enPuesto"         ? "Ningún agente está en puesto activo" :
                 poolTab === "enSSA"            ? "Ningún agente cubre un SSA activo" :
                 poolTab === "enVacaciones"     ? "Ningún agente en vacaciones hoy" :
                 "No hay agentes suspendidos"}
              </div>
            ) : poolTab === "trabajando" ? (() => {
              const vacTrab = poolActual.filter(a => a.vacacion_trabajada);
              const normales = poolActual.filter(a => !a.vacacion_trabajada);
              return (
                <div className="flex flex-col divide-y divide-white/5">
                  {normales.length > 0 && (
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {normales.map((agente) => (
                        <div key={agente.id} className="shrink-0 w-52">
                          <DraggableAgente agente={agente} isSelected={agenteSeleccionado?.id === agente.id} onClick={() => {}} disabled={true} />
                        </div>
                      ))}
                    </div>
                  )}
                  {vacTrab.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2 border-l-2 border-orange-500/40 pl-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/70">Vacaciones Trabajadas</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-300/60">{vacTrab.length}</span>
                        <span className="text-[8px] text-orange-300/40 ml-auto">Días de vacaciones trabajados</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {vacTrab.map((agente) => (
                          <div key={agente.id} className="shrink-0 w-52">
                            <DraggableAgente agente={agente} isSelected={agenteSeleccionado?.id === agente.id} onClick={() => {}} disabled={true} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="flex gap-2 p-3 overflow-x-auto min-h-[80px]">
                {poolActual.map((agente) => (
                  <div key={agente.id} className="shrink-0 w-52">
                    <DraggableAgente
                      agente={agente}
                      isSelected={agenteSeleccionado?.id === agente.id}
                      onClick={() => {
                        if (isCerrado) return;
                        setAgenteSeleccionado(agenteSeleccionado?.id === agente.id ? null : agente);
                      }}
                      disabled={poolTab === "enPuesto" || poolTab === "enSSA" || poolTab === "faltando" || poolTab === "enVacaciones" || isCerrado}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Leyenda */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/20">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-green-400" /> Cubierto</span>
              <span className="flex items-center gap-1"><Circle className="w-2.5 h-2.5 text-red-400" /> Descubierto</span>
              <span className="flex items-center gap-1"><GripVertical className="w-2.5 h-2.5" /> Arrastrar agente al puesto</span>
              <span className="flex items-center gap-1"><XCircle className="w-2.5 h-2.5" /> Hover sobre puesto para remover</span>
              <div className="flex-1" />
              <span>Se refresca cada 30 seg automáticamente</span>
            </div>
            </>)}
          </div>
          )}

          {/* ── CENTER: Tablero de puestos ─────────────────────────────── */}
          <div className="flex-1 overflow-auto relative" style={{ minHeight: 0 }}>
            {/* Read-only overlay when active date is closed */}
            {isCerrado && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute inset-0 bg-[#04090f]/60 backdrop-blur-[1px] rounded-xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-3 bg-[#07111f] border border-amber-500/30 rounded-2xl px-6 py-4 shadow-2xl shadow-amber-500/10">
                    <Lock className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-bold text-amber-300">Día operativo cerrado</p>
                      <p className="text-xs text-amber-400/60 mt-0.5">Modo solo lectura · {fechaActivaStr}</p>
                    </div>
                    {esAdmin && (
                      <button
                        onClick={() => setModalReabrir(true)}
                        className="pointer-events-auto flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-xl px-3 py-1.5 ml-2 transition-colors"
                      >
                        <Unlock className="w-3 h-3" /> Reabrir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {loadingTablero ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-sm text-white/40">Cargando pizarrón…</span>
              </div>
            ) : tablero.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Shield className="w-12 h-12 text-white/10" />
                <p className="text-white/30 text-sm">No hay puestos operativos configurados</p>
                <button
                  onClick={() => setNuevoPuestoData("nuevo")}
                  className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors border border-primary/20 rounded-xl px-4 py-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Crear primer puesto
                </button>
              </div>
            ) : tableroFiltrado.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <MapPin className="w-12 h-12 text-white/10" />
                <p className="text-white/30 text-sm">Ningún puesto coincide con los filtros aplicados</p>
                <button
                  onClick={() => { setFiltroZona(""); setFiltroCliente(""); }}
                  className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="flex gap-3 h-full pb-2">
                {tableroFiltrado.map((cliente) => (
                  <ClienteColumna
                    key={cliente.clienteNombre}
                    cliente={cliente}
                    agenteSeleccionadoId={agenteSeleccionado?.id ?? null}
                    onPuestoClick={handlePuestoClick}
                    onLiberar={(p) => esFuturo
                      ? setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
                      : setModalLiberar(p)}
                    onNuevoPuesto={(c) => setNuevoPuestoData(c)}
                    onEliminarPuesto={eliminarPuesto}
                    onAbrirSegmentos={(p) => { if (!esFuturo) setModalSegmentos(p); }}
                    onConfigTurno={(p) => esFuturo
                      ? setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
                      : setPuestoParaTurno(p)}
                    cambiosFuturosProximos={!esFuturo ? cambiosFuturosProximos : undefined}
                    planFuturoPorPuesto={esFuturo ? planFuturoPorPuesto : undefined}
                    resaltado={clienteResaltado !== null && cliente.clienteId === clienteResaltado}
                    colGlobal={colGlobal}
                    puestoContextoId={puestoContexto?.id ?? null}
                  />
                ))}
              </div>
            )}
          </div>
          {/* ── BOTTOM: Supervisión (vertical compacta) ─────────────────── */}
          <div className="shrink-0 flex flex-col gap-1.5 pb-1">

          {/* ── Panel de supervisores operativos con turno (solo en vista de hoy) */}
          {!esFuturo && (pool?.supervisores?.length ?? 0) > 0 && (() => {
            const svTrabajando  = pool!.supervisores.filter(sv => sv.estado_ciclo === "trabajando");
            const svDisponHE    = pool!.supervisores.filter(sv => sv.estado_ciclo === "disponible_he");
            const svDescanso    = pool!.supervisores.filter(sv => sv.estado_ciclo === "descansando_ciclo");
            const svOtros       = pool!.supervisores.filter(sv => !["trabajando","disponible_he","descansando_ciclo"].includes(sv.estado_ciclo ?? ""));
            const puedeCubrirCount = pool!.supervisores.filter(sv => sv.puede_cubrir).length;

            const SvCard = ({ sv }: { sv: SupervisorPool }) => {
              const estadoCiclo = sv.estado_ciclo;
              const estadoBadge = estadoCiclo === "trabajando"
                ? { cls: "text-emerald-300/90 bg-emerald-500/15 border-emerald-500/30", label: "EN TURNO" }
                : estadoCiclo === "disponible_he"
                  ? { cls: "text-amber-300/80 bg-amber-500/12 border-amber-500/25", label: "DISP. HE" }
                  : estadoCiclo === "descansando_ciclo"
                    ? { cls: "text-white/25 bg-white/3 border-white/8", label: "DESCANSO" }
                    : estadoCiclo === "licencia"
                      ? { cls: "text-indigo-300/70 bg-indigo-500/10 border-indigo-500/20", label: "LICENCIA" }
                      : estadoCiclo === "suspendido"
                        ? { cls: "text-red-300/70 bg-red-500/10 border-red-500/20", label: "SUSP." }
                        : { cls: "text-white/20 bg-white/3 border-white/6", label: "SIN TURNO" };

              const esSeleccionado = agenteSeleccionado?.id === sv.id;
              const estaEnDescansoPool = pool!.descansandoCiclo.some(a => a.id === sv.id);
              const seleccionable = estaEnDescansoPool && !isCerrado;

              const handleClick = seleccionable ? () => {
                const agente = pool!.descansandoCiclo.find(a => a.id === sv.id);
                if (agente) setAgenteSeleccionado(prev => prev?.id === agente.id ? null : agente);
              } : undefined;

              return (
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all select-none ${esSeleccionado ? "border-violet-400/60 bg-violet-500/15 ring-1 ring-violet-400/30" : seleccionable ? "border-violet-500/20 bg-violet-500/5 cursor-pointer hover:border-violet-400/40 hover:bg-violet-500/10" : "border-white/5 bg-transparent"}`}
                  onClick={handleClick}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(sv.nombre_completo)} ${esSeleccionado ? "ring-2 ring-violet-400/50" : sv.puede_cubrir ? "ring-1 ring-violet-400/20" : ""}`}>
                    {iniciales(sv.nombre_completo)}
                  </div>
                  <p className={`text-[11px] font-medium truncate max-w-[88px] ${sv.puede_cubrir || estadoCiclo === "trabajando" ? "text-white/80" : "text-white/35"}`}>{sv.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${estadoBadge.cls}`}>{estadoBadge.label}</span>
                  {esSeleccionado && <span className="text-[8px] text-violet-300 animate-pulse shrink-0">✓</span>}
                  {(sv as any).vehiculos_zona?.length > 0 && ((sv as any).vehiculos_zona as Array<{ id: number; placa: string; estado: string }>).filter(v => v.estado === "activo").slice(0,1).map(veh => (
                    <button key={veh.id} onClick={e => { e.stopPropagation(); setFichaVehiculoId(veh.id); }} className="text-[8px] text-sky-300/60 border border-sky-500/20 bg-sky-500/8 px-1 py-0.5 rounded shrink-0">🚗</button>
                  ))}
                </div>
              );
            };

            return (
              <div className="bg-[#060f1a] border border-violet-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_supers", colSupers, setColSupers)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-violet-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-violet-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-violet-300/65 uppercase tracking-widest">Supervisores</span>
                  <span className="text-[9px] text-violet-400/45 font-bold bg-violet-500/10 border border-violet-500/15 px-1 py-0.5 rounded-full">{pool!.supervisores.length}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 text-[10px]">
                    {svTrabajando.length > 0 && <span className="text-emerald-400/80 font-semibold">🟢 {svTrabajando.length} turno</span>}
                    {(svDescanso.length + svDisponHE.length) > 0 && <span className="text-blue-400/60">🔵 {svDescanso.length + svDisponHE.length} descanso</span>}
                    {puedeCubrirCount > 0 && <span className="text-violet-300/90 font-bold bg-violet-500/12 border border-violet-500/20 px-1.5 py-0.5 rounded-full">⚡ {puedeCubrirCount} apto</span>}
                  </div>
                  <ChevronRight className={`w-3 h-3 text-violet-400/25 group-hover:text-violet-400/50 ml-2 shrink-0 transition-transform ${colSupers ? "" : "rotate-90"}`} />
                </button>
                {!colSupers && (
                <div className="border-t border-violet-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...svTrabajando, ...svDisponHE, ...svDescanso, ...svOtros].map(sv => (
                    <SvCard key={sv.id} sv={sv} />
                  ))}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Jefe de Servicio del Día — panel operativo 24×24 ─────────── */}
          {!esFuturo && (pool?.jefes_servicio?.length ?? 0) > 0 && (() => {
            const jefesHoy     = pool!.jefes_servicio.filter(js => js.trabaja_hoy === true);
            const jefesMañana  = pool!.jefes_servicio.filter(js => js.trabaja_mañana === true && js.trabaja_hoy !== true);
            const jefesDescanso = pool!.jefes_servicio.filter(js => js.trabaja_hoy === false && js.estado_ciclo === "descansando_ciclo");
            const jefesOtros   = pool!.jefes_servicio.filter(js => js.trabaja_hoy === null || js.estado_ciclo === "sin_turno");

            const JefeCard = ({ js, variante }: { js: JefeServicioPool; variante: "hoy" | "mañana" | "descanso" | "otro" }) => {
              const esSeleccionado = agenteSeleccionado?.id === js.id;
              const seleccionable = variante === "descanso" && !isCerrado;
              const badgeCls = variante === "hoy"
                ? "text-orange-200/90 bg-orange-500/20 border-orange-400/35"
                : variante === "mañana"
                  ? "text-amber-300/70 bg-amber-500/10 border-amber-500/20"
                  : "text-white/25 bg-white/3 border-white/8";
              const badgeLabel = variante === "hoy" ? "EN TURNO" : variante === "mañana" ? "MAÑANA" : variante === "descanso" ? "DESCANSO" : "SIN TURNO";

              const handleClick = seleccionable ? () => {
                const agente = pool!.descansandoCiclo.find(a => a.id === js.id);
                if (agente) setAgenteSeleccionado(prev => prev?.id === agente.id ? null : agente);
              } : undefined;

              return (
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all select-none ${esSeleccionado ? "border-orange-400/60 bg-orange-500/15 ring-1 ring-orange-400/30" : seleccionable ? "border-orange-500/20 bg-orange-500/5 cursor-pointer hover:border-orange-400/40" : variante === "hoy" ? "border-orange-500/25 bg-orange-500/6" : "border-white/5 bg-transparent"}`}
                  onClick={handleClick}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(js.nombre_completo)} ${variante === "hoy" ? "ring-1 ring-orange-400/35" : ""} ${esSeleccionado ? "ring-2 ring-orange-400/50" : ""}`}>
                    {iniciales(js.nombre_completo)}
                  </div>
                  <p className={`text-[11px] font-medium truncate max-w-[88px] ${variante === "hoy" ? "text-white/90" : "text-white/40"}`}>{js.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}>{badgeLabel}</span>
                  {esSeleccionado && <span className="text-[8px] text-orange-300 animate-pulse shrink-0">✓</span>}
                </div>
              );
            };

            return (
              <div className="bg-[#060f1a] border border-orange-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_jefes", colJefes, setColJefes)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-orange-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-orange-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-orange-300/65 uppercase tracking-widest">Jefes de Servicio</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 text-[10px]">
                    {jefesHoy.length > 0 && (
                      <span className="text-emerald-400/80 font-semibold">🟢 {jefesHoy.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>
                    )}
                    {jefesDescanso.length > 0 && (
                      <span className="text-blue-400/60">🔵 {jefesDescanso.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>
                    )}
                    {jefesHoy.length === 0 && jefesDescanso.length === 0 && (
                      <span className="text-white/20">Sin turno activo</span>
                    )}
                  </div>
                  <ChevronRight className={`w-3 h-3 text-orange-400/25 group-hover:text-orange-400/50 ml-2 shrink-0 transition-transform ${colJefes ? "" : "rotate-90"}`} />
                </button>
                {!colJefes && (
                <div className="border-t border-orange-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...jefesHoy.map(js => ({ js, variante: "hoy" as const })), ...jefesMañana.map(js => ({ js, variante: "mañana" as const })), ...jefesDescanso.map(js => ({ js, variante: "descanso" as const })), ...jefesOtros.map(js => ({ js, variante: "otro" as const }))].map(({ js, variante }) => (
                    <JefeCard key={js.id} js={js} variante={variante} />
                  ))}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Supervisores — vista futura ─────────────────────────── */}
          {esFuturo && poolFuturo && (() => {
            const svTurno    = poolFuturo.trabajando.filter(a => a.tipo_personal === "supervisor");
            const svDescanso = poolFuturo.descansando.filter(a => a.tipo_personal === "supervisor");
            if (svTurno.length + svDescanso.length === 0) return null;
            return (
              <div className="bg-[#060f1a] border border-violet-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_supers", colSupers, setColSupers)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-violet-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-violet-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-violet-300/65 uppercase tracking-widest">Supervisores</span>
                  <span className="text-[9px] text-violet-400/45 font-bold bg-violet-500/10 border border-violet-500/15 px-1 py-0.5 rounded-full">{svTurno.length + svDescanso.length}</span>
                  <div className="flex-1" />
                  {svTurno.length > 0 && <span className="text-emerald-400/80 text-[10px] font-semibold">🟢 {svTurno.length} turno</span>}
                  {svDescanso.length > 0 && <span className="text-blue-400/60 text-[10px]">🔵 {svDescanso.length} descanso</span>}
                  <ChevronRight className={`w-3 h-3 text-violet-400/25 group-hover:text-violet-400/50 ml-2 shrink-0 transition-transform ${colSupers ? "" : "rotate-90"}`} />
                </button>
                {!colSupers && (
                <div className="border-t border-violet-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...svTurno, ...svDescanso].map(ag => {
                    const enTurno = svTurno.some(s => s.id === ag.id);
                    return (
                      <div key={ag.id} className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${enTurno ? "border-violet-500/25 bg-violet-500/6" : "border-white/5"}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${enTurno ? "" : "opacity-50"} ${avatarColor(ag.nombre_completo)}`}>
                          {iniciales(ag.nombre_completo)}
                        </div>
                        <p className={`text-[11px] font-medium truncate max-w-[88px] ${enTurno ? "text-white/85" : "text-white/40"}`}>{ag.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${enTurno ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" : "text-white/25 bg-white/3 border-white/8"}`}>{enTurno ? "EN TURNO" : "DESCANSO"}</span>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Jefes de Servicio — vista futura ────────────────────── */}
          {esFuturo && poolFuturo && (() => {
            const jfTurno    = poolFuturo.trabajando.filter(a => a.tipo_personal === "jefe_servicio");
            const jfDescanso = poolFuturo.descansando.filter(a => a.tipo_personal === "jefe_servicio");
            if (jfTurno.length + jfDescanso.length === 0) return null;
            return (
              <div className="bg-[#060f1a] border border-orange-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_jefes", colJefes, setColJefes)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-orange-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-orange-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-orange-300/65 uppercase tracking-widest">Jefes de Servicio</span>
                  <span className="text-[9px] text-orange-400/45 font-bold bg-orange-500/10 border border-orange-500/15 px-1 py-0.5 rounded-full">{jfTurno.length + jfDescanso.length}</span>
                  <div className="flex-1" />
                  {jfTurno.length > 0 && <span className="text-emerald-400/80 text-[10px] font-semibold">🟢 {jfTurno.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>}
                  {jfDescanso.length > 0 && <span className="text-blue-400/60 text-[10px]">🔵 {jfDescanso.length} descanso</span>}
                  <ChevronRight className={`w-3 h-3 text-orange-400/25 group-hover:text-orange-400/50 ml-2 shrink-0 transition-transform ${colJefes ? "" : "rotate-90"}`} />
                </button>
                {!colJefes && (
                <div className="border-t border-orange-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...jfTurno, ...jfDescanso].map(ag => {
                    const enTurno = jfTurno.some(j => j.id === ag.id);
                    return (
                      <div key={ag.id} className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${enTurno ? "border-orange-500/25 bg-orange-500/6" : "border-white/5"}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${enTurno ? "ring-1 ring-orange-400/30" : "opacity-50"} ${avatarColor(ag.nombre_completo)}`}>
                          {iniciales(ag.nombre_completo)}
                        </div>
                        <p className={`text-[11px] font-medium truncate max-w-[88px] ${enTurno ? "text-white/90" : "text-white/40"}`}>{ag.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${enTurno ? "text-orange-200 bg-orange-500/20 border-orange-400/35" : "text-white/25 bg-white/3 border-white/8"}`}>{enTurno ? "EN TURNO" : "DESCANSO"}</span>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Panel Administración / Backoffice ─────────────────────── */}
          {adminTablero && adminTablero.empleados.length > 0 && (() => {
            const GRUPOS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
              gerencia:             { label: "Gerencia",  color: "text-amber-300/80",  bg: "bg-amber-500/10",  border: "border-amber-500/25" },
              administrativo_rrhh:  { label: "RRHH",     color: "text-sky-300/80",    bg: "bg-sky-500/10",    border: "border-sky-500/25" },
              administrativo_bodega:{ label: "Bodega",   color: "text-teal-300/80",   bg: "bg-teal-500/10",   border: "border-teal-500/25" },
            };
            const totalTrabajando = adminTablero.empleados.filter(e => e.estado_ciclo === "trabajando").length;
            const totalDesc       = adminTablero.empleados.filter(e => e.estado_ciclo === "descansando_ciclo").length;
            const totalAusente    = adminTablero.empleados.filter(e => ["licencia","suspendido"].includes(e.estado_ciclo)).length;
            const totalSinTurno   = adminTablero.empleados.filter(e => e.estado_ciclo === "sin_turno").length;

            const AdminChip = ({ p, grupoKey }: { p: AdminPersonal; grupoKey: string }) => {
              const trabajando  = p.estado_ciclo === "trabajando";
              const descansando = p.estado_ciclo === "descansando_ciclo";
              const ausente     = ["licencia","suspendido"].includes(p.estado_ciclo);
              const badgeTxt    = trabajando ? "HOY" : descansando ? "DESCANSO" : ausente ? "AUSENTE" : "S/T";
              const badgeCls    = trabajando
                ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                : descansando
                ? "text-white/30 bg-white/4 border-white/8"
                : ausente
                ? "text-yellow-300/70 bg-yellow-500/10 border-yellow-500/20"
                : "text-white/20 bg-white/3 border-white/6";
              const cardBorder  = trabajando ? "border-emerald-500/20" : descansando ? "border-white/5" : ausente ? "border-yellow-500/10" : "border-white/5";
              const meta        = GRUPOS_LABELS[grupoKey] ?? GRUPOS_LABELS["gerencia"];
              return (
                <div className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${cardBorder}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${trabajando ? "" : "opacity-50"} ${avatarColor(p.nombre_completo)}`}>
                    {iniciales(p.nombre_completo)}
                  </div>
                  <p className={`text-[11px] font-medium truncate max-w-[80px] ${trabajando ? "text-white/85" : "text-white/40"}`}>{p.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${meta.color} ${meta.bg} ${meta.border}`}>{meta.label}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}>{badgeTxt}</span>
                </div>
              );
            };

            return (
              <div className="bg-[#060f1a] border border-slate-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_admin", colAdmin, setColAdmin)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-slate-500/5 transition-colors"
                >
                  <Building2 className="w-3 h-3 text-slate-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-300/65 uppercase tracking-widest">Administración</span>
                  <span className="text-[9px] text-slate-400/45 font-bold bg-slate-500/10 border border-slate-500/15 px-1 py-0.5 rounded-full">{adminTablero.empleados.length}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 text-[10px]">
                    {totalTrabajando > 0 && <span className="text-emerald-400/80 font-semibold">🟢 {totalTrabajando} trabajan</span>}
                    {totalDesc > 0 && <span className="text-blue-400/60">🔵 {totalDesc} descanso</span>}
                    {totalAusente > 0 && <span className="text-yellow-300/60">⚠ {totalAusente} ausentes</span>}
                  </div>
                  <ChevronRight className={`w-3 h-3 text-slate-400/25 group-hover:text-slate-400/50 ml-2 shrink-0 transition-transform ${colAdmin ? "" : "rotate-90"}`} />
                </button>

                {!colAdmin && (
                  <div className="border-t border-slate-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {(["gerencia","administrativo_rrhh","administrativo_bodega"] as const).flatMap(key =>
                      adminTablero.grupos[key].map(p => (
                        <AdminChip key={p.id} p={p} grupoKey={key} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Panel SSA: Servicios Especiales — todas las etapas activas ─ */}
          {tarjetasSSA.length > 0 && (
            <div className="bg-[#06101c] border border-white/8 rounded-xl overflow-hidden">
              {/* Cabecera del panel */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6">
                <button
                  onClick={() => togglePanel("piz_col_ssa", colSSA, setColSSA)}
                  className="flex items-center gap-2 flex-1 text-left group"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-white/70">Servicios Especiales Activos</span>
                  <span className="text-[10px] text-white/25 bg-white/6 px-2 py-0.5 rounded-full">{tarjetasSSA.length}</span>
                  {colSSA && <span className="text-[10px] text-white/20 ml-1">— minimizado</span>}
                  <ChevronRight className={`w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-all ml-auto shrink-0 ${colSSA ? "" : "rotate-90"}`} />
                </button>
                <a
                  href="/admin/tablero-servicios"
                  className="text-[10px] text-primary/60 hover:text-primary transition-colors flex items-center gap-1 shrink-0"
                >
                  Ver completo <ChevronRight className="w-3 h-3" />
                </a>
              </div>
              {!colSSA && (
              <>
              {/* Tabs de etapas */}
              <div className="flex border-b border-white/6">
                <button
                  onClick={() => setSsaTabActivo("sin_asignar")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                    ssaTabActivo === "sin_asignar"
                      ? "border-amber-400 text-amber-300 bg-amber-500/5"
                      : "border-transparent text-white/30 hover:text-white/60"
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  Sin asignar
                  {ssaSinAgente.length > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      ssaTabActivo === "sin_asignar" ? "bg-amber-400/20 text-amber-300" : "bg-white/8 text-white/30"
                    }`}>{ssaSinAgente.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setSsaTabActivo("cubierta")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                    ssaTabActivo === "cubierta"
                      ? "border-green-400 text-green-300 bg-green-500/5"
                      : "border-transparent text-white/30 hover:text-white/60"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Cubierta / Pre-Planilla
                  {ssaCubierta.length > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      ssaTabActivo === "cubierta" ? "bg-green-400/20 text-green-300" : "bg-white/8 text-white/30"
                    }`}>{ssaCubierta.length}</span>
                  )}
                </button>
              </div>
              {/* Contenido del tab activo */}
              <div className="flex flex-col gap-2 px-3 py-3 max-h-64 overflow-y-auto">
                {ssaTabActivo === "sin_asignar" && (
                  ssaSinAgente.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-white/25 py-1">
                      <CheckCircle2 className="w-4 h-4 text-green-400/50" />
                      Todos los servicios tienen guardia asignado
                    </div>
                  ) : (
                    ssaSinAgente.map((t) => <TarjetaSSACard key={t.id} t={t} onAsignar={() => setModalAsignarSSA(t)} />)
                  )
                )}
                {ssaTabActivo === "cubierta" && (
                  ssaCubierta.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-white/25 py-1">
                      <Info className="w-4 h-4 text-white/20" />
                      No hay servicios cubiertos activos
                    </div>
                  ) : (
                    ssaCubierta.map((t) => (
                      <TarjetaSSACard
                        key={t.id}
                        t={t}
                        onAsignar={() => setModalAsignarSSA(t)}
                        onRemover={isCerrado ? undefined : (motivo, notas) => removerAgenteSSA(t, motivo, notas)}
                      />
                    ))
                  )
                )}
              </div>
              </> )}
            </div>
          )}

          {/* ── Próximos Arranques de Proyecto ────────────────────────────── */}
          {(proximosArranques?.total ?? 0) > 0 && !esFuturo && (
            <div className="bg-amber-500/4 border border-amber-500/20 rounded-xl overflow-hidden">
              <button
                onClick={() => togglePanel("piz_col_arr", colArranques, setColArranques)}
                className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/15 text-left group hover:bg-amber-500/4 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-300/80 uppercase tracking-widest">Próximos arranques</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 border border-amber-500/25 text-amber-300">
                  {proximosArranques!.total} en 60 días
                </span>
                {colArranques && <span className="text-[10px] text-amber-400/30 ml-1">— minimizado</span>}
                <ChevronRight className={`w-3.5 h-3.5 text-amber-400/30 group-hover:text-amber-400/60 ml-auto shrink-0 transition-transform ${colArranques ? "" : "rotate-90"}`} />
              </button>
              {!colArranques && (
              <div>
              <div className="p-3 flex flex-col gap-1.5">
                {proximosArranques!.arranques.map((ip) => {
                  const diasRestantes = ip.dias_para_inicio ?? 99;
                  const fechaInicio   = ip.fecha_inicio_contrato?.slice(0, 10) ?? "";
                  const esSSA         = ip.tipo === "ssa";
                  const itemKey       = esSSA ? `ssa_${ip.ssa_id}` : `cli_${ip.cliente_id}`;
                  const colorChip     = diasRestantes <= 7
                    ? "bg-red-500/15 text-red-300 border border-red-500/20"
                    : diasRestantes <= 14
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                    : "bg-white/5 text-white/40 border border-white/10";
                  const iconBg        = esSSA
                    ? "bg-blue-500/15 border-blue-500/25 group-hover:border-blue-400/50 group-hover:bg-blue-500/25"
                    : "bg-amber-500/15 border-amber-500/25 group-hover:border-amber-400/50 group-hover:bg-amber-500/25";
                  const hoverBg       = esSSA ? "hover:bg-blue-500/10" : "hover:bg-amber-500/10";
                  const nombreColor   = esSSA ? "text-blue-200 group-hover:text-blue-100" : "text-amber-200 group-hover:text-amber-100";
                  const puestosLabel  = esSSA ? "guardias" : "puestos";
                  return (
                    <button
                      key={itemKey}
                      onClick={() => irAFecha(fechaInicio, esSSA ? undefined : ip.cliente_id)}
                      title={esSSA ? `SSA — ${TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? ip.tipo_solicitud} — ${fechaInicio}` : `Arranque nuevo — ${fechaInicio}`}
                      className={`group flex items-center gap-2 text-[11px] w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 ${hoverBg} transition-colors cursor-pointer`}
                    >
                      <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${iconBg}`}>
                        {esSSA
                          ? <Shield className="w-3 h-3 text-blue-400" />
                          : <Building2 className="w-3 h-3 text-amber-400" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`font-medium truncate block transition-colors ${nombreColor}`}>
                          {ip.cliente_nombre_comercial || ip.cliente_nombre}
                        </span>
                        <span className="text-white/25 text-[9px] group-hover:text-white/40 transition-colors">
                          {esSSA
                            ? (TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? ip.tipo_solicitud ?? "SSA")
                            : (fechaInicio ? fechaInicio.split("-").reverse().join("/") : "")
                          }
                          {esSSA && ip.hora_inicio ? ` · ${ip.hora_inicio}–${ip.hora_fin ?? ""}` : ""}
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="text-white/30 text-[10px]">{ip.total_puestos} {puestosLabel}</span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded text-[9px] ${colorChip}`}>
                          {diasRestantes === 0 ? "Hoy" : `${diasRestantes}d`}
                        </span>
                        <ExternalLink className={`w-3 h-3 ${esSSA ? "text-blue-400/0 group-hover:text-blue-400/60" : "text-amber-400/0 group-hover:text-amber-400/60"} transition-colors`} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 pb-3 text-[9px] text-white/20 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 text-amber-400/50" />
                <span>Arranque nuevo</span>
                <span className="mx-1">·</span>
                <Shield className="w-2.5 h-2.5 text-blue-400/50" />
                <span>Servicio adicional (SSA)</span>
              </div>
              </div>
              )}
            </div>
          )}

          </div>{/* ── fin supervisión abajo ── */}
          </div>{/* ── fin cuerpo vertical ── */}

        </div>

        {/* DragOverlay — miniatura flotante del agente arrastrado */}
        <DragOverlay>
          {draggingAgente && (
            <div className="bg-[#07111f] border border-primary/40 rounded-xl px-3 py-2 shadow-2xl shadow-primary/20 flex items-center gap-2 opacity-95 rotate-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(draggingAgente.nombre_completo)}`}>
                {iniciales(draggingAgente.nombre_completo)}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{draggingAgente.nombre_completo}</p>
                <p className="text-[10px] text-white/40">{draggingAgente.puesto ?? "Agente"}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      {historialAbierto && (
        <PanelHistorial
          movimientos={historial}
          isLoading={loadingHistorial}
          onClose={() => setHistorialAbierto(false)}
        />
      )}

      {modalSustituyeTitular && (
        <ModalSustituyeTitular
          puesto={modalSustituyeTitular.puesto}
          agente={modalSustituyeTitular.agente}
          onConfirm={confirmarSustituyeTitular}
          onCancel={() => setModalSustituyeTitular(null)}
        />
      )}

      {modalEligeCobertura && (
        <ModalEligeCobertura
          puesto={modalEligeCobertura.puesto}
          agente={modalEligeCobertura.agente}
          onElegir={confirmarEligeCobertura}
          onCancel={() => setModalEligeCobertura(null)}
        />
      )}

      {modalSustitucion && (
        <ModalSustitucion
          puesto={modalSustitucion.puesto}
          agenteEntrante={modalSustitucion.agente}
          advertencia={modalSustitucion.advertencia}
          onConfirm={confirmarSustitucion}
          onCancel={() => setModalSustitucion(null)}
        />
      )}

      {modalLiberar && (
        <ModalLiberar
          puesto={modalLiberar}
          onConfirm={confirmarLiberar}
          onClose={() => setModalLiberar(null)}
        />
      )}

      {nuevoPuestoData && (
        <ModalNuevoPuesto
          clientePreseleccionado={typeof nuevoPuestoData === "object" ? nuevoPuestoData : undefined}
          clientes={clientesDisponibles}
          onSave={crearPuesto}
          onClose={() => setNuevoPuestoData(null)}
        />
      )}

      {modalCierre && cierreHoy && (
        <ModalCierre
          resumen={cierreHoy.resumen}
          advertencias={cierreHoy.advertencias}
          fechaActivaStr={fechaActivaStr}
          onConfirm={cerrarDia}
          onClose={() => setModalCierre(false)}
        />
      )}

      {modalReabrir && (
        <ModalReabrir
          cierre={diaHoyCerrado ? (cierreHoy?.cierreDeHoy ?? null) : (cierreHoy?.cierre ?? null)}
          fechaParaReabrir={fechaCierreParaReabrir}
          onConfirm={reabrirDia}
          onClose={() => setModalReabrir(false)}
        />
      )}

      {fichaVehiculoId && (
        <ModalFichaVehiculo
          vehiculoId={fichaVehiculoId}
          onClose={() => setFichaVehiculoId(null)}
        />
      )}

      {modalSegmentos && cierreHoy && (
        <ModalSegmentos
          puesto={modalSegmentos}
          fecha={cierreHoy.fechaActiva}
          onClose={() => setModalSegmentos(null)}
        />
      )}

      {modalAsignarSSA && (
        <ModalAsignarSSA
          tarjeta={modalAsignarSSA}
          disponibles={pool?.disponibles ?? []}
          onClose={() => setModalAsignarSSA(null)}
          onSuccess={() => {
            setModalAsignarSSA(null);
            qc.invalidateQueries({ queryKey: ["ssa-tablero-pizarron"] });
          }}
        />
      )}

      {modalPlanFuturo && (
        <ModalPlanFuturo
          puesto={modalPlanFuturo.puesto}
          fecha={fechaVista}
          planExistente={modalPlanFuturo.plan}
          onGuardar={guardarPlanFuturo}
          onEliminar={modalPlanFuturo.plan ? () => eliminarPlanFuturo(modalPlanFuturo.plan!.id) : undefined}
          onClose={() => setModalPlanFuturo(null)}
        />
      )}

      {modalPlanSSA && (
        <ModalPlanSSA
          ssa={modalPlanSSA}
          fecha={fechaVista}
          planAgentes={modalPlanSSA.plan_agentes ?? []}
          onGuardar={guardarPlanSSA}
          onEliminar={eliminarPlanSSA}
          onClose={() => setModalPlanSSA(null)}
        />
      )}

      {puestoParaTurno && (
        <ModalConfigTurno
          puesto={puestoParaTurno}
          onClose={() => setPuestoParaTurno(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["operaciones-tablero"] });
            qc.invalidateQueries({ queryKey: ["operaciones-pool"] });
          }}
        />
      )}

      {modalIncentivo && (
        <ModalIncentivoCash
          data={modalIncentivo}
          autorizadoPor={currentUser?.nombre ?? currentUser?.username ?? ""}
          apiBase={API_BASE}
          onClose={() => setModalIncentivo(null)}
        />
      )}
    </AdminLayout>
  );
}

// ─── Modal: Incentivo Cash por Cobertura ─────────────────────────────────────

function ModalIncentivoCash({
  data, autorizadoPor, apiBase, onClose,
}: {
  data: { agenteId: number; agenteName: string; puestoId: number; puestoName: string; clienteId: number | null; clienteNombre: string | null; sedeId: number | null; fecha: string };
  autorizadoPor: string;
  apiBase: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"relevo_cash" | "bono_cobertura" | "motivacion_cobertura">("relevo_cash");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pagadoPor, setPagadoPor] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await fetch(`${apiBase}/incentivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          employeeId: data.agenteId,
          employeeNombre: data.agenteName,
          fecha: data.fecha,
          clienteId: data.clienteId,
          clienteNombre: data.clienteNombre,
          sedeId: data.sedeId,
          puestoId: data.puestoId,
          puestoNombre: data.puestoName,
          tipo,
          monto: Number(monto),
          motivo: motivo || undefined,
          autorizadoPor,
          pagadoPor: pagadoPor || undefined,
          metodoPago: "efectivo",
          estado: pagadoPor ? "pagado" : "pendiente",
        }),
      }).then((r) => { if (!r.ok) throw new Error("Error al guardar"); return r.json(); });
      toast({ title: "Incentivo cash registrado", description: `Q${Number(monto).toFixed(2)} → ${data.agenteName}` });
      onClose();
    } catch {
      toast({ title: "Error", description: "No se pudo registrar el incentivo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const TIPO_LABELS: Record<string, string> = {
    relevo_cash: "Relevo Cash",
    bono_cobertura: "Bono Cobertura",
    motivacion_cobertura: "Motivación / Incentivo",
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="bg-[#07111f] border border-emerald-700/30 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-emerald-900/20 border-b border-emerald-700/20">
          <div>
            <h3 className="text-sm font-bold text-emerald-300">Incentivo Cash por Cobertura</h3>
            <p className="text-[11px] text-white/40 mt-0.5">{data.agenteName} · {data.puestoName}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Tipo de Incentivo</label>
            <div className="flex gap-1.5 flex-wrap">
              {(["relevo_cash", "bono_cobertura", "motivacion_cobertura"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    tipo === t
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-white/4 border-white/10 text-white/40 hover:text-white/70"
                  }`}
                >
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Monto (Q)</label>
            <input
              type="number"
              min="1"
              step="0.50"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Motivo (opcional)</label>
            <input
              type="text"
              placeholder="Descripción breve del motivo…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Pagado por */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Pagado por (dejar vacío si aún no se paga)</label>
            <input
              type="text"
              placeholder="Nombre de quien entrega el efectivo…"
              value={pagadoPor}
              onChange={(e) => setPagadoPor(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[10px] text-white/25 mt-1">Si se ingresa, el estado se marca como "pagado" directamente.</p>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs font-medium text-white/40 bg-white/5 border border-white/10 hover:bg-white/8 transition-all"
            >
              No por ahora
            </button>
            <button
              onClick={guardar}
              disabled={saving || !monto}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-all"
            >
              {saving ? "Guardando…" : "Registrar Incentivo"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Asignar guardia a tarjeta SSA desde el Pizarrón ──────────────────

const TIPOS_COBERTURA: { value: string; label: string }[] = [
  { value: "disponible",        label: "Agente disponible del pool" },
  { value: "relevo",            label: "Relevo temporal" },
  { value: "horas_extra",       label: "Horas extra al titular" },
  { value: "cambio_titular",    label: "Cambio de titular" },
  { value: "contratacion_nueva", label: "Contratación nueva" },
];

const TIPO_SSA_LABELS: Record<string, string> = {
  guardia_extra: "Guardia Extra",
  ampliacion_horario: "Ampliación de Horario",
  cobertura_evento: "Cobertura de Evento",
  custodia_extra: "Custodia Extra",
  apoyo_temporal: "Apoyo Temporal",
};

// ─────────────────────────────────────────────────────────────────────────────
// Motivos de remoción de agente SSA
// ─────────────────────────────────────────────────────────────────────────────
const MOTIVOS_REMOCION = [
  { value: "error_asignacion", label: "Error de asignación", color: "text-orange-400 bg-orange-500/12 border-orange-500/25" },
  { value: "agente_declino",   label: "Agente declinó",      color: "text-red-400 bg-red-500/12 border-red-500/25" },
  { value: "cambio_operativo", label: "Cambio operativo",    color: "text-blue-400 bg-blue-500/12 border-blue-500/25" },
  { value: "no_disponible",    label: "No disponible",       color: "text-yellow-400 bg-yellow-500/12 border-yellow-500/25" },
  { value: "otro",             label: "Otro",                color: "text-white/40 bg-white/5 border-white/15" },
] as const;

// TarjetaSSACard — tarjeta visual para el panel SSA del Pizarrón
// ─────────────────────────────────────────────────────────────────────────────
function TarjetaSSACard({
  t,
  onAsignar,
  onRemover,
}: {
  t: TarjetaSSAPendiente;
  onAsignar: () => void;
  onRemover?: (motivo: string, notas?: string) => void;
}) {
  const [paso, setPaso] = useState<"idle" | "motivo" | "confirmar">("idle");
  const [motivoSel, setMotivoSel] = useState<string>("");
  const [notas, setNotas] = useState("");

  function resetear() { setPaso("idle"); setMotivoSel(""); setNotas(""); }

  const estaHoy = t.fecha
    ? new Date(t.fecha + "T12:00:00").toDateString() === new Date().toDateString()
    : false;

  const agentesActivos = (t.agentes ?? []).filter((a) => a.estado === "asignado");
  const cantidadRequerida = t.cantidad_guardias ?? 1;
  const cubierto = agentesActivos.length >= cantidadRequerida;
  const parcial  = agentesActivos.length > 0 && !cubierto;
  const sinAgente = agentesActivos.length === 0;
  const tieneRechazados = (t.agentes_rechazados?.length ?? 0) > 0;

  const prioColor = sinAgente
    ? t.prioridad === "urgente" ? "border-red-500/40 bg-red-500/6"
    : t.prioridad === "alta"    ? "border-orange-500/30 bg-orange-500/5"
    :                             "border-amber-500/20 bg-amber-500/4"
    : cubierto
      ? "border-green-500/20 bg-green-500/4"
      : "border-amber-500/25 bg-amber-500/5";

  const prioTag = t.prioridad === "urgente" ? "text-red-400 bg-red-500/15"
    : t.prioridad === "alta"                 ? "text-orange-400 bg-orange-500/15"
    :                                          "text-amber-400 bg-amber-500/15";

  return (
    <div className={`relative shrink-0 flex flex-col gap-1.5 border rounded-xl px-3 py-2.5 min-w-[220px] max-w-[250px] text-left transition-all ${prioColor}`}>

      {/* ── Paso 1: selector de motivo ─────────────────────────────────────── */}
      {paso === "motivo" && onRemover && (
        <div className="absolute inset-0 z-10 rounded-xl bg-[#080f1e]/97 border border-white/10 flex flex-col p-3 gap-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wide">Motivo de remoción</p>
            <button onClick={(e) => { e.stopPropagation(); resetear(); }} className="text-white/25 hover:text-white/60 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {MOTIVOS_REMOCION.map((m) => (
              <button
                key={m.value}
                onClick={(e) => { e.stopPropagation(); setMotivoSel(m.value); setPaso("confirmar"); }}
                className={`text-left text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:brightness-125 ${m.color}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Paso 2: confirmar remoción ─────────────────────────────────────── */}
      {paso === "confirmar" && onRemover && (
        <div className="absolute inset-0 z-10 rounded-xl bg-[#080f1e]/97 border border-red-500/20 flex flex-col items-center justify-center gap-3 p-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wide mb-1">Confirmar remoción</p>
            <p className="text-[10px] text-white/50">
              Motivo: <span className="text-white/80 font-medium">
                {MOTIVOS_REMOCION.find(m => m.value === motivoSel)?.label ?? motivoSel}
              </span>
            </p>
            {motivoSel === "agente_declino" && (
              <p className="text-[9px] text-red-400/70 mt-1">El agente quedará registrado como "declinó"</p>
            )}
          </div>
          {motivoSel === "otro" && (
            <input
              placeholder="Notas (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70 placeholder:text-white/25 outline-none"
            />
          )}
          <div className="flex gap-2 w-full">
            <button
              onClick={(e) => { e.stopPropagation(); setPaso("motivo"); }}
              className="flex-1 text-[10px] px-2 py-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
            >
              ← Atrás
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemover(motivoSel, notas || undefined); resetear(); }}
              className="flex-1 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/35 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Fila: prioridad + HOY + botón remover */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${prioTag}`}>
          {t.prioridad}
        </span>
        {estaHoy && <span className="text-[9px] text-amber-300/70 font-semibold">HOY</span>}
        {tieneRechazados && (
          <span title={`${t.agentes_rechazados.length} declinaron`} className="text-[9px] text-red-400/70 font-semibold">
            ↩{t.agentes_rechazados.length}
          </span>
        )}
        <span className="text-[9px] text-white/25 font-mono">{t.id.slice(0, 8)}</span>
        <div className="ml-auto flex items-center gap-1">
          {!sinAgente && onRemover && (
            <button
              onClick={(e) => { e.stopPropagation(); setPaso("motivo"); }}
              title="Remover agente (seleccionar motivo)"
              className="w-4 h-4 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/15 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Área clickeable principal → asignar */}
      <button
        onClick={onAsignar}
        className="text-left hover:brightness-110 transition-all"
      >
        {/* Cliente */}
        <p className="text-[11px] font-semibold text-white/90 truncate leading-tight">
          {t.cliente_nombre ?? "—"}
        </p>

        {/* Tipo + cantidad guardias */}
        <p className="text-[10px] text-white/45 truncate mt-0.5">
          {TIPO_SSA_LABELS[t.tipo_solicitud] ?? t.tipo_solicitud}
          {t.cantidad_guardias > 1 ? ` · ${t.cantidad_guardias} guardias` : ""}
        </p>

        {/* Sede + horario */}
        {(t.hora_inicio || t.sede_nombre) && (
          <p className="text-[9px] text-white/30 truncate mt-0.5">
            {t.sede_nombre ?? ""}
            {t.hora_inicio ? ` · ${t.hora_inicio}${t.hora_fin ? `–${t.hora_fin}` : ""}` : ""}
          </p>
        )}

        {/* Estado según etapa — multi-agente */}
        <div className="mt-1 space-y-0.5">
          {/* Badge cobertura */}
          {(cubierto || parcial) && (
            <div className="flex items-center gap-1 mb-0.5">
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase ${
                cubierto ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
              }`}>
                {agentesActivos.length}/{cantidadRequerida} {cubierto ? "cubierto" : "parcial"}
              </span>
              {t.estado_preplanilla === "incluido" && (
                <span className="text-[8px] text-primary/60 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2 h-2" />Pre-Planilla
                </span>
              )}
            </div>
          )}

          {/* Lista de agentes activos */}
          {agentesActivos.map((ag) => (
            <div key={ag.id} className="flex items-center gap-1">
              <User className="w-2.5 h-2.5 text-green-400 shrink-0" />
              <span className="text-[9px] text-green-300/80 truncate font-medium">
                {ag.nombre.split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
          ))}

          {/* Sin agente */}
          {sinAgente && (
            <div>
              {tieneRechazados && (
                <p className="text-[9px] text-red-400/60">
                  {t.agentes_rechazados.map(a => a.nombre.split(" ")[0]).join(", ")} declinaron
                </p>
              )}
              {t.plan_agente_nombre ? (
                <div className="flex items-center gap-1">
                  <UserCheck className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                  <span className="text-[9px] text-indigo-300/80 font-medium truncate">
                    Plan: {t.plan_agente_nombre.split(" ").slice(0, 2).join(" ")}
                  </span>
                </div>
              ) : (
                <p className="text-[9px] text-amber-400/70 font-medium">Toca para asignar →</p>
              )}
            </div>
          )}

          {/* Cobertura parcial — mostrar cuántos faltan */}
          {parcial && (
            <p className="text-[9px] text-amber-400/60">
              Faltan {cantidadRequerida - agentesActivos.length} guardia{cantidadRequerida - agentesActivos.length !== 1 ? "s" : ""}
            </p>
          )}

          {/* Pendiente facturación (si hay agentes) */}
          {!sinAgente && (
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-orange-400/60 shrink-0" />
              <span className="text-[9px] text-orange-300/50">Pend. facturación</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

function ModalAsignarSSA({
  tarjeta,
  disponibles,
  onClose,
  onSuccess,
}: {
  tarjeta: TarjetaSSAPendiente;
  disponibles: Agente[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(null);
  const [tipoCobertura, setTipoCobertura]           = useState("disponible");
  const [guardando, setGuardando]                   = useState(false);
  const [conflicto, setConflicto]                   = useState<string | null>(null);
  const [removiendo, setRemoviendo]                 = useState<Record<number, boolean>>({});

  // Local state that updates on each add/remove without closing the modal
  const [agentesLocales, setAgentesLocales] = useState<SsaAgente[]>(
    (tarjeta.agentes ?? []).filter((a) => a.estado === "asignado"),
  );

  const cantidadRequerida = tarjeta.cantidad_guardias ?? 1;
  const cubierto          = agentesLocales.length >= cantidadRequerida;
  const hayCapacidad      = agentesLocales.length < cantidadRequerida;
  const idsYaAsignados    = agentesLocales.map((a) => a.id);

  async function handleAgregar() {
    if (!agenteSeleccionado) {
      toast({ title: "Selecciona un agente", variant: "destructive" });
      return;
    }
    setConflicto(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/solicitudes-servicio/${tarjeta.id}/agentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ agenteId: agenteSeleccionado.id, tipoCobertura }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.advertencia) {
          setConflicto(body.error ?? "Conflicto de asignación");
        } else {
          toast({ title: "Error al asignar", description: body.error ?? "Error desconocido", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Guardia asignado", description: `${agenteSeleccionado.nombre_completo} agregado al servicio` });
      // Actualizar local state
      setAgentesLocales((prev) => [
        ...prev,
        { id: agenteSeleccionado.id, nombre: agenteSeleccionado.nombre_completo, telefono: null, estado: "asignado" },
      ]);
      setAgenteSeleccionado(null);
      onSuccess();
    } catch {
      toast({ title: "Error de red", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  async function handleRemover(ag: SsaAgente) {
    setRemoviendo((prev) => ({ ...prev, [ag.id]: true }));
    try {
      const res = await fetch(`/api/solicitudes-servicio/${tarjeta.id}/agentes/${ag.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ motivo: "cambio_operativo" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Error al remover", description: body.error ?? "Error", variant: "destructive" });
        return;
      }
      toast({ title: "Agente removido", description: `${ag.nombre} fue desvinculado del servicio` });
      setAgentesLocales((prev) => prev.filter((a) => a.id !== ag.id));
      onSuccess();
    } catch {
      toast({ title: "Error de red", variant: "destructive" });
    } finally {
      setRemoviendo((prev) => ({ ...prev, [ag.id]: false }));
    }
  }

  const prioColor =
    tarjeta.prioridad === "urgente" ? "text-red-400" :
    tarjeta.prioridad === "alta"    ? "text-orange-400" :
                                      "text-amber-400";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-amber-500/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Asignar Guardias — Servicio Especial</p>
              <p className="text-[10px] text-white/35 font-mono">{tarjeta.id}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar modal" className="text-white/30 hover:text-white transition-colors ml-3 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info de la tarjeta */}
        <div className="px-5 py-3 border-b border-white/6 bg-white/2 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90">{tarjeta.cliente_nombre ?? "—"}</p>
              <p className="text-xs text-white/45 mt-0.5">
                {TIPO_SSA_LABELS[tarjeta.tipo_solicitud] ?? tarjeta.tipo_solicitud}
                {tarjeta.sede_nombre ? ` · ${tarjeta.sede_nombre}` : ""}
              </p>
              {(tarjeta.hora_inicio || tarjeta.fecha) && (
                <p className="text-[10px] text-white/30 mt-0.5">
                  {tarjeta.fecha ? new Date(tarjeta.fecha + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                  {tarjeta.hora_inicio ? ` · ${tarjeta.hora_inicio}${tarjeta.hora_fin ? `–${tarjeta.hora_fin}` : ""}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-[10px] font-bold uppercase tracking-wide ${prioColor}`}>{tarjeta.prioridad}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                cubierto ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
              }`}>
                {agentesLocales.length}/{cantidadRequerida} cubierto{cantidadRequerida !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Agentes actuales */}
          {agentesLocales.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2">
                Asignados ({agentesLocales.length})
              </p>
              <div className="space-y-1.5">
                {agentesLocales.map((ag) => (
                  <div key={ag.id} className="flex items-center gap-3 bg-green-500/6 border border-green-500/20 rounded-xl px-3 py-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(ag.nombre)}`}>
                      {iniciales(ag.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/90 truncate">{ag.nombre}</p>
                      <p className="text-[10px] text-green-400/60">Asignado</p>
                    </div>
                    <button
                      onClick={() => handleRemover(ag)}
                      disabled={removiendo[ag.id]}
                      title="Remover agente"
                      className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {removiendo[ag.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Separador si hay capacidad para más */}
          {hayCapacidad && (
            <div className="px-5 pt-3 pb-3">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2">
                Agregar guardia {agentesLocales.length > 0 ? `(faltan ${cantidadRequerida - agentesLocales.length})` : ""}
              </p>

              {/* Tipo de cobertura */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {TIPOS_COBERTURA.map((tc) => (
                  <button
                    key={tc.value}
                    onClick={() => setTipoCobertura(tc.value)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                      tipoCobertura === tc.value
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-white/4 border-white/8 text-white/40 hover:border-white/20"
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>

              {/* Conflicto backend */}
              {conflicto && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 mb-3">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-200/70">{conflicto}</p>
                </div>
              )}

              {/* Selector agrupado por estado operativo */}
              <SelectorAgenteAgrupado
                fecha={tarjeta.fecha ?? new Date().toISOString().split("T")[0]}
                idsExcluidos={idsYaAsignados}
                seleccionado={agenteSeleccionado?.id ?? null}
                onSelect={(a) => {
                  setAgenteSeleccionado({ id: a.id, nombre_completo: a.nombre, estado_laboral: "activo", puesto: null, area: null, sede: null, telefono: null, wa_autorizado: false, supervisor_id: null, tipo_asignacion_eoa: "disponible" });
                  setConflicto(null);
                }}
              />
            </div>
          )}

          {/* Cubierto completamente */}
          {cubierto && (
            <div className="mx-5 my-3 flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-[11px] text-green-300/80 font-medium">
                Cobertura completa — {cantidadRequerida} de {cantidadRequerida} guardias asignados
              </p>
            </div>
          )}

          {/* Declinaron */}
          {(tarjeta.agentes_rechazados?.length ?? 0) > 0 && (
            <div className="mx-5 mb-3 flex items-start gap-2 bg-white/4 border border-white/10 rounded-xl px-3 py-2">
              <Info className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/30">
                Anteriores declinaron: {tarjeta.agentes_rechazados.map(a => a.nombre).join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-white/50 hover:text-white border border-white/8 rounded-xl transition-colors"
          >
            {cubierto ? "Listo" : "Cerrar"}
          </button>
          {hayCapacidad && (
            <button
              onClick={handleAgregar}
              disabled={!agenteSeleccionado || guardando}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#04090f] rounded-xl transition-colors"
            >
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Agregar guardia
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
