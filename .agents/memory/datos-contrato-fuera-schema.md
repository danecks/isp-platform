---
name: Datos de contrato fuera del schema Drizzle
description: Los campos personales para el contrato laboral se persisten con UPDATE crudo, no por Drizzle; editar sin prellenar borra datos.
---

# Datos de contrato fuera del schema Drizzle

Los campos personales usados para generar el contrato laboral en PDF
(estado_civil, sexo, nit, direccion, lugar_nacimiento, municipio, departamento)
NO están en el modelo Drizzle de employees. Se leen vía GET /employees/:id
(snake_case) y se escriben con un `UPDATE employees SET col = $n` parametrizado,
tanto en `POST /employees` como en `PATCH /employees/:id` (helper `pushPerso`).

**Regla:** en ese patrón `"" || null` se guarda como `NULL`. Por eso cualquier
formulario de EDICIÓN que envíe estos campos debe primero prellenarlos desde el
detalle (GET /:id); si los manda vacíos, BORRA los datos existentes.

**Why:** un form de edición que inicializa estos campos a `""` y los incluye en
el PATCH puede borrar silenciosamente datos válidos si el GET de detalle no
cargó (p.ej. falló sin `sessionHeader()` o sin validar `r.ok`).

**How to apply:** al tocar el modal de alta/edición de empleados o las rutas
employees base, (1) el GET de detalle debe llevar `sessionHeader()` y validar
`r.ok` (si no, react-query mantiene `data` undefined en error); (2) bloquear el
guardado en modo edición hasta que el detalle haya cargado; (3) prellenar solo
campos vacíos para no pisar lo que el usuario escribió.
