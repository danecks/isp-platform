/**
 * Detección de plataforma del runtime.
 *
 * Devuelve "android" cuando corre dentro del APK de Capacitor (com.ispsa.operaciones),
 * "ios" si en el futuro empaquetamos iOS, y "web" en cualquier navegador
 * (incluyendo escritorio admin).
 *
 * Implementación sin dependencias: detecta el objeto global que Capacitor
 * inyecta en el WebView (`window.Capacitor`). Esto evita importar
 * @capacitor/core en la web pura — el bundle queda igual de chico.
 */
export type NativePlatform = "android" | "ios" | "web";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function getPlatform(): NativePlatform {
  const cap = getCapacitor();
  const p = cap?.getPlatform?.();
  if (p === "android") return "android";
  if (p === "ios") return "ios";
  return "web";
}

export function isNative(): boolean {
  return getCapacitor()?.isNativePlatform?.() === true;
}

export function isAndroid(): boolean {
  return getPlatform() === "android";
}
