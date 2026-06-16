---
name: Anular HE en efectivo (reversión)
description: Cómo revertir un pago de hora extra en efectivo sin dejar estados huérfanos ni doble pago.
---

# Anular HE en efectivo

El reporte unificado de HE cash (GET /rrhh/horas-extra-cash) trae id compuesto
`inc-<id>` (incentivos_cash_cobertura, origen pizarrón) o `nov-<id>`
(novedades_nomina_diarias con horas_extra_estado='pagado_efectivo', origen anexo).
La anulación vive en POST /rrhh/horas-extra-cash/anular (transaccional, FOR UPDATE,
409 si ya cancelado/revertido).

## Regla clave (inc-)
El POST de creación (incentivos he_efectivo) marca el impacto en
novedades.impacto_nomina y eventos_rrhh **por empleado+fecha, NO por puesto**.
Por eso, al anular un `inc-`, primero se hace soft-delete (estado='cancelado') y
SOLO se revierte novedad/evento si **ya no queda ninguna otra HE en efectivo
activa** para ese empleado+fecha (COUNT estado<>'cancelado' == 0).

**Why:** un mismo colaborador puede tener dos HE cash el mismo día en distintos
puestos (el dup-check de creación es por employee+fecha+puesto). Sin el guard,
anular una devolvía a "pendiente" la novedad/evento que aún respalda la otra,
dejando el otro pago huérfano y abriendo puerta a reproceso/doble pago.

**How to apply:** cualquier reversión de impacto marcado por empleado+fecha
(no por clave fina) debe condicionarse a que no queden hermanos activos. Para
no cruzar fuentes, la rama inc- toca novedades solo con
`horas_extra_estado <> 'pagado_efectivo'` (no pisa pagos por la vía anexo).

## Regla (nov-)
Revertir la novedad (horas_extra_estado/impacto_nomina → 'pendiente', limpiar
aprobadas_por/at), su evento ('resuelto_cash' → 'pendiente') y reabrir la alerta
rrhh_alertas ('resuelta' → 'pendiente').

## UI
Dos lugares: botón "Anular" en el reporte (Reportes.tsx, ReporteHorasExtraCash)
y nueva pestaña "HE en Efectivo" del pizarrón (Operaciones.tsx → PanelHEEfectivo).
El panel del pizarrón restringe la acción a rol admin|operaciones.
