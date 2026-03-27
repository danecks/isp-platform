import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { AdminLayout } from "../layout/AdminLayout";
import {
  ClipboardList, AlertTriangle, RefreshCw, FileText,
  Download, CheckCircle2, Clock, Loader2,
  User, Building2, Briefcase, Search,
  Shield, Calendar, BookOpen, Ban, XCircle,
  AlertCircle, ChevronDown,
  ShieldAlert, ShieldCheck, ShieldOff, BarChart2,
  TrendingUp, ArrowUpRight, Minus, Users2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { EventoRrhh } from "@/lib/pdfRrhh";
import {
  generarBoletaDescuento, generarActaAdministrativa,
  generarDocumentoAnulacion, MOTIVO_ANULACION_LABELS,
} from "@/lib/pdfRrhh";

const API = "/api";

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
}

async function apiPatch(url: string, body: object): Promise<any> {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

async function apiPost(url: string, body: object): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

// ─── Configuración de estados ─────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pendiente: {
    label: "Pendiente",
    className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    icon: <Clock className="w-3 h-3" />,
  },
  en_proceso: {
    label: "En proceso",
    className: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    icon: <RefreshCw className="w-3 h-3" />,
  },
  cerrado: {
    label: "Cerrado",
    className: "text-green-400 bg-green-400/10 border-green-400/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  anulado: {
    label: "ANULADO",
    className: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: <Ban className="w-3 h-3" />,
  },
};

const TIPO_CONFIG: Record<string, { label: string; className: string }> = {
  falta: {
    label: "Falta injustificada",
    className: "text-red-400 bg-red-400/10 border-red-400/20",
  },
  suspension: {
    label: "Suspensión",
    className: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  },
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
}: {
  evento: EventoRrhh;
  onEstadoChange: (id: number, estado: string) => Promise<void>;
  onDescargarBoleta: (evento: EventoRrhh) => void;
  onDescargarActa: (evento: EventoRrhh) => void;
  onDescargarAnulacion: (evento: EventoRrhh) => void;
  onAnular: (evento: EventoRrhh) => void;
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
    <div className={`border rounded-2xl overflow-hidden transition-colors
      ${isAnulado
        ? "bg-[#0a0a0a] border-red-500/15 opacity-80"
        : "bg-[#07111f] border-white/8 hover:border-white/15"}`}
    >
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
      <div className="px-5 py-3.5 border-b border-white/6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            ${isAnulado ? "bg-red-500/10 border border-red-500/20" : "bg-purple-500/15 border border-purple-500/20"}`}
          >
            {isAnulado
              ? <XCircle className="w-4 h-4 text-red-400/60" />
              : <ClipboardList className="w-4 h-4 text-purple-400" />
            }
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${isAnulado ? "text-white/50 line-through" : "text-white"}`}>
              {evento.employee_nombre}
            </p>
            <p className="text-[11px] text-white/30">{numEvento} · {fmtFecha(evento.fecha)} {fmtHora(evento.fecha)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tipo */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tipoCfg.className} ${isAnulado ? "opacity-40" : ""}`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {tipoCfg.label}
          </span>

          {/* Estado (solo dropdown si no está anulado) */}
          {isAnulado ? (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${estadoCfg.className}`}>
              {estadoCfg.icon}
              {estadoCfg.label}
            </span>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowEstadoMenu((p) => !p)}
                disabled={loadingEstado}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${estadoCfg.className}`}
              >
                {loadingEstado ? <Loader2 className="w-3 h-3 animate-spin" /> : estadoCfg.icon}
                {estadoCfg.label}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {showEstadoMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-[#0c1929] border border-white/10 rounded-xl shadow-xl min-w-[140px] overflow-hidden">
                  {Object.entries(ESTADO_CONFIG)
                    .filter(([key]) => key !== "anulado")
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
      <div className="p-5 space-y-4">
        {/* Info del evento */}
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

        {/* Observaciones */}
        {evento.observaciones && (
          <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
            <p className="text-[10px] text-white/30 mb-1">Observaciones</p>
            <p className="text-xs text-white/55 leading-relaxed">{evento.observaciones}</p>
          </div>
        )}

        {/* Bloque de auditoría de anulación */}
        {isAnulado && evento.anulado_por && (
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

        {/* Documentos generados */}
        {docsGenerados.length > 0 && (
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

        {/* Botones de acción */}
        {isAnulado ? (
          // Solo descarga del acta de anulación disponible
          <button
            onClick={() => onDescargarAnulacion(evento)}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-500/15 rounded-xl text-xs text-red-400/70 hover:text-red-400 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar acta de anulación
          </button>
        ) : (
          <>
            {/* Botones de documentos */}
            <div className="flex gap-2">
              <button
                onClick={() => onDescargarBoleta(evento)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 rounded-xl text-xs text-white/60 hover:text-white transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Boleta
              </button>
              <button
                onClick={() => onDescargarActa(evento)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 rounded-xl text-xs text-white/60 hover:text-white transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                Acta
              </button>
            </div>

            {/* Botón anular */}
            <button
              onClick={() => onAnular(evento)}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-transparent hover:bg-red-500/8 border border-red-500/15 hover:border-red-500/30 rounded-xl text-xs text-red-400/50 hover:text-red-400 transition-all"
            >
              <Ban className="w-3.5 h-3.5" />
              Anular evento
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RRHHEventos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [modalAnulacion, setModalAnulacion] = useState<EventoRrhh | null>(null);

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

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["rrhh-eventos"] });
    qc.invalidateQueries({ queryKey: ["rrhh-stats"] });
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
      await apiPost(`${API}/rrhh/eventos/${modalAnulacion.id}/anular`, {
        motivoAnulacion: motivo,
        usuario,
      });
      invalidar();
      setModalAnulacion(null);
      toast({
        title: "Evento anulado correctamente",
        description: `ERH-${String(modalAnulacion.id).padStart(4, "0")} marcado como ANULADO. Los documentos han quedado sin efecto legal.`,
      });
    } catch (e: any) {
      toast({ title: "Error al anular", description: e?.error || "Intenta de nuevo", variant: "destructive" });
      throw e;
    }
  }

  async function registrarDescarga(evento: EventoRrhh, tipo: "boleta" | "acta" | "anulacion") {
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
      await generarBoletaDescuento(evento);
      await registrarDescarga(evento, "boleta");
      toast({ title: "Boleta generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  async function handleDescargarActa(evento: EventoRrhh) {
    try {
      await generarActaAdministrativa(evento);
      await registrarDescarga(evento, "acta");
      toast({ title: "Acta administrativa generada", description: `ACT-${String(evento.id).padStart(5, "0")}` });
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
              <h1 className="text-xl font-bold text-white">Eventos RRHH</h1>
            </div>
            <p className="text-sm text-white/40">
              Faltas y suspensiones · boleta de descuento · acta administrativa · reversión con auditoría
            </p>
          </div>
          <button
            onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["rrhh-stats"] }); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/50 hover:text-white transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>

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
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-primary/50 appearance-none"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="cerrado">Cerrado</option>
            <option value="anulado">Anulado</option>
          </select>
        </div>

        {/* ── Lista de eventos ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : eventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList className="w-10 h-10 text-white/15" />
            <p className="text-sm text-white/30">No hay eventos RRHH registrados</p>
            <p className="text-xs text-white/20 text-center max-w-xs">
              Los eventos se crean automáticamente al registrar una falta o suspensión en el Pizarrón Operativo
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-white/30">
              {eventos.length} evento{eventos.length !== 1 ? "s" : ""} ·{" "}
              {eventos.filter((e) => e.estado === "anulado").length} anulado{eventos.filter((e) => e.estado === "anulado").length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {eventos.map((ev) => (
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
          </>
        )}
      </div>

      {/* ── Modal de anulación ─────────────────────────────────────────── */}
      {modalAnulacion && (
        <ModalAnulacion
          evento={modalAnulacion}
          onConfirm={handleAnular}
          onClose={() => setModalAnulacion(null)}
        />
      )}
    </AdminLayout>
  );
}
