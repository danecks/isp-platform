/**
 * Índice de seeds — Fase 0 (refactor de fundaciones).
 *
 * Cada archivo de este directorio es un script tsx independiente que se
 * ejecuta manualmente desde la raíz del paquete `api-server`:
 *
 *   pnpm exec tsx src/seed/operaciones.ts   # leads, incidencias, tareas, clientes
 *   pnpm exec tsx src/seed/rrhh.ts          # empleados de ejemplo
 *   pnpm exec tsx src/seed/usuarios.ts      # usuarios admin/portal
 *   pnpm exec tsx src/seed/asignaciones.ts  # asignaciones de agentes a clientes
 *
 * IMPORTANTE: NO confundir con `lib/auto-seed.ts`, que es el migrador
 * idempotente que corre en cada arranque del servidor (única fuente de verdad
 * para CREATE TABLE/COLUMN en producción). Estos archivos sí mutan datos y se
 * usan únicamente en entornos de desarrollo / staging.
 */
export const SEED_SCRIPTS = [
  "operaciones",
  "rrhh",
  "usuarios",
  "asignaciones",
] as const;
