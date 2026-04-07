import { useState, useEffect, useCallback, Fragment } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, Popup } from "react-leaflet";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Trash2, Edit2, QrCode, MapPin, ChevronLeft, Printer,
  CheckCircle, XCircle, Activity, ToggleLeft, ToggleRight,
} from "lucide-react";

// ── Leaflet icon fix (Vite) ────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const API = "/api";
const f = (path: string, opts?: RequestInit) =>
  fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Ronda {
  id: number;
  nombre: string;
  descripcion?: string;
  cliente_id?: number;
  cliente_nombre?: string;
  activo: boolean;
  total_puntos: string;
  created_at: string;
}

interface Punto {
  id: number;
  ronda_id: number;
  nombre: string;
  descripcion?: string;
  qr_token: string;
  latitud_ref: string;
  longitud_ref: string;
  radio_metros: number;
  orden: number;
  activo: boolean;
}

interface PuntoForm {
  nombre: string;
  descripcion: string;
  radio_metros: number;
  orden: number;
  latitud_ref: number | null;
  longitud_ref: number | null;
}

interface RondaForm {
  nombre: string;
  descripcion: string;
  cliente_id: string;
}

const DEFAULT_PUNTO: PuntoForm = { nombre: "", descripcion: "", radio_metros: 30, orden: 1, latitud_ref: null, longitud_ref: null };
const DEFAULT_RONDA: RondaForm = { nombre: "", descripcion: "", cliente_id: "" };

// ── Componente: click en mapa para colocar marker ─────────────────────────
function MapClickHandler({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPlace(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// ── Componente: vista de impresión de QR ──────────────────────────────────
function PrintView({ punto, rondaNombre, onClose }: { punto: Punto; rondaNombre: string; onClose: () => void }) {
  const origin = window.location.origin;
  const url = `${origin}/ronda?token=${punto.qr_token}`;

  // Inyectar CSS de impresión: oculta todo excepto la tarjeta QR
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "qr-print-style";
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #qr-print-card, #qr-print-card * { visibility: visible !important; }
        #qr-print-card {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100vw !important;
          display: flex !important;
          justify-content: center !important;
          padding-top: 20px !important;
          background: white !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("qr-print-style")?.remove(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div id="qr-print-card" className="bg-white rounded-2xl p-8 max-w-sm w-full text-black">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
            ISP — Ronda de Seguridad
          </p>
          <h2 className="text-xl font-bold text-gray-900">{rondaNombre}</h2>
          <p className="text-sm text-gray-600 mt-1">{punto.nombre}</p>
          {punto.descripcion && <p className="text-xs text-gray-400 mt-1">{punto.descripcion}</p>}
        </div>

        <div className="flex justify-center mb-4">
          <QRCodeSVG value={url} size={220} level="H" includeMargin />
        </div>

        <p className="text-center text-xs text-gray-400 break-all mb-1">Punto #{punto.orden}</p>
        <p className="text-center text-xs text-gray-300 break-all">{url}</p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-2 rounded-lg text-sm font-medium"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente: detalle de ronda con mapa ─────────────────────────────────
function RondaDetalle({
  ronda,
  onBack,
  onUpdate,
}: {
  ronda: Ronda;
  onBack: () => void;
  onUpdate: () => void;
}) {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PuntoForm>(DEFAULT_PUNTO);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [printPunto, setPrintPunto] = useState<Punto | null>(null);
  const [tab, setTab] = useState<"mapa" | "lista" | "reporte">("mapa");
  const [eventos, setEventos] = useState<any[]>([]);

  const loadPuntos = useCallback(async () => {
    const r = await f(`/qr-rondas/${ronda.id}`);
    if (r.ok) { const d = await r.json(); setPuntos(d.puntos || []); }
    setLoading(false);
  }, [ronda.id]);

  const loadEventos = useCallback(async () => {
    const r = await f(`/qr-rondas/${ronda.id}/eventos`);
    if (r.ok) setEventos(await r.json());
  }, [ronda.id]);

  useEffect(() => { loadPuntos(); }, [loadPuntos]);
  useEffect(() => { if (tab === "reporte") loadEventos(); }, [tab, loadEventos]);

  const handleMapPlace = (lat: number, lng: number) => {
    if (!placing) return;
    setForm(f => ({ ...f, latitud_ref: lat, longitud_ref: lng }));
    setPlacing(false);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return setError("Nombre requerido");
    if (form.latitud_ref == null || form.longitud_ref == null) return setError("Debes marcar la ubicación en el mapa");
    setSaving(true); setError("");
    try {
      const body = JSON.stringify(form);
      let r;
      if (editingId) {
        r = await f(`/qr-rondas/${ronda.id}/puntos/${editingId}`, { method: "PUT", body });
      } else {
        r = await f(`/qr-rondas/${ronda.id}/puntos`, { method: "POST", body });
      }
      if (!r.ok) { const e = await r.json(); setError(e.error || "Error"); }
      else { setForm(DEFAULT_PUNTO); setEditingId(null); loadPuntos(); onUpdate(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este punto? También se borrarán sus registros de escaneo.")) return;
    await f(`/qr-rondas/${ronda.id}/puntos/${id}`, { method: "DELETE" });
    loadPuntos(); onUpdate();
  };

  const handleEdit = (p: Punto) => {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre, descripcion: p.descripcion || "",
      radio_metros: p.radio_metros, orden: p.orden,
      latitud_ref: parseFloat(p.latitud_ref), longitud_ref: parseFloat(p.longitud_ref),
    });
    setTab("mapa");
  };

  const centerOfPuntos = (): [number, number] => {
    if (puntos.length === 0) return [14.0723, -87.1921];
    const lat = puntos.reduce((s, p) => s + parseFloat(p.latitud_ref), 0) / puntos.length;
    const lng = puntos.reduce((s, p) => s + parseFloat(p.longitud_ref), 0) / puntos.length;
    return [lat, lng];
  };

  const COLORS = ["#60a5fa","#34d399","#f59e0b","#f87171","#a78bfa","#fb7185","#38bdf8","#4ade80"];

  return (
    <div className="h-full flex flex-col">
      {printPunto && <PrintView punto={printPunto} rondaNombre={ronda.nombre} onClose={() => setPrintPunto(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5 text-white/60" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-white">{ronda.nombre}</h1>
          {ronda.cliente_nombre && <p className="text-sm text-white/40">{ronda.cliente_nombre}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ronda.activo ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {ronda.activo ? "Activa" : "Inactiva"}
          </span>
          <span className="text-white/40 text-sm">{puntos.length} puntos</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1">
        {(["mapa", "lista", "reporte"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
            {t === "mapa" ? "Mapa & Puntos" : t === "lista" ? "Lista QR" : "Registros"}
          </button>
        ))}
      </div>

      {/* ── TAB MAPA ── */}
      {tab === "mapa" && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Panel izquierdo: formulario */}
          <div className="w-80 flex flex-col gap-3 overflow-y-auto pr-1">
            <div className="bg-white/5 border border-white/8 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                {editingId ? "Editar punto" : "Nuevo punto de control"}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej. Portón Norte" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Descripción</label>
                  <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Opcional" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Radio (metros)</label>
                    <input type="number" value={form.radio_metros} min={5} max={500}
                      onChange={e => setForm(f => ({ ...f, radio_metros: parseInt(e.target.value) || 30 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Orden</label>
                    <input type="number" value={form.orden} min={1}
                      onChange={e => setForm(f => ({ ...f, orden: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                  </div>
                </div>

                {/* Coordenadas */}
                <div className="bg-white/3 border border-white/8 rounded-lg p-3">
                  {form.latitud_ref != null ? (
                    <div>
                      <p className="text-xs text-green-400 mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Ubicación marcada</p>
                      <p className="text-xs text-white/40">{form.latitud_ref.toFixed(6)}, {form.longitud_ref?.toFixed(6)}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-yellow-400">Sin ubicación — haz clic en el mapa</p>
                  )}
                  <button onClick={() => setPlacing(true)}
                    className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${placing ? "bg-blue-500 text-white animate-pulse" : "bg-white/5 hover:bg-white/10 text-white/70"}`}>
                    {placing ? "Haz clic en el mapa..." : "Marcar en mapa"}
                  </button>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                    {saving ? "Guardando..." : editingId ? "Actualizar" : "Agregar punto"}
                  </button>
                  {editingId && (
                    <button onClick={() => { setEditingId(null); setForm(DEFAULT_PUNTO); }}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-colors">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de puntos debajo del formulario */}
            {puntos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider px-1">Puntos creados</p>
                {puntos.map((p, i) => (
                  <div key={p.id} className="bg-white/5 border border-white/8 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                      {p.orden}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{p.nombre}</p>
                      <p className="text-xs text-white/40">{p.radio_metros}m radio</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setPrintPunto(p)} title="Ver QR"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-blue-400 transition-colors">
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(p)} title="Editar"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} title="Eliminar"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mapa */}
          <div className="flex-1 rounded-xl overflow-hidden border border-white/8 relative">
            {placing && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[9999] bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-pulse pointer-events-none">
                Haz clic donde está el punto de control
              </div>
            )}
            {loading ? (
              <div className="h-full flex items-center justify-center bg-black/20">
                <p className="text-white/40">Cargando mapa...</p>
              </div>
            ) : (
              <MapContainer
                center={centerOfPuntos()}
                zoom={puntos.length > 0 ? 17 : 13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPlace={handleMapPlace} />

                {/* Marker de posición en edición/creación */}
                {form.latitud_ref != null && form.longitud_ref != null && (
                  <>
                    <Circle
                      center={[form.latitud_ref, form.longitud_ref]}
                      radius={form.radio_metros}
                      pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15 }}
                    />
                    <Marker position={[form.latitud_ref, form.longitud_ref]}>
                      <Popup>{form.nombre || "(nuevo punto)"}</Popup>
                    </Marker>
                  </>
                )}

                {/* Puntos existentes */}
                {puntos.map((p, i) => {
                  const lat = parseFloat(p.latitud_ref);
                  const lng = parseFloat(p.longitud_ref);
                  const color = COLORS[i % COLORS.length];
                  if (editingId === p.id) return null;
                  return (
                    <Fragment key={p.id}>
                      <Circle
                        center={[lat, lng]}
                        radius={p.radio_metros}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.15 }}
                      />
                      <Marker position={[lat, lng]}>
                        <Popup>
                          <strong>{p.nombre}</strong><br />
                          Radio: {p.radio_metros}m<br />
                          Orden: {p.orden}
                        </Popup>
                      </Marker>
                    </Fragment>
                  );
                })}
              </MapContainer>
            )}
          </div>
        </div>
      )}

      {/* ── TAB LISTA QR ── */}
      {tab === "lista" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
          {puntos.length === 0 && (
            <div className="col-span-3 text-center py-16 text-white/30">
              <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay puntos de control. Agrégalos en la pestaña Mapa.</p>
            </div>
          )}
          {puntos.map((p, i) => {
            const url = `${window.location.origin}/ronda?token=${p.qr_token}`;
            return (
              <div key={p.id} className="bg-white/5 border border-white/8 rounded-xl p-4 flex flex-col items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-black"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                  {p.orden}
                </div>
                <p className="text-sm font-semibold text-white text-center">{p.nombre}</p>
                {p.descripcion && <p className="text-xs text-white/40 text-center">{p.descripcion}</p>}
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={url} size={160} level="H" />
                </div>
                <p className="text-xs text-white/30 break-all text-center max-w-full">{url}</p>
                <p className="text-xs text-white/40">Radio: {p.radio_metros}m</p>
                <button onClick={() => setPrintPunto(p)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg text-sm text-white/70 hover:text-white transition-colors">
                  <Printer className="w-4 h-4" /> Imprimir QR
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB REPORTE ── */}
      {tab === "reporte" && (
        <div className="overflow-y-auto">
          {eventos.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sin registros de escaneo aún.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs border-b border-white/8">
                  <th className="pb-2 pr-4">Punto</th>
                  <th className="pb-2 pr-4">Guardia</th>
                  <th className="pb-2 pr-4">Fecha/Hora</th>
                  <th className="pb-2 pr-4">Distancia</th>
                  <th className="pb-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map(e => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="py-2 pr-4 text-white">{e.punto_nombre}</td>
                    <td className="py-2 pr-4 text-white/60">{e.guardia_nombre || "—"}</td>
                    <td className="py-2 pr-4 text-white/60">
                      {new Date(e.escaneado_en).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2 pr-4 text-white/60">
                      {e.distancia_metros != null ? `${e.distancia_metros}m` : "—"}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.resultado === "ok" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                        e.resultado === "fuera_de_rango" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                      }`}>
                        {e.resultado === "ok" ? "✓ OK" : e.resultado === "fuera_de_rango" ? "Fuera de rango" : "Sin GPS"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function RondasQR() {
  const [rondas, setRondas] = useState<Ronda[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ronda | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<RondaForm>(DEFAULT_RONDA);
  const [clients, setClients] = useState<{ id: number; nombre: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadRondas = useCallback(async () => {
    const r = await f("/qr-rondas");
    if (r.ok) setRondas(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRondas();
    f("/clientes-lista").then(r => r.ok && r.json()).then(d => d && setClients(d.map((c: any) => ({ id: c.id, nombre: c.nombre }))));
  }, [loadRondas]);

  const handleCreateRonda = async () => {
    if (!form.nombre.trim()) return setError("Nombre requerido");
    setSaving(true); setError("");
    try {
      const r = await f("/qr-rondas", {
        method: "POST",
        body: JSON.stringify({ ...form, cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null }),
      });
      if (!r.ok) { const e = await r.json(); setError(e.error || "Error"); }
      else { setForm(DEFAULT_RONDA); setShowCreate(false); loadRondas(); }
    } finally { setSaving(false); }
  };

  const handleToggleActivo = async (r: Ronda) => {
    await f(`/qr-rondas/${r.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...r, activo: !r.activo }),
    });
    loadRondas();
  };

  const handleDelete = async (r: Ronda) => {
    if (!confirm(`¿Eliminar la ronda "${r.nombre}"? Se borrarán todos sus puntos y registros.`)) return;
    await f(`/qr-rondas/${r.id}`, { method: "DELETE" });
    loadRondas();
  };

  if (selected) {
    return (
      <div className="h-full flex flex-col p-6">
        <RondaDetalle ronda={selected} onBack={() => setSelected(null)} onUpdate={loadRondas} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Rondas QR</h1>
          <p className="text-sm text-white/40 mt-1">Gestión de rutas de patrullaje con verificación por código QR y GPS</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva Ronda
        </button>
      </div>

      {/* Modal crear ronda */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Nueva Ronda</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. Ronda Perimetral Norte" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Opcional" rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Cliente (opcional)</label>
                <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                  <option value="">— Sin asignar —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreateRonda} disabled={saving}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {saving ? "Creando..." : "Crear Ronda"}
                </button>
                <button onClick={() => { setShowCreate(false); setForm(DEFAULT_RONDA); setError(""); }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de rondas */}
      {loading ? (
        <div className="text-center py-20 text-white/30">Cargando...</div>
      ) : rondas.length === 0 ? (
        <div className="text-center py-20">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-white/10" />
          <p className="text-white/30 text-lg">No hay rondas creadas aún</p>
          <p className="text-white/20 text-sm mt-1">Crea una ronda y agrega los puntos de control con sus ubicaciones</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rondas.map(r => (
            <div key={r.id} className="bg-white/5 border border-white/8 rounded-xl p-5 hover:border-white/15 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">{r.nombre}</h3>
                  {r.cliente_nombre && <p className="text-xs text-white/40 mt-0.5">{r.cliente_nombre}</p>}
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${r.activo ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20"}`}>
                  {r.activo ? "Activa" : "Inactiva"}
                </span>
              </div>

              {r.descripcion && <p className="text-xs text-white/40 mb-3 line-clamp-2">{r.descripcion}</p>}

              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs text-white/40">{r.total_puntos} punto{Number(r.total_puntos) !== 1 ? "s" : ""} de control</span>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setSelected(r)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg text-sm text-white/70 hover:text-white transition-colors font-medium">
                  Administrar
                </button>
                <button onClick={() => handleToggleActivo(r)} title={r.activo ? "Desactivar" : "Activar"}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg text-white/50 hover:text-white transition-colors">
                  {r.activo ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(r)} title="Eliminar"
                  className="p-2 bg-white/5 hover:bg-red-500/10 border border-white/8 hover:border-red-500/20 rounded-lg text-white/50 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
