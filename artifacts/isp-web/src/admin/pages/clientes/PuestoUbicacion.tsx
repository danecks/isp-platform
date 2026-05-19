import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Save, Crosshair } from "lucide-react";
import { API, h } from "./_shared";

const GT_CENTER: [number, number] = [14.6349, -90.5069];

const iconPuesto = L.divIcon({
  className: "",
  html: `<div style="background:#0ea5e9;width:18px;height:18px;border-radius:3px;border:2px solid white;box-shadow:0 0 0 1px #0c4a6e;transform:rotate(45deg);"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    const key = `${center[0].toFixed(5)},${center[1].toFixed(5)}`;
    if (key !== last.current) {
      last.current = key;
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

interface PuestoGps {
  puesto_id: number;
  latitud: number;
  longitud: number;
  radio_metros: number;
  updated_at?: string;
}

export function PuestoUbicacionInline({ puestoId }: { puestoId: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pos, setPos] = useState<[number, number]>(GT_CENTER);
  const [radio, setRadio] = useState<number>(50);
  const [hasInitial, setHasInitial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMsg(null);
    fetch(`${API}/puestos-gps/${puestoId}`, { headers: h() })
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          const d: PuestoGps | null = await r.json();
          if (d && Number.isFinite(d.latitud) && Number.isFinite(d.longitud)) {
            setPos([Number(d.latitud), Number(d.longitud)]);
            setRadio(Number(d.radio_metros) || 50);
            setHasInitial(true);
          }
          return;
        }
        if (r.status === 401) setMsg({ type: "err", text: "Sesión expirada — volvé a iniciar sesión." });
        else if (r.status === 403) setMsg({ type: "err", text: "Tu rol no tiene permiso para ver la ubicación del puesto." });
        else setMsg({ type: "err", text: `No se pudo cargar la ubicación (error ${r.status}).` });
      })
      .catch(() => {
        if (!cancelled) setMsg({ type: "err", text: "No se pudo cargar la ubicación (sin red)." });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [puestoId]);

  const updatedLabel = useMemo(() => {
    if (!hasInitial) return "Sin ubicación guardada";
    return `Lat ${pos[0].toFixed(6)} · Lng ${pos[1].toFixed(6)}`;
  }, [hasInitial, pos]);

  async function locateMe() {
    if (!navigator.geolocation) {
      setMsg({ type: "err", text: "El navegador no soporta geolocalización" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => setMsg({ type: "err", text: "No se pudo obtener tu ubicación" }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`${API}/puestos-gps/${puestoId}`, {
        method: "PUT",
        headers: h(),
        body: JSON.stringify({ latitud: pos[0], longitud: pos[1], radio_metros: radio }),
      });
      if (!r.ok) throw new Error(await r.text());
      setHasInitial(true);
      setMsg({ type: "ok", text: "Ubicación guardada" });
    } catch {
      setMsg({ type: "err", text: "Error al guardar la ubicación" });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-primary/50" />
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold flex-1">
          Ubicación / Perímetro
        </p>
        <button
          type="button"
          onClick={locateMe}
          className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white border border-white/10 hover:border-white/20 px-2 py-1 rounded"
          title="Usar mi ubicación"
        >
          <Crosshair className="w-3 h-3" />
          Mi ubicación
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 240 }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-[#060e1c]">
            <Loader2 className="w-4 h-4 animate-spin text-white/30" />
          </div>
        ) : (
          <MapContainer center={pos} zoom={hasInitial ? 17 : 13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Recenter center={pos} />
            <ClickHandler onClick={(lat, lng) => setPos([lat, lng])} />
            <Marker
              position={pos}
              icon={iconPuesto}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const ll = m.getLatLng();
                  setPos([ll.lat, ll.lng]);
                },
              }}
            />
            <Circle
              center={pos}
              radius={radio}
              pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.12, weight: 2 }}
            />
          </MapContainer>
        )}
      </div>

      <div className="bg-[#060e1c] border border-white/8 rounded-xl px-3 py-3 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/40">Radio del geofence</span>
          <span className="text-primary font-semibold">{radio} m</span>
        </div>
        <input
          type="range"
          min={50}
          max={500}
          step={10}
          value={radio}
          onChange={(e) => setRadio(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[9px] text-white/25">
          <span>50 m</span>
          <span>500 m</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-white/30 font-mono truncate flex-1">{updatedLabel}</p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 px-3 py-1.5 rounded-lg"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Guardar ubicación
        </button>
      </div>

      {msg && (
        <p className={`text-[10px] ${msg.type === "ok" ? "text-green-400" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}

      <p className="text-[9px] text-white/25 leading-relaxed">
        Hacé clic en el mapa o arrastrá el marcador para fijar la posición exacta del puesto. El círculo muestra el perímetro que el agente debe respetar al fichar y durante la jornada.
      </p>
    </div>
  );
}
