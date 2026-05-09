import { useState, useEffect, useRef } from "react";
import {
  Package, PackageOpen, Building2, User, Search, Plus, ChevronDown,
  ChevronRight, Edit2, Trash2, X, Check, Loader2, AlertCircle,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Archive, Tag,
  ClipboardList, BarChart3, History, ShoppingCart, UserCheck, Settings,
  Layers, CreditCard, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "../layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import { getSessionToken } from "@/lib/httpClient";

function getSession() {
  return getSessionToken();
}
function api(path: string, opts?: RequestInit) {
  return fetch(path, { ...opts, headers: { "x-isp-session": getSession(), "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Categoria { id: number; nombre: string; descripcion: string | null; total_articulos: number; }
interface Articulo {
  id: number; nombre: string; descripcion: string | null;
  categoria_id: number | null; categoria_nombre: string | null;
  codigo_prefijo: string; tipo_rastreo: string; tipo_asignacion: string; activo: boolean;
  costo_unitario: number;
  stock_total: number; stock_disponible: number; stock_asignado_puesto: number;
  stock_asignado_colaborador: number; stock_reparacion: number; stock_baja: number;
}
interface Unidad {
  id: number; articulo_id: number; codigo_inventario: string;
  numero_serie: string | null; condicion: string; estado: string;
  puesto_id: number | null; employee_id: number | null; notas: string | null;
  created_at: string; updated_at: string;
  articulo_nombre: string; codigo_prefijo: string; tipo_asignacion: string;
  categoria_nombre: string | null; puesto_nombre: string; puesto_cliente: string; empleado_nombre: string;
}
interface Movimiento {
  id: number; tipo: string; notas: string | null; registrado_por: string | null;
  created_at: string; codigo_inventario: string; articulo_nombre: string;
  puesto_nombre: string; empleado_nombre: string;
  condicion_antes: string | null; condicion_despues: string | null;
}
interface Puesto { id: number; nombre_puesto: string; cliente_nombre: string; }
interface Colaborador { id: number; nombre_completo: string; dpi: string | null; puesto: string | null; }

// ─── Colores helpers ──────────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, string> = {
  disponible:             "bg-green-500/15 text-green-400 border-green-500/30",
  asignado_puesto:        "bg-blue-500/15 text-blue-400 border-blue-500/30",
  asignado_colaborador:   "bg-purple-500/15 text-purple-400 border-purple-500/30",
  en_reparacion:          "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  baja:                   "bg-red-500/15 text-red-400 border-red-500/30",
};
const ESTADO_LABEL: Record<string, string> = {
  disponible:           "Disponible",
  asignado_puesto:      "Asig. Puesto",
  asignado_colaborador: "Asig. Colaborador",
  en_reparacion:        "En Reparación",
  baja:                 "Baja",
};
const CONDICION_COLOR: Record<string, string> = {
  bueno:       "text-green-400",
  regular:     "text-yellow-400",
  deteriorado: "text-red-400",
};
const TIPO_MOV_LABEL: Record<string, string> = {
  entrada:                "Entrada",
  asignacion_puesto:      "Asig. Puesto",
  asignacion_colaborador: "Asig. Colaborador",
  devolucion:             "Devolución",
  baja:                   "Baja",
  ajuste:                 "Ajuste",
};
const TIPO_MOV_COLOR: Record<string, string> = {
  entrada:                "bg-green-500/10 text-green-400 border-green-500/20",
  asignacion_puesto:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  asignacion_colaborador: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  devolucion:             "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  baja:                   "bg-red-500/10 text-red-400 border-red-500/20",
  ajuste:                 "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = s.length <= 10 ? s + "T00:00:00Z" : s;
  return new Date(d).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className={`bg-[#0f1623] border border-white/10 rounded-xl p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Modal base ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = "md" }: { title: string; onClose: () => void; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const w = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`bg-[#0d1a2a] border border-white/15 rounded-2xl w-full ${w} max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Combobox colaboradores ───────────────────────────────────────────────────
function ColabCombo({ colaboradores, value, onChange }: { colaboradores: Colaborador[]; value: number | ""; onChange: (id: number | "") => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = colaboradores.find(c => c.id === value);
  const filtered = q ? colaboradores.filter(c => c.nombre_completo.toLowerCase().includes(q.toLowerCase())).slice(0, 40) : colaboradores.slice(0, 40);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  if (selected) return (
    <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
      <User className="w-3.5 h-3.5 text-purple-400 shrink-0" />
      <span className="text-purple-200 text-sm flex-1 truncate">{selected.nombre_completo}</span>
      <button onClick={() => { onChange(""); setQ(""); }} className="text-purple-400/60 hover:text-purple-300"><X className="w-3 h-3" /></button>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input type="text" placeholder="Buscar colaborador..." value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          className="w-full bg-[#07111f] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600" />
      </div>
      {open && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-[#0d1a2a] border border-white/15 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-white/5">
          {filtered.map(c => (
            <li key={c.id}>
              <button onMouseDown={e => { e.preventDefault(); onChange(c.id); setQ(""); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm text-gray-300 flex items-center gap-2">
                <User className="w-3 h-3 text-gray-600 shrink-0" />{c.nombre_completo}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-2 text-gray-600 text-sm">Sin resultados</li>}
        </ul>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Dashboard ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function TabDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/bodega/dashboard").then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!data) return null;

  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Total" value={+s.total} icon={Package} color="bg-white/5 text-gray-400" />
        <StatCard label="Disponible" value={+s.disponible} icon={PackageOpen} color="bg-green-500/10 text-green-400" />
        <StatCard label="Asig. Puesto" value={+s.asignado_puesto} icon={Building2} color="bg-blue-500/10 text-blue-400" />
        <StatCard label="Asig. Colaborador" value={+s.asignado_colaborador} icon={User} color="bg-purple-500/10 text-purple-400" />
        <StatCard label="En Reparación" value={+s.en_reparacion} icon={RefreshCw} color="bg-yellow-500/10 text-yellow-400" />
        <StatCard label="Dados de Baja" value={+s.baja} icon={Archive} color="bg-red-500/10 text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top artículos */}
        <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">Artículos con más unidades</h3>
          </div>
          <div className="divide-y divide-white/5">
            {data.articulos.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <div>
                  <p className="text-gray-200">{a.nombre}</p>
                  <p className="text-gray-600 text-xs">{a.tipo_asignacion === "puesto" ? "→ Puesto" : a.tipo_asignacion === "colaborador" ? "→ Colaborador" : "→ Ambos"}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-right">
                  <span className="text-gray-400">{a.total} uds</span>
                  <span className="text-green-400">{a.disponible} libres</span>
                </div>
              </div>
            ))}
            {data.articulos.length === 0 && <p className="px-5 py-4 text-gray-600 text-sm">Sin artículos aún</p>}
          </div>
        </div>

        {/* Últimos movimientos */}
        <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">Últimos movimientos</h3>
          </div>
          <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
            {data.recientes.map((m: any) => (
              <div key={m.id} className="px-5 py-2.5 flex items-start gap-3">
                <Badge variant="outline" className={`text-[10px] border shrink-0 mt-0.5 ${TIPO_MOV_COLOR[m.tipo] ?? ""}`}>
                  {TIPO_MOV_LABEL[m.tipo] ?? m.tipo}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 text-xs font-mono">{m.codigo_inventario}</p>
                  <p className="text-gray-500 text-[11px] truncate">{m.articulo_nombre} · {m.puesto_nombre || m.empleado_nombre || "—"}</p>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0">{fmtDate(m.created_at)}</span>
              </div>
            ))}
            {data.recientes.length === 0 && <p className="px-5 py-4 text-gray-600 text-sm">Sin movimientos aún</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Catálogo ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ModalCategoria({ cat, onClose, onSaved }: { cat?: Categoria; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(cat?.nombre ?? "");
  const [desc, setDesc] = useState(cat?.descripcion ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function guardar() {
    if (!nombre.trim()) return setErr("Ingrese un nombre");
    setSaving(true); setErr("");
    const url = cat ? `/api/bodega/categorias/${cat.id}` : "/api/bodega/categorias";
    const method = cat ? "PUT" : "POST";
    const r = await api(url, { method, body: JSON.stringify({ nombre, descripcion: desc }) });
    setSaving(false);
    if (r.ok) { onSaved(); onClose(); } else setErr(await r.text());
  }

  return (
    <Modal title={cat ? "Editar Categoría" : "Nueva Categoría"} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div><label className="text-xs text-gray-400 block mb-1">Nombre *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50" /></div>
        <div><label className="text-xs text-gray-400 block mb-1">Descripción</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50 resize-none" /></div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancelar</Button>
          <Button onClick={guardar} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ModalArticulo({ art, categorias, onClose, onSaved }: { art?: Articulo; categorias: Categoria[]; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(art?.nombre ?? "");
  const [desc, setDesc] = useState(art?.descripcion ?? "");
  const [catId, setCatId] = useState<string>(art?.categoria_id?.toString() ?? "");
  const [prefijo, setPrefijo] = useState(art?.codigo_prefijo ?? "");
  const [rastreo, setRastreo] = useState(art?.tipo_rastreo ?? "seriado");
  const [asignacion, setAsignacion] = useState(art?.tipo_asignacion ?? "colaborador");
  const [costo, setCosto] = useState<string>(art?.costo_unitario != null ? String(art.costo_unitario) : "0");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function guardar() {
    if (!nombre.trim() || !prefijo.trim()) return setErr("Nombre y prefijo son requeridos");
    setSaving(true); setErr("");
    const url = art ? `/api/bodega/articulos/${art.id}` : "/api/bodega/articulos";
    const method = art ? "PUT" : "POST";
    const r = await api(url, { method, body: JSON.stringify({
      nombre, descripcion: desc, categoria_id: catId ? +catId : null,
      codigo_prefijo: prefijo, tipo_rastreo: rastreo, tipo_asignacion: asignacion,
      costo_unitario: parseFloat(costo) || 0,
    }) });
    setSaving(false);
    if (r.ok) { onSaved(); onClose(); } else setErr(await r.text());
  }

  return (
    <Modal title={art ? "Editar Artículo" : "Nuevo Artículo"} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Nombre del artículo *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Laptop HP ProBook 450" className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Categoría</label>
            <select value={catId} onChange={e => setCatId(e.target.value)} className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50">
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Prefijo de código *</label>
            <div className="flex items-center gap-1">
              <span className="text-gray-500 text-sm">ISP-</span>
              <input value={prefijo} onChange={e => setPrefijo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="MAC" maxLength={6}
                className="flex-1 bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-yellow-300 font-mono text-sm focus:outline-none focus:border-yellow-500/50 uppercase" />
              <span className="text-gray-500 text-sm">-001</span>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">Resultado: <span className="text-yellow-400 font-mono">ISP-{prefijo || "XXX"}-001</span></p>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tipo de rastreo</label>
            <select value={rastreo} onChange={e => setRastreo(e.target.value)} className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50">
              <option value="seriado">Seriado (número de serie individual)</option>
              <option value="cantidad">Por cantidad (stock general)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Se asigna a</label>
            <select value={asignacion} onChange={e => setAsignacion(e.target.value)} className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50">
              <option value="colaborador">Colaborador (laptop, celular…)</option>
              <option value="puesto">Puesto operativo (bastón, pito, radio…)</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Costo unitario (Q)</label>
            <input type="number" min={0} step={0.01} value={costo} onChange={e => setCosto(e.target.value)} placeholder="0.00"
              className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50" />
            <p className="text-[11px] text-gray-600 mt-1">Para calcular inversión en dotaciones de leads</p>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Descripción</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50 resize-none" />
          </div>
        </div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancelar</Button>
          <Button onClick={guardar} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TabCatalogo() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [catSel, setCatSel] = useState<number | null>(null);
  const [modalCat, setModalCat] = useState<Categoria | undefined | false>(false);
  const [modalArt, setModalArt] = useState<Articulo | undefined | false>(false);
  const [loading, setLoading] = useState(true);
  const { active: deleteModeActive, requestDelete } = useDeleteMode();

  async function cargar() {
    const [c, a] = await Promise.all([
      api("/api/bodega/categorias").then(r => r.json()),
      api("/api/bodega/articulos").then(r => r.json()),
    ]);
    setCategorias(c);
    setArticulos(a);
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  function eliminarCat(cat: Categoria) {
    if (!deleteModeActive) return;
    requestDelete({ entidad: "bodega_categoria", entidad_id: cat.id, entidad_descripcion: `Categoría: ${cat.nombre}` });
  }
  function eliminarArt(art: Articulo) {
    if (!deleteModeActive) return;
    requestDelete({ entidad: "bodega_articulo", entidad_id: art.id, entidad_descripcion: `Artículo: ${art.nombre}` });
  }

  const artsFiltrados = catSel === null ? articulos : articulos.filter(a => a.categoria_id === catSel);

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="flex gap-5">
      {/* Sidebar categorías */}
      <div className="w-56 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Categorías</span>
          <button onClick={() => setModalCat(undefined)} className="text-yellow-400 hover:text-yellow-300"><Plus className="w-4 h-4" /></button>
        </div>
        <button onClick={() => setCatSel(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${catSel === null ? "bg-yellow-500/15 text-yellow-300" : "text-gray-400 hover:bg-white/5"}`}>
          Todos los artículos <span className="text-gray-600 text-xs ml-1">({articulos.length})</span>
        </button>
        {categorias.map(c => (
          <div key={c.id} className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${catSel === c.id ? "bg-yellow-500/15 text-yellow-300" : "text-gray-400 hover:bg-white/5"}`}
            onClick={() => setCatSel(c.id)}>
            <span className="text-sm flex-1 truncate">{c.nombre} <span className="text-gray-600 text-xs">({c.total_articulos})</span></span>
            <div className="hidden group-hover:flex gap-1">
              <button onClick={e => { e.stopPropagation(); setModalCat(c); }} className="hover:text-yellow-400"><Edit2 className="w-3 h-3" /></button>
              {deleteModeActive && <button onClick={e => { e.stopPropagation(); eliminarCat(c); }} className="hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
            </div>
          </div>
        ))}
        {categorias.length === 0 && <p className="text-gray-600 text-xs px-3">Sin categorías</p>}
      </div>

      {/* Lista artículos */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">{catSel !== null ? (categorias.find(c => c.id === catSel)?.nombre ?? "Artículos") : "Todos los artículos"}</h3>
          <Button onClick={() => setModalArt(undefined)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-xs h-8 gap-1">
            <Plus className="w-3.5 h-3.5" /> Nuevo Artículo
          </Button>
        </div>
        <div className="space-y-2">
          {artsFiltrados.map(a => (
            <div key={a.id} className="bg-[#0f1623] border border-white/10 rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium text-sm">{a.nombre}</span>
                  <span className="font-mono text-yellow-400/70 text-[11px]">ISP-{a.codigo_prefijo}-###</span>
                  <Badge variant="outline" className="text-[10px] border border-white/10 text-gray-500">
                    {a.tipo_asignacion === "puesto" ? "→ Puesto" : a.tipo_asignacion === "colaborador" ? "→ Colaborador" : "→ Ambos"}
                  </Badge>
                  {a.categoria_nombre && <Badge variant="outline" className="text-[10px] border-blue-500/20 text-blue-400/70">{a.categoria_nombre}</Badge>}
                </div>
                {a.descripcion && <p className="text-gray-500 text-xs mt-0.5 truncate">{a.descripcion}</p>}
              </div>
              {/* Stock badges */}
              <div className="flex items-center gap-2 text-xs shrink-0">
                <span className="text-green-400">{a.stock_disponible} libre</span>
                {a.stock_asignado_puesto > 0 && <span className="text-blue-400">{a.stock_asignado_puesto} puesto</span>}
                {a.stock_asignado_colaborador > 0 && <span className="text-purple-400">{a.stock_asignado_colaborador} colab.</span>}
                {a.stock_reparacion > 0 && <span className="text-yellow-400">{a.stock_reparacion} rep.</span>}
                {a.stock_baja > 0 && <span className="text-red-400/60">{a.stock_baja} baja</span>}
                <span className="text-gray-600">/ {a.stock_total} total</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setModalArt(a)} className="text-gray-500 hover:text-yellow-400 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                {deleteModeActive && <button onClick={() => eliminarArt(a)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
          {artsFiltrados.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              <Package className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No hay artículos{catSel !== null ? " en esta categoría" : ""}. Crea el primero.</p>
            </div>
          )}
        </div>
      </div>

      {modalCat !== false && <ModalCategoria cat={modalCat} onClose={() => setModalCat(false)} onSaved={cargar} />}
      {modalArt !== false && <ModalArticulo art={modalArt} categorias={categorias} onClose={() => setModalArt(false)} onSaved={cargar} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Modal Crear Unidades ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ModalCrearUnidades({ articulos, onClose, onSaved }: { articulos: Articulo[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [artId, setArtId] = useState<string>("");
  const [cantidad, setCantidad] = useState(1);
  const [lineas, setLineas] = useState<{ codigo: string; serie: string; condicion: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function generarCodigos() {
    if (!artId) return setErr("Selecciona un artículo");
    setLoading(true); setErr("");
    const r = await api(`/api/bodega/articulos/${artId}/siguiente-codigo`);
    const data = await r.json();
    const { siguiente_numero, prefijo } = data;
    const nuevasLineas = Array.from({ length: cantidad }, (_, i) => ({
      codigo: `ISP-${prefijo}-${String(siguiente_numero + i).padStart(3, "0")}`,
      serie: "",
      condicion: "bueno",
    }));
    setLineas(nuevasLineas);
    setLoading(false);
  }

  async function guardar() {
    if (!artId || lineas.length === 0) return;
    setSaving(true); setErr("");
    const r = await api("/api/bodega/unidades", {
      method: "POST",
      body: JSON.stringify({
        articulo_id: +artId,
        unidades: lineas.map(l => ({ codigo_inventario: l.codigo, numero_serie: l.serie || undefined, condicion: l.condicion })),
      }),
    });
    setSaving(false);
    if (r.ok) {
      toast({ title: "Unidades registradas", description: `${lineas.length} unidad${lineas.length !== 1 ? "es" : ""} agregada${lineas.length !== 1 ? "s" : ""} al inventario.` });
      onSaved();
      onClose();
    } else {
      setErr(await r.text());
    }
  }

  function updateLinea(i: number, field: string, val: string) {
    setLineas(prev => prev.map((l, j) => j === i ? { ...l, [field]: val } : l));
  }

  return (
    <Modal title="Ingresar Unidades al Inventario" onClose={onClose} size="xl">
      <div className="space-y-4">
        {/* Selección artículo + cantidad */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Artículo *</label>
            <select value={artId} onChange={e => { setArtId(e.target.value); setLineas([]); }}
              className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50">
              <option value="">— Seleccionar artículo —</option>
              {articulos.map(a => <option key={a.id} value={a.id}>ISP-{a.codigo_prefijo} · {a.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Cantidad de unidades</label>
            <input type="number" min={1} max={50} value={cantidad} onChange={e => { setCantidad(Math.min(50, Math.max(1, +e.target.value))); setLineas([]); }}
              className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50" />
          </div>
        </div>
        <Button onClick={generarCodigos} disabled={!artId || loading} variant="outline" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 gap-2 w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
          Generar códigos ISP automáticamente
        </Button>

        {/* Tabla de unidades */}
        {lineas.length > 0 && (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left w-8">#</th>
                  <th className="px-4 py-2 text-left">Código ISP</th>
                  <th className="px-4 py-2 text-left">N° de Serie (opcional)</th>
                  <th className="px-4 py-2 text-left">Condición</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-600">{i + 1}</td>
                    <td className="px-4 py-2">
                      <input value={l.codigo} onChange={e => updateLinea(i, "codigo", e.target.value.toUpperCase())}
                        className="bg-[#07111f] border border-white/10 rounded px-2 py-1 text-yellow-300 font-mono text-xs w-full focus:outline-none focus:border-yellow-500/50" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={l.serie} onChange={e => updateLinea(i, "serie", e.target.value)} placeholder="Opcional"
                        className="bg-[#07111f] border border-white/10 rounded px-2 py-1 text-white text-xs w-full focus:outline-none focus:border-white/20" />
                    </td>
                    <td className="px-4 py-2">
                      <select value={l.condicion} onChange={e => updateLinea(i, "condicion", e.target.value)}
                        className="bg-[#07111f] border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none">
                        <option value="bueno">Bueno</option>
                        <option value="regular">Regular</option>
                        <option value="deteriorado">Deteriorado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {err && <p className="text-red-400 text-xs">{err}</p>}
        {lineas.length > 0 && (
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancelar</Button>
            <Button onClick={guardar} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              Ingresar {lineas.length} unidad{lineas.length !== 1 ? "es" : ""} al inventario
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Modal Asignar ────────────────────────────────────────────────────────────
function ModalAsignar({ unidad, puestos, colaboradores, onClose, onSaved }: {
  unidad: Unidad; puestos: Puesto[]; colaboradores: Colaborador[];
  onClose: () => void; onSaved: () => void;
}) {
  const tipoDefault = unidad.tipo_asignacion === "puesto" ? "puesto" : "colaborador";
  const [tipo, setTipo] = useState<"puesto" | "colaborador">(tipoDefault as any);
  const [puestoId, setPuestoId] = useState<string>("");
  const [empId, setEmpId] = useState<number | "">("");
  const [condicion, setCondicion] = useState(unidad.condicion);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function guardar() {
    if (tipo === "puesto" && !puestoId) return setErr("Selecciona un puesto");
    if (tipo === "colaborador" && !empId) return setErr("Selecciona un colaborador");
    setSaving(true); setErr("");
    const r = await api(`/api/bodega/unidades/${unidad.id}/asignar`, {
      method: "POST",
      body: JSON.stringify({ tipo_asignacion: tipo, puesto_id: tipo === "puesto" ? +puestoId : undefined, employee_id: tipo === "colaborador" ? empId : undefined, condicion, notas }),
    });
    setSaving(false);
    if (r.ok) { onSaved(); onClose(); } else setErr(await r.text());
  }

  return (
    <Modal title={`Asignar — ${unidad.codigo_inventario}`} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-300">
          <span className="font-mono text-yellow-300">{unidad.codigo_inventario}</span> · {unidad.articulo_nombre}
          {unidad.numero_serie && <span className="text-gray-500 ml-2">S/N: {unidad.numero_serie}</span>}
        </div>

        {/* Tipo de asignación */}
        {unidad.tipo_asignacion === "ambos" && (
          <div className="flex gap-2">
            {(["puesto", "colaborador"] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${tipo === t ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-300" : "border-white/10 text-gray-500 hover:text-gray-300"}`}>
                {t === "puesto" ? "📍 Puesto" : "👤 Colaborador"}
              </button>
            ))}
          </div>
        )}

        {tipo === "puesto" ? (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Puesto operativo *</label>
            <select value={puestoId} onChange={e => setPuestoId(e.target.value)}
              className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50">
              <option value="">— Seleccionar puesto —</option>
              {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre_puesto} — {p.cliente_nombre}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Colaborador *</label>
            <ColabCombo colaboradores={colaboradores} value={empId} onChange={setEmpId} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Condición al asignar</label>
            <select value={condicion} onChange={e => setCondicion(e.target.value)}
              className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="deteriorado">Deteriorado</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional"
              className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
          </div>
        </div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancelar</Button>
          <Button onClick={guardar} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />} Asignar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal Devolver ───────────────────────────────────────────────────────────
function ModalDevolver({ unidad, onClose, onSaved }: { unidad: Unidad; onClose: () => void; onSaved: () => void }) {
  const [condicion, setCondicion] = useState(unidad.condicion);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function guardar() {
    setSaving(true); setErr("");
    const r = await api(`/api/bodega/unidades/${unidad.id}/devolver`, { method: "POST", body: JSON.stringify({ condicion, notas }) });
    setSaving(false);
    if (r.ok) { onSaved(); onClose(); } else setErr(await r.text());
  }

  return (
    <Modal title={`Devolución — ${unidad.codigo_inventario}`} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-300">
          {unidad.estado === "asignado_puesto"
            ? <span>Devolviendo desde puesto <span className="text-blue-300">{unidad.puesto_nombre}</span></span>
            : <span>Devolviendo desde <span className="text-purple-300">{unidad.empleado_nombre}</span></span>}
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Condición al devolver</label>
          <select value={condicion} onChange={e => setCondicion(e.target.value)}
            className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
            <option value="bueno">Bueno</option>
            <option value="regular">Regular</option>
            <option value="deteriorado">Deteriorado</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Observaciones al recibir…"
            className="w-full bg-[#07111f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none" />
        </div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Cancelar</Button>
          <Button onClick={guardar} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />} Confirmar devolución
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Inventario ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function TabInventario() {
  const [articulos,    setArticulos]    = useState<Articulo[]>([]);
  const [unidades,     setUnidades]     = useState<Unidad[]>([]);
  const [puestos,      setPuestos]      = useState<Puesto[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [q,            setQ]            = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCat,    setFiltroCat]    = useState("");
  const [modalCrear,   setModalCrear]   = useState(false);
  const [modalAsignar, setModalAsignar] = useState<Unidad | null>(null);
  const [modalDevolver, setModalDevolver] = useState<Unidad | null>(null);

  async function cargar() {
    const [a, u, p, c] = await Promise.all([
      api("/api/bodega/articulos").then(r => r.json()),
      api("/api/bodega/unidades").then(r => r.json()),
      api("/api/bodega/puestos").then(r => r.json()),
      api("/api/bodega/colaboradores").then(r => r.json()),
    ]);
    setArticulos(a); setUnidades(u); setPuestos(p); setColaboradores(c);
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  async function darBaja(u: Unidad) {
    const motivo = prompt(`Motivo de baja para ${u.codigo_inventario}:`);
    if (motivo === null) return;
    await api(`/api/bodega/unidades/${u.id}/baja`, { method: "POST", body: JSON.stringify({ notas: motivo, condicion: "deteriorado" }) });
    cargar();
  }

  const categorias = [...new Set(articulos.map(a => a.categoria_nombre).filter(Boolean))] as string[];

  const filtradas = unidades.filter(u => {
    if (filtroEstado && u.estado !== filtroEstado) return false;
    if (filtroCat && u.categoria_nombre !== filtroCat) return false;
    if (q) {
      const ql = q.toLowerCase();
      return u.codigo_inventario.toLowerCase().includes(ql) ||
        u.articulo_nombre.toLowerCase().includes(ql) ||
        (u.numero_serie?.toLowerCase().includes(ql) ?? false) ||
        u.empleado_nombre.toLowerCase().includes(ql) ||
        u.puesto_nombre.toLowerCase().includes(ql);
    }
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por código, artículo, colaborador…"
            className="w-full bg-[#0f1623] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/40" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="bg-[#0f1623] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none min-w-[160px]">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}
          className="bg-[#0f1623] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none min-w-[150px]">
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button onClick={() => setModalCrear(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Ingresar unidades
        </Button>
      </div>

      {/* Tabla */}
      <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-white/10 text-gray-500 uppercase tracking-wide text-[10px]">
                <th className="px-4 py-3 text-left">Código ISP</th>
                <th className="px-4 py-3 text-left">Artículo / Categoría</th>
                <th className="px-4 py-3 text-left">N° Serie</th>
                <th className="px-4 py-3 text-left">Condición</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Asignado a</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((u, i) => (
                <tr key={u.id} className={`border-b border-white/5 hover:bg-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                  <td className="px-4 py-2.5 font-mono text-yellow-300 font-semibold">{u.codigo_inventario}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-200">{u.articulo_nombre}</p>
                    {u.categoria_nombre && <p className="text-gray-600 text-[10px]">{u.categoria_nombre}</p>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-400">{u.numero_serie ?? "—"}</td>
                  <td className="px-4 py-2.5 capitalize">
                    <span className={CONDICION_COLOR[u.condicion] ?? "text-gray-400"}>{u.condicion}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={`text-[10px] border ${ESTADO_COLOR[u.estado] ?? ""}`}>
                      {ESTADO_LABEL[u.estado] ?? u.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.estado === "asignado_puesto" && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="text-blue-300 text-[11px]">{u.puesto_nombre}</span>
                      </div>
                    )}
                    {u.estado === "asignado_colaborador" && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="text-purple-300 text-[11px]">{u.empleado_nombre}</span>
                      </div>
                    )}
                    {(u.estado === "disponible" || u.estado === "en_reparacion") && <span className="text-gray-600">—</span>}
                    {u.estado === "baja" && <span className="text-red-400/60 text-[11px]">Dado de baja</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {u.estado === "disponible" && (
                        <button onClick={() => setModalAsignar(u)} className="text-[11px] px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded hover:bg-blue-500/20 transition-colors">
                          Asignar
                        </button>
                      )}
                      {(u.estado === "asignado_puesto" || u.estado === "asignado_colaborador") && (
                        <button onClick={() => setModalDevolver(u)} className="text-[11px] px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/20 transition-colors">
                          Devolver
                        </button>
                      )}
                      {u.estado !== "baja" && (
                        <button onClick={() => darBaja(u)} className="text-[11px] px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded hover:bg-red-500/20 transition-colors">
                          Baja
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              <PackageOpen className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">{unidades.length === 0 ? "Sin unidades en el inventario. Ingresa el primero." : "No hay resultados para los filtros seleccionados."}</p>
            </div>
          )}
        </div>
        {filtradas.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 text-xs text-gray-600">
            Mostrando {filtradas.length} de {unidades.length} unidades
          </div>
        )}
      </div>

      {modalCrear && <ModalCrearUnidades articulos={articulos} onClose={() => setModalCrear(false)} onSaved={cargar} />}
      {modalAsignar && <ModalAsignar unidad={modalAsignar} puestos={puestos} colaboradores={colaboradores} onClose={() => setModalAsignar(null)} onSaved={cargar} />}
      {modalDevolver && <ModalDevolver unidad={modalDevolver} onClose={() => setModalDevolver(null)} onSaved={cargar} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Movimientos ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function TabMovimientos() {
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("");

  useEffect(() => {
    api("/api/bodega/movimientos?limit=200").then(r => r.json()).then(data => { setMovs(data); setLoading(false); });
  }, []);

  const filtrados = filtroTipo ? movs.filter(m => m.tipo === filtroTipo) : movs;

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="bg-[#0f1623] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_MOV_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-gray-600 text-sm">{filtrados.length} movimientos</span>
      </div>
      <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="border-b border-white/10 text-gray-500 uppercase tracking-wide text-[10px]">
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Código ISP</th>
                <th className="px-4 py-3 text-left">Artículo</th>
                <th className="px-4 py-3 text-left">Condición</th>
                <th className="px-4 py-3 text-left">Destino</th>
                <th className="px-4 py-3 text-left">Notas</th>
                <th className="px-4 py-3 text-left">Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m, i) => (
                <tr key={m.id} className={`border-b border-white/5 hover:bg-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={`text-[10px] border ${TIPO_MOV_COLOR[m.tipo] ?? ""}`}>
                      {TIPO_MOV_LABEL[m.tipo] ?? m.tipo}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-yellow-300">{m.codigo_inventario}</td>
                  <td className="px-4 py-2.5 text-gray-300">{m.articulo_nombre}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {m.condicion_antes && m.condicion_despues && m.condicion_antes !== m.condicion_despues
                      ? <span><span className={CONDICION_COLOR[m.condicion_antes]}>{m.condicion_antes}</span> → <span className={CONDICION_COLOR[m.condicion_despues]}>{m.condicion_despues}</span></span>
                      : <span className={CONDICION_COLOR[m.condicion_despues ?? ""] ?? "text-gray-500"}>{m.condicion_despues ?? "—"}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{m.puesto_nombre || m.empleado_nombre || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[180px] truncate">{m.notas ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{m.registrado_por ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              <History className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Sin movimientos registrados aún.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Kit de Ingreso ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
interface KitItem { id?: number; articulo_id: number | null; nombre_articulo: string; cantidad: number; stock_disponible?: number; }

function TabKitIngreso() {
  const [items, setItems] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", cantidad: 1 });

  async function cargar() {
    const r = await api("/api/dotacion/kit-ingreso");
    if (r.ok) { const d = await r.json(); setItems(d.map((i: any) => ({ id: i.id, articulo_id: i.articulo_id, nombre_articulo: i.nombre_articulo, cantidad: i.cantidad, stock_disponible: i.stock_disponible }))); }
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setSaving(true);
    await api("/api/dotacion/kit-ingreso", { method: "PUT", body: JSON.stringify({ items }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function agregar() {
    if (!nuevo.nombre.trim()) return;
    setItems(p => [...p, { articulo_id: null, nombre_articulo: nuevo.nombre, cantidad: nuevo.cantidad }]);
    setNuevo({ nombre: "", cantidad: 1 });
  }

  if (loading) return <div className="flex justify-center py-16 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl px-4 py-3 text-sm text-orange-300">
        <strong>Kit de ingreso:</strong> artículos que se asignan automáticamente a cada empleado nuevo al ser dado de alta en RRHH.
      </div>
      {items.length === 0
        ? <div className="text-center py-10 text-gray-600 border border-dashed border-white/10 rounded-xl">Sin artículos configurados aún.</div>
        : (
          <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/5 uppercase">
                  <th className="px-4 py-3 text-left">Artículo</th>
                  <th className="px-4 py-3 text-center w-20">Cantidad</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/2">
                    <td className="px-4 py-2.5 text-white/80">{item.nombre_articulo}</td>
                    <td className="px-4 py-2.5 text-center">
                      <input type="number" min={1} value={item.cantidad}
                        onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, cantidad: +e.target.value } : it))}
                        className="w-16 bg-[#07111f] border border-white/10 rounded px-2 py-1 text-white text-center text-xs" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="text-red-400/50 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      {/* Agregar */}
      <div className="flex gap-2 items-center">
        <input value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))}
          placeholder="Nombre del artículo del kit..."
          className="flex-1 bg-[#0f1623] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
        <input type="number" min={1} value={nuevo.cantidad} onChange={e => setNuevo(p => ({ ...p, cantidad: +e.target.value }))}
          className="w-16 bg-[#0f1623] border border-white/10 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none" />
        <button onClick={agregar} className="px-3 py-2 bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 rounded-lg border border-orange-500/20 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <button onClick={guardar} disabled={saving}
        className="flex items-center gap-2 px-5 py-2 bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 rounded-lg border border-orange-500/20 text-sm transition-colors disabled:opacity-40">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        {saved ? "Guardado ✓" : "Guardar kit de ingreso"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Dotaciones Pendientes ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
interface DotPend { id: number; empleado_nombre: string; empleado_puesto: string; estado: string; total_items: number; items_entregados: number; created_at: string; }

function TabDotaciones() {
  const [rows, setRows] = useState<DotPend[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);

  async function cargar() {
    const r = await api("/api/dotacion/pendientes");
    if (r.ok) setRows(await r.json());
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  async function entregar(id: number) {
    setActioning(id);
    await api(`/api/dotacion/pendientes/${id}/entregar`, { method: "PATCH" });
    await cargar(); setActioning(null);
  }
  async function cancelar(id: number) {
    if (!confirm("¿Cancelar esta dotación?")) return;
    setActioning(id);
    await api(`/api/dotacion/pendientes/${id}/cancelar`, { method: "PATCH" });
    await cargar(); setActioning(null);
  }

  const ESTADO_COLOR: Record<string, string> = {
    pendiente: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
    entregado: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    cancelado: "text-gray-500 bg-white/5 border-white/10",
  };

  if (loading) return <div className="flex justify-center py-16 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Kit de ingreso a entregar por bodega a cada colaborador nuevo registrado en RRHH.</p>
        <span className="text-xs text-gray-600">{rows.length} registros</span>
      </div>
      {rows.length === 0
        ? <div className="text-center py-12 text-gray-600 border border-dashed border-white/10 rounded-xl"><UserCheck className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">Sin dotaciones pendientes.</p></div>
        : (
          <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-white/5 uppercase text-[10px]">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Empleado</th>
                  <th className="px-4 py-3 text-left">Puesto</th>
                  <th className="px-4 py-3 text-center">Progreso</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/2">
                    <td className="px-4 py-3 font-mono text-orange-400">#{r.id}</td>
                    <td className="px-4 py-3 text-white/80 font-medium">{r.empleado_nombre}</td>
                    <td className="px-4 py-3 text-gray-400">{r.empleado_puesto || "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{r.items_entregados}/{r.total_items}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ESTADO_COLOR[r.estado] ?? ""}`}>{r.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(r.created_at).toLocaleDateString("es-GT")}</td>
                    <td className="px-4 py-3 text-right">
                      {r.estado === "pendiente" && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => entregar(r.id)} disabled={actioning === r.id}
                            className="text-[10px] px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg border border-emerald-500/20 transition-colors">
                            {actioning === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Marcar entregado"}
                          </button>
                          <button onClick={() => cancelar(r.id)} disabled={actioning === r.id}
                            className="text-[10px] px-2 py-1 bg-white/5 hover:bg-red-500/15 text-gray-500 hover:text-red-400 rounded-lg border border-white/10 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Órdenes de Compra ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
interface Orden { id: number; estado: string; total: number; lead_empresa: string | null; cliente_nombre: string | null; items_count: number; created_by: string; created_at: string; }

function TabOrdenes() {
  const [rows, setRows] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);

  async function cargar() {
    const r = await api("/api/dotacion/ordenes-compra");
    if (r.ok) setRows(await r.json());
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  async function cambiarEstado(id: number, estado: string) {
    setActioning(id);
    await api(`/api/dotacion/ordenes-compra/${id}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
    await cargar(); setActioning(null);
  }

  const ESTADO_COLOR: Record<string, string> = {
    pendiente:  "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
    procesada:  "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    cancelada:  "text-gray-500 bg-white/5 border-white/10",
  };

  function fmtQ(n: number) {
    return `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
  }

  if (loading) return <div className="flex justify-center py-16 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Órdenes de compra generadas automáticamente desde la dotación de leads.</p>
      {rows.length === 0
        ? <div className="text-center py-12 text-gray-600 border border-dashed border-white/10 rounded-xl"><ShoppingCart className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">Sin órdenes de compra registradas.</p></div>
        : (
          <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-white/5 uppercase text-[10px]">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Lead / Cliente</th>
                  <th className="px-4 py-3 text-center">Ítems</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/2">
                    <td className="px-4 py-3 font-mono text-orange-400">#{r.id}</td>
                    <td className="px-4 py-3 text-white/80">{r.lead_empresa || r.cliente_nombre || "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{r.items_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-white/70">{fmtQ(r.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ESTADO_COLOR[r.estado] ?? ""}`}>{r.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(r.created_at).toLocaleDateString("es-GT")}</td>
                    <td className="px-4 py-3 text-right">
                      {r.estado === "pendiente" && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => cambiarEstado(r.id, "procesada")} disabled={actioning === r.id}
                            className="text-[10px] px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg border border-emerald-500/20 transition-colors">
                            Procesada
                          </button>
                          <button onClick={() => cambiarEstado(r.id, "cancelada")} disabled={actioning === r.id}
                            className="text-[10px] px-2 py-1 bg-white/5 hover:bg-red-500/15 text-gray-500 hover:text-red-400 rounded-lg border border-white/10 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Tab Uniformes & Cobros (UNIF-01) ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

interface EntregaPendiente {
  id: number; employee_id: number; nombre_articulo: string; tipo_cargo: string;
  monto_total: number; num_cuotas: number; cuotas_pagadas: number; estado: string;
  created_at: string; empleado_nombre: string; empleado_puesto: string | null;
  cliente_nombre: string | null; cuotas_pendientes: number; saldo_pendiente: number;
}
interface EmpleadoOption { id: number; nombre_completo: string; puesto?: string; }
interface ArticuloOption { id: number; nombre: string; costo_unitario: number; }

function TabUniformes() {
  const [vista, setVista] = useState<"pendientes" | "nueva">("pendientes");
  const [pendientes, setPendientes] = useState<EntregaPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [articulos, setArticulos] = useState<ArticuloOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Autocomplete de empleados
  const [empSearch, setEmpSearch] = useState("");
  const [empFocused, setEmpFocused] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<EmpleadoOption | null>(null);
  const empRef = useRef<HTMLDivElement>(null);

  const empFiltered = empSearch.trim().length >= 1
    ? empleados.filter(e =>
        e.nombre_completo?.toLowerCase().includes(empSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  function selectEmp(emp: EmpleadoOption) {
    setSelectedEmp(emp);
    setEmpSearch(emp.nombre_completo);
    setEmpFocused(false);
    setForm(p => ({ ...p, employee_id: String(emp.id) }));
  }
  function clearEmp() {
    setSelectedEmp(null);
    setEmpSearch("");
    setForm(p => ({ ...p, employee_id: "" }));
  }

  const BLANK_FORM = {
    employee_id: "",
    nombre_articulo: "",
    tipo_cargo: "cargo_empleado" as "cargo_empleado" | "dotacion_cliente",
    monto_total: "",
    num_cuotas: "1",
    notas: "",
  };
  const [form, setForm] = useState(BLANK_FORM);
  const up = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const fmtQ = (n: number) => `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;

  async function cargar() {
    setLoading(true);
    const [pRes, eRes, aRes] = await Promise.all([
      api("/api/uniformes/pendientes"),
      api("/api/employees?activos=true&limit=500"),
      api("/api/bodega/articulos?limit=200"),
    ]);
    if (pRes.ok) setPendientes(await pRes.json());
    if (eRes.ok) {
      const d = await eRes.json();
      const arr: any[] = d.employees ?? d;
      setEmpleados(arr.map(e => ({
        id: e.id,
        nombre_completo: e.nombre_completo ?? e.nombreCompleto ?? "",
        puesto: e.puesto ?? e.area ?? undefined,
      })));
    }
    if (aRes.ok) { const d = await aRes.json(); setArticulos(d.articulos ?? d); }
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  async function registrar() {
    setErr(null);
    if (!form.employee_id || !form.nombre_articulo) { setErr("Empleado y artículo son requeridos"); return; }
    if (form.tipo_cargo === "cargo_empleado" && (!form.monto_total || Number(form.monto_total) <= 0)) {
      setErr("Monto requerido para cobro al empleado"); return;
    }
    setSaving(true);
    const r = await api("/api/uniformes/entregas", {
      method: "POST",
      body: JSON.stringify({
        employee_id: parseInt(form.employee_id),
        nombre_articulo: form.nombre_articulo,
        tipo_cargo: form.tipo_cargo,
        monto_total: form.tipo_cargo === "cargo_empleado" ? parseFloat(form.monto_total) : 0,
        num_cuotas: parseInt(form.num_cuotas) || 1,
        notas: form.notas || null,
      }),
    });
    setSaving(false);
    if (r.ok) { setOk(true); setForm(BLANK_FORM); clearEmp(); setVista("pendientes"); await cargar(); setTimeout(() => setOk(false), 3000); }
    else { const d = await r.json(); setErr(d.error ?? "Error al registrar"); }
  }

  async function condonar(id: number) {
    if (!confirm("¿Condonar el saldo pendiente de esta entrega?")) return;
    await api(`/api/uniformes/entregas/${id}/condonar`, { method: "PATCH", body: JSON.stringify({}) });
    cargar();
  }

  if (loading) return <div className="flex justify-center py-16 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Entrega y cobro de uniformes y botas. Las cuotas se descuentan automáticamente en planilla.</p>
        </div>
        <button onClick={() => setVista(v => v === "nueva" ? "pendientes" : "nueva")}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 rounded-lg border border-orange-500/20 transition-colors">
          {vista === "nueva" ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {vista === "nueva" ? "Cancelar" : "Registrar entrega"}
        </button>
      </div>

      {ok && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="text-sm text-emerald-300">Entrega registrada. Las cuotas se descontarán en la próxima planilla.</p>
        </div>
      )}

      {/* Formulario de registro */}
      {vista === "nueva" && (
        <div className="bg-[#0f1623] border border-white/10 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-white/80">Nueva Entrega de Uniforme / Botas</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* ── Autocomplete de colaborador ── */}
            <div className="space-y-1" ref={empRef}>
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Colaborador *</label>
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                  <input
                    type="text"
                    value={empSearch}
                    onChange={e => {
                      setEmpSearch(e.target.value);
                      if (selectedEmp && e.target.value !== selectedEmp.nombre_completo) {
                        setSelectedEmp(null);
                        setForm(p => ({ ...p, employee_id: "" }));
                      }
                      setEmpFocused(true);
                    }}
                    onFocus={() => setEmpFocused(true)}
                    onBlur={() => setTimeout(() => setEmpFocused(false), 150)}
                    placeholder="Buscar colaborador..."
                    className={`w-full bg-[#060e1c] border rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors ${
                      selectedEmp ? "border-orange-400/40" : "border-white/10 focus:border-orange-400/50"
                    }`}
                  />
                  {empSearch && (
                    <button
                      type="button"
                      onClick={clearEmp}
                      className="absolute right-2.5 text-white/20 hover:text-white/60 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown de sugerencias */}
                {empFocused && empFiltered.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-[#0b1628] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                    {empFiltered.map(emp => (
                      <button
                        key={emp.id}
                        type="button"
                        onMouseDown={() => selectEmp(emp)}
                        className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-orange-500/10 hover:text-white border-b border-white/5 last:border-0 transition-colors"
                      >
                        <span className="font-medium">{emp.nombre_completo}</span>
                        {emp.puesto && <span className="text-[11px] text-white/35 ml-2">— {emp.puesto}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sin resultados */}
                {empFocused && empSearch.trim().length >= 2 && empFiltered.length === 0 && !selectedEmp && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-[#0b1628] border border-white/15 rounded-xl shadow-2xl px-3 py-2.5">
                    <p className="text-xs text-white/30">Sin coincidencias para "{empSearch}"</p>
                  </div>
                )}

                {selectedEmp && (
                  <p className="text-[10px] text-orange-400/60 mt-1">Seleccionado: ID {selectedEmp.id}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Artículo entregado *</label>
              <select value={form.nombre_articulo} onChange={e => {
                const art = articulos.find(a => a.nombre === e.target.value);
                up("nombre_articulo", e.target.value);
                if (art && !form.monto_total) up("monto_total", String(art.costo_unitario ?? ""));
              }}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50">
                <option value="">— Artículo de bodega —</option>
                {articulos.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                <option value="Uniforme completo">Uniforme completo</option>
                <option value="Botas de seguridad">Botas de seguridad</option>
                <option value="Camisa">Camisa</option>
                <option value="Pantalón">Pantalón</option>
              </select>
              {!form.nombre_articulo && (
                <input type="text" placeholder="O escribir nombre del artículo"
                  onChange={e => up("nombre_articulo", e.target.value)}
                  className="w-full mt-1 bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-orange-400/50" />
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Tipo de cargo</label>
              <select value={form.tipo_cargo} onChange={e => up("tipo_cargo", e.target.value as any)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50">
                <option value="cargo_empleado">Cobro al empleado (cuotas planilla)</option>
                <option value="dotacion_cliente">Dotación del cliente (sin cobro)</option>
              </select>
              {form.tipo_cargo === "dotacion_cliente" && (
                <p className="text-[10px] text-yellow-400/70 mt-1">No genera cuotas. El cliente cubre el costo.</p>
              )}
            </div>
            {form.tipo_cargo === "cargo_empleado" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wide">Monto total (Q)</label>
                  <input type="number" min="0" step="0.01" value={form.monto_total} onChange={e => up("monto_total", e.target.value)}
                    className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50"
                    placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wide">Número de cuotas</label>
                  <select value={form.num_cuotas} onChange={e => up("num_cuotas", e.target.value)}
                    className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50">
                    {[1, 2, 3, 4, 6].map(n => (
                      <option key={n} value={n}>
                        {n} cuota{n > 1 ? "s" : ""}
                        {form.monto_total && Number(form.monto_total) > 0
                          ? ` — ${fmtQ(Number(form.monto_total) / n)} c/u`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-white/30">Cada cuota se descuenta en una planilla diferente</p>
                </div>
              </>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => up("notas", e.target.value)} rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-orange-400/50 resize-none"
              placeholder="Motivo, talla, observaciones..." />
          </div>

          {err && <div className="flex items-center gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4 flex-shrink-0" />{err}</div>}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setVista("pendientes")} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
            <button onClick={registrar} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Registrar entrega
            </button>
          </div>
        </div>
      )}

      {/* Lista de pendientes */}
      {vista === "pendientes" && (
        <>
          {pendientes.length === 0
            ? <div className="text-center py-12 text-gray-600 border border-dashed border-white/10 rounded-xl">
                <Layers className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Sin cuotas de uniforme pendientes.</p>
                <p className="text-xs mt-1 text-gray-700">Al registrar una entrega con cargo al empleado aparecerá aquí.</p>
              </div>
            : (
              <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/5 uppercase text-[10px]">
                      <th className="px-4 py-3 text-left">Colaborador</th>
                      <th className="px-4 py-3 text-left">Artículo</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-center">Cuotas</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map(r => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="px-4 py-3">
                          <p className="text-white/80 font-medium">{r.empleado_nombre}</p>
                          {r.empleado_puesto && <p className="text-gray-600 text-[10px]">{r.empleado_puesto}</p>}
                        </td>
                        <td className="px-4 py-3 text-white/60">{r.nombre_articulo}</td>
                        <td className="px-4 py-3 text-right font-mono text-white/70">{fmtQ(r.monto_total)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-orange-300 font-mono">{r.cuotas_pendientes}</span>
                          <span className="text-gray-600">/{r.num_cuotas}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-orange-300 font-semibold">{fmtQ(r.saldo_pendiente)}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(r.created_at).toLocaleDateString("es-GT")}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => condonar(r.id)}
                            className="text-[10px] px-2 py-1 bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-lg border border-white/10 transition-colors">
                            Condonar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          <p className="text-[10px] text-white/20 text-right">
            Las cuotas se descuentan automáticamente al generar planilla. Al liquidar, el saldo restante se descuenta del finiquito.
          </p>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Página principal ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "dashboard",   label: "Dashboard",         icon: BarChart3 },
  { id: "catalogo",    label: "Catálogo",           icon: ClipboardList },
  { id: "inventario",  label: "Inventario",         icon: Package },
  { id: "movimientos", label: "Movimientos",        icon: History },
  { id: "kit_ingreso", label: "Kit de Ingreso",     icon: Settings },
  { id: "dotaciones",  label: "Dotaciones",         icon: UserCheck },
  { id: "ordenes",     label: "Órdenes de Compra",  icon: ShoppingCart },
  { id: "uniformes",   label: "Uniformes & Cobros", icon: Layers },
] as const;

type TabId = typeof TABS[number]["id"];

export default function Bodega() {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <AdminLayout title="Bodega">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Bodega & Inventario</h1>
            <p className="text-sm text-gray-400">Control de activos — asignación a puestos y colaboradores</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-[#0f1623] border border-white/10 rounded-xl p-1 gap-1 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? "bg-orange-500/15 text-orange-300" : "text-gray-500 hover:text-gray-300"}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {tab === "dashboard"   && <TabDashboard />}
        {tab === "catalogo"    && <TabCatalogo />}
        {tab === "inventario"  && <TabInventario />}
        {tab === "movimientos" && <TabMovimientos />}
        {tab === "kit_ingreso" && <TabKitIngreso />}
        {tab === "dotaciones"  && <TabDotaciones />}
        {tab === "ordenes"     && <TabOrdenes />}
        {tab === "uniformes"   && <TabUniformes />}
      </div>
    </AdminLayout>
  );
}
