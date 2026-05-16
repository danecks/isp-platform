import { getSessionToken } from "@/lib/httpClient";

export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function getSession() {
  return getSessionToken();
}

export async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${url}`, {
    ...opts,
    headers: { "x-isp-session": getSession(), "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export function fmtQ(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtFecha(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "numeric" });
}
