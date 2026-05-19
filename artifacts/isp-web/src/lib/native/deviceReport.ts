/**
 * Reporte de versión del dispositivo al backend (TASK #97).
 *
 * Al iniciar sesión y después de cada chequeo OTA, el cliente envía al
 * api-server (POST /api/device-reports) qué versión nativa del APK y qué
 * bundle OTA está corriendo, junto con un deviceId aleatorio persistente.
 *
 * Esto permite al panel admin ver, sin preguntarle al usuario, qué
 * celulares se quedaron en una versión vieja y a quién contactar.
 *
 * En navegador igual reportamos: el deviceId distingue la sesión web del
 * usuario y deja constancia de que esa cuenta ingresó alguna vez. Las
 * columnas nativeVersion/bundleVersion quedan en null.
 */
import { getAppVersionInfo, getLastCheck } from "./liveUpdate";
import { getPlatform } from "./platform";

const DEVICE_ID_KEY = "isp_device_id";

function genDeviceId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fallthrough */
  }
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) return existing;
    const fresh = genDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    // Sin localStorage (modo privado raro): usamos un id efímero in-memory.
    return genDeviceId();
  }
}

function getDeviceModel(): string | null {
  try {
    const ua = navigator?.userAgent ?? "";
    return ua ? ua.slice(0, 100) : null;
  } catch {
    return null;
  }
}

export interface ReportDeviceArgs {
  userId?: number | null;
}

/**
 * Envía un reporte del dispositivo al backend. Fire-and-forget: si falla
 * (sin red, sin sesión válida) no propaga el error — el reporte es
 * diagnóstico, no debe romper login ni OTA.
 */
export async function reportDevice(args: ReportDeviceArgs = {}): Promise<void> {
  try {
    const [appInfo, deviceId] = await Promise.all([
      getAppVersionInfo(),
      Promise.resolve(getOrCreateDeviceId()),
    ]);
    const lastCheck = getLastCheck();

    const payload = {
      deviceId,
      userId: args.userId ?? null,
      platform: getPlatform(),
      nativeVersion: appInfo.native,
      bundleVersion: appInfo.bundle,
      bundleId: appInfo.bundleId,
      deviceModel: getDeviceModel(),
      lastOtaCheckAt: lastCheck?.at ?? null,
      lastOtaStatus: lastCheck?.result?.status ?? null,
    };

    await fetch("/api/device-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // No bloqueamos la UI — si falla, paciencia.
      keepalive: true,
    });
  } catch {
    /* silencioso por diseño */
  }
}
