import { useState } from "react";
import { Link, useLocation } from "wouter";
import { X, ExternalLink, ChevronDown } from "lucide-react";
import { brand } from "@/config/branding";
import { seccionesParaRol, ROL_LABELS, ROL_COLORES } from "@/config/permissions";
import { useAuth } from "@/contexts/AuthContext";
import type { Rol, NavSection } from "@/config/permissions";

const logoImg = "/images/logo-isp.jpg";

// Secciones que empiezan expandidas por defecto
const EXPANDED_BY_DEFAULT = new Set(["general", "operaciones"]);

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const [location] = useLocation();
  const { currentUser } = useAuth();
  const rol = currentUser?.rol as Rol | undefined;
  const secciones = seccionesParaRol(rol);

  // Determinar qué sección está activa basándonos en la ruta actual
  const activeSectionId = secciones.find((s) =>
    s.items.some(
      (item) => location === item.path || (item.path !== "/admin" && location.startsWith(item.path))
    )
  )?.id;

  // Estado de expansión de secciones — por defecto expandidas las de uso frecuente
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    secciones.forEach((s) => {
      init[s.id] = EXPANDED_BY_DEFAULT.has(s.id);
    });
    return init;
  });

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Expandir automáticamente la sección activa si está colapsada
  const isActive = (section: NavSection) =>
    section.items.some(
      (item) => location === item.path || (item.path !== "/admin" && location.startsWith(item.path))
    );

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
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={logoImg}
              alt={brand.shortName}
              className="w-8 h-8 object-contain rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <p className="text-xs font-bold text-white leading-none">{brand.shortName}</p>
              <p className="text-[9px] text-primary uppercase tracking-widest">Panel Administrativo</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge */}
        {currentUser && (
          <div className="px-5 py-2.5 border-b border-white/5 shrink-0">
            <p className="text-[10px] text-white/30 mb-1">Sesión activa</p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  ROL_COLORES[currentUser.rol as Rol] ?? "text-white/50 bg-white/5 border-white/10"
                }`}
              >
                {ROL_LABELS[currentUser.rol as Rol] ?? currentUser.rol}
              </span>
              <span className="text-[10px] text-white/30 truncate">{currentUser.username}</span>
            </div>
          </div>
        )}

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {secciones.map((seccion) => {
            const sectionActive = isActive(seccion);
            const isExpanded = expanded[seccion.id] ?? sectionActive;

            return (
              <div key={seccion.id} className="mb-1">
                {/* Section header — solo mostrar si hay más de 1 sección */}
                {secciones.length > 1 && (
                  <button
                    onClick={() => toggleSection(seccion.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors group ${
                      sectionActive ? "text-primary/80" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-widest font-bold">
                      {seccion.label}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                )}

                {/* Items */}
                {(isExpanded || secciones.length === 1) && (
                  <nav className="space-y-0.5 mb-1">
                    {seccion.items.map((item) => {
                      const active =
                        location === item.path ||
                        (item.path !== "/admin" && location.startsWith(item.path));
                      return (
                        <Link key={item.path} href={item.path} onClick={onClose}>
                          <div
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
                              active
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-white/50 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <item.icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary" : ""}`} />
                            <span className="truncate text-[13px]">{item.label}</span>
                            {active && (
                              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </nav>
                )}

                {/* Separador entre secciones */}
                {seccion.id !== secciones[secciones.length - 1].id && (
                  <div className="border-b border-white/5 mt-1 mb-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-white/5 shrink-0">
          <Link href="/">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/30 hover:text-white/60 cursor-pointer transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver sitio público
            </div>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-white/25">Sistema Activo</span>
          </div>
        </div>
      </aside>
    </>
  );
}
