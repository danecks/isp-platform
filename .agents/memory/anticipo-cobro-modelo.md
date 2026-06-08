---
name: Modelo de cobro de anticipos (interés flat)
description: Cómo se calcula el recargo de un anticipo salarial y por qué la fórmula vive duplicada en backend y frontend.
---

# Cobro de anticipos = interés fijo/flat sobre el monto original

**Regla de negocio:** el recargo se calcula sobre el MONTO ORIGINAL (no sobre
saldos): **10% en la primera cuota + 5% por cada cuota adicional** ⇒
`tasa = 0.10 + 0.05*(n-1)`. Cuotas **niveladas** (todas iguales). Redondeo: se
redondea la cuota y el total se deriva de ella (`cuotaMonto = round(monto*(1+tasa)/n)`,
`montoCobro = round(cuotaMonto*n)`), para que las cuotas queden exactamente iguales.
Ej: Q500 en 4 cuotas → 25% → Q625 → 4 de Q156.25.

**Por qué:** decisión del director (jun 2026). Antes era un 10% plano sobre todo
sin importar las cuotas; el modelo nuevo cobra más entre más cuotas. NO es modelo
de saldos insolutos.

**How to apply:**
- La fórmula está **duplicada a propósito** en dos lugares (no hay paquete
  compartido seguro): backend `anticipos.ts` (`calcularCobroAnticipo`) y frontend
  `isp-web/src/lib/anticipo-cobro.ts`. **Cualquier cambio de regla debe tocar
  AMBOS** o divergen. Cada copia tiene un comentario apuntando al otro.
- El cobro real se fija al **aprobar** (PATCH con `num_cuotas`): ahí se persisten
  `numCuotas`, `cuotaMonto`, `montoCobro`; la planilla descuenta con esos campos.
- Creación (POST) y kiosco (SolicitarAnticipo) NO conocen las cuotas → muestran/
  guardan el caso de **1 pago (10%)** como provisional/mínimo.
- El bot de WhatsApp inserta directo sin `montoCobro`; queda null hasta aprobar y
  el panel admin muestra el estimado a 1 cuota como fallback.
