---
name: Vacaciones por ciclo vigente (no arrastrar años)
description: Cómo se computa el saldo de vacaciones desde vac_desde en elegibilidad y liquidación, y la columna de corte por empleado.
---

El saldo de vacaciones se computa SOLO desde una fecha de cómputo `vac_desde`, NO desde fecha_ingreso. Esto evita arrastrar el backlog de años ya pagados (el sistema antes asumía que nunca se pagaron y mostraba años × 15).

**Regla:** `vac_desde = COALESCE(employees.vacaciones_pagadas_hasta, fecha_ingreso + (años_servicio - 1) años)`, acotado (clamp) a `[fecha_ingreso, fecha_referencia]`. La fecha_referencia es CURRENT_DATE en la pantalla y fecha_egreso en la liquidación. `dias_ganados = ROUND((fecha_ref - vac_desde)/365 * 15)`; gozados solo cuentan eventos con `fecha >= vac_desde`. Resultado: 15 del último ciclo cumplido + proporcional del año en curso, nunca más.

**Por qué:** el director confirmó que las vacaciones se pagan año con año, así que no hay backlog real; la regla general aplica a todos. Para excepciones con saldo viejo real se usa la columna `employees.vacaciones_pagadas_hasta` (DATE, NULL = regla general).

**Cómo aplicar:** cualquier cálculo de saldo de vacaciones (pantalla GET /vacaciones/elegibilidad y buildLiquidacion en prestaciones.ts) DEBE usar el mismo `vac_desde` para mantener pantalla y finiquito consistentes. El endpoint PATCH /vacaciones/pagadas-hasta valida que la fecha esté entre ingreso y hoy (evita subpago por corte futuro y sobrepago por corte pre-ingreso). El bloque de "recuperación vacaciones anticipadas" en la liquidación SIGUE usando antigüedad completa a propósito (es un tope de seguridad, independiente del ciclo).
