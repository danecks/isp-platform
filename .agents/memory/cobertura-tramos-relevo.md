---
name: Cobertura por tramos con relevo (falta titular + HE efectivo/planilla)
description: En cobertura por TRAMOS, cuando un tramo es relevo y el titular faltó, generar la falta del titular y preguntar efectivo/planilla solo si el cubriente estaba en descanso.
---

# Cobertura por tramos (POST /cobertura/segmentos + ModalSegmentos) con relevo

La cobertura por tramos debe igualar el flujo normal de sustitución cuando un tramo es RELEVO y el titular faltó:
1. Generar evento RRHH ('pendiente_aprobacion', generado_desde='cobertura_tramos') + novedad del titular con descuento según motivo (mirror de asignacion.ts).
2. Preguntar efectivo/planilla para la HE del cubriente **solo** cuando el cubriente estaba en descanso (front: `coverGrupo==='descansando'` → `aplicaHE`).

## Reglas durables

- **El evento RRHH del titular se inserta con la fecha del TRAMO, no con NOW().**
  **Why:** el dedupe idempotente busca `employee_id + fecha::date + tipo_evento`. Si se inserta con NOW(), un tramo retroactivo/futuro queda en el día equivocado y el check de idempotencia deja de ser fiable → se puede duplicar el evento o desalinear RRHH.
  **How to apply:** en cualquier INSERT de eventos_rrhh desde cobertura de tramos pasar `$n::date` con la `fecha` del tramo, nunca `NOW()`.

- **Descuento de días del titular:** falta real (no sin_descuento, no suspensión) ⇒ diasDesc por jornada (24h→3, 12h→2, otro→1). La novedad usa ON CONFLICT (fecha, employee_id) y preserva valores si la fila ya está 'aprobado_rrhh'/'rechazado_rrhh'.

- **HE en efectivo en tramos = dos requests no atómicas.** El front hace POST /cobertura/segmentos (deja la novedad del cubriente en impacto='pendiente') y luego POST /incentivos (he_efectivo) que la voltea a 'pagado_efectivo'.
  **Why:** si /incentivos falla y se silencia, la HE queda en planilla aunque el operador pagó/quería pagar en efectivo → riesgo de doble pago (cash + planilla).
  **How to apply:** tratar todo fallo no-409 de /incentivos como toast destructivo visible ("NO quedó registrado, sigue en planilla, reintenta"); 409 = ya registrado (dedupe por employee+fecha+puesto).

- El cierre (generar-novedades.ts Paso 4) preserva dias_descuento del titular (solo rellena si null/0) y no revierte 'pagado_efectivo' del cubriente.
