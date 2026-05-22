import { useState, useEffect } from "react";
  import { useQuery, useQueryClient } from "@tanstack/react-query";
  import { AdminLayout } from "../layout/AdminLayout";
  import {
    Users, Search, X, Loader2, RefreshCw, Plus, LayoutList, LayoutGrid,
  } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { getSessionToken } from "@/lib/httpClient";
  import {
    type Empleado, type FormState,
    API_BASE, sessionHeader, ESTADO_LAB,
  } from "./empleados/shared";
  import { EmpleadoCard, EmpleadoRow } from "./empleados/listado";
  import { FichaModal } from "./empleados/ficha-modal";
  import { FormModal } from "./empleados/form-modal";
  import { ReingresoModal } from "./empleados/estado";

  // ─── Página principal ─────────────────────────────────────────────────────────

export default function Empleados() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroArea, setFiltroArea] = useState<string>("todos");
  const [filtroTipoPersonal, setFiltroTipoPersonal] = useState<string>("todos");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroSede, setFiltroSede] = useState<string>("todos");
  const [vista, setVista] = useState<"tabla" | "tarjetas">("tabla");
  const [fichaAbierta, setFichaAbierta] = useState<Empleado | null>(null);
  const [formModal, setFormModal] = useState<{ modo: "crear" | "editar"; emp?: Empleado } | null>(null);
  const [reingresoPending, setReingresoPending] = useState<{
    existing: {
      id: number; nombreCompleto: string; estadoLaboral: string;
      fechaIngreso: string | null; fechaBaja: string | null; motivoBaja: string | null;
      puesto: string | null; area: string | null; periodosPrevios: number;
    };
    formData: Partial<FormState>;
  } | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: empleados = [], isLoading, isError, refetch } = useQuery<Empleado[]>({
    queryKey: ["empleados"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/employees`, { headers: sessionHeader() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Abre automáticamente la ficha si la URL tiene ?id=<employeeId>
  useEffect(() => {
    if (!empleados.length) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const emp = empleados.find((e) => String(e.id) === idParam);
    if (emp) {
      setFichaAbierta(emp);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [empleados]);

  // ─── Mutaciones ──────────────────────────────────────────────────────────────

  async function apiCall(url: string, method: string, body?: object) {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: "Error desconocido" }));
      throw new Error(err.error ?? "Error al guardar");
    }
    return r.json();
  }

  async function handleSave(data: Partial<FormState>) {
    if (formModal?.modo === "crear") {
      // POST directo para detectar 409 con código REINGRESO_DISPONIBLE
      const r = await fetch(`${API_BASE}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify(data),
      });
      if (r.status === 409) {
        const body = await r.json().catch(() => ({}));
        if (body.code === "REINGRESO_DISPONIBLE" && body.empleado) {
          setReingresoPending({ existing: body.empleado, formData: data });
          throw new Error(`${body.error} Revise el cuadro de reingreso.`);
        }
        throw new Error(body.error ?? "DPI duplicado");
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error ?? "Error al guardar");
      }
      toast({ title: "Colaborador creado", description: data.nombreCompleto });
    } else if (formModal?.emp) {
      await apiCall(`${API_BASE}/employees/${formModal.emp.id}`, "PATCH", data);
      toast({ title: "Colaborador actualizado", description: data.nombreCompleto });
    }
    qc.invalidateQueries({ queryKey: ["empleados"] });
  }

  async function confirmarReingreso() {
    if (!reingresoPending) return;
    const { existing, formData } = reingresoPending;
    try {
      const r = await fetch(`${API_BASE}/employees/${existing.id}/reingreso`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify(formData),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al registrar reingreso");
      }
      const data = await r.json();
      toast({
        title: "Reingreso registrado",
        description: `${existing.nombreCompleto} — período laboral #${data.numeroPeriodo}`,
      });
      setReingresoPending(null);
      setFormModal(null);
      qc.invalidateQueries({ queryKey: ["empleados"] });
    } catch (e: unknown) {
      toast({
        title: "Error en reingreso",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }

  async function handleEstado(
    emp: Empleado,
    estado: string,
    extras?: { fechaDesde?: string; fechaHasta?: string; observaciones?: string },
  ) {
    try {
      const body: Record<string, unknown> = { estadoLaboral: estado };
      if (extras?.fechaDesde)    body.fechaDesde    = extras.fechaDesde;
      if (extras?.fechaHasta)    body.fechaHasta    = extras.fechaHasta;
      if (extras?.observaciones) body.observaciones = extras.observaciones;
      const updated = await apiCall(`${API_BASE}/employees/${emp.id}/estado`, "PATCH", body);
      const desc = estado === "suspendido" && extras?.fechaDesde && extras?.fechaHasta
        ? `${emp.nombreCompleto} suspendido del ${extras.fechaDesde} al ${extras.fechaHasta} — evento RRHH creado`
        : `${emp.nombreCompleto} → ${ESTADO_LAB[estado]?.label ?? estado}`;
      toast({ title: "Estado actualizado", description: desc });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      qc.invalidateQueries({ queryKey: ["rrhh-eventos"] });
      qc.invalidateQueries({ queryKey: ["novedades-nomina"] });
      if (fichaAbierta?.id === emp.id) setFichaAbierta(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cambiar el estado";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────────

  const areas = Array.from(new Set(empleados.map((e) => e.area).filter(Boolean))) as string[];
  const clientes = Array.from(new Set(empleados.map((e) => e.clienteNombre).filter(Boolean))).sort() as string[];
  // Las sedes se derivan en cascada del cliente seleccionado:
  // si hay cliente, solo mostramos sedes de ese cliente; si no, todas las sedes.
  const sedes = Array.from(new Set(
    empleados
      .filter((e) => {
        if (filtroCliente === "todos") return true;
        if (filtroCliente === "__sin_cliente__") return !e.clienteNombre;
        return e.clienteNombre === filtroCliente;
      })
      .map((e) => e.sede)
      .filter(Boolean),
  )).sort() as string[];

  const filtrados = empleados.filter((e) => {
    if (filtroEstado !== "todos" && e.estadoLaboral !== filtroEstado) return false;
    if (filtroArea !== "todos" && e.area !== filtroArea) return false;
    if (filtroTipoPersonal !== "todos" && (e.tipoPersonal ?? "guardia") !== filtroTipoPersonal) return false;
    if (filtroCliente !== "todos") {
      if (filtroCliente === "__sin_cliente__") {
        if (e.clienteNombre) return false;
      } else {
        if (e.clienteNombre !== filtroCliente) return false;
      }
    }
    if (filtroSede !== "todos") {
      if (filtroSede === "__sin_sede__") {
        if (e.sede) return false;
      } else {
        if (e.sede !== filtroSede) return false;
      }
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        e.nombreCompleto.toLowerCase().includes(q) ||
        e.puesto?.toLowerCase().includes(q) ||
        e.area?.toLowerCase().includes(q) ||
        e.sede?.toLowerCase().includes(q) ||
        e.dpi?.includes(q) ||
        e.telefono?.includes(q) ||
        e.telefonoSecundario?.includes(q)
      );
    }
    return true;
  });

  // ─── Stats rápidas ───────────────────────────────────────────────────────────

  const total = empleados.length;
  const activos = empleados.filter((e) => e.estadoLaboral === "activo").length;
  const suspendidos = empleados.filter((e) => e.estadoLaboral === "suspendido" || e.estadoLaboral === "baja").length;
  const conDpi = empleados.filter((e) => e.dpi).length;

  return (
    <AdminLayout title="Colaboradores">
      <div className="space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{total}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Total</p>
          </div>
          <div className="bg-[#0c1929] border border-green-500/15 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{activos}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Activos</p>
          </div>
          <div className="bg-[#0c1929] border border-yellow-500/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{suspendidos}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Suspendidos / Baja</p>
          </div>
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{conDpi}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Con DPI registrado</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              placeholder="Buscar por nombre, DPI, teléfono, área…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-[#0c1929] border border-white/8 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-primary/40"
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="baja">Baja</option>
            <option value="licencia">Licencia</option>
            <option value="inactivo">Inactivo</option>
          </select>

          {areas.length > 0 && (
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer"
            >
              <option value="todos">Todas las áreas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          <select
            value={filtroTipoPersonal}
            onChange={(e) => setFiltroTipoPersonal(e.target.value)}
            className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer"
          >
            <option value="todos">Todos los tipos</option>
            <option value="guardia">Guardia</option>
            <option value="supervisor">Supervisor</option>
            <option value="jefe_servicio">Jefe de Servicio</option>
            <option value="administrativo_bodega">Bodega</option>
            <option value="administrativo_rrhh">RRHH</option>
            <option value="gerencia">Gerencia</option>
          </select>

          {clientes.length > 0 && (
            <select
              value={filtroCliente}
              onChange={(e) => {
                setFiltroCliente(e.target.value);
                setFiltroSede("todos"); // reset sede al cambiar de cliente
              }}
              className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="todos">Todos los clientes</option>
              <option value="__sin_cliente__">— Sin cliente (disponible)</option>
              {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {sedes.length > 0 && (
            <select
              value={filtroSede}
              onChange={(e) => setFiltroSede(e.target.value)}
              className="bg-[#0c1929] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:border-primary/40 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="todos">Todas las sedes</option>
              <option value="__sin_sede__">— Sin sede asignada</option>
              {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* Toggle vista */}
          <div className="flex items-center bg-[#0c1929] border border-white/8 rounded-lg overflow-hidden">
            <button
              onClick={() => setVista("tabla")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${vista === "tabla" ? "bg-primary/20 text-primary" : "text-white/40 hover:text-white"}`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Tabla
            </button>
            <button
              onClick={() => setVista("tarjetas")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${vista === "tarjetas" ? "bg-primary/20 text-primary" : "text-white/40 hover:text-white"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Tarjetas
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white border border-white/8 rounded-lg px-3 py-2 transition-colors bg-[#0c1929]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setFormModal({ modo: "crear" })}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg px-3 py-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo
          </button>
        </div>

        {/* Resultados */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-white/40">Cargando colaboradores…</span>
          </div>
        )}

        {isError && (
          <div className="text-center py-10">
            <p className="text-red-400 text-sm">Error al cargar datos.</p>
          </div>
        )}

        {!isLoading && !isError && filtrados.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">
              {empleados.length === 0 ? "No hay colaboradores registrados." : "Sin resultados para los filtros aplicados."}
            </p>
            {empleados.length === 0 && (
              <button
                onClick={() => setFormModal({ modo: "crear" })}
                className="mt-4 flex items-center gap-2 mx-auto text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4" /> Crear primer colaborador
              </button>
            )}
          </div>
        )}

        {/* Vista tabla */}
        {!isLoading && !isError && filtrados.length > 0 && vista === "tabla" && (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <p className="text-xs text-white/40">{filtrados.length} colaboradore{filtrados.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Colaborador</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">DPI</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Teléfono</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Puesto / Área</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Supervisor</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Tipo</th>
                    <th className="px-4 py-2.5 text-[10px] text-white/30 uppercase tracking-widest font-semibold">Estado</th>
                    <th className="px-4 py-2.5 text-right text-[10px] text-white/30 uppercase tracking-widest font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((e) => (
                    <EmpleadoRow
                      key={e.id}
                      emp={e}
                      onClick={() => setFichaAbierta(e)}
                      onEdit={() => setFormModal({ modo: "editar", emp: e })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vista tarjetas */}
        {!isLoading && !isError && filtrados.length > 0 && vista === "tarjetas" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtrados.map((e) => (
              <EmpleadoCard key={e.id} emp={e} onClick={() => setFichaAbierta(e)} />
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      {fichaAbierta && (
        <FichaModal
          emp={fichaAbierta}
          onClose={() => setFichaAbierta(null)}
          onEdit={(e) => { setFichaAbierta(null); setFormModal({ modo: "editar", emp: e }); }}
          onEstado={handleEstado}
        />
      )}

      {formModal && (
        <FormModal
          modo={formModal.modo}
          emp={formModal.emp}
          onClose={() => setFormModal(null)}
          onSave={handleSave}
        />
      )}

      {reingresoPending && (
        <ReingresoModal
          existing={reingresoPending.existing}
          onConfirm={confirmarReingreso}
          onCancel={() => setReingresoPending(null)}
        />
      )}
    </AdminLayout>
  );
}
  