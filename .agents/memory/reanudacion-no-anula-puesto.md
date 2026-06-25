---
name: Reanudación no debe anular puesto_id
description: Por qué un re-escaneo de puesto fijo no debe migrarse a custodia (borraba puesto_id y sacaba al agente de "en servicio").
---

En `POST /agente/iniciar-turno`, la rama de "reanudación como custodia" (único
`UPDATE agente_fichajes SET puesto_id = NULL`) solo debe aplicar si el agente es
realmente custodia hoy (`custodiaHoy` por titular o asignación diaria) **o** si el
fichaje abierto YA era de custodia (`puesto_id IS NULL`).

**Why:** `aplicaCustodia = targetClienteId !== null` con `targetClienteId` cayendo
a `fichaje.cliente_id` hacía que CUALQUIER re-escaneo de un puesto fijo (cliente_id
seteado) se tratara como custodia y borrara su `puesto_id`. Eso lo sacaba de todas
las listas de "en servicio" que filtran por `puesto_id` (portal-operativo y el
kiosco `/agente/turnos-activos-del-puesto`). Caso real: agentes del Templo Mormona
Miraflores aparecían/desaparecían; los fichajes quedaban con columna `puesto_id`
NULL pero `observaciones='puesto_id=XXX'` (prueba de que un UPDATE anuló la columna
tras el insert, porque la reanudación no reescribe observaciones).

**How to apply:** gate `aplicaCustodia = (custodiaHoy != null || fichaje.puesto_id == null) && targetClienteId !== null`.
Un puesto fijo re-escaneado cae al `else` (409 ya_iniciado) sin tocar `puesto_id`.
Para diagnosticar este patrón: `puesto_id` NULL + obs `puesto_id=N` = la columna se
anuló post-insert (solo lo hace esa rama). Reparación de datos histórica opcional:
restaurar `puesto_id` desde `observaciones` en fichajes mal anulados (los abiertos
son los que importan; un re-escaneo limpio ya los recrea).
