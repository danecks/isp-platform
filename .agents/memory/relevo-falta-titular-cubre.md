---
name: Relevo falta titular que cubre en otro lado
description: Cuándo NO generar falta/amonestación del titular al relevar su slot
---

# No generar falta del titular si cubre en otro lado / SSA

En el POST `/cobertura/segmentos` (bloque "RELEVO POR FALTA DEL TITULAR" de
`cobertura.ts`), antes de crear la falta + descuento del titular hay que verificar
si ese titular HOY está trabajando en otro lado. Si lo está → omitir falta y
descuento (no puede estar en dos lugares; sigue trabajando, no es falta).

**Qué cuenta como "cubre en otro lado":**
- `cobertura_segmentos` del titular en OTRO puesto ese día, EXCLUYENDO
  `tipo_cobertura = 'ausencia_sin_cubrir'` (una ausencia NO es cobertura; si no se
  excluye, marca falso positivo y se saltan faltas válidas).
- `custodia_asignacion_diaria` del titular ese día.
- SSA activo: `ssa_agentes`+`solicitudes_servicio_adicional` (multi-agente) y
  `solicitudes_servicio_adicional.agente_id` (agente único).

**Why:** caso real (titular APS cubriendo otro condado, su slot relevado por otro)
generaba amonestación y descuento indebidos. Espeja `cubriendoOtroLadoMap` + `ssaMap`
de `tablero.ts`, pero a diferencia del tablero hay que EXCLUIR `ausencia_sin_cubrir`
porque aquí se pregunta "¿está trabajando?", no "¿dónde aparece?".

**How to apply:** la verificación va antes de la condición que inserta la falta del
titular; añadir `&& !titularCubreOtroLado` a esa condición. No bloqueante (try/catch
que en error deja `false` = comportamiento previo).
