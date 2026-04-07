import { useEffect, useState } from "react";
import {
  CheckCircle, XCircle, Loader2, MapPin, AlertTriangle,
  QrCode, ShieldAlert, Star, ClipboardCheck, UserCheck, Smartphone,
  Footprints, ChevronRight, RotateCcw, Clock, Bell, Users,
} from "lucide-react";

const API = "/api";
const DEVICE_KEY = "isp_device";

function getStoredDevice(): { uuid: string; token: string } | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface AgenteInfo {
  employee_id: number;
  nombre_completo: string;
  cargo: string;
  tipo_personal: string;
  dpi: string;
  puesto: {
    id: number;
    nombre: string;
    cliente_nombre: string;
    horario?: string;
    hora_entrada?: string;
    hora_salida?: string;
    turno?: string;
    jornada?: string;
    novedad?: string | null;
  } | null;
  gps: { latitud: number; longitud: number; radio_metros: number } | null;
  armamento: {
    codigo: string;
    descripcion: string;
    serie?: string | null;
    activo?: boolean;
    numero_portacion?: string | null;
    fecha_vencimiento_portacion?: string | null;
    numero_tenencia?: string | null;
    fecha_vencimiento_tenencia?: string | null;
  } | null;
  relevo: { nombre: string; registrado_en: string } | null;
  proximo_relevo: { nombre: string; cargo: string } | null;
  ya_ficho_hoy: boolean;
}

interface DeviceInfo {
  tipo: "puesto" | "supervisor" | "maestro";
  supervisor_nombre: string;
  descripcion: string;
  puesto_nombre?: string;
  cliente_nombre?: string;
}

type ModoMaestro = "fichaje" | "supervision" | "ronda";

type EstadoFichaje =
  | "validando_device"
  | "device_invalido"
  | "cargando_info"
  | "esperando_gps"
  | "gps_denegado"
  | "enviando"
  | "ya_fichado"
  | "ok"
  | "fuera_de_zona"
  | "sin_gps"
  | "error"
  | "token_invalido";

interface SupervisionChecks {
  uniforme_completo: boolean;
  equipo_en_orden: boolean;
  armamento_ok: boolean;
  puesto_limpio: boolean;
  bitacora_actualizada: boolean;
}

const DEFAULT_CHECKS: SupervisionChecks = {
  uniforme_completo: false,
  equipo_en_orden: false,
  armamento_ok: false,
  puesto_limpio: false,
  bitacora_actualizada: false,
};

const CHECK_LABELS: Record<keyof SupervisionChecks, string> = {
  uniforme_completo: "Uniforme completo y limpio",
  equipo_en_orden: "Equipo de comunicación en orden",
  armamento_ok: "Armamento y munición correctos",
  puesto_limpio: "Área del puesto limpia y ordenada",
  bitacora_actualizada: "Bitácora actualizada",
};

// ── Helpers de vencimiento ──────────────────────────────────────────────────
function diasHastaVencer(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function colorVencimiento(dateStr: string | null | undefined): string {
  const d = diasHastaVencer(dateStr);
  if (d === null) return "text-white/25";
  if (d < 0) return "text-red-400";
  if (d <= 30) return "text-red-400";
  if (d <= 60) return "text-amber-400";
  return "text-green-400";
}
function bgVencimiento(dateStr: string | null | undefined): string {
  const d = diasHastaVencer(dateStr);
  if (d === null) return "bg-white/5 border-white/10";
  if (d < 0) return "bg-red-500/10 border-red-500/20";
  if (d <= 30) return "bg-red-500/8 border-red-500/15";
  if (d <= 60) return "bg-amber-500/8 border-amber-500/15";
  return "bg-green-500/5 border-green-500/15";
}
function labelVencimiento(dateStr: string | null | undefined): string {
  const d = diasHastaVencer(dateStr);
  if (d === null) return "Sin fecha";
  const formatted = new Date(dateStr!).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });
  if (d < 0) return `${formatted} · VENCIDA`;
  if (d === 0) return `${formatted} · Vence HOY`;
  if (d <= 30) return `${formatted} · ${d}d`;
  return formatted;
}

// ── BriefingPanel: panel compartido de info operativa ─────────────────────
function BriefingPanel({ info }: { info: AgenteInfo }) {
  const { relevo, proximo_relevo, armamento, puesto } = info;
  return (
    <div className="space-y-3 text-left">

      {/* Relevo anterior */}
      {relevo ? (
        <div className="bg-slate-500/5 border border-slate-500/15 rounded-xl p-4">
          <p className="text-xs text-slate-300/60 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Turno anterior
          </p>
          <p className="text-white/80 text-sm font-medium">{relevo.nombre}</p>
          <p className="text-white/30 text-xs mt-0.5">
            Fichó el {new Date(relevo.registrado_en).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}
          </p>
        </div>
      ) : (
        <div className="bg-slate-500/5 border border-slate-500/10 rounded-xl p-3">
          <p className="text-xs text-slate-300/40 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Sin relevo anterior registrado hoy
          </p>
        </div>
      )}

      {/* Próximo relevo */}
      {proximo_relevo && (
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
          <p className="text-xs text-blue-300/60 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5" /> Próximo relevo
          </p>
          <p className="text-white/80 text-sm font-medium">{proximo_relevo.nombre}</p>
          {proximo_relevo.cargo && <p className="text-white/30 text-xs mt-0.5">{proximo_relevo.cargo}</p>}
        </div>
      )}

      {/* Armamento */}
      {armamento ? (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-xs text-amber-300/60 font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Armamento del puesto
          </p>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-amber-200/90 text-sm font-mono font-semibold">{armamento.codigo}</p>
              <p className="text-white/50 text-xs mt-0.5">{armamento.descripcion.trim() || "—"}</p>
              {armamento.serie && <p className="text-white/25 text-xs mt-0.5 font-mono">Serie: {armamento.serie}</p>}
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              armamento.activo !== false
                ? "text-green-400 bg-green-400/10 border-green-400/20"
                : "text-red-400 bg-red-400/10 border-red-400/20"
            }`}>
              {armamento.activo !== false ? "✓ Operativa" : "✗ Reportada"}
            </span>
          </div>
          {/* Portación */}
          <div className={`rounded-lg border p-2.5 mb-2 ${bgVencimiento(armamento.fecha_vencimiento_portacion)}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-white/40 text-xs font-semibold">Portación</p>
                {armamento.numero_portacion && (
                  <p className="text-white/30 text-xs font-mono mt-0.5">{armamento.numero_portacion}</p>
                )}
              </div>
              <p className={`text-xs font-semibold shrink-0 ${colorVencimiento(armamento.fecha_vencimiento_portacion)}`}>
                {labelVencimiento(armamento.fecha_vencimiento_portacion)}
              </p>
            </div>
          </div>
          {/* Tenencia */}
          <div className={`rounded-lg border p-2.5 ${bgVencimiento(armamento.fecha_vencimiento_tenencia)}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-white/40 text-xs font-semibold">Tenencia</p>
                {armamento.numero_tenencia && (
                  <p className="text-white/30 text-xs font-mono mt-0.5">{armamento.numero_tenencia}</p>
                )}
              </div>
              <p className={`text-xs font-semibold shrink-0 ${colorVencimiento(armamento.fecha_vencimiento_tenencia)}`}>
                {labelVencimiento(armamento.fecha_vencimiento_tenencia)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
          <p className="text-xs text-amber-300/30 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Sin armamento asignado a este puesto
          </p>
        </div>
      )}

      {/* Novedades del puesto */}
      {puesto?.novedad && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-xs text-yellow-300/70 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Novedades del puesto
          </p>
          <p className="text-white/75 text-sm leading-relaxed whitespace-pre-line">{puesto.novedad}</p>
        </div>
      )}

    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function AgenteEscaneo() {
  const token = new URLSearchParams(window.location.search).get("token");

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [modoMaestro, setModoMaestro] = useState<ModoMaestro | null>(null);
  const [agenteInfo, setAgenteInfo] = useState<AgenteInfo | null>(null);
  const [estado, setEstado] = useState<EstadoFichaje>("validando_device");
  const [mensajeError, setMensajeError] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; precision: number } | null>(null);
  const [distanciaRes, setDistanciaRes] = useState<number | null>(null);

  // Supervisión
  const [checks, setChecks] = useState<SupervisionChecks>({ ...DEFAULT_CHECKS });
  const [calificacion, setCalificacion] = useState(0);
  const [observaciones, setObservaciones] = useState("");
  const [enviandoSupervision, setEnviandoSupervision] = useState(false);
  const [supervisionOk, setSupervisionOk] = useState(false);
  const [supervisionError, setSupervisionError] = useState("");

  // Ronda (maestro)
  const [obsRonda, setObsRonda] = useState("");
  const [enviandoRonda, setEnviandoRonda] = useState(false);
  const [rondaOk, setRondaOk] = useState(false);
  const [rondaError, setRondaError] = useState("");

  const hora = new Date().toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
  const fecha = new Date().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" });

  // Tipo efectivo: maestro hereda el modo seleccionado
  const tipoEfectivo: "puesto" | "supervisor" | "ronda" | null = (() => {
    if (!deviceInfo) return null;
    if (deviceInfo.tipo === "maestro") {
      if (!modoMaestro) return null;
      return modoMaestro === "fichaje" ? "puesto" : modoMaestro === "supervision" ? "supervisor" : "ronda";
    }
    return deviceInfo.tipo as "puesto" | "supervisor";
  })();

  // 1. Validar dispositivo
  useEffect(() => {
    const stored = getStoredDevice();
    if (!stored) { setEstado("device_invalido"); setMensajeError("no_registrado"); return; }
    fetch(`${API}/supervisor-devices/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_uuid: stored.uuid, device_token: stored.token }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) { setEstado("device_invalido"); setMensajeError(data.error || "Dispositivo revocado"); return; }
        setDeviceInfo(data);
        setEstado("cargando_info");
      })
      .catch(() => { setEstado("device_invalido"); setMensajeError("sin_conexion"); });
  }, []);

  // 2. Cargar info del agente
  useEffect(() => {
    if (estado !== "cargando_info") return;
    if (!token) { setEstado("token_invalido"); return; }
    fetch(`${API}/agente/scan/${token}`)
      .then(r => { if (!r.ok) return r.json().then(d => { throw new Error(d.error || "Token inválido"); }); return r.json(); })
      .then((data: AgenteInfo) => {
        setAgenteInfo(data);
        // Maestro: esperar selección de modo — no avanzar todavía
        if (deviceInfo?.tipo === "maestro") return;
        if (deviceInfo?.tipo === "supervisor") { setEstado("esperando_gps"); }
        else if (data.ya_ficho_hoy) { setEstado("ya_fichado"); }
        else { setEstado("esperando_gps"); }
      })
      .catch(e => { setMensajeError(e.message); setEstado("token_invalido"); });
  }, [estado, token, deviceInfo]);

  // 3. Cuando maestro elige modo → avanzar
  function elegirModo(modo: ModoMaestro) {
    setModoMaestro(modo);
    if (!agenteInfo) return;
    if (modo === "fichaje") {
      if (agenteInfo.ya_ficho_hoy) { setEstado("ya_fichado"); }
      else { setEstado("esperando_gps"); }
    } else if (modo === "supervision") {
      setEstado("esperando_gps");
    } else {
      // ronda — no GPS estricto requerido, pero intentamos capturarlo
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }),
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    }
  }

  // 4. GPS — solo para fichaje/supervisión
  useEffect(() => {
    if (estado !== "esperando_gps") return;
    const esRonda = tipoEfectivo === "ronda";
    const esSup = tipoEfectivo === "supervisor";

    if (esSup || esRonda) {
      // GPS opcional: intentar pero no bloquear
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }),
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
      return;
    }

    // Puesto: GPS requerido
    if (!navigator.geolocation) { setEstado("enviando"); return; }
    let settled = false;
    navigator.geolocation.getCurrentPosition(
      pos => { if (settled) return; settled = true; setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }); setEstado("enviando"); },
      err => { if (settled) return; settled = true; if (err.code === 1) setEstado("gps_denegado"); else setEstado("enviando"); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
    );
  }, [estado, tipoEfectivo]);

  // Escuchar cambios de permiso GPS — si el usuario activa en Ajustes y vuelve, reintenta
  useEffect(() => {
    if (estado !== "gps_denegado") return;
    if (!navigator.permissions) return;
    let removed = false;
    navigator.permissions.query({ name: "geolocation" as PermissionName })
      .then(status => {
        const handleChange = () => {
          if (!removed && status.state !== "denied") { setGpsCoords(null); setEstado("esperando_gps"); }
        };
        status.addEventListener("change", handleChange);
        return () => { removed = true; status.removeEventListener("change", handleChange); };
      })
      .catch(() => {});
  }, [estado]);

  // 5. Enviar fichaje (puesto o maestro en modo fichaje)
  useEffect(() => {
    if (estado !== "enviando" || tipoEfectivo !== "puesto") return;
    const stored = getStoredDevice()!;
    const body: Record<string, unknown> = { token, device_uuid: stored.uuid, device_token: stored.token };
    if (gpsCoords) { body.latitud = gpsCoords.lat; body.longitud = gpsCoords.lng; body.precision_metros = gpsCoords.precision; }
    fetch(`${API}/agente/fichaje`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(r => r.json())
      .then(data => {
        if (data.error === "ya_registrado") { setEstado("ya_fichado"); return; }
        if (data.error === "fuera_de_zona") { setDistanciaRes(data.distancia_metros); setEstado("fuera_de_zona"); return; }
        if (data.error === "dispositivo_no_autorizado" || data.error === "tipo_incorrecto") { setMensajeError(data.mensaje || data.error); setEstado("device_invalido"); return; }
        if (data.ok) { setDistanciaRes(data.distancia_metros); setEstado(data.resultado === "sin_gps" ? "sin_gps" : "ok"); }
        else { setMensajeError(data.error || "Error desconocido"); setEstado("error"); }
      })
      .catch(() => { setMensajeError("Error al conectar con el servidor"); setEstado("error"); });
  }, [estado, gpsCoords, token, tipoEfectivo]);

  // ── Enviar supervisión ─────────────────────────────────────────────────────
  async function enviarSupervision() {
    const stored = getStoredDevice();
    if (!stored) return;
    setEnviandoSupervision(true); setSupervisionError("");
    try {
      const res = await fetch(`${API}/agente/supervision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, device_uuid: stored.uuid, device_token: stored.token, checks, calificacion: calificacion || null, observaciones, latitud: gpsCoords?.lat ?? null, longitud: gpsCoords?.lng ?? null }),
      });
      const data = await res.json();
      if (data.ok) { setSupervisionOk(true); } else { setSupervisionError(data.mensaje || data.error || "Error guardando supervisión"); }
    } catch { setSupervisionError("Error de conexión"); }
    finally { setEnviandoSupervision(false); }
  }

  // ── Enviar ronda (maestro) ─────────────────────────────────────────────────
  async function enviarRonda() {
    const stored = getStoredDevice();
    if (!stored) return;
    setEnviandoRonda(true); setRondaError("");
    try {
      const res = await fetch(`${API}/agente/ronda-check`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, device_uuid: stored.uuid, device_token: stored.token, observaciones: obsRonda || null, latitud: gpsCoords?.lat ?? null, longitud: gpsCoords?.lng ?? null }),
      });
      const data = await res.json();
      if (data.ok) { setRondaOk(true); } else { setRondaError(data.mensaje || data.error || "Error marcando ronda"); }
    } catch { setRondaError("Error de conexión"); }
    finally { setEnviandoRonda(false); }
  }

  // ── Subcomponentes ─────────────────────────────────────────────────────────
  function AgenteCard({ compact = false }: { compact?: boolean }) {
    if (!agenteInfo) return null;
    const p = agenteInfo.puesto;
    const horaLabel = p?.hora_entrada && p?.hora_salida
      ? `${p.hora_entrada} – ${p.hora_salida}`
      : p?.horario ?? null;
    const turnoLabel = [p?.turno, p?.jornada].filter(Boolean).join(" · ") || null;

    return (
      <div className={`bg-white/5 border border-white/10 rounded-xl p-4 text-left ${compact ? "mb-3" : "mb-4"}`}>
        {/* Cabecera agente */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm leading-tight">{agenteInfo.nombre_completo}</p>
            <p className="text-white/50 text-xs mt-0.5">{agenteInfo.cargo || agenteInfo.tipo_personal}</p>
            {p && <p className="text-blue-300/80 text-xs mt-1 font-medium">{p.nombre}</p>}
            {p && <p className="text-white/35 text-xs">{p.cliente_nombre}</p>}
          </div>
        </div>

        {/* Horario del puesto */}
        {!compact && p && (horaLabel || turnoLabel) && (
          <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-x-3 gap-y-1">
            {horaLabel && (
              <div className="flex items-center gap-1.5 col-span-1">
                <svg className="w-3 h-3 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                <span className="text-xs text-white/60 font-medium">{horaLabel}</span>
              </div>
            )}
            {turnoLabel && (
              <div className="flex items-center gap-1.5 col-span-1">
                <svg className="w-3 h-3 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                </svg>
                <span className="text-xs text-white/60">{turnoLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Armamento */}
        {!compact && agenteInfo.armamento && (
          <div className="mt-2.5 pt-2.5 border-t border-white/5">
            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-amber-300/80 font-semibold">Arma asignada al puesto</p>
                <p className="text-xs text-white/50 mt-0.5">
                  <span className="text-amber-200/70 font-mono">{agenteInfo.armamento.codigo}</span>
                  {" — "}{agenteInfo.armamento.descripcion}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const esMaestro = deviceInfo?.tipo === "maestro";
  const esSupervisor = tipoEfectivo === "supervisor";
  const esPuesto = tipoEfectivo === "puesto";
  const esRonda = tipoEfectivo === "ronda";

  const deviceColor = esMaestro ? "amber" : deviceInfo?.tipo === "supervisor" ? "purple" : "blue";
  const deviceLabel = esMaestro ? "🧪 Dispositivo Maestro" : deviceInfo?.tipo === "supervisor" ? "🛡 Supervisor" : "📍 Puesto";

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4">
      {/* Back nav */}
      <div className="fixed top-0 left-0 right-0 flex items-center gap-2 px-4 py-3 bg-[#0d1117]/80 backdrop-blur-sm border-b border-white/5 z-10">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Volver
        </button>
        <span className="text-white/15 text-xs ml-auto">ISP</span>
      </div>

      {/* Header */}
      <div className="text-center mb-6 mt-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 mb-3">
          <QrCode className="w-6 h-6 text-blue-400" />
        </div>
        <p className="text-white/30 text-xs uppercase tracking-widest">ISP — Credencial de Agente</p>
        {deviceInfo && (
          <p className={`text-xs mt-1 ${
            esMaestro ? "text-amber-400/80" : deviceInfo.tipo === "supervisor" ? "text-purple-400/70" : "text-blue-400/70"
          }`}>
            {deviceLabel} · {deviceInfo.supervisor_nombre}
          </p>
        )}
      </div>

      <div className="w-full max-w-sm">

        {/* ── VALIDANDO ─────────────────────────────────────────────────────── */}
        {(estado === "validando_device" || estado === "cargando_info") && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 text-blue-400 animate-spin" />
            <p className="text-white font-semibold">
              {estado === "validando_device" ? "Autenticando dispositivo..." : "Verificando credencial..."}
            </p>
          </div>
        )}

        {/* ── DISPOSITIVO NO AUTORIZADO ─────────────────────────────────────── */}
        {estado === "device_invalido" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 font-bold text-xl mb-2">Dispositivo no autorizado</p>
            <p className="text-white/50 text-sm leading-relaxed">
              {mensajeError === "no_registrado" ? "Este teléfono no está registrado en el sistema ISP."
               : mensajeError === "sin_conexion" ? "No se pudo conectar con el servidor."
               : "Este dispositivo fue revocado o su token expiró."}
            </p>
            <div className="mt-5 bg-white/5 border border-white/10 rounded-xl p-4 text-left text-xs text-white/30 space-y-1.5">
              <p>1. El administrador registra el dispositivo en el panel</p>
              <p>2. Abre el enlace de activación en este teléfono</p>
              <p>3. Vuelve a escanear el QR del agente</p>
            </div>
          </div>
        )}

        {/* ── SELECTOR DE MODO (MAESTRO) ────────────────────────────────────── */}
        {esMaestro && !modoMaestro && agenteInfo && (
          <div className="bg-white/5 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center">
                <span className="text-sm">🧪</span>
              </div>
              <div>
                <p className="text-amber-300/90 text-sm font-semibold">Dispositivo Maestro</p>
                <p className="text-amber-300/40 text-xs">Elige cómo quieres actuar</p>
              </div>
            </div>

            <AgenteCard compact />

            <div className="space-y-2">
              <button onClick={() => elegirModo("fichaje")}
                className="w-full flex items-center gap-3 p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 hover:border-blue-500/40 rounded-xl transition-colors group">
                <div className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-blue-300 text-sm font-semibold">Marcar Fichaje</p>
                  <p className="text-blue-300/50 text-xs">Registrar entrada del agente</p>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400/40 group-hover:text-blue-400/70" />
              </button>

              <button onClick={() => elegirModo("supervision")}
                className="w-full flex items-center gap-3 p-4 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 hover:border-purple-500/40 rounded-xl transition-colors group">
                <div className="w-9 h-9 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-purple-300 text-sm font-semibold">Supervisión</p>
                  <p className="text-purple-300/50 text-xs">Checklist, calificación y observaciones</p>
                </div>
                <ChevronRight className="w-4 h-4 text-purple-400/40 group-hover:text-purple-400/70" />
              </button>

              <button onClick={() => elegirModo("ronda")}
                className="w-full flex items-center gap-3 p-4 bg-green-600/10 hover:bg-green-600/20 border border-green-500/20 hover:border-green-500/40 rounded-xl transition-colors group">
                <div className="w-9 h-9 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center shrink-0">
                  <Footprints className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-green-300 text-sm font-semibold">Marcar Ronda</p>
                  <p className="text-green-300/50 text-xs">Registrar visita de ronda en este puesto</p>
                </div>
                <ChevronRight className="w-4 h-4 text-green-400/40 group-hover:text-green-400/70" />
              </button>
            </div>
          </div>
        )}

        {/* ── MODO RONDA (MAESTRO) ──────────────────────────────────────────── */}
        {esRonda && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            {rondaOk ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Footprints className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-green-400 font-bold text-xl mb-1">Ronda Marcada</p>
                <p className="text-white/40 text-sm mt-2">{hora} — {fecha}</p>
                {agenteInfo && <p className="text-white text-sm mt-3 font-semibold">{agenteInfo.nombre_completo}</p>}
                <p className="text-white/20 text-xs mt-4">Puedes cerrar esta ventana</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center">
                    <Footprints className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <p className="text-green-300/80 text-xs font-semibold uppercase tracking-wide">Marcar Ronda</p>
                  {esMaestro && (
                    <button onClick={() => setModoMaestro(null)} className="ml-auto flex items-center gap-1 text-white/30 hover:text-white/60 text-xs">
                      <RotateCcw className="w-3 h-3" /> Cambiar
                    </button>
                  )}
                </div>

                {agenteInfo && <AgenteCard compact />}

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Observaciones (opcional)</p>
                <textarea
                  value={obsRonda}
                  onChange={e => setObsRonda(e.target.value)}
                  placeholder="Novedades del puesto durante la ronda..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 resize-none outline-none focus:border-green-500/40 mb-4"
                />

                {rondaError && <p className="text-red-400 text-xs mb-3">{rondaError}</p>}

                <button onClick={enviarRonda} disabled={enviandoRonda}
                  className="w-full py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-xl text-sm text-green-300 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {enviandoRonda ? <Loader2 className="w-4 h-4 animate-spin" /> : <Footprints className="w-4 h-4" />}
                  {enviandoRonda ? "Registrando..." : "Registrar visita de ronda"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MODO SUPERVISIÓN ──────────────────────────────────────────────── */}
        {esSupervisor && estado === "esperando_gps" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            {supervisionOk ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-purple-400 font-bold text-xl mb-1">Supervisión Guardada</p>
                <p className="text-white/40 text-sm mt-2">{hora} — {fecha}</p>
                {agenteInfo && <p className="text-white text-sm mt-3 font-semibold">{agenteInfo.nombre_completo}</p>}
                <p className="text-white/20 text-xs mt-4">Puedes cerrar esta ventana</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center justify-center">
                    <ClipboardCheck className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <p className="text-purple-300/80 text-xs font-semibold uppercase tracking-wide">Formulario de Supervisión</p>
                  {esMaestro && (
                    <button onClick={() => setModoMaestro(null)} className="ml-auto flex items-center gap-1 text-white/30 hover:text-white/60 text-xs">
                      <RotateCcw className="w-3 h-3" /> Cambiar
                    </button>
                  )}
                </div>

                {agenteInfo && <AgenteCard />}

                {/* Briefing operativo para el supervisor: arma, relevo, novedades */}
                {agenteInfo && (
                  <div className="mb-4">
                    <BriefingPanel info={agenteInfo} />
                  </div>
                )}

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-3">Lista de verificación</p>
                <div className="space-y-2 mb-4">
                  {(Object.keys(DEFAULT_CHECKS) as Array<keyof SupervisionChecks>).map(key => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => setChecks(c => ({ ...c, [key]: !c[key] }))}
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                          checks[key] ? "bg-green-500/20 border-green-500/40" : "border-white/15 group-hover:border-white/30"
                        }`}>
                        {checks[key] && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                      </div>
                      <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{CHECK_LABELS[key]}</span>
                    </label>
                  ))}
                </div>

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Calificación</p>
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setCalificacion(calificacion === n ? 0 : n)}>
                      <Star className={`w-7 h-7 transition-colors ${n <= calificacion ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
                    </button>
                  ))}
                </div>

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Observaciones</p>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ingresa tus observaciones..." rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 resize-none outline-none focus:border-purple-500/40 mb-4" />

                {supervisionError && <p className="text-red-400 text-xs mb-3">{supervisionError}</p>}

                <button onClick={enviarSupervision} disabled={enviandoSupervision}
                  className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-sm text-purple-300 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {enviandoSupervision ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  {enviandoSupervision ? "Guardando..." : "Guardar Supervisión"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MODO FICHAJE (puesto o maestro en modo fichaje) ───────────────── */}
        {esPuesto && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            {esMaestro && (estado === "esperando_gps" || estado === "enviando") && (
              <button onClick={() => { setModoMaestro(null); setEstado("cargando_info"); setGpsCoords(null); }}
                className="absolute top-3 right-3 flex items-center gap-1 text-white/30 hover:text-white/60 text-xs">
                <RotateCcw className="w-3 h-3" /> Cambiar
              </button>
            )}

            {(estado === "esperando_gps" || estado === "enviando") && (
              <div>
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
                <p className="text-white font-semibold text-lg mb-1">
                  {estado === "esperando_gps" ? "Obteniendo ubicación..." : "Registrando fichaje..."}
                </p>
                {agenteInfo && <p className="text-white/50 text-sm mt-2">{agenteInfo.nombre_completo}</p>}
                {estado === "esperando_gps" && (
                  <div className="mt-4 bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-300">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>Acepta el permiso de ubicación cuando tu navegador lo solicite</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {estado === "ya_fichado" && (
              <div>
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-blue-400 font-bold text-xl mb-1">Ya fichaste hoy</p>
                {agenteInfo && <p className="text-white font-semibold mt-3">{agenteInfo.nombre_completo}</p>}
                <p className="text-white/50 text-sm mt-2">{fecha}</p>
                <p className="text-white/20 text-xs mt-4">Tu fichaje de entrada ya fue registrado</p>
                {esMaestro && (
                  <button onClick={() => setModoMaestro(null)} className="mt-4 flex items-center gap-1 text-white/30 hover:text-white/60 text-xs mx-auto">
                    <RotateCcw className="w-3 h-3" /> Elegir otra acción
                  </button>
                )}
              </div>
            )}

            {estado === "gps_denegado" && (
              <div>
                <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8 text-orange-400" />
                </div>
                <p className="text-orange-400 font-bold text-xl mb-2">Ubicación bloqueada</p>
                <p className="text-white/60 text-sm mt-2 leading-relaxed">
                  El fichaje <strong className="text-white">no fue registrado</strong>. Sigue los pasos según tu teléfono:
                </p>

                <div className="mt-3 bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-left space-y-2">
                  <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide">📱 iPhone / iPad</p>
                  <div>
                    <p className="text-xs text-white/70 font-semibold mb-0.5">Paso 1:</p>
                    <p className="text-xs text-white/50 leading-relaxed">
                      <strong className="text-white/75">Ajustes → Privacidad y Seguridad → Localización → Safari</strong> → elige <strong className="text-orange-300">Al usar la app</strong>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/70 font-semibold mb-0.5">Paso 2:</p>
                    <p className="text-xs text-white/50 leading-relaxed">
                      En esa pantalla → <strong className="text-white/75">Acceso a Sitios Web → ispsa.net → Permitir</strong>
                    </p>
                  </div>
                  <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg p-2.5">
                    <p className="text-xs text-amber-300/80 font-semibold mb-0.5">⚠️ ¿Ya hiciste los pasos y sigue bloqueado?</p>
                    <p className="text-xs text-white/40 leading-relaxed">
                      Safari guarda el rechazo. Cierra Safari completamente (desliza hacia arriba), escanea el QR de nuevo y acepta la ubicación cuando pregunte.
                    </p>
                  </div>
                </div>

                <div className="mt-2 bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-left">
                  <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide mb-1">🤖 Android</p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    <strong className="text-white/75">Ajustes → Aplicaciones → Chrome → Permisos → Ubicación → Permitir todo el tiempo</strong>
                  </p>
                </div>

                <button onClick={() => { setGpsCoords(null); setEstado("esperando_gps"); }} className="mt-4 w-full py-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl text-sm text-orange-300 font-semibold transition-colors">
                  Ya lo hice — Intentar de nuevo
                </button>
              </div>
            )}

            {(estado === "ok" || estado === "sin_gps") && agenteInfo && (
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  estado === "ok"
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-yellow-500/10 border border-yellow-500/30"
                }`}>
                  {estado === "ok"
                    ? <CheckCircle className="w-8 h-8 text-green-400" />
                    : <AlertTriangle className="w-8 h-8 text-yellow-400" />}
                </div>
                <p className={`font-bold text-xl mb-1 ${estado === "ok" ? "text-green-400" : "text-yellow-400"}`}>
                  {estado === "ok" ? "Fichaje Registrado" : "Fichaje sin GPS"}
                </p>
                <p className="text-white text-base font-semibold mt-1">{agenteInfo.nombre_completo}</p>
                <p className="text-white/40 text-sm mt-1">{hora} — {fecha}</p>

                <div className="mt-4 space-y-3 text-left">

                  {/* Puesto y horario */}
                  {agenteInfo.puesto && (
                    <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                      <p className="text-xs text-blue-300/60 font-semibold uppercase tracking-wide mb-2">Puesto asignado</p>
                      <p className="text-blue-200 font-semibold text-sm">{agenteInfo.puesto.nombre}</p>
                      <p className="text-white/40 text-xs mt-0.5">{agenteInfo.puesto.cliente_nombre}</p>
                      {(agenteInfo.puesto.hora_entrada || agenteInfo.puesto.hora_salida) && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="w-3.5 h-3.5 text-blue-400/60 shrink-0" />
                          <span className="text-xs text-white/60">
                            {agenteInfo.puesto.hora_entrada ?? "—"} – {agenteInfo.puesto.hora_salida ?? "—"}
                            {agenteInfo.puesto.turno ? ` · ${agenteInfo.puesto.turno}` : ""}
                            {agenteInfo.puesto.jornada ? ` (${agenteInfo.puesto.jornada})` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* GPS */}
                  {distanciaRes != null && agenteInfo.gps && (
                    <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-green-400/70 shrink-0" />
                      <p className="text-xs text-green-400/80">
                        Distancia al puesto: <strong>{distanciaRes}m</strong> · radio permitido: {agenteInfo.gps.radio_metros}m
                      </p>
                    </div>
                  )}

                  {/* Briefing operativo: relevo, próximo relevo, arma + documentos, novedades */}
                  <BriefingPanel info={agenteInfo} />

                </div>

                <p className="text-white/20 text-xs mt-5">Puedes cerrar esta ventana</p>
                {esMaestro && (
                  <button onClick={() => setModoMaestro(null)} className="mt-3 flex items-center gap-1 text-white/30 hover:text-white/60 text-xs mx-auto">
                    <RotateCcw className="w-3 h-3" /> Elegir otra acción
                  </button>
                )}
              </div>
            )}

            {estado === "fuera_de_zona" && agenteInfo && (
              <div>
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 font-bold text-xl mb-1">Fuera del Área</p>
                <p className="text-white/60 text-sm mt-2">
                  Estás a <strong className="text-white">{distanciaRes}m</strong> del puesto.<br />
                  Radio permitido: <strong className="text-white">{agenteInfo.gps?.radio_metros}m</strong>.
                </p>
                <p className="text-white font-semibold mt-4">{agenteInfo.nombre_completo}</p>
                <button onClick={() => { setEstado("esperando_gps"); setGpsCoords(null); }} className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-colors">
                  Intentar de nuevo
                </button>
              </div>
            )}

            {(estado === "token_invalido" || estado === "error") && (
              <div>
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 font-bold text-xl mb-1">
                  {estado === "token_invalido" ? "Código no válido" : "Error de conexión"}
                </p>
                <p className="text-white/50 text-sm mt-2">
                  {mensajeError || (estado === "token_invalido" ? "Este QR no es reconocido o fue desactivado." : "No se pudo conectar.")}
                </p>
                {estado === "error" && (
                  <button onClick={() => window.location.reload()} className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-colors">Reintentar</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-white/15 text-xs mt-6 text-center">ISP — Investigaciones y Seguridad Profesional S.A.</p>
    </div>
  );
}
