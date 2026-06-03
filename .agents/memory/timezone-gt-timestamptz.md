---
name: Timezone GT en columnas TIMESTAMPTZ
description: Cómo filtrar/agrupar por fecha columnas TIMESTAMPTZ para que el día calce con Guatemala (UTC-6).
---

# Fecha de columnas TIMESTAMPTZ → día Guatemala

Regla: al filtrar o agrupar por DÍA sobre una columna `TIMESTAMPTZ` (ej. `eventos_rrhh.fecha`,
`entrada_at`), NO usar `col::date` directo — eso castea con el timezone de la sesión de DB
(normalmente UTC) y los eventos cerca de medianoche caen en el día/quincena equivocado.
Usar siempre: `(col AT TIME ZONE 'America/Guatemala')::date`.

**Why:** la operación es en Guatemala (UTC-6). Un evento del 31 a las 23:00 GT se guarda como
01 05:00 UTC; con `::date` directo se reportaría al día siguiente y descuadraría la conciliación
de quincena / la verificación de pago.

**How to apply:** aplica en WHERE, SELECT, JOIN y ORDER BY que comparen contra una columna
`DATE` (ej. `novedades_nomina_diarias.fecha`, `cobertura_segmentos.fecha`, que SÍ son DATE puro).
Convención ya usada en `visitas.ts`. El cálculo de "quincena actual" del lado servidor también
debe restar 6h al UTC antes de tomar día/mes.
