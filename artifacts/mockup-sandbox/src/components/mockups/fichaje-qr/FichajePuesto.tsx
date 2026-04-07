import { useState } from "react";
import { Camera, MapPin, CheckCircle2, XCircle, Clock, AlertTriangle, Scan, ChevronRight } from "lucide-react";

type Stage = "idle" | "scanning" | "gps" | "ok" | "duplicate" | "rejected";

const STAGES: Stage[] = ["idle", "scanning", "gps", "ok", "duplicate", "rejected"];
const STAGE_LABELS: Record<Stage, string> = {
  idle: "En espera",
  scanning: "Escaneando",
  gps: "Verificando GPS",
  ok: "Agente confirmado",
  duplicate: "Ya registrado",
  rejected: "Fuera de zona",
};

export function FichajePuesto() {
  const [stage, setStage] = useState<Stage>("idle");

  const next = () => {
    const idx = STAGES.indexOf(stage);
    setStage(STAGES[(idx + 1) % STAGES.length]);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Status bar */}
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-gray-300 text-xs font-medium">Puesto: Torre Central B1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-green-400" />
          <span className="text-green-400 text-[10px]">GPS activo</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {stage === "idle" && (
          <>
            <div className="w-24 h-24 rounded-full bg-indigo-900/40 border-2 border-indigo-600/40 flex items-center justify-center">
              <Camera className="w-10 h-10 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-bold mb-2">Fichaje de Turno</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Escanea la credencial del agente para registrar su ingreso al puesto
              </p>
            </div>
            <div className="w-full bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Turno actual</p>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-indigo-400" />
                <div>
                  <p className="text-white text-sm font-semibold">06:00 – 18:00 hs</p>
                  <p className="text-gray-400 text-xs">Lunes · 7 de abril 2025</p>
                </div>
              </div>
            </div>
            <div className="w-full bg-indigo-600/10 border border-indigo-600/30 rounded-2xl p-4 flex items-center gap-3">
              <Scan className="w-6 h-6 text-indigo-400 flex-shrink-0" />
              <p className="text-indigo-300 text-sm">
                Espera a que el agente presente su credencial con el QR
              </p>
            </div>
          </>
        )}

        {stage === "scanning" && (
          <>
            <div className="relative w-56 h-56 rounded-2xl overflow-hidden bg-gray-900 border-2 border-indigo-500">
              {/* Fake camera view */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
              {/* Scan line */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-indigo-400 rounded-xl relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400 rounded-br-sm" />
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-indigo-400/60" style={{animation: 'none'}} />
                </div>
              </div>
            </div>
            <p className="text-white font-semibold">Apunta al QR de la credencial</p>
            <p className="text-gray-400 text-sm text-center">Mantén el código dentro del marco para escanearlo</p>
          </>
        )}

        {stage === "gps" && (
          <>
            <div className="w-24 h-24 rounded-full bg-yellow-900/30 border-2 border-yellow-600/40 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-yellow-400" />
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-bold mb-2">Verificando ubicación</p>
              <p className="text-gray-400 text-sm">Comprobando que estás dentro del radio del puesto…</p>
            </div>
            <div className="w-full space-y-3">
              {[
                { label: "QR del agente", status: "ok", value: "Carlos Rodríguez · AGT-2024-0147" },
                { label: "Ubicación del escáner", status: "checking", value: "Obteniendo GPS…" },
                { label: "Radio del puesto", status: "waiting", value: "50 metros configurados" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.status === "ok" ? "bg-green-400" :
                    item.status === "checking" ? "bg-yellow-400 animate-pulse" :
                    "bg-gray-600"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-400 text-[10px] uppercase tracking-wide">{item.label}</p>
                    <p className="text-gray-200 text-xs truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {stage === "ok" && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-900/40 border-2 border-green-500/60 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-green-400 text-lg font-bold">¡Ingreso autorizado!</p>
              <p className="text-gray-400 text-sm mt-1">El agente ha sido verificado</p>
            </div>

            {/* Guard card */}
            <div className="w-full bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="bg-indigo-800/50 px-4 py-3 border-b border-gray-800">
                <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider">Agente verificado</p>
              </div>
              <div className="px-4 py-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Nombre</span>
                  <span className="text-white text-sm font-semibold">Carlos Rodríguez</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">ID</span>
                  <span className="text-gray-200 text-xs font-mono">AGT-2024-0147</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Turno asignado</span>
                  <span className="text-gray-200 text-xs">06:00 – 18:00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Armamento</span>
                  <span className="text-yellow-300 text-xs font-medium">Revólver .38 · ARM-0092</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Distancia GPS</span>
                  <span className="text-green-400 text-xs">12 m del puesto ✓</span>
                </div>
              </div>
            </div>

            <button className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl text-sm transition-colors">
              Confirmar ingreso al turno
            </button>
            <p className="text-gray-600 text-[10px] text-center">Registro: lunes 7 abr 2025 · 05:58 AM</p>
          </>
        )}

        {stage === "duplicate" && (
          <>
            <div className="w-20 h-20 rounded-full bg-orange-900/30 border-2 border-orange-600/40 flex items-center justify-center">
              <AlertTriangle className="w-9 h-9 text-orange-400" />
            </div>
            <div className="text-center">
              <p className="text-orange-400 text-lg font-bold">Ya registrado hoy</p>
              <p className="text-gray-400 text-sm mt-1">Este agente ya fichó entrada en este turno</p>
            </div>
            <div className="w-full bg-gray-900 border border-orange-900/40 rounded-2xl px-4 py-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Agente</span>
                <span className="text-white text-sm font-medium">Carlos Rodríguez</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Fichaje registrado</span>
                <span className="text-orange-300 text-xs">Hoy · 05:58 AM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Puesto</span>
                <span className="text-gray-300 text-xs">Torre Central B1</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs text-center">Si hay un error, contacta al supervisor</p>
          </>
        )}

        {stage === "rejected" && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-900/30 border-2 border-red-600/40 flex items-center justify-center">
              <XCircle className="w-9 h-9 text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-red-400 text-lg font-bold">Fuera de zona</p>
              <p className="text-gray-400 text-sm mt-1">El escáner no está dentro del radio del puesto</p>
            </div>
            <div className="w-full bg-gray-900 border border-red-900/40 rounded-2xl px-4 py-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Distancia detectada</span>
                <span className="text-red-400 text-sm font-bold">340 m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Radio permitido</span>
                <span className="text-gray-300 text-xs">50 m</span>
              </div>
              <div className="h-px bg-gray-800" />
              <p className="text-gray-500 text-xs text-center">El fichaje no fue registrado. Debes estar físicamente en el puesto.</p>
            </div>
          </>
        )}
      </div>

      {/* Navigation demo bar */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-3">
        <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-2 text-center">Demo — ver pantalla:</p>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                stage === s
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
