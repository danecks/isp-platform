/**
 * Portal API helper — agrega los headers de autenticación del cliente
 * en cada llamada al API del portal.
 *
 * Los headers x-isp-role y x-isp-clienteid se validan en el servidor
 * para asegurar que un cliente solo acceda a sus propios datos.
 */

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

function getPortalHeaders(): HeadersInit {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { "Content-Type": "application/json" };
    const user = JSON.parse(raw);
    const activeCid = getActivePortalClienteId();
    return {
      "Content-Type": "application/json",
      "x-isp-role": user.rol ?? "",
      "x-isp-userid": String(user.id ?? ""),
      "x-isp-clienteid": activeCid ?? user.clienteId ?? "",
    };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export async function portalGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "GET",
    headers: getPortalHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function portalPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: getPortalHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}
