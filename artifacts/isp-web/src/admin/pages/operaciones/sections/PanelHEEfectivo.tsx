import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Trash2, Banknote, Search, X } from "lucide-react";
import { API_BASE } from "../utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type FilaHE = {
  id: string;
  origen: string;
  fecha: string;
  empleado_nombre: string | null;
  horas_extra: number | null;
  monto: number | null;
  pagado_por: string | null;
  fecha_pago: string | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
};

const fmtFecha = (s: unknown) => {
  if (!s) return "—";
  const d = String(s).slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}-${d[1]}-${d[0]}` : String(s);
};
const fmtHoras = (n: unknown) => n == null || n === "" ? "—" : `${(Number(n) || 0).toLocaleString("es-GT", { maximumFractionDigits: 1 })} h`;
const fmtQ = (n: unknown) => n == null || n === "" ? "—" : `Q ${(Number(n) || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const origenLabel = (o: string) => o === "pizarron" ? "Pizarrón" : o === "anexo" ? "Anexo HE" : (o ?? "—");

export function PanelHEEfectivo() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const hoyIso = hoy.toISOString().slice(0, 10);
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoyIso);
  const [busqueda, setBusqueda] = useState("");
  const [origenFiltro, setOrigenFiltro] = useState<"todos" | "anexo" | "pizarron">("todos");
  const [rows, setRows] = useState<FilaHE[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);

  const puedeAnular = currentUser?.rol === "admin" || currentUser?.rol === "operaciones";

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`${API_BASE}/rrhh/horas-extra-cash?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar las HE en efectivo");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const q = busqueda.trim().toLowerCase();
  const filtradas = rows.filter((r) => {
    if (origenFiltro !== "todos" && r.origen !== origenFiltro) return false;
    if (q && ![r.empleado_nombre, r.puesto_nombre, r.cliente_nombre]
      .some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    return true;
  });
  const totalHoras = filtradas.reduce((s, r) => s + (Number(r.horas_extra) || 0), 0);
  const totalMonto = filtradas.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  const puestoCliente = (r: FilaHE) => {
    const puesto = r.puesto_nombre || "—";
    return r.cliente_nombre ? `${puesto} — ${r.cliente_nombre}` : puesto;
  };

  const anular = async (r: FilaHE) => {
    if (anulandoId) return;
    const quien = r.empleado_nombre ? `de ${r.empleado_nombre}` : "";
    if (!window.confirm(`¿Anular esta hora extra en efectivo ${quien}?\n\nSe revertirá el pago y la HE volverá a quedar pendiente.`)) return;
    const motivo = window.prompt("Motivo de la anulación (opcional):") ?? "";
    setAnulandoId(r.id);
    try {
      const res = await fetch(`${API_BASE}/rrhh/horas-extra-cash/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, motivo, usuario: currentUser?.nombre ?? currentUser?.username ?? "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "HE en efectivo anulada", description: "El pago se revirtió correctamente." });
      await cargar();
    } catch (e: any) {
      toast({ title: "No se pudo anular", description: e.message ?? "Error al anular la HE", variant: "destructive" });
    } finally {
      setAnulandoId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 mr-2">
          <Banknote className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Horas Extra en Efectivo</span>
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Origen</label>
          <select value={origenFiltro} onChange={(e) => setOrigenFiltro(e.target.value as "todos" | "anexo" | "pizarron")}
            className="bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40 [&_option]:bg-slate-800">
            <option value="todos">Todos</option>
            <option value="anexo">Eventos RRHH (Anexo HE)</option>
            <option value="pizarron">Pizarrón</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] text-white/40 mb-1">Buscar colaborador</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, puesto o cliente..."
              className="w-full bg-white/4 border border-white/8 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40" />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Registros</p>
          <p className="text-2xl font-bold text-white">{filtradas.length}</p>
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Total pagado</p>
          <p className="text-2xl font-bold text-emerald-400">{fmtQ(totalMonto)}</p>
        </div>
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Total horas extra</p>
          <p className="text-2xl font-bold text-amber-400">{totalHoras.toLocaleString("es-GT", { maximumFractionDigits: 1 })} h</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Cargando...</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={cargar} className="ml-auto text-xs text-red-400">Reintentar</button>
        </div>
      )}
      {!loading && !error && (
        filtradas.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">
            {rows.length === 0
              ? "No hay horas extra pagadas en efectivo en este período."
              : `No hay coincidencias para "${busqueda.trim()}" en este período.`}
          </div>
        ) : (
          <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 border-b border-white/8">
                  <th className="text-left font-medium px-3 py-2.5">Fecha</th>
                  <th className="text-left font-medium px-3 py-2.5">Colaborador</th>
                  <th className="text-left font-medium px-3 py-2.5">Puesto / Cliente</th>
                  <th className="text-left font-medium px-3 py-2.5">Origen</th>
                  <th className="text-right font-medium px-3 py-2.5">Horas extra</th>
                  <th className="text-right font-medium px-3 py-2.5">Monto</th>
                  <th className="text-left font-medium px-3 py-2.5">Pagado por</th>
                  <th className="text-left font-medium px-3 py-2.5">Fecha de pago</th>
                  {puedeAnular && <th className="text-right font-medium px-3 py-2.5">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr key={r.id} className="border-b border-white/4 hover:bg-white/3">
                    <td className="px-3 py-2 text-white/70 whitespace-nowrap">{fmtFecha(r.fecha)}</td>
                    <td className="px-3 py-2 text-white/90 font-medium">{r.empleado_nombre ?? "—"}</td>
                    <td className="px-3 py-2 text-white/50">{puestoCliente(r)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${r.origen === "pizarron" ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/20" : "text-violet-300 bg-violet-500/10 border-violet-500/20"}`}>{origenLabel(r.origen)}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-amber-400 font-semibold whitespace-nowrap">{fmtHoras(r.horas_extra)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-semibold whitespace-nowrap">{fmtQ(r.monto)}</td>
                    <td className="px-3 py-2 text-white/50">{r.pagado_por ?? "—"}</td>
                    <td className="px-3 py-2 text-white/50 whitespace-nowrap">{r.fecha_pago ? fmtFecha(r.fecha_pago) : "—"}</td>
                    {puedeAnular && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => anular(r)} disabled={anulandoId === r.id}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 disabled:opacity-40">
                          {anulandoId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Anular
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
