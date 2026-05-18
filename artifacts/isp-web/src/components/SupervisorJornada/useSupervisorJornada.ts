import { useCallback, useEffect, useRef, useState } from "react";
import {
  startBackgroundWatcher,
  supportsBackgroundTracking,
  type BgWatcherHandle,
} from "@/lib/native/backgroundLocation";

const API = import.meta.env.VITE_API_URL || "/api";
const GPS_INTERVAL_MS = 30_000;
// Min metros entre envíos consecutivos del modo background (filtra ruido y
// ahorra batería/red — distancia inferior se considera "mismo punto").
const BG_DISTANCE_FILTER_M = 20;
// Histéresis del geofence: para EVITAR parpadeo en el borde del perímetro,
// se entra al cruzar < radio_m, pero se sale recién al alejarse > radio_m * EXIT_FACTOR.
const GEOFENCE_EXIT_FACTOR = 1.15;
// Flush batch del modo background cada N segundos como mínimo, o cuando se
// acumulen MAX puntos en buffer (lo que pase primero).
const BG_FLUSH_INTERVAL_MS = 30_000;
const BG_FLUSH_MAX_POINTS = 50;

export interface DeviceCreds { device_uuid: string; device_token: string; }

export interface SesionActiva {
  id: number;
  fecha: string;
  hora_inicio_real: string;
  hora_inicio_planificada: string | null;
  hora_fin_planificada: string | null;
  estado: "activa" | "cerrada_manual" | "cerrada_auto";
}

export interface ProximaVisita {
  id: number;
  cliente_id: number | null;
  puesto_id: number | null;
  fecha_planificada: string;
  ventana_inicio: string | null;
  ventana_fin: string | null;
  tipo: string;
  prioridad: string;
  estado: string;
  instrucciones: string | null;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  puesto_direccion: string | null;
}

interface EstadoResp {
  ok: true;
  supervisor: { id: number; nombre: string };
  sesion: SesionActiva | null;
  horario_planificado: { hora_inicio: string | null; hora_fin: string | null };
  proxima_visita: ProximaVisita | null;
}

interface PuestoGeofence {
  puesto_id: number;
  puesto_nombre: string;
  cliente_id: number | null;
  cliente_nombre: string | null;
  lat: number;
  lng: number;
  radio_m: number;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Error HTTP ${r.status}`);
  return j as T;
}

// Haversine entre dos puntos en metros. Aproximación esférica suficiente
// para distancias < 100 km (los puestos están a < 10 km del supervisor).
function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Flag volátil escrito por AgenteSupervision al hacer un escaneo NUEVO
// del carnet (o al consumir el #qr= venido de /agente/inicio). Si el flag
// está presente cuando boot detecta sesion=null, hacemos clock-in automático.
// Si NO está, significa que el qr fue restaurado de localStorage de otra
// sesión del browser → no hacemos clock-in silencioso, llamamos
// onSesionAusente para que la UI limpie el qr y pida re-escaneo (caso de
// dispositivo compartido entre supervisores y entre días).
const QR_FRESH_KEY = "isp_supervisor_qr_fresh";
// Preferencia persistida: si el usuario activó el modo background, lo
// re-activamos automáticamente la próxima vez que entre en jornada (mismo
// supervisor / mismo APK). Se resetea al cerrar jornada manualmente.
const BG_PREF_KEY = "isp_supervisor_bg_enabled";

function consumirFreshFlag(): boolean {
  try {
    const v = sessionStorage.getItem(QR_FRESH_KEY);
    if (v) sessionStorage.removeItem(QR_FRESH_KEY);
    return v === "1";
  } catch { return false; }
}

function leerBgPref(): boolean {
  try { return localStorage.getItem(BG_PREF_KEY) === "1"; } catch { return false; }
}
function guardarBgPref(v: boolean): void {
  try {
    if (v) localStorage.setItem(BG_PREF_KEY, "1");
    else   localStorage.removeItem(BG_PREF_KEY);
  } catch { /* noop */ }
}

export function useSupervisorJornada(
  device: DeviceCreds | null,
  qrToken: string,
  onSesionAusente?: () => void,
) {
  const [supervisor, setSupervisor] = useState<{ id: number; nombre: string } | null>(null);
  const [sesion, setSesion] = useState<SesionActiva | null>(null);
  const [proxima, setProxima] = useState<ProximaVisita | null>(null);
  const [horario, setHorario] = useState<{ hora_inicio: string | null; hora_fin: string | null }>({
    hora_inicio: null, hora_fin: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Estado del modo background: el usuario lo enciende manualmente desde la
  // UI (botón "Activar GPS en segundo plano"). En APK arranca el servicio
  // en primer plano del plugin; en navegador hace fallback a watchPosition.
  const [bgEnabled, setBgEnabled] = useState<boolean>(false);
  const [bgIsNative, setBgIsNative] = useState<boolean>(false);

  const auth = device && qrToken
    ? { device_uuid: device.device_uuid, device_token: device.device_token, qr_token: qrToken }
    : null;

  const recargar = useCallback(async () => {
    if (!auth) return;
    setLoading(true); setError(null);
    try {
      const j = await postJson<EstadoResp>("/agente/supervision/jornada/estado", auth);
      setSupervisor(j.supervisor);
      setSesion(j.sesion);
      setProxima(j.proxima_visita);
      setHorario(j.horario_planificado);
    } catch (e: any) {
      setError(e.message || "Error al cargar");
    } finally { setLoading(false); }
  }, [device?.device_uuid, device?.device_token, qrToken]);

  // Carga inicial + clock-in automático si no hay sesión.
  useEffect(() => {
    if (!auth) return;
    let cancelado = false;
    const esFresco = consumirFreshFlag();
    (async () => {
      try {
        const j = await postJson<EstadoResp>("/agente/supervision/jornada/estado", auth);
        if (cancelado) return;
        setSupervisor(j.supervisor);
        setHorario(j.horario_planificado);
        setProxima(j.proxima_visita);
        if (!j.sesion) {
          if (esFresco) {
            const ci = await postJson<{ ok: true; sesion: SesionActiva }>(
              "/agente/supervision/jornada/clock-in", auth
            );
            if (cancelado) return;
            setSesion(ci.sesion);
          } else {
            if (cancelado) return;
            setSesion(null);
            onSesionAusente?.();
          }
        } else {
          setSesion(j.sesion);
        }
      } catch (e: any) {
        if (!cancelado) setError(e.message || "Error al cargar");
      }
    })();
    return () => { cancelado = true; };
  }, [device?.device_uuid, device?.device_token, qrToken]);

  // Wake Lock: mantiene la pantalla encendida mientras hay sesión activa.
  useEffect(() => {
    if (!sesion || sesion.estado !== "activa") return;
    if (typeof navigator === "undefined") return;
    const wl = (navigator as any).wakeLock;
    if (!wl || typeof wl.request !== "function") return;

    let lock: any = null;
    let cancelado = false;

    const adquirir = async () => {
      try {
        if (cancelado) return;
        if (document.visibilityState !== "visible") return;
        lock = await wl.request("screen");
        lock?.addEventListener?.("release", () => { lock = null; });
      } catch { /* sin permiso o no soportado: silencioso */ }
    };
    const onVis = () => {
      if (document.visibilityState === "visible" && !lock) void adquirir();
    };

    void adquirir();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", onVis);
      try { lock?.release?.(); } catch { /* noop */ }
      lock = null;
    };
  }, [sesion?.id, sesion?.estado]);

  // ── GPS foreground (modo legacy) ────────────────────────────────────────
  // Tick cada 30s mientras hay sesión activa y la app está abierta. Se
  // DESACTIVA si bgEnabled == true (el watcher de background ya está
  // reportando con su propia cadencia, mejor precisión y persistencia).
  const gpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<{
    ultimo_envio_at: number | null;
    enviados: number;
    error: string | null;
    modo: "off" | "foreground" | "background_web" | "background_native";
  }>({ ultimo_envio_at: null, enviados: 0, error: null, modo: "off" });

  useEffect(() => {
    if (!auth || !sesion || sesion.estado !== "activa") return;
    if (bgEnabled) return; // el watcher background se encarga
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus(s => ({ ...s, error: "Este dispositivo no soporta GPS.", modo: "off" }));
      return;
    }
    setGpsStatus(s => ({ ...s, modo: "foreground" }));

    let detenido = false;
    const enviar = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (detenido) return;
          const { latitude, longitude, accuracy } = pos.coords;
          gpsRef.current = { lat: latitude, lng: longitude };
          postJson("/agente/supervision/jornada/gps", {
            ...auth, lat: latitude, lng: longitude, accuracy_m: accuracy,
          })
            .then(() => {
              if (detenido) return;
              setGpsStatus(s => ({
                ...s,
                ultimo_envio_at: Date.now(),
                enviados: s.enviados + 1,
                error: null,
              }));
            })
            .catch((e) => {
              if (detenido) return;
              if (String(e?.message).includes("sin_sesion_activa")) {
                setSesion(null);
                void recargar();
                return;
              }
              setGpsStatus(s => ({ ...s, error: "No se pudo enviar GPS al servidor." }));
            });
        },
        (err) => {
          if (detenido) return;
          const msg = err.code === 1
            ? "Permiso de ubicación denegado. Activá GPS en ajustes del navegador/PWA."
            : err.code === 2
            ? "GPS no disponible (sin señal). Salí a un lugar abierto."
            : err.code === 3
            ? "GPS tardó demasiado en responder. Reintentando…"
            : "No se pudo obtener la ubicación.";
          setGpsStatus(s => ({ ...s, error: msg }));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    };
    enviar();
    const t = setInterval(enviar, GPS_INTERVAL_MS);
    return () => { detenido = true; clearInterval(t); };
  }, [auth?.device_uuid, sesion?.id, sesion?.estado, bgEnabled]);

  // ── GPS background + geofencing ──────────────────────────────────────────
  // Cuando bgEnabled = true y hay sesión activa:
  //   1. Pedimos al server las coords + radio de los puestos en agenda.
  //   2. Arrancamos el watcher (foreground service en APK, watchPosition en web).
  //   3. Cada lectura: bufferizamos para gps-batch + corremos detección
  //      de geofence local; al cruzar perímetro disparamos evento al server.
  const puestosRef = useRef<PuestoGeofence[]>([]);
  // Por puesto: estado actual (dentro/fuera). Inicializa undefined hasta la
  // primera lectura — sin esto, una lectura "dentro" al iniciar dispararía
  // un 'entry' falso (no sabemos de dónde venía el usuario).
  const dentroRef = useRef<Map<number, boolean>>(new Map());
  const watcherRef = useRef<BgWatcherHandle | null>(null);
  const bufferRef = useRef<Array<{ lat: number; lng: number; accuracy_m: number; timestamp: number }>>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargarPuestosGeofence = useCallback(async () => {
    if (!auth) return;
    try {
      const j = await postJson<{ ok: true; puestos: PuestoGeofence[] }>(
        "/agente/supervision/jornada/puestos-geofence", auth
      );
      puestosRef.current = j.puestos.map(p => ({
        ...p, lat: Number(p.lat), lng: Number(p.lng), radio_m: Number(p.radio_m),
      })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.radio_m > 0);
    } catch {
      // no es bloqueante; sin geofences el tracking sigue funcionando.
      puestosRef.current = [];
    }
  }, [auth?.device_uuid, auth?.qr_token]);

  const flushBuffer = useCallback(async () => {
    if (!auth) return;
    if (bufferRef.current.length === 0) return;
    const puntos = bufferRef.current.splice(0, bufferRef.current.length);
    try {
      await postJson("/agente/supervision/jornada/gps-batch", { ...auth, puntos });
      setGpsStatus(s => ({
        ...s,
        ultimo_envio_at: Date.now(),
        enviados: s.enviados + puntos.length,
        error: null,
      }));
    } catch (e: any) {
      // Reencolar y reintentar en el próximo tick. Si el buffer crece
      // demasiado (offline largo) tiramos los más viejos para no perder
      // memoria — el plugin nativo igual tiene su propia cola persistida.
      bufferRef.current.unshift(...puntos);
      if (bufferRef.current.length > 500) {
        bufferRef.current.splice(0, bufferRef.current.length - 500);
      }
      if (String(e?.message).includes("sin_sesion_activa")) {
        setSesion(null); void recargar();
        return;
      }
      setGpsStatus(s => ({ ...s, error: "No se pudo enviar GPS al servidor (reintentando)." }));
    }
  }, [auth?.device_uuid, auth?.qr_token, recargar]);

  const evaluarGeofences = useCallback((loc: { lat: number; lng: number; accuracy_m: number; timestamp: number }) => {
    if (!auth) return;
    for (const p of puestosRef.current) {
      const d = distanciaMetros(loc, p);
      const estabaDentro = dentroRef.current.get(p.puesto_id);
      const adentro = d <= p.radio_m;
      const afuera  = d >  p.radio_m * GEOFENCE_EXIT_FACTOR;

      if (estabaDentro === undefined) {
        // Primera lectura: solo memorizamos sin disparar evento.
        if (adentro) dentroRef.current.set(p.puesto_id, true);
        else if (afuera) dentroRef.current.set(p.puesto_id, false);
        continue;
      }
      if (!estabaDentro && adentro) {
        dentroRef.current.set(p.puesto_id, true);
        postJson("/agente/supervision/jornada/geofence-evento", {
          ...auth, puesto_id: p.puesto_id, tipo: "entry",
          lat: loc.lat, lng: loc.lng,
          accuracy_m: loc.accuracy_m, distancia_m: d, radio_m: p.radio_m,
          timestamp: loc.timestamp,
        }).catch(() => { /* el server hace dedupe; silencioso */ });
      } else if (estabaDentro && afuera) {
        dentroRef.current.set(p.puesto_id, false);
        postJson("/agente/supervision/jornada/geofence-evento", {
          ...auth, puesto_id: p.puesto_id, tipo: "exit",
          lat: loc.lat, lng: loc.lng,
          accuracy_m: loc.accuracy_m, distancia_m: d, radio_m: p.radio_m,
          timestamp: loc.timestamp,
        }).catch(() => { /* noop */ });
      }
    }
  }, [auth?.device_uuid, auth?.qr_token]);

  // Re-activar bgEnabled automáticamente si el usuario lo había encendido
  // antes y todavía tiene sesión activa.
  useEffect(() => {
    if (!sesion || sesion.estado !== "activa") return;
    if (leerBgPref()) setBgEnabled(true);
  }, [sesion?.id]);

  useEffect(() => {
    if (!auth || !sesion || sesion.estado !== "activa") return;
    if (!bgEnabled) {
      // detener watcher si quedó activo
      if (watcherRef.current) {
        watcherRef.current.stop().catch(() => {});
        watcherRef.current = null;
      }
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      return;
    }

    let cancelado = false;
    setBgIsNative(supportsBackgroundTracking());

    (async () => {
      await cargarPuestosGeofence();
      if (cancelado) return;

      const h = await startBackgroundWatcher(
        (loc, err) => {
          if (err) {
            setGpsStatus(s => ({ ...s, error: `GPS background: ${err.message}` }));
            return;
          }
          if (!loc) return;
          gpsRef.current = { lat: loc.latitude, lng: loc.longitude };
          const punto = {
            lat: loc.latitude,
            lng: loc.longitude,
            accuracy_m: loc.accuracy,
            timestamp: loc.timestamp,
          };
          // Geofence se evalúa siempre — aunque el punto sea redundante,
          // un movimiento de pocos metros igual puede cruzar el borde.
          evaluarGeofences(punto);
          // Dedupe simple por distancia: si el nuevo punto está a < N m del
          // último encolado, lo descartamos para no inflar el buffer.
          const last = bufferRef.current[bufferRef.current.length - 1];
          if (last) {
            const d = distanciaMetros({ lat: last.lat, lng: last.lng }, punto);
            if (d < BG_DISTANCE_FILTER_M) return;
          }
          bufferRef.current.push(punto);
          if (bufferRef.current.length >= BG_FLUSH_MAX_POINTS) {
            void flushBuffer();
          }
        },
        {
          backgroundTitle: "ISP Operaciones — Supervisión activa",
          backgroundMessage: "Reportando tu ubicación durante la jornada.",
          distanceFilter: BG_DISTANCE_FILTER_M,
          requestPermissions: true,
        }
      );
      if (cancelado) {
        await h.stop();
        return;
      }
      watcherRef.current = h;
      setBgIsNative(h.isNative);
      setGpsStatus(s => ({
        ...s,
        modo: h.isNative ? "background_native" : "background_web",
        error: null,
      }));

      flushTimerRef.current = setInterval(() => { void flushBuffer(); }, BG_FLUSH_INTERVAL_MS);
    })();

    return () => {
      cancelado = true;
      if (watcherRef.current) {
        watcherRef.current.stop().catch(() => {});
        watcherRef.current = null;
      }
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      // Vaciar el buffer pendiente antes de salir.
      void flushBuffer();
    };
  }, [auth?.device_uuid, sesion?.id, sesion?.estado, bgEnabled, cargarPuestosGeofence, evaluarGeofences, flushBuffer]);

  const setBackgroundTracking = useCallback((on: boolean) => {
    guardarBgPref(on);
    setBgEnabled(on);
    if (!on) {
      setGpsStatus(s => ({ ...s, modo: "foreground" }));
    }
  }, []);

  const terminarJornada = useCallback(async () => {
    if (!auth) return;
    try {
      // Apagamos el background antes de cerrar para no dejar la notificación
      // persistente activa sin sesión.
      setBackgroundTracking(false);
      if (watcherRef.current) {
        await watcherRef.current.stop().catch(() => {});
        watcherRef.current = null;
      }
      await flushBuffer();
      await postJson("/agente/supervision/jornada/clock-out", auth);
      setSesion(null);
      await recargar();
    } catch (e: any) { setError(e.message || "Error al terminar jornada"); }
  }, [device?.device_uuid, qrToken, recargar, flushBuffer, setBackgroundTracking]);

  const generarNovedad = useCallback(async (observaciones?: string) => {
    if (!auth) return null;
    const j = await postJson<{ ok: true; novedades_creadas: number[] }>(
      "/agente/supervision/novedad/generar",
      { ...auth, observaciones: observaciones || undefined }
    );
    return j.novedades_creadas;
  }, [device?.device_uuid, qrToken]);

  return {
    supervisor, sesion, proxima, horario, loading, error,
    setError, recargar, terminarJornada, generarNovedad,
    gpsActual: gpsRef.current,
    gpsStatus,
    auth,
    bgEnabled,
    bgIsNative,
    bgSupported: supportsBackgroundTracking(),
    setBackgroundTracking,
  };
}
