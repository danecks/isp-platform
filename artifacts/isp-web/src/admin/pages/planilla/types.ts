export interface PlanillaResumen {
  id: number;
  periodo_desde: string;
  periodo_hasta: string;
  estado: string;
  generado_por: string;
  fecha_generacion: string;
  total_colaboradores: number;
  total_bruto: string;
  total_anticipos: string;
  total_neto: string;
  total_sueldo_periodo: string;
  total_desc_faltas: string;
  total_valor_he: string;
  cerrado_por: string;
  cerrado_at: string;
}

export interface PlanillaLinea {
  id: number;
  employee_id: number | null;
  nombre_completo: string;
  dpi: string | null;
  puesto: string | null;
  sede: string | null;
  cliente: string | null;
  tipo_jornada: string | null;
  horas_contrato: number | null;
  sueldo_base: string;
  periodo_dias: number;
  dias_trabajados: number;
  dias_vacaciones?: number;
  faltas: number;
  suspensiones: number;
  horas_trabajadas: string;
  horas_extra: string;
  sueldo_periodo: string;
  desc_faltas: string;
  valor_he: string;
  total_bruto: string;
  anticipos: string;
  total_neto: string;
  igss_trabajador: string | null;
  igss_patronal: string | null;
  isr: string | null;
  otros_descuentos: string | null;
  otros_descuentos_detalle: string | null;
  anticipo_ids: number[] | null;
  novedad_ids: number[] | null;
  segmento_ids: number[] | null;
  aplica_igss: boolean;
  motivo_exclusion_igss: string | null;
  frecuencia_pago: string | null;
  revision_estado: string | null;
  observaciones_rrhh: string | null;
  // Datos del empleado para impresión (cheques/acreditaciones)
  banco?: string | null;
  cuenta_bancaria?: string | null;
  tipo_cuenta?: string | null;
  forma_pago?: string | null;
}

export interface PlanillaDetalle extends PlanillaResumen {
  lineas: PlanillaLinea[];
}

export interface ResumenTransferencias {
  bancos: { banco: string; bancoSlug: string; empleados: number; monto: number }[];
  otrosPagos: { empleados: number; monto: number };
  sinDatos: { id: number; nombre: string; dpi: string; razon: string; monto: number }[];
}

export interface TarifaHE {
  id: number;
  jornada: string;
  horas_turno: number;
  tarifa: string;
  descripcion: string | null;
  updated_at: string;
  updated_by: string | null;
}
