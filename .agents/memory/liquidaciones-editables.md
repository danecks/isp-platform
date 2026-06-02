---
name: Liquidaciones editables y permisos finos por sub-ruta
description: Por qué un módulo de permiso nuevo bajo /prestaciones se valida dentro del handler y no en el middleware; cómo se conserva el monto original y se recalculan totales.
---

# Permiso fino dentro del handler (no en el middleware)

El `permisosMiddleware` mapea cada ruta a UN módulo por **prefijo más largo**
(longest-prefix sobre `ROUTE_MODULO_MAP`). Como `/prestaciones/*` mapea a
`"prestaciones"`, cualquier sub-permiso más específico (ej. `editar_liquidacion`
para editar montos de una liquidación guardada) **no puede** gatearse desde el
middleware de ruta.

**Regla:** un módulo de permiso nuevo que vive bajo un prefijo ya catalogado se
valida DENTRO del handler: parsear `x-isp-session`, y si hay `username` resolver
con `getPermisosForUsername` (`rol==="admin" || modulos.has("*") || modulos.has(clave)`);
si no hay username, fallback solo a `session.rol === "admin"`. Esto replica el
patrón del propio middleware (ramas username vs. fallback) — no endurecer una sola
ruta de forma inconsistente.

**Why:** el middleware solo asigna un módulo por ruta; añadir el sub-permiso al
catálogo (SYSTEM_MODULOS) lo hace asignable en la UI de roles, pero el enforcement
fino debe ser explícito en el endpoint.

# Edición de montos de liquidación guardada

- Solo estados `confirmada`/`activa`. Transacción con `SELECT ... FOR UPDATE`.
- `monto_original` se conserva solo la 1ª vez con `COALESCE(monto_original, monto_actual)`.
- Cada cambio se audita en `prestaciones_liquidacion_ediciones` (rubro, anterior, nuevo, motivo, quién, cuándo).
- Totales del encabezado se **recalculan desde el detalle**: los 5 rubros conocidos
  (salario_pendiente, vacaciones, aguinaldo, bono14, indemnizacion) mapean a sus
  `total_*`; cualquier rubro fuera de esos 5 suma a `total_otros`; `total_general` = suma de todo.
- Rubros de liquidación son montos a favor (≥0): la edición bloquea negativos (`min=0`).
