import { useState } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { mockIncidencias } from "../mocks/incidencias";
import type { PrioridadType, EstadoIncidenciaType } from "../types";
import { AlertTriangle, Filter } from "lucide-react";

const ESTADOS: (EstadoIncidenciaType | "todos")[] = ["todos", "abierta", "en_proceso", "resuelta", "cerrada"];
const PRIORIDADES: (PrioridadType | "todos")[] = ["todos", "alta", "media", "baja"];

export default function Incidencias() {
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoIncidenciaType | "todos">("todos");
  const [prioridadFiltro, setPrioridadFiltro] = useState<PrioridadType | "todos">("todos");

  const filtradas = mockIncidencias.filter((i) => {
    if (estadoFiltro !== "todos" && i.estado !== estadoFiltro) return false;
    if (prioridadFiltro !== "todos" && i.prioridad !== prioridadFiltro) return false;
    return true;
  });

  return (
    <AdminLayout title="Gestión de Incidencias">
      <div className="space-y-6 max-w-[1400px]">

        {/* HEADER COUNTS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["abierta", "en_proceso", "resuelta", "cerrada"] as EstadoIncidenciaType[]).map((e) => {
            const count = mockIncidencias.filter((i) => i.estado === e).length;
            return (
              <button
                key={e}
                onClick={() => setEstadoFiltro(estadoFiltro === e ? "todos" : e)}
                className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                  estadoFiltro === e ? "border-primary/40" : "border-white/5 hover:border-white/10"
                }`}
              >
                <p className="text-2xl font-bold text-white">{count}</p>
                <div className="mt-1"><StatusBadge value={e} /></div>
              </button>
            );
          })}
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-white/30" />
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setEstadoFiltro(e)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  estadoFiltro === e
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                }`}
              >
                {e === "todos" ? "Todos los estados" : <StatusBadge value={e} />}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pl-2 border-l border-white/10">
            {PRIORIDADES.map((p) => (
              <button
                key={p}
                onClick={() => setPrioridadFiltro(p)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  prioridadFiltro === p
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                }`}
              >
                {p === "todos" ? "Toda prioridad" : <StatusBadge value={p} />}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Registro de Incidencias</p>
            </div>
            <span className="text-xs text-white/30">{filtradas.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-5 py-3">ID</th>
                  <th className="text-left px-3 py-3">Fecha</th>
                  <th className="text-left px-3 py-3">Origen</th>
                  <th className="text-left px-3 py-3">Cliente</th>
                  <th className="text-left px-3 py-3">Ubicación</th>
                  <th className="text-left px-3 py-3">Tipo</th>
                  <th className="text-left px-3 py-3">Prioridad</th>
                  <th className="text-left px-3 py-3">Estado</th>
                  <th className="text-left px-3 py-3">Responsable</th>
                  <th className="text-left px-3 py-3">Tarea</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((inc) => (
                  <tr key={inc.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3 text-primary font-mono font-semibold">{inc.id}</td>
                    <td className="px-3 py-3 text-white/50 whitespace-nowrap">{inc.fecha}</td>
                    <td className="px-3 py-3"><StatusBadge value={inc.origen} /></td>
                    <td className="px-3 py-3 text-white/80 max-w-[150px] truncate font-medium">{inc.cliente}</td>
                    <td className="px-3 py-3 text-white/40 max-w-[150px] truncate">{inc.ubicacion}</td>
                    <td className="px-3 py-3 text-white/60">{inc.tipo}</td>
                    <td className="px-3 py-3"><StatusBadge value={inc.prioridad} /></td>
                    <td className="px-3 py-3"><StatusBadge value={inc.estado} /></td>
                    <td className="px-3 py-3 text-white/50">{inc.responsable}</td>
                    <td className="px-3 py-3">
                      {inc.tareaAsociada ? (
                        <span className="text-primary/70 font-mono text-[10px]">{inc.tareaAsociada}</span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-white/30 text-xs">
                      No se encontraron incidencias con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
