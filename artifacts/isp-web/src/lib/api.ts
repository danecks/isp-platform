const API_BASE = "/api";

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
  createdAt: string;
  updatedAt: string;
}

export const incidentsApi = {
  getAll: () => apiFetch<Incident[]>("/incidents"),
  getCount: () => apiFetch<{ count: number }>("/incidents/count"),
  create: (data: Partial<Incident>) => apiFetch<Incident>("/incidents", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Incident>) => apiFetch<Incident>(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};
