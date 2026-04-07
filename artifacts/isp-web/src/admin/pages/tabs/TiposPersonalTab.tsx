import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HardHat, Plus, Pencil, Trash2, X, Check, Loader2, Lock, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const BASE = () => import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface TipoPersonal {
  clave: string;
  label: string;
  color: string;
  descripcion: string | null;
  activo: boolean;
  es_sistema: boolean;
  orden: number;
  empleados_count: number;
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

function TipoBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${color}`}>
      {label}
    </span>
  );
}

// ─── Modal crear/editar tipo ────────────────────────────────────────────────────
function TipoFormModal({ tipoEdit, onClose, onSaved }: { tipoEdit?: TipoPersonal; onClose: () => void; onSaved: () => void }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [clave, setClave] = useState(tipoEdit?.clave ?? "");
  const [label, setLabel] = useState(tipoEdit?.label ?? "");
  const [descripcion, setDescripcion] = useState(tipoEdit?.descripcion ?? "");
  const [color, setColor] = useState(tipoEdit?.color ?? COLOR_OPTIONS[7].value);
  const [orden, setOrden] = useState(String(tipoEdit?.orden ?? 99));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      const url = tipoEdit
        ? `${BASE()}/api/tipos-personal-config/${tipoEdit.clave}`
        : `${BASE()}/api/tipos-personal-config`;
      const r = await fetch(url, {
        method: tipoEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeader(currentUser) },
        body: JSON.stringify({
          clave: clave.trim(),
          label: label.trim(),
          descripcion: descripcion.trim() || null,
          color,
          orden: parseInt(orden) || 99,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: tipoEdit ? "Tipo actualizado" : "Tipo creado", description: label });
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
          <h2 className="text-base font-bold text-white">
            {tipoEdit ? "Editar tipo de personal" : "Nuevo tipo de personal"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {!tipoEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60">Clave interna <span className="text-white/30">(ej: coordinador)</span></Label>
              <Input
                value={clave}
                onChange={e => setClave(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="ej: coordinador_zona"
                className="bg-card border-white/10 text-white text-sm h-9"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Nombre del tipo</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="ej: Coordinador de Zona"
              className="bg-card border-white/10 text-white text-sm h-9"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Descripción <span className="text-white/30">(opcional)</span></Label>
            <Input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción breve del tipo de personal"
              className="bg-card border-white/10 text-white text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60">Orden de visualización</Label>
            <Input
              type="number"
              value={orden}
              onChange={e => setOrden(e.target.value)}
              min={1}
              max={999}
              className="bg-card border-white/10 text-white text-sm h-9 w-24"
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
              <TipoBadge color={color} label={label || "Tipo"} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white">
              Cancelar
            </button>
            <Button type="submit" disabled={saving} className="flex-1 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-9 gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {tipoEdit ? "Guardar cambios" : "Crear tipo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TiposPersonalTab ──────────────────────────────────────────────────────────
export function TiposPersonalTab() {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showNuevo, setShowNuevo] = useState(false);
  const [editTipo, setEditTipo] = useState<TipoPersonal | null>(null);

  const { data: tipos = [], isLoading } = useQuery<TipoPersonal[]>({
    queryKey: ["tipos-personal-config"],
    queryFn: async () => {
      const r = await fetch(`${BASE()}/api/tipos-personal-config`, {
        headers: authHeader(currentUser),
      });
      return r.json();
    },
  });

  const eliminar = useMutation({
    mutationFn: async (t: TipoPersonal) => {
      const r = await fetch(`${BASE()}/api/tipos-personal-config/${t.clave}`, {
        method: "DELETE",
        headers: authHeader(currentUser),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: (_, t) => {
      qc.invalidateQueries({ queryKey: ["tipos-personal-config"] });
      toast({ title: "Tipo eliminado", description: t.label });
    },
    onError: (e: any) => toast({ title: "No se puede eliminar", description: e.message, variant: "destructive" }),
  });

  const toggleActivo = useMutation({
    mutationFn: async (t: TipoPersonal) => {
      const r = await fetch(`${BASE()}/api/tipos-personal-config/${t.clave}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader(currentUser) },
        body: JSON.stringify({ activo: !t.activo }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tipos-personal-config"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["tipos-personal-config"] });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Tipos de personal</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Categorías para clasificar colaboradores. Aparecen en su ficha y en filtros de módulos.
          </p>
        </div>
        <Button
          onClick={() => setShowNuevo(true)}
          className="bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-9 px-4 gap-2 text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo tipo
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando tipos...
          </div>
        ) : (
          tipos.map(tipo => (
            <div
              key={tipo.clave}
              className={`bg-card border rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-opacity ${
                tipo.activo ? "border-white/5" : "border-white/3 opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <TipoBadge color={tipo.color} label={tipo.label} />
                  {tipo.es_sistema && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-white/30 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5" /> Sistema
                    </span>
                  )}
                  {!tipo.activo && (
                    <span className="text-[9px] text-red-400/60 bg-red-400/5 border border-red-400/15 px-1.5 py-0.5 rounded">
                      Inactivo
                    </span>
                  )}
                  <span className="text-[10px] text-white/25 font-mono">{tipo.clave}</span>
                </div>
                {tipo.descripcion && (
                  <p className="text-xs text-white/40 mb-1 truncate">{tipo.descripcion}</p>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                  <Users className="w-3 h-3" />
                  {tipo.empleados_count} colaborador{tipo.empleados_count !== 1 ? "es" : ""} asignado{tipo.empleados_count !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle activo/inactivo */}
                <button
                  onClick={() => toggleActivo.mutate(tipo)}
                  disabled={tipo.es_sistema}
                  title={tipo.activo ? "Desactivar" : "Activar"}
                  className={`h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    tipo.activo
                      ? "border-green-500/30 text-green-400 hover:bg-green-400/10"
                      : "border-white/10 text-white/40 hover:text-white"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {tipo.activo ? "Activo" : "Inactivo"}
                </button>
                {!tipo.es_sistema && (
                  <button
                    onClick={() => setEditTipo(tipo)}
                    className="h-8 w-8 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {!tipo.es_sistema && tipo.empleados_count === 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar tipo "${tipo.label}"?`)) eliminar.mutate(tipo);
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
        <TipoFormModal onClose={() => setShowNuevo(false)} onSaved={refresh} />
      )}
      {editTipo && (
        <TipoFormModal tipoEdit={editTipo} onClose={() => setEditTipo(null)} onSaved={refresh} />
      )}
    </div>
  );
}
