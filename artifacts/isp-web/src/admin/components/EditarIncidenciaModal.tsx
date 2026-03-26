import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { incidentsApi, type Incident } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "./StatusBadge";
import { X, Edit3, Loader2, Clock, MapPin, User, FileText } from "lucide-react";

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

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

export function EditarIncidenciaModal({ incidencia, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [estado, setEstado] = useState(incidencia.estado);
  const [prioridad, setPrioridad] = useState(incidencia.prioridad);
  const [responsable, setResponsable] = useState(incidencia.responsable ?? "");
  const [notas, setNotas] = useState(incidencia.descripcion ?? "");

  const changed =
    estado !== incidencia.estado ||
    prioridad !== incidencia.prioridad ||
    responsable !== (incidencia.responsable ?? "") ||
    notas !== (incidencia.descripcion ?? "");

  const mutation = useMutation({
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

          {/* DIVISOR */}
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
                rows={5}
                placeholder="Detalle del incidente, acciones tomadas, seguimiento..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>

          {/* PREPARADO PARA WHATSAPP */}
          <div className="bg-white/2 border border-white/5 rounded-xl px-4 py-3">
            <p className="text-[10px] text-white/25 leading-relaxed">
              <span className="text-primary/40 font-semibold">Próxima fase — Canal WhatsApp:</span> Cuando se integre el canal de WhatsApp, las incidencias reportadas por ese canal llegarán aquí automáticamente con <code className="text-primary/40">origen: "whatsapp"</code>. Los supervisores podrán responder desde este panel sin cambiar de aplicación.
            </p>
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
              onClick={() => mutation.mutate()}
              disabled={!changed || mutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-[#0a1628] text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? (
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
