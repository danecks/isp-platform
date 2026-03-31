/**
 * PrePlanilla.tsx — Pre-Planilla Operativa por Período (v2)
 *
 * Vista de revisión real de pago con:
 *   - Tab Resumen General: tabla consolidada + total estimado preliminar
 *   - Tab Horas Extra: anexo detallado por día / colaborador
 *   - Tab Faltas / Suspensiones: anexo con eventos RRHH
 *   - Tab Anticipos: anexo de anticipos aprobados/pagados
 *   - Tab Coberturas / Relevos: anexo de días de cobertura
 *
 * TOTAL ESTIMADO PRELIMINAR (indicativo, no legal):
 *   sueldo_periodo = sueldo_base / 30 * días_período
 *   desc_faltas    = (sueldo_base / 30) * (faltas + suspensiones)
 *   valor_he       = (sueldo_base / 30 / horas_dia) * 1.5 * horas_extra
 *   total_est      = sueldo_periodo - desc_faltas + valor_he - anticipos
 *
 * NO INCLUYE AÚN: IGSS, bonificación incentivo (Dto. 78-89), séptimo día,
 *   cuotas patronales, ni deducciones legales finales.
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Download, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Clock, Eye, X, Loader2,
  Users, Briefcase, TrendingUp, Wallet, Info,
  Check, AlertTriangle, FileText, CreditCard, Repeat2,
  MinusCircle, Lock, ShieldCheck, AlertOctagon, CheckCheck,
  XCircle, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-isp-session": getSession(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Error de API");
  }
  return res.json();
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ColaboradorPre {
  employee_id: number;
  nombre_completo: string;
  dpi: string | null;
  sueldo_base: string | null;
  tipo_jornada: string | null;
  dia_descanso: string | null;
  horas_contrato: number | null;
  estado_laboral: string;
  puesto_empleado: string | null;
  area: string | null;
  sede: string | null;
  supervisor_nombre: string | null;
  cliente_principal: string | null;
  puesto_titular_nombre: string | null;
  dias_trabajados: number;
  faltas: number;
  suspensiones: number;
  descansos_trabajados: number;
  horas_trabajadas: string;
  horas_extra: string;
  relevos: number;
  dias_sin_horas: number;
  anticipos_monto: number;
  anticipos_count: number;
  incentivos_cash_monto: number;
  incentivos_cash_count: number;
  revision_estado: "pendiente" | "revisada" | "observada" | "aprobado_rrhh";
  revision_observaciones: string | null;
  revision_por: string | null;
  revision_at: string | null;
  revision_aprobado_por: string | null;
  revision_aprobado_at: string | null;
  cierre_id: number | null;
  tipo_turno_id: number | null;
  tipo_turno_nombre: string | null;
  turno_horas_trabajo: string | null;
  turno_fecha_inicio_ciclo: string | null;
  horas_esperadas_total: string | null;
  dias_esperados_trabajo: number;
  dias_esperados_descanso: number;
  // IGSS — clasificación por período
  aplica_igss_general: boolean;
  estado_igss: string;
  fecha_inicio_igss: string | null;
  puesto_aplica_igss: boolean;
  puesto_regimen_igss: string;
  aplica_igss: boolean;
  motivo_exclusion_igss: string | null;
  // Frecuencia de pago
  frecuencia_pago: string | null;
  excluido_frecuencia_pago: boolean;
  motivo_exclusion_frecuencia_pago: string | null;
  quincena_tipo: string | null;
}

interface DetalleNovedad {
  id: number;
  fecha: string;
  trabajo_dia: boolean;
  horas_trabajadas: string | null;
  horas_extra: string | null;
  falta: boolean;
  suspension: boolean;
  descanso_trabajado: boolean;
  afecta_septimo: boolean;
  descuento_dia: boolean;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  num_puestos_cubiertos: number;
  observaciones: string | null;
  fuente: string | null;
  cierre_id: number | null;
  tipo_novedad: string | null;
}

interface DetalleAnticipo {
  id: number;
  cantidad: number;
  estado: string;
  periodo: string | null;
  origen: string;
  observaciones: string | null;
  fecha_solicitud: string;
}

interface DetalleIncentivo {
  id: number;
  fecha: string;
  tipo: string;
  monto: string;
  motivo: string | null;
  estado: string;
  autorizado_por: string | null;
  pagado_por: string | null;
  metodo_pago: string | null;
}

interface AnexoHE {
  id: number;
  fecha: string;
  horas_extra: number;
  horas_trabajadas: number;
  tipo: string;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  observaciones: string | null;
  fuente: string | null;
  employee_id: number;
  nombre_completo: string;
  sede: string | null;
  cliente_nombre: string | null;
}

interface AnexoFalta {
  id: number;
  fecha: string;
  falta: boolean;
  suspension: boolean;
  descuento_dia: boolean;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  observaciones: string | null;
  fuente: string | null;
  employee_id: number;
  nombre_completo: string;
  dpi: string | null;
  sede: string | null;
  tipo_novedad: string | null;
}

interface AnexoAnticipo {
  id: number;
  cantidad: number;
  estado: string;
  periodo: string | null;
  origen: string;
  observaciones: string | null;
  fecha_solicitud: string;
  nombre: string | null;
  planilla_id: number | null;
  employee_id: number;
  nombre_completo: string;
  dpi: string | null;
  sede: string | null;
}

interface AnexoCobertura {
  id: number;
  fecha: string;
  horas: number;
  horas_extra: number;
  tipo_cobertura: string;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  descanso_trabajado: boolean;
  observaciones: string | null;
  num_puestos_cubiertos: number;
  employee_id: number;
  nombre_completo: string;
  sede: string | null;
  cliente_nombre: string | null;
}

type Tab = "resumen" | "horas_extra" | "faltas" | "anticipos" | "coberturas";

// ─── Presets de período ───────────────────────────────────────────────────────

function getPeriodPresets() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const d = hoy.getDate();
  const fin = (y2: number, m2: number) => new Date(y2, m2 + 1, 0).getDate();
  const fmt = (y2: number, m2: number, d2: number) =>
    `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;

  let qDesde: string, qHasta: string;
  if (d <= 15) { qDesde = fmt(y, m, 1); qHasta = fmt(y, m, 15); }
  else { qDesde = fmt(y, m, 16); qHasta = fmt(y, m, fin(y, m)); }

  let qpDesde: string, qpHasta: string;
  if (d <= 15) {
    const pm = m === 0 ? 11 : m - 1; const py = m === 0 ? y - 1 : y;
    qpDesde = fmt(py, pm, 16); qpHasta = fmt(py, pm, fin(py, pm));
  } else { qpDesde = fmt(y, m, 1); qpHasta = fmt(y, m, 15); }

  const maDesde = fmt(y, m, 1); const maHasta = fmt(y, m, fin(y, m));
  const pm = m === 0 ? 11 : m - 1; const py = m === 0 ? y - 1 : y;
  const mpDesde = fmt(py, pm, 1); const mpHasta = fmt(py, pm, fin(py, pm));

  return { qDesde, qHasta, qpDesde, qpHasta, maDesde, maHasta, mpDesde, mpHasta };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-GT", {
    weekday: "short", day: "2-digit", month: "short",
  });
}

function fmtQ(n: number | string | null) {
  if (n === null || n === undefined || n === "") return "—";
  const num = parseFloat(String(n));
  if (isNaN(num)) return "—";
  return `Q${num.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcularTotalEstimado(col: ColaboradorPre, periodoTotalDias: number | null) {
  const sb = parseFloat(String(col.sueldo_base ?? "0"));
  if (!sb || !periodoTotalDias) return null;
  const sueldoDia = sb / 30;
  const sueldoPeriodo = sueldoDia * periodoTotalDias;
  const totalFaltas = Number(col.faltas) + Number(col.suspensiones);
  const descFaltas = sueldoDia * totalFaltas;
  // Horas día = horas_contrato / 6 días (semana 6 días) — o 8 por defecto
  const horasDia = col.horas_contrato ? col.horas_contrato / 6 : 8;
  const valorHora = sueldoDia / horasDia;
  const he = parseFloat(String(col.horas_extra ?? "0"));
  const valorHE = valorHora * 1.5 * he;
  const anticipo = Number(col.anticipos_monto);
  const total = sueldoPeriodo - descFaltas + valorHE - anticipo;
  return { sueldoPeriodo, descFaltas, valorHE, anticipo, total };
}

// ─── Badge revisión ───────────────────────────────────────────────────────────

const REVISION_CFG = {
  pendiente:     { label: "Pendiente",    cls: "text-amber-400 bg-amber-400/10 border-amber-400/25",  icon: Clock },
  revisada:      { label: "Revisada",     cls: "text-green-400 bg-green-400/10 border-green-400/25",  icon: CheckCircle2 },
  observada:     { label: "Observada",    cls: "text-rose-400 bg-rose-400/10 border-rose-400/25",     icon: AlertCircle },
  aprobado_rrhh: { label: "Aprobado",    cls: "text-primary bg-primary/10 border-primary/30",        icon: ShieldCheck },
};

function RevisionBadge({ estado }: { estado: string }) {
  const cfg = REVISION_CFG[estado as keyof typeof REVISION_CFG] ??
    { label: estado, cls: "text-white/40 bg-white/5 border-white/10", icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.cls}`}>
      <cfg.icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  );
}

// ─── Badge tipo cobertura ─────────────────────────────────────────────────────

function TipoCobBadge({ tipo }: { tipo: string }) {
  const cfgs: Record<string, string> = {
    relevo:             "text-purple-300 bg-purple-400/10 border-purple-400/20",
    descanso_trabajado: "text-blue-300 bg-blue-400/10 border-blue-400/20",
    cobertura:          "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
    normal:             "text-white/40 bg-white/5 border-white/10",
  };
  const labels: Record<string, string> = {
    relevo: "Relevo", descanso_trabajado: "Dsco. Trabajado", cobertura: "Cobertura", normal: "Normal",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfgs[tipo] ?? "text-white/30 bg-white/5 border-white/10"}`}>
      {labels[tipo] ?? tipo}
    </span>
  );
}

// ─── Componente de estado vacío de tabla ──────────────────────────────────────

function TablaVacia({ msg }: { msg: string }) {
  return <div className="p-10 text-center text-white/30 text-sm">{msg}</div>;
}

// ─── Modal de Detalle ─────────────────────────────────────────────────────────

function DetalleModal({
  col, desde, hasta, onClose, onRevisionChange,
}: {
  col: ColaboradorPre;
  desde: string;
  hasta: string;
  onClose: () => void;
  onRevisionChange: (id: number, estado: string, obs: string) => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<{
    novedades: DetalleNovedad[];
    anticipos: DetalleAnticipo[];
    incentivos: DetalleIncentivo[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [revEstado, setRevEstado] = useState(col.revision_estado);
  const [revObs, setRevObs] = useState(col.revision_observaciones ?? "");
  const [savingRev, setSavingRev] = useState(false);
  const [activeInner, setActiveInner] = useState<"resumen" | "detalle" | "historial">("resumen");

  const periodoTotalDias = desde && hasta
    ? Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1
    : null;

  const est = calcularTotalEstimado(col, periodoTotalDias);

  React.useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/detalle/${col.employee_id}?desde=${desde}&hasta=${hasta}`)
      .then((d) => setData(d))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [col.employee_id, desde, hasta]);

  async function guardarRevision() {
    setSavingRev(true);
    try {
      await apiFetch(`/api/nomina/pre-planilla/revision/${col.employee_id}`, {
        method: "PATCH",
        body: JSON.stringify({ desde, hasta, estado: revEstado, observaciones: revObs }),
      });
      onRevisionChange(col.employee_id, revEstado, revObs);
      toast({ title: "Revisión guardada" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingRev(false);
    }
  }

  const htNum = parseFloat(col.horas_trabajadas || "0");
  const heNum = parseFloat(col.horas_extra || "0");
  const tieneAlertas = Number(col.faltas) > 0 || Number(col.suspensiones) > 0 || Number(col.dias_sin_horas) > 0;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-end bg-black/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl bg-[#07111f] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#060e1c] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {tieneAlertas && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              <h3 className="text-sm font-bold text-white truncate">{col.nombre_completo}</h3>
            </div>
            <p className="text-[11px] text-white/40 mt-0.5">
              EMP-{String(col.employee_id).padStart(4, "0")} · {col.puesto_empleado ?? "—"} · {col.sede ?? "—"}
            </p>
            <p className="text-[10px] text-white/25 mt-0.5">{fmtFecha(desde)} – {fmtFecha(hasta)}</p>
          </div>
          <button onClick={onClose} className="ml-3 text-white/30 hover:text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner tabs */}
        <div className="flex border-b border-white/6 bg-[#060e1c] shrink-0">
          {([
            ["resumen", "Resumen"],
            ["detalle", "Día a día"],
            ["historial", "Historial"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setActiveInner(k)}
              className={`px-4 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${
                activeInner === k
                  ? "border-primary text-primary"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Tab: Resumen ──────────────────────────────────────────── */}
          {activeInner === "resumen" && (
            <div className="p-5 space-y-4">

              {/* Total estimado destacado */}
              {est ? (
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-4">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Total Estimado Preliminar</p>
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/50">Sueldo período ({periodoTotalDias}d)</span>
                      <span className="text-white font-medium">{fmtQ(est.sueldoPeriodo)}</span>
                    </div>
                    {est.descFaltas > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-red-400/70">— Desc. faltas / susp. ({Number(col.faltas) + Number(col.suspensiones)}d)</span>
                        <span className="text-red-400">–{fmtQ(est.descFaltas)}</span>
                      </div>
                    )}
                    {est.valorHE > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-400/70">+ H. Extra ({heNum.toFixed(1)} h × 1.5x)</span>
                        <span className="text-orange-400">+{fmtQ(est.valorHE)}</span>
                      </div>
                    )}
                    {est.anticipo > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-400/70">— Anticipo del período</span>
                        <span className="text-amber-400">–{fmtQ(est.anticipo)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                    <span className="text-xs font-semibold text-white/60">Total estimado</span>
                    <span className={`text-lg font-bold ${est.total >= 0 ? "text-primary" : "text-red-400"}`}>
                      {fmtQ(est.total)}
                    </span>
                  </div>
                  <p className="text-[9px] text-white/25 mt-2 leading-relaxed">
                    Estimación indicativa. No incluye IGSS, bonificación incentivo (Dto. 78-89), séptimo día, ni deducciones finales.
                  </p>
                </div>
              ) : (
                <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-white/30">Sin sueldo base registrado — no se puede calcular estimado</p>
                </div>
              )}

              {/* Grid métricas */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Métricas del período</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: "Días trab.", val: Number(col.dias_trabajados), cls: "text-green-400" },
                    { label: "Faltas", val: Number(col.faltas), cls: Number(col.faltas) > 0 ? "text-red-400" : "text-white/30" },
                    { label: "Suspensiones", val: Number(col.suspensiones), cls: Number(col.suspensiones) > 0 ? "text-amber-400" : "text-white/30" },
                    { label: "Dsco. trab.", val: Number(col.descansos_trabajados), cls: "text-blue-400" },
                    { label: "Relevos", val: Number(col.relevos), cls: Number(col.relevos) > 0 ? "text-purple-400" : "text-white/30" },
                    { label: "Días sin hrs", val: Number(col.dias_sin_horas), cls: Number(col.dias_sin_horas) > 0 ? "text-rose-400" : "text-white/20" },
                  ].map(({ label, val, cls }) => (
                    <div key={label} className="bg-[#0c1929] border border-white/6 rounded-lg p-2.5">
                      <p className={`text-xl font-bold ${cls}`}>{val}</p>
                      <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0c1929] border border-white/6 rounded-lg p-2.5">
                    <p className="text-lg font-bold text-cyan-400">{htNum.toFixed(1)} h</p>
                    <p className="text-[10px] text-white/35">Horas trabajadas</p>
                  </div>
                  <div className="bg-[#0c1929] border border-white/6 rounded-lg p-2.5">
                    <p className={`text-lg font-bold ${heNum > 0 ? "text-orange-400" : "text-white/30"}`}>{heNum.toFixed(1)} h</p>
                    <p className="text-[10px] text-white/35">Horas extra</p>
                  </div>
                </div>
              </div>

              {/* Datos de empleado */}
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Datos laborales</p>
                {[
                  ["Sueldo base", fmtQ(col.sueldo_base)],
                  ["Turno", col.tipo_turno_nombre ?? "—"],
                  ["Jornada", col.tipo_jornada ?? "—"],
                  ["Hrs contrato", col.horas_contrato != null ? `${col.horas_contrato} h/sem` : "—"],
                  ["Descanso", col.dia_descanso ?? "—"],
                  ["Cliente", col.cliente_principal ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-white/40">{k}</span>
                    <span className="text-white/80 font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {/* IGSS */}
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Clasificación IGSS</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Estado colaborador</span>
                  {col.aplica_igss ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Aplica IGSS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      No aplica
                    </span>
                  )}
                </div>
                {col.motivo_exclusion_igss && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-white/40 shrink-0">Motivo</span>
                    <span className="text-xs text-amber-300/80 text-right">{col.motivo_exclusion_igss}</span>
                  </div>
                )}
                {[
                  ["Aplica general", col.aplica_igss_general ? "Sí" : "No"],
                  ["Estado IGSS", col.estado_igss],
                  ["Puesto cubre IGSS", col.puesto_aplica_igss ? "Sí" : "No"],
                  ["Régimen puesto", col.puesto_regimen_igss || "—"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-xs">
                    <span className="text-white/40">{k}</span>
                    <span className="text-white/70">{v}</span>
                  </div>
                ))}
              </div>

              {/* Frecuencia de pago */}
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Frecuencia de pago</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Configuración</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    col.frecuencia_pago === "mensual"
                      ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                      : "bg-white/5 text-white/50 border-white/10"
                  }`}>
                    {col.frecuencia_pago === "mensual" ? "Mensual" : "Quincenal"}
                  </span>
                </div>
                {col.quincena_tipo && (
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Período actual</span>
                    <span className="text-white/70">{col.quincena_tipo === "primera" ? "1ª Quincena" : "2ª Quincena"}</span>
                  </div>
                )}
                {col.excluido_frecuencia_pago && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-white/40 shrink-0">Estado</span>
                    <span className="text-xs text-slate-300/80 text-right">Excluido de esta quincena</span>
                  </div>
                )}
                {col.motivo_exclusion_frecuencia_pago && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-white/40 shrink-0">Motivo</span>
                    <span className="text-xs text-amber-300/80 text-right">{col.motivo_exclusion_frecuencia_pago}</span>
                  </div>
                )}
              </div>

              {/* Revisión RRHH */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Revisión RRHH</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(["pendiente", "revisada", "observada", "aprobado_rrhh"] as const).map((e) => {
                      const cfg = REVISION_CFG[e];
                      return (
                        <button key={e} onClick={() => setRevEstado(e)}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            revEstado === e ? cfg.cls + " border-opacity-60" : "text-white/30 bg-white/4 border-white/10 hover:border-white/20"
                          }`}>
                          <cfg.icon className="w-3 h-3" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea value={revObs} onChange={(e) => setRevObs(e.target.value)} rows={2}
                    placeholder="Observaciones RRHH (opcional)…"
                    className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none" />
                  <button onClick={guardarRevision} disabled={savingRev}
                    className="w-full py-2.5 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                    {savingRev && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <Check className="w-3.5 h-3.5" />Guardar revisión
                  </button>
                  {col.revision_at && (
                    <p className="text-[10px] text-white/25 text-center">
                      Última revisión: {new Date(col.revision_at).toLocaleString("es-GT")}
                      {col.revision_por ? ` — por ${col.revision_por}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Día a día ────────────────────────────────────────── */}
          {activeInner === "detalle" && (
            <div className="p-5">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Novedades día a día</p>
              {loading ? (
                <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                </div>
              ) : data?.novedades.length === 0 ? (
                <p className="text-white/30 text-sm py-2">Sin novedades registradas en el período.</p>
              ) : (
                <div className="space-y-1">
                  {data?.novedades.map((n) => (
                    <div key={n.id} className={`flex items-center gap-3 py-2 px-2.5 rounded-lg text-xs transition-colors ${
                      n.falta ? "bg-red-500/5 border border-red-500/10" :
                      n.suspension ? "bg-amber-500/5 border border-amber-500/10" :
                      "hover:bg-white/3 border border-transparent"
                    }`}>
                      <span className="text-white/40 w-24 shrink-0">{fmtFecha(n.fecha)}</span>
                      <div className="flex items-center gap-1 flex-1 flex-wrap">
                        {n.trabajo_dia && <span className="px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-400/20">Trabajó</span>}
                        {n.falta && <span className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">Falta</span>}
                        {n.suspension && <span className="px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">Suspensión</span>}
                        {n.descanso_trabajado && <span className="px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Dsco. Trab.</span>}
                        {n.puesto_cubierto_nombre && n.puesto_cubierto_nombre !== n.puesto_titular_nombre && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400 border border-purple-400/20" title={`Cubrió: ${n.puesto_cubierto_nombre}`}>Relevo</span>
                        )}
                        {n.tipo_novedad && (() => {
                          const labelMap: Record<string,string> = {
                            falta_total: "Falta total", abandono_parcial: "Abandono parcial",
                            vacaciones: "Vacaciones", relevo_vacaciones: "Cob. vacaciones",
                            incapacidad: "Incapacidad IGSS", suspension: "Suspensión",
                            permiso_con_goce: "Permiso c/goce", permiso_sin_goce: "Permiso s/goce",
                            relevo_completo: "Relevo completo", relevo_parcial: "Relevo parcial",
                            horas_extra_puras: "Horas extra", ssa_externo: "Serv. especial",
                            cambio_titular: "Cambio titular",
                          };
                          const isDescuento = ["falta_total","abandono_parcial","suspension","permiso_sin_goce"].includes(n.tipo_novedad);
                          const isNeutral   = ["vacaciones","incapacidad","relevo_vacaciones","permiso_con_goce"].includes(n.tipo_novedad);
                          return (
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                              isDescuento ? "bg-red-500/5 text-red-300/70 border-red-500/15" :
                              isNeutral   ? "bg-emerald-500/5 text-emerald-300/70 border-emerald-500/15" :
                              "bg-white/5 text-white/30 border-white/10"
                            }`}>
                              {labelMap[n.tipo_novedad] ?? n.tipo_novedad}
                            </span>
                          );
                        })()}
                        {n.observaciones && <span className="text-white/30 text-[10px]">· {n.observaciones}</span>}
                      </div>
                      <span className="text-white/40 w-14 text-right shrink-0">
                        {n.horas_trabajadas ? `${parseFloat(n.horas_trabajadas).toFixed(1)} h` : "—"}
                      </span>
                      {parseFloat(n.horas_extra ?? "0") > 0 && (
                        <span className="text-orange-400 text-[10px] shrink-0">+{parseFloat(n.horas_extra!).toFixed(1)} HE</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Historial ────────────────────────────────────────── */}
          {activeInner === "historial" && (
            <div className="p-5 space-y-5">
              {loading ? (
                <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                </div>
              ) : (
                <>
                  {/* Incentivos cash */}
                  {(data?.incentivos?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Incentivos Cash del período</p>
                      <div className="space-y-1.5">
                        {data!.incentivos.map((inc) => {
                          const tipoLabel: Record<string, string> = {
                            relevo_cash: "Relevo Cash", bono_cobertura: "Bono Cobertura", motivacion_cobertura: "Motivación",
                          };
                          const estadoColor: Record<string, string> = {
                            pendiente: "text-amber-400 bg-amber-400/10 border-amber-400/20",
                            pagado:    "text-green-400 bg-green-400/10 border-green-400/20",
                            auditado:  "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
                            cancelado: "text-white/30 bg-white/5 border-white/10",
                          };
                          return (
                            <div key={inc.id} className="flex items-center justify-between px-3 py-2 bg-[#071a0d] border border-emerald-900/40 rounded-lg">
                              <div>
                                <p className="text-xs font-semibold text-emerald-300">{tipoLabel[inc.tipo] ?? inc.tipo} — {fmtQ(inc.monto)}</p>
                                <p className="text-[10px] text-white/35">{fmtFecha(inc.fecha)}{inc.motivo ? ` · ${inc.motivo}` : ""}</p>
                                {(inc.pagado_por || inc.metodo_pago) && (
                                  <p className="text-[10px] text-white/25">{inc.pagado_por}{inc.metodo_pago ? ` · ${inc.metodo_pago}` : ""}</p>
                                )}
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${estadoColor[inc.estado] ?? "text-white/30 bg-white/5 border-white/10"}`}>{inc.estado}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Anticipos */}
                  {(data?.anticipos.length ?? 0) > 0 ? (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Anticipos del período</p>
                      <div className="space-y-1.5">
                        {data!.anticipos.map((a) => (
                          <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-[#0c1929] border border-white/6 rounded-lg">
                            <div>
                              <p className="text-xs font-semibold text-amber-300">{fmtQ(a.cantidad)}</p>
                              <p className="text-[10px] text-white/35">{a.periodo ?? "—"} · {a.origen}</p>
                              {a.observaciones && <p className="text-[10px] text-white/25">{a.observaciones}</p>}
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                              a.estado === "pagada" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                              a.estado === "aprobada" ? "text-blue-400 bg-blue-400/10 border-blue-400/20" :
                              "text-white/30 bg-white/5 border-white/10"
                            }`}>{a.estado}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Anticipos del período</p>
                      <p className="text-white/25 text-sm">Sin anticipos en este período.</p>
                    </div>
                  )}

                  {(data?.incentivos?.length ?? 0) === 0 && (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Incentivos Cash</p>
                      <p className="text-white/25 text-sm">Sin incentivos cash en este período.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Anexo: Horas Extra ───────────────────────────────────────────────────────

function AnexoHorasExtra({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoHE[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/anexo/horas-extra?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando horas extra…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay horas extra registradas en el período." />;

  const totalHE = rows.reduce((s, r) => s + Number(r.horas_extra), 0);

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-3">
        <TrendingUp className="w-4 h-4 text-orange-400" />
        <span className="text-xs text-white/60">{rows.length} registros</span>
        <span className="text-xs font-bold text-orange-400">{totalHE.toFixed(1)} h extra total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador", "Cliente / Sede", "Puesto cubierto", "H. Extra", "H. Trab.", "Tipo", "Contexto"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/3 transition-colors">
                <td className="px-3 py-2.5 text-white/50 whitespace-nowrap">{fmtFecha(r.fecha)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30">{r.sede ?? "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/50">{r.cliente_nombre ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <p className="text-white/60">{r.puesto_cubierto_nombre ?? r.puesto_titular_nombre ?? "—"}</p>
                  {r.puesto_cubierto_nombre && r.puesto_cubierto_nombre !== r.puesto_titular_nombre && (
                    <p className="text-[10px] text-white/30">Titular: {r.puesto_titular_nombre}</p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-orange-400 font-bold">{Number(r.horas_extra).toFixed(1)} h</span>
                </td>
                <td className="px-3 py-2.5 text-right text-white/50">{Number(r.horas_trabajadas).toFixed(1)} h</td>
                <td className="px-3 py-2.5"><TipoCobBadge tipo={r.tipo} /></td>
                <td className="px-3 py-2.5 text-white/30 max-w-[150px] truncate">{r.observaciones ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Anexo: Faltas / Suspensiones ────────────────────────────────────────────

function AnexoFaltas({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoFalta[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/anexo/faltas?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando faltas…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay faltas ni suspensiones registradas en el período." />;

  const totalFaltas = rows.filter((r) => r.falta).length;
  const totalSusp = rows.filter((r) => r.suspension).length;

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-4">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-xs"><span className="text-red-400 font-bold">{totalFaltas}</span><span className="text-white/40"> faltas</span></span>
        <span className="text-xs"><span className="text-amber-400 font-bold">{totalSusp}</span><span className="text-white/40"> suspensiones</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador", "Sede", "Tipo", "Descuento día", "Puesto cubierto", "Ref. / Contexto"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => (
              <tr key={r.id} className={`hover:bg-white/3 transition-colors ${r.falta ? "bg-red-500/3" : "bg-amber-500/3"}`}>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{fmtFecha(r.fecha)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30 text-[10px]">{r.dpi ? `****${r.dpi.slice(-4)}` : "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/40">{r.sede ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    {r.falta && <span className="px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20 font-semibold">Falta</span>}
                    {r.suspension && <span className="px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-semibold">Suspensión</span>}
                    {r.tipo_novedad && (() => {
                      const m: Record<string,string> = {
                        falta_total:"Falta total",abandono_parcial:"Abandono parcial",
                        vacaciones:"Vacaciones",incapacidad:"Incap. IGSS",
                        suspension:"Suspensión",permiso_con_goce:"Permiso c/goce",
                        permiso_sin_goce:"Permiso s/goce",relevo_completo:"Relevo completo",
                        relevo_parcial:"Relevo parcial",relevo_vacaciones:"Cob. vacaciones",
                        horas_extra_puras:"HE",ssa_externo:"SSA",cambio_titular:"Cambio titular",
                      };
                      return (
                        <span className="text-[10px] text-white/40 italic">{m[r.tipo_novedad!] ?? r.tipo_novedad}</span>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {r.descuento_dia
                    ? <MinusCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />
                    : <span className="text-white/20">—</span>}
                </td>
                <td className="px-3 py-2.5 text-white/50">{r.puesto_cubierto_nombre ?? <span className="text-white/20">No cubierto</span>}</td>
                <td className="px-3 py-2.5 text-white/30 max-w-[160px] truncate">{r.observaciones ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Anexo: Anticipos ─────────────────────────────────────────────────────────

function AnexoAnticipos({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoAnticipo[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/anexo/anticipos?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando anticipos…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay anticipos aprobados/pagados en el período." />;

  const totalMonto = rows.reduce((s, r) => s + Number(r.cantidad), 0);

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-3">
        <CreditCard className="w-4 h-4 text-amber-400" />
        <span className="text-xs text-white/60">{rows.length} anticipos</span>
        <span className="text-xs font-bold text-amber-400">{fmtQ(totalMonto)} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador", "Sede", "Monto", "Estado", "Período", "Origen", "¿En planilla?"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/3 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{fmtFecha(r.fecha_solicitud)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30 text-[10px]">{r.dpi ? `****${r.dpi.slice(-4)}` : "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/40">{r.sede ?? "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-amber-400 font-bold">{fmtQ(r.cantidad)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                    r.estado === "pagada" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                    r.estado === "aprobada" ? "text-blue-400 bg-blue-400/10 border-blue-400/20" :
                    "text-white/30 bg-white/5 border-white/10"
                  }`}>{r.estado}</span>
                </td>
                <td className="px-3 py-2.5 text-white/40">{r.periodo ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/40">{r.origen}</td>
                <td className="px-3 py-2.5 text-center">
                  {r.planilla_id != null
                    ? <span className="text-green-400 text-[10px] font-semibold">Sí #{r.planilla_id}</span>
                    : <span className="text-white/25 text-[10px]">Pendiente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Anexo: Coberturas / Relevos ─────────────────────────────────────────────

function AnexoCoberturas({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoCobertura[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/anexo/coberturas?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando coberturas…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay relevos ni coberturas registrados en el período." />;

  const totalHoras = rows.reduce((s, r) => s + Number(r.horas), 0);
  const totalRel = rows.filter((r) => r.tipo_cobertura === "relevo").length;

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-4">
        <Repeat2 className="w-4 h-4 text-purple-400" />
        <span className="text-xs"><span className="text-purple-400 font-bold">{totalRel}</span><span className="text-white/40"> relevos</span></span>
        <span className="text-xs"><span className="text-white font-bold">{rows.length}</span><span className="text-white/40"> coberturas total</span></span>
        <span className="text-xs text-white/40">{totalHoras.toFixed(1)} h cubiertas</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador que cubrió", "Cliente / Sede", "Puesto cubierto", "Puesto titular", "Horas", "H. Extra", "Tipo"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/3 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{fmtFecha(r.fecha)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30">{r.sede ?? "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/50">{r.cliente_nombre ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/60">{r.puesto_cubierto_nombre ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/30">{r.puesto_titular_nombre ?? "—"}</td>
                <td className="px-3 py-2.5 text-right text-white/60">{Number(r.horas).toFixed(1)} h</td>
                <td className="px-3 py-2.5 text-right">
                  {Number(r.horas_extra) > 0
                    ? <span className="text-orange-400 font-semibold">{Number(r.horas_extra).toFixed(1)} h</span>
                    : <span className="text-white/20">—</span>}
                </td>
                <td className="px-3 py-2.5"><TipoCobBadge tipo={r.tipo_cobertura} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Modal de Cierre de Período ───────────────────────────────────────────────

function CierreModal({
  desde, hasta,
  validacion,
  validacionLoading,
  onClose,
  onCerrado,
}: {
  desde: string;
  hasta: string;
  validacion: {
    periodo_cerrado: boolean;
    errores_criticos: { tipo: string; mensaje: string }[];
    alertas: { tipo: string; mensaje: string }[];
    resumen: { total_colaboradores: number; errores: number; alertas: number; puede_cerrar: boolean };
  } | null;
  validacionLoading: boolean;
  onClose: () => void;
  onCerrado: () => void;
}) {
  const { toast } = useToast();
  const [obs, setObs] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [forzar, setForzar] = useState(false);

  const puedeEnviar = !cerrando && !validacionLoading && validacion != null &&
    (validacion.resumen.puede_cerrar || forzar);

  async function ejecutarCierre() {
    setCerrando(true);
    try {
      const cerradoPor = sessionStorage.getItem("isp_admin_usuario") ?? "admin";
      await apiFetch("/api/nomina/pre-planilla/cierre", {
        method: "POST",
        body: JSON.stringify({ desde, hasta, cerradoPor, observaciones: obs || null, forzar }),
      });
      toast({ title: "Pre-planilla cerrada", description: `Período ${desde} — ${hasta} congelado correctamente.` });
      onCerrado();
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error al cerrar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCerrando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#07111f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#060e1c]">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Cerrar pre-planilla del período</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Período */}
          <div className="bg-white/4 border border-white/8 rounded-lg px-4 py-3">
            <p className="text-[10px] text-white/40 mb-1">Período a cerrar</p>
            <p className="text-sm font-semibold text-white">{desde} — {hasta}</p>
          </div>

          {/* Resultados de validación */}
          {validacionLoading && (
            <div className="flex items-center gap-2 text-sm text-white/40 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />Ejecutando validaciones automáticas…
            </div>
          )}
          {validacion && !validacionLoading && (
            <div className="space-y-3">
              {/* Resumen */}
              <div className={`rounded-lg px-4 py-3 border ${
                validacion.resumen.errores > 0 ? "bg-red-500/8 border-red-500/30" :
                validacion.resumen.alertas > 0 ? "bg-amber-500/8 border-amber-500/25" :
                "bg-green-500/8 border-green-500/25"
              }`}>
                <div className="flex items-center gap-2">
                  {validacion.resumen.errores > 0
                    ? <AlertOctagon className="w-4 h-4 text-red-400" />
                    : validacion.resumen.alertas > 0
                    ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                    : <CheckCheck className="w-4 h-4 text-green-400" />}
                  <span className="text-xs font-semibold text-white/80">
                    {validacion.resumen.total_colaboradores} colaboradores · {validacion.resumen.errores} error{validacion.resumen.errores !== 1 ? "es" : ""} crítico{validacion.resumen.errores !== 1 ? "s" : ""} · {validacion.resumen.alertas} alerta{validacion.resumen.alertas !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Errores críticos */}
              {validacion.errores_criticos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Errores críticos — deben resolverse</p>
                  {validacion.errores_criticos.slice(0, 4).map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-300/80">
                      <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{e.mensaje}
                    </div>
                  ))}
                  {validacion.errores_criticos.length > 4 && (
                    <p className="text-[10px] text-red-400/60">…y {validacion.errores_criticos.length - 4} más</p>
                  )}
                  {/* Opción forzar */}
                  <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs text-amber-400/80">
                    <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)}
                      className="accent-amber-400" />
                    Cerrar de todas formas (requiere supervisión)
                  </label>
                </div>
              )}

              {/* Alertas */}
              {validacion.alertas.length > 0 && validacion.errores_criticos.length === 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Alertas — el cierre procederá con advertencias</p>
                  {validacion.alertas.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-300/70">
                      <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />{a.mensaje}
                    </div>
                  ))}
                  {validacion.alertas.length > 3 && (
                    <p className="text-[10px] text-amber-400/60">…y {validacion.alertas.length - 3} más</p>
                  )}
                </div>
              )}

              {/* Sin problemas */}
              {validacion.errores_criticos.length === 0 && validacion.alertas.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCheck className="w-4 h-4" />
                  Sin errores ni alertas. La pre-planilla está lista para cerrar.
                </div>
              )}
            </div>
          )}

          {/* Consecuencias */}
          <div className="bg-white/3 border border-white/8 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">Qué ocurre al cerrar</p>
            {[
              "Los datos quedan congelados en un snapshot de solo lectura",
              "No se podrán modificar revisiones de RRHH del período",
              "El snapshot queda disponible para generar la planilla final",
              "Se registra en auditoría quién cerró y cuándo",
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-white/50">
                <ChevronRight className="w-3 h-3 text-primary/60 mt-0.5 shrink-0" />{t}
              </div>
            ))}
          </div>

          {/* Observaciones */}
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
            placeholder="Observaciones del cierre (opcional)…"
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none" />

          {/* Botones */}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-semibold hover:bg-white/10 transition-colors">
              Cancelar
            </button>
            <button onClick={ejecutarCierre} disabled={!puedeEnviar}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                puedeEnviar ? "bg-primary text-white hover:bg-primary/90" : "bg-white/5 text-white/25 cursor-not-allowed"
              }`}>
              {cerrando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Lock className="w-3.5 h-3.5" />Confirmar cierre
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PrePlanilla() {
  const { toast } = useToast();
  const presets = getPeriodPresets();

  // Período
  const [desde, setDesde] = useState(presets.qDesde);
  const [hasta, setHasta] = useState(presets.qHasta);
  const [customDesde, setCustomDesde] = useState(presets.qDesde);
  const [customHasta, setCustomHasta] = useState(presets.qHasta);
  const [modoCustom, setModoCustom] = useState(false);

  // Datos consolidado
  const [rows, setRows] = useState<ColaboradorPre[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Tab activo
  const [activeTab, setActiveTab] = useState<Tab>("resumen");

  // Modal detalle
  const [detalle, setDetalle] = useState<ColaboradorPre | null>(null);

  // Filtros (Resumen)
  const [busqueda, setBusqueda] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroSede, setFiltroSede] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroRevision, setFiltroRevision] = useState("todos");
  const [soloConFaltas, setSoloConFaltas] = useState(false);
  const [soloConAnticipos, setSoloConAnticipos] = useState(false);
  const [soloConIncentivos, setSoloConIncentivos] = useState(false);
  const [soloConHE, setSoloConHE] = useState(false);
  const [soloRevisar, setSoloRevisar] = useState(false);

  // Ordenamiento
  const [sortField, setSortField] = useState<keyof ColaboradorPre>("nombre_completo");
  const [sortAsc, setSortAsc] = useState(true);

  // Validación automática
  const [validacion, setValidacion] = useState<{
    periodo_cerrado: boolean;
    cierre_id?: number;
    cerrado_por?: string;
    cerrado_at?: string;
    errores_criticos: { tipo: string; mensaje: string; employee_id?: number }[];
    alertas: { tipo: string; mensaje: string; employee_id?: number }[];
    resumen: { total_colaboradores: number; errores: number; alertas: number; puede_cerrar: boolean };
  } | null>(null);
  const [validacionLoading, setValidacionLoading] = useState(false);
  const [showValidacion, setShowValidacion] = useState(false);

  // Modal cierre
  const [showCierreModal, setShowCierreModal] = useState(false);

  // ¿Período cerrado? (del primer row)
  const periodoCerrado = rows.length > 0 && rows[0].cierre_id != null;

  // Cargar datos
  const cargar = useCallback(async (d: string, h: string) => {
    setLoading(true);
    setValidacion(null);
    setShowValidacion(false);
    try {
      const data = await apiFetch(`/api/nomina/pre-planilla?desde=${d}&hasta=${h}`);
      setRows(data);
      setLoaded(true);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const cargarValidacion = useCallback(async () => {
    setValidacionLoading(true);
    setShowValidacion(true);
    try {
      const data = await apiFetch(`/api/nomina/pre-planilla/validacion?desde=${desde}&hasta=${hasta}`);
      setValidacion(data);
    } catch (e: unknown) {
      toast({ title: "Error al validar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setValidacionLoading(false);
    }
  }, [desde, hasta, toast]);

  useEffect(() => { cargar(desde, hasta); }, []);

  function aplicarPreset(d: string, h: string) {
    setDesde(d); setHasta(h);
    setCustomDesde(d); setCustomHasta(h);
    setModoCustom(false);
    cargar(d, h);
  }

  function aplicarCustom() {
    if (!customDesde || !customHasta || customDesde > customHasta) {
      toast({ title: "Rango inválido", description: "La fecha inicio debe ser ≤ fecha fin", variant: "destructive" });
      return;
    }
    setDesde(customDesde); setHasta(customHasta);
    cargar(customDesde, customHasta);
  }

  function onRevisionChange(id: number, estado: string, obs: string) {
    setRows((prev) => prev.map((r) =>
      r.employee_id === id
        ? { ...r, revision_estado: estado as ColaboradorPre["revision_estado"], revision_observaciones: obs, revision_at: new Date().toISOString() }
        : r
    ));
  }

  async function exportarCSV() {
    const url = `${BASE}/api/nomina/pre-planilla/export?desde=${desde}&hasta=${hasta}`;
    try {
      const res = await fetch(url, { headers: { "x-isp-session": getSession() } });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `pre-planilla_${desde}_${hasta}.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e: unknown) {
      toast({ title: "Error al exportar", description: (e as Error).message, variant: "destructive" });
    }
  }

  // Opciones de filtro
  const clientes = useMemo(() => Array.from(new Set(rows.map((r) => r.cliente_principal).filter(Boolean))) as string[], [rows]);
  const sedes = useMemo(() => Array.from(new Set(rows.map((r) => r.sede).filter(Boolean))) as string[], [rows]);

  // Días del período
  const periodoTotalDias = desde && hasta
    ? Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1
    : null;

  // Filtrado + ordenamiento
  const filtrados = useMemo(() => {
    let data = [...rows];
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      data = data.filter((r) =>
        r.nombre_completo.toLowerCase().includes(q) ||
        r.dpi?.includes(q) ||
        r.puesto_empleado?.toLowerCase().includes(q) ||
        r.sede?.toLowerCase().includes(q) ||
        r.cliente_principal?.toLowerCase().includes(q)
      );
    }
    if (filtroCliente !== "todos") data = data.filter((r) => r.cliente_principal === filtroCliente);
    if (filtroSede !== "todos") data = data.filter((r) => r.sede === filtroSede);
    if (filtroEstado !== "todos") data = data.filter((r) => r.estado_laboral === filtroEstado);
    if (filtroRevision !== "todos") data = data.filter((r) => r.revision_estado === filtroRevision);
    if (soloConFaltas) data = data.filter((r) => Number(r.faltas) > 0 || Number(r.suspensiones) > 0);
    if (soloConAnticipos) data = data.filter((r) => r.anticipos_count > 0);
    if (soloConIncentivos) data = data.filter((r) => Number(r.incentivos_cash_count) > 0);
    if (soloConHE) data = data.filter((r) => parseFloat(r.horas_extra || "0") > 0);
    if (soloRevisar) data = data.filter((r) =>
      r.revision_estado === "pendiente" && (Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.dias_sin_horas) > 0 || r.anticipos_count > 0)
    );

    data.sort((a, b) => {
      const va = a[sortField] ?? ""; const vb = b[sortField] ?? "";
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb), "es") : String(vb).localeCompare(String(va), "es");
    });
    return data;
  }, [rows, busqueda, filtroCliente, filtroSede, filtroEstado, filtroRevision,
      soloConFaltas, soloConAnticipos, soloConIncentivos, soloConHE, soloRevisar, sortField, sortAsc]);

  // KPIs globales (siempre del consolidado completo)
  const totalColabs = filtrados.length;
  const totalFaltas = filtrados.reduce((s, r) => s + Number(r.faltas) + Number(r.suspensiones), 0);
  const totalHE = filtrados.reduce((s, r) => s + parseFloat(r.horas_extra || "0"), 0);
  const totalAnt = filtrados.reduce((s, r) => s + Number(r.anticipos_monto), 0);
  const totalIncentivos = filtrados.reduce((s, r) => s + Number(r.incentivos_cash_monto), 0);
  const conAlertas = filtrados.filter((r) => Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.dias_sin_horas) > 0).length;
  const totalRelevos = filtrados.reduce((s, r) => s + Number(r.relevos), 0);

  // Badges de tab
  const badgeHE = rows.filter((r) => parseFloat(r.horas_extra || "0") > 0).length;
  const badgeFaltas = rows.filter((r) => Number(r.faltas) > 0 || Number(r.suspensiones) > 0).length;
  const badgeAnt = rows.filter((r) => r.anticipos_count > 0).length;
  const badgeCob = rows.filter((r) => Number(r.relevos) > 0 || Number(r.descansos_trabajados) > 0).length;

  function toggleSort(field: keyof ColaboradorPre) {
    if (sortField === field) setSortAsc((a) => !a);
    else { setSortField(field); setSortAsc(true); }
  }

  function SortIcon({ field }: { field: keyof ColaboradorPre }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-white/20" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  }

  const th = (label: string, field: keyof ColaboradorPre, cls = "") => (
    <th onClick={() => toggleSort(field)}
      className={`text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 cursor-pointer hover:text-white/70 select-none whitespace-nowrap ${cls}`}>
      <span className="flex items-center gap-1">{label} <SortIcon field={field} /></span>
    </th>
  );

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "resumen",     label: "Resumen",           icon: FileText },
    { id: "horas_extra", label: "Horas Extra",       icon: TrendingUp, badge: badgeHE },
    { id: "faltas",      label: "Faltas / Susp.",    icon: AlertTriangle, badge: badgeFaltas },
    { id: "anticipos",   label: "Anticipos",         icon: CreditCard, badge: badgeAnt },
    { id: "coberturas",  label: "Coberturas",        icon: Repeat2, badge: badgeCob },
  ];

  return (
    <AdminLayout title="Pre-Planilla">
      <div className="space-y-4">

        {/* ── Selector de período ──────────────────────────────────────────── */}
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-white/70">Período</span>
            <div className="flex-1" />
            {loaded && rows.length > 0 && (
              <div className="flex items-center gap-2">
                {periodoCerrado ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
                    <Lock className="w-3.5 h-3.5" />Período cerrado
                  </span>
                ) : (
                  <button onClick={() => { cargarValidacion(); setShowCierreModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors">
                    <Lock className="w-3.5 h-3.5" />Cerrar período
                  </button>
                )}
                <button onClick={exportarCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition-colors">
                  <Download className="w-3.5 h-3.5" />Exportar CSV
                </button>
              </div>
            )}
            {loaded && rows.length === 0 && (
              <button onClick={exportarCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition-colors">
                <Download className="w-3.5 h-3.5" />Exportar CSV
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: "Q. Actual", d: presets.qDesde, h: presets.qHasta },
              { label: "Q. Anterior", d: presets.qpDesde, h: presets.qpHasta },
              { label: "Mes actual", d: presets.maDesde, h: presets.maHasta },
              { label: "Mes anterior", d: presets.mpDesde, h: presets.mpHasta },
            ].map(({ label, d, h }) => {
              const active = desde === d && hasta === h && !modoCustom;
              return (
                <button key={label} onClick={() => aplicarPreset(d, h)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    active ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/4 border-white/10 text-white/50 hover:text-white hover:border-white/20"
                  }`}>
                  {label}
                </button>
              );
            })}
            <button onClick={() => setModoCustom((m) => !m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                modoCustom ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/4 border-white/10 text-white/50 hover:text-white hover:border-white/20"
              }`}>
              Rango personalizado
            </button>
          </div>
          {modoCustom && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/6">
              <input type="date" value={customDesde} onChange={(e) => setCustomDesde(e.target.value)}
                className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary/50" />
              <span className="text-white/30 text-sm">al</span>
              <input type="date" value={customHasta} onChange={(e) => setCustomHasta(e.target.value)}
                className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary/50" />
              <button onClick={aplicarCustom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/50 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors">
                <RefreshCw className="w-3 h-3" /> Aplicar
              </button>
            </div>
          )}
          {loaded && (
            <p className="text-[10px] text-white/30 mt-2">
              {fmtFecha(desde)} — {fmtFecha(hasta)} · {periodoTotalDias}d · {rows.length} colaboradores con novedades
            </p>
          )}
        </div>

        {/* ── Estado vacío / carga ─────────────────────────────────────────── */}
        {!loaded && !loading && (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-12 text-center">
            <Briefcase className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-4">Selecciona un período para cargar la pre-planilla</p>
            <button onClick={() => cargar(desde, hasta)}
              className="px-4 py-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 transition-colors">
              Cargar período actual
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-8 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-white/40 text-sm">Consolidando novedades del período…</p>
          </div>
        )}

        {loaded && !loading && (
          <>
            {/* ── KPI Cards ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { icon: Users,         label: "Colaboradores",  val: totalColabs,               cls: "text-white" },
                { icon: AlertTriangle, label: "Faltas / Susp.", val: totalFaltas,               cls: totalFaltas > 0 ? "text-red-400" : "text-white/30" },
                { icon: TrendingUp,    label: "Horas extra",    val: `${totalHE.toFixed(1)} h`, cls: totalHE > 0 ? "text-orange-400" : "text-white/30" },
                { icon: Repeat2,       label: "Relevos",        val: totalRelevos,              cls: totalRelevos > 0 ? "text-purple-400" : "text-white/30" },
                { icon: Wallet,        label: "Incentivos Cash",val: fmtQ(totalIncentivos),     cls: totalIncentivos > 0 ? "text-emerald-400" : "text-white/30" },
                { icon: CreditCard,    label: "Total anticipos",val: fmtQ(totalAnt),            cls: totalAnt > 0 ? "text-amber-400" : "text-white/30" },
                { icon: AlertCircle,   label: "Con alertas",    val: conAlertas,                cls: conAlertas > 0 ? "text-rose-400" : "text-white/30" },
              ].map(({ icon: Icon, label, val, cls }) => (
                <div key={label} className="bg-[#0c1929] border border-white/8 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-white/35 mb-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">{label}</span>
                  </div>
                  <p className={`text-lg font-bold ${cls}`}>{val}</p>
                </div>
              ))}
            </div>

            {/* ── Panel de validación ─────────────────────────────────────── */}
            {showValidacion && (
              <div className={`border rounded-xl overflow-hidden ${
                validacion?.periodo_cerrado ? "bg-primary/5 border-primary/30" :
                validacion?.resumen?.errores > 0 ? "bg-red-500/5 border-red-500/30" :
                validacion?.resumen?.alertas > 0 ? "bg-amber-500/5 border-amber-500/25" :
                "bg-green-500/5 border-green-500/25"
              }`}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
                  {validacionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                  ) : validacion?.periodo_cerrado ? (
                    <Lock className="w-4 h-4 text-primary" />
                  ) : validacion?.resumen?.errores > 0 ? (
                    <AlertOctagon className="w-4 h-4 text-red-400" />
                  ) : validacion?.resumen?.alertas > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <CheckCheck className="w-4 h-4 text-green-400" />
                  )}
                  <span className="text-xs font-semibold text-white/70">
                    {validacionLoading ? "Ejecutando validaciones…" :
                     validacion?.periodo_cerrado ? `Período cerrado · ${validacion.cerrado_por} · ${validacion.cerrado_at ? new Date(validacion.cerrado_at).toLocaleString("es-GT") : ""}` :
                     `Validación: ${validacion?.resumen?.errores ?? 0} error${(validacion?.resumen?.errores ?? 0) !== 1 ? "es" : ""} crítico${(validacion?.resumen?.errores ?? 0) !== 1 ? "s" : ""} · ${validacion?.resumen?.alertas ?? 0} alerta${(validacion?.resumen?.alertas ?? 0) !== 1 ? "s" : ""}`}
                  </span>
                  <div className="flex-1" />
                  <button onClick={() => setShowValidacion(false)} className="text-white/30 hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {!validacionLoading && validacion && !validacion.periodo_cerrado && (
                  <div className="p-3 space-y-2">
                    {validacion.errores_criticos.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Errores críticos — bloquean el cierre</p>
                        {validacion.errores_criticos.slice(0, 5).map((e, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-red-300/80">
                            <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                            <span>{e.mensaje}</span>
                          </div>
                        ))}
                        {validacion.errores_criticos.length > 5 && (
                          <p className="text-[10px] text-red-400/60">…y {validacion.errores_criticos.length - 5} más</p>
                        )}
                      </div>
                    )}
                    {validacion.alertas.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Alertas — no bloquean el cierre</p>
                        {validacion.alertas.slice(0, 4).map((a, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-amber-300/70">
                            <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                            <span>{a.mensaje}</span>
                          </div>
                        ))}
                        {validacion.alertas.length > 4 && (
                          <p className="text-[10px] text-amber-400/60">…y {validacion.alertas.length - 4} más</p>
                        )}
                      </div>
                    )}
                    {validacion.errores_criticos.length === 0 && validacion.alertas.length === 0 && (
                      <div className="flex items-center gap-2 text-xs text-green-400">
                        <CheckCheck className="w-4 h-4" />
                        <span>Sin errores ni alertas. La pre-planilla está lista para cerrar.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Navegación de tabs ──────────────────────────────────────── */}
            <div className="bg-[#0c1929] border border-white/8 rounded-xl overflow-hidden">
              <div className="flex border-b border-white/6 overflow-x-auto">
                {TABS.map(({ id, label, icon: Icon, badge }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === id
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/3"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {!!badge && badge > 0 && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeTab === id ? "bg-primary/30 text-primary" : "bg-white/10 text-white/50"
                      }`}>{badge}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Tab: Resumen ─────────────────────────────────────────── */}
              {activeTab === "resumen" && (
                <>
                  {/* Filtros */}
                  <div className="p-4 border-b border-white/5">
                    <div className="flex flex-wrap gap-2 items-center">
                      <input type="text" placeholder="Buscar nombre, DPI, puesto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                        className="flex-1 min-w-[180px] bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50" />
                      {clientes.length > 0 && (
                        <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}
                          className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none">
                          <option value="todos">Todos los clientes</option>
                          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                      {sedes.length > 0 && (
                        <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}
                          className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none">
                          <option value="todos">Todas las sedes</option>
                          {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                        className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none">
                        <option value="todos">Todos los estados</option>
                        <option value="activo">Activo</option>
                        <option value="suspendido">Suspendido</option>
                        <option value="licencia">Licencia</option>
                      </select>
                      <select value={filtroRevision} onChange={(e) => setFiltroRevision(e.target.value)}
                        className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none">
                        <option value="todos">Toda revisión</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="revisada">Revisada</option>
                        <option value="observada">Observada</option>
                        <option value="aprobado_rrhh">Aprobado RRHH</option>
                      </select>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { label: "⚠ Revisar", val: soloRevisar, set: setSoloRevisar, cls: "text-rose-400 border-rose-400/30 bg-rose-400/10" },
                          { label: "Con faltas", val: soloConFaltas, set: setSoloConFaltas, cls: "" },
                          { label: "Con HE", val: soloConHE, set: setSoloConHE, cls: "" },
                          { label: "Con anticipos", val: soloConAnticipos, set: setSoloConAnticipos, cls: "" },
                          { label: "Con incentivo", val: soloConIncentivos, set: setSoloConIncentivos, cls: "" },
                        ].map(({ label, val, set, cls }) => (
                          <button key={label} onClick={() => set((v) => !v)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                              val ? (cls || "bg-primary/20 border-primary/50 text-primary") : "bg-white/4 border-white/10 text-white/40 hover:text-white/70"
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filtrados.length !== rows.length && (
                      <p className="text-[10px] text-white/30 mt-2">{filtrados.length} de {rows.length} colaboradores</p>
                    )}
                  </div>

                  {/* Tabla principal */}
                  {filtrados.length === 0 ? (
                    <TablaVacia msg="No hay colaboradores que coincidan con los filtros." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-[#060e1c] border-b border-white/6 sticky top-0">
                          <tr>
                            {th("ID", "employee_id")}
                            {th("Colaborador", "nombre_completo", "min-w-[160px]")}
                            {th("Puesto / Sede", "puesto_empleado")}
                            {th("Cliente", "cliente_principal")}
                            {th("Turno", "tipo_turno_nombre")}
                            {th("Sueldo Base", "sueldo_base")}
                            {th("Días", "dias_trabajados")}
                            {th("Faltas", "faltas")}
                            {th("Susp.", "suspensiones")}
                            {th("H. Trab.", "horas_trabajadas")}
                            {th("H. Extra", "horas_extra")}
                            {th("Anticipo", "anticipos_monto")}
                            {th("Total Est.", "sueldo_base")}
                            {th("IGSS", "aplica_igss")}
                            {th("Freq.", "frecuencia_pago")}
                            {th("Revisión", "revision_estado")}
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/4">
                          {filtrados.map((r) => {
                            const heNum2 = parseFloat(r.horas_extra || "0");
                            const tieneAlerta = Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.dias_sin_horas) > 0;
                            const needsReview = tieneAlerta && r.revision_estado === "pendiente";
                            const est2 = calcularTotalEstimado(r, periodoTotalDias);

                            return (
                              <tr key={r.employee_id}
                                onClick={() => setDetalle(r)}
                                className={`cursor-pointer transition-colors ${
                                  needsReview ? "hover:bg-rose-500/5 bg-rose-500/3" :
                                  r.revision_estado === "observada" ? "hover:bg-amber-500/5 bg-amber-500/3" :
                                  "hover:bg-white/3"
                                }`}>
                                {/* ID */}
                                <td className="px-3 py-2.5 text-white/30 text-[10px] whitespace-nowrap">
                                  EMP-{String(r.employee_id).padStart(4, "0")}
                                </td>
                                {/* Colaborador */}
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    {needsReview && <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
                                    {!needsReview && tieneAlerta && <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />}
                                    <div>
                                      <p className="font-semibold text-white">{r.nombre_completo}</p>
                                      <p className="text-white/30 text-[10px]">{r.dpi ? `****${r.dpi.slice(-4)}` : "—"}</p>
                                    </div>
                                  </div>
                                </td>
                                {/* Puesto / Sede */}
                                <td className="px-3 py-2.5">
                                  <p className="text-white/70">{r.puesto_titular_nombre ?? r.puesto_empleado ?? "—"}</p>
                                  <p className="text-white/30 text-[10px]">{r.sede ?? "—"}</p>
                                </td>
                                {/* Cliente */}
                                <td className="px-3 py-2.5 text-white/50">{r.cliente_principal ?? "—"}</td>
                                {/* Turno */}
                                <td className="px-3 py-2.5">
                                  {r.tipo_turno_nombre
                                    ? <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold">{r.tipo_turno_nombre}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                {/* Sueldo */}
                                <td className="px-3 py-2.5 text-white/60 text-right">{fmtQ(r.sueldo_base)}</td>
                                {/* Días trabajados */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-green-400 font-semibold">{Number(r.dias_trabajados)}</span>
                                  {periodoTotalDias != null && <span className="text-white/25 ml-1">/{periodoTotalDias}d</span>}
                                </td>
                                {/* Faltas */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={Number(r.faltas) > 0 ? "text-red-400 font-bold" : "text-white/20"}>{Number(r.faltas)}</span>
                                </td>
                                {/* Suspensiones */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={Number(r.suspensiones) > 0 ? "text-amber-400 font-bold" : "text-white/20"}>{Number(r.suspensiones)}</span>
                                </td>
                                {/* Horas trabajadas */}
                                <td className="px-3 py-2.5 text-right text-white/60">
                                  {parseFloat(r.horas_trabajadas || "0").toFixed(1)} h
                                </td>
                                {/* Horas extra */}
                                <td className="px-3 py-2.5 text-right">
                                  <span className={heNum2 > 0 ? "text-orange-400 font-semibold" : "text-white/20"}>
                                    {heNum2.toFixed(1)} h
                                  </span>
                                </td>
                                {/* Anticipo */}
                                <td className="px-3 py-2.5 text-right">
                                  {r.anticipos_count > 0
                                    ? <span className="text-amber-400 font-semibold">{fmtQ(r.anticipos_monto)}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                {/* Total estimado */}
                                <td className="px-3 py-2.5 text-right">
                                  {est2 != null ? (
                                    <div>
                                      <span className={`font-bold ${est2.total >= 0 ? "text-primary" : "text-red-400"}`}>
                                        {fmtQ(est2.total)}
                                      </span>
                                      {(est2.descFaltas > 0 || est2.valorHE > 0) && (
                                        <p className="text-[9px] text-white/25 mt-0.5">
                                          {est2.descFaltas > 0 ? `-${fmtQ(est2.descFaltas)} ` : ""}
                                          {est2.valorHE > 0 ? `+${fmtQ(est2.valorHE)} HE` : ""}
                                        </p>
                                      )}
                                    </div>
                                  ) : <span className="text-white/20">—</span>}
                                </td>
                                {/* IGSS */}
                                <td className="px-3 py-2.5 text-center">
                                  {r.aplica_igss ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Sí
                                    </span>
                                  ) : (
                                    <span className="text-white/20 text-[10px]">—</span>
                                  )}
                                </td>
                                {/* Frecuencia */}
                                <td className="px-3 py-2.5 text-center">
                                  {r.excluido_frecuencia_pago ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                      Excluido
                                    </span>
                                  ) : r.frecuencia_pago === "mensual" ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                      Mensual
                                    </span>
                                  ) : (
                                    <span className="text-white/20 text-[10px]">Q</span>
                                  )}
                                </td>
                                {/* Revisión */}
                                <td className="px-3 py-2.5">
                                  {needsReview
                                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-rose-400 bg-rose-400/10 border-rose-400/25 animate-pulse">
                                        <AlertCircle className="w-2.5 h-2.5" />REVISAR
                                      </span>
                                    : <RevisionBadge estado={r.revision_estado} />}
                                </td>
                                {/* Ver detalle */}
                                <td className="px-3 py-2.5">
                                  <button onClick={(e) => { e.stopPropagation(); setDetalle(r); }}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-primary hover:bg-primary/10 transition-colors">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── Tab: Horas Extra ─────────────────────────────────────── */}
              {activeTab === "horas_extra" && <AnexoHorasExtra desde={desde} hasta={hasta} />}

              {/* ── Tab: Faltas ──────────────────────────────────────────── */}
              {activeTab === "faltas" && <AnexoFaltas desde={desde} hasta={hasta} />}

              {/* ── Tab: Anticipos ───────────────────────────────────────── */}
              {activeTab === "anticipos" && <AnexoAnticipos desde={desde} hasta={hasta} />}

              {/* ── Tab: Coberturas ──────────────────────────────────────── */}
              {activeTab === "coberturas" && <AnexoCoberturas desde={desde} hasta={hasta} />}
            </div>

            {/* ── Nota informativa ──────────────────────────────────────── */}
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-300 mb-1">Pre-planilla operativa — estimación indicativa</p>
                  <p className="text-[11px] text-blue-300/60 leading-relaxed">
                    <strong className="text-blue-300/80">Total Estimado Preliminar</strong> = sueldo proporcional al período – descuento por faltas/suspensiones + valor horas extra (1.5x) – anticipos.
                    <br />
                    <strong className="text-blue-300/80">Pendiente para planilla final:</strong> IGSS (12.67% patronal + 4.83% laboral), bonificación incentivo (Dto. 78-89), séptimo día remunerado, y deducciones legales finales.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal de cierre ──────────────────────────────────────────────── */}
      {showCierreModal && (
        <CierreModal
          desde={desde}
          hasta={hasta}
          validacion={validacion}
          validacionLoading={validacionLoading}
          onClose={() => setShowCierreModal(false)}
          onCerrado={() => cargar(desde, hasta)}
        />
      )}

      {/* ── Modal de detalle ─────────────────────────────────────────────── */}
      {detalle && (
        <DetalleModal col={detalle} desde={desde} hasta={hasta}
          onClose={() => setDetalle(null)}
          onRevisionChange={(id, est, obs) => {
            onRevisionChange(id, est, obs);
            setDetalle((d) => d?.employee_id === id
              ? { ...d, revision_estado: est as ColaboradorPre["revision_estado"], revision_observaciones: obs }
              : d);
          }}
        />
      )}
    </AdminLayout>
  );
}
