import { useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import RegresosVacacionesBanner from "@/admin/components/RegresosVacacionesBanner";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "../layout/AdminLayout";
import { fechaHoyStr, API_BASE, apiPost } from "./operaciones/utils";
import { Puesto, ClienteBoard, Agente, DiaPendienteCierre, PlanFuturo, TarjetaSSAPendiente } from "./operaciones/types";
import { PoolFuturoPanel } from "./operaciones/components/PoolFuturoPanel";
import { initCollapse, persistCollapse, limpiarURLPizarron } from "./operaciones/helpers";
import { useOperacionesData } from "./operaciones/hooks/use-operaciones-data";
import { useFechaNavegacion } from "./operaciones/hooks/use-fecha-navegacion";
import { useTableroDerivado } from "./operaciones/hooks/use-tablero-derivado";
import { useDragHandlers } from "./operaciones/hooks/use-drag-handlers";
import { useAssignmentFlow } from "./operaciones/hooks/use-assignment-flow";
import { useCierreFlow } from "./operaciones/hooks/use-cierre-flow";
import { usePlanFuturoFlow } from "./operaciones/hooks/use-plan-futuro-flow";
import { OperacionesModales } from "./operaciones/OperacionesModales";
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

  const esAdmin             = currentUser?.rol === "admin";
  const esSupervisorOAdmin  = esAdmin || currentUser?.rol === "supervisor";
  const puedeQuitarTitular  = currentUser?.rol === "admin" || currentUser?.rol === "operaciones";

  // ── Estado UI compartido ──────────────────────────────────────────────────
  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(null);
  const [historialAbierto, setHistorialAbierto]     = useState(false);
  const [nuevoPuestoData, setNuevoPuestoData]       = useState<ClienteBoard | null | "nuevo">(null);
  const [poolTab, setPoolTab]                       = useState<PoolTab>("disponibles");
  const [busquedaPool, setBusquedaPool]             = useState("");
  const [busquedaPersona, setBusquedaPersona]       = useState("");
  const [colGlobal, setColGlobal]                   = useState<{ v: number; val: boolean }>({ v: 0, val: false });
  const [puestoContexto, setPuestoContexto]         = useState<Puesto | null>(null);
  const [filtroZona, setFiltroZona]                 = useState<string>("");
  const [filtroCliente, setFiltroCliente]           = useState<string>("");
  const [modalSegmentos, setModalSegmentos]         = useState<Puesto | null>(null);
  const [modalAsignarSSA, setModalAsignarSSA]       = useState<TarjetaSSAPendiente | null>(null);
  const [ssaTabActivo, setSsaTabActivo]             = useState<"sin_asignar" | "cubierta">("sin_asignar");
  const [fichaVehiculoId, setFichaVehiculoId]       = useState<number | null>(null);
  const [puestoParaTurno, setPuestoParaTurno]       = useState<Puesto | null>(null);
  const [editarPlantilla, setEditarPlantilla]       = useState<{
    empleadoId: number; empleadoNombre: string; tipo: "supervisor" | "administrativo" | "jefe_servicio";
  } | null>(null);

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

  // ── Fecha / navegación ────────────────────────────────────────────────────
  const {
    hoyISO, fechaVista, setFechaVista, esFuturo, esPasado, esOtraFecha,
    clienteResaltado, irAFecha, navFecha, volverHoy,
  } = useFechaNavegacion();

  // ── Datos: queries + invalidate helpers ───────────────────────────────────
  const {
    qc,
    tablero, loadingTablero, refetchTablero,
    pool, loadingPool, refetchPool,
    historial, loadingHistorial,
    clientesDisponibles,
    cierreHoy, refetchCierre,
    tarjetasSSA,
    sinZonaData,
    planFuturoDia,
    cambiosFuturosProximos,
    poolFuturo, loadingPoolFuturo,
    proximosArranques,
    invalidate, invalidateFuture,
  } = useOperacionesData({
    fechaVista, esOtraFecha, esFuturo,
    puestoContextoId: puestoContexto?.id ?? null,
    historialAbierto,
  });

  const puestosSinZonaCount = sinZonaData?.total ?? 0;

  const planFuturoPorPuesto: Record<number, PlanFuturo> = {};
  for (const p of planFuturoDia) {
    if (p.puesto_id !== null) planFuturoPorPuesto[p.puesto_id] = p;
  }

  const ssaSinAgente = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados < (t.cantidad_guardias ?? 1);
  });
  const ssaCubierta = tarjetasSSA.filter((t) => {
    const asignados = (t.agentes ?? []).filter((a) => a.estado === "asignado").length;
    return asignados >= (t.cantidad_guardias ?? 1);
  });

  const diaHoyCerrado = !!(cierreHoy?.esFechaFutura && cierreHoy?.cierreDeHoy);
  const fechaActivaStr = cierreHoy?.fechaActivaStr ?? fechaHoyStr();
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

  // ── Flujos: planificación futura, asignación, cierre ──────────────────────
  const planFuturoFlow = usePlanFuturoFlow({ fechaVista, currentUser, invalidateFuture });
  const assignment = useAssignmentFlow({
    pool, fechaVista, esPasado, fechaActivaStr, currentUser,
    invalidate, refetchTablero, refetchPool,
    setAgenteSeleccionado, setPuestoContexto,
  });
  const cierre = useCierreFlow({
    fechaVista, esPasado, primerDiaPendiente, cierreHoy,
    diaHoyCerrado, fechaVistaCerrada, fechaCierreParaReabrir,
    currentUser, refetchCierre, volverHoy,
  });

  // ── DnD ───────────────────────────────────────────────────────────────────
  const { sensors, draggingAgente, handleDragStart, handleDragEnd } = useDragHandlers({
    pool, tablero, fechaVistaCerrada,
    onAsignarCustodia: assignment.asignarCustodia,
    onIniciarAsignacion: assignment.iniciarAsignacion,
  });

  // ── Click en puesto: asignar agente seleccionado ──────────────────────────
  async function handlePuestoClick(puesto: Puesto) {
    if (esFuturo) {
      planFuturoFlow.setModalPlanFuturo({ puesto, plan: planFuturoPorPuesto[puesto.id] ?? null });
      return;
    }
    if (!agenteSeleccionado) {
      setPuestoContexto(prev => prev?.id === puesto.id ? null : puesto);
      if (poolTab !== "disponibles" && poolTab !== "descansandoCiclo") setPoolTab("disponibles");
      return;
    }
    if (fechaVistaCerrada) return;
    if (puesto.es_custodia) {
      await assignment.asignarCustodia(puesto, agenteSeleccionado);
      setAgenteSeleccionado(null);
      return;
    }
    await assignment.iniciarAsignacion(puesto, agenteSeleccionado);
  }

  async function crearPuesto(data: {
    clienteId: number | null; clienteNombre: string; nombre: string; turno: string; notas: string;
    tipoTurnoId: number; fechaInicioCiclo: string; zonaOperativaId: number;
    tipoPuesto: "normal" | "custodia";
  }) {
    await apiPost(`${API_BASE}/operaciones/puestos`, data);
    const tipoBadge = data.tipoPuesto === "custodia" ? " · Custodia" : "";
    toast({ title: "Puesto creado", description: `${data.nombre} — ${data.clienteNombre}${tipoBadge}` });
    invalidate();
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

  // ── Pool / tablero filtrados + stats ──────────────────────────────────────
  const {
    poolActual, candidatosRankeados, zonasDisponibles, clientesDisponiblesFiltro,
    tableroFiltrado, totalPuestos, puestosCubiertos, puestosDescubiertos, coberturaGlobal,
  } = useTableroDerivado({
    pool, busquedaPool, poolTab, puestoContexto, tablero,
    filtroCliente, filtroZona, busquedaPersona, planFuturoPorPuesto,
  });
  const totalPuestosFiltrados = totalPuestos;

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
              onCerrarDia={(dia) => cierre.setDiaPendienteSeleccionado(dia)}
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
            onAbrirReabrir={() => cierre.setModalReabrir(true)}
            onAbrirCierre={() => cierre.setModalCierre(true)}
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

          <div className="flex flex-col flex-1 gap-3 min-h-0">

          {esFuturo && poolFuturo ? (
            <PoolFuturoPanel
              data={poolFuturo}
              onPlanSSA={(ip) => planFuturoFlow.setModalPlanSSA(ip)}
              onSelectAgente={(ag) => setAgenteSeleccionado(prev => prev?.id === ag.id ? null : ag)}
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
              ? planFuturoFlow.setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
              : assignment.setModalLiberar(p)}
            onRegistrarFalta={(p, titularId, titularNombre) => assignment.setModalFalta({ puesto: p, titularId, titularNombre })}
            onNuevoPuesto={(c) => setNuevoPuestoData(c)}
            onEliminarPuesto={eliminarPuesto}
            onAbrirSegmentos={(p) => setModalSegmentos(p)}
            onConfigTurno={(p) => esFuturo
              ? planFuturoFlow.setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
              : setPuestoParaTurno(p)}
            onQuitarTitular={(p, employeeId, employeeNombre) => assignment.setModalQuitarTitular({ puesto: p, employeeId, employeeNombre })}
            onAbrirReabrir={() => cierre.setModalReabrir(true)}
            onLimpiarFiltros={() => { setFiltroZona(""); setFiltroCliente(""); setBusquedaPersona(""); }}
          />

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
              onRemover={(t, motivo, notas) => assignment.removerAgenteSSA(t, motivo, notas)}
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

          </div>
          </div>

        </div>

        <DragOverlay>
          {draggingAgente && <DragOverlayAgente agente={draggingAgente} />}
        </DragOverlay>
      </DndContext>

      <OperacionesModales
        qc={qc}
        pool={pool}
        cierreHoy={cierreHoy}
        hoyISO={hoyISO}
        fechaVista={fechaVista}
        esOtraFecha={esOtraFecha}
        esPasado={esPasado}
        diaHoyCerrado={diaHoyCerrado}
        fechaCierreParaReabrir={fechaCierreParaReabrir}
        primerDiaPendiente={primerDiaPendiente}
        clientesDisponibles={clientesDisponibles}
        currentUserNombre={currentUser?.nombre ?? currentUser?.username ?? ""}
        historialAbierto={historialAbierto}
        onCloseHistorial={() => setHistorialAbierto(false)}
        historial={historial}
        loadingHistorial={loadingHistorial}
        nuevoPuestoData={nuevoPuestoData}
        onCloseNuevoPuesto={() => setNuevoPuestoData(null)}
        onCrearPuesto={crearPuesto}
        modalSegmentos={modalSegmentos}
        onCloseSegmentos={() => setModalSegmentos(null)}
        modalAsignarSSA={modalAsignarSSA}
        onCloseAsignarSSA={() => setModalAsignarSSA(null)}
        fichaVehiculoId={fichaVehiculoId}
        onCloseVehiculo={() => setFichaVehiculoId(null)}
        editarPlantilla={editarPlantilla}
        onCloseEditarPlantilla={() => setEditarPlantilla(null)}
        puestoParaTurno={puestoParaTurno}
        onCloseConfigTurno={() => setPuestoParaTurno(null)}
        assignment={assignment}
        cierre={cierre}
        planFuturoFlow={planFuturoFlow}
      />
    </AdminLayout>
  );
}
