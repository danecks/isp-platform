import { useState, useEffect, useRef, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, TouchSensor, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Users, Loader2, RefreshCw, Plus, X, AlertTriangle, CheckCircle2, MapPin, ArrowLeftRight, History, Shield, Zap, ChevronRight, ChevronLeft, Info, Building2, Circle, XCircle, FileText, Lock, Unlock, Calendar, AlertCircle, ExternalLink, Search, Briefcase, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import { ModalFichaVehiculo } from "@/admin/components/ModalFichaVehiculo";
import RegresosVacacionesBanner from "@/admin/components/RegresosVacacionesBanner";
import { getSessionToken } from "@/lib/httpClient";
import { AdminLayout } from "../layout/AdminLayout";
import { EditarPlantillaPersonalModal } from "./operaciones/EditarPlantillaPersonalModal";
import { fechaHoyStr, iniciales, API_BASE, getSession, apiPost, avatarColor, toISODate } from "./operaciones/utils";
import { Puesto, ClienteBoard, Agente, GrupoRanking, AgenteRankeado, RANKING_GRUPO_CONFIG, SupervisorPool, JefeServicioPool, AdministrativoPool, SUBAREA_LABELS, Pool, PlanFuturo, InicioProyecto, PoolFuturoData, Movimiento, ClienteDisponible, TarjetaSSAPendiente, DiaPendienteCierre, CierreHoyData, OldTitularAccion, TIPOS_NOVEDAD, TIPO_SSA_LABELS } from "./operaciones/types";
import { rankCandidatos } from "./operaciones/ranking";
import { DraggableAgente } from "./operaciones/components/DraggableAgente";
import { PoolFuturoPanel } from "./operaciones/components/PoolFuturoPanel";
import { ClienteColumna } from "./operaciones/components/ClienteColumna";
import { PanelHistorial } from "./operaciones/components/PanelHistorial";
import { TarjetaSSACard } from "./operaciones/components/TarjetaSSACard";
import { ModalSegmentos } from "./operaciones/modals/ModalSegmentos";
import { ModalConfigTurno } from "./operaciones/modals/ModalConfigTurno";
import { ModalPlanSSA } from "./operaciones/modals/ModalPlanSSA";
import { ModalPlanFuturo } from "./operaciones/modals/ModalPlanFuturo";
import { ModalSustituyeTitular } from "./operaciones/modals/ModalSustituyeTitular";
import { ModalEligeCobertura } from "./operaciones/modals/ModalEligeCobertura";
import { ModalCustodiaTipo } from "./operaciones/modals/ModalCustodiaTipo";
import { ModalSustitucion } from "./operaciones/modals/ModalSustitucion";
import { ModalNuevoPuesto } from "./operaciones/modals/ModalNuevoPuesto";
import { ModalLiberar } from "./operaciones/modals/ModalLiberar";
import { ModalRegistrarFalta } from "./operaciones/modals/ModalRegistrarFalta";
import { ModalCierre } from "./operaciones/modals/ModalCierre";
import { ModalReabrir } from "./operaciones/modals/ModalReabrir";
import { ModalQuitarTitularidad } from "./operaciones/modals/ModalQuitarTitularidad";
import { ModalIncentivoCash } from "./operaciones/modals/ModalIncentivoCash";
import { ModalAsignarSSA } from "./operaciones/modals/ModalAsignarSSA";

export default function Operaciones() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { active: isDeleteMode, requestDelete } = useDeleteMode();

  // ── Roles ─────────────────────────────────────────────────────────────────
  const esAdmin             = currentUser?.rol === "admin";
  const esSupervisorOAdmin  = esAdmin || currentUser?.rol === "supervisor";

  // ── Estado UI ──────────────────────────────────────────────────────────────
  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(null);
  const [draggingAgente, setDraggingAgente]         = useState<Agente | null>(null);
  const [historialAbierto, setHistorialAbierto]     = useState(false);
  const [nuevoPuestoData, setNuevoPuestoData]        = useState<ClienteBoard | null | "nuevo">(null);
  const [modalSustitucion, setModalSustitucion]      = useState<{ puesto: Puesto; agente: Agente; advertencia?: string; agentePoolStatus?: "disponible" | "descansando" | "vacaciones" | "trabajando" } | null>(null);
  const [modalEligeCobertura, setModalEligeCobertura] = useState<{ puesto: Puesto; agente: Agente } | null>(null);
  const [modalCustodiaTipo, setModalCustodiaTipo]     = useState<{ puesto: Puesto; agente: Agente; clienteId: number; slotNumero: number } | null>(null);
  const [modalSustituyeTitular, setModalSustituyeTitular] = useState<{ puesto: Puesto; agente: Agente } | null>(null);
  const [modalIncentivo, setModalIncentivo]           = useState<{
    agenteId: number; agenteName: string;
    puestoId: number | null; puestoName: string;
    clienteId: number | null; clienteNombre: string | null;
    sedeId: number | null; fecha: string;
    costoHE?: number | null; jornada?: string;
  } | null>(null);
  const [modalLiberar, setModalLiberar]              = useState<Puesto | null>(null);
  const [modalFalta, setModalFalta]                  = useState<{ puesto: Puesto; titularId: number; titularNombre: string } | null>(null);
  const [modalQuitarTitular, setModalQuitarTitular]  = useState<{ puesto: Puesto; employeeId: number; employeeNombre: string } | null>(null);
  const puedeQuitarTitular = currentUser?.rol === "admin" || currentUser?.rol === "operaciones";
  const [poolTab, setPoolTab]                        = useState<"disponibles" | "disponiblesCubriendo" | "vacacionistasCubriendo" | "trabajando" | "descansandoCiclo" | "haciendoHE" | "enDescanso" | "suspendidos" | "enPuesto" | "enSSA" | "faltando" | "enVacaciones">("disponibles");
  const [busquedaPool, setBusquedaPool]              = useState("");
  const [busquedaPersona, setBusquedaPersona]        = useState("");
  const [colGlobal, setColGlobal]                    = useState<{ v: number; val: boolean }>({ v: 0, val: false });
  const [puestoContexto, setPuestoContexto]          = useState<Puesto | null>(null);
  const [modalCierre, setModalCierre]                = useState(false);
  const [modalReabrir, setModalReabrir]              = useState(false);
  const [filtroZona, setFiltroZona]                  = useState<string>("");
  const [filtroCliente, setFiltroCliente]            = useState<string>("");
  const [modalSegmentos, setModalSegmentos]          = useState<Puesto | null>(null);
  const [modalAsignarSSA, setModalAsignarSSA]        = useState<TarjetaSSAPendiente | null>(null);
  const [ssaTabActivo, setSsaTabActivo]              = useState<"sin_asignar" | "cubierta">("sin_asignar");
  const [fichaVehiculoId, setFichaVehiculoId]        = useState<number | null>(null);
  const [modalCierrePendiente, setModalCierrePendiente] = useState(false);
  const [editarPlantilla, setEditarPlantilla]        = useState<{
    empleadoId: number; empleadoNombre: string; tipo: "supervisor" | "administrativo" | "jefe_servicio";
  } | null>(null);

  // ── Estado de colapso de paneles (persiste en sessionStorage) ─────────────
  function initCollapse(key: string, defaultVal = false) {
    const v = sessionStorage.getItem(key);
    return v === null ? defaultVal : v === "1";
  }
  function togglePanel(key: string, cur: boolean, setter: (v: boolean) => void) {
    const next = !cur;
    sessionStorage.setItem(key, next ? "1" : "0");
    setter(next);
  }
  const [colSSA,       setColSSA]       = useState(() => initCollapse("piz_col_ssa"));
  const [colArranques, setColArranques] = useState(() => initCollapse("piz_col_arr"));
  const [colSupers,    setColSupers]    = useState(() => initCollapse("piz_col_supers"));
  const [colJefes,     setColJefes]     = useState(() => initCollapse("piz_col_jefes"));
  const [colPool,      setColPool]      = useState(() => initCollapse("piz_col_pool"));
  const [colAdmin,     setColAdmin]     = useState(() => initCollapse("piz_col_admin"));

  // ── Planificación futura ───────────────────────────────────────────────────
  const hoyISO = toISODate(new Date());

  // Leer ?pizarronFecha=YYYY-MM-DD de la URL para navegación directa desde el banner
  const fechaDesdeURL = (() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get("pizarronFecha");
    return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
  })();

  const [fechaVista, setFechaVista]           = useState<string>(fechaDesdeURL ?? hoyISO);
  const esFuturo  = fechaVista > hoyISO;
  const esPasado  = fechaVista < hoyISO;
  const esOtraFecha = fechaVista !== hoyISO;
  const [modalPlanFuturo, setModalPlanFuturo] = useState<{ puesto: Puesto; plan: PlanFuturo | null } | null>(null);
  const [modalPlanSSA, setModalPlanSSA]       = useState<InicioProyecto | null>(null);
  const [puestoParaTurno, setPuestoParaTurno] = useState<Puesto | null>(null);

  // Cliente a resaltar cuando el usuario navega desde el banner de arranques
  const [clienteResaltado, setClienteResaltado] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("clienteId");
    return id ? Number(id) : null;
  });
  const resaltadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-limpiar el resaltado después de 4 segundos
  useEffect(() => {
    if (clienteResaltado !== null) {
      if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current);
      resaltadoTimerRef.current = setTimeout(() => setClienteResaltado(null), 4000);
    }
    return () => { if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current); };
  }, [clienteResaltado]);

  // Función para navegar al pizarrón en una fecha específica y resaltar un cliente
  function irAFecha(fecha: string, clienteId?: number) {
    setFechaVista(fecha);
    if (clienteId) setClienteResaltado(clienteId);
    // Actualizar URL sin recargar para que sea compartible
    const params = new URLSearchParams(window.location.search);
    params.set("pizarronFecha", fecha);
    if (clienteId) params.set("clienteId", String(clienteId));
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  }

  function navFecha(delta: number) {
    const d = new Date(fechaVista + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const nuevo = toISODate(d);
    setFechaVista(nuevo);
    // Limpiar params de URL al navegar manualmente
    window.history.replaceState({}, "", window.location.pathname);
  }
  function volverHoy() {
    setFechaVista(hoyISO);
    setClienteResaltado(null);
    window.history.replaceState({}, "", window.location.pathname);
  }
  function formatFechaVista(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  }

  // ── Sensores DnD ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: tablero = [], isLoading: loadingTablero, refetch: refetchTablero } = useQuery<ClienteBoard[]>({
    queryKey: ["operaciones-tablero", esOtraFecha ? fechaVista : "hoy"],
    queryFn: async () => {
      const url = esOtraFecha
        ? `${API_BASE}/operaciones/tablero?fecha=${fechaVista}`
        : `${API_BASE}/operaciones/tablero`;
      const r = await fetch(url, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`No se pudo cargar el tablero (HTTP ${r.status})`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: esOtraFecha ? false : 30_000,
  });

  const { data: pool, isLoading: loadingPool, refetch: refetchPool } = useQuery<Pool>({
    queryKey: ["operaciones-pool", puestoContexto?.id ?? null, fechaVista],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (puestoContexto) params.set("puesto_id", String(puestoContexto.id));
      if (fechaVista) params.set("fecha", fechaVista);
      const qs = params.toString();
      const url = `${API_BASE}/operaciones/pool${qs ? `?${qs}` : ""}`;
      const r = await fetch(url, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`No se pudo cargar el pool (HTTP ${r.status})`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  // Panel "Administración" eliminado: consolidado en "Personal Administrativo" (cyan).
  // El endpoint /operaciones/tablero/administracion sigue existiendo pero ya no se consume aquí.

  const { data: historial = [], isLoading: loadingHistorial } = useQuery<Movimiento[]>({
    queryKey: ["operaciones-historial"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/historial?limit=80`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`historial ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: historialAbierto,
    refetchInterval: historialAbierto ? 15_000 : false,
  });

  const { data: clientesDisponibles = [] } = useQuery<ClienteDisponible[]>({
    queryKey: ["operaciones-clientes"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/clientes-disponibles`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`clientes-disponibles ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: cierreHoy, refetch: refetchCierre } = useQuery<CierreHoyData>({
    queryKey: ["operaciones-cierre-hoy"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/cierre-hoy`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`cierre-hoy ${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: tarjetasSSA = [] } = useQuery<TarjetaSSAPendiente[]>({
    queryKey: ["ssa-tablero-pizarron"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/solicitudes-servicio/tablero`, {
        headers: { "x-isp-session": getSession() },
      });
      if (!r.ok) throw new Error(`ssa/tablero ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 30_000,
  });

  // ── Query: puestos sin zona (alerta operativa) ───────────────────────────
  const { data: sinZonaData } = useQuery<{ total: number; puestos: { id: number; nombre: string; cliente: string }[] }>({
    queryKey: ["puestos-sin-zona"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/puestos/sin-zona`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`puestos/sin-zona ${r.status}`);
      return r.json();
    },
    refetchInterval: 120_000,
  });
  const puestosSinZonaCount = sinZonaData?.total ?? 0;

  // ── Queries: planificación futura ────────────────────────────────────────
  const { data: planFuturoDia = [], refetch: refetchPlanFuturo } = useQuery<PlanFuturo[]>({
    queryKey: ["planificacion-futura", fechaVista],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/planificacion-futura?fecha=${fechaVista}`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`planificacion-futura ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: esFuturo,
    refetchInterval: esFuturo ? 30_000 : false,
  });

  const { data: cambiosFuturosProximos = {} } = useQuery<Record<number, PlanFuturo[]>>({
    queryKey: ["planificacion-futura-proximos"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/planificacion-futura/proximos`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`planificacion-futura/proximos ${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  // Lookup para la vista futura: puestoId → plan del día
  const planFuturoPorPuesto: Record<number, PlanFuturo> = {};
  for (const p of planFuturoDia) {
    if (p.puesto_id !== null) planFuturoPorPuesto[p.puesto_id] = p;
  }

  const { data: poolFuturo, isLoading: loadingPoolFuturo } = useQuery<PoolFuturoData>({
    queryKey: ["pool-futuro", fechaVista],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/pool-futuro?fecha=${fechaVista}`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error("pool-futuro error");
      return r.json();
    },
    enabled: esFuturo,
    refetchInterval: esFuturo ? 60_000 : false,
    retry: 1,
  });

  const { data: proximosArranques } = useQuery<{ arranques: InicioProyecto[]; total: number }>({
    queryKey: ["proximos-arranques"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/proximos-arranques?dias=60`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`proximos-arranques ${r.status}`);
      return r.json();
    },
    refetchInterval: 300_000,
    retry: 1,
  });

  // Etapas SSA para el panel del Pizarrón (multi-agente)
  const ssaSinAgente = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados < (t.cantidad_guardias ?? 1);
  });
  const ssaCubierta = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados >= (t.cantidad_guardias ?? 1);
  });

  // isCerrado: la fecha ACTIVA está cerrada (prácticamente nunca true con nuevo modelo de fecha activa)
  const isCerrado = cierreHoy?.estado === "cerrado";
  // diaHoyCerrado: el día de hoy en el calendario fue cerrado y operamos ya en el siguiente
  const diaHoyCerrado = !!(cierreHoy?.esFechaFutura && cierreHoy?.cierreDeHoy);
  // Fecha activa formateada para mostrar en UI (usa la del API si está disponible)
  const fechaActivaStr = cierreHoy?.fechaActivaStr ?? fechaHoyStr();
  // Días pasados sin cerrar — bloquean el trabajo del día actual
  const diasPendientesCierre: DiaPendienteCierre[] = cierreHoy?.diasPendientesCierre ?? [];
  const hayDiasPendientes = diasPendientesCierre.length > 0;
  // El más antiguo primero (ya vienen ordenados del backend)
  const primerDiaPendiente: DiaPendienteCierre | null = diasPendientesCierre[0] ?? null;

  // ── Lógica de cierre basada en fechaVista ──────────────────────────────────
  // diasCerrados: lista explícita de días pasados con estado='cerrado' en BD.
  // Un día pasado está cerrado SOLO si el backend lo reporta explícitamente como cerrado.
  // Días sin registro o con estado='abierto' son editables (modo cuadre).
  const diasCerrados: string[] = cierreHoy?.diasCerrados ?? [];
  // Hoy cerrado: esFechaFutura (API avanzó al siguiente) o cierreDeHoy existe
  const hoyCerrado = !!(cierreHoy?.esFechaFutura || cierreHoy?.cierreDeHoy?.estado === "cerrado");
  // Viendo hoy pero hay días pasados sin cerrar → bloqueado
  const bloqueadoPorPendientes = !esPasado && !esFuturo && hayDiasPendientes && !hoyCerrado;
  // ¿El día actual visto ya está cerrado?
  // Una fecha está cerrada SSI tiene registro explícito con estado='cerrado' en BD.
  // No se debe inferir desde `esFechaFutura` (eso indica que la fecha activa avanzó
  // porque "hoy del servidor" está cerrado, pero no que la fecha que estás viendo lo esté).
  const fechaVistaCerrada = diasCerrados.includes(fechaVista ?? "");

  const fechaVistaStr = (() => {
    if (!fechaVista) return fechaHoyStr();
    const [y, m, d] = fechaVista.split("-");
    return `${d}-${m}-${y}`;
  })();
  const fechaCierreParaReabrir = esPasado && fechaVistaCerrada
    ? fechaVistaStr
    : diaHoyCerrado
      ? (cierreHoy!.cierreDeHoy!.fecha_str ?? fechaHoyStr())
      : fechaHoyStr();

  // ── Invalidar y refrescar ─────────────────────────────────────────────────
  function invalidate() {
    qc.invalidateQueries({ queryKey: ["operaciones-tablero"] });
    qc.invalidateQueries({ queryKey: ["operaciones-pool"] });
    qc.invalidateQueries({ queryKey: ["operaciones-historial"] });
    qc.invalidateQueries({ queryKey: ["ssa-tablero-pizarron"] });
    qc.invalidateQueries({ queryKey: ["pool-disponibilidad"] });
  }

  function invalidateFuture() {
    qc.invalidateQueries({ queryKey: ["planificacion-futura"] });
    qc.invalidateQueries({ queryKey: ["planificacion-futura-proximos"] });
    qc.invalidateQueries({ queryKey: ["pool-futuro"] });
  }

  // ── Handlers: planificación futura ───────────────────────────────────────
  async function guardarPlanFuturo(data: {
    tipoAusencia: string;
    titularAusenteId: number | null;
    relevId: number | null;
    motivo: string;
    notas: string;
  }) {
    if (!modalPlanFuturo) return;
    const { puesto, plan } = modalPlanFuturo;
    if (plan) {
      await fetch(`${API_BASE}/operaciones/planificacion-futura/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ ...data }),
      });
      toast({ title: "Plan actualizado", description: `${puesto.nombre} · ${formatFechaVista(fechaVista)}` });
    } else {
      await fetch(`${API_BASE}/operaciones/planificacion-futura`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          fecha: fechaVista,
          puestoId: puesto.id,
          tipoEvento: "ausencia",
          ...data,
          creadoPor: currentUser?.username ?? "sistema",
        }),
      });
      toast({ title: "Planificación guardada", description: `${puesto.nombre} · ${formatFechaVista(fechaVista)}` });
    }
    setModalPlanFuturo(null);
    invalidateFuture();
  }

  async function eliminarPlanFuturo(planId: number) {
    await fetch(`${API_BASE}/operaciones/planificacion-futura/${planId}`, { method: "DELETE", headers: { "x-isp-session": getSession() } });
    toast({ title: "Plan cancelado" });
    setModalPlanFuturo(null);
    invalidateFuture();
  }

  async function guardarPlanSSA(agentesSeleccionados: Array<{ id: number | null }>) {
    if (!modalPlanSSA) return;
    const ip = modalPlanSSA;
    const res = await fetch(`${API_BASE}/operaciones/planificacion-futura/ssa-batch`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({
        fecha: fechaVista,
        ssaId: ip.ssa_id,
        agentes: agentesSeleccionados.filter((a) => a.id),
        creadoPor: currentUser?.username ?? "sistema",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Error al guardar", description: body.error ?? "Error desconocido", variant: "destructive" });
      return;
    }
    const n = agentesSeleccionados.filter((a) => a.id).length;
    toast({
      title: n > 0 ? "Planificación SSA guardada" : "Planes SSA cancelados",
      description: n > 0 ? `${ip.cliente_nombre} · ${n} agente(s) planificado(s)` : `${ip.cliente_nombre} · sin agentes planificados`,
    });
    setModalPlanSSA(null);
    invalidateFuture();
  }

  async function eliminarPlanSSA() {
    if (!modalPlanSSA) return;
    await guardarPlanSSA([]);
  }

  // ── Remover agente de un SSA ─────────────────────────────────────────────
  async function removerAgenteSSA(t: TarjetaSSAPendiente, motivo?: string, notas?: string) {
    try {
      const r = await fetch(`${API_BASE}/solicitudes-servicio/${t.id}/remover-agente`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-isp-session": getSessionToken(),
        },
        body: JSON.stringify({ motivo: motivo ?? null, notas: notas ?? null }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Error al remover agente", description: err.error ?? "Error desconocido", variant: "destructive" });
        return;
      }
      const descripcionToast = motivo === "agente_declino"
        ? "El agente declinó. Queda registrado y el SSA volvió a Pendiente Operaciones."
        : "El agente fue desvinculado del servicio y volvió al pool.";
      toast({ title: "Agente removido", description: descripcionToast });
      invalidate();
    } catch {
      toast({ title: "Error de red", description: "No se pudo conectar con el servidor.", variant: "destructive" });
    }
  }

  // ── DnD: inicio ───────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    if (fechaVistaCerrada) return;
    const agenteId = parseInt(event.active.id.toString().replace("agent-", ""));
    const agente = [
      ...(pool?.disponibles ?? []),
      ...(pool?.trabajando ?? []),
      ...(pool?.descansandoCiclo ?? []),
      ...(pool?.enDescanso ?? []),
      ...(pool?.suspendidos ?? []),
      ...(pool?.enPuesto ?? []),
      ...(pool?.enSSA ?? []),
    ].find((a) => a.id === agenteId);
    if (agente) setDraggingAgente(agente);
  }

  // ── DnD: fin ──────────────────────────────────────────────────────────────
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingAgente(null);
    if (fechaVistaCerrada) return;
    if (!over) return;

    const agenteId = parseInt(active.id.toString().replace("agent-", ""));
    const puestoIdRaw = over.id.toString().replace("puesto-", "");

    const agente = [
      ...(pool?.disponibles ?? []),
      ...(pool?.trabajando ?? []),
      ...(pool?.descansandoCiclo ?? []),
      ...(pool?.enDescanso ?? []),
      ...(pool?.suspendidos ?? []),
      ...(pool?.enPuesto ?? []),
      ...(pool?.enSSA ?? []),
    ].find((a) => a.id === agenteId);

    const puesto = tablero.flatMap((c) => c.puestos).find((p) => String(p.id) === puestoIdRaw);

    if (!agente || !puesto) return;

    if (puesto.es_custodia) {
      await asignarCustodia(puesto, agente);
    } else {
      await iniciarAsignacion(puesto, agente);
    }
  }

  async function asignarCustodia(puesto: Puesto, agente: Agente) {
    const tieneTitular = !!puesto.titular_employee_id;

    if (tieneTitular) {
      setModalSustitucion({ puesto, agente, agentePoolStatus: detectarPoolStatus(agente) });
      return;
    }

    // Slot sin titular → preguntar al operador si es titular fijo o solo cobertura del día
    const idParts = String(puesto.id).split("-");
    const clienteId = parseInt(idParts[1]);
    const slotNumero = parseInt(idParts[2]);
    setModalCustodiaTipo({ puesto, agente, clienteId, slotNumero });
  }

  async function ejecutarAsignarCustodia(
    clienteId: number,
    slotNumero: number,
    agente: Agente,
    soloCobertura: boolean,
    puesto?: Puesto,
  ) {
    try {
      const resp = await fetch(`${API_BASE}/operaciones/asignar-custodia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          clienteId,
          slotNumero,
          employeeId: agente.id,
          fecha: fechaVista || undefined,
          soloCobertura,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        toast({ title: "Error", description: data.error || "Error al asignar custodia", variant: "destructive" });
        return;
      }
      toast({
        title: soloCobertura ? "Cobertura asignada" : "Titular asignado",
        description: `${agente.nombre_completo} → Custodio ${slotNumero}`,
      });
      invalidate();

      // Si el agente está en descanso (descanso de ciclo o haciendo HE), ofrecer
      // registro de horas extras igual que en puestos fijos.
      const poolStatus = detectarPoolStatus(agente);
      if (poolStatus === "descansando") {
        const clienteNombre = puesto?.cliente_nombre ?? null;
        setModalIncentivo({
          agenteId: agente.id,
          agenteName: agente.nombre_completo,
          puestoId: null,
          puestoName: `Custodio ${slotNumero}${clienteNombre ? ` — ${clienteNombre}` : ""}`,
          clienteId,
          clienteNombre,
          sedeId: null,
          fecha: fechaVista,
          jornada: "12h",
        });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  }

  // ── Helper: es agente del pool (no titular en EOA) ───────────────────────
  function esAgentePool(agente: Agente) {
    const eoa = agente.tipo_asignacion_eoa ?? "sin_asignacion";
    return eoa !== "titular";
  }

  function detectarPoolStatus(agente: Agente): "disponible" | "descansando" | "vacaciones" | "trabajando" {
    if (!pool) return "disponible";
    if ((pool.disponibles ?? []).some(a => a.id === agente.id)) return "disponible";
    if ((pool.disponiblesCubriendo ?? []).some(a => a.id === agente.id)) return "disponible";
    if ((pool.descansandoCiclo ?? []).some(a => a.id === agente.id)) return "descansando";
    if ((pool.haciendoHE ?? []).some(a => a.id === agente.id)) return "descansando";
    if ((pool.enVacaciones ?? []).some(a => a.id === agente.id)) return "vacaciones";
    if ((pool.vacacionistasCubriendo ?? []).some(a => a.id === agente.id)) return "vacaciones";
    if ((pool.trabajando ?? []).some(a => a.id === agente.id)) return "trabajando";
    if ((pool.enPuesto ?? []).some(a => a.id === agente.id)) return "trabajando";
    return "disponible";
  }

  // ── Lógica de asignación/sustitución ─────────────────────────────────────
  async function iniciarAsignacion(puesto: Puesto, agente: Agente) {
    // Si ya tiene el mismo agente, no hacer nada
    if (puesto.agente_id === agente.id) return;

    // ── Puesto multi-titular sin relevo manual activo ─────────────────────────
    // Preguntamos A QUIÉN sustituye antes de continuar
    if (!puesto.agente_id && puesto.es_par_24x24 && (puesto.par_trabajando || puesto.par_descansando)) {
      setModalSustituyeTitular({ puesto, agente });
      return;
    }

    // ── Agente de pool → puesto SIN agente, SIN titular previo (ni en puesto_titulares), y CON slot vacío → auto-asignar
    const tieneTitularesReales = !!puesto.titular_employee_id || (puesto.titulares && puesto.titulares.length > 0);
    if (!puesto.agente_id && !tieneTitularesReales && esAgentePool(agente) && puesto.tiene_slot_vacio) {
      try {
        const resp = await apiPost(`${API_BASE}/operaciones/asignar`, {
          puestoId: puesto.id,
          agenteId: agente.id,
          soloCobertura: false,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          motivoCambio: "asignacion_directa",
          ...(esPasado && fechaVista ? { fechaOperacion: fechaVista } : {}),
        });
        if (resp?.impactoSalarial?.detectado) {
          setTimeout(() => toast({
            title: "⚠️ Cambio con impacto salarial",
            description: "Este puesto tiene condiciones salariales distintas. El cambio requiere autorización de RRHH.",
            variant: "destructive",
          }), 400);
        }
        toast({ title: "Titular asignado", description: `${agente.nombre_completo} → ${puesto.nombre} (auto-asignado a plantilla)` });
        await refetchTablero();
        await refetchPool();
      } catch (e: any) {
        toast({ title: "Error", description: e?.message ?? "No se pudo asignar", variant: "destructive" });
      }
      return;
    }

    // ── Agente de pool → puesto SIN agente (sin slot vacío) → preguntar
    if (!puesto.agente_id && esAgentePool(agente)) {
      setModalEligeCobertura({ puesto, agente });
      return;
    }

    // Flujo normal: verificar disponibilidad y mostrar modal de confirmación
    try {
      const poolStatus = detectarPoolStatus(agente);
      const disp = await fetch(`${API_BASE}/operaciones/agentes/${agente.id}/disponibilidad`, { headers: { "x-isp-session": getSession() } }).then((r) => r.json());
      if (disp.puestosActivos.length > 0) {
        const yaTiene = disp.puestosActivos[0];
        setModalSustitucion({
          puesto,
          agente,
          advertencia: `${agente.nombre_completo} ya está en ${yaTiene.cliente_nombre} — ${yaTiene.nombre}. ¿Forzar?`,
          agentePoolStatus: poolStatus,
        });
      } else {
        setModalSustitucion({ puesto, agente, agentePoolStatus: poolStatus });
      }
    } catch {
      setModalSustitucion({ puesto, agente, agentePoolStatus: detectarPoolStatus(agente) });
    }
  }

  // ── Confirmar elección de cobertura (pool → puesto vacío) ────────────────
  async function confirmarEligeCobertura(soloCobertura: boolean, oldTitularAccion?: OldTitularAccion, fechaEfectiva?: string, motivoCambio?: string, horaInstalacion?: string) {
    if (!modalEligeCobertura) return;
    const { puesto, agente } = modalEligeCobertura;
    setModalEligeCobertura(null);
    try {
      const respAsignar = await apiPost(`${API_BASE}/operaciones/asignar`, {
        puestoId: puesto.id,
        agenteId: agente.id,
        soloCobertura,
        oldTitularAccion: oldTitularAccion ?? null,
        fechaEfectiva: fechaEfectiva ?? null,
        motivoCambio: motivoCambio ?? null,
        horaInstalacion: horaInstalacion ?? null,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        // Si estamos en modo cuadre (día pasado), registrar la cobertura en esa fecha
        ...(esPasado && fechaVista ? { fechaOperacion: fechaVista } : {}),
      });
      if (respAsignar?.impactoSalarial?.detectado) {
        setTimeout(() => toast({
          title: "⚠️ Cambio con impacto salarial",
          description: "Este puesto tiene condiciones salariales distintas. El cambio requiere autorización de RRHH.",
          variant: "destructive",
        }), 400);
      }
      if (soloCobertura) {
        const horaLabel = horaInstalacion ? ` desde las ${horaInstalacion}` : "";
        toast({ title: "Cobertura temporal registrada", description: `${agente.nombre_completo} cubre ${puesto.nombre}${horaLabel}` });
        setModalIncentivo({
          agenteId: agente.id,
          agenteName: agente.nombre_completo,
          puestoId: puesto.id,
          puestoName: puesto.nombre,
          clienteId: puesto.cliente_id,
          clienteNombre: puesto.cliente_nombre ?? null,
          sedeId: puesto.sede_id,
          fecha: fechaActivaStr,
          jornada: puesto.jornada ?? "12h",
        });
      } else {
        const motLabel = motivoCambio ? ` · ${motivoCambio.replace(/_/g, " ")}` : "";
        const fechaLabel = fechaEfectiva ? ` desde ${fechaEfectiva}` : "";
        toast({ title: "Nuevo titular asignado", description: `${agente.nombre_completo} → ${puesto.nombre}${fechaLabel}${motLabel}` });
        fetch(`${API_BASE}/solicitudes-cambio`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
          body: JSON.stringify({
            employee_id: agente.id,
            puesto_id: puesto.id,
            origen_modulo: "operaciones",
            tipo_cambio: "cambio_titular",
            estado: "pendiente_rrhh",
            motivo: motivoCambio
              ? `${motivoCambio.replace(/_/g, " ")}${fechaEfectiva ? " (efectivo " + fechaEfectiva + ")" : ""}`
              : `Nuevo titular desde pizarrón${fechaEfectiva ? " efectivo " + fechaEfectiva : ""}`,
            datos_antes: puesto.agente_id ? { agente_id: puesto.agente_id, agente: puesto.nombre ?? "" } : null,
            datos_despues: { agente_id: agente.id, agente: agente.nombre_completo, fecha_efectiva: fechaEfectiva ?? "inmediata" },
            creado_por: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          }),
        }).catch(() => {});
      }
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
      }
    }
  }

  // ── Confirmar selección de titular a sustituir (multi-titular) ───────────
  async function confirmarSustituyeTitular(titularSustituidoId: number, motivo: string, horaInstalacion: string) {
    if (!modalSustituyeTitular) return;
    const { puesto, agente } = modalSustituyeTitular;
    setModalSustituyeTitular(null);
    try {
      await apiPost(`${API_BASE}/operaciones/asignar`, {
        puestoId: puesto.id,
        agenteId: agente.id,
        soloCobertura: true,
        titularSustituidoId,
        motivoCambio: motivo,
        horaInstalacion: horaInstalacion || null,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
      });
      toast({ title: "Relevo registrado", description: `${agente.nombre_completo} cubre ${puesto.nombre} desde las ${horaInstalacion}` });
      setModalIncentivo({
        agenteId: agente.id,
        agenteName: agente.nombre_completo,
        puestoId: puesto.id,
        puestoName: puesto.nombre,
        clienteId: puesto.cliente_id,
        clienteNombre: puesto.cliente_nombre ?? null,
        sedeId: puesto.sede_id,
        fecha: fechaActivaStr,
        jornada: puesto.jornada ?? "12h",
      });
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
      }
    }
  }

  // ── Click en puesto: asignar agente seleccionado ──────────────────────────
  async function handlePuestoClick(puesto: Puesto) {
    const enModoCuadre = esPasado && diasPendientesCierre.some(d => d.fecha === fechaVista);

    // En modo planificación: click en puesto abre el modal de plan futuro
    if (esFuturo) {
      setModalPlanFuturo({ puesto, plan: planFuturoPorPuesto[puesto.id] ?? null });
      return;
    }

    // Sin agente seleccionado: siempre permitir expandir/contextualizar el puesto
    // (es lectura, no modifica nada — incluso si hay días pendientes)
    if (!agenteSeleccionado) {
      setPuestoContexto(prev => prev?.id === puesto.id ? null : puesto);
      if (poolTab !== "disponibles" && poolTab !== "descansandoCiclo") setPoolTab("disponibles");
      return;
    }

    if (fechaVistaCerrada) return;
    if (puesto.es_custodia) {
      await asignarCustodia(puesto, agenteSeleccionado);
      setAgenteSeleccionado(null);
      return;
    }
    await iniciarAsignacion(puesto, agenteSeleccionado);
  }

  // ── Confirmar sustitución / asignación ───────────────────────────────────
  async function confirmarSustitucion(motivo: string, notas: string, forzar: boolean, tipoSustitucion: string = "relevo", tipoNovedad?: string, coberturaTipo?: string, horasParcial?: { inicio: string; fin: string }, pagoEfectivo?: { monto: number; pagadoPor: string }) {
    if (!modalSustitucion) return;
    const { puesto, agente } = modalSustitucion;

    try {
      if (puesto.es_custodia) {
        const idParts = String(puesto.id).split("-");
        const clienteId = parseInt(idParts[1]);
        const slotNumero = parseInt(idParts[2]);

        if (tipoSustitucion === "reasignacion") {
          await apiPost(`${API_BASE}/operaciones/cambiar-titular-custodia`, {
            clienteId,
            slotNumero,
            nuevoTitularId: agente.id,
            anteriorTitularId: puesto.titular_employee_id,
            motivo: tipoNovedad ?? motivo,
            notas: notas || undefined,
            usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          });
          toast({ title: "Titular cambiado", description: `${agente.nombre_completo} es el nuevo titular de Custodio ${slotNumero}` });
        } else {
          if (puesto.titular_employee_id && !(puesto as any).titular_faltando) {
            await apiPost(`${API_BASE}/operaciones/registrar-falta-custodia`, {
              clienteId,
              slotNumero,
              empleadoId: puesto.titular_employee_id,
              motivo: tipoNovedad ?? motivo,
              notas: notas || undefined,
              usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
              fecha: fechaVista,
            });
          }

          const resp = await fetch(`${API_BASE}/operaciones/asignar-custodia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
            body: JSON.stringify({
              clienteId,
              slotNumero,
              employeeId: agente.id,
              fecha: fechaVista || undefined,
              soloCobertura: true,
            }),
          });
          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            toast({ title: "Error", description: data.error || "Error al asignar custodia", variant: "destructive" });
            setModalSustitucion(null);
            return;
          }
          const labelNov = TIPOS_NOVEDAD.find((t) => t.value === (tipoNovedad ?? ""))?.label ?? tipoNovedad ?? motivo;
          toast({ title: `Sustitución registrada · ${labelNov}`, description: `${puesto.titular_nombre ?? "Titular"} → ${agente.nombre_completo} en Custodio ${slotNumero}` });

          // Si el agente entrante estaba descansando o de vacaciones, abrir
          // modal de HE para registrar pago en efectivo o dejar para planilla.
          const poolStatus = modalSustitucion?.agentePoolStatus;
          if (poolStatus === "descansando" || poolStatus === "vacaciones") {
            const clienteNombre = puesto.cliente_nombre ?? null;
            setModalIncentivo({
              agenteId: agente.id,
              agenteName: agente.nombre_completo,
              puestoId: null,
              puestoName: `Custodio ${slotNumero}${clienteNombre ? ` — ${clienteNombre}` : ""}`,
              clienteId,
              clienteNombre,
              sedeId: null,
              fecha: fechaVista,
              jornada: "12h",
            });
          }
        }
        setModalSustitucion(null);
        setAgenteSeleccionado(null);
        setPuestoContexto(null);
        invalidate();
        return;
      }

      if (puesto.agente_id) {
        const poolStatus = modalSustitucion?.agentePoolStatus;
        const generaHE = poolStatus === "descansando" || poolStatus === "vacaciones";
        const resp = await apiPost(`${API_BASE}/operaciones/sustituir`, {
          puestoId: puesto.id,
          agenteEntranteId: agente.id,
          agenteSalienteId: puesto.agente_id ?? null,
          agenteSalienteNombre: puesto.agente_nombre ?? null,
          motivo,
          notas,
          forzar,
          tipoSustitucion,
          tipoNovedad: tipoNovedad ?? null,
          coberturaTipo: coberturaTipo ?? "completo",
          generaHE,
          ...(horasParcial ? { horaInicioParcial: horasParcial.inicio, horaFinParcial: horasParcial.fin } : {}),
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          ...(esPasado && fechaVista ? { fechaOperacion: fechaVista } : {}),
        });
        if (resp?.impactoSalarial?.detectado) {
          setTimeout(() => toast({
            title: "⚠️ Cambio con impacto salarial",
            description: "Este puesto tiene condiciones salariales distintas. El cambio se aplicó operativamente, pero requiere autorización de RRHH.",
            variant: "destructive",
          }), 400);
        }
        const labelNov = TIPOS_NOVEDAD.find((t) => t.value === (tipoNovedad ?? ""))?.label ?? tipoNovedad ?? "";
        if (resp?.eventoRrhhGenerado) {
          toast({
            title: `Sustitución registrada · ${labelNov}`,
            description: `Evento RRHH generado. Boleta disponible en Eventos RRHH.`,
          });
        } else {
          toast({ title: `Sustitución registrada · ${labelNov}`, description: `${puesto.agente_nombre} → ${agente.nombre_completo}` });
        }
        if (tipoSustitucion === "relevo") {
          if (pagoEfectivo && pagoEfectivo.monto > 0) {
            try {
              const r = await fetch(`${API_BASE}/incentivos`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
                body: JSON.stringify({
                  employeeId: agente.id,
                  employeeNombre: agente.nombre_completo,
                  fecha: fechaActivaStr,
                  clienteId: puesto.cliente_id,
                  clienteNombre: puesto.cliente_nombre ?? null,
                  sedeId: puesto.sede_id,
                  puestoId: puesto.id,
                  puestoNombre: puesto.nombre,
                  tipo: "he_efectivo",
                  monto: pagoEfectivo.monto,
                  motivo: `Pago HE en efectivo — ${puesto.nombre}`,
                  autorizadoPor: currentUser?.nombre ?? currentUser?.username ?? "sistema",
                  pagadoPor: pagoEfectivo.pagadoPor || (currentUser?.nombre ?? "sistema"),
                  metodoPago: "efectivo",
                  estado: "pagado",
                }),
              });
              if (r.status === 409) {
                toast({ title: "Ya registrado", description: "Este pago en efectivo ya fue registrado previamente.", variant: "destructive" });
              } else if (r.ok) {
                toast({ title: "HE pagadas en efectivo", description: `Q${pagoEfectivo.monto.toFixed(2)} → ${agente.nombre_completo}. No se incluirá en planilla.` });
              }
            } catch { }
          }
        }
      } else {
        await apiPost(`${API_BASE}/operaciones/asignar`, {
          puestoId: puesto.id,
          agenteId: agente.id,
          notas,
          forzar,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
        toast({ title: "Agente asignado", description: `${agente.nombre_completo} → ${puesto.nombre}` });
      }
      setModalSustitucion(null);
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        // Conflicto SSA: no se puede forzar — mostrar aviso claro
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
        setModalSustitucion(null);
        return;
      }
      if (e.advertencia) {
        setModalSustitucion((prev) => prev ? { ...prev, advertencia: e.error } : null);
        return;
      }
      toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
    }
  }

  // ── Confirmar liberación ──────────────────────────────────────────────────
  async function confirmarLiberar(motivo: string, horaFin?: string, generarEventoFalta?: boolean) {
    if (!modalLiberar) return;
    try {
      await apiPost(`${API_BASE}/operaciones/liberar`, {
        puestoId: modalLiberar.id,
        motivo,
        horaFin: horaFin ?? null,
        generarEventoFalta: generarEventoFalta ?? false,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
      });
      const extra = generarEventoFalta ? " · Falta registrada en RRHH" : "";
      toast({ title: "Puesto liberado", description: `${modalLiberar.agente_nombre} removido de ${modalLiberar.nombre}${extra}` });
      setModalLiberar(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.error ?? "Error al liberar", variant: "destructive" });
    }
  }

  // ── Confirmar quitar titularidad ─────────────────────────────────────────
  async function confirmarQuitarTitular(motivo: string) {
    if (!modalQuitarTitular) return;
    try {
      await apiPost(`${API_BASE}/operaciones/quitar-titularidad`, {
        puestoId: modalQuitarTitular.puesto.id,
        employeeId: modalQuitarTitular.employeeId,
        motivo,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
      });
      toast({
        title: "Titularidad removida",
        description: `${modalQuitarTitular.employeeNombre} ya no es titular de ${modalQuitarTitular.puesto.nombre}. Vuelve a Disponibles.`,
      });
      setModalQuitarTitular(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Error al quitar titularidad", variant: "destructive" });
    }
  }

  // ── Registrar falta de titular ───────────────────────────────────────────
  async function confirmarFalta(motivo: string, notas?: string) {
    if (!modalFalta) return;
    try {
      if (modalFalta.puesto.es_custodia) {
        const pId = String(modalFalta.puesto.id);
        const parts = pId.split("-");
        const clienteId = Number(parts[1]);
        const slotNumero = Number(parts[2]);
        await apiPost(`${API_BASE}/operaciones/registrar-falta-custodia`, {
          clienteId,
          slotNumero,
          empleadoId: modalFalta.titularId,
          motivo,
          notas: notas || undefined,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          fecha: fechaVista,
        });
      } else {
        await apiPost(`${API_BASE}/operaciones/registrar-falta`, {
          puestoId: modalFalta.puesto.id,
          empleadoId: modalFalta.titularId,
          motivo,
          notas: notas || undefined,
          es_24x24: !!modalFalta.puesto.es_par_24x24,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          fecha: fechaVista,
        });
      }
      toast({ title: "Falta registrada", description: `${modalFalta.titularNombre} — ${modalFalta.puesto.nombre}` });
      setModalFalta(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.error ?? "Error al registrar falta", variant: "destructive" });
    }
  }

  // ── Crear puesto ──────────────────────────────────────────────────────────
  async function crearPuesto(data: {
    clienteId: number | null;
    clienteNombre: string;
    nombre: string;
    turno: string;
    notas: string;
    tipoTurnoId: number;
    fechaInicioCiclo: string;
    zonaOperativaId: number;
    tipoPuesto: "normal" | "custodia";
  }) {
    await apiPost(`${API_BASE}/operaciones/puestos`, data);
    const tipoBadge = data.tipoPuesto === "custodia" ? " · Custodia" : "";
    toast({ title: "Puesto creado", description: `${data.nombre} — ${data.clienteNombre}${tipoBadge}` });
    invalidate();
  }

  // ── Cerrar día ─────────────────────────────────────────────────────────────
  // Siempre cierra la fecha que se está viendo en el pizarrón (fechaVista),
  // ya sea hoy o un día pasado sin cerrar.
  async function cerrarDia(comentario: string, sincronizarCustodias: boolean) {
    const fechaStr = formatFechaVista(fechaVista);
    try {
      const resp: any = await apiPost(`${API_BASE}/operaciones/cierre`, {
        confirmacion: `CERRAR ${fechaStr}`,
        comentario,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
        sincronizarCustodias,
        fecha: fechaVista,
      });
      const syncMsg = resp?.syncCustodias?.totalCambios
        ? ` • ${resp.syncCustodias.totalCambios} custodia(s) actualizada(s).`
        : "";
      toast({ title: "Día cerrado", description: `Cierre de ${fechaStr} registrado.${syncMsg}` });
      setModalCierre(false);
      refetchCierre();
      if (esPasado) volverHoy();
    } catch (e: any) {
      toast({ title: "Error al cerrar", description: e.error ?? "Error desconocido", variant: "destructive" });
      throw e;
    }
  }

  // ── Cerrar día pendiente (fecha pasada sin cierre) ─────────────────────────
  async function cerrarDiaPendiente(comentario: string, sincronizarCustodias: boolean) {
    if (!primerDiaPendiente) return;
    await cerrarDiaPorFecha(primerDiaPendiente, comentario, sincronizarCustodias);
    setModalCierrePendiente(false);
  }

  // ── Cerrar cualquier día pendiente por fecha ────────────────────────────────
  const [diaPendienteSeleccionado, setDiaPendienteSeleccionado] = useState<DiaPendienteCierre | null>(null);

  async function cerrarDiaPorFecha(dia: DiaPendienteCierre, comentario: string, sincronizarCustodias: boolean) {
    try {
      const resp: any = await apiPost(`${API_BASE}/operaciones/cierre`, {
        confirmacion: `CERRAR ${dia.fechaStr}`,
        comentario,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
        sincronizarCustodias,
        fecha: dia.fecha,
      });
      const syncMsg = resp?.syncCustodias?.totalCambios
        ? ` • ${resp.syncCustodias.totalCambios} custodia(s) actualizada(s).`
        : "";
      toast({ title: "Día cerrado", description: `Cierre de ${dia.fechaStr} registrado.${syncMsg}` });
      setDiaPendienteSeleccionado(null);
      refetchCierre();
      // Si estábamos viendo esa fecha, volver a hoy
      if (fechaVista === dia.fecha) volverHoy();
    } catch (e: any) {
      toast({ title: "Error al cerrar", description: e.error ?? "Error desconocido", variant: "destructive" });
      throw e;
    }
  }

  // ── Reabrir día ────────────────────────────────────────────────────────────
  async function reabrirDia(motivo: string) {
    const fechaISO = esPasado && fechaVistaCerrada
      ? fechaVista
      : diaHoyCerrado
        ? cierreHoy!.cierreDeHoy!.fecha.substring(0, 10)
        : (cierreHoy?.cierre?.fecha?.substring(0, 10) ?? undefined);
    try {
      await apiPost(`${API_BASE}/operaciones/reabrir`, {
        confirmacion: `REABRIR ${fechaCierreParaReabrir}`,
        motivo,
        fecha: fechaISO,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
      });
      toast({ title: "Día reabierto", description: `El día ${fechaCierreParaReabrir} está activo nuevamente` });
      setModalReabrir(false);
      refetchCierre();
    } catch (e: any) {
      toast({ title: "Error al reabrir", description: e.error ?? e.message ?? "Error desconocido", variant: "destructive" });
    }
  }

  // ── Eliminar puesto ───────────────────────────────────────────────────────
  function eliminarPuesto(puesto: Puesto) {
    if (!isDeleteMode) {
      toast({ title: "Modo eliminación inactivo", description: "Activa el modo de eliminación para poder borrar puestos.", variant: "destructive" });
      return;
    }
    requestDelete({
      entidad: "puesto",
      entidad_id: puesto.id,
      entidad_descripcion: `${puesto.nombre} — ${puesto.cliente_nombre ?? "Sin cliente"}`,
    });
  }

  // ── Pool filtrado ─────────────────────────────────────────────────────────
  // Cuando hay búsqueda activa, se busca en TODOS los tabs del pool para no perder
  // agentes que estén en una sección distinta a la que el usuario tiene abierta.
  const poolActual: Agente[] = (() => {
    if (!pool) return [];
    if (busquedaPool.trim()) {
      const q = busquedaPool.toLowerCase();
      const secciones: Array<[string, Agente[]]> = [
        ["Disponible",              pool.disponibles            ?? []],
        ["Disp. cubriendo",         pool.disponiblesCubriendo   ?? []],
        ["Descanso ciclo",          pool.descansandoCiclo       ?? []],
        ["Desc/Vac cubriendo",      [...(pool.haciendoHE ?? []), ...(pool.vacacionistasCubriendo ?? [])]],
        ["Trabaja hoy",             pool.trabajando             ?? []],
        ["Faltando",                pool.faltando               ?? []],
        ["Licencia",                pool.enDescanso             ?? []],
        ["En puesto",               pool.enPuesto               ?? []],
        ["En SSA",                  pool.enSSA                  ?? []],
        ["Suspendido",              pool.suspendidos            ?? []],
        ["Vacaciones",              pool.enVacaciones           ?? []],
      ];
      return secciones.flatMap(([label, lista]) =>
        lista
          .filter((a) =>
            a.nombre_completo.toLowerCase().includes(q) ||
            a.puesto?.toLowerCase().includes(q) ||
            a.area?.toLowerCase().includes(q)
          )
          .map((a) => ({ ...a, _seccionLabel: label }))
      );
    }
    if (poolTab === "haciendoHE") {
      return [...(pool.haciendoHE ?? []), ...(pool.vacacionistasCubriendo ?? [])];
    }
    return pool[poolTab] ?? [];
  })();

  // ── Ranking de candidatos para el puesto contextualizado ─────────────────
  // Se activa cuando hay puestoContexto (independiente de si tiene zona o no).
  // Combina disponibles + descansandoCiclo en una lista ordenada por prioridad.
  const candidatosRankeados: AgenteRankeado[] = puestoContexto && pool
    ? rankCandidatos(pool, puestoContexto.zona_operativa_id)
    : [];

  // ── Derivar zonas y clientes únicos para filtros ──────────────────────────
  const zonasDisponibles = (() => {
    const mapa: Record<string, string> = {};
    tablero.flatMap((c) => c.puestos).forEach((p) => {
      if (p.zona_operativa_id && p.zona_nombre) {
        mapa[String(p.zona_operativa_id)] = p.zona_nombre;
      }
    });
    return Object.entries(mapa).map(([id, nombre]) => ({ id, nombre }));
  })();

  const clientesDisponiblesFiltro = tablero.map((c) => ({ id: String(c.clienteId), nombre: c.clienteNombre }));

  // ── Tablero filtrado ──────────────────────────────────────────────────────
  const tableroFiltrado: typeof tablero = (() => {
    let result = tablero;
    if (filtroCliente) {
      result = result.filter((c) => String(c.clienteId) === filtroCliente);
    }
    if (filtroZona) {
      result = result
        .map((c) => ({ ...c, puestos: c.puestos.filter((p) => String(p.zona_operativa_id) === filtroZona) }))
        .filter((c) => c.puestos.length > 0);
    }
    if (busquedaPersona.trim()) {
      const q = busquedaPersona.toLowerCase().trim();
      result = result
        .map((c) => ({
          ...c,
          puestos: c.puestos.filter((p) => {
            const campos: (string | null | undefined)[] = [
              p.agente_nombre,
              p.titular_nombre,
              planFuturoPorPuesto[p.id]?.relevo_nombre,
              planFuturoPorPuesto[p.id]?.titular_ausente_nombre,
            ];
            return campos.some((v) => v && v.toLowerCase().includes(q));
          }),
        }))
        .filter((c) => c.puestos.length > 0);
    }
    return result;
  })();

  // ── Stats generales ───────────────────────────────────────────────────────
  const totalPuestos   = tableroFiltrado.flatMap((c) => c.puestos).length;
  const puestosCubiertos = tableroFiltrado.flatMap((c) => c.puestos).filter((p) => p.estado === "cubierto").length;
  const puestosDescubiertos = totalPuestos - puestosCubiertos;
  const coberturaGlobal = totalPuestos > 0 ? Math.round((puestosCubiertos / totalPuestos) * 100) : 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Pizarrón Operativo">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col h-full gap-4" style={{ minHeight: 0 }}>

          {/* ── ALERTA: titulares regresan de vacaciones ≤5 días ─────────── */}
          <RegresosVacacionesBanner fecha={fechaVista} dias={5} />

          {/* ── ALERTA: días sin cerrar ──────────────────────────────────── */}
          {hayDiasPendientes && (
            <div className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300 leading-tight">
                    {diasPendientesCierre.length === 1
                      ? `1 día sin cerrar — ${primerDiaPendiente!.fechaStr}`
                      : `${diasPendientesCierre.length} días sin cerrar`}
                  </p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Selecciona un día para revisar su pizarrón y cerrarlo cuando esté cuadrado.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {diasPendientesCierre.map((dia) => {
                  const esViendo = fechaVista === dia.fecha;
                  return (
                    <div key={dia.fecha} className={`flex items-center gap-1 rounded-lg border text-xs font-medium overflow-hidden ${esViendo ? "border-amber-400/60 bg-amber-500/20" : "border-white/10 bg-white/5"}`}>
                      <button
                        onClick={() => irAFecha(dia.fecha)}
                        className={`px-3 py-1.5 transition-colors ${esViendo ? "text-amber-200" : "text-white/70 hover:text-white"}`}
                      >
                        {esViendo && <span className="mr-1 text-amber-400">▶</span>}
                        {dia.fechaStr}
                      </button>
                      <button
                        onClick={() => { setDiaPendienteSeleccionado(dia); }}
                        title={`Cerrar ${dia.fechaStr}`}
                        className="px-2 py-1.5 border-l border-white/10 text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                      >
                        <Lock className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {esPasado && diasPendientesCierre.some(d => d.fecha === fechaVista) && (
                <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                  <p className="text-xs text-amber-400/80 flex-1">
                    Estás viendo el pizarrón del <span className="font-bold text-amber-300">{formatFechaVista(fechaVista)}</span>.
                    Cuadra la cobertura y ciérralo cuando esté listo.
                  </p>
                  <button
                    onClick={() => setDiaPendienteSeleccionado(diasPendientesCierre.find(d => d.fecha === fechaVista) ?? null)}
                    className="shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Cerrar {formatFechaVista(fechaVista)}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Barra de acciones ────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Stats */}
            <div className="flex items-center gap-3 bg-[#0c1929] border border-white/8 rounded-xl px-4 py-2">
              <div className="text-center">
                <p className="text-lg font-bold text-white leading-none">{coberturaGlobal}%</p>
                <p className="text-[10px] text-white/30 mt-0.5">Cobertura</p>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div className="text-center">
                <p className="text-lg font-bold text-green-400 leading-none">{puestosCubiertos}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Cubiertos</p>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div className="text-center">
                <p className={`text-lg font-bold leading-none ${puestosDescubiertos > 0 ? "text-red-400 animate-pulse" : "text-white/30"}`}>{puestosDescubiertos}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Descubiertos</p>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div className="text-center">
                <p className="text-lg font-bold text-blue-400 leading-none">{pool?.disponibles?.length ?? 0}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Libres</p>
              </div>
            </div>

            <div className="flex-1" />

            {agenteSeleccionado && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-xl px-3 py-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(agenteSeleccionado.nombre_completo)}`}>
                  {iniciales(agenteSeleccionado.nombre_completo)}
                </div>
                <span className="text-xs text-white/80 font-medium">{agenteSeleccionado.nombre_completo}</span>
                <span className="text-[10px] text-primary/70">seleccionado → toca un puesto</span>
                <button onClick={() => setAgenteSeleccionado(null)} className="text-white/30 hover:text-white ml-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ── Cierre operativo — siempre sobre fechaVista ─────────── */}
            {!esFuturo && (
              fechaVistaCerrada ? (
                // Día ya cerrado (pasado o hoy)
                <>
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-300">Cerrado</span>
                    <span className="text-[10px] text-amber-400/50">·</span>
                    <span className="text-[10px] text-amber-400/60 font-mono">{formatFechaVista(fechaVista)}</span>
                  </div>
                  {esAdmin && (
                    <button
                      onClick={() => setModalReabrir(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl px-3 py-2 transition-colors"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Reabrir
                    </button>
                  )}
                </>
              ) : bloqueadoPorPendientes ? (
                // Intentando ver/cerrar hoy pero hay días pasados sin cerrar
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2" title={`Cierra primero: ${primerDiaPendiente?.fechaStr}`}>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-red-300">
                    Cierra primero el <span className="font-bold text-red-200">{primerDiaPendiente?.fechaStr}</span>
                  </span>
                </div>
              ) : esSupervisorOAdmin ? (
                // Día abierto (pasado pendiente o hoy sin bloqueo) → botón de cierre
                <button
                  onClick={() => setModalCierre(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-300/80 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 rounded-xl px-3 py-2 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" /> Cerrar {formatFechaVista(fechaVista)}
                </button>
              ) : null
            )}

            {!fechaVistaCerrada && !esFuturo && (
              <button
                onClick={() => setNuevoPuestoData("nuevo")}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl px-3 py-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo puesto
              </button>
            )}

            <button
              onClick={() => setHistorialAbierto(!historialAbierto)}
              className={`flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border transition-colors
                ${historialAbierto
                  ? "bg-white/8 border-white/15 text-white"
                  : "bg-[#0c1929] border-white/8 text-white/40 hover:text-white"}`}
            >
              <History className="w-3.5 h-3.5" /> Historial
            </button>

            <a
              href="/admin/operaciones/cierres"
              className="flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border bg-[#0c1929] border-white/8 text-white/40 hover:text-white transition-colors"
              title="Ver historial de cierres"
            >
              <FileText className="w-3.5 h-3.5" /> Cierres
            </a>

            <a
              href="/admin/operaciones/zonas"
              className="flex items-center gap-1.5 text-xs rounded-xl px-3 py-2 border bg-[#0c1929] border-white/8 text-white/40 hover:text-white transition-colors"
              title="Administrar zonas operativas"
            >
              <MapPin className="w-3.5 h-3.5" /> Zonas
            </a>

            <button
              onClick={() => { refetchTablero(); refetchPool(); refetchCierre(); }}
              className="text-white/30 hover:text-white border border-white/8 rounded-xl px-2.5 py-2 bg-[#0c1929] transition-colors"
              title="Refrescar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Barra de navegación de fecha ─────────────────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navFecha(-1)}
              disabled={fechaVista <= "2026-04-01"}
              className="text-white/30 hover:text-white disabled:opacity-20 border border-white/8 rounded-xl px-2 py-1.5 bg-[#0c1929] transition-colors"
              title="Día anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border text-xs font-medium transition-colors ${
              esFuturo  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"  :
              esPasado  ? "bg-amber-500/10  border-amber-500/30  text-amber-300"   :
                          "bg-[#0c1929] border-white/8 text-white/60"
            }`}>
              <Calendar className="w-3 h-3" />
              <input
                type="date"
                value={fechaVista}
                min="2026-04-01"
                onChange={(e) => {
                  setFechaVista(e.target.value);
                  window.history.replaceState({}, "", window.location.pathname);
                }}
                className="bg-transparent outline-none cursor-pointer text-inherit font-mono"
              />
              {esFuturo && (
                <span className="text-indigo-400/70 text-[10px] font-semibold ml-1">PLANIFICACIÓN</span>
              )}
              {esPasado && diasPendientesCierre.some(d => d.fecha === fechaVista) && (
                <span className="text-amber-400/70 text-[10px] font-semibold ml-1">CUADRE</span>
              )}
            </div>

            <button
              onClick={() => navFecha(1)}
              className="text-white/30 hover:text-white border border-white/8 rounded-xl px-2 py-1.5 bg-[#0c1929] transition-colors"
              title="Día siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {esOtraFecha && (
              <button
                onClick={volverHoy}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white bg-[#0c1929] border border-white/8 hover:border-white/20 rounded-xl px-3 py-1.5 transition-colors"
              >
                Hoy
              </button>
            )}
          </div>

          {/* ── Filtros de zona y cliente ─────────────────────────────── */}
          {(zonasDisponibles.length > 0 || clientesDisponiblesFiltro.length > 1) && (
            <div className="flex items-center gap-2 flex-wrap">
              {zonasDisponibles.length > 0 && (
                <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-1.5 py-1">
                  <MapPin className="w-3 h-3 text-white/20 ml-1" />
                  <select
                    value={filtroZona}
                    onChange={(e) => setFiltroZona(e.target.value)}
                    className="bg-transparent text-xs text-white/60 outline-none pr-1"
                  >
                    <option value="">Todas las zonas</option>
                    {zonasDisponibles.map((z) => (
                      <option key={z.id} value={z.id}>{z.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {clientesDisponiblesFiltro.length > 1 && (
                <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-1.5 py-1">
                  <Building2 className="w-3 h-3 text-white/20 ml-1" />
                  <select
                    value={filtroCliente}
                    onChange={(e) => setFiltroCliente(e.target.value)}
                    className="bg-transparent text-xs text-white/60 outline-none pr-1"
                  >
                    <option value="">Todos los clientes</option>
                    {clientesDisponiblesFiltro.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {(filtroZona || filtroCliente) && (
                <button
                  onClick={() => { setFiltroZona(""); setFiltroCliente(""); }}
                  className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors px-2 py-1.5 border border-amber-500/20 rounded-xl"
                >
                  <X className="w-3 h-3" /> Limpiar filtros
                </button>
              )}
              {(filtroZona || filtroCliente) && (
                <span className="text-[10px] text-white/20">
                  Mostrando {tableroFiltrado.flatMap((c) => c.puestos).length} puestos
                </span>
              )}

            </div>
          )}

          {/* ── Buscador de colaborador + Colapsar/Expandir todo ─────── */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className={`relative flex items-center transition-all ${busquedaPersona ? "w-72" : "w-52"}`}>
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={busquedaPersona}
                onChange={(e) => setBusquedaPersona(e.target.value)}
                placeholder="Buscar colaborador en el pizarrón…"
                className={`w-full bg-[#0c1929] border rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-all ${
                  busquedaPersona ? "border-primary/40 bg-primary/5" : "border-white/8 focus:border-white/20"
                }`}
              />
              {busquedaPersona && (
                <button
                  onClick={() => setBusquedaPersona("")}
                  className="absolute right-2.5 text-white/30 hover:text-white transition-colors"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {busquedaPersona.trim() && (
              <span className={`text-[11px] font-medium whitespace-nowrap ${tableroFiltrado.length === 0 ? "text-red-400/70" : "text-primary/80"}`}>
                {tableroFiltrado.length === 0
                  ? "Sin resultados"
                  : `${tableroFiltrado.flatMap((c) => c.puestos).length} puesto${tableroFiltrado.flatMap((c) => c.puestos).length !== 1 ? "s" : ""} encontrado${tableroFiltrado.flatMap((c) => c.puestos).length !== 1 ? "s" : ""}`}
              </span>
            )}

            {/* Separador */}
            {tableroFiltrado.length > 0 && (
              <div className="w-px h-5 bg-white/10 mx-1 self-center" />
            )}

            {/* Colapsar / Expandir todo */}
            {tableroFiltrado.length > 0 && (
              <button
                onClick={() => setColGlobal(prev => ({ v: prev.v + 1, val: !colGlobal.val }))}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/80 transition-colors px-2.5 py-1.5 border border-white/8 hover:border-white/20 rounded-xl whitespace-nowrap"
                title={colGlobal.val ? "Expandir todas las columnas" : "Colapsar todas las columnas"}
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${colGlobal.val ? "rotate-0" : "rotate-90"}`} />
                {colGlobal.val ? "Expandir todo" : "Colapsar todo"}
              </button>
            )}
          </div>

          {/* ── Alerta: pool sin disponibles + puestos descubiertos ─────── */}
          {(pool?.disponibles?.length ?? 0) === 0 && puestosDescubiertos > 0 && !fechaVistaCerrada && (
            <div className="shrink-0 flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <p className="text-xs font-semibold text-red-300">
                Sin agentes disponibles en el pool
              </p>
              <span className="text-[10px] text-red-400/60">·</span>
              <p className="text-xs text-red-400/70">
                Hay {puestosDescubiertos} puesto{puestosDescubiertos !== 1 ? "s" : ""} descubierto{puestosDescubiertos !== 1 ? "s" : ""} y ningún agente libre para asignar. Considera liberar un agente de su puesto actual o verificar el estado de los suspendidos.
              </p>
            </div>
          )}

          {/* ── Alerta: puestos activos sin zona operativa ───────────── */}
          {puestosSinZonaCount > 0 && esSupervisorOAdmin && (
            <div className="shrink-0 flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-300">
                  {puestosSinZonaCount} puesto{puestosSinZonaCount !== 1 ? "s" : ""} sin zona operativa
                </p>
                <p className="text-[10px] text-amber-400/60 mt-0.5">
                  Los nuevos puestos requieren zona. Asigna zona a los puestos existentes desde{" "}
                  <a href="/admin/operaciones/zonas" className="underline hover:text-amber-300 transition-colors">
                    Zonas Operativas
                  </a>{" "}
                  para activar el sistema de recomendación.
                </p>
              </div>
            </div>
          )}

          {/* ── Cuerpo: pool ↑ · tablero · supervisión ↓ ─────────────────── */}
          <div className="flex flex-col flex-1 gap-3 min-h-0">

          {/* ── TOP: Pool de agentes (ancho completo) ────────────────────── */}
          {esFuturo && poolFuturo ? (
            <PoolFuturoPanel
              data={poolFuturo}
              onPlanSSA={(ip) => setModalPlanSSA(ip)}
              onSelectAgente={(ag) =>
                setAgenteSeleccionado(prev => prev?.id === ag.id ? null : ag)
              }
              agenteSeleccionadoId={agenteSeleccionado?.id ?? null}
            />
          ) : esFuturo && loadingPoolFuturo ? (
            <div className="shrink-0 bg-[#060f1a] border border-indigo-500/15 rounded-2xl flex items-center justify-center px-6 py-4 gap-2 text-xs text-indigo-300/50">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando disponibilidad futura…
            </div>
          ) : (
          <div className="shrink-0 bg-[#060f1a] border border-white/8 rounded-2xl overflow-hidden">
            {/* Header pool */}
            <div className="border-b border-white/8">
              {/* Fila 1: título + búsqueda + ayuda */}
              <div className="flex items-center gap-2 px-4 py-2.5">
                <button
                  onClick={() => togglePanel("piz_col_pool", colPool, setColPool)}
                  className="flex items-center gap-2 group shrink-0"
                  title={colPool ? "Expandir pool" : "Minimizar pool"}
                >
                  <Users className="w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-colors" />
                  <span className="text-xs font-bold text-white/60 uppercase tracking-widest group-hover:text-white/80 transition-colors">Pool de agentes</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-all ${colPool ? "" : "rotate-90"}`} />
                </button>
                {colPool && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[10px] text-green-400 font-bold">{pool?.disponibles?.length ?? 0} libres</span>
                    <span className="text-white/15">·</span>
                    <span className="text-[10px] text-cyan-400 font-bold">{pool?.disponiblesCubriendo?.length ?? 0} disp. cubriendo</span>
                    <span className="text-white/15">·</span>
                    <span className="text-[10px] text-amber-300 font-bold">{(pool?.haciendoHE?.length ?? 0) + (pool?.vacacionistasCubriendo?.length ?? 0)} desc/vac cubriendo</span>
                    <span className="text-white/15">·</span>
                    <span className="text-[10px] text-blue-400 font-bold">{pool?.descansandoCiclo?.length ?? 0} descanso</span>
                  </div>
                )}
                <div className="flex-1" />
                {!colPool && (
                  <div className="relative">
                    <input
                      type="text"
                      value={busquedaPool}
                      onChange={(e) => setBusquedaPool(e.target.value)}
                      placeholder="Buscar agente…"
                      className="bg-[#060e1c] border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-primary/40 w-40"
                    />
                    {busquedaPool && (
                      <button onClick={() => setBusquedaPool("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <span className="text-xs text-white/20 shrink-0">
                  {puestoContexto
                    ? (agenteSeleccionado ? "Selecciona el agente y toca el puesto para asignar" : "Selecciona un candidato recomendado")
                    : (agenteSeleccionado ? "Toca un puesto en el tablero" : "Toca un puesto vacío · o selecciona un agente")}
                </span>
              </div>
              {/* Fila 2: tabs del pool (ancho completo, scrollable) */}
              {!colPool && (
                <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto border-t border-white/5" style={{ scrollbarWidth: "none" }}>
                  {[
                    { key: "disponibles"             as const, label: "Disponibles",          count: pool?.disponibles?.length ?? 0,              color: "text-green-400",   dot: "bg-green-400",   sep: true  },
                    { key: "disponiblesCubriendo"    as const, label: "Disp. cubriendo",      count: pool?.disponiblesCubriendo?.length ?? 0,     color: "text-cyan-400",    dot: "bg-cyan-400",    sep: false },
                    { key: "haciendoHE"              as const, label: "Desc/Vac cubriendo",   count: (pool?.haciendoHE?.length ?? 0) + (pool?.vacacionistasCubriendo?.length ?? 0), color: "text-amber-300", dot: "bg-amber-300", sep: false },
                    { key: "trabajando"              as const, label: "Trabaja hoy",          count: pool?.trabajando?.length ?? 0,               color: "text-orange-400",  dot: "bg-orange-400",  sep: true  },
                    { key: "descansandoCiclo"        as const, label: "Descanso ciclo",       count: pool?.descansandoCiclo?.length ?? 0,         color: "text-blue-400",    dot: "bg-blue-400",    sep: false },
                    { key: "faltando"                as const, label: "Faltando",             count: pool?.faltando?.length ?? 0,                 color: "text-rose-400",    dot: "bg-rose-400",    sep: true  },
                    { key: "enDescanso"              as const, label: "Licencia",             count: pool?.enDescanso?.length ?? 0,               color: "text-indigo-400",  dot: "bg-indigo-400",  sep: false },
                    { key: "enPuesto"                as const, label: "En puesto",            count: pool?.enPuesto?.length ?? 0,                 color: "text-teal-400",    dot: "bg-teal-400",    sep: false },
                    { key: "enSSA"                   as const, label: "En SSA",               count: pool?.enSSA?.length ?? 0,                    color: "text-amber-400",   dot: "bg-amber-400",   sep: false },
                    { key: "suspendidos"             as const, label: "Suspendidos",          count: pool?.suspendidos?.length ?? 0,              color: "text-red-400",     dot: "bg-red-400",     sep: false },
                    { key: "enVacaciones"            as const, label: "Vacaciones",           count: pool?.enVacaciones?.length ?? 0,             color: "text-violet-400",  dot: "bg-violet-400",  sep: false },
                  ].map(({ key, label, count, color, dot, sep }, idx) => {
                    return (
                      <Fragment key={key}>
                        {sep && idx > 0 && <span className="w-px h-4 bg-white/10 shrink-0 mx-0.5" />}
                        <button
                          onClick={() => setPoolTab(key)}
                          className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                            poolTab === key
                              ? "bg-white/8 text-white"
                              : "text-white/35 hover:text-white/65"
                          }`}
                        >
                          {poolTab === key && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
                          {label}
                          <span className={`text-[10px] font-bold ${color}`}>{count}</span>
                        </button>
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {!colPool && (<>
            {/* Banner contextual: candidatos para un puesto específico */}
            {puestoContexto && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/6 border-b border-primary/15">
                <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                <span className="text-xs text-primary/80 font-semibold truncate">Candidatos para: {puestoContexto.nombre}</span>
                {puestoContexto.zona_nombre && (
                  <span className="text-[10px] text-primary/50 shrink-0">· {puestoContexto.zona_nombre}</span>
                )}
                <button onClick={() => setPuestoContexto(null)} className="ml-auto text-white/25 hover:text-white shrink-0 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Agentes en el pool */}
            {loadingPool ? (
              <div className="flex items-center justify-center min-h-[80px]">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : puestoContexto ? (
              candidatosRankeados.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[80px] gap-1 text-white/20 text-xs px-4 text-center">
                  <span>Sin candidatos disponibles o de descanso de ciclo</span>
                  <span className="text-[10px]">Usa las pestañas para explorar el pool completo</span>
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[260px] overflow-y-auto">
                  {(["P1", "P2", "P3", "P4", "P5"] as GrupoRanking[]).map((grupo) => {
                    const grupo_agentes = candidatosRankeados.filter(a => a.grupo === grupo);
                    if (grupo_agentes.length === 0) return null;
                    const cfg = RANKING_GRUPO_CONFIG[grupo];
                    return (
                      <div key={grupo} className="p-3">
                        <div className={`flex items-center gap-2 mb-2 border-l-2 pl-2 ${cfg.borderColor}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.headerColor}`}>{cfg.label}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 ${cfg.headerColor} opacity-70`}>{grupo_agentes.length}</span>
                          {grupo === "P5" && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300/70 font-bold ml-auto">Solo cobertura temporal</span>
                          )}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {grupo_agentes.map((agente) => (
                            <div key={agente.id} className="shrink-0 w-56">
                              <DraggableAgente
                                agente={agente}
                                isSelected={agenteSeleccionado?.id === agente.id}
                                motivos={agente.motivos}
                                onClick={() => { if (fechaVistaCerrada) return; setAgenteSeleccionado(agenteSeleccionado?.id === agente.id ? null : agente); }}
                                disabled={fechaVistaCerrada}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : poolActual.length === 0 ? (
              <div className="flex items-center justify-center min-h-[80px] text-white/20 text-xs px-4 text-center">
                {busquedaPool.trim()
                  ? `No se encontró ningún agente con "${busquedaPool}" en ninguna sección`
                  : poolTab === "disponibles"      ? "No hay agentes genuinamente disponibles hoy" :
                    poolTab === "trabajando"       ? "Ningún agente en turno de trabajo hoy" :
                    poolTab === "descansandoCiclo" ? "Ningún agente en descanso de ciclo hoy" :
                    poolTab === "disponiblesCubriendo" ? "Ningún disponible está cubriendo un puesto hoy" :
                    poolTab === "vacacionistasCubriendo" ? "Ningún vacacionista está cubriendo hoy" :
                    poolTab === "haciendoHE"       ? "Ningún descansero o vacacionista está cubriendo hoy" :
                    poolTab === "faltando"         ? "No hay ausencias registradas hoy" :
                    poolTab === "enDescanso"       ? "No hay agentes en licencia" :
                    poolTab === "enPuesto"         ? "Ningún agente está en puesto activo" :
                    poolTab === "enSSA"            ? "Ningún agente cubre un SSA activo" :
                    poolTab === "enVacaciones"     ? "Ningún agente en vacaciones hoy" :
                    "No hay agentes suspendidos"}
              </div>
            ) : poolTab === "trabajando" && !busquedaPool.trim() ? (() => {
              const vacTrab = poolActual.filter(a => a.vacacion_trabajada);
              const normales = poolActual.filter(a => !a.vacacion_trabajada);
              return (
                <div className="flex flex-col divide-y divide-white/5">
                  {normales.length > 0 && (
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {normales.map((agente) => (
                        <div key={agente.id} className="shrink-0 w-52">
                          <DraggableAgente agente={agente} isSelected={agenteSeleccionado?.id === agente.id} onClick={() => {}} disabled={true} />
                        </div>
                      ))}
                    </div>
                  )}
                  {vacTrab.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2 border-l-2 border-orange-500/40 pl-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/70">Vacaciones Trabajadas</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-300/60">{vacTrab.length}</span>
                        <span className="text-[8px] text-orange-300/40 ml-auto">Días de vacaciones trabajados</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {vacTrab.map((agente) => (
                          <div key={agente.id} className="shrink-0 w-52">
                            <DraggableAgente agente={agente} isSelected={agenteSeleccionado?.id === agente.id} onClick={() => {}} disabled={true} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="flex gap-2 p-3 overflow-x-auto min-h-[80px]">
                {poolActual.map((agente) => {
                  const seccion = agente._seccionLabel;
                  const seccionDeshabilitada = seccion === "En puesto" || seccion === "En SSA" || seccion === "Faltando" || seccion === "Vacaciones" || seccion === "Desc/Vac cubriendo";
                  const seccionColor: Record<string, string> = {
                    "Disponible":          "bg-emerald-500/20 text-emerald-300",
                    "Disp. cubriendo":     "bg-cyan-500/20 text-cyan-300",
                    "Descanso ciclo":      "bg-blue-500/20 text-blue-300",
                    "Desc/Vac cubriendo":  "bg-amber-500/20 text-amber-200",
                    "Trabaja hoy":         "bg-orange-500/20 text-orange-300",
                    "Faltando":            "bg-rose-500/20 text-rose-300",
                    "Licencia":            "bg-indigo-500/20 text-indigo-300",
                    "En puesto":           "bg-teal-500/20 text-teal-300",
                    "En SSA":              "bg-amber-500/20 text-amber-300",
                    "Suspendido":          "bg-red-500/20 text-red-300",
                    "Vacaciones":          "bg-violet-500/20 text-violet-300",
                  };
                  return (
                    <div key={agente.id} className="shrink-0 w-52">
                      {seccion && (
                        <div className="mb-1 flex justify-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${seccionColor[seccion] ?? "bg-white/10 text-white/40"}`}>
                            {seccion}
                          </span>
                        </div>
                      )}
                      <DraggableAgente
                        agente={agente}
                        isSelected={agenteSeleccionado?.id === agente.id}
                        onClick={() => {
                          if (fechaVistaCerrada) return;
                          setAgenteSeleccionado(agenteSeleccionado?.id === agente.id ? null : agente);
                        }}
                        disabled={
                          seccion
                            ? seccionDeshabilitada || fechaVistaCerrada
                            : poolTab === "enPuesto" || poolTab === "enSSA" || poolTab === "faltando" || poolTab === "enVacaciones" || poolTab === "haciendoHE" || poolTab === "disponiblesCubriendo" || poolTab === "vacacionistasCubriendo" || fechaVistaCerrada
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leyenda */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-white/20">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-green-400" /> Cubierto</span>
              <span className="flex items-center gap-1"><Circle className="w-2.5 h-2.5 text-red-400" /> Descubierto</span>
              <span className="flex items-center gap-1"><ArrowLeftRight className="w-2.5 h-2.5" /> Click agente → click puesto</span>
              <span className="flex items-center gap-1"><XCircle className="w-2.5 h-2.5" /> Hover sobre puesto para remover</span>
              <div className="flex-1" />
              <span>Se refresca cada 30 seg automáticamente</span>
            </div>
            </>)}
          </div>
          )}

          {/* ── CENTER: Tablero de puestos ─────────────────────────────── */}
          <div className="flex-1 overflow-auto relative" style={{ minHeight: 0 }}>
            {/* Read-only overlay when viewed date is closed */}
            {fechaVistaCerrada && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute inset-0 bg-[#04090f]/60 backdrop-blur-[1px] rounded-xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-3 bg-[#07111f] border border-amber-500/30 rounded-2xl px-6 py-4 shadow-2xl shadow-amber-500/10">
                    <Lock className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-bold text-amber-300">Día operativo cerrado</p>
                      <p className="text-xs text-amber-400/60 mt-0.5">Modo solo lectura · {formatFechaVista(fechaVista)}</p>
                    </div>
                    {esAdmin && (
                      <button
                        onClick={() => setModalReabrir(true)}
                        className="pointer-events-auto flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-xl px-3 py-1.5 ml-2 transition-colors"
                      >
                        <Unlock className="w-3 h-3" /> Reabrir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {loadingTablero ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-sm text-white/40">Cargando pizarrón…</span>
              </div>
            ) : tablero.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Shield className="w-12 h-12 text-white/10" />
                <p className="text-white/30 text-sm">No hay puestos operativos configurados</p>
                <button
                  onClick={() => setNuevoPuestoData("nuevo")}
                  className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors border border-primary/20 rounded-xl px-4 py-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Crear primer puesto
                </button>
              </div>
            ) : tableroFiltrado.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <MapPin className="w-12 h-12 text-white/10" />
                <p className="text-white/30 text-sm">Ningún puesto coincide con los filtros aplicados</p>
                <button
                  onClick={() => { setFiltroZona(""); setFiltroCliente(""); }}
                  className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="flex gap-3 h-full pb-2">
                {tableroFiltrado.map((cliente) => (
                  <ClienteColumna
                    key={cliente.clienteNombre}
                    cliente={cliente}
                    agenteSeleccionadoId={agenteSeleccionado?.id ?? null}
                    onPuestoClick={handlePuestoClick}
                    onLiberar={(p) => esFuturo
                      ? setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
                      : setModalLiberar(p)}
                    onRegistrarFalta={!esFuturo ? (puesto, titularId, titularNombre) => setModalFalta({ puesto, titularId, titularNombre }) : undefined}
                    onNuevoPuesto={(c) => setNuevoPuestoData(c)}
                    onEliminarPuesto={eliminarPuesto}
                    isDeleteMode={isDeleteMode}
                    onAbrirSegmentos={(p) => { if (!esFuturo) setModalSegmentos(p); }}
                    onConfigTurno={(p) => esFuturo
                      ? setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
                      : setPuestoParaTurno(p)}
                    onQuitarTitular={puedeQuitarTitular ? (puesto, employeeId, employeeNombre) => setModalQuitarTitular({ puesto, employeeId, employeeNombre }) : undefined}
                    cambiosFuturosProximos={!esFuturo ? cambiosFuturosProximos : undefined}
                    planFuturoPorPuesto={esFuturo ? planFuturoPorPuesto : undefined}
                    resaltado={clienteResaltado !== null && cliente.clienteId === clienteResaltado}
                    colGlobal={colGlobal}
                    puestoContextoId={puestoContexto?.id ?? null}
                  />
                ))}
              </div>
            )}
          </div>
          {/* ── BOTTOM: Supervisión (vertical compacta) ─────────────────── */}
          <div className="shrink-0 flex flex-col gap-1.5 pb-1">

          {/* ── Panel de supervisores operativos con turno (solo en vista de hoy) */}
          {!esFuturo && (pool?.supervisores?.length ?? 0) > 0 && (() => {
            const svTrabajando  = pool!.supervisores.filter(sv => sv.estado_ciclo === "trabajando");
            const svDisponHE    = pool!.supervisores.filter(sv => sv.estado_ciclo === "disponible_he");
            const svDescanso    = pool!.supervisores.filter(sv => sv.estado_ciclo === "descansando_ciclo");
            const svOtros       = pool!.supervisores.filter(sv => !["trabajando","disponible_he","descansando_ciclo"].includes(sv.estado_ciclo ?? ""));
            const puedeCubrirCount = pool!.supervisores.filter(sv => sv.puede_cubrir).length;

            const SvCard = ({ sv }: { sv: SupervisorPool }) => {
              const estadoCiclo = sv.estado_ciclo;
              const estadoBadge = estadoCiclo === "trabajando"
                ? { cls: "text-emerald-300/90 bg-emerald-500/15 border-emerald-500/30", label: "EN TURNO" }
                : estadoCiclo === "disponible_he"
                  ? { cls: "text-amber-300/80 bg-amber-500/12 border-amber-500/25", label: "DISP. HE" }
                  : estadoCiclo === "descansando_ciclo"
                    ? { cls: "text-white/25 bg-white/3 border-white/8", label: "DESCANSO" }
                    : estadoCiclo === "licencia"
                      ? { cls: "text-indigo-300/70 bg-indigo-500/10 border-indigo-500/20", label: "LICENCIA" }
                      : estadoCiclo === "suspendido"
                        ? { cls: "text-red-300/70 bg-red-500/10 border-red-500/20", label: "SUSP." }
                        : { cls: "text-white/20 bg-white/3 border-white/6", label: "SIN TURNO" };

              const esSeleccionado = agenteSeleccionado?.id === sv.id;
              const estaEnDescansoPool = pool!.descansandoCiclo.some(a => a.id === sv.id);
              const seleccionable = estaEnDescansoPool && !fechaVistaCerrada;

              const handleClick = seleccionable ? () => {
                const agente = pool!.descansandoCiclo.find(a => a.id === sv.id);
                if (agente) setAgenteSeleccionado(prev => prev?.id === agente.id ? null : agente);
              } : undefined;

              return (
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all select-none ${esSeleccionado ? "border-violet-400/60 bg-violet-500/15 ring-1 ring-violet-400/30" : seleccionable ? "border-violet-500/20 bg-violet-500/5 cursor-pointer hover:border-violet-400/40 hover:bg-violet-500/10" : "border-white/5 bg-transparent"}`}
                  onClick={handleClick}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(sv.nombre_completo)} ${esSeleccionado ? "ring-2 ring-violet-400/50" : sv.puede_cubrir ? "ring-1 ring-violet-400/20" : ""}`}>
                    {iniciales(sv.nombre_completo)}
                  </div>
                  <p className={`text-[11px] font-medium truncate max-w-[88px] ${sv.puede_cubrir || estadoCiclo === "trabajando" ? "text-white/80" : "text-white/35"}`}>{sv.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${estadoBadge.cls}`}>{estadoBadge.label}</span>
                  {esSeleccionado && <span className="text-[8px] text-violet-300 animate-pulse shrink-0">✓</span>}
                  {(sv as any).vehiculos_zona?.length > 0 && ((sv as any).vehiculos_zona as Array<{ id: number; placa: string; estado: string }>).filter(v => v.estado === "activo").slice(0,1).map(veh => (
                    <button key={veh.id} onClick={e => { e.stopPropagation(); setFichaVehiculoId(veh.id); }} className="text-[8px] text-sky-300/60 border border-sky-500/20 bg-sky-500/8 px-1 py-0.5 rounded shrink-0">🚗</button>
                  ))}
                  <button
                    onClick={e => { e.stopPropagation(); setEditarPlantilla({ empleadoId: sv.id, empleadoNombre: sv.nombre_completo, tipo: "supervisor" }); }}
                    title="Editar plantilla de turno"
                    className="text-violet-300/60 hover:text-violet-200 hover:bg-violet-500/15 border border-violet-500/20 rounded p-0.5 shrink-0">
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            };

            return (
              <div className="bg-[#060f1a] border border-violet-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_supers", colSupers, setColSupers)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-violet-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-violet-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-violet-300/65 uppercase tracking-widest">Supervisores</span>
                  <span className="text-[9px] text-violet-400/45 font-bold bg-violet-500/10 border border-violet-500/15 px-1 py-0.5 rounded-full">{pool!.supervisores.length}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 text-[10px]">
                    {svTrabajando.length > 0 && <span className="text-emerald-400/80 font-semibold">🟢 {svTrabajando.length} turno</span>}
                    {(svDescanso.length + svDisponHE.length) > 0 && <span className="text-blue-400/60">🔵 {svDescanso.length + svDisponHE.length} descanso</span>}
                    {puedeCubrirCount > 0 && <span className="text-violet-300/90 font-bold bg-violet-500/12 border border-violet-500/20 px-1.5 py-0.5 rounded-full">⚡ {puedeCubrirCount} apto</span>}
                  </div>
                  <ChevronRight className={`w-3 h-3 text-violet-400/25 group-hover:text-violet-400/50 ml-2 shrink-0 transition-transform ${colSupers ? "" : "rotate-90"}`} />
                </button>
                {!colSupers && (
                <div className="border-t border-violet-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...svTrabajando, ...svDisponHE, ...svDescanso, ...svOtros].map(sv => (
                    <SvCard key={sv.id} sv={sv} />
                  ))}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Jefe de Servicio del Día — panel operativo 24×24 ─────────── */}
          {!esFuturo && (pool?.jefes_servicio?.length ?? 0) > 0 && (() => {
            const jefesHoy     = pool!.jefes_servicio.filter(js => js.trabaja_hoy === true);
            const jefesMañana  = pool!.jefes_servicio.filter(js => js.trabaja_mañana === true && js.trabaja_hoy !== true);
            const jefesDescanso = pool!.jefes_servicio.filter(js => js.trabaja_hoy === false && js.estado_ciclo === "descansando_ciclo");
            const jefesOtros   = pool!.jefes_servicio.filter(js => js.trabaja_hoy === null || js.estado_ciclo === "sin_turno");

            const JefeCard = ({ js, variante }: { js: JefeServicioPool; variante: "hoy" | "mañana" | "descanso" | "otro" }) => {
              const esSeleccionado = agenteSeleccionado?.id === js.id;
              const seleccionable = variante === "descanso" && !fechaVistaCerrada;
              const badgeCls = variante === "hoy"
                ? "text-orange-200/90 bg-orange-500/20 border-orange-400/35"
                : variante === "mañana"
                  ? "text-amber-300/70 bg-amber-500/10 border-amber-500/20"
                  : "text-white/25 bg-white/3 border-white/8";
              const badgeLabel = variante === "hoy" ? "EN TURNO" : variante === "mañana" ? "MAÑANA" : variante === "descanso" ? "DESCANSO" : "SIN TURNO";

              const handleClick = seleccionable ? () => {
                const agente = pool!.descansandoCiclo.find(a => a.id === js.id);
                if (agente) setAgenteSeleccionado(prev => prev?.id === agente.id ? null : agente);
              } : undefined;

              return (
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all select-none ${esSeleccionado ? "border-orange-400/60 bg-orange-500/15 ring-1 ring-orange-400/30" : seleccionable ? "border-orange-500/20 bg-orange-500/5 cursor-pointer hover:border-orange-400/40" : variante === "hoy" ? "border-orange-500/25 bg-orange-500/6" : "border-white/5 bg-transparent"}`}
                  onClick={handleClick}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(js.nombre_completo)} ${variante === "hoy" ? "ring-1 ring-orange-400/35" : ""} ${esSeleccionado ? "ring-2 ring-orange-400/50" : ""}`}>
                    {iniciales(js.nombre_completo)}
                  </div>
                  <p className={`text-[11px] font-medium truncate max-w-[88px] ${variante === "hoy" ? "text-white/90" : "text-white/40"}`}>{js.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}>{badgeLabel}</span>
                  {esSeleccionado && <span className="text-[8px] text-orange-300 animate-pulse shrink-0">✓</span>}
                  <button
                    onClick={e => { e.stopPropagation(); setEditarPlantilla({ empleadoId: js.id, empleadoNombre: js.nombre_completo, tipo: "jefe_servicio" }); }}
                    title="Editar plantilla de turno"
                    className="text-orange-300/60 hover:text-orange-200 hover:bg-orange-500/15 border border-orange-500/20 rounded p-0.5 shrink-0">
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            };

            return (
              <div className="bg-[#060f1a] border border-orange-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_jefes", colJefes, setColJefes)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-orange-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-orange-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-orange-300/65 uppercase tracking-widest">Jefes de Servicio</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 text-[10px]">
                    {jefesHoy.length > 0 && (
                      <span className="text-emerald-400/80 font-semibold">🟢 {jefesHoy.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>
                    )}
                    {jefesDescanso.length > 0 && (
                      <span className="text-blue-400/60">🔵 {jefesDescanso.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>
                    )}
                    {jefesHoy.length === 0 && jefesDescanso.length === 0 && (
                      <span className="text-white/20">Sin turno activo</span>
                    )}
                  </div>
                  <ChevronRight className={`w-3 h-3 text-orange-400/25 group-hover:text-orange-400/50 ml-2 shrink-0 transition-transform ${colJefes ? "" : "rotate-90"}`} />
                </button>
                {!colJefes && (
                <div className="border-t border-orange-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...jefesHoy.map(js => ({ js, variante: "hoy" as const })), ...jefesMañana.map(js => ({ js, variante: "mañana" as const })), ...jefesDescanso.map(js => ({ js, variante: "descanso" as const })), ...jefesOtros.map(js => ({ js, variante: "otro" as const }))].map(({ js, variante }) => (
                    <JefeCard key={js.id} js={js} variante={variante} />
                  ))}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── PERS-SLOT-01: Personal Administrativo (solo en vista de hoy) ─── */}
          {!esFuturo && (pool?.administrativos?.length ?? 0) > 0 && (() => {
            const adTrabajando = pool!.administrativos!.filter(ad => ad.estado_ciclo === "trabajando");
            const adDescanso   = pool!.administrativos!.filter(ad => ad.estado_ciclo === "descansando_ciclo");
            const adOtros      = pool!.administrativos!.filter(ad => !["trabajando","descansando_ciclo"].includes(ad.estado_ciclo ?? ""));

            const AdCard = ({ ad }: { ad: AdministrativoPool }) => {
              const ec = ad.estado_ciclo;
              const badge = ec === "trabajando"
                ? { cls: "text-emerald-300/90 bg-emerald-500/15 border-emerald-500/30", label: "EN TURNO" }
                : ec === "descansando_ciclo"
                  ? { cls: "text-white/25 bg-white/3 border-white/8", label: "DESCANSO" }
                  : ec === "licencia"
                    ? { cls: "text-indigo-300/70 bg-indigo-500/10 border-indigo-500/20", label: "LICENCIA" }
                    : ec === "suspendido"
                      ? { cls: "text-red-300/70 bg-red-500/10 border-red-500/20", label: "SUSP." }
                      : { cls: "text-white/20 bg-white/3 border-white/6", label: "SIN PLANTILLA" };
              return (
                <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/5 bg-transparent">
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(ad.nombre_completo)} ${ec === "trabajando" ? "" : "opacity-60"}`}>
                    {iniciales(ad.nombre_completo)}
                  </div>
                  <p className={`text-[11px] font-medium truncate max-w-[100px] ${ec === "trabajando" ? "text-white/85" : "text-white/40"}`}>{ad.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                  {(() => {
                    const sa = SUBAREA_LABELS[ad.tipo_personal ?? "administrativo"] ?? SUBAREA_LABELS.administrativo;
                    return <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${sa.cls}`}>{sa.label}</span>;
                  })()}
                  {ad.area && <span className="text-[9px] text-cyan-300/50 truncate max-w-[60px]">· {ad.area}</span>}
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.cls}`}>{badge.label}</span>
                  {ec === "trabajando" && ad.ps_hora_entrada && (
                    <span className="text-[8px] text-white/30 shrink-0">{String(ad.ps_hora_entrada).slice(0,5)}</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setEditarPlantilla({ empleadoId: ad.id, empleadoNombre: ad.nombre_completo, tipo: "administrativo" }); }}
                    title="Editar plantilla de turno"
                    className="text-cyan-300/60 hover:text-cyan-200 hover:bg-cyan-500/15 border border-cyan-500/20 rounded p-0.5 shrink-0">
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            };

            return (
              <div className="bg-[#060f1a] border border-cyan-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_admin", colAdmin, setColAdmin)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-cyan-500/5 transition-colors"
                >
                  <Briefcase className="w-3 h-3 text-cyan-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-cyan-300/65 uppercase tracking-widest">Personal Administrativo</span>
                  <span className="text-[9px] text-cyan-400/45 font-bold bg-cyan-500/10 border border-cyan-500/15 px-1 py-0.5 rounded-full">{pool!.administrativos!.length}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 text-[10px]">
                    {adTrabajando.length > 0 && <span className="text-emerald-400/80 font-semibold">🟢 {adTrabajando.length} hoy</span>}
                    {adDescanso.length > 0 && <span className="text-blue-400/60">🔵 {adDescanso.length} descanso</span>}
                    {adOtros.length > 0 && <span className="text-white/30">⚪ {adOtros.length} sin plantilla</span>}
                  </div>
                  <ChevronRight className={`w-3 h-3 text-cyan-400/25 group-hover:text-cyan-400/50 ml-2 shrink-0 transition-transform ${colAdmin ? "" : "rotate-90"}`} />
                </button>
                {!colAdmin && (
                <div className="border-t border-cyan-500/8 p-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {[...adTrabajando, ...adDescanso, ...adOtros].map(ad => (
                    <AdCard key={ad.id} ad={ad} />
                  ))}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Supervisores — vista futura ─────────────────────────── */}
          {esFuturo && poolFuturo && (() => {
            const svTurno    = poolFuturo.trabajando.filter(a => a.tipo_personal === "supervisor");
            const svDescanso = poolFuturo.descansando.filter(a => a.tipo_personal === "supervisor");
            if (svTurno.length + svDescanso.length === 0) return null;
            return (
              <div className="bg-[#060f1a] border border-violet-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_supers", colSupers, setColSupers)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-violet-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-violet-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-violet-300/65 uppercase tracking-widest">Supervisores</span>
                  <span className="text-[9px] text-violet-400/45 font-bold bg-violet-500/10 border border-violet-500/15 px-1 py-0.5 rounded-full">{svTurno.length + svDescanso.length}</span>
                  <div className="flex-1" />
                  {svTurno.length > 0 && <span className="text-emerald-400/80 text-[10px] font-semibold">🟢 {svTurno.length} turno</span>}
                  {svDescanso.length > 0 && <span className="text-blue-400/60 text-[10px]">🔵 {svDescanso.length} descanso</span>}
                  <ChevronRight className={`w-3 h-3 text-violet-400/25 group-hover:text-violet-400/50 ml-2 shrink-0 transition-transform ${colSupers ? "" : "rotate-90"}`} />
                </button>
                {!colSupers && (
                <div className="border-t border-violet-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...svTurno, ...svDescanso].map(ag => {
                    const enTurno = svTurno.some(s => s.id === ag.id);
                    return (
                      <div key={ag.id} className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${enTurno ? "border-violet-500/25 bg-violet-500/6" : "border-white/5"}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${enTurno ? "" : "opacity-50"} ${avatarColor(ag.nombre_completo)}`}>
                          {iniciales(ag.nombre_completo)}
                        </div>
                        <p className={`text-[11px] font-medium truncate max-w-[88px] ${enTurno ? "text-white/85" : "text-white/40"}`}>{ag.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${enTurno ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" : "text-white/25 bg-white/3 border-white/8"}`}>{enTurno ? "EN TURNO" : "DESCANSO"}</span>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Jefes de Servicio — vista futura ────────────────────── */}
          {esFuturo && poolFuturo && (() => {
            const jfTurno    = poolFuturo.trabajando.filter(a => a.tipo_personal === "jefe_servicio");
            const jfDescanso = poolFuturo.descansando.filter(a => a.tipo_personal === "jefe_servicio");
            if (jfTurno.length + jfDescanso.length === 0) return null;
            return (
              <div className="bg-[#060f1a] border border-orange-500/15 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel("piz_col_jefes", colJefes, setColJefes)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-orange-500/5 transition-colors"
                >
                  <Shield className="w-3 h-3 text-orange-400/60 shrink-0" />
                  <span className="text-[11px] font-bold text-orange-300/65 uppercase tracking-widest">Jefes de Servicio</span>
                  <span className="text-[9px] text-orange-400/45 font-bold bg-orange-500/10 border border-orange-500/15 px-1 py-0.5 rounded-full">{jfTurno.length + jfDescanso.length}</span>
                  <div className="flex-1" />
                  {jfTurno.length > 0 && <span className="text-emerald-400/80 text-[10px] font-semibold">🟢 {jfTurno.map(j => j.nombre_completo.split(" ")[0]).join(" · ")}</span>}
                  {jfDescanso.length > 0 && <span className="text-blue-400/60 text-[10px]">🔵 {jfDescanso.length} descanso</span>}
                  <ChevronRight className={`w-3 h-3 text-orange-400/25 group-hover:text-orange-400/50 ml-2 shrink-0 transition-transform ${colJefes ? "" : "rotate-90"}`} />
                </button>
                {!colJefes && (
                <div className="border-t border-orange-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                  {[...jfTurno, ...jfDescanso].map(ag => {
                    const enTurno = jfTurno.some(j => j.id === ag.id);
                    return (
                      <div key={ag.id} className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${enTurno ? "border-orange-500/25 bg-orange-500/6" : "border-white/5"}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${enTurno ? "ring-1 ring-orange-400/30" : "opacity-50"} ${avatarColor(ag.nombre_completo)}`}>
                          {iniciales(ag.nombre_completo)}
                        </div>
                        <p className={`text-[11px] font-medium truncate max-w-[88px] ${enTurno ? "text-white/90" : "text-white/40"}`}>{ag.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${enTurno ? "text-orange-200 bg-orange-500/20 border-orange-400/35" : "text-white/25 bg-white/3 border-white/8"}`}>{enTurno ? "EN TURNO" : "DESCANSO"}</span>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}

          {/* ── Panel SSA: Servicios Especiales — todas las etapas activas ─ */}
          {tarjetasSSA.length > 0 && (
            <div className="bg-[#06101c] border border-white/8 rounded-xl overflow-hidden">
              {/* Cabecera del panel */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6">
                <button
                  onClick={() => togglePanel("piz_col_ssa", colSSA, setColSSA)}
                  className="flex items-center gap-2 flex-1 text-left group"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-white/70">Servicios Especiales Activos</span>
                  <span className="text-[10px] text-white/25 bg-white/6 px-2 py-0.5 rounded-full">{tarjetasSSA.length}</span>
                  {colSSA && <span className="text-[10px] text-white/20 ml-1">— minimizado</span>}
                  <ChevronRight className={`w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-all ml-auto shrink-0 ${colSSA ? "" : "rotate-90"}`} />
                </button>
                <a
                  href="/admin/tablero-servicios"
                  className="text-[10px] text-primary/60 hover:text-primary transition-colors flex items-center gap-1 shrink-0"
                >
                  Ver completo <ChevronRight className="w-3 h-3" />
                </a>
              </div>
              {!colSSA && (
              <>
              {/* Tabs de etapas */}
              <div className="flex border-b border-white/6">
                <button
                  onClick={() => setSsaTabActivo("sin_asignar")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                    ssaTabActivo === "sin_asignar"
                      ? "border-amber-400 text-amber-300 bg-amber-500/5"
                      : "border-transparent text-white/30 hover:text-white/60"
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  Sin asignar
                  {ssaSinAgente.length > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      ssaTabActivo === "sin_asignar" ? "bg-amber-400/20 text-amber-300" : "bg-white/8 text-white/30"
                    }`}>{ssaSinAgente.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setSsaTabActivo("cubierta")}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                    ssaTabActivo === "cubierta"
                      ? "border-green-400 text-green-300 bg-green-500/5"
                      : "border-transparent text-white/30 hover:text-white/60"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Cubierta / Pre-Planilla
                  {ssaCubierta.length > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      ssaTabActivo === "cubierta" ? "bg-green-400/20 text-green-300" : "bg-white/8 text-white/30"
                    }`}>{ssaCubierta.length}</span>
                  )}
                </button>
              </div>
              {/* Contenido del tab activo */}
              <div className="flex flex-col gap-2 px-3 py-3 max-h-64 overflow-y-auto">
                {ssaTabActivo === "sin_asignar" && (
                  ssaSinAgente.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-white/25 py-1">
                      <CheckCircle2 className="w-4 h-4 text-green-400/50" />
                      Todos los servicios tienen guardia asignado
                    </div>
                  ) : (
                    ssaSinAgente.map((t) => <TarjetaSSACard key={t.id} t={t} onAsignar={() => setModalAsignarSSA(t)} />)
                  )
                )}
                {ssaTabActivo === "cubierta" && (
                  ssaCubierta.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-white/25 py-1">
                      <Info className="w-4 h-4 text-white/20" />
                      No hay servicios cubiertos activos
                    </div>
                  ) : (
                    ssaCubierta.map((t) => (
                      <TarjetaSSACard
                        key={t.id}
                        t={t}
                        onAsignar={() => setModalAsignarSSA(t)}
                        onRemover={fechaVistaCerrada ? undefined : (motivo, notas) => removerAgenteSSA(t, motivo, notas)}
                      />
                    ))
                  )
                )}
              </div>
              </> )}
            </div>
          )}

          {/* ── Próximos Arranques de Proyecto ────────────────────────────── */}
          {(proximosArranques?.total ?? 0) > 0 && !esFuturo && (
            <div className="bg-amber-500/4 border border-amber-500/20 rounded-xl overflow-hidden">
              <button
                onClick={() => togglePanel("piz_col_arr", colArranques, setColArranques)}
                className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/15 text-left group hover:bg-amber-500/4 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-300/80 uppercase tracking-widest">Próximos arranques</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 border border-amber-500/25 text-amber-300">
                  {proximosArranques!.total} en 60 días
                </span>
                {colArranques && <span className="text-[10px] text-amber-400/30 ml-1">— minimizado</span>}
                <ChevronRight className={`w-3.5 h-3.5 text-amber-400/30 group-hover:text-amber-400/60 ml-auto shrink-0 transition-transform ${colArranques ? "" : "rotate-90"}`} />
              </button>
              {!colArranques && (
              <div>
              <div className="p-3 flex flex-col gap-1.5">
                {proximosArranques!.arranques.map((ip) => {
                  const diasRestantes = ip.dias_para_inicio ?? 99;
                  const fechaInicio   = ip.fecha_inicio_contrato?.slice(0, 10) ?? "";
                  const esSSA         = ip.tipo === "ssa";
                  const itemKey       = esSSA ? `ssa_${ip.ssa_id}` : `cli_${ip.cliente_id}`;
                  const colorChip     = diasRestantes <= 7
                    ? "bg-red-500/15 text-red-300 border border-red-500/20"
                    : diasRestantes <= 14
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                    : "bg-white/5 text-white/40 border border-white/10";
                  const iconBg        = esSSA
                    ? "bg-blue-500/15 border-blue-500/25 group-hover:border-blue-400/50 group-hover:bg-blue-500/25"
                    : "bg-amber-500/15 border-amber-500/25 group-hover:border-amber-400/50 group-hover:bg-amber-500/25";
                  const hoverBg       = esSSA ? "hover:bg-blue-500/10" : "hover:bg-amber-500/10";
                  const nombreColor   = esSSA ? "text-blue-200 group-hover:text-blue-100" : "text-amber-200 group-hover:text-amber-100";
                  const puestosLabel  = esSSA ? "guardias" : "puestos";
                  return (
                    <button
                      key={itemKey}
                      onClick={() => irAFecha(fechaInicio, esSSA ? undefined : ip.cliente_id)}
                      title={esSSA ? `SSA — ${TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? ip.tipo_solicitud} — ${fechaInicio}` : `Arranque nuevo — ${fechaInicio}`}
                      className={`group flex items-center gap-2 text-[11px] w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 ${hoverBg} transition-colors cursor-pointer`}
                    >
                      <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${iconBg}`}>
                        {esSSA
                          ? <Shield className="w-3 h-3 text-blue-400" />
                          : <Building2 className="w-3 h-3 text-amber-400" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`font-medium truncate block transition-colors ${nombreColor}`}>
                          {ip.cliente_nombre_comercial || ip.cliente_nombre}
                        </span>
                        <span className="text-white/25 text-[9px] group-hover:text-white/40 transition-colors">
                          {esSSA
                            ? (TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? ip.tipo_solicitud ?? "SSA")
                            : (fechaInicio ? fechaInicio.split("-").reverse().join("/") : "")
                          }
                          {esSSA && ip.hora_inicio ? ` · ${ip.hora_inicio}–${ip.hora_fin ?? ""}` : ""}
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="text-white/30 text-[10px]">{ip.total_puestos} {puestosLabel}</span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded text-[9px] ${colorChip}`}>
                          {diasRestantes === 0 ? "Hoy" : `${diasRestantes}d`}
                        </span>
                        <ExternalLink className={`w-3 h-3 ${esSSA ? "text-blue-400/0 group-hover:text-blue-400/60" : "text-amber-400/0 group-hover:text-amber-400/60"} transition-colors`} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 pb-3 text-[9px] text-white/20 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 text-amber-400/50" />
                <span>Arranque nuevo</span>
                <span className="mx-1">·</span>
                <Shield className="w-2.5 h-2.5 text-blue-400/50" />
                <span>Servicio adicional (SSA)</span>
              </div>
              </div>
              )}
            </div>
          )}

          </div>{/* ── fin supervisión abajo ── */}
          </div>{/* ── fin cuerpo vertical ── */}

        </div>

        {/* DragOverlay — miniatura flotante del agente arrastrado */}
        <DragOverlay>
          {draggingAgente && (
            <div className="bg-[#07111f] border border-primary/40 rounded-xl px-3 py-2 shadow-2xl shadow-primary/20 flex items-center gap-2 opacity-95 rotate-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(draggingAgente.nombre_completo)}`}>
                {iniciales(draggingAgente.nombre_completo)}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{draggingAgente.nombre_completo}</p>
                <p className="text-[10px] text-white/40">{draggingAgente.puesto ?? "Agente"}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      {historialAbierto && (
        <PanelHistorial
          movimientos={historial}
          isLoading={loadingHistorial}
          onClose={() => setHistorialAbierto(false)}
        />
      )}

      {modalSustituyeTitular && (
        <ModalSustituyeTitular
          puesto={modalSustituyeTitular.puesto}
          agente={modalSustituyeTitular.agente}
          onConfirm={confirmarSustituyeTitular}
          onCancel={() => setModalSustituyeTitular(null)}
        />
      )}

      {modalEligeCobertura && (
        <ModalEligeCobertura
          puesto={modalEligeCobertura.puesto}
          agente={modalEligeCobertura.agente}
          onElegir={confirmarEligeCobertura}
          onCancel={() => setModalEligeCobertura(null)}
        />
      )}

      {modalSustitucion && (
        <ModalSustitucion
          puesto={modalSustitucion.puesto}
          agenteEntrante={modalSustitucion.agente}
          advertencia={modalSustitucion.advertencia}
          agentePoolStatus={modalSustitucion.agentePoolStatus}
          onConfirm={confirmarSustitucion}
          onCancel={() => setModalSustitucion(null)}
        />
      )}

      {modalCustodiaTipo && (
        <ModalCustodiaTipo
          agenteNombre={modalCustodiaTipo.agente.nombre_completo}
          slotNumero={modalCustodiaTipo.slotNumero}
          onElegir={async (soloCobertura) => {
            const data = modalCustodiaTipo;
            setModalCustodiaTipo(null);
            await ejecutarAsignarCustodia(data.clienteId, data.slotNumero, data.agente, soloCobertura, data.puesto);
          }}
          onCancel={() => setModalCustodiaTipo(null)}
        />
      )}

      {modalLiberar && (
        <ModalLiberar
          puesto={modalLiberar}
          onConfirm={confirmarLiberar}
          onClose={() => setModalLiberar(null)}
        />
      )}

      {modalFalta && (
        <ModalRegistrarFalta
          puesto={modalFalta.puesto}
          titularId={modalFalta.titularId}
          titularNombre={modalFalta.titularNombre}
          onConfirm={confirmarFalta}
          onClose={() => setModalFalta(null)}
        />
      )}

      {modalQuitarTitular && (
        <ModalQuitarTitularidad
          puesto={modalQuitarTitular.puesto}
          employeeNombre={modalQuitarTitular.employeeNombre}
          onConfirm={confirmarQuitarTitular}
          onClose={() => setModalQuitarTitular(null)}
        />
      )}

      {nuevoPuestoData && (
        <ModalNuevoPuesto
          clientePreseleccionado={typeof nuevoPuestoData === "object" ? nuevoPuestoData : undefined}
          clientes={clientesDisponibles}
          onSave={crearPuesto}
          onClose={() => setNuevoPuestoData(null)}
        />
      )}

      {modalCierre && cierreHoy && (
        <ModalCierre
          resumen={esPasado
            ? { totalPuestos: 0, cubiertos: 0, descubiertos: 0, cubiertosPorTitular: 0, cubiertosPorRelevo: 0, ausencias: 0, horasExtra: 0 }
            : cierreHoy.resumen}
          advertencias={esPasado
            ? [`Cierre retroactivo del día ${formatFechaVista(fechaVista)}`]
            : cierreHoy.advertencias}
          fechaActivaStr={formatFechaVista(fechaVista)}
          fechaIso={fechaVista}
          onConfirm={cerrarDia}
          onClose={() => setModalCierre(false)}
        />
      )}

      {/* Modal de cierre para día pendiente (pasado sin cerrar) — flujo antiguo */}
      {modalCierrePendiente && primerDiaPendiente && (
        <ModalCierre
          resumen={{ totalPuestos: 0, cubiertos: 0, descubiertos: 0, cubiertosPorTitular: 0, cubiertosPorRelevo: 0, ausencias: 0, horasExtra: 0 }}
          advertencias={[`Cierre retroactivo del día ${primerDiaPendiente.fechaStr}`]}
          fechaActivaStr={primerDiaPendiente.fechaStr}
          fechaIso={primerDiaPendiente.fecha}
          onConfirm={cerrarDiaPendiente}
          onClose={() => setModalCierrePendiente(false)}
        />
      )}

      {/* Modal de cierre para cualquier día pendiente seleccionado */}
      {diaPendienteSeleccionado && (
        <ModalCierre
          resumen={{ totalPuestos: 0, cubiertos: 0, descubiertos: 0, cubiertosPorTitular: 0, cubiertosPorRelevo: 0, ausencias: 0, horasExtra: 0 }}
          advertencias={[`Cierre retroactivo del día ${diaPendienteSeleccionado.fechaStr}`]}
          fechaActivaStr={diaPendienteSeleccionado.fechaStr}
          fechaIso={diaPendienteSeleccionado.fecha}
          onConfirm={(comentario, syncCustodias) => cerrarDiaPorFecha(diaPendienteSeleccionado, comentario, syncCustodias)}
          onClose={() => setDiaPendienteSeleccionado(null)}
        />
      )}

      {modalReabrir && (
        <ModalReabrir
          cierre={diaHoyCerrado ? (cierreHoy?.cierreDeHoy ?? null) : (cierreHoy?.cierre ?? null)}
          fechaParaReabrir={fechaCierreParaReabrir}
          onConfirm={reabrirDia}
          onClose={() => setModalReabrir(false)}
        />
      )}

      {fichaVehiculoId && (
        <ModalFichaVehiculo
          vehiculoId={fichaVehiculoId}
          onClose={() => setFichaVehiculoId(null)}
        />
      )}

      {editarPlantilla && (
        <EditarPlantillaPersonalModal
          empleadoId={editarPlantilla.empleadoId}
          empleadoNombre={editarPlantilla.empleadoNombre}
          tipo={editarPlantilla.tipo}
          onClose={() => setEditarPlantilla(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["operaciones-pool"] });
          }}
        />
      )}

      {modalSegmentos && (
        <ModalSegmentos
          puesto={modalSegmentos}
          fecha={esOtraFecha ? fechaVista : (cierreHoy?.fechaActiva ?? hoyISO)}
          onClose={() => setModalSegmentos(null)}
        />
      )}

      {modalAsignarSSA && (
        <ModalAsignarSSA
          tarjeta={modalAsignarSSA}
          disponibles={pool?.disponibles ?? []}
          onClose={() => setModalAsignarSSA(null)}
          onSuccess={() => {
            setModalAsignarSSA(null);
            qc.invalidateQueries({ queryKey: ["ssa-tablero-pizarron"] });
          }}
        />
      )}

      {modalPlanFuturo && (
        <ModalPlanFuturo
          puesto={modalPlanFuturo.puesto}
          fecha={fechaVista}
          planExistente={modalPlanFuturo.plan}
          onGuardar={guardarPlanFuturo}
          onEliminar={modalPlanFuturo.plan ? () => eliminarPlanFuturo(modalPlanFuturo.plan!.id) : undefined}
          onClose={() => setModalPlanFuturo(null)}
        />
      )}

      {modalPlanSSA && (
        <ModalPlanSSA
          ssa={modalPlanSSA}
          fecha={fechaVista}
          planAgentes={modalPlanSSA.plan_agentes ?? []}
          onGuardar={guardarPlanSSA}
          onEliminar={eliminarPlanSSA}
          onClose={() => setModalPlanSSA(null)}
        />
      )}

      {puestoParaTurno && (
        <ModalConfigTurno
          puesto={puestoParaTurno}
          onClose={() => setPuestoParaTurno(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["operaciones-tablero"] });
            qc.invalidateQueries({ queryKey: ["operaciones-pool"] });
          }}
        />
      )}

      {modalIncentivo && (
        <ModalIncentivoCash
          data={modalIncentivo}
          autorizadoPor={currentUser?.nombre ?? currentUser?.username ?? ""}
          apiBase={API_BASE}
          onClose={() => setModalIncentivo(null)}
        />
      )}
    </AdminLayout>
  );
}

// ─── Modal: Incentivo Cash por Cobertura ─────────────────────────────────────

