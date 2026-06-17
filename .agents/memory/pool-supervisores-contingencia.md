---
name: Supervisores/jefes como cobertura (P5)
description: Por qué supervisores y jefes no aparecían para cubrir puestos y cómo habilitarlos.
---

# Supervisores/jefes de servicio como cobertura de contingencia

El endpoint del pool operativo devuelve a los supervisores y jefes de servicio
en listas **separadas** (`supervisores`, `jefes_servicio`), NO dentro de
`disponibles`/`descansandoCiclo` (esas solo traen guardias/custodios, filtrados
por tipo_personal en el backend).

**Trampa:** cualquier lógica de selección de candidatos que solo recorra
`disponibles`/`descansandoCiclo` dejará el grupo P5 ("Contingencia operativa")
vacío y será imposible asignar un supervisor a un puesto. El ranking debe
inyectar explícitamente esas listas aparte como candidatos P5.

**Why:** operativamente los supervisores/jefes a veces cubren una falta o un
puesto descubierto; la UI ya tenía el grupo P5 con su confirmación ("cobertura
temporal, sin cambiar titularidad") pero nunca recibía los datos.

**How to apply:** al construir candidatos para cubrir un puesto, suma
`pool.supervisores`/`pool.jefes_servicio` como P5 (filtrar `faltando` y
`estado_laboral!=='activo'`; para supervisores respetar `puede_cubrir`). El
backend ya clasifica la asignación de un supervisor como
`tipo_cobertura='cobertura_supervisor'` (no cambia titularidad). El modal
rankeado requiere puesto con zona; los puestos sin zona caen al selector
estándar (que tampoco incluye contingencia) — gap preexistente a considerar si
reaparece el síntoma.
