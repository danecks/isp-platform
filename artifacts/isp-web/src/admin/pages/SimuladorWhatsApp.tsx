/**
 * Re-export del simulador de WhatsApp.
 *
 * La implementación está dividida en `whatsapp-simulator/` (orquestador +
 * paneles de chat, config y debug). Este archivo se mantiene como punto de
 * entrada para no romper imports existentes (`@/admin/pages/SimuladorWhatsApp`).
 */

export { default } from "./whatsapp-simulator";
