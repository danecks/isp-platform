import { toISODate } from "./utils";

// ─── Estado de colapso de paneles (persiste en sessionStorage) ────────────────
export function initCollapse(key: string, defaultVal = false): boolean {
  const v = sessionStorage.getItem(key);
  return v === null ? defaultVal : v === "1";
}

export function persistCollapse(key: string, value: boolean) {
  sessionStorage.setItem(key, value ? "1" : "0");
}

// ─── Lectura de parámetros de URL para navegación directa ────────────────────
export function leerFechaURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  const f = params.get("pizarronFecha");
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
}

export function leerClienteURL(): number | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("clienteId");
  return id ? Number(id) : null;
}

export function setURLPizarron(fecha: string, clienteId?: number) {
  const params = new URLSearchParams(window.location.search);
  params.set("pizarronFecha", fecha);
  if (clienteId) params.set("clienteId", String(clienteId));
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
}

export function limpiarURLPizarron() {
  window.history.replaceState({}, "", window.location.pathname);
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
export function formatFechaVista(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function navFechaISO(fechaISO: string, delta: number): string {
  const d = new Date(fechaISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}
