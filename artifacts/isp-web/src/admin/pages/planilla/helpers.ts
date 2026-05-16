import { apiFetch, getSessionToken } from "@/lib/httpClient";

export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function getSession() {
  return getSessionToken();
}

export { apiFetch };

export function fmtQ(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtFecha(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "numeric" });
}
