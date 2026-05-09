import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import {
  UserCheck, Car, Search, Calendar, Download, RefreshCw, BarChart3,
  TrendingUp, TrendingDown, ArrowRight, Filter, Image as ImageIcon, X,
  ArrowUpRight,
} from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

interface Visita {
  id: number;
  tipo: "persona" | "vehiculo";
  puesto_id: number;
  puesto_nombre: string | null;
  cliente_id: number | null;
  cliente_nombre: string | null;
  dpi_numero: string | null;
  nombre_completo: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  placa: string | null;
  marca_vehiculo: string | null;
  color_vehiculo: string | null;
  conductor_nombre: string | null;
  conductor_dpi_numero: string | null;
  motivo: string | null;
  a_quien_visita: string | null;
  observaciones: string | null;
  entrada_at: string;
  entrada_employee_nombre: string | null;
  salida_at: string | null;
  salida_employee_nombre: string | null;
  tiene_foto_persona: boolean;
  tiene_foto_vehiculo: boolean;
  tiene_foto_dpi: boolean;
  tiene_foto_conductor_dpi: boolean;
}

interface EstadisticasResp {
  anio: number;
  mes: number;
  kpis: { personas_mes: number; vehiculos_mes: number; total_mes: number };
  kpis_mes_anterior: { personas_mes: number; vehiculos_mes: number; total_mes: number };
  por_dia: Array<{ dia: number; personas: number; vehiculos: number }>;
  top_puestos: Array<{ puesto_id: number; puesto_nombre: string; cliente_nombre: string; total: number; personas: number; vehiculos: number }>;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getSessionRaw() {
  return getSessionToken();
}
function getRol() {
  try {
    const raw = getSessionRaw();
    if (!raw) return "";
    const u = JSON.parse(raw);
    return u?.rol ?? "";
  } catch {
    return "";
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: {
      "x-isp-session": getSessionRaw(),
      "x-isp-role": getRol() || "admin",
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function fechaGT(): { anio: number; mes: number } {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  return { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 };
}

function inicioDeMesGT(): string {
  const { anio, mes } = fechaGT();
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

function hoyGT(): string {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtFechaHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-GT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Guatemala",
  });
}

function fmtDuracion(entrada: string, salida: string | null): string {
  const e = new Date(entrada).getTime();
  const s = (salida ? new Date(salida).getTime() : Date.now());
  const min = Math.max(0, Math.floor((s - e) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const r = min % 60;
  return `${h}h ${r}min`;
}

export function VisitasContent({ embedded = false }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<"tiempo_real" | "historico" | "estadisticas">("tiempo_real");
  const fhoy = fechaGT();
  const [filtros, setFiltros] = useState({
    fecha_desde: inicioDeMesGT(),
    fecha_hasta: hoyGT(),
    cliente_id: "",
    puesto_id: "",
    tipo: "",
    estado: "",
    q: "",
  });
  const [anio, setAnio] = useState(fhoy.anio);
  const [mes, setMes] = useState(fhoy.mes);
  const [statsClienteId, setStatsClienteId] = useState<string>("");
  const [statsPuestoId, setStatsPuestoId] = useState<string>("");
  const [statsClientes, setStatsClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [statsPuestos, setStatsPuestos] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [stats, setStats] = useState<EstadisticasResp | null>(null);
  const [fotoModal, setFotoModal] = useState<{ visitaId: number; tipo: string; titulo: string } | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  // Cargar listado
  async function cargar() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "tiempo_real") {
        params.set("estado", "abiertas");
      } else {
        if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
        if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);
        if (filtros.cliente_id) params.set("cliente_id", filtros.cliente_id);
        if (filtros.puesto_id) params.set("puesto_id", filtros.puesto_id);
        if (filtros.tipo) params.set("tipo", filtros.tipo);
        if (filtros.estado) params.set("estado", filtros.estado);
        if (filtros.q) params.set("q", filtros.q);
      }
      const r = await apiFetch<{ visitas: Visita[]; total: number }>(`/admin/visitas?${params.toString()}`);
      setVisitas(r.visitas);
    } catch (err: any) {
      console.error("Error cargando visitas", err);
      setVisitas([]);
    } finally {
      setLoading(false);
    }
  }

  async function cargarStats() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anio: String(anio), mes: String(mes) });
      if (statsClienteId) params.set("cliente_id", statsClienteId);
      if (statsPuestoId) params.set("puesto_id", statsPuestoId);
      const r = await apiFetch<EstadisticasResp>(`/admin/visitas/estadisticas?${params.toString()}`);
      setStats(r);
    } catch (err) {
      console.error("Error cargando estadísticas", err);
    } finally {
      setLoading(false);
    }
  }

  // Cargar lista de clientes (y opcionalmente puestos del cliente seleccionado)
  async function cargarFiltrosStats(clienteId?: string) {
    try {
      const qs = clienteId ? `?cliente_id=${clienteId}` : "";
      const r = await apiFetch<{ clientes: { id: number; nombre: string }[]; puestos: { id: number; nombre: string }[] }>(
        `/admin/visitas/filtros${qs}`
      );
      setStatsClientes(r.clientes);
      setStatsPuestos(r.puestos);
    } catch (err) {
      console.error("Error cargando filtros estadísticas", err);
    }
  }

  useEffect(() => {
    if (tab === "tiempo_real" || tab === "historico") void cargar();
    else {
      void cargarStats();
      if (statsClientes.length === 0) void cargarFiltrosStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Recargar stats al cambiar mes/año/cliente/puesto (solo en tab estadísticas)
  useEffect(() => {
    if (tab !== "estadisticas") return;
    void cargarStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes, statsClienteId, statsPuestoId]);

  // Al cambiar cliente: recargar lista de puestos de ese cliente
  // (el reseteo de puesto ya ocurre sincrónicamente en el onChange para evitar fetch inconsistente)
  useEffect(() => {
    if (tab !== "estadisticas") return;
    void cargarFiltrosStats(statsClienteId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsClienteId]);

  // Auto-refresh cada 30s en tiempo real
  useEffect(() => {
    if (tab !== "tiempo_real") return;
    const t = setInterval(() => void cargar(), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function verFoto(visita_id: number, tipoFoto: string, titulo: string) {
    setFotoModal({ visitaId: visita_id, tipo: tipoFoto, titulo });
    setFotoUrl(null);
    try {
      const r = await apiFetch<{ url: string }>(`/admin/visitas/foto/${visita_id}/${tipoFoto}`);
      setFotoUrl(r.url);
    } catch {
      setFotoUrl(null);
    }
  }

  function exportarCSV() {
    const cols = [
      "Tipo", "Puesto", "Cliente", "DPI", "Nombre", "Placa", "Marca", "Conductor",
      "Motivo", "A quién visita", "Entrada", "Agente entrada", "Salida", "Agente salida", "Duración",
    ];
    const rows = visitas.map(v => [
      v.tipo,
      v.puesto_nombre ?? "",
      v.cliente_nombre ?? "",
      v.dpi_numero ?? "",
      v.nombre_completo ?? "",
      v.placa ?? "",
      v.marca_vehiculo ?? "",
      v.conductor_nombre ?? "",
      v.motivo ?? "",
      v.a_quien_visita ?? "",
      fmtFechaHora(v.entrada_at),
      v.entrada_employee_nombre ?? "",
      v.salida_at ? fmtFechaHora(v.salida_at) : "Adentro",
      v.salida_employee_nombre ?? "",
      fmtDuracion(v.entrada_at, v.salida_at),
    ]);
    const csv = [cols, ...rows].map(r =>
      r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `visitas-${hoyGT()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // KPIs comparación
  function pctChange(act: number, ant: number): { val: number; up: boolean } {
    if (ant === 0) return { val: act > 0 ? 100 : 0, up: act >= 0 };
    const v = ((act - ant) / ant) * 100;
    return { val: Math.round(v), up: v >= 0 };
  }

  const personasAdentro = useMemo(() => visitas.filter(v => v.tipo === "persona"), [visitas]);
  const vehiculosAdentro = useMemo(() => visitas.filter(v => v.tipo === "vehiculo"), [visitas]);

  const inner = (
    <>
    <div className={embedded ? "space-y-4" : "p-4 sm:p-6 space-y-4"}>
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
          {[
            { id: "tiempo_real", label: "En tiempo real", icon: RefreshCw },
            { id: "historico",   label: "Histórico",      icon: Search },
            { id: "estadisticas",label: "Estadísticas",   icon: BarChart3 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-t-md ${
                tab === t.id
                  ? "bg-slate-900 text-primary border-b-2 border-primary"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* TAB: TIEMPO REAL */}
        {tab === "tiempo_real" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-wide font-semibold mb-1">
                  <UserCheck className="w-4 h-4" /> Personas adentro
                </div>
                <div className="text-3xl font-bold text-white">{personasAdentro.length}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-300 text-xs uppercase tracking-wide font-semibold mb-1">
                  <Car className="w-4 h-4" /> Vehículos adentro
                </div>
                <div className="text-3xl font-bold text-white">{vehiculosAdentro.length}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Se actualiza automáticamente cada 30 segundos.</p>
              <button onClick={cargar} className="flex items-center gap-2 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refrescar
              </button>
            </div>

            <ListadoVisitas visitas={visitas} loading={loading} verFoto={verFoto} />
          </div>
        )}

        {/* TAB: HISTÓRICO */}
        {tab === "historico" && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wide">
                <Filter className="w-4 h-4" /> Filtros
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Desde</label>
                  <input type="date" value={filtros.fecha_desde} onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Hasta</label>
                  <input type="date" value={filtros.fecha_hasta} onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tipo</label>
                  <select value={filtros.tipo} onChange={e => setFiltros({ ...filtros, tipo: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
                    <option value="">Todos</option>
                    <option value="persona">Personas</option>
                    <option value="vehiculo">Vehículos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Estado</label>
                  <select value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
                    <option value="">Todos</option>
                    <option value="abiertas">Adentro</option>
                    <option value="cerradas">Ya salieron</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Buscar por DPI, nombre, placa o a quién visita…"
                  value={filtros.q}
                  onChange={e => setFiltros({ ...filtros, q: e.target.value })}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                  onKeyDown={e => { if (e.key === "Enter") void cargar(); }}
                />
                <button onClick={cargar} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4" /> Buscar
                </button>
                <button onClick={exportarCSV} disabled={visitas.length === 0} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" /> Excel
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              {loading ? "Cargando…" : `${visitas.length} registros`}
            </div>

            <ListadoVisitas visitas={visitas} loading={loading} verFoto={verFoto} />
          </div>
        )}

        {/* TAB: ESTADÍSTICAS */}
        {tab === "estadisticas" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select value={mes} onChange={e => setMes(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <select value={anio} onChange={e => setAnio(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white">
                {[fhoy.anio - 1, fhoy.anio, fhoy.anio + 1].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={statsClienteId}
                onChange={e => {
                  // Reset sede sincrónicamente para evitar fetch con sede del cliente anterior
                  setStatsPuestoId("");
                  setStatsClienteId(e.target.value);
                }}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white max-w-[220px]"
                title="Filtrar por cliente"
              >
                <option value="">Todos los clientes</option>
                {statsClientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <select
                value={statsPuestoId}
                onChange={e => setStatsPuestoId(e.target.value)}
                disabled={!statsClienteId}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white max-w-[220px] disabled:opacity-40 disabled:cursor-not-allowed"
                title={statsClienteId ? "Filtrar por sede" : "Elegí primero un cliente"}
              >
                <option value="">{statsClienteId ? "Todas las sedes" : "Sede (elegí cliente)"}</option>
                {statsPuestos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <button onClick={cargarStats} className="ml-auto flex items-center gap-2 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-white">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
              </button>
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard
                    label="Personas en el mes"
                    valor={Number(stats.kpis.personas_mes)}
                    cmp={pctChange(Number(stats.kpis.personas_mes), Number(stats.kpis_mes_anterior.personas_mes))}
                    color="emerald"
                    icon={UserCheck}
                  />
                  <KpiCard
                    label="Vehículos en el mes"
                    valor={Number(stats.kpis.vehiculos_mes)}
                    cmp={pctChange(Number(stats.kpis.vehiculos_mes), Number(stats.kpis_mes_anterior.vehiculos_mes))}
                    color="blue"
                    icon={Car}
                  />
                  <KpiCard
                    label="Total visitas"
                    valor={Number(stats.kpis.total_mes)}
                    cmp={pctChange(Number(stats.kpis.total_mes), Number(stats.kpis_mes_anterior.total_mes))}
                    color="amber"
                    icon={ArrowUpRight}
                  />
                </div>

                {/* Gráfico de barras por día */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Visitas por día</h3>
                  <GraficoBarras data={stats.por_dia} />
                </div>

                {/* Top 5 puestos */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Top 5 puestos con más visitas</h3>
                  {stats.top_puestos.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin datos en este mes.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.top_puestos.map((p, i) => {
                        const max = Number(stats.top_puestos[0].total) || 1;
                        const ancho = (Number(p.total) / max) * 100;
                        return (
                          <div key={p.puesto_id}>
                            <div className="flex items-baseline justify-between mb-1">
                              <div className="text-sm text-white truncate">
                                <span className="text-slate-500 mr-2">#{i + 1}</span>
                                {p.puesto_nombre}
                                {p.cliente_nombre && <span className="text-slate-500 text-xs ml-1">· {p.cliente_nombre}</span>}
                              </div>
                              <div className="text-sm font-bold text-primary">{p.total}</div>
                            </div>
                            <div className="h-2 bg-slate-800 rounded overflow-hidden">
                              <div className="h-full bg-primary rounded" style={{ width: `${ancho}%` }} />
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
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

      {/* Modal de foto */}
      {fotoModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setFotoModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <h4 className="text-sm font-semibold text-white">{fotoModal.titulo}</h4>
              <button onClick={() => setFotoModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3">
              {fotoUrl ? (
                <img src={fotoUrl} alt={fotoModal.titulo} className="w-full rounded" />
              ) : (
                <div className="text-center py-12 text-slate-400">Cargando…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) return inner;
  return <AdminLayout title="Visitas (entradas y salidas)">{inner}</AdminLayout>;
}

export default function AdminVisitas() {
  return <VisitasContent />;
}

function KpiCard({ label, valor, cmp, color, icon: Icon }: any) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    blue:    "bg-blue-500/10 border-blue-500/30 text-blue-300",
    amber:   "bg-amber-500/10 border-amber-500/30 text-amber-300",
  };
  return (
    <div className={`border rounded-lg p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold mb-2">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-3xl font-bold text-white">{valor.toLocaleString("es-GT")}</div>
      <div className="flex items-center gap-1 text-xs mt-2">
        {cmp.up ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-rose-400" />}
        <span className={cmp.up ? "text-emerald-400" : "text-rose-400"}>
          {cmp.up ? "+" : ""}{cmp.val}%
        </span>
        <span className="text-slate-400">vs mes anterior</span>
      </div>
    </div>
  );
}

function GraficoBarras({ data }: { data: Array<{ dia: number; personas: number | string; vehiculos: number | string }> }) {
  if (data.length === 0) return <p className="text-xs text-slate-500">Sin datos.</p>;
  const max = Math.max(...data.map(d => Number(d.personas) + Number(d.vehiculos))) || 1;
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-40 px-1">
        {data.map(d => {
          const p = Number(d.personas);
          const v = Number(d.vehiculos);
          const total = p + v;
          const altP = (p / max) * 100;
          const altV = (v / max) * 100;
          return (
            <div key={d.dia} className="flex-1 flex flex-col items-center justify-end" title={`Día ${d.dia}: ${p} personas + ${v} vehículos`}>
              <div className="w-full flex flex-col-reverse" style={{ height: `${(total / max) * 100}%` }}>
                <div className="w-full bg-emerald-500" style={{ height: `${(altP / (altP + altV || 1)) * 100}%` }} />
                <div className="w-full bg-blue-500" style={{ height: `${(altV / (altP + altV || 1)) * 100}%` }} />
              </div>
              <div className="text-[9px] text-slate-500 mt-1">{d.dia}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded" />Personas</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded" />Vehículos</span>
      </div>
    </div>
  );
}

function ListadoVisitas({ visitas, loading, verFoto }: {
  visitas: Visita[]; loading: boolean;
  verFoto: (id: number, tipo: string, titulo: string) => void;
}) {
  if (loading && visitas.length === 0) {
    return <div className="text-center py-12 text-slate-400">Cargando…</div>;
  }
  if (visitas.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-lg border border-slate-800">
        Sin visitas con esos criterios.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Visitante</th>
            <th className="px-3 py-2 text-left">Puesto</th>
            <th className="px-3 py-2 text-left">A quién visita</th>
            <th className="px-3 py-2 text-left">Entrada</th>
            <th className="px-3 py-2 text-left">Salida</th>
            <th className="px-3 py-2 text-left">Tiempo</th>
            <th className="px-3 py-2 text-left">Fotos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {visitas.map(v => (
            <tr key={v.id} className="hover:bg-slate-900/40">
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
                    <div className="text-[11px] text-slate-500 font-mono">{v.dpi_numero}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-white font-mono font-bold">{v.placa}</div>
                    <div className="text-[11px] text-slate-500">
                      {[v.marca_vehiculo, v.color_vehiculo].filter(Boolean).join(" · ")}
                    </div>
                    {v.conductor_nombre && (
                      <div className="text-[11px] text-slate-400">Conductor: {v.conductor_nombre}</div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="text-white text-xs">{v.puesto_nombre}</div>
                <div className="text-[11px] text-slate-500">{v.cliente_nombre}</div>
              </td>
              <td className="px-3 py-2 text-xs">
                <div className="text-white">{v.a_quien_visita ?? "—"}</div>
                {v.motivo && <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={v.motivo}>{v.motivo}</div>}
              </td>
              <td className="px-3 py-2 text-xs text-slate-300">
                {fmtFechaHora(v.entrada_at)}
                {v.entrada_employee_nombre && <div className="text-[10px] text-slate-500">por {v.entrada_employee_nombre}</div>}
              </td>
              <td className="px-3 py-2 text-xs">
                {v.salida_at ? (
                  <>
                    <span className="text-slate-300">{fmtFechaHora(v.salida_at)}</span>
                    {v.salida_employee_nombre && <div className="text-[10px] text-slate-500">por {v.salida_employee_nombre}</div>}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Adentro
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-slate-300 whitespace-nowrap">
                {fmtDuracion(v.entrada_at, v.salida_at)}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  {v.tiene_foto_dpi && (
                    <button onClick={() => verFoto(v.id, "dpi", "DPI - " + (v.nombre_completo ?? ""))}
                      className="p-1 bg-slate-800 hover:bg-slate-700 rounded" title="Foto del DPI">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                    </button>
                  )}
                  {v.tiene_foto_persona && (
                    <button onClick={() => verFoto(v.id, "persona", "Foto - " + (v.nombre_completo ?? ""))}
                      className="p-1 bg-slate-800 hover:bg-slate-700 rounded" title="Foto de la persona">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                    </button>
                  )}
                  {v.tiene_foto_vehiculo && (
                    <button onClick={() => verFoto(v.id, "vehiculo", "Vehículo - " + (v.placa ?? ""))}
                      className="p-1 bg-slate-800 hover:bg-slate-700 rounded" title="Foto del vehículo">
                      <Car className="w-3.5 h-3.5 text-blue-300" />
                    </button>
                  )}
                  {v.tiene_foto_conductor_dpi && (
                    <button onClick={() => verFoto(v.id, "conductor_dpi", "DPI conductor - " + (v.conductor_nombre ?? ""))}
                      className="p-1 bg-slate-800 hover:bg-slate-700 rounded" title="DPI del conductor">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
