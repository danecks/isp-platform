import { useQuery } from "@tanstack/react-query";

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
  if (!esRolInterno(rol)) return { ok: true };
  const dom = String(dominio || DOMINIO_DEFAULT).trim().toLowerCase();
  if (!correo || !String(correo).trim()) {
    return { ok: false, error: `El correo institucional es obligatorio (@${dom})` };
  }
  const c = String(correo).trim().toLowerCase();
  if (!RE_CORREO.test(c)) return { ok: false, error: "Formato de correo inválido" };
  if (!c.endsWith(`@${dom}`)) return { ok: false, error: `El correo debe terminar en @${dom}` };
  return { ok: true };
}

export function useDominioInterno() {
  return useQuery<string>({
    queryKey: ["dominio-correo-interno"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      try {
        const r = await fetch(`${base}/api/config-empresa`);
        if (!r.ok) return DOMINIO_DEFAULT;
        const data = await r.json();
        return String(data?.dominio_correo_interno || DOMINIO_DEFAULT).trim().toLowerCase();
      } catch {
        return DOMINIO_DEFAULT;
      }
    },
    staleTime: 5 * 60_000,
  });
}
