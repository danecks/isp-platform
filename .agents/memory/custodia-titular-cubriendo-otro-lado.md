---
name: Custodia titular cubriendo en otro lado → origen descubierto
description: Regla derivada del pizarrón admin para marcar descubierto el slot de un custodio titular que hoy cubre en otra parte
---

En el pizarrón admin (tablero.ts, sección custodias), un custodio TITULAR de una
custodia que HOY está cubriendo en otro lado deja su slot de ORIGEN en estado
`descubierto` de forma automática.

**Regla:** el titular se considera "cubriendo en otro lado" si su employee_id
aparece ese día en `custodia_asignacion_diaria` (otra custodia) o en
`cobertura_segmentos` (un puesto guardia). Se precomputa una vez un
`cubriendoOtroLadoMap` (employee_id → nombre del cliente/puesto destino) y en el
loop de slots se bloquea la rama "cubierto por titular por defecto"
(`else if titular && !titularFaltando && !enDescansoExcedente && !titularCubriendoOtro`).
Se exponen flags `titular_cubriendo_otro` / `titular_cubriendo_donde`; el frontend
(CustodiaSlotItem.tsx) los pinta "Descubierto — Titular cubriendo en X".

**Why:** decisión explícita del director ("que lo deje descubierto
automáticamente"). Es puramente derivado: NO se registra falta ni descuento (el
titular sigue trabajando, solo en otra parte) y se auto-corrige si se quita la
cobertura del otro lado. Antes el slot de origen seguía viéndose "cubierto por
titular" porque `soloCobertura` no libera la titularidad de origen.

**How to apply:** no hay falso positivo cuando el titular SÍ está en su propio
slot, porque ese caso entra antes por la rama `if (asig && !asignadoFaltando)`
(asig es null en la rama titular). El portal de cliente (portal-operativo) NO
necesita cambio: ya marca "faltante" a cualquier titular ausente de la asignación
diaria del cliente. Si en el futuro se quiere lo mismo para puestos guardia de
origen, la lógica es simétrica pero hoy está acotada a custodias.
