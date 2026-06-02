---
name: Visibilidad de SSA en el tablero/pizarrón operativo
description: Por qué el tablero de solicitudes SSA usa fecha <= CURRENT_DATE en vez de BETWEEN fecha AND fecha_fin.
---

El `GET /solicitudes-servicio/tablero` filtra por `s.fecha <= CURRENT_DATE`, NO por
`CURRENT_DATE BETWEEN s.fecha AND s.fecha_fin`.

**Why:** Decisión del director: una SSA activada debe seguir visible en el pizarrón
mientras la solicitud siga abierta, aunque su `fecha_fin` ya haya pasado. El cierre
sale por estado (cancelada / cerrada explícita), no por vencimiento de fecha.

**How to apply:** No "corrijas" esto de vuelta a un rango BETWEEN aunque parezca un
bug de fechas — quitaría del tablero las SSA vencidas pero todavía abiertas, que es
justo lo que el director quiere ver. El control de salida del tablero es el estado,
no la fecha.

Relacionado: la sección "Por activar" del PanelSSA muestra solicitudes en_revision
sin tarjeta_activa; `PATCH /solicitudes-servicio/:id/activar` setea tarjeta_activa=TRUE.
