import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getSession } from "../utils";
import type {
  ClienteBoard,
  Pool,
  Movimiento,
  ClienteDisponible,
  CierreHoyData,
  TarjetaSSAPendiente,
  PlanFuturo,
  PoolFuturoData,
  InicioProyecto,
  Puesto,
} from "../types";

interface Args {
  fechaVista: string;
  esOtraFecha: boolean;
  esFuturo: boolean;
  puestoContextoId: number | null;
  historialAbierto: boolean;
}

export function useOperacionesData({ fechaVista, esOtraFecha, esFuturo, puestoContextoId, historialAbierto }: Args) {
  const qc = useQueryClient();

  const tableroQ = useQuery<ClienteBoard[]>({
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

  const poolQ = useQuery<Pool>({
    queryKey: ["operaciones-pool", puestoContextoId ?? null, fechaVista],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (puestoContextoId) params.set("puesto_id", String(puestoContextoId));
      if (fechaVista) params.set("fecha", fechaVista);
      const qs = params.toString();
      const url = `${API_BASE}/operaciones/pool${qs ? `?${qs}` : ""}`;
      const r = await fetch(url, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`No se pudo cargar el pool (HTTP ${r.status})`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const historialQ = useQuery<Movimiento[]>({
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

  const clientesDisponiblesQ = useQuery<ClienteDisponible[]>({
    queryKey: ["operaciones-clientes"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/clientes-disponibles`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`clientes-disponibles ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const cierreHoyQ = useQuery<CierreHoyData>({
    queryKey: ["operaciones-cierre-hoy"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/cierre-hoy`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`cierre-hoy ${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const tarjetasSSAQ = useQuery<TarjetaSSAPendiente[]>({
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

  const sinZonaQ = useQuery<{ total: number; puestos: { id: number; nombre: string; cliente: string }[] }>({
    queryKey: ["puestos-sin-zona"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/puestos/sin-zona`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`puestos/sin-zona ${r.status}`);
      return r.json();
    },
    refetchInterval: 120_000,
  });

  const planFuturoDiaQ = useQuery<PlanFuturo[]>({
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

  const cambiosFuturosProximosQ = useQuery<Record<number, PlanFuturo[]>>({
    queryKey: ["planificacion-futura-proximos"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/planificacion-futura/proximos`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`planificacion-futura/proximos ${r.status}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const poolFuturoQ = useQuery<PoolFuturoData>({
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

  const proximosArranquesQ = useQuery<{ arranques: InicioProyecto[]; total: number }>({
    queryKey: ["proximos-arranques"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/proximos-arranques?dias=60`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`proximos-arranques ${r.status}`);
      return r.json();
    },
    refetchInterval: 300_000,
    retry: 1,
  });

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

  return {
    qc,
    tablero: tableroQ.data ?? [] as ClienteBoard[],
    loadingTablero: tableroQ.isLoading,
    refetchTablero: tableroQ.refetch,
    pool: poolQ.data,
    loadingPool: poolQ.isLoading,
    refetchPool: poolQ.refetch,
    historial: historialQ.data ?? [] as Movimiento[],
    loadingHistorial: historialQ.isLoading,
    clientesDisponibles: clientesDisponiblesQ.data ?? [] as ClienteDisponible[],
    cierreHoy: cierreHoyQ.data,
    refetchCierre: cierreHoyQ.refetch,
    tarjetasSSA: tarjetasSSAQ.data ?? [] as TarjetaSSAPendiente[],
    sinZonaData: sinZonaQ.data,
    planFuturoDia: planFuturoDiaQ.data ?? [] as PlanFuturo[],
    refetchPlanFuturo: planFuturoDiaQ.refetch,
    cambiosFuturosProximos: cambiosFuturosProximosQ.data ?? {} as Record<number, PlanFuturo[]>,
    poolFuturo: poolFuturoQ.data,
    loadingPoolFuturo: poolFuturoQ.isLoading,
    proximosArranques: proximosArranquesQ.data,
    invalidate,
    invalidateFuture,
  };
}

export type OperacionesData = ReturnType<typeof useOperacionesData>;
// Re-export for convenience
export type { Puesto };
