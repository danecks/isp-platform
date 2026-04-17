import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  CheckCircle, XCircle, Loader2, MapPin, AlertTriangle,
  QrCode, ShieldAlert, RotateCcw, Smartphone, Users, Clock,
  Navigation, LogOut, Activity,
} from "lucide-react";

const API = "/api";
const SCANNER_ID = "isp-agente-scanner";
const DEVICE_KEY = "isp_device";          // mismo key que SupervisorActivar
const AUTO_RESET_MS = 8000;                // tiempo de éxito antes de volver al inicio (modo kiosco)

// ── Tracking GPS de custodios ──
const TRACKING_KEY = "isp_turno_activo";   // localStorage para reanudar al reabrir
const PING_DISTANCIA_M = 30;               // mover al menos 30m para grabar punto
const PING_TIEMPO_MAX_MS = 60_000;         // o cada 60s si no se movió (heartbeat)
const FLUSH_INTERVAL_MS = 30_000;          // intentar enviar lote cada 30s
const FLUSH_MAX_PUNTOS = 20;               // o cuando se acumulen 20 puntos

interface TurnoActivoStorage {
  fichaje_id: number;
  tracking_token: string;
  iniciado_en: string;
  agente_nombre: string;
  cliente_nombre: string | null;
  titulo: string;
}

interface PuntoGPS {
  lat: number;
  lng: number;
  precision: number | null;
  velocidad: number | null;
  rumbo: number | null;
  bateria: number | null;
  ts: string; // ISO
}

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Estado =
  | "inicio"
  | "escaneando"
  | "esperando_gps"
  | "gps_denegado"
  | "enviando"
  | "ok"
  | "turno_activo"
  | "cerrando_turno"
  | "error"
  | "error_cierre";

interface Servicio {
  tipo: "puesto" | "custodia";
  cliente_nombre: string | null;
  titulo: string;
  horario: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  turno: string | null;
  jornada: string | null;
}
interface Agente { nombre: string; cargo: string | null }
interface Arma { codigo: string; descripcion: string; serie: string | null }
interface Resultado {
  agente: Agente;
  servicio: Servicio;
  arma: Arma | null;
  resultado: string;
  distancia_metros: number | null;
  registrado_en: string;
}

interface DeviceCreds { uuid: string; token: string }
interface PuestoDelDia {
  puesto: {
    id: number;
    nombre: string;
    cliente_nombre: string | null;
    horario: string | null;
    turno: string | null;
  };
  agentes: {
    employee_id: number;
    nombre: string;
    cargo: string | null;
    orden: number;
    inicio_turno_hoy: { fichaje_id: number; registrado_en: string } | null;
  }[];
}

function leerDeviceCreds(): DeviceCreds | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceCreds;
    if (!parsed.uuid || !parsed.token) return null;
    return parsed;
  } catch { return null; }
}

export default function AgenteInicio() {
  const [estado, setEstado] = useState<Estado>("inicio");
  const [mensajeError, setMensajeError] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carnetToken, setCarnetToken] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [linternaOn, setLinternaOn] = useState(false);
  const [linternaSoportada, setLinternaSoportada] = useState(false);

  // Modo kiosco: si hay credenciales de dispositivo en localStorage
  const [device] = useState<DeviceCreds | null>(() => leerDeviceCreds());
  const esKiosco = device !== null;
  const [puestoDelDia, setPuestoDelDia] = useState<PuestoDelDia | null>(null);
  const [errorKiosco, setErrorKiosco] = useState<string | null>(null);

  // ── Tracking GPS de turno activo (custodia) ──
  const [turnoActivo, setTurnoActivo] = useState<TurnoActivoStorage | null>(null);
  const [puntosCount, setPuntosCount] = useState(0);
  const [ultimaPosicion, setUltimaPosicion] = useState<{ lat: number; lng: number; ts: string } | null>(null);
  const [bateria, setBateria] = useState<number | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [coCustodios, setCoCustodios] = useState<Array<{ employee_id: number; nombre: string; fichaje_id: number; es_lider: boolean }>>([]);

  const watchIdRef = useRef<number | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufferRef = useRef<PuntoGPS[]>([]);
  const ultimoGrabadoRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const turnoActivoRef = useRef<TurnoActivoStorage | null>(null);

  // Mantener ref sincronizada con el estado para usar dentro de callbacks de geo
  useEffect(() => { turnoActivoRef.current = turnoActivo; }, [turnoActivo]);

  // GPS-RECO-02: cargar lista de co-custodios anexados al recorrido (refresca cada 20s)
  useEffect(() => {
    if (!turnoActivo) { setCoCustodios([]); return; }
    let cancelled = false;
    const fetchCo = async () => {
      try {
        const r = await fetch(
          `${API}/agente/co-custodios/${turnoActivo.fichaje_id}?tracking_token=${encodeURIComponent(turnoActivo.tracking_token)}`,
        );
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setCoCustodios(data.co_custodios ?? []);
      } catch { /* noop */ }
    };
    void fetchCo();
    const t = setInterval(() => void fetchCo(), 20_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [turnoActivo]);

  // Cargar lista del día (modo kiosco)
  const cargarPuestoDelDia = useCallback(async () => {
    if (!device) return;
    try {
      const r = await fetch(
        `${API}/agente/puesto-del-dia?device_uuid=${encodeURIComponent(device.uuid)}&device_token=${encodeURIComponent(device.token)}`,
      );
      const data = await r.json();
      if (!r.ok) {
        setErrorKiosco(data.mensaje || data.error || "Dispositivo no autorizado");
        return;
      }
      setErrorKiosco(null);
      setPuestoDelDia(data);
    } catch {
      setErrorKiosco("No se pudo conectar con el servidor");
    }
  }, [device]);

  useEffect(() => { void cargarPuestoDelDia(); }, [cargarPuestoDelDia]);

  // Detener scanner al desmontar
  const detenerScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* noop */ }
      try { scannerRef.current.clear(); } catch { /* noop */ }
      scannerRef.current = null;
    }
  }, []);
  useEffect(() => () => { void detenerScanner(); }, [detenerScanner]);

  // Iniciar escaneo
  const iniciarEscaneo = useCallback(async () => {
    setMensajeError("");
    setResultado(null);

    // Pre-validaciones de contexto (no abren la cámara, solo chequean capacidad del navegador)
    if (!window.isSecureContext) {
      setMensajeError("La cámara solo funciona con HTTPS. Abrí la app desde el enlace seguro.");
      setEstado("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMensajeError("Este navegador no soporta cámara. Usá Safari o Chrome actualizado.");
      setEstado("error");
      return;
    }

    setEstado("escaneando");
    await new Promise(r => setTimeout(r, 50));
    try {
      const scanner = new Html5Qrcode(SCANNER_ID, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
      } as ConstructorParameters<typeof Html5Qrcode>[1]);
      scannerRef.current = scanner;
      // qrbox dinámico: 80% del lado más corto del viewport del scanner
      const qrboxFn = (vw: number, vh: number) => {
        const min = Math.min(vw, vh);
        const size = Math.floor(min * 0.8);
        return { width: size, height: size };
      };
      // Html5Qrcode exige que cameraIdOrConfig tenga EXACTAMENTE 1 key cuando es objeto.
      // Solo pedimos cámara trasera; resolución/enfoque los maneja la lib internamente.
      const videoConstraints = { facingMode: "environment" } as MediaTrackConstraints;
      await scanner.start(
        videoConstraints,
        {
          fps: 20,
          qrbox: qrboxFn,
          aspectRatio: 1.0,
          disableFlip: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        } as Parameters<Html5Qrcode["start"]>[2],
        (decoded) => {
          let token = decoded.trim();
          try {
            const u = new URL(token);
            token = u.searchParams.get("token") || u.pathname.split("/").pop() || token;
          } catch { /* token directo */ }
          setCarnetToken(token);
          void detenerScanner();
          solicitarGPS(token);
        },
        () => { /* scan fail por frame */ }
      );
      // Detectar si el track soporta linterna (Android Chrome sí, iOS no)
      try {
        const videoEl = document.querySelector(
          `#${SCANNER_ID} video`,
        ) as HTMLVideoElement | null;
        const stream = videoEl?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks?.()[0];
        const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean } | undefined;
        setLinternaSoportada(!!capabilities?.torch);
      } catch { setLinternaSoportada(false); }
      setLinternaOn(false);
    } catch (err: unknown) {
      // Html5Qrcode a veces rechaza con string, a veces con DOMException
      let detalle = "";
      let nombre = "";
      if (err instanceof Error) {
        detalle = err.message;
        nombre = err.name;
      } else if (typeof err === "string") {
        detalle = err;
      } else if (err && typeof err === "object") {
        const anyErr = err as { name?: string; message?: string };
        nombre = anyErr.name || "";
        detalle = anyErr.message || JSON.stringify(err);
      } else {
        detalle = String(err);
      }
      let msg = `No se pudo acceder a la cámara: ${detalle || "(sin detalle)"}`;
      if (nombre === "NotAllowedError" || /denied|allow/i.test(detalle)) {
        msg = "Permiso de cámara denegado. Abrí Ajustes → Safari → Cámara y permití el acceso.";
      } else if (nombre === "NotFoundError" || /not found|no camera/i.test(detalle)) {
        msg = "No se encontró ninguna cámara en este dispositivo.";
      } else if (nombre === "NotReadableError" || /in use|busy|already/i.test(detalle)) {
        msg = "La cámara está siendo usada por otra app o pestaña. Cerrala y volvé a intentar.";
      }
      setMensajeError(msg);
      setEstado("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detenerScanner]);

  // Solicitar GPS y enviar
  const solicitarGPS = useCallback((token: string) => {
    setEstado("esperando_gps");
    if (!navigator.geolocation) { enviar(token, null, null, null); return; }
    let settled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        enviar(
          token,
          pos.coords.latitude, pos.coords.longitude,
          Math.round(pos.coords.accuracy),
        );
      },
      (err) => {
        if (settled) return;
        settled = true;
        if (err.code === 1) { setEstado("gps_denegado"); return; }
        enviar(token, null, null, null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Enviar lote de puntos al servidor ──
  const flushPuntos = useCallback(async () => {
    const turno = turnoActivoRef.current;
    if (!turno) return;
    if (bufferRef.current.length === 0) return;
    const lote = bufferRef.current.splice(0, bufferRef.current.length);
    try {
      const r = await fetch(`${API}/agente/recorrido-ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fichaje_id: turno.fichaje_id,
          tracking_token: turno.tracking_token,
          puntos: lote,
        }),
        keepalive: true, // permite enviar aunque la pestaña se cierre
      });
      if (!r.ok) {
        // Si el server rechaza por "turno_ya_cerrado", limpiar local
        if (r.status === 409) {
          localStorage.removeItem(TRACKING_KEY);
          detenerRastreoInterno();
          setTurnoActivo(null);
          setEstado("inicio");
          return;
        }
        // Reintento simple: devolver al buffer al frente
        bufferRef.current = [...lote, ...bufferRef.current];
        setTrackingError("Conexión inestable, reintentando…");
      } else {
        setTrackingError(null);
      }
    } catch {
      // Sin red — devolvemos al buffer y reintentamos en el siguiente tick
      bufferRef.current = [...lote, ...bufferRef.current];
      setTrackingError("Sin conexión, los puntos se enviarán cuando vuelva");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Liberar todos los recursos del rastreo (sin tocar localStorage) ──
  const detenerRastreoInterno = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(watchIdRef.current); } catch { /* noop */ }
      watchIdRef.current = null;
    }
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (wakeLockRef.current) {
      try { void wakeLockRef.current.release(); } catch { /* noop */ }
      wakeLockRef.current = null;
    }
    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch { /* noop */ }
      audioCtxRef.current = null;
    }
  }, []);

  // ── Audio silencioso en loop: trick para que Android no duerma la pestaña ──
  const arrancarAudioSilencioso = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0; // silencio absoluto
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audioCtxRef.current = ctx;
    } catch { /* noop */ }
  }, []);

  // ── Wake Lock: mantiene la pantalla encendida si el agente lo deja activo ──
  // (no lo activamos automáticamente para no quemar batería; lo activa el botón)
  const adquirirWakeLock = useCallback(async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock;
      if (!wl) return false;
      wakeLockRef.current = await wl.request("screen");
      return true;
    } catch { return false; }
  }, []);

  // ── Iniciar el rastreo continuo ──
  const iniciarRastreo = useCallback((turno: TurnoActivoStorage) => {
    setTurnoActivo(turno);
    turnoActivoRef.current = turno;
    localStorage.setItem(TRACKING_KEY, JSON.stringify(turno));
    bufferRef.current = [];
    ultimoGrabadoRef.current = null;
    setPuntosCount(0);
    setTrackingError(null);
    setCoCustodios([]);

    // Audio truco (no requiere permiso explícito)
    arrancarAudioSilencioso();

    // Batería (Battery API; no soportada en iOS)
    try {
      const navAny = navigator as Navigator & { getBattery?: () => Promise<{ level: number; addEventListener: (e: string, f: () => void) => void }> };
      navAny.getBattery?.().then((b) => {
        const update = () => setBateria(Math.round(b.level * 100));
        update();
        b.addEventListener("levelchange", update);
      });
    } catch { /* noop */ }

    // GPS continuo
    if (!navigator.geolocation) {
      setTrackingError("Este teléfono no tiene GPS disponible");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const ahora = Date.now();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const ultimo = ultimoGrabadoRef.current;
        let grabar = false;
        if (!ultimo) {
          grabar = true;
        } else {
          const dist = distanciaMetros(ultimo.lat, ultimo.lng, lat, lng);
          const tiempoMs = ahora - ultimo.ts;
          if (dist >= PING_DISTANCIA_M) grabar = true;
          else if (tiempoMs >= PING_TIEMPO_MAX_MS) grabar = true;
        }
        if (!grabar) return;
        const punto: PuntoGPS = {
          lat, lng,
          precision: typeof pos.coords.accuracy === "number" ? Math.round(pos.coords.accuracy) : null,
          velocidad: typeof pos.coords.speed === "number" ? pos.coords.speed : null,
          rumbo: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
          bateria,
          ts: new Date(ahora).toISOString(),
        };
        bufferRef.current.push(punto);
        ultimoGrabadoRef.current = { lat, lng, ts: ahora };
        setPuntosCount((c) => c + 1);
        setUltimaPosicion({ lat, lng, ts: punto.ts });
        // Si llenamos el lote, flush inmediato
        if (bufferRef.current.length >= FLUSH_MAX_PUNTOS) void flushPuntos();
      },
      (err) => {
        if (err.code === 1) setTrackingError("Permiso de GPS denegado");
        else if (err.code === 3) setTrackingError("GPS lento, esperando señal…");
        else setTrackingError("Error obteniendo GPS");
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );

    // Flush periódico
    flushTimerRef.current = setInterval(() => { void flushPuntos(); }, FLUSH_INTERVAL_MS);
  }, [arrancarAudioSilencioso, bateria, flushPuntos]);

  // ── Cerrar turno (botón) ──
  const cerrarTurno = useCallback(async () => {
    const turno = turnoActivoRef.current;
    if (!turno) return;
    setEstado("cerrando_turno");
    // 1. Mandar lo que quede en buffer
    await flushPuntos();
    // 2. Última posición conocida (si hay)
    const last = ultimaPosicion;
    try {
      const r = await fetch(`${API}/agente/cerrar-turno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fichaje_id: turno.fichaje_id,
          tracking_token: turno.tracking_token,
          latitud: last?.lat ?? null,
          longitud: last?.lng ?? null,
        }),
      });
      if (!r.ok && r.status !== 409) {
        const data = await r.json().catch(() => ({}));
        setMensajeError(data.mensaje || data.error || "No se pudo cerrar el turno");
        setEstado("error_cierre");
        return;
      }
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : "Sin conexión, intentá de nuevo");
      setEstado("error_cierre");
      return;
    }
    detenerRastreoInterno();
    localStorage.removeItem(TRACKING_KEY);
    setTurnoActivo(null);
    setPuntosCount(0);
    setUltimaPosicion(null);
    setEstado("inicio");
    if (esKiosco) void cargarPuestoDelDia();
  }, [flushPuntos, ultimaPosicion, detenerRastreoInterno, esKiosco, cargarPuestoDelDia]);

  // ── Reanudar tracking si la app se reabre con turno activo en localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRACKING_KEY);
      if (!raw) return;
      const turno = JSON.parse(raw) as TurnoActivoStorage;
      if (!turno?.fichaje_id || !turno?.tracking_token) {
        localStorage.removeItem(TRACKING_KEY);
        return;
      }
      iniciarRastreo(turno);
      setEstado("turno_activo");
    } catch {
      localStorage.removeItem(TRACKING_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup: liberar GPS y audio al desmontar ──
  useEffect(() => () => { detenerRastreoInterno(); }, [detenerRastreoInterno]);

  // ── Re-adquirir wake lock al volver a primer plano (si estaba activo) ──
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && turnoActivoRef.current && wakeLockRef.current === null) {
        // No re-adquirir automático; solo hacer flush al volver
        void flushPuntos();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [flushPuntos]);

  const enviar = useCallback(async (
    token: string, lat: number | null, lng: number | null, precision: number | null
  ) => {
    setEstado("enviando");
    try {
      const r = await fetch(`${API}/agente/iniciar-turno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: token,
          latitud: lat, longitud: lng, precision_metros: precision,
          // Modo kiosco: enviar credenciales del dispositivo
          ...(device ? { device_uuid: device.uuid, device_token: device.token } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMensajeError(data.mensaje || data.error || "Error al iniciar turno");
        setEstado("error");
        return;
      }
      setResultado(data);
      // Si es custodia y vino tracking_token → este custodio es el LÍDER del recorrido (arranca rastreo).
      if (data.tracking_token && data.servicio?.tipo === "custodia") {
        const turno: TurnoActivoStorage = {
          fichaje_id: data.fichaje_id,
          tracking_token: data.tracking_token,
          iniciado_en: data.registrado_en,
          agente_nombre: data.agente.nombre,
          cliente_nombre: data.servicio.cliente_nombre,
          titulo: data.servicio.titulo,
        };
        iniciarRastreo(turno);
        setEstado("turno_activo");
      } else if (data.anexado_a_recorrido && data.servicio?.tipo === "custodia") {
        // Co-tripulante: ya hay un líder rastreando en este teléfono. NO sobreescribir el turnoActivo.
        // Sólo mostrar mensaje de éxito (auto-reset de kiosco lo lleva a la pantalla principal).
        setEstado("ok");
      } else {
        setEstado("ok");
      }
      // Modo kiosco: refrescar lista en segundo plano
      if (esKiosco) void cargarPuestoDelDia();
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : "Error de red");
      setEstado("error");
    }
  }, [device, esKiosco, cargarPuestoDelDia, iniciarRastreo]);

  // Toggle linterna (flash) — solo Android Chrome
  const toggleLinterna = useCallback(async () => {
    try {
      const videoEl = document.querySelector(
        `#${SCANNER_ID} video`,
      ) as HTMLVideoElement | null;
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return;
      const next = !linternaOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet & { torch: boolean }],
      });
      setLinternaOn(next);
    } catch { /* noop */ }
  }, [linternaOn]);

  // Fallback: subir foto del carnet QR
  const escanearArchivo = useCallback(async (file: File) => {
    setMensajeError("");
    try {
      await detenerScanner();
      const scanner = new Html5Qrcode(SCANNER_ID);
      const decoded = await scanner.scanFile(file, false);
      try { scanner.clear(); } catch { /* noop */ }
      let token = decoded.trim();
      try {
        const u = new URL(token);
        token = u.searchParams.get("token") || u.pathname.split("/").pop() || token;
      } catch { /* token directo */ }
      setCarnetToken(token);
      solicitarGPS(token);
    } catch {
      setMensajeError("No se pudo leer el QR de la foto. Probá con más luz o más cerca.");
      setEstado("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detenerScanner]);

  const reiniciar = useCallback(async () => {
    await detenerScanner();
    setCarnetToken(null);
    setResultado(null);
    setMensajeError("");
    setEstado("inicio");
    if (esKiosco) void cargarPuestoDelDia();
  }, [detenerScanner, esKiosco, cargarPuestoDelDia]);

  // Auto-reset en modo kiosco después de un éxito o error
  useEffect(() => {
    if (!esKiosco) return;
    if (estado !== "ok" && estado !== "error" && estado !== "error_cierre") return;
    const t = setTimeout(() => { void reiniciar(); }, AUTO_RESET_MS);
    return () => clearTimeout(t);
  }, [estado, esKiosco, reiniciar]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#060e1c] border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <img src="/images/logo-isp.png" alt="ISP" className="h-9 w-9 rounded" />
        <div className="flex-1 min-w-0">
          <div className="font-bold leading-tight truncate">ISP, S.A.</div>
          {esKiosco && puestoDelDia ? (
            <div className="text-[11px] text-slate-400 truncate">
              <Smartphone className="inline w-3 h-3 mr-1" />
              {puestoDelDia.puesto.nombre}
              {puestoDelDia.puesto.cliente_nombre ? ` · ${puestoDelDia.puesto.cliente_nombre}` : ""}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">Inicio de turno</div>
          )}
        </div>
        {esKiosco && (
          <span className="text-[10px] uppercase tracking-wide bg-blue-600/20 text-blue-300 px-2 py-1 rounded border border-blue-600/40">
            Puesto
          </span>
        )}
      </header>

      <main className="flex-1 px-4 py-5 max-w-md mx-auto w-full">
        {esKiosco && errorKiosco && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-xs text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorKiosco}</span>
          </div>
        )}

        {/* Inicio */}
        {estado === "inicio" && (
          <div className="space-y-5">
            {!esKiosco && (
              <div className="text-center pt-6 space-y-4">
                <div className="mx-auto w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Iniciar tu turno</h1>
                  <p className="text-slate-400 mt-2 text-sm">
                    Escanea el QR de tu carnet para registrar el inicio de tu servicio del día.
                  </p>
                </div>
              </div>
            )}

            {esKiosco && (
              <div className="text-center pt-2 space-y-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-blue-400" />
                </div>
                <h1 className="text-xl font-bold">Escaneá tu carnet</h1>
                <p className="text-slate-400 text-xs">Acercá el QR del carnet a la cámara</p>
              </div>
            )}

            <button
              onClick={iniciarEscaneo}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <QrCode className="w-5 h-5" /> Escanear carnet
            </button>

            {esKiosco && puestoDelDia && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 text-xs text-slate-300">
                  <Users className="w-4 h-4" />
                  <span>Hoy en este puesto ({puestoDelDia.agentes.length})</span>
                  {puestoDelDia.puesto.horario && (
                    <span className="ml-auto flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      {puestoDelDia.puesto.horario}
                    </span>
                  )}
                </div>
                {puestoDelDia.agentes.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">
                    Sin agentes asignados a este puesto.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {puestoDelDia.agentes.map(a => (
                      <li key={a.employee_id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.nombre}</div>
                          {a.cargo && <div className="text-[11px] text-slate-500 truncate">{a.cargo}</div>}
                        </div>
                        {a.inicio_turno_hoy ? (
                          <div className="text-right">
                            <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                              <CheckCircle className="w-3.5 h-3.5" /> Iniciado
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(a.inicio_turno_hoy.registrado_en).toLocaleTimeString("es-GT", {
                                hour: "2-digit", minute: "2-digit", timeZone: "America/Guatemala",
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-400">Pendiente</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!esKiosco && (
              <p className="text-xs text-slate-500 text-center">
                Necesitarás permitir el uso de la cámara y el GPS.
              </p>
            )}
          </div>
        )}

        {/* Escaneando */}
        {estado === "escaneando" && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-slate-300">Apuntá la cámara al QR del carnet</p>
              <p className="text-[11px] text-slate-500 mt-1">Acercá el carnet a unos 15–20 cm con buena luz</p>
            </div>
            <div id={SCANNER_ID} className="w-full overflow-hidden rounded-lg bg-black aspect-square" />

            {/* Controles auxiliares para Android con cámara floja */}
            <div className="grid grid-cols-2 gap-2">
              {linternaSoportada ? (
                <button
                  onClick={() => void toggleLinterna()}
                  className={`py-3 rounded-lg text-sm font-medium border ${
                    linternaOn
                      ? "bg-amber-500 text-slate-900 border-amber-400"
                      : "bg-slate-800 text-slate-200 border-slate-700"
                  }`}
                >
                  {linternaOn ? "Apagar linterna" : "Encender linterna"}
                </button>
              ) : (
                <div className="py-3 rounded-lg text-xs text-slate-500 text-center border border-slate-800">
                  Sin linterna en este teléfono
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-3 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Subir foto del QR
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void escanearArchivo(f);
                e.target.value = "";
              }}
            />

            <button
              onClick={reiniciar}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg text-sm"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Esperando GPS */}
        {estado === "esperando_gps" && (
          <div className="text-center pt-12 space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-400" />
            <p className="text-slate-300">Obteniendo ubicación…</p>
          </div>
        )}

        {/* GPS denegado */}
        {estado === "gps_denegado" && (
          <div className="text-center pt-8 space-y-4">
            <ShieldAlert className="w-14 h-14 mx-auto text-amber-400" />
            <h2 className="text-xl font-bold">GPS denegado</h2>
            <p className="text-sm text-slate-300">
              Activá el GPS en los ajustes del teléfono y volvé a intentar.
            </p>
            <button
              onClick={() => carnetToken && solicitarGPS(carnetToken)}
              disabled={!carnetToken}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg disabled:opacity-50"
            >
              Reintentar GPS
            </button>
            <button
              onClick={reiniciar}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-sm"
            >
              Volver al inicio
            </button>
          </div>
        )}

        {/* Enviando */}
        {estado === "enviando" && (
          <div className="text-center pt-12 space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-400" />
            <p className="text-slate-300">Registrando inicio de turno…</p>
          </div>
        )}

        {/* Turno activo (custodia) — rastreando GPS */}
        {estado === "turno_activo" && turnoActivo && (
          <div className="space-y-4 pt-2">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Activity className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold mt-2">Turno activo</h2>
              <p className="text-xs text-emerald-400 mt-1">Rastreando recorrido GPS</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Custodio</div>
                <div className="font-semibold">{turnoActivo.agente_nombre}</div>
              </div>
              <div className="border-t border-slate-800 pt-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Servicio</div>
                <div className="font-semibold">{turnoActivo.titulo}</div>
                {turnoActivo.cliente_nombre && (
                  <div className="text-sm text-slate-300">{turnoActivo.cliente_nombre}</div>
                )}
              </div>

              {coCustodios.length > 1 && (
                <div className="border-t border-slate-800 pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Custodios en esta ruta ({coCustodios.length})
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {coCustodios.map(c => (
                      <li key={c.fichaje_id} className="text-sm text-slate-200 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${c.es_lider ? "bg-blue-400" : "bg-emerald-400"}`} />
                        {c.nombre}
                        {c.es_lider && <span className="text-[10px] text-blue-400 uppercase tracking-wide">líder</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    El GPS rastrea desde este teléfono. Al cerrar el turno, se cierra a todos.
                  </p>
                </div>
              )}
              <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 uppercase tracking-wide text-[10px]">Inicio</div>
                  <div className="text-slate-200">
                    {new Date(turnoActivo.iniciado_en).toLocaleTimeString("es-GT", {
                      hour: "2-digit", minute: "2-digit", timeZone: "America/Guatemala",
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wide text-[10px]">Puntos grabados</div>
                  <div className="text-slate-200 font-mono">{puntosCount}</div>
                </div>
                {ultimaPosicion && (
                  <div className="col-span-2">
                    <div className="text-slate-500 uppercase tracking-wide text-[10px]">Última ubicación</div>
                    <div className="text-slate-300 font-mono text-[11px]">
                      {ultimaPosicion.lat.toFixed(5)}, {ultimaPosicion.lng.toFixed(5)}
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      hace {Math.max(0, Math.round((Date.now() - new Date(ultimaPosicion.ts).getTime()) / 1000))} s
                    </div>
                  </div>
                )}
                {bateria !== null && (
                  <div className="col-span-2 flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Batería del teléfono</span>
                    <span className={bateria < 20 ? "text-rose-400 font-semibold" : "text-slate-300"}>
                      {bateria}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {trackingError && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{trackingError}</span>
              </div>
            )}

            <button
              onClick={() => void adquirirWakeLock()}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              {wakeLockRef.current ? "Pantalla bloqueada activa" : "Mantener pantalla encendida"}
            </button>

            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
              <div className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Podés bloquear el teléfono y guardarlo. El recorrido sigue grabando en segundo plano.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-400">!</span>
                <span>No cerrés esta pantalla del menú de apps recientes — eso detiene el rastreo.</span>
              </div>
            </div>

            <button
              onClick={cerrarTurno}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Cerrar turno
            </button>
          </div>
        )}

        {/* Cerrando turno */}
        {estado === "cerrando_turno" && (
          <div className="text-center pt-12 space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-rose-400" />
            <p className="text-slate-300">Cerrando turno…</p>
          </div>
        )}

        {/* OK */}
        {estado === "ok" && resultado && (
          <div className="space-y-5 pt-2">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto text-emerald-400" />
              <h2 className="text-2xl font-bold mt-3">
                {(resultado as any).anexado_a_recorrido ? "¡Anexado a la ruta!" : "¡Turno iniciado!"}
              </h2>
              {(resultado as any).anexado_a_recorrido && (resultado as any).padre_nombre && (
                <p className="text-sm text-blue-300 mt-1">
                  Acompañando a {(resultado as any).padre_nombre}
                  {(resultado as any).co_custodios && ` · ${(resultado as any).co_custodios.length} custodios en ruta`}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {new Date(resultado.registrado_en).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Agente</div>
                <div className="font-semibold">{resultado.agente.nombre}</div>
                {resultado.agente.cargo && <div className="text-xs text-slate-400">{resultado.agente.cargo}</div>}
              </div>
              <div className="border-t border-slate-800 pt-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Servicio del día</div>
                <div className="font-semibold">{resultado.servicio.titulo}</div>
                {resultado.servicio.cliente_nombre && (
                  <div className="text-sm text-slate-300">{resultado.servicio.cliente_nombre}</div>
                )}
                {(resultado.servicio.hora_entrada || resultado.servicio.horario) && (
                  <div className="text-xs text-slate-400 mt-1">
                    {resultado.servicio.horario ||
                      `${resultado.servicio.hora_entrada} – ${resultado.servicio.hora_salida ?? ""}`}
                  </div>
                )}
              </div>
              {resultado.arma && (
                <div className="border-t border-slate-800 pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Arma asignada</div>
                  <div className="font-semibold">{resultado.arma.codigo}</div>
                  <div className="text-xs text-slate-400">
                    {resultado.arma.descripcion}{resultado.arma.serie ? ` · serie ${resultado.arma.serie}` : ""}
                  </div>
                </div>
              )}
              <div className="border-t border-slate-800 pt-3 flex items-center gap-2 text-xs">
                <MapPin className="w-4 h-4 text-slate-400" />
                {resultado.resultado === "ok" && resultado.distancia_metros != null && (
                  <span className="text-emerald-400">Ubicación verificada ({resultado.distancia_metros} m)</span>
                )}
                {resultado.resultado === "ok" && resultado.distancia_metros == null && (
                  <span className="text-emerald-400">Ubicación registrada</span>
                )}
                {resultado.resultado === "sin_gps" && (
                  <span className="text-amber-400">Sin GPS — registrado igualmente</span>
                )}
              </div>
            </div>

            <button
              onClick={reiniciar}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {esKiosco ? "Listo (vuelve solo)" : "Listo"}
            </button>
            {esKiosco && (
              <p className="text-center text-[11px] text-slate-500">
                Esta pantalla volverá al inicio en {Math.round(AUTO_RESET_MS / 1000)} s.
              </p>
            )}
          </div>
        )}

        {/* Error al cerrar turno */}
        {estado === "error_cierre" && (
          <div className="space-y-5 pt-4 text-center">
            <XCircle className="w-14 h-14 mx-auto text-rose-400" />
            <div>
              <h2 className="text-xl font-bold">No se pudo cerrar el turno</h2>
              <p className="text-sm text-slate-300 mt-2 flex items-start gap-2 justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>{mensajeError || "Error desconocido"}</span>
              </p>
            </div>
            <button
              onClick={cerrarTurno}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
            >
              Volver a intentar
            </button>
            {turnoActivo && (
              <button
                onClick={() => { setMensajeError(""); setEstado("turno_activo"); }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg"
              >
                Volver al turno activo
              </button>
            )}
            {esKiosco && (
              <p className="text-center text-[11px] text-slate-500">
                Esta pantalla volverá al inicio en {Math.round(AUTO_RESET_MS / 1000)} s.
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {estado === "error" && (
          <div className="space-y-5 pt-4 text-center">
            <XCircle className="w-14 h-14 mx-auto text-rose-400" />
            <div>
              <h2 className="text-xl font-bold">No se pudo iniciar el turno</h2>
              <p className="text-sm text-slate-300 mt-2 flex items-start gap-2 justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>{mensajeError || "Error desconocido"}</span>
              </p>
            </div>
            <button
              onClick={reiniciar}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
            >
              Volver a intentar
            </button>
            {esKiosco && (
              <p className="text-center text-[11px] text-slate-500">
                Esta pantalla volverá al inicio en {Math.round(AUTO_RESET_MS / 1000)} s.
              </p>
            )}
          </div>
        )}
      </main>

      <footer className="px-4 py-3 text-center text-[11px] text-slate-600 border-t border-slate-900">
        ISP, S.A. · Investigaciones y Seguridad Profesional
      </footer>
    </div>
  );
}
