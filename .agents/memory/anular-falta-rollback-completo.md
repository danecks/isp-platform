---
name: Anular falta = rollback completo
description: Qué debe revertir anular-falta y cómo restaurar simétricamente
---

# Anular falta debe revertir TODO lo que la falta produjo

Anular una falta del pizarrón no basta con tocar el slot + el evento RRHH + su HE
par. Debe revertir, dentro de la MISMA transacción:

1. **Novedad del titular**: `falta=FALSE, suspension=FALSE, descuento_dia=FALSE,
   dias_descuento=0, impacto_nomina='pendiente'` — guardado contra
   `impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh','pagado_efectivo')` (no pisar
   decisiones de RRHH ni lo ya pagado).
2. **`cobertura_segmentos.genera_horas_extra = FALSE`** del puesto+fecha.
   **Why (clave):** si se deja en TRUE, el cierre del día (loop sobre
   `genera_horas_extra=TRUE`) REGENERA una HE nueva (el dedupe excluye `anulado`), y
   queda la HE anulada + la nueva → **HE duplicada**. Esta era la causa real de la
   duplicación reportada tras anular.
3. **Segmento `ausencia_sin_cubrir`** del puesto+fecha: borrarlo guardando la fila
   completa para re-insertar.
4. **`rrhh_alertas`** (`faltante_sin_cubrir`, `horas_extra_pendiente`) del
   puesto+fecha → `estado='resuelta'`.

Todo el estado previo se guarda en `metadata_json` del evento `anulacion_falta`.

**Restauración simétrica:** helper exportado `restaurarRollbackFalta(db, meta)` en
`operaciones/anular-falta.ts`, invocado por `reactivar-falta` y por el rechazo de
`anulacion_falta` en `eventos-rrhh.ts` (PATCH estado='rechazado'). Re-inserta la
ausencia con `WHERE NOT EXISTS` (el UNIQUE(fecha,puesto_id,employee_id) NO dedup con
`employee_id NULL`).

**How to apply:** cualquier cambio a lo que crea una falta (descuento, segmentos,
alertas) debe reflejarse en el rollback Y en la restauración, o quedan inconsistentes.
`eventos-rrhh.ts` importa de `operaciones/anular-falta.ts` (sin ciclo recíproco).
