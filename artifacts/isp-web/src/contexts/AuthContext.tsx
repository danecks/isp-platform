import { createContext, useContext, useState, ReactNode } from "react";

const CREDENTIALS = { username: "dan2336", password: "1234" };
const STORAGE_KEY = "isp_admin_session";

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: string | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_KEY + "_user") || null;
  });

  const login = (username: string, password: string): boolean => {
    if (username.trim() === CREDENTIALS.username && password === CREDENTIALS.password) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      sessionStorage.setItem(STORAGE_KEY + "_user", username.trim());
      setIsAuthenticated(true);
      setCurrentUser(username.trim());
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY + "_user");
    setIsAuthenticated(false);
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
