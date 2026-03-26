import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Briefcase,
  CheckSquare,
  BarChart3,
  Truck,
  Building2,
  X,
  ExternalLink,
} from "lucide-react";
import { brand } from "@/config/branding";

const logoImg = "/images/logo-isp.jpg";

const navItems = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/admin/incidencias", icon: AlertTriangle, label: "Incidencias" },
  { path: "/admin/custodias", icon: Truck, label: "Custodias" },
  { path: "/admin/reclutamiento", icon: Users, label: "Reclutamiento" },
  { path: "/admin/comercial", icon: Briefcase, label: "Comercial" },
  { path: "/admin/tareas", icon: CheckSquare, label: "Tareas" },
  { path: "/admin/kpi", icon: BarChart3, label: "KPI & Métricas" },
  { path: "/admin/clientes", icon: Building2, label: "Clientes" },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const [location] = useLocation();

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

        <div className="px-3 py-2 flex-1 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-widest text-white/25 px-2 pt-3 pb-1 font-semibold">
            Módulos
          </p>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = location === item.path || (item.path !== "/admin" && location.startsWith(item.path));
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

        <div className="p-3 border-t border-white/5">
          <Link href="/">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-white/30 hover:text-white/60 cursor-pointer transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver sitio público
            </div>
          </Link>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-white/30">Modo Operaciones Activo</span>
          </div>
        </div>
      </aside>
    </>
  );
}
