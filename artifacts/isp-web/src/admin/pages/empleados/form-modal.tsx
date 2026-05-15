import { useState, useEffect, useRef, type ElementType } from "react";
  import { QRCodeSVG } from "qrcode.react";
  import { createPortal } from "react-dom";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import {
    Users, Search, X, Loader2, RefreshCw,
    Building2, MapPin, Phone, Mail, Calendar, Hash,
    Shield, Briefcase, BarChart2, CheckSquare, Wallet,
    AlertTriangle, Zap, Activity, Clock, TrendingUp,
    UserCheck, BadgeCheck, Plus, Pencil, LayoutList,
    LayoutGrid, ChevronDown, UserX, UserCheck2, MessageSquare,
    Link2, Unlink, Lock, Save, Banknote, MessageCircle, XCircle,
    TrendingDown, Minus, ShieldAlert, ShieldCheck, ShieldOff,
    ArrowUpRight, ArrowDownRight, Repeat2, ArrowLeftRight, MapPinned, Map, History,
    UserCog, Sun, Umbrella, CheckCircle2, Info, ChevronRight, QrCode, Download,
    ClipboardList, FileText, Scale, FileSignature, Printer, Camera,
    CalendarClock, Trash2,
  } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { generarContratoLaboral, cargarPatronoDesdeConfig, type DatosContratoLaboral } from "@/lib/pdfRrhh";
  import { useDeleteMode } from "@/contexts/DeleteModeContext";
  import DescansoSemanalEditor from "../../components/DescansoSemanalEditor";
  import { getSessionToken } from "@/lib/httpClient";
  import {
    type Empleado, type KpiData, type Asignacion, type UserVinculado, type PuestoTitular, type HistorialRelevo,
    type OperacionData, type EventoKPIFront, type KPIDisciplinario, type MovimientoRotacion, type KPIRotacion,
    type FormState, type AsignacionOperativa, type TipoPersonalConfig,
    API_BASE, sessionHeader, iniciales, fmtFecha, fmtRelativa, fmtQ, maskDpi,
    ESTADO_LAB, AVATAR_COLORS, avatarColor, FORM_EMPTY, TIPO_PERSONAL_CFG,
    VALID_TIPOS_PERSONAL, useTiposPersonal, TipoPersonalBadge, EstadoBadge,
    KpiCard, ProgressBar,
  } from "./shared";
  
// ─── Modal: Formulario CRUD ───────────────────────────────────────────────────

export function FormModal({
  modo,
  emp,
  onClose,
  onSave,
}: {
  modo: "crear" | "editar";
  emp?: Empleado;
  onClose: () => void;
  onSave: (data: Partial<FormState>) => Promise<void>;
}) {
  const { data: tiposCfg = [] } = useTiposPersonal();
  const [form, setForm] = useState<FormState>(() => ({
    nombreCompleto: emp?.nombreCompleto ?? "",
    dpi: emp?.dpi ?? "",
    telefono: emp?.telefono ?? "",
    telefonoSecundario: emp?.telefonoSecundario ?? "",
    correo: emp?.correo ?? "",
    area: emp?.area ?? "",
    estadoLaboral: emp?.estadoLaboral ?? "activo",
    fechaIngreso: emp?.fechaIngreso ? emp.fechaIngreso.split("T")[0] : "",
    fechaNacimiento: emp?.fechaNacimiento ? String(emp.fechaNacimiento).split("T")[0] : "",
    notas: emp?.notas ?? "",
    sueldoBase: emp?.sueldoBase ?? "",
    tipoJornada: emp?.tipoJornada ?? "",
    diaDescanso: emp?.diaDescanso ?? "",
    horasContrato: emp?.horasContrato != null ? String(emp.horasContrato) : "",
    frecuenciaPago: emp?.frecuenciaPago ?? "quincenal",
    limiteAnticipo: emp?.limiteAnticipo != null ? String(emp.limiteAnticipo) : "",
    tipoLimitePeriodo: emp?.tipoLimitePeriodo ?? "quincenal",
    tipoPersonal: emp?.tipoPersonal ?? "guardia",
    bonificacionIncentivo: emp?.bonificacionIncentivo ?? "",
    bonificacion1:         emp?.bonificacion1 ?? "",
    bonificacion2:         emp?.bonificacion2 ?? "",
    bonificacion3:         emp?.bonificacion3 ?? "",
    banco:                 emp?.banco ?? "",
    cuentaBancaria:        emp?.cuentaBancaria ?? "",
    tipoCuenta:            emp?.tipoCuenta ?? "",
    formaPago:             emp?.formaPago ?? "cheque",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formScrollRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  function showError(msg: string) {
    setError(msg);
    toast({ title: "No se pudo guardar", description: msg, variant: "destructive" });
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.nombreCompleto.trim()) { showError("El nombre completo es requerido."); return; }
    if (!form.dpi.trim()) { showError("El DPI es requerido."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof FormState, type = "text", opts?: { placeholder?: string; required?: boolean }) => (
    <div className="space-y-1">
      <label className="text-xs text-white/50 font-medium">{label}{opts?.required && <span className="text-rose-400 ml-0.5">*</span>}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts?.placeholder ?? ""}
        className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/75 backdrop-blur-sm p-4 pt-8 overflow-auto">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h3 className="text-sm font-bold text-white">
            {modo === "crear" ? "Nuevo Colaborador" : "Editar Colaborador"}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formScrollRef} onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Datos personales */}
          <p className="text-[10px] text-white/30 uppercase tracking-widest">Datos personales</p>
          <div className="grid grid-cols-1 gap-3">
            {field("Nombre completo", "nombreCompleto", "text", { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("DPI", "dpi", "text", { placeholder: "Número de DPI", required: true })}
            {field("Fecha de nacimiento", "fechaNacimiento", "date")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Fecha de ingreso", "fechaIngreso", "date")}
            <div />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Teléfono principal", "telefono", "tel", { placeholder: "+502 XXXX XXXX" })}
            {field("Teléfono secundario", "telefonoSecundario", "tel", { placeholder: "+502 XXXX XXXX" })}
          </div>
          {field("Correo electrónico", "correo", "email", { placeholder: "correo@ejemplo.com" })}
          {field("Área / Departamento", "area", "text", { placeholder: "Ops, Administración…" })}

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Estado laboral</label>
            <select
              value={form.estadoLaboral}
              onChange={(e) => set("estadoLaboral", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="licencia">Licencia</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Datos laborales / nómina */}
          <p className="text-[10px] text-white/30 uppercase tracking-widest pt-2">Datos laborales</p>
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Tipo de personal</label>
            <select
              value={form.tipoPersonal}
              onChange={(e) => set("tipoPersonal", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              {tiposCfg.filter(t => t.activo).map(t => (
                <option key={t.clave} value={t.clave}>
                  {t.label}{t.descripcion ? ` — ${t.descripcion}` : ""}
                </option>
              ))}
              {/* Si el valor actual ya no existe en el catálogo (o está inactivo), lo conservamos como opción extra */}
              {form.tipoPersonal && !tiposCfg.some(t => t.clave === form.tipoPersonal) && (
                <option value={form.tipoPersonal}>{form.tipoPersonal} (no catalogado)</option>
              )}
            </select>
            <p className="text-[10px] text-white/30 pt-0.5">
              ¿Falta un tipo? Agregalo en <span className="text-white/50">Configuración → Usuarios → Tipos de Personal</span>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Sueldo base (Q)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sueldoBase}
                onChange={(e) => set("sueldoBase", e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Horas contrato / semana</label>
              <input
                type="number"
                min="1"
                max="84"
                step="1"
                value={form.horasContrato}
                onChange={(e) => set("horasContrato", e.target.value)}
                placeholder="48"
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          {/* Bonificaciones */}
          <div>
            <p className="text-xs text-white/40 font-medium mb-2">Bonificaciones (Q / mes)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bon. Incentivo (Dto. 78-89)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacionIncentivo}
                  onChange={(e) => set("bonificacionIncentivo", e.target.value)}
                  placeholder="250.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bonificación 1</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacion1}
                  onChange={(e) => set("bonificacion1", e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bonificación 2</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacion2}
                  onChange={(e) => set("bonificacion2", e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-white/40">Bonificación 3</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.bonificacion3}
                  onChange={(e) => set("bonificacion3", e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Frecuencia de pago</label>
            <select
              value={form.frecuenciaPago ?? "quincenal"}
              onChange={(e) => set("frecuenciaPago", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              <option value="quincenal">Quincenal — pago dos veces al mes (Q1 y Q2)</option>
              <option value="mensual">Mensual — pago una vez al mes (solo Q2)</option>
            </select>
            <p className="text-[10px] text-white/30 pt-0.5">Mensual: el colaborador solo aparece en la segunda quincena del mes.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Tipo de jornada</label>
              <select
                value={form.tipoJornada}
                onChange={(e) => set("tipoJornada", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin especificar —</option>
                <option value="completa">Completa</option>
                <option value="parcial">Parcial</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Día de descanso</label>
              <select
                value={form.diaDescanso}
                onChange={(e) => set("diaDescanso", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin especificar —</option>
                <option value="domingo">Domingo</option>
                <option value="lunes">Lunes</option>
                <option value="martes">Martes</option>
                <option value="miercoles">Miércoles</option>
                <option value="jueves">Jueves</option>
                <option value="viernes">Viernes</option>
                <option value="sabado">Sábado</option>
              </select>
            </div>
          </div>

          {emp?.id ? (
            <DescansoSemanalEditor employeeId={emp.id} diaDescansoDefault={form.diaDescanso} />
          ) : (
            <p className="text-[10px] text-white/30 italic">
              Guarda primero al colaborador para configurar descansos por semana.
            </p>
          )}

          {/* Banco / cuenta / forma de pago */}
          <p className="text-[10px] text-white/30 uppercase tracking-widest pt-2">Banco y forma de pago</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Banco</label>
              <select
                value={form.banco}
                onChange={(e) => set("banco", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin banco —</option>
                <option value="Banrural">Banrural</option>
                <option value="Banco Industrial">Banco Industrial</option>
                <option value="G&T Continental">G&amp;T Continental</option>
                <option value="BAC Credomatic">BAC Credomatic</option>
                <option value="Bantrab">Bantrab</option>
                <option value="Ficohsa">Ficohsa</option>
                <option value="BAM">BAM</option>
                <option value="Vivibanco">Vivibanco</option>
                {form.banco && !["Banrural","Banco Industrial","G&T Continental","BAC Credomatic","Bantrab","Ficohsa","BAM","Vivibanco"].includes(form.banco) && (
                  <option value={form.banco}>{form.banco}</option>
                )}
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Tipo de cuenta</label>
              <select
                value={form.tipoCuenta}
                onChange={(e) => set("tipoCuenta", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Sin especificar —</option>
                <option value="Monetaria (Cheques)">Monetaria (Cheques)</option>
                <option value="Ahorro">Ahorro</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Número de cuenta", "cuentaBancaria", "text", { placeholder: "Ej: 3-000-12345-6" })}
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Forma de pago</label>
              <select
                value={form.formaPago || "cheque"}
                onChange={(e) => set("formaPago", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="cheque">Cheque</option>
                <option value="deposito">Depósito a cuenta</option>
              </select>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={3}
              placeholder="Observaciones adicionales…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {modo === "crear" ? "Crear colaborador" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
