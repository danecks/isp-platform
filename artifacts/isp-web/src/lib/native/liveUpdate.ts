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
  | { status: "downloading"; version: string }
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
const LAST_MANIFEST_KEY = "isp_ota_last_manifest";
const PENDING_BUNDLE_KEY = "isp_ota_pending_bundle";

/**
 * Umbral de "celular quedó atrás": si la versión publicada lleva más de
 * estos días disponible y el bundle activo sigue siendo otro, mostramos
 * el banner persistente "Hay una versión nueva disponible".
 *
 * Se eligió 2 días como compromiso: cubre celulares apagados un fin de
 * semana sin alarmar a usuarios que abren la app a las pocas horas de
 * un release.
 */
export const OTA_STALE_DAYS = 2;

export type OtaLastCheck = {
  at: string; // ISO
  result: OtaCheckResult;
};

export type OtaPublishedInfo = {
  version: string;
  releasedAt: string | null; // ISO o null si el manifest no lo trae
  notes: string | null;
  fetchedAt: string; // ISO — cuándo leímos el manifest
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

function persistPublished(m: OtaManifest): void {
  try {
    const entry: OtaPublishedInfo = {
      version: m.version,
      releasedAt: typeof m.releasedAt === "string" ? m.releasedAt : null,
      notes: typeof m.notes === "string" ? m.notes : null,
      fetchedAt: new Date().toISOString(),
    };
    localStorage.setItem(LAST_MANIFEST_KEY, JSON.stringify(entry));
  } catch {
    /* noop */
  }
}

export function getPublishedInfo(): OtaPublishedInfo | null {
  try {
    const raw = localStorage.getItem(LAST_MANIFEST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OtaPublishedInfo;
  } catch {
    return null;
  }
}

function persistPendingBundle(id: string, version: string): void {
  try {
    localStorage.setItem(PENDING_BUNDLE_KEY, JSON.stringify({ id, version }));
  } catch {
    /* noop */
  }
}

function getPendingBundle(): { id: string; version: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_BUNDLE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { id?: string; version?: string };
    if (!j?.id || !j?.version) return null;
    return { id: j.id, version: j.version };
  } catch {
    return null;
  }
}

function clearPendingBundle(): void {
  try { localStorage.removeItem(PENDING_BUNDLE_KEY); } catch { /* noop */ }
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
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
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

export async function checkForUpdate(
  onProgress?: (r: OtaCheckResult) => void,
): Promise<OtaCheckResult> {
  if (!isNative()) {
    const r: OtaCheckResult = { status: "unsupported" };
    persistLastCheck(r);
    return r;
  }

  let result: OtaCheckResult;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    const manifest = await fetchManifest();
    if (!manifest) {
      result = { status: "error", message: "No se pudo leer el manifest OTA" };
    } else {
      persistPublished(manifest);
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version === manifest.version) {
        clearPendingBundle();
        result = { status: "no-update" };
      } else {
        onProgress?.({ status: "downloading", version: manifest.version });
        const dl = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
          ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
        });
        if (!dl?.id) {
          result = { status: "error", message: "Descarga OTA falló" };
        } else {
          await CapacitorUpdater.next({ id: dl.id });
          persistPendingBundle(dl.id, manifest.version);
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
 * "ready" para que el plugin no haga rollback al boot siguiente, registra
 * listeners de progreso/error y dispara un check OTA en background.
 *
 * Los listeners nativos (download/downloadFailed/updateAvailable) son la única
 * forma de enterarnos de fallas cuando el plugin usa `autoUpdate: true` y
 * descarga por su cuenta sin pasar por `checkForUpdate()` del JS.
 */
export function initLiveUpdate(onResult?: (r: OtaCheckResult) => void): void {
  if (!isNative()) return;
  void (async () => {
    try {
      const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
      try {
        await CapacitorUpdater.notifyAppReady();
      } catch {
        /* primer boot — ignorar */
      }
      try {
        await CapacitorUpdater.addListener?.("download", (info: { percent?: number; version?: string }) => {
          const pct = typeof info?.percent === "number" ? info.percent : -1;
          const ver = typeof info?.version === "string" ? info.version : "?";
          if (pct === 100) {
            onResult?.({ status: "downloaded", version: ver });
          } else if (pct >= 0) {
            onResult?.({ status: "downloading", version: ver });
          }
        });
        await CapacitorUpdater.addListener?.("downloadFailed", (info: { version?: string }) => {
          const ver = typeof info?.version === "string" ? info.version : "?";
          const r: OtaCheckResult = { status: "error", message: `download failed v${ver}` };
          persistLastCheck(r);
          onResult?.(r);
        });
        await CapacitorUpdater.addListener?.("updateAvailable", (info: { bundle?: { version?: string } }) => {
          const ver = info?.bundle?.version;
          if (typeof ver === "string") onResult?.({ status: "available", version: ver });
        });
        await CapacitorUpdater.addListener?.("updateFailed", (info: { bundle?: { version?: string } }) => {
          const ver = info?.bundle?.version ?? "?";
          const r: OtaCheckResult = { status: "error", message: `update failed v${ver}` };
          persistLastCheck(r);
          onResult?.(r);
        });
      } catch {
        /* listeners no soportados — seguir igual */
      }
      const r = await checkForUpdate(onResult);
      onResult?.(r);
    } catch {
      /* silenciar — la app sigue corriendo con el bundle actual */
    }
  })();
}

/**
 * Compara la versión publicada (último manifest leído) contra el bundle
 * activo y devuelve true si el bundle está atrasado y, además, la versión
 * publicada lleva al menos `days` días disponible.
 *
 * Si no hay manifest cacheado todavía, devuelve false (no podemos juzgar).
 * Si el manifest no trae releasedAt, usamos fetchedAt como referencia
 * mínima (lo que conocimos en este dispositivo).
 */
export function isOtaStale(
  info: AppVersionInfo,
  published: OtaPublishedInfo | null,
  days: number = OTA_STALE_DAYS,
): boolean {
  if (!published) return false;
  if (!info.bundle) return false;
  if (info.bundle === published.version) return false;
  const referenceIso = published.releasedAt ?? published.fetchedAt;
  const ref = new Date(referenceIso).getTime();
  if (!Number.isFinite(ref)) return false;
  const ageMs = Date.now() - ref;
  const thresholdMs = Math.max(0, days) * 24 * 60 * 60 * 1000;
  return ageMs >= thresholdMs;
}

export type OtaApplyResult =
  | { status: "applied" } // CapacitorUpdater.set reinicia la WebView, normalmente no se ve esto
  | { status: "no-update" }
  | { status: "error"; message: string }
  | { status: "unsupported" };

/**
 * Forza la descarga (si hace falta) y aplica el nuevo bundle inmediatamente
 * sin esperar al próximo arranque. Usado por el banner "Actualizar ahora".
 *
 * Estrategia:
 *  1. Si ya hay un bundle pendiente (descargado por checkForUpdate o por el
 *     autoUpdate del plugin) cuyo id conocemos, llamamos directamente a
 *     `set({ id })`.
 *  2. Si no, leemos el manifest, descargamos y aplicamos.
 *
 * `set()` del plugin Capgo cambia el bundle activo y reinicia la WebView en
 * caliente — el usuario ve un "flash" de medio segundo y entra a la app
 * nueva. Mucho más efectivo que decirle "cerrá y reabrí".
 */
export async function applyUpdateNow(
  onProgress?: (r: OtaCheckResult) => void,
): Promise<OtaApplyResult> {
  if (!isNative()) return { status: "unsupported" };
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

    // 1) ¿Ya tenemos un bundle descargado esperando?
    const pending = getPendingBundle();
    if (pending) {
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version === pending.version) {
        // Ya está corriendo — limpiar y avisar.
        clearPendingBundle();
        return { status: "no-update" };
      }
      try {
        await CapacitorUpdater.set({ id: pending.id });
        clearPendingBundle();
        return { status: "applied" };
      } catch {
        // El bundle pendiente puede haber sido limpiado por el plugin;
        // caemos al flujo de descarga fresca.
        clearPendingBundle();
      }
    }

    // 2) Descarga fresca desde el manifest.
    const manifest = await fetchManifest();
    if (!manifest) {
      return { status: "error", message: "No se pudo leer el manifest OTA" };
    }
    persistPublished(manifest);
    const current = await CapacitorUpdater.current();
    if (current?.bundle?.version === manifest.version) {
      return { status: "no-update" };
    }
    onProgress?.({ status: "downloading", version: manifest.version });
    const dl = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
      ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
    });
    if (!dl?.id) {
      return { status: "error", message: "Descarga OTA falló" };
    }
    await CapacitorUpdater.set({ id: dl.id });
    return { status: "applied" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", message };
  }
}
