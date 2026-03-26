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

export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const { isAuthenticated, currentUser } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
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
