import { useState } from "react";
import { PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { Agente, ClienteBoard, Pool, Puesto } from "../types";

interface Args {
  pool: Pool | undefined;
  tablero: ClienteBoard[];
  fechaVistaCerrada: boolean;
  onAsignarCustodia: (puesto: Puesto, agente: Agente) => void | Promise<void>;
  onIniciarAsignacion: (puesto: Puesto, agente: Agente) => void | Promise<void>;
}

export function useDragHandlers({
  pool,
  tablero,
  fechaVistaCerrada,
  onAsignarCustodia,
  onIniciarAsignacion,
}: Args) {
  const [draggingAgente, setDraggingAgente] = useState<Agente | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function poolAplanado(): Agente[] {
    return [
      ...(pool?.disponibles ?? []),
      ...(pool?.trabajando ?? []),
      ...(pool?.descansandoCiclo ?? []),
      ...(pool?.enDescanso ?? []),
      ...(pool?.suspendidos ?? []),
      ...(pool?.enPuesto ?? []),
      ...(pool?.enSSA ?? []),
    ];
  }

  function handleDragStart(event: DragStartEvent) {
    if (fechaVistaCerrada) return;
    const agenteId = parseInt(event.active.id.toString().replace("agent-", ""));
    const agente = poolAplanado().find((a) => a.id === agenteId);
    if (agente) setDraggingAgente(agente);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingAgente(null);
    if (fechaVistaCerrada) return;
    if (!over) return;

    const agenteId = parseInt(active.id.toString().replace("agent-", ""));
    const puestoIdRaw = over.id.toString().replace("puesto-", "");

    const agente = poolAplanado().find((a) => a.id === agenteId);
    const puesto = tablero.flatMap((c) => c.puestos).find((p) => String(p.id) === puestoIdRaw);

    if (!agente || !puesto) return;

    if (puesto.es_custodia) {
      await onAsignarCustodia(puesto, agente);
    } else {
      await onIniciarAsignacion(puesto, agente);
    }
  }

  return { sensors, draggingAgente, handleDragStart, handleDragEnd };
}
