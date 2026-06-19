---
name: Activar IGSS a todos (autorización y null-safe)
description: Reglas de la acción masiva "Activar IGSS a todos" del módulo IGSS; cómo autorizar admin y por qué el WHERE debe ser null-safe.
---

# Acción masiva "Activar IGSS a todos"

Acción de un solo uso (panel en el módulo IGSS): deja afectos a IGSS a todos los
colaboradores activos y activa la cobertura IGSS en todos los puestos activos, para
que el descuento salga en planilla. El director luego quita manualmente los que no
aplican desde la ficha de cada colaborador.

## Regla de IGSS efectivo
El IGSS solo se descuenta si se cumplen las TRES: `aplica_igss_general=TRUE` AND
`estado_igss='activo'` AND (`puesto.aplica_igss` OR `cliente.igss_aplica`). Por eso
la acción toca AMBOS lados: el afecto del trabajador (employees) y la cobertura del
puesto (puestos_operativos).

## Autorización admin: NO confiar en el rol del header
**Regla:** para acciones administrativas sensibles, resolver el rol REAL por
`username` contra la BD con `getPermisosForUsername(username).rol`, nunca leer
`session.rol` del header `x-isp-session`.
**Why:** el middleware de permisos valida acceso al módulo por username contra BD
pero NO reescribe `session.rol`; un usuario no-admin con acceso al módulo podría
enviar `rol:"admin"` en el header y pasar un check ingenuo. Mismo patrón ya usado
en anticipos extraordinarios.
**How to apply:** parsear username del header, `getPermisosForUsername(username)`,
exigir `rol==='admin'`; cualquier otra cosa → 403.

## WHERE null-safe al filtrar "ya afecto"
**Regla:** al excluir filas ya afectas usar COALESCE:
`NOT (COALESCE(aplica_igss_general,FALSE)=TRUE AND COALESCE(estado_igss,'')='activo')`.
**Why:** con lógica tri-valuada de SQL, si `aplica_igss_general` o `estado_igss` son
NULL (común en legado), `NOT(NULL AND ...)` evalúa NULL → la fila NO se actualiza y
"activar a todos" deja fuera precisamente a los que más lo necesitan.
