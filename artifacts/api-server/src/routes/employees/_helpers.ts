// Helpers compartidos entre los submódulos de routes/employees

// Convierte un objeto con keys snake_case a camelCase (un nivel)
export function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ]),
  );
}

// Validación estricta de fecha YYYY-MM-DD que además rechaza fechas
// que pasan el regex pero no existen en el calendario (ej. 2026-13-40).
export function validDate(s: unknown): s is string {
  if (!s || typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Lunes ISO de la semana correspondiente a una fecha (YYYY-MM-DD)
export function lunesISO(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const jsDay = date.getUTCDay();
  const offsetAlLunes = (jsDay + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offsetAlLunes);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export const DIAS_VALIDOS = new Set([
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
]);

export function normalizarDia(d: string): string {
  return d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
