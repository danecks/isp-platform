/**
 * Bootstrap del runtime nativo dentro del APK.
 *
 * Se llama una sola vez al iniciar la app (desde main.tsx). En navegador es
 * no-op. En APK:
 *   - Marca el bundle actual como "ready" para el OTA updater (evita rollback).
 *   - Dispara un check OTA en background.
 *   - Cuando hay una versión nueva descargada, muestra un toast discreto
 *     informando que se aplicará al próximo arranque.
 */
import { isNative } from "./platform";
import { initLiveUpdate } from "./liveUpdate";
import { toast } from "@/hooks/use-toast";

export function bootstrapNative(): void {
  if (!isNative()) return;
  initLiveUpdate((r) => {
    if (r.status === "downloaded") {
      toast({
        title: "Actualización lista",
        description:
          "Se descargó una versión nueva. Se aplicará la próxima vez que abras la app.",
      });
    } else if (r.status === "error") {
      // Silencioso para el usuario — sólo se loggea en consola para que un
      // técnico pueda diagnosticarlo conectando el dispositivo.
      // eslint-disable-next-line no-console
      console.warn("[OTA] check falló:", r.message);
    }
  });
}
