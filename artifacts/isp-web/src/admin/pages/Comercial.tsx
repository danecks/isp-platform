import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { leadsApi } from "@/lib/api";
import { Briefcase, Filter, Loader2, RefreshCw, CheckCircle2, UserPlus, X, Calendar, Plus, Banknote, TrendingUp, AlertTriangle, ChevronRight } from "lucide-react";
import LeadDetallePanel from "../components/LeadDetallePanel";
import { getSessionToken } from "@/lib/httpClient";

type EstadoLead = "nuevo" | "contactado" | "cotizado" | "ganado" | "perdido";
type CanalFilter = "todos" | "whatsapp" | "web" | "otro";

const ESTADOS: (EstadoLead | "todos")[] = ["todos", "nuevo", "contactado", "cotizado", "ganado", "perdido"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

const API = "/api";

async function convertirCliente(id: number, fechaInicioContrato?: string): Promise<{ ok: boolean; clienteId?: number; msg?: string }> {
  try {
    const r = await fetch(`${API}/leads/${id}/convertir-cliente`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha_inicio_contrato: fechaInicioContrato || null }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, msg: data.error || "Error al convertir" };
    return { ok: true, clienteId: data.clienteId };
  } catch (err) {
    return { ok: false, msg: (err as Error).message };
  }
}

interface ModalConvertirState {
  leadId: number;
  empresa: string;
  fecha: string;
  submitting: boolean;
  error: string | null;
}

const JORNADAS_OPT = ["24x24", "12x12", "8x8", "6x6", "turno_unico"];
const CANALES_MANUAL = ["manual", "referido", "prospeccion", "feria", "llamada", "whatsapp", "web"];

function ModalNuevoLead({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    empresa: "", contacto: "", telefono: "", correo: "",
    servicio: "", ubicacion: "Guatemala", canal: "manual",
    ejecutivo: "", notas: "", num_puestos: "", tipo_jornada: "24x24",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function guardar() {
    if (!form.empresa.trim() || !form.contacto.trim() || !form.servicio.trim()) {
      return setErr("Empresa, contacto y servicio son requeridos.");
    }
    setSaving(true); setErr(null);
    const r = await fetch(`${API}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa: form.empresa, contacto: form.contacto, telefono: form.telefono,
        correo: form.correo, servicio: form.servicio, ubicacion: form.ubicacion,
        canal: form.canal, ejecutivo: form.ejecutivo || null, notas: form.notas || null,
        num_puestos: form.num_puestos ? parseInt(form.num_puestos) : null,
        tipo_jornada: form.tipo_jornada || null,
      }),
    });
    setSaving(false);
    if (r.ok) { onCreated(); onClose(); }
    else { const d = await r.json(); setErr(d.error || "Error al crear lead"); }
  }

  const inputCls = "w-full bg-[#060f1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50";
  const labelCls = "text-xs text-white/40 block mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-[#0a1628] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">Nuevo Lead</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Empresa / Prospecto *</label>
              <input value={form.empresa} onChange={e => set("empresa", e.target.value)} placeholder="Ej: Supermercados La Colonia" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contacto *</label>
              <input value={form.contacto} onChange={e => set("contacto", e.target.value)} placeholder="Nombre del contacto" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input value={form.telefono} onChange={e => set("telefono", e.target.value)} placeholder="+(502) 5555-0000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Correo</label>
              <input type="email" value={form.correo} onChange={e => set("correo", e.target.value)} placeholder="correo@empresa.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Servicio solicitado *</label>
              <input value={form.servicio} onChange={e => set("servicio", e.target.value)} placeholder="Ej: Seguridad física 24x7" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ubicación</label>
              <input value={form.ubicacion} onChange={e => set("ubicacion", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Canal de origen</label>
              <select value={form.canal} onChange={e => set("canal", e.target.value)} className={inputCls}>
                {CANALES_MANUAL.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ejecutivo asignado</label>
              <input value={form.ejecutivo} onChange={e => set("ejecutivo", e.target.value)} placeholder="Nombre del ejecutivo" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>N° de puestos estimados</label>
              <input type="number" min={0} value={form.num_puestos} onChange={e => set("num_puestos", e.target.value)} placeholder="Ej: 3" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo de jornada</label>
              <select value={form.tipo_jornada} onChange={e => set("tipo_jornada", e.target.value)} className={inputCls}>
                {JORNADAS_OPT.map(j => <option key={j} value={j}>{j.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => set("notas", e.target.value)} rows={2}
                className="w-full bg-[#060f1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none" />
            </div>
          </div>
          {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-sm text-white/50 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            className="flex-1 px-3 py-2 text-sm font-semibold bg-primary/20 hover:bg-primary/30 text-primary border border-primary/25 rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Crear Lead
          </button>
        </div>
      </div>
    </div>
  );
}

const fmtQG = (n: number) => n.toLocaleString("es-GT", { style: "currency", currency: "GTQ", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const getSessionC = () => getSessionToken();

function PanelRentabilidadGlobal() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/rentabilidad/global`, { headers: { "x-isp-session": getSessionC() } })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>;
  if (err) return <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">{err}</div>;
  if (!data) return null;

  const { clientes, totales } = data;
  const negativos = clientes.filter((c: any) => c.margen < 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ingreso Neto Total", value: fmtQG(totales.ingreso_neto), sub: `${totales.total_puestos} puestos`, color: "text-cyan-400" },
          { label: "Costo Operativo Total", value: fmtQG(totales.costo_operativo), sub: `${totales.total_titulares} titulares`, color: "text-amber-400" },
          { label: "Margen Global", value: fmtQG(totales.margen), sub: `${totales.margen_pct}%`, color: totales.margen >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Clientes en Riesgo", value: String(negativos.length), sub: "Margen negativo", color: negativos.length > 0 ? "text-red-400" : "text-emerald-400" },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {negativos.length > 0 && (
        <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">Clientes con Margen Negativo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {negativos.map((c: any) => (
              <span key={c.id} className="px-2.5 py-1 text-xs bg-red-500/15 border border-red-500/20 rounded-lg text-red-300">
                {c.nombre}: {fmtQG(c.margen)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/40">
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-right px-3 py-3">Puestos</th>
              <th className="text-right px-3 py-3">Tarifa Bruta</th>
              <th className="text-right px-3 py-3">Ingreso Neto</th>
              <th className="text-right px-3 py-3">Costo Op.</th>
              <th className="text-right px-3 py-3">Margen</th>
              <th className="text-right px-3 py-3">%</th>
              <th className="text-center px-3 py-3">Bajas</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c: any) => (
              <tr key={c.id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="text-white font-medium">{c.nombre}</span>
                </td>
                <td className="text-right px-3 py-2.5 text-white/60">{c.total_puestos}</td>
                <td className="text-right px-3 py-2.5 text-white/40 font-mono text-xs">{fmtQG(c.tarifa_bruta)}</td>
                <td className="text-right px-3 py-2.5 text-cyan-400/80 font-mono text-xs">{fmtQG(c.ingreso_neto)}</td>
                <td className="text-right px-3 py-2.5 text-amber-400/80 font-mono text-xs">{fmtQG(c.costo_operativo)}</td>
                <td className={`text-right px-3 py-2.5 font-mono text-xs font-semibold ${c.margen >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtQG(c.margen)}</td>
                <td className={`text-right px-3 py-2.5 text-xs ${c.margen_pct >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>{c.margen_pct}%</td>
                <td className="text-center px-3 py-2.5">
                  {(c.bajas_con_indem > 0 || c.bajas_sin_indem > 0) ? (
                    <span className="text-[10px] text-white/40">{c.bajas_con_indem}c / {c.bajas_sin_indem}s</span>
                  ) : <span className="text-white/15">—</span>}
                </td>
                <td className="px-2 py-2.5">
                  <a href={`/admin/clientes/${c.id}`} className="text-white/20 hover:text-primary transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 bg-white/3 font-semibold">
              <td className="px-4 py-3 text-white/60 text-xs uppercase">Totales</td>
              <td className="text-right px-3 py-3 text-white/60">{totales.total_puestos}</td>
              <td className="text-right px-3 py-3 text-white/40 font-mono text-xs">{fmtQG(totales.tarifa_bruta)}</td>
              <td className="text-right px-3 py-3 text-cyan-400 font-mono text-xs">{fmtQG(totales.ingreso_neto)}</td>
              <td className="text-right px-3 py-3 text-amber-400 font-mono text-xs">{fmtQG(totales.costo_operativo)}</td>
              <td className={`text-right px-3 py-3 font-mono text-xs ${totales.margen >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtQG(totales.margen)}</td>
              <td className={`text-right px-3 py-3 text-xs ${totales.margen_pct >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>{totales.margen_pct}%</td>
              <td className="text-center px-3 py-3 text-[10px] text-white/40">{totales.bajas_con_indem}c / {totales.bajas_sin_indem}s</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

type ComercialTab = "leads" | "rentabilidad";

export default function Comercial() {
  const qc = useQueryClient();
  const [comTab, setComTab] = useState<ComercialTab>("leads");
  const [filtro, setFiltro] = useState<EstadoLead | "todos">("todos");
  const [canalFiltro, setCanalFiltro] = useState<CanalFilter>("todos");
  const [convirtiendo, setConvirtiendo] = useState<number | null>(null);
  const [convertidos, setConvertidos] = useState<Record<number, number>>({});
  const [errores, setErrores] = useState<Record<number, string>>({});
  const [modalConvertir, setModalConvertir] = useState<ModalConvertirState | null>(null);
  const [modalNuevoLead, setModalNuevoLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const { data: leads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads"],
    queryFn: leadsApi.getAll,
    refetchInterval: 30000,
  });

  const filtrados = leads.filter((l) => {
    if (filtro !== "todos" && l.estado !== filtro) return false;
    if (canalFiltro === "whatsapp" && l.canal !== "whatsapp") return false;
    if (canalFiltro === "web" && l.canal !== "web") return false;
    if (canalFiltro === "otro" && (l.canal === "whatsapp" || l.canal === "web")) return false;
    return true;
  });

  const waCount = leads.filter((l) => l.canal === "whatsapp").length;

  return (
    <AdminLayout title="Gestión Comercial">
      <div className="space-y-6 max-w-[1400px]">

        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          {([
            { id: "leads" as ComercialTab, label: "Pipeline de Leads", icon: Briefcase },
            { id: "rentabilidad" as ComercialTab, label: "Rentabilidad por Cliente", icon: TrendingUp },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setComTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all ${comTab === id ? "bg-primary/15 text-primary border border-primary/30 font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {comTab === "rentabilidad" && <PanelRentabilidadGlobal />}

        {comTab === "leads" && <div className="space-y-6">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["nuevo", "contactado", "cotizado", "ganado", "perdido"] as EstadoLead[]).map((e) => {
            const cnt = leads.filter((l) => l.estado === e).length;
            return (
              <button
                key={e}
                onClick={() => setFiltro(filtro === e ? "todos" : e)}
                className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                  filtro === e ? "border-primary/40" : "border-white/5 hover:border-white/10"
                }`}
              >
                <p className="text-2xl font-bold text-white">{isLoading ? "—" : cnt}</p>
                <div className="mt-1"><StatusBadge value={e} /></div>
              </button>
            );
          })}
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-start gap-3">
          <Filter className="w-4 h-4 text-white/30 mt-1 shrink-0" />

          <div className="flex-1 flex flex-col gap-2">
            {/* Fila 1: Estado */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-white/25 uppercase tracking-widest w-14 shrink-0">Estado</span>
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltro(e)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    filtro === e
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                  }`}
                >
                  {e === "todos" ? "Todos" : <StatusBadge value={e} />}
                </button>
              ))}
            </div>

            {/* Fila 2: Canal */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-white/25 uppercase tracking-widest w-14 shrink-0">Canal</span>
              {(["todos", "whatsapp", "web", "otro"] as CanalFilter[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCanalFiltro(canalFiltro === c ? "todos" : c)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    canalFiltro === c
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                  }`}
                >
                  {c === "todos" ? (
                    <span>Todos</span>
                  ) : (
                    <StatusBadge value={c as any} />
                  )}
                </button>
              ))}
              {waCount > 0 && (
                <span className="text-[10px] text-[#25D366]/70 bg-[#25D366]/8 border border-[#25D366]/15 px-2 py-0.5 rounded-full">
                  {waCount} via WhatsApp
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="ml-auto flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Actualizar
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Pipeline Comercial</p>
              <span className="text-[10px] text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full font-semibold ml-1">Base de datos real</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30">{filtrados.length} leads</span>
              <button
                onClick={() => setModalNuevoLead(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 hover:bg-primary/25 text-primary text-xs rounded-lg border border-primary/20 transition-colors"
              >
                <Plus size={12} /> Nuevo Lead
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Cargando leads...</span>
            </div>
          )}

          {isError && (
            <div className="py-10 text-center text-xs text-red-400">
              Error al cargar leads. Verifique la conexión con el API.
            </div>
          )}

          {!isLoading && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-5 py-3">ID</th>
                    <th className="text-left px-3 py-3">Empresa</th>
                    <th className="text-left px-3 py-3">Contacto</th>
                    <th className="text-left px-3 py-3">Servicio</th>
                    <th className="text-left px-3 py-3">Ubicación</th>
                    <th className="text-left px-3 py-3">Canal</th>
                    <th className="text-left px-3 py-3">Estado</th>
                    <th className="text-left px-3 py-3">Ejecutivo</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                    <th className="text-left px-3 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((l) => {
                    const clienteIdConv = convertidos[l.id];
                    const error = errores[l.id];
                    return (
                    <tr
                      key={l.id}
                      onClick={() => setSelectedLead(l)}
                      className={`border-b border-white/3 hover:bg-white/2 transition-colors cursor-pointer ${
                        l.canal === "whatsapp" ? "bg-[#25D366]/3" : ""
                      }`}
                    >
                      <td className="px-5 py-3 text-primary font-mono font-semibold">#{l.id}</td>
                      <td className="px-3 py-3 text-white/80 font-medium max-w-[150px] truncate">{l.empresa}</td>
                      <td className="px-3 py-3 text-white/60">{l.contacto}</td>
                      <td className="px-3 py-3 text-white/50">{l.servicio}</td>
                      <td className="px-3 py-3 text-white/40 max-w-[130px] truncate">{l.ubicacion}</td>
                      <td className="px-3 py-3"><StatusBadge value={l.canal as any} /></td>
                      <td className="px-3 py-3"><StatusBadge value={l.estado} /></td>
                      <td className="px-3 py-3 text-white/50">{l.ejecutivo}</td>
                      <td className="px-3 py-3 text-white/30 whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {l.estado === "ganado" && (
                          clienteIdConv ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
                              <CheckCircle2 size={11} />
                              Cliente #{clienteIdConv}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); setModalConvertir({ leadId: l.id, empresa: l.empresa, fecha: "", submitting: false, error: null }); }}
                                disabled={convirtiendo === l.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-[11px] rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50"
                                title="Convertir a Cliente"
                              >
                                <UserPlus size={11} />
                                <span>Convertir</span>
                              </button>
                              {error && (
                                <span className="text-[10px] text-red-400/70 max-w-[120px] truncate" title={error}>{error}</span>
                              )}
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-5 py-10 text-center text-white/30 text-xs">
                        No hay leads con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>}
      {/* ── Modal: Nuevo Lead ── */}
      {modalNuevoLead && (
        <ModalNuevoLead onClose={() => setModalNuevoLead(false)} onCreated={() => { refetch(); qc.invalidateQueries({ queryKey: ["leads"] }); }} />
      )}

      {/* ── Panel Detalle Lead ── */}
      {selectedLead && (
        <LeadDetallePanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onLeadUpdate={(updated) => {
            setSelectedLead(updated);
            refetch();
          }}
        />
      )}

      {/* ── Modal: Convertir Lead a Cliente ── */}
      {modalConvertir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0a1628] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <UserPlus size={15} className="text-emerald-400" />
                <span className="text-sm font-semibold text-white">Convertir a Cliente</span>
              </div>
              <button
                onClick={() => setModalConvertir(null)}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="bg-white/4 rounded-xl px-3 py-2.5 text-sm text-white/70">
                <span className="text-white/40 text-xs block mb-0.5">Empresa</span>
                <span className="font-medium text-white">{modalConvertir.empresa}</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
                  <Calendar size={12} className="text-amber-400" />
                  Fecha de inicio del contrato / proyecto
                  <span className="text-amber-400/70 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={modalConvertir.fecha}
                  onChange={(e) => setModalConvertir(p => p ? { ...p, fecha: e.target.value, error: null } : p)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="bg-[#060f1a] border border-white/12 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 transition-all"
                />
                <p className="text-[10px] text-white/30">
                  Esta fecha aparecerá como "Arranque Programado" en el Pizarrón Futuro de Operaciones.
                </p>
              </div>

              {modalConvertir.error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {modalConvertir.error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setModalConvertir(null)}
                className="flex-1 px-3 py-2 text-sm text-white/50 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!modalConvertir.fecha || modalConvertir.submitting}
                onClick={async () => {
                  if (!modalConvertir.fecha) {
                    setModalConvertir(p => p ? { ...p, error: "La fecha de inicio es obligatoria." } : p);
                    return;
                  }
                  setModalConvertir(p => p ? { ...p, submitting: true, error: null } : p);
                  const res = await convertirCliente(modalConvertir.leadId, modalConvertir.fecha);
                  if (res.ok && res.clienteId) {
                    setConvertidos(p => ({ ...p, [modalConvertir.leadId]: res.clienteId! }));
                    setModalConvertir(null);
                  } else {
                    setModalConvertir(p => p ? { ...p, submitting: false, error: res.msg ?? "Error al convertir" } : p);
                  }
                }}
                className="flex-1 px-3 py-2 text-sm font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/25 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {modalConvertir.submitting ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
