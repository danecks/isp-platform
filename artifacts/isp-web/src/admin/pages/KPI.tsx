import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatCard } from "../components/StatCard";
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
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const API = "/api";

function getSession() {
  return sessionStorage.getItem("isp_admin_session_v2") || "";
}

async function fetchKPI() {
  const res = await fetch(`${API}/kpi/dashboard`, {
    headers: { "x-isp-session": getSession() },
  });
  if (!res.ok) throw new Error("Error al obtener KPIs");
  return res.json();
}

function MiniBarChart({ data, color = "#f5a623" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
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
      <p className="text-xs text-white/40 text-center">Tasa de resolución de incidencias</p>
    </div>
  );
}

export default function KPI() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["kpi-dashboard"],
    queryFn: fetchKPI,
    refetchInterval: 60000,
  });

  const resumen = data?.resumen ?? {};
  const tendenciaInc = data?.tendenciaIncidencias ?? Array(6).fill({ mes: "—", total: 0 });
  const tendenciaLeads = data?.tendenciaLeads ?? Array(6).fill({ mes: "—", total: 0 });
  const porCliente: { cliente: string; total: number }[] = data?.incidenciasPorCliente ?? [];
  const sla = resumen.slaCumplido ?? 0;

  const incTendencia = (() => {
    if (tendenciaInc.length < 2) return null;
    const ultimo = tendenciaInc[tendenciaInc.length - 1]?.total ?? 0;
    const penultimo = tendenciaInc[tendenciaInc.length - 2]?.total ?? 0;
    return ultimo < penultimo ? "bajando" : "subiendo";
  })();

  const leadsTendencia = (() => {
    if (tendenciaLeads.length < 2) return null;
    const ultimo = tendenciaLeads[tendenciaLeads.length - 1]?.total ?? 0;
    const penultimo = tendenciaLeads[tendenciaLeads.length - 2]?.total ?? 0;
    return ultimo > penultimo ? "en alza" : "a la baja";
  })();

  if (isLoading) {
    return (
      <AdminLayout title="KPI & Métricas Operativas">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-white/40">Calculando métricas desde la base de datos...</span>
        </div>
      </AdminLayout>
    );
  }

  if (isError) {
    return (
      <AdminLayout title="KPI & Métricas Operativas">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <p className="text-white/50">Error al cargar los KPIs</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary/20 border border-primary/30 text-primary rounded-lg text-sm"
          >
            Reintentar
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="KPI & Métricas Operativas">
      <div className="space-y-8 max-w-[1400px]">

        {/* Header con última actualización */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/25">Datos en tiempo real desde la base de datos</p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {/* MAIN STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Timer}
            label="T. Respuesta Prom."
            value="—"
            sub="Requiere datos adicionales"
            color="gold"
          />
          <StatCard
            icon={Timer}
            label="T. Resolución Prom."
            value="—"
            sub="Requiere campo fecha_cierre"
            color="blue"
          />
          <StatCard
            icon={Briefcase}
            label="Leads del Mes"
            value={resumen.leadsDelMes ?? 0}
            sub="Mes en curso"
            color="gold"
          />
          <StatCard
            icon={Users}
            label="Postulaciones Mes"
            value={resumen.postulacionesDelMes ?? 0}
            sub="Mes en curso"
            color="blue"
          />
          <StatCard
            icon={Truck}
            label="Puestos Cubiertos"
            value={`${resumen.custodiasActivas ?? 0} / ${resumen.puestosTotal ?? 0}`}
            sub="Operativos activos"
            color="purple"
          />
          <StatCard
            icon={CheckSquare}
            label="Tareas Cerradas"
            value={resumen.tareasCerradas ?? 0}
            sub="Este mes"
            color="green"
          />
          <StatCard
            icon={ShieldCheck}
            label="Tasa Resolución"
            value={`${sla}%`}
            sub="Incidencias cerradas / total"
            color="green"
          />
          <StatCard
            icon={BarChart3}
            label="Clientes Activos"
            value={resumen.clientesActivos ?? 0}
            sub="Con puestos operativos"
            color="gold"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* SLA GAUGE */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center">
            <p className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-4">Nivel de Servicio</p>
            <SLAGauge value={sla} />
          </div>

          {/* TENDENCIA INCIDENCIAS */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-widest text-white/30 font-semibold">Incidencias / Mes</p>
              {incTendencia === "bajando"
                ? <TrendingDown className="w-4 h-4 text-green-400" />
                : <TrendingUp className="w-4 h-4 text-red-400" />
              }
            </div>
            <MiniBarChart
              data={tendenciaInc.map((d: any) => ({ label: d.mes, value: d.total }))}
              color="#ef4444"
            />
            <p className="text-[10px] text-white/25 mt-3">
              Tendencia: {incTendencia ?? "sin datos"} vs. mes anterior
            </p>
          </div>

          {/* TENDENCIA LEADS */}
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-widest text-white/30 font-semibold">Leads Comerciales / Mes</p>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <MiniBarChart
              data={tendenciaLeads.map((d: any) => ({ label: d.mes, value: d.total }))}
              color="#f5a623"
            />
            <p className="text-[10px] text-white/25 mt-3">
              Tendencia: {leadsTendencia ?? "sin datos"} vs. mes anterior
            </p>
          </div>
        </div>

        {/* INCIDENCIAS POR CLIENTE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-bold text-white">
              Incidencias por Cliente — Total histórico
              <span className="ml-2 text-xs text-white/25 font-normal">
                ({resumen.incidenciasTotal ?? 0} total · {resumen.incidenciasActivas ?? 0} activas)
              </span>
            </p>
          </div>
          <div className="p-5 space-y-3">
            {porCliente.length === 0 && (
              <p className="text-sm text-white/30 text-center py-4">Sin incidencias registradas</p>
            )}
            {porCliente.map((item, i) => {
              const max = porCliente[0]?.total ?? 1;
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
