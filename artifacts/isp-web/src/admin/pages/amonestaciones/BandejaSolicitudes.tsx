import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, X } from "lucide-react";
import { api, fmtFecha, fmtQ } from "./helpers";
import type { SolicitudMod } from "./types";

export function BandejaSolicitudes({ onAbrirAmon }: { onAbrirAmon: (id: number) => void }) {
  const [estado, setEstado] = useState<"pendiente" | "todas">("pendiente");
  const sols = useQuery({
    queryKey: ["amon-sols", estado],
    queryFn: () => api<SolicitudMod[]>(`/amonestaciones/solicitudes-modificacion?estado=${estado}`),
  });
  const qc = useQueryClient();
  const [respuesta, setRespuesta] = useState<Record<number, string>>({});

  const resolver = useMutation({
    mutationFn: ({ id, accion, resp }: { id: number; accion: "aprobada" | "rechazada"; resp: string }) =>
      api(`/amonestaciones/solicitudes-modificacion/${id}/resolver`, {
        method: "POST",
        body: JSON.stringify({ accion, respuesta: resp }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amon-sols"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setEstado("pendiente")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${estado === "pendiente" ? "bg-amber-500/20 border-amber-500/40 text-amber-200" : "bg-white/5 border-white/10 text-white/60"}`}>
          Pendientes
        </button>
        <button onClick={() => setEstado("todas")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${estado === "todas" ? "bg-amber-500/20 border-amber-500/40 text-amber-200" : "bg-white/5 border-white/10 text-white/60"}`}>
          Todas
        </button>
      </div>

      {sols.isLoading ? (
        <div className="text-white/40 text-sm">Cargando…</div>
      ) : !sols.data?.length ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40 text-sm">
          No hay solicitudes {estado === "pendiente" ? "pendientes" : ""}
        </div>
      ) : (
        <div className="space-y-3">
          {sols.data.map(s => (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-white font-medium">{s.empleado_nombre}</div>
                  <div className="text-xs text-white/40 flex items-center gap-2 mt-0.5">
                    <Calendar className="w-3 h-3" /> {fmtFecha(s.fecha)}
                    <span>•</span>
                    <span className="capitalize">{s.tipo === "economica" ? `Económica ${fmtQ(s.monto)}` : "Llamada de atención"}</span>
                    <span>•</span>
                    <span>"{s.motivo}"</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.estado === "pendiente" ? "bg-amber-500/15 text-amber-300" :
                  s.estado === "aprobada" ? "bg-emerald-500/15 text-emerald-300" :
                  "bg-red-500/15 text-red-300"
                }`}>{s.estado}</span>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-black/30 rounded-lg p-2">
                  <div className="text-white/40 text-xs">Cambio solicitado</div>
                  <div className="text-white">{s.cambio_solicitado}</div>
                </div>
                <div className="bg-black/30 rounded-lg p-2">
                  <div className="text-white/40 text-xs">Razón</div>
                  <div className="text-white/80">{s.motivo_solicitud}</div>
                </div>
              </div>
              <div className="text-xs text-white/40 mt-2">
                Solicitada por <b>{s.solicitada_por_username}</b> ({s.solicitada_por_rol}) — {fmtFecha(s.created_at)}
              </div>

              {s.estado === "pendiente" && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={respuesta[s.id] || ""}
                    onChange={e => setRespuesta(r => ({ ...r, [s.id]: e.target.value }))}
                    rows={2}
                    placeholder="Respuesta a quien la solicitó (opcional)"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => onAbrirAmon(s.amonestacion_id)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-sm">
                      Abrir amonestación
                    </button>
                    <button onClick={() => resolver.mutate({ id: s.id, accion: "rechazada", resp: respuesta[s.id] || "" })}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm flex items-center gap-1">
                      <X className="w-4 h-4" /> Rechazar
                    </button>
                    <button onClick={() => resolver.mutate({ id: s.id, accion: "aprobada", resp: respuesta[s.id] || "" })}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-sm flex items-center gap-1">
                      <Check className="w-4 h-4" /> Aprobar
                    </button>
                  </div>
                </div>
              )}

              {s.respuesta_rrhh && (
                <div className="mt-2 text-xs text-emerald-300/80">
                  <b>RRHH ({s.resuelta_por}):</b> {s.respuesta_rrhh}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
