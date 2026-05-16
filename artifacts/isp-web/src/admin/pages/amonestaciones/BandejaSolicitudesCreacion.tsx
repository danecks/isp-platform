import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, X } from "lucide-react";
import { api, fmtFecha, fmtQ } from "./helpers";
import type { SolicitudCrea } from "./types";
import { TipoBadge } from "./badges";

export function BandejaSolicitudesCreacion({ esRRHH, onAbrirAmon, onActualizada }: {
  esRRHH: boolean; onAbrirAmon: (id: number) => void; onActualizada: () => void;
}) {
  const [estado, setEstado] = useState<"pendiente" | "todas">("pendiente");
  const sols = useQuery({
    queryKey: ["amon-sols-creacion", estado],
    queryFn: () => api<SolicitudCrea[]>(`/amonestaciones/solicitudes-creacion?estado=${estado}`),
  });
  const qc = useQueryClient();
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [aplicaDescs, setAplicaDescs] = useState<Record<number, boolean>>({});

  const resolver = useMutation({
    mutationFn: ({ id, accion, body }: { id: number; accion: "aprobada" | "rechazada"; body: Record<string, unknown> }) =>
      api(`/amonestaciones/solicitudes-creacion/${id}/resolver`, {
        method: "POST",
        body: JSON.stringify({ accion, ...body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amon-sols-creacion"] });
      onActualizada();
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
          {sols.data.map(s => {
            const monto = montos[s.id] ?? String(s.monto_sugerido || 0);
            const aplica = aplicaDescs[s.id] ?? false;
            return (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-white font-medium">{s.empleado_nombre}</div>
                    <div className="text-xs text-white/40 flex items-center gap-2 mt-0.5 flex-wrap">
                      <Calendar className="w-3 h-3" /> {fmtFecha(s.fecha_incidente)}
                      <span>•</span>
                      <TipoBadge tipo={s.tipo_solicitado} />
                      {s.monto_sugerido > 0 && (<><span>•</span><span>Sugerido {fmtQ(s.monto_sugerido)}</span></>)}
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
                    <div className="text-white/40 text-xs">Motivo</div>
                    <div className="text-white">{s.motivo}</div>
                    {s.descripcion && <div className="text-white/60 text-xs mt-1">{s.descripcion}</div>}
                  </div>
                  <div className="bg-black/30 rounded-lg p-2">
                    <div className="text-white/40 text-xs">Solicitada por</div>
                    <div className="text-white">{s.solicitada_por_username} <span className="text-white/40 text-xs">({s.solicitada_por_rol})</span></div>
                    <div className="text-white/40 text-xs mt-1">{fmtFecha(s.created_at)}</div>
                    {s.tipo_solicitado === "acta_administrativa" && s.causal_legal_codigo && (
                      <div className="text-purple-300/80 text-xs mt-1">
                        {s.causal_legal_codigo.split(",").length > 1 ? "Causales" : "Causal"}: {s.causal_legal_codigo}
                      </div>
                    )}
                  </div>
                </div>

                {s.estado === "pendiente" && esRRHH && (
                  <div className="mt-3 space-y-2">
                    {(s.tipo_solicitado === "economica" || s.tipo_solicitado === "acta_administrativa") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-white/50">Monto a aplicar (Q)</label>
                          <input type="number" min="0" step="0.01" value={monto}
                            onChange={e => setMontos(m => ({ ...m, [s.id]: e.target.value }))}
                            className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        {s.tipo_solicitado === "acta_administrativa" && (
                          <label className="flex items-center gap-2 text-sm text-white/80 mt-5">
                            <input type="checkbox" checked={aplica}
                              onChange={e => setAplicaDescs(a => ({ ...a, [s.id]: e.target.checked }))} />
                            Aplicar descuento económico vinculado
                          </label>
                        )}
                      </div>
                    )}
                    <textarea
                      value={respuestas[s.id] || ""}
                      onChange={e => setRespuestas(r => ({ ...r, [s.id]: e.target.value }))}
                      rows={2}
                      placeholder="Respuesta al solicitante (opcional)"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => resolver.mutate({
                        id: s.id, accion: "rechazada",
                        body: { respuesta: respuestas[s.id] || "" },
                      })}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm flex items-center gap-1">
                        <X className="w-4 h-4" /> Rechazar
                      </button>
                      <button onClick={() => resolver.mutate({
                        id: s.id, accion: "aprobada",
                        body: {
                          respuesta: respuestas[s.id] || "",
                          monto: Number(monto) || 0,
                          aplica_descuento: s.tipo_solicitado === "acta_administrativa" ? aplica : false,
                        },
                      })}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-sm flex items-center gap-1">
                        <Check className="w-4 h-4" /> Aprobar y crear
                      </button>
                    </div>
                  </div>
                )}

                {s.respuesta_rrhh && (
                  <div className="mt-2 text-xs text-emerald-300/80">
                    <b>RRHH ({s.resuelta_por}):</b> {s.respuesta_rrhh}
                  </div>
                )}
                {s.amonestacion_creada_id && (
                  <button onClick={() => onAbrirAmon(s.amonestacion_creada_id!)}
                    className="mt-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-xs">
                    Abrir amonestación creada #{s.amonestacion_creada_id}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
