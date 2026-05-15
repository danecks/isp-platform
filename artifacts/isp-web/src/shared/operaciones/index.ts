/**
 * Librería compartida de Operaciones.
 *
 * Un único punto de entrada para los componentes y utilidades que se usan en
 * más de una "capa" del producto (Admin, Portal Cliente, PWA Agente). Esto
 * deja al Portal y la PWA como capas delgadas sobre la lógica común.
 */

export * from "./formatters";
export * from "./types";
export * from "./constants";
export * from "./qrToken";
export { PeriodoToggle } from "./PeriodoToggle";
export { CumplimientoCard } from "./CumplimientoCard";
export { QrEventListItem } from "./QrEventListItem";
// Re-export del lector unificado de carnet QR para que el resto del producto
// lo importe desde la librería compartida en vez de la ruta interna.
export { QrCarnetReader } from "@/components/SupervisorJornada/QrCarnetReader";
