import { useState, useEffect } from "react";
import {
  X, Loader2, Plus, Trash2, Check, AlertTriangle,
  Users, Package, BarChart3, FileText, ShoppingCart,
  ChevronDown, Building2, Phone, Mail, MapPin,
  UserCheck, RefreshCw,
} from "lucide-react";

function getSession() {
  return sessionStorage.getItem("isp_admin_session_v2") || "";
}
function api(path: string, opts?: RequestInit) {
  return fetch(path, {
    ...opts,
    headers: { "x-isp-session": getSession(), "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
}

const JORNADAS = ["24x24", "12x12", "8x8", "6x6", "turno_unico"];
const FACTOR: Record<string, number> = { "24x24": 2, "12x12": 2, "8x8": 3, "6x6": 4, "turno_unico": 1 };

function fmtQ(n: number) {
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  empresa: string;
  contacto: string;
  telefono?: string;
  correo?: string;
  servicio?: string;
  ubicacion?: string;
  canal?: string;
  estado: string;
  ejecutivo?: string;
  notas?: string;
  num_puestos?: number;
  tipo_jornada?: string;
  createdAt: string;
}

interface ArticuloBodega {
  id: number;
  nombre: string;
  codigo_prefijo: string;
  costo_unitario: number;
  stock_disponible: number;
  tipo_rastreo: string;
}

interface DotacionItem {
  id: number;
  lead_id: number;
  articulo_id: number | null;
  nombre_articulo: string;
  es_equipo_personal: boolean;
  cantidad_por_puesto: number;
  costo_unitario: number;
  stock_disponible: number;
  total_necesario?: number;
  faltante?: number;
  costo_faltante?: number;
}

interface Resumen {
  personal: {
    agentes_necesarios: number;
    agentes_disponibles: number;
    total_activos: number;
    deficit: number;
  };
  items: DotacionItem[];
  totales: { inversion_total: number; hay_gaps: boolean; hay_deficit_personal: boolean };
}

// ─── Tab Datos ────────────────────────────────────────────────────────────────
function TabDatos({ lead, onLeadUpdate }: { lead: Lead; onLeadUpdate: (l: Lead) => void }) {
  const ESTADOS = ["nuevo", "contactado", "cotizado", "ganado", "perdido"];
  const [saving, setSaving] = useState(false);

  async function cambiarEstado(e: string) {
    setSaving(true);
    const r = await api(`/api/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ estado: e }) });
    if (r.ok) { const d = await r.json(); onLeadUpdate({ ...lead, ...d }); }
    setSaving(false);
  }

  const fields: [string, string | undefined][] = [
    ["Empresa",   lead.empresa],
    ["Contacto",  lead.contacto],
    ["Teléfono",  lead.telefono],
    ["Correo",    lead.correo],
    ["Servicio",  lead.servicio],
    ["Ubicación", lead.ubicacion],
    ["Canal",     lead.canal],
    ["Ejecutivo", lead.ejecutivo],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([label, val]) => val ? (
          <div key={label} className="bg-white/3 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm text-white/80">{val}</p>
          </div>
        ) : null)}
      </div>

      {lead.notas && (
        <div className="bg-white/3 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notas</p>
          <p className="text-sm text-white/60 whitespace-pre-wrap">{lead.notas}</p>
        </div>
      )}

      <div>
        <p className="text-xs text-white/40 mb-2">Cambiar estado</p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => cambiarEstado(e)}
              disabled={saving || e === lead.estado}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                e === lead.estado
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {e === lead.estado && saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Servicio & Personal ──────────────────────────────────────────────────
function TabServicio({ lead, onLeadUpdate }: { lead: Lead; onLeadUpdate: (l: Lead) => void }) {
  const [numPuestos, setNumPuestos] = useState(lead.num_puestos ?? 0);
  const [tipoJornada, setTipoJornada] = useState(lead.tipo_jornada ?? "24x24");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const factor = FACTOR[tipoJornada] ?? 2;
  const agentesNecesarios = numPuestos * factor;

  const [resumen, setResumen] = useState<Resumen["personal"] | null>(null);
  const [loadingRes, setLoadingRes] = useState(false);

  useEffect(() => {
    setLoadingRes(true);
    api(`/api/dotacion/lead/${lead.id}/resumen`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setResumen(d.personal); })
      .finally(() => setLoadingRes(false));
  }, [lead.id]);

  async function guardar() {
    setSaving(true);
    await api(`/api/dotacion/lead/${lead.id}/servicio`, {
      method: "PATCH",
      body: JSON.stringify({ num_puestos: numPuestos, tipo_jornada: tipoJornada }),
    });
    onLeadUpdate({ ...lead, num_puestos: numPuestos, tipo_jornada: tipoJornada });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
    // Refresh resumen
    const r = await api(`/api/dotacion/lead/${lead.id}/resumen`);
    if (r.ok) { const d = await r.json(); setResumen(d.personal); }
  }

  const dispDB = resumen?.agentes_disponibles;
  const deficitDB = resumen ? Math.max(0, agentesNecesarios - (resumen.agentes_disponibles)) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Número de puestos contratados</label>
          <input
            type="number" min={0}
            value={numPuestos}
            onChange={e => setNumPuestos(parseInt(e.target.value) || 0)}
            className="w-full bg-[#060f1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Tipo de jornada</label>
          <select
            value={tipoJornada}
            onChange={e => setTipoJornada(e.target.value)}
            className="w-full bg-[#060f1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
          >
            {JORNADAS.map(j => <option key={j} value={j}>{j.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={guardar}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-primary/15 hover:bg-primary/25 text-primary text-sm rounded-lg border border-primary/20 transition-colors"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Check className="w-3 h-3" />}
        {saved ? "Guardado" : "Guardar servicio"}
      </button>

      {/* Cálculo de agentes */}
      <div className="bg-[#060f1a] border border-white/8 rounded-xl p-4 space-y-3">
        <p className="text-xs text-white/40 uppercase tracking-widest">Cálculo de personal</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/3 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-white/30 mb-0.5">Puestos × factor {tipoJornada}</p>
            <p className="text-xl font-bold text-white">{agentesNecesarios}</p>
            <p className="text-[10px] text-white/30">agentes necesarios</p>
          </div>
          <div className="bg-white/3 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-white/30 mb-0.5">Activos sin asignación</p>
            {loadingRes ? (
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
            ) : (
              <>
                <p className="text-xl font-bold text-white">{dispDB ?? "—"}</p>
                <p className="text-[10px] text-white/30">de {resumen?.total_activos ?? "—"} activos totales</p>
              </>
            )}
          </div>
        </div>

        {!loadingRes && resumen && (
          deficitDB > 0 ? (
            <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-300">Déficit de {deficitDB} agente{deficitDB !== 1 ? "s" : ""}</p>
                <p className="text-xs text-orange-400/70">Se necesita contratar {deficitDB} agente{deficitDB !== 1 ? "s" : ""} nuevos para cubrir este contrato.</p>
                <p className="text-xs text-orange-400/50 mt-0.5">El kit de ingreso de bodega se aplicará solo a estos {deficitDB} nuevos.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <p className="text-sm text-emerald-300">Hay personal disponible suficiente para este contrato.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Tab Dotación ─────────────────────────────────────────────────────────────
function TabDotacion({ lead }: { lead: Lead }) {
  const [items, setItems] = useState<DotacionItem[]>([]);
  const [articulos, setArticulos] = useState<ArticuloBodega[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const [manual, setManual] = useState({ nombre: "", es_personal: false, cantidad: 1, costo: 0 });

  async function cargar() {
    const [dotRes, artRes] = await Promise.all([
      api(`/api/dotacion/lead/${lead.id}`).then(r => r.json()),
      api("/api/dotacion/articulos").then(r => r.json()),
    ]);
    setItems(Array.isArray(dotRes) ? dotRes : []);
    setArticulos(Array.isArray(artRes) ? artRes : []);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, [lead.id]);

  async function agregarDesdeBodega(art: ArticuloBodega) {
    setSaving(true);
    await api(`/api/dotacion/lead/${lead.id}/item`, {
      method: "POST",
      body: JSON.stringify({
        articulo_id: art.id,
        nombre_articulo: art.nombre,
        es_equipo_personal: false,
        cantidad_por_puesto: 1,
        costo_unitario: art.costo_unitario,
      }),
    });
    await cargar();
    setShowPicker(false);
    setQuery("");
    setSaving(false);
  }

  async function agregarManual() {
    if (!manual.nombre.trim()) return;
    setSaving(true);
    await api(`/api/dotacion/lead/${lead.id}/item`, {
      method: "POST",
      body: JSON.stringify({
        nombre_articulo: manual.nombre,
        es_equipo_personal: manual.es_personal,
        cantidad_por_puesto: manual.cantidad,
        costo_unitario: manual.costo,
      }),
    });
    await cargar();
    setManual({ nombre: "", es_personal: false, cantidad: 1, costo: 0 });
    setSaving(false);
  }

  async function eliminar(itemId: number) {
    await api(`/api/dotacion/lead/${lead.id}/item/${itemId}`, { method: "DELETE" });
    setItems(p => p.filter(i => i.id !== itemId));
  }

  async function togglePersonal(item: DotacionItem) {
    await api(`/api/dotacion/lead/${lead.id}/item/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ es_equipo_personal: !item.es_equipo_personal }),
    });
    setItems(p => p.map(i => i.id === item.id ? { ...i, es_equipo_personal: !i.es_equipo_personal } : i));
  }

  const filtered = articulos.filter(a => !query || a.nombre.toLowerCase().includes(query.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-16 text-white/30"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Lista de ítems */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-white/25 text-sm border border-dashed border-white/10 rounded-xl">
          Sin artículos en la dotación. Agrega artículos de bodega o manualmente.
        </div>
      ) : (
        <div className="bg-[#060f1a] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/25 border-b border-white/5 uppercase tracking-wide text-[10px]">
                <th className="text-left px-4 py-2.5">Artículo</th>
                <th className="text-left px-3 py-2.5">Tipo</th>
                <th className="text-center px-3 py-2.5">Cant/puesto</th>
                <th className="text-right px-3 py-2.5">Costo unit.</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-2.5 text-white/80 font-medium">{item.nombre_articulo}</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => togglePersonal(item)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                        item.es_equipo_personal
                          ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                          : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                      }`}
                    >
                      {item.es_equipo_personal ? "Personal" : "Del puesto"}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-center text-white/60">{item.cantidad_por_puesto}</td>
                  <td className="px-3 py-2.5 text-right text-white/50 font-mono">
                    {item.costo_unitario ? fmtQ(Number(item.costo_unitario)) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => eliminar(item.id)} className="text-red-400/50 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-white/2 text-[10px] text-white/30 flex gap-4">
            <span className="text-purple-400/60">● Personal</span> = solo nuevas contrataciones (uniforme, botas)
            <span className="text-blue-400/60">● Del puesto</span> = todos los puestos (arma, baton, linterna…)
          </div>
        </div>
      )}

      {/* Picker de bodega */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowPicker(p => !p)}
          className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs rounded-lg border border-primary/20 transition-colors"
        >
          <Package className="w-3.5 h-3.5" />
          Agregar de bodega
        </button>
      </div>

      {showPicker && (
        <div className="bg-[#060f1a] border border-white/10 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-white/8">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar artículo de bodega..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
            {filtered.slice(0, 30).map(a => (
              <button
                key={a.id}
                onClick={() => agregarDesdeBodega(a)}
                disabled={saving}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="text-xs text-white/80">{a.nombre}</p>
                  <p className="text-[10px] text-white/30">ISP-{a.codigo_prefijo} · {a.stock_disponible} disponibles</p>
                </div>
                {a.costo_unitario > 0 && (
                  <span className="text-[10px] text-white/40 font-mono ml-2">{fmtQ(a.costo_unitario)}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-4 py-3 text-xs text-white/25">Sin resultados</p>}
          </div>
        </div>
      )}

      {/* Agregar manual */}
      <details className="group">
        <summary className="text-xs text-white/40 hover:text-white/60 cursor-pointer flex items-center gap-1.5 select-none">
          <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
          Agregar artículo manual (no está en bodega)
        </summary>
        <div className="mt-3 bg-[#060f1a] border border-white/8 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-white/30 block mb-1">Nombre del artículo *</label>
              <input value={manual.nombre} onChange={e => setManual(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Radio de comunicación" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 block mb-1">Cantidad por puesto</label>
              <input type="number" min={1} value={manual.cantidad} onChange={e => setManual(p => ({ ...p, cantidad: +e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 block mb-1">Costo unitario (Q)</label>
              <input type="number" min={0} step={0.01} value={manual.costo} onChange={e => setManual(p => ({ ...p, costo: +e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <button
                onClick={() => setManual(p => ({ ...p, es_personal: !p.es_personal }))}
                className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                  manual.es_personal ? "bg-purple-500/30 border-purple-500/50" : "bg-white/5 border-white/15"
                }`}
              >
                {manual.es_personal && <Check className="w-3 h-3 text-purple-300" />}
              </button>
              <span className="text-xs text-white/50">Es equipo personal (uniforme, botas — solo para nuevas contrataciones)</span>
            </div>
          </div>
          <button onClick={agregarManual} disabled={saving || !manual.nombre.trim()}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/8 hover:bg-white/12 text-white/70 text-xs rounded-lg transition-colors disabled:opacity-40">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Agregar
          </button>
        </div>
      </details>
    </div>
  );
}

// ─── Tab Resumen ──────────────────────────────────────────────────────────────
function TabResumen({ lead }: { lead: Lead }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [ordenResult, setOrdenResult] = useState<{ ok: boolean; orden_id?: number; total?: number; message?: string } | null>(null);

  async function cargar() {
    setLoading(true);
    const r = await api(`/api/dotacion/lead/${lead.id}/resumen`);
    if (r.ok) setResumen(await r.json());
    setLoading(false);
  }
  useEffect(() => { cargar(); }, [lead.id]);

  async function generarOrden() {
    setGenerando(true);
    const r = await api(`/api/dotacion/lead/${lead.id}/generar-orden`, { method: "POST" });
    const d = await r.json();
    setOrdenResult(d);
    setGenerando(false);
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-white/30"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!resumen) return <p className="text-sm text-white/30 py-8 text-center">No se pudo cargar el resumen.</p>;

  const { personal, items, totales } = resumen;

  return (
    <div className="space-y-5">
      {/* Personal */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Agentes necesarios", val: personal.agentes_necesarios, color: "text-white" },
          { label: "Disponibles ahora",  val: personal.agentes_disponibles, color: "text-emerald-400" },
          { label: "Déficit",            val: personal.deficit, color: personal.deficit > 0 ? "text-orange-400" : "text-white/30" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-[#060f1a] border border-white/8 rounded-xl px-3 py-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabla de ítems */}
      {items.length > 0 && (
        <div className="bg-[#060f1a] border border-white/8 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-orange-400" />
            <p className="text-xs font-semibold text-white">Dotación de equipo</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/25 border-b border-white/5 text-[10px] uppercase">
                <th className="text-left px-4 py-2">Artículo</th>
                <th className="text-center px-3 py-2">Tipo</th>
                <th className="text-center px-3 py-2">Necesario</th>
                <th className="text-center px-3 py-2">En stock</th>
                <th className="text-center px-3 py-2">Falta</th>
                <th className="text-right px-4 py-2">Inversión</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className={`border-b border-white/3 ${item.faltante > 0 ? "bg-red-500/3" : ""}`}>
                  <td className="px-4 py-2.5 text-white/80">{item.nombre_articulo}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      item.es_equipo_personal
                        ? "bg-purple-500/15 text-purple-300"
                        : "bg-blue-500/15 text-blue-300"
                    }`}>
                      {item.es_equipo_personal ? "Personal" : "Puesto"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-white/60">{item.total_necesario}</td>
                  <td className="px-3 py-2.5 text-center text-emerald-400">{item.stock_disponible}</td>
                  <td className="px-3 py-2.5 text-center">
                    {item.faltante > 0
                      ? <span className="font-bold text-red-400">{item.faltante}</span>
                      : <span className="text-white/20">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-white/50">
                    {item.costo_faltante > 0 ? fmtQ(item.costo_faltante) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-white/3 border-t border-white/10">
                <td colSpan={5} className="px-4 py-2.5 text-xs text-white/40 font-semibold">Inversión total requerida</td>
                <td className="px-4 py-2.5 text-right font-bold text-white font-mono">{fmtQ(totales.inversion_total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Acción: Generar Orden */}
      {totales.hay_gaps && !ordenResult && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">Hay artículos con stock insuficiente</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Se requiere {fmtQ(totales.inversion_total)} en compras para cubrir este contrato.
            </p>
            <button
              onClick={generarOrden}
              disabled={generando}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm rounded-lg border border-amber-500/25 transition-colors disabled:opacity-50"
            >
              {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              Generar Orden de Compra
            </button>
          </div>
        </div>
      )}

      {ordenResult && (
        <div className={`rounded-xl p-4 flex items-start gap-3 ${
          ordenResult.ok && ordenResult.orden_id
            ? "bg-emerald-500/10 border border-emerald-500/20"
            : "bg-blue-500/10 border border-blue-500/20"
        }`}>
          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            {ordenResult.orden_id ? (
              <>
                <p className="text-sm font-semibold text-emerald-300">Orden de compra #{ordenResult.orden_id} generada</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">Total: {fmtQ(ordenResult.total || 0)} · Ver en Bodega → Órdenes de Compra</p>
              </>
            ) : (
              <p className="text-sm text-blue-300">{ordenResult.message}</p>
            )}
          </div>
        </div>
      )}

      {!totales.hay_gaps && items.length > 0 && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="text-sm text-emerald-300">Stock suficiente para cubrir este contrato. No se requiere orden de compra.</p>
        </div>
      )}
    </div>
  );
}

// ─── Panel principal ───────────────────────────────────────────────────────────
const TABS_PANEL = [
  { id: "datos",    label: "Datos",             icon: FileText },
  { id: "servicio", label: "Servicio & Personal", icon: Users },
  { id: "dotacion", label: "Dotación",           icon: Package },
  { id: "resumen",  label: "Resumen",            icon: BarChart3 },
] as const;
type PanelTab = typeof TABS_PANEL[number]["id"];

interface Props {
  lead: Lead;
  onClose: () => void;
  onLeadUpdate: (l: Lead) => void;
}

export default function LeadDetallePanel({ lead: initialLead, onClose, onLeadUpdate }: Props) {
  const [tab, setTab] = useState<PanelTab>("datos");
  const [lead, setLead] = useState(initialLead);

  function handleUpdate(l: Lead) {
    setLead(l);
    onLeadUpdate(l);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-[#0a1628] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <div>
            <p className="text-base font-bold text-white">{lead.empresa}</p>
            <p className="text-xs text-white/40">Lead #{lead.id} · {lead.contacto}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 bg-white/2 shrink-0 overflow-x-auto">
          {TABS_PANEL.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-primary/15 text-primary" : "text-white/40 hover:text-white"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "datos"    && <TabDatos    lead={lead} onLeadUpdate={handleUpdate} />}
          {tab === "servicio" && <TabServicio lead={lead} onLeadUpdate={handleUpdate} />}
          {tab === "dotacion" && <TabDotacion lead={lead} />}
          {tab === "resumen"  && <TabResumen  lead={lead} />}
        </div>
      </div>
    </div>
  );
}
