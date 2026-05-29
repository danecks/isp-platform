import { useState, useEffect, useCallback, Fragment, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, Popup } from "react-leaflet";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Trash2, Edit2, QrCode, MapPin, ChevronLeft, Printer,
  CheckCircle, XCircle, Activity, ToggleLeft, ToggleRight, CheckSquare, Square,
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
function CoordenadasEditor({
  latitud, longitud, placing, onMarcarMapa, onAplicarCoordenadas,
}: {
  latitud: number | null;
  longitud: number | null;
  placing: boolean;
  onMarcarMapa: () => void;
  onAplicarCoordenadas: (lat: number, lng: number) => void;
}) {
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [errorCoords, setErrorCoords] = useState<string | null>(null);

  // Sincronizar inputs cuando cambia la ubicación marcada por el mapa
  useEffect(() => {
    setLatStr(latitud != null ? latitud.toFixed(6) : "");
    setLngStr(longitud != null ? longitud.toFixed(6) : "");
    setErrorCoords(null);
  }, [latitud, longitud]);

  const aplicar = () => {
    // Aceptar tanto "14.123, -90.456" pegado en un solo campo como dos campos separados
    let latRaw = latStr.trim();
    let lngRaw = lngStr.trim();
    if (latRaw.includes(",") && !lngRaw) {
      const partes = latRaw.split(",").map(s => s.trim());
      if (partes.length === 2) { latRaw = partes[0]; lngRaw = partes[1]; }
    }
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setErrorCoords("Ingresá números válidos (ej. 14.306205, -90.791965)");
      return;
    }
    if (lat < -90 || lat > 90) {
      setErrorCoords("La latitud debe estar entre -90 y 90");
      return;
    }
    if (lng < -180 || lng > 180) {
      setErrorCoords("La longitud debe estar entre -180 y 180");
      return;
    }
    setErrorCoords(null);
    onAplicarCoordenadas(lat, lng);
  };

  return (
    <div className="bg-white/3 border border-white/8 rounded-lg p-3 space-y-3">
      {latitud != null ? (
        <div>
          <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Ubicación marcada
          </p>
          <p className="text-xs text-white/40">
            {latitud.toFixed(6)}, {longitud?.toFixed(6)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-yellow-400">Sin ubicación — marcá en el mapa o ingresá las coordenadas</p>
      )}

      <button
        onClick={onMarcarMapa}
        className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
          placing ? "bg-blue-500 text-white animate-pulse" : "bg-white/5 hover:bg-white/10 text-white/70"
        }`}
      >
        {placing ? "Haz clic en el mapa..." : "Marcar en mapa"}
      </button>

      <div className="border-t border-white/8 pt-3">
        <p className="text-xs text-white/50 mb-2">o ingresá las coordenadas manualmente</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-white/40 mb-1 block uppercase tracking-wide">Latitud</label>
            <input
              type="text"
              inputMode="decimal"
              value={latStr}
              onChange={e => setLatStr(e.target.value)}
              placeholder="14.306205"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 mb-1 block uppercase tracking-wide">Longitud</label>
            <input
              type="text"
              inputMode="decimal"
              value={lngStr}
              onChange={e => setLngStr(e.target.value)}
              placeholder="-90.791965"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 font-mono"
            />
          </div>
        </div>
        {errorCoords && <p className="text-[11px] text-red-400 mt-2">{errorCoords}</p>}
        <button
          onClick={aplicar}
          className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
        >
          Aplicar coordenadas
        </button>
        <p className="text-[10px] text-white/30 mt-2">
          Tip: podés copiar/pegar de Google Maps (clic derecho sobre el punto → copia las coordenadas).
        </p>
      </div>
    </div>
  );
}

function MapClickHandler({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPlace(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// ── Componente: vista de impresión de QR ──────────────────────────────────
function PrintView({ punto, rondaNombre, onClose }: { punto: Punto; rondaNombre: string; onClose: () => void }) {
  const origin = window.location.origin;
  const url = `${origin}/ronda?token=${punto.qr_token}`;
  const svgRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    // Serializar el SVG del QR para incluirlo en la ventana de impresión
    const svgEl = svgRef.current?.querySelector("svg");
    const svgHtml = svgEl ? new XMLSerializer().serializeToString(svgEl) : "";

    const win = window.open("", "_blank", "width=480,height=620");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>QR · ${rondaNombre} – ${punto.nombre}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #fff;
      display: flex;
      justify-content: center;
      padding: 32px 24px;
    }
    .card {
      width: 4cm;
      height: 5cm;
      text-align: center;
      border: 1.5px dashed #6b7280;
      border-radius: 4px;
      padding: 0.15cm 0.15cm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
      box-sizing: border-box;
    }
    .label {
      font-size: 5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      line-height: 1.1;
    }
    .ronda-name {
      font-size: 7pt;
      font-weight: 800;
      color: #111827;
      line-height: 1.1;
      margin-top: 1px;
    }
    .punto-name {
      font-size: 6pt;
      font-weight: 600;
      color: #374151;
      line-height: 1.1;
    }
    .qr-wrap {
      flex: 1;
      width: 100%;
      margin-top: 0.08cm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-wrap svg {
      width: 3.4cm;
      height: 3.4cm;
      display: block;
    }
    @page { size: letter; margin: 0.4in; }
    body { display: flex; justify-content: center; align-items: flex-start; padding: 0.5cm; }
  </style>
</head>
<body>
  <div class="card">
    <p class="label">ISP · Ronda</p>
    <p class="ronda-name">${rondaNombre}</p>
    <p class="punto-name">${punto.nombre}</p>
    <div class="qr-wrap">${svgHtml}</div>
  </div>
  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-black">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
            ISP — Ronda de Seguridad
          </p>
          <h2 className="text-xl font-bold text-gray-900">{rondaNombre}</h2>
          <p className="text-sm text-gray-600 mt-1">{punto.nombre}</p>
          {punto.descripcion && <p className="text-xs text-gray-400 mt-1">{punto.descripcion}</p>}
        </div>

        <div ref={svgRef} className="flex justify-center mb-4">
          <div className="p-3 bg-white border-2 border-gray-900 rounded-lg shadow-sm">
            <QRCodeSVG value={url} size={220} level="H" includeMargin />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mb-1">Punto #{punto.orden}</p>
        <p className="text-center text-xs text-gray-300 break-all">{url}</p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handlePrint}
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
  clients,
  onBack,
  onUpdate,
}: {
  ronda: Ronda;
  clients: { id: number; nombre: string }[];
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
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [showEditRonda, setShowEditRonda] = useState(false);
  const [rondaForm, setRondaForm] = useState<RondaForm>(DEFAULT_RONDA);
  const [savingRonda, setSavingRonda] = useState(false);
  const [errorRonda, setErrorRonda] = useState("");

  const abrirEditarRonda = () => {
    setRondaForm({
      nombre: ronda.nombre,
      descripcion: ronda.descripcion || "",
      cliente_id: ronda.cliente_id ? String(ronda.cliente_id) : "",
    });
    setErrorRonda("");
    setShowEditRonda(true);
  };

  const handleSaveRonda = async () => {
    if (!rondaForm.nombre.trim()) return setErrorRonda("Nombre requerido");
    setSavingRonda(true); setErrorRonda("");
    try {
      const r = await f(`/qr-rondas/${ronda.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre: rondaForm.nombre,
          descripcion: rondaForm.descripcion,
          cliente_id: rondaForm.cliente_id ? parseInt(rondaForm.cliente_id) : null,
          activo: ronda.activo,
        }),
      });
      if (r.ok) { setShowEditRonda(false); onUpdate(); onBack(); }
      else { const e = await r.json().catch(() => ({})); setErrorRonda(e.error || "No se pudo guardar"); }
    } catch { setErrorRonda("Error de conexión"); }
    finally { setSavingRonda(false); }
  };

  const toggleSel = (id: number) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelAll = () => {
    if (seleccionados.size === puntos.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(puntos.map(p => p.id)));
  };

  // Imprimir múltiples QR seleccionados en hojas tamaño Carta con líneas de corte
  // Layout: 2 columnas × 3 filas = 6 por hoja, paginación automática.
  const imprimirSeleccionados = () => {
    const elegidos = puntos.filter(p => seleccionados.has(p.id));
    if (elegidos.length === 0) return;

    // Copiamos el SVG de cada QR ya renderizado en la grilla (atributo data-qr-id)
    const svgPorPunto = new Map<number, string>();
    document.querySelectorAll<HTMLElement>('[data-qr-id]').forEach(el => {
      const id = Number(el.dataset.qrId);
      const svg = el.querySelector('svg');
      if (svg) {
        const clone = svg.cloneNode(true) as SVGElement;
        clone.setAttribute('width', '100%');
        clone.setAttribute('height', '100%');
        svgPorPunto.set(id, new XMLSerializer().serializeToString(clone));
      }
    });

    const win = window.open("", "_blank");
    if (!win) return;

    const cardsHtml = elegidos.map(p => {
      const svg = svgPorPunto.get(p.id) || "";
      return `
        <div class="card">
          <p class="label">ISP · Ronda</p>
          <p class="ronda-name">${ronda.nombre}</p>
          <p class="punto-name">${p.nombre}</p>
          <div class="qr-wrap">${svg}</div>
        </div>`;
    }).join("");

    // 4cm × 5cm por tarjeta. En hoja Carta (8.5" × 11" = 21.59 × 27.94 cm) con
    // márgenes de 1 cm caben 4 columnas × 5 filas = 20 QR por hoja.
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>QRs · ${ronda.nombre} (${elegidos.length})</title>
  <style>
    @page { size: letter; margin: 1cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #fff; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 4cm);
      grid-auto-rows: 5cm;
      gap: 0.2cm 0.2cm;
      justify-content: center;
    }
    .card {
      width: 4cm;
      height: 5cm;
      text-align: center;
      border: 1.5px dashed #6b7280;
      border-radius: 4px;
      padding: 0.15cm 0.15cm;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
      box-sizing: border-box;
    }
    .label {
      font-size: 5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      line-height: 1.1;
    }
    .ronda-name {
      font-size: 7pt;
      font-weight: 800;
      color: #111827;
      line-height: 1.1;
      margin-top: 1px;
    }
    .punto-name {
      font-size: 6pt;
      color: #374151;
      font-weight: 600;
      line-height: 1.1;
    }
    .qr-wrap {
      width: 3cm;
      height: 3cm;
      margin: 0.1cm 0 0.05cm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-wrap svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .orden {
      font-size: 5pt;
      color: #6b7280;
      font-weight: 600;
      line-height: 1.1;
    }
  </style>
</head>
<body>
  <div class="grid">${cardsHtml}</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
</body>
</html>`);
    win.document.close();
  };

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

      {/* Modal editar ronda / reasignar cliente */}
      {showEditRonda && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Editar ronda</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Nombre *</label>
                <input value={rondaForm.nombre} onChange={e => setRondaForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Descripción</label>
                <textarea value={rondaForm.descripcion} onChange={e => setRondaForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Cliente</label>
                <select value={rondaForm.cliente_id} onChange={e => setRondaForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                  <option value="">— Sin asignar —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <p className="text-[11px] text-white/30 mt-1">Al cambiar el cliente, los puntos y escaneos de esta ronda se mueven con ella.</p>
              </div>
              {errorRonda && <p className="text-xs text-red-400">{errorRonda}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveRonda} disabled={savingRonda || !rondaForm.nombre.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {savingRonda ? "Guardando..." : "Guardar"}
                </button>
                <button onClick={() => setShowEditRonda(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <button onClick={abrirEditarRonda} title="Editar ronda / reasignar cliente"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg text-xs text-white/70 hover:text-white transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Editar / Reasignar
          </button>
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
                <CoordenadasEditor
                  latitud={form.latitud_ref}
                  longitud={form.longitud_ref}
                  placing={placing}
                  onMarcarMapa={() => setPlacing(true)}
                  onAplicarCoordenadas={(lat, lng) =>
                    setForm(f => ({ ...f, latitud_ref: lat, longitud_ref: lng }))
                  }
                />

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
        <div className="flex flex-col gap-4 overflow-y-auto">
          {puntos.length > 0 && (
            <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
              <button onClick={toggleSelAll}
                className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                {seleccionados.size === puntos.length && puntos.length > 0
                  ? <CheckSquare className="w-4 h-4 text-blue-400" />
                  : <Square className="w-4 h-4" />}
                {seleccionados.size === puntos.length && puntos.length > 0 ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
              <span className="text-xs text-white/40 ml-2">
                {seleccionados.size} de {puntos.length} seleccionados
              </span>
              <button onClick={imprimirSeleccionados} disabled={seleccionados.size === 0}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                <Printer className="w-4 h-4" />
                Imprimir seleccionados {seleccionados.size > 0 ? `(${seleccionados.size})` : ""}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {puntos.length === 0 && (
              <div className="col-span-3 text-center py-16 text-white/30">
                <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay puntos de control. Agrégalos en la pestaña Mapa.</p>
              </div>
            )}
            {puntos.map((p, i) => {
              const url = `${window.location.origin}/ronda?token=${p.qr_token}`;
              const sel = seleccionados.has(p.id);
              return (
                <div key={p.id}
                  className={`relative border rounded-xl p-4 flex flex-col items-center gap-3 transition-colors ${sel ? "bg-blue-500/10 border-blue-500/40" : "bg-white/5 border-white/8"}`}>
                  <button onClick={() => toggleSel(p.id)}
                    title={sel ? "Quitar selección" : "Seleccionar para imprimir"}
                    className="absolute top-2 right-2 p-1 rounded-md hover:bg-white/10 transition-colors">
                    {sel
                      ? <CheckSquare className="w-5 h-5 text-blue-400" />
                      : <Square className="w-5 h-5 text-white/40" />}
                  </button>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-black"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {p.orden}
                  </div>
                  <p className="text-sm font-semibold text-white text-center">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-white/40 text-center">{p.descripcion}</p>}
                  <div data-qr-id={p.id} className="bg-white p-3 rounded-xl border-2 border-dashed border-gray-400">
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

// ── Tarjeta de ronda reutilizable ─────────────────────────────────────────────
function RondaCard({ r, onSelect, onToggle, onDelete }: {
  r: Ronda;
  onSelect: (r: Ronda) => void;
  onToggle: (r: Ronda) => void;
  onDelete: (r: Ronda) => void;
}) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-5 hover:border-white/15 transition-colors group">
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
        <button onClick={() => onSelect(r)}
          className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg text-sm text-white/70 hover:text-white transition-colors font-medium">
          Administrar
        </button>
        <button onClick={() => onToggle(r)} title={r.activo ? "Desactivar" : "Activar"}
          className="p-2 bg-white/5 hover:bg-white/10 border border-white/8 rounded-lg text-white/50 hover:text-white transition-colors">
          {r.activo ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        <button onClick={() => onDelete(r)} title="Eliminar"
          className="p-2 bg-white/5 hover:bg-red-500/10 border border-white/8 hover:border-red-500/20 rounded-lg text-white/50 hover:text-red-400 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
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
  const [vistaClientes, setVistaClientes] = useState(true);
  const [clienteFiltro, setClienteFiltro] = useState<number | null>(null);

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
        <RondaDetalle ronda={selected} clients={clients} onBack={() => setSelected(null)} onUpdate={loadRondas} />
      </div>
    );
  }

  // Calcular rondas por cliente
  const rondasPorCliente = rondas.reduce((acc, r) => {
    const key = r.cliente_id ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<number, Ronda[]>);

  // Clientes con y sin rondas
  const clientesConRondas = clients.map(c => ({
    ...c,
    rondas: rondasPorCliente[c.id] ?? [],
    totalRondas: (rondasPorCliente[c.id] ?? []).length,
  }));

  // Rondas del filtro activo (en vista clientes)
  const rondasFiltradas = clienteFiltro !== null
    ? rondas.filter(r => (r.cliente_id ?? 0) === clienteFiltro)
    : rondas;

  // Cliente actualmente seleccionado en filtro
  const clienteActivo = clienteFiltro !== null ? clients.find(c => c.id === clienteFiltro) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Rondas QR</h1>
          <p className="text-sm text-white/40 mt-1">Patrullaje con verificación QR y GPS</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden text-xs">
            <button onClick={() => { setVistaClientes(true); setClienteFiltro(null); }}
              className={`px-3 py-2 transition-colors ${vistaClientes ? "bg-blue-600 text-white" : "text-white/40 hover:text-white/70"}`}>
              Por Cliente
            </button>
            <button onClick={() => setVistaClientes(false)}
              className={`px-3 py-2 transition-colors ${!vistaClientes ? "bg-blue-600 text-white" : "text-white/40 hover:text-white/70"}`}>
              Todas
            </button>
          </div>
          <button
            onClick={() => {
              setForm(clienteFiltro ? { ...DEFAULT_RONDA, cliente_id: String(clienteFiltro) } : DEFAULT_RONDA);
              setShowCreate(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Nueva Ronda
          </button>
        </div>
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

      {/* ── VISTA POR CLIENTE ──────────────────────────────────────────────── */}
      {vistaClientes && clienteFiltro === null && (
        <div>
          {loading ? (
            <div className="text-center py-20 text-white/30">Cargando...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-20">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-white/10" />
              <p className="text-white/30 text-lg">No hay clientes registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientesConRondas.map(c => (
                <div key={c.id}
                  className="bg-white/5 border border-white/8 hover:border-blue-500/30 rounded-xl p-5 cursor-pointer transition-colors group"
                  onClick={() => setClienteFiltro(c.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base font-semibold text-white group-hover:text-blue-300 transition-colors truncate flex-1">{c.nombre}</h3>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 border ${
                      c.totalRondas > 0
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-white/5 text-white/30 border-white/10"
                    }`}>
                      {c.totalRondas} ronda{c.totalRondas !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {c.totalRondas === 0 ? (
                    <p className="text-xs text-white/25 italic">Sin rondas asignadas — clic para agregar</p>
                  ) : (
                    <div className="space-y-1">
                      {c.rondas.slice(0, 3).map(r => (
                        <div key={r.id} className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.activo ? "bg-green-400" : "bg-gray-500"}`} />
                          <span className="text-xs text-white/50 truncate">{r.nombre}</span>
                          <span className="text-xs text-white/25 ml-auto flex-shrink-0">{r.total_puntos}pts</span>
                        </div>
                      ))}
                      {c.totalRondas > 3 && <p className="text-xs text-white/25 pl-3">+{c.totalRondas - 3} más</p>}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-blue-400/60 group-hover:text-blue-400 transition-colors">Ver rondas →</span>
                    <button
                      onClick={e => { e.stopPropagation(); setForm({ ...DEFAULT_RONDA, cliente_id: String(c.id) }); setShowCreate(true); }}
                      className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Agregar ronda
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA POR CLIENTE — rondas de cliente seleccionado ────────────── */}
      {vistaClientes && clienteFiltro !== null && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setClienteFiltro(null)}
              className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" /> Todos los clientes
            </button>
            <span className="text-white/20">/</span>
            <span className="text-white font-medium text-sm">{clienteActivo?.nombre}</span>
          </div>

          {rondasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-white/3 border border-white/8 rounded-xl">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-white/10" />
              <p className="text-white/30">Este cliente no tiene rondas aún</p>
              <button
                onClick={() => { setForm({ ...DEFAULT_RONDA, cliente_id: String(clienteFiltro) }); setShowCreate(true); }}
                className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Crear primera ronda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rondasFiltradas.map(r => <RondaCard key={r.id} r={r} onSelect={setSelected} onToggle={handleToggleActivo} onDelete={handleDelete} />)}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA TODAS LAS RONDAS ────────────────────────────────────────── */}
      {!vistaClientes && (
        loading ? (
          <div className="text-center py-20 text-white/30">Cargando...</div>
        ) : rondas.length === 0 ? (
          <div className="text-center py-20">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-white/10" />
            <p className="text-white/30 text-lg">No hay rondas creadas aún</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rondas.map(r => <RondaCard key={r.id} r={r} onSelect={setSelected} onToggle={handleToggleActivo} onDelete={handleDelete} />)}
          </div>
        )
      )}
    </div>
  );
}
