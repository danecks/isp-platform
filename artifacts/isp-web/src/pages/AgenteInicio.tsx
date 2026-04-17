import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  CheckCircle, XCircle, Loader2, MapPin, AlertTriangle,
  QrCode, ShieldAlert, RotateCcw, Smartphone, Users, Clock,
} from "lucide-react";

const API = "/api";
const SCANNER_ID = "isp-agente-scanner";
const DEVICE_KEY = "isp_device";          // mismo key que SupervisorActivar
const AUTO_RESET_MS = 8000;                // tiempo de éxito antes de volver al inicio (modo kiosco)

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

  // Modo kiosco: si hay credenciales de dispositivo en localStorage
  const [device] = useState<DeviceCreds | null>(() => leerDeviceCreds());
  const esKiosco = device !== null;
  const [puestoDelDia, setPuestoDelDia] = useState<PuestoDelDia | null>(null);
  const [errorKiosco, setErrorKiosco] = useState<string | null>(null);

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
    setEstado("escaneando");
    await new Promise(r => setTimeout(r, 50));
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
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
      setEstado("ok");
      // Modo kiosco: refrescar lista en segundo plano
      if (esKiosco) void cargarPuestoDelDia();
    } catch (e) {
      setMensajeError(e instanceof Error ? e.message : "Error de red");
      setEstado("error");
    }
  }, [device, esKiosco, cargarPuestoDelDia]);

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
    if (estado !== "ok" && estado !== "error") return;
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
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-slate-300">Apuntá la cámara al QR del carnet</p>
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

        {/* OK */}
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
