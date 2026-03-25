import { useState } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { mockTareas } from "../mocks/tareas";
import type { EstadoTareaType } from "../types";
import { CheckSquare, Filter, Trello } from "lucide-react";

const ESTADOS: (EstadoTareaType | "todos")[] = ["todos", "pendiente", "en_proceso", "completada", "cancelada"];

export default function Tareas() {
  const [filtro, setFiltro] = useState<EstadoTareaType | "todos">("todos");

  const filtradas = filtro === "todos" ? mockTareas : mockTareas.filter((t) => t.estado === filtro);

  return (
    <AdminLayout title="Gestión de Tareas">
      <div className="space-y-6 max-w-[1400px]">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["pendiente", "en_proceso", "completada", "cancelada"] as EstadoTareaType[]).map((e) => {
            const count = mockTareas.filter((t) => t.estado === e).length;
            return (
              <button
                key={e}
                onClick={() => setFiltro(filtro === e ? "todos" : e)}
                className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                  filtro === e ? "border-primary/40" : "border-white/5 hover:border-white/10"
                }`}
              >
                <p className="text-2xl font-bold text-white">{count}</p>
                <div className="mt-1"><StatusBadge value={e} /></div>
              </button>
            );
          })}
        </div>

        {/* TRELLO INFO BLOCK */}
        <div className="bg-[#0c1829] border border-blue-500/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Trello className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-xs font-bold text-white">Sincronización con Trello — Próxima fase</p>
              <p className="text-[10px] text-white/30 mt-0.5">
                Cada tarea con trelloCardId activo será vinculada a una tarjeta de Trello. Los cambios de estado se sincronizarán automáticamente.
              </p>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-white/30" />
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setFiltro(e)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  filtro === e
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/3 border-white/8 text-white/40 hover:text-white"
                }`}
              >
                {e === "todos" ? "Todas" : <StatusBadge value={e} />}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Registro de Tareas</p>
            </div>
            <span className="text-xs text-white/30">{filtradas.length} tareas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-5 py-3">ID</th>
                  <th className="text-left px-3 py-3">Título</th>
                  <th className="text-left px-3 py-3">Incidencia</th>
                  <th className="text-left px-3 py-3">Prioridad</th>
                  <th className="text-left px-3 py-3">Estado</th>
                  <th className="text-left px-3 py-3">Asignado</th>
                  <th className="text-left px-3 py-3">Trello Card</th>
                  <th className="text-left px-3 py-3">Trello Lista</th>
                  <th className="text-left px-3 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => (
                  <tr key={t.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3 text-primary font-mono font-semibold">{t.id}</td>
                    <td className="px-3 py-3 text-white/80 max-w-[200px]">
                      <p className="truncate">{t.titulo}</p>
                    </td>
                    <td className="px-3 py-3">
                      {t.incidenciaRelacionada
                        ? <span className="text-red-400/70 font-mono text-[10px]">{t.incidenciaRelacionada}</span>
                        : <span className="text-white/20">—</span>
                      }
                    </td>
                    <td className="px-3 py-3"><StatusBadge value={t.prioridad} /></td>
                    <td className="px-3 py-3"><StatusBadge value={t.estado} /></td>
                    <td className="px-3 py-3 text-white/50">{t.asignado}</td>
                    <td className="px-3 py-3">
                      {t.trelloCardId
                        ? <span className="text-blue-400/60 font-mono text-[10px]">{t.trelloCardId}</span>
                        : <span className="text-white/20">—</span>
                      }
                    </td>
                    <td className="px-3 py-3">
                      {t.trelloList
                        ? <span className="text-white/40">{t.trelloList}</span>
                        : <span className="text-white/20">—</span>
                      }
                    </td>
                    <td className="px-3 py-3 text-white/30">{t.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
