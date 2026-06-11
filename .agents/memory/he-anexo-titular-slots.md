---
name: Titular (persona) en anexo HE de pre-planilla
description: En un relevo, "Titular" debe ser la PERSONA relevada en el puesto cubierto, no un nombre de puesto.
---

En el anexo de Horas Extra de pre-planilla, la columna "Titular" de una fila de
relevo debe mostrar el NOMBRE DE LA PERSONA a quien se relevó en el puesto CUBIERTO
ese día, no el nombre del puesto ni el puesto propio (home) del agente que cubrió.

**Regla:** el titular relevado = el titular que estaba de turno en el puesto cubierto
ese día. Como cada puesto 24x24 tiene 2 titulares en `puesto_slots`, hay que elegir el
slot de turno con la fórmula de ciclo del operativo:
`cycleDay = ((fecha - fecha_inicio_ciclo) % lc + lc) % lc + 1`, y trabaja si
`cycleDay = ANY(dias_trabajo)` (lc = `COALESCE(NULLIF(longitud_ciclo,0),14)`).
La novedad de `sustitucion_pizarron` NO guarda al titular relevado (cobertura_diaria
queda vacía en ese flujo), por eso se deriva por ciclo, no se lee de un campo.

**Why:** la titularidad vive en el modelo de turnos (`puesto_slots`), no en los campos
legacy ni en la novedad; resolver "titular" por campos legacy o por el slot del propio
agente que cubrió da blanco o un nombre de puesto, no la persona relevada (el director
lo rechazó explícitamente).
**How to apply:** solo para relevos (`puesto_cubierto_id` presente y distinto del titular).
Excluir al agente que cubre (`empleado_id <> employee_id`) y desempatar con
`ORDER BY slot_numero LIMIT 1` (determinismo). Es de SOLO LECTURA: no regenera novedades
ni toca pago. Si `fecha_inicio_ciclo` es NULL no hay match y "Titular" queda vacío.
