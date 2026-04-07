import { useState } from "react";
import { MapPin, CheckCircle2, XCircle, AlertTriangle, Shield, Clock, Loader2 } from "lucide-react";

type Stage = "gps" | "ok" | "duplicate" | "rejected";

const STAGE_LABELS: Record<Stage, string> = {
  gps: "Verificando GPS",
  ok: "Confirmado",
  duplicate: "Ya registrado",
  rejected: "Fuera de zona",
};

export function FichajePuesto() {
  const [stage, setStage] = useState<Stage>("gps");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar — puesto context */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">Puesto: Torre Central — Entrada B1</p>
          <p className="text-gray-500 text-[10px]">Banco Nacional S.A.</p>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-green-400 text-[10px]">GPS activo</span>
        </div>
      </div>

      {/* Explanation banner */}
      <div className="bg-indigo-950/60 border-b border-indigo-900/40 px-4 py-2 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0 text-[10px] text-white font-bold">i</div>
        <p className="text-indigo-300 text-[11px] leading-snug">
          Esta pantalla abre automáticamente al escanear la credencial del agente con la cámara
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-5 gap-5">

        {/* Agent card — always visible */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="bg-indigo-900/40 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
            <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider">Agente escaneado</p>
            <span className="text-gray-500 text-[10px] font-mono">AGT-2024-0147</span>
          </div>
          <div className="px-4 py-4 flex gap-4 items-center">
            <div className="w-14 h-14 bg-gray-700 rounded-xl flex flex-col items-center justify-end overflow-hidden flex-shrink-0">
              <div className="w-7 h-7 bg-gray-500 rounded-full mb-0" />
              <div className="w-11 h-5 bg-gray-600 rounded-t-xl" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">Carlos A. Rodríguez</p>
              <p className="text-indigo-300 text-xs">Agente de Seguridad</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <div>
                  <p className="text-gray-500 text-[10px]">Turno</p>
                  <p className="text-gray-200 text-xs font-medium">06:00 – 18:00 hs</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px]">Armamento</p>
                  <p className="text-yellow-300 text-xs font-medium">Revólver .38 · ARM-0092</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GPS status */}
        {stage === "gps" && (
          <div className="bg-gray-900 border border-yellow-900/40 rounded-2xl px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-yellow-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">Verificando ubicación…</p>
                <p className="text-gray-400 text-xs">Comprobando que el puesto está dentro del radio</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <p className="text-gray-300 text-xs">Credencial válida ✓</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <p className="text-gray-300 text-xs">Obteniendo GPS del dispositivo…</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-600" />
                <p className="text-gray-500 text-xs">Calcular distancia al puesto</p>
              </div>
            </div>
          </div>
        )}

        {stage === "ok" && !confirmed && (
          <>
            <div className="bg-gray-900 border border-green-900/40 rounded-2xl px-4 py-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <p className="text-green-400 text-sm font-semibold">Ubicación verificada</p>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Distancia al puesto</span>
                <span className="text-green-400 text-xs font-medium">12 m ✓ (radio: 50 m)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Turno asignado</span>
                <span className="text-gray-200 text-xs">Hoy 06:00 – 18:00 hs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Hora actual</span>
                <span className="text-gray-200 text-xs">05:58 AM · 7 abr 2025</span>
              </div>
            </div>
            <button
              onClick={() => setConfirmed(true)}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-2xl text-base transition-colors shadow-lg shadow-green-900/30"
            >
              Confirmar ingreso al turno
            </button>
          </>
        )}

        {stage === "ok" && confirmed && (
          <div className="bg-green-950/40 border border-green-800/40 rounded-2xl px-4 py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <p className="text-green-400 text-lg font-bold">¡Fichaje registrado!</p>
            <p className="text-gray-400 text-sm">El ingreso de Carlos Rodríguez fue confirmado</p>
            <div className="text-gray-500 text-xs mt-1">
              <p>Hoy · 05:58 AM · Torre Central B1</p>
              <p className="mt-0.5">GPS: 12 m del puesto</p>
            </div>
          </div>
        )}

        {stage === "duplicate" && (
          <div className="bg-orange-950/30 border border-orange-900/40 rounded-2xl px-4 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0" />
              <div>
                <p className="text-orange-400 font-semibold">Ya registrado hoy</p>
                <p className="text-gray-400 text-xs">Este agente ya fichó entrada en este turno</p>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl px-3 py-2.5 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Fichaje previo</span>
                <span className="text-orange-300 text-xs">Hoy · 05:58 AM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Puesto</span>
                <span className="text-gray-300 text-xs">Torre Central B1</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs text-center">Si hay un error, contacta al supervisor</p>
          </div>
        )}

        {stage === "rejected" && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-2xl px-4 py-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-semibold">Fuera de zona</p>
                <p className="text-gray-400 text-xs">No estás dentro del radio del puesto</p>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl px-3 py-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Tu ubicación</span>
                <span className="text-red-400 text-sm font-bold">340 m del puesto</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Radio permitido</span>
                <span className="text-gray-300 text-xs">50 m</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs text-center">El fichaje no fue registrado. Debes estar físicamente en el puesto.</p>
          </div>
        )}

        <div className="flex-1" />

        {/* Timestamp footer */}
        <div className="flex items-center justify-center gap-2 text-gray-700">
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">Lunes 7 de abril 2025 · 05:58 AM</span>
        </div>
      </div>

      {/* Demo nav */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-2.5">
        <p className="text-gray-600 text-[10px] text-center mb-1.5">Demo — resultado del escaneo:</p>
        <div className="flex gap-1.5 justify-center flex-wrap">
          {(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStage(s); setConfirmed(false); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                stage === s ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
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
