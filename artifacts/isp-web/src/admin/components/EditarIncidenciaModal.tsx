import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { incidentsApi, trelloApi, type Incident, type TrelloCardResult } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "./StatusBadge";
import {
  X, Edit3, Loader2, Clock, MapPin, User, FileText,
  Trello, ExternalLink, CheckSquare, CheckCircle2, AlertCircle,
} from "lucide-react";

interface Props {
  incidencia: Incident;
  onClose: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const CHECKLIST_PREVIEW = [
  "Validar incidente con el cliente",
  "Contactar al cliente / lugar del evento",
  "Asignar recurso y supervisor",
  "Ejecutar acción operativa",
  "Registrar evidencia / fotografías",
  "Cerrar incidente en sistema ISP",
];

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

export function EditarIncidenciaModal({ incidencia, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [estado, setEstado] = useState(incidencia.estado);
  const [prioridad, setPrioridad] = useState(incidencia.prioridad);
  const [responsable, setResponsable] = useState(incidencia.responsable ?? "");
  const [notas, setNotas] = useState(incidencia.descripcion ?? "");
  const [trelloResult, setTrelloResult] = useState<TrelloCardResult | null>(null);

  const currentTrelloUrl = trelloResult?.card.shortUrl ?? incidencia.tareaAsociada;

  const changed =
    estado !== incidencia.estado ||
    prioridad !== incidencia.prioridad ||
    responsable !== (incidencia.responsable ?? "") ||
    notas !== (incidencia.descripcion ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      incidentsApi.update(incidencia.id, {
        estado,
        prioridad,
        responsable: responsable.trim() || "Sin asignar",
        notas: notas.trim() || undefined,
      } as any),
    onSuccess: (updated) => {
      queryClient.setQueryData(["incidents"], (old: Incident[] | undefined) =>
        old ? old.map((i) => (i.id === updated.id ? updated : i)) : [updated]
      );
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast({ title: "Incidencia actualizada", description: `${incidencia.id} guardada correctamente.` });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" });
    },
  });

  const trelloMutation = useMutation({
    mutationFn: () => trelloApi.sendIncident(incidencia.id),
    onSuccess: (result) => {
      setTrelloResult(result);
      queryClient.setQueryData(["incidents"], (old: Incident[] | undefined) =>
        old
          ? old.map((i) =>
              i.id === incidencia.id
                ? { ...i, tareaAsociada: result.card.shortUrl }
                : i
            )
          : old
      );
      const modeLabel = result.mockMode ? " (modo simulación)" : "";
      toast({
        title: `Tarjeta creada en Trello${modeLabel}`,
        description: `${result.checklistItems.length} ítems de checklist agregados.`,
      });
    },
    onError: (err: Error) => {
      if (err.message.includes("ya tiene una tarjeta")) {
        toast({ title: "Ya está en Trello", description: err.message });
      } else {
        toast({ title: "Error al crear tarjeta Trello", description: err.message, variant: "destructive" });
      }
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#0d1b2e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white font-mono">{incidencia.id}</p>
                <StatusBadge value={incidencia.estado as any} />
                <StatusBadge value={incidencia.prioridad as any} />
              </div>
              <p className="text-[10px] text-white/30 mt-0.5">{incidencia.tipo} · {incidencia.cliente}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* INFO DE SOLO LECTURA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-wide">
                <Clock className="w-3 h-3" /> Registrada
              </div>
              <p className="text-xs text-white/60">{fmtDate(incidencia.fecha)}</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-wide">
                <MapPin className="w-3 h-3" /> Ubicación
              </div>
              <p className="text-xs text-white/60">{incidencia.ubicacion ?? "No especificada"}</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-wide">
                <User className="w-3 h-3" /> Cliente
              </div>
              <p className="text-xs text-white/70 font-medium">{incidencia.cliente}</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-wide">
                Canal de Origen
              </div>
              <StatusBadge value={incidencia.origen as any} />
            </div>
          </div>

          {/* CAMPOS EDITABLES */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-4">Campos Editables</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-white/50 uppercase tracking-wide mb-1.5">Estado</label>
                <select className={selectCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                  <option value="abierta">Abierta</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="resuelta">Resuelta</option>
                  <option value="cerrada">Cerrada</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-white/50 uppercase tracking-wide mb-1.5">Prioridad</label>
                <select className={selectCls} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                  <option value="urgente">Urgente</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-white/50 uppercase tracking-wide mb-1.5">Responsable</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Nombre del supervisor"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[11px] text-white/50 uppercase tracking-wide mb-1.5">
                <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> Notas / Descripción</span>
              </label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                placeholder="Detalle del incidente, acciones tomadas, seguimiento..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>

          {/* SECCIÓN TRELLO */}
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Trello className="w-4 h-4 text-blue-400" />
              <p className="text-[11px] text-white/50 uppercase tracking-widest">Integración Trello</p>
            </div>

            {currentTrelloUrl ? (
              /* ── Ya enviado a Trello ── */
              <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-300 font-semibold">Tarjeta creada en Trello</p>
                  {trelloResult?.mockMode && (
                    <span className="text-[10px] text-blue-400/50 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                      Simulación
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CHECKLIST_PREVIEW.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-1 text-[10px] text-white/40 bg-white/3 border border-white/5 rounded-md px-2 py-1"
                    >
                      <CheckSquare className="w-2.5 h-2.5 text-blue-400/50 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>

                <a
                  href={currentTrelloUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  {currentTrelloUrl}
                </a>
              </div>
            ) : (
              /* ── Aún no enviado ── */
              <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-white/20 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    Al enviar a Trello se creará una tarjeta con el checklist de 6 pasos del protocolo ISP y se asignará automáticamente a los responsables configurados.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CHECKLIST_PREVIEW.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-1 text-[10px] text-white/30 bg-white/2 border border-white/5 rounded-md px-2 py-1"
                    >
                      <CheckSquare className="w-2.5 h-2.5 text-white/15 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => trelloMutation.mutate()}
                  disabled={trelloMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {trelloMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creando tarjeta...</>
                  ) : (
                    <><Trello className="w-3.5 h-3.5" /> Enviar a Trello</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!changed || saveMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-[#0a1628] text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
              ) : (
                "Guardar Cambios"
              )}
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
