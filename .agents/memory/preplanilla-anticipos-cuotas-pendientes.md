---
name: Pre-planilla cuenta anticipos por cuota pendiente
description: Por qué la pre-planilla debe contar toda cuota de anticipo pendiente y no solo las solicitadas en la quincena en curso.
---

La pre-planilla (cálculo previo) debe descontar TODA cuota de anticipo pendiente
(`cuotas_pagadas < num_cuotas`), no solo los anticipos cuya `fecha_solicitud` cae
dentro de la quincena. El filtro correcto es `DATE(a.fecha_solicitud) <= hasta`
(fin del período), nunca `BETWEEN desde AND hasta`.

**Why:** un anticipo multi-cuota se cobra a lo largo de varias quincenas; la cuota 1
cae en la quincena donde se pidió, pero las cuotas 2..n caen en quincenas
posteriores. Con `BETWEEN desde AND hasta` esas cuotas 2..n NUNCA aparecen en el
previo (la fecha de solicitud se queda en el pasado), así que el previo mostraba Q0
aunque hubiera decenas de anticipos vivos con saldo. El `<= hasta` evita además
arrastrar anticipos futuros al cerrar quincenas retroactivas.

**How to apply:** el cambio va en DOS lugares de
`artifacts/api-server/src/routes/pre-planilla.ts`: el consolidado
(`anticipos_monto`/`anticipos_count`) y el `GET /anexo/anticipos`. Mantén ambos con
el mismo criterio (`fecha_solicitud <= hasta` + `estado IN ('aprobada','pagada')` +
`cuotas_pagadas < num_cuotas`) o el detalle no cuadra con el total.

La PLANILLA FINAL (`planilla.ts`) ya descuenta correcto: busca anticipos con cuotas
pendientes sin filtro de fecha e incrementa `cuotas_pagadas` al generar (estado pasa
a 'descontado' en la última cuota). Por eso el bug era solo de DISPLAY en el previo;
el pago real no se perdía, pero el director no podía confiar en el previo.
