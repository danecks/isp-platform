import { Link, useLocation } from "wouter";
import { X, LayoutDashboard, AlertTriangle, BarChart3, Users, LogOut, ExternalLink, ShieldCheck, Zap, Shield } from "lucide-react";
import { brand } from "@/config/branding";
import { useAuth } from "@/contexts/AuthContext";

const logoImg = "/images/logo-isp.png";

const portalNav = [
  { path: "/portal/dashboard",   label: "Panel General",        icon: LayoutDashboard },
  { path: "/portal/cobertura",   label: "Cobertura de Puestos", icon: Shield },
  { path: "/portal/solicitudes", label: "Servicios Adicionales",icon: Zap },
  { path: "/portal/incidencias", label: "Incidencias",          icon: AlertTriangle },
  { path: "/portal/kpi",         label: "KPI & Métricas",       icon: BarChart3 },
  { path: "/portal/agentes",     label: "Mis Agentes",          icon: Users },
];

interface PortalSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function PortalSidebar({ open, onClose }: PortalSidebarProps) {
  const [location] = useLocation();
  const { currentUser, logout } = useAuth();

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
              className="h-10 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <p className="text-xs font-bold text-white leading-none">{brand.shortName}</p>
              <p className="text-[9px] text-primary uppercase tracking-widest">Portal de Clientes</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Client badge */}
        {currentUser && (
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] text-white/40 mb-1">Cuenta activa</p>
            <p className="text-xs font-semibold text-white truncate">{currentUser.nombre}</p>
            {currentUser.clienteId && (
              <p className="text-[10px] text-primary/70 font-mono mt-0.5">{currentUser.clienteId}</p>
            )}
          </div>
        )}

        {/* Nav */}
        <div className="px-3 py-2 flex-1 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-widest text-white/25 px-2 pt-3 pb-1 font-semibold">
            Mi Portal
          </p>
          <nav className="space-y-0.5">
            {portalNav.map((item) => {
              const isActive =
                location === item.path ||
                (location.startsWith(item.path) && item.path !== "/portal");
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
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-white/30 hover:text-red-400 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
          <div className="flex items-center gap-2 px-3 pt-1">
            <ShieldCheck className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-white/30">Acceso seguro</span>
          </div>
        </div>
      </aside>
    </>
  );
}
