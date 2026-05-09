// Motor de turnos compartido (versión inicial — Fase 0).
//
// CONCEPTO:
//   Un slot de plantilla define un ciclo de longitud N días (7, 14, 21 ó 28).
//   `dias_trabajo` es un bitmask de qué días del ciclo son de trabajo (D1..Dn).
//   El día 1 del ciclo siempre cae en lunes (regla SLOT-FIC-MON-01).
//
// Esta función reemplazará a `calcTrabajaPorSlot` y `calcularEstadoCiclo`
// dispersos en `routes/operaciones.ts`, `routes/puesto-slots.ts` y la grilla
// del Pizarrón. Por ahora vive aquí como referencia única; las migraciones
// concretas ocurren en fases posteriores.

import { diffDays, lunesAnterior } from "./dates";

export type EstadoSlot = "trabaja" | "descansa" | "medio";

export interface PlantillaSlot {
  /** Lunes del ciclo (se normaliza si no lo es). */
  fechaInicioCiclo: Date;
  /** 7 | 14 | 21 | 28. */
  longitudCiclo: number;
  /** Bitmask de días de trabajo (1=D1, 2=D2, 4=D3, ...). */
  diasTrabajo: number;
  /** Bitmask opcional de días de medio turno. */
  diasMedioTurno?: number;
}

/**
 * Calcula si un agente con la plantilla `slot` trabaja, descansa o tiene
 * medio turno en la fecha indicada.
 */
export function calcEstadoSlot(slot: PlantillaSlot, fecha: Date): EstadoSlot {
  const inicio = lunesAnterior(slot.fechaInicioCiclo);
  const dia = diffDays(inicio, fecha);
  if (dia < 0) return "descansa";
  const idx = ((dia % slot.longitudCiclo) + slot.longitudCiclo) % slot.longitudCiclo;
  const bit = 1 << idx;
  if ((slot.diasMedioTurno ?? 0) & bit) return "medio";
  return slot.diasTrabajo & bit ? "trabaja" : "descansa";
}
