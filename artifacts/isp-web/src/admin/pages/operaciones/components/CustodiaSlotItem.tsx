import { useDroppable } from "@dnd-kit/core";
import { Truck, XCircle, UserMinus, Moon, MapPin } from "lucide-react";
import { iniciales, avatarColor } from "../utils";
import { Puesto } from "../types";

export function CustodiaSlotItem({
  puesto,
  isAgenteSeleccionado,
  onClick,
  onLiberar,
  onRegistrarFalta,
  onQuitarTitular,
  onRegistrarRuta,
}: {
  puesto: Puesto;
  isAgenteSeleccionado: boolean;
  onClick: () => void;
  onLiberar?: (puesto: Puesto) => void;
  onRegistrarFalta?: (puesto: Puesto, titularId: number, titularNombre: string) => void;
  onQuitarTitular?: (puesto: Puesto, employeeId: number, employeeNombre: string) => void;
  onRegistrarRuta?: (puesto: Puesto, employeeId: number, employeeNombre: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `puesto-${puesto.id}` });
  const cubierto = puesto.estado === "cubierto" && !!puesto.agente_id;
  const tieneTitular = !!puesto.titular_employee_id;
  const titularFaltando = (puesto as any).titular_faltando === true;
  const esRelevo = cubierto && tieneTitular && puesto.agente_id !== puesto.titular_employee_id;
  const descansoExcedente = puesto.descanso_por_ciclo === true;
  const slotVacio = (puesto as any).tiene_slot_vacio === true;

  const borde = isOver
    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]"
    : descansoExcedente
      ? "bg-[#08101a] border-indigo-500/25 hover:border-indigo-400/35"
      : esRelevo
        ? "bg-[#0f1208] border-amber-500/30 hover:border-amber-400/40"
        : cubierto
          ? "bg-[#0f1208] border-amber-500/25 hover:border-amber-400/35"
          : titularFaltando
            ? "bg-[#0c0a16] border-red-500/30 hover:border-red-400/40"
            : "bg-[#0c0a16] border-red-500/20 hover:border-red-400/35";

  const strip = descansoExcedente
    ? "bg-indigo-400"
    : cubierto
      ? (esRelevo ? "bg-amber-400" : "bg-amber-500")
      : "bg-red-500 animate-pulse";

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`relative rounded-xl border p-2.5 transition-all cursor-pointer group ${borde} ${isAgenteSeleccionado && !cubierto ? "ring-1 ring-primary/50 border-primary/30" : ""}`}
    >
      <div className="flex gap-2">
        <div className={`w-1 self-stretch rounded-full shrink-0 ${strip}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Truck className={`w-3 h-3 shrink-0 ${cubierto ? "text-amber-400" : descansoExcedente ? "text-indigo-400/60" : "text-white/30"}`} />
            <p className="text-[10px] font-semibold text-white/50">Custodio {puesto.slot_numero}</p>
            {puesto.arma_codigo && (
              <span className="text-[8px] bg-blue-500/10 border border-blue-500/20 text-blue-300/70 px-1 py-0.5 rounded font-mono">
                {puesto.arma_codigo}
              </span>
            )}
            {descansoExcedente && (
              <span className="text-[8px] px-1 py-0.5 bg-indigo-500/15 border border-indigo-500/25 rounded text-indigo-300/80 font-bold ml-auto">DESCANSO</span>
            )}
            {esRelevo && !descansoExcedente && (
              <span className="text-[8px] px-1 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded text-amber-300/80 font-bold ml-auto">REL</span>
            )}
          </div>

          {cubierto && puesto.agente_nombre ? (
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(puesto.agente_nombre)}`}>
                {iniciales(puesto.agente_nombre)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-white/90 truncate">{puesto.agente_nombre}</p>
                {esRelevo && puesto.titular_nombre && (
                  <p className="text-[9px] text-amber-400/70 truncate">Titular: {puesto.titular_nombre}</p>
                )}
              </div>
            </div>
          ) : descansoExcedente && puesto.titular_nombre ? (
            <div className="flex items-center gap-1.5 text-indigo-300/70">
              <Moon className="w-3 h-3 shrink-0" />
              <p className="text-[11px] truncate">{puesto.titular_nombre}</p>
            </div>
          ) : titularFaltando ? (
            <div>
              <p className="text-[11px] text-red-400 font-medium truncate">Faltante</p>
              <p className="text-[9px] text-red-400/60 truncate">Titular: {puesto.titular_nombre}</p>
            </div>
          ) : slotVacio ? (
            <p className="text-[11px] text-white/25 italic">
              {isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Sin titular asignado"}
            </p>
          ) : (
            <p className="text-[11px] text-white/25 italic">
              {isOver ? "Soltar aquí" : "Sin asignar"}
            </p>
          )}

          {/* Acciones */}
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {cubierto && esRelevo && onLiberar && (
              <button
                onClick={e => { e.stopPropagation(); onLiberar(puesto); }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-red-300/80 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors"
                title="Liberar cobertura de hoy"
              >
                <XCircle className="w-3 h-3" /><span>Liberar</span>
              </button>
            )}
            {tieneTitular && !titularFaltando && onRegistrarFalta && (
              <button
                onClick={e => { e.stopPropagation(); onRegistrarFalta(puesto, puesto.titular_employee_id!, puesto.titular_nombre!); }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-red-300/80 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors"
                title="Registrar falta del titular"
              >
                <XCircle className="w-3 h-3" /><span>Falta</span>
              </button>
            )}
            {tieneTitular && onQuitarTitular && (
              <button
                onClick={e => { e.stopPropagation(); onQuitarTitular(puesto, puesto.titular_employee_id!, puesto.titular_nombre!); }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300/80 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 hover:text-rose-300 rounded-md transition-colors"
                title={`Quitar titularidad de ${puesto.titular_nombre}`}
              >
                <UserMinus className="w-3 h-3" /><span>Quitar</span>
              </button>
            )}
            {cubierto && onRegistrarRuta && puesto.agente_id && puesto.agente_nombre && (
              <button
                onClick={e => { e.stopPropagation(); onRegistrarRuta(puesto, puesto.agente_id!, puesto.agente_nombre!); }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300/80 bg-sky-500/10 border border-sky-500/25 hover:bg-sky-500/20 hover:text-sky-300 rounded-md transition-colors"
                title={`Registrar ruta del día de ${puesto.agente_nombre}`}
              >
                <MapPin className="w-3 h-3" /><span>Ruta</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {isOver && <div className="absolute inset-0 rounded-xl border-2 border-primary border-dashed pointer-events-none" />}
    </div>
  );
}
