import { useState, useEffect, useRef } from "react";
import {
  Package, PackageOpen, Building2, User, Search, Plus, ChevronDown,
  ChevronRight, Edit2, Trash2, X, Check, Loader2, AlertCircle,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Archive, Tag,
  ClipboardList, BarChart3, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "../layout/AdminLayout";

function getSession() {
  return sessionStorage.getItem("isp_admin_session_v2") || "";
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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function guardar() {
    if (!nombre.trim() || !prefijo.trim()) return setErr("Nombre y prefijo son requeridos");
    setSaving(true); setErr("");
    const url = art ? `/api/bodega/articulos/${art.id}` : "/api/bodega/articulos";
    const method = art ? "PUT" : "POST";
    const r = await api(url, { method, body: JSON.stringify({ nombre, descripcion: desc, categoria_id: catId ? +catId : null, codigo_prefijo: prefijo, tipo_rastreo: rastreo, tipo_asignacion: asignacion }) });
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

  async function eliminarCat(id: number) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await api(`/api/bodega/categorias/${id}`, { method: "DELETE" });
    cargar();
  }
  async function eliminarArt(id: number) {
    if (!confirm("¿Eliminar este artículo del catálogo?")) return;
    await api(`/api/bodega/articulos/${id}`, { method: "DELETE" });
    cargar();
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
              <button onClick={e => { e.stopPropagation(); eliminarCat(c.id); }} className="hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
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
                <button onClick={() => eliminarArt(a.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
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
    if (r.ok) { onSaved(); onClose(); } else setErr(await r.text());
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
// ─── Página principal ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "dashboard", label: "Dashboard",  icon: BarChart3 },
  { id: "catalogo",  label: "Catálogo",   icon: ClipboardList },
  { id: "inventario",label: "Inventario", icon: Package },
  { id: "movimientos",label: "Movimientos", icon: History },
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
      </div>
    </AdminLayout>
  );
}
