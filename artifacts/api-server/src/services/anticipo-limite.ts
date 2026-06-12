/**
 * ANTICIPO LÍMITE — Tope dinámico de anticipos (premio por comportamiento)
 *
 * Regla acordada con la dirección:
 *
 *   tope = liquidación acumulada a la fecha × 30% × (KPI disciplinario ÷ 100)
 *
 *   · La liquidación acumulada (base "renuncia": aguinaldo + bono 14 +
 *     vacaciones proporcionales a hoy) es lo que el colaborador tiene ganado
 *     y de donde se podría cobrar si se va. Es la garantía.
 *   · El KPI disciplinario premia al que se porta bien y castiga al que no:
 *     a 100 pts accede al 30% completo; a 70 pts solo al 21%, etc.
 *   · Si el KPI cae en RIESGO (< 70 pts) el tope es 0 (no se presta).
 *
 * El tope se mide contra el SALDO TOTAL que la persona aún debe (todos sus
 * anticipos vivos, no por quincena):
 *   · pendiente / aprobada → cuenta el monto completo (aún no se cobra)
 *   · pagada con cuotas por cobrar → cuenta el principal que falta
 *   · rechazada / pagada completa → no cuenta
 *
 * Fallback: si no se puede calcular la liquidación (falta fecha de ingreso o
 * sueldo) se respeta el límite manual de la ficha (employees.limite_anticipo)
 * si existe; si tampoco hay, no se aplica restricción.
 */

import { db, employeesTable, anticiposTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { calcularLiquidacionAcumulada } from "./liquidacion-acumulada";
import { calcularKPIDisciplinario } from "./disciplinary-kpi";

// Parámetros de la política
const PORC_TECHO = 0.30;        // máximo 30% de la liquidación acumulada
const KPI_MIN_RIESGO = 70;      // KPI < 70 (riesgo) ⇒ sin anticipo

export interface LimiteInfo {
  limite: number | null;        // tope en Q (null = sin restricción)
  tipoLimitePeriodo: string;
  solicitado: number;           // saldo total vivo (todo lo que aún debe)
  restante: number | null;      // null si no hay tope
  tieneLimite: boolean;
  periodo: string;
  // ── Detalle de la política dinámica ──
  liquidacionAcumulada: number; // base de la garantía
  kpiScore: number;             // 0..100
  kpiClasificacion: string;     // excelente | regular | riesgo
  enRiesgo: boolean;            // true ⇒ tope forzado a 0
  porcentajeTecho: number;      // 0.30
  baseManual: boolean;          // true ⇒ se usó el límite manual (fallback)
}

// Estados que mantienen viva la deuda del colaborador
const ESTADOS_ACTIVOS = ["pendiente", "aprobada", "pagada"];

/**
 * Calcula el tope de anticipo disponible para un colaborador.
 * Reutilizable desde la API manual, el flujo WhatsApp y el simulador.
 */
export async function calcularLimiteAnticipo(
  employeeId: number,
  periodo: string
): Promise<LimiteInfo> {
  const [emp] = await db
    .select({
      limiteAnticipo: employeesTable.limiteAnticipo,
      tipoLimitePeriodo: employeesTable.tipoLimitePeriodo,
    })
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);

  const tipoPeriodo = emp?.tipoLimitePeriodo ?? "quincenal";

  // 1. Liquidación acumulada a hoy (base de la garantía)
  const liq = await calcularLiquidacionAcumulada(employeeId);

  // 2. KPI disciplinario (premia/castiga el tope)
  const kpi = await calcularKPIDisciplinario(employeeId);
  const enRiesgo = kpi.score < KPI_MIN_RIESGO;

  // 3. Tope dinámico. El corte por riesgo (KPI < 70) aplica SIEMPRE, aunque no
  // se pueda calcular la liquidación: la regla "en riesgo ⇒ no se presta" es
  // incondicional.
  let limite: number | null;
  let baseManual = false;
  if (enRiesgo) {
    limite = 0;
  } else if (!liq.computable) {
    // No se puede calcular ⇒ respetar el límite manual de la ficha si existe
    limite = emp?.limiteAnticipo ?? null;
    baseManual = true;
  } else {
    limite = Math.round(liq.total * PORC_TECHO * (kpi.score / 100));
  }

  // 4. Saldo total que la persona aún debe (todos los anticipos vivos)
  const registros = await db
    .select({
      cantidad: anticiposTable.cantidad,
      estado: anticiposTable.estado,
      numCuotas: anticiposTable.numCuotas,
      cuotasPagadas: anticiposTable.cuotasPagadas,
    })
    .from(anticiposTable)
    .where(
      and(
        eq(anticiposTable.employeeId, employeeId),
        inArray(anticiposTable.estado, ESTADOS_ACTIVOS)
      )
    );

  let solicitado = 0;
  for (const r of registros) {
    const nc = r.numCuotas && r.numCuotas > 0 ? r.numCuotas : 1;
    const cp = r.cuotasPagadas ?? 0;
    // Si ya se cobraron cuotas (en cualquier estado vivo), solo cuenta el
    // principal que aún falta; si no, cuenta el monto completo.
    if (cp > 0) {
      if (cp < nc) solicitado += Math.round(r.cantidad * (1 - cp / nc));
    } else {
      solicitado += r.cantidad;
    }
  }

  const restante = limite !== null ? Math.max(0, limite - solicitado) : null;

  return {
    limite,
    tipoLimitePeriodo: tipoPeriodo,
    solicitado,
    restante,
    tieneLimite: limite !== null,
    periodo,
    liquidacionAcumulada: liq.total,
    kpiScore: kpi.score,
    kpiClasificacion: kpi.clasificacion,
    enRiesgo: liq.computable ? enRiesgo : false,
    porcentajeTecho: PORC_TECHO,
    baseManual,
  };
}
