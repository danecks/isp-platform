// Helpers de "semana del mes" basados en semanas ISO (lun-dom).
//
// Convención: una semana ISO "pertenece" al mes donde cae su LUNES.
// La posición dentro del mes = floor((dia_lunes - 1) / 7) + 1, capped 1..5.
//
// Ejemplos (mes con día 1 = miércoles):
//   - Lunes anterior cae en el mes previo → ese miércoles cuenta como
//     semana 5 del mes previo, no como semana 1 del mes actual.
//   - Primer lunes del mes (día 6) → semana 1 del mes actual.
//
// Todos los cálculos se hacen en zona horaria America/Guatemala (UTC-6,
// sin DST). Las fechas se manejan como YYYY-MM-DD (sin horas).

const GT_OFFSET_MIN = -6 * 60;

/** Hoy en zona Guatemala como YYYY-MM-DD. */
export function hoyGT_ISO(): string {
  return fechaGT_ISO(new Date());
}

/** Convierte un Date UTC a YYYY-MM-DD en zona Guatemala. */
export function fechaGT_ISO(d: Date): string {
  const ms = d.getTime() + (GT_OFFSET_MIN - new Date().getTimezoneOffset()) * 60_000;
  const local = new Date(ms);
  // ↑ truco: convertimos el UTC absoluto a "como si fuese hora local de GT"
  // pero relativo a la zona del proceso (que es UTC en Replit), por eso el delta.
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Parse YYYY-MM-DD a Date local (00:00 hora del proceso). */
export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes (00:00) de la semana ISO que contiene la fecha. */
export function lunesDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();           // 0=dom .. 6=sab
  const diffToMon = (dow + 6) % 7;  // 0 si lunes, 6 si domingo
  d.setDate(d.getDate() - diffToMon);
  return d;
}

/** Domingo (00:00) de la semana ISO que contiene la fecha. */
export function domingoDeSemana(fecha: Date): Date {
  const lun = lunesDeSemana(fecha);
  const dom = new Date(lun);
  dom.setDate(dom.getDate() + 6);
  return dom;
}

/** Posición de la semana ISO dentro del mes del LUNES, 1..5. */
export function semanaDelMes(fecha: Date): number {
  const lun = lunesDeSemana(fecha);
  return Math.floor((lun.getDate() - 1) / 7) + 1;
}

/** Mes (1..12) y año al que pertenece la semana ISO de la fecha. */
export function mesDeSemana(fecha: Date): { mes: number; anio: number } {
  const lun = lunesDeSemana(fecha);
  return { mes: lun.getMonth() + 1, anio: lun.getFullYear() };
}

/** Devuelve YYYY-MM-DD del lunes y domingo. */
export function rangoSemanaISO(fecha: Date): { lunes: string; domingo: string } {
  const lun = lunesDeSemana(fecha);
  const dom = domingoDeSemana(fecha);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { lunes: fmt(lun), domingo: fmt(dom) };
}
