/**
 * Wrapper de notificaciones push.
 *
 * Maneja todo el ciclo de vida del lado cliente:
 *   - pedir permiso (Android 13+ exige POST_NOTIFICATIONS).
 *   - registrar el token FCM contra el dispositivo.
 *   - enviarlo al api-server (POST /api/push/tokens) para que quede
 *     asociado al usuario logueado.
 *   - borrarlo en el server cuando el usuario hace logout
 *     (DELETE /api/push/tokens/:token).
 *   - escuchar notificaciones entrantes y, al tocarlas, navegar a la
 *     ruta que viene en `data.ruta` (típico: emergencias).
 *
 * En navegador (no-APK) todas las funciones son no-op para que el código
 * de UI las pueda llamar sin distinguir plataforma.
 */
import { isNative } from "./platform";

export type PushPermission = "granted" | "denied" | "prompt" | "unsupported";

// Cache del último token para no spamear el endpoint en cada navegación.
let cachedToken: string | null = null;
let listenersInstalled = false;
let onOpenNavigate: ((ruta: string) => void) | null = null;

export async function requestPermission(): Promise<PushPermission> {
  if (!isNative()) return "unsupported";
  try {
    const mod = "@capacitor/push-notifications";
    const { PushNotifications } = await import(/* @vite-ignore */ mod);
    const r = await PushNotifications.requestPermissions();
    if (r.receive === "granted") return "granted";
    if (r.receive === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * Devuelve el push token (FCM en Android) si está disponible. Resuelve a
 * null en navegador o cuando el plugin no logra registrarse (no hay
 * google-services.json, sin red, permiso denegado, etc).
 */
export async function getDeviceToken(): Promise<string | null> {
  if (!isNative()) return null;
  if (cachedToken) return cachedToken;
  try {
    const mod = "@capacitor/push-notifications";
    const { PushNotifications } = await import(/* @vite-ignore */ mod);
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 8000);
      PushNotifications.addListener("registration", (t: { value: string }) => {
        clearTimeout(timer);
        cachedToken = t.value ?? null;
        resolve(cachedToken);
      });
      PushNotifications.addListener("registrationError", (err: unknown) => {
        clearTimeout(timer);
        // eslint-disable-next-line no-console
        console.warn("[Push] registrationError:", err);
        resolve(null);
      });
      void PushNotifications.register();
    });
  } catch {
    return null;
  }
}

/**
 * Engancha listeners para mostrar notificaciones en foreground y para
 * reaccionar cuando el usuario toca una. Idempotente.
 */
async function installListeners(): Promise<void> {
  if (listenersInstalled || !isNative()) return;
  try {
    const mod = "@capacitor/push-notifications";
    const { PushNotifications } = await import(/* @vite-ignore */ mod);
    PushNotifications.addListener(
      "pushNotificationReceived",
      (n: { title?: string; body?: string; data?: Record<string, string> }) => {
        // eslint-disable-next-line no-console
        console.info("[Push] recibida en foreground:", n.title, n.data);
      }
    );
    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (event: { notification: { data?: Record<string, string> } }) => {
        const ruta = event?.notification?.data?.["ruta"];
        if (ruta && onOpenNavigate) {
          try {
            onOpenNavigate(ruta);
          } catch {
            /* noop */
          }
        }
      }
    );
    listenersInstalled = true;
  } catch {
    /* plugin no disponible — modo navegador o sin SDK */
  }
}

/**
 * Registra el token contra el api-server. Idempotente y silencioso ante
 * errores (no rompe la app si la red está caída).
 */
export async function registerTokenWithServer(args: {
  userId: number;
  appVersion?: string;
  deviceModel?: string;
}): Promise<boolean> {
  if (!isNative()) return false;
  const token = await getDeviceToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/push/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        userId: args.userId,
        platform: "android",
        appVersion: args.appVersion ?? null,
        deviceModel: args.deviceModel ?? null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Borra el token del server (al hacer logout). El token local se mantiene
 * cacheado por si el usuario vuelve a loguearse con la misma cuenta o con
 * otra (en cuyo caso registerTokenWithServer lo reasigna).
 */
export async function unregisterTokenFromServer(): Promise<void> {
  if (!isNative() || !cachedToken) return;
  try {
    await fetch(`/api/push/tokens/${encodeURIComponent(cachedToken)}`, {
      method: "DELETE",
    });
  } catch {
    /* noop */
  }
}

/**
 * Bootstrap completo del módulo. Se llama una sola vez al arranque del
 * APK y, además, cada vez que el usuario completa login (para asociar
 * el token a la cuenta nueva).
 *
 * - Pide permiso si todavía no se concedió.
 * - Instala los listeners de notificaciones entrantes.
 * - Si hay userId, registra el token contra el server.
 */
export async function initPush(opts: {
  userId?: number | null;
  appVersion?: string;
  deviceModel?: string;
  navigate?: (ruta: string) => void;
}): Promise<void> {
  if (!isNative()) return;
  if (opts.navigate) onOpenNavigate = opts.navigate;
  const perm = await requestPermission();
  if (perm === "denied" || perm === "unsupported") return;
  await installListeners();
  if (opts.userId) {
    await registerTokenWithServer({
      userId: opts.userId,
      appVersion: opts.appVersion,
      deviceModel: opts.deviceModel,
    });
  }
}
