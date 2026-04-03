/**
 * nomina-calc.ts — Funciones compartidas de cálculo de nómina
 *
 * FUENTE ÚNICA DE VERDAD para los cálculos financieros de nómina.
 * Usada por pre-planilla (estimado del cierre) y planilla final.
 *
 * Garantiza que total_estimado del cierre == total_bruto de la planilla
 * para el mismo período y conjunto de datos.
 *
 * REGLAS DE NEGOCIO (Guatemala):
 *   - sueldoDia     = sueldo_base / 30  (base mensual dividida entre 30 siempre)
 *   - horasDia      = horas_contrato / 6  si horas_contrato > 0; si no → 8
 *                     (semana estándar: 6 días laborables × 8 h = 48 h contrato)
 *   - sueldoPeriodo = sueldoDia × periodoDias  (quincenal estándar)
 *                   = sueldo_base completo      (mensual en segunda quincena)
 *   - descFaltas    = sueldoDia × (faltas + suspensiones)
 *   - valorHE       = (sueldoDia / horasDia) × 1.5 × horas_extra
 *   - totalBruto    = max(0, sueldoPeriodo − descFaltas + valorHE)
 *   - totalNeto     = max(0, totalBruto − anticipos)
 *
 * NOTA: turno_horas_trabajo NO se usa aquí.
 *   Esa columna representa la duración del turno (12 h, 24 h),
 *   no las horas semanales contratadas. Usarla como divisor de la
 *   tasa horaria produce valores incorrectos para turnos no estándar.
 */

export interface BrutoParams {
  sueldoBase: number;
  horasContrato: number | null | undefined;
  faltas: number;
  suspensiones: number;
  horasExtra: number;
  periodoTotalDias: number;
  frecuenciaPago: string;
  quincenaTipo: "primera" | "segunda";
  /**
   * Número de semanas ISO en el período donde RRHH determinó que el colaborador
   * pierde el séptimo día (eventos_rrhh.afecta_septimo_res = TRUE).
   * Por defecto 0 (sin descuento de séptimo).
   */
  septimosPerdidos?: number;
}

export interface BrutoResult {
  sueldoDia: number;
  horasDia: number;
  sueldoPeriodo: number;
  descFaltas: number;
  descSeptimo: number;
  valorHE: number;
  totalBruto: number;
}

/**
 * Calcula las horas de trabajo por día para efectos de la tasa horaria de HE.
 *
 * @param horasContrato - Horas semanales contratadas del empleado (de employees.horas_contrato)
 * @returns horas/día (número positivo siempre)
 */
export function calcularHorasDia(horasContrato: number | null | undefined): number {
  const hc = parseFloat(String(horasContrato ?? 0));
  return hc > 0 ? hc / 6 : 8;
}

/**
 * Calcula el sueldo bruto de un colaborador para un período dado.
 * Esta función es la ÚNICA fuente de verdad para el cálculo financiero.
 *
 * Debe usarse tanto en el cierre de pre-planilla (total_estimado) como
 * en la generación de la planilla final (planilla_lineas.total_bruto).
 *
 * SÉPTIMO DÍA (Guatemala — Art. 126 CT):
 *   Por cada 6 días trabajados, el colaborador gana 1 día de descanso remunerado.
 *   Si RRHH determina que el colaborador pierde el séptimo de una semana
 *   (afecta_septimo_res = TRUE en eventos_rrhh), se descuenta 1 sueldoDia adicional
 *   por cada semana afectada. El campo septimosPerdidos = número de semanas perdidas.
 *
 *   Fórmula: descSeptimo = sueldoDia × septimosPerdidos
 *   totalBruto = max(0, sueldoPeriodo − descFaltas − descSeptimo + valorHE)
 */
export function calcularBruto(p: BrutoParams): BrutoResult {
  const sueldoDia     = p.sueldoBase / 30;
  const horasDia      = calcularHorasDia(p.horasContrato);
  const esMensualSeg  = p.frecuenciaPago === "mensual" && p.quincenaTipo === "segunda";
  const sueldoPeriodo = esMensualSeg ? p.sueldoBase : sueldoDia * p.periodoTotalDias;
  const descFaltas    = sueldoDia * (p.faltas + p.suspensiones);
  const descSeptimo   = sueldoDia * (p.septimosPerdidos ?? 0);
  const valorHE       = p.horasExtra > 0 ? (sueldoDia / horasDia) * 1.5 * p.horasExtra : 0;
  const totalBruto    = Math.max(0, sueldoPeriodo - descFaltas - descSeptimo + valorHE);

  return { sueldoDia, horasDia, sueldoPeriodo, descFaltas, descSeptimo, valorHE, totalBruto };
}

/**
 * Convierte cualquier valor de fila de BD a número seguro.
 * Cero si null/undefined/NaN.
 */
export function toNum(v: unknown, defaultVal = 0): number {
  const n = parseFloat(String(v ?? defaultVal));
  return isNaN(n) ? defaultVal : n;
}

export function toInt(v: unknown, defaultVal = 0): number {
  const n = parseInt(String(v ?? defaultVal), 10);
  return isNaN(n) ? defaultVal : n;
}
