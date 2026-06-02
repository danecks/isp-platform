import { useState, useCallback, useEffect } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { IspPdf } from "@/lib/pdfExport";
import {
  FileBarChart2, Download, FileText, RefreshCw, AlertCircle,
  Filter, Calendar, Building2, Loader2, BarChart3,
  AlertTriangle, CheckSquare, Users, Briefcase, TrendingUp,
  FileDown, ChevronDown, X, Map, ArrowRight, CalendarClock,
  Receipt, Pencil, Check
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "operaciones" | "emergencias" | "tareas" | "rrhh" | "comercial" | "kpi" | "ssa";

interface Filtros {
  desde: string;
  hasta: string;
  cliente: string;
  estado: string;
  canal: string;
  prioridad: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = "/api";

async function fetchReporte(tab: TabId, filtros: Filtros) {
  const params = new URLSearchParams();
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.cliente) params.set("cliente", filtros.cliente);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.canal) params.set("canal", filtros.canal);
  if (filtros.prioridad) params.set("prioridad", filtros.prioridad);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/reportes/${tab}${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function fmtNum(n: unknown) {
  const num = parseInt(String(n ?? 0));
  return isNaN(num) ? "0" : num.toLocaleString("es-GT");
}

function fmtQ(n: unknown) {
  const num = parseInt(String(n ?? 0));
  return isNaN(num) ? "Q0" : `Q${num.toLocaleString("es-GT")}`;
}

function fmtFecha(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

const CHART_COLORS = ["#c2a83e", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];

// ─── Componentes compartidos ──────────────────────────────────────────────────

function StatCard({ label, value, color = "gold" }: { label: string; value: string | number; color?: string }) {
  const colorMap: Record<string, string> = {
    gold: "text-primary border-primary/20 bg-primary/8",
    blue: "text-blue-400 border-blue-500/20 bg-blue-500/8",
    green: "text-green-400 border-green-500/20 bg-green-500/8",
    red: "text-red-400 border-red-500/20 bg-red-500/8",
    yellow: "text-yellow-400 border-yellow-500/20 bg-yellow-500/8",
    gray: "text-white/50 border-white/10 bg-white/4",
  };
  return (
    <div className={`border rounded-xl p-4 text-center ${colorMap[color] ?? colorMap.gold}`}>
      <p className="text-2xl font-bold">{fmtNum(value)}</p>
      <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
    </div>
  );
}

function MiniBarChart({ data, nameKey, valueKey }: { data: any[]; nameKey: string; valueKey: string }) {
  if (!data || data.length === 0) return (
    <div className="text-center py-6 text-white/20 text-xs">Sin datos disponibles</div>
  );
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <XAxis dataKey={nameKey} tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: "#0c1829", border: "1px solid #ffffff10", borderRadius: 8, fontSize: 11, color: "#fff" }}
          cursor={{ fill: "#ffffff08" }}
        />
        <Bar dataKey={valueKey} radius={[4, 4, 0, 0]}>
          {data.map((_: unknown, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ExportBar({
  onPdf, onCsv, loading
}: { onPdf: () => void; onCsv: () => void; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onCsv}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-green-400/80 hover:text-green-300 bg-green-500/8 hover:bg-green-500/15 border border-green-500/15 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
      >
        <FileDown className="w-3.5 h-3.5" />
        CSV
      </button>
      <button
        onClick={onPdf}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary bg-primary/8 hover:bg-primary/15 border border-primary/15 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        PDF
      </button>
    </div>
  );
}

function SeccionTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mt-4 mb-2 px-1 flex items-center gap-2">
      <span className="w-4 h-px bg-primary/40 inline-block" />
      {children}
    </h3>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ElementType; roles?: string[] }[] = [
  { id: "operaciones", label: "Operaciones", icon: AlertTriangle },
  { id: "emergencias", label: "Emergencias", icon: AlertCircle },
  { id: "tareas", label: "Tareas", icon: CheckSquare },
  { id: "rrhh", label: "RRHH", icon: Users },
  { id: "comercial", label: "Comercial", icon: Briefcase },
  { id: "kpi", label: "KPI Ejecutivo", icon: TrendingUp },
  { id: "ssa", label: "Facturación SSA", icon: Receipt },
];

// ─── REPORTE: Operaciones ─────────────────────────────────────────────────────

function ReporteOperaciones({ data, filtros, nombre }: { data: any; filtros: Filtros; nombre: string }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  if (!data?.resumen || !Array.isArray(data?.incidencias)) return null;

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const pdf = await new IspPdf({
        titulo: "Reporte de Operaciones",
        subtitulo: "Incidencias Operativas",
        desde: filtros.desde,
        hasta: filtros.hasta,
        cliente: filtros.cliente,
        preparedBy: nombre,
      }).build();

      pdf.addSeccionTitulo("RESUMEN EJECUTIVO");
      pdf.addResumenCards([
        { label: "Total Incidencias", valor: data.resumen.total, color: "blue" },
        { label: "Abiertas", valor: data.resumen.abiertas, color: "red" },
        { label: "En Proceso", valor: data.resumen.en_proceso, color: "yellow" },
        { label: "Cerradas / Resueltas", valor: parseInt(data.resumen.resueltas) + parseInt(data.resumen.cerradas), color: "green" },
      ]);
      pdf.addTextoResumen(
        `El presente reporte consolida ${data.resumen.total} incidencias registradas en el período. ` +
        `Se encuentran actualmente abiertas ${data.resumen.abiertas} incidencias y ${data.resumen.en_proceso} en proceso. ` +
        `Se han resuelto o cerrado ${parseInt(data.resumen.resueltas) + parseInt(data.resumen.cerradas)} casos.`
      );

      pdf.addSeccionTitulo("INCIDENCIAS POR ESTADO");
      pdf.addTabla(["Estado", "Total"], data.porEstado.map((r: any) => [r.estado, r.total]));

      pdf.addSeccionTitulo("INCIDENCIAS POR TIPO");
      pdf.addTabla(["Tipo", "Total"], data.porTipo.map((r: any) => [r.tipo, r.total]));

      pdf.addSeccionTitulo("CLIENTES CON MÁS INCIDENCIAS");
      pdf.addTabla(["Cliente", "Total"], data.porCliente.map((r: any) => [r.cliente, r.total]));

      pdf.addSeccionTitulo("DETALLE DE INCIDENCIAS");
      pdf.addTabla(
        ["ID", "Fecha", "Cliente", "Tipo", "Estado", "Prioridad"],
        data.incidencias.map((r: any) => [r.id, fmtFecha(r.fecha), r.cliente ?? "—", r.tipo, r.estado, r.prioridad])
      );

      pdf.save("reporte-operaciones.pdf");
    } finally {
      setPdfLoading(false);
    }
  };

  const exportCsv = () => {
    IspPdf.exportCsv(
      ["ID", "Fecha", "Cliente", "Tipo", "Estado", "Prioridad", "Origen"],
      data.incidencias.map((r: any) => [r.id, fmtFecha(r.fecha), r.cliente ?? "", r.tipo, r.estado, r.prioridad, r.origen]),
      "operaciones.csv"
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/40">{data.resumen.total} incidencias en el período</p>
        <ExportBar onPdf={exportPdf} onCsv={exportCsv} loading={pdfLoading} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={data.resumen.total} color="gold" />
        <StatCard label="Abiertas" value={data.resumen.abiertas} color="red" />
        <StatCard label="En Proceso" value={data.resumen.en_proceso} color="yellow" />
        <StatCard label="Resueltas/Cerradas" value={parseInt(data.resumen.resueltas) + parseInt(data.resumen.cerradas)} color="green" />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Por Tipo</SeccionTitulo>
          <MiniBarChart data={data.porTipo} nameKey="tipo" valueKey="total" />
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Por Cliente (Top 10)</SeccionTitulo>
          <MiniBarChart data={data.porCliente} nameKey="cliente" valueKey="total" />
        </div>
      </div>

      {/* Distribución */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { titulo: "Por Estado", data: data.porEstado, key: "estado" },
          { titulo: "Por Prioridad", data: data.porPrioridad, key: "prioridad" },
          { titulo: "Por Origen", data: data.porOrigen, key: "origen" },
        ].map(({ titulo, data: d, key }) => (
          <div key={titulo} className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5">
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">{titulo}</p>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {(d as any[]).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-white/3">
                    <td className="px-4 py-2 text-white/60">{row[key]}</td>
                    <td className="px-4 py-2 text-right font-bold text-white">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Tabla detalle */}
      <TablaDetalle
        titulo="Detalle de Incidencias"
        columnas={["ID", "Fecha", "Cliente", "Tipo", "Estado", "Prioridad"]}
        filas={data.incidencias.map((r: any) => [r.id, fmtFecha(r.fecha), r.cliente ?? "—", r.tipo, r.estado, r.prioridad])}
      />
    </div>
  );
}

// ─── REPORTE: Emergencias ─────────────────────────────────────────────────────

function ReporteEmergencias({ data, filtros, nombre }: { data: any; filtros: Filtros; nombre: string }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  if (!data?.resumen || !Array.isArray(data?.emergencias)) return null;

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const pdf = await new IspPdf({
        titulo: "Reporte de Emergencias",
        desde: filtros.desde, hasta: filtros.hasta, cliente: filtros.cliente, preparedBy: nombre,
      }).build();

      pdf.addSeccionTitulo("RESUMEN EJECUTIVO");
      pdf.addResumenCards([
        { label: "Total Emergencias", valor: data.resumen.total, color: "red" },
        { label: "Activas", valor: data.resumen.activas, color: "yellow" },
        { label: "Cerradas", valor: data.resumen.cerradas, color: "green" },
      ]);

      if (data.activas.length > 0) {
        pdf.addSeccionTitulo("EMERGENCIAS ACTIVAS");
        pdf.addTabla(
          ["ID", "Fecha", "Cliente", "Tipo", "Reportado por"],
          data.activas.map((r: any) => [r.id, fmtFecha(r.fecha), r.cliente ?? "—", r.tipo, r.reportado_por ?? "—"])
        );
      }

      pdf.addSeccionTitulo("POR CLIENTE");
      pdf.addTabla(["Cliente", "Total"], data.porCliente.map((r: any) => [r.cliente, r.total]));

      pdf.addSeccionTitulo("POR TIPO");
      pdf.addTabla(["Tipo", "Total"], data.porTipo.map((r: any) => [r.tipo, r.total]));

      pdf.addSeccionTitulo("HISTORIAL DE EMERGENCIAS");
      pdf.addTabla(
        ["ID", "Fecha", "Cliente", "Tipo", "Estado", "Reportado por"],
        data.emergencias.map((r: any) => [r.id, fmtFecha(r.fecha), r.cliente ?? "—", r.tipo, r.estado, r.reportado_por ?? "—"])
      );
      pdf.save("reporte-emergencias.pdf");
    } finally { setPdfLoading(false); }
  };

  const exportCsv = () => IspPdf.exportCsv(
    ["ID", "Fecha", "Cliente", "Tipo", "Estado", "Reportado Por"],
    data.emergencias.map((r: any) => [r.id, fmtFecha(r.fecha), r.cliente ?? "", r.tipo, r.estado, r.reportado_por ?? ""]),
    "emergencias.csv"
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/40">{data.resumen.total} emergencias en el período</p>
        <ExportBar onPdf={exportPdf} onCsv={exportCsv} loading={pdfLoading} />
      </div>

      {(data.activas ?? []).length > 0 && (
        <div className="bg-red-500/8 border border-red-500/25 rounded-xl p-4">
          <p className="text-xs font-bold text-red-400 mb-2">⚠ Emergencias Activas ({(data.activas ?? []).length})</p>
          <div className="space-y-1">
            {(data.activas ?? []).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-primary/70">{e.id}</span>
                <span className="text-white/70">{e.cliente}</span>
                <span className="text-white/40">{e.tipo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={data.resumen.total} color="red" />
        <StatCard label="Activas" value={data.resumen.activas} color="yellow" />
        <StatCard label="Cerradas" value={data.resumen.cerradas} color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Por Tipo</SeccionTitulo>
          <MiniBarChart data={data.porTipo} nameKey="tipo" valueKey="total" />
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Por Cliente</SeccionTitulo>
          <MiniBarChart data={data.porCliente} nameKey="cliente" valueKey="total" />
        </div>
      </div>

      <TablaDetalle
        titulo="Historial de Emergencias"
        columnas={["ID", "Fecha", "Cliente", "Tipo", "Estado", "Reportado por"]}
        filas={data.emergencias.map((r: any) => [r.id, fmtFecha(r.fecha), r.cliente ?? "—", r.tipo, r.estado, r.reportado_por ?? "—"])}
      />
    </div>
  );
}

// ─── REPORTE: Tareas ──────────────────────────────────────────────────────────

function ReporteTareas({ data, filtros, nombre }: { data: any; filtros: Filtros; nombre: string }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  if (!data?.resumen || !Array.isArray(data?.tareas)) return null;

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const pdf = await new IspPdf({
        titulo: "Reporte de Tareas y Supervisión",
        desde: filtros.desde, hasta: filtros.hasta, preparedBy: nombre,
      }).build();

      pdf.addSeccionTitulo("RESUMEN EJECUTIVO");
      pdf.addResumenCards([
        { label: "Total Tareas", valor: data.resumen.total, color: "blue" },
        { label: "Pendientes", valor: data.resumen.pendientes, color: "yellow" },
        { label: "En Proceso", valor: data.resumen.en_proceso, color: "blue" },
        { label: "Con Evidencia", valor: data.resumen.con_evidencia, color: "green" },
      ]);

      pdf.addSeccionTitulo("CIERRES POR SUPERVISOR");
      if (data.porSupervisor.length > 0) {
        pdf.addTabla(["Supervisor", "Tareas Cerradas", "Último Cierre"],
          data.porSupervisor.map((r: any) => [r.supervisor_nombre, r.tareas_cerradas, fmtFecha(r.ultimo_cierre)])
        );
      }

      pdf.addSeccionTitulo("TAREAS CON EVIDENCIA");
      if (data.conEvidencia.length > 0) {
        pdf.addTabla(["ID", "Tarea", "Prioridad", "Supervisor", "Comentario", "Fecha Cierre"],
          data.conEvidencia.map((r: any) => [r.id, r.titulo.substring(0, 35), r.prioridad, r.supervisor_nombre, r.comentario.substring(0, 30), fmtFecha(r.fecha_cierre)])
        );
      }

      pdf.addSeccionTitulo("LISTADO DE TAREAS");
      pdf.addTabla(
        ["ID", "Título", "Estado", "Prioridad", "Asignado"],
        data.tareas.map((r: any) => [r.id, r.titulo.substring(0, 40), r.estado, r.prioridad, r.asignado ?? "—"])
      );
      pdf.save("reporte-tareas.pdf");
    } finally { setPdfLoading(false); }
  };

  const exportCsv = () => IspPdf.exportCsv(
    ["ID", "Título", "Estado", "Prioridad", "Asignado", "Incidencia", "Fecha"],
    data.tareas.map((r: any) => [r.id, r.titulo, r.estado, r.prioridad, r.asignado ?? "", r.incidencia_id ?? "", fmtFecha(r.created_at)]),
    "tareas.csv"
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/40">{data.resumen.total} tareas en el período</p>
        <ExportBar onPdf={exportPdf} onCsv={exportCsv} loading={pdfLoading} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={data.resumen.total} color="gold" />
        <StatCard label="Pendientes" value={data.resumen.pendientes} color="yellow" />
        <StatCard label="Completadas" value={data.resumen.completadas} color="green" />
        <StatCard label="Con Evidencia" value={data.resumen.con_evidencia} color="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Por Estado</SeccionTitulo>
          <MiniBarChart data={data.porEstado} nameKey="estado" valueKey="total" />
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Cierres por Supervisor</SeccionTitulo>
          {data.porSupervisor.length > 0
            ? <MiniBarChart data={data.porSupervisor} nameKey="supervisor_nombre" valueKey="tareas_cerradas" />
            : <div className="py-10 text-center text-white/20 text-xs">Aún no hay tareas cerradas</div>
          }
        </div>
      </div>

      {data.conEvidencia.length > 0 && (
        <TablaDetalle
          titulo="Tareas Cerradas con Evidencia"
          columnas={["ID", "Título", "Prioridad", "Supervisor", "Canal", "Fecha Cierre"]}
          filas={data.conEvidencia.map((r: any) => [r.id, r.titulo.substring(0, 45), r.prioridad, r.supervisor_nombre, r.canal, fmtFecha(r.fecha_cierre)])}
        />
      )}

      <TablaDetalle
        titulo="Listado de Tareas"
        columnas={["ID", "Título", "Estado", "Prioridad", "Asignado"]}
        filas={data.tareas.map((r: any) => [r.id, r.titulo.substring(0, 50), r.estado, r.prioridad, r.asignado ?? "—"])}
      />
    </div>
  );
}

// ─── REPORTE: RRHH ────────────────────────────────────────────────────────────

function ReporteRrhh({ data, filtros, nombre }: { data: any; filtros: Filtros; nombre: string }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sub, setSub] = useState<"anticipos" | "reclutamiento">("anticipos");
  if (!data?.anticipos || !data?.reclutamiento) return null;

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const pdf = await new IspPdf({
        titulo: "Reporte de Recursos Humanos",
        desde: filtros.desde, hasta: filtros.hasta, preparedBy: nombre,
      }).build();

      pdf.addSeccionTitulo("ANTICIPOS SALARIALES");
      pdf.addResumenCards([
        { label: "Solicitudes", valor: data.anticipos.resumen.total_solicitudes, color: "blue" },
        { label: "Monto Total", valor: fmtQ(data.anticipos.resumen.monto_total), color: "gold" },
        { label: "Monto Pendiente", valor: fmtQ(data.anticipos.resumen.monto_pendiente), color: "yellow" },
        { label: "Monto Aprobado", valor: fmtQ(data.anticipos.resumen.monto_aprobado), color: "green" },
      ]);
      pdf.addTabla(["Estado", "Total", "Monto (Q)"],
        data.anticipos.porEstado.map((r: any) => [r.estado, r.total, fmtQ(r.monto)])
      );
      if (data.anticipos.lista.length > 0) {
        pdf.addTabla(["Nombre", "Puesto", "Monto (Q)", "Estado", "Período", "Fecha"],
          data.anticipos.lista.map((r: any) => [r.nombre, r.puesto ?? "—", fmtQ(r.cantidad), r.estado, r.periodo ?? "—", fmtFecha(r.fecha_solicitud)])
        );
      }

      pdf.addSeccionTitulo("RECLUTAMIENTO");
      pdf.addResumenCards([
        { label: "Postulaciones", valor: data.reclutamiento.resumen.total, color: "blue" },
        { label: "Aprobadas", valor: data.reclutamiento.resumen.aprobadas, color: "green" },
        { label: "Descartadas", valor: data.reclutamiento.resumen.descartadas, color: "red" },
      ]);
      pdf.addTabla(["Estado", "Total"], data.reclutamiento.porEstado.map((r: any) => [r.estado, r.total]));

      pdf.save("reporte-rrhh.pdf");
    } finally { setPdfLoading(false); }
  };

  const exportCsv = () => {
    if (sub === "anticipos") {
      IspPdf.exportCsv(
        ["Nombre", "Puesto", "Monto", "Estado", "Período", "Fecha"],
        data.anticipos.lista.map((r: any) => [r.nombre, r.puesto ?? "", r.cantidad, r.estado, r.periodo ?? "", fmtFecha(r.fecha_solicitud)]),
        "anticipos.csv"
      );
    } else {
      IspPdf.exportCsv(
        ["Nombre", "Puesto", "Canal", "Estado", "Fecha"],
        data.reclutamiento.lista.map((r: any) => [r.nombre, r.puesto ?? "", r.canal, r.estado, fmtFecha(r.created_at)]),
        "reclutamiento.csv"
      );
    }
  };

  const a = data.anticipos;
  const r = data.reclutamiento;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {(["anticipos", "reclutamiento"] as const).map((s) => (
            <button key={s} onClick={() => setSub(s)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${sub === s ? "bg-primary/15 border-primary/30 text-primary" : "bg-white/3 border-white/8 text-white/40 hover:text-white"}`}
            >
              {s === "anticipos" ? "Anticipos" : "Reclutamiento"}
            </button>
          ))}
        </div>
        <ExportBar onPdf={exportPdf} onCsv={exportCsv} loading={pdfLoading} />
      </div>

      {sub === "anticipos" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Solicitudes" value={a.resumen.total_solicitudes} color="gold" />
            <StatCard label="Monto Total" value={fmtQ(a.resumen.monto_total)} color="blue" />
            <StatCard label="Pendiente" value={fmtQ(a.resumen.monto_pendiente)} color="yellow" />
            <StatCard label="Aprobado" value={fmtQ(a.resumen.monto_aprobado)} color="green" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <SeccionTitulo>Por Estado</SeccionTitulo>
              <MiniBarChart data={a.porEstado} nameKey="estado" valueKey="total" />
            </div>
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <SeccionTitulo>Por Período</SeccionTitulo>
              <MiniBarChart data={a.porPeriodo} nameKey="periodo" valueKey="total" />
            </div>
          </div>
          <TablaDetalle titulo="Detalle de Anticipos"
            columnas={["Nombre", "Puesto", "Monto (Q)", "Estado", "Período", "Fecha"]}
            filas={a.lista.map((row: any) => [row.nombre, row.puesto ?? "—", fmtQ(row.cantidad), row.estado, row.periodo ?? "—", fmtFecha(row.fecha_solicitud)])}
          />
        </>
      )}

      {sub === "reclutamiento" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Postulaciones" value={r.resumen.total} color="gold" />
            <StatCard label="Aprobadas" value={r.resumen.aprobadas} color="green" />
            <StatCard label="Descartadas" value={r.resumen.descartadas} color="red" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <SeccionTitulo>Por Estado</SeccionTitulo>
              <MiniBarChart data={r.porEstado} nameKey="estado" valueKey="total" />
            </div>
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <SeccionTitulo>Por Canal</SeccionTitulo>
              <MiniBarChart data={r.porCanal} nameKey="canal" valueKey="total" />
            </div>
          </div>
          <TablaDetalle titulo="Detalle de Postulaciones"
            columnas={["Nombre", "Puesto", "Canal", "Estado", "Fecha"]}
            filas={r.lista.map((row: any) => [row.nombre, row.puesto ?? "—", row.canal, row.estado, fmtFecha(row.created_at)])}
          />
        </>
      )}
    </div>
  );
}

// ─── REPORTE: Comercial ───────────────────────────────────────────────────────

function ReporteComercial({ data, filtros, nombre }: { data: any; filtros: Filtros; nombre: string }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  if (!data?.resumen || !Array.isArray(data?.leads)) return null;

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const pdf = await new IspPdf({
        titulo: "Reporte Comercial",
        subtitulo: "Gestión de Leads y Clientes Potenciales",
        desde: filtros.desde, hasta: filtros.hasta, preparedBy: nombre,
      }).build();

      pdf.addSeccionTitulo("RESUMEN EJECUTIVO");
      pdf.addResumenCards([
        { label: "Total Leads", valor: data.resumen.total, color: "blue" },
        { label: "Nuevos", valor: data.resumen.nuevos, color: "yellow" },
        { label: "Cotizados", valor: data.resumen.cotizados, color: "gold" },
        { label: "Ganados", valor: data.resumen.ganados, color: "green" },
      ]);

      pdf.addSeccionTitulo("LEADS POR ESTADO");
      pdf.addTabla(["Estado", "Total"], data.porEstado.map((r: any) => [r.estado, r.total]));

      pdf.addSeccionTitulo("LEADS POR EJECUTIVO");
      pdf.addTabla(["Ejecutivo", "Total"], data.porEjecutivo.map((r: any) => [r.ejecutivo, r.total]));

      pdf.addSeccionTitulo("POR SERVICIO");
      pdf.addTabla(["Servicio", "Total"], data.porServicio.map((r: any) => [r.servicio, r.total]));

      pdf.addSeccionTitulo("DETALLE DE LEADS");
      pdf.addTabla(["ID", "Empresa", "Servicio", "Canal", "Estado", "Ejecutivo", "Fecha"],
        data.leads.map((r: any) => [r.id, r.empresa, r.servicio ?? "—", r.canal, r.estado, r.ejecutivo ?? "—", fmtFecha(r.created_at)])
      );
      pdf.save("reporte-comercial.pdf");
    } finally { setPdfLoading(false); }
  };

  const exportCsv = () => IspPdf.exportCsv(
    ["ID", "Empresa", "Contacto", "Servicio", "Canal", "Estado", "Ejecutivo", "Fecha"],
    data.leads.map((r: any) => [r.id, r.empresa, r.contacto ?? "", r.servicio ?? "", r.canal, r.estado, r.ejecutivo ?? "", fmtFecha(r.created_at)]),
    "comercial.csv"
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/40">{data.resumen.total} leads en el período</p>
        <ExportBar onPdf={exportPdf} onCsv={exportCsv} loading={pdfLoading} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={data.resumen.total} color="gold" />
        <StatCard label="Cotizados" value={data.resumen.cotizados} color="yellow" />
        <StatCard label="Ganados" value={data.resumen.ganados} color="green" />
        <StatCard label="Perdidos" value={data.resumen.perdidos} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Por Servicio</SeccionTitulo>
          <MiniBarChart data={data.porServicio} nameKey="servicio" valueKey="total" />
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Por Ejecutivo</SeccionTitulo>
          {data.porEjecutivo.length > 0
            ? <MiniBarChart data={data.porEjecutivo} nameKey="ejecutivo" valueKey="total" />
            : <div className="py-10 text-center text-white/20 text-xs">Sin datos de ejecutivos</div>
          }
        </div>
      </div>

      <TablaDetalle titulo="Detalle de Leads"
        columnas={["ID", "Empresa", "Servicio", "Canal", "Estado", "Ejecutivo", "Fecha"]}
        filas={data.leads.map((r: any) => [r.id, r.empresa, r.servicio ?? "—", r.canal, r.estado, r.ejecutivo ?? "—", fmtFecha(r.created_at)])}
      />
    </div>
  );
}

// ─── REPORTE: KPI Ejecutivo ───────────────────────────────────────────────────

function ReporteKpi({ data, filtros, nombre }: { data: any; filtros: Filtros; nombre: string }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  if (!data?.incidencias || !data?.tareas || !data?.leads) return null;

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const pdf = await new IspPdf({
        titulo: "KPI Ejecutivo — ISP, S.A.",
        subtitulo: "Indicadores Clave de Rendimiento",
        desde: filtros.desde, hasta: filtros.hasta, preparedBy: nombre,
      }).build();

      pdf.addSeccionTitulo("INCIDENCIAS OPERATIVAS");
      pdf.addResumenCards([
        { label: "Total Incidencias", valor: data.incidencias.total, color: "blue" },
        { label: "Activas", valor: data.incidencias.activas, color: "red" },
        { label: "Cerradas", valor: data.incidencias.cerradas, color: "green" },
        { label: "Críticas (Alta)", valor: data.incidencias.criticas, color: "red" },
      ]);

      pdf.addSeccionTitulo("EMERGENCIAS Y TAREAS");
      pdf.addResumenCards([
        { label: "Total Emergencias", valor: data.emergencias.total, color: "red" },
        { label: "Emergencias Activas", valor: data.emergencias.activas, color: "yellow" },
        { label: "Tareas Completadas", valor: data.tareas.completadas, color: "green" },
        { label: "Cumplimiento Tareas", valor: `${data.tareas.cumplimiento_pct}%`, color: "blue" },
      ]);

      pdf.addSeccionTitulo("RRHH Y COMERCIAL");
      pdf.addResumenCards([
        { label: "Anticipos", valor: data.anticipos.total_solicitudes, color: "blue" },
        { label: "Monto Anticipos (Q)", valor: fmtQ(data.anticipos.monto_total), color: "gold" },
        { label: "Leads", valor: data.leads.total, color: "blue" },
        { label: "Leads Ganados", valor: data.leads.ganados, color: "green" },
      ]);

      pdf.addSeccionTitulo("CLIENTES MÁS ACTIVOS");
      if (data.clientesActivos.length > 0) {
        pdf.addTabla(["Cliente", "Incidencias"], data.clientesActivos.map((r: any) => [r.cliente, r.incidencias]));
      }

      pdf.save("kpi-ejecutivo.pdf");
    } finally { setPdfLoading(false); }
  };

  const exportCsv = () => IspPdf.exportCsv(
    ["Métrica", "Valor"],
    [
      ["Total Incidencias", data.incidencias.total],
      ["Incidencias Activas", data.incidencias.activas],
      ["Incidencias Cerradas", data.incidencias.cerradas],
      ["Emergencias Total", data.emergencias.total],
      ["Emergencias Activas", data.emergencias.activas],
      ["Tareas Total", data.tareas.total],
      ["Tareas Completadas", data.tareas.completadas],
      ["Cumplimiento Tareas %", data.tareas.cumplimiento_pct],
      ["Anticipos", data.anticipos.total_solicitudes],
      ["Monto Anticipos Q", data.anticipos.monto_total],
      ["Leads", data.leads.total],
      ["Leads Ganados", data.leads.ganados],
    ],
    "kpi-ejecutivo.csv"
  );

  const cumplPct = data.tareas.cumplimiento_pct ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportBar onPdf={exportPdf} onCsv={exportCsv} loading={pdfLoading} />
      </div>

      {/* Incidencias */}
      <div>
        <SeccionTitulo>Incidencias Operativas</SeccionTitulo>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={data.incidencias.total} color="gold" />
          <StatCard label="Activas" value={data.incidencias.activas} color="red" />
          <StatCard label="Cerradas" value={data.incidencias.cerradas} color="green" />
          <StatCard label="Críticas" value={data.incidencias.criticas} color="red" />
        </div>
      </div>

      {/* Emergencias + Tareas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SeccionTitulo>Emergencias</SeccionTitulo>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total" value={data.emergencias.total} color="red" />
            <StatCard label="Activas" value={data.emergencias.activas} color="yellow" />
          </div>
        </div>
        <div>
          <SeccionTitulo>Tareas</SeccionTitulo>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Completadas" value={data.tareas.completadas} color="green" />
            <StatCard label={`Cumplimiento`} value={`${cumplPct}%`} color={cumplPct >= 70 ? "green" : cumplPct >= 40 ? "yellow" : "red"} />
          </div>
        </div>
      </div>

      {/* RRHH + Comercial */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Anticipos" value={data.anticipos.total_solicitudes} color="blue" />
        <StatCard label="Monto Q" value={fmtQ(data.anticipos.monto_total)} color="gold" />
        <StatCard label="Leads Total" value={data.leads.total} color="blue" />
        <StatCard label="Leads Ganados" value={data.leads.ganados} color="green" />
      </div>

      {/* Clientes activos */}
      {data.clientesActivos.length > 0 && (
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <SeccionTitulo>Clientes más Activos</SeccionTitulo>
          <div className="space-y-2 mt-1">
            {data.clientesActivos.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-white/80 truncate">{c.cliente}</span>
                    <span className="text-xs font-bold text-primary shrink-0">{c.incidencias}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${Math.round((c.incidencias / data.clientesActivos[0].incidencias) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabla de detalle genérica ────────────────────────────────────────────────

function TablaDetalle({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: (string | number)[][] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? filas : filas.slice(0, 10);

  return (
    <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <p className="text-xs font-bold text-white/70">{titulo}</p>
        <span className="text-[10px] text-white/30">{filas.length} registros</span>
      </div>
      {filas.length === 0 ? (
        <div className="text-center py-8 text-white/20 text-xs">Sin datos para el período seleccionado</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                  {columnas.map((c) => <th key={c} className="text-left px-4 py-2">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((fila, i) => (
                  <tr key={i} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    {fila.map((celda, j) => (
                      <td key={j} className="px-4 py-2 text-white/60">{celda}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filas.length > 10 && (
            <div className="px-4 py-2 border-t border-white/5">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Mostrar menos" : `Ver ${filas.length - 10} más`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── FILTROS GLOBALES ─────────────────────────────────────────────────────────

/** Carga la lista de clientes una sola vez para el selector del filtro. */
function useClientesLista() {
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  useEffect(() => {
    fetch("/api/alias/clientes")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setClientes(
            data
              .map((c: any) => ({ id: c.id, nombre: c.nombre ?? c.nombreComercial ?? "" }))
              .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
          );
        }
      })
      .catch(() => {});
  }, []);
  return clientes;
}

function FiltrosBar({ filtros, onChange, onReset }: { filtros: Filtros; onChange: (f: Filtros) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const clientes = useClientesLista();
  const hasActive = Object.values(filtros).some(Boolean);

  return (
    <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/60 font-medium">Filtros de Reporte</span>
          {hasActive && (
            <span className="text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
              Activos
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActive && (
            <button
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Desde</label>
              <input type="date" value={filtros.desde} onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
                className="w-full bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Hasta</label>
              <input type="date" value={filtros.hasta} onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
                className="w-full bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Cliente</label>
              <select
                value={filtros.cliente}
                onChange={(e) => onChange({ ...filtros, cliente: e.target.value })}
                className="w-full bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
              >
                <option value="">Todos</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Estado</label>
              <select value={filtros.estado} onChange={(e) => onChange({ ...filtros, estado: e.target.value })}
                className="w-full bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40">
                <option value="">Todos</option>
                <option value="abierta">Abierta</option>
                <option value="en_proceso">En Proceso</option>
                <option value="resuelta">Resuelta</option>
                <option value="cerrada">Cerrada</option>
                <option value="pendiente">Pendiente</option>
                <option value="completada">Completada</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Canal</label>
              <select value={filtros.canal} onChange={(e) => onChange({ ...filtros, canal: e.target.value })}
                className="w-full bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40">
                <option value="">Todos</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="web">Web</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Prioridad</label>
              <select value={filtros.prioridad} onChange={(e) => onChange({ ...filtros, prioridad: e.target.value })}
                className="w-full bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40">
                <option value="">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REPORTE: Facturación SSA mensual ─────────────────────────────────────────

const FACT_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  facturado: "Facturado",
  cobrado: "Cobrado",
};

function MesLabel({ mes }: { mes: string }) {
  if (!/^\d{4}-\d{2}$/.test(mes)) return <>{mes}</>;
  const [y, m] = mes.split("-").map(Number);
  const nombre = new Date(y, m - 1, 1).toLocaleDateString("es-GT", { month: "long", year: "numeric" });
  return <>{nombre.charAt(0).toUpperCase() + nombre.slice(1)}</>;
}

function ReporteSsaFacturacion({ nombre }: { nombre: string }) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const clientes = useClientesLista();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editMonto, setEditMonto] = useState("");
  const [editTarifa, setEditTarifa] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("mes", mes);
      if (clienteFiltro) params.set("cliente", clienteFiltro);
      const res = await fetch(`${API_BASE}/reportes/ssa-facturacion?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Error al cargar el reporte SSA");
    } finally {
      setLoading(false);
    }
  }, [mes, clienteFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

  const iniciarEdicion = (row: any) => {
    setEditId(row.id);
    setEditMonto(row.monto_estimado != null ? String(row.monto_estimado) : "");
    setEditTarifa(row.tarifa_aplicada != null ? String(row.tarifa_aplicada) : "");
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditMonto("");
    setEditTarifa("");
  };

  const guardarEdicion = async (id: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/solicitudes-servicio/${id}/facturacion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montoEstimado: editMonto === "" ? null : Number(editMonto),
          tarifaAplicada: editTarifa === "" ? null : editTarifa,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      cancelarEdicion();
      await cargar();
    } catch (e: any) {
      setError(e.message ?? "Error al guardar monto/tarifa");
    } finally {
      setSaving(false);
    }
  };

  const detalle: any[] = data?.detalle ?? [];
  const porCliente: any[] = data?.porCliente ?? [];
  const total = data?.total ?? { solicitudes: 0, monto_total: 0, monto_facturado: 0, monto_pendiente: 0 };

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const pdf = await new IspPdf({
        titulo: "Reporte de Facturación SSA",
        subtitulo: "Servicios de Seguridad Adicional",
        cliente: clienteFiltro,
        preparedBy: nombre,
      }).build();

      pdf.addSeccionTitulo(`RESUMEN — ${mes}`);
      pdf.addResumenCards([
        { label: "Solicitudes", valor: total.solicitudes, color: "blue" },
        { label: "Monto Total", valor: fmtQ(total.monto_total), color: "gold" },
        { label: "Facturado", valor: fmtQ(total.monto_facturado), color: "green" },
        { label: "Pendiente", valor: fmtQ(total.monto_pendiente), color: "yellow" },
      ]);

      pdf.addSeccionTitulo("TOTALES POR CLIENTE");
      pdf.addTabla(
        ["Cliente", "Solicitudes", "Monto Total", "Facturado", "Pendiente"],
        porCliente.map((r: any) => [
          r.cliente_nombre, r.solicitudes, fmtQ(r.monto_total), fmtQ(r.monto_facturado), fmtQ(r.monto_pendiente),
        ])
      );

      pdf.addSeccionTitulo("DETALLE DE SOLICITUDES");
      pdf.addTabla(
        ["ID", "Cliente", "Tipo", "Fecha", "Guardias", "Monto", "Tarifa", "Facturación"],
        detalle.map((r: any) => [
          r.id, r.cliente_nombre, r.tipo_solicitud ?? "—", fmtFecha(r.fecha),
          r.cantidad_guardias ?? "—", fmtQ(r.monto_estimado), r.tarifa_aplicada ?? "—",
          FACT_LABEL[r.estado_facturacion] ?? r.estado_facturacion ?? "—",
        ])
      );

      pdf.save(`reporte-ssa-${mes}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  const exportCsv = () => IspPdf.exportCsv(
    ["ID", "Cliente", "Sede", "Tipo", "Fecha", "Guardias", "Monto Estimado", "Tarifa Aplicada", "Facturación"],
    detalle.map((r: any) => [
      r.id, r.cliente_nombre, r.sede_nombre ?? "", r.tipo_solicitud ?? "", fmtFecha(r.fecha),
      r.cantidad_guardias ?? "", r.monto_estimado ?? "", r.tarifa_aplicada ?? "",
      FACT_LABEL[r.estado_facturacion] ?? r.estado_facturacion ?? "",
    ]),
    `ssa-${mes}.csv`
  );

  return (
    <div className="space-y-4">
      {/* Controles propios: mes + cliente */}
      <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Mes de facturación</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value || mesActual)}
            className="bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-[10px] text-white/40 mb-1">Cliente</label>
          <select
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
            className="w-full bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40"
          >
            <option value="">Todos</option>
            {clientes.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 bg-white/4 border border-white/8 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
        <div className="ml-auto">
          <ExportBar onPdf={exportPdf} onCsv={exportCsv} loading={pdfLoading} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Generando reporte SSA...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              <MesLabel mes={data?.mes ?? mes} /> · {fmtNum(total.solicitudes)} solicitud(es)
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Solicitudes" value={total.solicitudes} color="gold" />
            <div className="border rounded-xl p-4 text-center text-primary border-primary/20 bg-primary/8">
              <p className="text-2xl font-bold">{fmtQ(total.monto_total)}</p>
              <p className="text-[10px] text-white/50 mt-0.5">Monto Total</p>
            </div>
            <div className="border rounded-xl p-4 text-center text-green-400 border-green-500/20 bg-green-500/8">
              <p className="text-2xl font-bold">{fmtQ(total.monto_facturado)}</p>
              <p className="text-[10px] text-white/50 mt-0.5">Facturado</p>
            </div>
            <div className="border rounded-xl p-4 text-center text-yellow-400 border-yellow-500/20 bg-yellow-500/8">
              <p className="text-2xl font-bold">{fmtQ(total.monto_pendiente)}</p>
              <p className="text-[10px] text-white/50 mt-0.5">Pendiente</p>
            </div>
          </div>

          {/* Totales por cliente */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <p className="text-xs font-bold text-white/70">Totales por Cliente</p>
              <span className="text-[10px] text-white/30">{porCliente.length} cliente(s)</span>
            </div>
            {porCliente.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-xs">Sin solicitudes en el mes seleccionado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                      <th className="text-left px-4 py-2">Cliente</th>
                      <th className="text-right px-4 py-2">Solicitudes</th>
                      <th className="text-right px-4 py-2">Monto Total</th>
                      <th className="text-right px-4 py-2">Facturado</th>
                      <th className="text-right px-4 py-2">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCliente.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-2 text-white/80">{r.cliente_nombre}</td>
                        <td className="px-4 py-2 text-right text-white/60">{fmtNum(r.solicitudes)}</td>
                        <td className="px-4 py-2 text-right font-bold text-primary">{fmtQ(r.monto_total)}</td>
                        <td className="px-4 py-2 text-right text-green-400">{fmtQ(r.monto_facturado)}</td>
                        <td className="px-4 py-2 text-right text-yellow-400">{fmtQ(r.monto_pendiente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detalle con edición inline */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <p className="text-xs font-bold text-white/70">Detalle de Solicitudes (editar monto y tarifa)</p>
              <span className="text-[10px] text-white/30">{detalle.length} registro(s)</span>
            </div>
            {detalle.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-xs">Sin solicitudes en el mes seleccionado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                      <th className="text-left px-3 py-2">ID</th>
                      <th className="text-left px-3 py-2">Cliente</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-right px-3 py-2">Guardias</th>
                      <th className="text-right px-3 py-2">Monto (Q)</th>
                      <th className="text-left px-3 py-2">Tarifa</th>
                      <th className="text-left px-3 py-2">Facturación</th>
                      <th className="text-right px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((r: any) => {
                      const editando = editId === r.id;
                      return (
                        <tr key={r.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                          <td className="px-3 py-2 font-mono text-primary/70 text-[10px]">{r.id}</td>
                          <td className="px-3 py-2 text-white/70">
                            {r.cliente_nombre}
                            {r.sede_nombre && <span className="block text-[9px] text-white/30">{r.sede_nombre}</span>}
                          </td>
                          <td className="px-3 py-2 text-white/50">{r.tipo_solicitud ?? "—"}</td>
                          <td className="px-3 py-2 text-white/50">{fmtFecha(r.fecha)}</td>
                          <td className="px-3 py-2 text-right text-white/60">{r.cantidad_guardias ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {editando ? (
                              <input
                                type="number"
                                value={editMonto}
                                onChange={(e) => setEditMonto(e.target.value)}
                                placeholder="0"
                                className="w-24 bg-white/4 border border-primary/30 rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-primary/60"
                              />
                            ) : (
                              <span className="text-white/80 font-medium">{fmtQ(r.monto_estimado)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {editando ? (
                              <input
                                type="text"
                                value={editTarifa}
                                onChange={(e) => setEditTarifa(e.target.value)}
                                placeholder="Tarifa"
                                className="w-28 bg-white/4 border border-primary/30 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/60"
                              />
                            ) : (
                              <span className="text-white/50">{r.tarifa_aplicada ?? "—"}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              r.estado_facturacion === "facturado" ? "text-green-300 bg-green-500/10 border-green-500/25" :
                              r.estado_facturacion === "cobrado" ? "text-blue-300 bg-blue-500/10 border-blue-500/25" :
                              "text-yellow-300 bg-yellow-500/10 border-yellow-500/25"
                            }`}>
                              {FACT_LABEL[r.estado_facturacion] ?? r.estado_facturacion ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {editando ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => guardarEdicion(r.id)}
                                  disabled={saving}
                                  title="Guardar"
                                  className="p-1.5 rounded-lg text-green-300 bg-green-500/10 border border-green-500/25 hover:bg-green-500/20 transition-all disabled:opacity-40"
                                >
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </button>
                                <button
                                  onClick={cancelarEdicion}
                                  disabled={saving}
                                  title="Cancelar"
                                  className="p-1.5 rounded-lg text-white/40 bg-white/4 border border-white/8 hover:text-white/70 transition-all disabled:opacity-40"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => iniciarEdicion(r)}
                                title="Editar monto y tarifa"
                                className="p-1.5 rounded-lg text-primary/70 bg-primary/8 border border-primary/15 hover:bg-primary/15 hover:text-primary transition-all"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

const FILTROS_INICIAL: Filtros = { desde: "", hasta: "", cliente: "", estado: "", canal: "", prioridad: "" };

export default function Reportes() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabId>("operaciones");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAL);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (tab === "ssa") { setLoading(false); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchReporte(tab, filtros);
      setData(result);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [tab, filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreUsuario = currentUser?.nombre ?? "Admin";
  const rolActual = currentUser?.rol ?? "";

  const tabsVisibles = TABS.filter((t) => {
    if (t.id === "comercial" && !["admin", "comercial"].includes(rolActual)) return false;
    if (t.id === "rrhh" && !["admin", "rrhh"].includes(rolActual)) return false;
    if (t.id === "kpi" && !["admin"].includes(rolActual)) return false;
    return true;
  });

  return (
    <AdminLayout title="Reportería Profesional">
      <div className="space-y-5 max-w-[1400px]">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
              <FileBarChart2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Reportería Profesional</p>
              <p className="text-[10px] text-white/35">Reportes operativos con exportación PDF membretado</p>
            </div>
          </div>
          <button onClick={cargar} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {/* REPORTE ESPECIAL: Cobertura por Zona */}
        {["admin", "operaciones", "supervisor"].includes(rolActual) && (
          <a
            href="/admin/reportes/cobertura-zonas"
            className="flex items-center gap-3 bg-primary/5 border border-primary/15 hover:border-primary/35 hover:bg-primary/10 rounded-xl px-4 py-3 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0">
              <Map className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors">
                Reporte de Cobertura por Zona Operativa
              </p>
              <p className="text-[10px] text-white/30">
                Titulares · Relevos · Descubiertos · HE · Exportación CSV / PDF · Selector de período
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-primary transition-colors shrink-0" />
          </a>
        )}

        {/* REPORTE ESPECIAL: Plantilla de Turnos Vigente */}
        {["admin", "operaciones", "supervisor"].includes(rolActual) && (
          <a
            href="/admin/reportes/plantilla-turnos"
            className="flex items-center gap-3 bg-primary/5 border border-primary/15 hover:border-primary/35 hover:bg-primary/10 rounded-xl px-4 py-3 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0">
              <CalendarClock className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors">
                Reporte de Plantilla de Turnos Vigente
              </p>
              <p className="text-[10px] text-white/30">
                Titularidad · Turno 12/24h · Rotación 1-4 sem · Días trabajo y descanso por semana · Excel y PDF
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-primary transition-colors shrink-0" />
          </a>
        )}

        {/* FILTROS (la pestaña SSA usa sus propios controles de mes/cliente) */}
        {tab !== "ssa" && (
          <FiltrosBar filtros={filtros} onChange={setFiltros} onReset={() => setFiltros(FILTROS_INICIAL)} />
        )}

        {/* TABS */}
        <div className="flex flex-wrap gap-1 border-b border-white/5 pb-0">
          {tabsVisibles.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all border-b-2 ${
                  active
                    ? "text-primary border-primary bg-primary/6"
                    : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/3"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* CONTENIDO */}
        {tab === "ssa" ? (
          <div className="pb-8">
            <ReporteSsaFacturacion nombre={nombreUsuario} />
          </div>
        ) : (
          <>
            {loading && (
              <div className="flex items-center justify-center py-24 gap-2 text-white/30">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Generando reporte...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
                <button onClick={cargar} className="ml-auto text-xs text-red-400">Reintentar</button>
              </div>
            )}

            {!loading && !error && data && (
              <div className="pb-8">
                {tab === "operaciones" && <ReporteOperaciones data={data} filtros={filtros} nombre={nombreUsuario} />}
                {tab === "emergencias" && <ReporteEmergencias data={data} filtros={filtros} nombre={nombreUsuario} />}
                {tab === "tareas" && <ReporteTareas data={data} filtros={filtros} nombre={nombreUsuario} />}
                {tab === "rrhh" && <ReporteRrhh data={data} filtros={filtros} nombre={nombreUsuario} />}
                {tab === "comercial" && <ReporteComercial data={data} filtros={filtros} nombre={nombreUsuario} />}
                {tab === "kpi" && <ReporteKpi data={data} filtros={filtros} nombre={nombreUsuario} />}
              </div>
            )}
          </>
        )}

      </div>
    </AdminLayout>
  );
}
