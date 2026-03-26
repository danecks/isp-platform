import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { incidentsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { X, AlertTriangle, Loader2 } from "lucide-react";

const TIPOS_INCIDENCIA = [
  "Intrusión detectada",
  "Robo / Intento de robo",
  "Vandalismo",
  "Alerta médica",
  "Incendio / Emergencia",
  "Comportamiento sospechoso",
  "Falla en sistema de acceso",
  "Accidente de tránsito",
  "Conflicto entre personas",
  "Pérdida de material",
  "Otro",
];

interface FormState {
  cliente: string;
  tipo: string;
  tipoCustom: string;
  origen: string;
  ubicacion: string;
  prioridad: string;
  responsable: string;
  descripcion: string;
}

interface Props {
  onClose: () => void;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-white/50 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/50 focus:bg-white/7 transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

export function NuevaIncidenciaModal({ onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>({
    cliente: "",
    tipo: "",
    tipoCustom: "",
    origen: "manual",
    ubicacion: "",
    prioridad: "media",
    responsable: "",
    descripcion: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.cliente.trim()) errs.cliente = "El nombre del cliente es requerido";
    if (!form.tipo) errs.tipo = "Seleccione el tipo de incidencia";
    if (form.tipo === "Otro" && !form.tipoCustom.trim()) errs.tipoCustom = "Especifique el tipo de incidencia";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const mutation = useMutation({
    mutationFn: () =>
      incidentsApi.create({
        cliente: form.cliente.trim(),
        tipo: form.tipo === "Otro" ? form.tipoCustom.trim() : form.tipo,
        origen: form.origen,
        ubicacion: form.ubicacion.trim() || undefined,
        prioridad: form.prioridad,
        responsable: form.responsable.trim() || "Sin asignar",
        descripcion: form.descripcion.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast({
        title: "Incidencia registrada",
        description: "La incidencia fue creada y está disponible en la lista.",
      });
      onClose();
    },
    onError: (err: Error) => {
      toast({
        title: "Error al registrar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) mutation.mutate();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#0d1b2e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Registrar Nueva Incidencia</p>
              <p className="text-[10px] text-white/30">El ID se genera automáticamente al guardar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cliente / Cuenta" error={errors.cliente}>
              <input
                type="text"
                className={inputCls}
                placeholder="Nombre de la empresa o cuenta"
                value={form.cliente}
                onChange={(e) => set("cliente", e.target.value)}
              />
            </Field>

            <Field label="Tipo de Incidencia" error={errors.tipo}>
              <select
                className={selectCls}
                value={form.tipo}
                onChange={(e) => set("tipo", e.target.value)}
              >
                <option value="">— Seleccione el tipo —</option>
                {TIPOS_INCIDENCIA.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          {form.tipo === "Otro" && (
            <Field label="Especifique el tipo" error={errors.tipoCustom}>
              <input
                type="text"
                className={inputCls}
                placeholder="Describa brevemente el tipo de incidencia"
                value={form.tipoCustom}
                onChange={(e) => set("tipoCustom", e.target.value)}
                autoFocus
              />
            </Field>
          )}

          <Field label="Ubicación">
            <input
              type="text"
              className={inputCls}
              placeholder="Ej: Bodega Principal, Zona 12"
              value={form.ubicacion}
              onChange={(e) => set("ubicacion", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Origen">
              <select
                className={selectCls}
                value={form.origen}
                onChange={(e) => set("origen", e.target.value)}
              >
                <option value="manual">Manual (admin)</option>
                <option value="web">Formulario Web</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="llamada">Llamada Telefónica</option>
                <option value="portal">Portal de Clientes</option>
              </select>
            </Field>

            <Field label="Prioridad">
              <select
                className={selectCls}
                value={form.prioridad}
                onChange={(e) => set("prioridad", e.target.value)}
              >
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </Field>

            <Field label="Responsable Asignado">
              <input
                type="text"
                className={inputCls}
                placeholder="Nombre del supervisor"
                value={form.responsable}
                onChange={(e) => set("responsable", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Descripción / Notas Iniciales">
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              placeholder="Detalle lo sucedido, acciones tomadas o información relevante..."
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />
          </Field>

          {/* PRIORIDAD VISUAL HINT */}
          {(form.prioridad === "alta" || form.prioridad === "urgente") && (
            <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-[11px] text-red-400">
                Prioridad {form.prioridad.toUpperCase()} — Esta incidencia aparecerá destacada en la lista y en el dashboard.
              </p>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-[#0a1628] text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
              ) : (
                "Registrar Incidencia"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
