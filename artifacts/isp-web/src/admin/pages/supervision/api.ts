import { getSessionToken } from "@/lib/httpClient";
const API_BASE = "/api";

function getSession(): string {
  return (typeof sessionStorage !== "undefined"
    ? getSessionToken()
    : null) || "";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-isp-session": getSession(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function hoyISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function en7DiasISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const inputCls =
  "w-full bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white";
