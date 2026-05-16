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

/**
 * Prefijo de URL del artifact (p. ej. "" cuando se sirve en `/`, o
 * "/admin" cuando se monta bajo un sub-path). Lo respetamos para que las
 * llamadas al API funcionen tanto en root como bajo un base path.
 */
const BASE_URL_PREFIX = (() => {
  try {
    const raw = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    return raw ? raw.replace(/\/$/, "") : "";
  } catch {
    return "";
  }
})();

export function getSessionToken(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Construye la URL final hacia el API.
 *
 * - Si `path` ya es absoluta (`http...`), se devuelve tal cual.
 * - Si ya incluye el prefijo `/api`, se usa como está y solo se le antepone
 *   el `BASE_URL` del artifact (para deployments bajo sub-path).
 * - En caso contrario se prepende `${BASE_URL}/api`.
 *
 * Esto permite que el mismo helper sirva a llamadores que pasan
 * `"/leads"` (estilo `apiRequest` / `helpers.ts` de planilla) y a los que
 * pasan `"/api/nomina/..."` (estilo pre-planilla / rrhh-eventos).
 */
export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const withApi = path.startsWith(`${API_BASE}/`) || path === API_BASE
    ? path
    : `${API_BASE}${path}`;
  return `${BASE_URL_PREFIX}${withApi}`;
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

/**
 * Wrappers finos para POST/PATCH con cuerpo JSON. Equivalentes a
 * `apiRequest(url, { method, json: body })` — existen sólo para que los
 * call sites se vean más cortos y para deduplicar las decenas de
 * `apiPost`/`apiPatch` que históricamente cada página admin definía
 * inline (cada uno con su propia forma de error).
 *
 * Lanzan `ApiError`; el cuerpo parseado del backend está disponible en
 * `error.body` (p. ej. `(err as ApiError).body?.error`).
 */
export const apiPost = <T = unknown>(url: string, body: unknown) =>
  apiRequest<T>(url, { method: "POST", json: body });

export const apiPatch = <T = unknown>(url: string, body: unknown) =>
  apiRequest<T>(url, { method: "PATCH", json: body });

/**
 * Helper compartido usado por los `helpers.ts` de cada subcarpeta de admin
 * (planilla, planillas-especiales, prestaciones, amonestaciones, etc.).
 *
 * Hace `fetch(/api${url})` con header `x-isp-session`, fuerza
 * `Content-Type: application/json` y lanza un `Error` con el mensaje del
 * cuerpo cuando el status no es 2xx. Devuelve la respuesta parseada como
 * JSON.
 *
 * Para nuevo código preferí `apiRequest`, que tiene mejor manejo de JSON
 * vs FormData y lanza `ApiError` con status. `apiFetch` se mantiene para
 * preservar el contrato histórico de los helpers existentes.
 */
export async function apiFetch<T = any>(
  url: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(apiUrl(url), {
    ...opts,
    headers: {
      "x-isp-session": getSessionToken(),
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}
