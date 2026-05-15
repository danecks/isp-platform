import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, CheckCircle2, Zap, Info, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { iniciales, getSession, avatarColor } from "../utils";
import { Agente, SsaAgente, TarjetaSSAPendiente, TIPOS_COBERTURA, TIPO_SSA_LABELS } from "../types";
import { SelectorAgenteAgrupado } from "../components/SelectorAgenteAgrupado";

export function ModalAsignarSSA({
  tarjeta,
  disponibles,
  onClose,
  onSuccess,
}: {
  tarjeta: TarjetaSSAPendiente;
  disponibles: Agente[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(null);
  const [tipoCobertura, setTipoCobertura]           = useState("disponible");
  const [guardando, setGuardando]                   = useState(false);
  const [conflicto, setConflicto]                   = useState<string | null>(null);
  const [removiendo, setRemoviendo]                 = useState<Record<number, boolean>>({});

  // Local state that updates on each add/remove without closing the modal
  const [agentesLocales, setAgentesLocales] = useState<SsaAgente[]>(
    (tarjeta.agentes ?? []).filter((a) => a.estado === "asignado"),
  );

  const cantidadRequerida = tarjeta.cantidad_guardias ?? 1;
  const cubierto          = agentesLocales.length >= cantidadRequerida;
  const hayCapacidad      = agentesLocales.length < cantidadRequerida;
  const idsYaAsignados    = agentesLocales.map((a) => a.id);

  async function handleAgregar() {
    if (!agenteSeleccionado) {
      toast({ title: "Selecciona un agente", variant: "destructive" });
      return;
    }
    setConflicto(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/solicitudes-servicio/${tarjeta.id}/agentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ agenteId: agenteSeleccionado.id, tipoCobertura }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.advertencia) {
          setConflicto(body.error ?? "Conflicto de asignación");
        } else {
          toast({ title: "Error al asignar", description: body.error ?? "Error desconocido", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Guardia asignado", description: `${agenteSeleccionado.nombre_completo} agregado al servicio` });
      // Actualizar local state
      setAgentesLocales((prev) => [
        ...prev,
        { id: agenteSeleccionado.id, nombre: agenteSeleccionado.nombre_completo, telefono: null, estado: "asignado" },
      ]);
      setAgenteSeleccionado(null);
      onSuccess();
    } catch {
      toast({ title: "Error de red", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  async function handleRemover(ag: SsaAgente) {
    setRemoviendo((prev) => ({ ...prev, [ag.id]: true }));
    try {
      const res = await fetch(`/api/solicitudes-servicio/${tarjeta.id}/agentes/${ag.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ motivo: "cambio_operativo" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Error al remover", description: body.error ?? "Error", variant: "destructive" });
        return;
      }
      toast({ title: "Agente removido", description: `${ag.nombre} fue desvinculado del servicio` });
      setAgentesLocales((prev) => prev.filter((a) => a.id !== ag.id));
      onSuccess();
    } catch {
      toast({ title: "Error de red", variant: "destructive" });
    } finally {
      setRemoviendo((prev) => ({ ...prev, [ag.id]: false }));
    }
  }

  const prioColor =
    tarjeta.prioridad === "urgente" ? "text-red-400" :
    tarjeta.prioridad === "alta"    ? "text-orange-400" :
                                      "text-amber-400";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-amber-500/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Asignar Guardias — Servicio Especial</p>
              <p className="text-[10px] text-white/35 font-mono">{tarjeta.id}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar modal" className="text-white/30 hover:text-white transition-colors ml-3 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info de la tarjeta */}
        <div className="px-5 py-3 border-b border-white/6 bg-white/2 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90">{tarjeta.cliente_nombre ?? "—"}</p>
              <p className="text-xs text-white/45 mt-0.5">
                {TIPO_SSA_LABELS[tarjeta.tipo_solicitud] ?? tarjeta.tipo_solicitud}
                {tarjeta.sede_nombre ? ` · ${tarjeta.sede_nombre}` : ""}
              </p>
              {(tarjeta.hora_inicio || tarjeta.fecha) && (
                <p className="text-[10px] text-white/30 mt-0.5">
                  {tarjeta.fecha ? new Date(tarjeta.fecha + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                  {tarjeta.hora_inicio ? ` · ${tarjeta.hora_inicio}${tarjeta.hora_fin ? `–${tarjeta.hora_fin}` : ""}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-[10px] font-bold uppercase tracking-wide ${prioColor}`}>{tarjeta.prioridad}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                cubierto ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
              }`}>
                {agentesLocales.length}/{cantidadRequerida} cubierto{cantidadRequerida !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Agentes actuales */}
          {agentesLocales.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2">
                Asignados ({agentesLocales.length})
              </p>
              <div className="space-y-1.5">
                {agentesLocales.map((ag) => (
                  <div key={ag.id} className="flex items-center gap-3 bg-green-500/6 border border-green-500/20 rounded-xl px-3 py-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(ag.nombre)}`}>
                      {iniciales(ag.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/90 truncate">{ag.nombre}</p>
                      <p className="text-[10px] text-green-400/60">Asignado</p>
                    </div>
                    <button
                      onClick={() => handleRemover(ag)}
                      disabled={removiendo[ag.id]}
                      title="Remover agente"
                      className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {removiendo[ag.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Separador si hay capacidad para más */}
          {hayCapacidad && (
            <div className="px-5 pt-3 pb-3">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-2">
                Agregar guardia {agentesLocales.length > 0 ? `(faltan ${cantidadRequerida - agentesLocales.length})` : ""}
              </p>

              {/* Tipo de cobertura */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {TIPOS_COBERTURA.map((tc) => (
                  <button
                    key={tc.value}
                    onClick={() => setTipoCobertura(tc.value)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                      tipoCobertura === tc.value
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-white/4 border-white/8 text-white/40 hover:border-white/20"
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>

              {/* Conflicto backend */}
              {conflicto && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 mb-3">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-200/70">{conflicto}</p>
                </div>
              )}

              {/* Selector agrupado por estado operativo */}
              <SelectorAgenteAgrupado
                fecha={tarjeta.fecha ?? new Date().toISOString().split("T")[0]}
                idsExcluidos={idsYaAsignados}
                seleccionado={agenteSeleccionado?.id ?? null}
                onSelect={(a) => {
                  setAgenteSeleccionado({ id: a.id, nombre_completo: a.nombre, estado_laboral: "activo", puesto: null, area: null, sede: null, telefono: null, wa_autorizado: false, supervisor_id: null, tipo_asignacion_eoa: "disponible" });
                  setConflicto(null);
                }}
              />
            </div>
          )}

          {/* Cubierto completamente */}
          {cubierto && (
            <div className="mx-5 my-3 flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-[11px] text-green-300/80 font-medium">
                Cobertura completa — {cantidadRequerida} de {cantidadRequerida} guardias asignados
              </p>
            </div>
          )}

          {/* Declinaron */}
          {(tarjeta.agentes_rechazados?.length ?? 0) > 0 && (
            <div className="mx-5 mb-3 flex items-start gap-2 bg-white/4 border border-white/10 rounded-xl px-3 py-2">
              <Info className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/30">
                Anteriores declinaron: {tarjeta.agentes_rechazados.map(a => a.nombre).join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/8 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-white/50 hover:text-white border border-white/8 rounded-xl transition-colors"
          >
            {cubierto ? "Listo" : "Cerrar"}
          </button>
          {hayCapacidad && (
            <button
              onClick={handleAgregar}
              disabled={!agenteSeleccionado || guardando}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#04090f] rounded-xl transition-colors"
            >
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Agregar guardia
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

