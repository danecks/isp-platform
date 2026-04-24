import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  AlertTriangle, Bell, BellRing, CheckCircle2, Clock, Eye,
  Loader2, RefreshCw, Play, ShieldAlert, Repeat2, Zap,
  User, MapPin, Briefcase, ChevronDown, ChevronUp,
  ArrowRight, TriangleAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const API_BASE = "/api";

// Header de sesión admin para todos los fetches del archivo.
const sessionHeader = () => ({ "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "" });

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DatosClave {
  scoreRotacion?: number;
  nivelRotacion?: string;
  totalSalidas?: number;
  movimientos90d?: number;
  clientesDistintos?: number;
  puestosDistintos?: number;
  tendencia?: string;
  scoreDisc?: number;
  clasificacion?: string;
  faltas30d?: number;
  totalFaltas?: number;
  suspensiones?: number;
  nivelRiesgo?: string;
  salidas?: number;
  faltas?: number;
  clientes?: number;
  tendenciaRotacion?: string;
  movimientosPrev90d?: number;
  tendenciaDisc?: string;
}

interface Alerta {
  id: number;
  employeeId: number;
  employeeNombre: string;
  puesto: string | null;
  area: string | null;
  sede: string | null;
  estadoLaboral: string;
  tipo: string;
  prioridad: "alta" | "media" | "baja";
  estado: "nueva" | "en_revision" | "resuelta";
  datosClave: DatosClave;
  sugerencia: string | null;
  generadaAt: string;
  vistaAt: string | null;
  resueltaAt: string | null;
  resueltaPor: string | null;
}

interface AlertasResponse {
  alertas: Alerta[];
  resumen: {
    nueva: number;
    en_revision: number;
    resuelta: number;
    alta: number;
    media: number;
    baja: number;
  };
}

// ─── Config visual ────────────────────────────────────────────────────────────

const TIPO_CFG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }> = {
  rotacion_alta: {
    label: "Rotación Alta",
    icon: Repeat2,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/25",
  },
  disciplina: {
    label: "Disciplinario",
    icon: ShieldAlert,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/25",
  },
  combinada: {
    label: "Riesgo Combinado",
    icon: Zap,
    color: "text-rose-400",
    bg: "bg-rose-400/10",
    border: "border-rose-400/25",
  },
  tendencia_negativa: {
    label: "Tendencia Negativa",
    icon: TriangleAlert,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/25",
  },
};

const PRIORIDAD_CFG = {
  alta:  { label: "Alta",  color: "text-red-400",    bg: "bg-red-400/15 border-red-400/30"    },
  media: { label: "Media", color: "text-yellow-400", bg: "bg-yellow-400/15 border-yellow-400/30" },
  baja:  { label: "Baja",  color: "text-blue-400",   bg: "bg-blue-400/15 border-blue-400/30"  },
} as const;

const ESTADO_CFG = {
  nueva:        { label: "Nueva",       color: "text-white/70",  bg: "bg-white/8 border-white/15",     icon: BellRing     },
  en_revision:  { label: "En revisión", color: "text-blue-400",  bg: "bg-blue-400/10 border-blue-400/20", icon: Eye          },
  resuelta:     { label: "Resuelta",    color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", icon: CheckCircle2  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelativa(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 2)   return "hace un momento";
  if (min < 60)  return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24)  return `hace ${hrs} h`;
  const días = Math.floor(hrs / 24);
  if (días < 30) return `hace ${días} días`;
  return `hace ${Math.floor(días / 30)} meses`;
}

// ─── Tarjeta de datos clave ───────────────────────────────────────────────────

function DatosClavePill({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${danger ? "bg-red-400/8 border-red-400/20" : "bg-white/5 border-white/10"}`}>
      <p className={`text-xs font-bold ${danger ? "text-red-400" : "text-white/70"}`}>{value}</p>
      <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function DatosClaveDisciplina({ d }: { d: DatosClave }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DatosClavePill label="Score disc." value={d.scoreDisc ?? "—"} />
      <DatosClavePill label="Faltas 30d" value={d.faltas30d ?? 0} danger={(d.faltas30d ?? 0) >= 3} />
      <DatosClavePill label="Faltas total" value={d.totalFaltas ?? 0} danger={(d.totalFaltas ?? 0) >= 5} />
      <DatosClavePill label="Suspensiones" value={d.suspensiones ?? 0} danger={(d.suspensiones ?? 0) > 0} />
    </div>
  );
}

function DatosClaveRotacion({ d }: { d: DatosClave }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DatosClavePill label="Score rot." value={d.scoreRotacion ?? "—"} />
      <DatosClavePill label="Salidas" value={d.totalSalidas ?? d.salidas ?? 0} danger={(d.totalSalidas ?? d.salidas ?? 0) >= 3} />
      <DatosClavePill label="Movim. 90d" value={d.movimientos90d ?? 0} danger={(d.movimientos90d ?? 0) >= 4} />
      <DatosClavePill label="Clientes" value={d.clientesDistintos ?? d.clientes ?? 0} danger={(d.clientesDistintos ?? d.clientes ?? 0) >= 4} />
    </div>
  );
}

function DatosClaveCombinada({ d }: { d: DatosClave }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DatosClavePill label="Score rot." value={d.scoreRotacion ?? "—"} danger={(d.scoreRotacion ?? 100) < 60} />
      <DatosClavePill label="Score disc." value={d.scoreDisc ?? "—"} danger={(d.scoreDisc ?? 100) < 70} />
      <DatosClavePill label="Salidas" value={d.salidas ?? 0} danger={(d.salidas ?? 0) >= 2} />
      <DatosClavePill label="Faltas" value={d.faltas ?? 0} danger={(d.faltas ?? 0) >= 2} />
      <DatosClavePill label="Suspensiones" value={d.suspensiones ?? 0} danger={(d.suspensiones ?? 0) > 0} />
    </div>
  );
}

function DatosClaveTendencia({ d }: { d: DatosClave }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DatosClavePill label="Mov. 90d" value={d.movimientos90d ?? 0} danger={(d.movimientos90d ?? 0) >= 3} />
      <DatosClavePill label="Mov. prev. 90d" value={d.movimientosPrev90d ?? 0} />
      <DatosClavePill label="Faltas 30d" value={d.faltas30d ?? 0} danger={(d.faltas30d ?? 0) >= 1} />
      <DatosClavePill label="T. Rotación" value={d.tendenciaRotacion === "sube" ? "↑ Sube" : d.tendenciaRotacion === "baja" ? "↓ Baja" : "= Estable"} />
    </div>
  );
}

function DatosClaveSection({ tipo, datosClave }: { tipo: string; datosClave: DatosClave }) {
  if (tipo === "disciplina") return <DatosClaveDisciplina d={datosClave} />;
  if (tipo === "rotacion_alta") return <DatosClaveRotacion d={datosClave} />;
  if (tipo === "combinada") return <DatosClaveCombinada d={datosClave} />;
  if (tipo === "tendencia_negativa") return <DatosClaveTendencia d={datosClave} />;
  return null;
}

// ─── Tarjeta de alerta ────────────────────────────────────────────────────────

function TarjetaAlerta({ alerta, onCambiarEstado, onVerColaborador }: {
  alerta: Alerta;
  onCambiarEstado: (id: number, estado: string) => void;
  onVerColaborador: (id: number) => void;
}) {
  const [expandida, setExpandida] = useState(false);

  const tipoCfg = TIPO_CFG[alerta.tipo] ?? {
    label: alerta.tipo, icon: AlertTriangle, color: "text-white/50", bg: "bg-white/5", border: "border-white/10",
  };
  const priorCfg = PRIORIDAD_CFG[alerta.prioridad];
  const estadoCfg = ESTADO_CFG[alerta.estado];
  const TipoIcon = tipoCfg.icon;
  const EstadoIcon = estadoCfg.icon;

  return (
    <div className={`rounded-xl border ${tipoCfg.border} ${tipoCfg.bg} overflow-hidden transition-all`}>
      {/* Cabecera */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icono tipo */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tipoCfg.bg} border ${tipoCfg.border}`}>
            <TipoIcon className={`w-4.5 h-4.5 ${tipoCfg.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Nombre + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-white truncate">{alerta.employeeNombre}</p>
              {/* Badge tipo */}
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tipoCfg.color} ${tipoCfg.bg} ${tipoCfg.border}`}>
                {tipoCfg.label}
              </span>
              {/* Prioridad */}
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priorCfg.color} ${priorCfg.bg}`}>
                {priorCfg.label}
              </span>
              {/* Estado */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${estadoCfg.color} ${estadoCfg.bg}`}>
                <EstadoIcon className="w-2.5 h-2.5" />
                {estadoCfg.label}
              </span>
              {!alerta.vistaAt && alerta.estado === "nueva" && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" title="No vista" />
              )}
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/35">
              {alerta.puesto && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {alerta.puesto}
                </span>
              )}
              {alerta.sede && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {alerta.sede}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Generada {fmtRelativa(alerta.generadaAt)}
              </span>
              {alerta.vistaAt && (
                <span className="flex items-center gap-1 text-white/20">
                  <Eye className="w-3 h-3" />
                  Vista {fmtRelativa(alerta.vistaAt)}
                </span>
              )}
            </div>
          </div>

          {/* Expandir */}
          <button
            onClick={() => setExpandida((v) => !v)}
            className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5"
          >
            {expandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Datos clave siempre visibles */}
        <div className="mt-3 pl-12">
          <DatosClaveSection tipo={alerta.tipo} datosClave={alerta.datosClave} />
        </div>
      </div>

      {/* Detalle expandido */}
      {expandida && (
        <div className="border-t border-white/8 px-4 py-3 space-y-3">
          {/* Sugerencia */}
          {alerta.sugerencia && (
            <div className="flex items-start gap-2.5 bg-white/4 rounded-lg px-3 py-2.5">
              <Bell className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-primary/70 uppercase tracking-widest font-semibold mb-0.5">
                  Sugerencia de acción
                </p>
                <p className="text-xs text-white/70 leading-relaxed">{alerta.sugerencia}</p>
              </div>
            </div>
          )}

          {/* Historial estado */}
          {alerta.resueltaAt && (
            <p className="text-[11px] text-white/25 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              Resuelta {fmtRelativa(alerta.resueltaAt)}
              {alerta.resueltaPor && ` por ${alerta.resueltaPor}`}
            </p>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onVerColaborador(alerta.employeeId)}
              className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              Ver colaborador
              <ArrowRight className="w-3 h-3" />
            </button>

            {alerta.estado === "nueva" && (
              <button
                onClick={() => onCambiarEstado(alerta.id, "en_revision")}
                className="flex items-center gap-1.5 text-xs bg-blue-400/10 border border-blue-400/20 text-blue-400 hover:bg-blue-400/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Marcar en revisión
              </button>
            )}

            {alerta.estado !== "resuelta" && (
              <button
                onClick={() => onCambiarEstado(alerta.id, "resuelta")}
                className="flex items-center gap-1.5 text-xs bg-green-400/10 border border-green-400/20 text-green-400 hover:bg-green-400/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marcar como resuelta
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RRHHAlertas() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filtroEstado, setFiltroEstado] = useState<"activas" | "todas" | "resuelta">("activas");
  const [filtroPrioridad, setFiltroPrioridad] = useState<"" | "alta" | "media" | "baja">("");

  const { data, isLoading, isError, refetch } = useQuery<AlertasResponse>({
    queryKey: ["rrhh-alertas", filtroEstado, filtroPrioridad],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("estado", filtroEstado);
      if (filtroPrioridad) params.set("prioridad", filtroPrioridad);
      return fetch(`${API_BASE}/rrhh/alertas?${params}`, { headers: sessionHeader() }).then((r) => r.json());
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const mutacionGenerar = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/rrhh/alertas/generar`, { method: "POST", headers: sessionHeader() }).then((r) => r.json()),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["rrhh-alertas"] });
      toast({
        title: "Análisis completado",
        description: `${res.procesados} colaboradores analizados · ${res.alertasNuevas} alertas nuevas generadas`,
      });
    },
    onError: () => toast({ title: "Error", description: "No se pudo ejecutar el análisis.", variant: "destructive" }),
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      fetch(`${API_BASE}/rrhh/alertas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ estado }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rrhh-alertas"] });
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" }),
  });

  const handleCambiarEstado = (id: number, estado: string) => {
    mutacionEstado.mutate({ id, estado });
  };

  const handleVerColaborador = (empId: number) => {
    navigate(`/admin/empleados?id=${empId}`);
  };

  const resumen = data?.resumen;
  const alertas = data?.alertas ?? [];

  return (
    <AdminLayout title="Alertas RRHH">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Encabezado */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BellRing className="w-5 h-5 text-primary" />
              Alertas Automáticas RRHH
            </h1>
            <p className="text-sm text-white/40 mt-0.5">
              Detección de patrones de riesgo operativo y disciplinario
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8 transition-all"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => mutacionGenerar.mutate()}
              disabled={mutacionGenerar.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {mutacionGenerar.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Play className="w-4 h-4" />
              }
              Analizar ahora
            </button>
          </div>
        </div>

        {/* Tarjetas resumen */}
        {resumen && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Nuevas",       value: resumen.nueva,       color: "text-white/70" },
              { label: "En revisión",  value: resumen.en_revision,  color: "text-blue-400" },
              { label: "Resueltas",    value: resumen.resuelta,     color: "text-green-400" },
              { label: "Prioridad alta",  value: resumen.alta,   color: "text-red-400"    },
              { label: "Prioridad media", value: resumen.media,  color: "text-yellow-400" },
              { label: "Prioridad baja",  value: resumen.baja,   color: "text-blue-400"   },
            ].map((s) => (
              <div key={s.label} className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0c1929] border border-white/10 rounded-lg p-1">
            {(["activas", "todas", "resuelta"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filtroEstado === e
                    ? "bg-primary/20 text-primary"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {e === "activas" ? "Activas" : e === "todas" ? "Todas" : "Resueltas"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#0c1929] border border-white/10 rounded-lg p-1">
            {(["", "alta", "media", "baja"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFiltroPrioridad(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filtroPrioridad === p
                    ? "bg-primary/20 text-primary"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {p === "" ? "Todas las prioridades" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Estado de carga */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-white/40">Cargando alertas…</span>
          </div>
        )}

        {isError && (
          <div className="text-center py-12 text-red-400/60 text-sm">
            Error al cargar alertas. Intenta de nuevo.
          </div>
        )}

        {/* Lista de alertas */}
        {!isLoading && !isError && alertas.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-white/30 uppercase tracking-widest">
              {alertas.length} alerta{alertas.length !== 1 ? "s" : ""}
            </p>
            {alertas.map((alerta) => (
              <TarjetaAlerta
                key={alerta.id}
                alerta={alerta}
                onCambiarEstado={handleCambiarEstado}
                onVerColaborador={handleVerColaborador}
              />
            ))}
          </div>
        )}

        {/* Estado vacío */}
        {!isLoading && !isError && alertas.length === 0 && (
          <div className="text-center py-20">
            <CheckCircle2 className="w-14 h-14 text-green-400/20 mx-auto mb-4" />
            <p className="text-white/40 font-medium mb-1">
              {filtroEstado === "activas"
                ? "No hay alertas activas en este momento"
                : "No se encontraron alertas con los filtros actuales"}
            </p>
            <p className="text-white/20 text-sm mb-6">
              Usa "Analizar ahora" para escanear a todos los colaboradores y detectar nuevas señales de riesgo.
            </p>
            <button
              onClick={() => mutacionGenerar.mutate()}
              disabled={mutacionGenerar.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 mx-auto"
            >
              {mutacionGenerar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Ejecutar análisis
            </button>
          </div>
        )}

        {/* Leyenda explicativa */}
        <div className="bg-[#0a1628] border border-white/5 rounded-xl p-4 mt-2">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Cómo se generan las alertas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(TIPO_CFG).map(([tipo, cfg]) => {
              const Icon = cfg.icon;
              const descripciones: Record<string, string> = {
                rotacion_alta:      "Score rotación < 60  ó  ≥ 3 salidas de puesto  ó  ≥ 4 clientes distintos",
                disciplina:         "≥ 3 faltas en 30 días  ó  suspensiones registradas",
                combinada:          "Rotación alta simultánea con ≥ 2 faltas o suspensiones",
                tendencia_negativa: "Movimientos en aumento (tendencia 'sube') + actividad disciplinaria creciente",
              };
              return (
                <div key={tipo} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                  <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">{descripciones[tipo]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
