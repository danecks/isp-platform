import { useState } from "react";
import { Shield, CheckCircle2, Star } from "lucide-react";

function QrCode() {
  return (
    <img
      src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=ISP-AGT-2024-0147-TOKEN-f5c3d13c&color=000000&bgcolor=ffffff&margin=4"
      alt="QR del agente"
      width={160}
      height={160}
      className="rounded-lg"
    />
  );
}

export function AgenteCredencial() {
  const [side, setSide] = useState<"front" | "back">("front");

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 gap-6">
      <p className="text-zinc-400 text-xs uppercase tracking-widest">Credencial del Agente</p>

      {side === "front" ? (
        <div className="w-full max-w-[340px] bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-zinc-700 overflow-hidden shadow-2xl">
          {/* Header strip */}
          <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-3 flex items-center gap-3">
            <Shield className="w-5 h-5 text-white" />
            <div>
              <p className="text-white text-xs font-bold tracking-widest uppercase">ISP</p>
              <p className="text-indigo-200 text-[10px] leading-none">Investigaciones y Seguridad Profesional</p>
            </div>
            <span className="ml-auto bg-green-400/20 border border-green-400/40 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              ACTIVO
            </span>
          </div>

          {/* Body */}
          <div className="px-5 py-5 flex gap-4 items-start">
            {/* Photo */}
            <div className="w-20 h-24 bg-zinc-700 rounded-xl overflow-hidden flex-shrink-0 flex items-end justify-center">
              <div className="w-full flex flex-col items-center">
                <div className="w-10 h-10 bg-zinc-500 rounded-full mb-0" />
                <div className="w-14 h-8 bg-zinc-600 rounded-t-2xl" />
              </div>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base leading-tight">Carlos A.</p>
              <p className="text-white font-bold text-base leading-tight">Rodríguez Vega</p>
              <p className="text-indigo-300 text-xs mt-1">Agente de Seguridad</p>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[10px] w-6">ID</span>
                  <span className="text-zinc-200 text-[11px] font-mono">AGT-2024-0147</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[10px] w-6">CÉD</span>
                  <span className="text-zinc-200 text-[11px] font-mono">1-234-5678</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[10px] w-6">CAL</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-2.5 h-2.5 ${i <= 4 ? "text-yellow-400 fill-yellow-400" : "text-zinc-600"}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-zinc-700" />

          {/* Puesto actual */}
          <div className="px-5 py-3">
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Puesto asignado</p>
            <p className="text-zinc-200 text-sm font-medium">Banco Nacional — Torre Central</p>
            <p className="text-zinc-400 text-xs">Turno: 06:00 – 18:00 hs</p>
          </div>

          {/* Footer */}
          <div className="bg-zinc-900/60 px-5 py-3 flex items-center justify-between">
            <p className="text-zinc-600 text-[9px]">Válido 2024 · No transferible</p>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[340px] bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-zinc-700 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-white" />
            <p className="text-white text-xs font-bold tracking-widest uppercase">Escanear para verificar</p>
          </div>

          <div className="flex flex-col items-center justify-center py-8 px-6 gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-lg">
              <QrCode />
            </div>
            <div className="text-center">
              <p className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1">Token del agente</p>
              <p className="text-zinc-300 text-[11px] font-mono break-all">f5c3d13c-ebe0-47e1-bfc5-c5b633ee</p>
            </div>
            <div className="bg-indigo-900/40 border border-indigo-700/40 rounded-xl px-4 py-3 w-full text-center">
              <p className="text-indigo-300 text-xs leading-relaxed">
                Presentar al supervisor o teléfono del puesto al ingresar al turno
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/60 px-5 py-3 text-center">
            <p className="text-zinc-600 text-[9px]">ISP S.A. · No válido sin holograma de seguridad</p>
          </div>
        </div>
      )}

      {/* Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setSide("front")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            side === "front"
              ? "bg-indigo-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Frente
        </button>
        <button
          onClick={() => setSide("back")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            side === "back"
              ? "bg-indigo-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          QR del agente
        </button>
      </div>

      <p className="text-zinc-600 text-[10px] text-center max-w-[280px]">
        El reverso de la credencial contiene el QR único del agente para fichaje y supervisión
      </p>
    </div>
  );
}
