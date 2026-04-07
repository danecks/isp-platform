import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCog, Plus, Search, Pencil, KeyRound, Power, PowerOff,
  X, Check, AlertCircle, Loader2, ShieldCheck, Mail, Phone,
  User, Lock, ChevronDown, MessageSquare, Zap, Wallet, Shield,
  Info, Building, UserCheck, ShieldAlert, HardHat,
} from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi, type UserSafe } from "@/lib/api";
import { ROL_LABELS, ROL_COLORES } from "@/config/permissions";
import { useToast } from "@/hooks/use-toast";
import { RolesTab } from "./tabs/RolesTab";
import { TiposPersonalTab } from "./tabs/TiposPersonalTab";

type Rol = "admin" | "operaciones" | "rrhh" | "comercial" | "supervisor" | "guardia" | "cliente";
const ROLES: Rol[] = ["admin", "operaciones", "rrhh", "comercial", "supervisor", "guardia", "cliente"];

// Roles que pueden usar el panel admin (no solo WhatsApp)
const ROLES_ADMIN: Rol[] = ["admin", "operaciones", "rrhh", "comercial", "supervisor"];

// ─── RolBadge ──────────────────────────────────────────────────────────────────
function RolBadge({ rol }: { rol: string }) {
  const color = ROL_COLORES[rol as Rol] ?? "text-white/50 bg-white/5 border-white/10";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${color}`}>
      {ROL_LABELS[rol as Rol] ?? rol}
    </span>
  );
}

// ─── EstadoBadge ───────────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const active = estado === "activo";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
      active
        ? "text-green-400 bg-green-400/10 border-green-400/20"
        : "text-red-400 bg-red-400/10 border-red-400/20"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-400" : "bg-red-400"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ─── PermisoBadge ──────────────────────────────────────────────────────────────
function PermisoBadge({ activo, label }: { activo: boolean | null; label: string }) {
  if (!activo) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/15 border border-primary/20 text-primary">
      <Check className="w-2.5 h-2.5" />{label}
    </span>
  );
}

// ─── PermToggle ─────────────────────────────────────────────────────────────────
function PermToggle({
  value, onChange, label, description, icon: Icon,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  icon: React.ElementType;
}) {
  const on = value === true;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex items-start gap-3 w-full rounded-xl p-3.5 border transition-all text-left ${
        on
          ? "bg-primary/10 border-primary/30"
          : "bg-[#060e1c] border-white/8 hover:border-white/15"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        on ? "bg-primary/20" : "bg-white/5"
      }`}>
        <Icon className={`w-4 h-4 ${on ? "text-primary" : "text-white/30"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold leading-none mb-1 ${on ? "text-white" : "text-white/60"}`}>{label}</p>
        <p className="text-[10px] text-white/30 leading-relaxed">{description}</p>
      </div>
      <div className={`w-9 h-5 rounded-full transition-all shrink-0 mt-1.5 relative ${
        on ? "bg-primary" : "bg-white/15"
      }`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
          on ? "left-4" : "left-0.5"
        }`} />
      </div>
    </button>
  );
}

// ─── NuevoUsuarioModal ─────────────────────────────────────────────────────────
interface NuevoModalProps {
  onClose: () => void;
  onCreated: () => void;
}
function NuevoUsuarioModal({ onClose, onCreated }: NuevoModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    nombre: "", username: "", correo: "", password: "", confirmPassword: "",
    rol: "guardia" as Rol,
    telefono: "", clienteId: "", employeeId: "",
    canReportEmergency: false,
    canRequestAdvance: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const set = (key: string, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

  async function checkUsername(username: string) {
    if (!username.trim()) return;
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${BASE}/api/users/check?username=${encodeURIComponent(username.trim())}`);
      if (!res.ok) return;
      const data = await res.json();
      setUsernameError(data.available ? "" : "Este nombre de usuario ya está registrado");
    } catch {
      // ignorar errores de red en la verificación preventiva
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (usernameError) {
      setError(usernameError);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres");
      return;
    }
    setLoading(true);
    try {
      await usersApi.create({
        nombre: form.nombre,
        username: form.username.toLowerCase(),
        correo: form.correo || undefined,
        password: form.password,
        rol: form.rol,
        telefono: form.telefono || undefined,
        clienteId: form.clienteId || undefined,
        employeeId: form.employeeId ? parseInt(form.employeeId) : null,
        canReportEmergency: form.canReportEmergency || null,
        canRequestAdvance: form.canRequestAdvance || null,
      });
      toast({ title: "Usuario creado", description: `${form.nombre} registrado en el sistema.` });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  const esGuardiaOCliente = form.rol === "guardia" || form.rol === "cliente";
  const esCliente = form.rol === "cliente";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#07111f] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Nuevo Usuario</h2>
              <p className="text-[11px] text-muted-foreground">Registrar acceso al sistema</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 font-medium">Nombre completo *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                value={form.nombre}
                onChange={e => set("nombre", e.target.value)}
                placeholder="Carlos López Pérez"
                className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                required
              />
            </div>
          </div>

          {/* Username + Rol */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Username *</Label>
              <Input
                value={form.username}
                onChange={e => { set("username", e.target.value.toLowerCase()); setUsernameError(""); }}
                onBlur={e => checkUsername(e.target.value)}
                placeholder="carlos.lopez"
                className={`bg-[#060e1c] border-white/10 text-white text-sm h-10 ${usernameError ? "border-red-500/60" : ""}`}
                required
              />
              {usernameError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                  <span>⚠</span> {usernameError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Rol *</Label>
              <div className="relative">
                <select
                  value={form.rol}
                  onChange={e => set("rol", e.target.value)}
                  className="w-full h-10 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 appearance-none pr-8 focus:outline-none focus:border-primary/50"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROL_LABELS[r]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* WhatsApp Identity */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-green-400" />
              <Label className="text-xs text-white/60 font-medium">Teléfono / Identidad WhatsApp</Label>
              {esGuardiaOCliente && <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-semibold">RECOMENDADO</span>}
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                value={form.telefono}
                onChange={e => set("telefono", e.target.value)}
                placeholder="50212345678"
                className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10 font-mono"
              />
            </div>
            <p className="text-[10px] text-white/30 flex items-start gap-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              Formato internacional sin '+': código país + número. Guatemala: 502XXXXXXXX. Este número es la identidad del usuario en WhatsApp. Debe ser único.
            </p>
          </div>

          {/* Correo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 font-medium">Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                type="email"
                value={form.correo}
                onChange={e => set("correo", e.target.value)}
                placeholder="correo@empresa.gt"
                className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
              />
            </div>
          </div>

          {/* ClienteId (rol cliente) / EmployeeId (rol guardia/supervisor) */}
          {esCliente && (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">ID de Cliente del Portal</Label>
              <Input
                value={form.clienteId}
                onChange={e => set("clienteId", e.target.value)}
                placeholder="CLI-001"
                className="bg-[#060e1c] border-white/10 text-white text-sm h-10 font-mono"
              />
              <p className="text-[10px] text-white/30">Debe coincidir con el portal_cliente_id del cliente registrado.</p>
            </div>
          )}

          {(form.rol === "guardia" || form.rol === "supervisor" || form.rol === "operaciones") && (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">ID de Empleado (opcional)</Label>
              <Input
                value={form.employeeId}
                onChange={e => set("employeeId", e.target.value)}
                placeholder="ID numérico del empleado en el sistema"
                className="bg-[#060e1c] border-white/10 text-white text-sm h-10 font-mono"
                type="number"
              />
              <p className="text-[10px] text-white/30">Vincula este usuario a un registro de empleado para anticipos y asignaciones.</p>
            </div>
          )}

          {/* Permisos WhatsApp */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-white/40" />
              <Label className="text-xs text-white/60 font-medium">Permisos especiales vía WhatsApp</Label>
            </div>
            <PermToggle
              value={form.canReportEmergency}
              onChange={v => set("canReportEmergency", v)}
              label="Puede reportar emergencias"
              description="Permite activar el protocolo de emergencia desde WhatsApp. Solo para personal de campo autorizado."
              icon={Zap}
            />
            <PermToggle
              value={form.canRequestAdvance}
              onChange={v => set("canRequestAdvance", v)}
              label="Puede solicitar anticipos"
              description="Permite iniciar una solicitud de anticipo de nómina vía WhatsApp."
              icon={Wallet}
            />
          </div>

          {/* Contraseña */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Contraseña *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Confirmar *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => set("confirmPassword", e.target.value)}
                  placeholder="Repita contraseña"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-white/60 hover:text-white h-10">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-10"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Usuario"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── EditarUsuarioModal ────────────────────────────────────────────────────────
interface EditarModalProps {
  user: UserSafe;
  onClose: () => void;
  onUpdated: () => void;
}
function EditarUsuarioModal({ user, onClose, onUpdated }: EditarModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"datos" | "permisos" | "password">("datos");
  const [form, setForm] = useState({
    nombre: user.nombre,
    correo: user.correo ?? "",
    rol: user.rol as Rol,
    estado: user.estado,
    telefono: user.telefono ?? "",
    clienteId: user.clienteId ?? "",
    employeeId: user.employeeId ? String(user.employeeId) : "",
    canReportEmergency: user.canReportEmergency ?? false,
    canRequestAdvance: user.canRequestAdvance ?? false,
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

  const handleDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await usersApi.update(user.id, {
        nombre: form.nombre,
        correo: form.correo || undefined,
        rol: form.rol,
        estado: form.estado,
        telefono: form.telefono || undefined,
        clienteId: form.clienteId || undefined,
        employeeId: form.employeeId ? parseInt(form.employeeId) : null,
      });
      toast({ title: "Usuario actualizado", description: `${form.nombre} ha sido actualizado.` });
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  const handlePermisos = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await usersApi.update(user.id, {
        canReportEmergency: form.canReportEmergency || null,
        canRequestAdvance: form.canRequestAdvance || null,
      });
      toast({ title: "Permisos actualizados", description: `Los permisos de ${user.nombre} fueron guardados.` });
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Error al actualizar permisos");
    } finally {
      setLoading(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 4) {
      setError("Mínimo 4 caracteres");
      return;
    }
    setLoading(true);
    try {
      await usersApi.update(user.id, { password: newPassword });
      toast({ title: "Contraseña actualizada", description: `La contraseña de ${user.nombre} fue cambiada.` });
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Error al actualizar contraseña");
    } finally {
      setLoading(false);
    }
  };

  const esCliente = form.rol === "cliente";
  const tieneEmpleado = form.rol === "guardia" || form.rol === "supervisor" || form.rol === "operaciones";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#07111f] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Usuario</h2>
              <p className="text-[11px] text-muted-foreground">{user.username} · <RolBadge rol={user.rol} /></p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {(["datos", "permisos", "password"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                tab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "datos" ? "Datos & Rol" : t === "permisos" ? "Permisos WA" : "Contraseña"}
            </button>
          ))}
        </div>

        {tab === "datos" && (
          <form onSubmit={handleDatos} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Nombre completo *</Label>
              <Input
                value={form.nombre}
                onChange={e => set("nombre", e.target.value)}
                className="bg-[#060e1c] border-white/10 text-white text-sm h-10"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60 font-medium">Rol *</Label>
                <div className="relative">
                  <select
                    value={form.rol}
                    onChange={e => set("rol", e.target.value)}
                    className="w-full h-10 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 appearance-none pr-8 focus:outline-none focus:border-primary/50"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROL_LABELS[r]}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60 font-medium">Estado</Label>
                <div className="relative">
                  <select
                    value={form.estado}
                    onChange={e => set("estado", e.target.value)}
                    className="w-full h-10 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 appearance-none pr-8 focus:outline-none focus:border-primary/50"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* WhatsApp Phone */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-green-400" />
                <Label className="text-xs text-white/60 font-medium">Teléfono / Identidad WhatsApp</Label>
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  value={form.telefono}
                  onChange={e => set("telefono", e.target.value)}
                  placeholder="50212345678"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10 font-mono"
                />
              </div>
              <p className="text-[10px] text-white/30">Formato: código país + número sin '+'. Guatemala: 502XXXXXXXX. Debe ser único.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Correo electrónico</Label>
              <Input
                type="email"
                value={form.correo}
                onChange={e => set("correo", e.target.value)}
                className="bg-[#060e1c] border-white/10 text-white text-sm h-10"
              />
            </div>

            {esCliente && (
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60 font-medium">ID Cliente del Portal</Label>
                <Input
                  value={form.clienteId}
                  onChange={e => set("clienteId", e.target.value)}
                  placeholder="CLI-XXX"
                  className="bg-[#060e1c] border-white/10 text-white text-sm h-10 font-mono"
                />
              </div>
            )}

            {tieneEmpleado && (
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60 font-medium">ID de Empleado</Label>
                <Input
                  value={form.employeeId}
                  onChange={e => set("employeeId", e.target.value)}
                  placeholder="ID numérico"
                  className="bg-[#060e1c] border-white/10 text-white text-sm h-10 font-mono"
                  type="number"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-white/60 hover:text-white h-10">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        )}

        {tab === "permisos" && (
          <form onSubmit={handlePermisos} className="p-6 space-y-4">
            <div className="bg-[#060e1c] border border-white/8 rounded-xl px-4 py-3 flex items-start gap-2 mb-2">
              <Info className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
              <p className="text-xs text-white/40 leading-relaxed">
                Estos permisos controlan qué acciones puede realizar <strong className="text-white/60">{user.nombre}</strong> a través de WhatsApp.
                No afectan el acceso al panel de administración.
              </p>
            </div>

            <PermToggle
              value={form.canReportEmergency}
              onChange={v => set("canReportEmergency", v)}
              label="Puede reportar emergencias"
              description="Permite activar el protocolo de emergencia desde WhatsApp. El sistema crea una alerta con prioridad máxima."
              icon={Zap}
            />
            <PermToggle
              value={form.canRequestAdvance}
              onChange={v => set("canRequestAdvance", v)}
              label="Puede solicitar anticipos"
              description="Permite al usuario iniciar una solicitud de anticipo de nómina escribiendo al bot de WhatsApp."
              icon={Wallet}
            />

            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-white/60 hover:text-white h-10">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Permisos"}
              </Button>
            </div>
          </form>
        )}

        {tab === "password" && (
          <form onSubmit={handlePassword} className="p-6 space-y-4">
            <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-lg px-4 py-3 flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-400/80">
                Establecer nueva contraseña para <strong>{user.nombre}</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Nueva contraseña *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Confirmar contraseña *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita la contraseña"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-white/60 hover:text-white h-10">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-yellow-500 text-black font-bold hover:bg-yellow-400 h-10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cambiar Contraseña"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
interface Inconsistencia {
  empleadosSinUsuario: Array<{ id: number; nombre_completo: string; area: string; puesto: string; estado_laboral: string }>;
  clientesSinUsuario: Array<{ id: number; nombre: string; nombre_comercial: string | null; portal_cliente_id: string }>;
  totalInconsistencias: number;
}

type TabId = "usuarios" | "roles" | "tipos_personal";

export default function AdminUsuarios() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>("usuarios");
  const [search, setSearch] = useState("");
  const [rolFiltro, setRolFiltro] = useState<string>("todos");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  const [showNuevo, setShowNuevo] = useState(false);
  const [editUser, setEditUser] = useState<UserSafe | null>(null);
  const [showInconsistencias, setShowInconsistencias] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
    refetchInterval: 30_000,
  });

  const { data: inconsistencias } = useQuery<Inconsistencia>({
    queryKey: ["users-inconsistencias"],
    queryFn: async () => {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${BASE}/api/users/inconsistencias`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const toggleEstado = useMutation({
    mutationFn: (u: UserSafe) =>
      usersApi.update(u.id, { estado: u.estado === "activo" ? "inactivo" : "activo" }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: updated.estado === "activo" ? "Usuario activado" : "Usuario desactivado",
        description: `${updated.nombre} fue ${updated.estado === "activo" ? "activado" : "desactivado"}.`,
      });
    },
  });

  const filtered = users.filter(u => {
    const matchSearch =
      u.nombre.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.correo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.telefono ?? "").includes(search);
    const matchRol = rolFiltro === "todos" || u.rol === rolFiltro;
    const matchEstado = estadoFiltro === "todos" || u.estado === estadoFiltro;
    return matchSearch && matchRol && matchEstado;
  });

  const counts = {
    total: users.length,
    activos: users.filter(u => u.estado === "activo").length,
    inactivos: users.filter(u => u.estado === "inactivo").length,
    clientes: users.filter(u => u.rol === "cliente").length,
    internos: users.filter(u => ["admin","operaciones","rrhh","comercial","supervisor"].includes(u.rol)).length,
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "usuarios",       label: "Usuarios",         icon: UserCog },
    { id: "roles",          label: "Roles & Módulos",  icon: ShieldAlert },
    { id: "tipos_personal", label: "Tipos de Personal",icon: HardHat },
  ];

  return (
    <AdminLayout title="Usuarios del Sistema">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <UserCog className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-white">Gestión de Usuarios</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Control de acceso, roles, módulos y tipos de personal
            </p>
          </div>
          {tab === "usuarios" && (
            <Button
              onClick={() => setShowNuevo(true)}
              className="bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-10 px-5 gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </Button>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-[#060e1c] border border-white/8 rounded-xl p-1 w-fit">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t.id
                    ? "bg-primary text-[#050d1a]"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ─── Tab: Roles & Módulos ────────────────────────────────────────────── */}
        {tab === "roles" && <RolesTab />}

        {/* ─── Tab: Tipos de Personal ──────────────────────────────────────────── */}
        {tab === "tipos_personal" && <TiposPersonalTab />}

        {/* ─── Tab: Usuarios ───────────────────────────────────────────────────── */}
        {tab === "usuarios" && <>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: counts.total, color: "text-white" },
            { label: "Activos", value: counts.activos, color: "text-green-400" },
            { label: "Internos", value: counts.internos, color: "text-blue-400" },
            { label: "Portal cliente", value: counts.clientes, color: "text-primary" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-white/5 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Inconsistencias card */}
        {inconsistencias && inconsistencias.totalInconsistencias > 0 && (
          <div className="bg-amber-950/20 border border-amber-500/25 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowInconsistencias(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-amber-500/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-amber-400">
                    {inconsistencias.totalInconsistencias} inconsistencia{inconsistencias.totalInconsistencias !== 1 ? "s" : ""} detectada{inconsistencias.totalInconsistencias !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[10px] text-amber-400/60 mt-0.5">
                    {inconsistencias.empleadosSinUsuario.length > 0 && `${inconsistencias.empleadosSinUsuario.length} colaborador(es) interno(s) sin usuario`}
                    {inconsistencias.empleadosSinUsuario.length > 0 && inconsistencias.clientesSinUsuario.length > 0 && " · "}
                    {inconsistencias.clientesSinUsuario.length > 0 && `${inconsistencias.clientesSinUsuario.length} cliente(s) sin acceso al portal`}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-amber-400/60 transition-transform ${showInconsistencias ? "rotate-180" : ""}`} />
            </button>
            {showInconsistencias && (
              <div className="px-5 pb-4 space-y-3">
                {inconsistencias.empleadosSinUsuario.length > 0 && (
                  <div>
                    <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-2 font-semibold">Colaboradores internos sin usuario</p>
                    <div className="space-y-1.5">
                      {inconsistencias.empleadosSinUsuario.map(e => (
                        <div key={e.id} className="flex items-center justify-between bg-amber-950/30 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs text-white/80 font-medium">{e.nombre_completo}</p>
                            <p className="text-[10px] text-white/40">{e.area} · {e.puesto || "—"}</p>
                          </div>
                          <span className="text-[9px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">Sin usuario</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {inconsistencias.clientesSinUsuario.length > 0 && (
                  <div>
                    <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-2 font-semibold">Clientes sin acceso al portal</p>
                    <div className="space-y-1.5">
                      {inconsistencias.clientesSinUsuario.map(c => (
                        <div key={c.id} className="flex items-center justify-between bg-amber-950/30 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs text-white/80 font-medium">{c.nombre_comercial || c.nombre}</p>
                            <p className="text-[10px] text-white/40">Portal ID: {c.portal_cliente_id}</p>
                          </div>
                          <span className="text-[9px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">Sin usuarios</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, username, correo o teléfono..."
              className="pl-9 bg-card border-white/10 text-white text-sm h-10"
            />
          </div>
          <div className="relative">
            <select
              value={rolFiltro}
              onChange={e => setRolFiltro(e.target.value)}
              className="h-10 bg-card border border-white/10 text-white text-sm rounded-md px-3 pr-8 appearance-none focus:outline-none focus:border-primary/50 min-w-[140px]"
            >
              <option value="todos">Todos los roles</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{ROL_LABELS[r]}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={estadoFiltro}
              onChange={e => setEstadoFiltro(e.target.value)}
              className="h-10 bg-card border border-white/10 text-white text-sm rounded-md px-3 pr-8 appearance-none focus:outline-none focus:border-primary/50 min-w-[130px]"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-5 py-3">Usuario</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3">Rol</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3 hidden xl:table-cell">Vinculación</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3 hidden lg:table-cell">WhatsApp</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3">Estado</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-white/30">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-white/30">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => (
                    <tr
                      key={u.id}
                      className="border-b border-white/3 hover:bg-white/2 transition-colors"
                    >
                      {/* Usuario */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-primary text-xs font-bold">
                              {u.nombre.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm leading-none mb-0.5">{u.nombre}</p>
                            <p className="text-white/40 text-xs">{u.username}</p>
                          </div>
                        </div>
                      </td>
                      {/* Rol */}
                      <td className="px-4 py-3.5">
                        <RolBadge rol={u.rol} />
                      </td>
                      {/* Vinculación */}
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        {u.employeeId ? (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3 h-3 text-blue-400" />
                            <span className="text-blue-400/80 text-xs">Empleado #{u.employeeId}</span>
                          </div>
                        ) : u.clienteId ? (
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3 h-3 text-primary" />
                            <span className="text-primary/80 text-xs font-mono">{u.clienteId}</span>
                          </div>
                        ) : (
                          <span className="text-white/20 text-xs">—</span>
                        )}
                      </td>
                      {/* WhatsApp */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {u.telefono ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-green-400/15 flex items-center justify-center">
                              <MessageSquare className="w-2.5 h-2.5 text-green-400" />
                            </div>
                            <span className="text-white/60 text-xs font-mono">+{u.telefono}</span>
                          </div>
                        ) : (
                          <span className="text-white/20 text-xs flex items-center gap-1">
                            <X className="w-3 h-3" /> Sin número
                          </span>
                        )}
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3.5">
                        <EstadoBadge estado={u.estado} />
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditUser(u)}
                            title="Editar usuario"
                            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleEstado.mutate(u)}
                            title={u.estado === "activo" ? "Desactivar" : "Activar"}
                            className={`p-1.5 rounded-lg transition-all ${
                              u.estado === "activo"
                                ? "text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
                                : "text-green-400/60 hover:text-green-400 hover:bg-green-400/10"
                            }`}
                          >
                            {u.estado === "activo" ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 text-xs text-white/30">
              Mostrando {filtered.length} de {users.length} usuarios
            </div>
          )}
        </div>

        {/* Role reference table */}
        <div className="bg-card border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Referencia de Permisos por Rol
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-white/30 font-medium pb-2 pr-4">Módulo / Capacidad</th>
                  {ROLES_ADMIN.map(r => (
                    <th key={r} className="text-center pb-2 px-2">
                      <RolBadge rol={r} />
                    </th>
                  ))}
                  <th className="text-center pb-2 px-2"><RolBadge rol="guardia" /></th>
                  <th className="text-center pb-2 px-2"><RolBadge rol="cliente" /></th>
                </tr>
              </thead>
              <tbody>
                {[
                  { mod: "Panel admin",        admin: true,  operaciones: true,  rrhh: true,  comercial: true,  supervisor: true,  guardia: false, cliente: false },
                  { mod: "Incidencias",        admin: true,  operaciones: true,  rrhh: false, comercial: false, supervisor: true,  guardia: false, cliente: false },
                  { mod: "Tareas",             admin: true,  operaciones: true,  rrhh: false, comercial: false, supervisor: true,  guardia: false, cliente: false },
                  { mod: "Reclutamiento",      admin: true,  operaciones: false, rrhh: true,  comercial: false, supervisor: false, guardia: false, cliente: false },
                  { mod: "Anticipos (panel)",  admin: true,  operaciones: false, rrhh: true,  comercial: false, supervisor: false, guardia: false, cliente: false },
                  { mod: "Comercial / Leads",  admin: true,  operaciones: false, rrhh: false, comercial: true,  supervisor: false, guardia: false, cliente: false },
                  { mod: "KPI Ejecutivo",      admin: true,  operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: false, cliente: false },
                  { mod: "Usuarios",           admin: true,  operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: false, cliente: false },
                  { mod: "Portal de cliente",  admin: false, operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: false, cliente: true  },
                  { mod: "WhatsApp (reportar)", admin: true, operaciones: true,  rrhh: false, comercial: false, supervisor: true,  guardia: "permiso", cliente: false },
                  { mod: "WhatsApp (anticipo)", admin: true, operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: "permiso", cliente: false },
                ].map(row => (
                  <tr key={row.mod} className="border-b border-white/3 hover:bg-white/1">
                    <td className="py-2 pr-4 text-white/60">{row.mod}</td>
                    {(["admin", "operaciones", "rrhh", "comercial", "supervisor", "guardia", "cliente"] as const).map(r => (
                      <td key={r} className="text-center py-2 px-2">
                        {row[r] === true ? (
                          <Check className="w-3.5 h-3.5 text-green-400 mx-auto" />
                        ) : row[r] === "permiso" ? (
                          <span className="text-[9px] text-primary font-bold mx-auto block text-center">PERM</span>
                        ) : (
                          <span className="text-white/15 text-base">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-white/25 mt-3 flex items-center gap-1">
            <Info className="w-3 h-3" />
            <strong className="text-white/40">PERM</strong> = Requiere habilitación explícita desde el tab "Permisos WA" de este módulo.
          </p>
        </div>

        </>}

      </div>

      {showNuevo && (
        <NuevoUsuarioModal onClose={() => setShowNuevo(false)} onCreated={refresh} />
      )}
      {editUser && (
        <EditarUsuarioModal user={editUser} onClose={() => setEditUser(null)} onUpdated={refresh} />
      )}
    </AdminLayout>
  );
}
