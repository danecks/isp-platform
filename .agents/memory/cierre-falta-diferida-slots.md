---
name: Falta diferida del cierre vs puestos por slots
description: por qué el cierre regeneraba faltas diarias de un titular de slot y la regla para no hacerlo
---

El bloque de "faltas diferidas" del cierre operativo materializa una falta del titular
leyendo la bandera legacy `puestos_operativos.estado_operativo_puesto='faltando'`
(+ `falta_employee_id`). Esa bandera **no tiene fecha**: una vez puesta se queda pegada y
**cada cierre diario** genera una falta nueva del titular, incluso en sus días de descanso
del ciclo, aunque esté trabajando. Así un titular de slot acumulaba una falta por día
indefinidamente hasta anularlas a mano.

**Regla:** en el modelo por slots (24x24/turnos) la inasistencia se registra de forma
**fechada** vía cobertura/relevo (eventos propios), NO por la bandera legacy. El cierre
debe **excluir cualquier puesto con un slot activo asignado** del bloque de faltas
diferidas (no solo cuando `falta_employee_id` coincide con el ocupante: hay datos viejos
donde ya no coincide). Los puestos SIMPLES (sin slots) sí conservan la bandera legacy
(falta diaria mientras dure la ausencia — útil para Art. 77).

**Why:** el cierre es el ÚNICO punto donde se materializan TODAS las faltas diferidas,
sin importar cómo se puso la bandera (`/operaciones/registrar-falta` ignora el flag
`es_24x24` del body y la pone igual; también la pone el rechazo de anulación). Guardar el
cierre cubre todos los orígenes de la bandera en un solo lugar.

**How to apply:** el filtro va en el WHERE de la consulta `puestosFaltando` en
`routes/operaciones/cierre.ts` con `NOT EXISTS (SELECT 1 FROM puesto_slots ps WHERE
ps.puesto_id=po.id AND ps.activo=TRUE AND ps.empleado_id IS NOT NULL)`. Pendiente/follow-up:
alinear `registrar-falta` para que no ponga la bandera en puestos 24x24 (riesgo de doble
falta si además se cubre con relevo — evaluar con cuidado por impacto en nómina).
