import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Truck, AlertTriangle, Shield, Loader2, RefreshCw, User, Users,
  Calendar, Save, Printer, Plus, X, Search, ChevronDown, ChevronUp,
  Check, Clock, UserPlus, UserMinus,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface ClienteCustodia {
  clienteId: number;
  clienteNombre: string;
  fuerzaHoy: number;
  totalTitulares: number;
  titularesPresentes: number;
  titularesFaltantes: { employeeId: number; nombre: string; codigo: string }[];
  extras: { employeeId: number; nombre: string; codigo: string; notas: string | null }[];
  totalAsignados: number;
  pendientes: number;
  asignaciones: {
    employeeId: number;
    nombre: string;
    codigo: string;
    notas: string | null;
    esTitular: boolean;
  }[];
}

interface PoolAgent {
  id: number;
  nombre_completo: string;
  codigo: string;
  estado_laboral: string;
  tipo_personal: string;
}

interface HojaImprimible {
  clienteNombre: string;
  fecha: string;
  agentes: {
    employeeId: number;
    nombre: string;
    codigoEmpleado: string;
    armaMarca: string;
    armaSerie: string;
    armaTipo: string;
    municion: number;
  }[];
}

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() - 360);
  return d.toISOString().split("T")[0];
}

export default function Custodias() {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(todayLocal());
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [showFuerzaEditor, setShowFuerzaEditor] = useState<number | null>(null);
  const [showAsignar, setShowAsignar] = useState<number | null>(null);
  const [showHoja, setShowHoja] = useState<number | null>(null);
  const [busquedaPool, setBusquedaPool] = useState("");

  const { data: dashboard = [], isLoading, isError, refetch, isFetching } = useQuery<ClienteCustodia[]>({
    queryKey: ["custodias-dashboard", fecha],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/dashboard?fecha=${fecha}`, { credentials: "include" });
      if (!r.ok) throw new Error("Error al cargar");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const totalFuerza = dashboard.reduce((s, c) => s + c.fuerzaHoy, 0);
  const totalAsignados = dashboard.reduce((s, c) => s + c.totalAsignados, 0);
  const totalPendientes = dashboard.reduce((s, c) => s + c.pendientes, 0);

  return (
    <AdminLayout title="Control de Custodias">
      <div className="space-y-5 max-w-[1400px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
            </div>
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 border border-white/8 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {!isLoading && !isError && dashboard.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Fuerza del día</p>
              <p className="text-2xl font-bold text-white">{totalFuerza}</p>
            </div>
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Asignados</p>
              <p className="text-2xl font-bold text-green-400">{totalAsignados}</p>
            </div>
            <div className={`bg-[#0c1829] border rounded-xl p-4 ${totalPendientes > 0 ? "border-amber-500/20" : "border-white/5"}`}>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Pendientes</p>
              <p className={`text-2xl font-bold ${totalPendientes > 0 ? "text-amber-400" : "text-white/30"}`}>{totalPendientes}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-white/30 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando custodias…</span>
          </div>
        )}

        {isError && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
            Error al cargar las custodias. Verifica la conexión con el servidor.
          </div>
        )}

        {!isLoading && !isError && dashboard.length === 0 && (
          <div className="text-center py-14">
            <Truck className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white/30">No hay clientes de custodia configurados</p>
            <p className="text-xs text-white/20 mt-1 max-w-sm mx-auto">
              Para activar un cliente como custodia, edítalo y cambia su tipo de servicio a "Custodia".
            </p>
          </div>
        )}

        {!isLoading && !isError && dashboard.map(cl => (
          <ClienteCard
            key={cl.clienteId}
            cliente={cl}
            fecha={fecha}
            expanded={expandedClient === cl.clienteId}
            onToggle={() => setExpandedClient(expandedClient === cl.clienteId ? null : cl.clienteId)}
            showFuerzaEditor={showFuerzaEditor === cl.clienteId}
            onToggleFuerza={() => setShowFuerzaEditor(showFuerzaEditor === cl.clienteId ? null : cl.clienteId)}
            showAsignar={showAsignar === cl.clienteId}
            onToggleAsignar={() => { setShowAsignar(showAsignar === cl.clienteId ? null : cl.clienteId); setBusquedaPool(""); }}
            showHoja={showHoja === cl.clienteId}
            onToggleHoja={() => setShowHoja(showHoja === cl.clienteId ? null : cl.clienteId)}
            busquedaPool={busquedaPool}
            onBusquedaPool={setBusquedaPool}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["custodias-dashboard"] })}
          />
        ))}
      </div>
    </AdminLayout>
  );
}

function ClienteCard({
  cliente: cl, fecha, expanded, onToggle,
  showFuerzaEditor, onToggleFuerza,
  showAsignar, onToggleAsignar,
  showHoja, onToggleHoja,
  busquedaPool, onBusquedaPool,
  onRefresh,
}: {
  cliente: ClienteCustodia;
  fecha: string;
  expanded: boolean;
  onToggle: () => void;
  showFuerzaEditor: boolean;
  onToggleFuerza: () => void;
  showAsignar: boolean;
  onToggleAsignar: () => void;
  showHoja: boolean;
  onToggleHoja: () => void;
  busquedaPool: string;
  onBusquedaPool: (v: string) => void;
  onRefresh: () => void;
}) {
  const pct = cl.fuerzaHoy > 0 ? Math.round((cl.totalAsignados / cl.fuerzaHoy) * 100) : 0;
  const barColor = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="bg-[#0c1829] border border-white/6 rounded-xl overflow-hidden">
      <button onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/2 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left min-w-0">
            <p className="font-bold text-white text-sm truncate">{cl.clienteNombre}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] text-white/30">Fuerza: <strong className="text-white/60">{cl.fuerzaHoy}</strong></span>
              <span className="text-[10px] text-white/30">Titulares: <strong className="text-white/60">{cl.totalTitulares}</strong></span>
              <span className="text-[10px] text-white/30">Asignados: <strong className={cl.totalAsignados >= cl.fuerzaHoy ? "text-green-400" : "text-amber-400"}>{cl.totalAsignados}</strong></span>
              {cl.pendientes > 0 && (
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {cl.pendientes} pendientes
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="text-xs font-bold text-white/40 w-10 text-right">{pct}%</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={onToggleAsignar}
              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${showAsignar ? "bg-primary/15 border-primary/30 text-primary" : "border-white/10 text-white/50 hover:text-white/80"}`}>
              <UserPlus className="w-3 h-3" /> Asignar agentes
            </button>
            <button onClick={onToggleFuerza}
              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${showFuerzaEditor ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "border-white/10 text-white/50 hover:text-white/80"}`}>
              <Calendar className="w-3 h-3" /> Fuerza semanal
            </button>
            <button onClick={onToggleHoja}
              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${showHoja ? "bg-green-500/15 border-green-500/30 text-green-300" : "border-white/10 text-white/50 hover:text-white/80"}`}>
              <Printer className="w-3 h-3" /> Hoja imprimible
            </button>
          </div>

          {showFuerzaEditor && <FuerzaEditor clienteId={cl.clienteId} onSaved={onRefresh} />}
          {showAsignar && <AsignarPanel clienteId={cl.clienteId} fecha={fecha} busqueda={busquedaPool} onBusqueda={onBusquedaPool} onChanged={onRefresh} />}
          {showHoja && <HojaImprimiblePanel clienteId={cl.clienteId} fecha={fecha} />}

          {cl.asignaciones.length > 0 && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Agentes asignados hoy ({cl.asignaciones.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {cl.asignaciones.map(a => (
                  <div key={a.employeeId} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${a.esTitular ? "bg-green-500/5 border-green-500/15" : "bg-blue-500/5 border-blue-500/15"}`}>
                    <div className="min-w-0">
                      <p className="text-xs text-white/70 font-medium truncate">{a.nombre}</p>
                      <p className="text-[10px] text-white/30">{a.codigo || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${a.esTitular ? "bg-green-500/15 text-green-300" : "bg-blue-500/15 text-blue-300"}`}>
                        {a.esTitular ? "TITULAR" : "EXTRA"}
                      </span>
                      <RemoveButton clienteId={cl.clienteId} employeeId={a.employeeId} fecha={fecha} nombre={a.nombre} onRemoved={onRefresh} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cl.titularesFaltantes.length > 0 && (
            <div>
              <p className="text-[10px] text-red-400/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Titulares no asignados hoy ({cl.titularesFaltantes.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {cl.titularesFaltantes.map(t => (
                  <AsignarTitularChip
                    key={t.employeeId}
                    clienteId={cl.clienteId}
                    employeeId={t.employeeId}
                    nombre={t.nombre}
                    fecha={fecha}
                    onAsignado={onRefresh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RemoveButton({ clienteId, employeeId, fecha, nombre, onRemoved }: {
  clienteId: number; employeeId: number; fecha: string; nombre?: string; onRemoved: () => void;
}) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const puede = currentUser?.rol === "admin" || currentUser?.rol === "operaciones";

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/desasignar`, {
        method: "DELETE", credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "",
        },
        body: JSON.stringify({ fecha, employeeId }),
      });
      if (!r.ok) {
        const msg = await r.json().catch(() => ({ error: "Error al quitar custodio" }));
        throw new Error(msg.error || "Error al quitar custodio");
      }
    },
    onSuccess: () => {
      toast({ title: "Custodio removido", description: nombre ? `${nombre} ya no está asignado` : "Asignación eliminada" });
      onRemoved();
    },
    onError: (e: any) => {
      toast({ title: "No se pudo quitar", description: e?.message || "Error", variant: "destructive" });
    },
  });

  if (!puede) return null;

  return (
    <button
      onClick={() => {
        if (window.confirm(`¿Quitar a ${nombre || "este custodio"} del servicio?`)) mut.mutate();
      }}
      disabled={mut.isPending}
      className="text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-30"
      title="Quitar custodio (solo si no ha iniciado el servicio)"
    >
      {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
    </button>
  );
}

function AsignarTitularChip({ clienteId, employeeId, nombre, fecha, onAsignado }: {
  clienteId: number; employeeId: number; nombre: string; fecha: string; onAsignado: () => void;
}) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const puede = currentUser?.rol === "admin" || currentUser?.rol === "operaciones";

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/asignar`, {
        method: "POST", credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "",
        },
        body: JSON.stringify({ fecha, employeeId }),
      });
      if (!r.ok) {
        const msg = await r.json().catch(() => ({ error: "Error al asignar" }));
        throw new Error(msg.error || "Error al asignar");
      }
    },
    onSuccess: () => {
      toast({ title: "Titular asignado", description: `${nombre} ahora aparece como TITULAR del día` });
      onAsignado();
    },
    onError: (e: any) => {
      toast({ title: "No se pudo asignar", description: e?.message || "Error", variant: "destructive" });
    },
  });

  if (!puede) {
    return (
      <span className="text-[10px] px-2 py-1 rounded border bg-red-500/5 border-red-500/15 text-red-300/60">
        {nombre}
      </span>
    );
  }

  return (
    <button
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      title={`Asignar a ${nombre} como titular del día`}
      className="text-[10px] px-2 py-1 rounded border bg-red-500/5 border-red-500/15 text-red-300/70 hover:bg-green-500/15 hover:border-green-500/30 hover:text-green-300 transition-colors flex items-center gap-1.5 disabled:opacity-40"
    >
      {mut.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <UserPlus className="w-2.5 h-2.5 opacity-70" />}
      {nombre}
    </button>
  );
}

function FuerzaEditor({ clienteId, onSaved }: { clienteId: number; onSaved: () => void }) {
  const [fuerza, setFuerza] = useState<Record<number, number>>({});
  const [loaded, setLoaded] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["custodia-fuerza", clienteId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/fuerza`, { credentials: "include" });
      if (!r.ok) throw new Error("Error");
      const data = await r.json();
      setFuerza(data.fuerza);
      setLoaded(true);
      return data;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/fuerza`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fuerza }),
      });
      if (!r.ok) throw new Error("Error");
    },
    onSuccess: onSaved,
  });

  if (isLoading || !loaded) {
    return <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>;
  }

  return (
    <div className="bg-[#060e1c] border border-white/8 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-white/50 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Fuerza requerida por día</p>
      <div className="grid grid-cols-7 gap-2">
        {DIAS.map((dia, i) => (
          <div key={i} className="text-center">
            <p className="text-[9px] text-white/30 mb-1">{dia.slice(0, 3)}</p>
            <input
              type="number" min={0} value={fuerza[i] ?? 0}
              onChange={e => setFuerza(prev => ({ ...prev, [i]: parseInt(e.target.value) || 0 }))}
              className="w-full bg-[#0c1829] border border-white/10 rounded-lg px-2 py-1.5 text-center text-sm text-white font-bold outline-none focus:border-primary/40"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="flex items-center gap-1.5 text-xs px-4 py-2 bg-primary/15 border border-primary/30 text-primary rounded-lg font-semibold hover:bg-primary/25 transition-colors disabled:opacity-40">
          {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Guardar
        </button>
      </div>
      {saveMut.isSuccess && <p className="text-[10px] text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</p>}
    </div>
  );
}

function AsignarPanel({ clienteId, fecha, busqueda, onBusqueda, onChanged }: {
  clienteId: number; fecha: string; busqueda: string; onBusqueda: (v: string) => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: pool = [], isLoading } = useQuery<PoolAgent[]>({
    queryKey: ["custodia-pool", fecha],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/pool-disponible?fecha=${fecha}`, { credentials: "include" });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
  });

  const asignarMut = useMutation({
    mutationFn: async (employeeId: number) => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/asignar`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, employeeId }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo asignar el agente");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custodia-pool", fecha] });
      onChanged();
    },
    onError: (e: Error) => {
      toast({ title: "Error al asignar", description: e.message, variant: "destructive" });
    },
  });

  const filtered = pool.filter(a => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return a.nombre_completo?.toLowerCase().includes(q) || a.codigo?.toLowerCase().includes(q);
  });

  return (
    <div className="bg-[#060e1c] border border-white/8 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="w-3 h-3 text-white/30" />
        <input
          type="text" value={busqueda} onChange={e => onBusqueda(e.target.value)}
          placeholder="Buscar agente por nombre o código…"
          className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-white/20"
        />
      </div>
      {isLoading ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filtered.slice(0, 50).map(a => (
            <div key={a.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/3 transition-colors">
              <div className="min-w-0">
                <p className="text-xs text-white/70 truncate">{a.nombre_completo}</p>
                <p className="text-[10px] text-white/25">{a.codigo || "Sin código"} · {a.tipo_personal}</p>
              </div>
              <button onClick={() => asignarMut.mutate(a.id)} disabled={asignarMut.isPending}
                className="text-xs px-2 py-1 bg-primary/10 border border-primary/20 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-30 shrink-0">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-white/20 text-center py-4">No se encontraron agentes disponibles</p>
          )}
          {filtered.length > 50 && (
            <p className="text-[10px] text-white/20 text-center">Mostrando 50 de {filtered.length} — refina tu búsqueda</p>
          )}
        </div>
      )}
    </div>
  );
}

function HojaImprimiblePanel({ clienteId, fecha }: { clienteId: number; fecha: string }) {
  const { data, isLoading } = useQuery<HojaImprimible>({
    queryKey: ["custodia-hoja", clienteId, fecha],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/hoja-imprimible?fecha=${fecha}`, { credentials: "include" });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
  });

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w || !data) return;
    const fechaFmt = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-GT", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric"
    });
    w.document.write(`<!DOCTYPE html><html><head><title>Hoja de Custodia — ${data.clienteNombre}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
      h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
      h2 { font-size: 12px; text-align: center; font-weight: normal; color: #555; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
      th { background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 9px; }
      td.center { text-align: center; }
      .firma { min-width: 80px; }
      .empty { color: #999; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    <h1>${data.clienteNombre}</h1>
    <h2>${fechaFmt}</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Marca</th>
          <th>Serie</th>
          <th>Código</th>
          <th>No.</th>
          <th>Nombres y Apellidos</th>
          <th>Munición</th>
          <th class="firma">Firma</th>
        </tr>
      </thead>
      <tbody>
        ${data.agentes.map((a, i) => `
          <tr>
            <td class="center">${i + 1}</td>
            <td>${a.armaMarca || '<span class="empty">—</span>'}</td>
            <td>${a.armaSerie || '<span class="empty">—</span>'}</td>
            <td></td>
            <td></td>
            <td>${a.nombre}</td>
            <td class="center">${a.municion || ""}</td>
            <td class="firma"></td>
          </tr>
        `).join("")}
        ${Array.from({ length: Math.max(0, 5 - (data?.agentes?.length ?? 0)) }, (_, i) => `
          <tr>
            <td class="center">${(data?.agentes?.length ?? 0) + i + 1}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td class="firma"></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <p style="font-size:9px; color:#888; margin-top:10px; text-align:left;">
      ESCOPETA CON SU AUTÉNTICA DE PORTACIÓN &nbsp;|&nbsp; Código y No. = asignado por el cliente
    </p>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  if (isLoading) {
    return <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>;
  }

  if (!data || data.agentes.length === 0) {
    return (
      <div className="bg-[#060e1c] border border-white/8 rounded-xl p-4 text-center">
        <p className="text-xs text-white/30">No hay agentes asignados para imprimir la hoja.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#060e1c] border border-white/8 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/50 flex items-center gap-1.5">
          <Printer className="w-3 h-3" /> Vista previa — {data.agentes.length} agentes
        </p>
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs px-4 py-2 bg-green-500/15 border border-green-500/30 text-green-300 rounded-lg font-semibold hover:bg-green-500/25 transition-colors">
          <Printer className="w-3 h-3" /> Imprimir
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-white/30 border-b border-white/8 uppercase">
              <th className="text-left px-2 py-1.5">#</th>
              <th className="text-left px-2 py-1.5">Marca</th>
              <th className="text-left px-2 py-1.5">Serie</th>
              <th className="text-left px-2 py-1.5">Código</th>
              <th className="text-left px-2 py-1.5">No.</th>
              <th className="text-left px-2 py-1.5">Nombres y Apellidos</th>
              <th className="text-center px-2 py-1.5">Munición</th>
              <th className="text-left px-2 py-1.5">Firma</th>
            </tr>
          </thead>
          <tbody>
            {data.agentes.map((a, i) => (
              <tr key={a.employeeId} className="border-b border-white/4">
                <td className="px-2 py-1.5 text-white/30">{i + 1}</td>
                <td className="px-2 py-1.5 text-white/50">{a.armaMarca || "—"}</td>
                <td className="px-2 py-1.5 text-white/50">{a.armaSerie || "—"}</td>
                <td className="px-2 py-1.5 text-white/20 italic">Cliente</td>
                <td className="px-2 py-1.5 text-white/20 italic">Cliente</td>
                <td className="px-2 py-1.5 text-white/70 font-medium">{a.nombre}</td>
                <td className="px-2 py-1.5 text-white/50 text-center">{a.municion || "—"}</td>
                <td className="px-2 py-1.5 text-white/10">________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
