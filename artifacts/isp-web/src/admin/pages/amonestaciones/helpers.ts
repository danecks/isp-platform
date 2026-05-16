import { apiRequest, getSessionToken } from "@/lib/httpClient";

export function getSession() {
  return getSessionToken();
}

export function getRol(): string {
  try {
    const raw = getSession();
    if (!raw) return "";
    return JSON.parse(raw).rol || "";
  } catch { return ""; }
}

export const api = apiRequest;

export function fmtFecha(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtQ(n?: number | null) {
  return `Q ${(Number(n) || 0).toFixed(2)}`;
}
