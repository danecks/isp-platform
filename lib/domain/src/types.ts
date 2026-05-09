// Tipos comunes de dominio — usados por backend y frontend.

export type EstadoIncidencia = "abierta" | "en_proceso" | "resuelta" | "cerrada";
export type Prioridad = "baja" | "media" | "alta" | "critica";
export type EstadoTarea = "pendiente" | "en_proceso" | "completada" | "cancelada";
export type EstadoLaboral = "activo" | "suspendido" | "baja" | "licencia";
export type TipoPersonal =
  | "guardia"
  | "supervisor"
  | "jefe_servicio"
  | "administrativo_bodega"
  | "administrativo_rrhh"
  | "gerencia";
export type EstadoAnticipo = "pendiente" | "aprobada" | "rechazada" | "pagada";
export type RolUsuario =
  | "admin"
  | "operaciones"
  | "supervisor"
  | "rrhh"
  | "comercial"
  | "cliente"
  | "guardia";

/** Permite filtrar listas por estado conservando el tipado. */
export interface ConEstado<T extends string> {
  estado: T;
}
