import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { ROL_LABELS, ROL_COLORES } from "@/config/permissions";
import { getSessionToken } from "@/lib/httpClient";

export type Rol = "admin" | "operaciones" | "rrhh" | "comercial" | "supervisor" | "guardia" | "cliente";

export const ROLES: Rol[] = ["admin", "operaciones", "rrhh", "comercial", "supervisor", "guardia", "cliente"];

export const ROLES_ADMIN: Rol[] = ["admin", "operaciones", "rrhh", "comercial", "supervisor"];

export interface SystemRoleOption { clave: string; label: string; activo: boolean; }

export function getAdminSessionHeader(): Record<string, string> {
  try {
    const raw = getSessionToken();
    return raw ? { "x-isp-session": raw } : {};
  } catch { return {}; }
}

export function useSystemRoles() {
  return useQuery<SystemRoleOption[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${base}/api/roles`, { headers: getAdminSessionHeader() });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 0,
  });
}

export function RolBadge({ rol }: { rol: string }) {
  const color = ROL_COLORES[rol as Rol] ?? "text-white/50 bg-white/5 border-white/10";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${color}`}>
      {ROL_LABELS[rol as Rol] ?? rol}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: string }) {
  const active = estado === "activo";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
      active
        ? "text-green-400 bg-green-400/10 border-green-400/20"
        : "text-red-400 bg-red-400/10 border-red-400/20"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-400" : "bg-red-400"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export function PermisoBadge({ activo, label }: { activo: boolean | null; label: string }) {
  if (!activo) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/15 border border-primary/20 text-primary">
      <Check className="w-2.5 h-2.5" />{label}
    </span>
  );
}

export function PermToggle({
  value, onChange, label, description, icon: Icon,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  icon: React.ElementType;
}) {
  const on = value === true;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex items-start gap-3 w-full rounded-xl p-3.5 border transition-all text-left ${
        on
          ? "bg-primary/10 border-primary/30"
          : "bg-[#060e1c] border-white/8 hover:border-white/15"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        on ? "bg-primary/20" : "bg-white/5"
      }`}>
        <Icon className={`w-4 h-4 ${on ? "text-primary" : "text-white/30"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold leading-none mb-1 ${on ? "text-white" : "text-white/60"}`}>{label}</p>
        <p className="text-[10px] text-white/30 leading-relaxed">{description}</p>
      </div>
      <div className={`w-9 h-5 rounded-full transition-all shrink-0 mt-1.5 relative ${
        on ? "bg-primary" : "bg-white/15"
      }`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
          on ? "left-4" : "left-0.5"
        }`} />
      </div>
    </button>
  );
}
