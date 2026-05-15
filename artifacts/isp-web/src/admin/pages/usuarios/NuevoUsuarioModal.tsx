import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus, X, AlertCircle, Loader2,
  Mail, Phone, User, Lock, ChevronDown, MessageSquare, Zap, Wallet, Shield, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi } from "@/lib/api";
import { ROL_LABELS } from "@/config/permissions";
import { useToast } from "@/hooks/use-toast";
import { ROLES, useSystemRoles, PermToggle, type Rol } from "./shared";
import { EmpleadoPicker } from "./EmpleadoPicker";

interface NuevoModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NuevoUsuarioModal({ onClose, onCreated }: NuevoModalProps) {
  const { toast } = useToast();
  const { data: systemRoles = [] } = useSystemRoles();
  const rolesOpciones = systemRoles.filter(r => r.activo).length > 0
    ? systemRoles.filter(r => r.activo)
    : ROLES.map(r => ({ clave: r, label: ROL_LABELS[r] ?? r, activo: true }));
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
                  {rolesOpciones.map(r => (
                    <option key={r.clave} value={r.clave}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              </div>
            </div>
          </div>

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
              <Label className="text-xs text-white/60 font-medium">Vincular a colaborador (opcional)</Label>
              <EmpleadoPicker
                value={form.employeeId}
                onChange={v => set("employeeId", v)}
              />
              <p className="text-[10px] text-white/30">Buscá por nombre, DPI o puesto para vincular a un registro de empleado (necesario para anticipos y asignaciones).</p>
            </div>
          )}

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
