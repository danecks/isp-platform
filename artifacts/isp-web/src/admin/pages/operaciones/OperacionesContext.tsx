import { createContext, useContext, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type {
  Agente, AgenteRankeado, ClienteBoard, ClienteDisponible, CierreHoyData,
  DiaPendienteCierre, InicioProyecto, Movimiento, PlanFuturo, Pool,
  PoolFuturoData, PoolTab, Puesto, TarjetaSSAPendiente,
} from "./types";
import type { useAssignmentFlow } from "./hooks/use-assignment-flow";
import type { useCierreFlow } from "./hooks/use-cierre-flow";
import type { usePlanFuturoFlow } from "./hooks/use-plan-futuro-flow";

type AssignmentFlow    = ReturnType<typeof useAssignmentFlow>;
type CierreFlow        = ReturnType<typeof useCierreFlow>;
type PlanFuturoFlow    = ReturnType<typeof usePlanFuturoFlow>;

type Setter<T> = (value: T | ((prev: T) => T)) => void;

export interface ZonaItem    { id: string; nombre: string }
export interface ClienteItem { id: string; nombre: string }

export interface EditarPlantillaData {
  empleadoId: number;
  empleadoNombre: string;
  tipo: "supervisor" | "administrativo" | "jefe_servicio";
}

export interface OperacionesContextValue {
  // ── Roles / permisos
  esAdmin: boolean;
  esSupervisorOAdmin: boolean;
  puedeQuitarTitular: boolean;
  isDeleteMode: boolean;

  // ── UI state
  agenteSeleccionado: Agente | null;
  setAgenteSeleccionado: Setter<Agente | null>;
  historialAbierto: boolean;
  setHistorialAbierto: Setter<boolean>;
  nuevoPuestoData: ClienteBoard | null | "nuevo";
  setNuevoPuestoData: Setter<ClienteBoard | null | "nuevo">;
  poolTab: PoolTab;
  setPoolTab: Setter<PoolTab>;
  busquedaPool: string;
  setBusquedaPool: Setter<string>;
  busquedaPersona: string;
  setBusquedaPersona: Setter<string>;
  colGlobal: { v: number; val: boolean };
  toggleColGlobal: () => void;
  puestoContexto: Puesto | null;
  setPuestoContexto: Setter<Puesto | null>;
  filtroZona: string;
  setFiltroZona: Setter<string>;
  filtroCliente: string;
  setFiltroCliente: Setter<string>;
  modalSegmentos: Puesto | null;
  setModalSegmentos: Setter<Puesto | null>;
  modalAsignarSSA: TarjetaSSAPendiente | null;
  setModalAsignarSSA: Setter<TarjetaSSAPendiente | null>;
  ssaTabActivo: "sin_asignar" | "cubierta";
  setSsaTabActivo: Setter<"sin_asignar" | "cubierta">;
  fichaVehiculoId: number | null;
  setFichaVehiculoId: Setter<number | null>;
  puestoParaTurno: Puesto | null;
  setPuestoParaTurno: Setter<Puesto | null>;
  editarPlantilla: EditarPlantillaData | null;
  setEditarPlantilla: Setter<EditarPlantillaData | null>;

  // ── Collapse togglers
  colSSA: boolean;       toggleColSSA: () => void;
  colArranques: boolean; toggleColArranques: () => void;
  colSupers: boolean;    toggleColSupers: () => void;
  colJefes: boolean;     toggleColJefes: () => void;
  colPool: boolean;      toggleColPool: () => void;
  colAdmin: boolean;     toggleColAdmin: () => void;

  // ── Fecha / navegación
  hoyISO: string;
  fechaVista: string;
  setFechaVista: (f: string) => void;
  esFuturo: boolean;
  esPasado: boolean;
  esOtraFecha: boolean;
  clienteResaltado: number | null;
  irAFecha: (fecha: string, clienteId?: number) => void;
  navFecha: (delta: number) => void;
  volverHoy: () => void;
  onCambiarFecha: (f: string) => void;

  // ── Datos crudos
  qc: QueryClient;
  tablero: ClienteBoard[];
  loadingTablero: boolean;
  refetchTablero: () => void;
  pool: Pool | undefined;
  loadingPool: boolean;
  refetchPool: () => void;
  historial: Movimiento[];
  loadingHistorial: boolean;
  clientesDisponibles: ClienteDisponible[];
  cierreHoy: CierreHoyData | undefined;
  refetchCierre: () => void;
  tarjetasSSA: TarjetaSSAPendiente[];
  planFuturoDia: PlanFuturo[];
  cambiosFuturosProximos: Record<number, PlanFuturo[]>;
  poolFuturo: PoolFuturoData | undefined;
  loadingPoolFuturo: boolean;
  proximosArranques: { total: number; arranques: InicioProyecto[] } | undefined;
  invalidate: () => void;
  invalidateFuture: () => void;

  // ── Derivados de cierre / fecha
  puestosSinZonaCount: number;
  planFuturoPorPuesto: Record<number, PlanFuturo>;
  ssaSinAgente: TarjetaSSAPendiente[];
  ssaCubierta: TarjetaSSAPendiente[];
  diaHoyCerrado: boolean;
  fechaActivaStr: string;
  diasPendientesCierre: DiaPendienteCierre[];
  hayDiasPendientes: boolean;
  primerDiaPendiente: DiaPendienteCierre | null;
  diasCerrados: string[];
  hoyCerrado: boolean;
  bloqueadoPorPendientes: boolean;
  fechaVistaCerrada: boolean;
  fechaVistaStr: string;
  fechaCierreParaReabrir: string;

  // ── Tablero derivado
  poolActual: Agente[];
  candidatosRankeados: AgenteRankeado[];
  zonasDisponibles: ZonaItem[];
  clientesDisponiblesFiltro: ClienteItem[];
  tableroFiltrado: ClienteBoard[];
  totalPuestos: number;
  puestosCubiertos: number;
  puestosDescubiertos: number;
  coberturaGlobal: number;
  totalPuestosFiltrados: number;

  // ── Flujos
  assignment: AssignmentFlow;
  cierre: CierreFlow;
  planFuturoFlow: PlanFuturoFlow;

  // ── Handlers compuestos
  handlePuestoClick: (p: Puesto) => void | Promise<void>;
  crearPuesto: (data: {
    clienteId: number | null; clienteNombre: string; nombre: string; turno: string; notas: string;
    tipoTurnoId: number; fechaInicioCiclo: string; zonaOperativaId: number;
    tipoPuesto: "normal" | "custodia";
  }) => Promise<void>;
  eliminarPuesto: (p: Puesto) => void;
  handleRefrescar: () => void;
  handleLimpiarFiltros: () => void;

  currentUserNombre: string;
}

const OperacionesContext = createContext<OperacionesContextValue | null>(null);

export function OperacionesProvider({
  value,
  children,
}: {
  value: OperacionesContextValue;
  children: ReactNode;
}) {
  return (
    <OperacionesContext.Provider value={value}>{children}</OperacionesContext.Provider>
  );
}

export function useOperacionesContext(): OperacionesContextValue {
  const ctx = useContext(OperacionesContext);
  if (!ctx) throw new Error("useOperacionesContext must be used inside <OperacionesProvider>");
  return ctx;
}
