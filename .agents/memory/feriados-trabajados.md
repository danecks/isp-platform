---
name: Feriados trabajados (pre-planilla)
description: Modelo y reglas del pago por feriados/asuetos trabajados en la pre-planilla.
---

El pago por feriados se modela por **feriado_fecha**, no por feriado_id.

**Why:** dos feriados que caen el mismo día (p. ej. nacional + local del mismo
cliente) deben colapsar a una sola celda/monto. La UI también modela por
(employee, fecha). Introducir feriado_id rompería el modelo por-fecha y obligaría
a dos columnas la misma fecha, que la UI no soporta.

**How to apply:**
- `nomina_feriado_pago` tiene UNIQUE (employee_id, periodo_desde, periodo_hasta,
  feriado_fecha). El catálogo `nomina_feriados` usa índice único por expresión
  (fecha, nombre, COALESCE(cliente_nombre,'')) → permite el mismo feriado local
  para varios clientes y feriados distintos la misma fecha.
- El GET de colaboradores agrupa con GROUP BY por (emp, ..., fecha) → UNA fila por
  (colaborador, fecha). El frontend deriva columnas por fecha única (no por id);
  el listado de catálogo (agregar/eliminar) sí va por id.
- Scoping por cliente: usar SIEMPRE la misma resolución canónica que el resto del
  consolidado (LATERAL `po`: puesto_titular_historico vigente en el período con
  fallback a titular_employee_id). El helper `clienteEmpleadoSQL(emp,desde,hasta)`
  encapsula esa lógica; aplicarlo en GET, PUT individual y bulk; el consolidado
  usa `po.cliente_nombre`. En dev no hay titulares poblados (modelo slots), así que
  el cliente resuelve NULL para todos — es estado de datos, no del código.
- Un feriado aplica a un colaborador si es nacional (cliente_nombre NULL) o su
  cliente coincide. El subquery pago_feriados del consolidado exige EXISTS feriado
  activo en período con esa condición de cliente; al desactivar el feriado el pago
  deja de sumar al bruto.
- POST/DELETE de feriados requieren desde/hasta y devuelven 409 si la quincena
  está cerrada (periodoCerrado()); el snapshot del cierre congela el monto.
