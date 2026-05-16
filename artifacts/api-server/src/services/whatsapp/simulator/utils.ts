/**
 * Helpers genéricos del simulador (normalización de teléfono, lookup de usuario,
 * resolución de alias y generación de IDs de incidencia simulados).
 */

import { pool } from "@workspace/db";

export function normalizarTelefono(tel: string): string {
  return tel.replace(/[\s\-\(\)\+]/g, "");
}

export interface UsuarioRow {
  id: number;
  nombre: string;
  rol: string;
  estado: string;
  telefono: string;
}

export async function buscarUsuarioPorTelefono(telefono: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query<UsuarioRow>(
    `SELECT id, nombre, rol, estado, telefono FROM users WHERE telefono = $1 LIMIT 1`,
    [telefono]
  );
  return rows[0] ?? null;
}

export async function buscarAlias(mensaje: string): Promise<string | null> {
  try {
    const aliasResult = await pool.query<{ alias: string; nombre: string }>(
      `SELECT pa.alias, sl.nombre_puesto AS nombre
       FROM position_aliases pa
       JOIN service_locations sl ON sl.id = pa.puesto_id
       WHERE pa.alias ILIKE $1
       LIMIT 1`,
      [`%${mensaje.substring(0, 30)}%`]
    );
    return aliasResult.rows[0]?.nombre ?? null;
  } catch {
    return null;
  }
}

export async function generarIdIncidencia(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SIM-${yy}${mm}${dd}-${rand}`;
}
