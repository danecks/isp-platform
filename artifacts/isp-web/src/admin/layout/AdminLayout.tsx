import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Trash2, X, Clock, LogOut } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

function DeleteModeBanner() {
  const { active, deactivate } = useDeleteMode();
  if (!active) return null;
  return (
    <div className="flex items-center justify-between gap-4 bg-red-900/40 border-b border-red-500/30 px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <Trash2 className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
        <span className="text-sm font-semibold text-red-300">Modo eliminación activo</span>
        <span className="hidden sm:inline text-xs text-red-400/70">
          — Los registros muestran botones de eliminación. Haz clic en un botón para abrir la solicitud.
        </span>
      </div>
      <button
        onClick={deactivate}
        className="flex items-center gap-1.5 text-xs text-red-300 hover:text-white bg-red-500/15 hover:bg-red-500/30 border border-red-500/25 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
        Salir del modo
      </button>
    </div>
  );
}

const WARN_SECONDS = 5 * 60;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function IdleWarningModal({ onStay, onLogout }: { onStay: () => void; onLogout: () => void }) {
  const [seconds, setSeconds] = useState(WARN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSeconds(WARN_SECONDS);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (seconds === 0) onLogout();
  }, [seconds, onLogout]);

  const urgent = seconds <= 60;
  const pct = (seconds / WARN_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className={`bg-[#0c1628] border rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center transition-colors duration-500 ${
        urgent ? "border-red-500/40" : "border-yellow-500/30"
      }`}>
        {/* Ícono */}
        <div className={`flex items-center justify-center w-14 h-14 rounded-full mx-auto mb-4 border transition-colors duration-500 ${
          urgent
            ? "bg-red-500/10 border-red-500/25"
            : "bg-yellow-500/10 border-yellow-500/20"
        }`}>
          <Clock className={`w-7 h-7 transition-colors duration-500 ${urgent ? "text-red-400 animate-pulse" : "text-yellow-400"}`} />
        </div>

        <h2 className="text-base font-bold text-white mb-2">¿Sigues ahí?</h2>

        {/* Contador grande */}
        <div className={`text-4xl font-mono font-bold mb-1 tabular-nums transition-colors duration-500 ${
          urgent ? "text-red-400" : "text-yellow-400"
        }`}>
          {fmt(seconds)}
        </div>

        {/* Barra de progreso */}
        <div className="w-full h-1.5 bg-white/10 rounded-full mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${urgent ? "bg-red-400" : "bg-yellow-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-sm text-white/40 mb-6">
          {urgent
            ? "La sesión se cerrará en menos de un minuto"
            : "Tu sesión se cerrará por inactividad. Haz clic en Continuar para seguir."}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/25 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
          <button
            onClick={onStay}
            className={`flex-1 h-9 rounded-lg text-sm font-bold transition-colors ${
              urgent
                ? "bg-red-500 hover:bg-red-400 text-white"
                : "bg-primary hover:bg-primary/90 text-[#050d1a]"
            }`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const { logout } = useAuth();
  const [, navigate] = useLocation();

  const handleIdle = useCallback(() => {
    setShowIdleWarning(false);
    logout();
    navigate("/admin/login");
  }, [logout, navigate]);

  const handleWarn = useCallback(() => {
    setShowIdleWarning(true);
  }, []);

  const handleActivity = useCallback(() => {
    setShowIdleWarning(false);
  }, []);

  const handleStay = useCallback(() => {
    setShowIdleWarning(false);
  }, []);

  useIdleTimeout({ onIdle: handleIdle, onWarn: handleWarn, onActivity: handleActivity });

  return (
    <div className="min-h-screen bg-[#07111f] text-white flex">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        <AdminTopbar title={title} onMenuOpen={() => setSidebarOpen(true)} />
        <DeleteModeBanner />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {showIdleWarning && (
        <IdleWarningModal onStay={handleStay} onLogout={handleIdle} />
      )}
    </div>
  );
}
