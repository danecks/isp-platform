import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuración del wrapper Capacitor "ISP Operaciones".
 *
 * - appId: identificador único del paquete Android (no cambiar; cambiarlo
 *   significa que usuarios existentes verán la app como otra distinta y
 *   deberán reinstalar).
 * - webDir: carpeta con el bundle compilado de @workspace/isp-web. El script
 *   `pnpm run copy:web` copia `artifacts/isp-web/dist/public/` a `./www/`
 *   antes de `cap sync`.
 * - server.androidScheme: usamos `https` para que el WebView trate los
 *   recursos locales como contexto seguro (geolocation, camera, etc.).
 * - CapacitorUpdater: parámetros del OTA. El cliente JS en
 *   `isp-web/src/lib/native/liveUpdate.ts` se encarga de chequear el
 *   manifest y aplicar la versión nueva.
 */
const config: CapacitorConfig = {
  appId: "com.ispsa.operaciones",
  appName: "ISP Operaciones",
  webDir: "www",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: "https://ispsa.net/app-updates/manifest.json",
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: false,
    },
    // PushNotifications — usa Firebase Cloud Messaging en Android.
    // Requiere `google-services.json` en `android/app/` y el plugin
    // `com.google.gms.google-services` en el `build.gradle` raíz
    // (ver artifacts/isp-mobile-android/android-templates/README-firebase.md).
    // `presentationOptions` controla cómo se muestran las notificaciones
    // recibidas mientras la app está en foreground.
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
