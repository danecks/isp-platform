import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, MapPin, AlertTriangle, QrCode } from "lucide-react";

const API = "/api";

type EstadoScan = "cargando" | "esperando_gps" | "enviando" | "ok" | "fuera_de_rango" | "sin_gps" | "error" | "token_invalido";

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
  const [gpsListo, setGpsListo] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; precision: number } | null>(null);

  const token = new URLSearchParams(window.location.search).get("token");

  // 1. Verificar que el token es válido
  useEffect(() => {
    if (!token) { setEstado("token_invalido"); return; }

    fetch(`${API}/qr-rondas/scan/${token}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error || "Token inválido"); });
        return r.json();
      })
      .then(data => { setPuntoInfo(data); setEstado("esperando_gps"); })
      .catch(e => { setMensajeError(e.message); setEstado("token_invalido"); });
  }, [token]);

  // 2. Capturar GPS cuando el token es válido
  useEffect(() => {
    if (estado !== "esperando_gps") return;

    if (!navigator.geolocation) {
      setGpsListo(true);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        });
        setGpsListo(true);
      },
      () => { setGpsListo(true); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    const timer = setTimeout(() => setGpsListo(true), 8000);
    return () => { navigator.geolocation.clearWatch(id); clearTimeout(timer); };
  }, [estado]);

  // 3. Enviar escaneo cuando GPS esté listo (o timeout)
  useEffect(() => {
    if (!gpsListo || estado !== "esperando_gps") return;
    setEstado("enviando");

    const body: any = { token };
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
  }, [gpsListo, estado, gpsCoords, token]);

  const hora = new Date().toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" });
  const fecha = new Date().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4">
      {/* Logo/Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 mb-3">
          <QrCode className="w-6 h-6 text-blue-400" />
        </div>
        <p className="text-white/30 text-xs uppercase tracking-widest">ISP — Ronda de Seguridad</p>
      </div>

      {/* Tarjeta principal */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 text-center">

        {/* ── CARGANDO ── */}
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
            {estado === "esperando_gps" && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/30">
                <MapPin className="w-3.5 h-3.5" />
                <span>Asegúrate de tener el GPS activado</span>
              </div>
            )}
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
              <p className="text-xs text-red-400/80">
                Acércate más al punto de control e intenta de nuevo.
              </p>
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
              Activa el GPS para que se valide la proximidad.
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
