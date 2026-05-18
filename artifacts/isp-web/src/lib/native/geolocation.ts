/**
 * Wrapper de geolocalización.
 *
 * En APK Android usa `@capacitor/geolocation` (permisos nativos, mejor
 * precisión, funciona aunque el WebView restrinja la Web Geolocation API).
 * En navegador hace fallback a `navigator.geolocation`.
 *
 * El plugin Capacitor se carga dinámicamente para no inflar el bundle web.
 */
import { isNative } from "./platform";

export type GeoCoords = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type GeoOptions = {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
};

export async function getCurrentPosition(opts: GeoOptions = {}): Promise<GeoCoords> {
  if (isNative()) {
    const mod = "@capacitor/geolocation";
    const { Geolocation } = await import(/* @vite-ignore */ mod);
    const p = await Geolocation.getCurrentPosition({
      enableHighAccuracy: opts.enableHighAccuracy ?? true,
      timeout: opts.timeoutMs ?? 15000,
    });
    return {
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy,
      timestamp: p.timestamp,
    };
  }

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalización no disponible en este navegador"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
        }),
      (err) => reject(err),
      {
        enableHighAccuracy: opts.enableHighAccuracy ?? true,
        timeout: opts.timeoutMs ?? 15000,
        maximumAge: 0,
      },
    );
  });
}
