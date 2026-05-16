/**
 * SIMULADOR DE WHATSAPP — ISP, S.A.
 *
 * Punto único de entrada al simulador. La lógica está dividida por
 * responsabilidad:
 *
 *   types.ts        — interfaces compartidas (DebugInfo, SimularParams, ...)
 *   utils.ts        — normalización de teléfono, lookup de usuario, alias
 *   validation.ts   — sesión DPI, usuario inactivo, número desconocido
 *   real.ts         — handlers que persisten en la base de datos
 *   dry-run.ts      — handlers equivalentes que NO escriben (mismo shape)
 *   simulate.ts     — orquestador principal
 */

export { simularMensaje } from "./simulate";
export { normalizarTelefono } from "./utils";
export type { DebugInfo, SimularParams, SimularResult } from "./types";
