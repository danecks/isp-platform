import { useState, useCallback, useRef } from "react";
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
  History, Trash2, Shield, Activity, Zap, ChevronDown,
  ChevronRight, Info, Building2, Circle, GripVertical,
  UserMinus, UserPlus, XCircle, RotateCcw, FileText,
  Lock, Unlock, Calendar, AlertCircle, CheckSquare,
  Layers, Timer, Moon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
}

interface ClienteBoard {
  clienteId: number | null;
  clienteNombre: string;
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
}

interface Pool {
  disponibles: Agente[];
  enPuesto: Agente[];
  enSSA: Agente[];
  enDescanso: Agente[];
  suspendidos: Agente[];
  total: number;
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

async function apiPost(url: string, body: object) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
}: {
  agente: Agente;
  onClick: () => void;
  isSelected: boolean;
  disabled?: boolean;
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
        <p className="text-[10px] text-white/35 truncate">{agente.puesto ?? "Agente"}</p>
      </div>
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

  // Búsqueda de empleados
  const [busqueda, setBusqueda]         = useState("");
  const [empleadoSel, setEmpleadoSel]   = useState<EmpleadoBusqueda | null>(null);
  const [tipoCobertura, setTipo]        = useState("relevo");
  const [horaInicio, setHoraInicio]     = useState("");
  const [horaFin, setHoraFin]           = useState("");
  const [motivo, setMotivo]             = useState("");
  const [guardando, setGuardando]       = useState(false);

  // IDs de agentes actualmente en puesto o cubriendo un SSA (para filtrar disponibilidad)
  const { data: poolData } = useQuery<{ enPuesto: { id: number }[]; enSSA: { id: number }[] }>({
    queryKey: ["pool-disponibilidad"],
    queryFn: () => fetch(`${API_BASE}/operaciones/pool`).then((r) => r.json()),
    staleTime: 30_000,
  });
  const idsEnPuesto = new Set([
    ...(poolData?.enPuesto ?? []).map((a) => a.id),
    ...(poolData?.enSSA    ?? []).map((a) => a.id),
  ]);

  const { data: empleadosBusquedaRaw = [] } = useQuery<EmpleadoBusqueda[]>({
    queryKey: ["emp-busqueda", busqueda],
    queryFn: () =>
      fetch(`${API_BASE}/employees?q=${encodeURIComponent(busqueda)}&limit=20`)
        .then((r) => r.json())
        .then((d: any) => {
          const arr = Array.isArray(d) ? d : (d.employees ?? []);
          return arr.filter((e: any) => e.estadoLaboral === "activo" || e.estado_laboral === "activo");
        }),
    enabled: busqueda.length >= 2,
    staleTime: 30_000,
  });
  // Separar disponibles y en puesto
  const empleadosDisponibles = empleadosBusquedaRaw.filter((e) => !idsEnPuesto.has(e.id));
  const empleadosEnPuesto    = empleadosBusquedaRaw.filter((e) =>  idsEnPuesto.has(e.id));
  const empleadosBusqueda    = [...empleadosDisponibles, ...empleadosEnPuesto];

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
      setEmpleadoSel(null); setBusqueda(""); setHoraInicio(""); setHoraFin(""); setMotivo("");
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

          {/* Búsqueda de empleado */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar empleado (mín. 2 letras)…"
              value={empleadoSel ? empleadoSel.nombreCompleto : busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setEmpleadoSel(null); }}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-400/30"
            />
            {!empleadoSel && busqueda.length >= 2 && empleadosBusqueda.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#07111f] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                {empleadosDisponibles.length > 0 && (
                  <p className="px-3 pt-2 pb-1 text-[9px] text-emerald-400/60 uppercase tracking-widest font-semibold">Disponibles</p>
                )}
                {empleadosDisponibles.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { setEmpleadoSel(e); setBusqueda(""); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-2 border-b border-white/5 last:border-0"
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(e.nombreCompleto)}`}>
                      {iniciales(e.nombreCompleto)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/80 truncate">{e.nombreCompleto}</p>
                      <p className="text-[10px] text-white/35 truncate">{e.puesto ?? e.area ?? ""}</p>
                    </div>
                  </button>
                ))}
                {empleadosEnPuesto.length > 0 && (
                  <p className="px-3 pt-2 pb-1 text-[9px] text-amber-400/60 uppercase tracking-widest font-semibold border-t border-white/5 mt-1">En puesto ahora</p>
                )}
                {empleadosEnPuesto.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { setEmpleadoSel(e); setBusqueda(""); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-amber-500/5 transition-colors flex items-center gap-2 border-b border-white/5 last:border-0 opacity-60"
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(e.nombreCompleto)}`}>
                      {iniciales(e.nombreCompleto)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/80 truncate">{e.nombreCompleto}</p>
                      <p className="text-[10px] text-amber-400/50 truncate">Ya cubriendo otro puesto</p>
                    </div>
                    <span className="text-[8px] text-amber-400/60 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">En puesto</span>
                  </button>
                ))}
              </div>
            )}
            {empleadoSel && (
              <button
                onClick={() => { setEmpleadoSel(null); setBusqueda(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

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

// ─── Tarjeta de Puesto (droppable) ────────────────────────────────────────────

function DroppablePuesto({
  puesto,
  isAgenteSeleccionado,
  onClick,
  onLiberar,
  onAbrirSegmentos,
}: {
  puesto: Puesto;
  isAgenteSeleccionado: boolean;
  onClick: () => void;
  onLiberar: () => void;
  onAbrirSegmentos: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `puesto-${puesto.id}` });
  const cubierto  = puesto.estado === "cubierto" && puesto.agente_id;
  const esRelevo  = cubierto && puesto.titular_employee_id && puesto.agente_id !== puesto.titular_employee_id;
  const titularAusente = !puesto.agente_id && !!puesto.titular_employee_id;

  const borderClass = isOver
    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]"
    : esRelevo
      ? "bg-[#0f1208] border-amber-500/30 hover:border-amber-400/40"
      : cubierto
        ? "bg-[#081620] border-green-500/20 hover:border-green-400/30"
        : "bg-[#0c0a16] border-red-500/25 hover:border-red-400/35";

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
        relative rounded-xl border p-3 transition-all cursor-pointer group
        ${borderClass}
        ${isAgenteSeleccionado && !cubierto ? "ring-1 ring-primary/50 border-primary/30" : ""}
      `}
    >
      {/* Encabezado: nombre + turno + estado */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 truncate">{puesto.nombre}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${TURNO_COLORS[puesto.turno] ?? "text-white/30 bg-white/5 border-white/10"}`}>
              {puesto.turno}
            </span>
            {puesto.jornada && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border text-blue-300/60 bg-blue-500/5 border-blue-500/15 font-semibold">
                {puesto.jornada}
              </span>
            )}
            {esRelevo && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border text-amber-300/80 bg-amber-500/10 border-amber-500/25 font-bold">
                RELEVO
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 mt-0.5">
          {cubierto
            ? <CheckCircle2 className={`w-3.5 h-3.5 ${esRelevo ? "text-amber-400" : "text-green-400"}`} />
            : <Circle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
          }
        </div>
      </div>

      {/* Cobertura actual */}
      {cubierto && puesto.agente_nombre ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(puesto.agente_nombre)}`}>
                {iniciales(puesto.agente_nombre)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] text-white/80 font-medium truncate">{puesto.agente_nombre}</p>
                  {!esRelevo && (
                    <span className="text-[8px] text-green-400/70 font-bold shrink-0">T</span>
                  )}
                </div>
                {puesto.agente_telefono && (
                  <p className="text-[10px] text-white/25 truncate">{puesto.agente_telefono}</p>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onLiberar(); }}
              className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all p-0.5"
              title="Remover del puesto"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Si es relevo: mostrar titular ausente */}
          {esRelevo && puesto.titular_nombre && (
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-white/4 rounded-lg border border-white/5">
              <User className="w-2.5 h-2.5 text-white/25 shrink-0" />
              <p className="text-[9px] text-white/35 truncate">Titular ausente: <span className="text-white/50">{puesto.titular_nombre}</span></p>
            </div>
          )}
        </div>
      ) : titularAusente ? (
        /* Titular definido pero ausente hoy (sin cobertura) */
        <div className="space-y-1.5">
          <div className={`flex items-center gap-2 transition-colors ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/20"}`}>
            <User className="w-4 h-4 shrink-0" />
            <p className="text-[11px]">
              {isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Sin cobertura hoy"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-1.5 py-1 bg-red-500/5 rounded-lg border border-red-500/10">
            <User className="w-2.5 h-2.5 text-red-400/40 shrink-0" />
            <p className="text-[9px] text-red-300/50 truncate">Titular: <span className="text-red-300/70">{puesto.titular_nombre}</span></p>
          </div>
        </div>
      ) : (
        <div className={`flex items-center gap-2 transition-colors ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/20"}`}>
          <User className="w-4 h-4 shrink-0" />
          <p className="text-[11px]">
            {isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Puesto descubierto"}
          </p>
        </div>
      )}

      {/* Botón tramos */}
      <div className="mt-2 pt-2 border-t border-white/5">
        <button
          onClick={(e) => { e.stopPropagation(); onAbrirSegmentos(); }}
          className="flex items-center gap-1 text-[9px] text-indigo-400/50 hover:text-indigo-400 transition-colors group/tramos"
          title="Registrar tramos de cobertura"
        >
          <Layers className="w-3 h-3" />
          <span>Tramos</span>
        </button>
      </div>

      {/* Overlay drag-over */}
      {isOver && (
        <div className="absolute inset-0 rounded-xl border-2 border-primary border-dashed pointer-events-none" />
      )}
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
}: {
  cliente: ClienteBoard;
  agenteSeleccionadoId: number | null;
  onPuestoClick: (puesto: Puesto) => void;
  onLiberar: (puesto: Puesto) => void;
  onNuevoPuesto: (cliente: ClienteBoard) => void;
  onEliminarPuesto: (puesto: Puesto) => void;
  onAbrirSegmentos: (puesto: Puesto) => void;
}) {
  const cubiertos   = cliente.puestos.filter((p) => p.estado === "cubierto" && p.agente_id).length;
  const total       = cliente.puestos.length;
  const pct         = total > 0 ? Math.round((cubiertos / total) * 100) : 0;
  const colorBarra  = pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex-shrink-0 w-64 bg-[#060f1a] border border-white/8 rounded-2xl overflow-hidden flex flex-col max-h-full">
      {/* Header cliente */}
      <div className="px-3 py-3 border-b border-white/8">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white truncate">{cliente.clienteNombre}</h3>
            <p className="text-[10px] text-white/35 mt-0.5">{cubiertos}/{total} puestos cubiertos</p>
          </div>
          <button
            onClick={() => onNuevoPuesto(cliente)}
            className="text-white/20 hover:text-primary transition-colors shrink-0 mt-0.5"
            title="Agregar puesto"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
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
  const hayTitularPrevio = !!puesto.titular_employee_id;
  const hoy = toISODate(new Date());
  const manana = toISODate(new Date(Date.now() + 86400000));

  const ahoraHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  const [paso, setPaso] = useState<"elige" | "detalles" | "titularPrevio" | "horaInstalacion">("elige");
  const [oldTitularAccion, setOldTitularAccion] = useState<OldTitularAccion>("disponible");
  const [opcionFecha, setOpcionFecha] = useState<"hoy" | "manana" | "personalizada">("hoy");
  const [fechaPersonalizada, setFechaPersonalizada] = useState(hoy);
  const [motivo, setMotivo] = useState("cobertura_definitiva");
  const [soloCoberturaPendiente, setSoloCoberturaPendiente] = useState(false);
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
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">¿Cómo registrar esta asignación?</h3>
          </div>
          <p className="text-[11px] text-white/35 mt-1.5">
            <span className="text-white/60 font-medium">{agente.nombre_completo}</span>
            {" · "}
            <span className="capitalize text-white/35">{agente.tipo_asignacion_eoa?.replace("_", " ") ?? "pool"}</span>
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
              <button
                onClick={() => setPaso(soloCoberturaPendiente ? "elige" : (hayTitularPrevio ? "titularPrevio" : "detalles"))}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
              >
                Atrás
              </button>
              <button
                onClick={confirmarConHora}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors"
              >
                Confirmar →
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

function ModalSustitucion({
  puesto,
  agenteEntrante,
  onConfirm,
  onCancel,
  advertencia,
}: {
  puesto: Puesto;
  agenteEntrante: Agente;
  onConfirm: (motivo: string, notas: string, forzar: boolean, tipoSustitucion: string) => Promise<void>;
  onCancel: () => void;
  advertencia?: string;
}) {
  const [motivo, setMotivo] = useState("rotacion");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [tipoSustitucion, setTipoSustitucion] = useState<"relevo" | "reasignacion">("relevo");
  const esSustitucion = !!puesto.agente_id;

  const generaRrhh = esSustitucion && (motivo === "falta" || motivo === "suspension");

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(motivo, notas, !!advertencia, tipoSustitucion);
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

          {/* Motivo */}
          {esSustitucion && (
            <div className="space-y-1">
              <label className="text-xs text-white/40">Motivo de la sustitución</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="rotacion">Rotación de turno</option>
                <option value="falta">Falta del agente</option>
                <option value="descanso">Descanso / tiempo libre</option>
                <option value="suspension">Suspensión</option>
                <option value="emergencia">Emergencia</option>
                <option value="voluntario">Solicitud voluntaria</option>
                <option value="otro">Otro</option>
              </select>
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
  onSave: (data: { clienteId: number | null; clienteNombre: string; nombre: string; turno: string; notas: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [clienteId, setClienteId]     = useState<string>(clientePreseleccionado?.clienteId?.toString() ?? "");
  const [clienteNombreCustom, setClienteNombreCustom] = useState(clientePreseleccionado?.clienteNombre ?? "");
  const [nombre, setNombre]           = useState("");
  const [turno, setTurno]             = useState("día");
  const [notas, setNotas]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // Resolver nombre del cliente seleccionado
  const clienteSeleccionado = clientes.find((c) => c.id.toString() === clienteId);
  const clienteNombreFinal  = clienteSeleccionado
    ? (clienteSeleccionado.nombre_comercial || clienteSeleccionado.nombre)
    : clienteNombreCustom;

  async function handleSave() {
    if (!nombre.trim()) { setError("El nombre del puesto es requerido."); return; }
    if (!clienteNombreFinal.trim()) { setError("Selecciona o escribe un cliente."); return; }
    setLoading(true);
    setError("");
    try {
      await onSave({
        clienteId: clienteId ? parseInt(clienteId) : null,
        clienteNombre: clienteNombreFinal,
        nombre: nombre.trim(),
        turno,
        notas,
      });
      onClose();
    } catch (e: any) {
      setError(e.error ?? "Error al crear puesto");
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
          <div className="space-y-1">
            <label className="text-xs text-white/40">Turno</label>
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              <option value="día">Día</option>
              <option value="noche">Noche</option>
              <option value="24h">24 horas</option>
              <option value="mixto">Mixto</option>
            </select>
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
              disabled={loading}
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
  const [modalLiberar, setModalLiberar]              = useState<Puesto | null>(null);
  const [poolTab, setPoolTab]                        = useState<"disponibles" | "enDescanso" | "suspendidos" | "enPuesto" | "enSSA">("disponibles");
  const [busquedaPool, setBusquedaPool]              = useState("");
  const [modalCierre, setModalCierre]                = useState(false);
  const [modalReabrir, setModalReabrir]              = useState(false);
  const [filtroZona, setFiltroZona]                  = useState<string>("");
  const [filtroCliente, setFiltroCliente]            = useState<string>("");
  const [modalSegmentos, setModalSegmentos]          = useState<Puesto | null>(null);
  const [modalAsignarSSA, setModalAsignarSSA]        = useState<TarjetaSSAPendiente | null>(null);
  const [ssaTabActivo, setSsaTabActivo]              = useState<"sin_asignar" | "cubierta">("sin_asignar");

  // ── Sensores DnD ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: tablero = [], isLoading: loadingTablero, refetch: refetchTablero } = useQuery<ClienteBoard[]>({
    queryKey: ["operaciones-tablero"],
    queryFn: () => fetch(`${API_BASE}/operaciones/tablero`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: pool, isLoading: loadingPool, refetch: refetchPool } = useQuery<Pool>({
    queryKey: ["operaciones-pool"],
    queryFn: () => fetch(`${API_BASE}/operaciones/pool`).then((r) => r.json()),
    refetchInterval: 30_000,
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

  // Etapas SSA para el panel del Pizarrón
  const ssaSinAgente   = tarjetasSSA.filter((t) => !t.agente_id);
  const ssaCubierta    = tarjetasSSA.filter((t) => !!t.agente_id);

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

  // ── Remover agente de un SSA ─────────────────────────────────────────────
  async function removerAgenteSSA(t: TarjetaSSAPendiente) {
    try {
      const r = await fetch(`${API_BASE}/solicitudes-servicio/${t.id}/remover-agente`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "",
        },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Error al remover agente", description: err.error ?? "Error desconocido", variant: "destructive" });
        return;
      }
      toast({ title: "Agente removido", description: "El agente fue desvinculado del servicio y volvió al pool." });
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
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
    }
  }

  // ── Click en puesto: asignar agente seleccionado ──────────────────────────
  async function handlePuestoClick(puesto: Puesto) {
    if (isCerrado) return;
    if (!agenteSeleccionado) return;
    await iniciarAsignacion(puesto, agenteSeleccionado);
  }

  // ── Confirmar sustitución / asignación ───────────────────────────────────
  async function confirmarSustitucion(motivo: string, notas: string, forzar: boolean, tipoSustitucion: string = "relevo") {
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
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
        if (resp?.eventoRrhhGenerado) {
          toast({
            title: "Sustitución registrada + Evento RRHH generado",
            description: `Boleta y acta disponibles en Eventos RRHH`,
          });
        } else {
          toast({ title: "Sustitución registrada", description: `${puesto.agente_nombre} → ${agente.nombre_completo}` });
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
      invalidate();
    } catch (e: any) {
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
  async function crearPuesto(data: { clienteId: number | null; clienteNombre: string; nombre: string; turno: string; notas: string }) {
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
    if (!filtroZona && !filtroCliente) return tablero;
    return tablero
      .filter((c) => !filtroCliente || String(c.clienteId) === filtroCliente)
      .map((c) => ({
        ...c,
        puestos: filtroZona
          ? c.puestos.filter((p) => String(p.zona_operativa_id) === filtroZona)
          : c.puestos,
      }))
      .filter((c) => c.puestos.length > 0);
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
                <p className="text-[10px] text-white/30 mt-0.5">Disponibles</p>
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

          {/* ── Panel SSA: Servicios Especiales — todas las etapas activas ─ */}
          {tarjetasSSA.length > 0 && (
            <div className="shrink-0 bg-[#06101c] border border-white/8 rounded-2xl overflow-hidden">
              {/* Cabecera del panel */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-white/70">Servicios Especiales Activos</span>
                  <span className="text-[10px] text-white/25 bg-white/6 px-2 py-0.5 rounded-full">{tarjetasSSA.length}</span>
                </div>
                <a
                  href="/admin/tablero-servicios"
                  className="text-[10px] text-primary/60 hover:text-primary transition-colors flex items-center gap-1"
                >
                  Tablero completo <ChevronRight className="w-3 h-3" />
                </a>
              </div>

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
              <div className="flex gap-2 overflow-x-auto px-3 py-3">
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
                        onRemover={isCerrado ? undefined : () => removerAgenteSSA(t)}
                      />
                    ))
                  )
                )}
              </div>
            </div>
          )}

          {/* ── Tablero ──────────────────────────────────────────────────── */}
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
                    onLiberar={(p) => setModalLiberar(p)}
                    onNuevoPuesto={(c) => setNuevoPuestoData(c)}
                    onEliminarPuesto={eliminarPuesto}
                    onAbrirSegmentos={(p) => setModalSegmentos(p)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Pool de agentes ───────────────────────────────────────────── */}
          <div className="shrink-0 bg-[#060f1a] border border-white/8 rounded-2xl overflow-hidden">
            {/* Header pool */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8">
              <Users className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Pool de agentes</span>
              <div className="flex-1" />

              {/* Tabs del pool */}
              {[
                { key: "disponibles" as const, label: "Disponibles", count: pool?.disponibles?.length ?? 0, color: "text-green-400" },
                { key: "enDescanso"  as const, label: "Descanso",    count: pool?.enDescanso?.length ?? 0,  color: "text-blue-400" },
                { key: "enPuesto"   as const, label: "En puesto",   count: pool?.enPuesto?.length ?? 0,   color: "text-teal-400" },
                { key: "enSSA"      as const, label: "En SSA",      count: pool?.enSSA?.length ?? 0,      color: "text-amber-400" },
                { key: "suspendidos" as const, label: "Suspendidos", count: pool?.suspendidos?.length ?? 0, color: "text-red-400" },
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

              <span className="text-xs text-white/20">
                {agenteSeleccionado ? "Toca un puesto en el tablero" : "Arrastra o selecciona un agente"}
              </span>
            </div>

            {/* Agentes en el pool */}
            <div className="flex gap-2 p-3 overflow-x-auto min-h-[80px]">
              {loadingPool ? (
                <div className="flex items-center justify-center w-full">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              ) : poolActual.length === 0 ? (
                <div className="flex items-center justify-center w-full text-white/20 text-xs">
                  {poolTab === "disponibles" ? "No hay agentes disponibles" :
                   poolTab === "enDescanso"  ? "No hay agentes en descanso" :
                   poolTab === "enPuesto"    ? "Ningún agente está en puesto activo" :
                   poolTab === "enSSA"       ? "Ningún agente cubre un SSA activo" :
                   "No hay agentes suspendidos"}
                </div>
              ) : (
                poolActual.map((agente) => (
                  <div key={agente.id} className="shrink-0 w-52">
                    <DraggableAgente
                      agente={agente}
                      isSelected={agenteSeleccionado?.id === agente.id}
                      onClick={() => {
                        if (isCerrado) return;
                        setAgenteSeleccionado(agenteSeleccionado?.id === agente.id ? null : agente);
                      }}
                      disabled={poolTab === "enPuesto" || poolTab === "enSSA" || isCerrado}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/20">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-green-400" /> Cubierto</span>
              <span className="flex items-center gap-1"><Circle className="w-2.5 h-2.5 text-red-400" /> Descubierto</span>
              <span className="flex items-center gap-1"><GripVertical className="w-2.5 h-2.5" /> Arrastrar agente al puesto</span>
              <span className="flex items-center gap-1"><XCircle className="w-2.5 h-2.5" /> Hover sobre puesto para remover</span>
              <div className="flex-1" />
              <span>Se refresca cada 30 seg automáticamente</span>
            </div>
          </div>
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
    </AdminLayout>
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
// TarjetaSSACard — tarjeta visual para el panel SSA del Pizarrón
// ─────────────────────────────────────────────────────────────────────────────
function TarjetaSSACard({
  t,
  onAsignar,
  onRemover,
}: {
  t: TarjetaSSAPendiente;
  onAsignar: () => void;
  onRemover?: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  const estaHoy = t.fecha
    ? new Date(t.fecha + "T12:00:00").toDateString() === new Date().toDateString()
    : false;

  const sinAgente = !t.agente_id;

  const prioColor = sinAgente
    ? t.prioridad === "urgente" ? "border-red-500/40 bg-red-500/6"
    : t.prioridad === "alta"    ? "border-orange-500/30 bg-orange-500/5"
    :                             "border-amber-500/20 bg-amber-500/4"
    : "border-green-500/20 bg-green-500/4";

  const prioTag = t.prioridad === "urgente" ? "text-red-400 bg-red-500/15"
    : t.prioridad === "alta"                 ? "text-orange-400 bg-orange-500/15"
    :                                          "text-amber-400 bg-amber-500/15";

  return (
    <div className={`relative shrink-0 flex flex-col gap-1.5 border rounded-xl px-3 py-2.5 min-w-[210px] max-w-[240px] text-left transition-all ${prioColor}`}>

      {/* Confirmación inline de remoción */}
      {confirmando && onRemover && (
        <div className="absolute inset-0 z-10 rounded-xl bg-[#0a1628]/95 border border-red-500/30 flex flex-col items-center justify-center gap-2 p-3">
          <p className="text-[11px] text-white/80 text-center font-medium">¿Remover agente del servicio?</p>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRemover(); setConfirmando(false); }}
              className="text-[10px] font-bold px-3 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/35 transition-colors"
            >
              Confirmar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmando(false); }}
              className="text-[10px] px-3 py-1 rounded-lg bg-white/8 text-white/50 hover:bg-white/15 transition-colors"
            >
              Cancelar
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
        <span className="text-[9px] text-white/25 font-mono">{t.id.slice(0, 8)}</span>
        <div className="ml-auto flex items-center gap-1">
          {/* Botón × remover — solo aparece si hay agente y se permite */}
          {!sinAgente && onRemover && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmando(true); }}
              title="Remover agente"
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

        {/* Estado según etapa */}
        {sinAgente ? (
          <p className="text-[9px] text-amber-400/70 mt-1 font-medium">Toca para asignar guardia →</p>
        ) : (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1">
              <User className="w-2.5 h-2.5 text-green-400 shrink-0" />
              <span className="text-[9px] text-green-300/80 truncate font-medium">
                {t.agente_nombre_completo ?? t.agente_nombre ?? "Agente asignado"}
              </span>
            </div>
            {t.estado_preplanilla === "incluido" && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5 text-primary shrink-0" />
                <span className="text-[9px] text-primary/70">En Pre-Planilla</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-orange-400/60 shrink-0" />
              <span className="text-[9px] text-orange-300/50">Pend. facturación</span>
            </div>
          </div>
        )}
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
  const [tipoCobertura, setTipoCobertura] = useState("disponible");
  const [observaciones, setObservaciones] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);

  const agentesDisponibles = disponibles.filter((a) =>
    !busqueda.trim() ||
    a.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.puesto ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  async function handleConfirmar() {
    if (!agenteSeleccionado) {
      toast({ title: "Selecciona un agente", variant: "destructive" });
      return;
    }
    setGuardando(true);
    try {
      const session = sessionStorage.getItem("isp_admin_session_v2") || "";
      const res = await fetch(`/api/solicitudes-servicio/${tarjeta.id}/asignar-agente`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-isp-session": session },
        body: JSON.stringify({
          agenteId: agenteSeleccionado.id,
          tipoCobertura,
          observaciones: observaciones.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al asignar");
      }
      toast({
        title: "Guardia asignado",
        description: `${agenteSeleccionado.nombre_completo} asignado a ${tarjeta.id} — pendiente facturación`,
      });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Error al asignar", description: e.message, variant: "destructive" });
    } finally {
      setGuardando(false);
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
              <p className="text-sm font-bold text-white">Asignar Guardia — Servicio Especial</p>
              <p className="text-[10px] text-white/35 font-mono">{tarjeta.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors ml-3 shrink-0">
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
                {tarjeta.cantidad_guardias > 1 ? ` · ${tarjeta.cantidad_guardias} guardias` : ""}
                {tarjeta.sede_nombre ? ` · ${tarjeta.sede_nombre}` : ""}
              </p>
              {(tarjeta.hora_inicio || tarjeta.fecha) && (
                <p className="text-[10px] text-white/30 mt-0.5">
                  {tarjeta.fecha ? new Date(tarjeta.fecha + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                  {tarjeta.hora_inicio ? ` · ${tarjeta.hora_inicio}${tarjeta.hora_fin ? `–${tarjeta.hora_fin}` : ""}` : ""}
                </p>
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${prioColor}`}>
              {tarjeta.prioridad}
            </span>
          </div>
          {tarjeta.descripcion && (
            <p className="text-[10px] text-white/30 mt-2 leading-relaxed line-clamp-2">
              {tarjeta.descripcion}
            </p>
          )}
        </div>

        {/* Tipo de cobertura */}
        <div className="px-5 pt-3 pb-2 border-b border-white/6 shrink-0">
          <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block mb-1.5">
            Tipo de cobertura
          </label>
          <div className="flex flex-wrap gap-1.5">
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
        </div>

        {/* Selector de agente */}
        <div className="px-5 pt-3 pb-1 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
              Agente disponible
            </label>
            <span className="text-[10px] text-white/20">{disponibles.length} en pool</span>
          </div>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar agente…"
            className="w-full bg-[#0c1929] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/80 outline-none placeholder:text-white/20 focus:border-primary/40 mb-2"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-1 min-h-0">
          {agentesDisponibles.length === 0 ? (
            <div className="text-center py-6">
              <UserMinus className="w-6 h-6 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/25">
                {disponibles.length === 0 ? "No hay agentes disponibles en el pool" : "Sin resultados para la búsqueda"}
              </p>
            </div>
          ) : (
            agentesDisponibles.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgenteSeleccionado(a)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  agenteSeleccionado?.id === a.id
                    ? "bg-primary/15 border-primary/40 shadow-sm shadow-primary/10"
                    : "bg-[#0c1929] border-white/6 hover:border-white/15"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${avatarColor(a.nombre_completo)}`}>
                  {iniciales(a.nombre_completo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/90 truncate">{a.nombre_completo}</p>
                  <p className="text-[10px] text-white/35 truncate">{a.puesto ?? "Agente"}{a.sede ? ` · ${a.sede}` : ""}</p>
                </div>
                {agenteSeleccionado?.id === a.id && (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Observaciones */}
        <div className="px-5 py-3 border-t border-white/6 shrink-0">
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones (opcional)…"
            rows={2}
            className="w-full bg-[#0c1929] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/80 outline-none placeholder:text-white/20 focus:border-primary/40 resize-none"
          />
        </div>

        {/* Estado post-asignación (informativo) */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-orange-500/8 border border-orange-500/20 rounded-xl px-3 py-2">
            <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <p className="text-[10px] text-orange-300/70">
              Al confirmar: operativo <span className="text-green-400 font-semibold">Cubierto</span> · etapa <span className="text-orange-400 font-semibold">Pendiente Facturación</span>
            </p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 text-xs text-white/50 hover:text-white border border-white/8 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!agenteSeleccionado || guardando}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#04090f] rounded-xl transition-colors"
          >
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Confirmar asignación
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
