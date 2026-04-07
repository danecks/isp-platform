import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Users,
  TrendingUp, MapPin, Zap,
} from "lucide-react";

const API = "/api";
function getSession() { return sessionStorage.getItem("isp_admin_session_v2") || ""; }
const f = (path: string) => fetch(`${API}${path}`, {
  headers: { Authorization: `Bearer ${getSession()}` },
}).then(r => r.json());

interface Ronda { id: number; nombre: string; }

interface EstadisticasData {
  frecuencia_por_punto: {
    punto_id: number; punto_nombre: string; ronda_nombre: string;
    total: number; ok: number; fuera_de_rango: number; sin_gps: number;
    ultimo_escaneo: string | null;
  }[];
  distribucion_horaria: { hora: number; total: number }[];
  tendencia_diaria: { fecha: string; total: number }[];
  ranking_agentes: { guardia_nombre: string; total: number }[];
  puntos_sin_actividad: {
    punto_id: number; punto_nombre: string; ronda_nombre: string;
    ultimo_escaneo: string | null; horas_sin_actividad: number | null;
  }[];
  resumen: {
    total_escaneos: number;
    total_puntos_activos: number;
    total_rondas_activas: number;
    puntos_con_actividad: number;
  };
}

const PERIODOS = [
  { label: "Últimas 24h", dias: 1 },
  { label: "7 días",      dias: 7 },
  { label: "30 días",     dias: 30 },
  { label: "90 días",     dias: 90 },
];

function horasLabel(h: number | null) {
  if (h == null) return "Nunca escaneado";
  if (h < 1)    return "< 1 hora";
  if (h < 24)   return `${h}h sin actividad`;
  return `${Math.round(h / 24)}d sin actividad`;
}

function fechaCorta(f: string) {
  return new Date(f).toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 },
  labelStyle: { color: "#94a3b8", fontSize: 12 },
  itemStyle: { color: "#e2e8f0", fontSize: 12 },
};

export default function EstadisticasRondas() {
  const [dias, setDias] = useState(7);
  const [rondaId, setRondaId] = useState<number | null>(null);

  const { data: rondas } = useQuery<Ronda[]>({
    queryKey: ["rondas-lista"],
    queryFn: () => f("/qr-rondas"),
  });

  const { data, isLoading } = useQuery<EstadisticasData>({
    queryKey: ["rondas-estadisticas", dias, rondaId],
    queryFn: () => {
      const params = new URLSearchParams({ dias: String(dias) });
      if (rondaId) params.set("ronda_id", String(rondaId));
      return f(`/qr-rondas/estadisticas?${params}`);
    },
    refetchInterval: 60_000,
  });

  const resumen = data?.resumen;
  const cobertura = resumen
    ? resumen.total_puntos_activos > 0
      ? Math.round((resumen.puntos_con_actividad / resumen.total_puntos_activos) * 100)
      : 0
    : null;

  // Rellenar horas sin datos con 0 para el gráfico horario
  const horasCompletas = Array.from({ length: 24 }, (_, h) => {
    const found = data?.distribucion_horaria.find(x => x.hora === h);
    return { hora: `${String(h).padStart(2, "0")}:00`, total: found?.total ?? 0 };
  });

  // Calcular max para barra de frecuencia
  const maxFrec = data?.frecuencia_por_punto[0]?.total ?? 1;

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
          {PERIODOS.map(p => (
            <button key={p.dias} onClick={() => setDias(p.dias)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                dias === p.dias
                  ? "bg-blue-600 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}>{p.label}</button>
          ))}
        </div>

        <select value={rondaId ?? ""} onChange={e => setRondaId(e.target.value ? Number(e.target.value) : null)}
          className="bg-white/5 border border-white/10 text-white/70 text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500">
          <option value="">Todas las rondas</option>
          {rondas?.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>

        {isLoading && <span className="text-white/30 text-xs animate-pulse">Calculando…</span>}
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Escaneos totales",    val: resumen?.total_escaneos ?? "—",       icon: <Activity className="w-4 h-4" />,    color: "blue"  },
          { label: "Puntos activos",      val: resumen?.total_puntos_activos ?? "—", icon: <MapPin className="w-4 h-4" />,      color: "indigo" },
          { label: "Puntos con actividad",val: resumen?.puntos_con_actividad ?? "—", icon: <Zap className="w-4 h-4" />,         color: "green" },
          { label: "Cobertura",           val: cobertura != null ? `${cobertura}%` : "—", icon: <TrendingUp className="w-4 h-4" />, color: cobertura != null && cobertura < 50 ? "red" : "emerald" },
        ].map(s => (
          <div key={s.label}
            className={`bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              s.color === "blue"    ? "bg-blue-600/20 text-blue-400" :
              s.color === "indigo" ? "bg-indigo-600/20 text-indigo-400" :
              s.color === "green"  ? "bg-green-600/20 text-green-400" :
              s.color === "red"    ? "bg-red-600/20 text-red-400" :
                                     "bg-emerald-600/20 text-emerald-400"
            }`}>{s.icon}</div>
            <div>
              <p className="text-white font-bold text-lg leading-none">{s.val}</p>
              <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerta puntos sin actividad */}
      {(data?.puntos_sin_actividad.length ?? 0) > 0 && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-amber-300 font-semibold text-sm">
              {data!.puntos_sin_actividad.length} punto{data!.puntos_sin_actividad.length > 1 ? "s" : ""} sin actividad reciente
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data!.puntos_sin_actividad.map(p => (
              <div key={p.punto_id} className="flex items-center gap-2 text-xs bg-white/3 rounded-xl px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                <div className="min-w-0">
                  <span className="text-white/80 font-medium truncate block">{p.punto_nombre}</span>
                  <span className="text-white/35">{p.ronda_nombre} · {horasLabel(p.horas_sin_actividad)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Frecuencia por punto + Agentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Frecuencia por punto */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" /> Frecuencia por punto
          </h3>
          {(data?.frecuencia_por_punto.length ?? 0) === 0 ? (
            <p className="text-white/25 text-sm text-center py-8">Sin datos en este período</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {data!.frecuencia_por_punto.map(p => {
                const pct = maxFrec > 0 ? Math.round((p.total / maxFrec) * 100) : 0;
                return (
                  <div key={p.punto_id}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="min-w-0">
                        <span className="text-white/80 text-xs font-medium truncate block">{p.punto_nombre}</span>
                        <span className="text-white/30 text-[10px]">{p.ronda_nombre}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {p.ok > 0 && <span className="text-green-400 text-[10px]">✓{p.ok}</span>}
                        {p.fuera_de_rango > 0 && <span className="text-amber-400 text-[10px]">⚠{p.fuera_de_rango}</span>}
                        <span className="text-white font-bold text-sm">{p.total}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ranking de agentes */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" /> Actividad por agente
          </h3>
          {(data?.ranking_agentes.length ?? 0) === 0 ? (
            <p className="text-white/25 text-sm text-center py-8">Sin datos en este período</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {data!.ranking_agentes.map((a, i) => {
                const maxA = data!.ranking_agentes[0]?.total ?? 1;
                const pct  = Math.round((a.total / maxA) * 100);
                return (
                  <div key={a.guardia_nombre}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold w-4 shrink-0 ${
                          i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-white/25"
                        }`}>{i + 1}</span>
                        <span className="text-white/80 text-xs font-medium truncate">{a.guardia_nombre}</span>
                      </div>
                      <span className="text-white font-bold text-sm shrink-0 ml-2">{a.total}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Distribución horaria */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" /> Distribución por hora del día
          <span className="text-white/30 text-xs font-normal ml-1">(hora Guatemala)</span>
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={horasCompletas} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="hora" tick={{ fill: "#475569", fontSize: 10 }}
              tickFormatter={v => v.split(":")[0]}
              interval={2} />
            <YAxis tick={{ fill: "#475569", fontSize: 10 }} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "Escaneos"]} />
            <Bar dataKey="total" fill="#06b6d4" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-white/25 text-xs mt-2 text-center">Horas con mayor actividad indican los picos de patrullaje</p>
      </div>

      {/* Tendencia diaria */}
      {dias > 1 && (
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Tendencia de escaneos
          </h3>
          {(data?.tendencia_diaria.length ?? 0) === 0 ? (
            <p className="text-white/25 text-sm text-center py-8">Sin datos en este período</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={data!.tendencia_diaria.map(d => ({ ...d, fecha: fechaCorta(d.fecha) }))}
                margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: "#475569", fontSize: 10 }} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "Escaneos"]} />
                <Line type="monotone" dataKey="total" stroke="#10b981"
                  strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Detalle por punto: resultados OK/Fuera/SinGPS */}
      {(data?.frecuencia_por_punto.some(p => p.total > 0)) && (
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" /> Calidad de escaneos por punto
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/8">
                  <th className="text-left pb-2 font-medium">Punto</th>
                  <th className="text-left pb-2 font-medium text-white/20">Ronda</th>
                  <th className="text-center pb-2 font-medium text-green-400">Dentro</th>
                  <th className="text-center pb-2 font-medium text-amber-400">Fuera rango</th>
                  <th className="text-center pb-2 font-medium text-white/30">Sin GPS</th>
                  <th className="text-center pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data!.frecuencia_por_punto.filter(p => p.total > 0).map(p => (
                  <tr key={p.punto_id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="py-2 text-white/80 font-medium">{p.punto_nombre}</td>
                    <td className="py-2 text-white/30">{p.ronda_nombre}</td>
                    <td className="py-2 text-center text-green-400">{p.ok}</td>
                    <td className="py-2 text-center text-amber-400">{p.fuera_de_rango}</td>
                    <td className="py-2 text-center text-white/30">{p.sin_gps}</td>
                    <td className="py-2 text-center text-white font-bold">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
