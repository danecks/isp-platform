/**
 * PrePlanilla.tsx — Pre-Planilla Operativa por Período
 *
 * Consolida novedades_nomina_diarias + employees + anticipos para revisión
 * de RRHH antes del cálculo de planilla formal.
 *
 * FUENTES DE DATOS:
 *   - novedades_nomina_diarias  (asistencia, horas, faltas, suspensiones)
 *   - employees                 (sueldo_base, tipo_jornada, horas_contrato)
 *   - anticipos                 (aprobados/pagados en el período)
 *   - pre_planilla_revision     (estado de revisión RRHH: pendiente/revisada/observada)
 *
 * LO QUE NO CALCULA TODAVÍA:
 *   - Descuento proporcional por faltas/suspensiones
 *   - IGSS (cuota patronal 12.67% + laboral 4.83%)
 *   - Séptimo día / descanso remunerado
 *   - Bonificación incentivo (Decreto 78-89)
 *   - Indemnización / liquidación
 *   - Neto a pagar
 */

import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Download, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Clock, Eye, X, Loader2,
  Users, Briefcase, TrendingUp, Wallet, Info,
  Check, MessageSquare, AlertTriangle,
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
  revision_estado: "pendiente" | "revisada" | "observada";
  revision_observaciones: string | null;
  revision_por: string | null;
  revision_at: string | null;
  // Turno
  tipo_turno_id: number | null;
  tipo_turno_nombre: string | null;
  turno_horas_trabajo: string | null;
  turno_fecha_inicio_ciclo: string | null;
  horas_esperadas_total: string | null;
  dias_esperados_trabajo: number;
  dias_esperados_descanso: number;
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

// ─── Presets de período ───────────────────────────────────────────────────────

function getPeriodPresets() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth(); // 0-based
  const d = hoy.getDate();
  const fin = (y2: number, m2: number) => new Date(y2, m2 + 1, 0).getDate();
  const fmt = (y2: number, m2: number, d2: number) =>
    `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;

  // Quincena actual
  let qDesde: string, qHasta: string;
  if (d <= 15) {
    qDesde = fmt(y, m, 1);
    qHasta = fmt(y, m, 15);
  } else {
    qDesde = fmt(y, m, 16);
    qHasta = fmt(y, m, fin(y, m));
  }

  // Quincena anterior
  let qpDesde: string, qpHasta: string;
  if (d <= 15) {
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    qpDesde = fmt(py, pm, 16);
    qpHasta = fmt(py, pm, fin(py, pm));
  } else {
    qpDesde = fmt(y, m, 1);
    qpHasta = fmt(y, m, 15);
  }

  // Mes actual
  const maDesde = fmt(y, m, 1);
  const maHasta = fmt(y, m, fin(y, m));

  // Mes anterior
  const pm = m === 0 ? 11 : m - 1;
  const py = m === 0 ? y - 1 : y;
  const mpDesde = fmt(py, pm, 1);
  const mpHasta = fmt(py, pm, fin(py, pm));

  return { qDesde, qHasta, qpDesde, qpHasta, maDesde, maHasta, mpDesde, mpHasta };
}

// ─── Helper format ────────────────────────────────────────────────────────────

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

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

// ─── Badge de revisión ────────────────────────────────────────────────────────

const REVISION_CFG = {
  pendiente: { label: "Pendiente",  cls: "text-amber-400 bg-amber-400/10 border-amber-400/25",  icon: Clock },
  revisada:  { label: "Revisada",   cls: "text-green-400 bg-green-400/10 border-green-400/25",  icon: CheckCircle2 },
  observada: { label: "Observada",  cls: "text-rose-400 bg-rose-400/10 border-rose-400/25",     icon: AlertCircle },
};

function RevisionBadge({ estado }: { estado: string }) {
  const cfg = REVISION_CFG[estado as keyof typeof REVISION_CFG] ??
    { label: estado, cls: "text-white/40 bg-white/5 border-white/10", icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.cls}`}>
      <cfg.icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
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
  const [data, setData] = useState<{ novedades: DetalleNovedad[]; anticipos: DetalleAnticipo[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [revEstado, setRevEstado] = useState(col.revision_estado);
  const [revObs, setRevObs] = useState(col.revision_observaciones ?? "");
  const [savingRev, setSavingRev] = useState(false);

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

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-end bg-black/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl bg-[#07111f] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#060e1c] shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">{col.nombre_completo}</h3>
            <p className="text-[11px] text-white/40 mt-0.5">
              {col.puesto_empleado ?? "—"} · {col.sede ?? "—"} · {fmtFecha(desde)} – {fmtFecha(hasta)}
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Resumen del período */}
          <div className="p-5 border-b border-white/5">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Resumen del período</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Días trabajados", val: Number(col.dias_trabajados), cls: "text-green-400" },
                { label: "Faltas", val: Number(col.faltas), cls: Number(col.faltas) > 0 ? "text-red-400" : "text-white/50" },
                { label: "Suspensiones", val: Number(col.suspensiones), cls: Number(col.suspensiones) > 0 ? "text-amber-400" : "text-white/50" },
                { label: "Descansos trab.", val: Number(col.descansos_trabajados), cls: "text-blue-400" },
                { label: "Relevos", val: Number(col.relevos), cls: "text-purple-400" },
                { label: "Días sin horas", val: Number(col.dias_sin_horas), cls: Number(col.dias_sin_horas) > 0 ? "text-amber-400" : "text-white/30" },
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
            {col.anticipos_count > 0 && (
              <div className="mt-2 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-amber-300">Anticipos del período</span>
                <span className="text-sm font-bold text-amber-400">{fmtQ(col.anticipos_monto)} ({col.anticipos_count})</span>
              </div>
            )}
            {col.sueldo_base && (
              <div className="mt-2 bg-white/3 border border-white/6 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-white/40">Sueldo base</span>
                <span className="text-sm font-semibold text-white">{fmtQ(col.sueldo_base)}</span>
              </div>
            )}
          </div>

          {/* Novedades diarias */}
          <div className="p-5 border-b border-white/5">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Novedades diarias</p>
            {loading ? (
              <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
              </div>
            ) : data?.novedades.length === 0 ? (
              <p className="text-white/30 text-sm py-2">Sin novedades registradas en el período.</p>
            ) : (
              <div className="space-y-1">
                {data?.novedades.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/3 text-xs">
                    <span className="text-white/40 w-24 shrink-0">{fmtFecha(n.fecha)}</span>
                    <div className="flex items-center gap-1 flex-1 flex-wrap">
                      {n.trabajo_dia && <span className="px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-400/20">Trabajó</span>}
                      {n.falta && <span className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">Falta</span>}
                      {n.suspension && <span className="px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">Suspensión</span>}
                      {n.descanso_trabajado && <span className="px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Dsco. trab.</span>}
                      {n.puesto_cubierto_nombre && n.puesto_cubierto_nombre !== n.puesto_titular_nombre && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400 border border-purple-400/20">Relevo</span>
                      )}
                    </div>
                    <span className="text-white/40 w-14 text-right shrink-0">
                      {n.horas_trabajadas ? `${parseFloat(n.horas_trabajadas).toFixed(1)} h` : "—"}
                    </span>
                    {n.fuente === "auto_auditoria" && (
                      <span title="Detectado automáticamente" className="text-amber-400/60">
                        <Info className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anticipos */}
          {!loading && (data?.anticipos.length ?? 0) > 0 && (
            <div className="p-5 border-b border-white/5">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Anticipos del período</p>
              <div className="space-y-1.5">
                {data!.anticipos.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-[#0c1929] rounded-lg">
                    <div>
                      <p className="text-xs font-semibold text-amber-300">{fmtQ(a.cantidad)}</p>
                      <p className="text-[10px] text-white/35">{a.periodo ?? "—"} · {a.origen}</p>
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
          )}

          {/* Panel de revisión RRHH */}
          <div className="p-5">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Revisión RRHH</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["pendiente", "revisada", "observada"] as const).map((e) => {
                  const cfg = REVISION_CFG[e];
                  return (
                    <button
                      key={e}
                      onClick={() => setRevEstado(e)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        revEstado === e ? cfg.cls + " border-opacity-60" : "text-white/30 bg-white/4 border-white/10 hover:border-white/20"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={revObs}
                onChange={(e) => setRevObs(e.target.value)}
                rows={3}
                placeholder="Observaciones de RRHH (opcional)…"
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
              />
              <button
                onClick={guardarRevision}
                disabled={savingRev}
                className="w-full py-2.5 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {savingRev && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Check className="w-3.5 h-3.5" />
                Guardar revisión
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
      </div>
    </div>,
    document.body
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PrePlanilla() {
  const { toast } = useToast();
  const presets = getPeriodPresets();

  // Estado del período
  const [desde, setDesde] = useState(presets.qDesde);
  const [hasta, setHasta] = useState(presets.qHasta);
  const [customDesde, setCustomDesde] = useState(presets.qDesde);
  const [customHasta, setCustomHasta] = useState(presets.qHasta);
  const [modoCustom, setModoCustom] = useState(false);

  // Datos
  const [rows, setRows] = useState<ColaboradorPre[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Detalle modal
  const [detalle, setDetalle] = useState<ColaboradorPre | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroSede, setFiltroSede] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroRevision, setFiltroRevision] = useState("todos");
  const [soloConFaltas, setSoloConFaltas] = useState(false);
  const [soloConAnticipos, setSoloConAnticipos] = useState(false);
  const [soloConHE, setSoloConHE] = useState(false);

  // Ordenamiento
  const [sortField, setSortField] = useState<keyof ColaboradorPre>("nombre_completo");
  const [sortAsc, setSortAsc] = useState(true);

  // Cargar datos
  const cargar = useCallback(async (d: string, h: string) => {
    setLoading(true);
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

  // Actualizar revisión en memoria
  function onRevisionChange(id: number, estado: string, obs: string) {
    setRows((prev) => prev.map((r) =>
      r.employee_id === id
        ? { ...r, revision_estado: estado as ColaboradorPre["revision_estado"], revision_observaciones: obs, revision_at: new Date().toISOString() }
        : r
    ));
  }

  // Exportar CSV
  async function exportarCSV() {
    const url = `${BASE}/api/nomina/pre-planilla/export?desde=${desde}&hasta=${hasta}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `pre-planilla_${desde}_${hasta}.csv`;
    // Agregar header de sesión vía fetch + blob
    try {
      const res = await fetch(url, { headers: { "x-isp-session": getSession() } });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e: unknown) {
      toast({ title: "Error al exportar", description: (e as Error).message, variant: "destructive" });
    }
  }

  // Opciones de filtro (desde los datos)
  const clientes = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.cliente_principal).filter(Boolean))) as string[],
    [rows]);
  const sedes = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.sede).filter(Boolean))) as string[],
    [rows]);

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
    if (soloConHE) data = data.filter((r) => parseFloat(r.horas_extra || "0") > 0);

    data.sort((a, b) => {
      const va = a[sortField] ?? "";
      const vb = b[sortField] ?? "";
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      return sortAsc
        ? String(va).localeCompare(String(vb), "es")
        : String(vb).localeCompare(String(va), "es");
    });

    return data;
  }, [rows, busqueda, filtroCliente, filtroSede, filtroEstado, filtroRevision,
      soloConFaltas, soloConAnticipos, soloConHE, sortField, sortAsc]);

  // Días totales del período seleccionado
  const periodoTotalDias = desde && hasta
    ? Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1
    : null;

  // KPIs — se usa Number() para evitar concatenación de strings (pg devuelve bigint como string)
  const totalColabs = filtrados.length;
  const totalDias = filtrados.reduce((s, r) => s + Number(r.dias_trabajados), 0);
  const totalFaltas = filtrados.reduce((s, r) => s + Number(r.faltas) + Number(r.suspensiones), 0);
  const totalHE = filtrados.reduce((s, r) => s + parseFloat(r.horas_extra || "0"), 0);
  const totalAnt = filtrados.reduce((s, r) => s + Number(r.anticipos_monto), 0);
  const conAlertas = filtrados.filter((r) => Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.dias_sin_horas) > 0).length;

  function toggleSort(field: keyof ColaboradorPre) {
    if (sortField === field) setSortAsc((a) => !a);
    else { setSortField(field); setSortAsc(true); }
  }

  function SortIcon({ field }: { field: keyof ColaboradorPre }) {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-white/20" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  }

  const th = (label: string, field: keyof ColaboradorPre, cls = "") => (
    <th
      onClick={() => toggleSort(field)}
      className={`text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 cursor-pointer hover:text-white/70 select-none whitespace-nowrap ${cls}`}
    >
      <span className="flex items-center gap-1">{label} <SortIcon field={field} /></span>
    </th>
  );

  return (
    <AdminLayout title="Pre-Planilla">
      <div className="space-y-4">

        {/* ── Selector de período ─────────────────────────────────────────────── */}
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-white/70">Período</span>
            <div className="flex-1" />
            {loaded && (
              <button
                onClick={exportarCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            )}
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: "Q. Actual", d: presets.qDesde, h: presets.qHasta },
              { label: "Q. Anterior", d: presets.qpDesde, h: presets.qpHasta },
              { label: "Mes actual", d: presets.maDesde, h: presets.maHasta },
              { label: "Mes anterior", d: presets.mpDesde, h: presets.mpHasta },
            ].map(({ label, d, h }) => {
              const active = desde === d && hasta === h && !modoCustom;
              return (
                <button
                  key={label}
                  onClick={() => aplicarPreset(d, h)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    active
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-white/4 border-white/10 text-white/50 hover:text-white hover:border-white/20"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <button
              onClick={() => setModoCustom((m) => !m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                modoCustom
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-white/4 border-white/10 text-white/50 hover:text-white hover:border-white/20"
              }`}
            >
              Rango personalizado
            </button>
          </div>

          {/* Rango personalizado */}
          {modoCustom && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/6">
              <input type="date" value={customDesde} onChange={(e) => setCustomDesde(e.target.value)}
                className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary/50" />
              <span className="text-white/30 text-sm">al</span>
              <input type="date" value={customHasta} onChange={(e) => setCustomHasta(e.target.value)}
                className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary/50" />
              <button
                onClick={aplicarCustom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/50 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Aplicar
              </button>
            </div>
          )}

          {/* Período activo */}
          {loaded && (
            <p className="text-[10px] text-white/30 mt-2">
              Período: {fmtFecha(desde)} — {fmtFecha(hasta)} · {rows.length} colaboradores con novedades
            </p>
          )}
        </div>

        {/* ── Estado vacío / carga inicial ───────────────────────────────────── */}
        {!loaded && !loading && (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-12 text-center">
            <Briefcase className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-4">Selecciona un período para cargar la pre-planilla</p>
            <button
              onClick={() => cargar(desde, hasta)}
              className="px-4 py-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 transition-colors"
            >
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
            {/* ── KPI Cards ────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon: Users, label: "Colaboradores", val: totalColabs, cls: "text-white" },
                { icon: CheckCircle2, label: "Días trabajados", val: totalDias, cls: "text-green-400" },
                { icon: AlertTriangle, label: "Faltas / Susp.", val: totalFaltas, cls: totalFaltas > 0 ? "text-red-400" : "text-white/30" },
                { icon: TrendingUp, label: "Horas extra", val: `${totalHE.toFixed(1)} h`, cls: totalHE > 0 ? "text-orange-400" : "text-white/30" },
                { icon: Wallet, label: "Total anticipos", val: fmtQ(totalAnt), cls: totalAnt > 0 ? "text-amber-400" : "text-white/30" },
                { icon: AlertCircle, label: "Con alertas", val: conAlertas, cls: conAlertas > 0 ? "text-rose-400" : "text-white/30" },
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

            {/* ── Filtros ──────────────────────────────────────────────────────── */}
            <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4">
              <div className="flex flex-wrap gap-2 items-center">
                {/* Búsqueda */}
                <input
                  type="text"
                  placeholder="Buscar nombre, DPI, puesto…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="flex-1 min-w-[180px] bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
                />
                {/* Cliente */}
                {clientes.length > 0 && (
                  <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}
                    className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50 appearance-none">
                    <option value="todos">Todos los clientes</option>
                    {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {/* Sede */}
                {sedes.length > 0 && (
                  <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}
                    className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50 appearance-none">
                    <option value="todos">Todas las sedes</option>
                    {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {/* Estado laboral */}
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                  className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50 appearance-none">
                  <option value="todos">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="licencia">Licencia</option>
                </select>
                {/* Revisión */}
                <select value={filtroRevision} onChange={(e) => setFiltroRevision(e.target.value)}
                  className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50 appearance-none">
                  <option value="todos">Toda revisión</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="revisada">Revisada</option>
                  <option value="observada">Observada</option>
                </select>
                {/* Flags rápidos */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: "Con faltas", val: soloConFaltas, set: setSoloConFaltas },
                    { label: "Con anticipos", val: soloConAnticipos, set: setSoloConAnticipos },
                    { label: "Con HE", val: soloConHE, set: setSoloConHE },
                  ].map(({ label, val, set }) => (
                    <button
                      key={label}
                      onClick={() => set((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                        val ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/4 border-white/10 text-white/40 hover:text-white/70"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {filtrados.length !== rows.length && (
                <p className="text-[10px] text-white/30 mt-2">{filtrados.length} de {rows.length} colaboradores</p>
              )}
            </div>

            {/* ── Tabla principal ───────────────────────────────────────────────── */}
            <div className="bg-[#0c1929] border border-white/8 rounded-xl overflow-hidden">
              {filtrados.length === 0 ? (
                <div className="p-10 text-center text-white/30 text-sm">
                  No hay colaboradores que coincidan con los filtros.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-[#060e1c] border-b border-white/6 sticky top-0">
                      <tr>
                        {th("Colaborador", "nombre_completo", "min-w-[180px]")}
                        {th("Puesto / Sede", "puesto_empleado")}
                        {th("Cliente", "cliente_principal")}
                        {th("Turno", "tipo_turno_nombre")}
                        {th("Sueldo Base", "sueldo_base")}
                        {th("Días Trab.", "dias_trabajados")}
                        {th("Faltas", "faltas")}
                        {th("Susp.", "suspensiones")}
                        {th("H. Trab.", "horas_trabajadas")}
                        {th("H. Esp.", "horas_esperadas_total")}
                        {th("Cumpl.", "horas_trabajadas")}
                        {th("H. Extra", "horas_extra")}
                        {th("Anticipos", "anticipos_monto")}
                        {th("Revisión", "revision_estado")}
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {filtrados.map((r) => {
                        const htNum2 = parseFloat(r.horas_trabajadas || "0");
                        const heNum2 = parseFloat(r.horas_extra || "0");
                        const hesp = r.horas_esperadas_total ? parseFloat(r.horas_esperadas_total) : null;
                        const cumplPct = hesp && hesp > 0 ? Math.round((htNum2 / hesp) * 100) : null;
                        const tieneAlerta = r.faltas > 0 || r.suspensiones > 0 || r.dias_sin_horas > 0;

                        return (
                          <tr
                            key={r.employee_id}
                            className="hover:bg-white/3 transition-colors cursor-pointer"
                            onClick={() => setDetalle(r)}
                          >
                            {/* Colaborador */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                {tieneAlerta && <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />}
                                <div>
                                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                                  <p className="text-white/30">{r.dpi ? `****${r.dpi.slice(-4)}` : "—"}</p>
                                </div>
                              </div>
                            </td>
                            {/* Puesto / Sede */}
                            <td className="px-3 py-2.5">
                              <p className="text-white/70">{r.puesto_titular_nombre ?? r.puesto_empleado ?? "—"}</p>
                              <p className="text-white/30">{r.sede ?? "—"}</p>
                            </td>
                            {/* Cliente */}
                            <td className="px-3 py-2.5 text-white/50">{r.cliente_principal ?? "—"}</td>
                            {/* Turno */}
                            <td className="px-3 py-2.5">
                              {r.tipo_turno_nombre
                                ? <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold">{r.tipo_turno_nombre}</span>
                                : <span className="text-white/20">—</span>
                              }
                            </td>
                            {/* Sueldo */}
                            <td className="px-3 py-2.5 text-white/60 text-right">{fmtQ(r.sueldo_base)}</td>
                            {/* Días trabajados */}
                            <td className="px-3 py-2.5 text-center">
                              <span className="text-green-400 font-semibold">{Number(r.dias_trabajados)}</span>
                              {periodoTotalDias != null && (
                                <span className="text-white/30 ml-1">/ {periodoTotalDias}d</span>
                              )}
                            </td>
                            {/* Faltas */}
                            <td className="px-3 py-2.5 text-center">
                              <span className={Number(r.faltas) > 0 ? "text-red-400 font-semibold" : "text-white/25"}>{Number(r.faltas)}</span>
                            </td>
                            {/* Suspensiones */}
                            <td className="px-3 py-2.5 text-center">
                              <span className={Number(r.suspensiones) > 0 ? "text-amber-400 font-semibold" : "text-white/25"}>{Number(r.suspensiones)}</span>
                            </td>
                            {/* Horas trabajadas */}
                            <td className="px-3 py-2.5 text-right text-white/60">{htNum2.toFixed(1)} h</td>
                            {/* Horas esperadas */}
                            <td className="px-3 py-2.5 text-right">
                              {hesp != null
                                ? <span className="text-white/50">{hesp.toFixed(1)} h</span>
                                : <span className="text-white/20">—</span>
                              }
                            </td>
                            {/* Cumplimiento */}
                            <td className="px-3 py-2.5 text-right">
                              {cumplPct != null ? (
                                <span className={`font-semibold ${
                                  cumplPct >= 95 ? "text-green-400" :
                                  cumplPct >= 75 ? "text-amber-400" : "text-red-400"
                                }`}>{cumplPct}%</span>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>
                            {/* Horas extra */}
                            <td className="px-3 py-2.5 text-right">
                              <span className={heNum2 > 0 ? "text-orange-400 font-semibold" : "text-white/25"}>{heNum2.toFixed(1)} h</span>
                            </td>
                            {/* Anticipos */}
                            <td className="px-3 py-2.5 text-right">
                              {r.anticipos_count > 0 ? (
                                <span className="text-amber-400 font-semibold">{fmtQ(r.anticipos_monto)}</span>
                              ) : (
                                <span className="text-white/25">—</span>
                              )}
                            </td>
                            {/* Revisión */}
                            <td className="px-3 py-2.5">
                              <RevisionBadge estado={r.revision_estado} />
                            </td>
                            {/* Ver detalle */}
                            <td className="px-3 py-2.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); setDetalle(r); }}
                                className="p-1.5 rounded-lg text-white/30 hover:text-primary hover:bg-primary/10 transition-colors"
                              >
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
            </div>

            {/* ── Nota informativa sobre próxima fase ───────────────────────────── */}
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-300 mb-1">Esta es una pre-planilla operativa</p>
                  <p className="text-[11px] text-blue-300/60 leading-relaxed">
                    Incluye: asistencia, horas, faltas, suspensiones, descansos trabajados, horas extra, relevos y anticipos.
                    <br />
                    <strong className="text-blue-300/80">Pendiente para planilla final:</strong> descuento proporcional por ausencias, IGSS (12.67% patronal + 4.83% laboral),
                    bonificación incentivo (Dto. 78-89), séptimo día, y cálculo de neto a pagar.
                    Los datos actuales permiten conectar esta base directamente con el sistema de planilla formal.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal de detalle ────────────────────────────────────────────────── */}
      {detalle && (
        <DetalleModal
          col={detalle}
          desde={desde}
          hasta={hasta}
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
