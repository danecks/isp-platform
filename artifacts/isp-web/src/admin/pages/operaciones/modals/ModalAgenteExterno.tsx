import { useState } from "react";
import { UserPlus, X, Banknote, AlertTriangle } from "lucide-react";
import { Puesto } from "../types";

interface Props {
  puesto: Puesto;
  onConfirm: (externoNombre: string, externoDpi: string, jornada?: string) => void | Promise<void>;
  onClose: () => void;
}

export function ModalAgenteExterno({ puesto, onConfirm, onClose }: Props) {
  const [nombre, setNombre] = useState("");
  const [dpi, setDpi] = useState("");
  const [enviando, setEnviando] = useState(false);

  const esCustodia = puesto.es_custodia === true;
  // Custodios: jornada fija 12h. Guardias: 24h si es par 24x24 o jornada/turno indica 24, si no 12h.
  const jornadaRaw = String((puesto as any).jornada ?? (puesto as any).turno_nombre ?? (puesto as any).turno ?? "");
  const es24 = !esCustodia && (puesto.es_par_24x24 === true || /24/.test(jornadaRaw));
  const jornada = es24 ? "24h" : "12h";
  const monto = es24 ? 300 : 150;

  const nombreLimpio = nombre.trim();
  const dpiLimpio = dpi.trim();
  const dpiValido = /^\d{6,20}$/.test(dpiLimpio);
  const puedeEnviar = nombreLimpio.length >= 3 && dpiValido && !enviando;

  async function handleConfirm() {
    if (!puedeEnviar) return;
    setEnviando(true);
    try {
      await onConfirm(nombreLimpio, dpiLimpio, jornada);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-500/10 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white">Cubrir con agente externo</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-white/80">
          <p className="text-xs text-white/50">
            Cubre <span className="font-semibold text-white/80">{puesto.nombre}</span>{" "}
            con una persona ajena a la planilla. Se registra la cobertura del día y se le paga su hora
            extra <span className="text-teal-300 font-semibold">en efectivo</span>, fuera de la planilla legal.
          </p>

          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1">Nombre completo</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={150}
              placeholder="Nombre y apellidos del agente externo"
              className="w-full bg-[#04090f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1">DPI</label>
            <input
              value={dpi}
              onChange={(e) => setDpi(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              maxLength={20}
              placeholder="Número de DPI (solo dígitos)"
              className="w-full bg-[#04090f] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/40"
            />
            {dpiLimpio.length > 0 && !dpiValido && (
              <p className="text-[10px] text-red-400 mt-1">El DPI debe tener al menos 6 dígitos.</p>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-teal-500/8 border border-teal-500/20 rounded-lg">
            <Banknote className="w-4 h-4 text-teal-300 shrink-0" />
            <p className="text-xs text-teal-200/90">
              Turno <span className="font-semibold">{jornada}</span> — HE en efectivo{" "}
              <span className="font-bold text-teal-300">Q{monto.toFixed(2)}</span>
            </p>
          </div>

          <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/80">
              La falta del titular conserva su alerta a RRHH; esta cobertura no genera amonestación
              automática.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5">
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-xs font-semibold text-white/60 hover:text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!puedeEnviar}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:bg-white/10 disabled:text-white/30 rounded-lg px-4 py-1.5 transition-colors"
          >
            <UserPlus className="w-3 h-3" /> {enviando ? "Registrando…" : "Cubrir y pagar HE"}
          </button>
        </div>
      </div>
    </div>
  );
}
