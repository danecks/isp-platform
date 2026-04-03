import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import type { ReactNode } from "react";
import type { Rol } from "@/config/permissions";
import { usePermisos } from "@/hooks/usePermisos";

interface AuthGuardProps {
  children: ReactNode;
  requiredRoles?: Rol[];
}

/**
 * AuthGuard — Protege las rutas del panel administrativo.
 *
 * Reglas:
 * - Si no está autenticado → redirige a /admin/login
 * - Si es rol `cliente` → redirige a /portal/dashboard
 * - Si el rol no tiene acceso al módulo actual → redirige a /admin/dashboard
 * - Si se especifican requiredRoles y el rol no está → redirige a /admin/dashboard
 */
export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { isAuthenticated, currentUser } = useAuth();
  const [location] = useLocation();
  const { rolTienePath, isLoading } = usePermisos();

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }

  if (currentUser?.rol === "cliente") {
    return <Redirect to="/portal/dashboard" />;
  }

  // Mientras cargan los permisos desde la API, usar los estáticos (rolTienePath
  // ya aplica el fallback estático internamente cuando apiMap no está listo).
  if (!isLoading && !rolTienePath(currentUser?.rol, location)) {
    return <Redirect to="/admin/dashboard" />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!currentUser || !(requiredRoles as string[]).includes(currentUser.rol)) {
      return <Redirect to="/admin/dashboard" />;
    }
  }

  return <>{children}</>;
}
