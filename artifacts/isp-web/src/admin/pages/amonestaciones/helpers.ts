import { getSessionToken } from "@/lib/httpClient";

const API = "/api";

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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-isp-session": getSession(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fmtFecha(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtQ(n?: number | null) {
  return `Q ${(Number(n) || 0).toFixed(2)}`;
}
