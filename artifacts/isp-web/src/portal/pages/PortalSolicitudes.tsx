import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet, portalPost } from "@/lib/portalApi";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Plus, X, Clock, CheckCircle, AlertTriangle, Loader2,
  CalendarDays, Users, FileText, ChevronRight, Info, UserCheck, Shield,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SolicitudPortal {
  id: string;
  tipo_solicitud: string;
  fecha: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  cantidad_guardias: number;
  descripcion: string | null;
  prioridad: string;
  estado_general: string;
  contacto_solicitante: string | null;
  acepta_cobro_adicional: boolean;
  created_at: string;
  sede_nombre: string | null;
  puesto_nombre: string | null;
  agente_nombre: string | null;
  tipo_cobertura: string | null;
  resumen_final: string | null;
  resumen_generado_at: string | null;
}

// ─── Config visual ────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  guardia_extra: "Guardia Extra",
  ampliacion_horario: "Ampliación de Horario",
  cobertura_evento: "Cobertura de Evento",
  custodia_extra: "Custodia Extra",
  apoyo_temporal: "Apoyo Temporal",
};

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  nueva:                 { label: "Nueva", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: Plus },
  en_revision:           { label: "En Revisión", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: Clock },
  pendiente_rrhh:        { label: "Validando RRHH", color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: Users },
  pendiente_operaciones: { label: "En Operaciones", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: Zap },
  pendiente_facturacion: { label: "Pendiente de Cobro", color: "text-orange-400 bg-orange-400/10 border-orange-400/20", icon: FileText },
  cubierta:              { label: "Cubierta", color: "text-green-400 bg-green-400/10 border-green-400/20", icon: CheckCircle },
  cerrada:               { label: "Cerrada", color: "text-gray-400 bg-gray-400/10 border-gray-400/20", icon: CheckCircle },
  cancelada:             { label: "Cancelada", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: X },
};

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: "text-red-400 bg-red-400/10",
  alta:    "text-orange-400 bg-orange-400/10",
  normal:  "text-blue-400 bg-blue-400/10",
  baja:    "text-gray-400 bg-gray-400/10",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PortalSolicitudes() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudPortal[]>({
    queryKey: ["portal-solicitudes"],
    queryFn: () => portalGet("/portal/solicitudes-servicio"),
    refetchInterval: 30000,
  });

  return (
    <PortalLayout title="Servicios Adicionales">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Servicios Adicionales</h1>
            <p className="text-sm text-white/50 mt-1">
              Solicite guardias extra, ampliaciones de horario, coberturas de eventos y más.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-[#060e1c] text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Solicitud
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-300/80 leading-relaxed">
            Al enviar una solicitud, nuestro equipo de Operaciones, RRHH y Comercial la revisarán y coordinarán la cobertura.
            Puede ver el estado de seguimiento en esta página. Los detalles internos de gestión permanecen confidenciales.
          </p>
        </div>

        {/* Lista de solicitudes */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-white/5 bg-white/2">
            <Zap className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No ha realizado solicitudes aún</p>
            <p className="text-white/25 text-xs mt-1">Use el botón "Nueva Solicitud" para comenzar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitudes.map((s) => (
              <SolicitudCard key={s.id} solicitud={s} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de nueva solicitud */}
      {showForm && (
        <FormularioSolicitud
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["portal-solicitudes"] });
            toast({ title: "Solicitud enviada", description: "Nuestro equipo la revisará pronto." });
          }}
        />
      )}
    </PortalLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COBERTURA_LABELS: Record<string, string> = {
  disponible: "Agente Disponible",
  relevo: "Relevo Temporal",
  horas_extra: "Horas Extra",
  cambio_titular: "Cambio de Titular",
  contratacion_nueva: "Contratación Nueva",
};

// ─── Tarjeta de solicitud ─────────────────────────────────────────────────────

function SolicitudCard({ solicitud: s }: { solicitud: SolicitudPortal }) {
  const [open, setOpen] = useState(false);
  const estadoCfg = ESTADO_CONFIG[s.estado_general] ?? { label: s.estado_general, color: "text-gray-400 bg-gray-400/10 border-gray-400/20", icon: FileText };
  const IconEstado = estadoCfg.icon;
  const fechaFormateada = new Date(s.fecha + "T12:00:00").toLocaleDateString("es-GT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const resumenParsed = (() => {
    if (!s.resumen_final) return null;
    try { return JSON.parse(s.resumen_final); } catch { return null; }
  })();

  return (
    <div className="rounded-xl border border-white/7 bg-white/2 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-white/30">{s.id}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoCfg.color}`}>
              <IconEstado className="w-2.5 h-2.5" />
              {estadoCfg.label}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORIDAD_COLOR[s.prioridad] ?? "text-gray-400 bg-gray-400/10"}`}>
              {s.prioridad === "urgente" ? "URGENTE" : s.prioridad.charAt(0).toUpperCase() + s.prioridad.slice(1)}
            </span>
            {resumenParsed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Shield className="w-2.5 h-2.5" />
                Resumen Disponible
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white">
            {TIPO_LABELS[s.tipo_solicitud] ?? s.tipo_solicitud}
          </p>
          <p className="text-xs text-white/40 mt-0.5">{fechaFormateada}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-white/5 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-white/35 mb-0.5">Fecha</p>
              <p className="text-white font-medium capitalize">{fechaFormateada}</p>
            </div>
            {(s.hora_inicio || s.hora_fin) && (
              <div>
                <p className="text-white/35 mb-0.5">Horario</p>
                <p className="text-white font-medium">
                  {s.hora_inicio ?? "--"} – {s.hora_fin ?? "--"}
                </p>
              </div>
            )}
            <div>
              <p className="text-white/35 mb-0.5">Guardias solicitados</p>
              <p className="text-white font-medium">{s.cantidad_guardias}</p>
            </div>
            {s.sede_nombre && (
              <div>
                <p className="text-white/35 mb-0.5">Sede</p>
                <p className="text-white font-medium">{s.sede_nombre}</p>
              </div>
            )}
            {s.contacto_solicitante && (
              <div>
                <p className="text-white/35 mb-0.5">Contacto</p>
                <p className="text-white font-medium">{s.contacto_solicitante}</p>
              </div>
            )}
            <div>
              <p className="text-white/35 mb-0.5">Cobro adicional</p>
              <p className={`font-medium ${s.acepta_cobro_adicional ? "text-green-400" : "text-white/60"}`}>
                {s.acepta_cobro_adicional ? "Aceptado" : "No confirmado"}
              </p>
            </div>
          </div>
          {s.descripcion && (
            <div>
              <p className="text-white/35 text-xs mb-1">Descripción / Motivo</p>
              <p className="text-white/70 text-xs leading-relaxed">{s.descripcion}</p>
            </div>
          )}

          {/* Resumen final — visible al cliente cuando está disponible */}
          {resumenParsed && (
            <div className="mt-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <p className="text-xs font-bold text-purple-300">Resumen de Servicio — ISP</p>
                <span className="ml-auto text-[10px] text-white/30">
                  {s.resumen_generado_at ? new Date(s.resumen_generado_at).toLocaleDateString("es-GT") : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Tipo de Servicio", resumenParsed.tipo_servicio],
                  ["Agente Asignado", resumenParsed.agente ?? "—"],
                  ["Tipo de Cobertura", COBERTURA_LABELS[resumenParsed.tipo_cobertura] ?? resumenParsed.tipo_cobertura ?? "—"],
                  ["Estado Final", resumenParsed.estado_final === "cerrada" ? "Completado ✓" : resumenParsed.estado_final ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white/5 rounded-lg p-2">
                    <p className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">{k}</p>
                    <p className="text-white font-medium">{v}</p>
                  </div>
                ))}
              </div>
              {resumenParsed.hubo_horas_extra && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Se registraron horas extra — pendiente confirmación de cobro
                </div>
              )}
            </div>
          )}

          <p className="text-white/20 text-[10px]">
            Enviada el {new Date(s.created_at).toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Formulario de nueva solicitud ────────────────────────────────────────────

const TIPOS_SERVICIO = [
  { value: "guardia_extra", label: "Guardia Extra", desc: "Un agente de seguridad adicional por tiempo determinado" },
  { value: "ampliacion_horario", label: "Ampliación de Horario", desc: "Extender el horario de un puesto existente" },
  { value: "cobertura_evento", label: "Cobertura de Evento", desc: "Seguridad especial para evento o actividad" },
  { value: "custodia_extra", label: "Custodia Extra", desc: "Custodia adicional de bienes o personas" },
  { value: "apoyo_temporal", label: "Apoyo Temporal", desc: "Refuerzo de seguridad temporal por situación específica" },
];

interface FormularioProps {
  onClose: () => void;
  onCreated: () => void;
}

function FormularioSolicitud({ onClose, onCreated }: FormularioProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    tipoSolicitud: "",
    fecha: new Date().toISOString().slice(0, 10),
    horaInicio: "",
    horaFin: "",
    cantidadGuardias: 1,
    descripcion: "",
    prioridad: "normal",
    contactoSolicitante: "",
    aceptaCobroAdicional: false,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => portalPost("/portal/solicitudes-servicio", data),
    onSuccess: () => onCreated(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tipoSolicitud) {
      toast({ title: "Seleccione el tipo de servicio", variant: "destructive" });
      return;
    }
    if (!form.aceptaCobroAdicional) {
      toast({ title: "Debe confirmar que acepta el cobro adicional", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/7">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Nueva Solicitud de Servicio</h2>
              <p className="text-xs text-white/40">Complete los datos para enviar su solicitud</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {/* Tipo de servicio */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-2">
                Tipo de Servicio *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {TIPOS_SERVICIO.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set("tipoSolicitud", t.value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      form.tipoSolicitud === t.value
                        ? "border-primary/50 bg-primary/8 text-white"
                        : "border-white/7 bg-white/2 text-white/60 hover:border-white/15 hover:text-white/80"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.tipoSolicitud === t.value ? "border-primary" : "border-white/25"}`}>
                      {form.tipoSolicitud === t.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-[11px] text-white/40">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha y horario */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={form.fecha}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set("fecha", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">
                  Hora inicio
                </label>
                <input
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) => set("horaInicio", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">
                  Hora fin
                </label>
                <input
                  type="time"
                  value={form.horaFin}
                  onChange={(e) => set("horaFin", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {/* Cantidad y prioridad */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">
                  Guardias Solicitados
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.cantidadGuardias}
                  onChange={(e) => set("cantidadGuardias", Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">
                  Prioridad
                </label>
                <select
                  value={form.prioridad}
                  onChange={(e) => set("prioridad", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
                >
                  <option value="baja">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>

            {/* Contacto */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">
                Nombre y contacto del solicitante
              </label>
              <input
                type="text"
                value={form.contactoSolicitante}
                onChange={(e) => set("contactoSolicitante", e.target.value)}
                placeholder="Ej: Lic. García — 5000-0000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-1.5">
                Motivo o descripción del servicio
              </label>
              <textarea
                rows={3}
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
                placeholder="Describa el contexto, ubicación específica, requisitosdel servicio u otra información relevante..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>

            {/* Aceptación de cobro */}
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.aceptaCobroAdicional}
                  onChange={(e) => set("aceptaCobroAdicional", e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-yellow-400"
                />
                <div>
                  <p className="text-sm font-semibold text-white">Acepto el cobro adicional *</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    Entiendo que este servicio adicional generará un cargo en mi facturación según las tarifas vigentes de ISP, S.A.
                    El equipo comercial se comunicará para confirmar el monto.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/7">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-[#060e1c] text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Enviar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
