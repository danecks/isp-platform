import { useEffect, useMemo, useState } from "react";
import {
  Loader2, AlertTriangle, ShieldAlert, Shirt, Sparkles,
  ClipboardCheck, FileWarning, MapPin, Users, LogOut, Check, RotateCcw,
  History, ChevronLeft, ChevronRight,
} from "lucide-react";
import { api, hoyISO, inputCls } from "./api";

interface ClienteSlim { id: number; nombre: string }

interface Kpis {
  total_inspecciones: number;
  agentes_inspeccionados: number;
  total_novedades: number;
  total_abandonos: number;
  total_alertas_armas: number;
  alertas_armas_abiertas: number;
}
interface FallaItem {
  clave: string; etiqueta: string;
  categoria: "equipo" | "presentacion" | "arma" | "otro";
  fallas: number;
}
interface AlertaTipo { tipo: string; total: number; abiertas: number; cerradas: number }
interface PuestoProb {
  puesto_id: number; puesto_nombre: string; cliente_nombre: string | null;
  inspecciones: number; fallas_equipo: number; alertas_armas: number; total_problemas: number;
}
interface NovedadRec {
  id: number; fecha: string; tipo?: string; observaciones: string | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
  supervisor_nombre: string | null; generada_at: string;
  datos: {
    agentes?: Array<{ agente_nombre: string }>;
    permanencia_segundos?: number;
    umbral_segundos?: number;
  } | null;
  reconocida?: boolean;
  reconocida_at?: string | null;
  reconocida_por?: string | null;
}
interface AlertaArmaRec {
  id: number; tipo: string; descripcion: string | null; estado: string;
  abierta_at: string;
  arma_codigo: string | null; arma_tipo: string | null;
  agente_nombre: string | null; supervisor_nombre: string | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
}

interface ReporteResp {
  ok: true;
  rango: { desde: string; hasta: string };
  kpis: Kpis;
  fallas_por_item: FallaItem[];
  alertas_armas_por_tipo: AlertaTipo[];
  top_puestos_problematicos: PuestoProb[];
  novedades_recientes: NovedadRec[];
  alertas_armas_recientes: AlertaArmaRec[];
}

const TIPO_ALERTA_LABEL: Record<string, string> = {
  arma_mal_estado: "Arma en mal estado",
  portacion_extraviada: "Portación extraviada",
  portacion_no_legible: "Portación no legible",
  tenencia_extraviada: "Tenencia extraviada",
  tenencia_no_legible: "Tenencia no legible",
  otro: "Otro",
};
function hace30ISO(): string {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function TabReportes() {
  const [subTab, setSubTab] = useState<"resumen" | "historial">("resumen");
  const [desde, setDesde] = useState(hace30ISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState<ClienteSlim[]>([]);
  const [data, setData] = useState<ReporteResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ clientes: ClienteSlim[] }>("/supervision-programaciones/catalogos")
      .then(r => setClientes(r.clientes || []))
      .catch(() => {});
  }, []);

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (clienteId) params.set("cliente_id", clienteId);
    api<ReporteResp>(`/supervision/reportes?${params}`)
      .then(setData)
      .catch(e => setError(e.message || "Error"))
      .finally(() => setLoading(false));
  }, [desde, hasta, clienteId, reloadKey]);
  const recargar = () => setReloadKey(k => k + 1);

  const fallasUniformeEquipo = useMemo(
    () => (data?.fallas_por_item || []).filter(f => f.categoria === "equipo"),
    [data]
  );
  const fallasPresentacion = useMemo(
    () => (data?.fallas_por_item || []).filter(f => f.categoria === "presentacion"),
    [data]
  );

  return (
    <div className="space-y-3">
      {/* Sub-pestañas */}
      <div className="flex gap-1 border-b border-white/10">
        <button
          type="button"
          onClick={() => setSubTab("resumen")}
          className={`text-xs px-3 py-1.5 -mb-px border-b-2 inline-flex items-center gap-1.5 ${
            subTab === "resumen"
              ? "border-emerald-400 text-white"
              : "border-transparent text-white/50 hover:text-white/80"
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" /> Resumen
        </button>
        <button
          type="button"
          onClick={() => setSubTab("historial")}
          className={`text-xs px-3 py-1.5 -mb-px border-b-2 inline-flex items-center gap-1.5 ${
            subTab === "historial"
              ? "border-emerald-400 text-white"
              : "border-transparent text-white/50 hover:text-white/80"
          }`}
        >
          <History className="w-3.5 h-3.5" /> Historial de abandonos
        </button>
      </div>

      {subTab === "historial" ? (
        <HistorialAbandonos clientes={clientes} />
      ) : (
        <ResumenView
          desde={desde} setDesde={setDesde}
          hasta={hasta} setHasta={setHasta}
          clienteId={clienteId} setClienteId={setClienteId}
          clientes={clientes}
          data={data} loading={loading} error={error}
          recargar={recargar}
          fallasUniformeEquipo={fallasUniformeEquipo}
          fallasPresentacion={fallasPresentacion}
        />
      )}
    </div>
  );
}

interface ResumenViewProps {
  desde: string; setDesde: (s: string) => void;
  hasta: string; setHasta: (s: string) => void;
  clienteId: string; setClienteId: (s: string) => void;
  clientes: ClienteSlim[];
  data: ReporteResp | null;
  loading: boolean;
  error: string | null;
  recargar: () => void;
  fallasUniformeEquipo: FallaItem[];
  fallasPresentacion: FallaItem[];
}

function ResumenView({
  desde, setDesde, hasta, setHasta, clienteId, setClienteId, clientes,
  data, loading, error, recargar, fallasUniformeEquipo, fallasPresentacion,
}: ResumenViewProps) {
  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end p-3 bg-[#0b1424] border border-white/10 rounded">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}
            className={inputCls} style={{ minWidth: 200 }}>
            <option value="">Todos</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-rose-300 text-sm p-3 border border-rose-500/30 rounded bg-rose-500/10">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-white/50 text-sm p-4 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando reportes…
        </div>
      )}

      {!loading && data && (
        <>
          <KpisGrid k={data.kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <CardFallas
              titulo="Equipo / Uniforme — items con más fallas"
              icono={<Shirt className="w-4 h-4" />}
              items={fallasUniformeEquipo}
              vacio="Sin fallas registradas en equipo o uniforme."
            />
            <CardFallas
              titulo="Presentación personal — items con más fallas"
              icono={<Sparkles className="w-4 h-4" />}
              items={fallasPresentacion}
              vacio="Sin fallas registradas en presentación."
            />
          </div>

          <CardAlertasArmas items={data.alertas_armas_por_tipo} />

          <CardTopPuestos items={data.top_puestos_problematicos} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <CardNovedades items={data.novedades_recientes} onCambio={recargar} />
            <CardAlertasRecientes items={data.alertas_armas_recientes} />
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────── subcomponentes ──

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-[#0b1424] border border-white/10 rounded p-3">
      <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-wide">
        {icon}{label}
      </div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {hint && <div className="text-[10px] text-white/40 mt-0.5">{hint}</div>}
    </div>
  );
}

function KpisGrid({ k }: { k: Kpis }) {
  const abandonos = k.total_abandonos || 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      <Kpi icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Inspecciones" value={k.total_inspecciones || 0} />
      <Kpi icon={<Users className="w-3.5 h-3.5" />} label="Agentes únicos" value={k.agentes_inspeccionados || 0} />
      <Kpi icon={<FileWarning className="w-3.5 h-3.5" />} label="Novedades" value={k.total_novedades || 0} />
      <div className={`bg-[#0b1424] border rounded p-3 ${abandonos > 0 ? "border-rose-500/60 ring-1 ring-rose-500/40 animate-pulse" : "border-white/10"}`}>
        <div className={`flex items-center gap-2 text-[11px] uppercase tracking-wide ${abandonos > 0 ? "text-rose-200" : "text-white/60"}`}>
          <LogOut className="w-3.5 h-3.5" /> Abandonos de puesto
        </div>
        <div className={`text-2xl font-bold mt-1 ${abandonos > 0 ? "text-rose-300" : "text-white"}`}>{abandonos}</div>
        <div className="text-[10px] text-white/40 mt-0.5">salidas sin completar visita</div>
      </div>
      <Kpi icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Alertas armas" value={k.total_alertas_armas || 0}
        hint={`${k.alertas_armas_abiertas || 0} abiertas`} />
      <Kpi icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Pendientes" value={k.alertas_armas_abiertas || 0}
        hint="alertas armas sin cerrar" />
    </div>
  );
}

function CardFallas({ titulo, icono, items, vacio }: {
  titulo: string; icono: React.ReactNode; items: FallaItem[]; vacio: string;
}) {
  const max = items.reduce((m, f) => Math.max(m, f.fallas), 0) || 1;
  return (
    <div className="bg-[#0b1424] border border-white/10 rounded p-3">
      <h3 className="text-xs font-semibold text-white/80 mb-2 inline-flex items-center gap-1.5">{icono}{titulo}</h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/40 italic">{vacio}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(f => (
            <li key={f.clave} className="text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white/80">{f.etiqueta}</span>
                <span className="text-rose-300 font-bold">{f.fallas}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                <div className="h-full bg-rose-500/60" style={{ width: `${(f.fallas / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CardAlertasArmas({ items }: { items: AlertaTipo[] }) {
  return (
    <div className="bg-[#0b1424] border border-white/10 rounded p-3">
      <h3 className="text-xs font-semibold text-white/80 mb-2 inline-flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4" /> Alertas de armas por tipo
      </h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/40 italic">Sin alertas en el rango.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/40 text-[10px] uppercase">
              <tr>
                <th className="text-left py-1">Tipo</th>
                <th className="text-right py-1">Total</th>
                <th className="text-right py-1">Abiertas</th>
                <th className="text-right py-1">Cerradas</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.tipo} className="border-t border-white/5">
                  <td className="py-1.5">{TIPO_ALERTA_LABEL[a.tipo] || a.tipo}</td>
                  <td className="py-1.5 text-right font-semibold">{a.total}</td>
                  <td className="py-1.5 text-right text-rose-300">{a.abiertas}</td>
                  <td className="py-1.5 text-right text-emerald-300">{a.cerradas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CardTopPuestos({ items }: { items: PuestoProb[] }) {
  return (
    <div className="bg-[#0b1424] border border-white/10 rounded p-3">
      <h3 className="text-xs font-semibold text-white/80 mb-2 inline-flex items-center gap-1.5">
        <MapPin className="w-4 h-4" /> Puestos con más problemas detectados
      </h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/40 italic">Sin problemas registrados en el rango.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/40 text-[10px] uppercase">
              <tr>
                <th className="text-left py-1">Puesto</th>
                <th className="text-left py-1">Cliente</th>
                <th className="text-right py-1">Inspec.</th>
                <th className="text-right py-1">Fallas equipo</th>
                <th className="text-right py-1">Alertas armas</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.puesto_id} className="border-t border-white/5">
                  <td className="py-1.5">{p.puesto_nombre}</td>
                  <td className="py-1.5 text-white/60">{p.cliente_nombre || "—"}</td>
                  <td className="py-1.5 text-right text-white/60">{p.inspecciones}</td>
                  <td className="py-1.5 text-right text-amber-300">{p.fallas_equipo}</td>
                  <td className="py-1.5 text-right text-rose-300">{p.alertas_armas}</td>
                  <td className="py-1.5 text-right font-bold">{p.total_problemas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CardNovedades({ items, onCambio }: { items: NovedadRec[]; onCambio: () => void }) {
  const abandonos = items.filter(n => n.tipo === "abandono_puesto" && !n.reconocida).length;
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errId, setErrId] = useState<string | null>(null);

  async function toggleReconocer(n: NovedadRec) {
    setBusyId(n.id); setErrId(null);
    try {
      await api(`/supervision-reportes/novedades/${n.id}/reconocer`, {
        method: "PATCH",
        body: JSON.stringify({ reconocida: !n.reconocida }),
      });
      onCambio();
    } catch (e: any) {
      setErrId(e?.message || "Error al actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-[#0b1424] border border-white/10 rounded p-3">
      <h3 className="text-xs font-semibold text-white/80 mb-2 inline-flex items-center gap-1.5">
        <FileWarning className="w-4 h-4" /> Novedades recientes
        {abandonos > 0 && (
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
            <LogOut className="w-3 h-3" /> {abandonos} abandono(s) sin atender
          </span>
        )}
      </h3>
      {errId && (
        <div role="alert" className="text-rose-300 text-[11px] mb-2">{errId}</div>
      )}
      {items.length === 0 ? (
        <p className="text-[11px] text-white/40 italic">Sin novedades en el rango.</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {items.map(n => {
            const esAbandono = n.tipo === "abandono_puesto";
            const reconocida = !!n.reconocida;
            const nAg = n.datos?.agentes?.length || 0;
            const permMin = n.datos?.permanencia_segundos != null
              ? Math.round(n.datos.permanencia_segundos / 60) : null;
            return (
              <li key={n.id}
                  className={`text-xs border-l-2 pl-2 transition-opacity ${
                    esAbandono
                      ? (reconocida
                          ? "border-white/15 bg-white/5 rounded-r py-1 opacity-60"
                          : "border-rose-500 bg-rose-500/5 rounded-r py-1")
                      : "border-violet-500/40"
                  }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white/90 inline-flex items-center gap-1.5 flex-wrap">
                    {esAbandono && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 uppercase tracking-wide border ${
                        reconocida
                          ? "bg-white/5 text-white/60 border-white/15 line-through"
                          : "bg-rose-500/25 text-rose-200 border-rose-500/50"
                      }`}>
                        <LogOut className="w-3 h-3" /> Abandono
                      </span>
                    )}
                    {esAbandono && reconocida && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1 uppercase tracking-wide">
                        <Check className="w-3 h-3" /> Reconocida
                      </span>
                    )}
                    {n.puesto_nombre || "Sin puesto"}
                  </span>
                  <span className="text-[10px] text-white/40 shrink-0">{n.generada_at}</span>
                </div>
                <div className="text-[11px] text-white/50">
                  {n.cliente_nombre || "—"} · {n.supervisor_nombre || "—"}
                  {esAbandono
                    ? (permMin != null ? ` · permanencia ${permMin} min` : "")
                    : ` · ${nAg} agente(s)`}
                </div>
                {n.observaciones && (
                  <p className={`text-[11px] mt-0.5 line-clamp-2 whitespace-pre-wrap ${
                    esAbandono && !reconocida ? "text-rose-200/90" : "text-white/70"
                  }`}>{n.observaciones}</p>
                )}
                {esAbandono && (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-white/40">
                      {reconocida
                        ? `Reconocida por ${n.reconocida_por || "—"} · ${n.reconocida_at || ""}`
                        : "Pendiente de reconocer"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleReconocer(n)}
                      disabled={busyId === n.id}
                      className={`text-[10px] px-2 py-0.5 rounded border inline-flex items-center gap-1 transition ${
                        reconocida
                          ? "border-white/15 text-white/60 hover:bg-white/5"
                          : "border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
                      } ${busyId === n.id ? "opacity-50 cursor-wait" : ""}`}
                    >
                      {busyId === n.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : (reconocida ? <RotateCcw className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                      {reconocida ? "Reabrir" : "Reconocer"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────────────────── Historial de abandonos ──

interface HistorialRow {
  id: number;
  fecha: string;
  observaciones: string | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  supervisor_nombre: string | null;
  generada_at: string;
  permanencia_segundos: number | null;
  reconocida: boolean;
  reconocida_at: string | null;
  reconocida_por: string | null;
  reconocida_por_user_id: number | null;
}
interface UsuarioRecon { id: number; username: string }
interface HistorialResp {
  ok: true;
  rango: { desde: string; hasta: string };
  page: number;
  page_size: number;
  total: number;
  rows: HistorialRow[];
  usuarios_reconocedores: UsuarioRecon[];
}

function HistorialAbandonos({ clientes }: { clientes: ClienteSlim[] }) {
  const [desde, setDesde] = useState(hace30ISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [clienteId, setClienteId] = useState("");
  type EstadoFiltro = "todos" | "pendiente" | "reconocida";
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  function parseEstado(v: string): EstadoFiltro {
    return v === "pendiente" || v === "reconocida" ? v : "todos";
  }
  const [reconocidaPor, setReconocidaPor] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<HistorialResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [desde, hasta, clienteId, estado, reconocidaPor, pageSize]);

  useEffect(() => {
    setLoading(true); setError(null);
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (clienteId) p.set("cliente_id", clienteId);
    if (estado !== "todos") p.set("estado", estado);
    if (reconocidaPor) p.set("reconocida_por", reconocidaPor);
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    api<HistorialResp>(`/supervision-reportes/abandonos?${p}`)
      .then(setData)
      .catch(e => setError(e?.message || "Error"))
      .finally(() => setLoading(false));
  }, [desde, hasta, clienteId, estado, reconocidaPor, page, pageSize]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end p-3 bg-[#0b1424] border border-white/10 rounded">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}
            className={inputCls} style={{ minWidth: 180 }}>
            <option value="">Todos</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Estado</label>
          <select value={estado} onChange={e => setEstado(parseEstado(e.target.value))} className={inputCls}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="reconocida">Reconocidas</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Reconocida por</label>
          <select value={reconocidaPor} onChange={e => setReconocidaPor(e.target.value)}
            className={inputCls} style={{ minWidth: 160 }}>
            <option value="">Cualquiera</option>
            {(data?.usuarios_reconocedores || []).map(u => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Por página</label>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className={inputCls}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-rose-300 text-sm p-3 border border-rose-500/30 rounded bg-rose-500/10">
          {error}
        </div>
      )}

      <div className="bg-[#0b1424] border border-white/10 rounded">
        <div className="flex items-center justify-between p-2 text-[11px] text-white/50">
          <span>
            {loading
              ? <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Cargando…</span>
              : data ? `${data.total} abandono(s) en el rango` : ""}
          </span>
          {data && data.total > 0 && (
            <div className="inline-flex items-center gap-1">
              <button type="button" disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1 border border-white/10 rounded disabled:opacity-30 hover:bg-white/5">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="px-2">Página {page} de {totalPages}</span>
              <button type="button" disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1 border border-white/10 rounded disabled:opacity-30 hover:bg-white/5">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/40 text-[10px] uppercase bg-white/[0.02]">
              <tr>
                <th className="text-left py-1.5 px-2">Fecha evento</th>
                <th className="text-left py-1.5 px-2">Generada</th>
                <th className="text-left py-1.5 px-2">Puesto</th>
                <th className="text-left py-1.5 px-2">Cliente</th>
                <th className="text-right py-1.5 px-2">Permanencia</th>
                <th className="text-left py-1.5 px-2">Estado</th>
                <th className="text-left py-1.5 px-2">Reconocida por</th>
                <th className="text-left py-1.5 px-2">Reconocida el</th>
              </tr>
            </thead>
            <tbody>
              {(!loading && data && data.rows.length === 0) && (
                <tr><td colSpan={8} className="py-6 text-center text-white/40 italic">
                  Sin abandonos para los filtros seleccionados.
                </td></tr>
              )}
              {data?.rows.map(r => {
                const permMin = r.permanencia_segundos != null
                  ? Math.round(r.permanencia_segundos / 60) : null;
                return (
                  <tr key={r.id} className={`border-t border-white/5 ${r.reconocida ? "" : "bg-rose-500/[0.04]"}`}>
                    <td className="py-1.5 px-2 whitespace-nowrap text-white/80">{r.fecha}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap text-white/50">{r.generada_at}</td>
                    <td className="py-1.5 px-2">{r.puesto_nombre || "—"}</td>
                    <td className="py-1.5 px-2 text-white/60">{r.cliente_nombre || "—"}</td>
                    <td className="py-1.5 px-2 text-right text-white/70">
                      {permMin != null ? `${permMin} min` : "—"}
                    </td>
                    <td className="py-1.5 px-2">
                      {r.reconocida ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1 uppercase tracking-wide">
                          <Check className="w-3 h-3" /> Reconocida
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1 uppercase tracking-wide">
                          <LogOut className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-white/80">{r.reconocida_por || "—"}</td>
                    <td className="py-1.5 px-2 text-white/60 whitespace-nowrap">{r.reconocida_at || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CardAlertasRecientes({ items }: { items: AlertaArmaRec[] }) {
  return (
    <div className="bg-[#0b1424] border border-white/10 rounded p-3">
      <h3 className="text-xs font-semibold text-white/80 mb-2 inline-flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4" /> Alertas de armas recientes
      </h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/40 italic">Sin alertas recientes.</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {items.map(a => (
            <li key={a.id} className="text-xs border-l-2 border-rose-500/40 pl-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white/90">{TIPO_ALERTA_LABEL[a.tipo] || a.tipo}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  a.estado === "abierta"
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                }`}>{a.estado}</span>
              </div>
              <div className="text-[11px] text-white/50">
                {a.arma_codigo ? `${a.arma_codigo} · ${a.arma_tipo || ""}` : "Sin arma"} · {a.agente_nombre || "—"}
              </div>
              <div className="text-[10px] text-white/40">
                {a.puesto_nombre || "—"} · {a.cliente_nombre || "—"} · {a.abierta_at}
              </div>
              {a.descripcion && <p className="text-[11px] text-white/70 mt-0.5 whitespace-pre-wrap">{a.descripcion}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
