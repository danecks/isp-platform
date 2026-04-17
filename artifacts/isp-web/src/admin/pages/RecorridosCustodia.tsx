import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  MapPin, Clock, RefreshCw, Activity, CheckCircle2, User, Building2,
  Loader2, AlertTriangle,
} from "lucide-react";

const API = "/api";

// Iconos personalizados (Leaflet por defecto pierde el ícono al hacer bundle)
const iconoInicio = L.divIcon({
  className: "",
  html: `<div style="background:#10b981;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px #064e3b;"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
const iconoFin = L.divIcon({
  className: "",
  html: `<div style="background:#ef4444;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px #7f1d1d;"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
const iconoActual = L.divIcon({
  className: "",
  html: `<div style="background:#3b82f6;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px #1e3a8a;animation:pulse 1.5s infinite;"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface RecorridoListItem {
  fichaje_id: number;
  employee_id: number;
  cliente_id: number | null;
  slot_numero: number | null;
  inicio_en: string;
  turno_cerrado_en: string | null;
  agente_nombre: string;
  cliente_nombre: string | null;
  total_puntos: number;
  ultimo_ping: string | null;
}

interface PuntoGPS {
  lat: number;
  lng: number;
  precision_metros: number | null;
  velocidad_mps: number | null;
  rumbo_grados: number | null;
  bateria_pct: number | null;
  capturado_en: string;
}

interface RecorridoDetalle {
  turno: {
    id: number;
    employee_id: number;
    cliente_id: number | null;
    slot_numero: number | null;
    inicio_en: string;
    turno_cerrado_en: string | null;
    agente_nombre: string;
    cliente_nombre: string | null;
  };
  puntos: PuntoGPS[];
  total_puntos: number;
  co_custodios?: Array<{ employee_id: number; nombre: string; fichaje_id: number; es_lider: boolean }>;
}

// Helper: ajustar mapa al recorrido cargado
function FitBounds({ puntos }: { puntos: PuntoGPS[] }) {
  const map = useMap();
  useEffect(() => {
    if (puntos.length === 0) return;
    const bounds = L.latLngBounds(puntos.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [puntos, map]);
  return null;
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-GT", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Guatemala",
  });
}
function fmtDuracion(desde: string, hasta: string | null): string {
  const ini = new Date(desde).getTime();
  const fin = hasta ? new Date(hasta).getTime() : Date.now();
  const min = Math.max(0, Math.floor((fin - ini) / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Calcular distancia recorrida total en km
function distanciaTotalKm(puntos: PuntoGPS[]): number {
  if (puntos.length < 2) return 0;
  const R = 6371;
  let km = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(x));
  }
  return km;
}

export default function RecorridosCustodia() {
  const [lista, setLista] = useState<RecorridoListItem[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<RecorridoDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const cargarLista = useCallback(async () => {
    try {
      const r = await fetch(`${API}/agente/recorridos-del-dia`);
      const data = await r.json();
      if (!r.ok) {
        setErrorLista(data.error || "Error cargando lista");
        return;
      }
      setLista(data);
      setErrorLista(null);
    } catch {
      setErrorLista("Sin conexión");
    } finally {
      setCargandoLista(false);
    }
  }, []);

  const cargarDetalle = useCallback(async (fichajeId: number) => {
    setCargandoDetalle(true);
    try {
      const r = await fetch(`${API}/agente/recorrido/${fichajeId}`);
      const data = await r.json();
      if (!r.ok) {
        setDetalle(null);
        return;
      }
      setDetalle(data);
    } catch {
      setDetalle(null);
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  // Cargar lista al montar y cada 30s si autoRefresh
  useEffect(() => {
    void cargarLista();
    if (!autoRefresh) return;
    const t = setInterval(() => void cargarLista(), 30_000);
    return () => clearInterval(t);
  }, [cargarLista, autoRefresh]);

  // Cargar detalle al cambiar selección y refrescar cada 20s si turno activo
  useEffect(() => {
    if (seleccionado === null) { setDetalle(null); return; }
    void cargarDetalle(seleccionado);
    if (!autoRefresh) return;
    const t = setInterval(() => void cargarDetalle(seleccionado), 20_000);
    return () => clearInterval(t);
  }, [seleccionado, autoRefresh, cargarDetalle]);

  const polyline = useMemo<[number, number][]>(
    () => detalle?.puntos.map(p => [p.lat, p.lng]) ?? [],
    [detalle],
  );
  const ultimoPunto = detalle?.puntos[detalle.puntos.length - 1] ?? null;
  const primerPunto = detalle?.puntos[0] ?? null;
  const turnoCerrado = detalle?.turno.turno_cerrado_en != null;
  const distKm = useMemo(() => distanciaTotalKm(detalle?.puntos ?? []), [detalle]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Recorridos de Custodios</h2>
          <p className="text-xs text-white/40">Turnos de custodia con rastreo GPS — hoy</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-blue-500"
            />
            Auto-actualizar
          </label>
          <button
            onClick={() => void cargarLista()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 border border-white/10"
          >
            <RefreshCw className="w-4 h-4" /> Refrescar
          </button>
        </div>
      </div>

      {errorLista && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorLista}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* Lista de turnos */}
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 text-xs uppercase tracking-wide text-white/50">
            Turnos del día ({lista.length})
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {cargandoLista ? (
              <div className="p-6 text-center text-white/40 text-sm">
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                Cargando…
              </div>
            ) : lista.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-sm">
                Sin turnos de custodia con tracking hoy.
              </div>
            ) : (
              <ul className="divide-y divide-white/8">
                {lista.map(t => {
                  const activo = !t.turno_cerrado_en;
                  const sel = seleccionado === t.fichaje_id;
                  return (
                    <li key={t.fichaje_id}>
                      <button
                        onClick={() => setSeleccionado(t.fichaje_id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          sel ? "bg-blue-600/20 border-l-2 border-blue-500" : "hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-white truncate flex items-center gap-2">
                              {activo ? (
                                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse flex-shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              )}
                              {t.agente_nombre}
                            </div>
                            {t.cliente_nombre && (
                              <div className="text-[11px] text-white/50 truncate flex items-center gap-1 mt-0.5">
                                <Building2 className="w-3 h-3" /> {t.cliente_nombre}
                                {t.slot_numero ? ` · #${t.slot_numero}` : ""}
                              </div>
                            )}
                            <div className="text-[11px] text-white/40 flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {fmtHora(t.inicio_en)}
                                {t.turno_cerrado_en && ` – ${fmtHora(t.turno_cerrado_en)}`}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {t.total_puntos}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            activo
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-white/5 text-white/40 border border-white/10"
                          }`}>
                            {activo ? "Activo" : "Cerrado"}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Mapa + detalle */}
        <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
          {seleccionado === null ? (
            <div className="h-[600px] flex flex-col items-center justify-center text-white/30 text-sm">
              <MapPin className="w-12 h-12 mb-3 opacity-50" />
              Seleccioná un turno para ver el recorrido
            </div>
          ) : cargandoDetalle && !detalle ? (
            <div className="h-[600px] flex items-center justify-center text-white/40">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !detalle ? (
            <div className="h-[600px] flex items-center justify-center text-white/40 text-sm">
              No se pudo cargar el recorrido
            </div>
          ) : (
            <>
              {/* Header detalle */}
              <div className="px-4 py-3 border-b border-white/8 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-white/40 uppercase tracking-wide text-[10px] flex items-center gap-1">
                    <User className="w-3 h-3" /> Custodio{(detalle.co_custodios?.length ?? 0) > 1 ? "s" : ""}
                  </div>
                  {(detalle.co_custodios?.length ?? 0) > 1 ? (
                    <div className="text-white font-medium text-[11px] leading-tight">
                      {detalle.co_custodios!.map(c => (
                        <div key={c.fichaje_id} className="truncate">
                          {c.nombre}{c.es_lider && <span className="text-blue-400 ml-1">·líder</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-white font-medium truncate">{detalle.turno.agente_nombre}</div>
                  )}
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-wide text-[10px]">Duración</div>
                  <div className="text-white font-medium">
                    {fmtDuracion(detalle.turno.inicio_en, detalle.turno.turno_cerrado_en)}
                    {!turnoCerrado && <span className="text-emerald-400 ml-1 text-[10px]">en curso</span>}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-wide text-[10px]">Puntos GPS</div>
                  <div className="text-white font-medium">{detalle.total_puntos}</div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-wide text-[10px]">Distancia recorrida</div>
                  <div className="text-white font-medium">{distKm.toFixed(2)} km</div>
                </div>
              </div>

              {/* Mapa */}
              {polyline.length === 0 ? (
                <div className="h-[540px] flex flex-col items-center justify-center text-white/30 text-sm">
                  <MapPin className="w-10 h-10 mb-2 opacity-50" />
                  Aún no hay puntos GPS grabados para este turno
                </div>
              ) : (
                <div className="h-[540px]">
                  <MapContainer
                    center={[polyline[0][0], polyline[0][1]]}
                    zoom={14}
                    scrollWheelZoom
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FitBounds puntos={detalle.puntos} />
                    <Polyline
                      positions={polyline}
                      pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.85 }}
                    />
                    {primerPunto && (
                      <Marker position={[primerPunto.lat, primerPunto.lng]} icon={iconoInicio}>
                        <Popup>
                          <div className="text-xs">
                            <div className="font-semibold">Inicio del turno</div>
                            <div>{fmtHora(primerPunto.capturado_en)}</div>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {ultimoPunto && ultimoPunto !== primerPunto && (
                      <Marker
                        position={[ultimoPunto.lat, ultimoPunto.lng]}
                        icon={turnoCerrado ? iconoFin : iconoActual}
                      >
                        <Popup>
                          <div className="text-xs">
                            <div className="font-semibold">
                              {turnoCerrado ? "Fin del turno" : "Última posición"}
                            </div>
                            <div>{fmtHora(ultimoPunto.capturado_en)}</div>
                            {ultimoPunto.bateria_pct !== null && (
                              <div>Batería: {ultimoPunto.bateria_pct}%</div>
                            )}
                            {ultimoPunto.precision_metros !== null && (
                              <div>Precisión: ±{ultimoPunto.precision_metros}m</div>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
