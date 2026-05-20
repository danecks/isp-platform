import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/httpClient";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const headers = () => ({ "Content-Type": "application/json", "x-isp-session": getSessionToken() });

export interface Excepcion {
  id: number;
  fecha: string;
  cantidad: number;
  motivo: string | null;
}

export interface FilaReporte {
  fecha: string;
  diaSemana: number;
  base: number;
  excepcion: number | null;
  efectiva: number;
  motivo: string | null;
}

export interface ReporteDemanda {
  clienteId: number;
  clienteNombre: string;
  desde: string;
  hasta: string;
  total: number;
  filas: FilaReporte[];
}

export interface ClientePlanificable {
  id: number;
  nombre: string;
}

// CUST-FASE1: hook que centraliza demanda semanal + excepciones por cliente
// (carga + mutaciones), con invalidación correcta de queries.
export function usePlanificacionCliente(clienteId: number | null) {
  const qc = useQueryClient();
  const enabled = !!clienteId;

  const fuerza = useQuery({
    queryKey: ["custodia-fuerza", clienteId],
    enabled,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/fuerza`, {
        credentials: "include", headers: headers(),
      });
      if (!r.ok) throw new Error("Error al cargar fuerza semanal");
      const data = await r.json();
      return data.fuerza as Record<number, number>;
    },
  });

  const excepciones = useQuery<Excepcion[]>({
    queryKey: ["custodia-excepciones", clienteId],
    enabled,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/excepciones`, {
        credentials: "include", headers: headers(),
      });
      if (!r.ok) throw new Error("Error al cargar excepciones");
      return r.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["custodia-fuerza", clienteId] });
    qc.invalidateQueries({ queryKey: ["custodia-excepciones", clienteId] });
    qc.invalidateQueries({ queryKey: ["custodia-reporte-demanda"] });
    qc.invalidateQueries({ queryKey: ["custodias-dashboard"] });
  };

  const saveFuerza = useMutation({
    mutationFn: async (fuerza: Record<number, number>) => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/fuerza`, {
        method: "PUT", credentials: "include", headers: headers(),
        body: JSON.stringify({ fuerza }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Error al guardar");
    },
    onSuccess: invalidate,
  });

  const upsertExcepcion = useMutation({
    mutationFn: async (input: { fecha: string; cantidad: number; motivo?: string; id?: number }) => {
      const url = input.id
        ? `${API_BASE}/custodias/cliente/${clienteId}/excepciones/${input.id}`
        : `${API_BASE}/custodias/cliente/${clienteId}/excepciones`;
      const r = await fetch(url, {
        method: input.id ? "PUT" : "POST",
        credentials: "include", headers: headers(),
        body: JSON.stringify({ fecha: input.fecha, cantidad: input.cantidad, motivo: input.motivo || null }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar excepción");
      }
    },
    onSuccess: invalidate,
  });

  const deleteExcepcion = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/excepciones/${id}`, {
        method: "DELETE", credentials: "include", headers: headers(),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Error al borrar");
    },
    onSuccess: invalidate,
  });

  return { fuerza, excepciones, saveFuerza, upsertExcepcion, deleteExcepcion };
}

export function useClientesPlanificables() {
  return useQuery<ClientePlanificable[]>({
    queryKey: ["custodia-clientes-planificables"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/clientes-planificables`, {
        credentials: "include", headers: headers(),
      });
      if (!r.ok) throw new Error("Error al cargar clientes");
      return r.json();
    },
  });
}

export function useReporteDemanda(params: { clienteId: number | null; desde: string; hasta: string }) {
  const { clienteId, desde, hasta } = params;
  return useQuery<ReporteDemanda>({
    queryKey: ["custodia-reporte-demanda", clienteId, desde, hasta],
    enabled: !!clienteId && !!desde && !!hasta,
    queryFn: async () => {
      const r = await fetch(
        `${API_BASE}/custodias/reporte-demanda?clienteId=${clienteId}&desde=${desde}&hasta=${hasta}`,
        { credentials: "include", headers: headers() }
      );
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Error al cargar reporte");
      return r.json();
    },
  });
}
