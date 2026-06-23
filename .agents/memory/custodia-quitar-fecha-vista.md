---
name: Quitar custodio en el pizarrón
description: Por qué el botón "Quitar" de custodias debe operar sobre la fecha vista y sobre asignaciones diarias, no solo titulares.
---

# Botón "Quitar" de custodias en el pizarrón

El botón "Quitar" de una tarjeta de CUSTODIA (no de puesto) debe poder remover a la persona
que se ve en ese slot **para la fecha que se está viendo**, sea titular permanente o solo
asignación diaria (cobertura o asignación errónea).

**Regla:**
- Si la persona es titular activo → desactivar titularidad permanente Y borrar la asignación
  diaria de la fecha vista.
- Si la persona solo tiene asignación diaria (no es titular) → borrar solo esa fila diaria de
  la fecha vista. NO devolver al pool (EOA→disponible): eso solo aplica a remoción de
  titularidad permanente, para no alterar el estado operativo de HOY al corregir un día puntual.
- Si no es ni titular ni tiene asignación diaria esa fecha → 409 (nada que quitar).

**Why:** El bug original exigía titular activo (si no, 409 y no hacía nada) y borraba la
asignación diaria de `todayGT()` en vez de la fecha vista. Por eso un agente con solo una
asignación diaria en un día pasado reabierto seguía apareciendo aunque se diera "Quitar".
Cuando el slot no tiene titular real, el tablero deja `titular_employee_id = null` y la persona
mostrada queda solo en `agente_id`; por eso el frontend debe pasar `agente_id` al endpoint.

**How to apply:** El endpoint `quitar-titularidad-custodia` y el frontend
`confirmarQuitarTitular` deben enviar/usar `fecha = fechaVista` (mismo patrón que
`asignar-custodia`: `fecha || todayGT()` con `$N::date`). Mismo concepto vale para custodias
en cualquier corrección sobre día pasado: operar por fecha vista, no por hoy.

**Visibilidad del botón (clave):** el tablero arma el slot de custodia con
`titular_employee_id = titular?.employee_id ?? null`, así que cuando NO hay titular activo
(solo una asignación diaria) ese campo es null. Si el botón "Quitar" en `CustodiaSlotItem`
se condiciona solo a `tieneTitular`, NUNCA aparece para una asignación diaria suelta (el caso
del error). El botón debe mostrarse cuando hay titular fijo O un empleado real cubriendo
(`agente_id`, no externo), y pasar `titular_employee_id ?? agente_id` como employeeId.
