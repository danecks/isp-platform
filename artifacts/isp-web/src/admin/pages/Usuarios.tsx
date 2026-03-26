import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCog, Plus, Search, Pencil, KeyRound, Power, PowerOff,
  X, Check, AlertCircle, Loader2, ShieldCheck, Mail, Phone,
  User, Lock, ChevronDown,
} from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi, type UserSafe } from "@/lib/api";
import { ROL_LABELS, ROL_COLORES, type Rol } from "@/config/permissions";
import { useToast } from "@/hooks/use-toast";

const ROLES: Rol[] = ["admin", "operaciones", "rrhh", "comercial", "supervisor", "cliente"];

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

// ─── NuevoUsuarioModal ─────────────────────────────────────────────────────────
interface NuevoModalProps {
  onClose: () => void;
  onCreated: () => void;
}
function NuevoUsuarioModal({ onClose, onCreated }: NuevoModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    nombre: "", username: "", correo: "", password: "", confirmPassword: "",
    rol: "operaciones" as Rol, telefono: "", clienteId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      });
      toast({ title: "Usuario creado", description: `${form.nombre} ha sido registrado en el sistema.` });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 font-medium">Nombre completo *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                value={form.nombre}
                onChange={e => set("nombre", e.target.value)}
                placeholder="Carlos Supervisor González"
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
                onChange={e => set("username", e.target.value.toLowerCase())}
                placeholder="carlos.sup"
                className="bg-[#060e1c] border-white/10 text-white text-sm h-10"
                required
              />
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

          {/* Correo + Teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type="email"
                  value={form.correo}
                  onChange={e => set("correo", e.target.value)}
                  placeholder="correo@isp.gt"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  value={form.telefono}
                  onChange={e => set("telefono", e.target.value)}
                  placeholder="502 XXXX-XXXX"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                />
              </div>
            </div>
          </div>

          {/* ClienteId (only if rol === cliente) */}
          {form.rol === "cliente" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">ID de Cliente (opcional)</Label>
              <Input
                value={form.clienteId}
                onChange={e => set("clienteId", e.target.value)}
                placeholder="CLI-001"
                className="bg-[#060e1c] border-white/10 text-white text-sm h-10"
              />
            </div>
          )}

          {/* Contraseña */}
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
            <Label className="text-xs text-white/60 font-medium">Confirmar contraseña *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={e => set("confirmPassword", e.target.value)}
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

          <div className="flex gap-3 pt-2">
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
  const [tab, setTab] = useState<"datos" | "password">("datos");
  const [form, setForm] = useState({
    nombre: user.nombre,
    correo: user.correo ?? "",
    rol: user.rol as Rol,
    estado: user.estado,
    telefono: user.telefono ?? "",
    clienteId: user.clienteId ?? "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#07111f] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Usuario</h2>
              <p className="text-[11px] text-muted-foreground">{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {(["datos", "password"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                tab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "datos" ? "Datos & Rol" : "Contraseña"}
            </button>
          ))}
        </div>

        {tab === "datos" ? (
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

            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Correo electrónico</Label>
              <Input
                type="email"
                value={form.correo}
                onChange={e => set("correo", e.target.value)}
                className="bg-[#060e1c] border-white/10 text-white text-sm h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60 font-medium">Teléfono</Label>
                <Input
                  value={form.telefono}
                  onChange={e => set("telefono", e.target.value)}
                  className="bg-[#060e1c] border-white/10 text-white text-sm h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60 font-medium">ID Cliente</Label>
                <Input
                  value={form.clienteId}
                  onChange={e => set("clienteId", e.target.value)}
                  placeholder="CLI-XXX"
                  className="bg-[#060e1c] border-white/10 text-white text-sm h-10"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-white/60 hover:text-white h-10">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-10"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePassword} className="p-6 space-y-4">
            <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-lg px-4 py-3 flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-400/80">
                Establecer nueva contraseña para <strong>{user.nombre}</strong>. El usuario deberá usar esta contraseña en su próximo inicio de sesión.
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

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-white/60 hover:text-white h-10">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-yellow-500 text-black font-bold hover:bg-yellow-400 h-10"
              >
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
export default function AdminUsuarios() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rolFiltro, setRolFiltro] = useState<string>("todos");
  const [showNuevo, setShowNuevo] = useState(false);
  const [editUser, setEditUser] = useState<UserSafe | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
    refetchInterval: 30_000,
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
      (u.correo ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRol = rolFiltro === "todos" || u.rol === rolFiltro;
    return matchSearch && matchRol;
  });

  const counts = {
    total: users.length,
    activos: users.filter(u => u.estado === "activo").length,
    inactivos: users.filter(u => u.estado !== "activo").length,
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });

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
              Control de acceso y permisos por rol en el sistema operativo
            </p>
          </div>
          <Button
            onClick={() => setShowNuevo(true)}
            className="bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-10 px-5 gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total usuarios", value: counts.total, color: "text-white" },
            { label: "Activos", value: counts.activos, color: "text-green-400" },
            { label: "Inactivos", value: counts.inactivos, color: "text-red-400" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-white/5 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, username o correo..."
              className="pl-9 bg-card border-white/10 text-white text-sm h-10"
            />
          </div>
          <div className="relative">
            <select
              value={rolFiltro}
              onChange={e => setRolFiltro(e.target.value)}
              className="h-10 bg-card border border-white/10 text-white text-sm rounded-md px-3 pr-8 appearance-none focus:outline-none focus:border-primary/50 min-w-[160px]"
            >
              <option value="todos">Todos los roles</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{ROL_LABELS[r]}</option>
              ))}
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
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3 hidden md:table-cell">Contacto</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3">Estado</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-white/30 font-semibold px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-white/30">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-white/30">
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
                      {/* Contacto */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <div className="space-y-0.5">
                          {u.correo && (
                            <p className="text-white/60 text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" />{u.correo}
                            </p>
                          )}
                          {u.telefono && (
                            <p className="text-white/60 text-xs flex items-center gap-1">
                              <Phone className="w-3 h-3" />{u.telefono}
                            </p>
                          )}
                          {!u.correo && !u.telefono && (
                            <span className="text-white/20 text-xs">—</span>
                          )}
                        </div>
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
                  <th className="text-left text-white/30 font-medium pb-2 pr-4">Módulo</th>
                  {ROLES.filter(r => r !== "cliente").map(r => (
                    <th key={r} className="text-center pb-2 px-2">
                      <RolBadge rol={r} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { mod: "Dashboard", admin: true, operaciones: true, rrhh: true, comercial: true, supervisor: true },
                  { mod: "Incidencias", admin: true, operaciones: true, rrhh: false, comercial: false, supervisor: true },
                  { mod: "Custodias", admin: true, operaciones: true, rrhh: false, comercial: false, supervisor: true },
                  { mod: "Reclutamiento", admin: true, operaciones: false, rrhh: true, comercial: false, supervisor: false },
                  { mod: "Comercial", admin: true, operaciones: false, rrhh: false, comercial: true, supervisor: false },
                  { mod: "Tareas", admin: true, operaciones: true, rrhh: false, comercial: false, supervisor: true },
                  { mod: "KPI & Métricas", admin: true, operaciones: false, rrhh: false, comercial: false, supervisor: false },
                  { mod: "Clientes", admin: true, operaciones: true, rrhh: false, comercial: true, supervisor: false },
                  { mod: "Usuarios", admin: true, operaciones: false, rrhh: false, comercial: false, supervisor: false },
                ].map(row => (
                  <tr key={row.mod} className="border-b border-white/3 hover:bg-white/1">
                    <td className="py-2 pr-4 text-white/60">{row.mod}</td>
                    {(["admin", "operaciones", "rrhh", "comercial", "supervisor"] as const).map(r => (
                      <td key={r} className="text-center py-2 px-2">
                        {row[r] ? (
                          <Check className="w-3.5 h-3.5 text-green-400 mx-auto" />
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
        </div>

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
