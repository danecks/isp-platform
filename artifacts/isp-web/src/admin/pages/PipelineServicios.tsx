import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Plus, X, Search, ChevronDown, Loader2,
  LayoutGrid, CheckCircle, Clock, AlertTriangle, XCircle, DollarSign,
  Users, Settings, FileText, RefreshCw, ChevronRight, Info, Building2,
} from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

const API_BASE = "/api";

function getSession() { return getSessionToken(); }

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-isp-session": getSession() },
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `Error ${res.status}`); }
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `Error ${res.status}`); }
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `Error ${res.status}`); }
  return res.json();
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SolicitudSSA {
  id: string;
  cliente_id: number | null;
  sede_id: number | null;
  puesto_id: number | null;
  tipo_solicitud: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  cantidad_guardias: number;
  descripcion: string | null;
  prioridad: string;
  contacto_solicitante: string | null;
  acepta_cobro_adicional: boolean;
  origen: string;
  estado_general: string;
  estado_operaciones: string;
  estado_rrhh: string;
  estado_comercial: string;
  observaciones_operaciones: string | null;
  observaciones_rrhh: string | null;
  observaciones_comercial: string | null;
  monto_estimado: string | null;
  tarifa_aplicada: string | null;
  estado_facturacion: string;
  cubierta_con: string | null;
  tarea_operaciones_id: string | null;
  tarea_rrhh_id: string | null;
  tarea_comercial_id: string | null;
  cliente_nombre: string | null;
  sede_nombre: string | null;
  puesto_nombre: string | null;
  tarea_ops_estado: string | null;
  tarea_rrhh_estado: string | null;
  tarea_comercial_estado: string | null;
  solicitado_por_nombre: string | null;
  created_at: string;
  motivo_cancelacion: string | null;
  cancelado_por: string | null;
  cancelado_at: string | null;
}

interface StatsSSA {
  total: number; nuevas: number; en_revision: number; en_proceso: number;
  cubiertas: number; cerradas: number; canceladas: number; urgentes: number;
}

interface ClienteItem { id: number; nombre: string; }

// ─── Config visual ────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  guardia_extra: "Guardia Extra",
  ampliacion_horario: "Ampliación de Horario",
  cobertura_evento: "Cobertura de Evento",
  custodia_extra: "Custodia Extra",
  apoyo_temporal: "Apoyo Temporal",
};

const ESTADO_GENERAL_CFG: Record<string, { label: string; color: string }> = {
  nueva:                 { label: "Nueva",               color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  en_revision:           { label: "En Revisión",         color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  pendiente_rrhh:        { label: "Pendiente RRHH",      color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  pendiente_operaciones: { label: "Pendiente Ops",       color: "text-blue-300 bg-blue-300/10 border-blue-300/20" },
  pendiente_facturacion: { label: "Pendiente Factur.",   color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  cubierta:              { label: "Cubierta",            color: "text-green-400 bg-green-400/10 border-green-400/20" },
  cerrada:               { label: "Cerrada",             color: "text-gray-400 bg-gray-400/10 border-gray-400/20" },
  cancelada:             { label: "Cancelada",           color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

const ESTADO_AREA_CFG: Record<string, string> = {
  pendiente: "text-gray-400 bg-gray-400/10",
  en_proceso: "text-yellow-400 bg-yellow-400/10",
  viable: "text-green-400 bg-green-400/10",
  no_viable: "text-red-400 bg-red-400/10",
  cubierta: "text-green-400 bg-green-400/10",
  requiere_contratacion: "text-orange-400 bg-orange-400/10",
  requiere_reasignacion: "text-yellow-400 bg-yellow-400/10",
  registrado: "text-blue-400 bg-blue-400/10",
  pendiente_cobro: "text-orange-400 bg-orange-400/10",
  facturado: "text-cyan-400 bg-cyan-400/10",
  cobrado: "text-green-400 bg-green-400/10",
};

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: "text-red-400 bg-red-400/10",
  alta:    "text-orange-400 bg-orange-400/10",
  normal:  "text-blue-400 bg-blue-400/10",
  baja:    "text-gray-400 bg-gray-400/10",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PipelineServicios() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [showCrear, setShowCrear] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: stats } = useQuery<StatsSSA>({
    queryKey: ["ssa-stats"],
    queryFn: () => apiGet("/solicitudes-servicio/stats"),
    refetchInterval: 30000,
  });

  const { data: solicitudes = [], isLoading, refetch } = useQuery<SolicitudSSA[]>({
    queryKey: ["ssa-list", filtroEstado],
    queryFn: () => apiGet(`/solicitudes-servicio?estado=${filtroEstado}&limit=200`),
    refetchInterval: 30000,
  });

  const { data: detalleData } = useQuery<SolicitudSSA>({
    queryKey: ["ssa-detalle", detalleId],
    queryFn: () => apiGet(`/solicitudes-servicio/${detalleId}`),
    enabled: !!detalleId,
  });

  const filtradas = solicitudes.filter((s) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      (s.cliente_nombre ?? "").toLowerCase().includes(q) ||
      (TIPO_LABELS[s.tipo_solicitud] ?? s.tipo_solicitud).toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout title="Servicios Adicionales">
      <div className="p-6 space-y-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              Pipeline de Servicios Adicionales
            </h1>
            <p className="text-sm text-white/40 mt-0.5">
              Solicitudes de clientes — seguimiento coordinado entre Operaciones, RRHH y Comercial
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-white/8 text-white/40 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCrear(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-[#060e1c] text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva Solicitud
            </button>
          </div>
        </div>

        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Total", val: stats.total, color: "text-white" },
              { label: "Nuevas", val: stats.nuevas, color: "text-blue-400" },
              { label: "En revisión", val: stats.en_revision, color: "text-yellow-400" },
              { label: "En proceso", val: stats.en_proceso, color: "text-blue-300" },
              { label: "Cubiertas", val: stats.cubiertas, color: "text-green-400" },
              { label: "Cerradas", val: stats.cerradas, color: "text-gray-400" },
              { label: "Canceladas", val: stats.canceladas, color: "text-red-400" },
              { label: "Urgentes", val: stats.urgentes, color: "text-red-400 font-bold" },
            ].map((s) => (
              <div key={s.label} className="bg-white/2 border border-white/7 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48 bg-white/3 border border-white/8 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-white/30 shrink-0" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por ID, cliente o tipo..."
              className="bg-transparent text-sm text-white placeholder-white/25 flex-1 outline-none"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-white/3 border border-white/8 rounded-xl px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_GENERAL_CFG).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Tabla / lista */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-white/5 bg-white/2">
            <Zap className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No hay solicitudes que coincidan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map((s) => (
              <SolicitudRow key={s.id} solicitud={s} onDetalle={() => setDetalleId(s.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Modal crear */}
      {showCrear && (
        <ModalCrear
          onClose={() => setShowCrear(false)}
          onCreated={() => {
            setShowCrear(false);
            qc.invalidateQueries({ queryKey: ["ssa-list"] });
            qc.invalidateQueries({ queryKey: ["ssa-stats"] });
            toast({ title: "Solicitud creada", description: "Las 3 tareas de área fueron generadas automáticamente." });
          }}
        />
      )}

      {/* Modal detalle */}
      {detalleId && detalleData && (
        <ModalDetalle
          solicitud={detalleData}
          onClose={() => setDetalleId(null)}
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ["ssa-detalle", detalleId] });
            qc.invalidateQueries({ queryKey: ["ssa-list"] });
            qc.invalidateQueries({ queryKey: ["ssa-stats"] });
          }}
        />
      )}
    </AdminLayout>
  );
}

// ─── Fila de solicitud ────────────────────────────────────────────────────────

function SolicitudRow({ solicitud: s, onDetalle }: { solicitud: SolicitudSSA; onDetalle: () => void }) {
  const estadoCfg = ESTADO_GENERAL_CFG[s.estado_general] ?? { label: s.estado_general, color: "text-gray-400 bg-gray-400/10 border-gray-400/20" };
  const fecha = new Date(s.fecha + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div
      onClick={onDetalle}
      className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-white/6 bg-white/2 hover:bg-white/4 hover:border-white/10 cursor-pointer transition-all group"
    >
      {/* ID + tipo */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[10px] font-mono text-white/30">{s.id}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORIDAD_COLOR[s.prioridad] ?? "text-gray-400 bg-gray-400/10"}`}>
            {s.prioridad === "urgente" ? "⚡ URGENTE" : s.prioridad}
          </span>
          <span className="text-[10px] text-white/25">{s.origen === "portal_cliente" ? "Portal" : s.origen}</span>
        </div>
        <p className="text-sm font-semibold text-white truncate">
          {TIPO_LABELS[s.tipo_solicitud] ?? s.tipo_solicitud}
        </p>
        <p className="text-xs text-white/40">{s.cliente_nombre ?? "—"} · {fecha}</p>
      </div>

      {/* Estado general */}
      <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-1 rounded-full border ${estadoCfg.color} whitespace-nowrap`}>
        {estadoCfg.label}
      </span>

      {/* Estados por área */}
      <div className="hidden lg:flex gap-1.5">
        <AreaBadge icon={Settings} label="Ops" estado={s.estado_operaciones} />
        <AreaBadge icon={Users} label="RRHH" estado={s.estado_rrhh} />
        <AreaBadge icon={DollarSign} label="Comercial" estado={s.estado_comercial} />
      </div>

      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
    </div>
  );
}

function AreaBadge({ icon: Icon, label, estado }: { icon: React.ElementType; label: string; estado: string }) {
  const colorCls = ESTADO_AREA_CFG[estado] ?? "text-gray-400 bg-gray-400/10";
  return (
    <span className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${colorCls}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// ─── Modal Detalle / Gestión ──────────────────────────────────────────────────

interface ModalDetalleProps {
  solicitud: SolicitudSSA;
  onClose: () => void;
  onRefresh: () => void;
}

function ModalDetalle({ solicitud: s, onClose, onRefresh }: ModalDetalleProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"resumen" | "operaciones" | "rrhh" | "comercial">("resumen");

  // Ops
  const [estadoOps, setEstadoOps]       = useState(s.estado_operaciones);
  const [obsOps, setObsOps]             = useState(s.observaciones_operaciones ?? "");
  const [cubiertaCon, setCubiertaCon]   = useState(s.cubierta_con ?? "");

  // RRHH
  const [estadoRrhh, setEstadoRrhh]     = useState(s.estado_rrhh);
  const [obsRrhh, setObsRrhh]           = useState(s.observaciones_rrhh ?? "");

  // Comercial
  const [estadoComercial, setEstadoCom] = useState(s.estado_comercial);
  const [montoEstimado, setMonto]       = useState(s.monto_estimado ?? "");
  const [tarifa, setTarifa]             = useState(s.tarifa_aplicada ?? "");
  const [obsCom, setObsCom]             = useState(s.observaciones_comercial ?? "");

  const [saving, setSaving] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [cancelando, setCancelando] = useState(false);

  async function cancelarSolicitud() {
    setCancelando(true);
    try {
      await apiPatch(`/solicitudes-servicio/${s.id}/cancelar`, { motivoCancelacion: motivoCancelacion || null });
      onRefresh();
      onClose();
      toast({ title: "Servicio cancelado", description: "La solicitud fue marcada como cancelada." });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setCancelando(false);
  }

  async function saveOps() {
    setSaving(true);
    try {
      await apiPatch(`/solicitudes-servicio/${s.id}/operaciones`, {
        estadoOperaciones: estadoOps, observaciones: obsOps || null, cubiertaCon: cubiertaCon || null,
      });
      onRefresh();
      toast({ title: "Operaciones actualizado" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSaving(false);
  }

  async function saveRrhh() {
    setSaving(true);
    try {
      await apiPatch(`/solicitudes-servicio/${s.id}/rrhh`, {
        estadoRrhh, observaciones: obsRrhh || null,
      });
      onRefresh();
      toast({ title: "RRHH actualizado" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSaving(false);
  }

  async function saveComercial() {
    setSaving(true);
    try {
      await apiPatch(`/solicitudes-servicio/${s.id}/comercial`, {
        estadoComercial,
        montoEstimado: montoEstimado ? Number(montoEstimado) : null,
        tarifaAplicada: tarifa || null,
        observaciones: obsCom || null,
      });
      onRefresh();
      toast({ title: "Comercial actualizado" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSaving(false);
  }

  const estadoCfg = ESTADO_GENERAL_CFG[s.estado_general] ?? { label: s.estado_general, color: "text-gray-400 bg-gray-400/10 border-gray-400/20" };
  const fecha = new Date(s.fecha + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-white/7 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-white/30">{s.id}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoCfg.color}`}>
                {estadoCfg.label}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORIDAD_COLOR[s.prioridad] ?? "text-gray-400 bg-gray-400/10"}`}>
                {s.prioridad === "urgente" ? "⚡ URGENTE" : s.prioridad}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{TIPO_LABELS[s.tipo_solicitud] ?? s.tipo_solicitud}</h2>
            <p className="text-sm text-white/40">{s.cliente_nombre ?? "—"} · {fecha}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white ml-4 shrink-0 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/7 px-6 shrink-0">
          {(["resumen", "operaciones", "rrhh", "comercial"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors capitalize ${
                tab === t ? "border-primary text-primary" : "border-transparent text-white/35 hover:text-white/70"
              }`}
            >
              {t === "resumen" ? "Resumen" : t === "operaciones" ? "Operaciones" : t === "rrhh" ? "RRHH" : "Comercial"}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* ── Tab: Resumen ───────────────────────────────────────────────── */}
          {tab === "resumen" && (
            <div className="space-y-5">
              {/* Datos de la solicitud */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Tipo de servicio", TIPO_LABELS[s.tipo_solicitud] ?? s.tipo_solicitud],
                  ["Cliente", s.cliente_nombre ?? "—"],
                  ["Sede", s.sede_nombre ?? "—"],
                  ["Puesto", s.puesto_nombre ?? "—"],
                  ["Fecha", fecha],
                  ["Horario", s.hora_inicio ? `${s.hora_inicio} – ${s.hora_fin ?? "?"}` : "No especificado"],
                  ["Guardias solicitados", String(s.cantidad_guardias)],
                  ["Origen", s.origen === "portal_cliente" ? "Portal de Cliente" : s.origen],
                  ["Contacto", s.contacto_solicitante ?? "—"],
                  ["Acepta cobro adicional", s.acepta_cobro_adicional ? "Sí" : "No"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">{k}</p>
                    <p className="text-sm text-white font-medium">{v}</p>
                  </div>
                ))}
              </div>

              {s.descripcion && (
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-wide mb-1">Descripción</p>
                  <p className="text-sm text-white/70 leading-relaxed">{s.descripcion}</p>
                </div>
              )}

              {/* Estado por área */}
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3">Estado por Área</p>
                <div className="grid grid-cols-3 gap-3">
                  <AreaCard title="Operaciones" estado={s.estado_operaciones} tareaId={s.tarea_operaciones_id} tareaEstado={s.tarea_ops_estado} obs={s.observaciones_operaciones} icon={Settings} />
                  <AreaCard title="RRHH" estado={s.estado_rrhh} tareaId={s.tarea_rrhh_id} tareaEstado={s.tarea_rrhh_estado} obs={s.observaciones_rrhh} icon={Users} />
                  <AreaCard title="Comercial" estado={s.estado_comercial} tareaId={s.tarea_comercial_id} tareaEstado={s.tarea_comercial_estado} obs={s.observaciones_comercial} icon={DollarSign} monto={s.monto_estimado} />
                </div>
              </div>

              {/* Tareas relacionadas */}
              {(s.tarea_operaciones_id || s.tarea_rrhh_id || s.tarea_comercial_id) && (
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Tareas vinculadas</p>
                  <div className="space-y-1.5">
                    {[
                      { id: s.tarea_operaciones_id, area: "Operaciones", estado: s.tarea_ops_estado },
                      { id: s.tarea_rrhh_id, area: "RRHH", estado: s.tarea_rrhh_estado },
                      { id: s.tarea_comercial_id, area: "Comercial", estado: s.tarea_comercial_estado },
                    ].filter((t) => t.id).map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                        <FileText className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-xs font-mono text-white/50">{t.id}</span>
                        <span className="text-xs text-white/60 flex-1">{t.area}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ESTADO_AREA_CFG[t.estado ?? "pendiente"] ?? "text-gray-400 bg-gray-400/10"}`}>
                          {t.estado ?? "pendiente"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Operaciones ───────────────────────────────────────────── */}
          {tab === "operaciones" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-2 text-xs text-blue-300/80">
                <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                Revisar la solicitud, evaluar cobertura con personal disponible y actualizar el estado. Si se cubre, indicar con qué recurso.
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Estado Operaciones</label>
                <select value={estadoOps} onChange={(e) => setEstadoOps(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="viable">Viable — puede cubrirse</option>
                  <option value="cubierta">Cubierta</option>
                  <option value="no_viable">No viable</option>
                </select>
              </div>

              {estadoOps === "cubierta" && (
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Cubierta con</label>
                  <select value={cubiertaCon} onChange={(e) => setCubiertaCon(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                    <option value="">Seleccionar...</option>
                    <option value="disponible">Personal disponible</option>
                    <option value="relevo">Relevo / cobertura</option>
                    <option value="contratacion">Nueva contratación</option>
                    <option value="reasignacion">Reasignación interna</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Observaciones</label>
                <textarea rows={4} value={obsOps} onChange={(e) => setObsOps(e.target.value)} placeholder="Notas del equipo de operaciones..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none resize-none" />
              </div>

              <button onClick={saveOps} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Guardar — Operaciones
              </button>
            </div>
          )}

          {/* ── Tab: RRHH ──────────────────────────────────────────────────── */}
          {tab === "rrhh" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 flex gap-2 text-xs text-purple-300/80">
                <Info className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                Validar disponibilidad de personal para cubrir el servicio. Indicar si se cubre con el pool actual, requiere contratación o reasignación.
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Estado RRHH</label>
                <select value={estadoRrhh} onChange={(e) => setEstadoRrhh(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                  <option value="pendiente">Pendiente revisión</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="viable">Viable — hay personal disponible</option>
                  <option value="requiere_contratacion">Requiere Contratación</option>
                  <option value="requiere_reasignacion">Requiere Reasignación</option>
                  <option value="no_viable">No viable</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Observaciones RRHH</label>
                <textarea rows={4} value={obsRrhh} onChange={(e) => setObsRrhh(e.target.value)} placeholder="Disponibilidad de personal, restricciones, propuestas de asignación..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none resize-none" />
              </div>

              <button onClick={saveRrhh} disabled={saving} className="w-full py-2.5 rounded-xl bg-purple-700 text-white text-sm font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Guardar — RRHH
              </button>
            </div>
          )}

          {/* ── Tab: Comercial ─────────────────────────────────────────────── */}
          {tab === "comercial" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 flex gap-2 text-xs text-green-300/80">
                <Info className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                Registrar la tarifa y monto del servicio adicional. Dar seguimiento hasta confirmación de cobro.
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Estado Comercial</label>
                <select value={estadoComercial} onChange={(e) => setEstadoCom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                  <option value="pendiente">Pendiente registro</option>
                  <option value="registrado">Registrado</option>
                  <option value="pendiente_cobro">Pendiente de Cobro</option>
                  <option value="facturado">Facturado</option>
                  <option value="cobrado">Cobrado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Monto Estimado (Q)</label>
                  <input type="number" min={0} step={0.01} value={montoEstimado} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Tarifa Aplicada</label>
                  <input type="text" value={tarifa} onChange={(e) => setTarifa(e.target.value)} placeholder="Ej: Q250/guardia/hora" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Observaciones Comercial</label>
                <textarea rows={4} value={obsCom} onChange={(e) => setObsCom(e.target.value)} placeholder="Notas de facturación, condiciones, pendientes de cobro..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none resize-none" />
              </div>

              <button onClick={saveComercial} disabled={saving} className="w-full py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                Guardar — Comercial
              </button>
            </div>
          )}
        </div>

        {/* ── Footer: Cancelar Servicio ────────────────────────────────────── */}
        {s.estado_general !== "cancelada" && s.estado_general !== "cerrada" && (
          <div className="border-t border-white/7 px-6 py-4 shrink-0">
            {!cancelConfirm ? (
              <button
                onClick={() => setCancelConfirm(true)}
                className="flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancelar este servicio
              </button>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm font-semibold text-red-300">¿Confirmar cancelación del servicio?</p>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Esta acción marcará la solicitud como <span className="text-red-400 font-semibold">Cancelada</span>. No se puede deshacer automáticamente.
                </p>
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Motivo de cancelación <span className="text-white/25 font-normal">(opcional)</span></label>
                  <textarea
                    rows={2}
                    value={motivoCancelacion}
                    onChange={(e) => setMotivoCancelacion(e.target.value)}
                    placeholder="Ej: Cliente solicitó cancelación, ajuste presupuestario..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cancelarSolicitud}
                    disabled={cancelando}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cancelando ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Sí, cancelar servicio
                  </button>
                  <button
                    onClick={() => { setCancelConfirm(false); setMotivoCancelacion(""); }}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-semibold transition-colors"
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mostrar info de cancelación si ya está cancelada */}
        {s.estado_general === "cancelada" && (
          <div className="border-t border-white/7 px-6 py-3 shrink-0">
            <div className="flex items-start gap-2 text-xs text-red-400/70">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Servicio cancelado</span>
                {s.cancelado_por && <span className="text-white/30"> · por {s.cancelado_por}</span>}
                {s.motivo_cancelacion && <span className="text-white/40 block mt-0.5">{s.motivo_cancelacion}</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tarjeta de área en resumen ───────────────────────────────────────────────

function AreaCard({ title, estado, tareaId, tareaEstado, obs, icon: Icon, monto }: {
  title: string; estado: string; tareaId: string | null; tareaEstado: string | null;
  obs: string | null; icon: React.ElementType; monto?: string | null;
}) {
  const colorCls = ESTADO_AREA_CFG[estado] ?? "text-gray-400 bg-gray-400/10";
  return (
    <div className="rounded-xl border border-white/7 bg-white/2 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-white/40" />
        <span className="text-xs font-bold text-white/70">{title}</span>
      </div>
      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorCls}`}>
        {estado.replace(/_/g, " ")}
      </span>
      {tareaId && (
        <p className="text-[10px] font-mono text-white/30">
          Tarea: {tareaId}
          {tareaEstado && <span className="ml-1 text-white/20">({tareaEstado})</span>}
        </p>
      )}
      {monto && <p className="text-xs text-green-400 font-semibold">Q{Number(monto).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>}
      {obs && <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">{obs}</p>}
    </div>
  );
}

// ─── Modal Crear solicitud (admin) ────────────────────────────────────────────

const TIPOS_SERVICIO = [
  "guardia_extra", "ampliacion_horario", "cobertura_evento", "custodia_extra", "apoyo_temporal",
];

function ModalCrear({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { data: clientes = [] } = useQuery<ClienteItem[]>({
    queryKey: ["clientes-lista-simple"],
    queryFn: () => apiGet<{ id: number; nombre: string }[]>("/alias/clientes").catch(() => [] as ClienteItem[]),
  });

  const [form, setForm] = useState({
    clienteId: "", tipoSolicitud: "", fecha: new Date().toISOString().slice(0, 10),
    horaInicio: "", horaFin: "", cantidadGuardias: 1,
    descripcion: "", prioridad: "normal", contactoSolicitante: "",
    aceptaCobroAdicional: false, origen: "admin",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => apiPost("/solicitudes-servicio", { ...data, clienteId: data.clienteId ? Number(data.clienteId) : null }),
    onSuccess: () => onCreated(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm((p) => ({ ...p, [k]: v })); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tipoSolicitud || !form.fecha) {
      toast({ title: "Tipo y fecha son requeridos", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/7 shrink-0">
          <h2 className="text-base font-bold text-white">Nueva Solicitud — Panel Admin</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Cliente</label>
              <select value={form.clienteId} onChange={(e) => set("clienteId", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                <option value="">Sin cliente específico</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Tipo de Servicio *</label>
              <select required value={form.tipoSolicitud} onChange={(e) => set("tipoSolicitud", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                <option value="">Seleccionar...</option>
                {TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Fecha *</label>
              <input type="date" required value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Hora inicio</label>
              <input type="time" value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Hora fin</label>
              <input type="time" value={form.horaFin} onChange={(e) => set("horaFin", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Guardias</label>
              <input type="number" min={1} value={form.cantidadGuardias} onChange={(e) => set("cantidadGuardias", Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Prioridad</label>
              <select value={form.prioridad} onChange={(e) => set("prioridad", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Origen</label>
            <select value={form.origen} onChange={(e) => set("origen", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
              <option value="admin">Panel Admin</option>
              <option value="operaciones">Operaciones</option>
              <option value="comercial">Comercial</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Contacto solicitante</label>
            <input type="text" value={form.contactoSolicitante} onChange={(e) => set("contactoSolicitante", e.target.value)} placeholder="Nombre y teléfono" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">Descripción</label>
            <textarea rows={3} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Contexto, ubicación, requerimientos..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none resize-none" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.aceptaCobroAdicional} onChange={(e) => set("aceptaCobroAdicional", e.target.checked)} className="w-4 h-4 accent-yellow-400" />
            <span className="text-sm text-white/70">Acepta cobro adicional</span>
          </label>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-white/7 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} className="flex-1 py-2.5 rounded-xl bg-primary text-[#060e1c] text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Crear + Generar Tareas
          </button>
        </div>
      </div>
    </div>
  );
}
