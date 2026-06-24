---
name: HE en efectivo pareada con la falta del titular
description: Enlace durable evento_falta_id entre pago de HE en efectivo (incentivos + externos) y la falta del titular; late-link y semántica de anular.
---

El pago de HE en efectivo (incentivos_cash_cobertura, tipo='he_efectivo') se enlaza
de forma DURABLE a la falta del titular vía columna `evento_falta_id` → eventos_rrhh(falta).

**Por qué:** antes solo la HE de planilla quedaba pareada con la falta (vía
eventos_rrhh.evento_par_id). El efectivo (colaborador + agente externo) no tenía rastro
de a quién cubría. El pago casi siempre ocurre ANTES de que la falta se materialice
(la falta del titular está diferida al cierre del día), así que el enlace no se puede
resolver al momento del pago.

**Cómo se llena (dos momentos):**
- Al crear el pago: `resolverFaltaEvento` (read-only, por puesto_nombre+cliente+fecha,
  estado NOT IN anulado/cancelado). Normalmente devuelve null porque la falta aún no existe.
- Al crear/materializar la falta: `enlazarPagosCashAFalta` (backfill idempotente, solo
  rellena `evento_falta_id IS NULL`). Se llama en cierre.ts (falta diferida), /liberar y
  custodias-asignacion.ts. Match INCLUSIVO: por puesto_id O por puesto_nombre+cliente
  (un mismo puesto tiene pagos con puesto_id —guardia— y sin —custodia/externo—).

**Reporte (GET /rrhh/horas-extra-cash):** resuelve titular (id+nombre), falta_evento_id,
falta_estado y `amonestado` (EXISTS eventos_rrhh con evento_par_id=falta.id y tipo IN
amonestacion/acta_administrativa/suspension, no anulado). Filas nov-: titular vía
er.evento_par_id. Filas inc-: titular vía evento_falta_id con FALLBACK por puesto+fecha
si el pago se hizo antes del enlace. SIEMPRE filtrar falta por estado NOT IN
('anulado','cancelado') para no resolver titulares de faltas muertas.

**Anular — dos rutas con semántica de enlace distinta (a propósito):**
- Slot-based `/operaciones/anular-falta` (+ `reactivar-falta`): NO toca evento_falta_id;
  reactivar restaura el MISMO evento, así que mantener el enlace lo re-resuelve solo.
- `/rrhh/eventos/:id/anular` (falta): SÍ limpia evento_falta_id=NULL (no hay reactivación
  del mismo evento; soltar el enlace deja el pago listo para re-enlazarse a una futura
  falta nueva del mismo puesto+fecha).
- Anular el pago (inc-: estado='cancelado'; nov-: revierte horas_extra_estado) lo saca del
  reporte por el filtro de estado. El display correcto se garantiza por el filtro de estado
  en AMBOS lados, no por limpiar punteros.

Fuera de alcance de este pareo: tarifas/montos, qué genera amonestación, doble-pago.
