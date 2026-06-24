import { Truck } from "lucide-react";
import { Puesto } from "../types";
import { CustodiaSlotItem } from "./CustodiaSlotItem";

export function CustodiaGrupo({
  slots,
  isAgenteSeleccionado,
  onPuestoClick,
  onLiberar,
  onRegistrarFalta,
  onQuitarTitular,
  onRegistrarRuta,
  onAgenteExterno,
}: {
  slots: Puesto[];
  isAgenteSeleccionado: boolean;
  onPuestoClick: (puesto: Puesto) => void;
  onLiberar?: (puesto: Puesto) => void;
  onRegistrarFalta?: (puesto: Puesto, titularId: number, titularNombre: string) => void;
  onQuitarTitular?: (puesto: Puesto, employeeId: number, employeeNombre: string) => void;
  onRegistrarRuta?: (puesto: Puesto, employeeId: number | null, employeeNombre: string) => void;
  onAgenteExterno?: (puesto: Puesto) => void;
}) {
  if (slots.length === 0) return null;

  const ordenados = [...slots].sort((a, b) => (a.slot_numero ?? 0) - (b.slot_numero ?? 0));
  const cubiertos = ordenados.filter(
    (s) => s.estado === "cubierto" && (!!s.agente_id || (s as any).es_externo === true) && !(s as any).excedente_disponible,
  ).length;
  const operativos = ordenados.filter((s) => !(s as any).excedente_disponible).length;
  const disponiblesN = ordenados.filter((s) => (s as any).excedente_disponible).length;

  return (
    <div className="rounded-xl border border-amber-500/15 bg-[#0a0f15] overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-amber-500/10 flex items-center gap-1.5 bg-amber-500/5">
        <Truck className="w-3 h-3 text-amber-400/80 shrink-0" />
        <p className="text-[10px] font-bold text-amber-200/80 flex-1">
          {cubiertos} de {operativos} cubiertos
        </p>
        {disponiblesN > 0 && (
          <span className="text-[9px] text-emerald-300/70 font-semibold">
            +{disponiblesN} disponible
          </span>
        )}
      </div>
      <div className="p-1.5 space-y-1.5">
        {ordenados.map((slot) => (
          <CustodiaSlotItem
            key={slot.id}
            puesto={slot}
            isAgenteSeleccionado={isAgenteSeleccionado}
            onClick={() => onPuestoClick(slot)}
            onLiberar={onLiberar}
            onRegistrarFalta={onRegistrarFalta}
            onQuitarTitular={onQuitarTitular}
            onRegistrarRuta={onRegistrarRuta}
            onAgenteExterno={onAgenteExterno}
          />
        ))}
      </div>
    </div>
  );
}
