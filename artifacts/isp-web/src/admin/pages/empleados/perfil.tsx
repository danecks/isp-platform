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
import { FotoEmpleadoEditor, IgssSection, ContratosSection } from "./contratos";
import { DatosPersonalesSection } from "./datos-personales";
  
export function TabPerfil({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tiposCfg = [] } = useTiposPersonal();
  const [tipoEditing, setTipoEditing] = useState(false);
  const [tipoValue, setTipoValue] = useState(emp.tipoPersonal ?? "guardia");
  const [tipoSaving, setTipoSaving] = useState(false);

  async function saveTipo() {
    setTipoSaving(true);
    try {
      const r = await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ tipoPersonal: tipoValue }),
      });
      if (!r.ok) throw new Error("Error al guardar");
      toast({ title: "Tipo actualizado", description: `${emp.nombreCompleto} → ${tipoValue}` });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setTipoEditing(false);
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el tipo", variant: "destructive" });
    } finally {
      setTipoSaving(false);
    }
  }

  function Row({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string | null | undefined }) {
    if (!value || value === "—") return null;
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
        <Icon className="w-3.5 h-3.5 text-white/25 shrink-0" />
        <span className="text-xs text-white/40 w-36 shrink-0">{label}</span>
        <span className="text-sm text-white/80 flex-1 text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Foto del empleado */}
      <FotoEmpleadoEditor emp={emp} />

      {/* A — Datos personales */}
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Datos personales</p>
        <div className="space-y-0">
          <Row icon={Hash}      label="DPI"                value={emp.dpi ? maskDpi(emp.dpi) : null} />
          <Row icon={Phone}     label="Teléfono principal" value={emp.telefono} />
          <Row icon={Phone}     label="Teléfono secundario" value={emp.telefonoSecundario} />
          <Row icon={Mail}      label="Correo"             value={emp.correo} />
          <Row icon={MessageSquare} label="WhatsApp"       value={emp.waAutorizado ? "Autorizado" : null} />
          <Row icon={Building2} label="Área / Depto."      value={emp.area} />
          <Row icon={Calendar}  label="Fecha de ingreso"   value={fmtFecha(emp.fechaIngreso)} />
        </div>
        <DatosPersonalesSection emp={emp} />
      </div>

      {/* B — Datos laborales */}
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Datos laborales</p>

        {/* Tipo de personal — edición inline */}
        <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/30">Tipo de colaborador</p>
            {!tipoEditing && (
              <button onClick={() => setTipoEditing(true)} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-primary transition-colors">
                <Pencil className="w-3 h-3" /> Cambiar
              </button>
            )}
          </div>
          {!tipoEditing ? (
            <div className="mt-1">
              <TipoPersonalBadge tipo={emp.tipoPersonal ?? "guardia"} />
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={tipoValue}
                onChange={(e) => setTipoValue(e.target.value)}
                className="flex-1 bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 appearance-none"
              >
                {tiposCfg.filter(t => t.activo).map(t => (
                  <option key={t.clave} value={t.clave}>{t.label}</option>
                ))}
                {/* Conserva el valor actual aunque esté inactivo o ya no exista en el catálogo */}
                {tipoValue && !tiposCfg.some(t => t.clave === tipoValue) && (
                  <option value={tipoValue}>{tipoValue} (no catalogado)</option>
                )}
              </select>
              <button
                onClick={saveTipo}
                disabled={tipoSaving}
                className="flex items-center gap-1 text-xs bg-primary text-black font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {tipoSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
              <button onClick={() => setTipoEditing(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {emp.sueldoBase && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Sueldo base</p>
              <p className="text-sm font-semibold text-white">Q{Number(emp.sueldoBase).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.horasContrato && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Horas / semana</p>
              <p className="text-sm font-semibold text-white">{emp.horasContrato} h</p>
            </div>
          )}
          {emp.bonificacionIncentivo && Number(emp.bonificacionIncentivo) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bon. Incentivo</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacionIncentivo).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.bonificacion1 && Number(emp.bonificacion1) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bonificación 1</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacion1).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.bonificacion2 && Number(emp.bonificacion2) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bonificación 2</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacion2).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.bonificacion3 && Number(emp.bonificacion3) > 0 && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Bonificación 3</p>
              <p className="text-sm font-semibold text-emerald-400">Q{Number(emp.bonificacion3).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          {emp.tipoJornada && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Tipo de jornada</p>
              <p className="text-sm text-white/80 capitalize">{emp.tipoJornada}</p>
            </div>
          )}
          {emp.diaDescanso && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Día de descanso</p>
              <p className="text-sm text-white/80 capitalize">{emp.diaDescanso}</p>
            </div>
          )}
          <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <p className="text-[10px] text-white/30 mb-1">Frecuencia de pago</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              (emp.frecuenciaPago ?? "quincenal") === "mensual"
                ? "bg-violet-900/40 text-violet-300 border border-violet-700/40"
                : "bg-primary/15 text-primary border border-primary/30"
            }`}>
              {(emp.frecuenciaPago ?? "quincenal") === "mensual" ? "Mensual" : "Quincenal"}
            </span>
            <p className="text-[10px] text-white/25 mt-1">
              {(emp.frecuenciaPago ?? "quincenal") === "mensual"
                ? "Se paga una vez al mes (segunda quincena)"
                : "Se paga dos veces al mes (Q1 y Q2)"}
            </p>
          </div>
        </div>
      </div>

      {/* C — IGSS */}
      <IgssSection emp={emp} />

      {/* C2 — Contratos */}
      <ContratosSection empId={emp.id} />

      {/* D — Indicación a tab Asignación */}
      <div className="bg-[#0c1929] border border-primary/10 rounded-xl p-3 flex items-center gap-3">
        <MapPinned className="w-4 h-4 text-primary/50 shrink-0" />
        <p className="text-xs text-white/40">
          Cliente, puesto, sede, zona y supervisor — ver tab <span className="text-primary font-medium">Asignación</span>
        </p>
      </div>

      {/* D — Notas */}
      {emp.notas && (
        <div className="bg-[#0c1929] border border-white/8 rounded-lg p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notas internas</p>
          <p className="text-xs text-white/60 leading-relaxed">{emp.notas}</p>
        </div>
      )}
    </div>
  );
}

// ─── Áreas internas que requieren usuario obligatorio ────────────────────────

export const AREAS_INTERNAS = new Set([
  "administración", "administracion", "rrhh", "recursos humanos",
  "operaciones", "gerencia", "bodega", "comercial",
  "supervisión", "supervision", "facturación", "facturacion",
  "contabilidad", "compras", "sistemas", "legal",
]);

// ─── Modal rápido: Crear usuario para un colaborador ─────────────────────────
export function ModalCrearUsuarioColaborador({ emp, onClose, onCreated }: {
  emp: Empleado;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    nombre: emp.nombreCompleto,
    username: emp.nombreCompleto.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "").slice(0, 30),
    password: "", confirmPassword: "",
    rol: emp.area?.toLowerCase().includes("supervisor") ? "supervisor" as const
       : emp.area?.toLowerCase().includes("rrhh") || emp.area?.toLowerCase().includes("recursos") ? "rrhh" as const
       : emp.area?.toLowerCase().includes("comercial") ? "comercial" as const
       : "operaciones" as const,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    if (form.password.length < 4) { setError("Contraseña mínimo 4 caracteres"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSessionToken() },
        body: JSON.stringify({ nombre: form.nombre, username: form.username, password: form.password, rol: form.rol, employeeId: emp.id, estado: "activo" }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Error al crear usuario"); }
      toast({ title: "Usuario creado", description: `${form.nombre} ya tiene acceso al sistema.` });
      qc.invalidateQueries({ queryKey: ["employee-user", emp.id] });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold text-white">Crear usuario del sistema</h3>
            <p className="text-[10px] text-white/40 mt-0.5">{emp.nombreCompleto}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50">Nombre completo</label>
            <input value={form.nombre} onChange={e => set("nombre", e.target.value)} required
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Username *</label>
              <input value={form.username} onChange={e => set("username", e.target.value.toLowerCase())} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50 font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Rol</label>
              <select value={form.rol} onChange={e => set("rol", e.target.value)}
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none">
                <option value="operaciones">Operaciones</option>
                <option value="rrhh">RRHH</option>
                <option value="comercial">Comercial</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
                <option value="guardia">Guardia</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Contraseña *</label>
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50" placeholder="Mínimo 4 car." />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Confirmar *</label>
              <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50" placeholder="Repita" />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 flex items-center gap-1"><span>⚠</span>{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 border border-white/10 text-white/60 rounded-md text-xs hover:text-white">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 h-9 bg-primary text-[#050d1a] font-bold rounded-md text-xs hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Tab: Sistema ─────────────────────────────────────────────────────────────

export function TabSistema({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const [showCrearModal, setShowCrearModal] = useState(false);
  const { data: user, isLoading } = useQuery<UserVinculado | null>({
    queryKey: ["employee-user", emp.id],
    queryFn: () => fetch(`${API_BASE}/employees/${emp.id}/user`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const ROL_LABELS: Record<string, string> = {
    admin: "Administrador", operaciones: "Operaciones", rrhh: "RRHH",
    comercial: "Comercial", supervisor: "Supervisor", guardia: "Guardia", cliente: "Cliente",
  };

  const esAreaInterna = emp.area ? AREAS_INTERNAS.has(emp.area.toLowerCase()) : false;
  const requiereUsuario = esAreaInterna && emp.estadoLaboral === "activo";

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* IDs de sistema */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Identifiers</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Employee ID</span>
          <code className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">EMP-{emp.id}</code>
        </div>
        {emp.externalId && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">External ID</span>
            <code className="text-xs text-white/60 bg-white/5 px-2 py-0.5 rounded">{emp.externalId}</code>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Fuente</span>
          <span className="text-xs text-white/60">{emp.sourceSystem}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Sync status</span>
          <span className="text-xs text-white/60">{emp.syncStatus}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Actualizado</span>
          <span className="text-xs text-white/60">{fmtFecha(emp.updatedAt)}</span>
        </div>
      </div>

      {/* Usuario vinculado */}
      {/* Alerta: área interna sin usuario */}
      {requiereUsuario && !user && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-400">Inconsistencia: requiere usuario</p>
            <p className="text-[10px] text-amber-400/70 mt-1">
              Este colaborador está en el área <strong>{emp.area}</strong> — catalogada como interna obligatoria.
              Debe tener una cuenta de sistema activa.
            </p>
            <button
              onClick={() => setShowCrearModal(true)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg text-[11px] font-semibold hover:bg-amber-500/25 transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />
              Crear usuario ahora
            </button>
          </div>
        </div>
      )}

      {user ? (
        <div className="bg-[#0c1929] border border-green-500/15 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-green-400" />
              <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">Usuario vinculado</p>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
              user.estado === "activo"
                ? "text-green-400 bg-green-400/10 border-green-400/20"
                : "text-red-400 bg-red-400/10 border-red-400/20"
            }`}>{user.estado.toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Nombre</span>
            <span className="text-sm text-white/80">{user.nombre}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Username</span>
            <code className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">@{user.username}</code>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Rol</span>
            <span className="text-xs text-white/70">{ROL_LABELS[user.rol] ?? user.rol}</span>
          </div>
          {user.correo && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/40">Correo</span>
              <span className="text-xs text-white/60">{user.correo}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Cuenta creada</span>
            <span className="text-xs text-white/40">{fmtFecha(user.created_at)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl p-5 text-center">
          <Unlink className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm font-medium">Sin cuenta de sistema</p>
          {!requiereUsuario && (
            <p className="text-white/20 text-xs mt-1">
              Este colaborador no requiere usuario obligatorio según su área.
            </p>
          )}
          {!requiereUsuario && (
            <button
              onClick={() => setShowCrearModal(true)}
              className="mt-3 mx-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/50 rounded-lg text-xs hover:text-white hover:bg-white/8 transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />Crear usuario
            </button>
          )}
        </div>
      )}

      {/* Modal crear usuario */}
      {showCrearModal && (
        <ModalCrearUsuarioColaborador
          emp={emp}
          onClose={() => setShowCrearModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["employee-user", emp.id] })}
        />
      )}

      {/* Permisos WA */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">WhatsApp</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-white/40">Número autorizado</span>
          <span className={`text-xs font-semibold ${emp.waAutorizado ? "text-green-400" : "text-white/30"}`}>
            {emp.waAutorizado ? "Sí" : "No"}
          </span>
        </div>
        {emp.telefonoVerificadoAt && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Verificado</span>
            <span className="text-xs text-white/60">{fmtFecha(emp.telefonoVerificadoAt)}</span>
          </div>
        )}
        {emp.telefonoSecundario && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Tel. secundario</span>
            <span className="text-xs text-white/60">{emp.telefonoSecundario}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Operación ───────────────────────────────────────────────────────────

