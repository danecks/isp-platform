/**
 * Patch global de `window.fetch` para el APK Capacitor.
 *
 * Dentro del APK el WebView corre con origen `https://localhost`
 * (androidScheme=https). Cualquier `fetch("/api/...")` relativo resuelve
 * contra `https://localhost/api/...` → "error de conexión con el servidor".
 *
 * Este patch reescribe SOLO las URLs relativas que empiezan con "/api/"
 * o "/app-updates/" para que apunten al dominio corporativo absoluto.
 * Cualquier URL absoluta (http/https) o de otros prefijos pasa sin tocar.
 *
 * Se aplica una sola vez al boot desde `bootstrapNative()`. En navegador
 * es no-op.
 *
 * Además fuerza `credentials: "include"` para que las cookies de sesión
 * del dominio del API viajen (cross-origin desde el origen del WebView).
 */
import { isNative } from "./platform";

const NATIVE_ORIGIN = "https://ispsa.net";
const REWRITE_PREFIXES = ["/api/", "/app-updates/"];
let installed = false;

function shouldRewrite(input: string): boolean {
  if (!input.startsWith("/")) return false;
  if (input.startsWith("//")) return false;
  return REWRITE_PREFIXES.some((p) => input.startsWith(p));
}

function rewriteUrl(input: string): string {
  return `${NATIVE_ORIGIN}${input}`;
}

export function installNativeFetchPatch(): void {
  if (installed) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (!isNative()) return;

  const orig = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      let newInput: RequestInfo | URL = input;
      let didRewrite = false;

      if (typeof input === "string") {
        if (shouldRewrite(input)) {
          newInput = rewriteUrl(input);
          didRewrite = true;
        }
      } else if (input instanceof URL) {
        // URL absoluta — no tocar
      } else if (input instanceof Request) {
        // Request.url es siempre absoluta. Si apunta al origen del WebView
        // y el path es /api/... → rebuild Request con dominio corporativo.
        try {
          const parsed = new URL(input.url);
          if (
            (parsed.origin === window.location.origin ||
              parsed.hostname === "localhost") &&
            REWRITE_PREFIXES.some((p) => parsed.pathname.startsWith(p))
          ) {
            const newUrl = `${NATIVE_ORIGIN}${parsed.pathname}${parsed.search}`;
            newInput = new Request(newUrl, input);
            didRewrite = true;
          }
        } catch {
          /* noop */
        }
      }

      // Solo aplicar credentials:include cuando reescribimos al dominio
      // corporativo. No queremos cambiar el comportamiento de fetches a
      // terceros (rompería CORS de servicios externos).
      if (didRewrite) {
        const finalInit: RequestInit = { ...(init ?? {}) };
        if (finalInit.credentials === undefined) finalInit.credentials = "include";
        return orig(newInput, finalInit);
      }
      return orig(newInput, init);
    } catch {
      return orig(input, init);
    }
  };

  installed = true;
}
