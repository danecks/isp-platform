import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Check, Loader2,
  ChevronDown, ChevronUp, Settings2, Lock, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { NAV_SECTIONS } from "@/config/permissions";

const BASE = () => import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface SystemRole {
  clave: string;
  label: string;
  descripcion: string | null;
  color: string;
  activo: boolean;
  es_sistema: boolean;
  permisos_count: number;
  usuarios_activos: number;
}

interface Modulo {
  clave: string;
  label: string;
  seccion: string;
}

const COLOR_OPTIONS = [
  { label: "Rojo",    value: "text-red-400 bg-red-400/10 border-red-400/20" },
  { label: "Azul",   value: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  { label: "Morado", value: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  { label: "Verde",  value: "text-green-400 bg-green-400/10 border-green-400/20" },
  { label: "Amarillo",value: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  { label: "Naranja",value: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  { label: "Cyan",   value: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
  { label: "Neutro", value: "text-white/50 bg-white/5 border-white/10" },
];

function authHeader(currentUser: any): Record<string, string> {
  if (!currentUser) return {};
  return { "x-isp-session": JSON.stringify({ username: currentUser.username, rol: currentUser.rol, nombre: currentUser.nombre }) };
}

function RolBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${color}`}>
      {label}
    </span>
  );
}

// ─── Modal de permisos por rol ─────────────────────────────────────────────────
function PermisosModal({ rol, onClose }: { rol: SystemRole; onClose: () => void }) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: modulosDisponibles = [] } = useQuery<Modulo[]>({
    queryKey: ["roles-modulos"],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/roles/modulos`);
      return r.json();
    },
  });

  const { data: permisosActuales = [], isLoading } = useQuery<string[]>({
    queryKey: ["rol-permisos", rol.clave],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/roles/${rol.clave}/permisos`, {
        headers: authHeader(currentUser),
      });
      return r.json();
    },
  });

  const [seleccionados, setSeleccionados] = useState<Set<string> | null>(null);
  const efectivos = seleccionados ?? new Set(permisosActuales);

  const guardar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE()}/api/roles/${rol.clave}/permisos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader(currentUser) },
        body: JSON.stringify({ modulos: Array.from(efectivos) }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["rol-permisos", rol.clave] });
      qc.invalidateQueries({ queryKey: ["session-permisos"] });
      toast({ title: "Permisos actualizados", description: `Módulos de '${rol.label}' guardados` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Agrupados por sección
  const porSeccion = modulosDisponibles.reduce<Record<string, Modulo[]>>((acc, m) => {
    (acc[m.seccion] ??= []).push(m);
    return acc;
  }, {});

  function toggle(clave: string) {
    const next = new Set(efectivos);
    next.has(clave) ? next.delete(clave) : next.add(clave);
    setSeleccionados(next);
  }

  function toggleSeccion(modulos: Modulo[], todos: boolean) {
    const next = new Set(efectivos);
    modulos.forEach(m => todos ? next.delete(m.clave) : next.add(m.clave));
    setSeleccionados(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0c1628] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-white">Permisos de módulos</h2>
              <p className="text-xs text-white/40">
                <RolBadge color={rol.color} label={rol.label} />
                {" "} — {efectivos.size} módulo{efectivos.size !== 1 ? "s" : ""} habilitado{efectivos.size !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            Object.entries(porSeccion).map(([seccion, mods]) => {
              const todosActivos = mods.every(m => efectivos.has(m.clave));
              const algunoActivo = mods.some(m => efectivos.has(m.clave));
              return (
                <div key={seccion}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{seccion}</p>
                    <button
                      onClick={() => toggleSeccion(mods, todosActivos)}
                      className="text-[10px] text-primary hover:text-primary/80 font-semibold"
                    >
                      {todosActivos ? "Quitar todos" : "Seleccionar todos"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {mods.map(m => {
                      const activo = efectivos.has(m.clave);
                      return (
                        <button
                          key={m.clave}
                          onClick={() => toggle(m.clave)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border text-left transition-all ${
                            activo
                              ? "bg-primary/10 border-primary/30 text-white"
                              : "bg-[#060e1c] border-white/8 text-white/50 hover:border-white/20"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            activo ? "bg-primary border-primary" : "border-white/20"
                          }`}>
                            {activo && <Check className="w-2.5 h-2.5 text-[#050d1a]" />}
                          </div>
                          <span className="text-xs font-medium truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/8 shrink-0 gap-3">
          <button onClick={onClose} className="text-sm text-white/40 hover:text-white">Cancelar</button>
          <Button
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending}
            className="bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-9 px-5 gap-2"
          >
            {guardar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Guardar permisos
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal crear/editar rol ─────────────────────────────────────────────────────
function RolFormModal({ rolEdit, onClose, onSaved }: { rolEdit?: SystemRole; onClose: () => void; onSaved: () => void }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [clave, setClave] = useState(rolEdit?.clave ?? "");
  const [label, setLabel] = useState(rolEdit?.label ?? "");
  const [descripcion, setDescripcion] = useState(rolEdit?.descripcion ?? "");
  const [color, setColor] = useState(rolEdit?.color ?? COLOR_OPTIONS[7].value);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      const url = rolEdit
        ? `${BASE()}/api/roles/${rolEdit.clave}`
        : `${BASE()}/api/roles`;
      const r = await fetch(url, {
        method: rolEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeader(currentUser) },
        body: JSON.stringify({ clave: clave.trim(), label: label.trim(), descripcion: descripcion.trim() || null, color }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: rolEdit ? "Rol actualizado" : "Rol creado", description: label });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0c1628] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-base font-bold text-white">{rolEdit ? "Editar rol" : "Nuevo rol"}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {!rolEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60">Clave interna <span className="text-white/30">(sin espacios, ej: jefe_zona)</span></Label>
              <Input
                value={clave}
                onChange={e => setClave(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="ej: supervisor_zona"
                className="bg-card border-white/10 text-white text-sm h-9"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Nombre del rol</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="ej: Supervisor de Zona"
              className="bg-card border-white/10 text-white text-sm h-9"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Descripción <span className="text-white/30">(opcional)</span></Label>
            <Input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Breve descripción del rol"
              className="bg-card border-white/10 text-white text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Color del badge</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setColor(o.value)}
                  className={`rounded-lg p-2 border text-center transition-all ${
                    color === o.value ? "border-primary ring-1 ring-primary" : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${o.value}`}>
                    {o.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-1 text-center">
              <span className="text-xs text-white/40">Vista previa: </span>
              <RolBadge color={color} label={label || "Rol"} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white">
              Cancelar
            </button>
            <Button type="submit" disabled={saving} className="flex-1 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-9 gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {rolEdit ? "Guardar cambios" : "Crear rol"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RolesTab ──────────────────────────────────────────────────────────────────
export function RolesTab() {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showNuevo, setShowNuevo] = useState(false);
  const [editRol, setEditRol] = useState<SystemRole | null>(null);
  const [permisosRol, setPermisosRol] = useState<SystemRole | null>(null);

  const { data: roles = [], isLoading } = useQuery<SystemRole[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/roles`, {
        headers: authHeader(currentUser),
      });
      return r.json();
    },
  });

  const eliminar = useMutation({
    mutationFn: async (rol: SystemRole) => {
      const r = await fetch(`${BASE()}/api/roles/${rol.clave}`, {
        method: "DELETE",
        headers: authHeader(currentUser),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: (_, rol) => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Rol eliminado", description: rol.label });
    },
    onError: (e: any) => toast({ title: "No se puede eliminar", description: e.message, variant: "destructive" }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["roles"] });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Roles del sistema</h2>
          <p className="text-xs text-white/40 mt-0.5">Gestiona roles y los módulos que cada uno puede acceder</p>
        </div>
        <Button
          onClick={() => setShowNuevo(true)}
          className="bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-9 px-4 gap-2 text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo rol
        </Button>
      </div>

      {/* Lista de roles */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando roles...
          </div>
        ) : (
          roles.map(rol => (
            <div
              key={rol.clave}
              className="bg-card border border-white/5 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <RolBadge color={rol.color} label={rol.label} />
                  {rol.es_sistema && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-white/30 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5" /> Sistema
                    </span>
                  )}
                  <span className="text-[10px] text-white/25 font-mono">{rol.clave}</span>
                </div>
                {rol.descripcion && (
                  <p className="text-xs text-white/40 mb-1 truncate">{rol.descripcion}</p>
                )}
                <div className="flex items-center gap-4 text-[10px] text-white/30">
                  <span>{rol.permisos_count} módulo{rol.permisos_count !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {rol.usuarios_activos} usuario{rol.usuarios_activos !== 1 ? "s" : ""} activo{rol.usuarios_activos !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPermisosRol(rol)}
                  className="h-8 px-3 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors gap-1.5 inline-flex items-center"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Módulos
                </button>
                {!rol.es_sistema && (
                  <button
                    onClick={() => setEditRol(rol)}
                    className="h-8 w-8 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {!rol.es_sistema && rol.usuarios_activos === 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar rol "${rol.label}"?`)) eliminar.mutate(rol);
                    }}
                    className="h-8 w-8 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modales */}
      {showNuevo && (
        <RolFormModal onClose={() => setShowNuevo(false)} onSaved={refresh} />
      )}
      {editRol && (
        <RolFormModal rolEdit={editRol} onClose={() => setEditRol(null)} onSaved={refresh} />
      )}
      {permisosRol && (
        <PermisosModal rol={permisosRol} onClose={() => setPermisosRol(null)} />
      )}
    </div>
  );
}
