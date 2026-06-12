---
name: Anular/Reactivar falta — dos fuentes
description: El pizarrón decide "faltando" leyendo DOS fuentes; anular y reactivar deben tocar ambas, y reglas del snapshot para el HE par.
---

# Anular / Reactivar falta debe tocar las DOS fuentes

El pizarrón (tablero.ts) decide si un agente está "faltando" leyendo un UNION de
**dos** fuentes:
1. `puestos_operativos.estado_operativo_puesto = 'faltando'` (la marca del día).
2. `eventos_rrhh` con `tipo_evento='falta'` y `estado NOT IN ('anulado','cancelado')`.

**Regla:** cualquier acción que cambie el estado de falta de un agente debe tocar
AMBAS fuentes o el pizarrón se contradice.

**Por qué:** en día abierto el flujo legacy solo marca el slot (el evento de falta
se difiere al cierre). Pero al CERRAR se genera el evento en `eventos_rrhh`, y al
REABRIR ese evento NO se borra. Si "Anular" solo limpia el slot, en día reabierto
el agente sigue saliendo faltando porque el evento de RRHH sigue vivo.

**How to apply:**
- Anular falta (anular-falta.ts): limpia el slot + anula el evento `eventos_rrhh`
  'falta' del employee+fecha (estado='anulado', estado_anterior) + cascada a TODAS
  las HE par + crea `anulacion_falta` pendiente con snapshot en metadata_json.
- Reactivar falta (POST /operaciones/reactivar-falta): inverso desde el snapshot —
  slot→'faltando', reactiva evento+HE a su `estado_anterior`, marca el
  `anulacion_falta` como `'revertido'` (para que deje de ofrecerse Reactivar).
- El RECHAZO de RRHH de un `anulacion_falta` (eventos-rrhh.ts PATCH estado) también
  debe reponer evento+HE desde el snapshot, no solo el slot.
- TERCERA ruta (la que mordió): el anular genérico de eventos RRHH también debe
  limpiar la bandera del puesto, no solo el flujo /operaciones/anular-falta. Antes
  solo anulaba el evento+HE y dejaba el puesto pegado en 'faltando'.
  OJO durable: la bandera del puesto NO tiene fecha → una falta vieja anulada deja
  el puesto "descubierto" en TODOS los días futuros del titular, no solo el día de
  la falta. Por eso toda anulación de falta debe resetear el puesto del empleado.
- tablero.ts ofrece el botón vía `falta_anulada_reactivable=true` cuando hay un
  `anulacion_falta` estado='pendiente_aprobacion' para ese puesto
  (`metadata_json->>'puesto_id'`) y fecha.

**Relación 1 falta : N HE (no 1:1).** Una falta puede tener VARIAS HE (relevo
partido, o varias coberturas del puesto/día). El enlace es cada `HE.evento_par_id =
falta.id`; por back-compat la falta apunta a la PRIMERA HE (`COALESCE`). Para
seleccionar todas las HE de una falta: `WHERE tipo_evento='horas_extra' AND
(evento_par_id = falta.id OR id = falta.evento_par_id)`. Anular/reactivar/rechazar
deben operar sobre el CONJUNTO, no sobre un par único, o quedan HE huérfanas.

**Snapshot de reactivación:** se guarda `pares: [{id, estado_anterior}]` (solo las
que ESTA operación anuló). Los lectores (reactivar-falta y el rechazo de RRHH en
eventos-rrhh.ts) aceptan `pares[]` y hacen fallback a `par_id`/`par_estado_anterior`
de snapshots viejos.

**Trampa del HE par (bug que ya mordió):** al anular, registrar en el snapshot SOLO
las HE que esta operación realmente anuló (las que no estaban ya anuladas). Si
incluyes una que ya venía anulada de antes, al reactivar/rechazar la "revives" por
error.

**Quién crea las HE par:** `/sustituir` crea falta+HE juntas en el acto
(`genera_horas_extra=FALSE` en esa ruta). `/asignar` registra la cobertura con
`genera_horas_extra` correcto pero NO crea el evento HE — ese hueco lo llena el
CIERRE (cierre.ts), que por cada falta diferida busca `cobertura_segmentos` del
puesto+fecha con `genera_horas_extra=TRUE` y crea/enlaza la HE (dedupe por
employee+fecha+puesto+cliente).
