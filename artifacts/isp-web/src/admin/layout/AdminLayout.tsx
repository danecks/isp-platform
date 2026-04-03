import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { useDeleteMode } from "@/contexts/DeleteModeContext";

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

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    </div>
  );
}
