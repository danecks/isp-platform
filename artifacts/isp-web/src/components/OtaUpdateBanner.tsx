/**
 * Banner persistente "Hay una versión nueva disponible".
 *
 * Se muestra sólo en APK (en navegador no aplica OTA) cuando el bundle
 * activo lleva al menos OTA_STALE_DAYS días atrás respecto al manifest
 * publicado. Al tocar el botón, fuerza descarga + aplicación inmediata
 * (CapacitorUpdater.set) sin esperar al próximo arranque.
 *
 * Re-evalúa cada 60s para que un celular que estaba en avión y recién
 * recuperó WiFi vea el banner sin reiniciar la app.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  applyUpdateNow,
  getAppVersionInfo,
  getPublishedInfo,
  isOtaStale,
  OTA_STALE_DAYS,
  type AppVersionInfo,
  type OtaPublishedInfo,
} from "@/lib/native/liveUpdate";
import { isNative } from "@/lib/native/platform";
import { useToast } from "@/hooks/use-toast";

const POLL_MS = 60_000;

export function OtaUpdateBanner() {
  const { toast } = useToast();
  const [info, setInfo] = useState<AppVersionInfo | null>(null);
  const [pub, setPub] = useState<OtaPublishedInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isNative()) return;
    const [v] = await Promise.all([getAppVersionInfo()]);
    setInfo(v);
    setPub(getPublishedInfo());
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!isNative()) return null;
  if (!info) return null;
  if (!isOtaStale(info, pub, OTA_STALE_DAYS)) return null;

  const onUpdate = async () => {
    if (busy) return;
    setBusy(true);
    toast({
      title: "Actualizando la app…",
      description: `Descargando versión ${pub?.version ?? "nueva"}. No cierres la app.`,
      duration: 120_000,
    });
    try {
      const r = await applyUpdateNow();
      if (r.status === "error") {
        toast({
          title: "No se pudo actualizar",
          description: r.message,
          variant: "destructive",
        });
      } else if (r.status === "no-update") {
        toast({ title: "Ya estás al día" });
        await refresh();
      }
      // status "applied" reinicia la WebView; no hace falta más feedback.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 shadow-lg"
      role="alert"
      data-testid="banner-ota-vieja"
    >
      <div className="max-w-3xl mx-auto px-3 py-2 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 text-sm leading-tight">
          <p className="font-semibold truncate">
            Hay una versión nueva disponible
          </p>
          <p className="text-[11px] opacity-80 truncate">
            Tu app está en {info.bundle ?? "—"}, la publicada es {pub?.version ?? "—"}.
            Tocá para actualizar ahora.
          </p>
        </div>
        <button
          type="button"
          onClick={onUpdate}
          disabled={busy}
          className="flex-shrink-0 bg-amber-950 text-amber-50 disabled:opacity-60 px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5"
          data-testid="button-actualizar-ahora"
        >
          {busy ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Actualizando</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" /> Actualizar ahora</>
          )}
        </button>
      </div>
    </div>
  );
}

export default OtaUpdateBanner;
