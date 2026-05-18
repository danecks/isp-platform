/**
 * Wrapper de geolocalización en BACKGROUND para el supervisor.
 *
 * En APK Android usa `@capacitor-community/background-geolocation`, que
 * arranca un servicio en primer plano con notificación persistente y
 * mantiene el WebView vivo aunque la app esté minimizada o la pantalla
 * apagada. En navegador hace fallback a `navigator.geolocation.watchPosition`
 * (que sólo funciona con la pestaña visible; sirve para desarrollo y para
 * supervisores que usan la PWA en escritorio).
 *
 * El plugin se carga dinámicamente para no inflar el bundle web y para que
 * el código corra sin error si la APK se compiló sin el plugin.
 */
import { isNative } from "./platform";

export type BgLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

export type BgWatcherOptions = {
  /** Texto de la notificación persistente (Android). */
  backgroundTitle?: string;
  backgroundMessage?: string;
  /** Distancia mínima (metros) entre lecturas antes de notificar. 0 = todas. */
  distanceFilter?: number;
  /** Si true (default), pide permiso ACCESS_BACKGROUND_LOCATION. */
  requestPermissions?: boolean;
};

export type BgWatcherHandle = {
  stop: () => Promise<void>;
  isNative: boolean;
};

type WatcherCallback = (
  location: BgLocation | null,
  error: { code: string; message: string } | null
) => void;

/**
 * Arranca el watcher de background y devuelve un handle para detenerlo.
 * El callback recibe locations o un error (permiso denegado, GPS off, etc).
 * Llamar `handle.stop()` al cerrar jornada o desmontar.
 */
export async function startBackgroundWatcher(
  cb: WatcherCallback,
  opts: BgWatcherOptions = {}
): Promise<BgWatcherHandle> {
  if (isNative()) {
    try {
      // El módulo sólo existe en el APK Android (ver
      // artifacts/isp-mobile-android/package.json). Evitamos que TypeScript
      // intente resolverlo en el build web — el import es dinámico y el
      // try/catch maneja el caso de plugin ausente.
      const modName = "@capacitor-community/background-geolocation";
      const mod: any = await import(/* @vite-ignore */ modName);
      const Bg = mod.BackgroundGeolocation || mod.default;
      const watcherId: string = await Bg.addWatcher(
        {
          backgroundMessage:
            opts.backgroundMessage ?? "Reportando tu ubicación durante la jornada.",
          backgroundTitle: opts.backgroundTitle ?? "ISP Operaciones — Supervisión activa",
          requestPermissions: opts.requestPermissions ?? true,
          stale: false,
          distanceFilter: opts.distanceFilter ?? 0,
        },
        (location: any, error: any) => {
          if (error) {
            cb(null, { code: String(error.code || "error"), message: String(error.message || "") });
            return;
          }
          if (!location) return;
          cb(
            {
              latitude: Number(location.latitude),
              longitude: Number(location.longitude),
              accuracy: Number(location.accuracy ?? 0),
              speed: location.speed != null ? Number(location.speed) : null,
              timestamp: Number(location.time ?? Date.now()),
            },
            null
          );
        }
      );
      return {
        isNative: true,
        stop: async () => {
          try { await Bg.removeWatcher({ id: watcherId }); } catch { /* noop */ }
        },
      };
    } catch (err: any) {
      // Plugin no presente en este APK (build viejo) → fallback al watch web.
      cb(null, {
        code: "plugin_no_disponible",
        message:
          "El APK no incluye el plugin de GPS en segundo plano. Reinstalá la versión nueva.",
      });
      return { isNative: false, stop: async () => {} };
    }
  }

  // Fallback web: solo funciona con pestaña visible.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    cb(null, { code: "no_soportado", message: "Geolocalización no disponible." });
    return { isNative: false, stop: async () => {} };
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      cb(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        },
        null
      );
    },
    (err) => {
      const msg =
        err.code === 1
          ? "Permiso de ubicación denegado."
          : err.code === 2
          ? "GPS no disponible."
          : err.code === 3
          ? "GPS tardó demasiado."
          : "No se pudo obtener la ubicación.";
      cb(null, { code: String(err.code), message: msg });
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
  );
  return {
    isNative: false,
    stop: async () => {
      try { navigator.geolocation.clearWatch(id); } catch { /* noop */ }
    },
  };
}

/**
 * Indica si el runtime soporta tracking real en background (APK con plugin).
 * En web devuelve false: el watch se pausa cuando la pestaña queda oculta.
 */
export function supportsBackgroundTracking(): boolean {
  return isNative();
}
