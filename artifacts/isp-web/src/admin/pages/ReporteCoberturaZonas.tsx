/**
 * ReporteCoberturaZonas.tsx
 * Reporte de cobertura operativa por zona global con soporte de períodos.
 * Permite analizar titulares, relevos, descubiertos y HE por zona/cliente/sede.
 */

import { useState, useCallback } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { IspPdf } from "@/lib/pdfExport";
import {
  Map, Calendar, Building2, Loader2, RefreshCw,
  FileText, FileDown, ChevronDown, ChevronRight,
  X, Shield, Users, Clock, TrendingUp, AlertTriangle,
  CheckCircle2, UserX, Zap, Filter, User,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Periodo {
  desde: string;
  hasta: string;
  dias: number;
}

interface GlobalStats {
  total_registros: string;
  total_puestos: string;
  total_clientes: string;
  total_sedes: string;
  total_zonas: string;
  cubiertos_titular: string;
  cubiertos_relevo: string;
  descubiertos: string;
  horas_trabajadas: string;
  horas_extra: string;
}

interface ZonaSummary {
  zona_id: number | null;
  zona_nombre: string;
  supervisor_employee_id: number | null;
  supervisor_nombre: string | null;
  total_puestos: string;
  total_clientes: string;
  total_sedes: string;
  cubiertos_titular: string;
  cubiertos_relevo: string;
  descubiertos: string;
  horas_trabajadas: string;
  horas_extra: string;
}

interface Detalle {
  id: number;
  fecha: string;
  puesto_id: number;
  puesto_nombre: string;
  cliente_id: number | null;
  cliente_nombre: string;
  sede_id: number | null;
  sede_nombre: string | null;
  titular_employee_id: number | null;
  titular_nombre: string | null;
  cobertura_employee_id: number | null;
  cobertura_nombre: string | null;
  tipo_cobertura: string;
  motivo: string | null;
  horas_trabajadas: string | null;
  horas_extra: string | null;
  observaciones: string | null;
  zona_id: number | null;
  zona_nombre: string | null;
  supervisor_nombre: string | null;
  tipo_servicio: string | null;
  turno: string | null;
  jornada: string | null;
  horario: string | null;
}

interface ReporteData {
  periodo: Periodo;
  globalStats: GlobalStats;
  zonaSummaries: ZonaSummary[];
  detalles: Detalle[];
  zonasDisponibles: { id: number; nombre: string }[];
  clientesDisponibles: { id: number; nombre: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const h = () => ({ "x-isp-session": getSession() });

function fmtNum(n: unknown) {
  const v = parseFloat(String(n ?? 0));
  return isNaN(v) ? "0" : v.toLocaleString("es-GT");
}

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch { return iso; }
}

function tipoBadge(tipo: string) {
  switch (tipo) {
    case "titular":             return <span className="text-[9px] font-semibold text-green-400/80 bg-green-500/10 border border-green-500/15 px-1.5 py-0.5 rounded-full">Titular</span>;
    case "relevo":              return <span className="text-[9px] font-semibold text-amber-400/80 bg-amber-500/10 border border-amber-500/15 px-1.5 py-0.5 rounded-full">Relevo</span>;
    case "ausencia_sin_cubrir": return <span className="text-[9px] font-semibold text-red-400/80 bg-red-500/10 border border-red-500/15 px-1.5 py-0.5 rounded-full">Descubierto</span>;
    default:                    return <span className="text-[9px] font-semibold text-white/30 bg-white/4 border border-white/10 px-1.5 py-0.5 rounded-full">{tipo}</span>;
  }
}

// ─── Selector de período ──────────────────────────────────────────────────────

type Preset = "hoy" | "ayer" | "7dias" | "15dias" | "este_mes" | "mes_anterior" | "este_ano" | "personalizado";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "hoy",          label: "Hoy" },
  { id: "ayer",         label: "Ayer" },
  { id: "7dias",        label: "Últimos 7 días" },
  { id: "15dias",       label: "Últimos 15 días" },
  { id: "este_mes",     label: "Este mes" },
  { id: "mes_anterior", label: "Mes anterior" },
  { id: "este_ano",     label: "Este año" },
  { id: "personalizado",label: "Personalizado" },
];

function getDesdeHasta(preset: Preset, customDesde: string, customHasta: string): [string, string] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = iso(now);
  switch (preset) {
    case "hoy":           return [today, today];
    case "ayer": {
      const y = new Date(now); y.setDate(y.getDate()-1);
      const yd = iso(y); return [yd, yd];
    }
    case "7dias": {
      const d = new Date(now); d.setDate(d.getDate()-6);
      return [iso(d), today];
    }
    case "15dias": {
      const d = new Date(now); d.setDate(d.getDate()-14);
      return [iso(d), today];
    }
    case "este_mes":
      return [`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, today];
    case "mes_anterior": {
      const pm = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const ul = new Date(now.getFullYear(), now.getMonth(), 0);
      return [iso(pm), iso(ul)];
    }
    case "este_ano":
      return [`${now.getFullYear()}-01-01`, today];
    case "personalizado":
      return [customDesde || today, customHasta || today];
    default: return [today, today];
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReporteCoberturaZonas() {
  const [preset, setPreset]             = useState<Preset>("hoy");
  const [customDesde, setCustomDesde]   = useState("");
  const [customHasta, setCustomHasta]   = useState("");
  const [filtroZona, setFiltroZona]     = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroTipo, setFiltroTipo]     = useState("");
  const [data, setData]                 = useState<ReporteData | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [zonasExpandidas, setZonasExpandidas] = useState<Set<string>>(new Set());

  const [desde, hasta] = getDesdeHasta(preset, customDesde, customHasta);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ desde, hasta });
      if (filtroZona)    params.set("zona_id", filtroZona);
      if (filtroCliente) params.set("cliente_id", filtroCliente);
      if (filtroTipo)    params.set("tipo_cobertura", filtroTipo);
      const r = await fetch(`${API}/reportes/cobertura-zonas?${params}`, { headers: h() });
      if (!r.ok) throw new Error(await r.text());
      const json = await r.json();
      setData(json);
      // Expandir todas las zonas por default
      const ids = new Set<string>(json.zonaSummaries.map((z: ZonaSummary) => String(z.zona_id ?? "sin-zona")));
      setZonasExpandidas(ids);
    } catch {
      setError("Error al cargar el reporte. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, filtroZona, filtroCliente, filtroTipo]);

  // ── Agrupar detalles por zona > cliente > sede ──────────────────────────────
  type PorZona = Record<string, {
    zona: ZonaSummary;
    porCliente: Record<string, {
      clienteNombre: string;
      porSede: Record<string, { sedeNombre: string; filas: Detalle[] }>;
    }>;
  }>;

  const porZona: PorZona = {};
  if (data) {
    const zonasMap: Record<string, ZonaSummary> = {};
    data.zonaSummaries.forEach((z) => { zonasMap[String(z.zona_id ?? "sin-zona")] = z; });

    data.detalles.forEach((d) => {
      const zk = String(d.zona_id ?? "sin-zona");
      const ck = String(d.cliente_id ?? d.cliente_nombre);
      const sk = String(d.sede_id ?? "sin-sede");

      if (!porZona[zk]) {
        porZona[zk] = {
          zona: zonasMap[zk] ?? { zona_nombre: d.zona_nombre ?? "Sin zona", zona_id: d.zona_id } as ZonaSummary,
          porCliente: {},
        };
      }
      if (!porZona[zk].porCliente[ck]) {
        porZona[zk].porCliente[ck] = { clienteNombre: d.cliente_nombre, porSede: {} };
      }
      if (!porZona[zk].porCliente[ck].porSede[sk]) {
        porZona[zk].porCliente[ck].porSede[sk] = { sedeNombre: d.sede_nombre ?? "Sin sede", filas: [] };
      }
      porZona[zk].porCliente[ck].porSede[sk].filas.push(d);
    });
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────
  function exportCsv() {
    if (!data) return;
    const headers = [
      "Fecha", "Zona", "Supervisor", "Cliente", "Sede", "Puesto",
      "Tipo Servicio", "Turno", "Jornada", "Horario",
      "Titular esperado", "Colaborador real", "Tipo cobertura",
      "Motivo", "Horas trabajadas", "Horas extra", "Observaciones"
    ];
    const rows = data.detalles.map((d) => [
      d.fecha, d.zona_nombre ?? "Sin zona", d.supervisor_nombre ?? "",
      d.cliente_nombre, d.sede_nombre ?? "", d.puesto_nombre,
      d.tipo_servicio ?? "", d.turno ?? "", d.jornada ?? "", d.horario ?? "",
      d.titular_nombre ?? "", d.cobertura_nombre ?? "", d.tipo_cobertura,
      d.motivo ?? "", d.horas_trabajadas ?? "", d.horas_extra ?? "",
      (d.observaciones ?? "").replace(/,/g, ";"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobertura-zonas-${desde}-${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF Export ──────────────────────────────────────────────────────────────
  async function exportPdf() {
    if (!data) return;
    setPdfLoading(true);
    try {
      const gs = data.globalStats;
      const totalCubiertos = parseInt(gs.cubiertos_titular) + parseInt(gs.cubiertos_relevo);
      const total = parseInt(gs.total_registros) || 1;
      const cobPct = Math.round((totalCubiertos / total) * 100);

      const pdf = await new IspPdf({
        titulo: "Reporte de Cobertura por Zona Operativa",
        subtitulo: `Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)} (${data.periodo.dias} días)`,
        desde,
        hasta,
      }).build();

      pdf.addSeccionTitulo("RESUMEN EJECUTIVO");
      pdf.addResumenCards([
        { label: "Registros",       valor: fmtNum(gs.total_registros),   color: "blue" },
        { label: "Puestos únicos",  valor: fmtNum(gs.total_puestos),     color: "gray" },
        { label: "Zonas activas",   valor: fmtNum(gs.total_zonas),       color: "blue" },
        { label: "Cobertura",       valor: `${cobPct}%`,                 color: cobPct >= 80 ? "green" : cobPct >= 60 ? "yellow" : "red" },
      ]);
      pdf.addResumenCards([
        { label: "Titular",         valor: fmtNum(gs.cubiertos_titular), color: "green" },
        { label: "Relevo",          valor: fmtNum(gs.cubiertos_relevo),  color: "yellow" },
        { label: "Descubiertos",    valor: fmtNum(gs.descubiertos),      color: "red" },
        { label: "Horas extra",     valor: parseFloat(gs.horas_extra).toFixed(1), color: "yellow" },
      ]);
      pdf.addTextoResumen(
        `El reporte consolida ${fmtNum(gs.total_registros)} registros de cobertura operativa en ${data.periodo.dias} día(s), ` +
        `abarcando ${fmtNum(gs.total_zonas)} zona(s), ${fmtNum(gs.total_clientes)} cliente(s) y ${fmtNum(gs.total_puestos)} puesto(s) únicos. ` +
        `La cobertura global del período es de ${cobPct}% (${fmtNum(gs.cubiertos_titular)} titular + ${fmtNum(gs.cubiertos_relevo)} relevo).`
      );

      // Tabla por zona
      pdf.addSeccionTitulo("RESUMEN POR ZONA OPERATIVA");
      pdf.addTabla(
        ["Zona", "Supervisor", "Puestos", "Clientes", "Titular", "Relevo", "Desc.", "HE"],
        data.zonaSummaries.map((z) => [
          z.zona_nombre,
          z.supervisor_nombre ?? "—",
          z.total_puestos,
          z.total_clientes,
          z.cubiertos_titular,
          z.cubiertos_relevo,
          z.descubiertos,
          parseFloat(z.horas_extra).toFixed(1),
        ])
      );

      // Tabla detalle (limitada a 500 filas para PDF manejable)
      pdf.addSeccionTitulo("DETALLE DE COBERTURA");
      if (data.detalles.length <= 500) {
        pdf.addTabla(
          ["Fecha", "Zona", "Cliente", "Puesto", "Titular", "Cubrió", "Tipo", "Motivo", "HE"],
          data.detalles.map((d) => [
            fmtFecha(d.fecha),
            (d.zona_nombre ?? "Sin zona").substring(0, 15),
            d.cliente_nombre.substring(0, 12),
            d.puesto_nombre.substring(0, 18),
            (d.titular_nombre ?? "—").substring(0, 14),
            (d.cobertura_nombre ?? "—").substring(0, 14),
            d.tipo_cobertura === "ausencia_sin_cubrir" ? "Desc." : d.tipo_cobertura === "relevo" ? "Relevo" : "Titular",
            (d.motivo ?? "—").substring(0, 10),
            parseFloat(d.horas_extra ?? "0").toFixed(1),
          ])
        );
      } else {
        pdf.addTextoResumen(
          `El período contiene ${data.detalles.length} registros. Para el detalle completo use la exportación CSV.`
        );
      }

      pdf.save(`cobertura-zonas-${desde}-${hasta}.pdf`);
    } catch (e) {
      console.error("PDF error:", e);
    } finally {
      setPdfLoading(false);
    }
  }

  const gs = data?.globalStats;
  const totalCubiertos = gs ? parseInt(gs.cubiertos_titular) + parseInt(gs.cubiertos_relevo) : 0;
  const totalRegistros = gs ? parseInt(gs.total_registros) : 0;
  const coberturaGlobal = totalRegistros > 0 ? Math.round((totalCubiertos / totalRegistros) * 100) : 0;

  return (
    <AdminLayout title="Reporte de Cobertura por Zona">
      <div className="p-5 space-y-4 max-w-7xl mx-auto">

        {/* Encabezado */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold text-white">Reporte Cobertura por Zona Operativa</h1>
          </div>
          <div className="flex-1" />
          <a
            href="/admin/reportes"
            className="text-xs text-white/30 hover:text-white transition-colors"
          >
            ← Módulo Reportes
          </a>
          <a
            href="/admin/operaciones/zonas"
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors"
          >
            <Map className="w-3.5 h-3.5" /> Gestionar zonas
          </a>
        </div>

        {/* ── Selector de período ─────────────────────────────────────────── */}
        <div className="bg-[#07111f] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Período de análisis</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  preset === p.id
                    ? "bg-primary text-[#07111f] border-primary font-semibold"
                    : "bg-white/4 border-white/8 text-white/50 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "personalizado" && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/30 uppercase tracking-widest">Desde</label>
                <input
                  type="date"
                  value={customDesde}
                  onChange={(e) => setCustomDesde(e.target.value)}
                  className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-white/30 uppercase tracking-widest">Hasta</label>
                <input
                  type="date"
                  value={customHasta}
                  onChange={(e) => setCustomHasta(e.target.value)}
                  className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40"
                />
              </div>
            </div>
          )}

          <div className="text-[10px] text-white/25">
            Rango seleccionado: <span className="text-white/50">{fmtFecha(desde)}</span>
            {desde !== hasta && <> — <span className="text-white/50">{fmtFecha(hasta)}</span></>}
            {data && <span className="ml-2 text-primary/50">({data.periodo.dias} día{data.periodo.dias !== 1 ? "s" : ""})</span>}
          </div>
        </div>

        {/* ── Filtros adicionales ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-white/20 shrink-0" />
          {/* Zona */}
          <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-2 py-1.5">
            <Map className="w-3 h-3 text-white/20" />
            <select
              value={filtroZona}
              onChange={(e) => setFiltroZona(e.target.value)}
              className="bg-transparent text-xs text-white/60 outline-none"
            >
              <option value="">Todas las zonas</option>
              {(data?.zonasDisponibles ?? []).map((z) => (
                <option key={z.id} value={z.id}>{z.nombre}</option>
              ))}
            </select>
          </div>
          {/* Cliente */}
          <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-2 py-1.5">
            <Building2 className="w-3 h-3 text-white/20" />
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="bg-transparent text-xs text-white/60 outline-none"
            >
              <option value="">Todos los clientes</option>
              {(data?.clientesDisponibles ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          {/* Tipo cobertura */}
          <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-2 py-1.5">
            <Shield className="w-3 h-3 text-white/20" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="bg-transparent text-xs text-white/60 outline-none"
            >
              <option value="">Todos los tipos</option>
              <option value="titular">Titular</option>
              <option value="relevo">Relevo</option>
              <option value="ausencia_sin_cubrir">Descubierto</option>
            </select>
          </div>
          {(filtroZona || filtroCliente || filtroTipo) && (
            <button
              onClick={() => { setFiltroZona(""); setFiltroCliente(""); setFiltroTipo(""); }}
              className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors px-2 py-1.5 border border-amber-500/15 rounded-xl"
            >
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
          <div className="flex-1" />
          {/* Botón generar */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#07111f] bg-primary hover:bg-primary/90 rounded-xl px-4 py-2 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? "Generando…" : "Generar reporte"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Estado vacío inicial */}
        {!data && !loading && !error && (
          <div className="bg-[#0a1525] border border-white/6 rounded-2xl p-10 text-center">
            <Map className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">Selecciona un período y presiona "Generar reporte"</p>
            <p className="text-xs text-white/15 mt-1">
              Los datos se toman de la cobertura operativa registrada por el equipo.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-white/40">Procesando datos del período…</span>
          </div>
        )}

        {/* ── Resultados ──────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="space-y-5">

            {/* ─── Encabezado de resultados + exportación ─── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-white/40">
                  {fmtFecha(data.periodo.desde)}
                  {data.periodo.desde !== data.periodo.hasta && ` — ${fmtFecha(data.periodo.hasta)}`}
                  {" · "}<span className="text-white/60 font-semibold">{data.periodo.dias} día{data.periodo.dias !== 1 ? "s" : ""}</span>
                  {" · "}<span className="text-white/60 font-semibold">{fmtNum(gs?.total_registros)} registros</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 text-xs text-green-400/80 hover:text-green-300 bg-green-500/8 hover:bg-green-500/15 border border-green-500/15 px-3 py-1.5 rounded-lg transition-all"
                >
                  <FileDown className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={exportPdf}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary bg-primary/8 hover:bg-primary/15 border border-primary/15 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                >
                  {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  PDF
                </button>
              </div>
            </div>

            {/* ─── Sin datos ─── */}
            {parseInt(gs?.total_registros ?? "0") === 0 && (
              <div className="bg-[#0a1525] border border-white/6 rounded-2xl p-8 text-center">
                <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/30">No hay registros de cobertura en este período</p>
                <p className="text-xs text-white/15 mt-1">
                  Los registros se crean al registrar cobertura diaria desde el pizarrón operativo.
                </p>
              </div>
            )}

            {/* ─── Stats globales ─── */}
            {gs && parseInt(gs.total_registros) > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {[
                    { label: "Registros",       value: gs.total_registros,  color: "text-white",       bg: "bg-white/4 border-white/8" },
                    { label: "Puestos únicos",  value: gs.total_puestos,    color: "text-blue-400",    bg: "bg-blue-500/6 border-blue-500/12" },
                    { label: "Zonas",           value: gs.total_zonas,      color: "text-primary",     bg: "bg-primary/6 border-primary/12" },
                    { label: "Clientes",        value: gs.total_clientes,   color: "text-purple-400",  bg: "bg-purple-500/6 border-purple-500/12" },
                    { label: "Titular",         value: gs.cubiertos_titular, color: "text-green-400",  bg: "bg-green-500/6 border-green-500/12" },
                    { label: "Relevo",          value: gs.cubiertos_relevo, color: "text-amber-400",   bg: "bg-amber-500/6 border-amber-500/12" },
                    { label: "Descubiertos",    value: gs.descubiertos,     color: "text-red-400",     bg: "bg-red-500/6 border-red-500/12" },
                    { label: "Horas extra",     value: parseFloat(gs.horas_extra).toFixed(1), color: "text-orange-400", bg: "bg-orange-500/6 border-orange-500/12" },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`border rounded-xl p-2.5 text-center ${bg}`}>
                      <p className={`text-lg font-bold leading-none ${color}`}>{fmtNum(value)}</p>
                      <p className="text-[9px] text-white/30 mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Barra de cobertura global */}
                <div className="bg-[#07111f] border border-white/8 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-white/40 font-semibold uppercase tracking-widest">Cobertura global del período</span>
                    <span className={`text-xs font-bold ${coberturaGlobal >= 80 ? "text-green-400" : coberturaGlobal >= 60 ? "text-amber-400" : "text-red-400"}`}>
                      {coberturaGlobal}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                    <div className="bg-green-400 h-full transition-all" style={{ width: `${Math.round((parseInt(gs.cubiertos_titular)/Math.max(totalRegistros,1))*100)}%` }} />
                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${Math.round((parseInt(gs.cubiertos_relevo)/Math.max(totalRegistros,1))*100)}%` }} />
                    <div className="bg-red-500 h-full transition-all" style={{ width: `${Math.round((parseInt(gs.descubiertos)/Math.max(totalRegistros,1))*100)}%` }} />
                  </div>
                  <div className="flex gap-4 mt-1.5 text-[9px] text-white/30">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Titular {gs.cubiertos_titular}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Relevo {gs.cubiertos_relevo}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Descubierto {gs.descubiertos}</span>
                  </div>
                </div>

                {/* ─── Tarjetas por zona ─── */}
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">
                    Resumen por zona operativa ({data.zonaSummaries.length})
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.zonaSummaries.map((z) => {
                      const total = parseInt(z.cubiertos_titular) + parseInt(z.cubiertos_relevo) + parseInt(z.descubiertos);
                      const cob = total > 0 ? Math.round(((parseInt(z.cubiertos_titular) + parseInt(z.cubiertos_relevo)) / total) * 100) : 0;
                      return (
                        <div key={z.zona_id ?? "sin-zona"} className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden">
                          <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                            <Map className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white">{z.zona_nombre}</p>
                              {z.supervisor_nombre && (
                                <p className="text-[10px] text-white/35 flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" /> {z.supervisor_nombre}
                                </p>
                              )}
                            </div>
                            <span className={`text-xs font-bold ${cob >= 80 ? "text-green-400" : cob >= 60 ? "text-amber-400" : "text-red-400"}`}>{cob}%</span>
                          </div>
                          <div className="px-4 pb-1">
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden flex">
                              <div className="bg-green-400 h-full" style={{ width: `${Math.round((parseInt(z.cubiertos_titular)/Math.max(total,1))*100)}%` }} />
                              <div className="bg-amber-400 h-full" style={{ width: `${Math.round((parseInt(z.cubiertos_relevo)/Math.max(total,1))*100)}%` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 border-t border-white/5 mt-1">
                            {[
                              { label: "Puestos",  value: z.total_puestos,       color: "text-white" },
                              { label: "Clientes", value: z.total_clientes,      color: "text-blue-400" },
                              { label: "HE",       value: parseFloat(z.horas_extra).toFixed(1), color: "text-orange-400" },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="py-2 text-center border-r border-white/5 last:border-r-0">
                                <p className={`text-sm font-bold ${color}`}>{fmtNum(value)}</p>
                                <p className="text-[8px] text-white/20">{label}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex border-t border-white/5 text-[9px] text-white/40">
                            <div className="flex-1 py-1.5 text-center text-green-400/70">✓ {z.cubiertos_titular} titular</div>
                            <div className="flex-1 py-1.5 text-center border-x border-white/5 text-amber-400/70">↻ {z.cubiertos_relevo} relevo</div>
                            <div className="flex-1 py-1.5 text-center text-red-400/70">✗ {z.descubiertos} desc.</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─── Tabla detallada agrupada ─── */}
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">
                    Detalle de cobertura — {fmtNum(data.detalles.length)} registros
                  </p>
                  <div className="space-y-3">
                    {Object.entries(porZona).map(([zk, zData]) => {
                      const expandida = zonasExpandidas.has(zk);
                      return (
                        <div key={zk} className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden">
                          {/* Header zona */}
                          <button
                            onClick={() => {
                              const next = new Set(zonasExpandidas);
                              if (next.has(zk)) next.delete(zk); else next.add(zk);
                              setZonasExpandidas(next);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
                          >
                            <Map className="w-3.5 h-3.5 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-bold text-white">{zData.zona.zona_nombre}</span>
                              {zData.zona.supervisor_nombre && (
                                <span className="ml-2 text-[10px] text-white/35">· {zData.zona.supervisor_nombre}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-white/30 bg-white/4 px-2 py-0.5 rounded-full">
                              {Object.keys(zData.porCliente).length} clientes · {Object.values(zData.porCliente).flatMap((c) => Object.values(c.porSede).flatMap((s) => s.filas)).length} registros
                            </span>
                            {expandida ? <ChevronDown className="w-3.5 h-3.5 text-white/25 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/25 shrink-0" />}
                          </button>

                          {expandida && (
                            <div className="border-t border-white/6">
                              {Object.entries(zData.porCliente).map(([ck, cData]) => (
                                <div key={ck} className="border-b border-white/4 last:border-b-0">
                                  {/* Header cliente */}
                                  <div className="flex items-center gap-2 px-5 py-2 bg-white/2">
                                    <Building2 className="w-3 h-3 text-blue-400/60 shrink-0" />
                                    <span className="text-[11px] font-semibold text-blue-300/70">{cData.clienteNombre}</span>
                                  </div>

                                  {Object.entries(cData.porSede).map(([sk, sData]) => (
                                    <div key={sk}>
                                      {/* Header sede */}
                                      {sData.sedeNombre !== "Sin sede" && (
                                        <div className="flex items-center gap-2 px-7 py-1.5 bg-white/1 border-t border-white/3">
                                          <span className="text-[10px] text-white/30 italic">{sData.sedeNombre}</span>
                                        </div>
                                      )}
                                      {/* Tabla de filas */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-[10px]">
                                          <thead>
                                            <tr className="border-b border-white/4">
                                              {data.periodo.dias > 1 && <th className="text-left px-4 py-1.5 text-white/25 font-medium">Fecha</th>}
                                              <th className="text-left px-4 py-1.5 text-white/25 font-medium">Puesto</th>
                                              <th className="text-left px-4 py-1.5 text-white/25 font-medium">Turno</th>
                                              <th className="text-left px-4 py-1.5 text-white/25 font-medium">Titular</th>
                                              <th className="text-left px-4 py-1.5 text-white/25 font-medium">Cubrió</th>
                                              <th className="text-left px-4 py-1.5 text-white/25 font-medium">Tipo</th>
                                              <th className="text-left px-4 py-1.5 text-white/25 font-medium">Motivo</th>
                                              <th className="text-right px-4 py-1.5 text-white/25 font-medium">HT</th>
                                              <th className="text-right px-4 py-1.5 text-white/25 font-medium">HE</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {sData.filas.map((fila) => (
                                              <tr key={fila.id} className="border-b border-white/3 last:border-b-0 hover:bg-white/2">
                                                {data.periodo.dias > 1 && (
                                                  <td className="px-4 py-2 text-white/40 whitespace-nowrap">{fmtFecha(fila.fecha)}</td>
                                                )}
                                                <td className="px-4 py-2 text-white/70 max-w-[120px]">
                                                  <p className="truncate">{fila.puesto_nombre}</p>
                                                  {fila.tipo_servicio && <p className="text-white/25 text-[9px]">{fila.tipo_servicio}</p>}
                                                </td>
                                                <td className="px-4 py-2 text-white/40 whitespace-nowrap">{fila.turno ?? fila.jornada ?? "—"}</td>
                                                <td className="px-4 py-2 text-white/50 max-w-[100px]">
                                                  <p className="truncate">{fila.titular_nombre ?? <span className="text-white/20 italic">—</span>}</p>
                                                </td>
                                                <td className="px-4 py-2 text-white/60 max-w-[100px]">
                                                  <p className="truncate">{fila.cobertura_nombre ?? <span className="text-white/20 italic">—</span>}</p>
                                                </td>
                                                <td className="px-4 py-2">{tipoBadge(fila.tipo_cobertura)}</td>
                                                <td className="px-4 py-2 text-white/35 max-w-[80px]">
                                                  <p className="truncate">{fila.motivo ?? "—"}</p>
                                                </td>
                                                <td className="px-4 py-2 text-right text-white/40">
                                                  {parseFloat(fila.horas_trabajadas ?? "0").toFixed(1)}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-semibold ${parseFloat(fila.horas_extra ?? "0") > 0 ? "text-orange-400" : "text-white/20"}`}>
                                                  {parseFloat(fila.horas_extra ?? "0").toFixed(1)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─── Base para costo de supervisión ─── */}
                <div className="bg-[#07111f] border border-primary/15 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest">Base para costo de supervisión</h3>
                    <span className="text-[9px] text-primary/50 bg-primary/8 border border-primary/15 px-2 py-0.5 rounded-full">Preparación</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Carga operativa del período</p>
                      <div className="space-y-1.5">
                        {data.zonaSummaries.map((z) => {
                          const total = parseInt(z.total_puestos);
                          const maxZonas = Math.max(...data.zonaSummaries.map((zz) => parseInt(zz.total_puestos)));
                          const pct = maxZonas > 0 ? Math.round((total / maxZonas) * 100) : 0;
                          return (
                            <div key={z.zona_id}>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-[10px] text-white/50">{z.zona_nombre}</span>
                                <span className="text-[10px] text-white/40">{total} puestos · {z.total_clientes} clientes</span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/50 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Estructura de costos (pendiente)</p>
                      <div className="space-y-1.5 text-[11px] text-white/30">
                        {[
                          "Salario supervisor → configurar en perfil de empleado",
                          "Distribución de costo → por cantidad de puestos/horas",
                          "Costo por cliente → proporcional a puestos en su zona",
                          "Margen por zona → requiere tarifa configurada en puesto",
                          "Rentabilidad → tarifa_puesto × días − costo operativo",
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-primary/40 mt-0.5">·</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-white/15 mt-2 border-t border-white/5 pt-2">
                        Para habilitar el cálculo completo, configura: salario del supervisor en Empleados, y tarifa_puesto en Ficha de Cliente → Puestos.
                      </p>
                    </div>
                  </div>
                </div>

              </>
            )}
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
