/**
 * Wrapper de notificaciones push.
 *
 * Por ahora deja la infraestructura preparada pero NO inicializa Firebase —
 * el setup completo (google-services.json + APNs) se hace en una fase
 * posterior. En la web es no-op.
 *
 * Cuando se active, este archivo se encarga de: pedir permiso, registrar el
 * token y exponerlo para que el cliente lo envíe al api-server.
 */
import { isNative } from "./platform";

export type PushPermission = "granted" | "denied" | "prompt" | "unsupported";

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
 * null mientras no haya setup de Firebase completo en el proyecto Android.
 */
export async function getDeviceToken(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const mod = "@capacitor/push-notifications";
    const { PushNotifications } = await import(/* @vite-ignore */ mod);
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 5000);
      PushNotifications.addListener("registration", (t) => {
        clearTimeout(timer);
        resolve(t.value ?? null);
      });
      PushNotifications.addListener("registrationError", () => {
        clearTimeout(timer);
        resolve(null);
      });
      void PushNotifications.register();
    });
  } catch {
    return null;
  }
}
