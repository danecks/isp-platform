import type { Periodo } from "./types";
import { PERIODO_LABEL } from "./constants";

/**
 * Selector de período (Hoy / 7d / 15d) usado por las vistas de Fichajes y
 * Rondas tanto en Portal como en Admin. Antes cada página tenía su propia
 * copia idéntica del JSX y el `PERIODO_LABEL`.
 */
interface Props {
  value: Periodo;
  onChange: (p: Periodo) => void;
  /** Variante visual:
   *  - `portal` (default): fondo oscuro azul, encaja con PortalLayout.
   *  - `admin`: fondo slate, encaja con AdminLayout.
   */
  variant?: "portal" | "admin";
}

export function PeriodoToggle({ value, onChange, variant = "portal" }: Props) {
  const wrap =
    variant === "portal"
      ? "flex gap-1 bg-[#0d1c30] border border-white/5 rounded-lg p-1"
      : "flex gap-1 bg-slate-900/40 border border-slate-800 rounded-lg p-1";
  const activeBtn = "bg-primary text-white font-semibold";
  const inactiveBtn =
    variant === "portal"
      ? "text-white/50 hover:text-white"
      : "text-slate-400 hover:text-white";

  return (
    <div className={wrap}>
      {(["hoy", "7d", "15d"] as Periodo[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            value === p ? activeBtn : inactiveBtn
          }`}
        >
          {PERIODO_LABEL[p]}
        </button>
      ))}
    </div>
  );
}
