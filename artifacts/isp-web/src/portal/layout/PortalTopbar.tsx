import { Menu, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PortalTopbarProps {
  title: string;
  onMenuOpen: () => void;
}

export function PortalTopbar({ title, onMenuOpen }: PortalTopbarProps) {
  const { currentUser } = useAuth();

  return (
    <header className="h-14 bg-[#060e1c] border-b border-white/5 flex items-center px-4 gap-4 shrink-0">
      <button
        onClick={onMenuOpen}
        className="lg:hidden text-white/50 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-sm font-semibold text-white flex-1">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs text-white/70 font-medium leading-none">
            {currentUser?.nombre}
          </span>
          <span className="text-[10px] text-primary/60 mt-0.5">
            {currentUser?.clienteId ?? "Portal Cliente"}
          </span>
        </div>

        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-primary text-[10px] font-bold uppercase">
            {currentUser?.nombre?.charAt(0) ?? "C"}
          </span>
        </div>
      </div>
    </header>
  );
}
