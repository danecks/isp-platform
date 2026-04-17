import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, ChevronDown, Check, Building2, KeyRound, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  portalGet,
  getActivePortalClienteId,
  setActivePortalClienteId,
} from "@/lib/portalApi";
import { CambiarPasswordModal } from "@/components/CambiarPasswordModal";

interface PortalTopbarProps {
  title: string;
  onMenuOpen: () => void;
}

interface MiCliente {
  portal_cliente_id: string;
  cliente_db_id: number | null;
  nombre: string;
  es_default: boolean;
}

export function PortalTopbar({ title, onMenuOpen }: PortalTopbarProps) {
  const { currentUser, logout } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }
  const [activeCid, setActiveCid] = useState<string | null>(getActivePortalClienteId());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: clientes = [] } = useQuery<MiCliente[]>({
    queryKey: ["portal-mis-clientes"],
    queryFn: () => portalGet<MiCliente[]>("/portal/mis-clientes"),
    enabled: currentUser?.rol === "cliente",
  });

  // Si no hay cliente activo aún (primera carga) y la lista llegó, usar el default o el primero
  useEffect(() => {
    if (!activeCid && clientes.length > 0) {
      const def = clientes.find((c) => c.es_default) ?? clientes[0];
      setActivePortalClienteId(def.portal_cliente_id);
      setActiveCid(def.portal_cliente_id);
    }
  }, [clientes, activeCid]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeCliente = clientes.find((c) => c.portal_cliente_id === activeCid);
  const showSelector = clientes.length > 1;

  function handleCambiar(cid: string) {
    if (cid === activeCid) {
      setOpen(false);
      return;
    }
    setActivePortalClienteId(cid);
    setOpen(false);
    // Reload completo para garantizar que TODAS las pestañas y queries
    // se reinicialicen con el nuevo cliente activo (sin datos cacheados).
    window.location.reload();
  }

  return (
    <header className="h-14 bg-[#060e1c] border-b border-white/5 flex items-center px-4 gap-4 shrink-0">
      <button
        onClick={onMenuOpen}
        className="lg:hidden text-white/50 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-sm font-semibold text-white flex-1 truncate">{title}</h1>

      {showSelector && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <div className="text-left">
              <p className="text-[9px] text-primary/70 uppercase tracking-wider leading-none">Proyecto activo</p>
              <p className="text-xs text-white font-semibold mt-0.5 max-w-[160px] truncate">
                {activeCliente?.nombre ?? "Seleccionar..."}
              </p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-primary/70 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#0d1c30] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">
                  {clientes.length} proyectos vinculados
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {clientes.map((c) => {
                  const isActive = c.portal_cliente_id === activeCid;
                  return (
                    <button
                      key={c.portal_cliente_id}
                      onClick={() => handleCambiar(c.portal_cliente_id)}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs ${isActive ? "text-primary font-semibold" : "text-white"}`}>
                          {c.nombre}
                        </p>
                        {c.es_default && (
                          <p className="text-[9px] text-white/30 mt-0.5">Por defecto</p>
                        )}
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs text-white/70 font-medium leading-none">
            {currentUser?.nombre}
          </span>
          {!showSelector && (
            <span className="text-[10px] text-primary/60 mt-0.5">
              {activeCliente?.nombre ?? currentUser?.clienteId ?? "Portal Cliente"}
            </span>
          )}
        </div>

        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-primary text-[10px] font-bold uppercase">
            {currentUser?.nombre?.charAt(0) ?? "C"}
          </span>
        </div>

        <button
          onClick={() => setShowChangePass(true)}
          title="Cambiar mi contraseña"
          className="p-1.5 text-white/30 hover:text-primary transition-colors"
        >
          <KeyRound className="w-4 h-4" />
        </button>

        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {showChangePass && <CambiarPasswordModal onClose={() => setShowChangePass(false)} />}
    </header>
  );
}
