import {
  LayoutDashboard,
  AlertTriangle,
  Truck,
  Users,
  Briefcase,
  CheckSquare,
  BarChart3,
  Building2,
  UserCog,
  Wallet,
  MessageSquare,
  FileBarChart2,
  Globe,
  FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Rol = "admin" | "operaciones" | "rrhh" | "comercial" | "supervisor" | "guardia" | "cliente";

export const ROL_LABELS: Record<Rol, string> = {
  admin: "Administrador",
  operaciones: "Operaciones",
  rrhh: "RRHH",
  comercial: "Comercial",
  supervisor: "Supervisor",
  guardia: "Guardia",
  cliente: "Cliente",
};

export const ROL_COLORES: Record<Rol, string> = {
  admin: "text-red-400 bg-red-400/10 border-red-400/20",
  operaciones: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  rrhh: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  comercial: "text-green-400 bg-green-400/10 border-green-400/20",
  supervisor: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  guardia: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  cliente: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
};

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Rol[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
  },
  {
    path: "/admin/incidencias",
    label: "Incidencias",
    icon: AlertTriangle,
    roles: ["admin", "operaciones", "supervisor"],
  },
  {
    path: "/admin/custodias",
    label: "Custodias",
    icon: Truck,
    roles: ["admin", "operaciones", "supervisor"],
  },
  {
    path: "/admin/reclutamiento",
    label: "Reclutamiento",
    icon: Users,
    roles: ["admin", "rrhh"],
  },
  {
    path: "/admin/anticipos",
    label: "Anticipos",
    icon: Wallet,
    roles: ["admin", "rrhh"],
  },
  {
    path: "/admin/comercial",
    label: "Comercial",
    icon: Briefcase,
    roles: ["admin", "comercial"],
  },
  {
    path: "/admin/tareas",
    label: "Tareas",
    icon: CheckSquare,
    roles: ["admin", "operaciones", "supervisor"],
  },
  {
    path: "/admin/reportes",
    label: "Reportería",
    icon: FileBarChart2,
    roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
  },
  {
    path: "/admin/kpi",
    label: "KPI & Métricas",
    icon: BarChart3,
    roles: ["admin"],
  },
  {
    path: "/admin/clientes",
    label: "Clientes",
    icon: Building2,
    roles: ["admin", "operaciones", "comercial"],
  },
  {
    path: "/admin/usuarios",
    label: "Usuarios",
    icon: UserCog,
    roles: ["admin"],
  },
  {
    path: "/admin/configuracion/whatsapp",
    label: "Config. WhatsApp",
    icon: MessageSquare,
    roles: ["admin"],
  },
  {
    path: "/admin/cms",
    label: "CMS Web",
    icon: Globe,
    roles: ["admin"],
  },
  {
    path: "/admin/simulador-whatsapp",
    label: "Simulador WA",
    icon: FlaskConical,
    roles: ["admin"],
  },
];

export function puedeAcceder(rol: Rol | null | undefined, path: string): boolean {
  if (!rol) return false;
  const item = NAV_ITEMS.find((n) => path === n.path || path.startsWith(n.path + "/"));
  if (!item) return true;
  return (item.roles as string[]).includes(rol);
}

export function navParaRol(rol: Rol | null | undefined): NavItem[] {
  if (!rol) return [];
  return NAV_ITEMS.filter((n) => (n.roles as string[]).includes(rol));
}
