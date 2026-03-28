import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { incidentsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { X, AlertTriangle, Loader2, Siren } from "lucide-react";
import { ResponsableSelector } from "./ResponsableSelector";

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

const TIPOS_EMERGENCIA = [
  "Emergencia — Robo / Asalto",
  "Emergencia — Intrusión no autorizada",
  "Emergencia — Incidente armado",
  "Emergencia — Emergencia médica",
  "Emergencia — Incendio",
  "Emergencia — Evacuación",
  "Emergencia — Disturbio / Altercado",
  "Emergencia — Otro",
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
  esEmergencia: boolean;
  reportadoPor: string;
}

interface Props {
  onClose: () => void;
  defaultEmergencia?: boolean;
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
const emergInputCls = "w-full bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-red-400/50 transition-colors";
const emergSelectCls = `${emergInputCls} cursor-pointer`;

export function NuevaIncidenciaModal({ onClose, defaultEmergencia = false }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>({
    cliente: "",
    tipo: "",
    tipoCustom: "",
    origen: defaultEmergencia ? "manual" : "manual",
    ubicacion: "",
    prioridad: defaultEmergencia ? "urgente" : "media",
    responsable: "",
    descripcion: "",
    esEmergencia: defaultEmergencia,
    reportadoPor: "",
  });

  const [responsableId, setResponsableId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set(field: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field as keyof FormState]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function toggleEmergencia() {
    setForm((f) => ({
      ...f,
      esEmergencia: !f.esEmergencia,
      prioridad: !f.esEmergencia ? "urgente" : "media",
      tipo: "",
    }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.cliente.trim()) errs.cliente = "El nombre del cliente es requerido";
    if (!form.tipo) errs.tipo = "Seleccione el tipo de incidencia";
    if (form.tipo === "Otro" && !form.tipoCustom.trim()) errs.tipoCustom = "Especifique el tipo de incidencia";
    if (form.esEmergencia && !form.reportadoPor.trim()) errs.reportadoPor = "Indique quién reporta la emergencia";
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
        responsableId: responsableId ?? undefined,
        descripcion: form.descripcion.trim() || undefined,
        esEmergencia: form.esEmergencia,
        reportadoPor: form.esEmergencia ? form.reportadoPor.trim() : undefined,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast({
        title: form.esEmergencia ? "Emergencia registrada" : "Incidencia registrada",
        description: form.esEmergencia
          ? "La emergencia fue creada con prioridad URGENTE y está visible en la lista."
          : "La incidencia fue creada y está disponible en la lista.",
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

  const isEmerg = form.esEmergencia;
  const borderColor = isEmerg ? "border-red-500/30" : "border-white/10";
  const headerBg = isEmerg ? "bg-red-500/10 border-red-500/20" : "bg-red-500/15";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className={`bg-[#0d1b2e] border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl ${borderColor}`}>

        {/* HEADER */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${isEmerg ? "border-red-500/20 bg-red-500/5" : "border-white/8"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEmerg ? "bg-red-500/20" : "bg-red-500/15"}`}>
              {isEmerg
                ? <Siren className="w-4 h-4 text-red-400" />
                : <AlertTriangle className="w-4 h-4 text-red-400" />
              }
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {isEmerg ? "Registrar Emergencia" : "Registrar Nueva Incidencia"}
              </p>
              <p className="text-[10px] text-white/30">
                {isEmerg
                  ? "Se creará con prioridad URGENTE y badge de emergencia"
                  : "El ID se genera automáticamente al guardar"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>

        {/* TOGGLE EMERGENCIA */}
        <div className="px-6 pt-5">
          <button
            type="button"
            onClick={toggleEmergencia}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-left ${
              isEmerg
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-white/3 border-white/8 text-white/40 hover:border-white/15"
            }`}
          >
            <div className={`w-8 h-4 rounded-full relative transition-colors flex-shrink-0 ${isEmerg ? "bg-red-500" : "bg-white/15"}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isEmerg ? "left-4.5" : "left-0.5"}`} />
            </div>
            <div>
              <p className="text-[11px] font-semibold">
                {isEmerg ? "Modo emergencia activado" : "Marcar como emergencia"}
              </p>
              <p className="text-[9px] opacity-60 mt-0.5">
                {isEmerg
                  ? "Prioridad urgente, badge visible en dashboard"
                  : "Activar para eventos críticos: robo, intrusión, violencia"}
              </p>
            </div>
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* CAMPOS DE EMERGENCIA EXTRA */}
          {isEmerg && (
            <Field label="Reportado por" error={errors.reportadoPor}>
              <input
                type="text"
                className={emergInputCls}
                placeholder="Nombre, teléfono o puesto del reportante"
                value={form.reportadoPor}
                onChange={(e) => set("reportadoPor", e.target.value)}
                autoFocus
              />
            </Field>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cliente / Cuenta" error={errors.cliente}>
              <input
                type="text"
                className={isEmerg ? emergInputCls : inputCls}
                placeholder="Nombre de la empresa o cuenta"
                value={form.cliente}
                onChange={(e) => set("cliente", e.target.value)}
              />
            </Field>

            <Field label={isEmerg ? "Tipo de Emergencia" : "Tipo de Incidencia"} error={errors.tipo}>
              <select
                data-testid="select-tipo"
                className={isEmerg ? emergSelectCls : selectCls}
                value={form.tipo}
                onChange={(e) => set("tipo", e.target.value)}
              >
                <option value="">— Seleccione el tipo —</option>
                {(isEmerg ? TIPOS_EMERGENCIA : TIPOS_INCIDENCIA).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          {!isEmerg && form.tipo === "Otro" && (
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
              className={isEmerg ? emergInputCls : inputCls}
              placeholder="Ej: Puerta Principal — Planta Gallo Zona 12"
              value={form.ubicacion}
              onChange={(e) => set("ubicacion", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Origen">
              <select
                className={isEmerg ? emergSelectCls : selectCls}
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
                className={isEmerg ? emergSelectCls : selectCls}
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
              <ResponsableSelector
                value={form.responsable}
                onChange={(v) => set("responsable", v)}
                onChangeWithId={(_nombre, id) => setResponsableId(id)}
                inputCls={isEmerg ? emergInputCls : inputCls}
                placeholder="Buscar supervisor, jefe o administrador…"
              />
            </Field>
          </div>

          <Field label="Descripción / Notas Iniciales">
            <textarea
              className={`${isEmerg ? emergInputCls : inputCls} resize-none`}
              rows={4}
              placeholder={
                isEmerg
                  ? "Describa brevemente la situación de emergencia, personas involucradas, estado actual..."
                  : "Detalle lo sucedido, acciones tomadas o información relevante..."
              }
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />
          </Field>

          {/* PRIORIDAD VISUAL HINT */}
          {isEmerg && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3">
              <Siren className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-red-300 font-semibold mb-0.5">Emergencia — Atención inmediata</p>
                <p className="text-[10px] text-red-400/70">
                  Esta incidencia aparecerá con badge rojo pulsante en el panel. Si hay peligro inmediato, contacte también al 110 (PNC) o 122 (Bomberos).
                </p>
              </div>
            </div>
          )}
          {!isEmerg && (form.prioridad === "alta" || form.prioridad === "urgente") && (
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
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-60 ${
                isEmerg
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-primary hover:bg-primary/90 text-[#0a1628]"
              }`}
            >
              {mutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
              ) : isEmerg ? (
                <><Siren className="w-3.5 h-3.5" /> Registrar Emergencia</>
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
