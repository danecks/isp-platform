import { useEffect, useMemo, useState } from "react";
import { X, Loader2, MapPin, Clock, Save, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useRutasHistorial,
  useGuardarRuta,
  useAsignacionesRutaDia,
} from "../../custodias/use-rutas-custodia";

// CUST-FASE3 — modal de captura de ruta del día.
// Se abre desde el pizarrón (botón "Ruta" del CustodiaSlotItem) con el agente
// preseleccionado. El autocompletado es 100% cliente-side sobre las últimas
// rutas que el agente registró para ese cliente.

interface Props {
  clienteId: number;
  clienteNombre: string;
  fecha: string;
  employeeId: number | null;
  employeeNombre: string;
  slotNumero?: number | null;
  esExterno?: boolean;
  onClose: () => void;
}

export function ModalRutaCustodia({
  clienteId, clienteNombre, fecha, employeeId, employeeNombre, slotNumero, esExterno, onClose,
}: Props) {
  const { toast } = useToast();

  const asignaciones = useAsignacionesRutaDia(clienteId, fecha);
  // Para externos (employee_id NULL) identificamos la fila por slot.
  const actual = asignaciones.data?.find(a =>
    esExterno ? a.slot_numero === slotNumero : a.employee_id === employeeId,
  );

  const [ruta, setRuta] = useState("");
  const [horaSalida, setHoraSalida] = useState("");
  const [horaRegreso, setHoraRegreso] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [mostrarSug, setMostrarSug] = useState(false);
  const [precargado, setPrecargado] = useState(false);

  useEffect(() => {
    if (precargado || !actual) return;
    setRuta(actual.ruta_texto ?? "");
    setHoraSalida(actual.hora_salida ?? "");
    setHoraRegreso(actual.hora_regreso ?? "");
    setObservaciones(actual.observaciones ?? "");
    setPrecargado(true);
  }, [actual, precargado]);

  const historial = useRutasHistorial(clienteId, esExterno ? null : employeeId, 20);
  const sugerencias = useMemo(() => {
    const q = ruta.trim().toLowerCase();
    const base = historial.data ?? [];
    const filtradas = q ? base.filter(r => r.texto.toLowerCase().includes(q)) : base;
    return filtradas.slice(0, 8);
  }, [historial.data, ruta]);

  const guardar = useGuardarRuta(clienteId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruta.trim() && !horaSalida && !horaRegreso && !observaciones.trim()) {
      toast({ title: "Sin cambios", description: "Llená al menos un campo para registrar.", variant: "destructive" });
      return;
    }
    try {
      await guardar.mutateAsync({
        fecha, employeeId,
        slotNumero: slotNumero ?? null,
        esExterno: esExterno ?? false,
        rutaTexto: ruta.trim() || null,
        horaSalida: horaSalida || null,
        horaRegreso: horaRegreso || null,
        observaciones: observaciones.trim() || null,
      });
      toast({ title: "Ruta registrada", description: `${employeeNombre} · ${fecha}` });
      onClose();
    } catch (err: any) {
      toast({ title: "No se pudo guardar", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-[#0a1322] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-white">Ruta del día</h2>
              {slotNumero != null && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded text-amber-300/80 font-bold">
                  Custodio {slotNumero}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/40 truncate"><strong className="text-white/70">{employeeNombre}</strong> · {clienteNombre} · {fecha}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-5 py-4 space-y-3">
          <div className="relative">
            <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Ruta</label>
            <input
              type="text" value={ruta} onChange={e => setRuta(e.target.value)}
              onFocus={() => setMostrarSug(true)}
              onBlur={() => setTimeout(() => setMostrarSug(false), 150)}
              placeholder="Ej. Ruta 1: bodega → tienda zona 10 → bodega"
              maxLength={500}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
            />
            {mostrarSug && sugerencias.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-[#060e1c] border border-white/15 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                <div className="px-2 py-1 text-[9px] text-white/30 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5">
                  <History className="w-2.5 h-2.5" /> Rutas previas del agente
                </div>
                {sugerencias.map((s, i) => (
                  <button
                    type="button" key={i}
                    onMouseDown={() => { setRuta(s.texto); setMostrarSug(false); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-primary/10 hover:text-white transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{s.texto}</span>
                    <span className="text-[9px] text-white/30 shrink-0">{s.veces}× · {s.ultimaFecha}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Hora de salida
              </label>
              <input type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Hora de regreso
              </label>
              <input type="time" value={horaRegreso} onChange={e => setHoraRegreso(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/40" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
              rows={2} maxLength={1000} placeholder="Incidencias, paradas, retrasos…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/40 resize-none" />
          </div>

          {actual?.registrado_por && (
            <p className="text-[10px] text-white/30">
              Último registro: {actual.registrado_por}
              {actual.registrado_at ? ` · ${new Date(actual.registrado_at).toLocaleString("es-GT")}` : ""}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="text-xs text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg border border-white/10 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardar.isPending}
              className="text-xs text-white bg-primary/80 hover:bg-primary px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
              {guardar.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar ruta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
