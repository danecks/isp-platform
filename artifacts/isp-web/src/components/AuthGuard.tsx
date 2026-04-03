import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { puedeAcceder } from "@/config/permissions";
import { useLocation } from "wouter";
import type { ReactNode } from "react";
import type { Rol } from "@/config/permissions";

interface AuthGuardProps {
  children: ReactNode;
  requiredRoles?: Rol[];
}

/**
 * AuthGuard — Protege las rutas del panel administrativo.
 *
 * Reglas:
 * - Si no está autenticado → redirige a /admin/login
 * - Si es rol `cliente` → redirige a /portal/dashboard (clientes tienen su propio portal)
 * - Si el rol no tiene acceso al módulo actual → redirige a /admin/dashboard
 * - Si se especifican requiredRoles y el rol no está → redirige a /admin/dashboard
 */
export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { isAuthenticated, currentUser } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }

  // Clientes no pueden acceder al área administrativa
  if (currentUser?.rol === "cliente") {
    return <Redirect to="/portal/dashboard" />;
  }

  // Role-based path check
  if (!puedeAcceder(currentUser?.rol, location)) {
    return <Redirect to="/admin/dashboard" />;
  }

  // Optional explicit role list
  if (requiredRoles && requiredRoles.length > 0) {
    if (!currentUser || !(requiredRoles as string[]).includes(currentUser.rol)) {
      return <Redirect to="/admin/dashboard" />;
    }
  }

  return <>{children}</>;
}
