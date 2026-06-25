---
name: Deploy — escuchar el puerto antes de migrar
description: Por qué el arranque del api-server debe hacer app.listen ANTES de correr auto-migraciones/seed, o el healthcheck del deploy falla.
---

El arranque del api-server (artifacts/api-server/src/index.ts) debe llamar
`app.listen(port)` PRIMERO y correr `runAutoMigrations()` + `runAutoSeed()`
DESPUÉS, dentro del callback de listen.

**Why:** la cadena de auto-migraciones es idempotente ("verifica/crea") pero
fue creciendo con cada feature hasta tardar ~1 min en producción. Cuando
corría antes de `app.listen`, el puerto no quedaba enlazado durante ese minuto
y el healthcheck del deploy (`/api`, `/app-updates`) recibía 500
(connection refused mapeado) → el promote fallaba sin instancia sana y la
publicación se caía. Deploys anteriores con el MISMO código sí pasaban; el
fallo apareció solo cuando el tiempo de arranque cruzó la ventana del
healthcheck. No es un fallo de compilación ni transitorio: es tiempo de
arranque.

**How to apply:** mantener el orden listen→migrar→seed→jobs. Los jobs
periódicos (limpieza de fotos, GC de sesiones WA, recordatorios, cleanup de
device_reports) van DESPUÉS de que migraciones+seed terminen, dentro del
`.then()`. Caveat aceptado: durante ~1 min tras un deploy nuevo las rutas se
sirven mientras corren las migraciones; en prod el esquema ya existe, así que
son verificaciones casi instantáneas y las rutas funcionan. Si algún deploy
agrega una columna/tabla nueva que una ruta use de inmediato, puede dar 500
transitorio en ese primer minuto. Si el arranque se volviera muy pesado,
considerar un endpoint de health dedicado que responda 200 sin tocar BD.
