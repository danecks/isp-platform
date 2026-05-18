import { useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, Clock, AlertTriangle, MapPin, Loader2, Repeat, Star, LogOut, RefreshCw } from "lucide-react";
import { api, hoyISO } from "./api";
import type { SupervisorDisponible } from "./types";

interface Kpis {
  total: number; pendientes: number; en_curso: number;
  completadas: number; no_realizadas: number; canceladas: number;
  rutinas: number; comisiones: number; extraordinarias: number;
  cumplimiento_pct: number;
  abandonos?: number;
}
interface PorSupervisor {
  id: number; nombre: string;
  total: number; completadas: number; pendientes: number;
  en_curso: number; no_realizadas: number;
}
interface AbandonoItem {
  id: number;
  generada_at: string;
  observaciones: string | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  supervisor_nombre: string | null;
  datos: { permanencia_segundos?: number; umbral_segundos?: number } | null;
}

const POLL_MS = 30000;

function hace7DiasISO(): string {
  const d = new Date(); d.setDate(d.getDate() - 7);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function TabDashboard() {
  const [desde, setDesde] = useState(hace7DiasISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [supervisor, setSupervisor] = useState("");
  const [supervisores, setSupervisores] = useState<SupervisorDisponible[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [porSup, setPorSup] = useState<PorSupervisor[]>([]);
  const [abandonos, setAbandonos] = useState<AbandonoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refrescadoAt, setRefrescadoAt] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api<{ supervisores: SupervisorDisponible[] }>("/supervision-zonas/supervisores-disponibles")
      .then(r => setSupervisores(r.supervisores))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    const cargar = (mostrarSpinner: boolean) => {
      if (mostrarSpinner) setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (supervisor) params.set("supervisor", supervisor);
      api<{ kpis: Kpis; por_supervisor: PorSupervisor[]; abandonos_recientes?: AbandonoItem[] }>(
        `/supervision-dashboard?${params}`
      )
        .then(r => {
          if (cancelado) return;
          setKpis(r.kpis);
          setPorSup(r.por_supervisor);
          setAbandonos(r.abandonos_recientes || []);
          setRefrescadoAt(new Date());
        })
        .catch(e => { if (!cancelado) setError(e.message || "Error"); })
        .finally(() => { if (!cancelado && mostrarSpinner) setLoading(false); });
    };
    cargar(true);
    // Auto-refresh para que las alertas de abandono aparezcan sin recargar.
    pollRef.current = setInterval(() => cargar(false), POLL_MS);
    return () => {
      cancelado = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [desde, hasta, supervisor]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end p-3 bg-[#0b1424] border border-white/10 rounded">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white" />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white" />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Supervisor</label>
          <select value={supervisor} onChange={e => setSupervisor(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white"
            style={{ minWidth: 180 }}>
            <option value="">Todos</option>
            {supervisores.map(s => <option key={s.id} value={s.id}>{s.nombre_completo}</option>)}
          </select>
        </div>
        <div className="ml-auto text-[10px] text-white/40 inline-flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          Auto-refresh cada {POLL_MS / 1000}s
          {refrescadoAt && <> · actualizado a las {refrescadoAt.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>}
        </div>
      </div>

      {error && <div role="alert" className="text-rose-300 text-sm p-3 border border-rose-500/30 rounded bg-rose-500/10">{error}</div>}
      {loading && <div className="text-white/50 text-sm p-4 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>}

      {!loading && kpis && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <Kpi icon={Activity}     label="Total programadas"   value={kpis.total} />
            <Kpi icon={CheckCircle2} label="Completadas"         value={kpis.completadas} accent="emerald"
                 hint={`${kpis.cumplimiento_pct}% cumplimiento`} />
            <Kpi icon={Clock}        label="Pendientes / En curso" value={kpis.pendientes + kpis.en_curso}
                 hint={`${kpis.pendientes} pend · ${kpis.en_curso} en curso`} />
            <Kpi icon={AlertTriangle} label="No realizadas"      value={kpis.no_realizadas} accent="rose" />
            <Kpi icon={LogOut}       label="Abandonos de puesto" value={kpis.abandonos ?? 0} accent="rose"
                 hint="Salidas sin inspección registrada" pulse={(kpis.abandonos ?? 0) > 0} />
            <Kpi icon={Repeat}       label="Rutinas"             value={kpis.rutinas} />
            <Kpi icon={Star}         label="Extraordinarias"     value={kpis.extraordinarias} accent="amber" />
            <Kpi icon={MapPin}       label="Comisiones"          value={kpis.comisiones} />
            <Kpi icon={AlertTriangle} label="Canceladas"         value={kpis.canceladas} />
          </div>

          {abandonos.length > 0 && (
            <div className="border border-rose-500/40 rounded-lg overflow-hidden bg-rose-500/5">
              <div className="bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 inline-flex items-center gap-2 w-full">
                <LogOut className="w-3.5 h-3.5" />
                Abandonos de puesto detectados ({abandonos.length})
              </div>
              <ul className="divide-y divide-rose-500/20">
                {abandonos.map(a => {
                  const mins = a.datos?.permanencia_segundos
                    ? Math.round(a.datos.permanencia_segundos / 60)
                    : null;
                  return (
                    <li key={a.id} className="p-2.5 text-xs flex flex-wrap gap-x-3 gap-y-1 items-center">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-100 font-bold uppercase text-[10px]">
                        Abandono
                      </span>
                      <span className="text-white font-semibold">{a.puesto_nombre || "—"}</span>
                      {a.cliente_nombre && <span className="text-white/60">· {a.cliente_nombre}</span>}
                      <span className="text-white/60">· {a.supervisor_nombre || "—"}</span>
                      {mins !== null && (
                        <span className="text-amber-200">· Permanencia: {mins} min</span>
                      )}
                      <span className="ml-auto text-white/40">{a.generada_at}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="border border-white/10 rounded-lg overflow-hidden">
            <div className="bg-white/5 px-3 py-2 text-xs font-bold text-white/80">Por supervisor</div>
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-white/60">
                <tr>
                  <th className="px-2 py-1.5 text-left">Supervisor</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                  <th className="px-2 py-1.5 text-right">Completadas</th>
                  <th className="px-2 py-1.5 text-right">En curso</th>
                  <th className="px-2 py-1.5 text-right">Pendientes</th>
                  <th className="px-2 py-1.5 text-right">No realizadas</th>
                  <th className="px-2 py-1.5 text-right">% cumpl.</th>
                </tr>
              </thead>
              <tbody>
                {porSup.length === 0 && (
                  <tr><td colSpan={7} className="text-white/40 text-center p-4">Sin programaciones en el rango.</td></tr>
                )}
                {porSup.map(s => {
                  const cump = s.total > 0 ? Math.round((s.completadas / s.total) * 1000) / 10 : 0;
                  return (
                    <tr key={s.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-2 py-1.5 text-white">{s.nombre}</td>
                      <td className="px-2 py-1.5 text-right text-white/80">{s.total}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-300">{s.completadas}</td>
                      <td className="px-2 py-1.5 text-right text-blue-300">{s.en_curso}</td>
                      <td className="px-2 py-1.5 text-right text-amber-300">{s.pendientes}</td>
                      <td className="px-2 py-1.5 text-right text-rose-300">{s.no_realizadas}</td>
                      <td className="px-2 py-1.5 text-right text-white/80">{cump}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const ACCENT: Record<string, string> = {
  default: "text-white",
  emerald: "text-emerald-300",
  rose:    "text-rose-300",
  amber:   "text-amber-200",
};

function Kpi({ icon: Icon, label, value, hint, accent = "default", pulse = false }: {
  icon: any; label: string; value: number | string; hint?: string; accent?: string; pulse?: boolean;
}) {
  return (
    <div className={`p-3 border rounded ${pulse ? "bg-rose-500/10 border-rose-500/50 animate-pulse" : "bg-[#0b1424] border-white/10"}`}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] text-white/50 uppercase tracking-wide">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${ACCENT[accent]}`} />
      </div>
      <p className={`text-xl font-bold mt-1 ${ACCENT[accent]}`}>{value}</p>
      {hint && <p className="text-[10px] text-white/40 mt-0.5">{hint}</p>}
    </div>
  );
}
