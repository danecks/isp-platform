/**
 * Wrapper de almacenamiento clave/valor.
 *
 * En APK Android usa `@capacitor/preferences` (persistencia nativa, sobrevive
 * a OTAs y a limpiar caché del WebView).
 * En navegador usa `localStorage`.
 *
 * Mantenemos la API minimal (get/set/remove) y siempre string — el caller
 * serializa JSON si necesita estructuras.
 */
import { isNative } from "./platform";

export async function getItem(key: string): Promise<string | null> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    const r = await Preferences.get({ key });
    return r.value ?? null;
  }
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
    return;
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* quota/private mode — ignorar */
  }
}

export async function removeItem(key: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
    return;
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* ignorar */
  }
}
