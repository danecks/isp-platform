// Schema intencionalmente vacio para drizzle-kit / Replit Deploy migration scanner.
//
// El esquema real declarado por TypeScript vive en `./schema/isp.ts` (importado
// por la app via `./schema/index.ts`). Pero ESE esquema esta intencionalmente
// desfasado vs la BD real (no incluye armas, arma_custodia, puestos_operativos,
// novedades, kiosko, ni columnas extra que ha agregado auto-migrate).
//
// La fuente de verdad de la estructura de BD es el bloque `auto-migrate` en
// `artifacts/api-server/src/lib/auto-seed.ts` (idempotente, no destructivo,
// solo CREATE/ADD IF NOT EXISTS).
//
// `drizzle.config.ts` apunta a ESTE archivo para que drizzle-kit y el detector
// automatico de migraciones de Replit Deploy vean "0 tablas declaradas" → "0
// cambios" → ningun dialogo destructivo "Migrations failed validation".
//
// Ver `replit.md` > Database Migration Policy para el contexto completo del
// incidente de abril 2026 (wipe de la armeria por copy dev → prod).
export {};
