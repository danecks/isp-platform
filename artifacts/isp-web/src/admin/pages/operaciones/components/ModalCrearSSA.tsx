import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Zap, Loader2, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, apiPost, getSession } from "../utils";

const TIPOS_SERVICIO = [
  "guardia_extra", "ampliacion_horario", "cobertura_evento", "custodia_extra", "apoyo_temporal",
];

const TIPO_LABELS: Record<string, string> = {
  guardia_extra: "Guardia extra",
  ampliacion_horario: "Ampliación de horario",
  cobertura_evento: "Cobertura de evento",
  custodia_extra: "Custodia extra",
  apoyo_temporal: "Apoyo temporal",
};

interface ClienteItem { id: number; nombre: string }

/**
 * Formulario simplificado para crear una Solicitud de Servicio Adicional.
 * Campos visibles: Cliente, Tipo, Fecha, #Guardias.
 * El resto (horario, prioridad, contacto, descripción) bajo "Más detalles".
 */
export function ModalCrearSSA({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [verMas, setVerMas] = useState(false);

  const { data: clientes = [] } = useQuery<ClienteItem[]>({
    queryKey: ["clientes-lista-simple"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/alias/clientes`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) return [] as ClienteItem[];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const [form, setForm] = useState({
    clienteId: "", tipoSolicitud: "", fecha: new Date().toISOString().slice(0, 10),
    cantidadGuardias: 1,
    horaInicio: "", horaFin: "", prioridad: "normal",
    contactoSolicitante: "", descripcion: "", aceptaCobroAdicional: false,
    origen: "operaciones",
  });

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm((p) => ({ ...p, [k]: v })); }

  const mutation = useMutation({
    mutationFn: () =>
      apiPost(`${API_BASE}/solicitudes-servicio`, {
        ...form,
        clienteId: form.clienteId ? Number(form.clienteId) : null,
      }),
    onSuccess: () => {
      toast({ title: "Solicitud creada", description: "Se generó la tarea con su checklist." });
      onCreated();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tipoSolicitud || !form.fecha) {
      toast({ title: "Tipo y fecha son requeridos", variant: "destructive" });
      return;
    }
    mutation.mutate();
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder-white/25 focus:border-primary/40";
  const labelCls = "text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/7 shrink-0">
          <h2 className="text-base font-bold text-white">Nueva solicitud de servicio</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className={labelCls}>Cliente</label>
            <select value={form.clienteId} onChange={(e) => set("clienteId", e.target.value)} className={inputCls}>
              <option value="">Sin cliente específico</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Tipo de servicio *</label>
            <select required value={form.tipoSolicitud} onChange={(e) => set("tipoSolicitud", e.target.value)} className={inputCls}>
              <option value="">Seleccionar...</option>
              {TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" required value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}># Guardias</label>
              <input type="number" min={1} value={form.cantidadGuardias} onChange={(e) => set("cantidadGuardias", Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVerMas((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verMas ? "rotate-180" : ""}`} />
            {verMas ? "Menos detalles" : "Más detalles"}
          </button>

          {verMas && (
            <div className="space-y-4 pt-1 border-t border-white/6">
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div>
                  <label className={labelCls}>Hora inicio</label>
                  <input type="time" value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora fin</label>
                  <input type="time" value={form.horaFin} onChange={(e) => set("horaFin", e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Prioridad</label>
                <select value={form.prioridad} onChange={(e) => set("prioridad", e.target.value)} className={inputCls}>
                  <option value="baja">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Contacto solicitante</label>
                <input type="text" value={form.contactoSolicitante} onChange={(e) => set("contactoSolicitante", e.target.value)} placeholder="Nombre y teléfono" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Descripción</label>
                <textarea rows={3} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Contexto, ubicación, requerimientos..." className={`${inputCls} resize-none`} />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.aceptaCobroAdicional} onChange={(e) => set("aceptaCobroAdicional", e.target.checked)} className="w-4 h-4 accent-yellow-400" />
                <span className="text-sm text-white/70">Acepta cobro adicional</span>
              </label>
            </div>
          )}
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-white/7 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} className="flex-1 py-2.5 rounded-xl bg-primary text-[#060e1c] text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Crear solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
