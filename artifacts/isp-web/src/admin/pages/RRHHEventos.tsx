/**
 * RRHHEventos.tsx — Página principal del módulo de Eventos RRHH.
 *
 * Container delgado: el grueso del UI vive en `./rrhh-eventos/*`.
 * Tabs: Eventos · Vacaciones · Alertas Pizarrón.
 */

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Archive, BarChart2, Bell, ChevronDown, ClipboardList, Clock, Loader2,
  Palmtree, Plus, RefreshCw, Search, Settings, ShieldAlert, ShieldCheck,
  ShieldOff, TrendingUp, Users2,
} from "lucide-react";
import VacacionesTab from "./VacacionesTab";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { EventoRrhh } from "@/lib/pdfRrhh";
import {
  generarBoletaDescuento, generarActaAdministrativa,
  generarConstanciaHorasExtra, generarDocumentoAnulacion,
} from "@/lib/pdfRrhh";

import { API, apiFetch, apiPatch, apiPost, construirDatosActa } from "./rrhh-eventos/helpers";
import { ApiError } from "@/lib/httpClient";
import { ESTADO_CONFIG } from "./rrhh-eventos/constants";
import { AlertasPizarronTab } from "./rrhh-eventos/AlertasPizarronTab";
import { BatchActasPanel } from "./rrhh-eventos/BatchActasPanel";
import { EventoCard } from "./rrhh-eventos/EventoCard";
import { ModalAnulacion } from "./rrhh-eventos/ModalAnulacion";
import { ModalCausalesActa } from "./rrhh-eventos/ModalCausalesActa";
import { ModalConfigEmpresa } from "./rrhh-eventos/ModalConfigEmpresa";
import { ModalNuevoEvento } from "./rrhh-eventos/ModalNuevoEvento";

interface EmpleadoRiesgo {
  employeeId: number; employeeNombre: string;
  score: number; nivel: "bajo" | "medio" | "alto";
  faltas30d: number; faltasTotal: number; suspensionesTotal: number;
}
interface TopEmpleado {
  employeeId: number; employeeNombre: string; faltas: number; suspensiones: number;
}
interface TendenciaMes { mes: string; faltas: number; suspensiones: number; }

interface AlertaPizarronItem { employee_id?: number; tipo: string; }

export default function RRHHEventos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  const [paginaActiva, setPaginaActiva] = useState<"eventos" | "vacaciones" | "alertas">("eventos");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [tabEventos, setTabEventos] = useState<"pendientes" | "historial">("pendientes");
  const [modalAnulacion, setModalAnulacion] = useState<EventoRrhh | null>(null);
  const [modalCausales, setModalCausales] = useState<EventoRrhh | null>(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (filtroTipo) params.set("tipo", filtroTipo);
    if (filtroEstado) params.set("estado", filtroEstado);
    if (busqueda) params.set("empleado", busqueda);
    const q = params.toString();
    return `${API}/rrhh/eventos${q ? `?${q}` : ""}`;
  };

  const { data: eventos = [], isLoading, refetch } = useQuery<EventoRrhh[]>({
    queryKey: ["rrhh-eventos", filtroTipo, filtroEstado, busqueda],
    queryFn: () => apiFetch(buildUrl()),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<{
    total: string; pendientes: string; en_proceso: string;
    cerrados: string; anulados: string; faltas: string;
    suspensiones: string; ultimos_7_dias: string; ultimos_30_dias: string;
  }>({
    queryKey: ["rrhh-stats"],
    queryFn: () => apiFetch(`${API}/rrhh/stats`),
    staleTime: 60_000,
  });

  const { data: discData } = useQuery<{
    top: TopEmpleado[];
    tendencia: TendenciaMes[];
    enRiesgo: EmpleadoRiesgo[];
    resumen: { totalAlto: number; totalMedio: number; totalBajo: number };
  }>({
    queryKey: ["rrhh-disciplinario"],
    queryFn: () => apiFetch(`${API}/rrhh/disciplinario`),
    staleTime: 60_000,
  });

  const [showDashboard, setShowDashboard] = useState(false);

  const { data: alertasPizarronCount } = useQuery<{ alertas: AlertaPizarronItem[]; totales: { faltantes: number; horasExtra: number } }>({
    queryKey: ["rrhh-alertas-count"],
    queryFn: () => apiFetch(`${API}/rrhh/alertas-pizarron?estado=pendiente`),
    staleTime: 30_000,
    refetchInterval: 45_000,
  });
  const totalAlertasBadge = (alertasPizarronCount?.totales?.faltantes ?? 0) + (alertasPizarronCount?.totales?.horasExtra ?? 0);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["rrhh-eventos"] });
    qc.invalidateQueries({ queryKey: ["rrhh-stats"] });
  }

  async function handleCrearEvento(data: {
    employeeId: number; tipoEvento: string;
    fechaInicio: string; fechaFin?: string; notas?: string;
  }) {
    try {
      await apiPost(`${API}/rrhh/eventos`, {
        employeeId: data.employeeId,
        tipoEvento: data.tipoEvento,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        notas: data.notas,
      });
      invalidar();
      qc.invalidateQueries({ queryKey: ["rrhh-disciplinario"] });
      toast({ title: "Evento registrado", description: `Tipo: ${data.tipoEvento}` });
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? (e.body as { error?: string })?.error : undefined;
      toast({ title: "Error al crear evento", description: msg || "Intenta de nuevo", variant: "destructive" });
      throw e;
    }
  }

  async function handleEstadoChange(id: number, estado: string) {
    try {
      await apiPatch(`${API}/rrhh/eventos/${id}/estado`, { estado });
      invalidar();
      toast({ title: "Estado actualizado", description: `"${ESTADO_CONFIG[estado]?.label ?? estado}"` });
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? (e.body as { error?: string })?.error : undefined;
      toast({ title: "Error", description: msg || "No se pudo actualizar", variant: "destructive" });
    }
  }

  async function handleAnular(motivo: string) {
    if (!modalAnulacion) return;
    const usuario = currentUser?.nombre ?? currentUser?.username ?? "usuario";
    try {
      const res = await apiPost(`${API}/rrhh/eventos/${modalAnulacion.id}/anular`, {
        motivoAnulacion: motivo,
        usuario,
      });
      invalidar();
      setModalAnulacion(null);
      const parMsg = (res as { parAnulado?: boolean })?.parAnulado
        ? " El evento de horas extra vinculado también fue anulado."
        : "";
      toast({
        title: "Evento anulado correctamente",
        description: `ERH-${String(modalAnulacion.id).padStart(4, "0")} marcado como ANULADO.${parMsg}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? (e.body as { error?: string })?.error : undefined;
      toast({ title: "Error al anular", description: msg || "Intenta de nuevo", variant: "destructive" });
      throw e;
    }
  }

  async function registrarDescarga(evento: EventoRrhh, tipo: "boleta" | "acta" | "anulacion" | "constancia_he") {
    try {
      await apiPatch(`${API}/rrhh/eventos/${evento.id}/documentos`, {
        tipo,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "usuario",
      });
      invalidar();
    } catch { /* No bloquear la descarga si falla el registro */ }
  }

  async function handleDescargarBoleta(evento: EventoRrhh) {
    try {
      if (evento.tipo_evento === "horas_extra") {
        await generarConstanciaHorasExtra(evento);
        await registrarDescarga(evento, "constancia_he");
        toast({ title: "Constancia de HE generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
      } else {
        await generarBoletaDescuento(evento);
        await registrarDescarga(evento, "boleta");
        toast({ title: "Boleta generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
      }
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  function handleDescargarActa(evento: EventoRrhh) {
    setModalCausales(evento);
  }

  async function generarActaConCausales(evento: EventoRrhh, causalesIds: string[], hechosExtra?: string) {
    try {
      const datos = await construirDatosActa(evento);
      datos.causales_seleccionadas = causalesIds;
      if (hechosExtra) datos.hechos = hechosExtra;
      await generarActaAdministrativa(datos);
      await registrarDescarga(evento, "acta");
      toast({ title: "Acta administrativa generada", description: `Acta No. ${datos.numero_acta}` });
      setModalCausales(null);
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  async function handleDescargarAnulacion(evento: EventoRrhh) {
    try {
      await generarDocumentoAnulacion(evento);
      await registrarDescarga(evento, "anulacion");
      toast({ title: "Acta de anulación generada", description: `ERH-${String(evento.id).padStart(4, "0")}` });
    } catch {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="Eventos RRHH">
      <div className="flex flex-col gap-6 p-6">

        {/* ── Encabezado ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-5 h-5 text-purple-400" />
              <h1 className="text-xl font-bold text-white">RRHH</h1>
            </div>
            <p className="text-sm text-white/40">
              Eventos disciplinarios · vacaciones · documentos laborales
            </p>
          </div>
          {paginaActiva === "eventos" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalConfig(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/50 hover:text-white transition-all"
                title="Configuración de empresa"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["rrhh-stats"] }); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/50 hover:text-white transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </button>
              <button
                onClick={() => setModalNuevo(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-semibold text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo evento
              </button>
            </div>
          )}
        </div>

        {/* ── Tabs principales ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
          <button
            onClick={() => setPaginaActiva("eventos")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              paginaActiva === "eventos"
                ? "bg-purple-600 text-white shadow"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Eventos RRHH
          </button>
          <button
            onClick={() => setPaginaActiva("vacaciones")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              paginaActiva === "vacaciones"
                ? "bg-teal-600 text-white shadow"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Palmtree className="w-4 h-4" />
            Vacaciones
          </button>
          <button
            onClick={() => setPaginaActiva("alertas")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              paginaActiva === "alertas"
                ? "bg-red-700 text-white shadow"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Bell className="w-4 h-4" />
            Alertas Pizarrón
            {totalAlertasBadge > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 animate-pulse">
                {totalAlertasBadge}
              </span>
            )}
          </button>
        </div>

        {paginaActiva === "vacaciones" && <VacacionesTab />}
        {paginaActiva === "alertas" && <AlertasPizarronTab />}

        {paginaActiva === "eventos" && (<React.Fragment>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total eventos", value: stats.total, color: "text-white", bg: "bg-white/5 border-white/8" },
              { label: "Pendientes", value: stats.pendientes, color: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/10" },
              { label: "Faltas", value: stats.faltas, color: "text-red-400", bg: "bg-red-400/5 border-red-400/10" },
              { label: "Anulados", value: stats.anulados, color: "text-red-400/60", bg: "bg-white/3 border-white/6" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border rounded-2xl p-4`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/35 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Dashboard Disciplinario ─────────────────────────────────────── */}
        <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white/80">Dashboard Disciplinario</span>
              {discData && discData.resumen.totalAlto > 0 && (
                <span className="text-[10px] bg-red-400/10 border border-red-400/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                  {discData.resumen.totalAlto} en riesgo alto
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${showDashboard ? "rotate-180" : ""}`} />
          </button>

          {showDashboard && discData && (
            <div className="border-t border-white/8 p-5 space-y-5">

              <div className="grid grid-cols-3 gap-3">
                {[
                  { nivel: "Alto",  count: discData.resumen.totalAlto,  icon: ShieldOff,   color: "text-red-400",    bg: "bg-red-400/5 border-red-400/15"    },
                  { nivel: "Medio", count: discData.resumen.totalMedio, icon: ShieldAlert, color: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/15" },
                  { nivel: "Bajo",  count: discData.resumen.totalBajo,  icon: ShieldCheck, color: "text-green-400",  bg: "bg-green-400/5 border-green-400/15"  },
                ].map(({ nivel, count, icon: Icon, color, bg }) => (
                  <div key={nivel} className={`${bg} border rounded-xl p-3 text-center`}>
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                    <p className={`text-2xl font-bold ${color}`}>{count}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Riesgo {nivel}</p>
                  </div>
                ))}
              </div>

              {discData.top.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Users2 className="w-3 h-3" /> Empleados con más eventos (top {discData.top.length})
                  </p>
                  <div className="space-y-1.5">
                    {discData.top.map((emp, i) => {
                      const score = Math.max(0, 100 - emp.faltas * 10 - emp.suspensiones * 20);
                      const clsColor = score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400";
                      return (
                        <div key={emp.employeeId} className="flex items-center gap-3 bg-[#0c1929] border border-white/6 rounded-xl px-3 py-2">
                          <span className="text-[10px] text-white/20 w-4 shrink-0">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/70 truncate">{emp.employeeNombre}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {emp.faltas > 0 && (
                              <span className="text-[10px] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded">
                                {emp.faltas} falta{emp.faltas !== 1 ? "s" : ""}
                              </span>
                            )}
                            {emp.suspensiones > 0 && (
                              <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded">
                                {emp.suspensiones} susp.
                              </span>
                            )}
                            <span className={`text-[10px] font-bold ${clsColor}`}>{score}pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {discData.enRiesgo.filter(e => e.nivel === "alto").length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <ShieldOff className="w-3 h-3 text-red-400" /> Empleados en riesgo alto
                  </p>
                  <div className="space-y-1.5">
                    {discData.enRiesgo.filter(e => e.nivel === "alto").map((emp) => (
                      <div key={emp.employeeId} className="flex items-center gap-3 bg-red-400/3 border border-red-400/15 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 truncate">{emp.employeeNombre}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {emp.faltas30d > 0 && `${emp.faltas30d} faltas en 30 días · `}
                            {emp.suspensionesTotal > 0 && `${emp.suspensionesTotal} suspensión(es) · `}
                            Score: {emp.score}pts
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded">
                          RIESGO ALTO
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {discData.tendencia.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Tendencia últimos 6 meses
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {discData.tendencia.map((mes) => {
                      const maxVal = Math.max(...discData.tendencia.map(m => m.faltas + m.suspensiones), 1);
                      return (
                        <div key={mes.mes} className="flex flex-col items-center gap-1.5 min-w-[52px]">
                          <div className="flex items-end h-12 gap-0.5">
                            <div
                              className="w-3 bg-orange-400/60 rounded-t transition-all"
                              style={{ height: `${Math.round((mes.faltas / maxVal) * 48)}px` }}
                              title={`${mes.faltas} faltas`}
                            />
                            <div
                              className="w-3 bg-red-400/60 rounded-t transition-all"
                              style={{ height: `${Math.round((mes.suspensiones / maxVal) * 48)}px` }}
                              title={`${mes.suspensiones} suspensiones`}
                            />
                          </div>
                          <p className="text-[9px] text-white/25 text-center leading-tight">
                            {mes.mes.slice(5)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-orange-400/60" /><span className="text-[9px] text-white/20">Faltas</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-400/60" /><span className="text-[9px] text-white/20">Suspensiones</span></div>
                  </div>
                </div>
              )}

              {discData.enRiesgo.length === 0 && discData.top.length === 0 && (
                <div className="text-center py-6">
                  <ShieldCheck className="w-10 h-10 text-green-400/20 mx-auto mb-2" />
                  <p className="text-sm text-white/30">Sin eventos disciplinarios registrados</p>
                </div>
              )}
            </div>
          )}
        </div>

        <BatchActasPanel eventos={eventos} />

        {/* ── Sub-tabs: Pendientes / Historial ─────────────────────────── */}
        {(() => {
          const ESTADOS_PENDIENTES = new Set(["pendiente_aprobacion", "pendiente"]);
          const countPendientes = eventos.filter(e => ESTADOS_PENDIENTES.has(e.estado)).length;
          const countHistorial = eventos.filter(e => !ESTADOS_PENDIENTES.has(e.estado)).length;
          const eventosFiltrados = tabEventos === "pendientes"
            ? eventos.filter(e => ESTADOS_PENDIENTES.has(e.estado))
            : eventos.filter(e => !ESTADOS_PENDIENTES.has(e.estado));
          return (<>
            <div className="flex items-center gap-1 bg-white/3 border border-white/8 rounded-xl p-1 w-fit">
              <button
                onClick={() => setTabEventos("pendientes")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tabEventos === "pendientes"
                    ? "bg-amber-600 text-white shadow"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pendientes
                {countPendientes > 0 && (
                  <span className="ml-0.5 bg-white/20 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {countPendientes}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTabEventos("historial")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tabEventos === "historial"
                    ? "bg-white/15 text-white shadow"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Historial
                {countHistorial > 0 && (
                  <span className="ml-0.5 bg-white/10 text-white/60 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {countHistorial}
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar colaborador…"
                  className="w-full bg-[#07111f] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-primary/50"
                />
              </div>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">Todos los tipos</option>
                <option value="falta">Falta</option>
                <option value="suspension">Suspensión</option>
              </select>
              {tabEventos === "historial" && (
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-primary/50 appearance-none"
                >
                  <option value="">Todos los estados</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="anulado">Anulado</option>
                </select>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : eventosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ClipboardList className="w-10 h-10 text-white/15" />
                <p className="text-sm text-white/30">
                  {tabEventos === "pendientes"
                    ? "No hay eventos pendientes de aprobación"
                    : "No hay eventos en el historial"}
                </p>
                {tabEventos === "pendientes" && (
                  <>
                    <p className="text-xs text-white/20 text-center max-w-xs">
                      Los eventos aparecen aquí cuando se registran desde el Pizarrón o manualmente. Cuando se aprueban, pasan al Historial.
                    </p>
                    <button
                      onClick={() => setModalNuevo(true)}
                      className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-semibold text-white transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nuevo evento
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-white/30">
                  {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? "s" : ""}
                  {tabEventos === "historial" && ` · ${eventosFiltrados.filter((e) => e.estado === "anulado").length} anulado${eventosFiltrados.filter((e) => e.estado === "anulado").length !== 1 ? "s" : ""}`}
                </p>
                <div className="space-y-4">
                  {(() => {
                    const usedIds = new Set<number>();
                    const paired: Array<{ falta: EventoRrhh; he: EventoRrhh; movId: number | null }> = [];
                    const evById = new Map<number, EventoRrhh>();
                    eventosFiltrados.forEach(ev => evById.set(ev.id, ev));

                    eventosFiltrados.forEach(ev => {
                      if (usedIds.has(ev.id)) return;
                      if (ev.evento_par_id) {
                        const par = evById.get(ev.evento_par_id);
                        if (par && !usedIds.has(par.id)) {
                          const falta = ev.tipo_evento !== 'horas_extra' ? ev : par;
                          const he = ev.tipo_evento === 'horas_extra' ? ev : par;
                          usedIds.add(falta.id);
                          usedIds.add(he.id);
                          paired.push({ falta, he, movId: ev.movimiento_id ?? par.movimiento_id ?? null });
                        }
                      }
                    });

                    const solos = eventosFiltrados.filter(ev => !usedIds.has(ev.id));

                    return (
                      <>
                        {paired.map(({ falta, he, movId }) => (
                          <div key={`pair-${movId}`} className="bg-[#060e1c] border border-purple-500/15 rounded-2xl overflow-hidden">
                            <div className="px-4 py-2 bg-purple-500/5 border-b border-purple-500/10 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Sustitución #{movId}</span>
                              <span className="text-[10px] text-white/25">·</span>
                              <span className="text-[10px] text-white/30">
                                {falta?.puesto_nombre} — {falta?.cliente_nombre || he?.cliente_nombre}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                              <div className="p-2">
                                {falta ? (
                                  <EventoCard
                                    evento={falta}
                                    onEstadoChange={handleEstadoChange}
                                    onDescargarBoleta={handleDescargarBoleta}
                                    onDescargarActa={handleDescargarActa}
                                    onDescargarAnulacion={handleDescargarAnulacion}
                                    onAnular={(ev) => setModalAnulacion(ev)}
                                    compact
                                    label="TITULAR — Descuento"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center py-6 text-white/15 text-xs">Sin evento titular</div>
                                )}
                              </div>
                              <div className="p-2">
                                {he ? (
                                  <EventoCard
                                    evento={he}
                                    onEstadoChange={handleEstadoChange}
                                    onDescargarBoleta={handleDescargarBoleta}
                                    onDescargarActa={handleDescargarActa}
                                    onDescargarAnulacion={handleDescargarAnulacion}
                                    onAnular={(ev) => setModalAnulacion(ev)}
                                    compact
                                    label="CUBRIENTE — Horas Extra"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center py-6 text-white/15 text-xs">Sin evento HE</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {solos.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {solos.map((ev) => (
                              <EventoCard
                                key={ev.id}
                                evento={ev}
                                onEstadoChange={handleEstadoChange}
                                onDescargarBoleta={handleDescargarBoleta}
                                onDescargarActa={handleDescargarActa}
                                onDescargarAnulacion={handleDescargarAnulacion}
                                onAnular={(ev) => setModalAnulacion(ev)}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </>);
        })()}
        </React.Fragment>)}
      </div>

      {modalAnulacion && (
        <ModalAnulacion
          evento={modalAnulacion}
          onConfirm={handleAnular}
          onClose={() => setModalAnulacion(null)}
        />
      )}

      {modalConfig && (
        <ModalConfigEmpresa onClose={() => setModalConfig(false)} />
      )}

      {modalCausales && (
        <ModalCausalesActa
          evento={modalCausales}
          onGenerar={(causales, hechos) => generarActaConCausales(modalCausales, causales, hechos)}
          onClose={() => setModalCausales(null)}
        />
      )}

      {modalNuevo && (
        <ModalNuevoEvento
          onClose={() => setModalNuevo(false)}
          onCreate={handleCrearEvento}
        />
      )}
    </AdminLayout>
  );
}
