/**
 * PrePlanilla.tsx — Pre-Planilla Operativa por Período (orquestador)
 *
 * Esta pantalla está dividida en módulos por sección dentro de
 * `./pre-planilla/`:
 *   - types.ts                 — Interfaces / tipos compartidos
 *   - helpers.ts               — apiRequest, formateadores, IGSS, ISR,
 *                                cálculo de total estimado y REVISION_CFG
 *   - badges.tsx               — RevisionBadge, TipoCobBadge, TablaVacia
 *   - DetalleModal.tsx         — Drawer detalle por colaborador
 *                                (resumen, día a día, historial)
 *   - CierreModal.tsx          — Modal de cierre de período + validaciones
 *   - AnexoHorasExtra.tsx      — Tab anexo de horas extra
 *   - AnexoFaltas.tsx          — Tab anexo de faltas/suspensiones
 *   - AnexoAnticipos.tsx       — Tab anexo de anticipos
 *   - AnexoCoberturas.tsx      — Tab anexo de coberturas/relevos
 *
 * Este archivo se queda como orquestador: filtros, tabla maestra,
 * KPIs y enrutado de tabs. Los cálculos (uniformes/barracas/seguros/
 * IGSS/provisiones) viven en `helpers.calcularTotalEstimado` para
 * mantenerlos en un solo lugar y compartidos entre tabla y modales.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Download, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Eye, Loader2,
  Users, Briefcase, TrendingUp, Wallet, Info,
  AlertTriangle, FileText, CreditCard, Repeat2,
  Lock, Unlock, ShieldCheck, AlertOctagon, CheckCheck,
  XCircle, X,
} from "lucide-react";

import {
  BASE,
  apiRequest,
  fmtFecha,
  fmtQ,
  getPeriodPresets,
  getSession,
  calcularTotalEstimado,
} from "./pre-planilla/helpers";
import { RevisionBadge, TablaVacia } from "./pre-planilla/badges";
import { DetalleModal } from "./pre-planilla/DetalleModal";
import { CierreModal } from "./pre-planilla/CierreModal";
import { AnexoHorasExtra } from "./pre-planilla/AnexoHorasExtra";
import { AnexoFaltas } from "./pre-planilla/AnexoFaltas";
import { AnexoAnticipos } from "./pre-planilla/AnexoAnticipos";
import { AnexoCoberturas } from "./pre-planilla/AnexoCoberturas";
import { FeriadosTrabajados } from "./pre-planilla/FeriadosTrabajados";
import type { ColaboradorPre, Tab, Validacion } from "./pre-planilla/types";

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
  const [filtroTipoPersonal, setFiltroTipoPersonal] = useState("todos");
  const [soloConFaltas, setSoloConFaltas] = useState(false);
  const [soloConAnticipos, setSoloConAnticipos] = useState(false);
  const [soloConIncentivos, setSoloConIncentivos] = useState(false);
  const [soloConHE, setSoloConHE] = useState(false);
  const [soloRevisar, setSoloRevisar] = useState(false);

  // Ordenamiento
  const [sortField, setSortField] = useState<keyof ColaboradorPre>("nombre_completo");
  const [sortAsc, setSortAsc] = useState(true);

  // Validación automática
  const [validacion, setValidacion] = useState<Validacion | null>(null);
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
      const data = await apiRequest<ColaboradorPre[]>(`/api/nomina/pre-planilla?desde=${d}&hasta=${h}`);
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
      const data = await apiRequest<Validacion>(`/api/nomina/pre-planilla/validacion?desde=${desde}&hasta=${hasta}`);
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
    if (filtroTipoPersonal !== "todos") data = data.filter((r) => (r.tipo_personal ?? "guardia") === filtroTipoPersonal);
    if (soloConFaltas) data = data.filter((r) => Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.faltas_pendientes_rrhh) > 0);
    if (soloConAnticipos) data = data.filter((r) => r.anticipos_count > 0);
    if (soloConIncentivos) data = data.filter((r) => Number(r.incentivos_cash_count) > 0);
    if (soloConHE) data = data.filter((r) => parseFloat(r.horas_extra || "0") > 0);
    if (soloRevisar) data = data.filter((r) =>
      r.revision_estado === "pendiente" && (Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.dias_sin_horas) > 0 || r.anticipos_count > 0 || Number(r.faltas_pendientes_rrhh) > 0)
    );

    data.sort((a, b) => {
      const va = a[sortField] ?? ""; const vb = b[sortField] ?? "";
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb), "es") : String(vb).localeCompare(String(va), "es");
    });
    return data;
  }, [rows, busqueda, filtroCliente, filtroSede, filtroEstado, filtroRevision, filtroTipoPersonal,
      soloConFaltas, soloConAnticipos, soloConIncentivos, soloConHE, soloRevisar, sortField, sortAsc]);

  // KPIs globales
  const totalColabs = filtrados.length;
  const totalFaltas = filtrados.reduce((s, r) => s + Number(r.faltas) + Number(r.suspensiones), 0);
  const totalHE = filtrados.reduce((s, r) => s + parseFloat(r.horas_extra || "0"), 0);
  const totalAnt = filtrados.reduce((s, r) => s + Number(r.anticipos_monto), 0);
  const totalIncentivos = filtrados.reduce((s, r) => s + Number(r.incentivos_cash_monto), 0);
  const conAlertas = filtrados.filter((r) => Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.dias_sin_horas) > 0 || Number(r.faltas_pendientes_rrhh) > 0).length;
  const totalRelevos = filtrados.reduce((s, r) => s + Number(r.relevos), 0);
  const estimadosPorEmp = filtrados.map((r) => ({ r, e: calcularTotalEstimado(r, periodoTotalDias, desde ? Number(desde.slice(0, 4)) : new Date().getFullYear()) }));
  const totalIGSS = estimadosPorEmp.reduce((s, { r, e }) => s + (r.aplica_igss ? (e?.igssLaboral ?? 0) : 0), 0);
  const totalISR = estimadosPorEmp.reduce((s, { e }) => s + (e?.isrQuincenal ?? 0), 0);
  const totalSueldoBase = filtrados.reduce((s, r) => s + Number(r.sueldo_base ?? 0), 0);
  const totalBonif = estimadosPorEmp.reduce((s, { e }) => s + (e?.totalBonifReal ?? 0), 0);
  const totalUniforme = filtrados.reduce((s, r) => s + Number(r.cuota_uniforme_monto ?? 0), 0);
  const totalBarraca = filtrados.reduce((s, r) => s + Number(r.barraca_monto ?? 0), 0);
  const totalSeguro = estimadosPorEmp.reduce((s, { e }) => s + (e?.seguroMonto ?? 0), 0);
  const totalAmonest = filtrados.reduce((s, r) => s + Number(r.amonestaciones_monto ?? 0), 0);
  const totalOtrosDesc = totalUniforme + totalBarraca + totalSeguro + totalAmonest;
  const totalGeneralReal = estimadosPorEmp.reduce((s, { e }) => s + (e?.totalReal ?? 0), 0);
  const totalGeneralEst = estimadosPorEmp.reduce((s, { e }) => s + (e?.total ?? 0), 0);

  // Badges de tab
  const badgeHE = rows.filter((r) => parseFloat(r.horas_extra || "0") > 0).length;
  const badgeFaltas = rows.filter((r) => Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.faltas_pendientes_rrhh) > 0).length;
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
    { id: "feriados",    label: "Feriados trab.",    icon: Calendar },
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
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
                      <Lock className="w-3.5 h-3.5" />Período cerrado
                    </span>
                    <button onClick={async () => {
                      if (!confirm("¿Reabrir el período? Podrás editar y volver a cerrar.")) return;
                      try {
                        await apiRequest("/api/nomina/pre-planilla/reabrir", { method: "POST", json: { desde, hasta, usuario: "admin" } });
                        toast({ title: "Período reabierto" });
                        cargar(desde, hasta);
                      } catch (e: unknown) { toast({ title: "Error", description: (e as Error).message, variant: "destructive" }); }
                    }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-400 text-xs font-semibold hover:bg-amber-600/30 transition-colors">
                      <Unlock className="w-3.5 h-3.5" />Reabrir
                    </button>
                  </div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3">
              {[
                { icon: Users,         label: "Colaboradores",  val: totalColabs,               cls: "text-white" },
                { icon: AlertTriangle, label: "Faltas / Susp.", val: totalFaltas,               cls: totalFaltas > 0 ? "text-red-400" : "text-white/30" },
                { icon: TrendingUp,    label: "Horas extra",    val: `${totalHE.toFixed(1)} h`, cls: totalHE > 0 ? "text-orange-400" : "text-white/30" },
                { icon: Repeat2,       label: "Relevos",        val: totalRelevos,              cls: totalRelevos > 0 ? "text-purple-400" : "text-white/30" },
                { icon: Wallet,        label: "Incentivos Cash",val: fmtQ(totalIncentivos),     cls: totalIncentivos > 0 ? "text-emerald-400" : "text-white/30" },
                { icon: CreditCard,    label: "Total anticipos",val: fmtQ(totalAnt),            cls: totalAnt > 0 ? "text-amber-400" : "text-white/30" },
                { icon: ShieldCheck,   label: "IGSS laboral",   val: fmtQ(totalIGSS),           cls: totalIGSS > 0 ? "text-cyan-400" : "text-white/30" },
                { icon: FileText,      label: "ISR total",      val: fmtQ(totalISR),            cls: totalISR > 0 ? "text-amber-400" : "text-white/30" },
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
                (validacion?.resumen?.errores ?? 0) > 0 ? "bg-red-500/5 border-red-500/30" :
                (validacion?.resumen?.alertas ?? 0) > 0 ? "bg-amber-500/5 border-amber-500/25" :
                "bg-green-500/5 border-green-500/25"
              }`}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
                  {validacionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                  ) : validacion?.periodo_cerrado ? (
                    <Lock className="w-4 h-4 text-primary" />
                  ) : (validacion?.resumen?.errores ?? 0) > 0 ? (
                    <AlertOctagon className="w-4 h-4 text-red-400" />
                  ) : (validacion?.resumen?.alertas ?? 0) > 0 ? (
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
                      <select value={filtroTipoPersonal} onChange={(e) => setFiltroTipoPersonal(e.target.value)}
                        className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none">
                        <option value="todos">Todo tipo</option>
                        <option value="guardia">Guardia</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="jefe_servicio">Jefe Servicio</option>
                        <option value="administrativo_bodega">Bodega</option>
                        <option value="administrativo_rrhh">RRHH</option>
                        <option value="gerencia">Gerencia</option>
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
                            {th("Vacac.", "dias_vacaciones")}
                            {th("Faltas", "faltas")}
                            {th("Susp.", "suspensiones")}
                            {th("H. Trab.", "horas_trabajadas")}
                            {th("H. Extra", "horas_extra")}
                            <th className="text-left text-[10px] text-emerald-300/70 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap" title="Bonificación incentivo + Bonif 1/2/3 (proporcional a días trabajados)">Bonif.</th>
                            {th("Anticipo", "anticipos_monto")}
                            <th className="text-left text-[10px] text-rose-300/70 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap" title="Cuota uniforme + Barraca + Seguro de vida + Amonestaciones">Otros Desc.</th>
                            {th("Total Est.", "sueldo_base")}
                            {th("IGSS", "aplica_igss")}
                            <th className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">ISR</th>
                            {th("Freq.", "frecuencia_pago")}
                            {th("Revisión", "revision_estado")}
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/4">
                          {filtrados.map((r) => {
                            const heNum2 = parseFloat(r.horas_extra || "0");
                            const tieneAlerta = Number(r.faltas) > 0 || Number(r.suspensiones) > 0 || Number(r.dias_sin_horas) > 0 || Number(r.faltas_pendientes_rrhh) > 0;
                            const needsReview = tieneAlerta && r.revision_estado === "pendiente";
                            const est2 = calcularTotalEstimado(r, periodoTotalDias, desde ? Number(desde.slice(0, 4)) : new Date().getFullYear());

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
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-semibold text-white">{r.nombre_completo}</p>
                                        {(r.tipo_personal ?? "guardia") !== "guardia" && (
                                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                                            r.tipo_personal === "supervisor"
                                              ? "text-violet-300 bg-violet-500/10 border-violet-500/20"
                                              : "text-amber-300 bg-amber-500/10 border-amber-500/20"
                                          }`}>
                                            {r.tipo_personal === "supervisor" ? "SUPERVISOR" : "ADMIN"}
                                          </span>
                                        )}
                                      </div>
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
                                {/* Días pagados (cerrados - descuento) */}
                                <td className="px-3 py-2.5 text-center">
                                  {(() => {
                                    const cerr = Number(r.dias_cerrados);
                                    const desc = Number(r.total_dias_descuento ?? 0);
                                    const ant = Number(r.dias_descuento_anticipados ?? 0);
                                    const pagados = Math.max(cerr - desc, 0);
                                    return <>
                                      <span className={desc > 0 ? "text-amber-400 font-semibold" : "text-green-400 font-semibold"}>{pagados}</span>
                                      <span className="text-white/25 ml-1">/{cerr}d</span>
                                      {periodoTotalDias != null && cerr < periodoTotalDias && (
                                        <p className="text-[9px] text-white/20">de {periodoTotalDias}d</p>
                                      )}
                                      {ant > 0 && (
                                        <p className="text-[9px] text-purple-400/80"
                                          title={`Descuento por días pagados por adelantado la quincena anterior en los que faltó: ${(r.ajuste_anticipado_detalle ?? []).map(d => `${d.fecha} (−${d.dias})`).join(", ")}`}>
                                          −{ant}d quinc. ant.
                                        </p>
                                      )}
                                    </>;
                                  })()}
                                </td>
                                {/* Vacaciones (días de goce en el período, aparte de los trabajados) */}
                                <td className="px-3 py-2.5 text-center">
                                  {Number(r.dias_vacaciones ?? 0) > 0
                                    ? <span className="text-sky-400 font-semibold">{Number(r.dias_vacaciones)}<span className="text-white/25 text-[10px] ml-0.5">d</span></span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                {/* Faltas */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={Number(r.faltas) > 0 ? "text-red-400 font-bold" : "text-white/20"}>{Number(r.faltas)}</span>
                                  {Number(r.faltas_pendientes_rrhh) > 0 && (
                                    <p className="text-[9px] text-amber-400/70" title="Pendiente resolución RRHH">
                                      +{Number(r.faltas_pendientes_rrhh)} pend.
                                    </p>
                                  )}
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
                                  {parseFloat((r as any).horas_extra_pendientes || "0") > 0 && (
                                    <p className="text-[9px] text-yellow-400/60" title="Pendiente aprobación RRHH">
                                      +{parseFloat((r as any).horas_extra_pendientes).toFixed(1)}h pend.
                                    </p>
                                  )}
                                </td>
                                {/* Bonificaciones (incentivo + 1/2/3) */}
                                <td className="px-3 py-2.5 text-right">
                                  {est2 != null && est2.totalBonifReal > 0 ? (
                                    <span className="text-emerald-300 font-semibold"
                                      title={[
                                        est2.bonIncentivoReal > 0 ? `Incentivo: ${fmtQ(est2.bonIncentivoReal)}` : "",
                                        est2.bon1Real > 0 ? `Bonif 1: ${fmtQ(est2.bon1Real)}` : "",
                                        est2.bon2Real > 0 ? `Bonif 2: ${fmtQ(est2.bon2Real)}` : "",
                                        est2.bon3Real > 0 ? `Bonif 3: ${fmtQ(est2.bon3Real)}` : "",
                                        `(${est2.diasTrabReal}d trab.)`,
                                      ].filter(Boolean).join("\n")}>
                                      {fmtQ(est2.totalBonifReal)}
                                    </span>
                                  ) : <span className="text-white/20">—</span>}
                                </td>
                                {/* Anticipo */}
                                <td className="px-3 py-2.5 text-right">
                                  {r.anticipos_count > 0
                                    ? <span className="text-amber-400 font-semibold">{fmtQ(r.anticipos_monto)}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                {/* Otros descuentos: uniforme + barraca + seguro + amonestaciones */}
                                <td className="px-3 py-2.5 text-right">
                                  {(() => {
                                    const uni = Number(r.cuota_uniforme_monto ?? 0);
                                    const bar = Number(r.barraca_monto ?? 0);
                                    const seg = est2?.seguroMonto ?? 0;
                                    const amon = Number(r.amonestaciones_monto ?? 0);
                                    const sum = uni + bar + seg + amon;
                                    if (sum <= 0) return <span className="text-white/20">—</span>;
                                    return (
                                      <span className="text-rose-300 font-semibold"
                                        title={[
                                          uni > 0 ? `Uniforme: ${fmtQ(uni)}` : "",
                                          bar > 0 ? `Barraca${r.barraca_nombre ? ` (${r.barraca_nombre})` : ""}: ${fmtQ(bar)}` : "",
                                          seg > 0 ? `Seguro vida: ${fmtQ(seg)}` : "",
                                          amon > 0 ? `Amonestaciones${Number(r.amonestaciones_count ?? 0) > 0 ? ` (${r.amonestaciones_count})` : ""}: ${fmtQ(amon)}` : "",
                                        ].filter(Boolean).join("\n")}>
                                        {fmtQ(sum)}
                                      </span>
                                    );
                                  })()}
                                </td>
                                {/* Total estimado */}
                                <td className="px-3 py-2.5 text-right">
                                  {est2 != null ? (
                                    <div>
                                      <span className={`font-bold ${est2.totalReal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {fmtQ(est2.totalReal)}
                                      </span>
                                      {est2.diasCerrados < (periodoTotalDias ?? 0) && (
                                        <p className="text-[9px] text-white/30 mt-0.5" title={`Estimado ${periodoTotalDias}d: ${fmtQ(est2.total)}`}>
                                          est. {fmtQ(est2.total)}
                                        </p>
                                      )}
                                      {(est2.descFaltas > 0 || est2.valorHE > 0) && (
                                        <p className="text-[9px] text-white/25 mt-0.5">
                                          {est2.descFaltas > 0 ? `-${fmtQ(est2.descFaltas)} (${est2.diasDesc}d) ` : ""}
                                          {est2.valorHE > 0 ? `+${fmtQ(est2.valorHE)} HE` : ""}
                                        </p>
                                      )}
                                    </div>
                                  ) : <span className="text-white/20">—</span>}
                                </td>
                                {/* IGSS */}
                                <td className="px-3 py-2.5 text-right">
                                  {r.aplica_igss && est2 ? (
                                    <div>
                                      <span className="text-xs font-medium text-emerald-400">
                                        {fmtQ(est2.igssLaboral)}
                                      </span>
                                      <p className="text-[9px] text-white/25">4.83%</p>
                                    </div>
                                  ) : r.aplica_igss ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Sí
                                    </span>
                                  ) : (
                                    <span className="text-white/20 text-[10px]">—</span>
                                  )}
                                </td>
                                {/* ISR */}
                                <td className="px-3 py-2.5 text-right">
                                  {est2 && est2.isrQuincenal > 0 ? (
                                    <div>
                                      <span className="text-xs font-medium text-amber-400">
                                        {fmtQ(est2.isrQuincenal)}
                                      </span>
                                      <p className="text-[9px] text-white/25">quincenal</p>
                                    </div>
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
                        <tfoot className="bg-[#060e1c] border-t-2 border-primary/30 sticky bottom-0">
                          <tr className="font-bold">
                            <td colSpan={5} className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-white/60">
                              Totales ({filtrados.length} colab.)
                            </td>
                            <td className="px-3 py-2.5 text-right text-white/80">{fmtQ(totalSueldoBase)}</td>
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5 text-center text-red-400">
                              {filtrados.reduce((s, r) => s + Number(r.faltas), 0)}
                            </td>
                            <td className="px-3 py-2.5 text-center text-amber-400">
                              {filtrados.reduce((s, r) => s + Number(r.suspensiones), 0)}
                            </td>
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5 text-right text-orange-400">{totalHE.toFixed(1)} h</td>
                            <td className="px-3 py-2.5 text-right text-emerald-300">{totalBonif > 0 ? `+${fmtQ(totalBonif)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-amber-400">{totalAnt > 0 ? `–${fmtQ(totalAnt)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-rose-300"
                              title={`Uniforme: ${fmtQ(totalUniforme)}\nBarraca: ${fmtQ(totalBarraca)}\nSeguro: ${fmtQ(totalSeguro)}\nAmonestaciones: ${fmtQ(totalAmonest)}`}>
                              {totalOtrosDesc > 0 ? `–${fmtQ(totalOtrosDesc)}` : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div>
                                <span className={`text-sm ${totalGeneralReal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {fmtQ(totalGeneralReal)}
                                </span>
                                {totalGeneralEst !== totalGeneralReal && (
                                  <p className="text-[9px] font-normal text-white/30 mt-0.5"
                                    title={`Proyección a ${periodoTotalDias}d`}>
                                    est. {fmtQ(totalGeneralEst)}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-cyan-400">{totalIGSS > 0 ? `–${fmtQ(totalIGSS)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-amber-400">{totalISR > 0 ? `–${fmtQ(totalISR)}` : "—"}</td>
                            <td colSpan={3} className="px-3 py-2.5" />
                          </tr>
                        </tfoot>
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

              {activeTab === "feriados" && <FeriadosTrabajados desde={desde} hasta={hasta} />}
            </div>

            {/* ── Nota informativa ──────────────────────────────────────── */}
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-300 mb-1">Pre-planilla operativa — estimación indicativa</p>
                  <p className="text-[11px] text-blue-300/60 leading-relaxed">
                    <strong className="text-blue-300/80">Total Estimado Preliminar</strong> = sueldo proporcional al período – descuento por faltas/suspensiones + valor horas extra (1.5x) – anticipos – IGSS laboral (4.83%).
                    <br />
                    <strong className="text-blue-300/80">Pendiente para planilla final:</strong> bonificación incentivo (Dto. 78-89), séptimo día remunerado, y deducciones legales finales.
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
