import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle, XCircle, Loader2, MapPin, AlertTriangle,
  QrCode, ShieldAlert, Star, ClipboardCheck, UserCheck, Smartphone,
  Footprints, ChevronRight, RotateCcw, Clock, Bell, Users, Package,
  Calendar, Phone, BadgeCheck,
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
  fecha_ingreso: string | null;
  telefono_empresa: string | null;
  contacto_emergencia: {
    nombre: string | null;
    telefono: string;
    parentesco: string | null;
  } | null;
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
    arma_id?: number | null;
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
  municion: { id: number; descripcion: string; cantidad_asignada: number } | null;
  bodega_tallas_botas: string[];
  bodega_tallas_uniforme: string[];
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
  | "listo_para_gps"
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

// ── Tarjeta pública del carnet ────────────────────────────────────────────────
// Se muestra a cualquier persona/dispositivo que escanee el QR del carnet sin
// estar registrado en el sistema. Solo expone datos no sensibles del agente
// (nombre, cargo, antigüedad) y el teléfono de emergencia/atención de ISP
// para que cualquiera pueda verificar la identidad del agente o reportar.
function CarnetPublico({
  info,
  mensajeError,
}: {
  info: AgenteInfo | null;
  mensajeError: string;
}) {
  function formatDesde(iso: string | null): string {
    if (!iso) return "—";
    const [y, m] = iso.split("-").map(Number);
    const meses = ["enero","febrero","marzo","abril","mayo","junio",
                   "julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return `${meses[(m ?? 1) - 1]} ${y}`;
  }
  function antiguedad(iso: string | null): string | null {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const inicio = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
    const ahora = new Date();
    let meses = (ahora.getUTCFullYear() - inicio.getUTCFullYear()) * 12
              + (ahora.getUTCMonth() - inicio.getUTCMonth());
    if (ahora.getUTCDate() < inicio.getUTCDate()) meses -= 1;
    if (meses < 0) return null;
    const anios = Math.floor(meses / 12);
    const rMeses = meses % 12;
    if (anios === 0) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
    if (rMeses === 0) return `${anios} ${anios === 1 ? "año" : "años"}`;
    return `${anios} ${anios === 1 ? "año" : "años"} y ${rMeses} ${rMeses === 1 ? "mes" : "meses"}`;
  }

  if (!info) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 font-bold text-xl mb-2">No se pudo leer el carnet</p>
        <p className="text-white/50 text-sm leading-relaxed">
          {mensajeError === "sin_conexion"
            ? "No se pudo conectar con el servidor."
            : "Este código QR no es válido o fue desactivado."}
        </p>
      </div>
    );
  }

  const telEmpresa = info.telefono_empresa?.replace(/[^\d+]/g, "") ?? "";
  const telContacto = info.contacto_emergencia?.telefono.replace(/[^\d+]/g, "") ?? "";
  const desde = formatDesde(info.fecha_ingreso);
  const ant = antiguedad(info.fecha_ingreso);

  return (
    <div className="bg-gradient-to-br from-[#0a1a3d] via-[#0f2044] to-[#0a1a3d] border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl">
      {/* Encabezado de marca */}
      <div className="bg-gradient-to-r from-amber-600/20 via-amber-400/10 to-amber-600/20 border-b border-amber-500/30 px-5 py-3 text-center">
        <p className="text-amber-300 text-[10px] font-bold tracking-[0.25em] uppercase">
          Investigaciones y Seguridad Profesional
        </p>
        <p className="text-white/40 text-[9px] tracking-widest">CARNET DE IDENTIFICACIÓN</p>
      </div>

      {/* Identidad del agente */}
      <div className="px-5 pt-5 pb-4 text-center">
        <div className="w-14 h-14 bg-amber-500/15 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto mb-3">
          <BadgeCheck className="w-7 h-7 text-amber-300" />
        </div>
        <p className="text-white text-lg font-bold leading-tight">{info.nombre_completo}</p>
        {info.cargo && (
          <p className="text-amber-200/80 text-xs mt-0.5 font-medium uppercase tracking-wider">
            {info.cargo}
          </p>
        )}
      </div>

      {/* Antigüedad */}
      <div className="mx-5 mb-4 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
        <Calendar className="w-5 h-5 text-amber-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Agente ISP desde</p>
          <p className="text-white font-semibold text-sm leading-tight">{desde}</p>
          {ant && <p className="text-white/50 text-[11px] mt-0.5">({ant} de servicio)</p>}
        </div>
      </div>

      {/* Contacto de emergencia personal del agente (familia) */}
      {info.contacto_emergencia && telContacto ? (
        <a
          href={`tel:${telContacto}`}
          className="mx-5 mb-3 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 bg-rose-500/30 border border-rose-400/50 rounded-full flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-rose-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-rose-200/80 uppercase tracking-widest font-semibold">
              Contacto de emergencia
            </p>
            {info.contacto_emergencia.nombre && (
              <p className="text-white font-semibold text-sm leading-tight truncate">
                {info.contacto_emergencia.nombre}
                {info.contacto_emergencia.parentesco && (
                  <span className="text-rose-200/70 font-normal text-xs ml-1">
                    ({info.contacto_emergencia.parentesco})
                  </span>
                )}
              </p>
            )}
            <p className="text-white font-bold text-base leading-tight">
              {info.contacto_emergencia.telefono}
            </p>
            <p className="text-rose-200/70 text-[10px] mt-0.5">Toca para llamar</p>
          </div>
        </a>
      ) : (
        <div className="mx-5 mb-3 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-center">
          <p className="text-white/50 text-xs">
            Contacto de emergencia no registrado en su ficha.
          </p>
        </div>
      )}

      {/* Teléfono institucional ISP (verificación) */}
      {telEmpresa && (
        <a
          href={`tel:${telEmpresa}`}
          className="mx-5 mb-5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
        >
          <div className="w-10 h-10 bg-emerald-500/30 border border-emerald-400/50 rounded-full flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-emerald-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-emerald-200/70 uppercase tracking-widest">
              ISP — Verificación / Reportes
            </p>
            <p className="text-white font-bold text-base leading-tight">{info.telefono_empresa}</p>
            <p className="text-emerald-200/70 text-[10px] mt-0.5">Toca para llamar</p>
          </div>
        </a>
      )}

      {/* Pie informativo */}
      <div className="bg-black/30 border-t border-white/5 px-5 py-3">
        <p className="text-white/40 text-[10px] text-center leading-relaxed">
          En caso de emergencia, contacte primero al familiar del agente.
          Para verificar identidad o reportar, llame a ISP.
        </p>
      </div>
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
  // Acciones disciplinarias
  const [accionDisciplinaria, setAccionDisciplinaria] = useState<string>("");
  const [notasDisciplinarias, setNotasDisciplinarias] = useState("");
  const [amonestacionMonto, setAmonestacionMonto] = useState<string>("");

  // Ronda (maestro)
  const [obsRonda, setObsRonda] = useState("");
  const [enviandoRonda, setEnviandoRonda] = useState(false);
  const [rondaOk, setRondaOk] = useState(false);
  const [rondaError, setRondaError] = useState("");

  // Reporte de turno (paso 2 después del fichaje / parte de supervisión)
  const [reporteAbierto, setReporteAbierto] = useState(false);
  const [fichajeIdParaReporte, setFichajeIdParaReporte] = useState<number | null>(null);
  const [reporteEnviado, setReporteEnviado] = useState(false);
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [reporteError, setReporteError] = useState("");
  const [reporteResponsable, setReporteResponsable] = useState<string | null>(null);
  // Arma
  const [armaEstado, setArmaEstado] = useState<"bueno" | "necesita_reparacion">("bueno");
  const [armaObservacion, setArmaObservacion] = useState("");
  // Sugerencia de cambio de estado del arma (solo supervisores)
  const [armaSugerencia, setArmaSugerencia] = useState<"bodega" | "mal_estado" | null>(null);
  const [armaSugerenciaObs, setArmaSugerenciaObs] = useState("");
  // Munición
  const [municionOk, setMunicionOk] = useState<boolean>(true);
  const [municionFaltante, setMunicionFaltante] = useState<number>(0);
  // Uniforme
  const [uniformeOk, setUniformeOk] = useState<boolean>(true);
  const [uniformeItems, setUniformeItems] = useState<{ tipo: string; talla: string }[]>([]);
  // Llegada tarde
  const [llegadaTarde, setLlegadaTarde] = useState<{ minutos: number } | null>(null);
  const [tardanzaAck, setTardanzaAck] = useState(false);
  // Equipo del puesto
  const [equipoPuesto, setEquipoPuesto] = useState<Array<{ id: number; codigo: string; descripcion: string; tipo: string }>>([]);
  const [equipoNovedades, setEquipoNovedades] = useState<Record<number, { estado: string; obs: string }>>({});
  const [enviandoEquipo, setEnviandoEquipo] = useState(false);
  const [equipoEnviado, setEquipoEnviado] = useState(false);

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

  // 2.bis Tarjeta pública del carnet — siempre intentar cargar info del agente
  // aunque el dispositivo no esté registrado, para que cualquier teléfono que
  // escanee el QR pueda ver datos públicos (nombre, fecha de ingreso, tel. de
  // emergencia ISP). No interfiere con el flujo de fichaje normal.
  useEffect(() => {
    if (!token || agenteInfo) return;
    fetch(`${API}/agente/scan/${token}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: AgenteInfo | null) => { if (data) setAgenteInfo(data); })
      .catch(() => { /* silencioso: la UI de error ya cubre este caso */ });
  }, [token, agenteInfo]);

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
        else { setEstado("listo_para_gps"); }
      })
      .catch(e => { setMensajeError(e.message); setEstado("token_invalido"); });
  }, [estado, token, deviceInfo]);

  // 3. Cuando maestro elige modo → avanzar
  function elegirModo(modo: ModoMaestro) {
    setModoMaestro(modo);
    if (!agenteInfo) return;
    if (modo === "fichaje") {
      if (agenteInfo.ya_ficho_hoy) { setEstado("ya_fichado"); }
      else { setEstado("listo_para_gps"); }
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

  // 4. GPS para supervisor/ronda — opcional, se intenta en background cuando llega a "esperando_gps"
  useEffect(() => {
    if (estado !== "esperando_gps") return;
    const esSup = tipoEfectivo === "supervisor";
    const esRonda = tipoEfectivo === "ronda";
    if (!esSup && !esRonda) return; // puesto: GPS requerido, se dispara desde botón
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [estado, tipoEfectivo]);

  // 4b. GPS para puesto — DEBE ser llamado desde un tap del usuario (iOS requiere gesto)
  const solicitarGPS = useCallback(() => {
    if (!navigator.geolocation) { setEstado("enviando"); return; }
    setEstado("esperando_gps");
    let settled = false;
    navigator.geolocation.getCurrentPosition(
      pos => { if (settled) return; settled = true; setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }); setEstado("enviando"); },
      err => { if (settled) return; settled = true; if (err.code === 1) setEstado("gps_denegado"); else setEstado("enviando"); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  // Escuchar cambios de permiso GPS — si el usuario activa en Ajustes y vuelve, volvemos a "listo_para_gps"
  useEffect(() => {
    if (estado !== "gps_denegado") return;
    if (!navigator.permissions) return;
    let removed = false;
    navigator.permissions.query({ name: "geolocation" as PermissionName })
      .then(status => {
        const handleChange = () => {
          if (!removed && status.state !== "denied") { setGpsCoords(null); setEstado("listo_para_gps"); }
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
        if (data.ok) {
          setDistanciaRes(data.distancia_metros);
          if (data.fichaje_id) setFichajeIdParaReporte(data.fichaje_id);
          // Detección de llegada tarde
          const horaEntrada = agenteInfo?.puesto?.hora_entrada;
          if (horaEntrada) {
            const ahora = new Date();
            const [hh, mm] = horaEntrada.split(":").map(Number);
            const programada = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm);
            const diffMin = Math.round((ahora.getTime() - programada.getTime()) / 60000);
            if (diffMin > 5) setLlegadaTarde({ minutos: diffMin });
          }
          // Cargar equipo del puesto si hay puesto asignado
          const puestoId = agenteInfo?.puesto?.id;
          if (puestoId) {
            fetch(`${API}/agente/puesto/${puestoId}/equipo-asignado`)
              .then(r => r.ok ? r.json() : null)
              .then(eq => { if (eq?.equipo) setEquipoPuesto(eq.equipo); })
              .catch(() => {});
          }
          setEstado(data.resultado === "sin_gps" ? "sin_gps" : "ok");
        } else { setMensajeError(data.error || "Error desconocido"); setEstado("error"); }
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
        body: JSON.stringify({ token, device_uuid: stored.uuid, device_token: stored.token, checks, calificacion: calificacion || null, observaciones, latitud: gpsCoords?.lat ?? null, longitud: gpsCoords?.lng ?? null, accion_disciplinaria: accionDisciplinaria || null, notas_disciplinarias: notasDisciplinarias || null, amonestacion_monto: Number(amonestacionMonto) || 0, amonestacion_motivo: accionDisciplinaria ? String(accionDisciplinaria).replace(/_/g, " ") : null }),
      });
      const data = await res.json();
      if (data.ok) {
        setSupervisionOk(true);
        if (data.supervision_id) setFichajeIdParaReporte(data.supervision_id);
      } else { setSupervisionError(data.mensaje || data.error || "Error guardando supervisión"); }
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

  // ── Enviar reporte de turno ────────────────────────────────────────────────
  async function enviarReporteTurno(fichajeId: number, tipo: "fichaje" | "supervision" = "fichaje") {
    const stored = getStoredDevice();
    if (!stored || !agenteInfo) return;
    setEnviandoReporte(true); setReporteError("");
    try {
      const payload = {
        fichaje_id: fichajeId,
        puesto_id: agenteInfo.puesto?.id ?? null,
        employee_id: agenteInfo.employee_id,
        tipo,
        arma_id: agenteInfo.armamento?.arma_id ?? null,
        arma_estado: agenteInfo.armamento ? armaEstado : null,
        arma_observacion: armaEstado === "necesita_reparacion" ? armaObservacion : null,
        municion_ok: agenteInfo.municion ? municionOk : null,
        municion_faltante: agenteInfo.municion && !municionOk ? municionFaltante : 0,
        uniforme_ok: uniformeOk,
        uniforme_items_faltantes: !uniformeOk ? uniformeItems : [],
        device_uuid: stored.uuid, device_token: stored.token,
      };
      const res = await fetch(`${API}/agente/reporte-turno`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setReporteEnviado(true);
        if (data.responsable_anterior_nombre) setReporteResponsable(data.responsable_anterior_nombre);
        // Enviar novedades de equipo del puesto si las hay
        if (data.reporte_id && equipoPuesto.length > 0) {
          await enviarEquipoNovedades(data.reporte_id);
        }
        // Enviar sugerencia de cambio de estado del arma (solo supervisores)
        if (armaSugerencia && agenteInfo?.armamento?.arma_id && tipo === "supervision") {
          await fetch(`${API}/armeria/armas/${agenteInfo.armamento.arma_id}/sugerir-cambio`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              supervisor_nombre: agenteInfo.relevo?.nombre_completo ?? stored.uuid,
              puesto_id: agenteInfo.puesto?.id ?? null,
              estado_sugerido: armaSugerencia,
              observacion: armaSugerenciaObs || null,
            }),
          });
        }
      } else { setReporteError(data.error || "Error guardando reporte"); }
    } catch { setReporteError("Error de conexión"); }
    finally { setEnviandoReporte(false); }
  }

  // ── Enviar novedades de equipo del puesto ─────────────────────────────────
  async function enviarEquipoNovedades(reporteId: number) {
    if (equipoPuesto.length === 0) return;
    setEnviandoEquipo(true);
    try {
      const novedades = equipoPuesto.map(item => ({
        unidad_id: item.id,
        estado: equipoNovedades[item.id]?.estado ?? "bueno",
        observacion: equipoNovedades[item.id]?.obs ?? null,
      }));
      await fetch(`${API}/agente/reporte-turno/${reporteId}/equipo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novedades }),
      });
      setEquipoEnviado(true);
    } catch { /* no-op */ }
    finally { setEnviandoEquipo(false); }
  }

  // ── ReporteTurnoForm: formulario de estado de arma/munición/uniforme ────────
  function ReporteTurnoForm({ fichajeId, tipo = "fichaje" }: { fichajeId: number; tipo?: "fichaje" | "supervision" }) {
    if (!agenteInfo) return null;
    const { armamento, municion, bodega_tallas_botas, bodega_tallas_uniforme } = agenteInfo;
    const TIPOS_UNIFORME = ["Camisa", "Pantalón", "Chaleco", "Gorra", "Cinturón", "Calcetines"];

    function toggleUniformeItem(tipo: string, talla: string) {
      setUniformeItems(prev => {
        const exists = prev.find(i => i.tipo === tipo);
        if (exists) return prev.filter(i => i.tipo !== tipo);
        return [...prev, { tipo, talla }];
      });
    }
    function getItemTalla(tipoItem: string) {
      return uniformeItems.find(i => i.tipo === tipoItem)?.talla ?? "";
    }
    function setItemTalla(tipoItem: string, talla: string) {
      setUniformeItems(prev => prev.map(i => i.tipo === tipoItem ? { ...i, talla } : i));
    }

    // ── Validación — todos los campos son obligatorios ──
    const puedeEnviar = (
      (!armamento || armaEstado !== null) &&
      (armaEstado !== "necesita_reparacion" || armaObservacion.trim().length > 0) &&
      (!municion || municionOk !== null) &&
      (municionOk !== false || municionFaltante > 0) &&
      uniformeOk !== null &&
      (uniformeOk !== false || (uniformeItems.length > 0 && uniformeItems.every(i => i.talla)))
    );

    const camposFaltantes: string[] = [];
    if (armamento && armaEstado === null) camposFaltantes.push("estado del arma");
    if (armaEstado === "necesita_reparacion" && !armaObservacion.trim()) camposFaltantes.push("descripción del problema del arma");
    if (municion && municionOk === null) camposFaltantes.push("estado de la munición");
    if (municionOk === false && !municionFaltante) camposFaltantes.push("cantidad de cartuchos faltantes");
    if (uniformeOk === null) camposFaltantes.push("estado del uniforme");
    if (uniformeOk === false && uniformeItems.length === 0) camposFaltantes.push("artículos de dotación requeridos");
    if (uniformeOk === false && uniformeItems.some(i => !i.talla)) camposFaltantes.push("talla de todos los artículos seleccionados");

    if (reporteEnviado) {
      return (
        <div className="mt-4 bg-green-500/5 border border-green-500/20 rounded-2xl p-5 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-green-400 font-bold text-lg">Reporte enviado</p>
          {reporteResponsable && (
            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-1">⚠️ Alerta de munición</p>
              <p className="text-white/70 text-sm">
                Según registros, <strong className="text-white">{reporteResponsable}</strong> fue el último agente en confirmar la munición completa en este puesto. Queda notificado como responsable de la falta.
              </p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mt-4 bg-white/3 border border-white/8 rounded-2xl p-4 space-y-5">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <ClipboardCheck className="w-3.5 h-3.5" /> Estado del turno
        </p>

        {/* ── Armamento ── */}
        {armamento && (
          <div>
            <p className="text-amber-300/70 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Arma {armamento.codigo}
            </p>
            <div className="flex gap-2 mb-2">
              {(["bueno", "necesita_reparacion"] as const).map(opt => (
                <button key={opt} onClick={() => setArmaEstado(opt)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    armaEstado === opt
                      ? opt === "bueno"
                        ? "bg-green-500/15 border-green-500/30 text-green-300"
                        : "bg-red-500/15 border-red-500/30 text-red-300"
                      : "bg-white/3 border-white/10 text-white/40 hover:text-white/60"
                  }`}>
                  {opt === "bueno" ? "✓ Buen estado" : "⚠ Necesita reparación"}
                </button>
              ))}
            </div>
            {armaEstado === "necesita_reparacion" && (
              <textarea value={armaObservacion} onChange={e => setArmaObservacion(e.target.value)}
                placeholder="Describe el problema o tipo de servicio que necesita..."
                rows={2}
                className="w-full bg-white/5 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-white/80 placeholder-white/20 resize-none outline-none focus:border-red-500/40" />
            )}

            {/* ── Sección exclusiva para supervisores: sugerir cambio de estado ── */}
            {tipoEfectivo === "supervisor" && (
              <div className="mt-3 pt-3 border-t border-amber-500/10">
                <p className="text-amber-400/50 text-xs font-semibold uppercase tracking-wide mb-2">
                  Sugerir cambio de estado (supervisor)
                </p>
                <div className="flex gap-2 mb-2">
                  {([
                    { key: null,       label: "Sin cambio",     color: "border-white/10 text-white/30" },
                    { key: "bodega",   label: "Enviar a bodega", color: "border-blue-500/30 text-blue-300 bg-blue-500/10" },
                    { key: "mal_estado", label: "Mal estado",   color: "border-orange-500/30 text-orange-300 bg-orange-500/10" },
                  ] as const).map(opt => (
                    <button key={String(opt.key)} onClick={() => setArmaSugerencia(opt.key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        armaSugerencia === opt.key
                          ? opt.color
                          : "bg-white/3 border-white/10 text-white/30 hover:text-white/50"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {armaSugerencia && (
                  <textarea value={armaSugerenciaObs} onChange={e => setArmaSugerenciaObs(e.target.value)}
                    placeholder="Observación de la sugerencia (opcional)..."
                    rows={2}
                    className="w-full bg-white/5 border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-white/80 placeholder-white/20 resize-none outline-none focus:border-amber-500/40" />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Munición ── */}
        {municion && (
          <div>
            <p className="text-orange-300/70 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Munición — {municion.cantidad_asignada} cartuchos {municion.descripcion}
            </p>
            <div className="flex gap-2 mb-2">
              {([true, false] as const).map(opt => (
                <button key={String(opt)} onClick={() => { setMunicionOk(opt); if (opt) setMunicionFaltante(0); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    municionOk === opt
                      ? opt
                        ? "bg-green-500/15 border-green-500/30 text-green-300"
                        : "bg-red-500/15 border-red-500/30 text-red-300"
                      : "bg-white/3 border-white/10 text-white/40 hover:text-white/60"
                  }`}>
                  {opt ? "✓ Completa" : "⚠ Falta munición"}
                </button>
              ))}
            </div>
            {!municionOk && (
              <div className="flex items-center gap-2 mt-2">
                <p className="text-white/50 text-xs shrink-0">¿Cuántos faltan?</p>
                <input type="number" min={1} max={municion.cantidad_asignada}
                  value={municionFaltante || ""}
                  onChange={e => setMunicionFaltante(Number(e.target.value))}
                  className="flex-1 bg-white/5 border border-red-500/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-red-500/40 text-center" />
                <p className="text-white/30 text-xs shrink-0">cartucho(s)</p>
              </div>
            )}
          </div>
        )}

        {/* ── Uniforme ── */}
        <div>
          <p className="text-blue-300/70 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Uniforme y equipo
          </p>
          <div className="flex gap-2 mb-3">
            {([true, false] as const).map(opt => (
              <button key={String(opt)} onClick={() => { setUniformeOk(opt); if (opt) setUniformeItems([]); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  uniformeOk === opt
                    ? opt
                      ? "bg-green-500/15 border-green-500/30 text-green-300"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    : "bg-white/3 border-white/10 text-white/40 hover:text-white/60"
                }`}>
                {opt ? "✓ Todo completo" : "Necesita dotación"}
              </button>
            ))}
          </div>

          {!uniformeOk && (
            <div className="space-y-2">
              {/* Botas (con tallas de bodega) */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => toggleUniformeItem("Botas", bodega_tallas_botas[0] ?? "")}
                      className={`w-4 h-4 rounded border transition-colors ${
                        uniformeItems.find(i => i.tipo === "Botas")
                          ? "bg-amber-500/30 border-amber-500/50" : "border-white/20"
                      }`}>
                      {uniformeItems.find(i => i.tipo === "Botas") && <CheckCircle className="w-4 h-4 text-amber-400" />}
                    </div>
                    <span className="text-xs text-white/70">Botas</span>
                  </label>
                  {uniformeItems.find(i => i.tipo === "Botas") && (
                    <select value={getItemTalla("Botas")} onChange={e => setItemTalla("Botas", e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 outline-none">
                      <option value="">Talla…</option>
                      {bodega_tallas_botas.length > 0
                        ? bodega_tallas_botas.map(t => <option key={t} value={t}>{t}</option>)
                        : ["35","36","37","38","39","40","41","42","43","44","45"].map(t => <option key={t} value={t}>{t}</option>)
                      }
                    </select>
                  )}
                </div>
                {bodega_tallas_botas.length === 0 && (
                  <p className="text-white/25 text-xs">Sin tallas registradas en bodega</p>
                )}
              </div>

              {/* Prendas de uniforme */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-2">
                {TIPOS_UNIFORME.map(tipoItem => (
                  <div key={tipoItem} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => toggleUniformeItem(tipoItem, bodega_tallas_uniforme[0] ?? "")}
                        className={`w-4 h-4 rounded border transition-colors ${
                          uniformeItems.find(i => i.tipo === tipoItem)
                            ? "bg-amber-500/30 border-amber-500/50" : "border-white/20"
                        }`}>
                        {uniformeItems.find(i => i.tipo === tipoItem) && <CheckCircle className="w-4 h-4 text-amber-400" />}
                      </div>
                      <span className="text-xs text-white/70">{tipoItem}</span>
                    </label>
                    {uniformeItems.find(i => i.tipo === tipoItem) && (
                      <select value={getItemTalla(tipoItem)} onChange={e => setItemTalla(tipoItem, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 outline-none">
                        <option value="">Talla…</option>
                        {bodega_tallas_uniforme.length > 0
                          ? bodega_tallas_uniforme.map(t => <option key={t} value={t}>{t}</option>)
                          : ["XS","S","M","L","XL","XXL"].map(t => <option key={t} value={t}>{t}</option>)
                        }
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Equipo del puesto (bodega) ── */}
        {equipoPuesto.length > 0 && (
          <div>
            <p className="text-teal-300/70 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Equipo del puesto ({equipoPuesto.length} {equipoPuesto.length === 1 ? "artículo" : "artículos"})
            </p>
            <div className="space-y-2">
              {equipoPuesto.map(item => {
                const nov = equipoNovedades[item.id];
                return (
                  <div key={item.id} className="bg-white/3 border border-white/8 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs text-white/70 font-semibold font-mono">{item.codigo}</p>
                        <p className="text-xs text-white/40 truncate">{item.descripcion}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {(["bueno", "novedad"] as const).map(opt => (
                          <button key={opt} onClick={() =>
                            setEquipoNovedades(prev => ({ ...prev, [item.id]: { ...prev[item.id], estado: opt, obs: prev[item.id]?.obs ?? "" } }))
                          } className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                            (nov?.estado ?? "bueno") === opt
                              ? opt === "bueno"
                                ? "bg-green-500/15 border-green-500/30 text-green-300"
                                : "bg-red-500/15 border-red-500/30 text-red-300"
                              : "bg-white/3 border-white/10 text-white/35 hover:text-white/60"
                          }`}>
                            {opt === "bueno" ? "✓ OK" : "⚠ Novedad"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {nov?.estado === "novedad" && (
                      <input value={nov.obs} onChange={e =>
                        setEquipoNovedades(prev => ({ ...prev, [item.id]: { ...prev[item.id], obs: e.target.value } }))
                      } placeholder="Descripción de la novedad..." className="w-full bg-white/5 border border-red-500/20 rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder-white/20 outline-none" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reporteError && <p className="text-red-400 text-xs">{reporteError}</p>}

        {!puedeEnviar && camposFaltantes.length > 0 && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-300/80 text-xs font-semibold mb-1.5">Faltan completar:</p>
            <ul className="space-y-0.5">
              {camposFaltantes.map((c, i) => (
                <li key={i} className="text-amber-200/50 text-xs flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-amber-500/60 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={() => enviarReporteTurno(fichajeId, tipo)} disabled={enviandoReporte || !puedeEnviar}
          className="w-full py-3 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/25 rounded-xl text-sm text-blue-300 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {enviandoReporte ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
          {enviandoReporte ? "Enviando..." : "Enviar reporte de turno"}
        </button>
      </div>
    );
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

        {/* ── DISPOSITIVO NO AUTORIZADO → TARJETA PÚBLICA DEL CARNET ──────── */}
        {estado === "device_invalido" && (
          <CarnetPublico
            info={agenteInfo}
            mensajeError={mensajeError}
          />
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
                {/* Reporte de turno del supervisor */}
                {agenteInfo && (agenteInfo.armamento || agenteInfo.municion) && fichajeIdParaReporte && (
                  <ReporteTurnoForm fichajeId={fichajeIdParaReporte} tipo="supervision" />
                )}
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

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Acción Disciplinaria</p>
                <div className="space-y-2 mb-3">
                  {[
                    { v: "", l: "Sin acción", color: "border-white/15 text-white/40" },
                    { v: "llamada_atencion_1", l: "Llamada de atención 1 (verbal)", color: "border-amber-500/30 text-amber-300" },
                    { v: "llamada_atencion_2", l: "Llamada de atención 2 (escrita)", color: "border-orange-500/30 text-orange-300" },
                    { v: "acta_administrativa", l: "Acta Administrativa", color: "border-red-500/30 text-red-300" },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setAccionDisciplinaria(opt.v)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-colors ${
                        accionDisciplinaria === opt.v
                          ? `${opt.color} bg-white/5`
                          : "border-white/8 text-white/40 hover:border-white/15"
                      }`}>
                      {opt.l}
                    </button>
                  ))}
                </div>

                {accionDisciplinaria && (
                  <div className="mb-4 space-y-3">
                    <div>
                      <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">
                        Notas de la acción <span className="text-red-400">*</span>
                      </p>
                      <textarea value={notasDisciplinarias} onChange={e => setNotasDisciplinarias(e.target.value)}
                        placeholder="Describa la situación: ej. 'El agente llegó en estado de ebriedad', 'No se presentó a sus labores'..."
                        rows={3}
                        className="w-full bg-white/5 border border-red-500/20 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 resize-none outline-none focus:border-red-500/40" />
                    </div>
                    <div>
                      <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">
                        Monto a descontar (Q) — opcional
                      </p>
                      <input type="number" min="0" step="0.01" value={amonestacionMonto}
                        onChange={e => setAmonestacionMonto(e.target.value)}
                        placeholder="0 = solo llamada de atención (sin descuento)"
                        className="w-full bg-white/5 border border-orange-500/20 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-orange-500/40" />
                      <p className="text-white/30 text-[11px] mt-1">
                        Si indicas un monto, se levantará una amonestación económica que se descontará en la próxima planilla. Sin monto, queda solo como llamada de atención registrada.
                      </p>
                    </div>
                  </div>
                )}

                {supervisionError && <p className="text-red-400 text-xs mb-3">{supervisionError}</p>}

                <button onClick={enviarSupervision} disabled={enviandoSupervision || (!!accionDisciplinaria && !notasDisciplinarias.trim())}
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
            {esMaestro && (estado === "listo_para_gps" || estado === "esperando_gps" || estado === "enviando") && (
              <button onClick={() => { setModoMaestro(null); setEstado("cargando_info"); setGpsCoords(null); }}
                className="absolute top-3 right-3 flex items-center gap-1 text-white/30 hover:text-white/60 text-xs">
                <RotateCcw className="w-3 h-3" /> Cambiar
              </button>
            )}

            {/* ── BOTÓN GPS (iOS requiere tap del usuario para mostrar el prompt) ── */}
            {estado === "listo_para_gps" && agenteInfo && (
              <div>
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-white font-semibold text-lg mb-1">{agenteInfo.nombre_completo}</p>
                <p className="text-white/30 text-xs mb-6">{hora} · {fecha}</p>
                <button
                  onClick={solicitarGPS}
                  className="w-full py-4 bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 border border-blue-500/40 rounded-2xl text-base text-blue-300 font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Registrar fichaje
                </button>
                <p className="text-white/20 text-xs mt-3">Se verificará tu ubicación al fichar</p>
                <button
                  onClick={() => setEstado("enviando")}
                  className="mt-3 w-full py-3 bg-white/4 hover:bg-white/8 border border-white/10 rounded-xl text-sm text-white/30 hover:text-white/50 font-medium transition-colors"
                >
                  Continuar sin ubicación
                </button>
              </div>
            )}

            {(estado === "esperando_gps" || estado === "enviando") && (
              <div>
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
                <p className="text-white font-semibold text-lg mb-1">
                  {estado === "esperando_gps" ? "Obteniendo ubicación..." : "Registrando fichaje..."}
                </p>
                {agenteInfo && <p className="text-white/50 text-sm mt-2">{agenteInfo.nombre_completo}</p>}
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

                <button onClick={() => { setGpsCoords(null); solicitarGPS(); }} className="mt-4 w-full py-3 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 rounded-xl text-sm text-blue-300 font-semibold transition-colors flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" /> Ya lo hice — Intentar de nuevo
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

                {/* ── Llegada tarde — aviso OBLIGATORIO antes de continuar ── */}
                {llegadaTarde && !tardanzaAck && (
                  <div className="mt-5 bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-red-400" />
                      </div>
                      <p className="text-red-300 font-bold text-sm uppercase tracking-wide">Registro de tardanza</p>
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed mb-3">
                      Su llegada se registró con <strong className="text-red-300">{llegadaTarde.minutos} minutos de retraso</strong> respecto a la hora programada de entrada al puesto.
                    </p>
                    <p className="text-white/60 text-sm leading-relaxed mb-4">
                      Este registro queda asentado en el <strong className="text-white/90">expediente de asistencia</strong> con fecha y hora exactas. La tardanza es reportada conforme a las disposiciones del <strong className="text-white/90">Ministerio de Trabajo y Previsión Social</strong> de la República de Guatemala.
                    </p>
                    <p className="text-red-300/80 text-xs font-semibold mb-4">
                      Al presionar el botón declara estar enterado de este registro.
                    </p>
                    <button onClick={() => setTardanzaAck(true)}
                      className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 rounded-xl text-sm text-red-300 font-bold transition-colors">
                      Entendido — continuar
                    </button>
                  </div>
                )}

                {/* Resto del contenido solo se muestra si no hay tardanza pendiente de ack */}
                {(!llegadaTarde || tardanzaAck) && (<>
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

                {/* Reporte de turno (paso 2) */}
                {(agenteInfo.armamento || agenteInfo.municion || equipoPuesto.length > 0) && !reporteAbierto && !reporteEnviado && (
                  <button onClick={() => setReporteAbierto(true)}
                    className="mt-4 w-full py-3 bg-slate-500/8 hover:bg-slate-500/15 border border-slate-500/20 rounded-xl text-sm text-white/50 hover:text-white/80 font-semibold transition-colors flex items-center justify-center gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Completar relevo — arma / munición / equipo / uniforme
                  </button>
                )}
                {reporteAbierto && fichajeIdParaReporte && (
                  <ReporteTurnoForm fichajeId={fichajeIdParaReporte} tipo="fichaje" />
                )}
                </>)}

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
                <button onClick={() => { setGpsCoords(null); solicitarGPS(); }} className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-colors">
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
