import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle, XCircle, Loader2, MapPin, AlertTriangle, QrCode, ShieldAlert, RotateCcw } from "lucide-react";

const API = "/api";
const SCANNER_ID = "isp-agente-scanner";

type Estado =
  | "inicio"
  | "escaneando"
  | "esperando_gps"
  | "gps_denegado"
  | "enviando"
  | "ok"
  | "error";

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

export default function AgenteInicio() {
  const [estado, setEstado] = useState<Estado>("inicio");
  const [mensajeError, setMensajeError] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carnetToken, setCarnetToken] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Detener scanner al desmontar o al cambiar de estado
  const detenerScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* noop */ }
      try { scannerRef.current.clear(); } catch { /* noop */ }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => () => { void detenerScanner(); }, [detenerScanner]);

  // Iniciar escaneo con cámara trasera
  const iniciarEscaneo = useCallback(async () => {
    setMensajeError("");
    setResultado(null);
    setEstado("escaneando");
    // Esperar a que el div esté en el DOM
    await new Promise(r => setTimeout(r, 50));
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          // Extraer token: el QR puede ser una URL o el token solo
          let token = decoded.trim();
          try {
            const u = new URL(token);
            token = u.searchParams.get("token") || u.pathname.split("/").pop() || token;
          } catch { /* no es URL, asumimos token directo */ }
          setCarnetToken(token);
          void detenerScanner();
          solicitarGPS(token);
        },
        () => { /* scan fail por frame, ignorar */ }
      );
    } catch (err) {
      setMensajeError(
        err instanceof Error
          ? `No se pudo acceder a la cámara: ${err.message}`
          : "No se pudo acceder a la cámara"
      );
      setEstado("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detenerScanner]);

  // Solicitar GPS y enviar al backend
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
          pos.coords.latitude,
          pos.coords.longitude,
          Math.round(pos.coords.accuracy)
        );
      },
      (err) => {
        if (settled) return;
        settled = true;
        if (err.code === 1) { setEstado("gps_denegado"); return; }
        // timeout u otro: enviar sin GPS
        enviar(token, null, null, null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviar = useCallback(async (
    token: string,
    lat: number | null,
    lng: number | null,
    precision: number | null
  ) => {
    setEstado("enviando");
    try {
      const r = await fetch(`${API}/agente/iniciar-turno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: token,
          latitud: lat,
          longitud: lng,
          precision_metros: precision,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMensajeError(data.mensaje || data.error || "Error al iniciar turno");
        setEstado("error");
        return;
      }
      setResultado(data);
      setEstado("ok");
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : "Error de red");
      setEstado("error");
    }
  }, []);

  const reiniciar = useCallback(async () => {
    await detenerScanner();
    setCarnetToken(null);
    setResultado(null);
    setMensajeError("");
    setEstado("inicio");
  }, [detenerScanner]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#060e1c] border-b border-slate-800 px-4 py-4 flex items-center gap-3">
        <img src="/images/logo-isp.png" alt="ISP" className="h-10 w-10 rounded" />
        <div>
          <div className="font-bold leading-tight">ISP, S.A.</div>
          <div className="text-xs text-slate-400">Inicio de turno</div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
        {estado === "inicio" && (
          <div className="space-y-6 text-center pt-8">
            <div className="mx-auto w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center">
              <QrCode className="w-12 h-12 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Iniciar tu turno</h1>
              <p className="text-slate-400 mt-2 text-sm">
                Escanea el QR de tu carnet para registrar el inicio de tu servicio del día.
              </p>
            </div>
            <button
              onClick={iniciarEscaneo}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <QrCode className="w-5 h-5" /> Escanear mi carnet
            </button>
            <p className="text-xs text-slate-500">
              Necesitarás permitir el uso de la cámara y el GPS.
            </p>
          </div>
        )}

        {estado === "escaneando" && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-slate-300">Apunta la cámara al QR de tu carnet</p>
            </div>
            <div id={SCANNER_ID} className="w-full overflow-hidden rounded-lg bg-black aspect-square" />
            <button
              onClick={reiniciar}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg text-sm"
            >
              Cancelar
            </button>
          </div>
        )}

        {estado === "esperando_gps" && (
          <div className="text-center pt-12 space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-400" />
            <p className="text-slate-300">Obteniendo tu ubicación…</p>
            <p className="text-xs text-slate-500">Si tu navegador pide permiso, aceptá.</p>
          </div>
        )}

        {estado === "gps_denegado" && (
          <div className="text-center pt-8 space-y-4">
            <ShieldAlert className="w-14 h-14 mx-auto text-amber-400" />
            <h2 className="text-xl font-bold">GPS denegado</h2>
            <p className="text-sm text-slate-300">
              Para iniciar tu turno necesitamos tu ubicación. Activá el GPS en los ajustes
              del teléfono y volvé a intentar.
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

        {estado === "enviando" && (
          <div className="text-center pt-12 space-y-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-400" />
            <p className="text-slate-300">Registrando tu inicio de turno…</p>
          </div>
        )}

        {estado === "ok" && resultado && (
          <div className="space-y-5 pt-2">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto text-emerald-400" />
              <h2 className="text-2xl font-bold mt-3">¡Turno iniciado!</h2>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(resultado.registrado_en).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Agente</div>
                <div className="font-semibold">{resultado.agente.nombre}</div>
                {resultado.agente.cargo && (
                  <div className="text-xs text-slate-400">{resultado.agente.cargo}</div>
                )}
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
                  <span className="text-emerald-400">
                    Ubicación verificada ({resultado.distancia_metros} m del puesto)
                  </span>
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
              <RotateCcw className="w-4 h-4" /> Listo
            </button>
          </div>
        )}

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
          </div>
        )}
      </main>

      <footer className="px-4 py-3 text-center text-[11px] text-slate-600 border-t border-slate-900">
        ISP, S.A. · Investigaciones y Seguridad Profesional
      </footer>
    </div>
  );
}
