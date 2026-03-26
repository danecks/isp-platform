import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { AlertTriangle, Filter, Search } from "lucide-react";

interface Incident {
  id: string;
  fecha: string;
  tipo: string;
  prioridad: string;
  estado: string;
  ubicacion: string | null;
  responsable: string | null;
  descripcion: string | null;
  origen: string;
}

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "text-red-400 bg-red-400/10 border-red-400/20",
  media: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  baja: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const ESTADO_COLOR: Record<string, string> = {
  abierta: "text-red-400 bg-red-400/10 border-red-400/20",
  en_proceso: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  cerrada: "text-green-400 bg-green-400/10 border-green-400/20",
};

const ESTADO_LABEL: Record<string, string> = {
  abierta: "Abierta",
  en_proceso: "En Proceso",
  cerrada: "Cerrada",
};

function formatFecha(str: string) {
  return new Date(str).toLocaleDateString("es-GT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function PortalIncidencias() {
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);

  const { data = [], isLoading, isError } = useQuery<Incident[]>({
    queryKey: ["portal-incidencias"],
    queryFn: () => portalGet<Incident[]>("/portal/incidencias"),
    refetchInterval: 30000,
  });

  const filtradas = data.filter((inc) => {
    if (filtroEstado && inc.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        inc.tipo.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q) ||
        (inc.ubicacion ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activas = data.filter((i) => ["abierta", "en_proceso"].includes(i.estado)).length;
  const cerradas = data.filter((i) => i.estado === "cerrada").length;

  return (
    <PortalLayout title="Incidencias">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Mis Incidencias</h2>
          <p className="text-sm text-white/40 mt-1">
            Historial de incidencias registradas en su cuenta
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="bg-[#0d1c30] border border-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-red-400">{activas}</p>
            <p className="text-[10px] text-white/40 uppercase">Activas</p>
          </div>
          <div className="bg-[#0d1c30] border border-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-green-400">{cerradas}</p>
            <p className="text-[10px] text-white/40 uppercase">Cerradas</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar por tipo, ID o ubicación..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-[#0d1c30] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#0d1c30] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary/40 appearance-none min-w-[160px]"
          >
            <option value="">Todos los estados</option>
            <option value="abierta">Abierta</option>
            <option value="en_proceso">En Proceso</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/40 text-sm animate-pulse">Cargando incidencias...</div>
        </div>
      ) : isError ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center text-sm text-red-400">
          Error al cargar incidencias.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No se encontraron incidencias</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((inc) => (
            <div
              key={inc.id}
              className="bg-[#0d1c30] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
              onClick={() => setExpandida(expandida === inc.id ? null : inc.id)}
            >
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* ID + tipo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-white/30">{inc.id}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${PRIORIDAD_COLOR[inc.prioridad] ?? ""}`}>
                      {inc.prioridad?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{inc.tipo}</p>
                  {inc.ubicacion && (
                    <p className="text-xs text-white/40 mt-0.5 truncate">{inc.ubicacion}</p>
                  )}
                </div>

                {/* Estado + fecha */}
                <div className="flex sm:flex-col items-center sm:items-end gap-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold border ${ESTADO_COLOR[inc.estado] ?? ""}`}>
                    {ESTADO_LABEL[inc.estado] ?? inc.estado}
                  </span>
                  <span className="text-[10px] text-white/30 whitespace-nowrap">
                    {formatFecha(inc.fecha)}
                  </span>
                </div>
              </div>

              {/* Detalle expandible */}
              {expandida === inc.id && (
                <div className="px-5 pb-4 border-t border-white/5 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {inc.descripcion && (
                    <div className="sm:col-span-2">
                      <p className="text-white/40 mb-1">Descripción</p>
                      <p className="text-white/70">{inc.descripcion}</p>
                    </div>
                  )}
                  {inc.responsable && (
                    <div>
                      <p className="text-white/40 mb-0.5">Responsable</p>
                      <p className="text-white">{inc.responsable}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/40 mb-0.5">Origen del reporte</p>
                    <p className="text-white capitalize">{inc.origen}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filtradas.length > 0 && (
        <p className="text-xs text-white/30 text-center mt-4">
          Mostrando {filtradas.length} de {data.length} incidencias
        </p>
      )}
    </PortalLayout>
  );
}
