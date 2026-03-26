import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { BarChart3, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";

interface KPIData {
  clienteId: string;
  resumen: {
    total: number;
    activas: number;
    resueltas: number;
    tasaResolucion: number;
  };
  tendenciaMensual: {
    mes: string;
    total: number;
    resueltas: number;
    abiertas: number;
  }[];
  porTipo: Record<string, number>;
  porPrioridad: { alta: number; media: number; baja: number };
  tiempoPromedioResolucion: null;
  notasIntegracion: string[];
}

function BarH({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white/60 w-6 text-right">{value}</span>
    </div>
  );
}

export default function PortalKPI() {
  const { data, isLoading, isError } = useQuery<KPIData>({
    queryKey: ["portal-kpi"],
    queryFn: () => portalGet<KPIData>("/portal/kpi"),
  });

  if (isLoading) {
    return (
      <PortalLayout title="KPI & Métricas">
        <div className="flex items-center justify-center h-64">
          <div className="text-white/40 text-sm animate-pulse">Calculando métricas...</div>
        </div>
      </PortalLayout>
    );
  }

  if (isError || !data) {
    return (
      <PortalLayout title="KPI & Métricas">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center text-sm text-red-400">
          Error al cargar métricas.
        </div>
      </PortalLayout>
    );
  }

  const maxMensual = Math.max(...data.tendenciaMensual.map((m) => m.total), 1);
  const topTipos = Object.entries(data.porTipo)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxTipo = Math.max(...Object.values(data.porTipo), 1);

  return (
    <PortalLayout title="KPI & Métricas">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">KPI & Métricas</h2>
        <p className="text-sm text-white/40 mt-1">Indicadores de desempeño de su servicio de seguridad</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <BarChart3 className="w-4 h-4 text-primary mb-2" />
          <p className="text-2xl font-bold text-white">{data.resumen.total}</p>
          <p className="text-xs text-white/40 mt-1">Total incidencias</p>
        </div>
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-red-400 mb-2" />
          <p className="text-2xl font-bold text-white">{data.resumen.activas}</p>
          <p className="text-xs text-white/40 mt-1">Activas ahora</p>
        </div>
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <CheckCircle className="w-4 h-4 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-white">{data.resumen.resueltas}</p>
          <p className="text-xs text-white/40 mt-1">Resueltas</p>
        </div>
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <TrendingUp className="w-4 h-4 text-primary mb-2" />
          <p className="text-2xl font-bold text-white">{data.resumen.tasaResolucion}%</p>
          <p className="text-xs text-white/40 mt-1">Tasa de resolución</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia mensual */}
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Tendencia Últimos 6 Meses</h3>
          <div className="space-y-4">
            {data.tendenciaMensual.map((m) => (
              <div key={m.mes}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-white/60 capitalize">{m.mes}</span>
                  <span className="text-xs text-white/40">{m.total} total</span>
                </div>
                <div className="flex h-5 rounded-md overflow-hidden bg-white/5 gap-px">
                  {m.resueltas > 0 && (
                    <div
                      className="bg-green-500/60 flex items-center justify-center"
                      style={{ width: `${maxMensual > 0 ? (m.resueltas / maxMensual) * 100 : 0}%` }}
                      title={`${m.resueltas} resueltas`}
                    />
                  )}
                  {m.abiertas > 0 && (
                    <div
                      className="bg-red-500/60 flex items-center justify-center"
                      style={{ width: `${maxMensual > 0 ? (m.abiertas / maxMensual) * 100 : 0}%` }}
                      title={`${m.abiertas} abiertas`}
                    />
                  )}
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-green-400/70">{m.resueltas} resueltas</span>
                  <span className="text-[10px] text-red-400/70">{m.abiertas} activas</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-green-500/60 rounded-sm" />
              <span className="text-[10px] text-white/40">Resueltas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-red-500/60 rounded-sm" />
              <span className="text-[10px] text-white/40">Activas</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Por prioridad */}
          <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Por Prioridad</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-red-400">Alta</span>
                </div>
                <BarH value={data.porPrioridad.alta} max={data.resumen.total} color="bg-red-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-yellow-400">Media</span>
                </div>
                <BarH value={data.porPrioridad.media} max={data.resumen.total} color="bg-yellow-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-blue-400">Baja</span>
                </div>
                <BarH value={data.porPrioridad.baja} max={data.resumen.total} color="bg-blue-500" />
              </div>
            </div>
          </div>

          {/* Por tipo */}
          <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Por Tipo de Incidencia</h3>
            <div className="space-y-3">
              {topTipos.map(([tipo, count]) => (
                <div key={tipo}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white/60 truncate pr-2">{tipo}</span>
                  </div>
                  <BarH value={count} max={maxTipo} color="bg-primary/70" />
                </div>
              ))}
              {topTipos.length === 0 && (
                <p className="text-xs text-white/30 text-center py-2">Sin datos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tiempo promedio — pendiente */}
      <div className="mt-6 bg-[#0d1c30] border border-white/5 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Tiempo Promedio de Resolución</h3>
            <p className="text-xs text-white/40 mt-1">
              Esta métrica estará disponible en la próxima fase del portal, cuando se
              registre la fecha de cierre de cada incidencia en el sistema.
            </p>
          </div>
          <span className="ml-auto shrink-0 px-2 py-1 bg-yellow-400/10 border border-yellow-400/20 rounded text-[10px] text-yellow-400 font-semibold">
            PRÓXIMAMENTE
          </span>
        </div>
      </div>
    </PortalLayout>
  );
}
