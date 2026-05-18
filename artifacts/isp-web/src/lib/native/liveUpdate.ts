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
  | { status: "available"; version: string; notes?: string; releasedAt?: string }
  | { status: "downloaded"; version: string; notes?: string; releasedAt?: string }
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

const LAST_CHECK_KEY = "isp_ota_last_check";

export type OtaLastCheck = {
  at: string; // ISO
  result: OtaCheckResult;
};

function persistLastCheck(result: OtaCheckResult): void {
  try {
    const entry: OtaLastCheck = { at: new Date().toISOString(), result };
    localStorage.setItem(LAST_CHECK_KEY, JSON.stringify(entry));
  } catch {
    /* noop */
  }
}

export function getLastCheck(): OtaLastCheck | null {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OtaLastCheck;
  } catch {
    return null;
  }
}

export type AppVersionInfo = {
  native: string | null; // versión del APK instalado
  bundle: string | null; // versión del bundle OTA activo
  bundleId: string | null; // id interno del bundle
  builtin: boolean; // true si está corriendo el bundle empaquetado
};

/**
 * Lee la versión nativa (APK) y la versión del bundle OTA activo desde el
 * plugin CapacitorUpdater. En navegador devuelve todo null.
 */
export async function getAppVersionInfo(): Promise<AppVersionInfo> {
  if (!isNative()) {
    return { native: null, bundle: null, bundleId: null, builtin: false };
  }
  try {
    const mod = "@capgo/capacitor-updater";
    const { CapacitorUpdater } = await import(/* @vite-ignore */ mod);
    const current = await CapacitorUpdater.current();
    const bundle = current?.bundle ?? null;
    return {
      native: typeof current?.native === "string" ? current.native : null,
      bundle: typeof bundle?.version === "string" ? bundle.version : null,
      bundleId: typeof bundle?.id === "string" ? bundle.id : null,
      builtin: bundle?.id === "builtin" || bundle?.version === "builtin",
    };
  } catch {
    return { native: null, bundle: null, bundleId: null, builtin: false };
  }
}

export async function checkForUpdate(): Promise<OtaCheckResult> {
  if (!isNative()) {
    const r: OtaCheckResult = { status: "unsupported" };
    persistLastCheck(r);
    return r;
  }

  let result: OtaCheckResult;
  try {
    const mod = "@capgo/capacitor-updater";
    const { CapacitorUpdater } = await import(/* @vite-ignore */ mod);
    const manifest = await fetchManifest();
    if (!manifest) {
      result = { status: "error", message: "No se pudo leer el manifest OTA" };
    } else {
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version === manifest.version) {
        result = { status: "no-update" };
      } else {
        const dl = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
          ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
        });
        if (!dl?.id) {
          result = { status: "error", message: "Descarga OTA falló" };
        } else {
          await CapacitorUpdater.next({ id: dl.id });
          result = { status: "downloaded", version: manifest.version, notes: manifest.notes, releasedAt: manifest.releasedAt };
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { status: "error", message };
  }
  persistLastCheck(result);
  return result;
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
