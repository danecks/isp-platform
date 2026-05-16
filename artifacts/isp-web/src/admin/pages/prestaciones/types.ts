export interface PrestacionesConfig {
  aguinaldoBase: "salario_actual" | "promedio_periodo";
  bono14Base: "promedio_periodo" | "salario_actual";
  vacacionesDiasPrimerAnio: number;
  vacacionesDiasQuinquenio: number;
  vacacionesDiasElegibilidad: number;
  indemnizacionSoloLegal: boolean;
  redondeoDecimales: number;
}

export interface Provision {
  periodo_desde: string;
  periodo_hasta: string;
  tipo: string;
  employee_id: number;
  empleado_nombre: string;
  sede: string | null;
  monto_provision: string;
  dias_periodo: number;
  salario_referencia: string;
}

export interface LiquidacionItem {
  id: number;
  employee_id: number;
  empleado: string;
  causal_egreso: string;
  fecha_egreso: string;
  total_general: string;
  estado: string;
  created_at: string;
}

export interface RubroLiquidacion {
  rubro: string;
  descripcion: string;
  monto: number;
}

export interface SimulacionLiquidacion {
  employee_id: number;
  empleado_nombre: string;
  tipo_egreso: string;
  fecha_egreso: string;
  rubros: RubroLiquidacion[];
  totalGeneral: number;
  simulacion: boolean;
}

export interface Employee {
  id: number;
  nombreCompleto: string;
  sueldoBase: string;
  fechaIngreso: string;
  estadoLaboral: string;
}

export interface OdbcEmpleadoRow {
  empl_numero: string;
  nombre_completo: string | null;
  fecha_ingreso: string | null;
  fecha_baja: string | null;
  sueldo_base: string | null;
  total_bono14: string;
  total_aguinaldo: string;
  total_vacaciones: string;
  total_indem: string;
  dias_laborados: string;
  base_bono14_ult: string;
  base_vacas_ult: string;
  periodos_con_data: string;
}
