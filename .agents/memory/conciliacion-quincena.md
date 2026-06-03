---
name: Reporte de conciliación de quincena
description: Reglas de negocio durables del reporte de verificación de pago quincenal.
---

# Conciliación de quincena (verificación de pago)

Reporte para, al pagar la quincena, cruzar lo operativo (faltas, coberturas, horas extra)
con lo que entra a nómina y confirmar que el pago es correcto.

**Reglas durables (no obvias, no deducibles del esquema):**
- Una falta NO está "cubierta" solo porque tenga par vinculado: el par debe ser de tipo
  horas_extra y NO estar rechazado/anulado. Si el par no es HE o está anulado → inconsistencia.
- Default de período = quincena GT (1ª: 1–15, 2ª: 16–fin de mes) si no llega rango.
- Los retroactivos descuadrados solo se MARCAN como inconsistentes; este reporte no re-vincula.
- Gating: módulo `reportes` (middleware, igual que todos los reportes) + rol admin/rrhh/operaciones
  en el handler (defensa en profundidad por ser dato de nómina). La pestaña del front se oculta por rol.

**Why:** la ruta operativa `asignar` puede dejar faltas sin su HE vinculada (par incompleto);
este reporte existe justamente para destapar esos descuadres antes de pagar. El gate de rol calza
con el set de la pestaña; un 403 por falta de módulo es comportamiento correcto, no un bug.
