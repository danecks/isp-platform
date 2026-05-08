import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode } from "lucide-react";

// Lector QR de carnet unificado para todo el flujo del supervisor móvil:
//   - Login del supervisor (AgenteSupervision: escanea su propio carnet)
//   - Inspección de agente (ModalInspeccion: escanea el carnet del guardia)
//
// Centraliza la configuración probada (fps, qrbox, facingMode, soporte de
// URLs /agente/scan/<token>) y un teardown seguro que evita dobles disparos
// del callback de html5-qrcode. Si en el futuro se necesita cambiar la
// resolución, el frame guide o el procesamiento de tokens, se hace acá.

interface Props {
  // Llamado UNA sola vez con el token decodificado (sin URL prefix).
  onToken: (token: string) => void;
  // Texto del botón "iniciar". Default: "Escanear carnet".
  labelIniciar?: string;
  // Texto cuando se está escaneando. Default: "Cancelar".
  labelCancelar?: string;
  // Mensaje de error externo (opcional, se muestra debajo del scanner).
  errorExterno?: string | null;
}

export function QrCarnetReader({
  onToken, labelIniciar = "Escanear carnet", labelCancelar = "Cancelar",
  errorExterno,
}: Props) {
  // Cada instancia genera un id único: si hay dos lectores en pantalla
  // (no debería pasar, pero por defensa) no chocan en el DOM.
  const reactId = useId();
  const containerId = `isp-qr-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Latch para garantizar que el callback de decodificación se procesa una
  // sola vez, aunque html5-qrcode lo dispare varias veces antes de que
  // stop() tome efecto (caso conocido en frames de alta densidad).
  const consumidoRef = useRef(false);

  const stopScan = useCallback(async () => {
    try { await scannerRef.current?.stop(); scannerRef.current?.clear(); }
    catch { /* noop: ya estaba detenido o el contenedor desapareció */ }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    setError(null); setScanning(true); consumidoRef.current = false;
    try {
      const sc = new Html5Qrcode(containerId);
      scannerRef.current = sc;
      await sc.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (consumidoRef.current) return;
          consumidoRef.current = true;
          let token = decoded.trim();
          // Acepta URLs del tipo https://…/agente/scan/<token> y devuelve
          // sólo el token. El backend valida el token, no la URL.
          const m = token.match(/\/agente\/scan\/([^/?#]+)/);
          if (m) token = m[1];
          // Detenemos en background; no bloqueamos al consumidor del token.
          void stopScan();
          onToken(token);
        },
        () => { /* errores de frame: silenciosos */ }
      );
    } catch (e: any) {
      setScanning(false);
      setError("No se pudo abrir la cámara: " + (e?.message || e));
    }
  }, [containerId, onToken, stopScan]);

  // Limpieza al desmontar (por ej. si el modal se cierra mientras escanea).
  useEffect(() => () => { void stopScan(); }, [stopScan]);

  const errMostrar = errorExterno ?? error;

  return (
    <div className="space-y-3">
      {/* Contenedor del video. max-w-sm: probado y suficiente para que el
          QR del carnet quepa dentro del qrbox de 240×240 a distancia normal
          de lectura (~10–20 cm). NO reducir a max-w-xs: el video se hace
          más chico y el QR queda más grande que el qrbox → no decodifica. */}
      <div
        id={containerId}
        className="w-full max-w-sm mx-auto rounded overflow-hidden border border-white/10"
      />
      <div className="flex justify-center">
        {!scanning ? (
          <button
            type="button"
            onClick={() => void startScan()}
            className="px-4 py-2 bg-primary text-black text-sm font-bold rounded inline-flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" /> {labelIniciar}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void stopScan()}
            className="px-4 py-2 bg-white/10 text-white text-sm rounded"
          >
            {labelCancelar}
          </button>
        )}
      </div>
      {errMostrar && (
        <p role="alert" className="text-rose-300 text-xs text-center max-w-sm mx-auto">
          {errMostrar}
        </p>
      )}
    </div>
  );
}
