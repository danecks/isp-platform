/**
 * Configuración central de branding — ISP, S.A.
 *
 * Reglas de uso:
 *  - legalName  → pie de página legal, textos formales, documentación institucional
 *  - shortName  → navbar, sidebar, headers visuales, interfaces de usuario
 *  - acronym    → referencias internas cortas ("Canal ISP", "Portal ISP")
 */

export const brand = {
  legalName: "Investigaciones y Seguridad Profesional S.A.",
  shortName: "ISP, S.A.",
  acronym: "ISP",
  country: "Guatemala",
  tagline: "Seguridad que protege, profesionalismo que da confianza",
  taglineShort: "Seguridad Profesional",
  systemName: "Sistema de Operaciones Internas",
  systemShort: "ISP, S.A. · Operaciones",
  copyright: (year: number) => `© ${year} Investigaciones y Seguridad Profesional S.A. Todos los derechos reservados.`,
} as const;

export type Brand = typeof brand;
