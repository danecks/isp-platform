import { useState, useMemo, useEffect } from "react";
import { Loader2, Download, FileBarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientesPlanificables, useReporteDemanda, type FilaReporte } from "./use-planificacion";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function todayLocal(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() - 360);
  return d.toISOString().split("T")[0];
}

function firstOfMonth(iso: string) {
  return iso.slice(0, 7) + "-01";
}

// CUST-FASE1: reporte "Demanda histórica" filtrable por cliente y rango.
// Muestra día x día (base + excepción aplicada → cantidad efectiva), totales
// agrupados por mes y permite exportar a CSV para contabilidad.
export default function ReporteDemandaPanel() {
  const { toast } = useToast();
  const { data: clientes = [] } = useClientesPlanificables();
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [desde, setDesde] = useState(() => firstOfMonth(todayLocal()));
  const [hasta, setHasta] = useState(() => todayLocal());

  useEffect(() => {
    if (!clienteId && clientes.length > 0) setClienteId(clientes[0].id);
  }, [clientes, clienteId]);

  const reporte = useReporteDemanda({ clienteId, desde, hasta });

  const totalesPorMes = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of reporte.data?.filas ?? []) {
      const k = f.fecha.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + f.efectiva);
    }
    return Array.from(m.entries()).sort();
  }, [reporte.data]);

  const handleExportCSV = () => {
    if (!reporte.data) return;
    const cliente = reporte.data.clienteNombre.replace(/[^a-zA-Z0-9_-]+/g, "_");
    const filename = `demanda_${cliente}_${desde}_a_${hasta}.csv`;
    const header = ["fecha", "dia_semana", "cantidad_base", "cantidad_excepcion", "cantidad_efectiva", "motivo"];
    const rows = reporte.data.filas.map((f) => [
      f.fecha,
      DIAS[f.diaSemana],
      String(f.base),
      f.excepcion === null ? "" : String(f.excepcion),
      String(f.efectiva),
      (f.motivo ?? "").replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => (/[,"\n]/.test(c) ? `"${c}"` : c)).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV descargado", description: filename });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Cliente</label>
          <select
            value={clienteId ?? ""}
            onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
            className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40 min-w-[240px]"
          >
            {clientes.length === 0 && <option value="">— Sin clientes —</option>}
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!reporte.data || reporte.data.filas.length === 0}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-500/15 border border-green-500/30 text-green-300 rounded-lg font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-40"
        >
          <Download className="w-3 h-3" /> Exportar CSV
        </button>
      </div>

      {reporte.isLoading && (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
      )}

      {reporte.isError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-xs text-red-300">
          {(reporte.error as any)?.message || "Error al cargar el reporte"}
        </div>
      )}

      {reporte.data && (
        <ReporteContenido data={reporte.data} totalesPorMes={totalesPorMes} />
      )}
    </div>
  );
}

function ReporteContenido({
  data, totalesPorMes,
}: {
  data: { clienteNombre: string; desde: string; hasta: string; total: number; filas: FilaReporte[] };
  totalesPorMes: [string, number][];
}) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Cliente</p>
          <p className="text-sm font-bold text-white truncate">{data.clienteNombre}</p>
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Rango</p>
          <p className="text-sm font-bold text-white">{data.desde} → {data.hasta}</p>
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Días</p>
          <p className="text-sm font-bold text-white">{data.filas.length}</p>
        </div>
        <div className="bg-[#0c1829] border border-primary/20 rounded-xl p-4">
          <p className="text-[10px] text-primary/60 uppercase tracking-widest mb-1">Total agentes-día</p>
          <p className="text-2xl font-bold text-primary">{data.total}</p>
        </div>
      </div>

      {totalesPorMes.length > 0 && (
        <div className="bg-[#0c1829] border border-white/6 rounded-xl p-4">
          <p className="text-xs font-semibold text-white/60 mb-2 flex items-center gap-1.5">
            <FileBarChart2 className="w-3.5 h-3.5" /> Totales por mes
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {totalesPorMes.map(([mes, total]) => (
              <div key={mes} className="bg-[#060e1c] border border-white/8 rounded-lg px-3 py-2">
                <p className="text-[10px] text-white/30">{mes}</p>
                <p className="text-sm font-bold text-white">{total}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#0c1829] border border-white/6 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0c1829] z-10">
              <tr className="text-white/30 border-b border-white/8 uppercase text-[10px]">
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Día</th>
                <th className="text-center px-3 py-2">Base</th>
                <th className="text-center px-3 py-2">Excepción</th>
                <th className="text-center px-3 py-2">Efectiva</th>
                <th className="text-left px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {data.filas.map((f) => {
                const tieneExc = f.excepcion !== null;
                const diff = tieneExc ? f.efectiva - f.base : 0;
                return (
                  <tr key={f.fecha} className="border-b border-white/4 hover:bg-white/2">
                    <td className="px-3 py-1.5 text-white/70">{f.fecha}</td>
                    <td className="px-3 py-1.5 text-white/40">{DIAS[f.diaSemana]}</td>
                    <td className="px-3 py-1.5 text-center text-white/60">{f.base}</td>
                    <td className="px-3 py-1.5 text-center">
                      {tieneExc ? (
                        <span className={`font-bold ${diff > 0 ? "text-blue-300" : diff < 0 ? "text-amber-300" : "text-white/40"}`}>
                          {f.excepcion}{diff !== 0 && <span className="text-[9px] ml-1 opacity-60">({diff > 0 ? "+" : ""}{diff})</span>}
                        </span>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center text-white font-bold">{f.efectiva}</td>
                    <td className="px-3 py-1.5 text-white/40">{f.motivo || <span className="text-white/15">—</span>}</td>
                  </tr>
                );
              })}
              {data.filas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-white/30 text-xs">Sin datos en el rango.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
