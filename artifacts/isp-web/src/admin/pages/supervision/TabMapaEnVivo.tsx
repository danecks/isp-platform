import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, RefreshCw, Clock, Activity, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { api } from "./api";

interface SupTracking {
  supervisor_id: number;
  supervisor_nombre: string;
  fichaje_id: number;
  turno_inicio: string;
  latitud: number | null;
  longitud: number | null;
  precision_metros: number | null;
  velocidad_mps: number | null;
  capturado_en: string | null;
  programacion_id: number | null;
  puesto_id: number | null;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  zona_nombre: string | null;
  puesto_lat: number | null;
  puesto_lng: number | null;
  puesto_radio_m: number | null;
  hace_segundos: number | null;
}

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const POLL_MS = 15000;
const GT_CENTER: [number, number] = [14.6349, -90.5069];

function iconSupervisor(stale: boolean, fueraDePerimetro: boolean) {
  const color = fueraDePerimetro ? "#ef4444" : stale ? "#f59e0b" : "#22d3ee";
  const ring  = fueraDePerimetro ? "#7f1d1d" : stale ? "#78350f" : "#0e7490";
  const pulse = fueraDePerimetro
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.6;animation:pulse-fuera 1.4s ease-out infinite;"></div>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;">${pulse}<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px ${ring};"></div></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  });
}

function fmtHaceSeg(s: number | null): string {
  if (s == null) return "—";
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)} h`;
}

function FitBounds({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    if (puntos.length === 1) { map.setView(puntos[0], 14); return; }
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
  }, [puntos, map]);
  return null;
}

export function TabMapaEnVivo() {
  const [data, setData] = useState<SupTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState<string>("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function cargar() {
    try {
      setErr(null);
      const r = await api<{ supervisores: SupTracking[]; server_now: string }>(
        "/supervision-tracking/en-vivo"
      );
      setData(r.supervisores || []);
      setServerNow(r.server_now);
    } catch (e: any) {
      setErr(e.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    timer.current = setInterval(cargar, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const conGps = useMemo(
    () => data.filter(d => d.latitud != null && d.longitud != null),
    [data]
  );
  const sinGps = useMemo(
    () => data.filter(d => d.latitud == null || d.longitud == null),
    [data]
  );

  function distanciaAlPuesto(s: SupTracking): number | null {
    if (s.latitud == null || s.longitud == null) return null;
    if (s.puesto_lat == null || s.puesto_lng == null) return null;
    return distanciaMetros(
      Number(s.latitud), Number(s.longitud),
      Number(s.puesto_lat), Number(s.puesto_lng)
    );
  }
  function estaFueraPerimetro(s: SupTracking): boolean {
    const d = distanciaAlPuesto(s);
    if (d == null || s.puesto_radio_m == null) return false;
    return d > Number(s.puesto_radio_m);
  }

  const fueraCount = useMemo(
    () => conGps.filter(estaFueraPerimetro).length,
    [conGps]
  );

  const perimetros = useMemo(() => {
    const seen = new Set<number>();
    const out: { puesto_id: number; lat: number; lng: number; radio: number; nombre: string; cliente: string | null }[] = [];
    for (const s of data) {
      if (s.puesto_id == null || s.puesto_lat == null || s.puesto_lng == null || s.puesto_radio_m == null) continue;
      if (seen.has(s.puesto_id)) continue;
      seen.add(s.puesto_id);
      out.push({
        puesto_id: s.puesto_id,
        lat: Number(s.puesto_lat),
        lng: Number(s.puesto_lng),
        radio: Number(s.puesto_radio_m),
        nombre: s.puesto_nombre || "Puesto",
        cliente: s.cliente_nombre,
      });
    }
    return out;
  }, [data]);

  const puntos = useMemo<[number, number][]>(() => {
    const arr: [number, number][] = conGps.map(d => [Number(d.latitud), Number(d.longitud)] as [number, number]);
    for (const p of perimetros) arr.push([p.lat, p.lng]);
    return arr;
  }, [conGps, perimetros]);

  return (
    <div className="space-y-3">
      <style>{`@keyframes pulse-fuera { 0% { transform: scale(0.8); opacity: 0.7; } 100% { transform: scale(1.8); opacity: 0; } }`}</style>
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#0b1424] border border-white/10 rounded">
        <div className="text-xs text-white/70 inline-flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-300" />
          <strong className="text-white">{data.length}</strong> supervisor(es) con turno activo —
          <span className="text-cyan-300 ml-1"><strong>{conGps.length}</strong> con GPS reciente</span>
          {sinGps.length > 0 && <span className="text-amber-300 ml-1">· {sinGps.length} sin señal</span>}
          {fueraCount > 0 && (
            <span className="text-rose-300 ml-1 inline-flex items-center gap-0.5">
              · <AlertTriangle className="w-3 h-3" /> {fueraCount} fuera del perímetro
            </span>
          )}
        </div>
        <button onClick={cargar}
          className="ml-auto px-2 py-1 text-[11px] bg-white/5 hover:bg-white/10 text-white/80 rounded inline-flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Actualizar
        </button>
        <span className="text-[10px] text-white/40">
          Auto-refresh cada {POLL_MS / 1000}s {serverNow && `· servidor: ${new Date(serverNow).toLocaleTimeString("es-GT")}`}
        </span>
      </div>

      {err && <div role="alert" className="text-rose-300 text-sm p-3 border border-rose-500/30 rounded bg-rose-500/10">{err}</div>}
      {loading && data.length === 0 && (
        <div className="text-white/50 text-sm p-4 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        <div className="border border-white/10 rounded-lg overflow-hidden" style={{ height: 560 }}>
          <MapContainer center={GT_CENTER} zoom={11} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds puntos={puntos} />
            {perimetros.map(p => (
              <Circle
                key={`per-${p.puesto_id}`}
                center={[p.lat, p.lng]}
                radius={p.radio}
                pathOptions={{
                  color: "#22d3ee",
                  weight: 1.5,
                  fillColor: "#22d3ee",
                  fillOpacity: 0.08,
                  dashArray: "4 4",
                }}
              >
                <Popup>
                  <div style={{ fontSize: 12, minWidth: 160 }}>
                    <strong>{p.nombre}</strong>
                    {p.cliente && <><br /><span style={{ color: "#666" }}>{p.cliente}</span></>}
                    <br />Radio del puesto: {Math.round(p.radio)}m
                  </div>
                </Popup>
              </Circle>
            ))}
            {conGps.map(s => {
              const stale = (s.hace_segundos ?? 0) > 300;
              const dist = distanciaAlPuesto(s);
              const fuera = estaFueraPerimetro(s);
              return (
                <Marker key={s.supervisor_id}
                  position={[Number(s.latitud), Number(s.longitud)]}
                  icon={iconSupervisor(stale, fuera)}>
                  <Popup>
                    <div style={{ fontSize: 12, minWidth: 180 }}>
                      <strong>{s.supervisor_nombre}</strong><br />
                      <span style={{ color: "#666" }}>{fmtHaceSeg(s.hace_segundos)}</span><br />
                      {s.precision_metros != null && <>Precisión: ±{Math.round(s.precision_metros)}m<br /></>}
                      {(s.cliente_nombre || s.puesto_nombre || s.zona_nombre) && (
                        <span style={{ color: "#0369a1" }}>
                          En visita: {[s.cliente_nombre, s.puesto_nombre, s.zona_nombre].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {dist != null && s.puesto_radio_m != null && (
                        <div style={{ marginTop: 4, color: fuera ? "#b91c1c" : "#15803d", fontWeight: 600 }}>
                          {fuera
                            ? `⚠ Fuera del perímetro: a ${Math.round(dist)}m (radio ${Math.round(Number(s.puesto_radio_m))}m)`
                            : `Dentro del perímetro (${Math.round(dist)}m / ${Math.round(Number(s.puesto_radio_m))}m)`}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="border border-white/10 rounded-lg bg-[#0b1424] overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-white/5 text-xs font-bold text-white/80 border-b border-white/10">
            Supervisores activos
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
            {data.length === 0 && !loading && (
              <p className="text-white/40 text-xs p-4 text-center">
                Ningún supervisor con turno activo.
              </p>
            )}
            <ul className="divide-y divide-white/5">
              {data.map(s => {
                const conPos = s.latitud != null && s.longitud != null;
                const stale = (s.hace_segundos ?? 99999) > 300;
                const fuera = estaFueraPerimetro(s);
                const dist = distanciaAlPuesto(s);
                return (
                  <li key={s.supervisor_id} className={`p-2.5 hover:bg-white/5 ${fuera ? "bg-rose-500/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white font-medium truncate">{s.supervisor_nombre}</p>
                        <p className="text-[10px] text-white/50 inline-flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Turno: {new Date(s.turno_inicio).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {(s.cliente_nombre || s.puesto_nombre || s.zona_nombre) && (
                          <p className="text-[10px] text-cyan-300/90 inline-flex items-start gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">
                              {[s.cliente_nombre, s.puesto_nombre, s.zona_nombre].filter(Boolean).join(" · ")}
                            </span>
                          </p>
                        )}
                        {fuera && dist != null && s.puesto_radio_m != null && (
                          <p className="text-[10px] text-rose-300 inline-flex items-center gap-1 mt-0.5 font-medium">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Fuera del perímetro: {Math.round(dist)}m (radio {Math.round(Number(s.puesto_radio_m))}m)
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          !conPos ? "bg-rose-500/15 text-rose-300 border border-rose-500/30" :
                          stale   ? "bg-amber-500/15 text-amber-200 border border-amber-500/30" :
                                    "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                        }`}>
                          {conPos ? fmtHaceSeg(s.hace_segundos) : "Sin GPS"}
                        </span>
                        {fuera && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40">
                            Fuera zona
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <GeofenceEventosPanel />
    </div>
  );
}

interface GeofenceEvento {
  id: number;
  tipo: "entry" | "exit";
  supervisor_nombre: string;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  distancia_m: number | null;
  radio_m: number | null;
  ocurrido_at: string;
  hace_segundos: number;
}

function GeofenceEventosPanel() {
  const [eventos, setEventos] = useState<GeofenceEvento[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    try {
      setErr(null);
      const r = await api<{ eventos: GeofenceEvento[] }>("/supervision-geofence-eventos?limit=50");
      setEventos(r.eventos || []);
    } catch (e: any) {
      setErr(e.message || "Error al cargar eventos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="border border-white/10 rounded-lg bg-[#0b1424] overflow-hidden">
      <div className="px-3 py-2 bg-white/5 text-xs font-bold text-white/80 border-b border-white/10 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-violet-300" />
          Llegadas y salidas a puestos (últimas 24h)
        </span>
        <button onClick={cargar}
          className="px-2 py-0.5 text-[11px] bg-white/5 hover:bg-white/10 text-white/70 rounded inline-flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Actualizar
        </button>
      </div>
      {err && <div role="alert" className="text-rose-300 text-xs p-3">{err}</div>}
      {loading && eventos.length === 0 && (
        <div className="text-white/40 text-xs p-4 inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…
        </div>
      )}
      {!loading && eventos.length === 0 && !err && (
        <p className="text-white/40 text-xs p-4 text-center">
          Sin eventos de geofencing recientes. Los supervisores con GPS en
          segundo plano activo dispararán eventos automáticamente al llegar
          o salir de cada puesto.
        </p>
      )}
      {eventos.length > 0 && (
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          <ul className="divide-y divide-white/5">
            {eventos.map(e => (
              <li key={e.id} className="px-3 py-2 hover:bg-white/5 flex items-start gap-2">
                <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                  e.tipo === "entry"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                }`}>
                  {e.tipo === "entry" ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white">
                    <strong>{e.supervisor_nombre}</strong>{" "}
                    <span className="text-white/60">{e.tipo === "entry" ? "llegó a" : "salió de"}</span>{" "}
                    <span className="text-cyan-200">
                      {[e.cliente_nombre, e.puesto_nombre].filter(Boolean).join(" · ") || "(puesto desconocido)"}
                    </span>
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    {fmtHaceSeg(e.hace_segundos)} · {new Date(e.ocurrido_at).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
                    {e.distancia_m != null && e.radio_m != null && (
                      <> · a {Math.round(e.distancia_m)}m del centro (radio {Math.round(e.radio_m)}m)</>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
