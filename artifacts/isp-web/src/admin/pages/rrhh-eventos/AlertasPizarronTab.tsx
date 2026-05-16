import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, Calendar, CheckCheck, Clock, Loader2,
  MapPin, RefreshCw, ThumbsDown, ThumbsUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API, apiRequest, apiPatch } from "./helpers";

interface AlertaItem {
  id: number;
  tipo: string;
  employee_id?: number;
  employee_nombre: string;
  puesto_nombre?: string;
  fecha_evento?: string;
  sugerencia?: string;
}

interface HEItem {
  id: number;
  employee_id?: number;
  empleado_nombre: string;
  fecha: string;
  horas_extra: number;
  puesto_cubierto_nombre?: string;
  fue_en_dia_descanso?: boolean;
}

interface KpiData {
  faltas12m: number;
  suspensiones12m: number;
  actas12m: number;
  horasExtraAprobadas: number;
  faltasEsteMes: number;
  consecutivasMax: number;
  art77: { nivel: string; alertaConsecutiva?: boolean; alertaMes?: boolean };
}

export function AlertasPizarronTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<"faltantes" | "horas_extra">("faltantes");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [kpiId, setKpiId] = useState<number | null>(null);

  const { data: alertasData, isLoading: loadingAlertas, refetch } = useQuery<{
    alertas: AlertaItem[]; totales: { faltantes: number; horasExtra: number };
  }>({
    queryKey: ["rrhh-alertas-pizarron"],
    queryFn: () => apiRequest(`${API}/rrhh/alertas-pizarron?estado=pendiente`),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const { data: hePendData, isLoading: loadingHE, refetch: refetchHE } = useQuery<{
    pendientes: HEItem[]; total: number;
  }>({
    queryKey: ["rrhh-he-pendientes"],
    queryFn: () => apiRequest(`${API}/rrhh/horas-extra-pendientes`),
    staleTime: 20_000,
  });

  const { data: kpiData } = useQuery<KpiData>({
    queryKey: ["rrhh-kpi", kpiId],
    queryFn: () => apiRequest(`${API}/rrhh/empleado/${kpiId}/kpi`),
    enabled: !!kpiId,
    staleTime: 30_000,
  });

  const alertas = alertasData?.alertas ?? [];
  const totales  = alertasData?.totales ?? { faltantes: 0, horasExtra: 0 };
  const heList   = hePendData?.pendientes ?? [];

  async function resolverAlerta(id: number) {
    setLoadingId(id);
    try {
      await apiPatch(`${API}/rrhh/alertas/${id}/resolver`, { resuelto_por: "RRHH" });
      refetch();
      qc.invalidateQueries({ queryKey: ["rrhh-alertas-pizarron"] });
      toast({ title: "Alerta resuelta", description: "Fue marcada como resuelta manualmente." });
    } catch {
      toast({ title: "Error", description: "No se pudo resolver la alerta.", variant: "destructive" });
    } finally { setLoadingId(null); }
  }

  async function aprobarHE(id: number) {
    setLoadingId(id);
    try {
      await apiPatch(`${API}/rrhh/horas-extra/${id}/aprobar`, { aprobado_por: "RRHH" });
      refetchHE();
      toast({ title: "HE Aprobadas", description: "Horas extra aprobadas correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo aprobar.", variant: "destructive" });
    } finally { setLoadingId(null); }
  }

  async function rechazarHE(id: number) {
    setLoadingId(id);
    try {
      await apiPatch(`${API}/rrhh/horas-extra/${id}/rechazar`, { rechazado_por: "RRHH" });
      refetchHE();
      toast({ title: "HE Rechazadas", description: "Las horas extra fueron rechazadas." });
    } catch {
      toast({ title: "Error", description: "No se pudo rechazar.", variant: "destructive" });
    } finally { setLoadingId(null); }
  }

  const art77Color = (nivel: string) =>
    nivel === "rojo" ? "text-red-400 bg-red-400/10 border-red-400/20" :
    nivel === "amarillo" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" :
    "text-green-400 bg-green-400/10 border-green-400/20";

  const art77Emoji = (nivel: string) =>
    nivel === "rojo" ? "🔴" : nivel === "amarillo" ? "🟡" : "🟢";

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-400/5 border border-red-400/10 rounded-2xl p-4">
          <p className="text-2xl font-bold text-red-400">{totales.faltantes}</p>
          <p className="text-xs text-white/35 mt-0.5">Faltantes sin cubrir</p>
        </div>
        <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-4">
          <p className="text-2xl font-bold text-amber-400">{totales.horasExtra + (hePendData?.total ?? 0)}</p>
          <p className="text-xs text-white/35 mt-0.5">HE pendientes de aprobación</p>
        </div>
      </div>

      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        <button
          onClick={() => setSubTab("faltantes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            subTab === "faltantes" ? "bg-red-600 text-white shadow" : "text-white/40 hover:text-white/70"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Faltantes ({totales.faltantes})
        </button>
        <button
          onClick={() => setSubTab("horas_extra")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            subTab === "horas_extra" ? "bg-amber-600 text-white shadow" : "text-white/40 hover:text-white/70"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          HE Pendientes ({hePendData?.total ?? 0})
        </button>
        <button
          onClick={() => { refetch(); refetchHE(); }}
          className="px-2 py-1.5 text-white/30 hover:text-white/60 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {kpiId && kpiData && (
        <div className="bg-[#07111f] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white/80">KPI Empleado</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${art77Color(kpiData.art77.nivel)}`}>
                Art.77 {art77Emoji(kpiData.art77.nivel)}
              </span>
            </div>
            <button onClick={() => setKpiId(null)} className="text-white/20 hover:text-white/60 text-xs">✕</button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
            {[
              { label: "Faltas 12m",  value: kpiData.faltas12m,          color: "text-red-400" },
              { label: "Suspensiones",value: kpiData.suspensiones12m,     color: "text-orange-400" },
              { label: "Actas 12m",   value: kpiData.actas12m,            color: "text-yellow-400" },
              { label: "HE aprobadas",value: `${kpiData.horasExtraAprobadas}h`, color: "text-green-400" },
              { label: "Faltas mes",  value: kpiData.faltasEsteMes,       color: "text-red-300" },
              { label: "Consecutivas",value: kpiData.consecutivasMax,     color: kpiData.consecutivasMax >= 2 ? "text-red-400" : "text-white/60" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/3 border border-white/6 rounded-xl p-2">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[9px] text-white/30">{label}</p>
              </div>
            ))}
          </div>
          {kpiData.art77.alertaConsecutiva && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              ⚠️ <strong>Art. 77 GT:</strong> {kpiData.consecutivasMax} días consecutivos ausente — posible causa justificada de terminación.
            </p>
          )}
          {kpiData.art77.alertaMes && !kpiData.art77.alertaConsecutiva && (
            <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
              ⚠️ <strong>Art. 77 GT:</strong> {kpiData.faltasEsteMes} faltas este mes — revisar umbral de inasistencias.
            </p>
          )}
        </div>
      )}

      {subTab === "faltantes" && (
        <div className="space-y-2">
          {loadingAlertas && (
            <div className="text-center py-8 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-xs">Cargando alertas...</p>
            </div>
          )}
          {!loadingAlertas && alertas.filter((a) => a.tipo === "faltante_sin_cubrir").length === 0 && (
            <div className="text-center py-10 text-white/20">
              <CheckCheck className="w-8 h-8 mx-auto mb-2 text-green-400/40" />
              <p className="text-sm">Sin faltantes pendientes</p>
            </div>
          )}
          {alertas
            .filter((a) => a.tipo === "faltante_sin_cubrir")
            .map((alerta) => (
              <div key={alerta.id} className="bg-[#07111f] border border-red-400/15 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white/85 truncate">{alerta.employee_nombre}</p>
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full font-medium">faltante</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-white/35">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{alerta.puesto_nombre ?? "—"}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{alerta.fecha_evento ?? "—"}</span>
                  </div>
                  {alerta.sugerencia && (
                    <p className="text-[10px] text-white/25 italic">{alerta.sugerencia}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {alerta.employee_id && (
                    <button
                      onClick={() => setKpiId(alerta.employee_id!)}
                      className="text-[10px] px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/20 rounded-lg transition-colors"
                    >
                      KPI
                    </button>
                  )}
                  <button
                    onClick={() => resolverAlerta(alerta.id)}
                    disabled={loadingId === alerta.id}
                    className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingId === alerta.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                    Resolver
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {subTab === "horas_extra" && (
        <div className="space-y-2">
          {loadingHE && (
            <div className="text-center py-8 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-xs">Cargando HE pendientes...</p>
            </div>
          )}
          {!loadingHE && heList.length === 0 && (
            <div className="text-center py-10 text-white/20">
              <CheckCheck className="w-8 h-8 mx-auto mb-2 text-green-400/40" />
              <p className="text-sm">Sin horas extra pendientes</p>
            </div>
          )}
          {heList.map((he) => (
            <div key={he.id} className="bg-[#07111f] border border-amber-400/15 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white/85 truncate">{he.empleado_nombre}</p>
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-full font-medium">
                    {he.horas_extra}h extra
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/35">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{he.fecha}</span>
                  {he.puesto_cubierto_nombre && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{he.puesto_cubierto_nombre}</span>
                  )}
                  {he.fue_en_dia_descanso && (
                    <span className="text-orange-400">día de descanso</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {he.employee_id && (
                  <button
                    onClick={() => setKpiId(he.employee_id!)}
                    className="text-[10px] px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/20 rounded-lg transition-colors"
                  >
                    KPI
                  </button>
                )}
                <button
                  onClick={() => rechazarHE(he.id)}
                  disabled={loadingId === he.id}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingId === he.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                  Rechazar
                </button>
                <button
                  onClick={() => aprobarHE(he.id)}
                  disabled={loadingId === he.id}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingId === he.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                  Aprobar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
