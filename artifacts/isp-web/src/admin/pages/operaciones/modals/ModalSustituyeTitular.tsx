import { useState } from "react";
import { Puesto, TitularCiclo, Agente } from "../types";

export function ModalSustituyeTitular({
  puesto,
  agente,
  onConfirm,
  onCancel,
}: {
  puesto: Puesto;
  agente: Agente;
  onConfirm: (titularSustituidoId: number, motivo: string, horaInstalacion: string) => void;
  onCancel: () => void;
}) {
  const t1 = puesto.par_trabajando;
  const t2 = puesto.par_descansando;
  const defaultId = t1?.employee_id ?? t2?.employee_id ?? 0;

  const [seleccionado, setSeleccionado] = useState<number>(defaultId);
  const [motivo, setMotivo] = useState("falta_total");
  const ahoraHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };
  const [hora, setHora] = useState(ahoraHHMM);

  const MOTIVOS_RAPIDOS = [
    { value: "falta_total",        label: "Falta total",                desc: "No se presentó sin justificación",               color: "text-red-300" },
    { value: "abandono_parcial",   label: "Abandono parcial",           desc: "Se retiró antes de terminar su turno",            color: "text-red-400" },
    { value: "permiso_sin_goce",   label: "Permiso s/goce",             desc: "Requiere aprobación RRHH",                        color: "text-yellow-300" },
    { value: "incapacidad",        label: "Incapacidad IGSS",           desc: "Genera evento RRHH para seguimiento de suspensión oficial", color: "text-orange-300" },
    { value: "permiso_con_goce",   label: "Permiso c/goce",             desc: "Duelo, matrimonio, etc.",                         color: "text-emerald-300" },
    { value: "relevo_completo",    label: "Relevo completo",            desc: "Cobertura programada, sin falta",                 color: "text-violet-300" },
  ];

  function TitularOpcion({ tc, label }: { tc: TitularCiclo; label: string }) {
    const activo = seleccionado === tc.employee_id;
    return (
      <button
        type="button"
        onClick={() => setSeleccionado(tc.employee_id)}
        className={`w-full text-left p-3 rounded-lg border transition-all ${
          activo
            ? "border-violet-500 bg-violet-500/20"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all ${
            activo ? "border-violet-400 bg-violet-400" : "border-white/30"
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{tc.nombre}</p>
            <p className={`text-[11px] font-medium ${label === "Trabaja hoy" ? "text-green-400" : "text-blue-400"}`}>
              {label}
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/8">
          <p className="text-[11px] text-white/40 uppercase tracking-widest mb-1">Relevo en {puesto.nombre}</p>
          <h2 className="text-lg font-bold text-white">¿A quién sustituye?</h2>
          <p className="text-xs text-white/50 mt-1">
            <span className="text-violet-300 font-medium">{agente.nombre_completo}</span> reemplazará al titular ausente
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Selección de titular */}
          <div className="space-y-2">
            {t1 && <TitularOpcion tc={t1} label="Trabaja hoy" />}
            {t2 && <TitularOpcion tc={t2} label="Descansa hoy" />}
          </div>

          {/* Motivo */}
          <div>
            <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wider">Motivo de ausencia</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MOTIVOS_RAPIDOS.map((m) => (
                <div key={m.value} className="relative group/tip">
                  <button
                    type="button"
                    onClick={() => setMotivo(m.value)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition-all ${
                      motivo === m.value
                        ? `${m.color} border-current bg-current/10`
                        : "text-white/40 border-white/10 hover:text-white/70 hover:border-white/20"
                    }`}
                  >
                    {m.label}
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-[#0d1117] border border-white/20 rounded-lg text-[10px] text-white/80 leading-snug whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-xl">
                    {m.desc}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20" />
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const sel = MOTIVOS_RAPIDOS.find(m => m.value === motivo);
              return sel ? (
                <p className="text-[10px] text-white/40 mt-1.5 leading-relaxed">{sel.desc}</p>
              ) : null;
            })()}
          </div>

          {/* Hora de instalación */}
          <div>
            <p className="text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wider">Hora de instalación</p>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-white/15 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!seleccionado}
            onClick={() => onConfirm(seleccionado, motivo, hora)}
            className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-semibold text-white transition-all"
          >
            Confirmar relevo
          </button>
        </div>
      </div>
    </div>
  );
}

