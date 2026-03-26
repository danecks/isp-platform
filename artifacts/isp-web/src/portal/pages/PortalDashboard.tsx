import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import {
  AlertTriangle, CheckCircle, Users, ShieldAlert, ShieldCheck, Shield,
  Clock, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardData {
  clienteId: string;
  incidencias: {
    total: number;
    activas: number;
    resueltas: number;
    delMes: number;
    delMesAnterior: number;
    variacionMes: number;
    recientes: {
      id: string; tipo: string; prioridad: string; estado: string;
      ubicacion: string | null; fecha: string; responsable: string | null;
    }[];
  };
  agentes: { activos: number };
  estadoServicio: "operativo" | "atencion" | "critico";
}

const ESTADO_CONFIG = {
  operativo: {
    label: "Servicio Operativo",
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/20",
    icon: ShieldCheck,
  },
  atencion: {
    label: "Requiere Atención",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
    icon: Shield,
  },
  critico: {
    label: "Estado Crítico",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
    icon: ShieldAlert,
  },
};

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "text-red-400 bg-red-400/10",
  media: "text-yellow-400 bg-yellow-400/10",
  baja: "text-blue-400 bg-blue-400/10",
};

const ESTADO_COLOR: Record<string, string> = {
  abierta: "text-red-400 bg-red-400/10",
  en_proceso: "text-yellow-400 bg-yellow-400/10",
  cerrada: "text-green-400 bg-green-400/10",
};

const ESTADO_LABEL: Record<string, string> = {
  abierta: "Abierta",
  en_proceso: "En Proceso",
  cerrada: "Cerrada",
};

function formatFecha(str: string) {
  return new Date(str).toLocaleDateString("es-GT", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function PortalDashboard() {
  const { currentUser } = useAuth();

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["portal-dashboard"],
    queryFn: () => portalGet<DashboardData>("/portal/dashboard"),
    refetchInterval: 30000,
  });

  const estadoConf = data ? ESTADO_CONFIG[data.estadoServicio] : null;
  const variacion = data?.incidencias.variacionMes ?? 0;

  if (isLoading) {
    return (
      <PortalLayout title="Panel General">
        <div className="flex items-center justify-center h-64">
          <div className="text-white/40 text-sm animate-pulse">Cargando datos de su cuenta...</div>
        </div>
      </PortalLayout>
    );
  }

  if (isError || !data) {
    return (
      <PortalLayout title="Panel General">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center text-sm text-red-400">
          Error al cargar datos. Por favor intente de nuevo.
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Panel General">
      {/* Bienvenida */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">
          Bienvenido, {currentUser?.nombre}
        </h2>
        <p className="text-white/40 text-sm mt-1">
          Resumen del estado de su servicio de seguridad — cuenta{" "}
          <span className="text-primary font-mono">{data.clienteId}</span>
        </p>
      </div>

      {/* Estado general */}
      {estadoConf && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${estadoConf.bg} mb-6`}>
          <estadoConf.icon className={`w-5 h-5 ${estadoConf.color}`} />
          <div>
            <p className={`text-sm font-semibold ${estadoConf.color}`}>
              {estadoConf.label}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              {data.estadoServicio === "operativo"
                ? "No hay incidencias activas que requieran atención inmediata."
                : data.estadoServicio === "atencion"
                ? "Existen incidencias en seguimiento. Su equipo está trabajando en ellas."
                : "Múltiples incidencias activas. Coordinación en progreso."}
            </p>
          </div>
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Activas</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.incidencias.activas}</p>
          <p className="text-xs text-white/40 mt-1">incidencias abiertas</p>
        </div>

        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Resueltas</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.incidencias.resueltas}</p>
          <p className="text-xs text-white/40 mt-1">cerradas en total</p>
        </div>

        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Este mes</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.incidencias.delMes}</p>
          <div className="flex items-center gap-1 mt-1">
            {variacion > 0 ? (
              <TrendingUp className="w-3 h-3 text-red-400" />
            ) : variacion < 0 ? (
              <TrendingDown className="w-3 h-3 text-green-400" />
            ) : (
              <Minus className="w-3 h-3 text-white/30" />
            )}
            <span className={`text-xs ${variacion > 0 ? "text-red-400" : variacion < 0 ? "text-green-400" : "text-white/30"}`}>
              {variacion !== 0 ? `${variacion > 0 ? "+" : ""}${variacion}% vs mes anterior` : "Sin variación"}
            </span>
          </div>
        </div>

        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Agentes</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.agentes.activos}</p>
          <p className="text-xs text-white/40 mt-1">asignados a su cuenta</p>
        </div>
      </div>

      {/* Incidencias recientes */}
      <div className="bg-[#0d1c30] border border-white/5 rounded-xl">
        <div className="px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Incidencias Recientes</h3>
          <p className="text-xs text-white/40 mt-0.5">Últimos registros de su cuenta</p>
        </div>

        {data.incidencias.recientes.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm">
            No hay incidencias registradas
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {data.incidencias.recientes.map((inc) => (
              <div key={inc.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white/30">{inc.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORIDAD_COLOR[inc.prioridad] ?? ""}`}>
                      {inc.prioridad?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium truncate mt-0.5">{inc.tipo}</p>
                  {inc.ubicacion && (
                    <p className="text-xs text-white/40 truncate">{inc.ubicacion}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={`px-2 py-1 rounded text-[10px] font-semibold ${ESTADO_COLOR[inc.estado] ?? ""}`}>
                    {ESTADO_LABEL[inc.estado] ?? inc.estado}
                  </span>
                  <p className="text-[10px] text-white/30 mt-1">{formatFecha(inc.fecha)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
