import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Map, Plus, Edit3, Trash2, X, Loader2, Users, Building2,
  Shield, ChevronLeft, ChevronDown, ChevronRight,
  User, CheckCircle2, AlertCircle, RefreshCw, MapPin,
  Save, Layers, Power,
} from "lucide-react";
import { AdminLayout } from "../layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const h = () => ({ "x-isp-session": getSession(), "Content-Type": "application/json" });

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ZonaSupervisor {
  employee_id: number;
  nombre: string;
  puesto: string | null;
  telefono: string | null;
}

interface Zona {
  id: number;
  nombre: string;
  descripcion: string | null;
  supervisor_employee_id: number | null;
  supervisor_user_id: number | null;
  supervisor_nombre: string | null;
  supervisor_puesto: string | null;
  supervisor_telefono: string | null;
  supervisores: ZonaSupervisor[];
  estado: string;
  total_puestos: number;
  total_clientes: number;
  total_sedes: number;
  puestos_cubiertos: number;
  puestos_descubiertos: number;
  created_at: string;
}

interface ZonaDetalle {
  zona: Zona & { supervisor_nombre: string | null };
  puestosAgrupados: Array<{
    cliente_id: number | null;
    cliente_nombre: string;
    puestos: Array<{
      id: number;
      nombre: string;
      estado: string;
      turno: string | null;
      agente_nombre: string | null;
      sede_nombre: string | null;
    }>;
  }>;
}

interface Empleado {
  id: number;
  nombreCompleto: string;
  puesto: string | null;
  area: string | null;
}

interface PuestoAll {
  id: number;
  nombre: string;
  cliente_nombre: string;
  cliente_id: number | null;
  sede_nombre: string | null;
  estado: string;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
}

// ─── Modal: Crear / Editar zona ───────────────────────────────────────────────

function ModalZona({
  zona,
  onClose,
  onSaved,
}: {
  zona: Zona | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [nombre, setNombre] = useState(zona?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(zona?.descripcion ?? "");
  const [supervisorIds, setSupervisorIds] = useState<number[]>(
    () => (zona?.supervisores ?? []).map((s) => s.employee_id)
  );
  const [saving, setSaving] = useState(false);

  // Lista filtrada: solo supervisores, jefes de servicio o administración.
  const { data: empleadosSup = [], isLoading: cargandoSup } = useQuery<Empleado[]>({
    queryKey: ["empleados-supervisores"],
    queryFn: () =>
      fetch(`${API}/operaciones/zonas/empleados-supervisores`).then((r) => r.json()),
  });

  const empleadosMap = new Map(empleadosSup.map((e) => [e.id, e] as const));
  const disponibles = empleadosSup.filter((e) => !supervisorIds.includes(e.id));

  function agregar(id: number) {
    if (!supervisorIds.includes(id)) setSupervisorIds([...supervisorIds, id]);
  }
  function quitar(id: number) {
    setSupervisorIds(supervisorIds.filter((x) => x !== id));
  }

  async function handleSave() {
    if (!nombre.trim()) { toast({ title: "El nombre es requerido", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        supervisor_employee_ids: supervisorIds,
      };
      const url = zona ? `${API}/operaciones/zonas/${zona.id}` : `${API}/operaciones/zonas`;
      const method = zona ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: h(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: zona ? "Zona actualizada" : "Zona creada", description: nombre.trim() });
      onSaved();
    } catch {
      toast({ title: "Error al guardar zona", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0a1525]">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">
              {zona ? "Editar zona operativa" : "Nueva zona operativa"}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-widest font-semibold block mb-1.5">
              Nombre de la zona *
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Zona Norte, Zona Centro, Zona Industrial…"
              className="w-full bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-primary/40"
            />
          </div>

          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-widest font-semibold block mb-1.5">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Área geográfica, características, notas relevantes…"
              rows={2}
              className="w-full bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-primary/40 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-white/30 uppercase tracking-widest font-semibold block mb-1.5">
              Supervisores responsables
            </label>

            {supervisorIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {supervisorIds.map((id) => {
                  const emp = empleadosMap.get(id);
                  const label = emp?.nombreCompleto ?? `Empleado #${id}`;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary"
                    >
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[180px]">{label}</span>
                      <button
                        type="button"
                        onClick={() => quitar(id)}
                        className="text-primary/60 hover:text-primary"
                        title="Quitar supervisor"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) agregar(Number(v));
              }}
              disabled={cargandoSup || disponibles.length === 0}
              className="w-full bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40 disabled:opacity-50"
            >
              <option value="">
                {cargandoSup
                  ? "Cargando…"
                  : disponibles.length === 0
                    ? supervisorIds.length === 0
                      ? "No hay supervisores registrados"
                      : "Todos los supervisores ya están agregados"
                    : "+ Agregar supervisor…"}
              </option>
              {disponibles.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombreCompleto}{emp.puesto ? ` — ${emp.puesto}` : ""}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-white/20 mt-1">
              Solo empleados registrados en el sistema. No implica un rol de usuario.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-[#07111f] text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {zona ? "Guardar cambios" : "Crear zona"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Asignar puestos a zona ────────────────────────────────────────────

function ModalAsignarPuestos({
  zona,
  todosPuestos,
  onClose,
  onSaved,
}: {
  zona: Zona;
  todosPuestos: PuestoAll[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // IDs actualmente en esta zona
  const actualesIds = new Set(
    todosPuestos.filter((p) => p.zona_operativa_id === zona.id).map((p) => p.id)
  );
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set(actualesIds));

  // Filtrar por búsqueda
  const puestosFiltrados = todosPuestos.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return p.nombre.toLowerCase().includes(q) || p.cliente_nombre.toLowerCase().includes(q);
  });

  // Agrupar por cliente
  const porCliente: Record<string, PuestoAll[]> = {};
  for (const p of puestosFiltrados) {
    const k = p.cliente_nombre || "Sin cliente";
    if (!porCliente[k]) porCliente[k] = [];
    porCliente[k].push(p);
  }

  function toggle(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Puestos a agregar (no estaban antes, ahora sí)
      const agregar = [...seleccionados].filter((id) => !actualesIds.has(id));
      // Puestos a quitar (estaban antes, ahora no)
      const quitar = [...actualesIds].filter((id) => !seleccionados.has(id));

      if (agregar.length > 0) {
        const r = await fetch(`${API}/operaciones/zonas/${zona.id}/puestos`, {
          method: "POST",
          headers: h(),
          body: JSON.stringify({ puesto_ids: agregar }),
        });
        if (!r.ok) throw new Error("Error al asignar");
      }

      for (const pid of quitar) {
        await fetch(`${API}/operaciones/zonas/${zona.id}/puestos/${pid}`, {
          method: "DELETE",
          headers: h(),
        });
      }

      toast({
        title: "Puestos actualizados",
        description: `${agregar.length} asignados, ${quitar.length} removidos`,
      });
      onSaved();
    } catch {
      toast({ title: "Error al guardar cambios", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const cambios = [...seleccionados].filter((id) => !actualesIds.has(id)).length +
    [...actualesIds].filter((id) => !seleccionados.has(id)).length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0a1525] shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Puestos en "{zona.nombre}"</h3>
            <span className="text-[10px] text-primary/60 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
              {seleccionados.size} seleccionados
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/6 shrink-0">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar puesto o cliente…"
            className="w-full bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-primary/30"
          />
          <p className="text-[10px] text-white/20 mt-1.5">
            Selecciona los puestos que pertenecen a esta zona. Un puesto solo puede estar en una zona a la vez.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {Object.entries(porCliente).map(([cliente, puestos]) => (
            <div key={cliente}>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> {cliente}
              </p>
              <div className="space-y-1">
                {puestos.map((p) => {
                  const checked = seleccionados.has(p.id);
                  const enOtraZona = p.zona_operativa_id && p.zona_operativa_id !== zona.id;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border
                        ${checked
                          ? "bg-primary/8 border-primary/20 text-white"
                          : "bg-[#0c1929] border-white/5 text-white/50 hover:border-white/10"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        className="accent-primary w-3.5 h-3.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.nombre}</p>
                        {p.sede_nombre && (
                          <p className="text-[10px] text-white/30 truncate">{p.sede_nombre}</p>
                        )}
                      </div>
                      {enOtraZona && (
                        <span className="text-[9px] text-amber-400/60 bg-amber-500/8 border border-amber-500/15 px-1.5 py-0.5 rounded-full shrink-0">
                          {p.zona_nombre}
                        </span>
                      )}
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.estado === "cubierto" ? "bg-green-400" : "bg-red-400"}`} />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(porCliente).length === 0 && (
            <div className="text-center py-6 text-xs text-white/25">
              No hay puestos que coincidan con la búsqueda
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-white/8 flex items-center gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || cambios === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-[#07111f] text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {cambios > 0 ? `Guardar (${cambios} cambios)` : "Sin cambios"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Card de zona ──────────────────────────────────────────────────────────────

function ZonaCard({
  zona,
  onEdit,
  onDelete,
  onAsignar,
  onDetalle,
  onActivar,
}: {
  zona: Zona;
  onEdit: () => void;
  onDelete: () => void;
  onAsignar: () => void;
  onDetalle: () => void;
  onActivar?: () => void;
}) {
  const coberturaP = zona.total_puestos > 0
    ? Math.round((zona.puestos_cubiertos / zona.total_puestos) * 100)
    : 0;

  return (
    <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
          <Map className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">{zona.nombre}</h3>
            {zona.estado !== "activo" && (
              <span className="text-[9px] text-red-400/70 bg-red-500/10 border border-red-500/15 px-1.5 py-0.5 rounded-full">Inactiva</span>
            )}
          </div>
          {zona.descripcion && (
            <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{zona.descripcion}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-white/25 hover:text-white transition-colors rounded-lg hover:bg-white/5" title="Editar zona">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          {onActivar ? (
            <button
              onClick={onActivar}
              className="p-1.5 text-emerald-400/50 hover:text-emerald-400 transition-colors rounded-lg hover:bg-emerald-500/10"
              title="Reactivar zona"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={onDelete} className="p-1.5 text-red-400/30 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/8" title="Desactivar zona">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-0 border-t border-white/6">
        {[
          { label: "Puestos",   value: zona.total_puestos,   color: "text-white" },
          { label: "Clientes",  value: zona.total_clientes,  color: "text-blue-400" },
          { label: "Sedes",     value: zona.total_sedes,     color: "text-purple-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="py-2.5 text-center border-r border-white/6 last:border-r-0">
            <p className={`text-base font-bold leading-none ${color}`}>{value}</p>
            <p className="text-[9px] text-white/25 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Cobertura bar */}
      {zona.total_puestos > 0 && (
        <div className="px-4 py-2.5 border-t border-white/6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30">Cobertura actual</span>
            <span className={`text-[10px] font-bold ${coberturaP >= 80 ? "text-green-400" : coberturaP >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {coberturaP}%
            </span>
          </div>
          <div className="h-1 bg-white/6 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${coberturaP >= 80 ? "bg-green-400" : coberturaP >= 50 ? "bg-amber-400" : "bg-red-400"}`}
              style={{ width: `${coberturaP}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-green-400/60">{zona.puestos_cubiertos} cubiertos</span>
            {zona.puestos_descubiertos > 0 && (
              <span className="text-[9px] text-red-400/60">{zona.puestos_descubiertos} descubiertos</span>
            )}
          </div>
        </div>
      )}

      {/* Supervisores */}
      <div className="px-4 py-2.5 border-t border-white/6 flex items-start gap-2">
        <User className="w-3 h-3 text-white/20 shrink-0 mt-0.5" />
        {zona.supervisores && zona.supervisores.length > 0 ? (
          <div className="flex-1 min-w-0 space-y-0.5">
            {zona.supervisores.map((s) => (
              <div key={s.employee_id}>
                <p className="text-[11px] text-white/60 truncate">{s.nombre}</p>
                {s.puesto && (
                  <p className="text-[9px] text-white/25 truncate">{s.puesto}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-white/20 italic">Sin supervisor asignado</span>
        )}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 border-t border-white/6">
        <button
          onClick={onAsignar}
          className="py-2.5 text-[11px] text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 border-r border-white/6"
        >
          <Layers className="w-3 h-3" /> Puestos
        </button>
        <button
          onClick={onDetalle}
          className="py-2.5 text-[11px] text-white/40 hover:text-white hover:bg-white/4 transition-colors flex items-center justify-center gap-1.5"
        >
          <ChevronRight className="w-3 h-3" /> Detalle
        </button>
      </div>
    </div>
  );
}

// ─── Modal: Detalle de zona ────────────────────────────────────────────────────

function ModalDetalle({
  zonaId,
  onClose,
}: {
  zonaId: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<ZonaDetalle>({
    queryKey: ["zona-detalle", zonaId],
    queryFn: () => fetch(`${API}/operaciones/zonas/${zonaId}/detalle`).then((r) => r.json()),
  });

  const zona = data?.zona;
  const grupos = data?.puestosAgrupados ?? [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0a1525] shrink-0">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">{zona?.nombre ?? "Cargando…"}</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
              <span className="text-sm text-white/40">Cargando…</span>
            </div>
          )}
          {zona && (
            <>
              {zona.descripcion && (
                <p className="text-xs text-white/40 bg-white/3 rounded-xl p-3">{zona.descripcion}</p>
              )}
              {zona.supervisor_nombre && (
                <div className="flex items-center gap-2.5 bg-[#0c1929] border border-white/8 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{zona.supervisor_nombre}</p>
                    <p className="text-[10px] text-white/35">Supervisor responsable de zona</p>
                  </div>
                </div>
              )}

              {grupos.length === 0 ? (
                <div className="text-center py-6">
                  <Layers className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/30">Esta zona no tiene puestos asignados aún.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {grupos.map((g) => (
                    <div key={g.cliente_nombre}>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-3 h-3 text-white/20" />
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{g.cliente_nombre}</p>
                        <span className="text-[9px] text-white/20 bg-white/4 px-1.5 py-0.5 rounded-full">{g.puestos.length} puestos</span>
                      </div>
                      <div className="space-y-1">
                        {g.puestos.map((p) => (
                          <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 bg-[#0c1929] rounded-xl border border-white/5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.estado === "cubierto" ? "bg-green-400" : "bg-red-400"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/70 truncate">{p.nombre}</p>
                              {p.sede_nombre && (
                                <p className="text-[9px] text-white/25">{p.sede_nombre}</p>
                              )}
                            </div>
                            {p.agente_nombre && (
                              <span className="text-[10px] text-white/40 truncate max-w-[100px]">{p.agente_nombre}</span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${p.estado === "cubierto" ? "text-green-400/70 bg-green-500/8 border-green-500/15" : "text-red-400/70 bg-red-500/8 border-red-500/15"}`}>
                              {p.estado}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-white/8">
          <button onClick={onClose} className="w-full py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ZonasOperativas() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [modalZona, setModalZona] = useState<Zona | null | "nuevo">(null);
  const [asignarZona, setAsignarZona] = useState<Zona | null>(null);
  const [detalleZonaId, setDetalleZonaId] = useState<number | null>(null);

  const { data: zonas = [], isLoading } = useQuery<Zona[]>({
    queryKey: ["operaciones-zonas"],
    queryFn: () => fetch(`${API}/operaciones/zonas`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: todosPuestos = [], refetch: refetchPuestos } = useQuery<PuestoAll[]>({
    queryKey: ["todos-puestos"],
    queryFn: () => fetch(`${API}/operaciones/todos-puestos`).then((r) => r.json()),
    enabled: !!asignarZona,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["operaciones-zonas"] });
    qc.invalidateQueries({ queryKey: ["todos-puestos"] });
  }

  async function handleDelete(zona: Zona) {
    if (!confirm(`¿Desactivar la zona "${zona.nombre}"?\n\nLos puestos asignados perderán su zona.`)) return;
    try {
      const r = await fetch(`${API}/operaciones/zonas/${zona.id}`, {
        method: "DELETE",
        headers: h(),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Zona desactivada", description: zona.nombre });
      invalidate();
    } catch {
      toast({ title: "Error al desactivar zona", variant: "destructive" });
    }
  }

  async function handleActivar(zona: Zona) {
    try {
      const r = await fetch(`${API}/operaciones/zonas/${zona.id}`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({ estado: "activo" }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Zona reactivada", description: zona.nombre });
      invalidate();
    } catch {
      toast({ title: "Error al reactivar zona", variant: "destructive" });
    }
  }

  const zonasActivas = zonas.filter((z) => z.estado === "activo");
  const zonasInactivas = zonas.filter((z) => z.estado !== "activo");

  // Métricas globales
  const totalPuestosCubiertos = zonasActivas.reduce((acc, z) => acc + z.puestos_cubiertos, 0);
  const totalPuestosZona = zonasActivas.reduce((acc, z) => acc + z.total_puestos, 0);

  return (
    <AdminLayout title="Zonas Operativas Globales">
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* Encabezado */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setLocation("/admin/operaciones")}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Volver al pizarrón
          </button>
          <span className="text-white/15">·</span>
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            <h1 className="text-base font-bold text-white">Zonas Operativas Globales</h1>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => { invalidate(); refetchPuestos(); }}
            className="p-2 text-white/30 hover:text-white border border-white/8 rounded-xl bg-[#0c1929] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setModalZona("nuevo")}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#07111f] bg-primary hover:bg-primary/90 rounded-xl px-3 py-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva zona
          </button>
        </div>

        {/* Explicación conceptual */}
        <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Map className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-300 mb-1">¿Qué es una zona operativa global?</p>
              <p className="text-[11px] text-blue-400/60 leading-relaxed">
                Una zona agrupa puestos de <strong className="text-blue-400/80">distintos clientes</strong> bajo
                la supervisión de un mismo responsable de zona. A diferencia del contrato del cliente (estructura
                comercial), la zona refleja la <strong className="text-blue-400/80">realidad operativa de campo</strong>:
                un supervisor puede vigilar puestos de Cervecería, Salvavidas y DistNac si todos están en la misma región.
                Esta estructura es la base para calcular costos de supervisión y reportes por zona.
              </p>
            </div>
          </div>
        </div>

        {/* Stats resumen */}
        {zonasActivas.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Zonas activas",     value: zonasActivas.length,      color: "text-primary" },
              { label: "Puestos en zonas",  value: totalPuestosZona,          color: "text-white" },
              { label: "Cubiertos en zonas",value: totalPuestosCubiertos,     color: "text-green-400" },
              { label: "Puestos sin zona",  value: todosPuestos.filter((p) => !p.zona_operativa_id).length, color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#07111f] border border-white/8 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-white/40">Cargando zonas…</span>
          </div>
        )}

        {/* Sin zonas */}
        {!isLoading && zonas.length === 0 && (
          <div className="bg-[#0a1525] border border-white/8 rounded-xl p-8 text-center">
            <Map className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40 mb-1">No hay zonas operativas configuradas</p>
            <p className="text-xs text-white/20 mb-4">
              Crea la primera zona para empezar a agrupar puestos por región.
            </p>
            <button
              onClick={() => setModalZona("nuevo")}
              className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 border border-primary/20 rounded-xl px-4 py-2 mx-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Crear primera zona
            </button>
          </div>
        )}

        {/* Grid de zonas activas */}
        {zonasActivas.length > 0 && (
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">
              Zonas activas ({zonasActivas.length})
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {zonasActivas.map((zona) => (
                <ZonaCard
                  key={zona.id}
                  zona={zona}
                  onEdit={() => setModalZona(zona)}
                  onDelete={() => handleDelete(zona)}
                  onAsignar={() => { setAsignarZona(zona); }}
                  onDetalle={() => setDetalleZonaId(zona.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Zonas inactivas */}
        {zonasInactivas.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-[10px] text-white/25 uppercase tracking-widest font-semibold hover:text-white/40 transition-colors select-none">
              Zonas inactivas ({zonasInactivas.length}) ▸
            </summary>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {zonasInactivas.map((zona) => (
                <ZonaCard
                  key={zona.id}
                  zona={zona}
                  onEdit={() => setModalZona(zona)}
                  onDelete={() => handleDelete(zona)}
                  onAsignar={() => setAsignarZona(zona)}
                  onDetalle={() => setDetalleZonaId(zona.id)}
                  onActivar={() => handleActivar(zona)}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Modals */}
      {modalZona !== null && (
        <ModalZona
          zona={modalZona === "nuevo" ? null : modalZona}
          onClose={() => setModalZona(null)}
          onSaved={() => { setModalZona(null); invalidate(); }}
        />
      )}

      {asignarZona && (
        <ModalAsignarPuestos
          zona={asignarZona}
          todosPuestos={todosPuestos}
          onClose={() => setAsignarZona(null)}
          onSaved={() => { setAsignarZona(null); invalidate(); refetchPuestos(); }}
        />
      )}

      {detalleZonaId !== null && (
        <ModalDetalle
          zonaId={detalleZonaId}
          onClose={() => setDetalleZonaId(null)}
        />
      )}
    </AdminLayout>
  );
}
