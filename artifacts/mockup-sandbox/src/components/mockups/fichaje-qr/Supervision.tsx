import { useState } from "react";
import { CheckCircle2, Star, Shield, MapPin, ClipboardList } from "lucide-react";

type Stage = "form" | "saved";

interface Check {
  id: string;
  label: string;
  desc: string;
}

const CHECKS: Check[] = [
  { id: "uniforme", label: "Uniforme completo", desc: "Camisa, pantalón, botas, gorra ISP" },
  { id: "gafete", label: "Gafete y credencial", desc: "Porta credencial visible" },
  { id: "armamento", label: "Armamento portado", desc: "Conforme a la asignación de hoy" },
  { id: "equipo", label: "Equipo operativo", desc: "Radio, linterna, esposas" },
  { id: "actitud", label: "Presentación / actitud", desc: "Trato profesional, higiene" },
  { id: "puesto", label: "Conoce el puesto", desc: "Sabe protocolos y contactos" },
];

export function Supervision() {
  const [stage, setStage] = useState<Stage>("form");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [obs, setObs] = useState("");

  const toggle = (id: string) =>
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));

  const passed = Object.values(checks).filter(Boolean).length;
  const total = CHECKS.length;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold">Supervisión de Turno</p>
          <p className="text-slate-400 text-[10px]">Sup. María González · Región Central</p>
        </div>
        <div className="bg-indigo-900/50 border border-indigo-700/50 px-2 py-0.5 rounded-full">
          <p className="text-indigo-300 text-[10px] font-medium">Autenticado</p>
        </div>
      </div>

      {/* Explanation banner */}
      <div className="bg-indigo-950/60 border-b border-indigo-900/40 px-4 py-2 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0 text-[10px] text-white font-bold">i</div>
        <p className="text-indigo-300 text-[11px] leading-snug">
          Pantalla abierta automáticamente al escanear la credencial del agente
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {stage === "form" && (
          <div className="p-4 space-y-4">
            {/* GPS status */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-xs">GPS verificado · 28 m del puesto Torre Central B1</p>
            </div>

            {/* Guard info */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="bg-indigo-900/40 border-b border-slate-800 px-4 py-2">
                <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider">Agente a supervisar</p>
              </div>
              <div className="px-4 py-3 flex gap-3 items-center">
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex flex-col items-center justify-end overflow-hidden flex-shrink-0">
                  <div className="w-6 h-6 bg-slate-500 rounded-full" />
                  <div className="w-10 h-4 bg-slate-600 rounded-t-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Carlos A. Rodríguez</p>
                  <p className="text-indigo-300 text-xs">Agente de Seguridad · AGT-2024-0147</p>
                  <div className="flex gap-3 mt-1.5">
                    <div>
                      <p className="text-slate-500 text-[10px]">Puesto</p>
                      <p className="text-slate-200 text-xs">Torre Central B1</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px]">Turno</p>
                      <p className="text-slate-200 text-xs">06:00 – 18:00</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-white text-sm font-semibold">Lista de verificación</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  passed === total ? "bg-green-900/50 text-green-400" : "bg-slate-800 text-slate-400"
                }`}>
                  {passed}/{total}
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {CHECKS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                      checks[c.id] ? "bg-green-600 border-green-600" : "border-slate-600"
                    }`}>
                      {checks[c.id] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${checks[c.id] ? "text-white" : "text-slate-300"}`}>
                        {c.label}
                      </p>
                      <p className="text-slate-500 text-[10px]">{c.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4">
              <p className="text-white text-sm font-semibold mb-3">Calificación general</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star className={`w-8 h-8 transition-colors ${
                      n <= (hoverRating || rating) ? "text-yellow-400 fill-yellow-400" : "text-slate-600"
                    }`} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-slate-400 text-xs mt-2">
                  {["", "Deficiente", "Regular", "Aceptable", "Bueno", "Excelente"][rating]}
                </p>
              )}
            </div>

            {/* Observations */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4">
              <p className="text-white text-sm font-semibold mb-3">Observaciones</p>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Notas sobre el agente, situación del puesto, incidentes..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder:text-slate-600 resize-none focus:outline-none focus:border-indigo-600 transition-colors"
                rows={3}
              />
              <p className="text-slate-600 text-[10px] mt-1 text-right">{obs.length}/500</p>
            </div>

            <button
              onClick={() => setStage("saved")}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-sm transition-colors"
            >
              Guardar supervisión
            </button>
            <div className="h-4" />
          </div>
        )}

        {stage === "saved" && (
          <div className="flex flex-col items-center justify-center p-6 gap-5 min-h-[560px]">
            <div className="w-20 h-20 rounded-full bg-green-900/40 border-2 border-green-500/60 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-green-400 text-xl font-bold mb-1">Supervisión guardada</p>
              <p className="text-slate-400 text-sm">El registro quedó archivado en el sistema</p>
            </div>
            <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Agente</span>
                <span className="text-white text-sm font-medium">Carlos Rodríguez</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Supervisor</span>
                <span className="text-slate-200 text-xs">María González</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Checklist</span>
                <span className="text-green-400 text-xs font-medium">{passed}/{total} ítems ✓</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Calificación</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= rating ? "text-yellow-400 fill-yellow-400" : "text-slate-700"}`} />
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">GPS</span>
                <span className="text-green-400 text-xs">28 m del puesto ✓</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Timestamp</span>
                <span className="text-slate-400 text-xs">7 abr 2025 · 07:23 AM</span>
              </div>
            </div>
            <button
              onClick={() => { setStage("form"); setChecks({}); setRating(0); setObs(""); }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-2xl text-sm transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Demo nav */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2">
        <div className="flex gap-2 justify-center">
          {(["form", "saved"] as Stage[]).map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-all ${
                stage === s ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {s === "form" ? "Formulario" : "Guardado"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
