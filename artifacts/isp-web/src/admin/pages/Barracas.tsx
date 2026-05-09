import { useState, useEffect, useCallback } from "react";
import {
  Home, Users, Plus, Edit2, X, Check, Loader2, Search,
  UserPlus, UserMinus, MapPin, DollarSign, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "../layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { getSessionToken } from "@/lib/httpClient";

function getSession() {
  return getSessionToken();
}
function api(path: string, opts?: RequestInit) {
  return fetch(path, {
    ...opts,
    headers: {
      "x-isp-session": getSession(),
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
}

interface Barraca {
  id: number;
  nombre: string;
  direccion: string | null;
  departamento: string | null;
  municipio: string | null;
  cuota_mensual: string;
  capacidad: number;
  notas: string | null;
  activo: boolean;
  ocupantes: number;
}

interface Asignacion {
  id: number;
  barraca_id: number;
  employee_id: number;
  nombre_completo: string;
  dpi: string | null;
  telefono: string | null;
  estado_laboral: string;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  activo: boolean;
  fecha_inicio: string;
  fecha_fin: string | null;
  notas: string | null;
}

interface BarracaDetalle extends Barraca {
  asignaciones: Asignacion[];
}

interface Empleado {
  id: number;
  nombre_completo: string;
  dpi: string | null;
  puesto: string | null;
}

export default function Barracas() {
  const { toast } = useToast();
  const [barracas, setBarracas] = useState<Barraca[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<BarracaDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: "", direccion: "", departamento: "", municipio: "",
    cuota_mensual: "", capacidad: "10", notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [showAsignar, setShowAsignar] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<Empleado[]>([]);
  const [searchingEmp, setSearchingEmp] = useState(false);
  const [asignando, setAsignando] = useState(false);

  const loadBarracas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/api/barracas");
      if (res.ok) setBarracas(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadDetalle = useCallback(async (id: number) => {
    setLoadingDetalle(true);
    try {
      const res = await api(`/api/barracas/${id}`);
      if (res.ok) setDetalle(await res.json());
    } catch { /* ignore */ }
    setLoadingDetalle(false);
  }, []);

  useEffect(() => { loadBarracas(); }, [loadBarracas]);

  useEffect(() => {
    if (selectedId) loadDetalle(selectedId);
    else setDetalle(null);
  }, [selectedId, loadDetalle]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ nombre: "", direccion: "", departamento: "", municipio: "", cuota_mensual: "", capacidad: "10", notas: "" });
    setShowForm(true);
  };

  const openEdit = (b: Barraca) => {
    setEditingId(b.id);
    setFormData({
      nombre: b.nombre,
      direccion: b.direccion || "",
      departamento: b.departamento || "",
      municipio: b.municipio || "",
      cuota_mensual: String(b.cuota_mensual),
      capacidad: String(b.capacidad),
      notas: b.notas || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }
    if (!formData.cuota_mensual || parseFloat(formData.cuota_mensual) < 0) {
      toast({ title: "La cuota mensual es requerida", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        nombre: formData.nombre.trim(),
        direccion: formData.direccion || null,
        departamento: formData.departamento || null,
        municipio: formData.municipio || null,
        cuota_mensual: parseFloat(formData.cuota_mensual),
        capacidad: parseInt(formData.capacidad) || 10,
        notas: formData.notas || null,
      };
      const res = editingId
        ? await api(`/api/barracas/${editingId}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api("/api/barracas", { method: "POST", body: JSON.stringify(body) });

      if (res.ok) {
        toast({ title: editingId ? "Barraca actualizada" : "Barraca creada" });
        setShowForm(false);
        loadBarracas();
        if (editingId && selectedId === editingId) loadDetalle(editingId);
      } else {
        const err = await res.json();
        toast({ title: err.error || "Error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
    setSaving(false);
  };

  const searchEmpleados = async (q: string) => {
    setEmpSearch(q);
    if (q.length < 2) { setEmpResults([]); return; }
    setSearchingEmp(true);
    try {
      const res = await api(`/api/employees?q=${encodeURIComponent(q)}&estadoLaboral=activo`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.empleados || [];
        setEmpResults(list.slice(0, 10).map((e: any) => ({
          id: e.id,
          nombre_completo: e.nombre_completo,
          dpi: e.dpi,
          puesto: e.puesto,
        })));
      }
    } catch { /* ignore */ }
    setSearchingEmp(false);
  };

  const asignarEmpleado = async (empId: number) => {
    if (!selectedId) return;
    setAsignando(true);
    try {
      const res = await api(`/api/barracas/${selectedId}/asignar`, {
        method: "POST",
        body: JSON.stringify({ employeeId: empId }),
      });
      if (res.ok) {
        toast({ title: "Empleado asignado a barraca" });
        setShowAsignar(false);
        setEmpSearch("");
        setEmpResults([]);
        loadDetalle(selectedId);
        loadBarracas();
      } else {
        const err = await res.json();
        toast({ title: err.error || "Error al asignar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
    setAsignando(false);
  };

  const desasignar = async (asigId: number) => {
    if (!confirm("¿Desasignar a este empleado de la barraca?")) return;
    try {
      const res = await api(`/api/barracas/desasignar/${asigId}`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Empleado desasignado" });
        if (selectedId) loadDetalle(selectedId);
        loadBarracas();
      } else {
        const err = await res.json();
        toast({ title: err.error || "Error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  };

  const toggleActivo = async (b: Barraca) => {
    try {
      const res = await api(`/api/barracas/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !b.activo }),
      });
      if (res.ok) {
        toast({ title: b.activo ? "Barraca desactivada" : "Barraca activada" });
        loadBarracas();
        if (selectedId === b.id) loadDetalle(b.id);
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  };

  return (
    <AdminLayout title="Barracas" subtitle="Gestión de viviendas empresariales">
      <div className="flex gap-6 h-[calc(100vh-180px)]">
        {/* Left panel: list */}
        <div className="w-[380px] flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button onClick={openCreate} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" /> Nueva Barraca
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : barracas.length === 0 ? (
            <div className="text-zinc-500 text-center py-12">No hay barracas registradas</div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto">
              {barracas.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedId === b.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-sm">{b.nombre}</span>
                    </div>
                    <Badge variant={b.activo ? "default" : "secondary"} className={`text-[10px] ${b.activo ? "bg-green-500/20 text-green-400" : "bg-zinc-600/30 text-zinc-500"}`}>
                      {b.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  {b.direccion && (
                    <div className="text-xs text-zinc-500 flex items-center gap-1 mb-1">
                      <MapPin className="w-3 h-3" /> {b.direccion}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {b.ocupantes}/{b.capacidad}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Q{parseFloat(b.cuota_mensual).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: detail */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selectedId ? (
            <div className="flex items-center justify-center h-full text-zinc-500">
              <div className="text-center">
                <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Selecciona una barraca para ver sus detalles</p>
              </div>
            </div>
          ) : loadingDetalle ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : detalle ? (
            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Home className="w-5 h-5 text-blue-400" />
                    {detalle.nombre}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(detalle)}>
                      <Edit2 className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={detalle.activo ? "destructive" : "default"}
                      onClick={() => toggleActivo(detalle)}
                    >
                      {detalle.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-zinc-500">Cuota Mensual</span>
                    <p className="font-mono font-semibold text-green-400">Q{parseFloat(detalle.cuota_mensual).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Capacidad</span>
                    <p className="font-semibold">{detalle.ocupantes} / {detalle.capacidad}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Ubicación</span>
                    <p>{[detalle.direccion, detalle.municipio, detalle.departamento].filter(Boolean).join(", ") || "—"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Estado</span>
                    <p>
                      <Badge className={detalle.activo ? "bg-green-500/20 text-green-400" : "bg-zinc-600/30 text-zinc-500"}>
                        {detalle.activo ? "Activa" : "Inactiva"}
                      </Badge>
                    </p>
                  </div>
                </div>
                {detalle.notas && (
                  <div className="mt-3 text-sm text-zinc-400 flex items-start gap-1">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {detalle.notas}
                  </div>
                )}
              </div>

              {/* Occupants */}
              <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Ocupantes ({detalle.asignaciones?.filter(a => a.activo).length || 0})
                  </h3>
                  {detalle.activo && (
                    <Button size="sm" onClick={() => { setShowAsignar(true); setEmpSearch(""); setEmpResults([]); }}>
                      <UserPlus className="w-3 h-3 mr-1" /> Asignar
                    </Button>
                  )}
                </div>

                {showAsignar && (
                  <div className="mb-4 p-3 bg-zinc-900 rounded-lg border border-zinc-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Buscar empleado por nombre o DPI..."
                        value={empSearch}
                        onChange={(e) => searchEmpleados(e.target.value)}
                        className="flex-1 bg-transparent text-sm border-none outline-none text-white placeholder:text-zinc-500"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={() => setShowAsignar(false)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {searchingEmp && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
                    {empResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {empResults.map((emp) => (
                          <div
                            key={emp.id}
                            className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded cursor-pointer"
                            onClick={() => !asignando && asignarEmpleado(emp.id)}
                          >
                            <div>
                              <div className="text-sm font-medium">{emp.nombre_completo}</div>
                              <div className="text-xs text-zinc-500">{emp.dpi || "Sin DPI"} {emp.puesto ? `• ${emp.puesto}` : ""}</div>
                            </div>
                            <UserPlus className="w-4 h-4 text-green-400" />
                          </div>
                        ))}
                      </div>
                    )}
                    {empSearch.length >= 2 && !searchingEmp && empResults.length === 0 && (
                      <p className="text-xs text-zinc-500 mt-1">Sin resultados</p>
                    )}
                  </div>
                )}

                {(detalle.asignaciones?.filter(a => a.activo) || []).length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">No hay ocupantes asignados</p>
                ) : (
                  <div className="space-y-2">
                    {detalle.asignaciones.filter(a => a.activo).map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-zinc-900/50 rounded-lg border border-zinc-700">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{a.nombre_completo}</div>
                          <div className="text-xs text-zinc-500">
                            {a.dpi || "Sin DPI"}
                            {a.puesto_nombre && ` • ${a.puesto_nombre}`}
                            {a.cliente_nombre && ` (${a.cliente_nombre})`}
                          </div>
                          <div className="text-xs text-zinc-600">Desde: {a.fecha_inicio}</div>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => desasignar(a.id)}>
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Historial de asignaciones pasadas */}
                {(detalle.asignaciones?.filter(a => !a.activo) || []).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Historial</h4>
                    <div className="space-y-1">
                      {detalle.asignaciones.filter(a => !a.activo).map((a) => (
                        <div key={a.id} className="flex items-center gap-2 p-2 bg-zinc-900/30 rounded text-sm text-zinc-500">
                          <span>{a.nombre_completo}</span>
                          <span className="text-xs">{a.fecha_inicio} → {a.fecha_fin || "?"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-400" />
              {editingId ? "Editar Barraca" : "Nueva Barraca"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white"
                  placeholder="Ej: Casa Zona 5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Cuota Mensual (Q) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cuota_mensual}
                    onChange={(e) => setFormData({ ...formData, cuota_mensual: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white"
                    placeholder="200.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Capacidad</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacidad}
                    onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Dirección</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white"
                  placeholder="Dirección de la propiedad"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Departamento</label>
                  <input
                    type="text"
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white"
                    placeholder="Guatemala"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Municipio</label>
                  <input
                    type="text"
                    value={formData.municipio}
                    onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white"
                    placeholder="Guatemala"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white resize-none"
                  rows={2}
                  placeholder="Observaciones opcionales"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                {editingId ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
