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
  'falta' del employee+fecha (estado='anulado', estado_anterior) + cascada al HE
  par (`evento_par_id`) + crea `anulacion_falta` pendiente con snapshot en
  metadata_json.
- Reactivar falta (POST /operaciones/reactivar-falta): inverso desde el snapshot —
  slot→'faltando', reactiva evento+HE a su `estado_anterior`, marca el
  `anulacion_falta` como `'revertido'` (para que deje de ofrecerse Reactivar).
- El RECHAZO de RRHH de un `anulacion_falta` (eventos-rrhh.ts PATCH estado) también
  debe reponer evento+HE desde el snapshot, no solo el slot.
- tablero.ts ofrece el botón vía `falta_anulada_reactivable=true` cuando hay un
  `anulacion_falta` estado='pendiente_aprobacion' para ese puesto
  (`metadata_json->>'puesto_id'`) y fecha.

**Trampa del HE par (bug que ya mordió):** al anular, guardar `par_id` en el
snapshot SOLO si esta operación realmente anuló el par (es decir, el par no estaba
ya anulado). Si el par ya venía anulado de antes y lo registras igual, al
reactivar/rechazar lo "revives" por error. Guardar `par_id=null` cuando
`par_estado_anterior` es null.
