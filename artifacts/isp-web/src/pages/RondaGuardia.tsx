import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, MapPin, AlertTriangle, QrCode, ShieldAlert } from "lucide-react";

const API = "/api";

type EstadoScan =
  | "cargando"
  | "listo_para_gps"
  | "esperando_gps"
  | "gps_denegado"
  | "enviando"
  | "ok"
  | "fuera_de_rango"
  | "sin_gps"
  | "error"
  | "token_invalido";

interface PuntoInfo {
  id: number;
  nombre: string;
  descripcion?: string;
  radio_metros: number;
  ronda_nombre: string;
}

interface ResultadoScan {
  resultado: string;
  distancia_metros: number | null;
  radio_metros: number;
  nombre_punto: string;
}

export default function RondaGuardia() {
  const [estado, setEstado] = useState<EstadoScan>("cargando");
  const [puntoInfo, setPuntoInfo] = useState<PuntoInfo | null>(null);
  const [resultado, setResultado] = useState<ResultadoScan | null>(null);
  const [mensajeError, setMensajeError] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; precision: number } | null>(null);

  const token = new URLSearchParams(window.location.search).get("token");

  // 1. Verificar que el token es válido — luego esperar gesto del usuario para GPS
  useEffect(() => {
    if (!token) { setEstado("token_invalido"); return; }

    fetch(`${API}/qr-rondas/scan/${token}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error || "Token inválido"); });
        return r.json();
      })
      .then(data => { setPuntoInfo(data); setEstado("listo_para_gps"); })
      .catch(e => { setMensajeError(e.message); setEstado("token_invalido"); });
  }, [token]);

  // 2. Solicitar GPS — siempre llamado desde un tap del usuario (iOS requiere gesto)
  const solicitarGPS = useCallback(() => {
    if (!navigator.geolocation) { setEstado("enviando"); return; }
    setEstado("esperando_gps");
    let settled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) });
        setEstado("enviando");
      },
      (err) => {
        if (settled) return;
        settled = true;
        if (err.code === 1) setEstado("gps_denegado");
        else setEstado("enviando");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  // 2b. Escuchar cambios de permiso — si el usuario activa GPS en Ajustes y vuelve,
  //     volvemos a "listo_para_gps" para que el botón vuelva a aparecer.
  useEffect(() => {
    if (estado !== "gps_denegado") return;
    if (!navigator.permissions) return;
    let removed = false;
    navigator.permissions.query({ name: "geolocation" as PermissionName })
      .then(status => {
        const handleChange = () => {
          if (!removed && status.state !== "denied") setEstado("listo_para_gps");
        };
        status.addEventListener("change", handleChange);
        return () => { removed = true; status.removeEventListener("change", handleChange); };
      })
      .catch(() => {});
  }, [estado]);

  // 3. Enviar escaneo cuando el estado cambia a "enviando"
  useEffect(() => {
    if (estado !== "enviando") return;

    const body: Record<string, unknown> = { token };
    if (gpsCoords) {
      body.latitud = gpsCoords.lat;
      body.longitud = gpsCoords.lng;
      body.precision_metros = gpsCoords.precision;
    }

    fetch(`${API}/qr-rondas/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(data => {
        setResultado(data);
        if (data.resultado === "ok") setEstado("ok");
        else if (data.resultado === "fuera_de_rango") setEstado("fuera_de_rango");
        else setEstado("sin_gps");
      })
      .catch(() => { setMensajeError("Error al conectar con el servidor"); setEstado("error"); });
  }, [estado, gpsCoords, token]);

  const hora = new Date().toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
  const fecha = new Date().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" });

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
      <div className="text-center mb-8 mt-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 mb-3">
          <QrCode className="w-6 h-6 text-blue-400" />
        </div>
        <p className="text-white/30 text-xs uppercase tracking-widest">ISP — Ronda de Seguridad</p>
      </div>

      {/* Tarjeta principal */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 text-center">

        {/* ── CARGANDO / ENVIANDO ── */}
        {(estado === "cargando" || estado === "enviando" || estado === "esperando_gps") && (
          <div>
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
            <p className="text-white font-semibold text-lg mb-1">
              {estado === "cargando" ? "Verificando código..." :
               estado === "esperando_gps" ? "Obteniendo ubicación..." :
               "Registrando marcación..."}
            </p>
            {puntoInfo && (
              <p className="text-white/50 text-sm mt-2">{puntoInfo.ronda_nombre} — {puntoInfo.nombre}</p>
            )}
          </div>
        )}

        {/* ── LISTO PARA GPS — botón explícito (necesario para iOS Safari) ── */}
        {estado === "listo_para_gps" && puntoInfo && (
          <div>
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-white font-semibold text-lg mb-1">{puntoInfo.nombre}</p>
            <p className="text-white/40 text-sm mb-1">{puntoInfo.ronda_nombre}</p>
            <p className="text-white/25 text-xs mb-6">{hora} · {fecha}</p>

            <button
              onClick={solicitarGPS}
              className="w-full py-4 bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 border border-blue-500/40 rounded-2xl text-base text-blue-300 font-bold transition-colors flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" />
              Compartir mi ubicación
            </button>
            <p className="text-white/20 text-xs mt-3">El sistema verificará que estás en el punto de control</p>

            <button
              onClick={() => setEstado("enviando")}
              className="mt-3 w-full py-3 bg-white/4 hover:bg-white/8 border border-white/10 rounded-xl text-sm text-white/35 hover:text-white/55 font-medium transition-colors"
            >
              Registrar sin ubicación
            </button>
            <p className="text-white/15 text-xs mt-1">La marcación queda sin validación de distancia</p>
          </div>
        )}

        {/* ── GPS DENEGADO ── */}
        {estado === "gps_denegado" && (
          <div>
            <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-orange-400 font-bold text-xl mb-2">Ubicación bloqueada</p>
            <p className="text-white/60 text-sm mt-2 leading-relaxed">
              El dispositivo no compartió la ubicación. Sigue los pasos:
            </p>

            {/* iOS */}
            <div className="mt-4 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 text-left space-y-3">
              <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide">📱 iPhone — Safari</p>
              <div>
                <p className="text-xs text-white/70 font-semibold mb-0.5">Paso 1 — Permiso de Safari:</p>
                <p className="text-xs text-white/55 leading-relaxed">
                  <strong className="text-white/80">Ajustes → Privacidad y Seguridad → Localización → Safari</strong> → elige <strong className="text-orange-300">Al usar la app</strong>
                </p>
              </div>
              <div>
                <p className="text-xs text-white/70 font-semibold mb-0.5">Paso 2 — Permiso del sitio:</p>
                <p className="text-xs text-white/55 leading-relaxed">
                  En esa pantalla toca <strong className="text-white/80">Acceso a Sitios Web</strong> → busca la dirección de la app → <strong className="text-orange-300">Permitir</strong>
                </p>
              </div>
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg p-2.5">
                <p className="text-xs text-amber-300/80 font-semibold mb-0.5">¿Ya hiciste los pasos y sigue sin funcionar?</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  Cierra Safari completamente (desliza la app hacia arriba en el multitarea), vuelve a escanear el QR y toca el botón azul.
                </p>
              </div>
            </div>

            {/* Android */}
            <div className="mt-2 bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 text-left">
              <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide mb-2">🤖 Android — Chrome</p>
              <p className="text-xs text-white/55 leading-relaxed">
                Toca el ícono de candado en la barra de direcciones → <strong className="text-white/80">Permisos → Ubicación → Permitir</strong>
              </p>
            </div>

            <button
              onClick={solicitarGPS}
              className="mt-4 w-full py-3 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 rounded-xl text-sm text-blue-300 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" /> Ya lo hice — Intentar de nuevo
            </button>

            <button
              onClick={() => setEstado("enviando")}
              className="mt-3 w-full py-3 bg-white/4 hover:bg-white/8 border border-white/10 rounded-xl text-sm text-white/40 hover:text-white/60 font-medium transition-colors"
            >
              Registrar sin GPS
            </button>
            <p className="text-xs text-white/15 mt-1.5 text-center">La marcación queda sin validación de distancia</p>
          </div>
        )}

        {/* ── OK ── */}
        {estado === "ok" && resultado && (
          <div>
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-green-400 font-bold text-xl mb-1">Marcación Registrada</p>
            <p className="text-white text-base font-semibold mt-3">{resultado.nombre_punto}</p>
            <p className="text-white/40 text-sm mt-1">{hora} — {fecha}</p>
            {resultado.distancia_metros != null && (
              <div className="mt-4 bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                <p className="text-xs text-green-400/80">
                  Distancia al punto: <strong>{resultado.distancia_metros}m</strong>{" "}
                  (radio: {resultado.radio_metros}m)
                </p>
              </div>
            )}
            <p className="text-white/20 text-xs mt-4">Puedes cerrar esta ventana</p>
          </div>
        )}

        {/* ── FUERA DE RANGO ── */}
        {estado === "fuera_de_rango" && resultado && (
          <div>
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 font-bold text-xl mb-1">Fuera de Rango</p>
            <p className="text-white/60 text-sm mt-2">
              Estás a <strong className="text-white">{resultado.distancia_metros}m</strong> del punto.<br />
              El radio permitido es de <strong className="text-white">{resultado.radio_metros}m</strong>.
            </p>
            <p className="text-white text-base font-semibold mt-4">{resultado.nombre_punto}</p>
            <p className="text-white/40 text-sm">{hora} — {fecha}</p>
            <div className="mt-4 bg-red-500/5 border border-red-500/15 rounded-xl p-3">
              <p className="text-xs text-red-400/80">Acércate más al punto de control e intenta de nuevo.</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-colors"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* ── SIN GPS ── */}
        {estado === "sin_gps" && (
          <div>
            <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-yellow-400 font-bold text-xl mb-1">Marcación sin GPS</p>
            <p className="text-white/60 text-sm mt-2">
              La marcación fue registrada pero <strong className="text-white">sin datos de ubicación</strong>.
              Activa el GPS del dispositivo para que se valide la proximidad.
            </p>
            <p className="text-white text-base font-semibold mt-4">{puntoInfo?.nombre}</p>
            <p className="text-white/40 text-sm">{hora} — {fecha}</p>
          </div>
        )}

        {/* ── TOKEN INVÁLIDO / ERROR ── */}
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
              <button
                onClick={() => window.location.reload()}
                className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-colors"
              >
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-white/15 text-xs mt-6 text-center">
        ISP — Investigaciones y Seguridad Profesional S.A.
      </p>
    </div>
  );
}
