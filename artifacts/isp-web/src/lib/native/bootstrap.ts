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
import { initPush } from "./push";
import { toast } from "@/hooks/use-toast";

/**
 * Lee el usuario logueado desde sessionStorage. Se accede directamente
 * (sin pasar por React context) porque bootstrap corre antes de montar
 * el árbol. Si no hay sesión todavía, AuthContext volverá a invocar
 * initPush al completar el login.
 */
function readUserIdFromSession(): number | null {
  try {
    const raw = sessionStorage.getItem("isp_admin_session_v2");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

/**
 * Rutas "marketing" del sitio web público que NO tienen sentido dentro del
 * APK (la app móvil es para guardias y supervisores, no para visitantes que
 * miran servicios). Si el WebView aterriza en una de estas al abrir el APK
 * lo redirigimos al login operativo.
 */
const RUTAS_MARKETING = new Set<string>([
  "",
  "/",
  "/nosotros",
  "/servicios",
  "/servicios/seguridad-fisica",
  "/servicios/custodia-transporte",
  "/sectores",
  "/reclutamiento",
  "/solicitar-servicio",
  "/contacto",
  "/acceso-clientes",
  "/descarga-app",
]);

function redirigirSiEsMarketing(): void {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (RUTAS_MARKETING.has(path)) {
      window.location.replace("/admin/login");
    }
  } catch {
    /* noop */
  }
}

export function bootstrapNative(): void {
  if (!isNative()) return;
  redirigirSiEsMarketing();
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

  // Push notifications: pide permiso, registra el token y lo asocia al
  // usuario logueado (si lo hay). El handler de "tocar notificación"
  // navega a la ruta enviada en data.ruta (típico: emergencias).
  void initPush({
    userId: readUserIdFromSession(),
    navigate: (ruta) => {
      try {
        window.location.assign(ruta);
      } catch {
        /* noop */
      }
    },
  });
}
