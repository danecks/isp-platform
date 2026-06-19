---
name: Botón Agente externo en puestos fijos
description: Por qué el botón de cobertura externa debe mostrarse en fijos no cubiertos aunque el titular descanse por ciclo.
---

El botón "Agente externo" del pizarrón operativo debe aparecer en CUALQUIER puesto no cubierto, incluyendo un fijo cuyo titular descansa hoy por ciclo (descanso_por_ciclo=true → tarjeta indigo "Descanso de turno"): ese puesto queda vacío y el operador necesita poder cubrirlo.

**Regla:** la condición del botón en fijos es `onAgenteExterno && !cubierto` (NO `&& !descansoCiclo`). Se alinea con la rama 24x24 (`activoSinCob`) y con custodias (que nunca cierran por descanso normal, solo por descansoExcedente).

**Why:** el director reportó "falta el botón en fijos descubiertos"; la causa era el gate `!descansoCiclo` que lo escondía en días de descanso del titular, mientras custodias sí lo mostraban → inconsistencia. Para un fijo single-titular, descanso_por_ciclo=true implica que nadie trabaja hoy, así que el puesto realmente necesita cobertura.

**How to apply:** vive en DroppablePuesto.tsx (ruta regular/fijo). El backend de cobertura externa es la fuente de verdad (upsert idempotente, rechaza ya-cubierto); el gate del front es solo conveniencia. Un fijo cubierto por el titular tiene estado='cubierto' → `cubierto=true` → botón sigue oculto, sin efecto colateral.

**Nota de despliegue:** los tres botones (custodia CustodiaSlotItem, 24x24 y fijo en DroppablePuesto) se agregaron en el MISMO commit; si en prod se ve uno, los tres están desplegados. Si el director ve un botón pero no otro, sospechar caché del navegador (hard refresh) antes que un gap de deploy.
