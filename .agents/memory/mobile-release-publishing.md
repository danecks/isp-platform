si---
name: Publicación móvil OTA/APK (CI por tags)
description: Gotchas no obvios para publicar OTA y APK de la app del agente vía GitHub Actions.
---

La app móvil (Capacitor wrapper de isp-web) se publica por GitHub Actions disparadas con **tags de git**, no desde este entorno.

- **El APK release público solo se crea con un tag `mobile-v*`.** `build-apk.yml` crea el GitHub Release (el `.apk` que el celular descarga de `releases/latest`) únicamente cuando el disparo es por tag (`if: startsWith(github.ref, 'refs/tags/mobile-v')`). Un "Run workflow" (workflow_dispatch) solo sube un artifact interno, NO publica release. Para distribuir APK → push tag `mobile-v X.Y.Z`.
- **OTA auto**: `publish-ota.yml` se dispara AUTOMÁTICAMENTE en cada push a `main` que toque `artifacts/isp-web/**`, `lib/**`, `pnpm-lock.yaml` o el propio workflow. Versión derivada sola: `YYYY.MM.DD.<run_number>` (no hace falta tag ni bumpear archivos). También sigue funcionando con tag `web-v*` (usa esa versión exacta) y con dispatch manual (input version vacío = automática). Empaqueta el bundle web y lo publica a `ispsa.net/app-updates/`. La app lo baja al arrancar (`liveUpdate.ts`).
- **La comparación de versión OTA es por IGUALDAD, no por orden** (`liveUpdate.ts`: `current.bundle.version === manifest.version`). Cualquier versión distinta dispara update; por eso el filtro `paths` evita republicar (y spamear celulares) en pushes que no tocan la app.
- **El sandbox NO puede hacer push a GitHub.** El token disponible es de solo lectura de metadata; `git ls-remote` cuelga. La publicación requiere que el usuario suba código + tags desde el panel de Git de Replit / su shell.
- **El `main` de Replit y el de GitHub pueden divergir.** La CI compila desde GitHub: hay que pushear el commit primero y recién después el tag, o se construye código viejo.
- La versión del APK/OTA la deriva la CI del nombre del tag (no hace falta bumpear archivos).

- **ANTES de etiquetar un APK, verificá que el `main` de GitHub esté al día.** La conexión Replit→GitHub se rompe (panel "Failed to authenticate with the remote"; desde el sandbox el remoto `subrepl-*` git+ssh riker.replit.dev se CUELGA en `ls-remote --tags`). Cuando eso pasa, `main` en GitHub queda semanas atrás en silencio y un tag construye código viejo. Chequear el tip con `GET /repos/<repo>/commits/main` (con GITHUB_RELEASES_TOKEN, solo lectura de contents) y comparar fecha/mensaje con lo último de Replit.
- **GITHUB_RELEASES_TOKEN es contents:read solamente.** Sirve para ver releases/commits, NO para Actions (`/actions/runs` devuelve vacío/None) ni para push. Para ver si el build corrió, el usuario debe mirar la pestaña Actions.
- **Crear el Release/tag desde la web de GitHub** (Releases → Draft → Create new tag → Publish) dispara `build-apk.yml` por tag sin necesitar push de Replit, PERO compila el código que ya está en GitHub main (si está stale, sale viejo).

**Why:** evita publicar con un disparo equivocado (dispatch sin release) o construir una versión sin los cambios recién hechos; la conexión Git rota es un fallo silencioso que reparte una app atrasada.
**How to apply:** cuando el usuario pida "publicar app/APK/OTA", confirmá que su commit está en GitHub (verificá el tip de main por API) y usá tags `mobile-v*` (APK) y `web-v*` (OTA). Si el push falla, el arreglo (guía Replit) es desconectar y reconectar GitHub en Git Providers, no algo que el sandbox pueda hacer.
