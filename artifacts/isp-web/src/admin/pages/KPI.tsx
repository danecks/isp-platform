import { AdminLayout } from "../layout/AdminLayout";
import { StatCard } from "../components/StatCard";
import { mockKPI, tendenciaIncidencias, tendenciaLeads } from "../mocks/kpi";
import {
  Timer,
  ShieldCheck,
  Briefcase,
  Users,
  Truck,
  CheckSquare,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

function MiniBarChart({ data, color = "#f5a623" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-sm transition-all"
            style={{
              height: `${(d.value / max) * 48}px`,
              backgroundColor: color,
              opacity: i === data.length - 1 ? 1 : 0.4,
            }}
          />
          <span className="text-[8px] text-white/30 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function SLAGauge({ value }: { value: number }) {
  const color = value >= 90 ? "#22c55e" : value >= 75 ? "#f5a623" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 314} 314`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{value}%</span>
          <span className="text-[9px] text-white/30">SLA</span>
        </div>
      </div>
      <p className="text-xs text-white/40 text-center">Cumplimiento de nivel de servicio</p>
    </div>
  );
}

export default function KPI() {
  return (
    <AdminLayout title="KPI & Métricas Operativas">
      <div className="space-y-8 max-w-[1400px]">

        {/* MAIN STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Timer} label="T. Respuesta Prom." value={`${mockKPI.tiempoRespuestaPromedio} min`} sub="Promedio mensual" color="gold" />
          <StatCard icon={Timer} label="T. Resolución Prom." value={`${mockKPI.tiempoResolucionPromedio} hrs`} sub="Desde apertura a cierre" color="blue" />
          <StatCard icon={Briefcase} label="Leads del Mes" value={mockKPI.leadsDelMes} sub="Marzo 2024" color="gold" />
          <StatCard icon={Users} label="Postulaciones Mes" value={mockKPI.postulacionesDelMes} sub="Marzo 2024" color="blue" />
          <StatCard icon={Truck} label="Custodias Activas" value={mockKPI.custodiasActivas} sub="En ruta hoy" color="purple" />
          <StatCard icon={CheckSquare} label="Tareas Cerradas" value={mockKPI.tareasCerradas} sub="Este mes" color="green" />
          <StatCard icon={ShieldCheck} label="SLA Cumplido" value={`${mockKPI.slaCumplido}%`} sub="Mes actual" color="green" />
          <StatCard icon={BarChart3} label="Clientes Activos" value={8} sub="Contratos vigentes" color="gold" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* SLA GAUGE */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center">
            <p className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-4">Nivel de Servicio</p>
            <SLAGauge value={mockKPI.slaCumplido} />
          </div>

          {/* TENDENCIA INCIDENCIAS */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-widest text-white/30 font-semibold">Incidencias / Mes</p>
              <TrendingDown className="w-4 h-4 text-green-400" />
            </div>
            <MiniBarChart
              data={tendenciaIncidencias.map((d) => ({ label: d.mes, value: d.total }))}
              color="#ef4444"
            />
            <p className="text-[10px] text-white/25 mt-3">Tendencia: bajando vs. mes anterior</p>
          </div>

          {/* TENDENCIA LEADS */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-widest text-white/30 font-semibold">Leads Comerciales / Mes</p>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <MiniBarChart
              data={tendenciaLeads.map((d) => ({ label: d.mes, value: d.total }))}
              color="#f5a623"
            />
            <p className="text-[10px] text-white/25 mt-3">Tendencia: en alza vs. mes anterior</p>
          </div>
        </div>

        {/* INCIDENCIAS POR CLIENTE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-bold text-white">Incidencias por Cliente — Mes Actual</p>
          </div>
          <div className="p-5 space-y-3">
            {mockKPI.incidenciasPorCliente.map((item, i) => {
              const max = mockKPI.incidenciasPorCliente[0].total;
              const pct = (item.total / max) * 100;
              return (
                <div key={i} className="flex items-center gap-4">
                  <p className="text-xs text-white/60 w-56 truncate shrink-0">{item.cliente}</p>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%`, opacity: 0.4 + (pct / 100) * 0.6 }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white w-6 text-right shrink-0">{item.total}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
