import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }
  return <>{children}</>;
}
