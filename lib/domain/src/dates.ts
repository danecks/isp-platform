// Helpers de fecha — siempre operan en zona horaria Guatemala (UTC-6, sin DST).
//
// REGLA DE ORO: nunca usar `new Date().toISOString().slice(0, 10)` para "hoy" —
// eso devuelve UTC y a partir de las 18:00 GT-6 retorna el día siguiente. Usar
// `todayGT()`.

const GT_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Fecha de hoy en Guatemala como string ISO `YYYY-MM-DD`. */
export function todayGT(): string {
  return new Date(Date.now() - GT_OFFSET_MS).toISOString().substring(0, 10);
}

/** Convierte un Date (UTC) a string `YYYY-MM-DD` en Guatemala. */
export function toGTDateString(d: Date): string {
  return new Date(d.getTime() - GT_OFFSET_MS).toISOString().substring(0, 10);
}

/**
 * Re-ancla cualquier fecha al lunes anterior (o al mismo día si ya es lunes).
 * Equivalente a la regla SLOT-FIC-MON-01 del módulo de Operaciones.
 */
export function lunesAnterior(d: Date): Date {
  const dow = d.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = (dow + 6) % 7; // 0 si lunes, 6 si domingo
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - diff);
  return out;
}

/** Diferencia en días enteros entre dos fechas (b - a). */
export function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86_400_000);
}
