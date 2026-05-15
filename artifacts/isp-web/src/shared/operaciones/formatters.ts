/**
 * Formatters compartidos entre Admin, Portal Cliente y PWA Agente.
 *
 * Antes cada pantalla redefinía estas funciones (Visitas admin, PortalVisitas,
 * AgenteVisitas, PortalRondas, PortalFichajes, PortalRecorridos, etc.) con
 * variaciones mínimas en formato. Centralizar acá garantiza que la zona horaria
 * (America/Guatemala), el locale (es-GT) y el redondeo de duración sean iguales
 * en todos los flujos operativos.
 */

const TZ = "America/Guatemala";
const LOCALE = "es-GT";

// ─── Fechas en zona Guatemala ─────────────────────────────────────────────────

export function fechaGT(): { anio: number; mes: number; dia: number } {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1, dia: ahora.getDate() };
}

/** Devuelve YYYY-MM-DD del día actual en zona GT. */
export function hoyGT(): string {
  const { anio, mes, dia } = fechaGT();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Devuelve YYYY-MM-01 del mes actual en zona GT. */
export function inicioDeMesGT(): string {
  const { anio, mes } = fechaGT();
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

/** YYYY-MM-DD con offset de días respecto a hoy (en zona GT). */
export function dateGT(offsetDays = 0): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

// ─── Formato de horas y fechas ────────────────────────────────────────────────

/** "23 oct, 14:30" */
export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(LOCALE, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

/** "14:30" — acepta ISO string o epoch ms (Date.now()). */
export function fmtHora(iso: string | number | null | undefined): string {
  if (iso == null) return "—";
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

/** "23 oct 2025, 14:30" */
export function fmtFechaLargaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(LOCALE, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

/** "lunes 23 de octubre de 2025" a partir de YYYY-MM-DD. */
export function fmtFechaLarga(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ─── Duraciones ───────────────────────────────────────────────────────────────

/** "45 min" / "2h 15min". Si `salida` es null, mide hasta ahora. */
export function fmtDuracion(entrada: string, salida: string | null = null): string {
  const e = new Date(entrada).getTime();
  const s = salida ? new Date(salida).getTime() : Date.now();
  const min = Math.max(0, Math.floor((s - e) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

// ─── KPIs / variaciones ───────────────────────────────────────────────────────

/** Variación porcentual entre actual y anterior, con flag up/down. */
export function pctChange(act: number, ant: number): { val: number; up: boolean } {
  if (ant === 0) return { val: act > 0 ? 100 : 0, up: act >= 0 };
  const v = ((act - ant) / ant) * 100;
  return { val: Math.round(v), up: v >= 0 };
}

// ─── Distancia ────────────────────────────────────────────────────────────────

/** Distancia total en km entre puntos consecutivos (Haversine). */
export function distanciaTotalKm(
  puntos: Array<{ lat: number; lng: number }>
): number {
  if (puntos.length < 2) return 0;
  const R = 6371;
  let km = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(x));
  }
  return km;
}
