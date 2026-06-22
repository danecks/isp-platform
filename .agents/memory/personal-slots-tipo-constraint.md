---
name: Restricción tipo de personal_slots debe seguir a los tipos del handler
description: El CHECK personal_slots_tipo_chk debe incluir todos los tipos que el handler acepta (supervisor/jefe_servicio/administrativo), o falla al crear plantilla.
---

# personal_slots: el CHECK de tipo se desincroniza del código

**Síntoma:** "Error al crear personal_slot" al crear plantilla de turno para un
Jefe de Servicio. En logs: `new row for relation "personal_slots" violates check
constraint "personal_slots_tipo_chk"` (SQLSTATE 23514), fila con `tipo='jefe_servicio'`.

**Causa:** el handler `POST /personal/empleados/:empleadoId/slots` acepta
`tipo` en {supervisor, jefe_servicio, administrativo} (lo valida contra
`employees.tipo_personal`), pero el CHECK de la tabla, definido en auto-seed,
solo permitía `('supervisor','administrativo')`. El dominio de BD quedó atrás del
código.

**Regla:** los tipos permitidos en `personal_slots.tipo` (CHECK
`personal_slots_tipo_chk`) deben incluir **todos** los que el handler puede
insertar. Hoy: supervisor, jefe_servicio, administrativo. Si se agrega un nuevo
`tipo_personal` de oficina que reciba plantilla de turno, ampliar también el CHECK.

**Why:** `personal_slots` es el clon de `puesto_slots` para personal de oficina;
la clasificación de empleados (guardia/supervisor/jefe_servicio/administrativo_*/
gerencia) evoluciona, y el CHECK no se actualiza solo.

**How to apply:** ampliar el CHECK con migración idempotente en auto-seed
(`ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...; ADD CONSTRAINT ... CHECK (...)`).
Ampliar el dominio es seguro (las filas válidas siguen válidas). Aplica en
producción al correr auto-seed en el arranque del deploy → requiere publicar.
