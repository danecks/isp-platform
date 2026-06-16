---
name: Custodias — falta vs asignación diaria, y ruta de agente externo
description: Por qué el pizarrón de custodias debe cruzar la falta contra la asignación diaria (no solo el titular), y cómo se captura la ruta de un agente externo.
---

# Custodia: boleta de falta debe ocultar al asignado

En el tablero de custodias, cada slot puede tener una fila en `custodia_asignacion_diaria` (el "asignado del día"). El cruce de faltas (`custodiaFaltaSet`, derivado de `eventos_rrhh` tipo falta de hoy) originalmente solo se comparaba contra el TITULAR fijo, no contra el asignado del día. El bloque `if (asig)` marcaba el slot como cubierto con prioridad, así que una boleta de falta quedaba sin efecto cuando la persona ya estaba en la asignación diaria (caso típico: el día se arma copiando al titular en su mismo slot).

**Regla:** un empleado (no externo) cuyo `employee_id` está en `custodiaFaltaSet` NO debe mostrarse presente. Se calcula `asignadoFaltando = !!asig && !asig.es_externo && custodiaFaltaSet.has(asig.employee_id)` y el slot solo se cubre con `if (asig && !asignadoFaltando)`.

**`titular_faltando` representa SOLO la ausencia del titular.** No mezclar con `asignadoFaltando`: si un RELEVO (distinto del titular) falta, el titular sigue disponible y etiquetarlo como faltante sería incorrecto. Cuando el asignado que falta ES el titular, `titularFaltando` ya queda true por sí mismo (mismo set, mismo employee_id), así que el caso real funciona sin el OR.

**Why:** el director reportó custodios con boleta de falta que seguían en el pizarrón; el diagnóstico (producción read-only) mostró titulares-asignados-a-sí-mismos con falta hoy.

**El reporte impreso es otra fuente.** El pizarrón y la "hoja imprimible" de custodias (GET `/custodias/cliente/:id/hoja-imprimible`) NO comparten consulta: arreglar el tablero no arregla el reporte. La hoja lee `custodia_asignacion_diaria JOIN employees` y debe aplicar el mismo cruce de faltas con `NOT EXISTS` sobre `eventos_rrhh` (tipo_evento='falta', fecha del día, estado NOT IN ('anulado','cancelado')) o seguirá imprimiendo al ausente. Regla general: cualquier salida (pizarrón, hoja, export) que liste custodios del día debe replicar el cruce de faltas.

# Ruta de agente externo (employee_id NULL)

Los agentes externos en custodia se identifican por `slot_numero`, no por `employee_id` (que es NULL en `custodia_asignacion_diaria`). Para capturar/editar su ruta del día:

- El botón "Ruta" del slot aparece con `(puesto.agente_id || esExterno)`, no solo con `agente_id`.
- Toda la cadena de ruta propaga `slotNumero` + `esExterno` (callback `onRegistrarRuta` con `employeeId: number | null`, modal, hook `GuardarRutaInput`).
- El PUT `/custodias/cliente/:id/ruta` usa `usarSlot = esExterno === true` (explícito, NO inferido por employeeId ausente, para evitar emparejamientos accidentales) y filtra por `slot_numero` en vez de `employee_id`.
- El GET `/custodias/cliente/:id/rutas` usa LEFT JOIN + `COALESCE(e.nombre_completo, cad.externo_nombre)` para incluir externos (antes el INNER JOIN los excluía y no se podía precargar su ruta).

**How to apply:** cualquier flujo nuevo que escriba/lea `custodia_asignacion_diaria` por persona debe contemplar la fila externa (employee_id NULL) y resolverla por slot.
