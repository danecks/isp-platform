import type { Request } from "express";
import { pool } from "@workspace/db";
import { getPermisosForUsername } from "./permisos-middleware";

/**
 * Lee la sesión de `x-isp-session` y devuelve el actor REAL validado contra BD.
 *
 * Pensado para handlers sensibles (cierre de día, reapertura, etc.) que NO
 * deben confiar en `req.body.rol` ni en `req.body.usuario` / `req.body.usuarioId`.
 * Cualquier dato del body puede ser falsificado; los datos confiables son los
 * de la fila `users` correspondiente al `username` de la sesión.
 *
 * Devuelve `null` si no hay sesión válida o el username no existe / está inactivo.
 *
 * Nota: el middleware de permisos ya rechaza rutas admin sin sesión, pero este
 * helper sirve para añadir una segunda capa dentro del handler (defense-in-depth).
 */
export async function getActorFromReq(
  req: Request
): Promise<{ id: number; username: string; rol: string } | null> {
  const raw = req.headers["x-isp-session"];
  if (typeof raw !== "string" || !raw) return null;

  let session: { username?: string; rol?: string } | null = null;
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!session?.username) return null;

  const { rol } = await getPermisosForUsername(session.username);
  if (!rol) return null;

  // Consulta el id real del usuario para que la auditoría/bitácora sea fiable.
  try {
    const r = await pool.query(
      `SELECT id FROM users WHERE username = $1 AND estado = 'activo' LIMIT 1`,
      [session.username]
    );
    if (r.rows.length === 0) return null;
    return { id: r.rows[0].id as number, username: session.username, rol };
  } catch {
    return null;
  }
}
