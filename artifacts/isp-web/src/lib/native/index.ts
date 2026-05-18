/**
 * Punto único de import para los helpers nativos.
 *
 * Uso recomendado:
 *
 *   import { isNative, getCurrentPosition, capturePhoto } from "@/lib/native";
 *
 * Cada wrapper detecta plataforma internamente — el caller no necesita
 * preguntar si está en APK o navegador antes de invocar.
 */
export * from "./platform";
export * as Geo from "./geolocation";
export * as BgGeo from "./backgroundLocation";
export * as Cam from "./camera";
export * as Store from "./storage";
export * as Push from "./push";
export * as LiveUpdate from "./liveUpdate";
