// Validadores Zod reutilizables.
import { z } from "zod";

/** DPI guatemalteco — 13 dígitos sin separadores. */
export const dpiSchema = z
  .string()
  .regex(/^\d{13}$/u, "DPI debe tener exactamente 13 dígitos");

/**
 * Teléfono guatemalteco normalizado (acepta con o sin código de país 502).
 * Devuelve siempre con prefijo "502" cuando se parsea.
 */
export const telefonoGTSchema = z
  .string()
  .transform((s) => s.replace(/[^0-9]/gu, ""))
  .refine((s) => s.length === 8 || (s.length === 11 && s.startsWith("502")), {
    message: "Teléfono debe ser de 8 dígitos GT o 11 con prefijo 502",
  })
  .transform((s) => (s.length === 8 ? `502${s}` : s));

/** Fecha ISO YYYY-MM-DD. */
export const fechaISOSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Fecha debe estar en formato YYYY-MM-DD");

/** Helper: convierte un mensaje de error de Zod a una cadena legible. */
export function zodErrorToMessage(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "campo"}: ${i.message}`)
    .join("; ");
}
