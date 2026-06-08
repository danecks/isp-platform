/**
 * Cálculo del cobro de un anticipo salarial (modelo de interés fijo / "flat").
 *
 * Regla: el recargo se aplica sobre el MONTO ORIGINAL (no sobre saldos):
 *   - 10% en la primera cuota
 *   - +5% por cada cuota adicional
 *   => tasa total = 0.10 + 0.05 * (cuotas - 1)
 * Las cuotas quedan NIVELADAS (todas iguales).
 *
 * Ejemplo: Q500 en 4 cuotas → tasa 25% → total Q625 → 4 cuotas de Q156.25.
 *
 * NOTA: este cálculo está espejado en el backend
 * (artifacts/api-server/src/routes/anticipos.ts -> calcularCobroAnticipo).
 * Cualquier cambio de regla debe aplicarse en ambos lugares.
 */
export function tasaAnticipo(cuotas: number): number {
  const n = Math.max(1, Math.floor(cuotas) || 1);
  return 0.1 + 0.05 * (n - 1);
}

export function calcularCobroAnticipo(monto: number, cuotas: number) {
  const n = Math.max(1, Math.floor(cuotas) || 1);
  const tasa = tasaAnticipo(n);
  const cuotaMonto = Math.round(((monto * (1 + tasa)) / n) * 100) / 100;
  const montoCobro = Math.round(cuotaMonto * n * 100) / 100;
  return { n, tasa, cuotaMonto, montoCobro };
}
