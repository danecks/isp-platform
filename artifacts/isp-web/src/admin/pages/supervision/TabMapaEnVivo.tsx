import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, RefreshCw, Clock, Activity, LogIn, LogOut } from "lucide-react";
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
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  zona_nombre: string | null;
  hace_segundos: number | null;
}

const POLL_MS = 15000;
const GT_CENTER: [number, number] = [14.6349, -90.5069];

function iconSupervisor(stale: boolean) {
  const color = stale ? "#f59e0b" : "#22d3ee";
  const ring  = stale ? "#78350f" : "#0e7490";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px ${ring};"></div>`,
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
  const puntos = useMemo<[number, number][]>(
    () => conGps.map(d => [Number(d.latitud), Number(d.longitud)] as [number, number]),
    [conGps]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#0b1424] border border-white/10 rounded">
        <div className="text-xs text-white/70 inline-flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-300" />
          <strong className="text-white">{data.length}</strong> supervisor(es) con turno activo —
          <span className="text-cyan-300 ml-1"><strong>{conGps.length}</strong> con GPS reciente</span>
          {sinGps.length > 0 && <span className="text-amber-300 ml-1">· {sinGps.length} sin señal</span>}
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
            {conGps.map(s => {
              const stale = (s.hace_segundos ?? 0) > 300;
              return (
                <Marker key={s.supervisor_id}
                  position={[Number(s.latitud), Number(s.longitud)]}
                  icon={iconSupervisor(stale)}>
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
                return (
                  <li key={s.supervisor_id} className="p-2.5 hover:bg-white/5">
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
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        !conPos ? "bg-rose-500/15 text-rose-300 border border-rose-500/30" :
                        stale   ? "bg-amber-500/15 text-amber-200 border border-amber-500/30" :
                                  "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                      }`}>
                        {conPos ? fmtHaceSeg(s.hace_segundos) : "Sin GPS"}
                      </span>
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
