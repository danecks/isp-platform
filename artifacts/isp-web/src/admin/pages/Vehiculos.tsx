import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Car, Plus, RefreshCw, Search, X, XCircle, ChevronRight,
  MapPin, User, Clock, AlertTriangle, CheckCircle2, Loader2,
  ArrowRightLeft, Edit, History, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import { AdminLayout } from "../layout/AdminLayout";
import { apiFetch, apiPatch, apiPost, ApiError } from "@/lib/httpClient";

const API = "/api";

function fmtFecha(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDatetime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TIPO_VEHICULO = ["pickup", "motocicleta", "panel", "camión", "furgoneta", "sedan", "otro"] as const;
const TIPO_LABELS: Record<string, string> = {
  pickup: "Pickup", motocicleta: "Motocicleta", panel: "Panel",
  "camión": "Camión", furgoneta: "Furgoneta", sedan: "Sedán", otro: "Otro",
};
const ESTADO_CONFIG: Record<string, { label: string; cls: string }> = {
  activo:    { label: "Activo",     cls: "text-teal-400 bg-teal-400/10 border-teal-400/20" },
  en_taller: { label: "En taller",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  baja:      { label: "Baja",       cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};

interface Vehiculo {
  id: number;
  placa: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  anio: number | null;
  estado: string;
  activo: boolean;
  observaciones: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  custodia_id: number | null;
  custodio_id: number | null;
  custodio_nombre: string | null;
  custodio_tipo: string | null;
  custodia_desde: string | null;
  custodia_tipo_relevo: string | null;
}

interface SupervisorTurno {
  id: number;
  nombre_completo: string;
  tipo_personal: string;
  telefono: string | null;
  turno_nombre: string | null;
  tipo_ciclo: string | null;
  trabaja_hoy: boolean | null;
  estado_ciclo: string;
}

interface EstadoOpZona {
  zona_id: number;
  zona_nombre: string;
  vehiculo_id: number | null;
  placa: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  vehiculo_estado: string | null;
  supervisor_zona_id: number | null;
  supervisor_zona_nombre: string | null;
  custodia_id: number | null;
  custodio_id: number | null;
  custodio_nombre: string | null;
  custodio_tipo: string | null;
  custodia_desde: string | null;
  custodia_tipo_relevo: string | null;
  responsable_turno: SupervisorTurno | null;
  supervisores_zona: SupervisorTurno[];
}

interface CustodiaRow {
  id: number;
  vehiculo_id: number;
  placa: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  employee_id: number | null;
  custodio_nombre: string | null;
  custodio_tipo: string | null;
  zona_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_relevo: string;
  notas: string | null;
  registrado_por: string | null;
}

// ── Modal Crear/Editar Vehículo ─────────────────────────────────────────────
function ModalVehiculo({
  vehiculo,
  zonas,
  usuario,
  onClose,
}: {
  vehiculo?: Vehiculo;
  zonas: { id: number; nombre: string; supervisor_id: number | null; supervisor_nombre: string | null }[];
  usuario: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const esEdicion = !!vehiculo;

  const [placa, setPlaca]       = useState(vehiculo?.placa ?? "");
  const [tipo, setTipo]         = useState(vehiculo?.tipo ?? "pickup");
  const [marca, setMarca]       = useState(vehiculo?.marca ?? "");
  const [modelo, setModelo]     = useState(vehiculo?.modelo ?? "");
  const [color, setColor]       = useState(vehiculo?.color ?? "");
  const [anio, setAnio]         = useState(vehiculo?.anio ? String(vehiculo.anio) : "");
  const [estado, setEstado]     = useState(vehiculo?.estado ?? "activo");
  const [activo, setActivo]     = useState(vehiculo?.activo ?? true);
  const [zonaId, setZonaId]     = useState(vehiculo?.zona_operativa_id ? String(vehiculo.zona_operativa_id) : "");
  const [obs, setObs]           = useState(vehiculo?.observaciones ?? "");

  const zonaSeleccionada = zonas.find(z => String(z.id) === zonaId) ?? null;
  const [loading, setLoading]   = useState(false);

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";
  const labelCls = "text-xs font-medium text-white/50";

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!placa.trim() || !tipo) return;
    setLoading(true);
    try {
      const body = {
        placa: placa.trim(), tipo, marca: marca || undefined, modelo: modelo || undefined,
        color: color || undefined, anio: anio ? Number(anio) : undefined,
        estado, activo, zona_operativa_id: zonaId ? Number(zonaId) : null,
        observaciones: obs.trim() || undefined, usuario,
      };
      if (esEdicion) {
        await apiPatch(`${API}/vehiculos/${vehiculo!.id}`, body);
        toast({ title: "Vehículo actualizado" });
      } else {
        await apiPost(`${API}/vehiculos`, body);
        toast({ title: "Vehículo registrado" });
      }
      qc.invalidateQueries({ queryKey: ["vehiculos"] });
      qc.invalidateQueries({ queryKey: ["vehiculos-estado"] });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? (e.body as { error?: string })?.error : undefined;
      toast({ title: "Error", description: msg || "Intenta de nuevo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-teal-500/20 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-5 py-4 border-b border-teal-500/10 bg-teal-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white">{esEdicion ? "Editar Vehículo" : "Nuevo Vehículo"}</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Placa <span className="text-red-400">*</span></label>
              <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="P-123ABC" required className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Tipo <span className="text-red-400">*</span></label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} required className={inputCls}>
                {TIPO_VEHICULO.map(t => <option key={t} value={t}>{TIPO_LABELS[t] ?? t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Marca</label>
              <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Toyota" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Modelo</label>
              <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Hilux" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Color</label>
              <input value={color} onChange={e => setColor(e.target.value)} placeholder="Blanco" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Año</label>
              <input type="number" value={anio} onChange={e => setAnio(e.target.value)} placeholder="2022" min="1990" max="2030" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Estado</label>
              <select value={estado} onChange={e => setEstado(e.target.value)} className={inputCls}>
                <option value="activo">Activo</option>
                <option value="en_taller">En taller</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Zona operativa asignada</label>
            <select value={zonaId} onChange={e => setZonaId(e.target.value)} className={inputCls}>
              <option value="">— Sin zona —</option>
              {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>

            {/* Chip de supervisor heredado al seleccionar zona */}
            {zonaId && zonaSeleccionada && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                esEdicion && vehiculo?.zona_operativa_id && zonaId !== String(vehiculo.zona_operativa_id)
                  ? "border-yellow-400/30 bg-yellow-400/5 text-yellow-300"
                  : "border-teal-500/30 bg-teal-500/5 text-teal-300"
              }`}>
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {esEdicion && vehiculo?.zona_operativa_id && zonaId !== String(vehiculo.zona_operativa_id)
                    ? "Cambio de zona: nueva custodia para "
                    : "Custodia asignada a "}
                  <span className="font-semibold">
                    {zonaSeleccionada.supervisor_nombre ?? "— Sin supervisor asignado en esta zona —"}
                  </span>
                </span>
              </div>
            )}

            {zonaId && zonaSeleccionada && !zonaSeleccionada.supervisor_nombre && (
              <p className="text-[10px] text-yellow-400/60 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Esta zona no tiene supervisor registrado. La custodia quedará sin responsable hasta asignar uno.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Observaciones</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Notas opcionales..." className={`${inputCls} resize-none`} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="veh-activo" checked={activo} onChange={e => setActivo(e.target.checked)}
              className="rounded border-white/20 bg-[#060e1c] accent-teal-500" />
            <label htmlFor="veh-activo" className="text-xs text-white/60">Vehículo activo en flota</label>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {esEdicion ? "Guardar cambios" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Modal Relevo de Custodia ────────────────────────────────────────────────
function ModalRelevo({
  vehiculo,
  supervisores,
  usuario,
  onClose,
}: {
  vehiculo: Vehiculo;
  supervisores: { id: number; nombre_completo: string; tipo_personal: string }[];
  usuario: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [nuevoEmpId, setNuevoEmpId] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nuevoEmpId) return;
    setLoading(true);
    try {
      await apiPost(`${API}/vehiculos/${vehiculo.id}/relevo`, {
        nuevo_employee_id: Number(nuevoEmpId),
        notas: notas.trim() || undefined,
        tipo_relevo: "manual",
        usuario,
      });
      toast({ title: "Custodia transferida correctamente" });
      qc.invalidateQueries({ queryKey: ["vehiculos"] });
      qc.invalidateQueries({ queryKey: ["vehiculos-estado"] });
      qc.invalidateQueries({ queryKey: ["vehiculos-historial"] });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? (e.body as { error?: string })?.error : undefined;
      toast({ title: "Error en relevo", description: msg || "Intenta de nuevo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-orange-500/20 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-orange-500/10 bg-orange-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white">Relevo de Custodia</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><XCircle className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
            <Car className="w-4 h-4 text-white/30 shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">{vehiculo.placa}</p>
              <p className="text-[10px] text-white/40">{TIPO_LABELS[vehiculo.tipo] ?? vehiculo.tipo} · {vehiculo.marca} {vehiculo.modelo}</p>
            </div>
          </div>

          {vehiculo.custodio_nombre && (
            <div className="flex items-center gap-2 text-[11px] text-white/40 px-1">
              <User className="w-3 h-3" />
              Custodia actual: <span className="text-white/70 font-medium">{vehiculo.custodio_nombre}</span>
              {vehiculo.custodia_desde && <span className="ml-auto">desde {fmtDatetime(vehiculo.custodia_desde)}</span>}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Nuevo responsable <span className="text-red-400">*</span></label>
            <select value={nuevoEmpId} onChange={e => setNuevoEmpId(e.target.value)} required className={inputCls}>
              <option value="">— Selecciona supervisor / jefe de servicio / administración —</option>
              {supervisores.map(s => (
                <option key={s.id} value={s.id}>{s.nombre_completo} ({s.tipo_personal?.replace(/_/g, " ")})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Notas del relevo</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Motivo del relevo, observaciones..." className={`${inputCls} resize-none`} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Transferir custodia
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Página Principal ────────────────────────────────────────────────────────
type SubTab = "estado" | "vehiculos" | "historial";

export default function Vehiculos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const { active: deleteModeActive, requestDelete } = useDeleteMode();
  const usuario = currentUser?.nombre ?? currentUser?.username ?? "sistema";

  const [subTab, setSubTab] = useState<SubTab>("estado");
  const [busqueda, setBusqueda] = useState("");
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editando, setEditando] = useState<Vehiculo | null>(null);
  const [relevando, setRelevando] = useState<Vehiculo | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function syncTodasCustodias() {
    setSyncing(true);
    try {
      const data = await apiPost<{ cambios: number; total: number }>(
        `${API}/vehiculos/sync-custodias`,
        { usuario },
      );
      toast({
        title: `Custodias sincronizadas`,
        description: `${data.cambios} cambio(s) aplicado(s) sobre ${data.total} vehículo(s) en turno.`,
      });
      qc.invalidateQueries({ queryKey: ["vehiculos"] });
      qc.invalidateQueries({ queryKey: ["vehiculos-estado"] });
      qc.invalidateQueries({ queryKey: ["vehiculos-historial"] });
    } catch {
      toast({ title: "Error al sincronizar", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  const { data: vehiculos = [], isLoading: loadingVeh, refetch: refetchVeh } = useQuery<Vehiculo[]>({
    queryKey: ["vehiculos"],
    queryFn: () => apiFetch(`${API}/vehiculos`),
    staleTime: 30_000,
  });

  const { data: estadoOp = [], isLoading: loadingEstado, refetch: refetchEstado } = useQuery<EstadoOpZona[]>({
    queryKey: ["vehiculos-estado"],
    queryFn: () => apiFetch(`${API}/vehiculos/estado-operativo`),
    staleTime: 30_000,
    enabled: subTab === "estado",
  });

  const { data: historial = [], isLoading: loadingHistorial, refetch: refetchHistorial } = useQuery<CustodiaRow[]>({
    queryKey: ["vehiculos-historial"],
    queryFn: () => apiFetch(`${API}/vehiculos/historial/global?limite=200`),
    staleTime: 30_000,
    enabled: subTab === "historial",
  });

  const { data: zonas = [] } = useQuery<{ id: number; nombre: string; supervisor_id: number | null; supervisor_nombre: string | null }[]>({
    queryKey: ["zonas-activas"],
    queryFn: () => apiFetch<any[]>(`${API}/operaciones/zonas`).then(list =>
      list
        .filter((z: any) => z.estado === "activo" || !z.estado)
        .map((z: any) => ({
          id: z.id,
          nombre: z.nombre,
          supervisor_id: z.supervisor_employee_id ?? null,
          supervisor_nombre: z.supervisor_nombre ?? null,
        }))
    ),
    staleTime: 120_000,
  });

  const { data: supervisores = [] } = useQuery<{ id: number; nombre_completo: string; tipo_personal: string }[]>({
    queryKey: ["empleados-para-relevo"],
    queryFn: () => apiFetch<any[]>(`${API}/employees`).then(list => {
      const TIPOS_PERMITIDOS = ["supervisor", "jefe_servicio", "administrativo_rrhh", "administrativo_bodega", "gerencia"];
      return list
        .filter((e: any) => {
          const tipo = e.tipoPersonal ?? e.tipo_personal ?? "";
          const activo = (e.estadoLaboral ?? e.estado_laboral) === "activo" || !(e.estadoLaboral ?? e.estado_laboral);
          return activo && TIPOS_PERMITIDOS.includes(tipo);
        })
        .map((e: any) => ({
          id: e.id,
          nombre_completo: e.nombreCompleto ?? e.nombre_completo ?? "",
          tipo_personal: e.tipoPersonal ?? e.tipo_personal ?? "",
        }))
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    }),
    staleTime: 120_000,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["vehiculos"] });
    qc.invalidateQueries({ queryKey: ["vehiculos-estado"] });
    qc.invalidateQueries({ queryKey: ["vehiculos-historial"] });
  }

  const vehFilt = vehiculos.filter(v =>
    !busqueda ||
    v.placa.toLowerCase().includes(busqueda.toLowerCase()) ||
    (v.marca ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (v.zona_nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const histFilt = historial.filter(h =>
    !busqueda ||
    (h.placa ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (h.custodio_nombre ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (h.zona_nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const zonasConVehiculo = estadoOp.filter(z => z.vehiculo_id);
  const zonasSinVehiculo = estadoOp.filter(z => !z.vehiculo_id);

  return (
    <AdminLayout title="Vehículos de Supervisión">
    <div className="flex flex-col gap-5">

      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Car className="w-5 h-5 text-teal-400" />
            Vehículos de Supervisión
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Control operativo, custodia y trazabilidad por zona y turno</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { invalidar(); }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModalNuevo(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-xl text-sm font-semibold text-white transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo vehículo
          </button>
        </div>
      </div>

      {/* ── Stats rápidas ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total flota", value: vehiculos.filter(v => v.activo).length, cls: "text-white", bg: "bg-white/5 border-white/8" },
          { label: "En operación", value: vehiculos.filter(v => v.activo && v.estado === "activo").length, cls: "text-teal-400", bg: "bg-teal-400/5 border-teal-400/10" },
          { label: "Con custodia activa", value: vehiculos.filter(v => v.custodia_id).length, cls: "text-blue-400", bg: "bg-blue-400/5 border-blue-400/10" },
          { label: "En taller / baja", value: vehiculos.filter(v => v.estado !== "activo").length, cls: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/10" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-2xl p-4 flex items-center gap-3`}>
            <div>
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[11px] text-white/35">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Controles ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {([
            { key: "estado", label: "Estado Operativo" },
            { key: "vehiculos", label: "Vehículos" },
            { key: "historial", label: "Historial Custodia" },
          ] as { key: SubTab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${subTab === t.key
                ? "bg-teal-600 text-white"
                : "text-white/40 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-white/30" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar placa, zona, responsable..."
            className="bg-transparent text-sm text-white outline-none placeholder-white/25 w-full"
          />
          {busqueda && <button onClick={() => setBusqueda("")}><X className="w-3.5 h-3.5 text-white/30 hover:text-white" /></button>}
        </div>
      </div>

      {/* ── SUB-TAB: Estado Operativo ──────────────────────────────────────── */}
      {subTab === "estado" && (
        <div className="space-y-4">
          {/* Botón sincronizar custodias */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-white/30">
              El responsable se hereda automáticamente del supervisor en turno activo de cada zona.
            </p>
            <button
              onClick={syncTodasCustodias}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/10 border border-orange-500/20 text-xs font-medium text-orange-400 hover:bg-orange-600/20 transition-all disabled:opacity-50"
              title="Herramienta de ajuste excepcional — el flujo normal ocurre al cierre del pizarrón"
            >
              {syncing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Sincronización extraordinaria
            </button>
          </div>
          {loadingEstado ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /></div>
          ) : (
            <>
              {zonasConVehiculo.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Zonas con vehículo asignado ({zonasConVehiculo.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {zonasConVehiculo.map(z => {
                      const estadoCfg = ESTADO_CONFIG[z.vehiculo_estado ?? "activo"] ?? ESTADO_CONFIG.activo;
                      const vehiculoDesc = [z.tipo ? TIPO_LABELS[z.tipo] ?? z.tipo : null, z.marca, z.modelo].filter(Boolean).join(" ");
                      const rt = z.responsable_turno;
                      const svs = z.supervisores_zona ?? [];
                      const custodioSincronizado = rt && z.custodio_id && z.custodio_id === rt.id;
                      return (
                        <div key={z.zona_id} className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
                          {/* Zona */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-teal-400" />
                              <span className="text-sm font-bold text-white">{z.zona_nombre}</span>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoCfg.cls}`}>
                              {estadoCfg.label}
                            </span>
                          </div>

                          {/* Vehículo */}
                          <div className="flex items-center gap-2.5 bg-white/4 rounded-xl p-2.5">
                            <Car className="w-5 h-5 text-white/30 shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-white">{z.placa}</p>
                              <p className="text-[10px] text-white/40">{vehiculoDesc || "—"}</p>
                              {z.color && <p className="text-[9px] text-white/25">Color: {z.color}</p>}
                            </div>
                          </div>

                          {/* Responsable de turno (calculado del motor de ciclos) */}
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider">Responsable por turno hoy</p>
                            {rt ? (
                              <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${
                                custodioSincronizado
                                  ? "border-teal-500/30 bg-teal-500/8"
                                  : "border-yellow-400/30 bg-yellow-400/5"
                              }`}>
                                <Shield className={`w-3.5 h-3.5 shrink-0 ${custodioSincronizado ? "text-teal-400" : "text-yellow-400"}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-bold text-white truncate">{rt.nombre_completo}</p>
                                  <p className="text-[9px] text-white/40">
                                    {rt.tipo_ciclo ?? rt.turno_nombre ?? "Turno activo"}
                                    {!custodioSincronizado && (
                                      <span className="ml-1 text-yellow-400/70">· pendiente sincronizar</span>
                                    )}
                                  </p>
                                </div>
                                {custodioSincronizado && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                              </div>
                            ) : svs.length > 0 ? (
                              <div className="flex items-center gap-2 text-yellow-400/60">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <p className="text-[11px]">Sin supervisor en turno activo hoy</p>
                              </div>
                            ) : (
                              <p className="text-[11px] text-white/20">No hay supervisores asignados a esta zona</p>
                            )}

                            {/* Lista de supervisores con estado de turno */}
                            {svs.length > 0 && (
                              <div className="space-y-1 pt-0.5">
                                {svs.map((sv: SupervisorTurno) => (
                                  <div key={sv.id} className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      sv.trabaja_hoy === true  ? "bg-teal-400" :
                                      sv.trabaja_hoy === false ? "bg-white/20" :
                                      "bg-yellow-400/60"
                                    }`} />
                                    <span className={`text-[10px] truncate ${sv.trabaja_hoy ? "text-white/70" : "text-white/30"}`}>
                                      {sv.nombre_completo}
                                    </span>
                                    <span className={`text-[9px] ml-auto shrink-0 ${
                                      sv.trabaja_hoy === true  ? "text-teal-400" :
                                      sv.trabaja_hoy === false ? "text-white/20" :
                                      "text-yellow-400/60"
                                    }`}>
                                      {sv.trabaja_hoy === true ? "En turno" :
                                       sv.trabaja_hoy === false ? "Descansando" : "Sin turno"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {zonasSinVehiculo.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-2">
                    Zonas sin vehículo ({zonasSinVehiculo.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {zonasSinVehiculo.map(z => (
                      <div key={z.zona_id} className="flex items-center gap-1.5 bg-white/3 border border-white/6 rounded-lg px-2.5 py-1.5">
                        <MapPin className="w-3 h-3 text-white/20" />
                        <span className="text-[11px] text-white/30">{z.zona_nombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {estadoOp.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <MapPin className="w-10 h-10 text-white/10" />
                  <p className="text-sm text-white/30">No hay zonas operativas activas</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SUB-TAB: Vehículos ──────────────────────────────────────────────── */}
      {subTab === "vehiculos" && (
        <div>
          {loadingVeh ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /></div>
          ) : vehFilt.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Car className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/30">No hay vehículos registrados</p>
              <button onClick={() => setModalNuevo(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-xl text-xs font-semibold text-white transition-all">
                <Plus className="w-3.5 h-3.5" /> Registrar primer vehículo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {vehFilt.map(v => {
                const estadoCfg = ESTADO_CONFIG[v.estado] ?? ESTADO_CONFIG.activo;
                const vehiculoDesc = [TIPO_LABELS[v.tipo] ?? v.tipo, v.marca, v.modelo].filter(Boolean).join(" ");
                return (
                  <div key={v.id} className={`bg-white/4 border rounded-2xl p-4 space-y-3 ${!v.activo ? "opacity-50" : "border-white/8"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-base font-bold text-white">{v.placa}</p>
                        <p className="text-[11px] text-white/40">{vehiculoDesc}</p>
                        {v.color && <p className="text-[10px] text-white/25">Color: {v.color}{v.anio ? ` · ${v.anio}` : ""}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoCfg.cls}`}>
                          {estadoCfg.label}
                        </span>
                        {!v.activo && <span className="text-[9px] text-white/25">Inactivo</span>}
                      </div>
                    </div>

                    {/* Zona asignada */}
                    {v.zona_nombre ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-teal-400/70">
                        <MapPin className="w-3 h-3" /> {v.zona_nombre}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-white/20">
                        <MapPin className="w-3 h-3" /> Sin zona asignada
                      </div>
                    )}

                    {/* Custodia actual */}
                    {v.custodio_nombre ? (
                      <div className="flex items-center gap-2 bg-blue-400/5 border border-blue-400/15 rounded-lg px-2.5 py-1.5">
                        <Shield className="w-3 h-3 text-blue-400 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-white">{v.custodio_nombre}</p>
                          <p className="text-[9px] text-white/35">Desde {fmtDatetime(v.custodia_desde)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-white/20 flex items-center gap-1.5">
                        <Shield className="w-3 h-3" /> Sin custodia activa
                      </div>
                    )}

                    {v.observaciones && (
                      <p className="text-[10px] text-white/25 italic">{v.observaciones}</p>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-2 pt-1 border-t border-white/5">
                      <button
                        onClick={() => setEditando(v)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                      >
                        <Edit className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={() => setRelevando(v)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 hover:border-orange-500/35 transition-all"
                      >
                        <ArrowRightLeft className="w-3 h-3" /> Relevo
                      </button>
                      {deleteModeActive && (
                        <button
                          onClick={() => requestDelete({ entidad: "vehiculo", entidad_id: v.id, entidad_descripcion: v.placa })}
                          title="Solicitar eliminación"
                          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB: Historial ──────────────────────────────────────────────── */}
      {subTab === "historial" && (
        <div>
          {loadingHistorial ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /></div>
          ) : histFilt.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <History className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/30">Sin registros de custodia todavía</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 bg-white/3">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Vehículo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Responsable</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Zona</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Inicio</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Fin</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {histFilt.map(h => (
                    <tr key={h.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-white text-[13px]">{h.placa}</p>
                        <p className="text-[10px] text-white/35">{TIPO_LABELS[h.tipo] ?? h.tipo} {h.marca ? `· ${h.marca}` : ""} {h.color ? `· ${h.color}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-white font-medium">{h.custodio_nombre ?? "—"}</p>
                        <p className="text-[10px] text-white/35">{h.custodio_tipo?.replace(/_/g, " ") ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-white/60">{h.zona_nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-[11px] text-white/50">{fmtDatetime(h.fecha_inicio)}</td>
                      <td className="px-4 py-3">
                        {h.fecha_fin
                          ? <span className="text-[11px] text-white/50">{fmtDatetime(h.fecha_fin)}</span>
                          : <span className="text-[11px] text-teal-400 font-semibold">Activa</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                          h.tipo_relevo === "automatico"
                            ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
                            : "text-white/40 bg-white/5 border-white/10"
                        }`}>
                          {h.tipo_relevo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/35 max-w-[180px] truncate">{h.notas ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      {modalNuevo && (
        <ModalVehiculo
          zonas={zonas}
          usuario={usuario}
          onClose={() => setModalNuevo(false)}
        />
      )}
      {editando && (
        <ModalVehiculo
          vehiculo={editando}
          zonas={zonas}
          usuario={usuario}
          onClose={() => setEditando(null)}
        />
      )}
      {relevando && (
        <ModalRelevo
          vehiculo={relevando}
          supervisores={supervisores}
          usuario={usuario}
          onClose={() => setRelevando(null)}
        />
      )}
    </div>
    </AdminLayout>
  );
}
