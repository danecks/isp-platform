import { useState, useEffect, useRef } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, TouchSensor, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import { ModalFichaVehiculo } from "@/admin/components/ModalFichaVehiculo";
import RegresosVacacionesBanner from "@/admin/components/RegresosVacacionesBanner";
import { getSessionToken } from "@/lib/httpClient";
import { AdminLayout } from "../layout/AdminLayout";
import { EditarPlantillaPersonalModal } from "./operaciones/EditarPlantillaPersonalModal";
import { fechaHoyStr, API_BASE, getSession, apiPost, toISODate } from "./operaciones/utils";
import {
  Puesto,
  ClienteBoard,
  Agente,
  Pool,
  PlanFuturo,
  InicioProyecto,
  TarjetaSSAPendiente,
  DiaPendienteCierre,
  CierreHoyData,
  OldTitularAccion,
  TIPOS_NOVEDAD,
} from "./operaciones/types";
import { rankCandidatos } from "./operaciones/ranking";
import { PoolFuturoPanel } from "./operaciones/components/PoolFuturoPanel";
import { PanelHistorial } from "./operaciones/components/PanelHistorial";
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
import { initCollapse, persistCollapse, leerFechaURL, leerClienteURL, setURLPizarron, limpiarURLPizarron, formatFechaVista, navFechaISO } from "./operaciones/helpers";
import { useOperacionesData } from "./operaciones/hooks/use-operaciones-data";
import { AlertaDiasSinCerrar } from "./operaciones/sections/AlertaDiasSinCerrar";
import { BarraAcciones } from "./operaciones/sections/BarraAcciones";
import { BarraNavegacionFecha } from "./operaciones/sections/BarraNavegacionFecha";
import { FiltrosZonaCliente } from "./operaciones/sections/FiltrosZonaCliente";
import { BuscadorColaborador } from "./operaciones/sections/BuscadorColaborador";
import { AlertaPoolDescubiertos } from "./operaciones/sections/AlertaPoolDescubiertos";
import { AlertaPuestosSinZona } from "./operaciones/sections/AlertaPuestosSinZona";
import { PanelPool, type PoolTab } from "./operaciones/sections/PanelPool";
import { TableroPuestos } from "./operaciones/sections/TableroPuestos";
import { PanelSupervisoresHoy } from "./operaciones/sections/PanelSupervisoresHoy";
import { PanelJefesServicioHoy } from "./operaciones/sections/PanelJefesServicioHoy";
import { PanelPersonalAdmin } from "./operaciones/sections/PanelPersonalAdmin";
import { PanelSupervisoresFuturo } from "./operaciones/sections/PanelSupervisoresFuturo";
import { PanelJefesFuturo } from "./operaciones/sections/PanelJefesFuturo";
import { PanelSSA } from "./operaciones/sections/PanelSSA";
import { PanelProximosArranques } from "./operaciones/sections/PanelProximosArranques";
import { DragOverlayAgente } from "./operaciones/sections/DragOverlayAgente";

export default function Operaciones() {
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
  const [poolTab, setPoolTab]                        = useState<PoolTab>("disponibles");
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
  function togglePanel(key: string, cur: boolean, setter: (v: boolean) => void) {
    const next = !cur;
    persistCollapse(key, next);
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
  const fechaDesdeURL = leerFechaURL();

  const [fechaVista, setFechaVista]           = useState<string>(fechaDesdeURL ?? hoyISO);
  const esFuturo  = fechaVista > hoyISO;
  const esPasado  = fechaVista < hoyISO;
  const esOtraFecha = fechaVista !== hoyISO;
  const [modalPlanFuturo, setModalPlanFuturo] = useState<{ puesto: Puesto; plan: PlanFuturo | null } | null>(null);
  const [modalPlanSSA, setModalPlanSSA]       = useState<InicioProyecto | null>(null);
  const [puestoParaTurno, setPuestoParaTurno] = useState<Puesto | null>(null);

  // Cliente a resaltar cuando el usuario navega desde el banner de arranques
  const [clienteResaltado, setClienteResaltado] = useState<number | null>(() => leerClienteURL());
  const resaltadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-limpiar el resaltado después de 4 segundos
  useEffect(() => {
    if (clienteResaltado !== null) {
      if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current);
      resaltadoTimerRef.current = setTimeout(() => setClienteResaltado(null), 4000);
    }
    return () => { if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current); };
  }, [clienteResaltado]);

  function irAFecha(fecha: string, clienteId?: number) {
    setFechaVista(fecha);
    if (clienteId) setClienteResaltado(clienteId);
    setURLPizarron(fecha, clienteId);
  }

  function navFecha(delta: number) {
    setFechaVista(navFechaISO(fechaVista, delta));
    limpiarURLPizarron();
  }
  function volverHoy() {
    setFechaVista(hoyISO);
    setClienteResaltado(null);
    limpiarURLPizarron();
  }

  // ── Sensores DnD ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // ── Datos: queries + invalidate helpers ────────────────────────────────────
  const {
    qc,
    tablero,
    loadingTablero,
    refetchTablero,
    pool,
    loadingPool,
    refetchPool,
    historial,
    loadingHistorial,
    clientesDisponibles,
    cierreHoy,
    refetchCierre,
    tarjetasSSA,
    sinZonaData,
    planFuturoDia,
    cambiosFuturosProximos,
    poolFuturo,
    loadingPoolFuturo,
    proximosArranques,
    invalidate,
    invalidateFuture,
  } = useOperacionesData({
    fechaVista,
    esOtraFecha,
    esFuturo,
    puestoContextoId: puestoContexto?.id ?? null,
    historialAbierto,
  });

  const puestosSinZonaCount = sinZonaData?.total ?? 0;

  // Lookup para la vista futura: puestoId → plan del día
  const planFuturoPorPuesto: Record<number, PlanFuturo> = {};
  for (const p of planFuturoDia) {
    if (p.puesto_id !== null) planFuturoPorPuesto[p.puesto_id] = p;
  }

  // Etapas SSA para el panel del Pizarrón (multi-agente)
  const ssaSinAgente = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados < (t.cantidad_guardias ?? 1);
  });
  const ssaCubierta = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados >= (t.cantidad_guardias ?? 1);
  });

  // diaHoyCerrado: el día de hoy en el calendario fue cerrado y operamos ya en el siguiente
  const diaHoyCerrado = !!(cierreHoy?.esFechaFutura && cierreHoy?.cierreDeHoy);
  // Fecha activa formateada para mostrar en UI (usa la del API si está disponible)
  const fechaActivaStr = cierreHoy?.fechaActivaStr ?? fechaHoyStr();
  // Días pasados sin cerrar — bloquean el trabajo del día actual
  const diasPendientesCierre: DiaPendienteCierre[] = cierreHoy?.diasPendientesCierre ?? [];
  const hayDiasPendientes = diasPendientesCierre.length > 0;
  const primerDiaPendiente: DiaPendienteCierre | null = diasPendientesCierre[0] ?? null;

  const diasCerrados: string[] = cierreHoy?.diasCerrados ?? [];
  const hoyCerrado = !!(cierreHoy?.esFechaFutura || cierreHoy?.cierreDeHoy?.estado === "cerrado");
  const bloqueadoPorPendientes = !esPasado && !esFuturo && hayDiasPendientes && !hoyCerrado;
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
    if (puesto.agente_id === agente.id) return;

    if (!puesto.agente_id && puesto.es_par_24x24 && (puesto.par_trabajando || puesto.par_descansando)) {
      setModalSustituyeTitular({ puesto, agente });
      return;
    }

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

    if (!puesto.agente_id && esAgentePool(agente)) {
      setModalEligeCobertura({ puesto, agente });
      return;
    }

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
    if (esFuturo) {
      setModalPlanFuturo({ puesto, plan: planFuturoPorPuesto[puesto.id] ?? null });
      return;
    }

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

  async function cerrarDiaPendiente(comentario: string, sincronizarCustodias: boolean) {
    if (!primerDiaPendiente) return;
    await cerrarDiaPorFecha(primerDiaPendiente, comentario, sincronizarCustodias);
    setModalCierrePendiente(false);
  }

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
      if (fechaVista === dia.fecha) volverHoy();
    } catch (e: any) {
      toast({ title: "Error al cerrar", description: e.error ?? "Error desconocido", variant: "destructive" });
      throw e;
    }
  }

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
    return (pool[poolTab] as Agente[] | undefined) ?? [];
  })();

  const candidatosRankeados = puestoContexto && pool
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
  const tableroFiltrado: ClienteBoard[] = (() => {
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
  const totalPuestosFiltrados = tableroFiltrado.flatMap((c) => c.puestos).length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Pizarrón Operativo">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col h-full gap-4" style={{ minHeight: 0 }}>

          <RegresosVacacionesBanner fecha={fechaVista} dias={5} />

          {hayDiasPendientes && (
            <AlertaDiasSinCerrar
              diasPendientesCierre={diasPendientesCierre}
              fechaVista={fechaVista}
              esPasado={esPasado}
              onIrAFecha={irAFecha}
              onCerrarDia={(dia) => setDiaPendienteSeleccionado(dia)}
            />
          )}

          <BarraAcciones
            totalPuestos={totalPuestos}
            puestosCubiertos={puestosCubiertos}
            puestosDescubiertos={puestosDescubiertos}
            coberturaGlobal={coberturaGlobal}
            pool={pool}
            agenteSeleccionado={agenteSeleccionado}
            onLimpiarSeleccion={() => setAgenteSeleccionado(null)}
            esFuturo={esFuturo}
            fechaVista={fechaVista}
            fechaVistaCerrada={fechaVistaCerrada}
            bloqueadoPorPendientes={bloqueadoPorPendientes}
            primerDiaPendiente={primerDiaPendiente}
            esAdmin={!!esAdmin}
            esSupervisorOAdmin={!!esSupervisorOAdmin}
            historialAbierto={historialAbierto}
            onAbrirReabrir={() => setModalReabrir(true)}
            onAbrirCierre={() => setModalCierre(true)}
            onNuevoPuesto={() => setNuevoPuestoData("nuevo")}
            onToggleHistorial={() => setHistorialAbierto(!historialAbierto)}
            onRefrescar={() => { refetchTablero(); refetchPool(); refetchCierre(); }}
          />

          <BarraNavegacionFecha
            fechaVista={fechaVista}
            esFuturo={esFuturo}
            esPasado={esPasado}
            esOtraFecha={esOtraFecha}
            diasPendientesCierre={diasPendientesCierre}
            onNavFecha={navFecha}
            onCambiarFecha={(f) => { setFechaVista(f); limpiarURLPizarron(); }}
            onVolverHoy={volverHoy}
          />

          {(zonasDisponibles.length > 0 || clientesDisponiblesFiltro.length > 1) && (
            <FiltrosZonaCliente
              zonasDisponibles={zonasDisponibles}
              clientesDisponiblesFiltro={clientesDisponiblesFiltro}
              filtroZona={filtroZona}
              filtroCliente={filtroCliente}
              totalPuestosFiltrados={totalPuestosFiltrados}
              onCambiarZona={setFiltroZona}
              onCambiarCliente={setFiltroCliente}
              onLimpiar={() => { setFiltroZona(""); setFiltroCliente(""); }}
            />
          )}

          <BuscadorColaborador
            busquedaPersona={busquedaPersona}
            onBusquedaChange={setBusquedaPersona}
            totalPuestosFiltrados={totalPuestosFiltrados}
            hayTablero={tableroFiltrado.length > 0}
            colGlobalVal={colGlobal.val}
            onToggleColGlobal={() => setColGlobal(prev => ({ v: prev.v + 1, val: !colGlobal.val }))}
          />

          <AlertaPoolDescubiertos
            puestosDescubiertos={puestosDescubiertos}
            poolDisponiblesCount={pool?.disponibles?.length ?? 0}
            fechaVistaCerrada={fechaVistaCerrada}
          />

          <AlertaPuestosSinZona
            puestosSinZonaCount={puestosSinZonaCount}
            esSupervisorOAdmin={!!esSupervisorOAdmin}
          />

          {/* ── Cuerpo: pool ↑ · tablero · supervisión ↓ ─────────────────── */}
          <div className="flex flex-col flex-1 gap-3 min-h-0">

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
              Calculando disponibilidad futura…
            </div>
          ) : (
            <PanelPool
              pool={pool}
              loadingPool={loadingPool}
              poolActual={poolActual}
              poolTab={poolTab}
              onSetPoolTab={setPoolTab}
              busquedaPool={busquedaPool}
              onBusquedaPoolChange={setBusquedaPool}
              colPool={colPool}
              onToggleColPool={() => togglePanel("piz_col_pool", colPool, setColPool)}
              agenteSeleccionado={agenteSeleccionado}
              onSelectAgente={(ag) => setAgenteSeleccionado(agenteSeleccionado?.id === ag.id ? null : ag)}
              puestoContexto={puestoContexto}
              onLimpiarContexto={() => setPuestoContexto(null)}
              candidatosRankeados={candidatosRankeados}
              fechaVistaCerrada={fechaVistaCerrada}
            />
          )}

          <TableroPuestos
            loadingTablero={loadingTablero}
            tablero={tablero}
            tableroFiltrado={tableroFiltrado}
            fechaVistaCerrada={fechaVistaCerrada}
            fechaVista={fechaVista}
            esAdmin={!!esAdmin}
            esFuturo={esFuturo}
            isDeleteMode={isDeleteMode}
            agenteSeleccionado={agenteSeleccionado}
            cambiosFuturosProximos={cambiosFuturosProximos}
            planFuturoPorPuesto={planFuturoPorPuesto}
            clienteResaltado={clienteResaltado}
            colGlobal={colGlobal}
            puestoContextoId={puestoContexto?.id ?? null}
            puedeQuitarTitular={puedeQuitarTitular}
            onPuestoClick={handlePuestoClick}
            onLiberar={(p) => esFuturo
              ? setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
              : setModalLiberar(p)}
            onRegistrarFalta={(p, titularId, titularNombre) => setModalFalta({ puesto: p, titularId, titularNombre })}
            onNuevoPuesto={(c) => setNuevoPuestoData(c)}
            onEliminarPuesto={eliminarPuesto}
            onAbrirSegmentos={(p) => setModalSegmentos(p)}
            onConfigTurno={(p) => esFuturo
              ? setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
              : setPuestoParaTurno(p)}
            onQuitarTitular={(p, employeeId, employeeNombre) => setModalQuitarTitular({ puesto: p, employeeId, employeeNombre })}
            onAbrirReabrir={() => setModalReabrir(true)}
            onLimpiarFiltros={() => { setFiltroZona(""); setFiltroCliente(""); setBusquedaPersona(""); }}
          />

          {/* ── BOTTOM: Supervisión (vertical compacta) ─────────────────── */}
          <div className="shrink-0 flex flex-col gap-1.5 pb-1">

          {!esFuturo && pool && (pool.supervisores?.length ?? 0) > 0 && (
            <PanelSupervisoresHoy
              pool={pool}
              agenteSeleccionado={agenteSeleccionado}
              onSelectAgente={setAgenteSeleccionado}
              fechaVistaCerrada={fechaVistaCerrada}
              colSupers={colSupers}
              onToggleSupers={() => togglePanel("piz_col_supers", colSupers, setColSupers)}
              onEditarPlantilla={(data) => setEditarPlantilla(data)}
              onAbrirVehiculo={(id) => setFichaVehiculoId(id)}
            />
          )}

          {!esFuturo && pool && (pool.jefes_servicio?.length ?? 0) > 0 && (
            <PanelJefesServicioHoy
              pool={pool}
              agenteSeleccionado={agenteSeleccionado}
              onSelectAgente={setAgenteSeleccionado}
              fechaVistaCerrada={fechaVistaCerrada}
              colJefes={colJefes}
              onToggleJefes={() => togglePanel("piz_col_jefes", colJefes, setColJefes)}
              onEditarPlantilla={(data) => setEditarPlantilla(data)}
            />
          )}

          {!esFuturo && pool && (pool.administrativos?.length ?? 0) > 0 && (
            <PanelPersonalAdmin
              pool={pool}
              colAdmin={colAdmin}
              onToggleAdmin={() => togglePanel("piz_col_admin", colAdmin, setColAdmin)}
              onEditarPlantilla={(data) => setEditarPlantilla(data)}
            />
          )}

          {esFuturo && poolFuturo && (
            <PanelSupervisoresFuturo
              poolFuturo={poolFuturo}
              colSupers={colSupers}
              onToggleSupers={() => togglePanel("piz_col_supers", colSupers, setColSupers)}
            />
          )}

          {esFuturo && poolFuturo && (
            <PanelJefesFuturo
              poolFuturo={poolFuturo}
              colJefes={colJefes}
              onToggleJefes={() => togglePanel("piz_col_jefes", colJefes, setColJefes)}
            />
          )}

          {tarjetasSSA.length > 0 && (
            <PanelSSA
              tarjetasSSA={tarjetasSSA}
              ssaSinAgente={ssaSinAgente}
              ssaCubierta={ssaCubierta}
              ssaTabActivo={ssaTabActivo}
              onSetSsaTab={setSsaTabActivo}
              colSSA={colSSA}
              onToggleSSA={() => togglePanel("piz_col_ssa", colSSA, setColSSA)}
              fechaVistaCerrada={fechaVistaCerrada}
              onAsignar={(t) => setModalAsignarSSA(t)}
              onRemover={(t, motivo, notas) => removerAgenteSSA(t, motivo, notas)}
            />
          )}

          {(proximosArranques?.total ?? 0) > 0 && !esFuturo && proximosArranques && (
            <PanelProximosArranques
              arranques={proximosArranques.arranques}
              total={proximosArranques.total}
              colArranques={colArranques}
              onToggleArranques={() => togglePanel("piz_col_arr", colArranques, setColArranques)}
              onIrAFecha={irAFecha}
            />
          )}

          </div>{/* ── fin supervisión abajo ── */}
          </div>{/* ── fin cuerpo vertical ── */}

        </div>

        <DragOverlay>
          {draggingAgente && <DragOverlayAgente agente={draggingAgente} />}
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
