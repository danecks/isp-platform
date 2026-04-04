/**
 * prestaciones-calc.ts — Motor de cálculo de prestaciones laborales (Guatemala)
 *
 * FUENTE LEGAL
 *  - Aguinaldo:    Código de Trabajo Art. 102 inc. j; Decreto 76-78
 *  - Bono 14:      Decreto 42-92
 *  - Vacaciones:   Código de Trabajo Art. 130-136
 *  - Indemnización:Código de Trabajo Art. 82-85
 *
 * PRINCIPIO
 *  Toda función es pura (no toca DB) y retorna el detalle de cómo se calculó.
 *  Los valores monetarios se redondean a 2 decimales en el resultado final.
 *  Los valores intermedios (dias, tasas) mantienen precisión completa.
 *
 * @module prestaciones-calc
 */

// ─── Utilidades de fecha ──────────────────────────────────────────────────────

/** Parsea fecha como UTC-midnight (evita desfase de zona horaria). */
function toUtcDate(d: Date | string): Date {
  if (d instanceof Date) return new Date(d.toISOString().slice(0, 10) + "T00:00:00Z");
  return new Date(d.slice(0, 10) + "T00:00:00Z");
}

/**
 * Días calendario entre dos fechas, inclusive en ambos extremos.
 * Ej: 2026-04-01 → 2026-04-30 = 30 días.
 */
export function diasEntreFechas(inicio: Date | string, fin: Date | string): number {
  const a = toUtcDate(inicio);
  const b = toUtcDate(fin);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/**
 * Días laborados dentro de un período dado.
 * Si fechaIngreso > periodoInicio → usa fechaIngreso como inicio real.
 * Si fechaEgreso  < periodoFin   → usa fechaEgreso  como fin real.
 * Si no hay solape → retorna 0.
 */
export function diasLaboradosEnPeriodo(
  fechaIngreso: Date | string,
  periodoInicio: Date | string,
  periodoFin: Date | string,
  fechaEgreso?: Date | string,
): number {
  const ingreso    = toUtcDate(fechaIngreso);
  const pInicio    = toUtcDate(periodoInicio);
  const pFin       = toUtcDate(periodoFin);
  const egreso     = fechaEgreso ? toUtcDate(fechaEgreso) : pFin;

  const efectivoInicio = ingreso > pInicio ? ingreso : pInicio;
  const efectivoFin    = egreso  < pFin    ? egreso  : pFin;

  if (efectivoInicio > efectivoFin) return 0;
  return Math.round((efectivoFin.getTime() - efectivoInicio.getTime()) / 86_400_000) + 1;
}

/** Diferencia en años completos entre dos fechas. */
export function aniosDiferenciaCompletos(desde: Date | string, hasta: Date | string): number {
  const a = toUtcDate(desde);
  const b = toUtcDate(hasta);
  let anios = b.getUTCFullYear() - a.getUTCFullYear();
  if (
    b.getUTCMonth() < a.getUTCMonth() ||
    (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())
  ) anios--;
  return Math.max(0, anios);
}

/** Años de servicio exactos (con fracción) como decimal. */
export function aniosDiferenciaDecimal(desde: Date | string, hasta: Date | string): number {
  const a = toUtcDate(desde);
  const b = toUtcDate(hasta);
  const dias = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
  return dias / 365;
}

function r2(n: number): number { return parseFloat(n.toFixed(2)); }

// ─── Interfaces públicas ──────────────────────────────────────────────────────

/** Configuración por empresa (con defaults legales Guatemala). */
export interface PrestacionesConfig {
  aguinaldoBase:              "salario_actual" | "promedio_periodo";
  bono14Base:                 "salario_actual" | "promedio_periodo";
  vacacionesDiasPrimerAnio:   number;  // default 15
  vacacionesDiasQuinquenio:   number;  // default 20
  vacacionesDiasElegibilidad: number;  // default 150 (días continuos)
  indemnizacionSoloLegal:     boolean; // true = solo según CT; false = puede haber mejora
  redondeoDecimales:          number;  // default 2
}

export const CONFIG_DEFAULT: PrestacionesConfig = {
  aguinaldoBase:              "salario_actual",
  bono14Base:                 "promedio_periodo",
  vacacionesDiasPrimerAnio:   15,
  vacacionesDiasQuinquenio:   20,
  vacacionesDiasElegibilidad: 150,
  indemnizacionSoloLegal:     true,
  redondeoDecimales:          2,
};

export type CausalEgreso =
  | "renuncia"
  | "despido_injustificado"
  | "despido_justificado"
  | "mutuo_acuerdo"
  | "fin_contrato"
  | "muerte";

// ─── A. AGUINALDO ─────────────────────────────────────────────────────────────

export interface AguinaldoParams {
  sueldoMensual:    number;         // sueldo_base actual
  promedioSalario?: number;         // si se usa promedio del período
  fechaIngreso:     Date | string;
  periodoInicio:    Date | string;  // Dec 1 año anterior
  periodoFin:       Date | string;  // Nov 30 año vigente
  fechaEgreso?:     Date | string;  // solo para cálculo al egreso
  config?:          Partial<PrestacionesConfig>;
}

export interface AguinaldoResult {
  tipo:              "aguinaldo";
  periodoInicio:     string;
  periodoFin:        string;
  diasPeriodo:       number;
  diasLaborados:     number;
  fraccion:          number;        // diasLaborados / diasPeriodo [0..1]
  salarioReferencia: number;
  montoTotal:        number;        // fraccion × salarioReferencia
  esAnioCompleto:    boolean;
  baseCalculo:       string;        // descripción reproducible
}

export function calcularAguinaldo(p: AguinaldoParams): AguinaldoResult {
  const cfg       = { ...CONFIG_DEFAULT, ...p.config };
  const pInicio   = toUtcDate(p.periodoInicio);
  const pFin      = toUtcDate(p.periodoFin);
  const diasPer   = diasEntreFechas(pInicio, pFin);
  const diasLab   = diasLaboradosEnPeriodo(p.fechaIngreso, pInicio, pFin, p.fechaEgreso);
  const fraccion  = diasPer > 0 ? diasLab / diasPer : 0;

  const salRef =
    cfg.aguinaldoBase === "promedio_periodo" && p.promedioSalario != null
      ? p.promedioSalario
      : p.sueldoMensual;

  const montoTotal = r2(salRef * Math.min(fraccion, 1));

  return {
    tipo:              "aguinaldo",
    periodoInicio:     pInicio.toISOString().slice(0, 10),
    periodoFin:        pFin.toISOString().slice(0, 10),
    diasPeriodo:       diasPer,
    diasLaborados:     diasLab,
    fraccion:          parseFloat(fraccion.toFixed(6)),
    salarioReferencia: salRef,
    montoTotal,
    esAnioCompleto:    diasLab >= diasPer,
    baseCalculo: JSON.stringify({
      base: cfg.aguinaldoBase,
      sueldoMensual: p.sueldoMensual,
      promedioSalario: p.promedioSalario ?? null,
      salarioUsado: salRef,
      diasPeriodo: diasPer,
      diasLaborados: diasLab,
      formula: `${salRef} × (${diasLab}/${diasPer}) = ${montoTotal}`,
    }),
  };
}

// ─── B. BONO 14 ──────────────────────────────────────────────────────────────

export interface Bono14Params {
  sueldoMensual:    number;
  promedioSalario?: number;         // promedio mensual ordinario del período Jul-Jun
  fechaIngreso:     Date | string;
  periodoInicio:    Date | string;  // Jul 1 año anterior
  periodoFin:       Date | string;  // Jun 30 año vigente
  fechaEgreso?:     Date | string;
  config?:          Partial<PrestacionesConfig>;
}

export interface Bono14Result {
  tipo:              "bono14";
  periodoInicio:     string;
  periodoFin:        string;
  diasPeriodo:       number;
  diasLaborados:     number;
  fraccion:          number;
  salarioReferencia: number;
  montoTotal:        number;
  esAnioCompleto:    boolean;
  baseCalculo:       string;
}

export function calcularBono14(p: Bono14Params): Bono14Result {
  const cfg      = { ...CONFIG_DEFAULT, ...p.config };
  const pInicio  = toUtcDate(p.periodoInicio);
  const pFin     = toUtcDate(p.periodoFin);
  const diasPer  = diasEntreFechas(pInicio, pFin);
  const diasLab  = diasLaboradosEnPeriodo(p.fechaIngreso, pInicio, pFin, p.fechaEgreso);
  const fraccion = diasPer > 0 ? diasLab / diasPer : 0;

  // Bono 14 usa promedio por defecto (Decreto 42-92); fallback = sueldo actual
  const salRef =
    cfg.bono14Base === "promedio_periodo" && p.promedioSalario != null
      ? p.promedioSalario
      : p.sueldoMensual;

  const montoTotal = r2(salRef * Math.min(fraccion, 1));

  return {
    tipo:              "bono14",
    periodoInicio:     pInicio.toISOString().slice(0, 10),
    periodoFin:        pFin.toISOString().slice(0, 10),
    diasPeriodo:       diasPer,
    diasLaborados:     diasLab,
    fraccion:          parseFloat(fraccion.toFixed(6)),
    salarioReferencia: salRef,
    montoTotal,
    esAnioCompleto:    diasLab >= diasPer,
    baseCalculo: JSON.stringify({
      base: cfg.bono14Base,
      sueldoMensual: p.sueldoMensual,
      promedioSalario: p.promedioSalario ?? null,
      salarioUsado: salRef,
      diasPeriodo: diasPer,
      diasLaborados: diasLab,
      formula: `${salRef} × (${diasLab}/${diasPer}) = ${montoTotal}`,
    }),
  };
}

// ─── C. VACACIONES ───────────────────────────────────────────────────────────

export interface VacacionesDevengadasParams {
  diasTrabajados:  number;          // días calendario laborados en el período
  aniosServicio:   number;          // años completados al inicio del período
  config?:         Partial<PrestacionesConfig>;
}

export interface VacacionesDevengadasResult {
  tipo:              "vacaciones_devengadas";
  diasTrabajados:    number;
  aniosServicio:     number;
  tasaAnual:         number;        // 15 o 20 días
  diasGanados:       number;        // diasTrabajados × (tasaAnual/365)
  baseCalculo:       string;
}

export function calcularVacacionesDevengadas(p: VacacionesDevengadasParams): VacacionesDevengadasResult {
  const cfg      = { ...CONFIG_DEFAULT, ...p.config };
  const tasaAnual = p.aniosServicio >= 5 ? cfg.vacacionesDiasQuinquenio : cfg.vacacionesDiasPrimerAnio;
  const diasGanados = parseFloat(((p.diasTrabajados * tasaAnual) / 365).toFixed(6));

  return {
    tipo:           "vacaciones_devengadas",
    diasTrabajados: p.diasTrabajados,
    aniosServicio:  p.aniosServicio,
    tasaAnual,
    diasGanados,
    baseCalculo: JSON.stringify({
      aniosServicio: p.aniosServicio,
      tasaAnual,
      diasTrabajados: p.diasTrabajados,
      formula: `${p.diasTrabajados} × (${tasaAnual}/365) = ${diasGanados}`,
    }),
  };
}

export interface VacacionesSaldoParams {
  diasGanados:    number;
  diasGozados:    number;
}

export interface VacacionesSaldoResult {
  tipo:           "vacaciones_saldo";
  diasGanados:    number;
  diasGozados:    number;
  diasDisponibles:number;
  baseCalculo:    string;
}

export function calcularVacacionesSaldo(p: VacacionesSaldoParams): VacacionesSaldoResult {
  const diasDisponibles = parseFloat(Math.max(0, p.diasGanados - p.diasGozados).toFixed(6));
  return {
    tipo: "vacaciones_saldo",
    diasGanados:     p.diasGanados,
    diasGozados:     p.diasGozados,
    diasDisponibles,
    baseCalculo: JSON.stringify({ diasGanados: p.diasGanados, diasGozados: p.diasGozados, diasDisponibles }),
  };
}

export interface VacacionesPagoParams {
  sueldoMensual:  number;
  diasVacaciones: number;           // días a pagar
}

export interface VacacionesPagoResult {
  tipo:            "vacaciones_pago";
  sueldoMensual:   number;
  sueldoDia:       number;          // sueldo_mensual / 30 (CT Art. 92)
  diasVacaciones:  number;
  montoPago:       number;
  baseCalculo:     string;
}

export function calcularVacacionesPago(p: VacacionesPagoParams): VacacionesPagoResult {
  const sueldoDia  = p.sueldoMensual / 30;
  const montoPago  = r2(sueldoDia * p.diasVacaciones);

  return {
    tipo:          "vacaciones_pago",
    sueldoMensual: p.sueldoMensual,
    sueldoDia:     parseFloat(sueldoDia.toFixed(6)),
    diasVacaciones: p.diasVacaciones,
    montoPago,
    baseCalculo: JSON.stringify({
      sueldoMensual: p.sueldoMensual,
      sueldoDia: sueldoDia,
      diasVacaciones: p.diasVacaciones,
      formula: `(${p.sueldoMensual}/30) × ${p.diasVacaciones} = ${montoPago}`,
    }),
  };
}

// ─── D. INDEMNIZACIÓN ────────────────────────────────────────────────────────

/** Causales que generan indemnización según CT Guatemala Art. 82. */
const CAUSALES_CON_INDEMNIZACION: CausalEgreso[] = ["despido_injustificado"];

export interface IndemnizacionParams {
  sueldoMensual:           number;
  promedioUltimos6Meses?:  number;   // si hay salario variable
  fechaIngreso:            Date | string;
  fechaEgreso:             Date | string;
  causalEgreso:            CausalEgreso;
  config?:                 Partial<PrestacionesConfig>;
}

export interface IndemnizacionResult {
  tipo:              "indemnizacion";
  causalEgreso:      CausalEgreso;
  aplicaIndemnizacion:boolean;
  motivoExclusion?:  string;
  fechaIngreso:      string;
  fechaEgreso:       string;
  diasServicio:      number;
  aniosDecimal:      number;
  salarioReferencia: number;         // promedio si está disponible, si no sueldo actual
  montoTotal:        number;
  baseCalculo:       string;
}

export function calcularIndemnizacion(p: IndemnizacionParams): IndemnizacionResult {
  const aplicaIndemnizacion = CAUSALES_CON_INDEMNIZACION.includes(p.causalEgreso as CausalEgreso);

  const ingreso = toUtcDate(p.fechaIngreso);
  const egreso  = toUtcDate(p.fechaEgreso);
  const diasServicio = Math.max(0, Math.round((egreso.getTime() - ingreso.getTime()) / 86_400_000));
  const aniosDecimal = parseFloat((diasServicio / 365).toFixed(6));

  // Indemnización = salario_mensual × años_servicio (proporcional, CT Art. 82)
  const salRef =
    p.promedioUltimos6Meses != null ? p.promedioUltimos6Meses : p.sueldoMensual;

  const montoTotal = aplicaIndemnizacion ? r2(salRef * aniosDecimal) : 0;

  return {
    tipo:               "indemnizacion",
    causalEgreso:       p.causalEgreso,
    aplicaIndemnizacion,
    motivoExclusion:    aplicaIndemnizacion
      ? undefined
      : `Causal '${p.causalEgreso}' no genera indemnización legal (CT Art. 82)`,
    fechaIngreso:       ingreso.toISOString().slice(0, 10),
    fechaEgreso:        egreso.toISOString().slice(0, 10),
    diasServicio,
    aniosDecimal,
    salarioReferencia:  salRef,
    montoTotal,
    baseCalculo: JSON.stringify({
      causalEgreso:   p.causalEgreso,
      aplicaIndemnizacion,
      sueldoMensual:  p.sueldoMensual,
      promedioUsado:  p.promedioUltimos6Meses ?? null,
      salarioUsado:   salRef,
      diasServicio,
      aniosDecimal,
      formula: aplicaIndemnizacion
        ? `${salRef} × ${aniosDecimal.toFixed(4)} años = ${montoTotal}`
        : "Q0.00 — causal sin indemnización legal",
    }),
  };
}

// ─── E. PROVISIÓN PERIÓDICA ───────────────────────────────────────────────────

export interface ProvisionPorPeriodoParams {
  sueldoMensual:   number;
  diasPeriodo:     number;           // días calendario del período de nómina (15 para quincena)
  tipo:            "aguinaldo" | "bono14" | "vacaciones" | "indemnizacion";
  aniosServicio?:  number;           // para vacaciones
  config?:         Partial<PrestacionesConfig>;
}

export interface ProvisionResult {
  tipo:            string;
  diasPeriodo:     number;
  sueldoMensual:   number;
  montoProvision:  number;
  tasaAnual:       number;           // tasa del año completo
  baseCalculo:     string;
}

export function calcularProvisionPeriodo(p: ProvisionPorPeriodoParams): ProvisionResult {
  const cfg = { ...CONFIG_DEFAULT, ...p.config };

  let tasaAnual: number;

  switch (p.tipo) {
    case "aguinaldo":
      // 1 sueldo mensual / año → devengado = sueldo_mensual × (dias_periodo / 365)
      tasaAnual = p.sueldoMensual;
      break;
    case "bono14":
      tasaAnual = p.sueldoMensual;
      break;
    case "vacaciones": {
      // Costo de las vacaciones = días_vacaciones × (sueldo_mensual/30)
      const diasVac = (p.aniosServicio ?? 0) >= 5 ? cfg.vacacionesDiasQuinquenio : cfg.vacacionesDiasPrimerAnio;
      tasaAnual = (p.sueldoMensual / 30) * diasVac;
      break;
    }
    case "indemnizacion":
      // 1 sueldo mensual por año de servicio
      tasaAnual = p.sueldoMensual;
      break;
    default:
      tasaAnual = p.sueldoMensual;
  }

  const montoProvision = r2(tasaAnual * (p.diasPeriodo / 365));

  return {
    tipo:           p.tipo,
    diasPeriodo:    p.diasPeriodo,
    sueldoMensual:  p.sueldoMensual,
    montoProvision,
    tasaAnual,
    baseCalculo: JSON.stringify({
      tipo: p.tipo,
      sueldoMensual: p.sueldoMensual,
      diasPeriodo: p.diasPeriodo,
      tasaAnualBase: tasaAnual,
      formula: `${tasaAnual} × (${p.diasPeriodo}/365) = ${montoProvision}`,
    }),
  };
}

// ─── F. LIQUIDACIÓN FINAL ─────────────────────────────────────────────────────

export interface LiquidacionFinalParams {
  // Datos del empleado
  sueldoMensual:           number;
  promedioUltimos6Meses?:  number;
  fechaIngreso:            Date | string;
  fechaEgreso:             Date | string;
  causalEgreso:            CausalEgreso;
  // Nómina pendiente
  diasSalarioPendiente:    number;   // días del último período no pagado
  // Vacaciones
  diasVacacionesPendientes:number;   // saldo de vacaciones no gozadas
  // Períodos de prestaciones (para proporcional)
  periodoAguinaldoInicio:  Date | string;  // generalmente Dec 1 año anterior
  periodoAguinaldoFin:     Date | string;  // Nov 30 año vigente
  periodoBono14Inicio:     Date | string;  // Jul 1 año anterior
  periodoBono14Fin:        Date | string;  // Jun 30 año vigente
  promedioSalarioAguinaldo?:number;
  promedioSalarioBono14?:   number;
  config?:                 Partial<PrestacionesConfig>;
}

export interface LiquidacionRubro {
  rubro:             string;
  descripcion:       string;
  diasBase?:         number;
  salarioReferencia: number;
  monto:             number;
  baseCalculo:       string;
}

export interface LiquidacionFinalResult {
  fechaIngreso:       string;
  fechaEgreso:        string;
  causalEgreso:       CausalEgreso;
  diasServicio:       number;
  aniosServicio:      number;
  sueldoMensual:      number;
  rubros:             LiquidacionRubro[];
  totalSalarioPendiente: number;
  totalVacaciones:    number;
  totalAguinaldo:     number;
  totalBono14:        number;
  totalIndemnizacion: number;
  totalGeneral:       number;
  baseCalculo:        string;
}

export function calcularLiquidacionFinal(p: LiquidacionFinalParams): LiquidacionFinalResult {
  const ingreso = toUtcDate(p.fechaIngreso);
  const egreso  = toUtcDate(p.fechaEgreso);
  const diasServicio = Math.max(0, Math.round((egreso.getTime() - ingreso.getTime()) / 86_400_000));
  const aniosServicio = aniosDiferenciaCompletos(ingreso, egreso);

  const sueldoDia = p.sueldoMensual / 30;
  const rubros: LiquidacionRubro[] = [];

  // ── Salario pendiente ───────────────────────────────────────────────────────
  const montoSalPend = r2(sueldoDia * p.diasSalarioPendiente);
  rubros.push({
    rubro:             "salario_pendiente",
    descripcion:       `Salario pendiente: ${p.diasSalarioPendiente} días`,
    diasBase:          p.diasSalarioPendiente,
    salarioReferencia: p.sueldoMensual,
    monto:             montoSalPend,
    baseCalculo: JSON.stringify({ sueldoMensual: p.sueldoMensual, sueldoDia, dias: p.diasSalarioPendiente, formula: `(${p.sueldoMensual}/30)×${p.diasSalarioPendiente}=${montoSalPend}` }),
  });

  // ── Vacaciones pendientes ──────────────────────────────────────────────────
  const vacResult = calcularVacacionesPago({ sueldoMensual: p.sueldoMensual, diasVacaciones: p.diasVacacionesPendientes });
  rubros.push({
    rubro:             "vacaciones",
    descripcion:       `Vacaciones pendientes: ${p.diasVacacionesPendientes} días`,
    diasBase:          p.diasVacacionesPendientes,
    salarioReferencia: p.sueldoMensual,
    monto:             vacResult.montoPago,
    baseCalculo:       vacResult.baseCalculo,
  });

  // ── Aguinaldo proporcional ─────────────────────────────────────────────────
  const aguResult = calcularAguinaldo({
    sueldoMensual:   p.sueldoMensual,
    promedioSalario: p.promedioSalarioAguinaldo,
    fechaIngreso:    p.fechaIngreso,
    periodoInicio:   p.periodoAguinaldoInicio,
    periodoFin:      p.periodoAguinaldoFin,
    fechaEgreso:     p.fechaEgreso,
    config:          p.config,
  });
  rubros.push({
    rubro:             "aguinaldo",
    descripcion:       `Aguinaldo proporcional: ${aguResult.diasLaborados}/${aguResult.diasPeriodo} días`,
    diasBase:          aguResult.diasLaborados,
    salarioReferencia: aguResult.salarioReferencia,
    monto:             aguResult.montoTotal,
    baseCalculo:       aguResult.baseCalculo,
  });

  // ── Bono 14 proporcional ───────────────────────────────────────────────────
  const b14Result = calcularBono14({
    sueldoMensual:   p.sueldoMensual,
    promedioSalario: p.promedioSalarioBono14,
    fechaIngreso:    p.fechaIngreso,
    periodoInicio:   p.periodoBono14Inicio,
    periodoFin:      p.periodoBono14Fin,
    fechaEgreso:     p.fechaEgreso,
    config:          p.config,
  });
  rubros.push({
    rubro:             "bono14",
    descripcion:       `Bono 14 proporcional: ${b14Result.diasLaborados}/${b14Result.diasPeriodo} días`,
    diasBase:          b14Result.diasLaborados,
    salarioReferencia: b14Result.salarioReferencia,
    monto:             b14Result.montoTotal,
    baseCalculo:       b14Result.baseCalculo,
  });

  // ── Indemnización ──────────────────────────────────────────────────────────
  const indemResult = calcularIndemnizacion({
    sueldoMensual:          p.sueldoMensual,
    promedioUltimos6Meses:  p.promedioUltimos6Meses,
    fechaIngreso:           p.fechaIngreso,
    fechaEgreso:            p.fechaEgreso,
    causalEgreso:           p.causalEgreso,
    config:                 p.config,
  });
  rubros.push({
    rubro:             "indemnizacion",
    descripcion:       indemResult.aplicaIndemnizacion
      ? `Indemnización: ${indemResult.aniosDecimal.toFixed(2)} años (${indemResult.causalEgreso})`
      : `Indemnización: Q0 — ${indemResult.motivoExclusion}`,
    diasBase:          indemResult.diasServicio,
    salarioReferencia: indemResult.salarioReferencia,
    monto:             indemResult.montoTotal,
    baseCalculo:       indemResult.baseCalculo,
  });

  const totalSalarioPendiente = montoSalPend;
  const totalVacaciones       = vacResult.montoPago;
  const totalAguinaldo        = aguResult.montoTotal;
  const totalBono14           = b14Result.montoTotal;
  const totalIndemnizacion    = indemResult.montoTotal;
  const totalGeneral          = r2(totalSalarioPendiente + totalVacaciones + totalAguinaldo + totalBono14 + totalIndemnizacion);

  return {
    fechaIngreso:    ingreso.toISOString().slice(0, 10),
    fechaEgreso:     egreso.toISOString().slice(0, 10),
    causalEgreso:    p.causalEgreso,
    diasServicio,
    aniosServicio,
    sueldoMensual:   p.sueldoMensual,
    rubros,
    totalSalarioPendiente,
    totalVacaciones,
    totalAguinaldo,
    totalBono14,
    totalIndemnizacion,
    totalGeneral,
    baseCalculo: JSON.stringify({
      fechaIngreso:     ingreso.toISOString().slice(0, 10),
      fechaEgreso:      egreso.toISOString().slice(0, 10),
      causalEgreso:     p.causalEgreso,
      diasServicio,
      aniosServicio,
      sueldoMensual:    p.sueldoMensual,
      rubros:           rubros.map(r => ({ rubro: r.rubro, monto: r.monto })),
      total:            totalGeneral,
    }),
  };
}

// ─── G. PERÍODOS ESTÁNDAR (helpers para Guatemala) ───────────────────────────

/**
 * Retorna el período legal de aguinaldo para un año de pago dado.
 * anoPago = año en que se paga (ej. 2025 → período Dec2024-Nov2025)
 */
export function periodoAguinaldoGuatemala(anoPago: number): { inicio: string; fin: string } {
  return {
    inicio: `${anoPago - 1}-12-01`,
    fin:    `${anoPago}-11-30`,
  };
}

/**
 * Retorna el período legal de Bono 14 para un año de pago dado.
 * anoPago = año en que se paga (ej. 2025 → período Jul2024-Jun2025)
 */
export function periodoBono14Guatemala(anoPago: number): { inicio: string; fin: string } {
  return {
    inicio: `${anoPago - 1}-07-01`,
    fin:    `${anoPago}-06-30`,
  };
}
