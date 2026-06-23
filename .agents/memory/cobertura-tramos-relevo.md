---
name: Cobertura por tramos — falta del titular en relevo
description: Cómo el POST /cobertura/segmentos genera la falta del titular en un relevo, incluyendo puestos 24h por slots donde el titular legacy es NULL.
---

# Falta del titular en cobertura por TRAMOS (relevo)

En `POST /cobertura/segmentos`, rama `relevo`, se genera el evento RRHH + novedad de
nómina del titular que faltó (descuento por motivo), espejo del flujo de sustitución
de `asignacion.ts`. La fecha del evento es la del tramo (no NOW()).

## El titular NO siempre está en `po.titular_employee_id`
En puestos de 24h con 2+ titulares modelados por **`puesto_slots`** (24x24/24x48/etc.),
`puestos_operativos.titular_employee_id` (legacy) es **NULL**. Si solo lees ese campo,
la rama de relevo se salta y NUNCA generas la falta del titular.

**Regla:** cuando `titularId` legacy es null, resolver el titular que **trabaja HOY**
(= el que faltó) desde `puesto_slots`, replicando la lógica del pizarrón (`tablero.ts`):
- `cycleDay = ((diasDesdeFechaInicioCiclo % longitud_ciclo) + longitud_ciclo) % longitud_ciclo + 1` (1-based, maneja negativos)
- trabaja hoy si `dias_trabajo[]` (array 1..longitud_ciclo) incluye `cycleDay`
- `fecha_inicio_ciclo` = `COALESCE(ps.fecha_inicio_ciclo, po.fecha_inicio_ciclo)`, `longitud_ciclo` default 14
- excluir al cubriente (`employeeId`); tomar el **primer** slot activo con `empleado_id` que trabaja hoy

**Por qué replicar y no usar `calcularEstadoCiclo`:** los slots guardan un patrón explícito
por día (`dias_trabajo INTEGER[]`), no un `tipo_ciclo`. `calcularEstadoCiclo` daría el día
equivocado para estos puestos. La fuente de verdad es `calcTrabajaPorSlot` (idéntica en
`tablero.ts` y `cobertura.ts`).

## Atribución del puesto en la novedad
Como el titular resuelto (legacy o por slot) **siempre** pertenece a este puesto, la novedad
fija `puesto_titular_id = puestoId` y `puesto_titular_nombre` directo. (Antes se condicionaba
a `legacy === titularId`, que para slots es null → quedaba sin puesto.)

## Decisiones firmes del flujo
- El relevo pide **motivo** (default `falta_total`); efectivo/planilla solo si el cubriente
  estaba `descansando`.
- Idempotente: evento RRHH único por titular+fecha+tipo con `generado_desde='cobertura_tramos'`;
  novedad con ON CONFLICT (fecha, employee_id) que respeta `aprobado_rrhh/rechazado_rrhh`.
- La resolución por slot va en try/catch **no bloqueante** (warn): si falla, no rompe el tramo.
