import { useCallback, useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api";
const GPS_INTERVAL_MS = 30_000;

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

export function useSupervisorJornada(device: DeviceCreds | null, qrToken: string) {
  const [supervisor, setSupervisor] = useState<{ id: number; nombre: string } | null>(null);
  const [sesion, setSesion] = useState<SesionActiva | null>(null);
  const [proxima, setProxima] = useState<ProximaVisita | null>(null);
  const [horario, setHorario] = useState<{ hora_inicio: string | null; hora_fin: string | null }>({
    hora_inicio: null, hora_fin: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    (async () => {
      try {
        const j = await postJson<EstadoResp>("/agente/supervision/jornada/estado", auth);
        if (cancelado) return;
        setSupervisor(j.supervisor);
        setHorario(j.horario_planificado);
        setProxima(j.proxima_visita);
        if (!j.sesion) {
          // Auto clock-in al entrar.
          const ci = await postJson<{ ok: true; sesion: SesionActiva }>(
            "/agente/supervision/jornada/clock-in", auth
          );
          if (cancelado) return;
          setSesion(ci.sesion);
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
  // Funciona en Android Chrome y iOS 16.4+. Se re-adquiere si el sistema lo
  // libera al volver al primer plano (visibilitychange).
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

  // GPS cada 30s mientras hay sesión activa y la app está abierta.
  const gpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<{
    ultimo_envio_at: number | null;
    enviados: number;
    error: string | null;
  }>({ ultimo_envio_at: null, enviados: 0, error: null });

  useEffect(() => {
    if (!auth || !sesion || sesion.estado !== "activa") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus(s => ({ ...s, error: "Este dispositivo no soporta GPS." }));
      return;
    }

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
          // 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
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
  }, [auth?.device_uuid, sesion?.id, sesion?.estado]);

  const terminarJornada = useCallback(async () => {
    if (!auth) return;
    try {
      await postJson("/agente/supervision/jornada/clock-out", auth);
      setSesion(null);
      await recargar();
    } catch (e: any) { setError(e.message || "Error al terminar jornada"); }
  }, [device?.device_uuid, qrToken, recargar]);

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
  };
}
