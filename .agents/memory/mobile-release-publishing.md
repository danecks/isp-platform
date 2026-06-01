---
name: Publicación móvil OTA/APK (CI por tags)
description: Gotchas no obvios para publicar OTA y APK de la app del agente vía GitHub Actions.
---

La app móvil (Capacitor wrapper de isp-web) se publica por GitHub Actions disparadas con **tags de git**, no desde este entorno.

- **El APK release público solo se crea con un tag `mobile-v*`.** `build-apk.yml` crea el GitHub Release (el `.apk` que el celular descarga de `releases/latest`) únicamente cuando el disparo es por tag (`if: startsWith(github.ref, 'refs/tags/mobile-v')`). Un "Run workflow" (workflow_dispatch) solo sube un artifact interno, NO publica release. Para distribuir APK → push tag `mobile-v X.Y.Z`.
- **OTA**: `publish-ota.yml` (tag `web-v*` o dispatch) empaqueta el bundle web y lo publica a `ispsa.net/app-updates/` (servido vía api-server, url `/api/app-updates/vX.Y.Z.zip`). La app lo baja al arrancar (`liveUpdate.ts`).
- **El sandbox NO puede hacer push a GitHub.** El token disponible es de solo lectura de metadata; `git ls-remote` cuelga. La publicación requiere que el usuario suba código + tags desde el panel de Git de Replit / su shell.
- **El `main` de Replit y el de GitHub pueden divergir.** La CI compila desde GitHub: hay que pushear el commit primero y recién después el tag, o se construye código viejo.
- La versión del APK/OTA la deriva la CI del nombre del tag (no hace falta bumpear archivos).

**Why:** evita publicar con un disparo equivocado (dispatch sin release) o construir una versión sin los cambios recién hechos.
**How to apply:** cuando el usuario pida "publicar app/APK/OTA", confirmá que su commit está en GitHub y usá tags `mobile-v*` (APK) y `web-v*` (OTA).
