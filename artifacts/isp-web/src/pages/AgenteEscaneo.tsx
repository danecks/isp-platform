import { useEffect, useState } from "react";
import {
  CheckCircle, XCircle, Loader2, MapPin, AlertTriangle,
  QrCode, ShieldAlert, Star, ClipboardCheck, UserCheck,
} from "lucide-react";

const API = "/api";
const STORAGE_KEY = "isp_admin_session_v2";

function getSession(): { id: number; nombre: string; rol: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sessionHeader(): Record<string, string> {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  return { "x-isp-session": raw };
}

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface AgenteInfo {
  employee_id: number;
  nombre_completo: string;
  cargo: string;
  tipo_personal: string;
  dpi: string;
  puesto: { id: number; nombre: string; cliente_nombre: string; horario?: string; turno?: string } | null;
  gps: { latitud: number; longitud: number; radio_metros: number } | null;
  armamento: { codigo: string; descripcion: string } | null;
  ya_ficho_hoy: boolean;
}

type Modo = "fichaje" | "supervision";
type EstadoFichaje =
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

// ── Componente principal ───────────────────────────────────────────────────────
export default function AgenteEscaneo() {
  const token = new URLSearchParams(window.location.search).get("token");
  const session = getSession();
  const esSupervisor = session && ["admin", "supervisor", "operaciones"].includes(session.rol);

  const [agenteInfo, setAgenteInfo] = useState<AgenteInfo | null>(null);
  const [modo, setModo] = useState<Modo>(esSupervisor ? "supervision" : "fichaje");
  const [estado, setEstado] = useState<EstadoFichaje>("cargando_info");
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

  const hora = new Date().toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
  const fecha = new Date().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" });

  // 1. Cargar info del agente
  useEffect(() => {
    if (!token) { setEstado("token_invalido"); return; }
    fetch(`${API}/agente/scan/${token}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error || "Token inválido"); });
        return r.json();
      })
      .then((data: AgenteInfo) => {
        setAgenteInfo(data);
        if (data.ya_ficho_hoy && modo === "fichaje") {
          setEstado("ya_fichado");
        } else {
          setEstado("esperando_gps");
        }
      })
      .catch(e => { setMensajeError(e.message); setEstado("token_invalido"); });
  }, [token]);

  // 2. GPS para fichaje
  useEffect(() => {
    if (modo !== "fichaje" || estado !== "esperando_gps") return;

    if (!navigator.geolocation) { setEstado("enviando"); return; }

    let settled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return; settled = true;
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) });
        setEstado("enviando");
      },
      (err) => {
        if (settled) return; settled = true;
        if (err.code === 1) { setEstado("gps_denegado"); }
        else { setEstado("enviando"); }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [estado, modo]);

  // 3. Enviar fichaje
  useEffect(() => {
    if (modo !== "fichaje" || estado !== "enviando") return;

    const body: Record<string, unknown> = { token };
    if (gpsCoords) { body.latitud = gpsCoords.lat; body.longitud = gpsCoords.lng; body.precision_metros = gpsCoords.precision; }

    fetch(`${API}/agente/fichaje`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error === "ya_registrado") { setEstado("ya_fichado"); return; }
        if (data.error === "fuera_de_zona") { setDistanciaRes(data.distancia_metros); setEstado("fuera_de_zona"); return; }
        if (data.ok) {
          setDistanciaRes(data.distancia_metros);
          if (data.resultado === "fuera_de_zona") setEstado("fuera_de_zona");
          else if (data.resultado === "sin_gps") setEstado("sin_gps");
          else setEstado("ok");
        } else {
          setMensajeError(data.error || "Error desconocido");
          setEstado("error");
        }
      })
      .catch(() => { setMensajeError("Error al conectar con el servidor"); setEstado("error"); });
  }, [estado, gpsCoords, token, modo]);

  // ── Enviar supervisión ─────────────────────────────────────────────────────
  async function enviarSupervision() {
    if (!session) return;
    setEnviandoSupervision(true);
    setSupervisionError("");
    try {
      const res = await fetch(`${API}/agente/supervision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ token, checks, calificacion: calificacion || null, observaciones }),
      });
      const data = await res.json();
      if (data.ok) { setSupervisionOk(true); }
      else { setSupervisionError(data.error || "Error guardando supervisión"); }
    } catch {
      setSupervisionError("Error de conexión");
    } finally {
      setEnviandoSupervision(false);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function AgenteCard() {
    if (!agenteInfo) return null;
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">{agenteInfo.nombre_completo}</p>
            <p className="text-white/50 text-xs mt-0.5">{agenteInfo.cargo || agenteInfo.tipo_personal}</p>
            {agenteInfo.puesto && (
              <p className="text-blue-300/80 text-xs mt-1">
                {agenteInfo.puesto.nombre} — {agenteInfo.puesto.cliente_nombre}
              </p>
            )}
          </div>
        </div>
        {agenteInfo.armamento && (
          <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/40 flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>Arma: <span className="text-amber-300/80">{agenteInfo.armamento.codigo}</span> — {agenteInfo.armamento.descripcion}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Modo selector (solo si es supervisor) ─────────────────────────────────
  function ModoSelector() {
    if (!esSupervisor || estado === "token_invalido") return null;
    return (
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setModo("fichaje"); if (agenteInfo?.ya_ficho_hoy) setEstado("ya_fichado"); else setEstado("esperando_gps"); }}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            modo === "fichaje"
              ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
              : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
          }`}
        >
          Fichaje
        </button>
        <button
          onClick={() => setModo("supervision")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            modo === "supervision"
              ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
              : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
          }`}
        >
          Supervisión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 mb-3">
          <QrCode className="w-6 h-6 text-blue-400" />
        </div>
        <p className="text-white/30 text-xs uppercase tracking-widest">ISP — Credencial de Agente</p>
        {esSupervisor && (
          <p className="text-purple-400/60 text-xs mt-1">Sesión: {session!.nombre}</p>
        )}
      </div>

      <div className="w-full max-w-sm">
        <ModoSelector />

        {/* ─────────────── MODO SUPERVISIÓN ─────────────────────────────── */}
        {modo === "supervision" && (
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
                {agenteInfo && <AgenteCard />}

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-3">Lista de verificación</p>
                <div className="space-y-2 mb-4">
                  {(Object.keys(DEFAULT_CHECKS) as Array<keyof SupervisionChecks>).map(key => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => setChecks(c => ({ ...c, [key]: !c[key] }))}
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                          checks[key]
                            ? "bg-green-500/20 border-green-500/40"
                            : "border-white/15 group-hover:border-white/30"
                        }`}
                      >
                        {checks[key] && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                      </div>
                      <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{CHECK_LABELS[key]}</span>
                    </label>
                  ))}
                </div>

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Calificación</p>
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setCalificacion(calificacion === n ? 0 : n)}>
                      <Star className={`w-7 h-7 transition-colors ${n <= calificacion ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
                    </button>
                  ))}
                </div>

                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Observaciones</p>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Ingresa tus observaciones..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 resize-none outline-none focus:border-purple-500/40 mb-4"
                />

                {supervisionError && (
                  <p className="text-red-400 text-xs mb-3">{supervisionError}</p>
                )}

                <button
                  onClick={enviarSupervision}
                  disabled={enviandoSupervision}
                  className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-sm text-purple-300 font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {enviandoSupervision ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  {enviandoSupervision ? "Guardando..." : "Guardar Supervisión"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─────────────── MODO FICHAJE ─────────────────────────────────── */}
        {modo === "fichaje" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">

            {/* CARGANDO */}
            {(estado === "cargando_info" || estado === "esperando_gps" || estado === "enviando") && (
              <div>
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
                <p className="text-white font-semibold text-lg mb-1">
                  {estado === "cargando_info" ? "Verificando credencial..." :
                   estado === "esperando_gps" ? "Obteniendo ubicación..." :
                   "Registrando fichaje..."}
                </p>
                {agenteInfo && (
                  <p className="text-white/50 text-sm mt-2">{agenteInfo.nombre_completo}</p>
                )}
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

            {/* YA FICHADO HOY */}
            {estado === "ya_fichado" && (
              <div>
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-blue-400 font-bold text-xl mb-1">Ya fichaste hoy</p>
                {agenteInfo && <p className="text-white font-semibold mt-3">{agenteInfo.nombre_completo}</p>}
                <p className="text-white/50 text-sm mt-2">{fecha}</p>
                <p className="text-white/20 text-xs mt-4">Tu fichaje de entrada ya fue registrado</p>
              </div>
            )}

            {/* GPS DENEGADO */}
            {estado === "gps_denegado" && (
              <div>
                <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8 text-orange-400" />
                </div>
                <p className="text-orange-400 font-bold text-xl mb-2">Ubicación bloqueada</p>
                <p className="text-white/60 text-sm mt-2 leading-relaxed">
                  El fichaje <strong className="text-white">no fue registrado</strong>. Necesitamos tu ubicación para validar que estás en el puesto.
                </p>
                <div className="mt-4 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 text-left">
                  <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide mb-2">📱 iPhone / iPad</p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Ve a <strong className="text-white">Ajustes</strong> del iPhone:<br />
                    <strong className="text-white/80">Privacidad y Seguridad</strong> → <strong className="text-white/80">Localización</strong> → <strong className="text-white/80">Safari</strong> → <strong className="text-white">Al usar la app</strong>
                  </p>
                  <p className="text-xs text-white/30 mt-1">⚠️ El menú AA de Safari no es suficiente — hazlo desde Ajustes del sistema.</p>
                </div>
                <div className="mt-2 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 text-left">
                  <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide mb-2">🤖 Android</p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    <strong className="text-white/80">Ajustes</strong> → <strong className="text-white/80">Aplicaciones</strong> → <strong className="text-white/80">Chrome</strong> → <strong className="text-white/80">Permisos</strong> → <strong className="text-white/80">Ubicación</strong> → <strong className="text-white">Permitir</strong>
                  </p>
                </div>
                <button onClick={() => window.location.reload()} className="mt-4 w-full py-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-xl text-sm text-orange-300 hover:text-orange-200 font-medium transition-colors">
                  Ya la activé — Intentar de nuevo
                </button>
              </div>
            )}

            {/* OK */}
            {estado === "ok" && agenteInfo && (
              <div>
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-green-400 font-bold text-xl mb-1">Fichaje Registrado</p>
                <p className="text-white text-base font-semibold mt-3">{agenteInfo.nombre_completo}</p>
                {agenteInfo.puesto && (
                  <p className="text-white/50 text-sm">{agenteInfo.puesto.nombre} — {agenteInfo.puesto.cliente_nombre}</p>
                )}
                <p className="text-white/40 text-sm mt-2">{hora} — {fecha}</p>
                {distanciaRes != null && agenteInfo.gps && (
                  <div className="mt-4 bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                    <p className="text-xs text-green-400/80">
                      Distancia al puesto: <strong>{distanciaRes}m</strong> (radio: {agenteInfo.gps.radio_metros}m)
                    </p>
                  </div>
                )}
                <p className="text-white/20 text-xs mt-4">Puedes cerrar esta ventana</p>
              </div>
            )}

            {/* FUERA DE ZONA */}
            {estado === "fuera_de_zona" && agenteInfo && (
              <div>
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 font-bold text-xl mb-1">Fuera del Área</p>
                <p className="text-white/60 text-sm mt-2">
                  Estás a <strong className="text-white">{distanciaRes}m</strong> del puesto.<br />
                  El radio permitido es de <strong className="text-white">{agenteInfo.gps?.radio_metros}m</strong>.
                </p>
                <p className="text-white font-semibold mt-4">{agenteInfo.nombre_completo}</p>
                <p className="text-white/40 text-sm">{hora} — {fecha}</p>
                <div className="mt-4 bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <p className="text-xs text-red-400/80">Acércate al puesto e intenta de nuevo.</p>
                </div>
                <button onClick={() => { setEstado("esperando_gps"); setGpsCoords(null); }} className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-colors">
                  Intentar de nuevo
                </button>
              </div>
            )}

            {/* SIN GPS */}
            {estado === "sin_gps" && agenteInfo && (
              <div>
                <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                </div>
                <p className="text-yellow-400 font-bold text-xl mb-1">Fichaje sin GPS</p>
                <p className="text-white/60 text-sm mt-2">
                  El fichaje fue registrado pero <strong className="text-white">sin datos de ubicación</strong>.
                </p>
                <p className="text-white font-semibold mt-4">{agenteInfo.nombre_completo}</p>
                <p className="text-white/40 text-sm">{hora} — {fecha}</p>
              </div>
            )}

            {/* TOKEN INVÁLIDO / ERROR */}
            {(estado === "token_invalido" || estado === "error") && (
              <div>
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-red-400 font-bold text-xl mb-1">
                  {estado === "token_invalido" ? "Código no válido" : "Error de conexión"}
                </p>
                <p className="text-white/50 text-sm mt-2">
                  {mensajeError || (estado === "token_invalido"
                    ? "Este código QR no es reconocido o fue desactivado."
                    : "No se pudo conectar con el servidor. Intenta de nuevo.")}
                </p>
                {estado === "error" && (
                  <button onClick={() => window.location.reload()} className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-colors">
                    Reintentar
                  </button>
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
