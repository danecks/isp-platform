---
name: ISR deducción personal (Decreto 13-2026)
description: Cómo se calcula la deducción personal del ISR sobre rentas del trabajo tras la reforma de Guatemala; reglas por año y dónde mantenerla.
---

# ISR deducción personal — Decreto 13-2026 (Guatemala)

La deducción personal anual que se resta antes de aplicar la tarifa del ISR
(5% hasta Q300,000 / 7% excedente, ÷24 para quincenal) dejó de ser el fijo
histórico Q48,000. Regla por **año fiscal del período** (no por año en curso):

- `< 2026`: Q48,000 (histórico, para reprocesar períodos viejos).
- `2026`: Q48,000 + Q3,024 extraordinario transitorio = **Q51,024**.
- `2027+`: **dinámica** = 12 × (salario mínimo mensual no agrícola + bonificación
  incentivo Q250). Sube solo cuando sube el salario mínimo. 2026 no agrícola = Q4,252.

**Why:** Decreto 13-2026 (reforma al Dto. 10-2012), vigente 23-may-2026. El año
debe ser el del período liquidado (derivado de `desde`), no `new Date()`, para que
reprocesar una quincena vieja no aplique la deducción equivocada.

**How to apply:**
- La fórmula está **DUPLICADA**: backend `artifacts/api-server/src/lib/nomina-calc.ts`
  (`deduccionPersonalISR`, `calcularISRQuincenal`) y frontend
  `artifacts/isp-web/src/admin/pages/pre-planilla/helpers.ts`. Cambiar en AMBOS o divergen.
- `calcularISRQuincenal`/`calcularTotalEstimado` reciben `anio` opcional (default año
  actual); los callers pasan `Number(desde.slice(0,4))`. `deduccionPersonalISR` guarda
  contra NaN (`desde` malformado) cayendo al año actual.
- Cada año, al publicarse el salario mínimo, agregar `{ <año>: <monto no agrícola> }`
  a `SALARIO_MINIMO_NO_AGRICOLA` en ambos archivos; sin entrada usa el último año conocido.
- La app **NO** aplica el crédito IVA de Q12,000 (requiere facturas por empleado, no
  se rastrean); se mantiene así a propósito (conservador). No agregarlo sin pedido explícito.
