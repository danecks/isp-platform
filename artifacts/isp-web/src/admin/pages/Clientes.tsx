import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import {
  Building2, Tag, MapPin, Search, Plus, Trash2, ChevronDown, ChevronRight,
  X, Loader2, CheckCircle, AlertTriangle, Hash, RefreshCw, Layers,
  Shield, Users, Clock, ExternalLink
} from "lucide-react";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Alias { id: number; alias: string; tipoAlias: string; createdAt: string; }
interface Client {
  id: number; nombre: string; nombreComercial: string | null; nit: string | null;
  sector: string | null; estado: string; portalClienteId: string | null;
  notas: string | null; createdAt: string; aliases: Alias[];
}
interface ServiceLocation {
  id: number; clientId: number; clienteNombre: string; clienteNombreComercial: string | null;
  nombrePuesto: string; ubicacion: string | null; tipo: string; estado: string;
  notas: string | null; createdAt: string; aliases: Alias[];
}
interface ResolverResult {
  input: string; inputNormalizado: string; totalCoincidencias: number;
  confianzaMaxima: number; ambiguo: boolean; resultados: any[]; sugerencia: string | null;
}

// ─── Colores de confianza ─────────────────────────────────────────────────────
const confianzaColor = (c: number) =>
  c >= 0.85 ? "text-emerald-400" : c >= 0.65 ? "text-yellow-400" : "text-orange-400";

const confianzaBg = (c: number) =>
  c >= 0.85 ? "bg-emerald-500/10 border-emerald-500/30" : c >= 0.65 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-orange-500/10 border-orange-500/30";

// ─── Tipo de alias badge ──────────────────────────────────────────────────────
const tipoBadge = (tipo: string) => {
  const map: Record<string, string> = {
    comercial: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    operativo: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    comun: "bg-white/5 text-white/40 border-white/10",
  };
  return map[tipo] || map.comun;
};

// ─── Modal: Agregar Alias ─────────────────────────────────────────────────────
function ModalAgregarAlias({
  titulo, onClose, onSave,
}: { titulo: string; onClose: () => void; onSave: (alias: string, tipo: string) => Promise<void>; }) {
  const [alias, setAlias] = useState("");
  const [tipo, setTipo] = useState<"comun" | "operativo" | "comercial">("comun");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const handleSave = async () => {
    if (!alias.trim()) { setError("El alias no puede estar vacío"); return; }
    setLoading(true); setError("");
    try {
      await onSave(alias.trim(), tipo);
      onClose();
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0c1829] border border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-white">{titulo}</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Alias</label>
            <input
              ref={inputRef}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
              placeholder='ej. "gallo", "custodio gallo", "ruta norte"'
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Tipo de Alias</label>
            <div className="flex gap-2">
              {(["comun", "operativo", "comercial"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs border capitalize transition-all ${tipo === t ? tipoBadge(t) + " ring-1 ring-current/30" : "bg-white/3 border-white/8 text-white/30 hover:bg-white/5"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-1">
              Común: nombre cotidiano · Operativo: usado en radio/reportes · Comercial: nombre de marca
            </p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/8 text-white/60 text-xs transition-all">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-black font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Agregar Alias
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Fila de cliente expandible ───────────────────────────────────────────────
function FilaCliente({ client, onRefresh }: { client: Client; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [, navigate] = useLocation();

  const addAlias = async (alias: string, tipo: string) => {
    const r = await fetch(`${API}/alias/clientes/${client.id}/alias`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({ alias, tipoAlias: tipo }),
    });
    if (!r.ok) throw new Error("No se pudo agregar el alias");
    onRefresh();
  };

  const deleteAlias = async (aliasId: number) => {
    if (!confirm("¿Eliminar este alias?")) return;
    await fetch(`${API}/alias/clientes/alias/${aliasId}`, {
      method: "DELETE",
      headers: { "x-isp-session": getSession() },
    });
    onRefresh();
  };

  return (
    <>
      <tr
        className="border-b border-white/3 hover:bg-white/2 transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <td className="px-5 py-4 w-6">
          {open ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
        </td>
        <td className="px-3 py-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-white text-xs">{client.nombre}</p>
              {client.nombreComercial && (
                <p className="text-[10px] text-primary/70 mt-0.5">{client.nombreComercial}</p>
              )}
              {client.portalClienteId && (
                <span className="text-[9px] font-mono text-blue-400/60 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                  Portal: {client.portalClienteId}
                </span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/clientes/${client.id}`); }}
              className="flex items-center gap-1 text-[10px] text-primary/50 hover:text-primary transition-colors shrink-0 px-1.5 py-0.5 rounded hover:bg-primary/8"
              title="Ver ficha completa"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Ficha
            </button>
          </div>
        </td>
        <td className="px-3 py-4">
          <span className="text-[10px] text-white/40 capitalize bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
            {client.sector || "—"}
          </span>
        </td>
        <td className="px-3 py-4">
          <div className="flex flex-wrap gap-1">
            {client.aliases.slice(0, 3).map((a) => (
              <span key={a.id} className={`text-[9px] border px-1.5 py-0.5 rounded-full ${tipoBadge(a.tipoAlias)}`}>
                {a.alias}
              </span>
            ))}
            {client.aliases.length > 3 && (
              <span className="text-[9px] text-white/30 px-1.5 py-0.5">+{client.aliases.length - 3}</span>
            )}
            {client.aliases.length === 0 && (
              <span className="text-[9px] text-white/20 italic">sin alias</span>
            )}
          </div>
        </td>
        <td className="px-3 py-4"><StatusBadge value={client.estado} /></td>
      </tr>

      {open && (
        <tr className="border-b border-white/5 bg-[#060e1a]">
          <td colSpan={5} className="px-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-bold">Alias registrados ({client.aliases.length})</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar Alias
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {client.aliases.map((a) => (
                  <div key={a.id} className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-full text-xs ${tipoBadge(a.tipoAlias)}`}>
                    <span>{a.alias}</span>
                    <span className="text-[8px] opacity-50 capitalize">· {a.tipoAlias}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAlias(a.id); }}
                      className="opacity-40 hover:opacity-100 ml-1 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {client.aliases.length === 0 && (
                  <p className="text-xs text-white/25 italic">No hay alias registrados para este cliente.</p>
                )}
              </div>
              {client.notas && (
                <p className="text-[10px] text-white/30 border-t border-white/5 pt-2 mt-2">
                  <span className="font-bold">Notas:</span> {client.notas}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}

      {showModal && (
        <ModalAgregarAlias
          titulo={`Alias para: ${client.nombreComercial || client.nombre}`}
          onClose={() => setShowModal(false)}
          onSave={addAlias}
        />
      )}
    </>
  );
}

// ─── Fila de puesto expandible ────────────────────────────────────────────────
function FilaPuesto({ puesto, onRefresh }: { puesto: ServiceLocation; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const addAlias = async (alias: string, tipo: string) => {
    const r = await fetch(`${API}/alias/puestos/${puesto.id}/alias`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({ alias, tipoAlias: tipo }),
    });
    if (!r.ok) throw new Error("No se pudo agregar el alias");
    onRefresh();
  };

  const deleteAlias = async (aliasId: number) => {
    if (!confirm("¿Eliminar este alias?")) return;
    await fetch(`${API}/alias/puestos/alias/${aliasId}`, {
      method: "DELETE",
      headers: { "x-isp-session": getSession() },
    });
    onRefresh();
  };

  const tipoIcono: Record<string, string> = {
    puerta: "🚪", bodega: "📦", ruta: "🛣️", planta: "🏭", perimetral: "🔒", vigilancia: "👁",
  };

  return (
    <>
      <tr
        className="border-b border-white/3 hover:bg-white/2 transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <td className="px-5 py-3.5 w-6">
          {open ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{tipoIcono[puesto.tipo] || "📍"}</span>
            <div>
              <p className="font-bold text-white text-xs">{puesto.nombrePuesto}</p>
              {puesto.ubicacion && <p className="text-[10px] text-white/30 mt-0.5">{puesto.ubicacion}</p>}
            </div>
          </div>
        </td>
        <td className="px-3 py-3.5">
          <div>
            <p className="text-xs text-primary/80">{puesto.clienteNombreComercial || puesto.clienteNombre}</p>
            <p className="text-[9px] text-white/30">{puesto.clienteNombre}</p>
          </div>
        </td>
        <td className="px-3 py-3.5">
          <span className="text-[10px] text-white/40 capitalize bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
            {puesto.tipo}
          </span>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex flex-wrap gap-1">
            {puesto.aliases.slice(0, 3).map((a) => (
              <span key={a.id} className={`text-[9px] border px-1.5 py-0.5 rounded-full ${tipoBadge(a.tipoAlias)}`}>
                {a.alias}
              </span>
            ))}
            {puesto.aliases.length > 3 && (
              <span className="text-[9px] text-white/30 px-1.5 py-0.5">+{puesto.aliases.length - 3}</span>
            )}
            {puesto.aliases.length === 0 && (
              <span className="text-[9px] text-white/20 italic">sin alias</span>
            )}
          </div>
        </td>
        <td className="px-3 py-3.5"><StatusBadge value={puesto.estado} /></td>
      </tr>

      {open && (
        <tr className="border-b border-white/5 bg-[#060e1a]">
          <td colSpan={6} className="px-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-bold">Alias del puesto ({puesto.aliases.length})</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar Alias
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {puesto.aliases.map((a) => (
                  <div key={a.id} className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-full text-xs ${tipoBadge(a.tipoAlias)}`}>
                    <span>{a.alias}</span>
                    <span className="text-[8px] opacity-50 capitalize">· {a.tipoAlias}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAlias(a.id); }}
                      className="opacity-40 hover:opacity-100 ml-1 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {puesto.aliases.length === 0 && (
                  <p className="text-xs text-white/25 italic">No hay alias registrados para este puesto.</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}

      {showModal && (
        <ModalAgregarAlias
          titulo={`Alias para: ${puesto.nombrePuesto}`}
          onClose={() => setShowModal(false)}
          onSave={addAlias}
        />
      )}
    </>
  );
}

// ─── Pestaña: Resolver Alias ──────────────────────────────────────────────────
function TabResolver() {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResolverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ejemplos = ["gallo", "custodio gallo", "salvavidas", "ruta norte", "dolores", "distnac", "bodega gallo", "planta salvavidas", "distribuidora"];

  const resolver = async (q: string) => {
    if (q.trim().length < 2) { setResultado(null); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/alias/resolver?q=${encodeURIComponent(q)}`, {
        headers: { "x-isp-session": getSession() },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error");
      setResultado(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (val: string) => {
    setTexto(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => resolver(val), 400);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-[#0c1829] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-white">Resolver Alias en Tiempo Real</h3>
        </div>

        <div className="relative">
          <input
            type="text"
            value={texto}
            onChange={(e) => handleChange(e.target.value)}
            placeholder='Escribe un alias: "gallo", "custodio gallo", "ruta norte"...'
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50 transition-colors pr-10"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-white/30 absolute right-3 top-3.5" />}
          {!loading && texto && (
            <button onClick={() => { setTexto(""); setResultado(null); }} className="absolute right-3 top-3.5 text-white/20 hover:text-white/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {ejemplos.map((ej) => (
            <button
              key={ej}
              onClick={() => { setTexto(ej); resolver(ej); }}
              className="text-[10px] text-white/40 hover:text-primary bg-white/3 hover:bg-primary/10 border border-white/8 hover:border-primary/30 px-2 py-1 rounded-full transition-all"
            >
              {ej}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {resultado && (
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Resultado para: <span className="text-white font-mono">"{resultado.input}"</span></p>
              <p className="text-[10px] text-white/25 mt-0.5">Normalizado: {resultado.inputNormalizado}</p>
            </div>
            <div className="flex items-center gap-2">
              {resultado.ambiguo && (
                <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> Ambiguo
                </span>
              )}
              <span className="text-[10px] text-white/30">{resultado.totalCoincidencias} coincidencia{resultado.totalCoincidencias !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {resultado.sugerencia && (
            <div className={`rounded-lg border p-3 ${resultado.totalCoincidencias === 0 ? "bg-red-500/5 border-red-500/20" : resultado.ambiguo ? "bg-yellow-500/5 border-yellow-500/20" : "bg-emerald-500/5 border-emerald-500/20"}`}>
              <p className="text-xs text-white/70">{resultado.sugerencia}</p>
            </div>
          )}

          {resultado.resultados.length > 0 && (
            <div className="space-y-2">
              {resultado.resultados.map((r: any, i: number) => (
                <div key={i} className={`border rounded-xl p-3.5 ${confianzaBg(r.confianza)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {r.tipo === "cliente" ? <Building2 className="w-3.5 h-3.5 text-blue-400 mt-0.5" /> : <MapPin className="w-3.5 h-3.5 text-amber-400 mt-0.5" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white">
                            {r.tipo === "cliente" ? (r.nombreComercial || r.nombre) : r.nombrePuesto}
                          </p>
                          <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${r.tipo === "cliente" ? "text-blue-300 bg-blue-500/10 border-blue-500/20" : "text-amber-300 bg-amber-500/10 border-amber-500/20"}`}>
                            {r.tipo}
                          </span>
                        </div>
                        {r.tipo === "cliente" && r.nombre !== r.nombreComercial && r.nombre && (
                          <p className="text-[10px] text-white/40 mt-0.5">{r.nombre}</p>
                        )}
                        {r.tipo === "puesto" && (
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {r.clienteNombre} {r.ubicacion ? `· ${r.ubicacion}` : ""}
                          </p>
                        )}
                        <p className="text-[10px] text-white/30 mt-1">
                          Coincidió con: <span className="font-mono text-white/50">"{r.aliasCoincidente}"</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${confianzaColor(r.confianza)}`}>
                        {Math.round(r.confianza * 100)}%
                      </p>
                      <p className="text-[9px] text-white/25">confianza</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tipos: Sedes ─────────────────────────────────────────────────────────────
interface Sede {
  id: number;
  client_id: number;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  contacto: string | null;
  telefono: string | null;
  activo: boolean;
  notas: string | null;
  total_puestos: number;
  puestos_cubiertos: number;
}

// ─── Tab: Sedes Operativas ────────────────────────────────────────────────────
function TabSedes({ clients }: { clients: Client[] }) {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [sedeModalClientId, setSedeModalClientId] = useState<number | null>(null);
  const [nuevaSede, setNuevaSede] = useState({ nombre: "", direccion: "", ciudad: "", contacto: "", telefono: "" });
  const [saving, setSaving] = useState(false);
  const [expandedCliente, setExpandedCliente] = useState<number | null>(null);

  async function loadAllSedes() {
    setLoading(true);
    const all: Sede[] = [];
    await Promise.all(
      clients.filter(c => c.estado === "activo").map(async (c) => {
        try {
          const r = await fetch(`${API}/clientes/${c.id}/sedes`, { headers: { "x-isp-session": getSession() } });
          const data: Sede[] = await r.json();
          if (Array.isArray(data)) all.push(...data);
        } catch { /* ignore */ }
      })
    );
    setSedes(all);
    setLoading(false);
  }

  useEffect(() => { if (clients.length > 0) loadAllSedes(); }, [clients.length]);

  async function crearSede(clientId: number) {
    if (!nuevaSede.nombre.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/clientes/${clientId}/sedes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify(nuevaSede),
      });
      setNuevaSede({ nombre: "", direccion: "", ciudad: "", contacto: "", telefono: "" });
      setSedeModalClientId(null);
      await loadAllSedes();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function eliminarSede(sedeId: number) {
    if (!confirm("¿Desactivar esta sede?")) return;
    await fetch(`${API}/sedes/${sedeId}`, {
      method: "DELETE",
      headers: { "x-isp-session": getSession() },
    });
    await loadAllSedes();
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>;

  const clientesActivos = clients.filter(c => c.estado === "activo");

  return (
    <div className="p-5 space-y-4">
      {clientesActivos.map((cliente) => {
        const misSedes = sedes.filter(s => s.client_id === cliente.id && s.activo);
        const isExpanded = expandedCliente === cliente.id;

        return (
          <div key={cliente.id} className="border border-white/8 rounded-xl overflow-hidden">
            {/* Header cliente */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-white/3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => setExpandedCliente(isExpanded ? null : cliente.id)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/30" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
                <Building2 className="w-3.5 h-3.5 text-primary/60" />
                <p className="text-sm font-semibold text-white">{cliente.nombreComercial || cliente.nombre}</p>
                <span className="text-[10px] text-white/30">{misSedes.length} sede{misSedes.length !== 1 ? "s" : ""}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSedeModalClientId(cliente.id); }}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
              >
                <Plus className="w-3 h-3" /> Nueva sede
              </button>
            </div>

            {/* Sedes */}
            {isExpanded && (
              <div className="p-4 space-y-3">
                {misSedes.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-4 italic">No hay sedes registradas para este cliente</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {misSedes.map((sede) => (
                      <div key={sede.id} className="bg-[#0c1929] border border-white/8 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{sede.nombre}</p>
                            {sede.ciudad && <p className="text-[10px] text-white/30">{sede.ciudad}</p>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                              sede.puestos_cubiertos === sede.total_puestos && sede.total_puestos > 0
                                ? "text-green-400 bg-green-500/10 border border-green-500/20"
                                : sede.total_puestos > 0
                                  ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                                  : "text-white/25 bg-white/5 border border-white/8"
                            }`}>
                              {sede.puestos_cubiertos}/{sede.total_puestos} puestos
                            </div>
                            <button
                              onClick={() => eliminarSede(sede.id)}
                              className="text-red-400/40 hover:text-red-400 transition-colors p-0.5"
                              title="Desactivar sede"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-0.5 text-[10px] text-white/35">
                          {sede.direccion && <div className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{sede.direccion}</div>}
                          {sede.contacto && <div className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{sede.contacto}</div>}
                          {sede.telefono && <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{sede.telefono}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal nueva sede */}
      {sedeModalClientId !== null && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Nueva sede</h3>
              <button onClick={() => setSedeModalClientId(null)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white/40">
              Cliente: <span className="text-white/70">{clients.find(c => c.id === sedeModalClientId)?.nombreComercial || clients.find(c => c.id === sedeModalClientId)?.nombre}</span>
            </p>
            {[
              { key: "nombre", label: "Nombre de la sede *", placeholder: "Ej: Sede Central, Bodega Norte..." },
              { key: "direccion", label: "Dirección", placeholder: "Dirección física" },
              { key: "ciudad", label: "Ciudad / Municipio", placeholder: "Ej: Guatemala, Mixco..." },
              { key: "contacto", label: "Nombre de contacto", placeholder: "Persona de contacto" },
              { key: "telefono", label: "Teléfono de contacto", placeholder: "+502..." },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-white/40">{label}</label>
                <input
                  type="text"
                  value={(nuevaSede as any)[key]}
                  onChange={(e) => setNuevaSede(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setSedeModalClientId(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => crearSede(sedeModalClientId!)}
                disabled={saving || !nuevaSede.nombre.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar sede
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
type Tab = "clientes" | "puestos" | "resolver" | "sedes";

export default function Clientes() {
  const [tab, setTab] = useState<Tab>("clientes");
  const [clients, setClients] = useState<Client[]>([]);
  const [puestos, setPuestos] = useState<ServiceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadClientes = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/alias/clientes`, { headers: { "x-isp-session": getSession() } });
      const data = await r.json();
      setClients(Array.isArray(data) ? data : []);
    } catch { setClients([]); }
    setLoading(false);
  };

  const loadPuestos = async () => {
    try {
      const r = await fetch(`${API}/alias/puestos`, { headers: { "x-isp-session": getSession() } });
      const data = await r.json();
      setPuestos(Array.isArray(data) ? data : []);
    } catch { setPuestos([]); }
  };

  useEffect(() => {
    loadClientes();
    loadPuestos();
  }, []);

  const filteredClients = clients.filter((c) =>
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.nombreComercial?.toLowerCase().includes(search.toLowerCase()) ||
    c.aliases.some((a) => a.alias.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPuestos = puestos.filter((p) =>
    !search || p.nombrePuesto.toLowerCase().includes(search.toLowerCase()) ||
    p.clienteNombre.toLowerCase().includes(search.toLowerCase()) ||
    p.aliases.some((a) => a.alias.toLowerCase().includes(search.toLowerCase()))
  );

  const totalAliasClientes = clients.reduce((s, c) => s + c.aliases.length, 0);
  const totalAliasPuestos = puestos.reduce((s, p) => s + p.aliases.length, 0);

  return (
    <AdminLayout title="Alias de Clientes y Puestos">
      <div className="space-y-5 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-white/40 uppercase tracking-wide">Clientes</span>
            </div>
            <p className="text-2xl font-bold text-white">{clients.length}</p>
            <p className="text-[10px] text-white/30">{clients.filter(c => c.estado === "activo").length} activos</p>
          </div>
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-wide">Alias de Clientes</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalAliasClientes}</p>
            <p className="text-[10px] text-white/30">registrados</p>
          </div>
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-wide">Puestos/Rutas</span>
            </div>
            <p className="text-2xl font-bold text-white">{puestos.length}</p>
            <p className="text-[10px] text-white/30">{puestos.filter(p => p.estado === "activo").length} activos</p>
          </div>
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-wide">Alias de Puestos</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalAliasPuestos}</p>
            <p className="text-[10px] text-white/30">registrados</p>
          </div>
        </div>

        {/* TABS */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1">
              {([
                { id: "clientes", label: "Clientes", icon: Building2 },
                { id: "sedes", label: "Sedes Operativas", icon: Shield },
                { id: "puestos", label: "Puestos y Rutas", icon: MapPin },
                { id: "resolver", label: "Resolver Alias", icon: Search },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${tab === id ? "bg-primary/15 text-primary border border-primary/30" : "text-white/40 hover:text-white/70 hover:bg-white/3"}`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {tab !== "resolver" && (
                <div className="relative">
                  <Search className="w-3 h-3 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-primary/40 w-48"
                  />
                </div>
              )}
              <button
                onClick={() => { loadClientes(); loadPuestos(); }}
                className="p-1.5 rounded-lg bg-white/3 hover:bg-white/6 border border-white/8 text-white/40 hover:text-white/70 transition-all"
                title="Recargar"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Tab: Sedes Operativas */}
          {tab === "sedes" && <TabSedes clients={clients} />}

          {/* Tab: Resolver */}
          {tab === "resolver" && (
            <div className="p-5">
              <TabResolver />
            </div>
          )}

          {/* Tab: Clientes */}
          {tab === "clientes" && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                      <th className="w-6 px-5 py-3" />
                      <th className="text-left px-3 py-3">Cliente</th>
                      <th className="text-left px-3 py-3">Sector</th>
                      <th className="text-left px-3 py-3">Alias Registrados</th>
                      <th className="text-left px-3 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-12 text-center text-white/25 italic text-xs">No hay clientes registrados</td></tr>
                    ) : (
                      filteredClients.map((c) => (
                        <FilaCliente key={c.id} client={c} onRefresh={loadClientes} />
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab: Puestos */}
          {tab === "puestos" && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                      <th className="w-6 px-5 py-3" />
                      <th className="text-left px-3 py-3">Puesto / Ruta</th>
                      <th className="text-left px-3 py-3">Cliente</th>
                      <th className="text-left px-3 py-3">Tipo</th>
                      <th className="text-left px-3 py-3">Alias</th>
                      <th className="text-left px-3 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPuestos.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-white/25 italic text-xs">No hay puestos registrados</td></tr>
                    ) : (
                      filteredPuestos.map((p) => (
                        <FilaPuesto key={p.id} puesto={p} onRefresh={loadPuestos} />
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-wide mb-2">Tipos de Alias</p>
          <div className="flex flex-wrap gap-3 text-[10px] text-white/40">
            <span className={`border px-2.5 py-1 rounded-full ${tipoBadge("comercial")}`}>Comercial — nombre de marca oficial</span>
            <span className={`border px-2.5 py-1 rounded-full ${tipoBadge("operativo")}`}>Operativo — usado en radio y reportes internos</span>
            <span className={`border px-2.5 py-1 rounded-full ${tipoBadge("comun")}`}>Común — nombre que usan los agentes en el campo</span>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
