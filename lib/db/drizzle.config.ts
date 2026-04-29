import { defineConfig } from "drizzle-kit";
import path from "path";

// IMPORTANTE — leer `replit.md` > Database Migration Policy antes de cambiar.
//
// Este archivo apunta a `./src/schema-empty.ts` de forma INTENCIONAL.
//
// La fuente de verdad de la estructura de la BD es el bloque `auto-migrate`
// en `artifacts/api-server/src/lib/auto-seed.ts` (idempotente y no destructivo).
//
// Si se apunta `schema:` al esquema real (`./src/schema/index.ts`),
// drizzle-kit y el detector automatico de Replit Deploy comparan un esquema TS
// desfasado contra la BD real, generan plan destructivo, y disparan el dialogo
// "Migrations failed validation". Si el usuario elige "Copy your development
// database schema & data to production", la BD de produccion se reemplaza por
// la de desarrollo y se PIERDEN datos (en abril 2026 borro toda la armeria).
export default defineConfig({
  schema: path.join(__dirname, "./src/schema-empty.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://disabled-by-policy",
  },
});
