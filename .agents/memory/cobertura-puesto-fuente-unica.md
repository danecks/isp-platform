---
name: Cobertura de puesto fuente única
description: Helper único para "¿está cubierto este puesto?"; no leer la columna legacy estado.
---
La verdad de "¿está cubierto un puesto operativo?" vive en `lib/cobertura-puesto.ts`
(`puestoCubiertoSql(alias)` / `puestoEstadoCoberturaSql(alias)`): cubierto = hay un
`puesto_slots` activo con `empleado_id`, o fallback legacy `po.agente_id IS NOT NULL`.

**Why:** la columna legacy `puestos_operativos.estado` ('cubierto'/'descubierto')
quedó obsoleta al pasar al modelo 24x24; reportaba casi todo "descubierto" y divergía
del pizarrón/cierre. La auditoría encontró que fichaje, zonas y portal aún la leían.

**La columna fue RETIRADA definitivamente** (DROP COLUMN). La migración idempotente
`ALTER TABLE puestos_operativos DROP COLUMN IF EXISTS estado` vive en auto-seed.ts
justo después del CREATE TABLE; el CREATE ya no la declara. Los readers usan el helper.
OJO: las escrituras a esta columna estaban dispersas (UPDATEs e INSERTs en rutas, seed
y tests) Y EN SWEEPS/UPDATEs FÁCILES DE PASAR POR ALTO: asignacion.ts (asignar titular,
cobertura diaria, sustitución) e importacion-maestro.ts (sweep final con FROM
puesto_titulares). Al dropear la columna, cualquier write residual rompe el endpoint en
runtime ("column does not exist"); auditar writes con grep amplio sobre varias líneas,
no solo INSERTs. El "estado" que sigue existiendo es OTRA cosa:
(1) el FIELD de respuesta `... AS estado` derivado por `puestoEstadoCoberturaSql`,
(2) variables locales/literales en el snapshot del cierre, (3) columnas `estado` de
otras tablas (clients, armas, vehiculos, eventos, etc.). No confundir.

**How to apply:** cualquier nueva decisión o display de cobertura debe usar el helper,
nunca la columna (ya no existe). El campo de respuesta `estado` se mantiene pero se
nutre del helper. El EXISTS usa alias `ps_cob` para no chocar con otros `ps`.
