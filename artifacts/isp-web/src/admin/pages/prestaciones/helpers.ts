import { apiFetch, getSessionToken } from "@/lib/httpClient";

export const API = "/api";

export function getSession() {
  return getSessionToken();
}

export { apiFetch };

export function apiGet(url: string) {
  return apiFetch(url);
}

export function apiPost(url: string, body: unknown) {
  return apiFetch(url, { method: "POST", body: JSON.stringify(body) });
}

export function apiPut(url: string, body: unknown) {
  return apiFetch(url, { method: "PUT", body: JSON.stringify(body) });
}

export function apiPatch(url: string, body?: unknown) {
  return apiFetch(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
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
