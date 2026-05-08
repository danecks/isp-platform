import { useState } from "react";
import { ClipboardList, Map, BarChart3, MapPin, FileBarChart2, CalendarRange } from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { TabProgramacion } from "./supervision/TabProgramacion";
import { TabAsignacionZonas } from "./supervision/TabAsignacionZonas";
import { TabDashboard } from "./supervision/TabDashboard";
import { TabMapaEnVivo } from "./supervision/TabMapaEnVivo";
import { TabReportes } from "./supervision/TabReportes";
import { TabPlanMensual } from "./supervision/TabPlanMensual";

type TabKey = "dashboard" | "mapa" | "plan_mensual" | "programacion" | "zonas" | "reportes";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<any> }> = [
  { key: "dashboard",    label: "Dashboard",          icon: BarChart3 },
  { key: "mapa",         label: "Mapa en vivo",       icon: MapPin },
  { key: "plan_mensual", label: "Plan mensual",       icon: CalendarRange },
  { key: "programacion", label: "Programación",       icon: ClipboardList },
  { key: "reportes",     label: "Reportes",           icon: FileBarChart2 },
  { key: "zonas",        label: "Asignación de Zonas", icon: Map },
];

export default function Supervision() {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <AdminLayout title="Supervisión">
      <div className="p-4 space-y-3">
        <p className="text-xs text-white/50">
          Programa visitas de supervisores, mide cumplimiento y administra qué supervisor cubre cada zona.
        </p>

        <div className="flex gap-1 border-b border-white/10">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-xs font-medium inline-flex items-center gap-1.5 border-b-2 transition-colors ${
                  active
                    ? "text-primary border-primary"
                    : "text-white/50 border-transparent hover:text-white/80"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div>
          {tab === "dashboard"    && <TabDashboard />}
          {tab === "mapa"         && <TabMapaEnVivo />}
          {tab === "plan_mensual" && <TabPlanMensual />}
          {tab === "programacion" && <TabProgramacion />}
          {tab === "reportes"     && <TabReportes />}
          {tab === "zonas"        && <TabAsignacionZonas />}
        </div>
      </div>
    </AdminLayout>
  );
}
