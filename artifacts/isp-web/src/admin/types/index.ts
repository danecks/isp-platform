export type OrigenType = "web" | "whatsapp" | "manual";
export type PrioridadType = "alta" | "media" | "baja";
export type EstadoIncidenciaType = "abierta" | "en_proceso" | "resuelta" | "cerrada";

export interface Incidencia {
  id: string;
  fecha: string;
  origen: OrigenType;
  cliente: string;
  ubicacion: string;
  tipo: string;
  prioridad: PrioridadType;
  estado: EstadoIncidenciaType;
  responsable: string;
  tareaAsociada?: string;
}

export type EstadoPostulanteType = "recibido" | "en_revision" | "entrevista" | "aprobado" | "descartado";

export interface Postulante {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  experiencia: string;
  ubicacion: string;
  canal: OrigenType;
  estado: EstadoPostulanteType;
  puesto: string;
  fecha: string;
}

export type EstadoLeadType = "nuevo" | "contactado" | "cotizado" | "ganado" | "perdido";

export interface Lead {
  id: string;
  empresa: string;
  contacto: string;
  servicio: string;
  ubicacion: string;
  canal: OrigenType;
  estado: EstadoLeadType;
  ejecutivo: string;
  fecha: string;
}

export type EstadoTareaType = "pendiente" | "en_proceso" | "completada" | "cancelada";

export interface Tarea {
  id: string;
  titulo: string;
  incidenciaRelacionada?: string;
  prioridad: PrioridadType;
  estado: EstadoTareaType;
  asignado: string;
  fecha: string;
}

export type EstadoCustodiaType = "planificada" | "en_ruta" | "completada" | "incidente";

export interface Custodia {
  id: string;
  cliente: string;
  origen: string;
  destino: string;
  agente: string;
  estado: EstadoCustodiaType;
  horaSalida: string;
  incidentesAsociados: number;
  fecha: string;
}

export type EstadoClienteType = "activo" | "revision" | "inactivo";

export interface Cliente {
  id: string;
  empresa: string;
  servicios: string[];
  incidenciasMes: number;
  tiempoPromedio: string;
  estado: EstadoClienteType;
  agentesAsignados: number;
}

export interface KPIData {
  tiempoRespuestaPromedio: number;
  tiempoResolucionPromedio: number;
  incidenciasPorCliente: { cliente: string; total: number }[];
  leadsDelMes: number;
  postulacionesDelMes: number;
  custodiasActivas: number;
  tareasCerradas: number;
  slaCumplido: number;
}
