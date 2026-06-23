---
name: Armas — custodia manual y munición por puesto
description: Gotchas del módulo de armería (ON CONFLICT con índice parcial, custodia abierta no única, fallback de cierre)
---

## ON CONFLICT con índice parcial (no constraint)
`agente-fichaje.ts` POST /municion-puestos usaba `ON CONFLICT ON CONSTRAINT pm_puesto_activo`, pero `pm_puesto_activo` es un ÍNDICE PARCIAL único, no una constraint nombrada → la cláusula siempre falla en runtime (en prod la munición nunca se guardó, tabla en 0).
**Regla:** para upsert contra un índice parcial único hay que usar `ON CONFLICT (puesto_id) WHERE activo = TRUE`, nunca `ON CONSTRAINT <nombre_del_indice>`.
**How to apply:** cualquier upsert nuevo en armería/munición debe espejar el predicado del índice parcial en la cláusula WHERE del ON CONFLICT. El GET correspondiente debe filtrar `activo = TRUE` para no listar eliminados.

## Custodia abierta no tiene unique constraint
`arma_custodia` solo tiene un índice `ac_activa`; NO hay unique parcial de "una abierta por arma". Dos requests concurrentes pueden insertar dos custodias abiertas.
**Regla:** el endpoint de asignación manual (`POST /api/armas/:id/asignar-responsable`) serializa con `SELECT ... FROM armas WHERE id=$1 FOR UPDATE` dentro de la transacción, hace guard de no-op (si la abierta ya es del mismo empleado, COMMIT sin cerrar+reabrir → no fragmenta historial), y valida `employee_id` numérico estricto (un string basura debe dar 400, no degradar a "quitar responsable"). employee_id null/"" = quitar (cierra la abierta).

## Cierre transfiere custodia: snapshot vs resolvedor
`cierre-sync.ts` (sincronizarCustodiasAlCierre) usa `snapshotPuestos.agente_id` (cobertura_segmentos/legacy). Puestos cubiertos por TITULAR sin segmento quedaban "sin agente" y el arma no transfería.
**Regla:** cuando el snapshot no da agente para un puesto, hacer fallback a `calcularResponsablePuesto(puesto_id, fecha)` (que sí lee puesto_slots). Es el mismo resolvedor que usa el operativo en vivo.

## Dato de negocio (preview/prod, jun 2026)
Existían ~26 armas activas ligadas a puestos INACTIVOS (datos viejos) sin custodia abierta ni titular: se resuelven con el botón de responsable manual o desligando el arma; no se sanan solas al cierre porque el puesto está inactivo.
