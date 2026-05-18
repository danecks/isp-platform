import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Loader2, LogIn, LogOut, Clock, Activity, Zap, MapPin } from "lucide-react";
import { api } from "./api";
import type { SupervisionProgramacion } from "./types";
import { TIPO_LABEL, ESTADO_LABEL, ESTADO_COLOR } from "./types";

interface PuntoGps {
  latitud: number; longitud: number;
  precision_metros: number | null;
  velocidad_mps: number | null;
  capturado_en: string;
}
interface GpsResp {
  puntos: PuntoGps[];
  fichaje_id?: number;
  iniciada_at: string | null;
  completada_at: string | null;
  info?: string;
}
interface GeofenceEv {
  id: number;
  tipo: "entry" | "exit";
  lat: number; lng: number;
  accuracy_m: number | null;
  distancia_m: number | null;
  radio_m: number | null;
  ocurrido_at: string;
  puesto_id: number | null;
  puesto_nombre: string | null;
}
interface GeofenceResp {
  eventos: GeofenceEv[];
  permanencia_segundos: number;
  auto_iniciada: boolean;
  iniciada_at: string | null;
  completada_at: string | null;
}

const GT_CENTER: [number, number] = [14.6349, -90.5069];

function iconEvento(tipo: "entry" | "exit") {
  const color = tipo === "entry" ? "#10b981" : "#f59e0b";
  const ring  = tipo === "entry" ? "#064e3b" : "#78350f";
  const letra = tipo === "entry" ? "E" : "S";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px ${ring};display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;font-family:system-ui,sans-serif;">${letra}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}
const iconInicio = L.divIcon({
  className: "",
  html: `<div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px #1e3a8a;"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});
const iconFin = L.divIcon({
  className: "",
  html: `<div style="background:#a78bfa;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px #4c1d95;"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});

function FitBounds({ puntos }: { puntos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    if (puntos.length === 1) { map.setView(puntos[0], 16); return; }
    map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 17 });
  }, [puntos, map]);
  return null;
}

function fmtDuracion(seg: number): string {
  if (!seg || seg <= 0) return "0 min";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}
function fmtHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export function VisitaDetalle({ visita, onClose }: { visita: SupervisionProgramacion; onClose: () => void }) {
  const [gps, setGps] = useState<GpsResp | null>(null);
  const [geo, setGeo] = useState<GeofenceResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([
      api<GpsResp>(`/supervision-programaciones/${visita.id}/gps`),
      api<GeofenceResp>(`/supervision-programaciones/${visita.id}/geofence-eventos`),
    ])
      .then(([g, e]) => { if (!alive) return; setGps(g); setGeo(e); })
      .catch((err) => { if (alive) setError(err.message || "Error al cargar tracking"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visita.id]);

  const trackLatLng = useMemo<[number, number][]>(
    () => (gps?.puntos || []).map(p => [Number(p.latitud), Number(p.longitud)]),
    [gps]
  );
  const eventosLatLng = useMemo<[number, number][]>(
    () => (geo?.eventos || []).map(e => [Number(e.lat), Number(e.lng)]),
    [geo]
  );
  const todosPuntos = useMemo(
    () => [...trackLatLng, ...eventosLatLng],
    [trackLatLng, eventosLatLng]
  );

  const numEntries = (geo?.eventos || []).filter(e => e.tipo === "entry").length;
  const numExits   = (geo?.eventos || []).filter(e => e.tipo === "exit").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="bg-[#0b1424] border border-white/10 rounded-lg w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">
              Visita programada · {visita.supervisor_nombre}
            </h2>
            <p className="text-[11px] text-white/60 mt-0.5 truncate">
              {visita.fecha_planificada}
              {visita.ventana_inicio && ` · ${visita.ventana_inicio}${visita.ventana_fin ? `–${visita.ventana_fin}` : ""}`}
              {" · "}{TIPO_LABEL[visita.tipo]}
              {" · "}{[visita.cliente_nombre, visita.puesto_nombre, visita.zona_nombre].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded border ${ESTADO_COLOR[visita.estado]}`}>
              {ESTADO_LABEL[visita.estado]}
            </span>
            <button onClick={onClose} aria-label="Cerrar"
              className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {error && (
            <div role="alert" className="text-rose-300 text-sm p-3 border border-rose-500/30 rounded bg-rose-500/10">
              {error}
            </div>
          )}
          {loading && (
            <div className="text-white/50 text-sm p-4 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando tracking…
            </div>
          )}

          {!loading && !error && (
            <>
              {/* KPIs de la visita */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Kpi
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Inicio real"
                  value={fmtHora(geo?.iniciada_at ?? gps?.iniciada_at ?? null)}
                  hint={geo?.auto_iniciada ? "auto-iniciada por entry" : undefined}
                />
                <Kpi
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Fin"
                  value={fmtHora(geo?.completada_at ?? gps?.completada_at ?? null)}
                />
                <Kpi
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  label="Permanencia"
                  value={fmtDuracion(geo?.permanencia_segundos || 0)}
                  hint={`${numEntries} llegada(s) · ${numExits} salida(s)`}
                />
                <Kpi
                  icon={<Activity className="w-3.5 h-3.5" />}
                  label="Puntos GPS"
                  value={(gps?.puntos || []).length}
                  hint={gps?.info || (trackLatLng.length === 0 ? "sin recorrido registrado" : undefined)}
                />
              </div>

              {geo?.auto_iniciada && (
                <div className="text-[11px] text-emerald-300 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
                  <Zap className="w-3 h-3" />
                  Esta visita arrancó automáticamente cuando el supervisor entró al perímetro del puesto.
                </div>
              )}

              {/* Mapa */}
              <div className="border border-white/10 rounded-lg overflow-hidden" style={{ height: 380 }}>
                {todosPuntos.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/40 text-xs">
                    Sin recorrido ni eventos de geofence para mostrar.
                  </div>
                ) : (
                  <MapContainer center={todosPuntos[0] || GT_CENTER} zoom={15} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FitBounds puntos={todosPuntos} />

                    {trackLatLng.length >= 2 && (
                      <Polyline positions={trackLatLng} pathOptions={{ color: "#22d3ee", weight: 3, opacity: 0.75 }} />
                    )}
                    {trackLatLng.length > 0 && (
                      <Marker position={trackLatLng[0]} icon={iconInicio}>
                        <Popup>Inicio del recorrido<br />{fmtHora(gps?.puntos[0]?.capturado_en ?? null)}</Popup>
                      </Marker>
                    )}
                    {trackLatLng.length > 1 && (
                      <Marker position={trackLatLng[trackLatLng.length - 1]} icon={iconFin}>
                        <Popup>Fin del recorrido<br />{fmtHora(gps?.puntos[gps.puntos.length - 1]?.capturado_en ?? null)}</Popup>
                      </Marker>
                    )}

                    {(geo?.eventos || []).map(ev => (
                      <Marker key={ev.id} position={[Number(ev.lat), Number(ev.lng)]} icon={iconEvento(ev.tipo)}>
                        <Popup>
                          <div style={{ fontSize: 12, minWidth: 200 }}>
                            <strong style={{ color: ev.tipo === "entry" ? "#047857" : "#b45309" }}>
                              {ev.tipo === "entry" ? "Llegó al puesto" : "Salió del puesto"}
                            </strong><br />
                            {fmtHora(ev.ocurrido_at)} ({new Date(ev.ocurrido_at).toLocaleDateString("es-GT")})<br />
                            {ev.puesto_nombre && <>Puesto: {ev.puesto_nombre}<br /></>}
                            {ev.distancia_m != null && (
                              <>Distancia al centro: {Math.round(ev.distancia_m)}m
                                {ev.radio_m != null && <> (radio {Math.round(ev.radio_m)}m)</>}<br />
                              </>
                            )}
                            {ev.accuracy_m != null && <>Precisión GPS: ±{Math.round(ev.accuracy_m)}m</>}
                          </div>
                        </Popup>
                        {ev.radio_m != null && (
                          <Circle
                            center={[Number(ev.lat), Number(ev.lng)]}
                            radius={Number(ev.radio_m)}
                            pathOptions={{
                              color: ev.tipo === "entry" ? "#10b981" : "#f59e0b",
                              fillOpacity: 0.05, weight: 1, dashArray: "4 4",
                            }}
                          />
                        )}
                      </Marker>
                    ))}
                  </MapContainer>
                )}
              </div>

              {/* Listado de eventos */}
              <div className="border border-white/10 rounded-lg bg-[#060e1c] overflow-hidden">
                <div className="px-3 py-2 bg-white/5 text-xs font-bold text-white/80 border-b border-white/10">
                  Llegadas y salidas durante la visita
                </div>
                {(geo?.eventos || []).length === 0 ? (
                  <p className="text-white/40 text-xs p-4 text-center">
                    No se registraron eventos de geofence para esta visita.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {(geo?.eventos || []).map(ev => (
                      <li key={ev.id} className="px-3 py-2 flex items-start gap-2">
                        <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                          ev.tipo === "entry"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                        }`}>
                          {ev.tipo === "entry" ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white">
                            <strong>{ev.tipo === "entry" ? "Llegó" : "Salió"}</strong>
                            {" "}<span className="text-white/60">a las</span>{" "}
                            <span className="text-cyan-200">{fmtHora(ev.ocurrido_at)}</span>
                          </p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {ev.distancia_m != null
                              ? <>a {Math.round(ev.distancia_m)}m del centro
                                  {ev.radio_m != null && <> · radio {Math.round(ev.radio_m)}m</>}</>
                              : "sin distancia registrada"}
                            {ev.accuracy_m != null && <> · ±{Math.round(ev.accuracy_m)}m</>}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-[#060e1c] border border-white/10 rounded p-2.5">
      <div className="flex items-center gap-1.5 text-white/50 text-[10px] uppercase tracking-wide">
        {icon}{label}
      </div>
      <div className="text-base font-bold text-white mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-white/40 mt-0.5">{hint}</div>}
    </div>
  );
}
