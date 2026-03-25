import { useState } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { mockCustodias } from "../mocks/custodias";
import type { EstadoCustodiaType } from "../types";
import { Truck, Filter, MapPin, AlertTriangle } from "lucide-react";

const ESTADOS: (EstadoCustodiaType | "todos")[] = ["todos", "planificada", "en_ruta", "completada", "incidente"];

export default function Custodias() {
  const [filtro, setFiltro] = useState<EstadoCustodiaType | "todos">("todos");

  const filtradas = filtro === "todos" ? mockCustodias : mockCustodias.filter((c) => c.estado === filtro);
  const enRuta = mockCustodias.filter((c) => c.estado === "en_ruta");
  const conIncidente = mockCustodias.filter((c) => c.estado === "incidente");

  return (
    <AdminLayout title="Control de Custodias">
      <div className="space-y-6 max-w-[1400px]">

        {/* ALERT INCIDENTES */}
        {conIncidente.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-300">{conIncidente.length} custodia(s) con incidente activo</p>
              <p className="text-xs text-red-400/60 mt-0.5">
                {conIncidente.map((c) => `${c.id} — ${c.cliente}`).join(" | ")}
              </p>
            </div>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["planificada", "en_ruta", "completada", "incidente"] as EstadoCustodiaType[]).map((e) => {
            const count = mockCustodias.filter((c) => c.estado === e).length;
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

        {/* EN RUTA — CARDS */}
        {enRuta.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Custodias en Ruta Ahora</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enRuta.map((c) => (
                <div key={c.id} className="bg-[#0c1829] border border-yellow-500/20 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-mono text-primary">{c.id}</p>
                      <p className="font-bold text-white">{c.cliente}</p>
                    </div>
                    <StatusBadge value={c.estado} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50 mb-1">
                    <MapPin className="w-3 h-3 text-green-400" />
                    <span>{c.origen}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50 mb-3">
                    <MapPin className="w-3 h-3 text-red-400" />
                    <span>{c.destino}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30">Agente: <span className="text-white/60">{c.agente}</span></span>
                    <span className="text-white/30">Salida: <span className="text-white/60">{c.horaSalida}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
              <Truck className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-white">Registro de Custodias</p>
            </div>
            <span className="text-xs text-white/30">{filtradas.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-5 py-3">ID</th>
                  <th className="text-left px-3 py-3">Fecha</th>
                  <th className="text-left px-3 py-3">Cliente</th>
                  <th className="text-left px-3 py-3">Origen</th>
                  <th className="text-left px-3 py-3">Destino</th>
                  <th className="text-left px-3 py-3">Agente</th>
                  <th className="text-left px-3 py-3">Salida</th>
                  <th className="text-left px-3 py-3">Estado</th>
                  <th className="text-left px-3 py-3">Incidentes</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <tr key={c.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3 text-primary font-mono font-semibold">{c.id}</td>
                    <td className="px-3 py-3 text-white/30">{c.fecha}</td>
                    <td className="px-3 py-3 text-white/80 font-medium max-w-[140px] truncate">{c.cliente}</td>
                    <td className="px-3 py-3 text-white/50 max-w-[130px] truncate">{c.origen}</td>
                    <td className="px-3 py-3 text-white/50 max-w-[130px] truncate">{c.destino}</td>
                    <td className="px-3 py-3 text-white/60">{c.agente}</td>
                    <td className="px-3 py-3 text-white/50">{c.horaSalida}</td>
                    <td className="px-3 py-3"><StatusBadge value={c.estado} /></td>
                    <td className="px-3 py-3">
                      {c.incidentesAsociados > 0
                        ? <span className="text-red-400 font-bold">{c.incidentesAsociados}</span>
                        : <span className="text-white/20">0</span>
                      }
                    </td>
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
