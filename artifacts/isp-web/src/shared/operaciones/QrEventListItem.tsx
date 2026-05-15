import { Clock, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { fmtFechaHora } from "./formatters";

/**
 * Fila de evento QR usada por las listas de Fichajes y Rondas.
 *
 * Las dos pantallas mostraban el mismo patrón: avatar circular con ícono según
 * resultado (ok/warn), nombre principal, una etiqueta tipo chip, fila inferior
 * con fuente y timestamp + distancia opcional. Mover acá elimina ~50 líneas
 * duplicadas por pantalla y garantiza que ambos flujos se vean iguales.
 */

interface Props {
  /** Color del avatar circular: `ok` verde, `warn` amarillo. */
  resultado: "ok" | string;
  /** Ícono dentro del avatar (CheckCircle2/AlertCircle/QrCode, etc). */
  icono: ReactNode;
  /** Texto principal: nombre del agente, del puesto, etc. */
  titulo: string;
  /** Etiqueta opcional tipo chip (tipo de fichaje, nombre de ronda...). */
  chip?: string | null;
  /** Texto secundario izquierdo (puesto del fichaje / agente que escaneó). */
  subtituloIzq?: string | null;
  /** Timestamp ISO del evento. */
  cuando: string;
  /** Distancia al punto, en metros (opcional). */
  distanciaMetros?: number | null;
}

export function QrEventListItem({
  resultado, icono, titulo, chip, subtituloIzq, cuando, distanciaMetros,
}: Props) {
  const okColor = resultado === "ok"
    ? "bg-green-400/10 text-green-400"
    : "bg-yellow-400/10 text-yellow-400";
  return (
    <div className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${okColor}`}>
          {icono}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white font-medium">{titulo}</span>
            {chip && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20">
                {chip}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50 mt-1 flex-wrap">
            {subtituloIzq && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {subtituloIzq}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {fmtFechaHora(cuando)}
            </span>
            {distanciaMetros != null && (
              <span className="text-white/30">{distanciaMetros}m del punto</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
