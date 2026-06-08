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
  consolidado. La resolución del cliente del empleado es un modelo UNIFICADO por
  prioridad: histórico vigente en el período (0) > puesto_slots (1) > puesto_titulares
  (2) > legacy titular_employee_id (3); elige el puesto de mayor prioridad y toma su
  `cliente_nombre`. **Why:** el operativo vigente vive en `puesto_slots`; histórico y
  legacy están vacíos en los datos reales, así que resolver SOLO por histórico/legacy
  dejaba el cliente en NULL para todos → todo "Sin cliente asignado" y los feriados
  locales no mostraban a nadie (el WHERE `f.cliente_nombre = ec.cliente` nunca casa
  con NULL). **How to apply:** el helper `clienteEmpleadoSQL(emp,desde,hasta)`
  encapsula esa lógica (GET feriados, PUT individual, PUT bulk) y el LATERAL `po` del
  QUERY_CONSOLIDADO replica la MISMA cadena (lo usa `pago_feriados` y los campos
  aplica_igss/regimen_igss/tipo_turno_id). Mantener ambas en lockstep o pestaña y
  bruto divergen. `puestos_operativos.cliente_nombre` == `clients.nombre` (no
  nombre_comercial), por eso el selector de `clientes-disponibles` casa con el scoping.
- Un feriado aplica a un colaborador si es nacional (cliente_nombre NULL) o su
  cliente coincide. El subquery pago_feriados del consolidado exige EXISTS feriado
  activo en período con esa condición de cliente; al desactivar el feriado el pago
  deja de sumar al bruto.
- POST/DELETE de feriados requieren desde/hasta y devuelven 409 si la quincena
  está cerrada (periodoCerrado()); el snapshot del cierre congela el monto.
- Visibilidad en la pantalla: `pago_feriados` se SUMA al total/bruto en
  `helpers.ts calcularTotalEstimado` (campo `est.pagoFeriados`), pero NO se ve solo
  por eso. Hay que pintar su propia línea de desglose en DetalleModal (igual que
  valorHE), en las DOS secciones: "Total real" y "Total estimado (proyección)".
  **Why:** sin la línea el monto queda dentro del total y el usuario reporta "creé el
  pago pero no aparece". El dato puede estar correcto en el backend (pago_feriados
  devuelve el monto) y aun así ser invisible si falta la línea.
- El feriado local se asigna a clientes desde el catálogo real
  (`/api/operaciones/clientes-disponibles` → `clients.nombre`), NO texto libre, y
  admite varios clientes: el POST acepta `clientes[]` y crea una fila por cliente
  (transacción) reusando el ON CONFLICT. **Why:** el `cliente_nombre` del feriado se
  compara contra el cliente resuelto del consolidado (`po.cliente_nombre`); texto
  libre desalineaba la visibilidad/pago. Vacío = nacional (cliente_nombre NULL).
