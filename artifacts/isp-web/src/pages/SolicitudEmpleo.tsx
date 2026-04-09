/**
 * SolicitudEmpleo.tsx
 * Versión pública del formulario de solicitud de empleo — sin PIN.
 * Ruta pública: /solicitud-empleo
 * Se comparte por WhatsApp, redes sociales, o cualquier enlace externo.
 */
import KioscoSolicitud from "./KioscoSolicitud";

export default function SolicitudEmpleo() {
  return <KioscoSolicitud skipPin />;
}
