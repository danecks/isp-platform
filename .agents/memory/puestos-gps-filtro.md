---
name: Filtro de /puestos-gps y opciones de select en Windows
description: Por qué /puestos-gps no lista todos los puestos y cómo evitar el texto blanco en menús nativos
---

**`GET /api/puestos-gps`** filtra por defecto `WHERE po.estado = 'cubierto'`
porque su uso original es GPS/fichaje (solo puestos con guardia presente). Para
asignar cosas a un puesto aunque hoy esté descubierto (p. ej. teléfono de
dispositivo), pasar `?todos=1` → usa `po.activo = TRUE` (puestos vigentes, no
el estado de cobertura del día).

**Por qué:** "vigente" (activo) y "cubierto hoy" son cosas distintas. El menú
de asignación debe usar `activo`, no `estado`. El filtro por defecto se conserva
para no romper otros consumidores (config GPS, munición).

**Menús `<select>` nativos en Windows:** las `<option>` no heredan el tema
oscuro de Tailwind y salen texto blanco sobre fondo blanco (en Mac se ven bien).
Solución: agregar `[&_option]:bg-slate-800 [&_option]:text-slate-100` al
className del `<select>`. Aplica a cualquier select con tema oscuro de la app.
