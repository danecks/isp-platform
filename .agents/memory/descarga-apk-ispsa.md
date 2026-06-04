---
name: Descarga del APK desde ispsa.net (espejo perezoso)
description: Cómo se sirve el APK de la app del agente desde ispsa.net en vez de redirigir a GitHub.
---

El endpoint público `GET /api/descarga-apk[/:version]` (api-server) entrega el APK **desde Object Storage propio de ispsa.net**, no por redirect a GitHub. La página `DescargaApp.tsx` (ruta `/descarga-app`) apunta QR y botón a `https://ispsa.net/api/descarga-apk`.

Patrón "espejo perezoso":
- Sin versión en la URL → resuelve la última release `mobile-v*` de GitHub (cache 5 min); si GitHub no responde, cae a escanear la versión más alta ya guardada en storage.
- Si el APK ya está en storage (prefijo `app-downloads/`, mismo bucket que los bundles OTA `app-updates/`) → lo sirve por streaming sin tocar GitHub.
- Si no está → lo baja UNA vez del release privado (GITHUB_RELEASES_TOKEN, contents:read), lo guarda y lo entrega.

**Why:** el director no quiere que los guardias descarguen desde github.com; además así la descarga sobrevive aunque GitHub esté caído (tras la primera copia). El token solo se necesita para sembrar versiones nuevas.

**How to apply:**
- La primera copia de cada versión sí requiere que el APK exista en el release de GitHub. Si querés independencia total, habría que subir el APK a Object Storage desde el CI (bloqueado mientras la conexión Git esté rota).
- Concurrencia resuelta con singleflight en memoria (Map por versión); en deploy autoscale el lock NO es distribuido entre instancias, pero el guardado es idempotente (mismo path) y la ventana es solo hasta el primer save.
- La primera copia bufferiza ~31 MB en RAM (no es streaming end-to-end); aceptable por el bajo tráfico (instalaciones puntuales). Si el tráfico crece, migrar a stream GitHub→storage+cliente.
- OJO: `Response` de fetch choca con el `Response` de express importado en el archivo; no anotar `Promise<Response>` en helpers de fetch (dejar inferir).
- Para que entre en vivo: deploy de Replit (autoscale), independiente del problema de conexión Git→GitHub.
