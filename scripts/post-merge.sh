#!/bin/bash
set -e
pnpm install --frozen-lockfile

# IMPORTANTE: NO ejecutar `pnpm --filter db push` aqui.
#
# El esquema declarado en `lib/db/src/schema/isp.ts` esta intencionalmente
# desactualizado respecto a la BD real (solo cubre las tablas que se importan
# como tipos en TypeScript). La verdad de la estructura vive en el bloque
# auto-migrate de `artifacts/api-server/src/lib/auto-seed.ts`, que crea/extiende
# tablas y columnas de forma idempotente y NO destructiva al arranque del
# servidor.
#
# Si se vuelve a habilitar `drizzle-kit push`, Replit Deploy detecta cambios
# destructivos (DROP COLUMN / TRUNCATE) y muestra el dialogo
# "Migrations failed validation". Si el usuario elige "Copy your development
# database schema & data to production", la BD de produccion se reemplaza por
# la de desarrollo y se PIERDEN datos (en abril 2026 borro toda la armeria).
