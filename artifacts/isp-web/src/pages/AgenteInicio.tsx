import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { parseQrToken, fmtHora } from "@/shared/operaciones";
import {
  CheckCircle, XCircle, Loader2, MapPin, AlertTriangle,
  QrCode, ShieldAlert, RotateCcw, Smartphone, Users, Clock,
  Navigation, LogOut, Activity, UserPlus, Plus, ArrowLeft,
} from "lucide-react";

const API = "/api";
const SCANNER_ID = "isp-agente-scanner";
const DEVICE_KEY = "isp_device";          // mismo key que SupervisorActivar
const AUTO_RESET_MS = 8000;                // tiempo de éxito antes de volver al inicio (modo kiosco)

// ── Tracking GPS de custodios ──
const TRACKING_KEY = "isp_turno_activo";   // localStorage para reanudar al reabrir
const BUFFER_KEY = "isp_turno_buffer";     // localStorage para puntos no enviados
const PING_DISTANCIA_M = 30;               // mover al menos 30m para grabar punto
const PING_TIEMPO_MAX_MS = 60_000;         // o cada 60s si no se movió (heartbeat)
const FLUSH_INTERVAL_MS = 30_000;          // intentar enviar lote cada 30s
const FLUSH_MAX_PUNTOS = 20;               // o cuando se acumulen 20 puntos
const GAP_CHECK_INTERVAL_MS = 30_000;      // chequear cada 30s si hay hueco GPS
const GAP_THRESHOLD_MS = 180_000;          // 3 min sin punto = hueco visible

interface TurnoActivoStorage {
  fichaje_id: number;
  tracking_token: string;
  iniciado_en: string;
  agente_nombre: string;
  cliente_nombre: string | null;
  titulo: string;
  tipo?: "puesto" | "custodia"; // opcional por compat con storage previo (custodia)
}

interface PuntoRonda {
  id: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  escaneado_hoy: boolean;
  ultimo_escaneo: string | null;
  ultimo_distancia_metros: number | null;
  ultimo_resultado: string | null;
}
interface RondaConProgreso {
  id: number;
  nombre: string;
  descripcion: string | null;
  total_puntos: number;
  escaneados_hoy: number;
  puntos: PuntoRonda[];
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
  | "supervisor_menu"
  | "turno_activo"
  | "cerrando_turno"
  | "error"
  | "error_cierre";

interface SupervisorIdent {
  nombre: string;
  cargo: string | null;
  rol: "supervisor" | "jefe_servicio";
  mensaje: string;
}

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
  const [supervisorIdent, setSupervisorIdent] = useState<SupervisorIdent | null>(null);
  const [carnetToken, setCarnetToken] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  // Rondas del puesto (solo cuando turno_activo && tipo === "puesto")
  const [rondas, setRondas] = useState<RondaConProgreso[] | null>(null);
  const [rondasError, setRondasError] = useState<string | null>(null);
  const [rondasCargando, setRondasCargando] = useState(false);

  // ── Multi-agente puesto fijo (kiosco): cabecera con todos los activos +
  // sub-vistas Agregar agente / Cerrar turno con doble verificación.
  // Solo se usa cuando esKiosco && turnoActivo.tipo === "puesto".
  const [agentesActivos, setAgentesActivos] = useState<Array<{
    fichaje_id: number;
    employee_id: number;
    user_id: number | null;
    nombre: string;
    cargo: string | null;
    iniciado_en: string;
  }> | null>(null);
  const [agentesActivosError, setAgentesActivosError] = useState<string | null>(null);
  const [puestoSubVista, setPuestoSubVista] = useState<
    "main" | "agregar_agente" | "cerrar_select" | "cerrar_scan" | "rondas_select" | "rondas_scan" | "visitas"
  >("main");
  // ── Visitas (sub-vista del puesto fijo) ────────────────────────────────────
  const [visitaTab, setVisitaTab] = useState<"peaton" | "vehiculo">("peaton");
  const [visitasAbiertas, setVisitasAbiertas] = useState<{
    personas: Array<{ id: number; dpi_numero: string | null; nombre_completo: string | null; a_quien_visita: string | null; entrada_at: string; tiene_foto_dpi?: boolean }>;
    vehiculos: Array<{ id: number; placa: string | null; marca_vehiculo: string | null; conductor_nombre: string | null; a_quien_visita: string | null; entrada_at: string; tiene_foto_conductor?: boolean }>;
  } | null>(null);
  const [fotoVisitaModal, setFotoVisitaModal] = useState<{ url: string; titulo: string } | null>(null);
  const [visitasLoading, setVisitasLoading] = useState(false);
  const [visitaSubmitting, setVisitaSubmitting] = useState(false);
  const [visitaOcrLoading, setVisitaOcrLoading] = useState(false);
  const [visitaForm, setVisitaForm] = useState<{
    dpi_numero: string;
    nombre_completo: string;
    placa: string;
    marca_vehiculo: string;
    color_vehiculo: string;
    a_quien_visita: string;
    motivo: string;
    dpi_frente_url: string | null;
  }>({
    dpi_numero: "", nombre_completo: "", placa: "", marca_vehiculo: "",
    color_vehiculo: "", a_quien_visita: "", motivo: "", dpi_frente_url: null,
  });
  const [cerrarTarget, setCerrarTarget] = useState<{
    fichaje_id: number; employee_id: number; nombre: string;
  } | null>(null);
  const [rondaTarget, setRondaTarget] = useState<{
    user_id: number; nombre: string;
  } | null>(null);
  const rondaGpsRef = useRef<{
    latitud: number; longitud: number; precision_metros: number | null;
  } | null>(null);
  const [accionMsg, setAccionMsg] = useState<{ kind: "ok" | "error"; texto: string } | null>(null);
  const [accionLoading, setAccionLoading] = useState(false);
  // Ref con la función a ejecutar cuando el escáner decodifique un QR.
  // Si es null, se usa el flujo default (solicitarGPS para iniciar turno).
  const onScanRef = useRef<((token: string) => void) | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gapTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufferRef = useRef<PuntoGPS[]>([]);
  const ultimoGrabadoRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const turnoActivoRef = useRef<TurnoActivoStorage | null>(null);
  const [gapAlerta, setGapAlerta] = useState<{ minutos: number } | null>(null);

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
      // Teléfono de supervisor: no es kiosco, no mostrar error.
      // El supervisor escanea su carnet y entra al supervisor_menu.
      if (data.modo === "supervisor") {
        setErrorKiosco(null);
        setPuestoDelDia(null);
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
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
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
      // No usamos useBarCodeDetectorIfSupported: en Safari iOS la API nativa
      // BarcodeDetector está rota o ausente y termina rechazando QRs impresos
      // que la cámara nativa de iOS sí decodifica sin problema. Forzamos el
      // decodificador interno (ZXing-WASM) que es más tolerante.
      const scanner = new Html5Qrcode(SCANNER_ID, {
        verbose: false,
        useBarCodeDetectorIfSupported: false,
      } as ConstructorParameters<typeof Html5Qrcode>[1]);
      scannerRef.current = scanner;
      // Handler único para ambos motores (ZXing y jsQR). El primero que
      // decodifique gana; el segundo ya no encuentra scanner activo.
      let yaDecodificado = false;
      const handleDecoded = (raw: string) => {
        if (yaDecodificado) return;
        yaDecodificado = true;
        // parseQrToken centraliza el reconocimiento del token cuando viene
        // como URL completa /agente/scan/<token>. Si no lo es, devuelve la
        // cadena ya recortada — comportamiento equivalente al try/URL anterior.
        const token = parseQrToken(raw);
        setCarnetToken(token);
        void detenerScanner();
        // Despacho: si hay un handler custom (agregar agente, cerrar verificado),
        // se usa; si no, flujo default de inicio de turno con GPS.
        const customHandler = onScanRef.current;
        if (customHandler) {
          onScanRef.current = null;
          customHandler(token);
        } else {
          solicitarGPS(token);
        }
      };
      // Html5Qrcode exige que cameraIdOrConfig tenga EXACTAMENTE 1 key
      // cuando es objeto, así que pedimos solo la cámara trasera aquí
      // y subimos resolución/zoom/focus después con applyConstraints().
      const videoConstraints = { facingMode: "environment" } as MediaTrackConstraints;
      await scanner.start(
        videoConstraints,
        {
          fps: 20,
          // Sin qrbox: escaneamos todo el frame del video (igual que la cámara
          // nativa al subir foto). Esto evita que el recuadro de detección quede
          // mal calculado cuando subimos la resolución del stream a 1080p después.
          disableFlip: false,
        } as Parameters<Html5Qrcode["start"]>[1],
        (decoded) => handleDecoded(decoded),
        () => { /* scan fail por frame */ }
      );
      // Detectar capacidades del track y aplicar mejoras opcionales
      // (linterna, zoom 2× para QR pequeños, enfoque continuo)
      try {
        const videoEl = document.querySelector(
          `#${SCANNER_ID} video`,
        ) as HTMLVideoElement | null;
        const stream = videoEl?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks?.()[0];
        const capabilities = track?.getCapabilities?.() as
          MediaTrackCapabilities & {
            torch?: boolean;
            zoom?: { min: number; max: number; step: number };
            focusMode?: string[];
            width?: { max: number };
            height?: { max: number };
          } | undefined;
        setLinternaSoportada(!!capabilities?.torch);
        // Subir resolución a 1080p (o lo más alto que soporte el track).
        // Sin esto el navegador entrega ~480p por defecto y el QR pequeño del gafete no decodifica.
        if (track) {
          const maxW = capabilities?.width?.max ?? 1920;
          const maxH = capabilities?.height?.max ?? 1080;
          try {
            await track.applyConstraints({
              width:  { ideal: Math.min(1920, maxW) },
              height: { ideal: Math.min(1080, maxH) },
            });
          } catch { /* resolución no aplicable */ }
        }
        // Zoom 3× para compensar el QR físicamente pequeño del gafete (Android Chrome lo soporta; iOS Safari lo ignora silenciosamente)
        if (track && capabilities?.zoom) {
          const target = Math.min(3, capabilities.zoom.max);
          if (target > (capabilities.zoom.min ?? 1)) {
            try { await track.applyConstraints({ advanced: [{ zoom: target } as MediaTrackConstraintSet] }); } catch { /* zoom no aplicable */ }
          }
        }
        // Enfoque continuo (mantiene foco sobre el carnet a 15-20 cm)
        if (track && capabilities?.focusMode?.includes?.("continuous")) {
          try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }); } catch { /* focus no aplicable */ }
        }
        // Motor de respaldo jsQR: cada 200 ms tomamos un snapshot del video
        // y lo decodificamos con jsQR. Es más tolerante que ZXing con QRs
        // impresos en plástico mate y reflejos. El primero que decodifique gana.
        if (videoEl) {
          if (!scanCanvasRef.current) {
            scanCanvasRef.current = document.createElement("canvas");
          }
          const canvas = scanCanvasRef.current;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            scanIntervalRef.current = setInterval(() => {
              if (yaDecodificado) return;
              const w = videoEl.videoWidth;
              const h = videoEl.videoHeight;
              if (!w || !h) return;
              if (canvas.width !== w) canvas.width = w;
              if (canvas.height !== h) canvas.height = h;
              try {
                ctx.drawImage(videoEl, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                const code = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
                if (code?.data) handleDecoded(code.data);
              } catch { /* frame ignorado */ }
            }, 200);
          }
        }
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
          localStorage.removeItem(BUFFER_KEY);
          detenerRastreoInterno();
          setTurnoActivo(null);
          setEstado("inicio");
          return;
        }
        // Reintento simple: devolver al buffer al frente
        bufferRef.current = [...lote, ...bufferRef.current];
        try { localStorage.setItem(BUFFER_KEY, JSON.stringify(bufferRef.current)); } catch { /* noop */ }
        setTrackingError("Conexión inestable, reintentando…");
      } else {
        // Éxito: limpiar buffer persistido
        try { localStorage.removeItem(BUFFER_KEY); } catch { /* noop */ }
        setTrackingError(null);
      }
    } catch {
      // Sin red — devolvemos al buffer y reintentamos en el siguiente tick
      bufferRef.current = [...lote, ...bufferRef.current];
      try { localStorage.setItem(BUFFER_KEY, JSON.stringify(bufferRef.current)); } catch { /* noop */ }
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
    if (gapTimerRef.current) {
      clearInterval(gapTimerRef.current);
      gapTimerRef.current = null;
    }
    if (wakeLockRef.current) {
      try { void wakeLockRef.current.release(); } catch { /* noop */ }
      wakeLockRef.current = null;
    }
    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch { /* noop */ }
      audioCtxRef.current = null;
    }
    setGapAlerta(null);
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

  // ── Wake Lock: mantiene la pantalla encendida automáticamente durante el turno ──
  // Si el sistema lo libera (ej. el usuario apaga la pantalla manualmente), se re-adquiere
  // al volver a primer plano vía el listener de visibilitychange.
  const adquirirWakeLock = useCallback(async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock;
      if (!wl) return false;
      const sentinel = await wl.request("screen");
      wakeLockRef.current = sentinel;
      // Cuando el sistema lo libera (cambio de app, etc.), limpiar la ref para
      // que el visibilitychange handler sepa que tiene que re-adquirirlo.
      sentinel.addEventListener("release", () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
      });
      return true;
    } catch { return false; }
  }, []);

  // ── Iniciar el rastreo continuo ──
  const iniciarRastreo = useCallback((turno: TurnoActivoStorage) => {
    setTurnoActivo(turno);
    turnoActivoRef.current = turno;
    localStorage.setItem(TRACKING_KEY, JSON.stringify(turno));
    // Restaurar puntos no enviados que quedaron de una sesión anterior (offline buffer)
    try {
      const rawBuf = localStorage.getItem(BUFFER_KEY);
      if (rawBuf) {
        const arr = JSON.parse(rawBuf) as PuntoGPS[];
        if (Array.isArray(arr) && arr.length > 0) {
          bufferRef.current = arr;
        } else {
          bufferRef.current = [];
        }
      } else {
        bufferRef.current = [];
      }
    } catch {
      bufferRef.current = [];
      try { localStorage.removeItem(BUFFER_KEY); } catch { /* noop */ }
    }
    ultimoGrabadoRef.current = null;
    setPuntosCount(bufferRef.current.length);
    setTrackingError(null);
    setCoCustodios([]);
    setGapAlerta(null);

    // Wake Lock automático: que la pantalla no se apague sola
    void adquirirWakeLock();

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

    // Detector de hueco GPS: avisa si pasaron > 3 min sin grabar punto
    // (significa que el navegador suspendió la pestaña, p.ej. teléfono bloqueado)
    gapTimerRef.current = setInterval(() => {
      const ultimo = ultimoGrabadoRef.current;
      if (!ultimo) return;
      const ms = Date.now() - ultimo.ts;
      if (ms >= GAP_THRESHOLD_MS) {
        setGapAlerta({ minutos: Math.floor(ms / 60_000) });
      } else {
        setGapAlerta(null);
      }
    }, GAP_CHECK_INTERVAL_MS);
  }, [adquirirWakeLock, arrancarAudioSilencioso, bateria, flushPuntos]);

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
    localStorage.removeItem(BUFFER_KEY);
    setTurnoActivo(null);
    setPuntosCount(0);
    setUltimaPosicion(null);
    setEstado("inicio");
    if (esKiosco) void cargarPuestoDelDia();
  }, [flushPuntos, ultimaPosicion, detenerRastreoInterno, esKiosco, cargarPuestoDelDia]);

  // ── Reanudar turno si la app se reabre con uno guardado en localStorage ──
  // Custodia → re-arranca el rastreo GPS continuo.
  // Puesto fijo → sólo restaura la pantalla activa (no hay GPS que reanudar).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRACKING_KEY);
      if (!raw) return;
      const turno = JSON.parse(raw) as TurnoActivoStorage;
      if (!turno?.fichaje_id || !turno?.tracking_token) {
        localStorage.removeItem(TRACKING_KEY);
        return;
      }
      if (turno.tipo === "puesto") {
        setTurnoActivo(turno);
        turnoActivoRef.current = turno;
        setEstado("turno_activo");
      } else {
        // Default = custodia (por compat con storage previo sin campo tipo).
        iniciarRastreo(turno);
        setEstado("turno_activo");
      }
    } catch {
      localStorage.removeItem(TRACKING_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup: liberar GPS y audio al desmontar ──
  useEffect(() => () => { detenerRastreoInterno(); }, [detenerRastreoInterno]);

  // ── Cargar rondas del puesto cuando hay turno fijo activo + auto-refresh ──
  const cargarRondas = useCallback(async () => {
    const turno = turnoActivoRef.current;
    if (!turno || turno.tipo !== "puesto") return;
    setRondasCargando(true);
    try {
      const r = await fetch(
        `${API}/agente/rondas-del-puesto/${turno.fichaje_id}` +
          `?tracking_token=${encodeURIComponent(turno.tracking_token)}`,
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setRondasError(data.error || "No se pudieron cargar las rondas");
        return;
      }
      const data = await r.json();
      setRondas(Array.isArray(data.rondas) ? data.rondas : []);
      setRondasError(null);
    } catch {
      setRondasError("Sin conexión, reintentando…");
    } finally {
      setRondasCargando(false);
    }
  }, []);

  useEffect(() => {
    if (estado !== "turno_activo" || turnoActivo?.tipo !== "puesto") return;
    void cargarRondas();
    const t = setInterval(() => { void cargarRondas(); }, 30_000);
    return () => clearInterval(t);
  }, [estado, turnoActivo?.tipo, turnoActivo?.fichaje_id, cargarRondas]);

  // Resetea la sesión local del kiosko de puesto fijo y vuelve a la pantalla
  // inicial. Lo usamos cuando el backend confirma que la sesión está cerrada
  // (HTTP 410) o cuando el operador pide salir manualmente para destrabar la
  // PWA si quedó atrapada en la pantalla del puesto sin agentes activos.
  const resetSesionKiosco = useCallback((mensaje?: { kind: "ok" | "error"; texto: string }) => {
    try { localStorage.removeItem(TRACKING_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(BUFFER_KEY); } catch { /* noop */ }
    setTurnoActivo(null);
    turnoActivoRef.current = null;
    setAgentesActivos(null);
    setAgentesActivosError(null);
    setPuestoSubVista("main");
    setCerrarTarget(null);
    setEstado("inicio");
    if (mensaje) setAccionMsg(mensaje);
    if (esKiosco) void cargarPuestoDelDia();
  }, [esKiosco, cargarPuestoDelDia]);

  // ── MULTI-AGENTE PUESTO FIJO (kiosco) ──
  // Lista de agentes con turno abierto en este puesto + acciones de gestión.
  const cargarAgentesActivos = useCallback(async () => {
    const turno = turnoActivoRef.current;
    if (!turno || turno.tipo !== "puesto") return;
    try {
      const r = await fetch(
        `${API}/agente/turnos-activos-del-puesto/${turno.fichaje_id}` +
          `?tracking_token=${encodeURIComponent(turno.tracking_token)}`,
      );
      if (!r.ok) {
        // 410 = la sesión del kiosko ya fue cerrada (forzar-cierre admin,
        // expiración, último agente cerrado por otro flujo). El frontend
        // estaba quedando atrapado mostrando "Sin agentes activos" sin
        // forma de salir. Limpiamos local y volvemos a la pantalla inicial.
        if (r.status === 410) {
          resetSesionKiosco({
            kind: "ok",
            texto: "La sesión del kiosko ya estaba cerrada. Volvé a escanear el QR del puesto para reabrir.",
          });
          return;
        }
        const data = await r.json().catch(() => ({}));
        setAgentesActivosError(data.error || "No se pudieron cargar los agentes");
        return;
      }
      const data = await r.json();
      setAgentesActivos(Array.isArray(data.agentes) ? data.agentes : []);
      setAgentesActivosError(null);
    } catch {
      setAgentesActivosError("Sin conexión, reintentando…");
    }
  }, [resetSesionKiosco]);

  // Auto-refresh cada 30s cuando estamos en main del puesto fijo
  // (la nueva botonería operativa no depende del modo kiosko).
  useEffect(() => {
    if (estado !== "turno_activo" || turnoActivo?.tipo !== "puesto") return;
    if (puestoSubVista !== "main") return;
    void cargarAgentesActivos();
    const t = setInterval(() => { void cargarAgentesActivos(); }, 30_000);
    return () => clearInterval(t);
  }, [estado, turnoActivo?.tipo, turnoActivo?.fichaje_id, puestoSubVista, cargarAgentesActivos]);

  // Iniciar escaneo en modo "agregar agente": el QR decodificado se manda a
  // /agente/iniciar-turno; si OK, refresca la lista. NO toca turnoActivo.
  const iniciarAgregarAgente = useCallback(() => {
    setAccionMsg(null);
    setPuestoSubVista("agregar_agente");
    onScanRef.current = async (token: string) => {
      setAccionLoading(true);
      try {
        const dev = leerDeviceCreds();
        const r = await fetch(`${API}/agente/iniciar-turno`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qr_token: token,
            device_uuid: dev?.uuid ?? null,
            device_token: dev?.token ?? null,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setAccionMsg({
            kind: "error",
            texto: data.mensaje || data.error || "No se pudo iniciar el turno del nuevo agente.",
          });
          setPuestoSubVista("main");
          if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
          return;
        }
        if (data.es_supervisor) {
          setAccionMsg({
            kind: "error",
            texto: `${data.agente?.nombre ?? "Esta persona"} es ${data.rol === "jefe_servicio" ? "jefe de servicio" : "supervisor"}. No fichan turno en este puesto.`,
          });
          setPuestoSubVista("main");
          if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
          return;
        }
        setAccionMsg({
          kind: "ok",
          texto: `${data.agente?.nombre ?? "Agente"} entró en servicio.`,
        });
        setPuestoSubVista("main");
        if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
        await cargarAgentesActivos();
      } catch {
        setAccionMsg({ kind: "error", texto: "Sin conexión. Intentá de nuevo." });
        setPuestoSubVista("main");
        if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
      } finally {
        setAccionLoading(false);
      }
    };
    void iniciarEscaneo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarAgentesActivos]);

  // Iniciar escaneo en modo "cerrar verificado": valida que el carnet
  // escaneado pertenezca al agente que se quiere cerrar y dispara el cierre.
  const iniciarCerrarVerificado = useCallback((target: {
    fichaje_id: number; employee_id: number; nombre: string;
  }) => {
    const turno = turnoActivoRef.current;
    if (!turno) return;
    setCerrarTarget(target);
    setAccionMsg(null);
    setPuestoSubVista("cerrar_scan");
    onScanRef.current = async (carnetToken: string) => {
      setAccionLoading(true);
      try {
        const r = await fetch(`${API}/agente/cerrar-turno-verificado`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fichaje_id_a_cerrar: target.fichaje_id,
            carnet_qr_token: carnetToken,
            sesion_fichaje_id: turno.fichaje_id,
            tracking_token_sesion: turno.tracking_token,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setAccionMsg({
            kind: "error",
            texto: data.mensaje || data.error || "No se pudo cerrar el turno.",
          });
          setPuestoSubVista("main");
          setCerrarTarget(null);
          if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
          return;
        }
        // Si el cerrado era la sesión del kiosco y el backend rotó al siguiente
        // agente como nuevo líder, actualizamos el storage y el state local.
        if (data.nueva_sesion) {
          const turnoActual = turnoActivoRef.current;
          if (turnoActual) {
            const nuevo: TurnoActivoStorage = {
              ...turnoActual,
              fichaje_id: data.nueva_sesion.fichaje_id,
              tracking_token: data.nueva_sesion.tracking_token,
              agente_nombre: data.nueva_sesion.agente_nombre,
            };
            try { localStorage.setItem(TRACKING_KEY, JSON.stringify(nuevo)); } catch { /* noop */ }
            setTurnoActivo(nuevo);
            turnoActivoRef.current = nuevo;
          }
        } else if (target.fichaje_id === turno.fichaje_id) {
          // Cerró la sesión y NO hay siguiente: el kiosco vuelve al estado
          // inicial (no quedan agentes activos en el puesto).
          try { localStorage.removeItem(TRACKING_KEY); } catch { /* noop */ }
          try { localStorage.removeItem(BUFFER_KEY); } catch { /* noop */ }
          setTurnoActivo(null);
          turnoActivoRef.current = null;
          setEstado("inicio");
          setAgentesActivos(null);
          setPuestoSubVista("main");
          setCerrarTarget(null);
          setAccionMsg({ kind: "ok", texto: `${target.nombre} cerró su turno. Sin agentes activos.` });
          return;
        }
        setAccionMsg({ kind: "ok", texto: `${target.nombre} cerró su turno.` });
        setPuestoSubVista("main");
        setCerrarTarget(null);
        await cargarAgentesActivos();
      } catch {
        setAccionMsg({ kind: "error", texto: "Sin conexión. Intentá de nuevo." });
        setPuestoSubVista("main");
        setCerrarTarget(null);
      } finally {
        setAccionLoading(false);
      }
    };
    void iniciarEscaneo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarAgentesActivos]);

  // Iniciar marcaje de ronda en nombre de un agente activo del puesto.
  // Sub-vista: rondas_scan. Pre-cachea GPS para enviarlo en el evento.
  const iniciarMarcarRonda = useCallback((target: {
    user_id: number; nombre: string;
  }) => {
    setAccionMsg(null);
    setRondaTarget(target);
    setPuestoSubVista("rondas_scan");
    rondaGpsRef.current = null;
    // Pre-cargar GPS sin bloquear; si tarda, el scan se enviará sin GPS
    // (resultado="sin_gps").
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          rondaGpsRef.current = {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            precision_metros: pos.coords.accuracy ?? null,
          };
        },
        () => { /* sin GPS */ },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    }
    onScanRef.current = async (token: string) => {
      const turno = turnoActivoRef.current;
      if (!turno) return;
      setAccionLoading(true);
      try {
        const r = await fetch(`${API}/agente/marcar-ronda-puesto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fichaje_id_sesion: turno.fichaje_id,
            tracking_token_sesion: turno.tracking_token,
            agente_user_id: target.user_id,
            qr_token: token,
            latitud: rondaGpsRef.current?.latitud ?? null,
            longitud: rondaGpsRef.current?.longitud ?? null,
            precision_metros: rondaGpsRef.current?.precision_metros ?? null,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setAccionMsg({
            kind: "error",
            texto: data.error === "qr_no_valido" ? "QR no válido para una ronda."
                  : data.error === "punto_inactivo" ? "Este punto de control está inactivo."
                  : data.error === "agente_no_activo_en_puesto" ? "El agente seleccionado ya no está en servicio."
                  : data.mensaje || data.error || "No se pudo marcar la ronda.",
          });
          setRondaTarget(null);
          setPuestoSubVista("main");
          if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
          return;
        }
        const distancia = data.distancia_metros != null ? ` (${data.distancia_metros} m)` : "";
        const sufijo = data.resultado === "ok" ? "✓"
                     : data.resultado === "fuera_de_rango" ? `⚠ fuera de rango${distancia}`
                     : "sin GPS";
        setAccionMsg({
          kind: data.resultado === "ok" ? "ok" : "error",
          texto: `${target.nombre.split(" ")[0]} marcó "${data.nombre_punto}" — ${sufijo}`,
        });
        setRondaTarget(null);
        setPuestoSubVista("main");
        if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
        // Refrescar progreso de rondas
        void cargarRondas();
      } catch {
        setAccionMsg({ kind: "error", texto: "Sin conexión. Intentá de nuevo." });
        setRondaTarget(null);
        setPuestoSubVista("main");
        if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
      } finally {
        setAccionLoading(false);
      }
    };
    void iniciarEscaneo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelarSubVista = useCallback(() => {
    onScanRef.current = null;
    void detenerScanner();
    setCerrarTarget(null);
    setRondaTarget(null);
    setPuestoSubVista("main");
    // Restaurar el estado al panel del turno activo (el escáner había
    // forzado estado="escaneando").
    if (turnoActivoRef.current?.tipo === "puesto") setEstado("turno_activo");
  }, [detenerScanner]);

  // ── Visitas: cargar abiertas, OCR/foto, registrar entrada/salida ──────────
  const cargarVisitasAbiertas = useCallback(async () => {
    const turno = turnoActivoRef.current;
    if (!turno?.fichaje_id || !turno?.tracking_token) return;
    setVisitasLoading(true);
    try {
      const r = await fetch(
        `${API}/agente/visitas-puesto/abiertas/${turno.fichaje_id}` +
          `?tracking_token=${encodeURIComponent(turno.tracking_token)}`,
      );
      if (r.ok) {
        const d = await r.json();
        setVisitasAbiertas({ personas: d.personas ?? [], vehiculos: d.vehiculos ?? [] });
      }
    } catch (err) {
      console.error("cargarVisitasAbiertas", err);
    } finally {
      setVisitasLoading(false);
    }
  }, []);

  const abrirVisitas = useCallback(() => {
    setAccionMsg(null);
    setVisitaTab("peaton");
    setVisitaForm({
      dpi_numero: "", nombre_completo: "", placa: "", marca_vehiculo: "",
      color_vehiculo: "", a_quien_visita: "", motivo: "", dpi_frente_url: null,
    });
    setPuestoSubVista("visitas");
    void cargarVisitasAbiertas();
  }, [cargarVisitasAbiertas]);

  // Sube foto del DPI y luego corre OCR para autocompletar nombre/dpi.
  const tomarFotoYExtraerDpi = useCallback(async (file: File) => {
    const turno = turnoActivoRef.current;
    if (!turno?.fichaje_id || !turno?.tracking_token) return;
    setVisitaOcrLoading(true);
    try {
      // 1) Convertir a data URL base64
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsDataURL(file);
      });
      // 2) Subir a object storage
      const upRes = await fetch(`${API}/agente/visitas-puesto/foto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fichaje_id_sesion: turno.fichaje_id,
          tracking_token_sesion: turno.tracking_token,
          imagen: dataUrl,
        }),
      });
      if (!upRes.ok) {
        const e = await upRes.json().catch(() => ({}));
        setAccionMsg({ kind: "error", texto: e.error ?? "No se pudo subir la foto" });
        return;
      }
      const upData = await upRes.json();
      setVisitaForm((f) => ({ ...f, dpi_frente_url: upData.url }));
      // 3) Correr OCR (no bloqueante para guardar la foto)
      const ocrRes = await fetch(`${API}/agente/visitas-puesto/extraer-dpi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fichaje_id_sesion: turno.fichaje_id,
          tracking_token_sesion: turno.tracking_token,
          imagen: dataUrl,
        }),
      });
      if (ocrRes.ok) {
        const d = await ocrRes.json();
        const datos = d.datos ?? {};
        setVisitaForm((f) => ({
          ...f,
          dpi_numero: datos.dpi || f.dpi_numero,
          nombre_completo: datos.nombre_completo || f.nombre_completo,
        }));
      }
    } catch (err) {
      console.error("tomarFotoYExtraerDpi", err);
      setAccionMsg({ kind: "error", texto: "Error procesando la foto" });
    } finally {
      setVisitaOcrLoading(false);
    }
  }, []);

  const registrarEntradaVisita = useCallback(async () => {
    const turno = turnoActivoRef.current;
    if (!turno?.fichaje_id || !turno?.tracking_token) return;
    if (visitaTab === "peaton" && !visitaForm.dpi_numero.trim()) {
      setAccionMsg({ kind: "error", texto: "DPI es requerido" });
      return;
    }
    if (visitaTab === "vehiculo" && !visitaForm.placa.trim()) {
      setAccionMsg({ kind: "error", texto: "Placa es requerida" });
      return;
    }
    setVisitaSubmitting(true);
    try {
      const body = visitaTab === "peaton"
        ? {
            fichaje_id_sesion: turno.fichaje_id,
            tracking_token_sesion: turno.tracking_token,
            tipo: "persona",
            dpi_numero: visitaForm.dpi_numero.trim(),
            nombre_completo: visitaForm.nombre_completo.trim() || null,
            dpi_frente_url: visitaForm.dpi_frente_url,
            a_quien_visita: visitaForm.a_quien_visita.trim() || null,
            motivo: visitaForm.motivo.trim() || null,
          }
        : {
            fichaje_id_sesion: turno.fichaje_id,
            tracking_token_sesion: turno.tracking_token,
            tipo: "vehiculo",
            placa: visitaForm.placa.trim(),
            marca_vehiculo: visitaForm.marca_vehiculo.trim() || null,
            color_vehiculo: visitaForm.color_vehiculo.trim() || null,
            conductor_dpi_numero: visitaForm.dpi_numero.trim() || null,
            conductor_nombre: visitaForm.nombre_completo.trim() || null,
            conductor_dpi_frente_url: visitaForm.dpi_frente_url,
            a_quien_visita: visitaForm.a_quien_visita.trim() || null,
            motivo: visitaForm.motivo.trim() || null,
          };
      const r = await fetch(`${API}/agente/visitas-puesto/entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setAccionMsg({ kind: "error", texto: e.error ?? "No se pudo registrar la entrada" });
        return;
      }
      setAccionMsg({ kind: "ok", texto: "Entrada registrada" });
      setVisitaForm({
        dpi_numero: "", nombre_completo: "", placa: "", marca_vehiculo: "",
        color_vehiculo: "", a_quien_visita: "", motivo: "", dpi_frente_url: null,
      });
      await cargarVisitasAbiertas();
    } catch (err) {
      console.error("registrarEntradaVisita", err);
      setAccionMsg({ kind: "error", texto: "Error de red" });
    } finally {
      setVisitaSubmitting(false);
    }
  }, [visitaTab, visitaForm, cargarVisitasAbiertas]);

  const marcarSalidaVisita = useCallback(async (visita_id: number) => {
    const turno = turnoActivoRef.current;
    if (!turno?.fichaje_id || !turno?.tracking_token) return;
    if (!confirm("¿Marcar salida?")) return;
    setVisitaSubmitting(true);
    try {
      const r = await fetch(`${API}/agente/visitas-puesto/salida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fichaje_id_sesion: turno.fichaje_id,
          tracking_token_sesion: turno.tracking_token,
          visita_id,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setAccionMsg({ kind: "error", texto: e.error ?? "No se pudo marcar salida" });
        return;
      }
      setAccionMsg({ kind: "ok", texto: "Salida registrada" });
      await cargarVisitasAbiertas();
    } catch (err) {
      console.error("marcarSalidaVisita", err);
    } finally {
      setVisitaSubmitting(false);
    }
  }, [cargarVisitasAbiertas]);

  // ── Al volver a primer plano: re-adquirir wake lock + flush + recheck gap ──
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!turnoActivoRef.current) return;
      // Re-adquirir wake lock automático (el sistema lo libera al perder foco)
      if (wakeLockRef.current === null) void adquirirWakeLock();
      // Mandar lo que haya en buffer apenas vuelva la conexión
      void flushPuntos();
      // Forzar re-evaluación del gap inmediatamente (sin esperar al timer)
      const ultimo = ultimoGrabadoRef.current;
      if (ultimo) {
        const ms = Date.now() - ultimo.ts;
        if (ms >= GAP_THRESHOLD_MS) {
          setGapAlerta({ minutos: Math.floor(ms / 60_000) });
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [adquirirWakeLock, flushPuntos]);

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
      // Supervisor / jefe de servicio sin puesto/custodia: no es turno operativo,
      // mostramos su menú propio para que vaya a la agenda de supervisión.
      if (data.es_supervisor) {
        // Guardamos su qr_token en sessionStorage para que /agente/supervision
        // no le pida re-escanearlo al abrir su agenda.
        // Persistimos en localStorage para que el qr_token sobreviva cold
        // start / OS killing de la pestaña, y dejamos un flag volátil
        // "fresh" en sessionStorage para que /agente/supervision sepa que
        // este qr acaba de escanearse y puede hacer clock-in automático.
        try { localStorage.setItem("isp_supervisor_qr", token); } catch { /* noop */ }
        try { sessionStorage.setItem("isp_supervisor_qr_fresh", "1"); } catch { /* noop */ }
        setSupervisorIdent({
          nombre: data.agente?.nombre ?? "Supervisor",
          cargo: data.agente?.cargo ?? null,
          rol: (data.rol === "jefe_servicio" ? "jefe_servicio" : "supervisor"),
          mensaje: data.mensaje || "Sos personal de supervisión.",
        });
        setEstado("supervisor_menu");
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
          tipo: "custodia",
        };
        iniciarRastreo(turno);
        setEstado("turno_activo");
      } else if (data.anexado_a_recorrido && data.servicio?.tipo === "custodia") {
        // Co-tripulante: ya hay un líder rastreando en este teléfono. NO sobreescribir el turnoActivo.
        // Sólo mostrar mensaje de éxito (auto-reset de kiosco lo lleva a la pantalla principal).
        setEstado("ok");
      } else if (data.tracking_token && data.servicio?.tipo === "puesto") {
        // Puesto fijo: NO hay rastreo GPS. Sólo guardar el turno y mostrar la
        // pantalla con rondas y opciones del puesto.
        const turno: TurnoActivoStorage = {
          fichaje_id: data.fichaje_id,
          tracking_token: data.tracking_token,
          iniciado_en: data.registrado_en,
          agente_nombre: data.agente.nombre,
          cliente_nombre: data.servicio.cliente_nombre,
          titulo: data.servicio.titulo,
          tipo: "puesto",
        };
        setTurnoActivo(turno);
        turnoActivoRef.current = turno;
        try { localStorage.setItem(TRACKING_KEY, JSON.stringify(turno)); } catch { /* noop */ }
        setEstado("turno_activo");
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
    setSupervisorIdent(null);
    setMensajeError("");
    setEstado("inicio");
    if (esKiosco) void cargarPuestoDelDia();
  }, [detenerScanner, esKiosco, cargarPuestoDelDia]);

  // Auto-reset en modo kiosco después de un éxito, error o pantalla informativa
  // de supervisor (la pantalla anuncia "vuelve solo en N s", así que el effect debe
  // cubrir ese estado también para no quedar colgada).
  useEffect(() => {
    if (!esKiosco) return;
    if (
      estado !== "ok" &&
      estado !== "error" &&
      estado !== "error_cierre" &&
      estado !== "supervisor_menu"
    ) return;
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

            {esKiosco && puestoDelDia?.puesto?.id && (
              <button
                onClick={() => { window.location.href = "/agente/visitas"; }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition"
              >
                <Users className="w-5 h-5" /> Visitas (entradas / salidas)
              </button>
            )}

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
                              {fmtHora(a.inicio_turno_hoy.registrado_en)}
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
              {puestoSubVista === "agregar_agente" ? (
                <>
                  <p className="text-sm text-emerald-300 font-semibold">Agregar agente al puesto</p>
                  <p className="text-[11px] text-slate-400 mt-1">Pasá el carnet del nuevo agente</p>
                </>
              ) : puestoSubVista === "cerrar_scan" && cerrarTarget ? (
                <>
                  <p className="text-sm text-rose-300 font-semibold">Cerrar turno de {cerrarTarget.nombre}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Para confirmar, {cerrarTarget.nombre.split(" ")[0]} debe pasar su propio carnet</p>
                </>
              ) : puestoSubVista === "rondas_scan" && rondaTarget ? (
                <>
                  <p className="text-sm text-blue-300 font-semibold">Ronda — {rondaTarget.nombre}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Escaneá el QR del punto de control</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300">Apuntá la cámara al QR del carnet</p>
                  <p className="text-[11px] text-slate-500 mt-1">Acercá el carnet a unos 15–20 cm con buena luz</p>
                </>
              )}
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
              onClick={() => {
                if (puestoSubVista !== "main") cancelarSubVista();
                else void reiniciar();
              }}
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
        {estado === "turno_activo" && turnoActivo && turnoActivo.tipo !== "puesto" && (
          <div className="space-y-4 pt-2">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Activity className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold mt-2">Turno activo</h2>
              <p className="text-xs text-emerald-400 mt-1">Rastreando recorrido GPS</p>
            </div>

            {esKiosco && (
              <button
                onClick={() => setEstado("inicio")}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 border-2 border-blue-400/40"
              >
                <UserPlus className="w-6 h-6" />
                Marcar otro agente
              </button>
            )}

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
                    {fmtHora(turnoActivo.iniciado_en)}
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

            {gapAlerta && (
              <div className="bg-rose-500/15 border-2 border-rose-500/50 rounded-lg p-3 text-sm text-rose-100 flex gap-2 animate-pulse">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Hueco en el recorrido detectado</div>
                  <div className="text-xs mt-0.5 text-rose-200/90">
                    No se grabaron puntos en los últimos {gapAlerta.minutos} min. El teléfono o la app
                    estuvieron suspendidos. Manténgalo desbloqueado y con esta pantalla al frente.
                  </div>
                </div>
              </div>
            )}

            {trackingError && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{trackingError}</span>
              </div>
            )}

            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-lg p-3 text-xs text-amber-100 space-y-2">
              <div className="font-semibold text-amber-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                IMPORTANTE — para que el recorrido se grabe completo
              </div>
              <div className="flex gap-2">
                <span className="text-rose-400">✗</span>
                <span><b>NO bloquees</b> el teléfono apretando el botón de power.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-rose-400">✗</span>
                <span><b>NO cambies</b> a otra app (WhatsApp, cámara, etc).</span>
              </div>
              <div className="flex gap-2">
                <span className="text-rose-400">✗</span>
                <span><b>NO cerrés</b> esta pestaña del menú de apps recientes.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Dejá esta pantalla siempre al frente y guardá el teléfono así.</span>
              </div>
              <div className="flex gap-2 text-[10px] text-amber-300/70 pt-1 border-t border-amber-500/20">
                <Navigation className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>
                  La pantalla está configurada para no apagarse sola.
                  {wakeLockRef.current === null && " Tocá la pantalla cada cierto tiempo para reactivarla."}
                </span>
              </div>
            </div>

            {esKiosco && (
              <button
                onClick={() => setEstado("inicio")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Marcar otro agente
              </button>
            )}

            <button
              onClick={cerrarTurno}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Cerrar turno
            </button>
            {esKiosco && (
              <p className="text-center text-[11px] text-slate-500">
                "Cerrar turno" finaliza a todos los custodios anexados a esta ruta.
              </p>
            )}
          </div>
        )}

        {/* Turno activo (puesto fijo) — sin GPS, con rondas y opciones del puesto */}
        {estado === "turno_activo" && turnoActivo && turnoActivo.tipo === "puesto" && (
          <div className="space-y-4 pt-2">
            {/* Cabecera "En servicio" */}
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold mt-3 text-emerald-300">En servicio</h2>
              <p className="text-xs text-slate-400 mt-1">
                Desde {fmtHora(turnoActivo.iniciado_en)}
              </p>
            </div>

            {/* Info del puesto */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Puesto</div>
              <div className="font-semibold">{turnoActivo.titulo}</div>
              {turnoActivo.cliente_nombre && (
                <div className="text-sm text-slate-300">{turnoActivo.cliente_nombre}</div>
              )}
            </div>

            {/* Banner de mensajes de acción (ok/error) */}
            {accionMsg && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                accionMsg.kind === "ok"
                  ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-200"
                  : "bg-rose-500/15 border border-rose-500/40 text-rose-200"
              }`}>
                {accionMsg.kind === "ok"
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">{accionMsg.texto}</div>
                <button
                  onClick={() => setAccionMsg(null)}
                  className="text-xs opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Botonería operativa multi-agente (visible en cualquier turno de puesto fijo;
                las acciones se autorizan por carnet QR + tracking_token, no por modo kiosco). */}
            <>
                {/* MAIN: lista de agentes activos + botonería 2x2 */}
                {puestoSubVista === "main" && (
                  <>
                    {/* Lista de agentes activos en este puesto */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-400" />
                          <span className="font-semibold text-sm">Agentes en servicio</span>
                          {agentesActivos && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                              {agentesActivos.length}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => void cargarAgentesActivos()}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Actualizar
                        </button>
                      </div>

                      {agentesActivosError && (
                        <div className="text-xs text-amber-400 flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3" />
                          {agentesActivosError}
                        </div>
                      )}

                      {agentesActivos === null && !agentesActivosError && (
                        <div className="text-center text-xs text-slate-500 py-3">
                          <Loader2 className="w-4 h-4 mx-auto animate-spin mb-1" />
                          Cargando…
                        </div>
                      )}

                      {agentesActivos && agentesActivos.length === 0 && (
                        <div className="text-xs text-slate-400 text-center py-2">
                          Sin agentes activos.
                        </div>
                      )}

                      {agentesActivos && agentesActivos.length > 0 && (
                        <div className="space-y-2">
                          {agentesActivos.map((a) => (
                            <div key={a.fichaje_id} className="flex items-center justify-between border border-slate-800 rounded-lg px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">{a.nombre}</div>
                                {a.cargo && (
                                  <div className="text-[11px] text-slate-400 truncate">{a.cargo}</div>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 flex-shrink-0">
                                <Clock className="w-3 h-3" />
                                {fmtHora(a.iniciado_en)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Botonería principal 2x2 */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={iniciarAgregarAgente}
                        disabled={accionLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg flex flex-col items-center justify-center gap-1"
                      >
                        <Plus className="w-6 h-6" />
                        <span className="text-sm">Agregar agente</span>
                      </button>
                      <button
                        onClick={() => {
                          setAccionMsg(null);
                          setPuestoSubVista("cerrar_select");
                        }}
                        disabled={accionLoading || !agentesActivos || agentesActivos.length === 0}
                        className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg flex flex-col items-center justify-center gap-1"
                      >
                        <LogOut className="w-6 h-6" />
                        <span className="text-sm">Terminar turno</span>
                      </button>
                      <button
                        onClick={() => {
                          setAccionMsg(null);
                          setPuestoSubVista("rondas_select");
                        }}
                        disabled={accionLoading || !agentesActivos || agentesActivos.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg flex flex-col items-center justify-center gap-1"
                      >
                        <Navigation className="w-6 h-6" />
                        <span className="text-sm">Rondas</span>
                      </button>
                      <button
                        onClick={abrirVisitas}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 rounded-lg flex flex-col items-center justify-center gap-1"
                      >
                        <UserPlus className="w-6 h-6" />
                        <span className="text-sm">Visitas</span>
                      </button>
                    </div>

                    {/* Salida manual del kiosko: red de seguridad para cuando
                        la pantalla queda atrapada (último agente cerrado por
                        otro flujo, sesión zombie, etc.). NO cierra ningún
                        turno — solo libera la sesión local y vuelve al inicio
                        para volver a escanear el QR del puesto. */}
                    <button
                      onClick={() => {
                        if (agentesActivos && agentesActivos.length > 0) {
                          if (!window.confirm("Hay agentes en servicio en este puesto. ¿Salir igual del kiosko sin cerrar sus turnos?")) return;
                        }
                        resetSesionKiosco({
                          kind: "ok",
                          texto: "Sesión del kiosko cerrada. Volvé a escanear el QR del puesto cuando lo necesites.",
                        });
                      }}
                      disabled={accionLoading}
                      className="w-full mt-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-300 text-sm py-2.5 rounded-lg flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Volver al inicio
                    </button>
                  </>
                )}

                {/* SUB-VISTA: cerrar_select — selector de qué agente cierra turno */}
                {puestoSubVista === "cerrar_select" && (
                  <div className="space-y-3">
                    <button
                      onClick={cancelarSubVista}
                      className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" /> Volver
                    </button>
                    <div>
                      <h3 className="font-bold text-lg">¿Quién termina turno?</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Para confirmar, el agente seleccionado deberá pasar su propio carnet.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(agentesActivos ?? []).map((a) => (
                        <button
                          key={a.fichaje_id}
                          onClick={() => iniciarCerrarVerificado({
                            fichaje_id: a.fichaje_id,
                            employee_id: a.employee_id,
                            nombre: a.nombre,
                          })}
                          className="w-full bg-slate-900 border border-slate-700 hover:border-rose-500 rounded-lg p-3 text-left flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{a.nombre}</div>
                            {a.cargo && (
                              <div className="text-xs text-slate-400 truncate">{a.cargo}</div>
                            )}
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Desde {fmtHora(a.iniciado_en)}
                            </div>
                          </div>
                          <LogOut className="w-5 h-5 text-rose-400 flex-shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUB-VISTA: rondas_select — qué agente marca el punto */}
                {puestoSubVista === "rondas_select" && (
                  <div className="space-y-3">
                    <button
                      onClick={cancelarSubVista}
                      className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" /> Volver
                    </button>
                    <div>
                      <h3 className="font-bold text-lg">¿Quién marca la ronda?</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Después escaneá el QR del punto de control.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(agentesActivos ?? []).map((a) => {
                        const sinUsuario = !a.user_id;
                        return (
                          <button
                            key={a.fichaje_id}
                            disabled={sinUsuario}
                            onClick={() => {
                              if (a.user_id) iniciarMarcarRonda({ user_id: a.user_id, nombre: a.nombre });
                            }}
                            className="w-full bg-slate-900 border border-slate-700 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-3 text-left flex items-center justify-between"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{a.nombre}</div>
                              {a.cargo && (
                                <div className="text-xs text-slate-400 truncate">{a.cargo}</div>
                              )}
                              {sinUsuario && (
                                <div className="text-[11px] text-amber-400 mt-0.5">
                                  Sin usuario web — no puede marcar rondas
                                </div>
                              )}
                            </div>
                            <Navigation className="w-5 h-5 text-blue-400 flex-shrink-0 ml-2" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SUB-VISTA: visitas — registro de entradas/salidas peatón/vehículo */}
                {puestoSubVista === "visitas" && (
                  <div className="space-y-3">
                    <button
                      onClick={cancelarSubVista}
                      className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" /> Volver
                    </button>

                    {/* Tabs Peatón / Vehículo */}
                    <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1">
                      <button
                        onClick={() => setVisitaTab("peaton")}
                        className={`flex-1 py-2 rounded text-sm font-medium ${
                          visitaTab === "peaton" ? "bg-amber-600 text-white" : "text-slate-400"
                        }`}
                      >
                        Peatón
                      </button>
                      <button
                        onClick={() => setVisitaTab("vehiculo")}
                        className={`flex-1 py-2 rounded text-sm font-medium ${
                          visitaTab === "vehiculo" ? "bg-amber-600 text-white" : "text-slate-400"
                        }`}
                      >
                        Vehículo
                      </button>
                    </div>

                    {/* Form de nueva entrada */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3">
                      <h3 className="font-bold text-sm">Nueva entrada</h3>

                      {/* Captura foto DPI (común a peatón y conductor del vehículo) */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Foto del DPI {visitaTab === "vehiculo" ? "(conductor)" : ""}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          disabled={visitaOcrLoading || visitaSubmitting}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void tomarFotoYExtraerDpi(f);
                            e.target.value = "";
                          }}
                          className="block w-full text-xs text-slate-300 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:bg-slate-700 file:text-white file:text-xs"
                        />
                        {visitaOcrLoading && (
                          <div className="text-xs text-amber-400 mt-1">Procesando foto…</div>
                        )}
                        {visitaForm.dpi_frente_url && !visitaOcrLoading && (
                          <div className="text-xs text-emerald-400 mt-1">✓ Foto guardada</div>
                        )}
                      </div>

                      {visitaTab === "vehiculo" && (
                        <>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Placa *</label>
                            <input
                              type="text"
                              value={visitaForm.placa}
                              onChange={(e) => setVisitaForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))}
                              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm uppercase"
                              placeholder="P000ABC"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Marca</label>
                              <input
                                type="text"
                                value={visitaForm.marca_vehiculo}
                                onChange={(e) => setVisitaForm((f) => ({ ...f, marca_vehiculo: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Color</label>
                              <input
                                type="text"
                                value={visitaForm.color_vehiculo}
                                onChange={(e) => setVisitaForm((f) => ({ ...f, color_vehiculo: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          DPI {visitaTab === "peaton" ? "*" : "(conductor)"}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={visitaForm.dpi_numero}
                          onChange={(e) => setVisitaForm((f) => ({ ...f, dpi_numero: e.target.value.replace(/\D/g, "") }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                          placeholder="13 dígitos"
                          maxLength={13}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Nombre {visitaTab === "peaton" ? "*" : "(conductor)"}
                        </label>
                        <input
                          type="text"
                          value={visitaForm.nombre_completo}
                          onChange={(e) => setVisitaForm((f) => ({ ...f, nombre_completo: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">A quién visita</label>
                        <input
                          type="text"
                          value={visitaForm.a_quien_visita}
                          onChange={(e) => setVisitaForm((f) => ({ ...f, a_quien_visita: e.target.value }))}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => void registrarEntradaVisita()}
                        disabled={visitaSubmitting || visitaOcrLoading}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg"
                      >
                        {visitaSubmitting ? "Registrando…" : "Registrar entrada"}
                      </button>
                    </div>

                    {/* Lista de visitas abiertas */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm">Adentro ahora</h3>
                        <button
                          onClick={() => void cargarVisitasAbiertas()}
                          disabled={visitasLoading}
                          className="text-xs text-slate-400 hover:text-slate-200"
                        >
                          {visitasLoading ? "…" : "↻"}
                        </button>
                      </div>
                      {!visitasAbiertas || (visitasAbiertas.personas.length === 0 && visitasAbiertas.vehiculos.length === 0) ? (
                        <div className="text-xs text-slate-500">No hay visitas abiertas.</div>
                      ) : (
                        <div className="space-y-2">
                          {visitasAbiertas.personas.map((p) => {
                            const fotoUrl = p.tiene_foto_dpi && turnoActivo?.fichaje_id && turnoActivo?.tracking_token
                              ? `${API}/agente/visitas-puesto/foto/${p.id}?fichaje_id=${turnoActivo.fichaje_id}&tracking_token=${encodeURIComponent(turnoActivo.tracking_token)}&cual=dpi`
                              : null;
                            return (
                              <div key={`p-${p.id}`} className="bg-slate-800 rounded p-2 flex items-center gap-2">
                                {fotoUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setFotoVisitaModal({ url: fotoUrl, titulo: `DPI · ${p.nombre_completo ?? p.dpi_numero ?? "Persona"}` })}
                                    className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-slate-700 border border-slate-600 hover:border-amber-500 transition"
                                    aria-label="Ver foto del DPI"
                                  >
                                    <img src={fotoUrl} alt="DPI" className="w-full h-full object-cover" />
                                  </button>
                                ) : (
                                  <div className="flex-shrink-0 w-12 h-12 rounded bg-slate-700 border border-slate-600 flex items-center justify-center text-[9px] text-slate-500 text-center leading-tight">
                                    Sin<br/>foto
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold truncate">
                                    {p.nombre_completo ?? p.dpi_numero ?? "Persona"}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {p.dpi_numero && <span>DPI {p.dpi_numero}</span>}
                                    {p.a_quien_visita && <span> · visita {p.a_quien_visita}</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Entró {fmtHora(p.entrada_at)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => void marcarSalidaVisita(p.id)}
                                  disabled={visitaSubmitting}
                                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded"
                                >
                                  Salida
                                </button>
                              </div>
                            );
                          })}
                          {visitasAbiertas.vehiculos.map((v) => {
                            const fotoUrl = v.tiene_foto_conductor && turnoActivo?.fichaje_id && turnoActivo?.tracking_token
                              ? `${API}/agente/visitas-puesto/foto/${v.id}?fichaje_id=${turnoActivo.fichaje_id}&tracking_token=${encodeURIComponent(turnoActivo.tracking_token)}&cual=conductor`
                              : null;
                            return (
                              <div key={`v-${v.id}`} className="bg-slate-800 rounded p-2 flex items-center gap-2">
                                {fotoUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setFotoVisitaModal({ url: fotoUrl, titulo: `DPI conductor · ${v.placa ?? "Vehículo"}` })}
                                    className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-slate-700 border border-slate-600 hover:border-amber-500 transition"
                                    aria-label="Ver foto del DPI del conductor"
                                  >
                                    <img src={fotoUrl} alt="DPI conductor" className="w-full h-full object-cover" />
                                  </button>
                                ) : (
                                  <div className="flex-shrink-0 w-12 h-12 rounded bg-slate-700 border border-slate-600 flex items-center justify-center text-[9px] text-slate-500 text-center leading-tight">
                                    Sin<br/>foto
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold truncate">
                                    {v.placa} {v.marca_vehiculo && `· ${v.marca_vehiculo}`}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {v.conductor_nombre && <span>{v.conductor_nombre}</span>}
                                    {v.a_quien_visita && <span> · visita {v.a_quien_visita}</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Entró {fmtHora(v.entrada_at)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => void marcarSalidaVisita(v.id)}
                                  disabled={visitaSubmitting}
                                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded"
                                >
                                  Salida
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>

            {/* Rondas con progreso del día (visible en MAIN para ambos modos) */}
            {puestoSubVista === "main" && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-sm">Rondas del puesto</span>
                  </div>
                  <button
                    onClick={() => void cargarRondas()}
                    disabled={rondasCargando}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    {rondasCargando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Actualizar
                  </button>
                </div>

                {rondasError && (
                  <div className="text-xs text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    {rondasError}
                  </div>
                )}

                {rondas === null && !rondasError && (
                  <div className="text-center text-xs text-slate-500 py-4">
                    <Loader2 className="w-4 h-4 mx-auto animate-spin mb-1" />
                    Cargando rondas…
                  </div>
                )}

                {rondas !== null && rondas.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-3">
                    No hay rondas configuradas para este puesto.
                  </div>
                )}

                {rondas !== null && rondas.length > 0 && (
                  <div className="space-y-3">
                    {rondas.map((ronda) => {
                      const completa = ronda.escaneados_hoy >= ronda.total_puntos;
                      return (
                        <div key={ronda.id} className="border border-slate-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-sm">{ronda.nombre}</div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                              completa
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}>
                              {ronda.escaneados_hoy}/{ronda.total_puntos}
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {ronda.puntos.map((p) => (
                              <li key={p.id} className="flex items-start gap-2 text-xs">
                                {p.escaneado_hoy ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-slate-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <div className={p.escaneado_hoy ? "text-slate-200" : "text-slate-400"}>
                                    {p.nombre}
                                  </div>
                                  {p.escaneado_hoy && p.ultimo_escaneo && (
                                    <div className="text-[10px] text-slate-500">
                                      {fmtHora(p.ultimo_escaneo)}
                                      {p.ultimo_distancia_metros != null && ` · ${p.ultimo_distancia_metros} m`}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-slate-500 text-center pt-1">
                      Escaneá los códigos QR pegados en cada punto con la cámara del teléfono.
                    </p>
                  </div>
                )}
              </div>
            )}
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

            {esKiosco && (
              <button
                onClick={() => void reiniciar()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Marcar otro agente
              </button>
            )}
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

        {/* Menú propio para supervisores y jefes de servicio (sin puesto/custodia) */}
        {estado === "supervisor_menu" && supervisorIdent && (
          <div className="space-y-5 pt-4 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-violet-600/20 flex items-center justify-center">
              <ShieldAlert className="w-10 h-10 text-violet-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{supervisorIdent.nombre}</h2>
              <p className="text-xs text-violet-300/80 mt-1 uppercase tracking-wider">
                {supervisorIdent.rol === "jefe_servicio" ? "Jefe de Servicio" : "Supervisor"}
                {supervisorIdent.cargo ? ` · ${supervisorIdent.cargo}` : ""}
              </p>
              <p className="text-sm text-slate-300 mt-3">{supervisorIdent.mensaje}</p>
            </div>

            <button
              onClick={() => {
                // Pasamos el qr_token también en el hash como fallback:
                // en iOS standalone (PWA instalada) sessionStorage puede no
                // sobrevivir la navegación, así que el hash garantiza que
                // /agente/supervision lo recibe sin pedir re-escanear.
                const qr = (() => { try { return localStorage.getItem("isp_supervisor_qr") || ""; } catch { return ""; } })();
                window.location.href = qr ? `/agente/supervision#qr=${encodeURIComponent(qr)}` : "/agente/supervision";
              }}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Activity className="w-5 h-5" /> Iniciar supervisión
            </button>

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

      {/* Modal lightbox para ver la foto del DPI de una visita */}
      {fotoVisitaModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4"
          onClick={() => setFotoVisitaModal(null)}
        >
          <div className="text-white text-sm mb-3 text-center">{fotoVisitaModal.titulo}</div>
          <img
            src={fotoVisitaModal.url}
            alt="Foto DPI"
            className="max-w-full max-h-[75vh] rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setFotoVisitaModal(null)}
            className="mt-4 bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
