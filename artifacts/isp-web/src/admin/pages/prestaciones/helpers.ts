import { apiRequest, getSessionToken } from "@/lib/httpClient";

export const API = "/api";

export function getSession() {
  return getSessionToken();
}

export { apiRequest };

export function apiGet<T = unknown>(url: string) {
  return apiRequest<T>(url);
}

export function apiPost<T = unknown>(url: string, body: unknown) {
  return apiRequest<T>(url, { method: "POST", json: body });
}

export function apiPut<T = unknown>(url: string, body: unknown) {
  return apiRequest<T>(url, { method: "PUT", json: body });
}

export function apiPatch<T = unknown>(url: string, body?: unknown) {
  return apiRequest<T>(url, { method: "PATCH", json: body });
}

export function fmt(n: number | string | null | undefined) {
  if (n == null || n === "") return "Q0.00";
  const v = parseFloat(String(n));
  if (!isFinite(v)) return "—";
  return `Q${v.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("es-GT");
}

export const TIPO_EGRESO_LABELS: Record<string, string> = {
  renuncia: "Renuncia",
  despido_justificado: "Despido Justificado",
  despido_injustificado: "Despido Injustificado",
  mutuo_acuerdo: "Mutuo Acuerdo",
  finalizacion_contrato: "Finalización de Contrato",
};

export const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  confirmada: { label: "Confirmada", cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  activa:     { label: "Activa",     cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  anulada:    { label: "Anulada",    cls: "bg-red-500/20 text-red-300 border-red-500/30" },
};
