import type { AuthUser } from "@/contexts/AuthContext";

const API_BASE = "/api";

// --- EMPLOYEES (slim) ---
export interface EmpleadoSlim {
  id: number;
  nombreCompleto: string;
  puesto: string | null;
  dpi: string | null;
  telefono: string | null;
  estadoLaboral: string;
}

export const employeesApi = {
  getAll: () => apiFetch<EmpleadoSlim[]>("/employees"),
};

// --- USERS ---
export type { AuthUser as User };

export interface UserSafe {
  id: number;
  nombre: string;
  username: string;
  correo: string | null;
  rol: string;
  estado: string;
  telefono: string | null;
  clienteId: string | null;
  employeeId: number | null;
  canReportEmergency: boolean | null;
  canRequestAdvance: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  getAll: () => apiFetch<UserSafe[]>("/users"),
  create: (data: {
    nombre: string;
    username: string;
    password: string;
    correo?: string;
    rol?: string;
    estado?: string;
    telefono?: string;
    clienteId?: string;
    employeeId?: number | null;
    canReportEmergency?: boolean | null;
    canRequestAdvance?: boolean | null;
  }) => apiFetch<UserSafe>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{
    nombre: string;
    correo: string;
    rol: string;
    estado: string;
    telefono: string;
    clienteId: string;
    employeeId: number | null;
    canReportEmergency: boolean | null;
    canRequestAdvance: boolean | null;
    password: string;
  }>) => apiFetch<UserSafe>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// Delegamos en `httpClient.apiRequest` (Fase 0 — refactor de fundaciones)
// para que exista una única implementación de fetch + sesión + manejo de
// errores. Este wrapper se conserva para no romper a los ~30 callers que
// usan `employeesApi`, `usersApi`, `leadsApi`, `incidentsApi`, etc.
import { apiRequest, ApiError } from "@/lib/httpClient";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    return await apiRequest<T>(path, options as Parameters<typeof apiRequest>[1]);
  } catch (err) {
    // Mantengo la firma histórica: throw new Error(message) para que los
    // componentes existentes que hacen `catch (e: any)` sigan funcionando.
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

// --- LEADS ---
export interface Lead {
  id: number;
  empresa: string;
  contacto: string;
  telefono: string | null;
  correo: string | null;
  servicio: string;
  ubicacion: string | null;
  canal: string;
  estado: string;
  ejecutivo: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export const leadsApi = {
  getAll: () => apiFetch<Lead[]>("/leads"),
  getCount: () => apiFetch<{ count: number }>("/leads/count"),
  create: (data: Partial<Lead>) => apiFetch<Lead>("/leads", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Lead>) => apiFetch<Lead>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// --- APPLICATIONS ---
export interface Application {
  id: number;
  nombre: string;
  telefono: string;
  correo: string | null;
  experiencia: string | null;
  ubicacion: string | null;
  puesto: string | null;
  canal: string;
  estado: string;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

export const applicationsApi = {
  getAll: () => apiFetch<Application[]>("/applications"),
  getCount: () => apiFetch<{ count: number }>("/applications/count"),
  create: (data: Partial<Application>) => apiFetch<Application>("/applications", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Application>) => apiFetch<Application>(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// --- INCIDENTS ---
export interface Incident {
  id: string;
  fecha: string;
  origen: string;
  cliente: string;
  ubicacion: string | null;
  tipo: string;
  prioridad: string;
  estado: string;
  responsable: string | null;
  tareaAsociada: string | null;
  descripcion: string | null;
  esEmergencia: boolean;
  reportadoPor: string | null;
  createdAt: string;
  updatedAt: string;
}

export const incidentsApi = {
  getAll: () => apiFetch<Incident[]>("/incidents"),
  getCount: () => apiFetch<{ count: number }>("/incidents/count"),
  create: (data: Partial<Incident>) => apiFetch<Incident>("/incidents", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Incident>) => apiFetch<Incident>(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// --- ANTICIPOS ---
export interface Anticipo {
  id: number;
  employeeId: number | null;
  nombre: string;
  puesto: string | null;
  dpi: string | null;
  telefono: string | null;
  cantidad: number;
  montoCobro: string | null;     // total a descontar (cantidad + 10%)
  numCuotas: number | null;      // cuántos pagos de planilla
  cuotaMonto: string | null;     // monto por cuota ((cantidad/n) * 1.1)
  cuotasPagadas: number | null;  // cuántas cuotas ya descontadas
  origen: string;
  estado: string;
  periodo: string | null;
  fechaSolicitud: string;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnticipoTotales {
  pendiente: number;
  aprobada: number;
  rechazada: number;
  pagada: number;
  total: number;
  montoPendiente: number;
  montoAprobado: number;
}

export interface AnticipoPeriodoConfig {
  diasHabilitados: number[];
  toleranciaDias: number;
  periodoActual: string | null;
  habilitadoAhora: boolean;
  estadosValidos: string[];
}

export const anticiposApi = {
  getAll: (params?: { estado?: string; origen?: string; periodo?: string; desde?: string; hasta?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string> ?? {}).toString();
    return apiFetch<{ anticipos: Anticipo[]; totales: AnticipoTotales }>(`/anticipos${qs ? "?" + qs : ""}`);
  },
  getConfig: () => apiFetch<AnticipoPeriodoConfig>("/anticipos/config"),
  update: (id: number, data: { estado?: string; observaciones?: string; num_cuotas?: number }) =>
    apiFetch<Anticipo>(`/anticipos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  create: (data: {
    nombre: string;
    cantidad: number;
    empleadoId?: number | null;
    puesto?: string;
    dpi?: string;
    telefono?: string;
    observaciones?: string;
  }) => apiFetch<Anticipo>("/anticipos", { method: "POST", body: JSON.stringify(data) }),
  exportCsv: (params?: { estado?: string; periodo?: string; desde?: string; hasta?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string> ?? {}).toString();
    return `${API_BASE}/anticipos/export${qs ? "?" + qs : ""}`;
  },
};

// ─── TAREAS ───────────────────────────────────────────────────────────────────
export interface TareaEvidencia {
  id: number;
  tareaId: string;
  supervisorId: number | null;
  supervisorNombre: string;
  comentario: string;
  fotoUrl: string;
  canal: string;
  fechaCierre: string;
  createdAt: string;
}

export interface TareaPaso {
  key: string;
  label: string;
  done: boolean;
  doneAt: string | null;
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  incidenciaId: string | null;
  prioridad: string;
  estado: string;
  asignado: string | null;
  asignadoId: number | null;
  pasos: TareaPaso[] | null;
  fechaVencimiento: string | null;
  canal: string;
  createdAt: string;
  updatedAt: string;
  evidencia: TareaEvidencia | null;
}

export interface TareaStats {
  pendiente: number;
  en_proceso: number;
  completada: number;
  cancelada: number;
}

// --- DASHBOARD SUMMARY ---
export interface DashboardSummary {
  operaciones: {
    incidencias_activas: number;
    emergencias_activas: number;
    tareas_pendientes: number;
  };
  rrhh: {
    empleados_activos: number;
    suspendidos: number;
    bajas_este_mes: number;
    alertas_activas: number;
    anticipos_pendientes: number;
    liquidaciones_confirmadas: number;
    postulaciones_nuevas: number;
    vacaciones_pendientes: number;
  };
  comercial: {
    leads_nuevos: number;
    postulaciones_nuevas: number;
  };
  control_qr: {
    fichajes_hoy: number;
    agentes_en_turno: number;
  };
  bodega: {
    solicitudes_pendientes: number;
    armas_en_reparacion: number;
  };
  sistema: {
    eliminaciones_pendientes: number;
  };
}

export const dashboardApi = {
  getSummary: () => apiFetch<DashboardSummary>("/dashboard/summary"),
};

// --- RRHH ALERTAS (para dashboard) ---
export interface AlertaRRHH {
  id: number;
  employeeNombre: string;
  tipo: string;
  prioridad: string;
  estado: string;
  sugerencia: string | null;
  generadaAt: string;
}

export const rrhhAlertasApi = {
  getActivas: (limit = 8) =>
    apiFetch<{ alertas: AlertaRRHH[]; resumen: Record<string, number> }>(`/rrhh/alertas?estado=activas`).then(
      (d) => ({ ...d, alertas: (d.alertas ?? []).slice(0, limit) }),
    ),
};

export const tareasApi = {
  getAll: () => apiFetch<Tarea[]>("/tareas"),
  getStats: () => apiFetch<TareaStats>("/tareas/stats"),
  getById: (id: string) => apiFetch<Tarea>(`/tareas/${id}`),
  create: (data: {
    titulo: string;
    descripcion?: string;
    incidenciaId?: string;
    prioridad?: string;
    estado?: string;
    asignado?: string;
    asignadoId?: number;
    fechaVencimiento?: string;
    canal?: string;
  }) => apiFetch<Tarea>("/tareas", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{
    titulo: string;
    descripcion: string;
    prioridad: string;
    estado: string;
    asignado: string;
  }>) => apiFetch<Tarea>(`/tareas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  cerrar: (id: string, data: {
    supervisorNombre: string;
    supervisorId?: number;
    rolSupervisor: string;
    comentario: string;
    fotoUrl: string;
    canal?: string;
  }) => apiFetch<{ tarea: Tarea; evidencia: TareaEvidencia }>(`/tareas/${id}/cerrar`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  cancelar: (id: string) => apiFetch<{ ok: boolean }>(`/tareas/${id}`, { method: "DELETE" }),
  togglePaso: (id: string, key: string, done: boolean) =>
    apiFetch<Tarea>(`/tareas/${id}/paso`, { method: "PATCH", body: JSON.stringify({ key, done }) }),
};

