import { pool } from "@workspace/db";

export const ROLES_INTERNOS = new Set([
  "admin",
  "operaciones",
  "rrhh",
  "comercial",
  "supervisor",
  "guardia",
]);

export const DOMINIO_DEFAULT = "ispsa.net";

export function esRolInterno(rol: string | null | undefined): boolean {
  if (!rol) return false;
  return ROLES_INTERNOS.has(String(rol).toLowerCase());
}

export function normalizarLocalParteCorreo(raw: string): string {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

export function generarCorreoInterno(username: string, dominio: string): string {
  const local = normalizarLocalParteCorreo(username);
  const dom = String(dominio || DOMINIO_DEFAULT).trim().toLowerCase();
  return `${local}@${dom}`;
}

const RE_CORREO = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function validarCorreoInterno(
  correo: string | null | undefined,
  dominio: string,
  rol: string | null | undefined,
): { ok: boolean; error?: string } {
  const interno = esRolInterno(rol);
  const dom = String(dominio || DOMINIO_DEFAULT).trim().toLowerCase();

  if (!interno) return { ok: true };

  if (!correo || !String(correo).trim()) {
    return { ok: false, error: `El correo institucional es obligatorio para usuarios internos (@${dom})` };
  }
  const c = String(correo).trim().toLowerCase();
  if (!RE_CORREO.test(c)) {
    return { ok: false, error: "Formato de correo inválido" };
  }
  if (!c.endsWith(`@${dom}`)) {
    return { ok: false, error: `El correo debe terminar en @${dom}` };
  }
  return { ok: true };
}

let _cacheDom: { val: string; exp: number } | null = null;

export async function obtenerDominioInterno(): Promise<string> {
  const now = Date.now();
  if (_cacheDom && _cacheDom.exp > now) return _cacheDom.val;
  try {
    const { rows } = await pool.query(
      `SELECT dominio_correo_interno FROM config_empresa WHERE id = 1 LIMIT 1`,
    );
    const dom = String(rows[0]?.dominio_correo_interno || DOMINIO_DEFAULT).trim().toLowerCase();
    _cacheDom = { val: dom, exp: now + 60_000 };
    return dom;
  } catch {
    return DOMINIO_DEFAULT;
  }
}

export function invalidarCacheDominio() {
  _cacheDom = null;
}
