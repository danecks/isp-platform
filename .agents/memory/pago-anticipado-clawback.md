---
name: Pago anticipado de días y clawback
description: Reglas durables del descuento por días pagados "de fe" al cerrar la pre-planilla antes del fin de quincena.
---

# Pago anticipado de días con reconciliación (clawback)

Al cerrar la quincena antes del fin real (14/29), los días del período que aún no
están 'cerrado' en `cierre_operativo_diario` se pagan "de fe". Si el agente faltó
esos días, se descuenta en la SIGUIENTE quincena. El descuento por falta ya vive en
`novedades_nomina_diarias.dias_descuento` (24h=3, 12h=2).

## Reglas que no se pueden romper

- **El clawback SOLO aplica a quien fue pagado de fe ese día.** La reconciliación
  debe restringir las faltas al conjunto de `employee_id` del **snapshot del cierre
  que adelantó el día** (`pre_planilla_cierres.snapshot`), no a todos los empleados
  con falta en esa fecha.
  - **Why:** los registros anticipados son por fecha (global), no por empleado. Sin
    el filtro, se descuenta a quien nunca recibió el adelanto (p.ej. mensuales
    excluidos del pago en la 1ª quincena), generando descuentos fantasma.
  - **How to apply:** en `reconciliarAnticipados`, mapear fecha→Set(employee_id)
    desde el snapshot del `cierre_id` del registro; saltar faltas de no-miembros.
    `cierre_id` nulo o snapshot ilegible = sin restricción (fallback heredado).

- **Cierre y reapertura deben ser transaccionales (BEGIN/COMMIT/ROLLBACK).**
  - **Why:** mezclan inserción del cierre, registro de días anticipados y marcado
    'reconciliado'. Un fallo a mitad deja estado parcial que **duplica el clawback**
    en quincenas siguientes (registros que quedan 'pendiente' se re-descuentan).
  - **How to apply:** la auto-provisión de prestaciones queda FUERA de esa
    transacción (best-effort, su propia conexión); no debe revertir el cierre.

- **Display (GET /pre-planilla), cálculo del cierre (POST) y CSV** comparten la
  misma fuente `reconciliarAnticipados(desde)` y suman sobre `total_dias_descuento`.
  Cualquier cambio de fórmula debe tocar las tres a la vez o divergen.

- **v1 = SOLO descuento (clawback).** Los abonos a favor (estructura en la tabla
  lista) NO están cableados.
