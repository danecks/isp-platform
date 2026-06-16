---
name: Cobertura por agente externo (anti doble-pago)
description: Cómo se cubre un puesto descubierto con persona fuera de planilla y por qué el pago de HE es idempotente por puesto/día.
---

# Cobertura por "Agente externo"

Un operador puede cubrir un puesto descubierto (guardias Y custodias) con una persona AJENA a la planilla: se captura nombre+DPI, la cobertura del día queda con `employee_id NULL` + `es_externo=TRUE`, y se paga su HE EN EFECTIVO por turno (12h→Q150, 24h→Q300) vía `incentivos_cash_cobertura` (tipo `he_efectivo`, `metodo_pago='efectivo'`, `employee_nombre`=nombre del externo) FUERA de la planilla legal. Endpoint único: `POST /operaciones/cubrir-externo` (rama custodia por cliente+slot; rama guardias por puesto).

**Opción A (decidida):** la cobertura externa NO auto-genera amonestación. La falta del titular conserva su alerta a RRHH; RRHH hace la económica/acta a mano.

## Regla anti doble-pago (clave de negocio, NO por DPI)
Un puesto/día solo puede tener UNA HE externa. El dedupe es por clave de negocio, **ignorando el DPI**:
- Guardias: `(fecha, puesto_id)`
- Custodia: `(fecha, cliente_id, puesto_nombre='Custodio N')` — la custodia no tiene `puesto_id` ni `slot_numero` en `incentivos_cash_cobertura`; el slot va codificado en `puesto_nombre`.

Mecánica: pre-check fuera de la tx bloquea (409) solo si ya existe un pago externo YA PROCESADO (`estado <> 'pendiente'`). Si está `'pendiente'`, dentro de la misma tx se hace DELETE de los pendientes de esa clave y luego INSERT (upsert idempotente). En guardias también se borra el `cobertura_segmentos` externo previo marcado con `usuario_registro='cubrir_externo'`. La asignación de custodia ya es idempotente por `ON CONFLICT (cliente_id,fecha,slot_numero)`.

**Why:** el dedupe original era por DPI, así que re-cubrir el mismo puesto/día con un DPI distinto (corrección de typo o cambio de persona) insertaba un segundo pago; en custodia el incentivo se insertaba siempre aunque el ON CONFLICT deduplicara la asignación. Eso duplicaba la HE en efectivo de un único turno cubierto.

**How to apply:** cualquier cambio a `cubrir-externo` debe preservar esta unicidad por puesto/día; el cambio de DPI debe REEMPLAZAR el pago pendiente, no agregar otro.

## Jornada/monto autoritativos en backend
El monto se deriva en el backend desde el puesto (no del body), con la MISMA regla que el frontend: `24h` si `puesto.es_par_24x24===true || /24/` sobre `jornada/turno_nombre/turno`; el `jornada` del body solo es último recurso. Evita drift entre lo mostrado y lo cobrado, y manipulación del monto. Custodios son 12h fijos.
