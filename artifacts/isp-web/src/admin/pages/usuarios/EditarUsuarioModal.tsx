import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Pencil, X, AlertCircle, Loader2, KeyRound,
  Phone, Lock, ChevronDown, MessageSquare, Zap, Wallet, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi, type UserSafe } from "@/lib/api";
import { ROL_LABELS } from "@/config/permissions";
import { useToast } from "@/hooks/use-toast";
import { ROLES, useSystemRoles, RolBadge, PermToggle, type Rol } from "./shared";
import { EmpleadoPicker } from "./EmpleadoPicker";

interface EditarModalProps {
  user: UserSafe;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditarUsuarioModal({ user, onClose, onUpdated }: EditarModalProps) {
  const { toast } = useToast();
  const { data: systemRoles = [] } = useSystemRoles();
  const rolesOpciones = systemRoles.filter(r => r.activo).length > 0
    ? systemRoles.filter(r => r.activo)
    : ROLES.map(r => ({ clave: r, label: ROL_LABELS[r] ?? r, activo: true }));
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
                    {rolesOpciones.map(r => (
                      <option key={r.clave} value={r.clave}>{r.label}</option>
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
                <Label className="text-xs text-white/60 font-medium">Vincular a colaborador</Label>
                <EmpleadoPicker
                  value={form.employeeId}
                  onChange={v => set("employeeId", v)}
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
