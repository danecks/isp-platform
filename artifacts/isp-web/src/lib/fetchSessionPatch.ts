/**
 * Parche de `window.fetch` para inyectar el header `x-isp-session` en
 * cualquier llamada hacia `/api/...` que NO pase por `httpClient.apiRequest`.
 *
 * Este parche existe como red de seguridad para componentes y librerías de
 * terceros que llaman `fetch()` directamente. La fuente única de verdad para
 * el header sigue siendo `httpClient.getSessionToken()`.
 *
 * ROADMAP: una vez todas las páginas migren a `apiRequest()` (fases 1-6),
 * este monkey-patch debe eliminarse.
 */

import { getSessionToken } from "@/lib/httpClient";

const SESSION_HEADER = "x-isp-session";

function isApiRequest(input: RequestInfo | URL): boolean {
  let url: string;
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
  } else {
    return false;
  }

  if (url.startsWith("/api/") || url === "/api") return true;

  if (typeof window !== "undefined") {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return parsed.pathname.startsWith("/api/") || parsed.pathname === "/api";
      }
    } catch {
      return false;
    }
  }
  return false;
}

function headersAlreadyHas(
  init: HeadersInit | undefined,
  name: string,
): boolean {
  if (!init) return false;
  const target = name.toLowerCase();
  if (init instanceof Headers) {
    return init.has(name);
  }
  if (Array.isArray(init)) {
    return init.some(([k]) => k.toLowerCase() === target);
  }
  return Object.keys(init).some((k) => k.toLowerCase() === target);
}

export function installFetchSessionPatch() {
  if (typeof window === "undefined") return;
  const flag = "__ispFetchPatched__";
  const w = window as unknown as Record<string, unknown>;
  if (w[flag]) return;
  w[flag] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!isApiRequest(input)) {
      return originalFetch(input, init);
    }

    const session = getSessionToken();
    if (!session) {
      return originalFetch(input, init);
    }

    if (input instanceof Request) {
      // Si init trae headers, esos headers reemplazan los del Request
      // (spec de fetch). En ese caso debo inyectar sobre init.
      if (init && init.headers !== undefined) {
        if (headersAlreadyHas(init.headers, SESSION_HEADER)) {
          return originalFetch(input, init);
        }
        const newHeaders = new Headers(init.headers);
        newHeaders.set(SESSION_HEADER, session);
        return originalFetch(input, { ...init, headers: newHeaders });
      }
      if (input.headers.has(SESSION_HEADER)) {
        return originalFetch(input, init);
      }
      const cloned = new Request(input, {
        headers: (() => {
          const h = new Headers(input.headers);
          h.set(SESSION_HEADER, session);
          return h;
        })(),
      });
      return originalFetch(cloned, init);
    }

    if (headersAlreadyHas(init?.headers, SESSION_HEADER)) {
      return originalFetch(input, init);
    }

    const newHeaders = new Headers(init?.headers ?? undefined);
    newHeaders.set(SESSION_HEADER, session);
    return originalFetch(input, { ...(init ?? {}), headers: newHeaders });
  };
}
