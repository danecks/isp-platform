/**
 * Wrapper de cámara.
 *
 * En APK Android usa `@capacitor/camera` (acceso nativo, sin restricciones
 * del WebView para getUserMedia). Devuelve un data URL listo para mandar al
 * backend o renderizar en <img>.
 * En navegador devuelve null y deja que el caller use el flujo web actual
 * (input[type=file capture] o getUserMedia con jsQR).
 */
import { isNative } from "./platform";

export type CapturedPhoto = {
  dataUrl: string;
  format: "jpeg" | "png";
};

export type CaptureOptions = {
  quality?: number; // 0–100, default 80
  allowEdit?: boolean;
};

export async function capturePhoto(opts: CaptureOptions = {}): Promise<CapturedPhoto | null> {
  if (!isNative()) return null;

  const mod = "@capacitor/camera";
  const { Camera, CameraResultType, CameraSource } = await import(/* @vite-ignore */ mod);
  const r = await Camera.getPhoto({
    quality: opts.quality ?? 80,
    allowEditing: opts.allowEdit ?? false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
  });
  if (!r.dataUrl) return null;
  return {
    dataUrl: r.dataUrl,
    format: r.format === "png" ? "png" : "jpeg",
  };
}
