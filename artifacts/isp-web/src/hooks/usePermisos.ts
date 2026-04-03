import { useQuery } from "@tanstack/react-query";
import { NAV_SECTIONS, NAV_ITEMS, type Rol } from "@/config/permissions";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const SESSION_KEY = "isp_admin_session_v2";
const getSession = () => sessionStorage.getItem(SESSION_KEY) || "";

// ─── Construir mapa estático de permisos desde NAV_SECTIONS ──────────────────
function buildStaticMap(): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const s of NAV_SECTIONS) {
    for (const item of s.items) {
      m[item.path] = [...item.roles];
    }
  }
  return m;
}

const STATIC_MAP = buildStaticMap();

// ─── Hook principal ───────────────────────────────────────────────────────────
export function usePermisos() {
  const { data: apiMap, isLoading } = useQuery<Record<string, string[]>>({
    queryKey: ["permisos-ruta-rol"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/config/permisos`, {
        headers: { "x-isp-session": getSession() },
      });
      if (!res.ok) throw new Error("Error al cargar permisos");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: false,
  });

  const mapaEfectivo = apiMap ?? STATIC_MAP;

  function rolTienePath(rol: string | null | undefined, path: string): boolean {
    if (!rol) return false;
    if (rol === "admin") return true;
    const rolesConAcceso = mapaEfectivo[path];
    if (!rolesConAcceso) {
      const itemStatic = NAV_ITEMS.find((n) => path === n.path || path.startsWith(n.path + "/"));
      if (!itemStatic) return true;
      return (itemStatic.roles as string[]).includes(rol);
    }
    return rolesConAcceso.includes(rol);
  }

  function seccionesParaRolDinamico(rol: Rol | null | undefined) {
    if (!rol) return [];
    return NAV_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((item) => rolTienePath(rol, item.path)),
    })).filter((s) => s.items.length > 0);
  }

  return {
    mapaEfectivo,
    isLoading,
    rolTienePath,
    seccionesParaRolDinamico,
  };
}
