import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Lock, ChevronLeft, Loader2, Calendar, User, Clock,
  CheckCircle2, Circle, AlertTriangle, Shield, History,
  ArrowLeftRight, FileText, ChevronDown, Moon, Unlock,
  Building2, MapPin, Info,
} from "lucide-react";
import { AdminLayout } from "../layout/AdminLayout";
import { getSessionToken } from "@/lib/httpClient";

const API_BASE = "/api";

// Header de sesión admin para todos los fetches del archivo.
const sessionHeader = () => ({ "x-isp-session": getSessionToken() });

// ── Helpers ───────────────────────────────────────────────────────────────────

function iniciales(n: string | null | undefined) {
  if (!n) return "?";
  return n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-600", "bg-violet-600", "bg-sky-600", "bg-teal-600",
  "bg-emerald-600", "bg-amber-600", "bg-orange-600", "bg-rose-600",
];
function avatarColor(nombre: string | null | undefined) {
  if (!nombre) return "bg-slate-600";
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const TURNO_COLORS: Record<string, string> = {
  día:   "text-amber-300/80 bg-amber-500/10 border-amber-500/20",
  noche: "text-blue-300/80 bg-blue-500/10 border-blue-500/20",
  "24h": "text-purple-300/80 bg-purple-500/10 border-purple-500/20",
};

// ── Interfaces ────────────────────────────────────────────────────────────────

interface CierreListItem {
  id: number;
  fecha_iso: string;
  fecha_str: string;
  estado: string;
  cerrado_por: string;
  cerrado_en_str: string;
  total_puestos: number | null;
  cubiertos: number | null;
  descubiertos: number | null;
  ausencias: number | null;
}

interface SnapshotPuesto {
  id: number;
  nombre: string;
  cliente_nombre: string;
  cliente_id: number | null;
  estado: string;
  agente_id: number | null;
  agente_nombre: string | null;
  titular_employee_id: number | null;
  titular_nombre: string | null;
  turno: string | null;
  horario: string | null;
  jornada: string | null;
  notas: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  sede_nombre: string | null;
}

interface ClienteHistorico {
  clienteId: number | null;
  clienteNombre: string;
  puestos: SnapshotPuesto[];
}

interface MovimientoHistorico {
  tipo: string;
  motivo: string | null;
  agente_saliente_nombre: string | null;
  agente_entrante_nombre: string | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  fecha_hora: string;
}

interface Segmento {
  id: number;
  puesto_id: number;
  puesto_nombre: string | null;
  employee_id: number;
  empleado_nombre: string | null;
  hora_inicio: string;
  hora_fin: string | null;
  horas_calculadas: number | null;
  tipo_cobertura: string | null;
}

interface PizarronHistoricoData {
  cierre: {
    id: number;
    fecha_iso: string;
    fecha_str: string;
    estado: string;
    cerrado_por: string;
    cerrado_en_str: string;
    reabierto_por: string | null;
    reabierto_en_str: string | null;
    motivo_reapertura: string | null;
    comentario: string | null;
  };
  stats: {
    totalPuestos: number;
    cubiertos: number;
    descubiertos: number;
    cubiertosPorTitular: number;
    cubiertosPorRelevo: number;
    ausencias: number;
    horasExtra: number;
  };
  tableroHistorico: ClienteHistorico[];
  movimientosHoy: MovimientoHistorico[];
  segmentos: Segmento[];
}

// ── Tarjeta de Puesto (solo lectura) ─────────────────────────────────────────

function PuestoCardHistorico({ puesto }: { puesto: SnapshotPuesto }) {
  const cubierto     = puesto.estado === "cubierto" && puesto.agente_id;
  const esRelevo     = cubierto && puesto.titular_employee_id && puesto.agente_id !== puesto.titular_employee_id;
  const titularAusente = !puesto.agente_id && !!puesto.titular_employee_id;

  const borderClass = esRelevo
    ? "bg-[#0f1208] border-amber-500/30"
    : cubierto
      ? "bg-[#081620] border-green-500/20"
      : "bg-[#0c0a16] border-red-500/25";

  return (
    <div className={`relative rounded-xl border p-3 transition-all select-none ${borderClass}`}>
      {/* Encabezado: nombre + turno + estado */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 truncate">{puesto.nombre}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {puesto.turno && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${TURNO_COLORS[puesto.turno] ?? "text-white/30 bg-white/5 border-white/10"}`}>
                {puesto.turno}
              </span>
            )}
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
            : <Circle className="w-3.5 h-3.5 text-red-400" />
          }
        </div>
      </div>

      {/* Cobertura */}
      {cubierto && puesto.agente_nombre ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(puesto.agente_nombre)}`}>
              {iniciales(puesto.agente_nombre)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] text-white/80 font-medium truncate">{puesto.agente_nombre}</p>
                {!esRelevo && <span className="text-[8px] text-green-400/70 font-bold shrink-0">T</span>}
              </div>
            </div>
          </div>
          {esRelevo && puesto.titular_nombre && (
            <div className="flex items-center gap-1.5 px-1.5 py-1 bg-white/4 rounded-lg border border-white/5">
              <User className="w-2.5 h-2.5 text-white/25 shrink-0" />
              <p className="text-[9px] text-white/35 truncate">
                Titular ausente: <span className="text-white/50">{puesto.titular_nombre}</span>
              </p>
            </div>
          )}
        </div>
      ) : titularAusente ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-white/20">
            <User className="w-4 h-4 shrink-0" />
            <p className="text-[11px]">Sin cobertura</p>
          </div>
          <div className="flex items-center gap-1.5 px-1.5 py-1 bg-red-500/5 rounded-lg border border-red-500/10">
            <User className="w-2.5 h-2.5 text-red-400/40 shrink-0" />
            <p className="text-[9px] text-red-300/50 truncate">
              Titular: <span className="text-red-300/70">{puesto.titular_nombre}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-white/20">
          <User className="w-4 h-4 shrink-0" />
          <p className="text-[11px]">Puesto descubierto</p>
        </div>
      )}

      {/* Horario si existe */}
      {puesto.horario && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 text-white/20 shrink-0" />
          <span className="text-[9px] text-white/25 font-mono">{puesto.horario}</span>
        </div>
      )}

      {/* Sello de solo lectura */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Lock className="w-2.5 h-2.5 text-white/15" />
      </div>
    </div>
  );
}

// ── Columna de Cliente (solo lectura) ─────────────────────────────────────────

function ClienteColumnaHistorico({ cliente }: { cliente: ClienteHistorico }) {
  const cubiertos = cliente.puestos.filter((p) => p.estado === "cubierto" && p.agente_id).length;
  const total     = cliente.puestos.length;
  const pct       = total > 0 ? Math.round((cubiertos / total) * 100) : 0;
  const colorBarra = pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex-shrink-0 w-64 bg-[#060f1a] border border-white/8 rounded-2xl overflow-hidden flex flex-col max-h-full">
      {/* Header cliente */}
      <div className="px-3 py-3 border-b border-white/8">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white truncate">{cliente.clienteNombre}</h3>
            <p className="text-[10px] text-white/35 mt-0.5">{cubiertos}/{total} puestos cubiertos</p>
          </div>
          <div className="shrink-0 text-right">
            <span className={`text-xs font-bold ${pct === 100 ? "text-green-400" : pct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
              {pct}%
            </span>
          </div>
        </div>
        <div className="h-1 bg-white/8 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${colorBarra}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Puestos */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cliente.puestos.map((p) => (
          <PuestoCardHistorico key={p.id} puesto={p} />
        ))}
      </div>
    </div>
  );
}

// ── Componente de Movimientos ─────────────────────────────────────────────────

function MovimientosPanel({ movimientos }: { movimientos: MovimientoHistorico[] }) {
  const [expanded, setExpanded] = useState(false);

  const TIPO_LABELS: Record<string, string> = {
    asignacion:      "Asignación",
    liberacion:      "Liberación",
    relevo:          "Relevo",
    cambio_puesto:   "Cambio de puesto",
    registro_manual: "Manual",
  };
  const TIPO_COLORS: Record<string, string> = {
    asignacion:      "text-green-400 bg-green-500/10 border-green-500/20",
    liberacion:      "text-red-400 bg-red-500/10 border-red-500/20",
    relevo:          "text-amber-400 bg-amber-500/10 border-amber-500/20",
    cambio_puesto:   "text-blue-400 bg-blue-500/10 border-blue-500/20",
    registro_manual: "text-white/40 bg-white/5 border-white/10",
  };

  const formatHora = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" }); }
    catch { return "—"; }
  };

  return (
    <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden shrink-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-semibold text-white/50">
            Movimientos del día
          </span>
          {movimientos.length > 0 && (
            <span className="text-[10px] bg-white/8 text-white/30 px-2 py-0.5 rounded-full">
              {movimientos.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-white/6 divide-y divide-white/4">
          {movimientos.length === 0 ? (
            <div className="px-4 py-4 text-xs text-white/25 text-center">
              Sin movimientos registrados ese día.
            </div>
          ) : (
            movimientos.map((m, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${TIPO_COLORS[m.tipo] ?? TIPO_COLORS["registro_manual"]}`}>
                  {TIPO_LABELS[m.tipo] ?? m.tipo}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/60 truncate">
                    <span className="font-medium text-white/70">{m.puesto_nombre ?? "—"}</span>
                    {m.cliente_nombre ? <span className="text-white/30"> · {m.cliente_nombre}</span> : null}
                  </p>
                  <p className="text-[10px] text-white/30 truncate">
                    {m.agente_saliente_nombre && <span>Salió: {m.agente_saliente_nombre}</span>}
                    {m.agente_saliente_nombre && m.agente_entrante_nombre && " → "}
                    {m.agente_entrante_nombre && <span>Entró: {m.agente_entrante_nombre}</span>}
                    {m.motivo && <span className="text-white/20"> · {m.motivo}</span>}
                  </p>
                </div>
                <span className="text-[10px] text-white/20 font-mono shrink-0 mt-0.5">{formatHora(m.fecha_hora)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PizarronHistorico() {
  const [, setLocation] = useLocation();

  // Leer ?fecha= de la URL si viene desde CierresHistorico
  const fechaFromUrl = (() => {
    try {
      return new URLSearchParams(window.location.search).get("fecha");
    } catch { return null; }
  })();

  const [fechaSel, setFechaSel] = useState<string | null>(fechaFromUrl);

  // Lista de cierres disponibles
  const { data: cierres = [], isLoading: cargandoCierres } = useQuery<CierreListItem[]>({
    queryKey: ["pizarron-historico-cierres-lista"],
    queryFn: () => fetch(`${API_BASE}/operaciones/cierres`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Pizarrón histórico para la fecha seleccionada
  const { data, isLoading: cargandoPizarron, error } = useQuery<PizarronHistoricoData>({
    queryKey: ["pizarron-historico", fechaSel],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/pizarron-historico/${fechaSel}`, { headers: sessionHeader() }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al cargar");
        return r.json();
      }),
    enabled: !!fechaSel,
    staleTime: 300_000,
  });

  // Cuando llegan los cierres y no hay fecha sel, seleccionar el primero automáticamente
  const cierresValidos = cierres.filter((c) => c.estado === "cerrado");
  useEffect(() => {
    if (!fechaSel && cierresValidos.length > 0 && !cargandoCierres) {
      setFechaSel(cierresValidos[0].fecha_iso);
    }
  }, [cierresValidos.length, cargandoCierres, fechaSel]);

  const cierre     = data?.cierre;
  const stats      = data?.stats;
  const tablero    = data?.tableroHistorico ?? [];
  const movimientos = data?.movimientosHoy ?? [];

  const pct = stats ? Math.round((stats.cubiertos / Math.max(stats.totalPuestos, 1)) * 100) : 0;

  return (
    <AdminLayout title="Pizarrón Histórico">
      <div className="flex flex-col h-full gap-4 p-4" style={{ minHeight: 0 }}>

        {/* ── Banner de solo lectura ─────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-2.5">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-300">
              PIZARRÓN HISTÓRICO — SOLO LECTURA
            </p>
            {cierre && (
              <p className="text-[10px] text-amber-300/50 mt-0.5">
                Cerrado por <span className="text-amber-300/70">{cierre.cerrado_por}</span>
                {" "}el{" "}
                <span className="font-mono text-amber-300/70">{cierre.cerrado_en_str}</span>
                {cierre.comentario && <span className="text-amber-300/40"> · {cierre.comentario}</span>}
              </p>
            )}
          </div>
          {cierre?.reabierto_por && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
              <Unlock className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-red-300/70">Fue reabierto</span>
            </div>
          )}
        </div>

        {/* ── Barra de controles ────────────────────────────────────────────── */}
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          {/* Volver */}
          <button
            onClick={() => setLocation("/admin/operaciones/cierres")}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors bg-[#0c1929] border border-white/8 rounded-xl px-3 py-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Historial de cierres
          </button>

          {/* Selector de fecha */}
          <div className="flex items-center gap-2 bg-[#0c1929] border border-white/8 rounded-xl px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-white/30 shrink-0" />
            {cargandoCierres ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />
            ) : (
              <select
                value={fechaSel ?? ""}
                onChange={(e) => setFechaSel(e.target.value)}
                className="bg-transparent text-xs text-white/70 outline-none cursor-pointer"
              >
                <option value="" disabled>Seleccionar fecha…</option>
                {cierres.map((c) => (
                  <option key={c.fecha_iso} value={c.fecha_iso} className="bg-[#0c1929]">
                    {c.fecha_str} — {c.cerrado_por}
                    {c.estado !== "cerrado" ? " (reabierto)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Stats snapshot */}
          {stats && (
            <div className="flex items-center gap-3 bg-[#0c1929] border border-white/8 rounded-xl px-4 py-2">
              <div className="text-center">
                <p className={`text-sm font-bold leading-none ${pct === 100 ? "text-green-400" : pct >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                  {pct}%
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">Cobertura</p>
              </div>
              <div className="w-px h-7 bg-white/8" />
              <div className="text-center">
                <p className="text-sm font-bold text-green-400 leading-none">{stats.cubiertos}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Cubiertos</p>
              </div>
              <div className="w-px h-7 bg-white/8" />
              <div className="text-center">
                <p className={`text-sm font-bold leading-none ${stats.descubiertos > 0 ? "text-red-400" : "text-white/20"}`}>
                  {stats.descubiertos}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">Descubiertos</p>
              </div>
              <div className="w-px h-7 bg-white/8" />
              <div className="text-center">
                <p className={`text-sm font-bold leading-none ${stats.ausencias > 0 ? "text-orange-400" : "text-white/20"}`}>
                  {stats.ausencias}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">Ausencias</p>
              </div>
              {stats.cubiertosPorRelevo > 0 && (
                <>
                  <div className="w-px h-7 bg-white/8" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-amber-400 leading-none">{stats.cubiertosPorRelevo}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Relevos</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Indicadores */}
          {cierre && (
            <div className="flex items-center gap-1.5 ml-auto">
              <History className="w-3.5 h-3.5 text-white/20" />
              <span className="text-xs text-white/25 font-mono">{cierre.fecha_str}</span>
            </div>
          )}
        </div>

        {/* ── Área principal ────────────────────────────────────────────────── */}
        {!fechaSel ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Calendar className="w-10 h-10 text-white/10 mx-auto" />
              <p className="text-sm text-white/30">Selecciona una fecha para ver el pizarrón</p>
            </div>
          </div>
        ) : cargandoPizarron ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-white/40">Cargando pizarrón histórico…</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 max-w-sm text-center">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
              No se pudo cargar el pizarrón para esa fecha.
            </div>
          </div>
        ) : tablero.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Shield className="w-10 h-10 text-white/10 mx-auto" />
              <p className="text-sm text-white/30">No hay datos de puestos en el snapshot de ese cierre.</p>
              <p className="text-xs text-white/20">
                Los cierres anteriores a la actualización del sistema pueden no tener snapshot completo.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Columnas de clientes — tablero horizontal scrollable */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-3 h-full pb-2" style={{ minWidth: "max-content" }}>
                {tablero.map((cliente) => (
                  <ClienteColumnaHistorico key={`${cliente.clienteId ?? cliente.clienteNombre}`} cliente={cliente} />
                ))}
              </div>
            </div>

            {/* Movimientos del día */}
            <MovimientosPanel movimientos={movimientos} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
