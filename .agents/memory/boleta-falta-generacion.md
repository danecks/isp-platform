---
name: Generación de la boleta de falta desde el pizarrón
description: Cómo y cuándo el botón de Falta del pizarrón genera el evento RRHH que alimenta la boleta de descuento (incluye cuadres pasados y futuro).
---

La "boleta" = `generarBoletaDescuento` (isp-web/src/lib/pdfRrhh.ts), PDF generado en cliente bajo demanda desde Eventos RRHH a partir de un `eventos_rrhh` tipo `falta`. El botón del pizarrón NO genera el PDF; su trabajo es crear ese evento (la fuente de la boleta).

Dos rutas distintas según el tipo de personal:
- **Personal de oficina** (supervisor/jefe_servicio/administrativo*): `POST /operaciones/falta-personal` crea el evento `falta` al instante, fechado con la `fecha` enviada (`$4::date`, valida `YYYY-MM-DD`, default todayGT). Boleta disponible de inmediato, también para fechas pasadas. Bloquea día cerrado.
- **Guardias en puesto**: el botón llama `POST /operaciones/registrar-falta`, que SOLO marca `puestos_operativos.estado_operativo_puesto='faltando'` (+ falta_employee_id/motivo/notas). NO crea evento en ese momento (modelo diferido). El evento `falta` se materializa al CERRAR el día en cierre.ts, fechado con `fechaACerrarISO`. **Por qué:** si durante el día alguien cubre (sustitución/relevo), la falta ya no se genera.

**Cuadres pasados:** el cierre permite cerrar días pasados (supervisor ≤7 días, admin más) y crea el evento con la fecha correcta del día cerrado → boleta con fecha correcta. Para guardias la boleta aparece DESPUÉS de cerrar ese día, no al hacer clic.

**Hueco conocido (puestos 24x24 por slots):** cierre.ts EXCLUYE a propósito de la materialización los puestos con slot activo (`AND NOT EXISTS (puesto_slots activo)`), porque la bandera legacy `faltando` no tiene fecha y regeneraría una falta en cada día cerrado (incluidos descansos del ciclo). En el modelo por slots la inasistencia se documenta de forma FECHADA vía cobertura/relevo. Consecuencia: si un titular 24x24 falta y NADIE lo cubre, el botón solo no produce boleta al cierre.

**Planeación / futuro:** cierre.ts rechaza cerrar fecha futura ("No se puede cerrar una fecha futura"), así que una falta de guardia marcada a futuro no produce boleta hasta que ese día llegue y se cierre. (falta-personal de oficina no tiene guard de futuro: crearía evento fechado a futuro.)

Otros inserts de `falta`: cierre.ts (diferida), falta-personal.ts (oficina), custodias-asignacion.ts (custodia), asignacion.ts `/liberar` (usa `fecha=NOW()` en el evento — bug latente de fecha para retroactivo, pero no es la ruta del botón de falta del pizarrón).
