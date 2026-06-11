---
name: IGSS se reclasifica al generar la planilla
description: Por qué el IGSS no cambia retroactivamente en una planilla ya generada y cómo reflejar cambios de config IGSS.
---

Al **generar la planilla final** (POST /api/nomina/planilla), el IGSS se reclasifica
con una consulta VIVA a la BD por empleado (aplica_igss_general + estado_igss='activo'
+ (puesto.aplica_igss OR cliente.igss_aplica)). NO usa el snapshot de la pre-planilla.

**Consecuencia operativa:** si activas el IGSS de un colaborador DESPUÉS de generar/pagar
su planilla, esa planilla ya congelada (planilla_lineas) sigue en 0 — el Libro de Salarios
muestra fielmente ese snapshot. El IGSS entra en la SIGUIENTE planilla que generes.

**Para reflejarlo en una planilla existente** hay que regenerarla: revertir (DELETE
/nomina/planilla/:id) → re-cerrar pre-planilla si no hay cierre vigente → generar de nuevo.
El revert decrementa cuotas de anticipos y libera amonestaciones (se re-aplican al regenerar;
neto-neutral).

**Guard de "pagada":** el DELETE rechaza revertir una planilla en estado 'pagada' (protección
de nómina real). En PRUEBAS se puede bajar estado a 'aprobada' por SQL para forzar el revert;
en producción NO — el IGSS simplemente aplica en la próxima quincena.

**Why:** evita reescribir nómina ya pagada y mantiene el Libro como foto fiel del cierre.
**How to apply:** ante "el IGSS no aparece", primero revisar estado de la planilla y si se
generó antes de activar el IGSS; no es bug del Libro.
