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
import { reportDevice } from "./deviceReport";
import { initPush } from "./push";
import { installNativeFetchPatch } from "./fetchPatch";
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
 * Rutas que NO tienen sentido como pantalla inicial del APK. La app móvil
 * es para personal de campo (agentes, custodios y supervisores) que se
 * identifica escaneando su carnet QR — el carnet determina el rol y
 * AgenteInicio rutea solo (al flujo de turno para agentes/custodios o al
 * menú del supervisor cuando corresponde). La entrada universal del APK
 * es el escáner kiosco en /agente/inicio.
 *
 * - /admin/login: los admins usan el sitio desde una computadora.
 * - /agente (sin token): es la vista pública del carnet que muestra
 *   "No se pudo leer el carnet" si la abrís sin ?token=. No es escáner.
 * - resto: páginas marketing del sitio web público.
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
  "/admin/login",
  "/agente",
]);

const RUTA_ENTRADA_APK = "/agente/inicio";

function redirigirSiEsMarketing(): void {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (RUTAS_MARKETING.has(path)) {
      window.location.replace(RUTA_ENTRADA_APK);
    }
  } catch {
    /* noop */
  }
}

export function bootstrapNative(): void {
  if (!isNative()) return;
  // PRIMERO: parchar fetch global para que las llamadas /api/... resuelvan
  // contra el dominio corporativo. Sin esto cualquier petición HTTP falla
  // con "error de conexión con el servidor".
  installNativeFetchPatch();
  redirigirSiEsMarketing();
  // TASK #97: reportar la versión nativa/OTA actual al backend en el arranque
  // (fire-and-forget). Si todavía no hay sesión, el backend igual guarda el
  // reporte como anónimo y se reasocia en el siguiente login.
  void reportDevice();
  initLiveUpdate((r) => {
    // Cada vez que cambia el estado OTA, refrescamos el reporte para que el
    // panel admin vea la última verificación sin esperar al próximo login.
    if (r.status === "downloaded" || r.status === "no-update" || r.status === "error") {
      void reportDevice();
    }
    if (r.status === "downloading") {
      toast({
        title: "Actualizando la app…",
        description:
          `Descargando versión ${r.version}. No cierres la app, esto puede tardar 1-2 minutos.`,
        duration: 120000,
      });
    } else if (r.status === "downloaded") {
      toast({
        title: "Actualización lista",
        description:
          "Se descargó una versión nueva. Cerrá y reabrí la app para aplicarla.",
        duration: 30000,
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
