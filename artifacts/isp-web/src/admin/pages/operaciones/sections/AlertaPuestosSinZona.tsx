import { AlertTriangle } from "lucide-react";
import { useOperacionesContext } from "../OperacionesContext";

export function AlertaPuestosSinZona() {
  const { puestosSinZonaCount, esSupervisorOAdmin } = useOperacionesContext();
  if (puestosSinZonaCount === 0 || !esSupervisorOAdmin) return null;
  return (
    <div className="shrink-0 flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-2.5">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-300">
          {puestosSinZonaCount} puesto{puestosSinZonaCount !== 1 ? "s" : ""} sin zona operativa
        </p>
        <p className="text-[10px] text-amber-400/60 mt-0.5">
          Los nuevos puestos requieren zona. Asigna zona a los puestos existentes desde{" "}
          <a href="/admin/operaciones/zonas" className="underline hover:text-amber-300 transition-colors">
            Zonas Operativas
          </a>{" "}
          para activar el sistema de recomendación.
        </p>
      </div>
    </div>
  );
}
