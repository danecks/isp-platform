/**
 * Cliente HTTP centralizado para el frontend (Fase 0 — refactor).
 *
 * Antes había varios patrones distintos para llamar al API:
 *   - `fetch()` directo en cada componente (sin headers de sesión)
 *   - `apiFetch()` privado en `lib/api.ts`
 *   - `getSession()` repetido en cada caller
 *   - `fetchSessionPatch.ts` parchando `window.fetch` global
 *
 * Este módulo unifica todo:
 *   - `apiRequest(path, options)` — fetch con `Content-Type` JSON, header
 *     `x-isp-session` y manejo de errores consistente. Devuelve la respuesta
 *     ya parseada como JSON.
 *   - `apiUrl(path)` — construye la URL completa contra `/api`.
 *   - `getSessionToken()` — lee la sesión persistida en `sessionStorage`.
 *
 * USO RECOMENDADO con TanStack Query:
 *   const { data } = useQuery({
 *     queryKey: ["leads"],
 *     queryFn: () => apiRequest<Lead[]>("/leads"),
 *   });
 */

const API_BASE = "/api";
const SESSION_KEY = "isp_admin_session_v2";
const SESSION_HEADER = "x-isp-session";

export function getSessionToken(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

export function apiUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  /** Cuerpo JSON: se serializa automáticamente a string. */
  json?: unknown;
  /** Cuerpo crudo (string / FormData / Blob). Se envía tal cual. */
  body?: BodyInit;
}

/**
 * Hace una petición al API e intenta parsear la respuesta como JSON.
 * Lanza `ApiError` si el status no es 2xx.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const session = getSessionToken();
  const headers = new Headers(options.headers);
  const body =
    options.json !== undefined ? JSON.stringify(options.json) : options.body;
  // Auto Content-Type para JSON: tanto cuando se usa `json:` como cuando el
  // caller (incluidos los wrappers legados de `lib/api.ts`) pasa un string ya
  // serializado en `body`. NO lo aplicamos a FormData/Blob porque el browser
  // debe poner el boundary multipart por sí solo.
  const isJsonBody =
    options.json !== undefined ||
    (typeof body === "string" && body.length > 0);
  if (isJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session && !headers.has(SESSION_HEADER)) {
    headers.set(SESSION_HEADER, session);
  }

  const res = await fetch(apiUrl(path), { ...options, headers, body });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg =
      typeof errBody === "object" && errBody && "error" in errBody
        ? String((errBody as { error: unknown }).error)
        : `Error ${res.status}`;
    throw new ApiError(res.status, msg, errBody);
  }

  // 204 No Content y similares
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
