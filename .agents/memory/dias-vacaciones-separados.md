---
name: Días de vacaciones separados de trabajados en nómina
description: Decisión de mostrar dias_vacaciones como columna propia (no mezclada en días cerrados) en nómina.
---

Los días de vacaciones se muestran como columna PROPIA, separada de los días trabajados,
en pre-planilla, planilla y libro de salarios. La métrica diaria es la fuente:
trabajados = `trabajo_dia=TRUE`, vacaciones = `tipo_novedad='vacaciones'`.

**Why:** el director pidió ver las vacaciones aparte; antes iban mezcladas dentro de
"días cerrados". No cambia ningún monto: vacaciones siguen siendo tiempo pagado y solo la
bonificación incentivo se ajusta a días trabajados (regla aparte).

**How to apply:**
- Si se agregan columnas de días a estas pantallas, mantener trabajados y vacaciones
  distintas; no recalcular, leer la novedad diaria.
- Planillas generadas ANTES de existir la columna `planilla_lineas.dias_vacaciones` y las
  fuentes ODBC (detalle/histórico del libro) muestran 0 — no tienen desglose de vacaciones.
- Al editar el CSV de planilla, recordar que la fila de TOTALES se arma por posición fija:
  cualquier columna nueva exige sumar una celda al prefijo vacío o se corre todo.
- Lo mismo en la tabla en pantalla (PrePlanilla.tsx): el `<tfoot>` se alinea por POSICIÓN,
  no por nombre. Al agregar una columna al `<thead>`/`<tbody>` hay que sumar también su
  celda en el footer (aunque sea vacía) o los totales salen "corridos". Regla durable:
  contar celdas de header = body = footer (contando colSpan) cuando se toca esta tabla.
