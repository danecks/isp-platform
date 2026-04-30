import { useState } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { QrCode, MapPin, Activity, BarChart2, Route, ShieldCheck } from "lucide-react";
import FichajeQR from "./FichajeQR";
import RondasQR from "./RondasQR";
import EstadisticasRondas from "./EstadisticasRondas";
import RecorridosCustodia from "./RecorridosCustodia";
import { VisitasContent } from "./Visitas";

type Tab = "fichaje" | "rondas" | "recorridos" | "visitas" | "estadisticas";

export default function ControlOperativoQR() {
  const [tab, setTab] = useState<Tab>("fichaje");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "fichaje",      label: "Fichaje & Control",    icon: <QrCode className="w-4 h-4" /> },
    { key: "rondas",       label: "Rondas de Patrullaje", icon: <MapPin className="w-4 h-4" /> },
    { key: "recorridos",   label: "Recorridos Custodia",  icon: <Route className="w-4 h-4" /> },
    { key: "visitas",      label: "Visitas",              icon: <ShieldCheck className="w-4 h-4" /> },
    { key: "estadisticas", label: "Estadísticas",         icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <AdminLayout title="Control Operativo QR">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Control Operativo QR</h1>
            <p className="text-white/40 text-sm">Fichaje de agentes, rondas de patrullaje y estadísticas</p>
          </div>
        </div>

        {/* Tab bar principal */}
        <div className="flex gap-2 mb-6 border-b border-white/8 pb-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-500 text-blue-300 bg-blue-600/10"
                  : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/3"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {tab === "fichaje"      && <FichajeQR />}
        {tab === "rondas"       && <RondasQR />}
        {tab === "recorridos"   && <RecorridosCustodia />}
        {tab === "visitas"      && <VisitasContent embedded />}
        {tab === "estadisticas" && <EstadisticasRondas />}
      </div>
    </AdminLayout>
  );
}
