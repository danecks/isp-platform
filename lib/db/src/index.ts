import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// ── Zona horaria Guatemala para todas las conexiones ──────────────────────────
// Guatemala no observa DST; siempre UTC-6.
// Esto hace que CURRENT_DATE, NOW(), CURRENT_TIMESTAMP devuelvan la hora
// correcta de Guatemala en todas las queries de toda la aplicación.
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'America/Guatemala'");
});

// Helper JS para obtener la fecha de hoy en Guatemala como "YYYY-MM-DD".
// Usar siempre que el código TypeScript/JavaScript necesite la fecha de hoy,
// en lugar de new Date().toISOString().slice(0,10) que usa UTC del servidor.
export function todayGT(): string {
  // Guatemala = UTC-6, sin DST
  const d = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return d.toISOString().substring(0, 10);
}

export * from "./schema";
