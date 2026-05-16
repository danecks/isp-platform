import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Building2, MapPin, Shield, Users, ChevronRight, ChevronDown,
  Plus, Trash2, Loader2, AlertTriangle,
  Edit3, Banknote, RefreshCw,
  UserCheck, Calendar, FileText, LayoutGrid, Activity,
  ChevronLeft, History, UserCog, Landmark,
} from "lucide-react";
import {
  API, getSession, fmtQ, ClienteFicha, Sede, Puesto,
} from "./clientes/_shared";
import { TabRentabilidad } from "./clientes/TabRentabilidad";
import { TabTitulares } from "./clientes/TabTitulares";
import { TabPlantillaTurnos } from "./clientes/TabPlantillaTurnos";
import { TabIGSSCentro } from "./clientes/TabIGSSCentro";
import { TabUsuariosCliente } from "./clientes/TabUsuariosCliente";
import { ModalPuesto } from "./clientes/ModalPuesto";
import { ModalEditarCliente } from "./clientes/ModalEditarCliente";
import { ModalNuevaSede } from "./clientes/ModalNuevaSede";

interface CoberturaHoy {
  puestos: Array<{
    puesto_id: number;
    puesto_nombre: string;
    sede_nombre: string | null;
    turno: string | null;
    horario: string | null;
    hora_entrada: string | null;
    hora_salida: string | null;
    cantidad_contratada: number;
    titular_employee_id: number | null;
    titular_nombre: string | null;
    agente_id: number | null;
    agente_nombre: string | null;
    estado: string;
    tipo_cobertura: "titular" | "relevo" | "descubierto";
  }>;
  resumen: {
    totalPuestos: number;
    cubiertos: number;
    conTitular: number;
    conRelevo: number;
    descubiertos: number;
  };
}

interface FichaData {
  cliente: ClienteFicha;
  sedes: Sede[];
  puestos: Puesto[];
  coberturaHoy: CoberturaHoy;
}

const estadoContratoColor = (e: string | null) => {
  const map: Record<string, string> = {
    activo: "text-green-400 bg-green-400/10 border-green-400/20",
    suspendido: "text-red-400 bg-red-400/10 border-red-400/20",
    negociacion: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    inactivo: "text-white/30 bg-white/4 border-white/10",
  };
  return map[e ?? "activo"] ?? map.activo;
};

const coberturaColor = (tipo: string) => {
  if (tipo === "titular") return "bg-green-500/8 border-green-500/20";
  if (tipo === "relevo") return "bg-amber-500/8 border-amber-500/20";
  return "bg-red-500/8 border-red-500/20";
};

const coberturaBadge = (tipo: string) => {
  if (tipo === "titular") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (tipo === "relevo") return "text-amber-400 bg-amber-400/10 border-amber-400/20";
  return "text-red-400 bg-red-400/10 border-red-400/20";
};

const coberturaTxt = (tipo: string) => {
  if (tipo === "titular") return "Titular cubriendo";
  if (tipo === "relevo") return "Relevo activo";
  return "Descubierto";
};

// ─── PuestoRow: fila de puesto en la tab de estructura ───────────────────────
interface PuestoTitularHistorico {
  id: number;
  employee_id: number;
  empleado_nombre: string;
  numero_empleado?: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo?: string;
  creado_por?: string;
}

function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function HistorialTitularPuesto({ puestoId }: { puestoId: number }) {
  const [rows, setRows] = useState<PuestoTitularHistorico[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    fetch(`${API}/operaciones/puestos/${puestoId}/titular-historico`, {
      headers: { "x-isp-session": getSession(), "Content-Type": "application/json" },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setRows)
      .catch(() => {});
  }, [puestoId, loaded]);

  const activo = rows.find(r => !r.fecha_fin);
  const anteriores = rows.filter(r => r.fecha_fin);
  const visibles = showAll ? anteriores : anteriores.slice(0, 3);

  return (
    <div className="col-span-2 sm:col-span-4 border-t border-white/6 pt-2 mt-1">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="w-3 h-3 text-white/20" />
        <p className="text-[9px] text-white/25 uppercase tracking-wide">Historial de titularidad</p>
      </div>
      {rows.length === 0 && (
        <p className="text-[10px] text-white/25">Sin historial registrado</p>
      )}
      {activo && (
        <div className="flex items-start gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1 shrink-0" />
          <div>
            <p className="text-[11px] text-green-300/80 font-medium">{activo.empleado_nombre}</p>
            <p className="text-[10px] text-white/30">Titular desde {fmtFechaCorta(activo.fecha_inicio)}{activo.motivo ? ` · ${activo.motivo.replace(/_/g, " ")}` : ""}</p>
          </div>
        </div>
      )}
      {visibles.map(r => (
        <div key={r.id} className="flex items-start gap-2 mb-1 opacity-60">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-1 shrink-0" />
          <div>
            <p className="text-[10px] text-white/50">{r.empleado_nombre}</p>
            <p className="text-[9px] text-white/25">{fmtFechaCorta(r.fecha_inicio)} → {fmtFechaCorta(r.fecha_fin)}{r.motivo ? ` · ${r.motivo.replace(/_/g, " ")}` : ""}</p>
          </div>
        </div>
      ))}
      {anteriores.length > 3 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-[9px] text-white/25 hover:text-white/50 transition-colors">
          +{anteriores.length - 3} anteriores…
        </button>
      )}
    </div>
  );
}

function PuestoRow({ puesto, onEdit, onDelete }: { puesto: Puesto; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const tieneCobertura = puesto.agente_id !== null;
  const esRelevo = tieneCobertura && puesto.agente_id !== puesto.titular_employee_id;

  return (
    <div>
      <div
        className="px-4 py-3 flex items-center gap-3 hover:bg-white/2 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${tieneCobertura ? (esRelevo ? "bg-amber-400" : "bg-green-400") : (puesto.titular_employee_id ? "bg-red-400" : "bg-white/20")}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-white">{puesto.nombre}</p>
            {puesto.tipo_servicio && (
              <span className="text-[9px] text-white/30 bg-white/4 px-1.5 py-0.5 rounded-full">{puesto.tipo_servicio.replace("_", " ")}</span>
            )}
            {puesto.zona_nombre && (
              <span className="text-[9px] text-primary/60 bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
                {puesto.zona_nombre}
              </span>
            )}
          </div>
          {puesto.direccion && (
            <p className="text-[10px] text-white/20 mt-0.5 truncate">{puesto.direccion}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {puesto.tarifa_puesto && (
            <span className="text-[10px] text-primary/60">{fmtQ(puesto.tarifa_puesto)}</span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-white/25 hover:text-white/70 transition-colors">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-red-400/30 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/1.5 border-t border-white/4">
          {[
            { label: "Cubre hoy", value: puesto.agente_nombre },
            { label: "Estado", value: puesto.estado },
          ].map(({ label, value }) => (
            <div key={label} className="py-2">
              <p className="text-[9px] text-white/25 uppercase tracking-wide">{label}</p>
              <p className="text-[11px] text-white/60 mt-0.5">{value || "—"}</p>
            </div>
          ))}
          {puesto.notas && (
            <div className="col-span-2 sm:col-span-4 py-1">
              <p className="text-[9px] text-white/25 uppercase tracking-wide">Notas</p>
              <p className="text-[11px] text-white/50 mt-0.5">{puesto.notas}</p>
            </div>
          )}
          {/* Historial de titularidad por puesto */}
          <HistorialTitularPuesto puestoId={puesto.id} />
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
type Tab = "general" | "estructura" | "cobertura" | "titulares" | "turnos" | "usuarios" | "igss" | "rentabilidad";

export default function FichaCliente() {
  const [, params] = useRoute("/admin/clientes/:id");
  const [, navigate] = useLocation();
  const clientId = Number(params?.id);

  const [data, setData] = useState<FichaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("general");
  const [expandedSede, setExpandedSede] = useState<number | null>(null);

  const [modalEditar, setModalEditar] = useState(false);
  const [modalNuevaSede, setModalNuevaSede] = useState(false);
  const [modalPuesto, setModalPuesto] = useState<Puesto | null | "nuevo">(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/clientes/${clientId}/ficha`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => { if (clientId) load(); }, [clientId]);

  async function desactivarPuesto(puestoId: number) {
    if (!confirm("¿Desactivar este puesto? El pizarrón ya no lo mostrará.")) return;
    await fetch(`${API}/puestos/${puestoId}`, { method: "DELETE", headers: { "x-isp-session": getSession() } });
    load();
  }

  async function desactivarSede(sedeId: number) {
    if (!confirm("¿Desactivar esta sede?")) return;
    await fetch(`${API}/sedes/${sedeId}`, { method: "DELETE", headers: { "x-isp-session": getSession() } });
    load();
  }

  if (loading) return (
    <AdminLayout title="Ficha de Cliente">
      <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
    </AdminLayout>
  );

  if (!data) return (
    <AdminLayout title="Ficha de Cliente">
      <div className="text-center py-20">
        <AlertTriangle className="w-8 h-8 text-red-400/40 mx-auto mb-3" />
        <p className="text-white/40">Cliente no encontrado</p>
        <button onClick={() => navigate("/admin/clientes")} className="mt-4 text-xs text-primary hover:text-primary/80 flex items-center gap-1 mx-auto">
          <ChevronLeft className="w-3 h-3" /> Volver a clientes
        </button>
      </div>
    </AdminLayout>
  );

  const { cliente, sedes, puestos, coberturaHoy } = data;
  const nombreMostrar = cliente.nombreComercial || cliente.nombre;
  const puestosActivosTotal = puestos.length;
  const puestosConTitular = puestos.filter(p => (p as any).slots_con_titular > 0 || p.titular_employee_id).length;
  const tarifaTotal = puestos.reduce((s, p) => s + Number(p.tarifa_puesto || 0), 0);

  return (
    <AdminLayout title={`Ficha — ${nombreMostrar}`}>
      <div className="space-y-4 max-w-5xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate("/admin/clientes")}
              className="mt-1 p-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-white/8 text-white/40 hover:text-white transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{nombreMostrar}</h1>
              {cliente.nombreComercial && <p className="text-xs text-white/40 mt-0.5">{cliente.nombre}</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {cliente.sector && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 border border-white/10 text-white/40">{cliente.sector}</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${estadoContratoColor(cliente.estado_contrato)}`}>
                  Contrato: {cliente.estado_contrato ?? "activo"}
                </span>
                {cliente.contrato_sin_prueba && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border text-blue-400 bg-blue-400/10 border-blue-400/20 font-semibold">
                    Sin período de prueba
                  </span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cliente.estado === "activo" ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-white/30 bg-white/4 border-white/10"}`}>
                  {cliente.estado}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg bg-white/3 hover:bg-white/6 border border-white/8 text-white/40 hover:text-white transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setModalEditar(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-xs text-white/70 hover:text-white transition-all"
            >
              <Edit3 className="w-3 h-3" /> Editar cliente
            </button>
          </div>
        </div>

        {/* ── Stats rápidas ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sedes activas", value: sedes.filter(s => s.activo).length, icon: MapPin, color: "text-blue-400" },
            { label: "Puestos activos", value: puestosActivosTotal, icon: Shield, color: "text-primary" },
            { label: "Tarifa mensual", value: tarifaTotal > 0 ? `Q${tarifaTotal.toLocaleString()}` : "—", icon: Users, color: "text-purple-400" },
            { label: "Puestos con titular", value: `${puestosConTitular}/${puestosActivosTotal}`, icon: UserCheck, color: "text-green-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#0c1829] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <p className="text-[10px] text-white/30 uppercase tracking-wide">{label}</p>
              </div>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="bg-[#0c1829] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-1 flex-wrap">
            {([
              { id: "general", label: "General + Contrato", icon: FileText },
              { id: "estructura", label: "Sedes y Estructura", icon: LayoutGrid },
              { id: "cobertura", label: "Cobertura Hoy", icon: Activity },
              { id: "titulares", label: "Titulares", icon: UserCheck },
              { id: "turnos", label: "Plantilla de Turnos", icon: Calendar },
              { id: "usuarios", label: "Usuarios del Cliente", icon: UserCog },
              { id: "igss", label: "Centro IGSS", icon: Landmark },
              { id: "rentabilidad", label: "Rentabilidad", icon: Banknote },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${tab === id ? "bg-primary/15 text-primary border border-primary/30" : "text-white/40 hover:text-white/70 hover:bg-white/3"}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab General + Contrato ─────────────────────────────────────── */}
          {tab === "general" && (
            <div className="p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Datos generales */}
                <div className="space-y-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Datos generales</p>
                  {[
                    { label: "Nombre legal", value: cliente.nombre },
                    { label: "Nombre comercial", value: cliente.nombreComercial },
                    { label: "NIT", value: cliente.nit },
                    { label: "Sector", value: cliente.sector },
                    { label: "Estado operativo", value: cliente.estado },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2 border-b border-white/4 pb-2">
                      <p className="text-xs text-white/35">{label}</p>
                      <p className="text-xs text-white/80 font-medium text-right max-w-[60%]">{value || "—"}</p>
                    </div>
                  ))}
                </div>

                {/* Datos contractuales */}
                <div className="space-y-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Datos contractuales</p>
                  {[
                    { label: "Estado del contrato", value: cliente.estado_contrato ?? "activo" },
                    { label: "Inicio de contrato", value: cliente.fecha_inicio_contrato ? new Date(cliente.fecha_inicio_contrato).toLocaleDateString("es-GT") : null },
                    { label: "Tarifa base mensual", value: cliente.tarifa_base_mensual ? fmtQ(cliente.tarifa_base_mensual) : null },
                    { label: "Tarifa total puestos", value: tarifaTotal > 0 ? fmtQ(tarifaTotal) : null },
                    { label: "Período de prueba", value: cliente.contrato_sin_prueba ? "No aplica (prestaciones desde ingreso)" : "2 meses (estándar)" },
                    {
                      label: "Dotación de uniformes",
                      value: (cliente.dotacion_uniforme_num ?? 0) > 0
                        ? `${cliente.dotacion_uniforme_num} uniforme(s) c/${cliente.dotacion_uniforme_frecuencia_meses} meses`
                        : "No aplica (agente asume costo)",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2 border-b border-white/4 pb-2">
                      <p className="text-xs text-white/35">{label}</p>
                      <p className="text-xs text-white/80 font-medium text-right">{value || "—"}</p>
                    </div>
                  ))}
                  {cliente.observaciones_contractuales && (
                    <div className="mt-2">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Observaciones contractuales</p>
                      <p className="text-xs text-white/50 bg-white/3 rounded-lg p-3 leading-relaxed">{cliente.observaciones_contractuales}</p>
                    </div>
                  )}
                  {cliente.notas && (
                    <div className="mt-2">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Notas internas</p>
                      <p className="text-xs text-white/50 bg-white/3 rounded-lg p-3 leading-relaxed">{cliente.notas}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen operativo */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 font-semibold">Estructura contratada — resumen</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {sedes.filter(s => s.activo).map(sede => (
                    <div key={sede.id} className="bg-[#070f1c] border border-white/8 rounded-xl p-3">
                      <p className="text-xs font-semibold text-white mb-1">{sede.nombre}</p>
                      {sede.ciudad && <p className="text-[10px] text-white/30 mb-2">{sede.ciudad}</p>}
                      <div className="flex gap-3 text-[10px] text-white/40">
                        <span>{sede.total_puestos} puesto{sede.total_puestos !== 1 ? "s" : ""}</span>
                        <span className={sede.puestos_cubiertos === sede.total_puestos && sede.total_puestos > 0 ? "text-green-400" : "text-amber-400"}>
                          {sede.puestos_cubiertos}/{sede.total_puestos} cubiertos
                        </span>
                      </div>
                    </div>
                  ))}
                  {sedes.filter(s => s.activo).length === 0 && (
                    <div className="col-span-3 text-xs text-white/25 text-center py-4 italic">Sin sedes registradas</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab Sedes y Estructura ─────────────────────────────────────── */}
          {tab === "estructura" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/30">Estructura base del servicio contratado — sedes y puestos operativos</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalNuevaSede(true)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nueva sede
                  </button>
                  <button
                    onClick={() => setModalPuesto("nuevo")}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nuevo puesto
                  </button>
                </div>
              </div>

              {/* Puestos sin sede */}
              {puestos.filter(p => !p.sede_id).length > 0 && (
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-white/30" />
                    <p className="text-xs text-white/50 font-semibold">Sin sede asignada</p>
                    <span className="text-[10px] text-white/25">{puestos.filter(p => !p.sede_id).length} puestos</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {puestos.filter(p => !p.sede_id).map(puesto => (
                      <PuestoRow key={puesto.id} puesto={puesto} onEdit={() => setModalPuesto(puesto)} onDelete={() => desactivarPuesto(puesto.id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Sedes con sus puestos */}
              {sedes.filter(s => s.activo).map(sede => {
                const misPuestos = puestos.filter(p => p.sede_id === sede.id);
                const isOpen = expandedSede === sede.id;
                return (
                  <div key={sede.id} className="border border-white/8 rounded-xl overflow-hidden">
                    <div
                      className="px-4 py-3 bg-white/3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedSede(isOpen ? null : sede.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />}
                        <MapPin className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{sede.nombre}</p>
                          {(sede.ciudad || sede.direccion) && (
                            <p className="text-[10px] text-white/30">{[sede.ciudad, sede.direccion].filter(Boolean).join(" — ")}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${
                          sede.puestos_cubiertos === sede.total_puestos && sede.total_puestos > 0
                            ? "text-green-400 bg-green-500/10 border-green-500/20"
                            : sede.total_puestos > 0
                              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                              : "text-white/25 bg-white/5 border-white/8"
                        }`}>
                          {sede.puestos_cubiertos}/{sede.total_puestos} cubiertos
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); desactivarSede(sede.id); }}
                          className="text-red-400/30 hover:text-red-400 transition-colors p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div>
                        {misPuestos.length === 0 ? (
                          <div className="px-5 py-6 text-center text-xs text-white/25 italic">
                            Sin puestos en esta sede —{" "}
                            <button
                              onClick={() => setModalPuesto("nuevo")}
                              className="text-primary hover:text-primary/80 underline"
                            >crear uno</button>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {misPuestos.map(puesto => (
                              <PuestoRow key={puesto.id} puesto={puesto} onEdit={() => setModalPuesto(puesto)} onDelete={() => desactivarPuesto(puesto.id)} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {sedes.filter(s => s.activo).length === 0 && puestos.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Sin sedes ni puestos registrados</p>
                  <p className="text-white/15 text-xs mt-1">Crea una sede y luego agrega puestos operativos.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Tab Cobertura Hoy ─────────────────────────────────────────── */}
          {tab === "cobertura" && (
            <div className="p-5 space-y-4">
              {/* Resumen del día */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Cubiertos", value: coberturaHoy.resumen.cubiertos, color: "text-green-400", bg: "bg-green-500/8 border-green-500/20" },
                  { label: "Titular cubriendo", value: coberturaHoy.resumen.conTitular, color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/20" },
                  { label: "Con relevo", value: coberturaHoy.resumen.conRelevo, color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/20" },
                  { label: "Descubiertos", value: coberturaHoy.resumen.descubiertos, color: "text-red-400", bg: "bg-red-500/8 border-red-500/20" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`border rounded-xl p-3 ${bg}`}>
                    <p className="text-[10px] text-white/35 uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Puestos */}
              <div className="space-y-2">
                {coberturaHoy.puestos.map(p => (
                  <div key={p.puesto_id} className={`border rounded-xl p-3 ${coberturaColor(p.tipo_cobertura)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white">{p.puesto_nombre}</p>
                          {p.sede_nombre && <span className="text-[10px] text-white/30">· {p.sede_nombre}</span>}
                        </div>
                        <p className="text-[10px] text-white/40">
                          {[p.turno, p.hora_entrada && p.hora_salida ? `${p.hora_entrada}–${p.hora_salida}` : p.horario].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${coberturaBadge(p.tipo_cobertura)}`}>
                        {coberturaTxt(p.tipo_cobertura)}
                      </span>
                    </div>
                    {p.tipo_cobertura !== "descubierto" && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                        <UserCheck className="w-3 h-3" />
                        <span className="font-medium">{p.agente_nombre}</span>
                        {p.tipo_cobertura === "relevo" && p.titular_nombre && (
                          <span className="text-white/30">(titular: {p.titular_nombre})</span>
                        )}
                      </div>
                    )}
                    {p.tipo_cobertura === "descubierto" && p.titular_nombre && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/35">
                        <Users className="w-3 h-3" />
                        <span>Titular asignado: {p.titular_nombre} — ausente hoy</span>
                      </div>
                    )}
                    {p.tipo_cobertura === "descubierto" && !p.titular_nombre && (
                      <p className="mt-2 text-[11px] text-red-400/60">Sin titular asignado — puesto pendiente de cobertura</p>
                    )}
                  </div>
                ))}
                {coberturaHoy.puestos.length === 0 && (
                  <div className="text-center py-10">
                    <Activity className="w-7 h-7 text-white/10 mx-auto mb-3" />
                    <p className="text-white/30 text-sm">Sin puestos operativos registrados</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab Plantilla de Turnos ───────────────────────────────────── */}
          {tab === "turnos" && (
            <TabPlantillaTurnos clienteId={clientId} puestos={puestos} />
          )}

          {/* ── Tab Usuarios del Cliente ──────────────────────────────────── */}
          {tab === "usuarios" && (
            <TabUsuariosCliente clienteDbId={clientId} />
          )}

          {/* ── Tab Titulares ─────────────────────────────────────────────── */}
          {tab === "titulares" && (
            <TabTitulares puestos={puestos} clienteId={clientId} />
          )}

          {/* ── Tab IGSS ──────────────────────────────────────────────────── */}
          {tab === "igss" && (
            <TabIGSSCentro cliente={cliente} onSaved={load} />
          )}

          {/* ── Tab Rentabilidad ───────────────────────────────────────────── */}
          {tab === "rentabilidad" && (
            <TabRentabilidad clienteId={clientId} />
          )}
        </div>

        {/* Modales */}
        {modalEditar && (
          <ModalEditarCliente
            cliente={cliente}
            onClose={() => setModalEditar(false)}
            onSaved={() => { setModalEditar(false); load(); }}
          />
        )}
        {modalNuevaSede && (
          <ModalNuevaSede
            clientId={clientId}
            onClose={() => setModalNuevaSede(false)}
            onSaved={() => { setModalNuevaSede(false); load(); }}
          />
        )}
        {modalPuesto !== null && (
          <ModalPuesto
            clientId={clientId}
            sedes={sedes}
            puesto={modalPuesto === "nuevo" ? null : modalPuesto}
            onClose={() => setModalPuesto(null)}
            onSaved={() => { setModalPuesto(null); load(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
