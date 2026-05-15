/**
 * Helpers compartidos para parseo de tokens QR de carnet/agente.
 *
 * El backend acepta dos formatos al recibir un escaneo:
 *   1. El token "puro": p.ej. `abc123def456...`
 *   2. Una URL larga del tipo `https://app.isp.gt/agente/scan/<token>`
 *
 * Históricamente cada lector (QrCarnetReader, AgenteInicio, AgenteEscaneo)
 * implementaba el parseo con regex propio. Centralizar evita inconsistencia
 * cuando se agregue (por ejemplo) soporte para deep-links nuevos.
 */

const SCAN_URL_RE = /\/agente\/scan\/([^/?#]+)/;

/**
 * Extrae el token puro a partir del valor decodificado del QR.
 *
 * Soporta los formatos históricos que pueden venir impresos en gafetes
 * antiguos y nuevos:
 *   1. Token puro: `abc123def456...` → se devuelve tal cual.
 *   2. Ruta directa: `https://app.isp.gt/agente/scan/<token>` → extrae `<token>`.
 *   3. Query string: `https://x/y?token=<token>` → extrae `<token>`.
 *   4. URL genérica: cualquier URL → último segmento del pathname como fallback
 *      (replica el comportamiento que tenía AgenteInicio antes del refactor).
 */
export function parseQrToken(decoded: string): string {
  const trimmed = decoded.trim();
  const m = trimmed.match(SCAN_URL_RE);
  if (m) return m[1];
  try {
    const u = new URL(trimmed);
    return u.searchParams.get("token") || u.pathname.split("/").filter(Boolean).pop() || trimmed;
  } catch {
    return trimmed;
  }
}
