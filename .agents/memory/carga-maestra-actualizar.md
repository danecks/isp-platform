---
name: Carga maestra omite DPI existentes
description: La carga maestra (POST /importacion/maestro) precarga DPI existentes y los omite; solo actualiza con flag actualizar.
---

# Carga maestra: omite existentes salvo flag `actualizar`

La carga maestra precarga TODOS los DPI ya en BD y, por defecto, OMITE cualquier
fila cuyo DPI exista (no actualiza). Por eso re-subir el archivo no rellena datos
de colaboradores que ya están registrados.

Existe el flag `actualizar` en el body del endpoint: cuando está activo y el DPI
ya existe, en vez de omitir hace un UPDATE que **solo rellena `fecha_nacimiento`
cuando está vacía** (`WHERE fecha_nacimiento IS NULL`), salta el comodín
`01/01/2000` y las filas sin fecha. No toca ningún otro campo ni pisa fechas
existentes.

**Why:** en producción la carga maestra original perdió la fecha_nacimiento de
~457 colaboradores (la necesita el director para el seguro). El director decidió
rellenar SOLO fecha_nacimiento y SALTAR los comodín 01/01/2000.

**How to apply:** si en el futuro hay que rellenar/actualizar otros campos
demográficos por DPI, el patrón ya está: extender la rama `actualizar` con más
columnas usando COALESCE / `IS NULL` para no pisar datos buenos, y reflejarlo en
el preview usando el set precargado (p. ej. `empleadoConFechaNac`) para que
preview e import real coincidan 1:1. El cambio aplica en prod solo tras publicar;
prod es read-only para el agente, el director re-sube el archivo.
