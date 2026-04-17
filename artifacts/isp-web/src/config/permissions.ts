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
  Calendar,
  Kanban,
  Trash2,
  ArrowUpDown,
  Landmark,
  Gift,
  BookOpen,
  Package,
  FileUp,
  ScanLine,
  BadgeCheck,
  Palmtree,
  CreditCard,
  Tablet,
  Home,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Rol = "admin" | "operaciones" | "rrhh" | "comercial" | "supervisor" | "guardia" | "cliente";

export const ROL_LABELS: Record<string, string> = {
  admin: "Administrador",
  operaciones: "Operaciones",
  rrhh: "RRHH",
  comercial: "Comercial",
  supervisor: "Supervisor",
  guardia: "Guardia",
  cliente: "Cliente",
};

export const ROL_COLORES: Record<string, string> = {
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
  clave: string;
  roles: string[];
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
        clave: "dashboard",
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
        clave: "pizarron",
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/tablero-servicios",
        label: "Seguimiento SSA",
        icon: Kanban,
        clave: "seguimiento_ssa",
        roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
      },
      {
        path: "/admin/pipeline-servicios",
        label: "Pipeline SSA",
        icon: Zap,
        clave: "pipeline_ssa",
        roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
      },
      {
        path: "/admin/tareas",
        label: "Tareas",
        icon: CheckSquare,
        clave: "tareas",
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/incidencias",
        label: "Incidencias",
        icon: AlertTriangle,
        clave: "incidencias",
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/custodias",
        label: "Custodias",
        icon: Truck,
        clave: "custodias",
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/cambios-estructurales",
        label: "Cambios Estructurales",
        icon: GitMerge,
        clave: "cambios_estructurales",
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
        clave: "clientes",
        roles: ["admin", "operaciones", "comercial"],
      },
      {
        path: "/admin/comercial",
        label: "Comercial",
        icon: Briefcase,
        clave: "comercial",
        roles: ["admin", "comercial"],
      },
      {
        path: "/admin/reportes",
        label: "Reportería",
        icon: FileBarChart2,
        clave: "reportes",
        roles: ["admin", "operaciones", "rrhh", "comercial", "supervisor"],
      },
      {
        path: "/admin/kpi",
        label: "KPI & Métricas",
        icon: BarChart3,
        clave: "kpi",
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
        clave: "empleados",
        roles: ["admin", "operaciones", "rrhh", "supervisor"],
      },
      {
        path: "/admin/rrhh/kiosco-solicitudes",
        label: "Solicitudes Kiosco",
        icon: Tablet,
        clave: "kiosco_solicitudes",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/anticipos",
        label: "Anticipos",
        icon: Wallet,
        clave: "anticipos",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/eventos",
        label: "Eventos RRHH",
        icon: Calendar,
        clave: "eventos_rrhh",
        roles: ["admin", "rrhh", "operaciones"],
      },
      {
        path: "/admin/rrhh/alertas",
        label: "Alertas RRHH",
        icon: BellRing,
        clave: "alertas_rrhh",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/nomina",
        label: "Novedades de Nómina",
        icon: ScrollText,
        clave: "nomina",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/pre-planilla",
        label: "Pre-Planilla",
        icon: TableProperties,
        clave: "pre_planilla",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/planilla",
        label: "Planilla Final",
        icon: FileSpreadsheet,
        clave: "planilla",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/turnos",
        label: "Tipos de Turno",
        icon: Timer,
        clave: "turnos",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/cambios-salariales",
        label: "Cambios Salariales",
        icon: ArrowUpDown,
        clave: "cambios_salariales",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/prestaciones",
        label: "Prestaciones Laborales",
        icon: Landmark,
        clave: "prestaciones",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/vacaciones",
        label: "Solicitudes de Vacaciones",
        icon: Palmtree,
        clave: "solicitudes_vacaciones",
        roles: ["admin", "rrhh", "operaciones"],
      },
      {
        path: "/admin/rrhh/planillas-especiales",
        label: "Bono 14 & Aguinaldo",
        icon: Gift,
        clave: "planillas_especiales",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/libro-salarios",
        label: "Libro de Salarios",
        icon: BookOpen,
        clave: "libro_salarios",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/igss",
        label: "Planilla IGSS",
        icon: Landmark,
        clave: "igss_planilla",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/seguros",
        label: "Seguros",
        icon: ShieldCheck,
        clave: "seguros",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/carnets",
        label: "Carnets QR",
        icon: CreditCard,
        clave: "carnets_qr",
        roles: ["admin", "rrhh"],
      },
      {
        path: "/admin/rrhh/barracas",
        label: "Barracas",
        icon: Home,
        clave: "barracas",
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
        clave: "solicitudes_eliminacion",
        roles: ["admin"],
      },
      {
        path: "/admin/usuarios",
        label: "Usuarios del Sistema",
        icon: UserCog,
        clave: "usuarios",
        roles: ["admin"],
      },
      {
        path: "/admin/configuracion/whatsapp",
        label: "Configuración WhatsApp",
        icon: MessageSquare,
        clave: "config_whatsapp",
        roles: ["admin"],
      },
      {
        path: "/admin/cms",
        label: "CMS Web",
        icon: Globe,
        clave: "cms",
        roles: ["admin"],
      },
      {
        path: "/admin/simulador-whatsapp",
        label: "Simulador WhatsApp",
        icon: FlaskConical,
        clave: "simulador_wa",
        roles: ["admin"],
      },
      {
        path: "/admin/modelo-datos",
        label: "Modelo de Datos (ERD)",
        icon: FlaskConical,
        clave: "modelo_datos",
        roles: ["admin"],
      },
    ],
  },

  // ── 7. BODEGA E INVENTARIO ─────────────────────────────────────────────────
  {
    id: "bodega",
    label: "Bodega e Inventario",
    items: [
      {
        path: "/admin/bodega",
        label: "Inventario General",
        icon: Package,
        clave: "bodega",
        roles: ["admin", "operaciones"],
      },
      {
        path: "/admin/vehiculos",
        label: "Vehículos",
        icon: Car,
        clave: "vehiculos",
        roles: ["admin", "operaciones", "supervisor"],
      },
      {
        path: "/admin/armeria",
        label: "Armería",
        icon: Shield,
        clave: "armeria",
        roles: ["admin", "operaciones", "supervisor"],
      },
    ],
  },

  // ── 8. MIGRACIÓN ───────────────────────────────────────────────────────────
  {
    id: "migracion",
    label: "Migración",
    items: [
      {
        path: "/admin/importacion",
        label: "Importar Datos",
        icon: FileUp,
        clave: "importacion",
        roles: ["admin"],
      },
    ],
  },

  // ── 9. CONTROL OPERATIVO ──────────────────────────────────────────────────
  {
    id: "control_operativo",
    label: "Control Operativo",
    items: [
      {
        path: "/admin/control-operativo-qr",
        label: "Control Operativo QR",
        icon: BadgeCheck,
        clave: "control_qr",
        roles: ["admin", "operaciones", "supervisor"],
      },
    ],
  },
];

// ── Lista plana (para compatibilidad con puedeAcceder) ────────────────────────
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function puedeAcceder(rol: string | null | undefined, path: string): boolean {
  if (!rol) return false;
  const item = NAV_ITEMS.find((n) => path === n.path || path.startsWith(n.path + "/"));
  if (!item) return true;
  return (item.roles as string[]).includes(rol);
}

export function navParaRol(rol: string | null | undefined): NavItem[] {
  if (!rol) return [];
  return NAV_ITEMS.filter((n) => (n.roles as string[]).includes(rol));
}

export function seccionesParaRol(rol: string | null | undefined): NavSection[] {
  if (!rol) return [];
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((n) => (n.roles as string[]).includes(rol)),
  })).filter((s) => s.items.length > 0);
}

// ── Con permisos dinámicos de BD ───────────────────────────────────────────────
export function seccionesParaPermisos(modulosPermitidos: Set<string>): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((n) => modulosPermitidos.has(n.clave)),
  })).filter((s) => s.items.length > 0);
}
