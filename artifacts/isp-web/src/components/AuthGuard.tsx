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

const SYSTEM_ROLES = new Set<string>([
  "admin", "operaciones", "rrhh", "comercial", "supervisor", "guardia", "cliente",
]);

/**
 * AuthGuard — Protege las rutas del panel administrativo.
 *
 * Reglas:
 * - Si no está autenticado → redirige a /admin/login
 * - Si es rol `cliente` → redirige a /portal/dashboard
 * - Para roles del sistema: verifica puedeAcceder() (lista estática)
 * - Para roles personalizados (creados en BD): permite acceso; el sidebar
 *   ya filtra los módulos según permisos dinámicos de la BD.
 * - Si se especifican requiredRoles y el rol no está → redirige a /admin/dashboard
 */
export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { isAuthenticated, currentUser } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }

  if (currentUser?.rol === "cliente") {
    return <Redirect to="/portal/dashboard" />;
  }

  const rol = currentUser?.rol ?? "";

  if (SYSTEM_ROLES.has(rol) && !puedeAcceder(rol, location)) {
    return <Redirect to="/admin/dashboard" />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!currentUser || !(requiredRoles as string[]).includes(rol)) {
      return <Redirect to="/admin/dashboard" />;
    }
  }

  return <>{children}</>;
}
