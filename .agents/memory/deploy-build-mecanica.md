---
name: Mecánica del build de deployment (autoscale, monorepo)
description: Cómo se construye y promueve el deploy; cómo distinguir fallo de build vs fallo de promote/health-check.
---

# Build de deployment: qué corre y cómo depurar

El deploy NO corre el typecheck raíz (`pnpm run build` / `tsc --build` de libs). Por
eso los errores TS2344 de Zod en `lib/db` (baseline rojo) NUNCA rompen el deploy.

Lo que corre el deploy, por artefacto, es el `build` de su
`.replit-artifact/artifact.toml` `[services.production]`:
- api-server: `pnpm --filter @workspace/api-server run build` → esbuild (`build.mjs`). esbuild NO typechequea.
- isp-web: `vite build` → genera `dist/public` (static serve, publicDir). El `vite build` SÍ obtiene `PORT` desde `[services.env]`, así que el `PORT` obligatorio de `vite.config.ts` NO rompe el build de deploy (solo rompe si lo corres a mano sin PORT).
- mockup-sandbox: NO tiene `[services.production]` → no se despliega.

`.replit` `[deployment].build` es solo pre-hook a nivel raíz; aquí solo hace
`pnpm store prune` como postBuild.

## Distinguir build vs promote
Fases: build → promote → serve. En los logs de `getDeploymentBuild`, si ves los
dos builds completar y luego "Pushing/Created ... layer" y al final status=failed
SIN error de compilación, el fallo es en **promote** (health check), no en build.
El probe del api-server (autoscale) es `GET /api/healthz` (definido en
`[services.production.health.startup]`). En local arranca y responde 200 en ~7s.

**Why:** un fallo de promote sin error en logs, con solo CSS cambiado desde el
último deploy exitoso, suele ser flake transitorio de la plataforma (a veces
`getDeploymentInfo` también devuelve "service unavailable"). La acción correcta es
re-publicar, no tocar código.

**Fragilidad latente (no tocar sin pedido):** el api-server corre auto-seed
completo en CADA arranque en frío; en autoscale los cold starts repiten todas las
migraciones IF NOT EXISTS, lo que puede alargar el arranque cerca del timeout del
probe.
