---
name: Typecheck baseline api-server / isp-web
description: El typecheck por artefacto está rojo de base; cómo saber si un error es tuyo o preexistente.
---

# Typecheck baseline (pre-existente, no regresión)

`pnpm --filter @workspace/api-server run typecheck` y el de `isp-web` ya fallan de
base, independientemente de tus cambios. Errores recurrentes preexistentes:

- **api-server**: `src/test/e2e-abril/unit-tests.ts` (TS2345 number/string),
  y en rutas que importan de `@workspace/db`: `TS2305 ... no exported member 'todayGT'`
  (artefacto de orden de build: el typecheck no compila primero las project
  references; `todayGT` SÍ existe en `lib/db/src/index.ts`). También `TS7030 Not all
  code paths return a value` en handlers Express (patrón guard `return res.json` +
  `res.json` sin return) presente en muchos handlers.
- **isp-web**: `KioscoSolicitud.tsx`, `SolicitarAnticipo.tsx`, `SolicitudEmpleo.tsx`,
  `acceso-clientes.tsx`.

**How to apply:** Para saber si rompiste algo, no mires el exit code global. Filtra
por tus archivos: `pnpm --filter <pkg> run typecheck 2>&1 | rg "<tu-archivo>"`.
OJO: no uses `tail -N` sobre la salida (puede ocultar errores de tus archivos que
salen arriba). La validación al cerrar puede fallar por este baseline rojo →
documentar con skip_validation_reason cuando tus archivos estén limpios.
