import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { AdminLayout } from "../layout/AdminLayout";
import {
  ClipboardList, AlertTriangle, RefreshCw, FileText,
  Download, CheckCircle2, Clock, Loader2, X,
  User, Building2, Briefcase, Search,
  Shield, Calendar, BookOpen, Ban, XCircle,
  AlertCircle, ChevronDown, Plus,
  ShieldAlert, ShieldCheck, ShieldOff, BarChart2,
  TrendingUp, ArrowUpRight, Minus, Users2, Palmtree,
  Bell, ThumbsUp, ThumbsDown, CheckCheck, Printer,
  MapPin, Activity, Archive, Settings, Save,
} from "lucide-react";
import VacacionesTab from "./VacacionesTab";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { EventoRrhh, DatosActa } from "@/lib/pdfRrhh";
import {
  generarBoletaDescuento, generarActaAdministrativa,
  generarConstanciaHorasExtra, generarDocumentoAnulacion,
  generarAvisoInspector,
  MOTIVO_ANULACION_LABELS,
} from "@/lib/pdfRrhh";
import { getSessionToken } from "@/lib/httpClient";

const API = "/api";
const getSession = () => getSessionToken();

async function construirDatosActa(evento: EventoRrhh): Promise<DatosActa> {
  const hdr = { "x-isp-session": getSession() };
  const [configRes, numRes] = await Promise.all([
    fetch(`${API}/actas/datos-para-pdf/${evento.employee_id}`, { headers: hdr }).then(r => r.ok ? r.json() : null),
    fetch(`${API}/actas/siguiente-numero`, { method: "POST", headers: { ...hdr, "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : { numero: evento.id }),
  ]);

  const cfg = configRes?.config || {};
  const emp = configRes?.empleado || {};
  const puesto = configRes?.puesto || {};
  const historial = (configRes?.eventos_recientes || [])
    .filter((e: any) => ["falta","falta_injustificada","llamada_atencion_1","llamada_atencion_2","acta_administrativa","amonestacion","suspension","suspension_disciplinaria"].includes(e.tipo_evento))
    .slice(0, 10);

  const notas: string[] = [];
  if (evento.notas) notas.push(evento.notas);
  if (evento.observaciones && evento.observaciones !== evento.notas) notas.push(evento.observaciones);

  const tipoTexto = evento.tipo_evento === "falta" || evento.tipo_evento === "falta_injustificada"
    ? "ABANDONO DEL PUESTO DE TRABAJO" : "INCUMPLIMIENTO LABORAL";

  const hechos = evento.observaciones ||
    `El trabajador ${(emp.nombre_completo || evento.employee_nombre).toUpperCase()} no se presentó ` +
    `a sus labores el día ${new Date(evento.fecha).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" })}, ` +
    `en el puesto "${puesto.puesto_nombre || evento.puesto_nombre || "asignado"}" ` +
    `del cliente ${puesto.cliente_nombre || evento.cliente_nombre || "asignado"}, ` +
    `sin dar aviso ni justificación alguna, generando descubierto en la cobertura operativa.`;

  const causalesAuto: string[] = [];
  if (evento.tipo_evento === "falta" || evento.tipo_evento === "falta_injustificada") {
    causalesAuto.push("falta_injustificada");
  } else if (evento.tipo_evento === "abandono_parcial") {
    causalesAuto.push("ausencia_sin_permiso");
  }

  return {
    numero_acta: numRes.numero || evento.id,
    representante_nombre: cfg.representante_nombre || "Representante Legal",
    representante_dpi: cfg.representante_dpi || "",
    direccion_empresa: cfg.direccion_empresa || "14 calle 15-52 zona 1, Barrio Gerona, Ciudad de Guatemala",
    nombre_empresa: cfg.nombre_empresa || "Investigaciones y Seguridad Profesional S.A.",
    empleado_nombre: emp.nombre_completo || evento.employee_nombre,
    empleado_dpi: emp.dpi || evento.employee_dpi || "",
    empleado_fecha_ingreso: emp.fecha_ingreso || "",
    empleado_cargo: emp.cargo || "Agente de Seguridad",
    puesto_nombre: puesto.puesto_nombre || evento.puesto_nombre || "",
    cliente_nombre: puesto.cliente_nombre || evento.cliente_nombre || "",
    fecha_evento: evento.fecha,
    hechos,
    notas_sistema: notas,
    causal: tipoTexto,
    articulo_legal: "Art. 77 inciso f)",
    eventos_historial: historial.map((e: any) => ({ fecha: e.fecha, tipo: e.tipo_evento, notas: e.notas || e.observaciones || "" })),
    causales_seleccionadas: causalesAuto,
  };
}

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { "x-isp-session": getSession() } });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
}

async function apiPatch(url: string, body: object): Promise<any> {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

async function apiPost(url: string, body: object): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

// ─── Configuración de estados ─────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pendiente_aprobacion: {
    label: "Pendiente aprobación",
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: <Clock className="w-3 h-3" />,
  },
  aprobado: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rechazado: {
    label: "Rechazado",
    className: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: <Ban className="w-3 h-3" />,
  },
  pagado_efectivo: {
    label: "Pagado en efectivo",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  anulado: {
    label: "ANULADO",
    className: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: <Ban className="w-3 h-3" />,
  },
  pendiente: {
    label: "Pendiente aprobación",
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: <Clock className="w-3 h-3" />,
  },
  activo: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  en_proceso: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cerrado: {
    label: "Aprobado",
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

const TIPO_CONFIG: Record<string, { label: string; className: string }> = {
  falta:                { label: "Falta injustificada",          className: "text-red-400 bg-red-400/10 border-red-400/20" },
  falta_injustificada:  { label: "Falta injustificada",          className: "text-red-400 bg-red-400/10 border-red-400/20" },
  suspension:           { label: "Suspensión",                   className: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  incapacidad:          { label: "Incapacidad",                  className: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  permiso_goce_sueldo:  { label: "Permiso con goce de sueldo",  className: "text-green-400 bg-green-400/10 border-green-400/20" },
  amonestacion:         { label: "Amonestación",                 className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  vacaciones:           { label: "Vacaciones",                   className: "text-teal-400 bg-teal-400/10 border-teal-400/20" },
  horas_extra:          { label: "Horas Extra (cobertura)",      className: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  permiso_sin_goce:     { label: "Permiso sin goce de sueldo",   className: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  permiso_con_goce:     { label: "Permiso con goce de sueldo",   className: "text-green-400 bg-green-400/10 border-green-400/20" },
  abandono_parcial:     { label: "Abandono parcial",             className: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  suspension_disciplinaria: { label: "Suspensión disciplinaria", className: "text-red-500 bg-red-500/10 border-red-500/20" },
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function fmtDateTime(iso: string): string {
  return `${fmtFecha(iso)} ${fmtHora(iso)}`;
}

// ─── Tipos de evento RRHH ─────────────────────────────────────────────────────
const TIPOS_EVENTO = [
  { value: "falta",              label: "Falta injustificada" },
  { value: "suspension",         label: "Suspensión" },
  { value: "incapacidad",        label: "Incapacidad" },
  { value: "permiso_goce_sueldo",label: "Permiso con goce de sueldo" },
  { value: "amonestacion",       label: "Amonestación verbal/escrita" },
  { value: "vacaciones",         label: "Vacaciones" },
];

// ─── Modal Nuevo Evento ───────────────────────────────────────────────────────
function ModalNuevoEvento({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    employeeId: number;
    tipoEvento: string;
    fechaInicio: string;
    fechaFin?: string;
    notas?: string;
  }) => Promise<void>;
}) {
  const [employeeId, setEmployeeId]     = useState<string>("");
  const [tipoEvento, setTipoEvento]     = useState<string>("falta");
  const [fechaInicio, setFechaInicio]   = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin]         = useState<string>("");
  const [notas, setNotas]               = useState<string>("");
  const [loading, setLoading]           = useState(false);
  const [busEmpleado, setBusEmpleado]   = useState("");

  const { data: empleados = [] } = useQuery<Array<{ id: number; nombreCompleto: string; dpi?: string }>>({
    queryKey: ["empleados-activos"],
    queryFn: async () => {
      const r = await fetch(`${API}/employees?estado=activo&limit=300`, {
        headers: { "x-isp-session": getSessionToken() },
      });
      if (!r.ok) throw new Error("Error cargando empleados");
      return r.json();
    },
    staleTime: 60_000,
  });

  const empFiltrados = empleados.filter((e) =>
    !busEmpleado ||
    (e.nombreCompleto ?? "").toLowerCase().includes(busEmpleado.toLowerCase()) ||
    String(e.dpi ?? "").includes(busEmpleado)
  );

  const empleadoSeleccionado = empleados.find((e) => String(e.id) === employeeId);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!employeeId) return;
    setLoading(true);
    try {
      await onCreate({
        employeeId: Number(employeeId),
        tipoEvento,
        fechaInicio,
        fechaFin: fechaFin || undefined,
        notas: notas.trim() || undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/40 transition-colors";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-purple-500/20 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-purple-500/10 bg-purple-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Nuevo evento RRHH</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Búsqueda de empleado */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">
              Empleado <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Filtrar por nombre o DPI..."
              value={busEmpleado}
              onChange={(e) => { setBusEmpleado(e.target.value); setEmployeeId(""); }}
              className={inputCls}
            />
            {/* Select nativo con empleados filtrados */}
            <select
              value={employeeId}
              onChange={(e) => {
                const val = e.target.value;
                setEmployeeId(val);
                const emp = empleados.find((em) => String(em.id) === val);
                if (emp) setBusEmpleado(emp.nombreCompleto);
              }}
              className={inputCls + " appearance-none mt-1.5" + (employeeId ? " border-purple-500/40" : "")}
              required
            >
              <option value="">
                {empFiltrados.length === 0 && busEmpleado
                  ? "Sin resultados — cambia el filtro"
                  : "-- Seleccionar empleado --"}
              </option>
              {empFiltrados.slice(0, 30).map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.nombreCompleto}{emp.dpi ? ` · ${emp.dpi}` : ""}
                </option>
              ))}
            </select>
            {empleadoSeleccionado ? (
              <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {empleadoSeleccionado.nombreCompleto}
              </p>
            ) : (
              <p className="text-[11px] text-white/25 mt-1">
                Filtra por nombre arriba y selecciona del menú
              </p>
            )}
          </div>

          {/* Tipo evento */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">
              Tipo de evento <span className="text-red-400">*</span>
            </label>
            <select
              value={tipoEvento}
              onChange={(e) => setTipoEvento(e.target.value)}
              className={inputCls + " appearance-none"}
              required
            >
              {TIPOS_EVENTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">
                Fecha inicio <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={inputCls + " [color-scheme:dark]"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio}
                className={inputCls + " [color-scheme:dark]"}
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Notas / observaciones</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Descripción del evento, testigos, contexto..."
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !employeeId || !tipoEvento || !fechaInicio}
              className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-sm font-bold text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Plus className="w-3.5 h-3.5" />
              Registrar evento
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── Modal de Causales para Acta ──────────────────────────────────────────────
function ModalCausalesActa({
  evento,
  onGenerar,
  onClose,
}: {
  evento: EventoRrhh;
  onGenerar: (causales: string[], hechosExtra?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [causales, setCausales] = useState<string[]>(() => {
    if (evento.tipo_evento === "falta" || evento.tipo_evento === "falta_injustificada") return ["falta_injustificada"];
    if (evento.tipo_evento === "abandono_parcial") return ["ausencia_sin_permiso"];
    return [];
  });
  const [hechosExtra, setHechosExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [allCausales, setAllCausales] = useState<Array<{ id: string; label: string; desc: string; articulo: string }>>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    import("../../lib/pdfRrhh")
      .then(m => setAllCausales([...m.CAUSALES_ACTA]))
      .catch(() => setLoadError(true));
  }, []);

  const toggle = (id: string) => {
    setCausales(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  async function handleConfirm() {
    if (causales.length === 0) return;
    setLoading(true);
    try {
      await onGenerar(causales, hechosExtra || undefined);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-amber-500/20 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-amber-500/10 bg-amber-500/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Generar Acta Administrativa</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 space-y-1">
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Evento base</p>
            <p className="text-sm text-white font-medium">{evento.employee_nombre}</p>
            <p className="text-xs text-white/40">
              {TIPO_CONFIG[evento.tipo_evento]?.label ?? evento.tipo_evento} · {fmtFecha(evento.fecha)}
              {evento.cliente_nombre && ` · ${evento.cliente_nombre}`}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 mb-2">Causales del Código de Trabajo</p>
            {loadError && <p className="text-[10px] text-red-400 py-2">Error al cargar causales. Recarga la página.</p>}
            {!loadError && allCausales.length === 0 && (
              <div className="flex items-center gap-2 py-3 text-white/30 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" /> Cargando causales…</div>
            )}
            <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {allCausales.map(c => {
                const active = causales.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
                    className={`text-left rounded-lg px-3 py-2 border transition-colors ${active ? "bg-amber-500/10 border-amber-500/25 text-amber-200" : "bg-white/3 border-white/8 text-white/50 hover:bg-white/5"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? "bg-amber-500 border-amber-500" : "border-white/20"}`}>
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
          </div>

          <div>
            <label className="text-xs text-white/40 block mb-1">Hechos adicionales (opcional)</label>
            <textarea
              value={hechosExtra}
              onChange={e => setHechosExtra(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20"
              placeholder="Describir hechos específicos o dejar en blanco para texto automático…"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/8 flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 text-xs text-white/40 hover:text-white/60 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={loading || causales.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg py-2 disabled:opacity-40 transition-colors">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {loading ? "Generando…" : `Generar Acta (${causales.length} causal${causales.length !== 1 ? "es" : ""})`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Modal de Anulación ───────────────────────────────────────────────────────
function ModalAnulacion({
  evento,
  onConfirm,
  onClose,
}: {
  evento: EventoRrhh;
  onConfirm: (motivo: string) => Promise<void>;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("error_registro");
  const [loading, setLoading] = useState(false);
  const numEvento = `ERH-${String(evento.id).padStart(4, "0")}`;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(motivo);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-red-500/20 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-red-500/10 bg-red-500/5">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-white">Anular evento RRHH</h3>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Advertencia */}
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300 mb-1">Acción irreversible</p>
                <p className="text-xs text-red-300/70 leading-relaxed">
                  Esta acción anulará el evento <span className="font-mono font-bold">{numEvento}</span> y
                  dejará sin efecto legal los documentos generados (boleta de descuento y acta administrativa).
                  El registro histórico se conserva para auditoría. Esta acción quedará registrada.
                </p>
              </div>
            </div>
          </div>

          {/* Evento afectado */}
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Evento a anular</p>
            <p className="text-sm text-white font-medium">{evento.employee_nombre}</p>
            <p className="text-xs text-white/40">
              {TIPO_CONFIG[evento.tipo_evento]?.label ?? evento.tipo_evento} ·{" "}
              {fmtFecha(evento.fecha)}
              {evento.cliente_nombre && ` · ${evento.cliente_nombre}`}
            </p>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">
              Motivo de anulación <span className="text-red-400">*</span>
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-red-500/40 appearance-none"
            >
              {Object.entries(MOTIVO_ANULACION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Ban className="w-3.5 h-3.5" />
              Confirmar anulación
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Tarjeta de evento individual ─────────────────────────────────────────────
function EventoCard({
  evento,
  onEstadoChange,
  onDescargarBoleta,
  onDescargarActa,
  onDescargarAnulacion,
  onAnular,
  compact,
  label,
}: {
  evento: EventoRrhh;
  onEstadoChange: (id: number, estado: string) => Promise<void>;
  onDescargarBoleta: (evento: EventoRrhh) => void;
  onDescargarActa: (evento: EventoRrhh) => void;
  onDescargarAnulacion: (evento: EventoRrhh) => void;
  onAnular: (evento: EventoRrhh) => void;
  compact?: boolean;
  label?: string;
}) {
  const [showEstadoMenu, setShowEstadoMenu] = useState(false);
  const [loadingEstado, setLoadingEstado] = useState(false);

  const isAnulado = evento.estado === "anulado";
  const estadoCfg = ESTADO_CONFIG[evento.estado] ?? ESTADO_CONFIG.pendiente;
  const tipoCfg = TIPO_CONFIG[evento.tipo_evento] ?? TIPO_CONFIG.falta;
  const numEvento = `ERH-${String(evento.id).padStart(4, "0")}`;
  const docsGenerados = (evento.documentos_generados ?? []) as Array<{ tipo: string; usuario: string; fecha: string }>;

  async function cambiarEstado(nuevoEstado: string) {
    setLoadingEstado(true);
    setShowEstadoMenu(false);
    try {
      await onEstadoChange(evento.id, nuevoEstado);
    } finally {
      setLoadingEstado(false);
    }
  }

  return (
    <div className={`${compact ? "rounded-xl" : "border rounded-2xl"} overflow-hidden transition-colors
      ${isAnulado
        ? `bg-[#0a0a0a] ${compact ? "" : "border-red-500/15"} opacity-80`
        : `${compact ? "bg-[#0b1525]" : "bg-[#07111f] border-white/8 hover:border-white/15"}`}`}
    >
      {label && (
        <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
          evento.tipo_evento === 'horas_extra' ? "text-emerald-400/70 bg-emerald-500/5" : "text-orange-400/70 bg-orange-500/5"
        }`}>
          {label}
        </div>
      )}
      {/* Banner ANULADO */}
      {isAnulado && (
        <div className="bg-red-900/30 border-b border-red-500/20 px-5 py-2.5 flex items-center gap-2">
          <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-red-400 tracking-widest">ANULADO</span>
            {evento.motivo_anulacion && (
              <span className="text-[11px] text-red-400/60 ml-2">
                — {MOTIVO_ANULACION_LABELS[evento.motivo_anulacion] ?? evento.motivo_anulacion}
              </span>
            )}
          </div>
          {evento.anulado_at && (
            <span className="text-[10px] text-red-400/40 shrink-0">{fmtFecha(evento.anulado_at)}</span>
          )}
        </div>
      )}

      {/* Encabezado de la tarjeta */}
      <div className={`${compact ? "px-3 py-2.5" : "px-5 py-3.5"} border-b border-white/6`}>
        <div className="flex items-center gap-2 min-w-0">
          {!compact && (
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              ${isAnulado ? "bg-red-500/10 border border-red-500/20" : "bg-purple-500/15 border border-purple-500/20"}`}
            >
              {isAnulado
                ? <XCircle className="w-4 h-4 text-red-400/60" />
                : <ClipboardList className="w-4 h-4 text-purple-400" />
              }
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={`${compact ? "text-xs" : "text-sm"} font-semibold truncate ${isAnulado ? "text-white/50 line-through" : "text-white"}`}>
              {evento.employee_nombre}
            </p>
            <p className={`${compact ? "text-[10px]" : "text-[11px]"} text-white/30`}>{numEvento} · {fmtFecha(evento.fecha)} {fmtHora(evento.fecha)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tipoCfg.className} ${isAnulado ? "opacity-40" : ""}`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {tipoCfg.label}
          </span>
          {isAnulado ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${estadoCfg.className}`}>
              {estadoCfg.icon}
              {estadoCfg.label}
            </span>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowEstadoMenu((p) => !p)}
                disabled={loadingEstado}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${estadoCfg.className}`}
              >
                {loadingEstado ? <Loader2 className="w-3 h-3 animate-spin" /> : estadoCfg.icon}
                {estadoCfg.label}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {showEstadoMenu && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-[#0c1929] border border-white/10 rounded-xl shadow-xl min-w-[140px] overflow-hidden">
                  {(["pendiente_aprobacion", "aprobado", "rechazado"] as const)
                    .map((key) => [key, ESTADO_CONFIG[key]] as const)
                    .map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => cambiarEstado(key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors
                          ${key === evento.estado ? "text-white/80 bg-white/5" : "text-white/50"}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className={`${compact ? "px-3 py-2.5 space-y-2.5" : "p-5 space-y-4"}`}>
        {compact ? (
          <div className="space-y-1 text-[11px]">
            {evento.employee_dpi && (
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-white/20 shrink-0" />
                <span className="text-white/30">DPI</span>
                <span className="text-white/50 font-mono">{evento.employee_dpi}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-white/20 shrink-0" />
              <span className="text-white/30">Por</span>
              <span className="text-white/50">{evento.usuario_generador || "sistema"}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/30 capitalize">{evento.generado_desde || "operaciones"}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {evento.employee_dpi && (
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">DPI</p>
                  <p className="text-xs text-white/60 font-mono">{evento.employee_dpi}</p>
                </div>
              </div>
            )}
            {evento.cliente_nombre && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">Cliente</p>
                  <p className="text-xs text-white/60 truncate">{evento.cliente_nombre}</p>
                </div>
              </div>
            )}
            {evento.puesto_nombre && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">Puesto</p>
                  <p className="text-xs text-white/60 truncate">{evento.puesto_nombre}</p>
                </div>
              </div>
            )}
            {evento.supervisor_nombre && (
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">Supervisor</p>
                  <p className="text-xs text-white/60 truncate">{evento.supervisor_nombre}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div>
                <p className="text-[10px] text-white/30">Registrado por</p>
                <p className="text-xs text-white/60">{evento.usuario_generador || "Sistema"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div>
                <p className="text-[10px] text-white/30">Origen</p>
                <p className="text-xs text-white/60 capitalize">{evento.generado_desde || "operaciones"}</p>
              </div>
            </div>
          </div>
        )}

        {evento.observaciones && (
          <div className={`bg-[#0c1929] border border-white/6 rounded-xl ${compact ? "p-2" : "p-3"}`}>
            <p className="text-[10px] text-white/30 mb-0.5">Observaciones</p>
            <p className={`${compact ? "text-[11px] line-clamp-2" : "text-xs leading-relaxed"} text-white/55`}>{evento.observaciones}</p>
          </div>
        )}

        {!compact && isAnulado && evento.anulado_por && (
          <div className="bg-red-900/10 border border-red-500/15 rounded-xl p-3.5 space-y-2">
            <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wide">Auditoría de anulación</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-white/25">Anulado por</p>
                <p className="text-xs text-white/55">{evento.anulado_por}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Fecha / hora</p>
                <p className="text-xs text-white/55">{fmtDateTime(evento.anulado_at || "")}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Motivo</p>
                <p className="text-xs text-white/55">{MOTIVO_ANULACION_LABELS[evento.motivo_anulacion ?? ""] ?? evento.motivo_anulacion}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Estado anterior</p>
                <p className="text-xs text-white/55 capitalize">{evento.estado_anterior?.replace("_", " ") || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {!compact && docsGenerados.length > 0 && (
          <div className={`border rounded-xl p-3 ${isAnulado ? "bg-red-500/5 border-red-500/10 opacity-60" : "bg-purple-500/5 border-purple-500/15"}`}>
            <p className={`text-[10px] mb-2 font-medium ${isAnulado ? "text-red-400/50" : "text-purple-400/60"}`}>
              Documentos generados {isAnulado ? "(anulados)" : ""}
            </p>
            <div className="space-y-1">
              {docsGenerados.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText className={`w-3 h-3 ${isAnulado ? "text-red-400/30" : "text-purple-400/50"}`} />
                  <span className={`text-[11px] capitalize ${isAnulado ? "text-white/25 line-through" : "text-white/40"}`}>{d.tipo}</span>
                  <span className="text-[10px] text-white/20">—</span>
                  <span className="text-[10px] text-white/20">{fmtFecha(d.fecha)} por {d.usuario}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAnulado ? (
          <button
            onClick={() => onDescargarAnulacion(evento)}
            className={`w-full flex items-center justify-center gap-1.5 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-red-900/20 hover:bg-red-900/30 border border-red-500/15 text-red-400/70 hover:text-red-400 transition-all`}
          >
            <Download className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            {compact ? "Acta anulación" : "Descargar acta de anulación"}
          </button>
        ) : (
          <>
            <div className="flex gap-1.5">
              <button
                onClick={() => onDescargarBoleta(evento)}
                className={`flex-1 flex items-center justify-center gap-1 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 text-white/60 hover:text-white transition-all`}
              >
                <Download className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                {evento.tipo_evento === "horas_extra" ? "Constancia HE" : "Boleta"}
              </button>
              {evento.tipo_evento !== "horas_extra" && (
                <button
                  onClick={() => onDescargarActa(evento)}
                  className={`flex-1 flex items-center justify-center gap-1 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 text-white/60 hover:text-white transition-all`}
                >
                  <FileText className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                  Acta
                </button>
              )}
            </div>
            <button
              onClick={() => onAnular(evento)}
              className={`w-full flex items-center justify-center gap-1.5 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-transparent hover:bg-red-500/8 border border-red-500/15 hover:border-red-500/30 text-red-400/50 hover:text-red-400 transition-all`}
            >
              <Ban className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              Anular evento
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Panel Batch Actas ────────────────────────────────────────────────────────
function BatchActasPanel({ eventos }: { eventos: EventoRrhh[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [printing, setPrinting] = useState(false);

  const filtrados = eventos.filter((e) => {
    const f = new Date(e.fecha).toISOString().slice(0, 10);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    if (tipoFiltro && e.tipo_evento !== tipoFiltro) return false;
    if (e.estado === "anulado") return false;
    return true;
  });

  async function imprimirTodo() {
    if (!filtrados.length) return;
    setPrinting(true);
    let count = 0;
    for (const ev of filtrados) {
      try {
        const datos = await construirDatosActa(ev);
        await generarActaAdministrativa(datos);
        count++;
        await new Promise((r) => setTimeout(r, 180));
      } catch {
        // continúa con el siguiente
      }
    }
    setPrinting(false);
    toast({ title: `${count} acta(s) generadas`, description: "Revisa tu carpeta de Descargas." });
  }

  return (
    <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Printer className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white/80">Impresión Batch de Actas</span>
          <span className="text-[10px] text-white/30 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
            {filtrados.length} evento{filtrados.length !== 1 ? "s" : ""} en rango
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/8 p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Tipo</span>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}
                className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-cyan-500/50 appearance-none">
                <option value="">Todos</option>
                <option value="falta">Falta</option>
                <option value="suspension">Suspensión</option>
                <option value="amonestacion">Amonestación</option>
              </select>
            </label>
            <button
              onClick={imprimirTodo}
              disabled={printing || filtrados.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-semibold text-white transition-all"
            >
              {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              {printing ? "Generando..." : `Generar ${filtrados.length} acta(s)`}
            </button>
          </div>
          {filtrados.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {filtrados.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-1.5 bg-white/3 border border-white/6 rounded-xl text-xs">
                  <span className="text-white/60 truncate">{e.employee_nombre}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-white/30">{String(e.fecha ?? "").slice(0, 10)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">{e.tipo_evento}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal Config Empresa ─────────────────────────────────────────────────────
function ModalConfigEmpresa({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    representante_nombre: "",
    representante_dpi: "",
    representante_fecha_nacimiento: "",
    direccion_empresa: "",
    nombre_empresa: "",
    nit_empresa: "",
    patente_comercio: "",
    telefono_empresa: "",
    umbral_dias_consecutivos: 2,
    umbral_medios_turnos_mes: 6,
  });

  useEffect(() => {
    fetch(`${API}/config-empresa`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setForm({
            representante_nombre: data.representante_nombre || "",
            representante_dpi: data.representante_dpi || "",
            representante_fecha_nacimiento: data.representante_fecha_nacimiento || "",
            direccion_empresa: data.direccion_empresa || "",
            nombre_empresa: data.nombre_empresa || "",
            nit_empresa: data.nit_empresa || "",
            patente_comercio: data.patente_comercio || "",
            telefono_empresa: data.telefono_empresa || "",
            umbral_dias_consecutivos: data.umbral_dias_consecutivos ?? 2,
            umbral_medios_turnos_mes: data.umbral_medios_turnos_mes ?? 6,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`${API}/config-empresa`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Error al guardar");
      toast({ title: "Configuración guardada" });
      onClose();
    } catch {
      toast({ title: "Error al guardar configuración", variant: "destructive" });
    } finally { setSaving(false); }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/40";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-primary/20 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Configuración de Empresa</p>
            <p className="text-[11px] text-white/40">Datos para actas administrativas y avisos</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Nombre de Empresa</label>
              <input value={form.nombre_empresa} onChange={e => setForm({ ...form, nombre_empresa: e.target.value })} placeholder="Investigaciones y Seguridad Profesional S.A." className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Representante Legal</label>
              <input value={form.representante_nombre} onChange={e => setForm({ ...form, representante_nombre: e.target.value })} placeholder="Nombre completo del representante" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">DPI del Representante Legal</label>
                <input value={form.representante_dpi} onChange={e => setForm({ ...form, representante_dpi: e.target.value })} placeholder="0000 00000 0000" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Fecha de nacimiento del Representante</label>
                <input
                  type="date"
                  value={form.representante_fecha_nacimiento}
                  onChange={e => setForm({ ...form, representante_fecha_nacimiento: e.target.value })}
                  className={inputCls}
                />
                <p className="text-[10px] text-white/30">Se usa para imprimir “de XX años de edad” en los contratos.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Dirección de la Empresa</label>
              <input value={form.direccion_empresa} onChange={e => setForm({ ...form, direccion_empresa: e.target.value })} placeholder="14 calle 15-52 zona 1, Barrio Gerona" className={inputCls} />
            </div>

            <div className="border-t border-white/8 pt-4">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Datos Mercantiles (para contratos laborales)</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/40">NIT de la empresa</label>
                    <input value={form.nit_empresa} onChange={e => setForm({ ...form, nit_empresa: e.target.value })} placeholder="1234567-8" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/40">Patente de Comercio</label>
                    <input value={form.patente_comercio} onChange={e => setForm({ ...form, patente_comercio: e.target.value })} placeholder="No. xxxxx, Folio yy, Libro zz" className={inputCls} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40">Teléfono de la empresa</label>
                  <input value={form.telefono_empresa} onChange={e => setForm({ ...form, telefono_empresa: e.target.value })} placeholder="+502 2379 0700" className={inputCls} />
                </div>
              </div>
            </div>

            <div className="border-t border-white/8 pt-4">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Umbrales Disciplinarios</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40">Días consecutivos para causa justa</label>
                  <input type="number" min={1} max={30} value={form.umbral_dias_consecutivos} onChange={e => setForm({ ...form, umbral_dias_consecutivos: Number(e.target.value) })} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40">Medios turnos/mes para causa justa</label>
                  <input type="number" min={1} max={30} value={form.umbral_medios_turnos_mes} onChange={e => setForm({ ...form, umbral_medios_turnos_mes: Number(e.target.value) })} className={inputCls} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 py-2 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-xl transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-xs font-semibold bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Tab Alertas Pizarrón ─────────────────────────────────────────────────────
function AlertasPizarronTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<"faltantes" | "horas_extra">("faltantes");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [kpiId, setKpiId] = useState<number | null>(null);

  const { data: alertasData, isLoading: loadingAlertas, refetch } = useQuery<{
    alertas: any[]; totales: { faltantes: number; horasExtra: number };
  }>({
    queryKey: ["rrhh-alertas-pizarron"],
    queryFn: () => apiFetch(`${API}/rrhh/alertas-pizarron?estado=pendiente`),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const { data: hePendData, isLoading: loadingHE, refetch: refetchHE } = useQuery<{
    pendientes: any[]; total: number;
  }>({
    queryKey: ["rrhh-he-pendientes"],
    queryFn: () => apiFetch(`${API}/rrhh/horas-extra-pendientes`),
    staleTime: 20_000,
  });

  const { data: kpiData } = useQuery<any>({
    queryKey: ["rrhh-kpi", kpiId],
    queryFn: () => apiFetch(`${API}/rrhh/empleado/${kpiId}/kpi`),
    enabled: !!kpiId,
    staleTime: 30_000,
  });

  const alertas = alertasData?.alertas ?? [];
  const totales  = alertasData?.totales ?? { faltantes: 0, horasExtra: 0 };
  const heList   = hePendData?.pendientes ?? [];

  async function resolverAlerta(id: number) {
    setLoadingId(id);
    try {
      await apiPatch(`${API}/rrhh/alertas/${id}/resolver`, { resuelto_por: "RRHH" });
      refetch();
      qc.invalidateQueries({ queryKey: ["rrhh-alertas-pizarron"] });
      toast({ title: "Alerta resuelta", description: "Fue marcada como resuelta manualmente." });
    } catch {
      toast({ title: "Error", description: "No se pudo resolver la alerta.", variant: "destructive" });
    } finally { setLoadingId(null); }
  }

  async function aprobarHE(id: number) {
    setLoadingId(id);
    try {
      await apiPatch(`${API}/rrhh/horas-extra/${id}/aprobar`, { aprobado_por: "RRHH" });
      refetchHE();
      toast({ title: "HE Aprobadas", description: "Horas extra aprobadas correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo aprobar.", variant: "destructive" });
    } finally { setLoadingId(null); }
  }

  async function rechazarHE(id: number) {
    setLoadingId(id);
    try {
      await apiPatch(`${API}/rrhh/horas-extra/${id}/rechazar`, { rechazado_por: "RRHH" });
      refetchHE();
      toast({ title: "HE Rechazadas", description: "Las horas extra fueron rechazadas." });
    } catch {
      toast({ title: "Error", description: "No se pudo rechazar.", variant: "destructive" });
    } finally { setLoadingId(null); }
  }

  const art77Color = (nivel: string) =>
    nivel === "rojo" ? "text-red-400 bg-red-400/10 border-red-400/20" :
    nivel === "amarillo" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" :
    "text-green-400 bg-green-400/10 border-green-400/20";

  const art77Emoji = (nivel: string) =>
    nivel === "rojo" ? "🔴" : nivel === "amarillo" ? "🟡" : "🟢";

  return (
    <div className="space-y-4">

      {/* ── Counters ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-400/5 border border-red-400/10 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-400">{totales.faltantes}</p>
          <p className="text-xs text-white/35 mt-0.5">Faltantes sin cubrir</p>
        </div>
        <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-4">
          <p className="text-2xl font-bold text-amber-400">{totales.horasExtra + (hePendData?.total ?? 0)}</p>
          <p className="text-xs text-white/35 mt-0.5">HE pendientes de aprobación</p>
        </div>
      </div>

      {/* ── Sub-tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        <button
          onClick={() => setSubTab("faltantes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            subTab === "faltantes" ? "bg-red-600 text-white shadow" : "text-white/40 hover:text-white/70"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Faltantes ({totales.faltantes})
        </button>
        <button
          onClick={() => setSubTab("horas_extra")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            subTab === "horas_extra" ? "bg-amber-600 text-white shadow" : "text-white/40 hover:text-white/70"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          HE Pendientes ({hePendData?.total ?? 0})
        </button>
        <button
          onClick={() => { refetch(); refetchHE(); }}
          className="px-2 py-1.5 text-white/30 hover:text-white/60 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── KPI del empleado seleccionado ─────────────────────────────── */}
      {kpiId && kpiData && (
        <div className="bg-[#07111f] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white/80">KPI Empleado</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${art77Color(kpiData.art77.nivel)}`}>
                Art.77 {art77Emoji(kpiData.art77.nivel)}
              </span>
            </div>
            <button onClick={() => setKpiId(null)} className="text-white/20 hover:text-white/60 text-xs">✕</button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
            {[
              { label: "Faltas 12m",  value: kpiData.faltas12m,          color: "text-red-400" },
              { label: "Suspensiones",value: kpiData.suspensiones12m,     color: "text-orange-400" },
              { label: "Actas 12m",   value: kpiData.actas12m,            color: "text-yellow-400" },
              { label: "HE aprobadas",value: `${kpiData.horasExtraAprobadas}h`, color: "text-green-400" },
              { label: "Faltas mes",  value: kpiData.faltasEsteMes,       color: "text-red-300" },
              { label: "Consecutivas",value: kpiData.consecutivasMax,     color: kpiData.consecutivasMax >= 2 ? "text-red-400" : "text-white/60" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/3 border border-white/6 rounded-xl p-2">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[9px] text-white/30">{label}</p>
              </div>
            ))}
          </div>
          {kpiData.art77.alertaConsecutiva && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              ⚠️ <strong>Art. 77 GT:</strong> {kpiData.consecutivasMax} días consecutivos ausente — posible causa justificada de terminación.
            </p>
          )}
          {kpiData.art77.alertaMes && !kpiData.art77.alertaConsecutiva && (
            <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
              ⚠️ <strong>Art. 77 GT:</strong> {kpiData.faltasEsteMes} faltas este mes — revisar umbral de inasistencias.
            </p>
          )}
        </div>
      )}

      {/* ── Lista de faltantes ────────────────────────────────────────── */}
      {subTab === "faltantes" && (
        <div className="space-y-2">
          {loadingAlertas && (
            <div className="text-center py-8 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-xs">Cargando alertas...</p>
            </div>
          )}
          {!loadingAlertas && alertas.filter((a) => a.tipo === "faltante_sin_cubrir").length === 0 && (
            <div className="text-center py-10 text-white/20">
              <CheckCheck className="w-8 h-8 mx-auto mb-2 text-green-400/40" />
              <p className="text-sm">Sin faltantes pendientes</p>
            </div>
          )}
          {alertas
            .filter((a) => a.tipo === "faltante_sin_cubrir")
            .map((alerta: any) => (
              <div key={alerta.id} className="bg-[#07111f] border border-red-400/15 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white/85 truncate">{alerta.employee_nombre}</p>
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full font-medium">faltante</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-white/35">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{alerta.puesto_nombre ?? "—"}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{alerta.fecha_evento ?? "—"}</span>
                  </div>
                  {alerta.sugerencia && (
                    <p className="text-[10px] text-white/25 italic">{alerta.sugerencia}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {alerta.employee_id && (
                    <button
                      onClick={() => setKpiId(alerta.employee_id)}
                      className="text-[10px] px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/20 rounded-lg transition-colors"
                    >
                      KPI
                    </button>
                  )}
                  <button
                    onClick={() => resolverAlerta(alerta.id)}
                    disabled={loadingId === alerta.id}
                    className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingId === alerta.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                    Resolver
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── Lista de HE pendientes ────────────────────────────────────── */}
      {subTab === "horas_extra" && (
        <div className="space-y-2">
          {loadingHE && (
            <div className="text-center py-8 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-xs">Cargando HE pendientes...</p>
            </div>
          )}
          {!loadingHE && heList.length === 0 && (
            <div className="text-center py-10 text-white/20">
              <CheckCheck className="w-8 h-8 mx-auto mb-2 text-green-400/40" />
              <p className="text-sm">Sin horas extra pendientes</p>
            </div>
          )}
          {heList.map((he: any) => (
            <div key={he.id} className="bg-[#07111f] border border-amber-400/15 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white/85 truncate">{he.empleado_nombre}</p>
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-full font-medium">
                    {he.horas_extra}h extra
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/35">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{he.fecha}</span>
                  {he.puesto_cubierto_nombre && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{he.puesto_cubierto_nombre}</span>
                  )}
                  {he.fue_en_dia_descanso && (
                    <span className="text-orange-400">día de descanso</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {he.employee_id && (
                  <button
                    onClick={() => setKpiId(he.employee_id)}
                    className="text-[10px] px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/20 rounded-lg transition-colors"
                  >
                    KPI
                  </button>
                )}
                <button
                  onClick={() => rechazarHE(he.id)}
                  disabled={loadingId === he.id}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingId === he.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                  Rechazar
                </button>
                <button
                  onClick={() => aprobarHE(he.id)}
                  disabled={loadingId === he.id}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingId === he.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                  Aprobar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RRHHEventos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  const [paginaActiva, setPaginaActiva] = useState<"eventos" | "vacaciones" | "alertas">("eventos");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [tabEventos, setTabEventos] = useState<"pendientes" | "historial">("pendientes");
  const [modalAnulacion, setModalAnulacion] = useState<EventoRrhh | null>(null);
  const [modalCausales, setModalCausales] = useState<EventoRrhh | null>(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (filtroTipo) params.set("tipo", filtroTipo);
    if (filtroEstado) params.set("estado", filtroEstado);
    if (busqueda) params.set("empleado", busqueda);
    const q = params.toString();
    return `${API}/rrhh/eventos${q ? `?${q}` : ""}`;
  };

  const { data: eventos = [], isLoading, refetch } = useQuery<EventoRrhh[]>({
    queryKey: ["rrhh-eventos", filtroTipo, filtroEstado, busqueda],
    queryFn: () => apiFetch(buildUrl()),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<{
    total: string; pendientes: string; en_proceso: string;
    cerrados: string; anulados: string; faltas: string;
    suspensiones: string; ultimos_7_dias: string; ultimos_30_dias: string;
  }>({
    queryKey: ["rrhh-stats"],
    queryFn: () => apiFetch(`${API}/rrhh/stats`),
    staleTime: 60_000,
  });

  interface EmpleadoRiesgo {
    employeeId: number; employeeNombre: string;
    score: number; nivel: "bajo" | "medio" | "alto";
    faltas30d: number; faltasTotal: number; suspensionesTotal: number;
  }
  interface TopEmpleado {
    employeeId: number; employeeNombre: string; faltas: number; suspensiones: number;
  }
  interface TendenciaMes { mes: string; faltas: number; suspensiones: number; }

  const { data: discData } = useQuery<{
    top: TopEmpleado[];
    tendencia: TendenciaMes[];
    enRiesgo: EmpleadoRiesgo[];
    resumen: { totalAlto: number; totalMedio: number; totalBajo: number };
  }>({
    queryKey: ["rrhh-disciplinario"],
    queryFn: () => apiFetch(`${API}/rrhh/disciplinario`),
    staleTime: 60_000,
  });

  const [showDashboard, setShowDashboard] = useState(false);

  const { data: alertasPizarronCount } = useQuery<{ alertas: any[]; totales: { faltantes: number; horasExtra: number } }>({
    queryKey: ["rrhh-alertas-count"],
    queryFn: () => apiFetch(`${API}/rrhh/alertas-pizarron?estado=pendiente`),
    staleTime: 30_000,
    refetchInterval: 45_000,
  });
  const totalAlertasBadge = (alertasPizarronCount?.totales?.faltantes ?? 0) + (alertasPizarronCount?.totales?.horasExtra ?? 0);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["rrhh-eventos"] });
    qc.invalidateQueries({ queryKey: ["rrhh-stats"] });
  }

  async function handleCrearEvento(data: {
    employeeId: number; tipoEvento: string;
    fechaInicio: string; fechaFin?: string; notas?: string;
  }) {
    try {
      await apiPost(`${API}/rrhh/eventos`, {
        employeeId: data.employeeId,
        tipoEvento: data.tipoEvento,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        notas: data.notas,
      });
      invalidar();
      qc.invalidateQueries({ queryKey: ["rrhh-disciplinario"] });
      toast({ title: "Evento registrado", description: `Tipo: ${data.tipoEvento}` });
    } catch (e: any) {
      toast({ title: "Error al crear evento", description: e?.error || "Intenta de nuevo", variant: "destructive" });
      throw e;
    }
  }

  async function handleEstadoChange(id: number, estado: string) {
    try {
      await apiPatch(`${API}/rrhh/eventos/${id}/estado`, { estado });
      invalidar();
      toast({ title: "Estado actualizado", description: `"${ESTADO_CONFIG[estado]?.label ?? estado}"` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.error || "No se pudo actualizar", variant: "destructive" });
    }
  }

  async function handleAnular(motivo: string) {
    if (!modalAnulacion) return;
    const usuario = currentUser?.nombre ?? currentUser?.username ?? "usuario";
    try {
      const res = await apiPost(`${API}/rrhh/eventos/${modalAnulacion.id}/anular`, {
        motivoAnulacion: motivo,
        usuario,
      });
      invalidar();
      setModalAnulacion(null);
      const parMsg = (res as any)?.parAnulado
        ? " El evento de horas extra vinculado también fue anulado."
        : "";
      toast({
        title: "Evento anulado correctamente",
        description: `ERH-${String(modalAnulacion.id).padStart(4, "0")} marcado como ANULADO.${parMsg}`,
      });
    } catch (e: any) {
      toast({ title: "Error al anular", description: e?.error || "Intenta de nuevo", variant: "destructive" });
      throw e;
    }
  }

  async function registrarDescarga(evento: EventoRrhh, tipo: "boleta" | "acta" | "anulacion" | "constancia_he") {
    try {
      await apiPatch(`${API}/rrhh/eventos/${evento.id}/documentos`, {
        tipo,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "usuario",
      });
      invalidar();
    } catch { /* No bloquear la descarga si falla el registro */ }
  }

  async function handleDescargarBoleta(evento: EventoRrhh) {
    try {
      if (evento.tipo_evento === "horas_extra") {
        await generarConstanciaHorasExtra(evento);
        await registrarDescarga(evento, "constancia_he");
        toast({ title: "Constancia de HE generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
      } else {
        await generarBoletaDescuento(evento);
        await registrarDescarga(evento, "boleta");
        toast({ title: "Boleta generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
      }
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  function handleDescargarActa(evento: EventoRrhh) {
    setModalCausales(evento);
  }

  async function generarActaConCausales(evento: EventoRrhh, causalesIds: string[], hechosExtra?: string) {
    try {
      const datos = await construirDatosActa(evento);
      datos.causales_seleccionadas = causalesIds;
      if (hechosExtra) datos.hechos = hechosExtra;
      await generarActaAdministrativa(datos);
      await registrarDescarga(evento, "acta");
      toast({ title: "Acta administrativa generada", description: `Acta No. ${datos.numero_acta}` });
      setModalCausales(null);
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  async function handleDescargarAviso(evento: EventoRrhh) {
    try {
      const datos = await construirDatosActa(evento);
      await generarAvisoInspector(datos);
      toast({ title: "Aviso al Inspector generado", description: `Acta No. ${datos.numero_acta}` });
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  async function handleDescargarAnulacion(evento: EventoRrhh) {
    try {
      await generarDocumentoAnulacion(evento);
      await registrarDescarga(evento, "anulacion");
      toast({ title: "Acta de anulación generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="Eventos RRHH">
      <div className="flex flex-col gap-6 p-6">

        {/* ── Encabezado ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-5 h-5 text-purple-400" />
              <h1 className="text-xl font-bold text-white">RRHH</h1>
            </div>
            <p className="text-sm text-white/40">
              Eventos disciplinarios · vacaciones · documentos laborales
            </p>
          </div>
          {paginaActiva === "eventos" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalConfig(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/50 hover:text-white transition-all"
                title="Configuración de empresa"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["rrhh-stats"] }); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/50 hover:text-white transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </button>
              <button
                onClick={() => setModalNuevo(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-semibold text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo evento
              </button>
            </div>
          )}
        </div>

        {/* ── Tabs principales ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
          <button
            onClick={() => setPaginaActiva("eventos")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              paginaActiva === "eventos"
                ? "bg-purple-600 text-white shadow"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Eventos RRHH
          </button>
          <button
            onClick={() => setPaginaActiva("vacaciones")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              paginaActiva === "vacaciones"
                ? "bg-teal-600 text-white shadow"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Palmtree className="w-4 h-4" />
            Vacaciones
          </button>
          <button
            onClick={() => setPaginaActiva("alertas")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              paginaActiva === "alertas"
                ? "bg-red-700 text-white shadow"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Bell className="w-4 h-4" />
            Alertas Pizarrón
            {totalAlertasBadge > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 animate-pulse">
                {totalAlertasBadge}
              </span>
            )}
          </button>
        </div>

        {/* ── Contenido del tab de Vacaciones ────────────────────────────── */}
        {paginaActiva === "vacaciones" && <VacacionesTab />}

        {/* ── Contenido del tab de Alertas Pizarrón ──────────────────────── */}
        {paginaActiva === "alertas" && <AlertasPizarronTab />}

        {/* ── Todo lo siguiente solo se muestra en tab Eventos ───────────── */}
        {paginaActiva === "eventos" && (<React.Fragment>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total eventos", value: stats.total, color: "text-white", bg: "bg-white/5 border-white/8" },
              { label: "Pendientes", value: stats.pendientes, color: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/10" },
              { label: "Faltas", value: stats.faltas, color: "text-red-400", bg: "bg-red-400/5 border-red-400/10" },
              { label: "Anulados", value: stats.anulados, color: "text-red-400/60", bg: "bg-white/3 border-white/6" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border rounded-2xl p-4`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Dashboard Disciplinario ─────────────────────────────────────── */}
        <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white/80">Dashboard Disciplinario</span>
              {discData && discData.resumen.totalAlto > 0 && (
                <span className="text-[10px] bg-red-400/10 border border-red-400/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                  {discData.resumen.totalAlto} en riesgo alto
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${showDashboard ? "rotate-180" : ""}`} />
          </button>

          {showDashboard && discData && (
            <div className="border-t border-white/8 p-5 space-y-5">

              {/* Resumen de riesgo */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { nivel: "Alto",  count: discData.resumen.totalAlto,  icon: ShieldOff,   color: "text-red-400",    bg: "bg-red-400/5 border-red-400/15"    },
                  { nivel: "Medio", count: discData.resumen.totalMedio, icon: ShieldAlert, color: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/15" },
                  { nivel: "Bajo",  count: discData.resumen.totalBajo,  icon: ShieldCheck, color: "text-green-400",  bg: "bg-green-400/5 border-green-400/15"  },
                ].map(({ nivel, count, icon: Icon, color, bg }) => (
                  <div key={nivel} className={`${bg} border rounded-xl p-3 text-center`}>
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                    <p className={`text-2xl font-bold ${color}`}>{count}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Riesgo {nivel}</p>
                  </div>
                ))}
              </div>

              {/* Top empleados con más eventos */}
              {discData.top.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Users2 className="w-3 h-3" /> Empleados con más eventos (top {discData.top.length})
                  </p>
                  <div className="space-y-1.5">
                    {discData.top.map((emp, i) => {
                      const score = Math.max(0, 100 - emp.faltas * 10 - emp.suspensiones * 20);
                      const clsColor = score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400";
                      return (
                        <div key={emp.employeeId} className="flex items-center gap-3 bg-[#0c1929] border border-white/6 rounded-xl px-3 py-2">
                          <span className="text-[10px] text-white/20 w-4 shrink-0">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/70 truncate">{emp.employeeNombre}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {emp.faltas > 0 && (
                              <span className="text-[10px] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded">
                                {emp.faltas} falta{emp.faltas !== 1 ? "s" : ""}
                              </span>
                            )}
                            {emp.suspensiones > 0 && (
                              <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded">
                                {emp.suspensiones} susp.
                              </span>
                            )}
                            <span className={`text-[10px] font-bold ${clsColor}`}>{score}pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empleados en riesgo alto */}
              {discData.enRiesgo.filter(e => e.nivel === "alto").length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <ShieldOff className="w-3 h-3 text-red-400" /> Empleados en riesgo alto
                  </p>
                  <div className="space-y-1.5">
                    {discData.enRiesgo.filter(e => e.nivel === "alto").map((emp) => (
                      <div key={emp.employeeId} className="flex items-center gap-3 bg-red-400/3 border border-red-400/15 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 truncate">{emp.employeeNombre}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {emp.faltas30d > 0 && `${emp.faltas30d} faltas en 30 días · `}
                            {emp.suspensionesTotal > 0 && `${emp.suspensionesTotal} suspensión(es) · `}
                            Score: {emp.score}pts
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded">
                          RIESGO ALTO
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tendencia mensual */}
              {discData.tendencia.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Tendencia últimos 6 meses
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {discData.tendencia.map((mes) => {
                      const total = mes.faltas + mes.suspensiones;
                      const maxVal = Math.max(...discData.tendencia.map(m => m.faltas + m.suspensiones), 1);
                      const pct = Math.round((total / maxVal) * 100);
                      return (
                        <div key={mes.mes} className="flex flex-col items-center gap-1.5 min-w-[52px]">
                          <div className="flex items-end h-12 gap-0.5">
                            <div
                              className="w-3 bg-orange-400/60 rounded-t transition-all"
                              style={{ height: `${Math.round((mes.faltas / maxVal) * 48)}px` }}
                              title={`${mes.faltas} faltas`}
                            />
                            <div
                              className="w-3 bg-red-400/60 rounded-t transition-all"
                              style={{ height: `${Math.round((mes.suspensiones / maxVal) * 48)}px` }}
                              title={`${mes.suspensiones} suspensiones`}
                            />
                          </div>
                          <p className="text-[9px] text-white/25 text-center leading-tight">
                            {mes.mes.slice(5)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-orange-400/60" /><span className="text-[9px] text-white/20">Faltas</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-400/60" /><span className="text-[9px] text-white/20">Suspensiones</span></div>
                  </div>
                </div>
              )}

              {discData.enRiesgo.length === 0 && discData.top.length === 0 && (
                <div className="text-center py-6">
                  <ShieldCheck className="w-10 h-10 text-green-400/20 mx-auto mb-2" />
                  <p className="text-sm text-white/30">Sin eventos disciplinarios registrados</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Batch actas ────────────────────────────────────────────────── */}
        <BatchActasPanel eventos={eventos} />

        {/* ── Sub-tabs: Pendientes / Historial ─────────────────────────── */}
        {(() => {
          const ESTADOS_PENDIENTES = new Set(["pendiente_aprobacion", "pendiente"]);
          const countPendientes = eventos.filter(e => ESTADOS_PENDIENTES.has(e.estado)).length;
          const countHistorial = eventos.filter(e => !ESTADOS_PENDIENTES.has(e.estado)).length;
          const eventosFiltrados = tabEventos === "pendientes"
            ? eventos.filter(e => ESTADOS_PENDIENTES.has(e.estado))
            : eventos.filter(e => !ESTADOS_PENDIENTES.has(e.estado));
          return (<>
            <div className="flex items-center gap-1 bg-white/3 border border-white/8 rounded-xl p-1 w-fit">
              <button
                onClick={() => setTabEventos("pendientes")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tabEventos === "pendientes"
                    ? "bg-amber-600 text-white shadow"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pendientes
                {countPendientes > 0 && (
                  <span className="ml-0.5 bg-white/20 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {countPendientes}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTabEventos("historial")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tabEventos === "historial"
                    ? "bg-white/15 text-white shadow"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Historial
                {countHistorial > 0 && (
                  <span className="ml-0.5 bg-white/10 text-white/60 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {countHistorial}
                  </span>
                )}
              </button>
            </div>

            {/* ── Filtros ────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar colaborador…"
                  className="w-full bg-[#07111f] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-primary/50"
                />
              </div>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">Todos los tipos</option>
                <option value="falta">Falta</option>
                <option value="suspension">Suspensión</option>
              </select>
              {tabEventos === "historial" && (
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-primary/50 appearance-none"
                >
                  <option value="">Todos los estados</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="anulado">Anulado</option>
                </select>
              )}
            </div>

            {/* ── Lista de eventos ───────────────────────────────────────────── */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : eventosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ClipboardList className="w-10 h-10 text-white/15" />
                <p className="text-sm text-white/30">
                  {tabEventos === "pendientes"
                    ? "No hay eventos pendientes de aprobación"
                    : "No hay eventos en el historial"}
                </p>
                {tabEventos === "pendientes" && (
                  <>
                    <p className="text-xs text-white/20 text-center max-w-xs">
                      Los eventos aparecen aquí cuando se registran desde el Pizarrón o manualmente. Cuando se aprueban, pasan al Historial.
                    </p>
                    <button
                      onClick={() => setModalNuevo(true)}
                      className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-semibold text-white transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nuevo evento
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-white/30">
                  {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? "s" : ""}
                  {tabEventos === "historial" && ` · ${eventosFiltrados.filter((e) => e.estado === "anulado").length} anulado${eventosFiltrados.filter((e) => e.estado === "anulado").length !== 1 ? "s" : ""}`}
                </p>
                <div className="space-y-4">
                  {(() => {
                    const usedIds = new Set<number>();
                    const paired: Array<{ falta: EventoRrhh; he: EventoRrhh; movId: number | null }> = [];
                    const evById = new Map<number, EventoRrhh>();
                    eventosFiltrados.forEach(ev => evById.set(ev.id, ev));

                    eventosFiltrados.forEach(ev => {
                      if (usedIds.has(ev.id)) return;
                      if (ev.evento_par_id) {
                        const par = evById.get(ev.evento_par_id);
                        if (par && !usedIds.has(par.id)) {
                          const falta = ev.tipo_evento !== 'horas_extra' ? ev : par;
                          const he = ev.tipo_evento === 'horas_extra' ? ev : par;
                          usedIds.add(falta.id);
                          usedIds.add(he.id);
                          paired.push({ falta, he, movId: ev.movimiento_id ?? par.movimiento_id ?? null });
                        }
                      }
                    });

                    const solos = eventosFiltrados.filter(ev => !usedIds.has(ev.id));

                    return (
                      <>
                        {paired.map(({ falta, he, movId }) => (
                          <div key={`pair-${movId}`} className="bg-[#060e1c] border border-purple-500/15 rounded-2xl overflow-hidden">
                            <div className="px-4 py-2 bg-purple-500/5 border-b border-purple-500/10 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Sustitución #{movId}</span>
                              <span className="text-[10px] text-white/25">·</span>
                              <span className="text-[10px] text-white/30">
                                {falta?.puesto_nombre} — {falta?.cliente_nombre || he?.cliente_nombre}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                              <div className="p-2">
                                {falta ? (
                                  <EventoCard
                                    evento={falta}
                                    onEstadoChange={handleEstadoChange}
                                    onDescargarBoleta={handleDescargarBoleta}
                                    onDescargarActa={handleDescargarActa}
                                    onDescargarAnulacion={handleDescargarAnulacion}
                                    onAnular={(ev) => setModalAnulacion(ev)}
                                    compact
                                    label="TITULAR — Descuento"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center py-6 text-white/15 text-xs">Sin evento titular</div>
                                )}
                              </div>
                              <div className="p-2">
                                {he ? (
                                  <EventoCard
                                    evento={he}
                                    onEstadoChange={handleEstadoChange}
                                    onDescargarBoleta={handleDescargarBoleta}
                                    onDescargarActa={handleDescargarActa}
                                    onDescargarAnulacion={handleDescargarAnulacion}
                                    onAnular={(ev) => setModalAnulacion(ev)}
                                    compact
                                    label="CUBRIENTE — Horas Extra"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center py-6 text-white/15 text-xs">Sin evento HE</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {solos.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {solos.map((ev) => (
                              <EventoCard
                                key={ev.id}
                                evento={ev}
                                onEstadoChange={handleEstadoChange}
                                onDescargarBoleta={handleDescargarBoleta}
                                onDescargarActa={handleDescargarActa}
                                onDescargarAnulacion={handleDescargarAnulacion}
                                onAnular={(ev) => setModalAnulacion(ev)}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </>);
        })()}
        </React.Fragment>)}
      </div>

      {/* ── Modal de anulación ─────────────────────────────────────────── */}
      {modalAnulacion && (
        <ModalAnulacion
          evento={modalAnulacion}
          onConfirm={handleAnular}
          onClose={() => setModalAnulacion(null)}
        />
      )}

      {/* ── Modal configuración empresa ──────────────────────────────────── */}
      {modalConfig && (
        <ModalConfigEmpresa onClose={() => setModalConfig(false)} />
      )}

      {/* ── Modal causales acta ─────────────────────────────────────────── */}
      {modalCausales && (
        <ModalCausalesActa
          evento={modalCausales}
          onGenerar={(causales, hechos) => generarActaConCausales(modalCausales, causales, hechos)}
          onClose={() => setModalCausales(null)}
        />
      )}

      {/* ── Modal nuevo evento ──────────────────────────────────────────── */}
      {modalNuevo && (
        <ModalNuevoEvento
          onClose={() => setModalNuevo(false)}
          onCreate={handleCrearEvento}
        />
      )}
    </AdminLayout>
  );
}
