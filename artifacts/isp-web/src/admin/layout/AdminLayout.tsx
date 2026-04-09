import { useState, useCallback } from "react";
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

function IdleWarningModal({ onStay, onLogout }: { onStay: () => void; onLogout: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#0c1628] border border-yellow-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/20 mx-auto mb-4">
          <Clock className="w-7 h-7 text-yellow-400 animate-pulse" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">¿Sigues ahí?</h2>
        <p className="text-sm text-white/50 mb-1">
          Tu sesión se cerrará en <span className="text-yellow-400 font-semibold">5 minutos</span> por inactividad.
        </p>
        <p className="text-xs text-white/30 mb-6">
          Por seguridad, el sistema cierra la sesión tras 1 hora sin actividad.
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
            className="flex-1 h-9 rounded-lg bg-primary text-[#050d1a] text-sm font-bold hover:bg-primary/90 transition-colors"
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
