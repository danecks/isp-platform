import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

interface PortalGuardProps {
  children: ReactNode;
}

/**
 * PortalGuard — Protege las rutas del portal de clientes.
 *
 * Reglas:
 * - Si no está autenticado → redirige a /admin/login (login unificado)
 * - Si está autenticado pero NO es cliente → redirige a /admin/dashboard
 * - Si es cliente → permite acceso
 */
export function PortalGuard({ children }: PortalGuardProps) {
  const { isAuthenticated, currentUser } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }

  if (currentUser?.rol !== "cliente") {
    return <Redirect to="/admin/dashboard" />;
  }

  return <>{children}</>;
}
