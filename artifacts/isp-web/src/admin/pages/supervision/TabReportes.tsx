import { useEffect, useMemo, useState } from "react";
import {
  Loader2, AlertTriangle, ShieldAlert, Shirt, Sparkles,
  ClipboardCheck, FileWarning, MapPin, Users, LogOut,
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
  }, [desde, hasta, clienteId]);

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
            <CardNovedades items={data.novedades_recientes} />
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

function CardNovedades({ items }: { items: NovedadRec[] }) {
  const abandonos = items.filter(n => n.tipo === "abandono_puesto").length;
  return (
    <div className="bg-[#0b1424] border border-white/10 rounded p-3">
      <h3 className="text-xs font-semibold text-white/80 mb-2 inline-flex items-center gap-1.5">
        <FileWarning className="w-4 h-4" /> Novedades recientes
        {abandonos > 0 && (
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
            <LogOut className="w-3 h-3" /> {abandonos} abandono(s)
          </span>
        )}
      </h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-white/40 italic">Sin novedades en el rango.</p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {items.map(n => {
            const esAbandono = n.tipo === "abandono_puesto";
            const nAg = n.datos?.agentes?.length || 0;
            const permMin = n.datos?.permanencia_segundos != null
              ? Math.round(n.datos.permanencia_segundos / 60) : null;
            return (
              <li key={n.id}
                  className={`text-xs border-l-2 pl-2 ${
                    esAbandono
                      ? "border-rose-500 bg-rose-500/5 rounded-r py-1"
                      : "border-violet-500/40"
                  }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white/90 inline-flex items-center gap-1.5">
                    {esAbandono && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-500/50 inline-flex items-center gap-1 uppercase tracking-wide">
                        <LogOut className="w-3 h-3" /> Abandono
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
                    esAbandono ? "text-rose-200/90" : "text-white/70"
                  }`}>{n.observaciones}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
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
