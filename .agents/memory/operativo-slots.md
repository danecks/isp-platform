---
name: Operativo en vivo y modelo de slots
description: Cómo el portal/admin determinan quién cubre un puesto hoy; modelo puesto_slots vs. legacy agente_id y la fórmula de día de ciclo.
---

# Operativo en vivo, puestos y slots

## Regla: la cobertura de puestos vive en `puesto_slots`, no en `agente_id`
El modelo actual de turnos es `puesto_slots` (varios slots por puesto, cada uno con
`empleado_id`, `horas_turno`, `dias_trabajo`, `longitud_ciclo`, `fecha_inicio_ciclo`).
Un puesto puede tener 2 agentes el mismo día (ej. uno de 12h y uno de 24h con
`dias_trabajo` complementarios que alternan por día de ciclo).

**Why:** Los campos viejos `puestos_operativos.agente_id` / `titular_employee_id`
quedaron obsoletos cuando los clientes pasaron al modelo de slots. Cualquier vista
que solo lea esos campos mostrará "Sin agente asignado" aunque el agente sí esté
asignado en su slot. Es exactamente la brecha que tenía `/portal/operativo/puestos`.

**How to apply:** Toda lectura de "quién cubre el puesto" (portal o admin) debe
partir de `puesto_slots` con empleado asignado, y dejar `agente_id` solo como
fallback legacy para puestos sin slots.

## Fórmula canónica "¿trabaja hoy?" — usar módulo NORMALIZADO a positivo
```
dia_en_ciclo = ((((fecha - fecha_inicio_ciclo) % longitud_ciclo) + longitud_ciclo) % longitud_ciclo) + 1
trabaja_hoy  = dia_en_ciclo = ANY(dias_trabajo)
```
**Why:** El `%` de Postgres puede dar negativo si `fecha < fecha_inicio_ciclo`,
produciendo un día de ciclo erróneo. El tablero admin (`operaciones/tablero.ts`,
`calcTrabajaPorSlot`) normaliza a positivo; la query `disponibles-cobertura` en
`puesto-slots.ts` NO normaliza (solo correcta para fechas >= inicio). Replicar la
versión robusta evita inconsistencias con el admin.

**How to apply:** Al escribir SQL de día de ciclo para slots, copiar la versión
normalizada (doble módulo). Si `fecha_inicio_ciclo IS NULL`, el fallback usado en
el portal es `EXTRACT(ISODOW) = ANY(dias_trabajo)` (igual que disponibles-cobertura).

## Trampa UI: DroppablePuesto.tsx tiene DOS bloques de render independientes
El puesto par 24x24 se renderiza en su PROPIO bloque (early return) y el puesto de
un solo titular en otro. Toda acción/botón (Anular falta, Reactivar, Registrar
falta, etc.) que se agregue a un bloque DEBE espejarse en el otro o silenciosamente
no aparecerá para ese tipo de puesto. Ya mordió: "Anular falta" existía solo en el
bloque de un titular y no salía en puestos 24x24 aunque el tablero marcaba
`titular_faltando=true` para ambos. Mismo gating en ambos
(`titular_faltando` / `falta_anulada_reactivable`, `!es_custodia`).

## Datos relevantes
- Cliente 77 = "TEMPLO MORMONA MIRAFLORES" (proyecto activo del portal demo).
- Prod es READ-ONLY (executeSql production solo SELECT); validar fórmulas ahí.
