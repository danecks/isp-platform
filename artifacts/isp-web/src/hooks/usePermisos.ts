import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface PermisosResponse {
  rol: string;
  modulos: string[];
}

export function usePermisos() {
  const { currentUser } = useAuth();

  const { data, isLoading } = useQuery<PermisosResponse>({
    queryKey: ["session-permisos", currentUser?.username],
    queryFn: async () => {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${BASE}/api/session/permisos`, {
        headers: {
          "x-isp-session": currentUser
            ? JSON.stringify({ username: currentUser.username, rol: currentUser.rol, nombre: currentUser.nombre })
            : "",
        },
      });
      if (!r.ok) throw new Error("Error al cargar permisos");
      return r.json();
    },
    enabled: !!currentUser,
    staleTime: 0,
    gcTime: 60_000,
  });

  const modulosSet = new Set<string>(data?.modulos ?? []);

  function tienePermiso(moduloClave: string): boolean {
    if (currentUser?.rol === "admin") return true;
    return modulosSet.has(moduloClave);
  }

  return {
    modulos: modulosSet,
    tienePermiso,
    isLoading,
    rol: data?.rol ?? currentUser?.rol ?? null,
  };
}
