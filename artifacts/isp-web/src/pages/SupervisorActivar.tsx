import { useEffect, useState } from "react";
import { Smartphone, CheckCircle, XCircle, Loader2, ShieldCheck, MapPin } from "lucide-react";

const API = "/api";
const DEVICE_KEY = "isp_device";

export default function SupervisorActivar() {
  const params = new URLSearchParams(window.location.search);
  const device_uuid = params.get("uuid");
  const device_token = params.get("token");

  const [estado, setEstado] = useState<"validando" | "ok" | "error" | "params_invalidos">("validando");
  const [info, setInfo] = useState<{
    tipo: string;
    supervisor_nombre: string;
    descripcion: string;
    puesto_nombre?: string;
    cliente_nombre?: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!device_uuid || !device_token) {
      setEstado("params_invalidos");
      return;
    }

    fetch(`${API}/supervisor-devices/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_uuid, device_token }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) { setError(data.error || "Dispositivo no válido"); setEstado("error"); return; }
        localStorage.setItem(DEVICE_KEY, JSON.stringify({ uuid: device_uuid, token: device_token }));
        setInfo(data);
        setEstado("ok");
      })
      .catch(() => { setError("Error de conexión al validar el dispositivo"); setEstado("error"); });
  }, []);

  const tipoLabel = info?.tipo === "puesto" ? "Teléfono de Puesto" : "Teléfono de Supervisor";
  const tipoColor = info?.tipo === "puesto" ? "blue" : "purple";

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-700/50 border border-white/10 mb-4">
          <Smartphone className="w-7 h-7 text-white/60" />
        </div>
        <p className="text-white/30 text-xs uppercase tracking-widest">ISP — Activación de Dispositivo</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">

          {/* VALIDANDO */}
          {estado === "validando" && (
            <div>
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
              <p className="text-white font-semibold">Validando dispositivo...</p>
            </div>
          )}

          {/* OK */}
          {estado === "ok" && info && (
            <div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
                tipoColor === "blue"
                  ? "bg-blue-500/10 border border-blue-500/30"
                  : "bg-purple-500/10 border border-purple-500/30"
              }`}>
                {info.tipo === "puesto"
                  ? <MapPin className="w-8 h-8 text-blue-400" />
                  : <ShieldCheck className="w-8 h-8 text-purple-400" />
                }
              </div>

              <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                tipoColor === "blue"
                  ? "bg-blue-500/15 text-blue-300 border border-blue-500/20"
                  : "bg-purple-500/15 text-purple-300 border border-purple-500/20"
              }`}>
                {tipoLabel}
              </div>

              <p className="text-white font-bold text-xl mb-1">{info.supervisor_nombre}</p>
              {info.descripcion && <p className="text-white/50 text-sm mb-3">{info.descripcion}</p>}

              {info.tipo === "puesto" && info.puesto_nombre && (
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 mb-4">
                  <p className="text-blue-300/80 text-sm">
                    Puesto: <strong>{info.puesto_nombre}</strong>
                    {info.cliente_nombre && <span className="text-blue-300/50"> · {info.cliente_nombre}</span>}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 justify-center mb-5">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-green-400 font-semibold">Dispositivo activado</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left text-xs text-white/40 space-y-1.5">
                <p>✓ Este teléfono queda registrado para uso {info.tipo === "puesto" ? "de fichaje en puesto" : "de supervisión"}</p>
                <p>✓ No compartas esta URL con nadie</p>
                <p>✓ Para revocar el acceso, el administrador debe desactivar el dispositivo</p>
              </div>

              <p className="text-white/20 text-xs mt-5">Ya puedes cerrar esta ventana y escanear credenciales QR</p>
            </div>
          )}

          {/* ERROR */}
          {(estado === "error" || estado === "params_invalidos") && (
            <div>
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 font-bold text-xl mb-2">Activación fallida</p>
              <p className="text-white/50 text-sm leading-relaxed">
                {estado === "params_invalidos"
                  ? "El enlace de activación es inválido o incompleto."
                  : error === "Dispositivo sin token configurado" || error === "Dispositivo inactivo"
                    ? "Este enlace ya no es válido. El dispositivo fue desactivado o el enlace venció."
                  : error === "Dispositivo no válido" || error.includes("token")
                    ? "El token del enlace es incorrecto o ya fue utilizado."
                  : error || "No se pudo validar el dispositivo."}
              </p>
              <div className="mt-5 bg-white/5 border border-white/10 rounded-xl p-4 text-left text-xs text-white/30 space-y-1.5">
                <p>→ Pide al administrador que cree un nuevo enlace de activación</p>
                <p>→ El enlace de activación es de un solo uso — no lo compartas</p>
                <p>→ Si el dispositivo fue revocado, debe registrarse nuevamente</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-white/15 text-xs mt-8 text-center">ISP — Investigaciones y Seguridad Profesional S.A.</p>
    </div>
  );
}
