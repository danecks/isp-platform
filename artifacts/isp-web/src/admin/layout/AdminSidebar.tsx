import { Link, useLocation } from "wouter";
import { X, ExternalLink } from "lucide-react";
import { brand } from "@/config/branding";
import { navParaRol, ROL_LABELS, ROL_COLORES } from "@/config/permissions";
import { useAuth } from "@/contexts/AuthContext";
import type { Rol } from "@/config/permissions";

const logoImg = "/images/logo-isp.jpg";

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const [location] = useLocation();
  const { currentUser } = useAuth();
  const rol = currentUser?.rol as Rol | undefined;
  const navItems = navParaRol(rol);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-[#060e1c] border-r border-white/5 flex flex-col z-30 transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/5">
          <div className="flex items-center gap-3">
            <img
              src={logoImg}
              alt={brand.shortName}
              className="w-8 h-8 object-contain rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <p className="text-xs font-bold text-white leading-none">{brand.shortName}</p>
              <p className="text-[9px] text-primary uppercase tracking-widest">Operaciones</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge */}
        {currentUser && (
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-white/40 mb-1">Acceso como</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                ROL_COLORES[currentUser.rol as Rol] ?? "text-white/50 bg-white/5 border-white/10"
              }`}
            >
              {ROL_LABELS[currentUser.rol as Rol] ?? currentUser.rol}
            </span>
          </div>
        )}

        {/* Nav items */}
        <div className="px-3 py-2 flex-1 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-widest text-white/25 px-2 pt-3 pb-1 font-semibold">
            Módulos
          </p>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                location === item.path ||
                (item.path !== "/admin" && location.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path} onClick={onClose}>
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-white/50 hover:text-white hover:bg-white/4"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                    {item.label}
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5">
          <Link href="/">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-white/30 hover:text-white/60 cursor-pointer transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver sitio público
            </div>
          </Link>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-white/30">Sistema Activo</span>
          </div>
        </div>
      </aside>
    </>
  );
}
