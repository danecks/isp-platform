import { Menu, Bell, User } from "lucide-react";

interface AdminTopbarProps {
  title: string;
  onMenuOpen: () => void;
}

export function AdminTopbar({ title, onMenuOpen }: AdminTopbarProps) {
  const now = new Date().toLocaleDateString("es-GT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="h-16 bg-[#060e1c] border-b border-white/5 flex items-center px-4 gap-4 sticky top-0 z-10">
      <button
        className="lg:hidden text-white/50 hover:text-white"
        onClick={onMenuOpen}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-white truncate">{title}</h1>
        <p className="text-[10px] text-white/30 capitalize truncate">{now}</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-1.5 text-white/40 hover:text-white transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-white/8">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white leading-none">Coordinación</p>
            <p className="text-[9px] text-white/30 mt-0.5">ISP Operaciones</p>
          </div>
        </div>
      </div>
    </header>
  );
}
