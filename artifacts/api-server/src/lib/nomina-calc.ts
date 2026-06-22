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
 *   - sueldoPeriodo = sueldoDia × 15            (quincenal: SIEMPRE 15 días contables,
 *                                                 sin importar el calendario real.
 *                                                 Política empresa may-2026.)
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
  diasDescuento?: number | null;
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
  /**
   * Tarifa fija por turno de HE (override del factor 1.5x legal).
   * Si se proporciona, valorHE = tarifaFijaTurnoHE × turnosHE.
   * Si no, se usa la fórmula legal: (sueldoDia / horasDia) × 1.5 × horasExtra.
   */
  tarifaFijaTurnoHE?: number | null;
  /**
   * Número de turnos completos de HE (cuando se usa tarifa fija).
   * Si no se proporciona, se calcula como horasExtra / horasDelTurno.
   */
  turnosHE?: number | null;
  /**
   * Pago por feriados/asuetos nacionales trabajados en el período.
   * Concepto aparte que suma al bruto (default 0). Lo asigna el encargado de
   * nómina por colaborador en la pre-planilla mientras la quincena está abierta.
   */
  pagoFeriados?: number;
}

export interface BrutoResult {
  sueldoDia: number;
  horasDia: number;
  sueldoPeriodo: number;
  descFaltas: number;
  descSeptimo: number;
  valorHE: number;
  pagoFeriados: number;
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
 * Calcula el valor en quetzales de las horas extra de un colaborador.
 *
 * FUENTE ÚNICA para el monto de HE — usada por la pre-planilla (vista previa
 * y estimado del cierre) y por la planilla final, para que siempre coincidan.
 *
 * Si existe tarifa fija por turno (tabla config_tarifa_he: 12h→Q150, 24h→Q300),
 * valorHE = tarifa × turnos, donde turnos = horasExtra / horas_turno.
 * Si no hay tarifa configurada, cae a la fórmula legal (sueldoDia/horasDia)×1.5×he.
 *
 * `jornada` se resuelve igual que en la planilla: jornada explícita, si no la
 * duración del turno (turnoHorasTrabajo + "h"), si no "12h".
 */
export function calcularValorHE(opts: {
  sueldoBase: number;
  horasContrato?: number | null;
  horasExtra: number;
  jornada?: string | null;
  turnoHorasTrabajo?: number | null;
  tarifasHE?: Map<string, { tarifa: number; horas_turno: number }> | null;
}): { valorHE: number; tarifaFijaTurnoHE: number | null; turnosHE: number | null } {
  const he = parseFloat(String(opts.horasExtra ?? 0));
  if (!he || he <= 0) return { valorHE: 0, tarifaFijaTurnoHE: null, turnosHE: null };

  const jornada = String(
    opts.jornada ?? (opts.turnoHorasTrabajo ? `${opts.turnoHorasTrabajo}h` : "12h"),
  );
  const tarifaConf = opts.tarifasHE?.get(jornada) ?? opts.tarifasHE?.get("12h");
  if (tarifaConf && tarifaConf.tarifa > 0) {
    const turnos = he / (tarifaConf.horas_turno || 12);
    return {
      valorHE: parseFloat((tarifaConf.tarifa * turnos).toFixed(2)),
      tarifaFijaTurnoHE: tarifaConf.tarifa,
      turnosHE: turnos,
    };
  }

  // Sin tarifa configurada → fórmula legal 1.5x
  const sueldoDia = opts.sueldoBase / 30;
  const horasDia = calcularHorasDia(opts.horasContrato);
  return {
    valorHE: parseFloat(((sueldoDia / horasDia) * 1.5 * he).toFixed(2)),
    tarifaFijaTurnoHE: null,
    turnosHE: null,
  };
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
  // Política empresa may-2026: quincena fija de 15 días contables, sin importar
  // el calendario real. El agente cobra exactamente sueldo_base/2 cada quincena
  // (en febrero, marzo de 31 días, año bisiesto, etc.). Esto evita que el monto
  // varíe quincena a quincena por el largo del mes.
  const DIAS_QUINCENA_FIJA = 15;
  const esQuincenal = p.frecuenciaPago === "quincenal";
  const sueldoPeriodo = esMensualSeg
    ? p.sueldoBase
    : esQuincenal
      ? sueldoDia * DIAS_QUINCENA_FIJA
      : sueldoDia * p.periodoTotalDias;
  // Si se provee diasDescuento (días de descuento por turno, ya topado a un séptimo
  // por semana en el query consolidado), es la fuente autoritativa AUNQUE sea 0
  // (p.ej. faltas rechazadas por RRHH → no se descuenta). Solo se cae al conteo de
  // faltas cuando diasDescuento no viene (callers de validación/tests).
  const diasDesc      = (p.diasDescuento != null)
    ? p.diasDescuento + p.suspensiones
    : p.faltas + p.suspensiones;
  const descFaltas    = sueldoDia * diasDesc;
  const descSeptimo   = sueldoDia * (p.septimosPerdidos ?? 0);
  const valorHE       = p.horasExtra > 0
    ? (p.tarifaFijaTurnoHE != null && p.tarifaFijaTurnoHE > 0
        ? p.tarifaFijaTurnoHE * (p.turnosHE ?? p.horasExtra)
        : (sueldoDia / horasDia) * 1.5 * p.horasExtra)
    : 0;
  const pagoFeriados  = Math.max(0, p.pagoFeriados ?? 0);
  const totalBruto    = Math.max(0, sueldoPeriodo - descFaltas - descSeptimo + valorHE + pagoFeriados);

  return { sueldoDia, horasDia, sueldoPeriodo, descFaltas, descSeptimo, valorHE, pagoFeriados, totalBruto };
}

// ─── Parámetros para bonificación incentivo ──────────────────────────────────

export interface BonificacionParams {
  /** 'quincenal' → Q125 base | 'mensual' → Q250 base | cualquier otro → Q125 */
  frecuenciaPago: string;
  /** Fecha de inicio del período YYYY-MM-DD */
  desde: string;
  /** Fecha de fin del período YYYY-MM-DD (inclusive) */
  hasta: string;
  /** Días que el colaborador trabajó efectivamente */
  diasTrabajados: number;
  /** Días de vacaciones gozadas en el período */
  diasVacaciones: number;
  /** Días de permiso con goce de sueldo */
  diasPermisoConGoce: number;
  /**
   * Días de incapacidad con goce (IGSS cubre al patrono).
   * Si no existe columna separada, pasar el total de incapacidad.
   */
  diasIncapacidadConGoce: number;
}

/**
 * Calcula la bonificación incentivo proporcional al tiempo laborable.
 *
 * Decreto 78-89 Art. 7 (Guatemala): Q250/mes mínimo.
 * → Q125/quincena para empleados quincenales.
 * → Q250 para empleados mensuales (pagado en segunda quincena).
 *
 * REGLA DE PROPORCIONALIDAD (decisión de empresa abr 2026):
 *   bonificacion = (montoBase / 30) × diasPagables
 *
 * Usamos divisor fijo de 30 (mes contable estándar) para que la fórmula
 * sea idéntica a `bonProporcional` en planilla.ts y a la pre-planilla,
 * y para que un mes de 31 días pagado completo no genere Q258.33 en
 * vez de Q250 (lo que pasaría si dividiéramos entre diasPeriodo).
 *
 * Donde:
 *   diasPeriodo  = días calendario del período (inclusive ambos extremos)
 *   diasPagables = diasTrabajados + diasPermisoConGoce
 *                  (capped al máximo de diasPeriodo, mínimo 0)
 *
 * NO se incluyen en diasPagables:
 *   - vacaciones (postura empresa: durante vacaciones no hay actividad
 *                 y la bonif. incentivo es por día efectivamente trabajado)
 *   - incapacidad por IGSS (la subvención la paga el seguro social,
 *                           no la empresa, así que no se devenga bonif.)
 *   - permisos sin goce, faltas injustificadas, suspensiones sin goce
 *
 * Si diasPeriodo ≤ 0 o diasPagables = 0 → retorna 0.
 * Resultado redondeado a 2 decimales.
 */
export function calcularBonificacionIncentivo(p: BonificacionParams): number {
  // Días calendario del período (extremos inclusivos)
  const d1 = new Date(p.desde + "T00:00:00Z");
  const d2 = new Date(p.hasta + "T00:00:00Z");
  const diasPeriodo = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;

  // Monto base SIEMPRE mensual (Q250) — la proporción /30 × días pagables
  // ya da el valor correcto por período: para una quincena con 15 días
  // pagables sale Q125 automáticamente (250/30×15=125). El parámetro
  // `frecuenciaPago` se mantiene por compatibilidad pero ya no escala el monto.
  const montoBase = 250;

  // Días que generan derecho a bonificación (solo trabajados + permiso con goce)
  let diasPagables =
    (p.diasTrabajados     || 0) +
    (p.diasPermisoConGoce || 0);

  // Política empresa may-2026: quincena fija de 15 días contables.
  // Si el calendario real tiene < 15 días (feb 16-28 = 13 días, feb bisiesto = 14),
  // se acreditan los "días padding" como pagables, porque el agente no puede haber
  // faltado a días que no existen en el calendario. Resultado: agente que trabajó
  // toda la quincena cobra Q125 completo, sin importar el largo del mes.
  // Tope final: 15 para quincenales, 30 para mensuales.
  const topePeriodo = p.frecuenciaPago === "quincenal" ? 15 : 30;
  if (p.frecuenciaPago === "quincenal" && diasPeriodo > 0 && diasPeriodo < topePeriodo) {
    diasPagables += (topePeriodo - diasPeriodo);
  }
  diasPagables = Math.max(0, Math.min(diasPagables, topePeriodo));

  if (diasPeriodo <= 0 || diasPagables <= 0) return 0;

  // Divisor fijo de 30 (mes contable) — alineado con planilla.ts y pre-planilla
  return parseFloat(((montoBase / 30) * diasPagables).toFixed(2));
}

// ── ISR rentas del trabajo (Guatemala) ──────────────────────────────────────
// Deducción personal anual antes de calcular el ISR, según el Decreto 13-2026
// (reforma al Decreto 10-2012, "Ley de Actualización Tributaria"; vigente desde
// el 23-may-2026).
//
//  • Año fiscal ≤ 2026: Q48,000 fijos (mínimo vital histórico) + Q3,024 de
//    deducción extraordinaria transitoria = Q51,024.
//  • Año fiscal ≥ 2027: la deducción fija se sustituye por un monto DINÁMICO =
//    12 salarios mínimos mensuales no agrícolas + bonificación incentivo (Q250),
//    que se actualiza solo cada vez que sube el salario mínimo (Art. 72 bis).
//
// Al publicarse el salario mínimo de un nuevo año, agregar su valor en
// SALARIO_MINIMO_NO_AGRICOLA (la SAT publica la tabla del ISR 5 días hábiles
// después). Mientras no esté, se usa el último salario mínimo conocido.
export const BONIFICACION_INCENTIVO = 250;
export const SALARIO_MINIMO_NO_AGRICOLA: Record<number, number> = {
  2026: 4252,
};

export function deduccionPersonalISR(anio: number): number {
  const y = Number.isFinite(anio) ? anio : new Date().getFullYear();
  if (y < 2026) return 48000;          // regla histórica (antes del Dto. 13-2026)
  if (y === 2026) return 48000 + 3024; // Q51,024 (regla transitoria 2026)
  // 2027+: dinámica = 12 × (salario mínimo no agrícola + bonificación incentivo).
  const aniosConocidos = Object.keys(SALARIO_MINIMO_NO_AGRICOLA).map(Number);
  const sm = SALARIO_MINIMO_NO_AGRICOLA[y]
    ?? SALARIO_MINIMO_NO_AGRICOLA[Math.max(...aniosConocidos)];
  return 12 * (sm + BONIFICACION_INCENTIVO);
}

/**
 * Calcula ISR quincenal (Guatemala) usando proyección anual fija.
 *
 * Fórmula:
 *   rentaAnual     = sueldoBase × 12
 *   igssAnual      = rentaAnual × 4.83%
 *   rentaImponible = rentaAnual − igssAnual − deducción personal del año fiscal
 *   ISR anual      = 5% hasta Q300,000 + 7% sobre excedente
 *   ISR quincenal  = ISR anual / 24
 *
 * La deducción personal depende del año (ver deduccionPersonalISR, Dto. 13-2026).
 * El IGSS sí se descuenta de la base por ser deducible del ISR (Art. 72 Dto. 10-2012).
 */
export function calcularISRQuincenal(
  sueldoBaseMensual: number,
  aplicaIgss: boolean = true,
  anio: number = new Date().getFullYear(),
): number {
  const brutaAnual = sueldoBaseMensual * 12;
  const igssAnual = aplicaIgss ? brutaAnual * 0.0483 : 0;
  const rentaImponible = brutaAnual - igssAnual - deduccionPersonalISR(anio);
  if (rentaImponible <= 0) return 0;
  let isrAnual = 0;
  if (rentaImponible <= 300000) {
    isrAnual = rentaImponible * 0.05;
  } else {
    isrAnual = 300000 * 0.05 + (rentaImponible - 300000) * 0.07;
  }
  return Math.round((isrAnual / 24) * 100) / 100;
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
