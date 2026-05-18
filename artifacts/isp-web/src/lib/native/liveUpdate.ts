/**
 * OTA / Live Update.
 *
 * Al iniciar la app dentro del APK, consulta el manifest publicado en
 * `ispsa.net/app-updates/manifest.json`. Si la versión es distinta a la
 * actualmente activa, descarga el bundle en background y lo deja listo para
 * aplicarse al próximo arranque.
 *
 * El plugin `@capgo/capacitor-updater` ya soporta autoUpdate por config
 * (ver capacitor.config.ts del wrapper); este módulo expone además un check
 * manual para mostrar el toast "Actualización disponible" en la UI.
 *
 * En navegador es no-op: el sitio web se sirve siempre con la última versión.
 */
import { isNative } from "./platform";

const MANIFEST_URL = "https://ispsa.net/app-updates/manifest.json";

export type OtaManifest = {
  version: string;
  url: string;
  checksum?: string;
  releasedAt?: string;
  notes?: string;
};

export type OtaCheckResult =
  | { status: "no-update" }
  | { status: "available"; version: string; notes?: string }
  | { status: "downloaded"; version: string; notes?: string }
  | { status: "error"; message: string }
  | { status: "unsupported" };

async function fetchManifest(): Promise<OtaManifest | null> {
  try {
    const r = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as Partial<OtaManifest>;
    if (!j.version || !j.url) return null;
    return j as OtaManifest;
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<OtaCheckResult> {
  if (!isNative()) return { status: "unsupported" };

  try {
    const mod = "@capgo/capacitor-updater";
    const { CapacitorUpdater } = await import(/* @vite-ignore */ mod);
    const manifest = await fetchManifest();
    if (!manifest) return { status: "error", message: "No se pudo leer el manifest OTA" };

    const current = await CapacitorUpdater.current();
    if (current?.bundle?.version === manifest.version) return { status: "no-update" };

    const dl = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
      ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
    });
    if (!dl?.id) return { status: "error", message: "Descarga OTA falló" };

    await CapacitorUpdater.next({ id: dl.id });
    return { status: "downloaded", version: manifest.version, notes: manifest.notes };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", message };
  }
}

/**
 * Llamar UNA vez al montar la app (App.tsx). Marca el bundle actual como
 * "ready" para que el plugin no haga rollback al boot siguiente, y dispara
 * un check OTA en background sin bloquear el render.
 */
export function initLiveUpdate(onResult?: (r: OtaCheckResult) => void): void {
  if (!isNative()) return;
  void (async () => {
    try {
      const mod = "@capgo/capacitor-updater";
      const { CapacitorUpdater } = await import(/* @vite-ignore */ mod);
      try {
        await CapacitorUpdater.notifyAppReady();
      } catch {
        /* primer boot — ignorar */
      }
      const r = await checkForUpdate();
      onResult?.(r);
    } catch {
      /* silenciar — la app sigue corriendo con el bundle actual */
    }
  })();
}
