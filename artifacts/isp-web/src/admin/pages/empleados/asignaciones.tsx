import { useState, useEffect, useRef, type ElementType } from "react";
  import { QRCodeSVG } from "qrcode.react";
  import { createPortal } from "react-dom";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  import DescansoSemanalEditor from "../../components/DescansoSemanalEditor";
  import { getSessionToken } from "@/lib/httpClient";
  import {
    type Empleado, type KpiData, type Asignacion, type UserVinculado, type PuestoTitular, type HistorialRelevo,
    type OperacionData, type EventoKPIFront, type KPIDisciplinario, type MovimientoRotacion, type KPIRotacion,
    type FormState, type AsignacionOperativa, type TipoPersonalConfig,
    API_BASE, sessionHeader, iniciales, fmtFecha, fmtRelativa, fmtQ, maskDpi,
    ESTADO_LAB, AVATAR_COLORS, avatarColor, FORM_EMPTY, TIPO_PERSONAL_CFG,
    VALID_TIPOS_PERSONAL, useTiposPersonal, TipoPersonalBadge, EstadoBadge,
    KpiCard, ProgressBar,
  } from "./shared";
  
export function TabAsignaciones({ empId }: { empId: number }) {
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


export interface ZonaBasic {
  id: number;
  nombre: string;
  descripcion: string | null;
  total_puestos: number;
  total_clientes: number;
  estado: string;
}

export function TabOperacion({ empId }: { empId: number }) {
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


export interface HistorialCobertura {
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

export interface HistorialTitularidad {
  puesto_id: number;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo: string | null;
}

export interface HistorialData {
  coberturas: HistorialCobertura[];
  titularidades: HistorialTitularidad[];
  titularActual: { puesto_id: number; puesto_nombre: string | null; cliente_nombre: string | null; fecha_inicio: string } | null;
}

export const TIPO_COBERTURA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  relevo:                   { label: "Relevo",              color: "text-blue-300",   bg: "bg-blue-500/15 border-blue-500/25" },
  titular:                  { label: "Titular",             color: "text-green-300",  bg: "bg-green-500/15 border-green-500/25" },
  cobertura_supervisor:     { label: "Cob. Supervisor",     color: "text-orange-300", bg: "bg-orange-500/15 border-orange-500/25" },
  cobertura_jefe_servicio:  { label: "Cob. Jefe Servicio",  color: "text-amber-300",  bg: "bg-amber-500/15 border-amber-500/25" },
};

export function TabHistorialAsignaciones({ empId }: { empId: number }) {
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


export const TIPO_ASIG_CFG: Record<string, { label: string; color: string; bg: string }> = {
  titular:       { label: "Titular",         color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
  disponible:    { label: "Disponible",       color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20" },
  pool_relevo:   { label: "Pool de relevos",  color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  sin_asignacion:{ label: "Sin asignación",   color: "text-white/40",   bg: "bg-white/5 border-white/10" },
};

export interface PuestoBasic { id: number; nombre: string; cliente_nombre: string; sede_id: number | null; sede_nombre: string | null; zona_operativa_id: number | null; }
export interface ZonaBasicEOA { id: number; nombre: string; supervisor_nombre: string | null; }
export interface TurnoBasicEOA { id: number; nombre: string; horas_trabajo: number; horas_descanso: number; }

export interface TitularHistorialRow {
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

export function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function HistorialTitularEmp({ empId }: { empId: number }) {
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

export function TabAsignacionOperativa({ empId }: { empId: number }) {
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

