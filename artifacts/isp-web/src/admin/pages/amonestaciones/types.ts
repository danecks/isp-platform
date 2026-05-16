export interface Motivo { id: number; nombre: string; monto_sugerido: number }
export interface Empleado { id: number; nombreCompleto: string; dpi: string | null; estadoLaboral: string }
export interface CausalLegal {
  id: number; codigo: string; inciso: string; articulo: string;
  titulo: string; descripcion: string; orden: number;
}
export type TipoAmon = "llamada_atencion" | "economica" | "acta_administrativa";
export interface Amonestacion {
  id: number;
  employee_id: number;
  empleado_nombre: string;
  creado_por_username: string | null;
  creado_por_rol: string;
  tipo: TipoAmon;
  motivo: string;
  descripcion: string | null;
  monto: number;
  evidencia_url: string | null;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  fecha: string;
  estado: "activa" | "anulada";
  descontado: boolean;
  planilla_id: number | null;
  anulada_por: string | null;
  anulada_at: string | null;
  created_at: string;
  notas_rrhh?: string | null;
  causal_legal?: string | null;
  articulo_legal?: string | null;
  acta_numero?: number | null;
  acta_pdf_url?: string | null;
  aplica_descuento?: boolean;
  amon_economica_id?: number | null;
  firma_colaborador?: string | null;
  firma_levanta?: string | null;
  firmada_at?: string | null;
}
export interface SolicitudCrea {
  id: number;
  employee_id: number;
  empleado_nombre: string;
  tipo_solicitado: TipoAmon;
  motivo: string;
  descripcion: string | null;
  causal_legal_codigo: string | null;
  monto_sugerido: number;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  fecha_incidente: string | null;
  solicitada_por_username: string;
  solicitada_por_rol: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  respuesta_rrhh: string | null;
  amonestacion_creada_id: number | null;
  resuelta_por: string | null;
  resuelta_at: string | null;
  created_at: string;
}
export interface SolicitudMod {
  id: number;
  amonestacion_id: number;
  solicitada_por_username: string;
  solicitada_por_rol: string;
  cambio_solicitado: string;
  motivo_solicitud: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  respuesta_rrhh: string | null;
  resuelta_por: string | null;
  resuelta_at: string | null;
  created_at: string;
  empleado_nombre: string;
  tipo: string;
  motivo: string;
  monto: number;
  fecha: string;
  amon_estado: string;
  creado_por_username: string;
  creado_por_rol: string;
}
