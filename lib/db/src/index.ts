import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool, types } = pg;

// ── Parsear columnas DATE como string "YYYY-MM-DD" ────────────────────────────
// Por defecto node-postgres convierte `date` a un objeto JS Date a UTC
// medianoche. Al serializar a JSON eso da "2004-08-31T00:00:00.000Z" y al
// reinterpretarlo en zonas horarias negativas (GT-6) se corre un día atrás
// (mostraría "30 de agosto"). Devolvemos el string crudo de Postgres para
// que las fechas-puras (fecha_nacimiento, vigencia_licencia, emp*_inicio,
// etc.) viajen sin contaminación de zona horaria. OID 1082 = DATE.
types.setTypeParser(1082, (val: string) => val);

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
