import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Ban, Check, Download, MessageSquareWarning, PenLine, X,
} from "lucide-react";
import { generarActaPdf, type DatosActaPdf } from "../../../lib/actaPdf";
import { api, fmtFecha, fmtQ } from "./helpers";
import type { Amonestacion, SolicitudMod } from "./types";
import { EstadoBadge, Info, TipoBadge } from "./badges";
import { FirmasModal } from "./FirmasModal";

function ConfirmModal({
  titulo, mensaje, onCancel, onConfirm, loading, requireMotivo,
}: { titulo: string; mensaje: string; onCancel: () => void; onConfirm: (m: string) => void; loading?: boolean; requireMotivo?: boolean }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-4">
        <h4 className="text-white font-semibold">{titulo}</h4>
        <p className="text-white/60 text-sm mt-2">{mensaje}</p>
        {requireMotivo && (
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
            placeholder="Motivo de la anulación (opcional pero recomendado)"
            className="w-full mt-3 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
        )}
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="px-3 py-2 bg-white/5 text-white/70 rounded-lg text-sm">Cancelar</button>
          <button onClick={() => onConfirm(motivo)} disabled={loading}
            className="px-3 py-2 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg text-sm">
            {loading ? "Procesando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SolicitarModificacionModal({
  amonId, onClose, onEnviada,
}: { amonId: number; onClose: () => void; onEnviada: () => void }) {
  const [cambio, setCambio] = useState("");
  const [razon, setRazon] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enviar = useMutation({
    mutationFn: () => {
      if (!cambio.trim() || !razon.trim()) {
        return Promise.reject(new Error("Indica qué cambio quieres y la razón"));
      }
      return api(`/amonestaciones/${amonId}/solicitar-modificacion`, {
        method: "POST",
        body: JSON.stringify({ cambio_solicitado: cambio, motivo_solicitud: razon }),
      });
    },
    onSuccess: onEnviada,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-4">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-blue-300" /> Solicitar modificación a RRHH
        </h4>
        <p className="text-white/50 text-xs mt-1">Tu solicitud llegará a la bandeja de RRHH para que decidan.</p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-white/50 font-medium">¿Qué cambio quieres? *</label>
            <input type="text" value={cambio} onChange={e => setCambio(e.target.value)}
              placeholder="Ej: Anular, Cambiar monto a Q30, Cambiar motivo"
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-white/50 font-medium">Razón *</label>
            <textarea value={razon} onChange={e => setRazon(e.target.value)} rows={3}
              placeholder="Por qué crees que debería modificarse"
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-2 bg-white/5 text-white/70 rounded-lg text-sm">Cancelar</button>
          <button onClick={() => { setError(null); enviar.mutate(); }} disabled={enviar.isPending}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg text-sm">
            {enviar.isPending ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DetalleAmonestacionModal({
  id, esRRHH, onClose, onActualizada,
}: { id: number; esRRHH: boolean; onClose: () => void; onActualizada: () => void }) {
  const detalle = useQuery({
    queryKey: ["amon-detalle", id],
    queryFn: () => api<Amonestacion & { solicitudes_modificacion: SolicitudMod[] }>(`/amonestaciones/${id}`),
  });
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [editMonto, setEditMonto] = useState<string>("");
  const [editMotivo, setEditMotivo] = useState<string>("");
  const [editNotas, setEditNotas] = useState<string>("");
  const [showSolicitar, setShowSolicitar] = useState(false);
  const [showAnular, setShowAnular] = useState(false);
  const [showFirmas, setShowFirmas] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  useEffect(() => {
    if (detalle.data) {
      setEditMonto(String(detalle.data.monto || ""));
      setEditMotivo(detalle.data.motivo || "");
      setEditNotas(detalle.data.notas_rrhh || "");
    }
  }, [detalle.data]);

  const guardar = useMutation({
    mutationFn: () => api(`/amonestaciones/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        monto: Number(editMonto) || 0,
        motivo: editMotivo,
        notas_rrhh: editNotas,
      }),
    }),
    onSuccess: () => {
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["amon-detalle", id] });
      onActualizada();
    },
  });

  const anular = useMutation({
    mutationFn: (motivo: string) => api(`/amonestaciones/${id}/anular`, {
      method: "POST",
      body: JSON.stringify({ motivo }),
    }),
    onSuccess: () => {
      setShowAnular(false);
      qc.invalidateQueries({ queryKey: ["amon-detalle", id] });
      onActualizada();
    },
  });

  if (detalle.isLoading || !detalle.data) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
        <div className="text-white/60">Cargando…</div>
      </div>
    );
  }
  const a = detalle.data;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Amonestación #{a.id}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <TipoBadge tipo={a.tipo} actaNumero={a.acta_numero} />
            <EstadoBadge a={a} />
            {a.descontado && a.planilla_id && (
              <span className="text-xs text-emerald-300/70">Descontada en planilla #{a.planilla_id}</span>
            )}
            {a.tipo === "acta_administrativa" && a.aplica_descuento && a.amon_economica_id && (
              <span className="text-xs text-orange-300/80">+ descuento económico vinculado #{a.amon_economica_id}</span>
            )}
            {a.tipo === "acta_administrativa" && (
              a.firmada_at ? (
                <span className="text-xs text-emerald-300/80 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Firmada</span>
              ) : (
                <span className="text-xs text-amber-300/80 inline-flex items-center gap-1"><PenLine className="w-3 h-3" /> Pendiente de firma</span>
              )
            )}
          </div>

          {a.tipo === "acta_administrativa" && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 space-y-1">
              <div>
                <div className="text-xs text-purple-300/80 uppercase">Causal legal</div>
                <div className="text-purple-100 text-sm font-medium">{a.causal_legal || "—"}</div>
                <div className="text-purple-300/60 text-xs">{a.articulo_legal || "Art. 77 Código de Trabajo de Guatemala"}</div>
              </div>
              {(a.firma_colaborador || a.firma_levanta) && (
                <div className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t border-purple-500/20 text-xs">
                  <div>
                    <div className="text-purple-300/70">Firma colaborador</div>
                    <div className="text-white">{a.firma_colaborador || "—"}</div>
                  </div>
                  <div>
                    <div className="text-purple-300/70">Firma quien levanta</div>
                    <div className="text-white">{a.firma_levanta || "—"}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Colaborador" value={a.empleado_nombre} />
            <Info label="Fecha" value={fmtFecha(a.fecha)} />
            <Info label="Levantada por" value={`${a.creado_por_username || "—"} (${a.creado_por_rol})`} />
            <Info label="Cliente / Puesto" value={[a.cliente_nombre, a.puesto_nombre].filter(Boolean).join(" — ") || "—"} />
          </div>

          {editando && esRRHH ? (
            <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <div>
                <label className="text-xs text-amber-300 font-medium">Motivo</label>
                <input type="text" value={editMotivo} onChange={e => setEditMotivo(e.target.value)}
                  className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              {a.tipo === "economica" && (
                <div>
                  <label className="text-xs text-amber-300 font-medium">Monto (Q)</label>
                  <input type="number" min="0" step="0.01" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              )}
              <div>
                <label className="text-xs text-amber-300 font-medium">Notas internas RRHH</label>
                <textarea value={editNotas} onChange={e => setEditNotas(e.target.value)} rows={2}
                  className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditando(false)} className="px-3 py-1.5 bg-white/5 text-white/70 rounded-lg text-sm">Cancelar</button>
                <button onClick={() => guardar.mutate()} disabled={guardar.isPending}
                  className="px-3 py-1.5 bg-amber-500 text-black font-semibold rounded-lg text-sm">
                  {guardar.isPending ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 bg-white/5 border border-white/10 rounded-lg p-3">
              <div>
                <div className="text-xs text-white/40 uppercase">Motivo</div>
                <div className="text-white">{a.motivo}</div>
              </div>
              {a.tipo === "economica" && (
                <div>
                  <div className="text-xs text-white/40 uppercase">Monto</div>
                  <div className="text-orange-300 font-semibold text-lg">{fmtQ(a.monto)}</div>
                </div>
              )}
              {a.descripcion && (
                <div>
                  <div className="text-xs text-white/40 uppercase">Descripción</div>
                  <div className="text-white/80 text-sm whitespace-pre-wrap">{a.descripcion}</div>
                </div>
              )}
              {a.notas_rrhh && (
                <div>
                  <div className="text-xs text-amber-300/80 uppercase">Notas RRHH</div>
                  <div className="text-white/80 text-sm whitespace-pre-wrap">{a.notas_rrhh}</div>
                </div>
              )}
            </div>
          )}

          {a.estado === "anulada" && (
            <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-3 text-sm">
              <div className="text-gray-300 font-medium">Anulada por {a.anulada_por} el {fmtFecha(a.anulada_at)}</div>
            </div>
          )}

          {/* Solicitudes de modificación */}
          {a.solicitudes_modificacion?.length > 0 && (
            <div>
              <div className="text-xs text-white/50 font-medium mb-2 uppercase">Solicitudes de modificación</div>
              <div className="space-y-2">
                {a.solicitudes_modificacion.map(s => (
                  <div key={s.id} className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/80 font-medium">{s.solicitada_por_username} ({s.solicitada_por_rol})</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.estado === "pendiente" ? "bg-amber-500/15 text-amber-300" :
                        s.estado === "aprobada" ? "bg-emerald-500/15 text-emerald-300" :
                        "bg-red-500/15 text-red-300"
                      }`}>{s.estado}</span>
                    </div>
                    <div className="text-white/70 text-xs mt-1"><b>Cambio:</b> {s.cambio_solicitado}</div>
                    <div className="text-white/60 text-xs"><b>Razón:</b> {s.motivo_solicitud}</div>
                    {s.respuesta_rrhh && (
                      <div className="text-emerald-300/80 text-xs mt-1"><b>RRHH:</b> {s.respuesta_rrhh}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end gap-2 flex-wrap">
          {a.tipo === "acta_administrativa" && (
            <button
              onClick={async () => {
                try {
                  setDescargandoPdf(true);
                  const datos = await api<DatosActaPdf>(`/amonestaciones/${id}/datos-pdf`);
                  const doc = generarActaPdf(datos);
                  doc.save(`acta_administrativa_${a.acta_numero ?? a.id}_${a.empleado_nombre.replace(/\s+/g, "_")}.pdf`);
                } catch (e) {
                  alert("No se pudo generar el PDF: " + (e as Error).message);
                } finally {
                  setDescargandoPdf(false);
                }
              }}
              disabled={descargandoPdf}
              className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {descargandoPdf ? "Generando…" : "Descargar PDF"}
            </button>
          )}
          {esRRHH && a.tipo === "acta_administrativa" && a.estado === "activa" && (
            <button onClick={() => setShowFirmas(true)}
              className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 rounded-lg text-sm flex items-center gap-1">
              <PenLine className="w-4 h-4" /> {a.firmada_at ? "Editar firmas" : "Registrar firmas"}
            </button>
          )}
          {esRRHH && a.estado === "activa" && !editando && (
            <>
              <button onClick={() => setEditando(true)} className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-sm">
                Editar
              </button>
              <button onClick={() => setShowAnular(true)} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm flex items-center gap-1">
                <Ban className="w-4 h-4" /> Anular
              </button>
            </>
          )}
          {!esRRHH && a.estado === "activa" && (
            <button onClick={() => setShowSolicitar(true)} className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-sm flex items-center gap-1">
              <MessageSquareWarning className="w-4 h-4" /> Solicitar modificación
            </button>
          )}
          <button onClick={onClose} className="px-3 py-2 bg-white/5 text-white/70 rounded-lg text-sm">Cerrar</button>
        </div>
      </div>

      {showAnular && (
        <ConfirmModal
          titulo="Anular amonestación"
          mensaje={a.descontado
            ? "Esta amonestación ya fue descontada en una planilla cerrada. Si la anulas, deberás generar un ajuste manual al colaborador."
            : "Se quitará de la próxima pre-planilla. ¿Confirmas?"}
          requireMotivo
          onCancel={() => setShowAnular(false)}
          onConfirm={(motivo) => anular.mutate(motivo || "")}
          loading={anular.isPending}
        />
      )}
      {showSolicitar && (
        <SolicitarModificacionModal
          amonId={id}
          onClose={() => setShowSolicitar(false)}
          onEnviada={() => { setShowSolicitar(false); detalle.refetch(); }}
        />
      )}
      {showFirmas && (
        <FirmasModal
          amon={a}
          onClose={() => setShowFirmas(false)}
          onFirmada={() => {
            setShowFirmas(false);
            qc.invalidateQueries({ queryKey: ["amon-detalle", id] });
            onActualizada();
          }}
        />
      )}
    </div>
  );
}
