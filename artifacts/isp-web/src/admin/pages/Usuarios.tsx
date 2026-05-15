import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCog, Plus, Search, Pencil, Power, PowerOff,
  X, AlertCircle, Loader2, ShieldCheck, ChevronDown, MessageSquare,
  Building, UserCheck, ShieldAlert, HardHat,
} from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usersApi, type UserSafe } from "@/lib/api";
import { ROL_LABELS } from "@/config/permissions";
import { useToast } from "@/hooks/use-toast";
import { RolesTab } from "./tabs/RolesTab";
import { TiposPersonalTab } from "./tabs/TiposPersonalTab";
import { ROLES, useSystemRoles, RolBadge, EstadoBadge } from "./usuarios/shared";
import { NuevoUsuarioModal } from "./usuarios/NuevoUsuarioModal";
import { EditarUsuarioModal } from "./usuarios/EditarUsuarioModal";
import { PermisosReferenceTable } from "./usuarios/PermisosReferenceTable";

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

  const { data: systemRolesAll = [] } = useSystemRoles();
  const rolesFilter = systemRolesAll.filter(r => r.activo).length > 0
    ? systemRolesAll.filter(r => r.activo)
    : ROLES.map(r => ({ clave: r, label: ROL_LABELS[r] ?? r, activo: true }));

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

        {tab === "roles" && <RolesTab />}
        {tab === "tipos_personal" && <TiposPersonalTab />}

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
              {rolesFilter.map(r => (
                <option key={r.clave} value={r.clave}>{r.label}</option>
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
                      <td className="px-4 py-3.5">
                        <RolBadge rol={u.rol} />
                      </td>
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
                      <td className="px-4 py-3.5">
                        <EstadoBadge estado={u.estado} />
                      </td>
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

        <PermisosReferenceTable />

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
