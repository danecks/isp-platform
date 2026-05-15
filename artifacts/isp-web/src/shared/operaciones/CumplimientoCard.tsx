import { CheckCircle2, AlertCircle } from "lucide-react";
import { fmtFechaHora } from "./formatters";

/**
 * Card de cumplimiento agregada por puntos QR, usada en:
 *   - PortalFichajes (cobertura de fichajes por puesto)
 *   - PortalRondas   (cumplimiento de rondas por punto)
 *
 * Antes cada página tenía un JSX casi idéntico con el mismo grid 1/2 columnas,
 * el mismo header con el porcentaje grande a la derecha y los mismos íconos
 * de check/alert. Centralizar evita drift de estilo entre las dos pantallas.
 */

interface Item {
  id: number;
  nombre: string;
  conteo: number;            // total fichajes / escaneos
  ultimo: string | null;
  /** Etiqueta singular ("fichaje" / "escaneo") usada para pluralizar. */
  unidad: string;
}

interface Props {
  titulo: string;            // "Cobertura de fichajes" / "Cumplimiento de rondas"
  pct: number | null;
  totalAgregado: number;     // p.ej. puestos_con_fichaje
  totalUniverso: number;     // p.ej. total_puestos
  agregadoLabel: string;     // p.ej. "puestos" o "puntos QR"
  items: Item[];
}

export function CumplimientoCard({
  titulo, pct, totalAgregado, totalUniverso, agregadoLabel, items,
}: Props) {
  return (
    <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{pct ?? 0}%</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">
            {totalAgregado} de {totalUniverso} {agregadoLabel}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-xs text-white truncate">{it.nombre}</p>
              <p className="text-[10px] text-white/40">
                {it.conteo} {it.unidad}{it.conteo !== 1 ? "s" : ""}
                {it.ultimo && ` · último ${fmtFechaHora(it.ultimo)}`}
              </p>
            </div>
            {it.conteo > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-400/60 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
