export interface PlanillaEspecial {
  id: number;
  tipo: "bono14" | "aguinaldo";
  anio: number;
  periodo_inicio: string;
  periodo_fin: string;
  num_pagos: number;
  estado: "borrador" | "aprobada" | "completada" | "anulada";
  total_colaboradores: number;
  total_bruto: string;
  generado_por: string;
  observaciones: string | null;
  created_at: string;
  pagos_realizados: string;
}

export interface PlanillaLinea {
  id: number;
  employee_id: number | null;
  nombre_completo: string;
  puesto: string;
  sede: string;
  cliente: string;
  fecha_ingreso: string;
  fecha_egreso_emp: string | null;
  dias_periodo_total: number;
  dias_laborados: number;
  salario_referencia: string;
  monto_total: string;
  monto_ya_pagado: string;
  estado_laboral?: string;
}

export interface PlanillaPago {
  id: number;
  numero_pago: number;
  porcentaje: string;
  fecha_programada: string | null;
  estado: "pendiente" | "pagado";
  total_este_pago: string;
  pagado_por: string | null;
  pagado_at: string | null;
}

export interface PreviewLinea {
  employee_id: number;
  nombre_completo: string;
  puesto: string;
  sede: string;
  cliente: string;
  fecha_ingreso: string;
  fecha_egreso_emp: string | null;
  estado_laboral: string;
  dias_periodo_total: number;
  dias_laborados: number;
  salario_referencia: number;
  monto_total: number;
  fuente_dias: "odbc" | "planilla" | "calendario";
}

export interface PreviewCuota {
  numero: number;
  porcentaje: number;
  monto: number;
}

export interface PreviewResult {
  tipo: "bono14" | "aguinaldo";
  anio: number;
  periodo_inicio: string;
  periodo_fin: string;
  num_pagos: number;
  total_colaboradores: number;
  total_bruto: number;
  cuotas: PreviewCuota[];
  fuente_resumen: Record<string, number>;
  lineas: PreviewLinea[];
}

export interface PlanillaEspecialDetalle {
  planilla: PlanillaEspecial;
  lineas: PlanillaLinea[];
  pagos: PlanillaPago[];
}
