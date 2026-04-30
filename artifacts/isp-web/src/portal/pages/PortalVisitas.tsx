import { useEffect, useMemo, useState } from "react";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import {
  UserCheck, Car, Search, Download, RefreshCw, BarChart3,
  TrendingUp, TrendingDown, Calendar, Filter, ArrowUpRight,
} from "lucide-react";

interface Visita {
  id: number;
  tipo: "persona" | "vehiculo";
  puesto_id: number;
  puesto_nombre: string | null;
  dpi_numero: string | null;
  nombre_completo: string | null;
  placa: string | null;
  marca_vehiculo: string | null;
  color_vehiculo: string | null;
  conductor_nombre: string | null;
  motivo: string | null;
  a_quien_visita: string | null;
  entrada_at: string;
  entrada_employee_nombre: string | null;
  salida_at: string | null;
  salida_employee_nombre: string | null;
}

interface EstadisticasResp {
  anio: number;
  mes: number;
  kpis: { personas_mes: number; vehiculos_mes: number; total_mes: number };
  kpis_mes_anterior: { personas_mes: number; vehiculos_mes: number; total_mes: number };
  por_dia: Array<{ dia: number; personas: number | string; vehiculos: number | string }>;
  top_puestos: Array<{ puesto_id: number; puesto_nombre: string; total: number; personas: number; vehiculos: number }>;
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fechaGT() {
  const a = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  return { anio: a.getFullYear(), mes: a.getMonth() + 1 };
}
function inicioDeMesGT() {
  const { anio, mes } = fechaGT();
  return `${anio}-${String(mes).padStart(2,"0")}-01`;
}
function hoyGT() {
  const a = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  return `${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,"0")}-${String(a.getDate()).padStart(2,"0")}`;
}
function fmtFechaHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-GT", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", timeZone:"America/Guatemala" });
}
function fmtDuracion(entrada: string, salida: string | null) {
  const e = new Date(entrada).getTime();
  const s = salida ? new Date(salida).getTime() : Date.now();
  const min = Math.max(0, Math.floor((s - e) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min/60)}h ${min%60}min`;
}

export default function PortalVisitas() {
  const [tab, setTab] = useState<"tiempo_real" | "historico" | "estadisticas">("tiempo_real");
  const fhoy = fechaGT();
  const [filtros, setFiltros] = useState({
    fecha_desde: inicioDeMesGT(),
    fecha_hasta: hoyGT(),
    tipo: "",
    q: "",
  });
  const [anio, setAnio] = useState(fhoy.anio);
  const [mes, setMes] = useState(fhoy.mes);
  const [loading, setLoading] = useState(false);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [stats, setStats] = useState<EstadisticasResp | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "tiempo_real") {
        // Para "tiempo real" pedimos abiertas (sin salida) — el backend no tiene flag estado en portal,
        // así que filtramos cliente-side
        const r = await portalGet<{ visitas: Visita[] }>(`/portal-cliente/visitas`);
        setVisitas(r.visitas.filter(v => !v.salida_at));
      } else {
        if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
        if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);
        if (filtros.tipo) params.set("tipo", filtros.tipo);
        if (filtros.q) params.set("q", filtros.q);
        const r = await portalGet<{ visitas: Visita[] }>(`/portal-cliente/visitas?${params.toString()}`);
        setVisitas(r.visitas);
      }
    } catch (err) {
      console.error("Error cargando visitas", err);
      setVisitas([]);
    } finally {
      setLoading(false);
    }
  }

  async function cargarStats() {
    setLoading(true);
    try {
      const r = await portalGet<EstadisticasResp>(`/portal-cliente/visitas/estadisticas?anio=${anio}&mes=${mes}`);
      setStats(r);
    } catch (err) {
      console.error("Error cargando estadísticas", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "tiempo_real" || tab === "historico") void cargar();
    else void cargarStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== "tiempo_real") return;
    const t = setInterval(() => void cargar(), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function pctChange(act: number, ant: number) {
    if (ant === 0) return { val: act > 0 ? 100 : 0, up: act >= 0 };
    const v = ((act - ant) / ant) * 100;
    return { val: Math.round(v), up: v >= 0 };
  }

  function exportarCSV() {
    const cols = ["Tipo","Puesto","Visitante","DPI","Placa","Marca","A quién visita","Motivo","Entrada","Salida","Tiempo"];
    const rows = visitas.map(v => [
      v.tipo,
      v.puesto_nombre ?? "",
      v.nombre_completo ?? v.conductor_nombre ?? "",
      v.dpi_numero ?? "",
      v.placa ?? "",
      v.marca_vehiculo ?? "",
      v.a_quien_visita ?? "",
      v.motivo ?? "",
      fmtFechaHora(v.entrada_at),
      v.salida_at ? fmtFechaHora(v.salida_at) : "Adentro",
      fmtDuracion(v.entrada_at, v.salida_at),
    ]);
    const csv = [cols, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `visitas-${hoyGT()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const personasAdentro = useMemo(() => visitas.filter(v => v.tipo === "persona"), [visitas]);
  const vehiculosAdentro = useMemo(() => visitas.filter(v => v.tipo === "vehiculo"), [visitas]);

  return (
    <PortalLayout title="Visitas (entradas y salidas)">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex gap-2 border-b border-white/10 pb-1 overflow-x-auto">
          {[
            { id: "tiempo_real", label: "En tiempo real", icon: RefreshCw },
            { id: "historico",   label: "Historial",      icon: Search },
            { id: "estadisticas",label: "Estadísticas",   icon: BarChart3 },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-t-md ${
                tab === t.id ? "bg-white/5 text-primary border-b-2 border-primary" : "text-white/50 hover:text-white"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "tiempo_real" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase font-semibold mb-1">
                  <UserCheck className="w-4 h-4" /> Personas adentro
                </div>
                <div className="text-3xl font-bold text-white">{personasAdentro.length}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-300 text-xs uppercase font-semibold mb-1">
                  <Car className="w-4 h-4" /> Vehículos adentro
                </div>
                <div className="text-3xl font-bold text-white">{vehiculosAdentro.length}</div>
              </div>
            </div>
            <p className="text-xs text-white/40">Se actualiza automáticamente cada 30 segundos.</p>
            <ListadoVisitasPortal visitas={visitas} loading={loading} />
          </div>
        )}

        {tab === "historico" && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/50 font-semibold uppercase">
                <Filter className="w-4 h-4" /> Filtros
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1">Desde</label>
                  <input type="date" value={filtros.fecha_desde} onChange={e => setFiltros({...filtros, fecha_desde: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1">Hasta</label>
                  <input type="date" value={filtros.fecha_hasta} onChange={e => setFiltros({...filtros, fecha_hasta: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1">Tipo</label>
                  <select value={filtros.tipo} onChange={e => setFiltros({...filtros, tipo: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white">
                    <option value="">Todos</option>
                    <option value="persona">Personas</option>
                    <option value="vehiculo">Vehículos</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Buscar por DPI, nombre, placa…" value={filtros.q}
                  onChange={e => setFiltros({...filtros, q: e.target.value})}
                  onKeyDown={e => { if (e.key === "Enter") void cargar(); }}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                <button onClick={cargar} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4" /> Buscar
                </button>
                <button onClick={exportarCSV} disabled={visitas.length === 0} className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" /> Excel
                </button>
              </div>
            </div>
            <div className="text-xs text-white/40">{loading ? "Cargando…" : `${visitas.length} registros`}</div>
            <ListadoVisitasPortal visitas={visitas} loading={loading} />
          </div>
        )}

        {tab === "estadisticas" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-white/40" />
              <select value={mes} onChange={e => setMes(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white">
                {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={anio} onChange={e => setAnio(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white">
                {[fhoy.anio - 1, fhoy.anio, fhoy.anio + 1].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button onClick={cargarStats} className="ml-auto flex items-center gap-2 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
              </button>
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiPortal label="Personas en el mes" valor={Number(stats.kpis.personas_mes)} cmp={pctChange(Number(stats.kpis.personas_mes), Number(stats.kpis_mes_anterior.personas_mes))} color="emerald" icon={UserCheck} />
                  <KpiPortal label="Vehículos en el mes" valor={Number(stats.kpis.vehiculos_mes)} cmp={pctChange(Number(stats.kpis.vehiculos_mes), Number(stats.kpis_mes_anterior.vehiculos_mes))} color="blue" icon={Car} />
                  <KpiPortal label="Total visitas" valor={Number(stats.kpis.total_mes)} cmp={pctChange(Number(stats.kpis.total_mes), Number(stats.kpis_mes_anterior.total_mes))} color="amber" icon={ArrowUpRight} />
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Visitas por día</h3>
                  <GraficoBarrasPortal data={stats.por_dia} />
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Top puestos con más visitas</h3>
                  {stats.top_puestos.length === 0 ? (
                    <p className="text-xs text-white/40">Sin datos en este mes.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.top_puestos.map((p, i) => {
                        const max = Number(stats.top_puestos[0].total) || 1;
                        const ancho = (Number(p.total) / max) * 100;
                        return (
                          <div key={p.puesto_id}>
                            <div className="flex items-baseline justify-between mb-1">
                              <div className="text-sm text-white truncate">
                                <span className="text-white/40 mr-2">#{i+1}</span>{p.puesto_nombre}
                              </div>
                              <div className="text-sm font-bold text-primary">{p.total}</div>
                            </div>
                            <div className="h-2 bg-white/10 rounded overflow-hidden">
                              <div className="h-full bg-primary rounded" style={{ width: `${ancho}%` }} />
                            </div>
                            <div className="text-[10px] text-white/40 mt-0.5">
                              {p.personas} personas · {p.vehiculos} vehículos
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

function KpiPortal({ label, valor, cmp, color, icon: Icon }: any) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    blue:    "bg-blue-500/10 border-blue-500/30 text-blue-300",
    amber:   "bg-amber-500/10 border-amber-500/30 text-amber-300",
  };
  return (
    <div className={`border rounded-lg p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 text-xs uppercase font-semibold mb-2">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-3xl font-bold text-white">{valor.toLocaleString("es-GT")}</div>
      <div className="flex items-center gap-1 text-xs mt-2">
        {cmp.up ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-rose-400" />}
        <span className={cmp.up ? "text-emerald-400" : "text-rose-400"}>{cmp.up ? "+" : ""}{cmp.val}%</span>
        <span className="text-white/40">vs mes anterior</span>
      </div>
    </div>
  );
}

function GraficoBarrasPortal({ data }: { data: Array<{ dia: number; personas: number | string; vehiculos: number | string }> }) {
  if (data.length === 0) return <p className="text-xs text-white/40">Sin datos.</p>;
  const max = Math.max(...data.map(d => Number(d.personas) + Number(d.vehiculos))) || 1;
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-40 px-1">
        {data.map(d => {
          const p = Number(d.personas); const v = Number(d.vehiculos); const total = p + v;
          const altP = (p / max) * 100; const altV = (v / max) * 100;
          return (
            <div key={d.dia} className="flex-1 flex flex-col items-center justify-end" title={`Día ${d.dia}: ${p} personas + ${v} vehículos`}>
              <div className="w-full flex flex-col-reverse" style={{ height: `${(total / max) * 100}%` }}>
                <div className="w-full bg-emerald-500" style={{ height: `${(altP / (altP + altV || 1)) * 100}%` }} />
                <div className="w-full bg-blue-500" style={{ height: `${(altV / (altP + altV || 1)) * 100}%` }} />
              </div>
              <div className="text-[9px] text-white/40 mt-1">{d.dia}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 text-[11px] text-white/50 pt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded" />Personas</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded" />Vehículos</span>
      </div>
    </div>
  );
}

function ListadoVisitasPortal({ visitas, loading }: { visitas: Visita[]; loading: boolean }) {
  if (loading && visitas.length === 0) return <div className="text-center py-12 text-white/50">Cargando…</div>;
  if (visitas.length === 0) {
    return <div className="text-center py-12 text-white/40 bg-white/5 rounded-lg border border-white/10">Sin visitas con esos criterios.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-xs uppercase text-white/50">
          <tr>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Visitante</th>
            <th className="px-3 py-2 text-left">Puesto</th>
            <th className="px-3 py-2 text-left">A quién visita</th>
            <th className="px-3 py-2 text-left">Entrada</th>
            <th className="px-3 py-2 text-left">Salida</th>
            <th className="px-3 py-2 text-left">Tiempo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {visitas.map(v => (
            <tr key={v.id} className="hover:bg-white/5">
              <td className="px-3 py-2">
                {v.tipo === "persona" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <UserCheck className="w-3 h-3" /> Persona
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    <Car className="w-3 h-3" /> Vehículo
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                {v.tipo === "persona" ? (
                  <div>
                    <div className="text-white font-medium">{v.nombre_completo ?? "—"}</div>
                    <div className="text-[11px] text-white/40 font-mono">{v.dpi_numero}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-white font-mono font-bold">{v.placa}</div>
                    <div className="text-[11px] text-white/40">{[v.marca_vehiculo, v.color_vehiculo].filter(Boolean).join(" · ")}</div>
                    {v.conductor_nombre && <div className="text-[11px] text-white/50">Conductor: {v.conductor_nombre}</div>}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-white text-xs">{v.puesto_nombre}</td>
              <td className="px-3 py-2 text-xs">
                <div className="text-white">{v.a_quien_visita ?? "—"}</div>
                {v.motivo && <div className="text-[11px] text-white/40 truncate max-w-[200px]" title={v.motivo}>{v.motivo}</div>}
              </td>
              <td className="px-3 py-2 text-xs text-white/70">
                {fmtFechaHora(v.entrada_at)}
                {v.entrada_employee_nombre && <div className="text-[10px] text-white/40">por {v.entrada_employee_nombre}</div>}
              </td>
              <td className="px-3 py-2 text-xs">
                {v.salida_at ? (
                  <>
                    <span className="text-white/70">{fmtFechaHora(v.salida_at)}</span>
                    {v.salida_employee_nombre && <div className="text-[10px] text-white/40">por {v.salida_employee_nombre}</div>}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Adentro
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-white/70 whitespace-nowrap">{fmtDuracion(v.entrada_at, v.salida_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
