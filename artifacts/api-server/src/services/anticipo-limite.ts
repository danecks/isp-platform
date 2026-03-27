/**
 * ANTICIPO LÍMITE — Servicio compartido de cálculo de saldo disponible
 *
 * Regla de cálculo:
 *   restante = limiteAnticipo - totalSolicitadoEnPeriodo
 *
 * Estados que cuentan para el cálculo (reducen el saldo):
 *   · pendiente  — solicitud en revisión
 *   · aprobada   — aprobada pero aún no pagada
 *
 * Estados que NO cuentan (no reducen el saldo):
 *   · rechazada  — fue rechazada, no se descontó
 *   · pagada     — ya se procesó, se considera consumido el período
 *
 * Si limiteAnticipo es null → el colaborador no tiene límite configurado
 * y el sistema permite cualquier monto (sin restricción de límite).
 */

import { db, employeesTable, anticiposTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

export interface LimiteInfo {
  limite: number | null;        // null = sin configurar
  tipoLimitePeriodo: string;    // 'quincenal' | custom
  solicitado: number;           // total pendiente + aprobado en el período
  restante: number | null;      // null si no hay límite configurado
  tieneLimite: boolean;
  periodo: string;
}

// Estados que consumen del saldo autorizado
const ESTADOS_QUE_CUENTAN = ["pendiente", "aprobada"];

/**
 * Calcula el límite disponible para un colaborador en un período dado.
 * Reutilizable desde la API manual, el flujo WhatsApp, y el simulador.
 */
export async function calcularLimiteAnticipo(
  employeeId: number,
  periodo: string
): Promise<LimiteInfo> {
  // 1. Leer límite del colaborador
  const [emp] = await db
    .select({
      limiteAnticipo: employeesTable.limiteAnticipo,
      tipoLimitePeriodo: employeesTable.tipoLimitePeriodo,
    })
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);

  const limite = emp?.limiteAnticipo ?? null;
  const tipoPeriodo = emp?.tipoLimitePeriodo ?? "quincenal";

  // 2. Sumar anticipos activos del período
  const registros = await db
    .select({ cantidad: anticiposTable.cantidad })
    .from(anticiposTable)
    .where(
      and(
        eq(anticiposTable.employeeId, employeeId),
        eq(anticiposTable.periodo, periodo),
        inArray(anticiposTable.estado, ESTADOS_QUE_CUENTAN)
      )
    );

  const solicitado = registros.reduce((s, r) => s + r.cantidad, 0);
  const restante = limite !== null ? Math.max(0, limite - solicitado) : null;

  return {
    limite,
    tipoLimitePeriodo: tipoPeriodo,
    solicitado,
    restante,
    tieneLimite: limite !== null,
    periodo,
  };
}
