import { QrCarnetReader } from "@/components/SupervisorJornada/QrCarnetReader";

// Escáner público de carnet: abre la cámara para leer el QR del gafete y
// navega a la tarjeta pública (/agente?token=…). No requiere credenciales de
// supervisor — pensado para quien quiere verificar un carnet sin tener que
// pegar el enlace a mano. Reutiliza el lector probado del flujo de supervisión.
export function EscanearCarnetPublico() {
  return (
    <QrCarnetReader
      labelIniciar="Escanear carnet con la cámara"
      onToken={(token) => {
        window.location.href = `/agente?token=${encodeURIComponent(token)}`;
      }}
    />
  );
}
