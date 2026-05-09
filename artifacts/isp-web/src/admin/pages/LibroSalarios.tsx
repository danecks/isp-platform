import { useState, useEffect, useRef } from "react";
import { BookOpen, Users, User, Search, Download, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "../layout/AdminLayout";
import { getSessionToken } from "@/lib/httpClient";

// ─── helpers ──────────────────────────────────────────────────────────────────
function getSession() {
  return getSessionToken();
}

function fmtQ(v: number | string | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  return "Q " + n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const s = d.length <= 10 ? d + "T00:00:00Z" : d;
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtN(v: number | string | null | undefined): string {
  return parseFloat(String(v ?? 0)).toFixed(2);
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ESTADO_COLOR: Record<string, string> = {
  pagada:   "bg-green-500/10 text-green-400 border-green-500/30",
  aprobada: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  revisada: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  borrador: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

// ─── tipos ────────────────────────────────────────────────────────────────────
interface LineaLibro {
  planilla_id:            number;
  periodo_desde:          string;
  periodo_hasta:          string;
  planilla_estado:        string;
  generado_por:           string;
  linea_id:               number;
  employee_id:            number | null;
  nombre_completo:        string;
  dpi:                    string | null;
  puesto:                 string | null;
  sede:                   string | null;
  cliente:                string | null;
  frecuencia_pago:        string | null;
  sueldo_base:            number;
  periodo_dias:           number;
  dias_trabajados:        number;
  faltas:                 number;
  suspensiones:           number;
  horas_extra:            number;
  sueldo_periodo:         number;
  desc_faltas:            number;
  valor_he:               number;
  bonificacion_incentivo: number;
  bonificacion_1:         number;
  bonificacion_2:         number;
  bonificacion_3:         number;
  desc_septimo:           number;
  total_bruto:            number;
  igss_trabajador:        number;
  anticipos:              number;
  otros_descuentos:       number;
  total_neto:             number;
}

interface Empleado {
  id: number;
  nombre_completo: string;
}

// ─── exportar CSV ─────────────────────────────────────────────────────────────
function exportarCSV(lineas: LineaLibro[], filename: string) {
  const encabezados = [
    "No.", "Período Desde", "Período Hasta", "Estado", "Frecuencia",
    "Nombre Completo", "DPI", "Puesto", "Sede", "Cliente",
    "Días Contrato", "Días Trabajados", "Faltas", "Suspensiones", "Horas Extra",
    "Sueldo Base", "Sueldo Período", "Desc. Faltas", "Valor HE",
    "Bon. Incentivo", "Bon. 1", "Bon. 2", "Bon. 3", "Desc. Séptimo", "Total Bruto",
    "IGSS Trabajador", "Anticipos", "Otros Descuentos", "Total Neto",
  ];
  const filas = lineas.map((l, i) => [
    i + 1,
    l.periodo_desde,
    l.periodo_hasta,
    l.planilla_estado,
    l.frecuencia_pago ?? "",
    l.nombre_completo,
    l.dpi ?? "",
    l.puesto ?? "",
    l.sede ?? "",
    l.cliente ?? "",
    l.periodo_dias,
    l.dias_trabajados,
    l.faltas,
    l.suspensiones,
    l.horas_extra,
    fmtN(l.sueldo_base),
    fmtN(l.sueldo_periodo),
    fmtN(l.desc_faltas),
    fmtN(l.valor_he),
    fmtN(l.bonificacion_incentivo),
    fmtN(l.desc_septimo),
    fmtN(l.total_bruto),
    fmtN(l.igss_trabajador),
    fmtN(l.anticipos),
    fmtN(l.otros_descuentos),
    fmtN(l.total_neto),
  ]);

  const csv = [encabezados, ...filas]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── totales de una lista de líneas ──────────────────────────────────────────
function calcTotales(lineas: LineaLibro[]) {
  return lineas.reduce(
    (acc, l) => ({
      sueldo_periodo:         acc.sueldo_periodo         + +l.sueldo_periodo,
      desc_faltas:            acc.desc_faltas            + +l.desc_faltas,
      valor_he:               acc.valor_he               + +l.valor_he,
      bonificacion_incentivo: acc.bonificacion_incentivo + +l.bonificacion_incentivo,
      desc_septimo:           acc.desc_septimo           + +l.desc_septimo,
      total_bruto:            acc.total_bruto            + +l.total_bruto,
      igss_trabajador:        acc.igss_trabajador        + +l.igss_trabajador,
      anticipos:              acc.anticipos              + +l.anticipos,
      otros_descuentos:       acc.otros_descuentos       + +l.otros_descuentos,
      total_neto:             acc.total_neto             + +l.total_neto,
    }),
    {
      sueldo_periodo: 0, desc_faltas: 0, valor_he: 0,
      bonificacion_incentivo: 0, desc_septimo: 0, total_bruto: 0,
      igss_trabajador: 0, anticipos: 0, otros_descuentos: 0, total_neto: 0,
    }
  );
}

// ─── Tabla compartida de líneas ───────────────────────────────────────────────
function TablaLineas({ lineas, mostrarPeriodo = false }: { lineas: LineaLibro[]; mostrarPeriodo?: boolean }) {
  const tot = calcTotales(lineas);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse min-w-[1600px]">
        <thead>
          <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wide text-[10px]">
            <th className="px-3 py-2 w-8">#</th>
            {mostrarPeriodo && <th className="px-3 py-2">Período</th>}
            <th className="px-3 py-2">Colaborador</th>
            <th className="px-3 py-2">DPI</th>
            <th className="px-3 py-2">Puesto / Sede</th>
            <th className="px-3 py-2 text-center">Días<br/>Cont.</th>
            <th className="px-3 py-2 text-center">Días<br/>Trab.</th>
            <th className="px-3 py-2 text-center">Faltas</th>
            <th className="px-3 py-2 text-center">HE</th>
            <th className="px-3 py-2 text-right">Sueldo<br/>Período</th>
            <th className="px-3 py-2 text-right">Desc.<br/>Faltas</th>
            <th className="px-3 py-2 text-right">Valor HE</th>
            <th className="px-3 py-2 text-right">Bonif.<br/>Incentivo</th>
            <th className="px-3 py-2 text-right">Desc.<br/>Séptimo</th>
            <th className="px-3 py-2 text-right font-bold text-white/70">Total<br/>Bruto</th>
            <th className="px-3 py-2 text-right">IGSS<br/>Trab.</th>
            <th className="px-3 py-2 text-right">Anticipos</th>
            <th className="px-3 py-2 text-right">Otros<br/>Desc.</th>
            <th className="px-3 py-2 text-right font-bold text-yellow-300/80">Total<br/>Líquido</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={l.linea_id} className={`border-b border-white/5 hover:bg-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
              <td className="px-3 py-2 text-gray-600">{i + 1}</td>
              {mostrarPeriodo && (
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-gray-300">{fmtDate(l.periodo_desde)}</div>
                  <div className="text-gray-500">al {fmtDate(l.periodo_hasta)}</div>
                  <Badge variant="outline" className={`text-[9px] mt-0.5 border ${ESTADO_COLOR[l.planilla_estado] ?? ""}`}>
                    {l.planilla_estado}
                  </Badge>
                </td>
              )}
              <td className="px-3 py-2">
                <div className="text-white font-medium truncate max-w-[160px]">{l.nombre_completo}</div>
                <div className="text-gray-500 text-[10px]">{l.frecuencia_pago ?? ""}</div>
              </td>
              <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">{l.dpi ?? "—"}</td>
              <td className="px-3 py-2">
                <div className="text-gray-300 truncate max-w-[140px]">{l.puesto ?? "—"}</div>
                <div className="text-gray-600 text-[10px] truncate">{l.sede ?? ""}</div>
              </td>
              <td className="px-3 py-2 text-center text-gray-400">{l.periodo_dias}</td>
              <td className="px-3 py-2 text-center text-white">{l.dias_trabajados}</td>
              <td className="px-3 py-2 text-center text-red-400/80">{l.faltas > 0 ? l.faltas : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-center text-blue-400/80">{+l.horas_extra > 0 ? fmtN(l.horas_extra) : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-right text-gray-300">{fmtQ(l.sueldo_periodo)}</td>
              <td className="px-3 py-2 text-right text-red-400/70">{+l.desc_faltas > 0 ? fmtQ(l.desc_faltas) : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-right text-blue-400/70">{+l.valor_he > 0 ? fmtQ(l.valor_he) : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-right text-green-400/70">{fmtQ(l.bonificacion_incentivo)}</td>
              <td className="px-3 py-2 text-right text-orange-400/70">{+l.desc_septimo > 0 ? fmtQ(l.desc_septimo) : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-right text-white font-semibold">{fmtQ(l.total_bruto)}</td>
              <td className="px-3 py-2 text-right text-purple-400/70">{+l.igss_trabajador > 0 ? fmtQ(l.igss_trabajador) : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-right text-red-400/70">{+l.anticipos > 0 ? fmtQ(l.anticipos) : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-right text-red-400/70">{+l.otros_descuentos > 0 ? fmtQ(l.otros_descuentos) : <span className="text-gray-600">—</span>}</td>
              <td className="px-3 py-2 text-right text-yellow-300 font-bold">{fmtQ(l.total_neto)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-white/20 bg-white/5 font-semibold text-[11px]">
            <td colSpan={mostrarPeriodo ? 9 : 8} className="px-3 py-3 text-white/60 text-right">TOTALES ({lineas.length} registros)</td>
            <td className="px-3 py-3 text-right text-gray-200">{fmtQ(tot.sueldo_periodo)}</td>
            <td className="px-3 py-3 text-right text-red-400">{fmtQ(tot.desc_faltas)}</td>
            <td className="px-3 py-3 text-right text-blue-400">{fmtQ(tot.valor_he)}</td>
            <td className="px-3 py-3 text-right text-green-400">{fmtQ(tot.bonificacion_incentivo)}</td>
            <td className="px-3 py-3 text-right text-orange-400">{fmtQ(tot.desc_septimo)}</td>
            <td className="px-3 py-3 text-right text-white">{fmtQ(tot.total_bruto)}</td>
            <td className="px-3 py-3 text-right text-purple-400">{fmtQ(tot.igss_trabajador)}</td>
            <td className="px-3 py-3 text-right text-red-400">{fmtQ(tot.anticipos)}</td>
            <td className="px-3 py-3 text-right text-red-400">{fmtQ(tot.otros_descuentos)}</td>
            <td className="px-3 py-3 text-right text-yellow-300">{fmtQ(tot.total_neto)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Vista General ────────────────────────────────────────────────────────────
function VistaGeneral() {
  const hoy    = new Date();
  const [anio, setAnio]   = useState(hoy.getFullYear());
  const [mes,  setMes]    = useState(hoy.getMonth() + 1);
  const [data,    setData]    = useState<{ rows: LineaLibro[]; anio: number; mes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const endpoint = `/api/libro-salarios/general`;

  const planillas = data
    ? Object.values(
        data.rows.reduce<Record<number, { planilla_id: number; periodo_desde: string; periodo_hasta: string; planilla_estado: string; generado_por: string; lineas: LineaLibro[] }>>(
          (acc, l) => {
            if (!acc[l.planilla_id]) {
              acc[l.planilla_id] = {
                planilla_id: l.planilla_id,
                periodo_desde: l.periodo_desde,
                periodo_hasta: l.periodo_hasta,
                planilla_estado: l.planilla_estado,
                generado_por: l.generado_por,
                lineas: [],
              };
            }
            acc[l.planilla_id].lineas.push(l);
            return acc;
          },
          {}
        )
      )
    : [];

  const [expandidos, setExpandidos] = useState<Record<number, boolean>>({});

  function togglePlanilla(id: number) {
    setExpandidos((p) => ({ ...p, [id]: !p[id] }));
  }

  async function buscar() {
    setLoading(true);
    setError(null);
    setExpandidos({});
    try {
      const res = await fetch(`${endpoint}?anio=${anio}&mes=${mes}`, {
        headers: { "x-isp-session": getSession() },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
      const exp: Record<number, boolean> = {};
      (json.rows as LineaLibro[]).forEach((l) => { exp[l.planilla_id] = true; });
      setExpandidos(exp);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const anios = Array.from({ length: 6 }, (_, i) => hoy.getFullYear() - i);

  function labelPlanilla(p: typeof planillas[0]) {
    return `Planilla #${p.planilla_id} — ${fmtDate(p.periodo_desde)} al ${fmtDate(p.periodo_hasta)}`;
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-[#0f1623] border border-white/10 rounded-xl p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Año</label>
            <select
              value={anio}
              onChange={(e) => setAnio(+e.target.value)}
              className="bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
            >
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(+e.target.value)}
              className="bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
            >
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <Button
            onClick={buscar}
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Consultar
          </Button>
          {data && data.rows.length > 0 && (
            <Button
              variant="outline"
              onClick={() => exportarCSV(data.rows, `libro-salarios-${anio}-${String(mes).padStart(2, "0")}.csv`)}
              className="border-white/15 text-gray-300 hover:text-white gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Sin resultados */}
      {data && data.rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
          <FileSpreadsheet className="w-10 h-10" />
          <p className="text-sm">No hay datos para {MESES[mes - 1]} {anio}.</p>
          <p className="text-xs text-gray-600">
            Importa el histórico desde la sección de Importación y luego materializa las planillas.
          </p>
        </div>
      )}

      {/* Planillas / Quincenas */}
      {planillas.map((p) => {
        const isOpen = expandidos[p.planilla_id] ?? false;
        const tot    = calcTotales(p.lineas);
        return (
          <div key={p.planilla_id} className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => togglePlanilla(p.planilla_id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <FileSpreadsheet className="w-5 h-5 text-yellow-400 shrink-0" />
                <div className="text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold text-sm">{labelPlanilla(p)}</span>
                    <Badge variant="outline" className={`text-[10px] border ${ESTADO_COLOR[p.planilla_estado] ?? "border-gray-500/30 text-gray-400"}`}>{p.planilla_estado}</Badge>
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {p.lineas.length} colaboradores · Líquido total: <span className="text-yellow-300 font-semibold">{fmtQ(tot.total_neto)}</span>
                  </div>
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {isOpen && (
              <div className="border-t border-white/5">
                <TablaLineas lineas={p.lineas} />
              </div>
            )}
          </div>
        );
      })}

      {/* Gran total si hay más de una quincena */}
      {planillas.length > 1 && data && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-yellow-300 font-bold text-sm">
              Gran Total — {MESES[mes - 1]} {anio}
            </span>
            <div className="flex gap-6 text-sm flex-wrap">
              <span className="text-gray-400">Quincenas: <span className="text-white font-semibold">{planillas.length}</span></span>
              <span className="text-gray-400">Colaboradores: <span className="text-white font-semibold">{data.rows.length}</span></span>
              <span className="text-gray-400">Total Bruto: <span className="text-white font-semibold">{fmtQ(calcTotales(data.rows).total_bruto)}</span></span>
              <span className="text-gray-400">Total Líquido: <span className="text-yellow-300 font-bold">{fmtQ(calcTotales(data.rows).total_neto)}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Combobox de colaborador ──────────────────────────────────────────────────
function ColaboradorCombobox({
  empleados,
  loading,
  empId,
  empNombre,
  onSelect,
  onClear,
}: {
  empleados: Empleado[];
  loading: boolean;
  empId: number | "";
  empNombre: string;
  onSelect: (id: number, nombre: string) => void;
  onClear: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [open, setOpen]         = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  const filtrados = busqueda.trim().length === 0
    ? empleados.slice(0, 50)
    : empleados.filter((e) =>
        e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 50);

  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function seleccionar(emp: Empleado) {
    onSelect(emp.id, emp.nombre_completo);
    setBusqueda("");
    setOpen(false);
  }

  function limpiar() {
    onClear();
    setBusqueda("");
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando colaboradores...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative min-w-[280px]">
      {empId !== "" ? (
        /* Chip — colaborador seleccionado */
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
          <User className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="text-yellow-200 text-sm font-medium truncate max-w-[220px]">{empNombre}</span>
          <button
            onClick={limpiar}
            className="ml-auto shrink-0 text-yellow-400/60 hover:text-yellow-300 transition-colors"
            title="Cambiar colaborador"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Input de búsqueda */
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar colaborador..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              className="w-full bg-[#07111f] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50 placeholder:text-gray-600"
            />
          </div>

          {/* Dropdown */}
          {open && (
            <div className="absolute z-50 top-full mt-1 w-full bg-[#0d1a2a] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
              {filtrados.length === 0 ? (
                <div className="px-4 py-3 text-gray-500 text-sm">Sin resultados para "{busqueda}"</div>
              ) : (
                <ul className="max-h-64 overflow-y-auto divide-y divide-white/5">
                  {filtrados.map((emp) => {
                    const partes = busqueda.trim()
                      ? emp.nombre_completo.split(new RegExp(`(${busqueda.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
                      : [emp.nombre_completo];
                    return (
                      <li key={emp.id}>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); seleccionar(emp); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-3"
                        >
                          <User className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                          <span className="text-sm text-gray-300">
                            {partes.map((p, i) =>
                              p.toLowerCase() === busqueda.toLowerCase()
                                ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{p}</mark>
                                : p
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {empleados.filter((e) => e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())).length > 50 && (
                    <li className="px-4 py-2 text-gray-600 text-xs text-center">
                      Mostrando 50 de {empleados.filter((e) => e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())).length} — sigue escribiendo para afinar
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Vista Individual ─────────────────────────────────────────────────────────
function VistaIndividual() {
  const hoy = new Date();
  const [empleados,   setEmpleados]   = useState<Empleado[]>([]);
  const [empId,       setEmpId]       = useState<number | "">("");
  const [empNombre,   setEmpNombre]   = useState("");
  const [desde,       setDesde]       = useState(`${hoy.getFullYear()}-01-01`);
  const [hasta,       setHasta]       = useState(`${hoy.getFullYear()}-12-31`);
  const [data,        setData]        = useState<{ rows: LineaLibro[]; empleado: { id: number; nombre_completo: string; dpi: string } | null } | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingEmp,  setLoadingEmp]  = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/libro-salarios/empleados", { headers: { "x-isp-session": getSession() } })
      .then((r) => r.json())
      .then((rows) => setEmpleados(rows))
      .catch(() => {})
      .finally(() => setLoadingEmp(false));
  }, []);

  async function buscar() {
    if (!empId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/libro-salarios/colaborador/${empId}?desde=${desde}&hasta=${hasta}`;
      const res = await fetch(url, { headers: { "x-isp-session": getSession() } });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const nombreColaborador = data?.empleado?.nombre_completo ?? empNombre;

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-[#0f1623] border border-white/10 rounded-xl p-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* Colaborador — combobox */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Colaborador</label>
            <ColaboradorCombobox
              empleados={empleados}
              loading={loadingEmp}
              empId={empId}
              empNombre={empNombre}
              onSelect={(id, nombre) => { setEmpId(id); setEmpNombre(nombre); setData(null); }}
              onClear={() => { setEmpId(""); setEmpNombre(""); setData(null); }}
            />
          </div>

          {/* Filtro de fechas */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50" />
          </div>

          <Button
            onClick={buscar}
            disabled={loading || !empId}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Consultar
          </Button>

          {data && data.rows.length > 0 && (
            <Button
              variant="outline"
              onClick={() => exportarCSV(
                data.rows,
                `libro-salarios-${nombreColaborador.replace(/\s+/g, "-")}-${desde}-${hasta}.csv`
              )}
              className="border-white/15 text-gray-300 hover:text-white gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Encabezado del colaborador */}
      {data && data.empleado && (
        <div className="bg-[#0f1623] border border-white/10 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-white font-semibold">{data.empleado.nombre_completo}</p>
            <p className="text-gray-400 text-xs">DPI: {data.empleado.dpi ?? "—"}</p>
          </div>
          <div className="ml-auto flex gap-6 text-sm text-right">
            <div>
              <p className="text-gray-500 text-xs">Nóminas en rango</p>
              <p className="text-white font-bold">{data.rows.length}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Bruto</p>
              <p className="text-white font-semibold">{fmtQ(calcTotales(data.rows).total_bruto)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Líquido</p>
              <p className="text-yellow-300 font-bold">{fmtQ(calcTotales(data.rows).total_neto)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sin resultados */}
      {data && data.rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
          <FileSpreadsheet className="w-10 h-10" />
          <p className="text-sm">No hay nóminas para este colaborador en el rango seleccionado.</p>
        </div>
      )}

      {/* Tabla */}
      {data && data.rows.length > 0 && (
        <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">
              Historial de Nóminas — {nombreColaborador}
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">
              {fmtDate(desde)} al {fmtDate(hasta)} · {data.rows.length} períodos
            </p>
          </div>
          <TablaLineas lineas={data.rows} mostrarPeriodo />
        </div>
      )}

      {/* Estado inicial */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
          <Info className="w-8 h-8" />
          <p className="text-sm">Selecciona un colaborador y el rango de fechas, luego pulsa Consultar.</p>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function LibroSalarios() {
  const [modo, setModo] = useState<"general" | "individual">("general");

  return (
    <AdminLayout title="Libro de Salarios">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Libro de Salarios</h1>
              <p className="text-sm text-gray-400">Registro legal de pagos salariales por período y colaborador</p>
            </div>
          </div>

          {/* Toggle modo */}
          <div className="flex items-center bg-[#0f1623] border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setModo("general")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                modo === "general" ? "bg-yellow-500 text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              Libro General
            </button>
            <button
              onClick={() => setModo("individual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                modo === "individual" ? "bg-yellow-500 text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <User className="w-4 h-4" />
              Por Colaborador
            </button>
          </div>
        </div>

        {/* Contenido según modo */}
        {modo === "general" ? <VistaGeneral /> : <VistaIndividual />}
      </div>
    </AdminLayout>
  );
}
