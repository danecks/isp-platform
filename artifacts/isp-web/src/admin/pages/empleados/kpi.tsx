import { useState, useEffect, useRef, type ElementType } from "react";
import { Link } from "wouter";
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
  
// ─── Tab: KPI ─────────────────────────────────────────────────────────────────

// ── Helpers visuales del KPI disciplinario ──────────────────────────────────

export const CLASIFICACION_CFG = {
  excelente: { label: "Excelente", color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20",  icon: ShieldCheck },
  regular:   { label: "Regular",   color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", icon: ShieldAlert  },
  riesgo:    { label: "Riesgo",    color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20",       icon: ShieldOff    },
} as const;

export const RIESGO_CFG = {
  bajo:  { label: "Bajo",  color: "text-green-400",  dot: "bg-green-400"  },
  medio: { label: "Medio", color: "text-yellow-400", dot: "bg-yellow-500" },
  alto:  { label: "Alto",  color: "text-red-400",    dot: "bg-red-400"    },
} as const;

export const TENDENCIA_CFG = {
  sube:    { label: "Sube",    icon: ArrowUpRight,   color: "text-red-400"    },
  baja:    { label: "Baja",    icon: ArrowDownRight, color: "text-green-400"  },
  estable: { label: "Estable", icon: Minus,          color: "text-white/40"   },
} as const;

export const TIPO_EVENTO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  falta:      { label: "Falta",      color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  suspension: { label: "Suspensión", color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20"       },
};

export const ROTACION_NIVEL_CFG = {
  bajo:  { label: "Estable",    color: "text-green-400",  dot: "bg-green-400",  bg: "bg-green-400/10 border-green-400/20"  },
  medio: { label: "Moderada",   color: "text-yellow-400", dot: "bg-yellow-500", bg: "bg-yellow-400/10 border-yellow-400/20" },
  alto:  { label: "Alta",       color: "text-red-400",    dot: "bg-red-400",    bg: "bg-red-400/10 border-red-400/20"       },
} as const;

export const ROL_MOV_CFG = {
  entrante: { label: "Asignado",   color: "text-teal-400",   bg: "bg-teal-400/10 border-teal-400/20"   },
  saliente: { label: "Removido",   color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
} as const;

// ─── Sección KPI de Rotación Operativa ────────────────────────────────────────

export function SeccionRotacion({ empId }: { empId: number }) {
  const { data: rot, isLoading } = useQuery<KPIRotacion>({
    queryKey: ["employee-rotation", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/rotation`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-white/30 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando KPI de rotación…
      </div>
    );
  }
  if (!rot) return null;

  const nivelCfg = ROTACION_NIVEL_CFG[rot.nivel];
  const tendCfg  = TENDENCIA_CFG[rot.tendencia];
  const TendIcon = tendCfg.icon;

  return (
    <div className="space-y-4">
      {/* Separador */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/25 uppercase tracking-widest flex items-center gap-1.5">
          <Repeat2 className="w-3 h-3" /> KPI Rotación Operativa
        </span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      {/* Alertas */}
      {rot.alertas.length > 0 && (
        <div className="space-y-1.5">
          {rot.alertas.map((alerta, i) => (
            <div key={i} className="flex items-start gap-2 bg-orange-400/5 border border-orange-400/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300">{alerta}</p>
            </div>
          ))}
        </div>
      )}

      {/* Score estabilidad + Nivel de rotación */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 text-center ${nivelCfg.bg}`}>
          <Repeat2 className={`w-5 h-5 mx-auto mb-1 ${nivelCfg.color}`} />
          <p className={`text-3xl font-bold ${nivelCfg.color}`}>{rot.score}</p>
          <p className={`text-[10px] mt-0.5 font-semibold uppercase tracking-wider ${nivelCfg.color}`}>
            Estabilidad
          </p>
          <p className="text-[9px] text-white/25 mt-1">Score / 100</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
          <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-1.5 ${nivelCfg.dot}`} />
          <p className={`text-lg font-bold ${nivelCfg.color}`}>{nivelCfg.label}</p>
          <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">Rotación</p>
          <div className={`flex items-center justify-center gap-1 mt-2 text-[10px] ${tendCfg.color}`}>
            <TendIcon className="w-3 h-3" />
            <span>Tendencia: {tendCfg.label}</span>
          </div>
          {rot.ultimoMovimiento && (
            <p className="text-[9px] text-white/20 mt-1.5">
              Último mov.: {fmtRelativa(rot.ultimoMovimiento)}
            </p>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.totalMovimientos === 0 ? "text-white/30" : rot.totalMovimientos >= 5 ? "text-red-400" : "text-blue-400"}`}>
            {rot.totalMovimientos}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Movimientos totales</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.totalSalidas === 0 ? "text-white/30" : rot.totalSalidas >= 3 ? "text-red-400" : "text-orange-400"}`}>
            {rot.totalSalidas}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Salidas de puesto</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.sustituciones === 0 ? "text-white/30" : "text-teal-400"}`}>
            {rot.sustituciones}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Sustituciones</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${rot.movimientos90d === 0 ? "text-white/30" : rot.movimientos90d >= 4 ? "text-red-400" : "text-yellow-400"}`}>
            {rot.movimientos90d}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Movim. · 90 días</p>
        </div>
      </div>

      {/* Cobertura */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <MapPinned className="w-3 h-3" /> Cobertura registrada
        </p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className={`text-xl font-bold ${rot.clientesDistintos >= 4 ? "text-red-400" : rot.clientesDistintos >= 3 ? "text-yellow-400" : "text-white/70"}`}>
              {rot.clientesDistintos}
            </p>
            <p className="text-[10px] text-white/30">Clientes distintos</p>
          </div>
          <div>
            <p className={`text-xl font-bold ${rot.puestosDistintos >= 5 ? "text-red-400" : rot.puestosDistintos >= 3 ? "text-yellow-400" : "text-white/70"}`}>
              {rot.puestosDistintos}
            </p>
            <p className="text-[10px] text-white/30">Puestos distintos</p>
          </div>
        </div>
      </div>

      {/* Historial de movimientos */}
      {rot.historial.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Historial de movimientos ({rot.totalMovimientos})
          </p>
          <div className="space-y-1.5">
            {rot.historial.map((mov) => {
              const rolCfg = ROL_MOV_CFG[mov.rol];
              return (
                <div key={mov.id} className={`rounded-lg px-3 py-2.5 border flex items-center gap-3 ${rolCfg.bg}`}>
                  <ArrowLeftRight className={`w-3.5 h-3.5 shrink-0 ${rolCfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${rolCfg.color}`}>
                        {rolCfg.label}
                      </span>
                      {mov.tipo === "sustitucion" && (
                        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 rounded px-1.5">SUSTITUCIóN</span>
                      )}
                      {mov.puestoNombre && (
                        <span className="text-[10px] text-white/40">{mov.puestoNombre}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {mov.clienteNombre && (
                        <span className="text-[10px] text-white/25">{mov.clienteNombre}</span>
                      )}
                      {mov.contraparte && (
                        <span className="text-[10px] text-white/20">↔ {mov.contraparte}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-white/25 shrink-0">
                    {new Date(mov.fechaHora).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              );
            })}
            {rot.totalMovimientos > 15 && (
              <p className="text-[10px] text-white/20 text-center pt-1">
                +{rot.totalMovimientos - 15} movimientos más en el historial
              </p>
            )}
          </div>
        </div>
      )}

      {rot.historial.length === 0 && (
        <div className="text-center py-4">
          <Repeat2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/25">Sin movimientos operativos registrados</p>
        </div>
      )}

      {/* Leyenda */}
      <p className="text-[10px] text-white/15 border-t border-white/5 pt-3 leading-relaxed">
        Score = 100 − (salidas × 15) − (sustituciones extra × 8) − (clientes extra × 10) − (puestos extra × 5) · Estable ≥ 80 · Moderada 60–79 · Alta &lt; 60
      </p>
    </div>
  );
}

// ─── Resumen de dimensiones KPI ────────────────────────────────────────────────

export function ResumenDimensionesKPI({ empId }: { empId: number }) {
  const { data: disc } = useQuery<KPIDisciplinario>({
    queryKey: ["employee-disciplinary", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/disciplinary`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });
  const { data: rot } = useQuery<KPIRotacion>({
    queryKey: ["employee-rotation", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/rotation`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const dimDisc = disc
    ? { label: "Disciplinario", score: disc.score, nivel: CLASIFICACION_CFG[disc.clasificacion].label, color: CLASIFICACION_CFG[disc.clasificacion].color, icon: ShieldCheck }
    : null;
  const dimRot = rot
    ? { label: "Rotación", score: rot.score, nivel: ROTACION_NIVEL_CFG[rot.nivel].label, color: ROTACION_NIVEL_CFG[rot.nivel].color, icon: Repeat2 }
    : null;

  if (!dimDisc && !dimRot) return null;

  const dims = [dimDisc, dimRot].filter(Boolean) as NonNullable<typeof dimDisc>[];

  return (
    <div className="bg-[#0a1628] border border-white/8 rounded-xl p-4">
      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <BarChart2 className="w-3 h-3" /> Resumen de dimensiones KPI
      </p>
      <div className="grid grid-cols-2 gap-3">
        {dims.map((d) => {
          const Icon = d.icon;
          const pct = Math.max(0, Math.min(100, d.score));
          const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
          return (
            <div key={d.label} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${d.color}`} />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">{d.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-xl font-bold ${d.color}`}>{d.score}</p>
                <span className={`text-[10px] font-semibold ${d.color}`}>{d.nivel}</span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActaDesdeKPI({ empId }: { empId: number }) {
  const [open, setOpen] = useState(false);
  const [causales, setCausales] = useState<string[]>([]);
  const [hechosCustom, setHechosCustom] = useState("");
  const [generando, setGenerando] = useState(false);
  const { toast } = useToast();
  const getSession = () => getSessionToken();

  const handleGenerar = async () => {
    if (causales.length === 0) {
      toast({ title: "Seleccione al menos una causal", variant: "destructive" });
      return;
    }
    setGenerando(true);
    try {
      const hdr = { "x-isp-session": getSession() };
      const [configRes, numRes] = await Promise.all([
        fetch(`${API_BASE}/actas/datos-para-pdf/${empId}`, { headers: hdr }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/actas/siguiente-numero`, { method: "POST", headers: { ...hdr, "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : null),
      ]);
      if (!configRes) throw new Error("No se pudo obtener datos del empleado");
      if (!numRes?.numero) throw new Error("No se pudo obtener número de acta");
      const cfg = configRes?.config || {};
      const emp = configRes?.empleado || {};
      const hist = (configRes?.eventos_recientes || [])
        .filter((e: any) => ["falta","falta_injustificada","llamada_atencion_1","llamada_atencion_2","acta_administrativa"].includes(e.tipo_evento))
        .slice(0, 10);

      const { generarActaAdministrativa } = await import("@/lib/pdfRrhh");
      await generarActaAdministrativa({
        numero_acta: numRes.numero,
        representante_nombre: cfg.representante_nombre || "Representante Legal",
        representante_dpi: cfg.representante_dpi || "",
        direccion_empresa: cfg.direccion_empresa || "",
        nombre_empresa: cfg.nombre_empresa || "Investigaciones y Seguridad Profesional S.A.",
        empleado_nombre: emp.nombre_completo || "Empleado",
        empleado_dpi: emp.dpi || "",
        empleado_fecha_ingreso: emp.fecha_ingreso || "",
        empleado_cargo: emp.cargo || "Agente de Seguridad",
        puesto_nombre: emp.puesto_nombre || "",
        cliente_nombre: emp.cliente_nombre || "",
        fecha_evento: new Date().toISOString(),
        hechos: hechosCustom || "Acumulación de faltas disciplinarias según historial documentado.",
        notas_sistema: [],
        causal: "INCUMPLIMIENTO LABORAL",
        articulo_legal: "Art. 77",
        eventos_historial: hist.map((e: any) => ({ fecha: e.fecha, tipo: e.tipo_evento, notas: e.notas || "" })),
        causales_seleccionadas: causales,
      });
      toast({ title: "Acta generada", description: "El PDF se descargó correctamente." });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error al generar acta", description: err?.message || "Intenta de nuevo", variant: "destructive" });
    } finally {
      setGenerando(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[10px] font-semibold text-red-300 hover:text-red-200 transition-colors bg-red-500/10 hover:bg-red-500/15 rounded-lg px-3 py-2">
        <FileText className="w-3.5 h-3.5" /> Generar Acta Administrativa
      </button>
    );
  }

  return (
    <div className="space-y-3 mt-2 bg-[#0a1628] border border-white/8 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Seleccionar Causales</p>
        <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/50"><X className="w-3.5 h-3.5" /></button>
      </div>
      <CausalSelector selected={causales} onChange={setCausales} />
      <div>
        <label className="text-[10px] text-white/30 block mb-1">Hechos adicionales (opcional)</label>
        <textarea
          value={hechosCustom}
          onChange={e => setHechosCustom(e.target.value)}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20"
          placeholder="Describir hechos específicos o dejar en blanco para texto automático…"
        />
      </div>
      <button onClick={handleGenerar} disabled={generando || causales.length === 0}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg px-3 py-2 disabled:opacity-40 transition-colors">
        {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        {generando ? "Generando…" : "Descargar Acta PDF"}
      </button>
    </div>
  );
}

export function CausalSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [causales, setCausales] = useState<Array<{ id: string; label: string; desc: string; articulo: string }>>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    import("@/lib/pdfRrhh")
      .then(m => setCausales([...m.CAUSALES_ACTA]))
      .catch(() => setLoadError(true));
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  if (loadError) {
    return <p className="text-[10px] text-red-400 py-2">Error al cargar causales. Recarga la página e intenta de nuevo.</p>;
  }
  if (causales.length === 0) {
    return <div className="flex items-center gap-2 py-3 text-white/30 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" /> Cargando causales…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
      {causales.map(c => {
        const active = selected.includes(c.id);
        return (
          <button key={c.id} onClick={() => toggle(c.id)}
            className={`text-left rounded-lg px-3 py-2 border transition-colors ${active ? "bg-red-500/15 border-red-500/30 text-red-200" : "bg-white/3 border-white/8 text-white/50 hover:bg-white/5"}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${active ? "bg-red-500 border-red-500" : "border-white/20"}`}>
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
  );
}

export function SeccionDisciplinaria({ empId }: { empId: number }) {
  const { data: disc, isLoading } = useQuery<KPIDisciplinario>({
    queryKey: ["employee-disciplinary", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/disciplinary`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-white/30 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando KPI disciplinario…
      </div>
    );
  }
  if (!disc) return null;

  const cls  = CLASIFICACION_CFG[disc.clasificacion];
  const rsg  = RIESGO_CFG[disc.nivelRiesgo];
  const tend = TENDENCIA_CFG[disc.tendencia];
  const TendIcon = tend.icon;
  const ClsIcon  = cls.icon;

  return (
    <div className="space-y-4">
      {/* Separador */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/25 uppercase tracking-widest">KPI Disciplinario</span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      {/* Alertas automáticas */}
      {disc.alertas.length > 0 && (
        <div className="space-y-1.5">
          {disc.alertas.map((alerta, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-400/5 border border-red-400/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{alerta}</p>
            </div>
          ))}
        </div>
      )}

      {/* Score + Nivel de riesgo */}
      <div className="grid grid-cols-2 gap-3">
        {/* Puntuación */}
        <div className={`rounded-xl border p-4 text-center ${cls.bg}`}>
          <ClsIcon className={`w-5 h-5 mx-auto mb-1 ${cls.color}`} />
          <p className={`text-3xl font-bold ${cls.color}`}>{disc.score}</p>
          <p className={`text-[10px] mt-0.5 font-semibold uppercase tracking-wider ${cls.color}`}>{cls.label}</p>
          <p className="text-[9px] text-white/25 mt-1">Puntuación / 100</p>
        </div>
        {/* Nivel de riesgo */}
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
          <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-1.5 ${rsg.dot}`} />
          <p className={`text-lg font-bold ${rsg.color}`}>{rsg.label}</p>
          <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">Nivel de riesgo</p>
          <div className={`flex items-center justify-center gap-1 mt-2 text-[10px] ${tend.color}`}>
            <TendIcon className="w-3 h-3" />
            <span>Tendencia: {tend.label}</span>
          </div>
        </div>
      </div>

      {/* Métricas disciplinarias */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{disc.totalFaltas}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Faltas totales</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{disc.totalSuspensiones}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Suspensiones</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${disc.faltas30d >= 3 ? "text-red-400" : disc.faltas30d >= 1 ? "text-yellow-400" : "text-white/30"}`}>
            {disc.faltas30d}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Faltas · 30 días</p>
        </div>
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${disc.faltas90d >= 5 ? "text-red-400" : disc.faltas90d >= 3 ? "text-yellow-400" : "text-white/30"}`}>
            {disc.faltas90d}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Faltas · 90 días</p>
        </div>
      </div>

      {/* Historial de eventos disciplinarios */}
      {disc.eventos.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Historial disciplinario ({disc.eventos.length})
          </p>
          <div className="space-y-1.5">
            {disc.eventos.slice(0, 10).map((ev) => {
              const cfg = TIPO_EVENTO_CFG[ev.tipoEvento] ?? { label: ev.tipoEvento, color: "text-white/50", bg: "bg-white/5 border-white/10" };
              return (
                <div key={ev.id} className={`rounded-lg px-3 py-2.5 border flex items-center gap-3 ${ev.anulado ? "opacity-40" : cfg.bg}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                      {ev.anulado && <span className="text-[10px] bg-white/5 border border-white/10 text-white/30 rounded px-1.5">ANULADO</span>}
                      {ev.puestoNombre && <span className="text-[10px] text-white/30">{ev.puestoNombre}</span>}
                    </div>
                    {ev.observaciones && (
                      <p className="text-[10px] text-white/30 mt-0.5 truncate">{ev.observaciones}</p>
                    )}
                    {ev.coberturas && ev.coberturas.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {ev.coberturas.map((c, i) => {
                          const detalle = (
                            <>
                              Cubierto por <span className="font-semibold text-cyan-200">{c.cubridorNombre}</span>
                              {c.horas != null && c.horas > 0 && ` · ${c.horas} h`}
                              {c.monto != null && c.monto > 0 && ` · ${fmtQ(c.monto)} efectivo`}
                            </>
                          );
                          return (
                            <div key={i} className="flex items-center gap-1.5 text-[10px] text-cyan-300/80">
                              <UserCheck className="w-3 h-3 shrink-0 text-cyan-400/60" />
                              {c.heEventoId != null ? (
                                <Link
                                  href={`/admin/rrhh/eventos?empleado=${encodeURIComponent(c.cubridorNombre)}&evento=${c.heEventoId}`}
                                  className="truncate hover:text-cyan-200 hover:underline"
                                  title="Ver evento de horas extra"
                                >
                                  {detalle}
                                </Link>
                              ) : (
                                <span className="truncate">{detalle}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-white/25 shrink-0">
                    {new Date(ev.fecha).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              );
            })}
            {disc.eventos.length > 10 && (
              <p className="text-[10px] text-white/20 text-center pt-1">
                +{disc.eventos.length - 10} eventos más en el historial
              </p>
            )}
          </div>
        </div>
      )}

      {disc.eventos.length === 0 && (
        <div className="text-center py-4">
          <ShieldCheck className="w-8 h-8 text-green-400/20 mx-auto mb-2" />
          <p className="text-xs text-white/25">Sin eventos disciplinarios registrados</p>
        </div>
      )}

      {disc.score < 70 && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-red-300 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> Rendimiento bajo — Acción recomendada
          </p>
          <p className="text-[10px] text-white/30">
            El score disciplinario de este colaborador está en nivel de riesgo.
            Puede generar un acta administrativa directamente desde aquí.
          </p>
          <ActaDesdeKPI empId={empId} />
        </div>
      )}

      {/* Leyenda de cálculo */}
      <p className="text-[10px] text-white/15 border-t border-white/5 pt-3 leading-relaxed">
        Score = 100 − (faltas × 10) − (suspensiones × 20) · Excelente ≥ 90 · Regular 70–89 · Riesgo &lt; 70
      </p>
    </div>
  );
}

export function TabKPI({ empId }: { empId: number }) {
  const { data: kpi, isLoading, isError } = useQuery<KpiData>({
    queryKey: ["employee-kpi", empId],
    queryFn: () => fetch(`${API_BASE}/employees/${empId}/kpi`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-white/40">Calculando KPI…</span>
      </div>
    );
  }
  if (isError || !kpi) {
    return <div className="text-center py-16 text-white/30 text-sm">No se pudo cargar el KPI.</div>;
  }

  if (!kpi.tieneDatos) {
    return (
      <div className="space-y-4">
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-6 text-center">
          <Activity className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/50 text-sm font-medium">Sin actividad trazable en el período</p>
          <p className="text-white/25 text-xs mt-1">{kpi.periodo}</p>
          <p className="text-white/20 text-xs mt-3">
            Los KPI se alimentan automáticamente desde Tareas, Anticipos e Incidencias
            una vez que el colaborador registre actividad.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={CheckSquare} label="Tareas asignadas" value={0} color="text-white/40" />
          <KpiCard icon={TrendingUp} label="Completadas" value={0} color="text-white/40" />
          <KpiCard icon={Wallet} label="Anticipos" value={0} color="text-white/40" />
          <KpiCard icon={AlertTriangle} label="Incidencias" value={0} color="text-white/40" />
          <KpiCard icon={Zap} label="Emergencias" value={0} color="text-white/40" />
          <KpiCard icon={Shield} label="Asignaciones activas" value={kpi.asignaciones.activas} color="text-white/40" />
        </div>
        <SeccionDisciplinaria empId={empId} />
        <SeccionRotacion empId={empId} />
        <ResumenDimensionesKPI empId={empId} />
      </div>
    );
  }

  const tasaCompletadas = kpi.tareas.asignadas > 0
    ? Math.round((kpi.tareas.completadas / kpi.tareas.asignadas) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-white/35">
        <Clock className="w-3.5 h-3.5" />
        <span>Métricas de los {kpi.periodo}</span>
        {kpi.ultimaActividad && (
          <span className="text-white/25">· última actividad {fmtRelativa(kpi.ultimaActividad)}</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard icon={CheckSquare} label="Tareas asignadas" value={kpi.tareas.asignadas}
          sub={kpi.tareas.ultimaTarea ? `última: ${fmtRelativa(kpi.tareas.ultimaTarea)}` : null}
          color="text-blue-400" />
        <KpiCard icon={TrendingUp} label="Completadas" value={kpi.tareas.completadas}
          sub={`${tasaCompletadas}% de tasa`}
          color={tasaCompletadas >= 70 ? "text-green-400" : tasaCompletadas >= 40 ? "text-yellow-400" : "text-red-400"} />
        <KpiCard icon={Wallet} label="Anticipos solicitados" value={kpi.anticipos.solicitados}
          sub={kpi.anticipos.montoTotal > 0 ? `Total: ${fmtQ(kpi.anticipos.montoTotal)}` : null}
          color="text-yellow-400" />
        <KpiCard icon={AlertTriangle} label="Incidencias relacionadas" value={kpi.incidencias.relacionadas}
          sub={kpi.incidencias.ultimaIncidencia ? fmtRelativa(kpi.incidencias.ultimaIncidencia) : null}
          color={kpi.incidencias.relacionadas > 5 ? "text-red-400" : "text-orange-400"} />
        <KpiCard icon={Zap} label="Emergencias reportadas" value={kpi.emergencias.reportadas}
          sub={kpi.emergencias.ultimaEmergencia ? fmtRelativa(kpi.emergencias.ultimaEmergencia) : null}
          color={kpi.emergencias.reportadas > 0 ? "text-rose-400" : "text-white/40"} />
        <KpiCard icon={Shield} label="Asignaciones activas" value={kpi.asignaciones.activas}
          sub={`de ${kpi.asignaciones.total} total`} color="text-teal-400" />
      </div>
      {kpi.tareas.asignadas > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-3">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-widest">Desglose de tareas</p>
          <ProgressBar label="Completadas" value={kpi.tareas.completadas} total={kpi.tareas.asignadas} color="bg-green-500" />
          <ProgressBar label="En proceso" value={kpi.tareas.enProceso} total={kpi.tareas.asignadas} color="bg-blue-500" />
          <ProgressBar label="Pendientes" value={kpi.tareas.pendientes} total={kpi.tareas.asignadas} color="bg-yellow-500" />
        </div>
      )}
      {kpi.anticipos.solicitados > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-3">Anticipos en el período</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-lg font-bold text-yellow-400">{kpi.anticipos.solicitados}</p><p className="text-[10px] text-white/35">Solicitados</p></div>
            <div><p className="text-lg font-bold text-green-400">{kpi.anticipos.aprobados}</p><p className="text-[10px] text-white/35">Aprobados</p></div>
            <div><p className="text-lg font-bold text-white/60">{kpi.anticipos.pendientes}</p><p className="text-[10px] text-white/35">Pendientes</p></div>
          </div>
        </div>
      )}
      <SeccionDisciplinaria empId={empId} />
      <SeccionRotacion empId={empId} />
      <ResumenDimensionesKPI empId={empId} />
      <p className="text-[11px] text-white/20 border-t border-white/5 pt-3">
        KPI alimentado desde: Tareas (vía usuario) · Anticipos (FK directa) · Incidencias (por nombre de responsable) · Movimientos operativos
      </p>
    </div>
  );
}

// ─── Tab: Asignaciones ────────────────────────────────────────────────────────

