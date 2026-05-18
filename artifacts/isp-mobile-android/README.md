# ISP Operaciones — Wrapper Android (Capacitor)

Empaqueta el bundle web de `@workspace/isp-web` como una **APK Android nativa
distribuible** (sin Play Store), con **auto-update OTA**: los parches de JS/HTML/CSS
se publican en `ispsa.net/app-updates/` y el APK los descarga al próximo arranque.

- **App name:** ISP Operaciones
- **App ID:** `com.ispsa.operaciones`
- **Mínimo:** Android 7.0 (API 24)
- **OTA host:** https://ispsa.net/app-updates/

---

## Qué se actualiza por OTA vs qué requiere APK nueva

| Cambio                                   | OTA | APK nueva |
| ---------------------------------------- | :-: | :-------: |
| Pantallas, lógica, estilos, assets web   |  ✔  |           |
| Endpoints API consumidos                 |  ✔  |           |
| Plugin Capacitor nuevo / actualizado     |     |     ✔     |
| Permiso Android nuevo en `AndroidManifest.xml` |     |     ✔     |
| Cambio de `appId`, `minSdkVersion`, etc. |     |     ✔     |
| Versión nueva de `@capacitor/*`          |     |     ✔     |

### Background GPS + geofencing (TASK #51)

A partir de la versión que incluye `@capacitor-community/background-geolocation`,
el supervisor puede activar **GPS en segundo plano** desde el header de su
pantalla de jornada. Mientras está activo:

- Android muestra una **notificación persistente** ("ISP Operaciones —
  Supervisión activa") que no se puede deslizar para descartar; tocarla
  abre la app.
- Las lecturas se acumulan en el WebView y se descargan al servidor en
  lotes (`POST /agente/supervision/jornada/gps-batch`, máx 200 puntos).
- En cada lectura el cliente computa distancia a los puestos de la agenda
  (haversine local) y dispara eventos `entry`/`exit`
  (`POST /agente/supervision/jornada/geofence-evento`). Cruzar el
  perímetro al entrar **auto-inicia la visita programada**.
- El admin ve las llegadas/salidas en `Supervisión → Mapa en vivo`, panel
  inferior "Llegadas y salidas a puestos".

Pre-requisitos para que esto funcione en el APK:

1. `pnpm install` en `artifacts/isp-mobile-android/` instala el plugin
   nuevo (`@capacitor-community/background-geolocation`).
2. El merge del `AndroidManifest.xml` está **automatizado**: el script
   `scripts/apply-android-manifest.mjs` inserta los permisos
   (`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
   `FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`, etc.) y el `<service>`
   `com.equimaps.capacitorblbackgroundgeolocation.BackgroundGeolocationService`
   con `android:foregroundServiceType="location"` de forma idempotente.
   Lo invoca tanto `pnpm run build:apk` como el workflow de CI; no hace
   falta editar el XML a mano. El template de referencia sigue en
   `android-templates/AndroidManifest-permissions.xml`.
3. `npx cap sync android` y rebuild.
4. La primera vez que el usuario active el botón, Android pedirá ubicación
   "todo el tiempo" — el supervisor debe aceptar; si elige "sólo mientras
   se usa la app", el servicio igual arranca pero deja de reportar al
   minimizar.

> Regla simple: si tocás algo de `artifacts/isp-mobile-android/` que no sea web,
> probablemente necesitás APK nueva.

---

## 1) Instalar el APK en un Android (usuario final)

1. Desde el celular, abrí la URL del último release:
   `https://github.com/<org>/<repo>/releases/latest`
2. Descargá `ISP-Operaciones-vX.Y.Z.apk`.
3. Al abrirlo, Android pedirá permiso para "instalar de fuentes desconocidas" —
   habilitalo sólo para el navegador o el gestor de archivos que esté usando.
4. Instalá. La app aparece como **ISP Operaciones**.

Para reemplazar: instalá el APK nuevo encima — siempre que esté firmado con la
**misma keystore**, Android lo trata como actualización. Si la keystore cambió,
hay que desinstalar primero (se pierden datos locales del WebView, pero NO la
sesión: queda en cookies del servidor).

---

## 2) Generar APK nuevo (local)

Pre-requisitos: Node 20, pnpm 9, Java 17 (Temurin), Android SDK con
`build-tools` y `platforms;android-34`. `ANDROID_HOME` apuntando al SDK.

```bash
# Desde la raíz del monorepo:
pnpm install

# Primera vez (genera artifacts/isp-mobile-android/android/):
cd artifacts/isp-mobile-android
npx cap add android

# Pegar el signing block en android/app/build.gradle:
cat android-templates/signing-block.gradle >> android/app/build.gradle

# Aplicar permisos + <service> al AndroidManifest (automatizado, idempotente):
pnpm run apply:manifest
# (el template de referencia está en android-templates/AndroidManifest-permissions.xml)

# Generar la keystore (sólo la primera vez):
bash scripts/generate-keystore.sh
# Guardá keystore.jks fuera del repo (1Password, vault, etc.).

# Build:
export KEYSTORE_PATH="$PWD/keystore.jks"
export KEYSTORE_PASSWORD="…"
export KEY_ALIAS="ispsa"
export KEY_PASSWORD="…"
export MOBILE_VERSION_NAME="1.0.0"
export MOBILE_VERSION_CODE="100"

pnpm run build:apk
# Output: android/app/build/outputs/apk/release/app-release.apk
```

En CI esto está automatizado: ver `.github/workflows/build-apk.yml`. Se dispara
solo con `git push origin mobile-v1.0.0`.

---

## 3) Publicar un OTA (sin reinstalar)

Para sacar un parche que sólo cambia código web (lo más común):

```bash
git tag web-v1.0.1 && git push origin web-v1.0.1
```

GitHub Actions (`.github/workflows/publish-ota.yml`) compila el bundle web,
lo empaqueta como `v1.0.1.zip`, calcula sha256 y lo sube — junto con un
`manifest.json` — a `ispsa.net/app-updates/`. Los APK instalados consultan el
manifest al iniciar (`liveUpdate.ts`), comparan versión y bajan el zip nuevo
en background. Se aplica al próximo abrir la app.

### Manualmente (sin tag)

```bash
cd artifacts/isp-mobile-android
OTA_VERSION=1.0.1 pnpm run bundle:ota
# Genera ota-out/v1.0.1.zip + ota-out/manifest.json
# Subir ambos a ispsa.net:/var/www/ispsa.net/app-updates/
```

### Modo alternativo: servir OTA desde el api-server

Si no hay acceso SSH cómodo a `ispsa.net`, está implementado un endpoint en
`@workspace/api-server`:

- `GET /api/app-updates/manifest.json`
- `GET /api/app-updates/v<X>.zip`

Lee desde Object Storage de Replit bajo el prefijo `app-updates/`. Para usar
este modo, apuntá `CapacitorUpdater.updateUrl` (en `capacitor.config.ts`) a
`https://<dominio>/api/app-updates/manifest.json` y publicá los bundles a
Object Storage en vez de a `ispsa.net`.

---

## 4) Keystore — crítico

El `keystore.jks` firma la APK. Android **rechaza** instalar una APK firmada
con otra key sobre una versión previa: si la perdés, todos los usuarios deben
desinstalar antes de poder volver a actualizar.

**Backup obligatorio**, fuera del repo:
- Copia en gestor de contraseñas corporativo (1Password / Bitwarden vault).
- Copia offline en un USB cifrado guardado en oficina.
- Anotar password y alias en el mismo lugar.

Para subir a CI:

```bash
base64 -w0 keystore.jks
# Pegar como secret KEYSTORE_BASE64 en GitHub.
# Setear también KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD.
```

### Rotación (cambio de keystore)

1. Generar nueva keystore con `scripts/generate-keystore.sh`.
2. Actualizar secrets en GitHub.
3. Avisar a usuarios: **deben desinstalar la app actual** antes de instalar
   la próxima versión. Los datos locales del WebView se pierden, pero la
   sesión y los datos del servidor quedan intactos.

---

## 5) Estructura del artefacto

```
artifacts/isp-mobile-android/
├─ capacitor.config.ts          ← appId, OTA config, plugins
├─ package.json                 ← @capacitor/* + @capgo/capacitor-updater
├─ android-templates/           ← snippets para pegar en android/ tras `cap add`
│  ├─ signing-block.gradle
│  └─ AndroidManifest-permissions.xml
├─ scripts/
│  ├─ copy-web-bundle.mjs       ← copia dist/public del isp-web a ./www
│  ├─ pack-ota.mjs              ← arma zip + manifest para OTA
│  └─ generate-keystore.sh
├─ www/                         ← (gitignored) bundle web copiado
└─ android/                     ← (gitignored) generado por `npx cap add android`
```

Los helpers nativos que el código web consume viven en
`artifacts/isp-web/src/lib/native/` (`platform`, `geolocation`, `camera`,
`storage`, `push`, `liveUpdate`). Cada uno detecta plataforma y elige
implementación nativa o web, así el mismo bundle corre como APK y como sitio
web sin cambios.
