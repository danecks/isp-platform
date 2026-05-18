import type { CalibracionCheque, FormatoCheque } from "./helpers/calibracionCheque";

// Panel de ajuste fino de coordenadas para cheques.
// Sólo se muestra cuando el usuario está por imprimir cheques.
export function CalibracionPanel({
  formato, cal, onChange,
}: {
  formato: FormatoCheque;
  cal: CalibracionCheque;
  onChange: (c: CalibracionCheque) => void;
}) {
  const set = (k: keyof CalibracionCheque, v: number) => onChange({ ...cal, [k]: v });
  const Num = ({ label, k, step = 0.5 }: { label: string; k: keyof CalibracionCheque; step?: number }) => (
    <label className="flex items-center justify-between gap-2 text-xs text-[#8bacc8]">
      <span>{label}</span>
      <input
        type="number" step={step} value={cal[k]}
        onChange={e => set(k, parseFloat(e.target.value) || 0)}
        className="w-20 bg-[#0a1628] border border-[#1e3a5f] rounded px-1.5 py-0.5 text-white text-xs"
      />
    </label>
  );
  return (
    <div className="space-y-3 bg-[#0a1628]/60 border border-[#1e3a5f] rounded p-3">
      <div className="text-xs text-amber-300 font-medium">
        Calibración (mm) — se guarda automáticamente
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Offset X" k="offsetX" />
        <Num label="Offset Y" k="offsetY" />
        {formato === "continuo" && <Num label="Alto cheque" k="altoCheque" step={1} />}
        <div />
        <Num label="Fecha X" k="fechaX" />
        <Num label="Fecha Y" k="fechaY" />
        <Num label="Beneficiario X" k="beneficiarioX" />
        <Num label="Beneficiario Y" k="beneficiarioY" />
        <Num label="Monto Nº X" k="montoNumeroX" />
        <Num label="Monto Nº Y" k="montoNumeroY" />
        <Num label="Monto letras X" k="montoLetrasX" />
        <Num label="Monto letras Y" k="montoLetrasY" />
      </div>
      <div className="text-[10px] text-[#8bacc8]/70">
        Imprimí 1 cheque de prueba. Si el texto cayó 2mm más arriba de lo debido,
        aumentá "Offset Y" en 2. Si cayó 3mm a la izquierda, aumentá "Offset X" en 3.
      </div>
    </div>
  );
}
