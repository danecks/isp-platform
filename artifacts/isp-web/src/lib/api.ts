import type { AuthUser } from "@/contexts/AuthContext";

const API_BASE = "/api";

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
  }) => apiFetch<UserSafe>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{
    nombre: string;
    correo: string;
    rol: string;
    estado: string;
    telefono: string;
    clienteId: string;
    password: string;
  }>) => apiFetch<UserSafe>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error ?? `Error ${res.status}`);
  }
  return res.json();
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

// --- TRELLO ---
export interface TrelloCardResult {
  incidenciaId: string;
  card: { id: string; name: string; url: string; shortUrl: string };
  checklistId: string;
  checklistItems: string[];
  membersAssigned: string[];
  mockMode: boolean;
}

export interface TrelloConfigStatus {
  configured: boolean;
  hasMemberSupervisor: boolean;
  hasMemberOperaciones: boolean;
  checklistItems: string[];
  mockMode: boolean;
}

export const trelloApi = {
  getConfig: () => apiFetch<TrelloConfigStatus>("/trello/config"),
  sendIncident: (id: string) =>
    apiFetch<TrelloCardResult>(`/trello/send-incident/${id}`, { method: "POST" }),
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
  update: (id: number, data: { estado?: string; observaciones?: string }) =>
    apiFetch<Anticipo>(`/anticipos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
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

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  incidenciaId: string | null;
  prioridad: string;
  estado: string;
  asignado: string | null;
  asignadoId: number | null;
  trelloCardId: string | null;
  trelloCardUrl: string | null;
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
    trelloCardId?: string;
    trelloCardUrl?: string;
    fechaVencimiento?: string;
    canal?: string;
  }) => apiFetch<Tarea>("/tareas", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{
    titulo: string;
    descripcion: string;
    prioridad: string;
    estado: string;
    asignado: string;
    trelloCardId: string;
    trelloCardUrl: string;
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
};
