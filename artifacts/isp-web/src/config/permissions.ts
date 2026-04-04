import {
  LayoutDashboard,
  AlertTriangle,
  Truck,
  Car,
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
  HardHat,
  LayoutGrid,
  ClipboardList,
  BellRing,
  ScrollText,
  TableProperties,
  FileSpreadsheet,
  Timer,
  GitMerge,
  Zap,
  Shield,
  UserSearch,
  Calendar,
  Kanban,
  Trash2,
  ArrowUpDown,
  Landmark,
  Gift,
  BookOpen,
  Package,
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

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

// ── Secciones de navegación del panel administrativo ─────────────────────────
export const NAV_SECTIONS: NavSection[] = [
  // ── 1. GENERAL ─────────────────────────────────────────────────────────────
  {
    id: "general",
    label: "General",
    items: [
      {
        path: "/admin/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
      },
    ],
  },

  // ── 2. OPERACIONES ─────────────────────────────────────────────────────────
  {
    id: "operaciones",
    label: "Operaciones",
    items: [
      {
        path: "/admin/operaciones",
        label: "Pizarrón Operativo",
        icon: LayoutGrid,
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/tablero-servicios",
        label: "Seguimiento SSA",
        icon: Kanban,
        roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
      },
      {
        path: "/admin/pipeline-servicios",
        label: "Pipeline SSA",
        icon: Zap,
        roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
      },
      {
        path: "/admin/tareas",
        label: "Tareas",
        icon: CheckSquare,
        roles: ["admin", "operaciones", "supervisor"],
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
        path: "/admin/vehiculos",
        label: "Vehículos",
        icon: Car,
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/armeria",
        label: "Armería",
        icon: Shield,
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/cambios-estructurales",
        label: "Cambios Estructurales",
        icon: GitMerge,
        roles: ["admin", "operaciones", "rrhh"],
      },
    ],
  },

  // ── 3. CLIENTES & COMERCIAL ────────────────────────────────────────────────
  {
    id: "comercial",
    label: "Clientes & Comercial",
    items: [
      {
        path: "/admin/clientes",
        label: "Clientes",
        icon: Building2,
        roles: ["admin", "operaciones", "comercial"],
      },
      {
        path: "/admin/comercial",
        label: "Comercial",
        icon: Briefcase,
        roles: ["admin", "comercial"],
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
    ],
  },

  // ── 4. PERSONAL / RRHH ─────────────────────────────────────────────────────
  {
    id: "rrhh",
    label: "Personal & RRHH",
    items: [
      {
        path: "/admin/empleados",
        label: "Colaboradores",
        icon: HardHat,
        roles: ["admin", "operaciones", "rrhh", "supervisor"],
      },
      {
        path: "/admin/reclutamiento",
        label: "Reclutamiento",
        icon: UserSearch,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/anticipos",
        label: "Anticipos",
        icon: Wallet,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/eventos",
        label: "Eventos RRHH",
        icon: Calendar,
        roles: ["admin", "rrhh", "operaciones"],
      },
      {
        path: "/admin/rrhh/alertas",
        label: "Alertas RRHH",
        icon: BellRing,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/nomina",
        label: "Novedades de Nómina",
        icon: ScrollText,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/pre-planilla",
        label: "Pre-Planilla",
        icon: TableProperties,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/planilla",
        label: "Planilla Final",
        icon: FileSpreadsheet,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/turnos",
        label: "Tipos de Turno",
        icon: Timer,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/cambios-salariales",
        label: "Cambios Salariales",
        icon: ArrowUpDown,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/prestaciones",
        label: "Prestaciones Laborales",
        icon: Landmark,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/planillas-especiales",
        label: "Bono 14 & Aguinaldo",
        icon: Gift,
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/libro-salarios",
        label: "Libro de Salarios",
        icon: BookOpen,
        roles: ["admin", "rrhh"],
      },
    ],
  },

  // ── 5. SISTEMA ─────────────────────────────────────────────────────────────
  {
    id: "sistema",
    label: "Sistema",
    items: [
      {
        path: "/admin/solicitudes-eliminacion",
        label: "Solicitudes de Eliminación",
        icon: Trash2,
        roles: ["admin"],
      },
      {
        path: "/admin/usuarios",
        label: "Usuarios del Sistema",
        icon: UserCog,
        roles: ["admin"],
      },
      {
        path: "/admin/configuracion/whatsapp",
        label: "Configuración WhatsApp",
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
        label: "Simulador WhatsApp",
        icon: FlaskConical,
        roles: ["admin"],
      },
    ],
  },

  // ── 7. BODEGA ──────────────────────────────────────────────────────────────
  {
    id: "bodega",
    label: "Bodega",
    items: [
      {
        path: "/admin/bodega",
        label: "Inventario",
        icon: Package,
        roles: ["admin", "operaciones"],
      },
    ],
  },
];

// ── Lista plana (para compatibilidad con puedeAcceder) ────────────────────────
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

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

export function seccionesParaRol(rol: Rol | null | undefined): NavSection[] {
  if (!rol) return [];
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((n) => (n.roles as string[]).includes(rol)),
  })).filter((s) => s.items.length > 0);
}
