export interface ColaboradorPre {
  employee_id: number;
  nombre_completo: string;
  dpi: string | null;
  sueldo_base: string | null;
  tipo_jornada: string | null;
  dia_descanso: string | null;
  horas_contrato: number | null;
  estado_laboral: string;
  puesto_empleado: string | null;
  area: string | null;
  sede: string | null;
  supervisor_nombre: string | null;
  cliente_principal: string | null;
  puesto_titular_nombre: string | null;
  dias_cerrados: number;
  dias_trabajados: number;
  faltas: number;
  faltas_pendientes_rrhh: number;
  suspensiones: number;
  descansos_trabajados: number;
  horas_trabajadas: string;
  horas_extra: string;
  relevos: number;
  dias_sin_horas: number;
  anticipos_monto: number;
  anticipos_count: number;
  cuota_uniforme_monto: number;
  incentivos_cash_monto: number;
  incentivos_cash_count: number;
  revision_estado: "pendiente" | "revisada" | "observada" | "aprobado_rrhh";
  revision_observaciones: string | null;
  revision_por: string | null;
  revision_at: string | null;
  revision_aprobado_por: string | null;
  revision_aprobado_at: string | null;
  cierre_id: number | null;
  tipo_turno_id: number | null;
  tipo_turno_nombre: string | null;
  turno_horas_trabajo: string | null;
  turno_fecha_inicio_ciclo: string | null;
  horas_esperadas_total: string | null;
  dias_esperados_trabajo: number;
  dias_esperados_descanso: number;
  aplica_igss_general: boolean;
  estado_igss: string;
  fecha_inicio_igss: string | null;
  puesto_aplica_igss: boolean;
  puesto_regimen_igss: string;
  aplica_igss: boolean;
  motivo_exclusion_igss: string | null;
  frecuencia_pago: string | null;
  excluido_frecuencia_pago: boolean;
  motivo_exclusion_frecuencia_pago: string | null;
  quincena_tipo: string | null;
  tipo_personal: string | null;
  total_dias_descuento: number;
  barraca_monto: number;
  barraca_nombre: string | null;
  seguro_prima_mensual: number;
  bon_incentivo_base: number | string | null;
  bon_1_base: number | string | null;
  bon_2_base: number | string | null;
  bon_3_base: number | string | null;
  amonestaciones_monto: number | string | null;
  amonestaciones_count: number | string | null;
  dias_vacaciones: number | string | null;
  dias_incapacidad: number | string | null;
  dias_permiso_con_goce: number | string | null;
}

export interface DetalleNovedad {
  id: number;
  fecha: string;
  trabajo_dia: boolean;
  horas_trabajadas: string | null;
  horas_extra: string | null;
  falta: boolean;
  suspension: boolean;
  descanso_trabajado: boolean;
  afecta_septimo: boolean;
  descuento_dia: boolean;
  dias_descuento: number | null;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  num_puestos_cubiertos: number;
  observaciones: string | null;
  fuente: string | null;
  cierre_id: number | null;
  tipo_novedad: string | null;
  impacto_nomina: string | null;
}

export interface DetalleAnticipo {
  id: number;
  cantidad: number;
  estado: string;
  periodo: string | null;
  origen: string;
  observaciones: string | null;
  fecha_solicitud: string;
}

export interface DetalleIncentivo {
  id: number;
  fecha: string;
  tipo: string;
  monto: string;
  motivo: string | null;
  estado: string;
  autorizado_por: string | null;
  pagado_por: string | null;
  metodo_pago: string | null;
}

export interface AnexoHE {
  id: number;
  fecha: string;
  horas_extra: number;
  horas_trabajadas: number;
  tipo: string;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  observaciones: string | null;
  fuente: string | null;
  horas_extra_estado: string | null;
  horas_extra_aprobadas_por: string | null;
  horas_extra_aprobadas_at: string | null;
  employee_id: number;
  nombre_completo: string;
  sede: string | null;
  cliente_nombre: string | null;
}

export interface AnexoFalta {
  id: number;
  fecha: string;
  falta: boolean;
  suspension: boolean;
  descuento_dia: boolean;
  dias_descuento: number | null;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  observaciones: string | null;
  fuente: string | null;
  employee_id: number;
  nombre_completo: string;
  dpi: string | null;
  sede: string | null;
  tipo_novedad: string | null;
}

export interface AnexoAnticipo {
  id: number;
  cantidad: number;
  estado: string;
  periodo: string | null;
  origen: string;
  observaciones: string | null;
  fecha_solicitud: string;
  nombre: string | null;
  planilla_id: number | null;
  employee_id: number;
  nombre_completo: string;
  dpi: string | null;
  sede: string | null;
}

export interface AnexoCobertura {
  id: number;
  fecha: string;
  horas: number;
  horas_extra: number;
  tipo_cobertura: string;
  puesto_titular_nombre: string | null;
  puesto_cubierto_nombre: string | null;
  descanso_trabajado: boolean;
  observaciones: string | null;
  num_puestos_cubiertos: number;
  employee_id: number;
  nombre_completo: string;
  sede: string | null;
  cliente_nombre: string | null;
}

export type Tab = "resumen" | "horas_extra" | "faltas" | "anticipos" | "coberturas";

export interface Validacion {
  periodo_cerrado: boolean;
  cierre_id?: number;
  cerrado_por?: string;
  cerrado_at?: string;
  errores_criticos: { tipo: string; mensaje: string; employee_id?: number }[];
  alertas: { tipo: string; mensaje: string; employee_id?: number }[];
  resumen: { total_colaboradores: number; errores: number; alertas: number; puede_cerrar: boolean };
}
