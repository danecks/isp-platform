import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/httpClient";

// CUST-FASE3 — hook que centraliza la captura de rutas del día por agente.
//   - listar asignaciones de un (cliente, fecha) con datos de ruta
//   - guardar (UPSERT) ruta + horarios + observaciones de un agente
//   - cargar historial de rutas del agente para alimentar autocompletado

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const headers = () => ({ "Content-Type": "application/json", "x-isp-session": getSessionToken() });

export interface AsignacionRuta {
  id: number;
  employee_id: number;
  slot_numero: number;
  ruta_texto: string | null;
  hora_salida: string | null;
  hora_regreso: string | null;
  observaciones: string | null;
  registrado_por: string | null;
  registrado_at: string | null;
  notas: string | null;
  nombre_completo: string;
  empl_numero: string | null;
}

export interface RutaHistorial {
  texto: string;
  ultimaFecha: string;
  veces: number;
}

export interface GuardarRutaInput {
  fecha: string;
  employeeId: number;
  rutaTexto?: string | null;
  horaSalida?: string | null;
  horaRegreso?: string | null;
  observaciones?: string | null;
}

export function useAsignacionesRutaDia(clienteId: number | null, fecha: string) {
  return useQuery({
    queryKey: ["custodia-rutas-dia", clienteId, fecha],
    enabled: !!clienteId && !!fecha,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/rutas?fecha=${fecha}`, {
        credentials: "include", headers: headers(),
      });
      if (!r.ok) throw new Error("Error al cargar asignaciones del día");
      const data = await r.json();
      return data.asignaciones as AsignacionRuta[];
    },
  });
}

export function useGuardarRuta(clienteId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardarRutaInput) => {
      if (!clienteId) throw new Error("clienteId requerido");
      const r = await fetch(`${API_BASE}/custodias/cliente/${clienteId}/ruta`, {
        method: "PUT", credentials: "include", headers: headers(),
        body: JSON.stringify(input),
      });
      const data = await r.json().catch(() => ({ error: "Error al guardar" }));
      if (!r.ok) throw new Error(data.error ?? "Error al guardar ruta");
      return data as { ok: true; id: number; slot: number };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["custodia-rutas-dia", clienteId, variables.fecha] });
      qc.invalidateQueries({ queryKey: ["custodia-rutas-historial", clienteId, variables.employeeId] });
      qc.invalidateQueries({ queryKey: ["custodias-dashboard"] });
    },
  });
}

export function useRutasHistorial(clienteId: number | null, employeeId: number | null, limit = 20) {
  return useQuery({
    queryKey: ["custodia-rutas-historial", clienteId, employeeId, limit],
    enabled: !!clienteId && !!employeeId,
    queryFn: async () => {
      const r = await fetch(
        `${API_BASE}/custodias/cliente/${clienteId}/rutas-historial/${employeeId}?limit=${limit}`,
        { credentials: "include", headers: headers() },
      );
      if (!r.ok) throw new Error("Error al cargar historial");
      const data = await r.json();
      return data.rutas as RutaHistorial[];
    },
    staleTime: 60_000,
  });
}
