---
name: Historial de puestos cubiertos usa dos fuentes
description: El "Historial → Puestos cubiertos" del detalle de pre-planilla debe unir cobertura_segmentos con novedades_nomina_diarias, o se pierden coberturas.
---

# Historial de puestos cubiertos (detalle de pre-planilla)

**Síntoma:** en pre-planilla, el detalle de un colaborador (pestaña "Historial",
sección "Puestos cubiertos en el período") no mostraba puestos que el agente sí
cubrió, aunque esas mismas coberturas sí aparecían en el "Anexo Coberturas".

**Causa:** dos fuentes distintas para "cobertura":
- `cobertura_segmentos` — tabla del pizarrón, fuente rica (tramos, hora_inicio/fin,
  cobertura parcial), pero **poblada parcialmente**.
- `novedades_nomina_diarias` (`puesto_cubierto_id`/`puesto_cubierto_nombre`/
  `descanso_trabajado`) — la fuente que usa el Anexo Coberturas y la nómina.
El historial leía SOLO de `cobertura_segmentos`, así que las coberturas que solo
quedaron en novedades (relevos/descansos no segmentados) salían vacías.

**Regla:** el historial debe **unir ambas** (UNION ALL): segmentos + coberturas de
novedades de días/puestos SIN segmento. Dedupe por `employee_id + fecha +
puesto_id IS NOT DISTINCT FROM puesto_cubierto_id` (a nivel **puesto**, no día
completo: un día puede tener un segmento de un puesto y otra cobertura de otro
puesto solo en novedades; el dedupe por día las ocultaría). Validado: dedupe por
puesto no introduce duplicados.

**Why:** la fuente operativa (segmentos) y la fuente de nómina (novedades) no
coinciden 1:1; cualquier vista de "qué cubrió esta persona" que lea una sola
quedará incompleta. El Anexo lee novedades, así que el detalle debe incluirlas
para ser consistente.

**How to apply:** la rama de novedades sintetiza los campos que espera el
frontend (DetalleModal): `hora_inicio/hora_fin = NULL::varchar`,
`horas_calculadas = horas_trabajadas`, `genera_horas_extra = horas_extra>0`,
`tipo_cobertura` derivado (relevo/descanso_trabajado/cobertura), `cliente_nombre`
por subconsulta (puesto cubierto → fallback al puesto titular del agente).
