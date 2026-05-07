// SLOT-FIC-MON-01: helper compartido para normalizar fechas al lunes anterior.
//
// La grilla del modal de Plantilla de Turnos (semanasCiclo() en
// admin/pages/Operaciones.tsx) asume D1=Lun, D2=Mar, ..., D7=Dom. Si un slot
// tiene puesto_slots.fecha_inicio_ciclo en otro día (p.ej. viernes), el motor
// de cálculo del cuadro operativo (calcTrabajaPorSlot en routes/operaciones.ts)
// usa la fecha real, pero el modal pinta los días bajo etiquetas equivocadas →
// el descanso aparece en el agente/día equivocado en el cuadro operativo.
//
// Regla del proyecto: TODA fecha_inicio_ciclo persistida en puesto_slots debe
// caer en LUNES. Este helper centraliza la normalización para que sea aplicada
// consistentemente en TODOS los puntos de escritura (POST/PUT slots, PATCH
// turno del puesto, importación masiva, importación maestro, etc.).

/**
 * Devuelve la fecha (YYYY-MM-DD) del LUNES anterior (o la misma si ya es lunes).
 * Acepta string YYYY-MM-DD, Date o null/undefined. Devuelve null si la entrada
 * es vacía. Si la entrada no se puede parsear, la devuelve sin tocar (no
 * bloqueante — el llamador ya validó formato).
 */
export function normalizarFechaALunesString(
  fecha: string | Date | null | undefined,
): string | null {
  if (fecha == null || fecha === "") return null;

  let y: number, m: number, d: number;
  if (fecha instanceof Date) {
    if (isNaN(fecha.getTime())) return null;
    y = fecha.getUTCFullYear();
    m = fecha.getUTCMonth() + 1;
    d = fecha.getUTCDate();
  } else {
    const match = String(fecha).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(fecha) as any; // dejar pasar; quien llama validó
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  }

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return null;
  const dow = dt.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const offset = (dow + 6) % 7; // días hacia atrás hasta el lunes anterior
  if (offset > 0) dt.setUTCDate(dt.getUTCDate() - offset);
  return dt.toISOString().slice(0, 10);
}

/**
 * Variante que devuelve un objeto Date (UTC) anclado al lunes anterior.
 * Útil para INSERTs donde el código ya maneja Date (ej: importacion-maestro).
 */
export function normalizarFechaALunesDate(
  fecha: Date | null | undefined,
): Date | null {
  if (!fecha || isNaN(fecha.getTime())) return null;
  const out = new Date(Date.UTC(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
  ));
  const dow = out.getUTCDay();
  const offset = (dow + 6) % 7;
  if (offset > 0) out.setUTCDate(out.getUTCDate() - offset);
  return out;
}
