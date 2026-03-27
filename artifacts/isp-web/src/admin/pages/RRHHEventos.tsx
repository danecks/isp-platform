import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  ClipboardList, AlertTriangle, RefreshCw, FileText,
  Download, CheckCircle2, Clock, XCircle, Loader2,
  User, Building2, Briefcase, Search, Filter,
  ChevronDown, Shield, Calendar, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { EventoRrhh } from "@/lib/pdfRrhh";
import { generarBoletaDescuento, generarActaAdministrativa } from "@/lib/pdfRrhh";

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

// ─── Badges de estado ─────────────────────────────────────────────────────────
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
  } catch {
    return iso;
  }
}

function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Tarjeta de evento individual ────────────────────────────────────────────
function EventoCard({
  evento,
  onEstadoChange,
  onDescargarBoleta,
  onDescargarActa,
}: {
  evento: EventoRrhh;
  onEstadoChange: (id: number, estado: string) => Promise<void>;
  onDescargarBoleta: (evento: EventoRrhh) => void;
  onDescargarActa: (evento: EventoRrhh) => void;
}) {
  const [cambioEstado, setCambioEstado] = useState(false);
  const [loadingEstado, setLoadingEstado] = useState(false);
  const estadoCfg = ESTADO_CONFIG[evento.estado] ?? ESTADO_CONFIG.pendiente;
  const tipoCfg   = TIPO_CONFIG[evento.tipo_evento] ?? TIPO_CONFIG.falta;

  const numEvento = `ERH-${String(evento.id).padStart(4, "0")}`;
  const docsGenerados = (evento.documentos_generados ?? []) as Array<{ tipo: string; usuario: string; fecha: string }>;

  async function cambiar(nuevoEstado: string) {
    setLoadingEstado(true);
    setCambioEstado(false);
    try {
      await onEstadoChange(evento.id, nuevoEstado);
    } finally {
      setLoadingEstado(false);
    }
  }

  return (
    <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors">
      {/* Encabezado de la tarjeta */}
      <div className="px-5 py-3.5 border-b border-white/6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{evento.employee_nombre}</p>
            <p className="text-[11px] text-white/35">{numEvento} · {fmtFecha(evento.fecha)} {fmtHora(evento.fecha)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tipo evento */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tipoCfg.className}`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {tipoCfg.label}
          </span>

          {/* Estado con dropdown */}
          <div className="relative">
            <button
              onClick={() => setCambioEstado((p) => !p)}
              disabled={loadingEstado}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${estadoCfg.className}`}
            >
              {loadingEstado ? <Loader2 className="w-3 h-3 animate-spin" /> : estadoCfg.icon}
              {estadoCfg.label}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {cambioEstado && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-[#0c1929] border border-white/10 rounded-xl shadow-xl min-w-[140px] overflow-hidden">
                {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => cambiar(key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors
                      ${key === evento.estado ? "text-white/80 bg-white/5" : "text-white/50"}`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cuerpo de la tarjeta */}
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

        {/* Documentos ya generados */}
        {docsGenerados.length > 0 && (
          <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
            <p className="text-[10px] text-purple-400/60 mb-2 font-medium">Documentos generados</p>
            <div className="space-y-1">
              {docsGenerados.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-purple-400/50" />
                  <span className="text-[11px] text-white/40 capitalize">{d.tipo}</span>
                  <span className="text-[10px] text-white/25">—</span>
                  <span className="text-[10px] text-white/25">{fmtFecha(d.fecha)} por {d.usuario}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones de descarga */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onDescargarBoleta(evento)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 rounded-xl text-xs text-white/60 hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Boleta de descuento
          </button>
          <button
            onClick={() => onDescargarActa(evento)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 rounded-xl text-xs text-white/60 hover:text-white transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Acta administrativa
          </button>
        </div>
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

  // Construir URL con filtros
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
    cerrados: string; faltas: string; suspensiones: string;
    ultimos_7_dias: string; ultimos_30_dias: string;
  }>({
    queryKey: ["rrhh-stats"],
    queryFn: () => apiFetch(`${API}/rrhh/stats`),
    staleTime: 60_000,
  });

  async function handleEstadoChange(id: number, estado: string) {
    try {
      await apiPatch(`${API}/rrhh/eventos/${id}/estado`, { estado });
      qc.invalidateQueries({ queryKey: ["rrhh-eventos"] });
      qc.invalidateQueries({ queryKey: ["rrhh-stats"] });
      toast({ title: "Estado actualizado", description: `Evento actualizado a "${ESTADO_CONFIG[estado]?.label ?? estado}"` });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    }
  }

  async function registrarDescarga(evento: EventoRrhh, tipo: "boleta" | "acta") {
    try {
      await apiPatch(`${API}/rrhh/eventos/${evento.id}/documentos`, {
        tipo,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "usuario",
      });
      qc.invalidateQueries({ queryKey: ["rrhh-eventos"] });
    } catch {
      // No bloquear la descarga si el registro falla
    }
  }

  async function handleDescargarBoleta(evento: EventoRrhh) {
    try {
      await generarBoletaDescuento(evento);
      await registrarDescarga(evento, "boleta");
      toast({ title: "Boleta de descuento generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
    } catch (err) {
      toast({ title: "Error al generar PDF", description: "Intenta de nuevo", variant: "destructive" });
    }
  }

  async function handleDescargarActa(evento: EventoRrhh) {
    try {
      await generarActaAdministrativa(evento);
      await registrarDescarga(evento, "acta");
      toast({ title: "Acta administrativa generada", description: `ACT-${String(evento.id).padStart(5, "0")}` });
    } catch (err) {
      toast({ title: "Error al generar PDF", description: "Intenta de nuevo", variant: "destructive" });
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
              Faltas y suspensiones registradas desde Operaciones con documentos adjuntos
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
              { label: "Total eventos", value: stats.total, color: "text-white", bg: "bg-white/5" },
              { label: "Pendientes", value: stats.pendientes, color: "text-yellow-400", bg: "bg-yellow-400/5" },
              { label: "Faltas registradas", value: stats.faltas, color: "text-red-400", bg: "bg-red-400/5" },
              { label: "Últimos 7 días", value: stats.ultimos_7_dias, color: "text-purple-400", bg: "bg-purple-400/5" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border border-white/8 rounded-2xl p-4`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

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
            className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-primary/50 appearance-none pr-8"
          >
            <option value="">Todos los tipos</option>
            <option value="falta">Falta</option>
            <option value="suspension">Suspensión</option>
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-primary/50 appearance-none pr-8"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="cerrado">Cerrado</option>
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
            <p className="text-xs text-white/30">{eventos.length} evento{eventos.length !== 1 ? "s" : ""} encontrado{eventos.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {eventos.map((ev) => (
                <EventoCard
                  key={ev.id}
                  evento={ev}
                  onEstadoChange={handleEstadoChange}
                  onDescargarBoleta={handleDescargarBoleta}
                  onDescargarActa={handleDescargarActa}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
