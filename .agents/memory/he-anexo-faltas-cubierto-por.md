---
name: "Cubierto por" en anexo de Faltas/Suspensiones de pre-planilla
description: Cómo mostrar QUIÉN cubrió una falta (la persona que hizo HE) cuando la novedad de la falta no lo guarda.
---

En el anexo de Faltas/Suspensiones de pre-planilla, cada fila de falta/suspensión
debe mostrar QUIÉN la cubrió (la persona que hizo horas extra ese día). Si hubo HE,
hubo cobertura; la columna antes mostraba el puesto cubierto (siempre vacío para el
ausente) → ahora muestra la persona.

**Regla:** la novedad de la falta NO guarda al cubridor. Se enlaza buscando, el MISMO
día, otra novedad con `puesto_cubierto_id` (horas_extra>0, empleado distinto) sobre el
puesto donde el ausente es titular. El puesto del ausente se toma de
`n.puesto_titular_id` si la novedad lo guardó; si es NULL (típico en
`fuente='sustitucion_pizarron'`), se enlaza contra CUALQUIER puesto donde el ausente
sea titular activo en `puesto_slots` (no elegir un slot arbitrario con LIMIT 1).

**Why:** la titularidad vive en `puesto_slots` y la relación falta↔cobertura no está
materializada; resolverla por el puesto + fecha es la única señal disponible. Elegir un
slot arbitrario podía atribuir un cubridor incorrecto si el ausente tuviera varios slots.
**How to apply:** es de SOLO LECTURA (endpoint del anexo), no toca generación ni pago.
Desempate determinista cuando hay varias coberturas del mismo puesto/día:
`ORDER BY horas_extra DESC, nombre LIMIT 1` (heurística: se muestra el de mayor HE; las
co-coberturas múltiples no se listan todas). Misma idea aplica al titular del anexo de HE
(ver he-anexo-titular-slots).
