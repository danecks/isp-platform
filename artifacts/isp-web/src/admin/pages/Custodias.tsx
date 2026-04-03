import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import {
  Truck, Filter, AlertTriangle, ShieldCheck, Shield,
  CalendarClock, Loader2, RefreshCw, User, MapPin, Clock,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

type EstadoCustodia = "planificada" | "en_ruta" | "incidente_activo" | "incidente_completado";

interface CustodiaOperativa {
  id: number;
  nombre: string;
  cliente_id: number | null;
  cliente_nombre: string;
  turno: string | null;
  horario: string | null;
  tipo_puesto: "custodia";
  agente_id: number | null;
  agente_nombre: string | null;
  titular_employee_id: number | null;
  titular_nombre: string | null;
  notas: string | null;
  activo: boolean;
  zona_nombre: string | null;
  sede_nombre: string | null;
  turno_tipo_nombre: string | null;
  tipo_turno_id: number | null;
  fecha_inicio_ciclo: string | null;
  estado_custodia: EstadoCustodia;
  total_incidentes: number;
  incidentes_activos: number;
}

const ESTADO_CONFIG: Record<EstadoCustodia, { label: string; color: string; icon: typeof Shield }> = {
  en_ruta:              { label: "En Ruta",              color: "text-green-300 bg-green-500/10 border-green-500/25",  icon: Truck },
  incidente_activo:     { label: "Incidente Activo",     color: "text-red-300 bg-red-500/10 border-red-500/25",        icon: AlertTriangle },
  incidente_completado: { label: "Incidente Completado", color: "text-amber-300 bg-amber-500/10 border-amber-500/25",  icon: ShieldCheck },
  planificada:          { label: "Planificada",           color: "text-blue-300 bg-blue-500/10 border-blue-500/25",    icon: CalendarClock },
};

const FILTROS: { key: EstadoCustodia | "todas"; label: string }[] = [
  { key: "todas",              label: "Todas" },
  { key: "en_ruta",            label: "En Ruta" },
  { key: "incidente_activo",   label: "Incidente Activo" },
  { key: "incidente_completado", label: "Incidente Completado" },
  { key: "planificada",        label: "Planificada" },
];

export default function Custodias() {
  const [filtro, setFiltro] = useState<EstadoCustodia | "todas">("todas");

  const { data: custodias = [], isLoading, isError, refetch, isFetching } = useQuery<CustodiaOperativa[]>({
    queryKey: ["custodias-puestos"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/puestos`, { credentials: "include" });
      if (!r.ok) throw new Error("Error al cargar custodias");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const filtradas = filtro === "todas"
    ? custodias
    : custodias.filter((c) => c.estado_custodia === filtro);

  const enRuta          = custodias.filter((c) => c.estado_custodia === "en_ruta");
  const conIncidente    = custodias.filter((c) => c.estado_custodia === "incidente_activo");

  const conteo: Record<EstadoCustodia | "todas", number> = {
    todas:               custodias.length,
    en_ruta:             custodias.filter((c) => c.estado_custodia === "en_ruta").length,
    incidente_activo:    custodias.filter((c) => c.estado_custodia === "incidente_activo").length,
    incidente_completado:custodias.filter((c) => c.estado_custodia === "incidente_completado").length,
    planificada:         custodias.filter((c) => c.estado_custodia === "planificada").length,
  };

  return (
    <AdminLayout title="Control de Custodias">
      <div className="space-y-6 max-w-[1400px]">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/30 mt-0.5">
              Puestos operativos de tipo custodia con su estado en tiempo real.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 border border-white/8 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-white/30 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando custodias…</span>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
            Error al cargar las custodias. Verifica la conexión con el servidor.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {/* ALERT INCIDENTES ACTIVOS */}
            {conIncidente.length > 0 && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-300">
                    {conIncidente.length} custodia{conIncidente.length > 1 ? "s" : ""} con incidente activo
                  </p>
                  <p className="text-xs text-red-400/60 mt-0.5">
                    {conIncidente.map((c) => `${c.cliente_nombre} — ${c.nombre}`).join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {/* STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(["en_ruta", "incidente_activo", "incidente_completado", "planificada"] as EstadoCustodia[]).map((estado) => {
                const cfg = ESTADO_CONFIG[estado];
                const Icon = cfg.icon;
                const count = conteo[estado];
                return (
                  <button
                    key={estado}
                    onClick={() => setFiltro(filtro === estado ? "todas" : estado)}
                    className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                      filtro === estado ? "border-primary/40 bg-primary/5" : "border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-4 h-4 ${
                        estado === "incidente_activo"     ? "text-red-400" :
                        estado === "en_ruta"              ? "text-green-400" :
                        estado === "incidente_completado" ? "text-amber-400" :
                        "text-blue-400"
                      }`} />
                      {filtro === estado && (
                        <span className="text-[9px] text-primary font-bold px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded-full">activo</span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white">{count}</p>
                    <p className={`text-[10px] font-semibold mt-1 ${
                      estado === "incidente_activo"     ? "text-red-400/70" :
                      estado === "en_ruta"              ? "text-green-400/70" :
                      estado === "incidente_completado" ? "text-amber-400/70" :
                      "text-blue-400/70"
                    }`}>{cfg.label}</p>
                  </button>
                );
              })}
            </div>

            {/* CARDS EN RUTA */}
            {enRuta.length > 0 && filtro === "todas" && (
              <div>
                <p className="text-xs uppercase tracking-widest text-green-400/60 font-semibold mb-3">
                  Custodias en Ruta Ahora
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enRuta.map((c) => (
                    <div key={c.id} className="bg-[#0c1829] border border-green-500/20 rounded-xl p-5 hover:border-green-500/30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs font-mono text-white/30">PUE-{String(c.id).padStart(4, "0")}</p>
                          <p className="font-bold text-white text-sm">{c.nombre}</p>
                          <p className="text-xs text-white/50">{c.cliente_nombre}</p>
                        </div>
                        <span className="text-[9px] px-2 py-1 rounded-full border font-bold text-green-300 bg-green-500/10 border-green-500/25">
                          EN RUTA
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {c.agente_nombre && (
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <User className="w-3 h-3 text-green-400/60" />
                            <span>{c.agente_nombre}</span>
                          </div>
                        )}
                        {c.zona_nombre && (
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <MapPin className="w-3 h-3 text-white/30" />
                            <span>{c.zona_nombre}</span>
                          </div>
                        )}
                        {c.horario && (
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <Clock className="w-3 h-3 text-white/30" />
                            <span>{c.horario}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FILTROS */}
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="w-4 h-4 text-white/30" />
              <div className="flex flex-wrap gap-2">
                {FILTROS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFiltro(key)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                      filtro === key
                        ? "bg-primary/15 border-primary/30 text-primary"
                        : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                    }`}
                  >
                    {label}
                    <span className="text-[9px] font-bold opacity-60">{conteo[key]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TABLA */}
            <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <p className="text-sm font-bold text-white">Registro de Puestos de Custodia</p>
                </div>
                <span className="text-xs text-white/30">{filtradas.length} {filtradas.length === 1 ? "puesto" : "puestos"}</span>
              </div>

              {filtradas.length === 0 ? (
                <div className="py-12 text-center text-white/20 text-sm">
                  {custodias.length === 0
                    ? "No hay puestos de custodia configurados. Crea un puesto y márcalo como custodia desde el Pizarrón Operativo."
                    : "No hay custodias con el filtro seleccionado."
                  }
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                        <th className="text-left px-5 py-3">Puesto</th>
                        <th className="text-left px-3 py-3">Cliente</th>
                        <th className="text-left px-3 py-3">Agente Asignado</th>
                        <th className="text-left px-3 py-3">Zona</th>
                        <th className="text-left px-3 py-3">Turno</th>
                        <th className="text-left px-3 py-3">Estado</th>
                        <th className="text-left px-3 py-3 text-center">Incidentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((c) => {
                        const cfg = ESTADO_CONFIG[c.estado_custodia];
                        return (
                          <tr key={c.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-medium text-white/90">{c.nombre}</p>
                              <p className="text-[10px] font-mono text-white/25">PUE-{String(c.id).padStart(4, "0")}</p>
                            </td>
                            <td className="px-3 py-3 text-white/70 font-medium max-w-[150px] truncate">{c.cliente_nombre}</td>
                            <td className="px-3 py-3">
                              {c.agente_nombre
                                ? <span className="text-white/70">{c.agente_nombre}</span>
                                : <span className="text-white/20 italic">Sin asignar</span>
                              }
                            </td>
                            <td className="px-3 py-3 text-white/40 max-w-[120px] truncate">{c.zona_nombre ?? "—"}</td>
                            <td className="px-3 py-3 text-white/40">{c.turno_tipo_nombre ?? c.turno ?? "—"}</td>
                            <td className="px-3 py-3">
                              <span className={`text-[9px] px-2 py-1 rounded-full border font-bold ${cfg.color}`}>
                                {cfg.label.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {Number(c.incidentes_activos) > 0 ? (
                                <span className="text-red-400 font-bold">{c.incidentes_activos} activo{Number(c.incidentes_activos) > 1 ? "s" : ""}</span>
                              ) : Number(c.total_incidentes) > 0 ? (
                                <span className="text-amber-400/60">{c.total_incidentes} cerrado{Number(c.total_incidentes) > 1 ? "s" : ""}</span>
                              ) : (
                                <span className="text-white/20">0</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {custodias.length === 0 && !isLoading && (
              <div className="bg-blue-900/10 border border-blue-500/15 rounded-xl p-5 text-sm text-blue-300/70">
                <p className="font-semibold mb-1">¿Cómo configurar puestos de custodia?</p>
                <p className="text-xs text-blue-300/50">
                  Ve al <strong>Pizarrón Operativo</strong>, crea un nuevo puesto y selecciona <strong>"Custodia"</strong> como tipo de puesto.
                  Ese puesto aparecerá automáticamente aquí con su estado operativo en tiempo real.
                </p>
              </div>
            )}
          </>
        )}

      </div>
    </AdminLayout>
  );
}
