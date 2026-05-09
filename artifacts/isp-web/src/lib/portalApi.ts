/**
 * Portal API helper — delega en `httpClient.apiRequest` (Fase 0) y agrega
 * los headers de autorización del cliente que el middleware del portal
 * exige (`x-isp-role`, `x-isp-userid`, `x-isp-clienteid`).
 *
 * Antes este archivo duplicaba la lógica de fetch + manejo de errores; ahora
 * sólo arma los headers y reutiliza el cliente HTTP central.
 */

import { apiRequest, ApiError } from "@/lib/httpClient";

const SESSION_KEY = "isp_admin_session_v2";
const ACTIVE_CLIENT_KEY = "isp_portal_active_client";

export function getActivePortalClienteId(): string | null {
  try {
    const stored = sessionStorage.getItem(ACTIVE_CLIENT_KEY);
    if (stored) return stored;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user.clienteId ?? null;
  } catch {
    return null;
  }
}

export function setActivePortalClienteId(cid: string) {
  sessionStorage.setItem(ACTIVE_CLIENT_KEY, cid);
}

export function clearActivePortalClienteId() {
  sessionStorage.removeItem(ACTIVE_CLIENT_KEY);
}

function getPortalHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const user = JSON.parse(raw);
    const activeCid = getActivePortalClienteId();
    return {
      "x-isp-role": user.rol ?? "",
      "x-isp-userid": String(user.id ?? ""),
      "x-isp-clienteid": activeCid ?? user.clienteId ?? "",
    };
  } catch {
    return {};
  }
}

async function portalRequest<T>(
  path: string,
  method: string,
  json?: unknown,
): Promise<T> {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(getPortalHeaders())) {
      headers.set(k, v);
    }
    return await apiRequest<T>(path, { method, headers, json });
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

export function portalGet<T>(path: string): Promise<T> {
  return portalRequest<T>(path, "GET");
}

export function portalPost<T>(path: string, body: unknown): Promise<T> {
  return portalRequest<T>(path, "POST", body);
}
