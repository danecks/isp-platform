import { createContext, useContext, useState, ReactNode } from "react";
import type { Rol } from "@/config/permissions";

export type { Rol };

export interface AuthUser {
  id: number;
  nombre: string;
  username: string;
  correo?: string | null;
  rol: Rol;
  estado: string;
  telefono?: string | null;
  clienteId?: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  login: (username: string, password: string, turnstileToken?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const STORAGE_KEY = "isp_admin_session_v2";

const AuthContext = createContext<AuthContextType | null>(null);

function loadUserFromStorage(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadUserFromStorage);

  const isAuthenticated = currentUser !== null && currentUser.estado === "activo";

  const login = async (username: string, password: string, turnstileToken?: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error ?? "Credenciales inválidas" };
      }
      const user = data.user as AuthUser;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      setCurrentUser(user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Error de conexión con el servidor" };
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
