# Firebase Cloud Messaging (FCM) — Setup del wrapper Android

Pasos para activar **notificaciones push reales** en el APK de ISP Operaciones.
Sólo se hace una vez por proyecto Firebase; después cada APK nuevo lo hereda.

## 1) Crear el proyecto Firebase

1. Entrar a https://console.firebase.google.com → **Add project**.
2. Nombre sugerido: `isp-operaciones`. **Desactivar** Google Analytics (no lo
   usamos).
3. Dentro del proyecto: **Add app → Android**.
   - **Package name:** `com.ispsa.operaciones` (debe coincidir con
     `capacitor.config.ts → appId`; si cambia, FCM rechaza los tokens).
   - **App nickname:** `ISP Operaciones`.
   - **SHA-1 / SHA-256:** dejarlo en blanco — sólo se necesita si se usa
     Google Sign-In, no para push.
4. Firebase ofrece descargar **`google-services.json`** — guardarlo.

## 2) Colocar `google-services.json`

Copiar el archivo descargado a:

```
artifacts/isp-mobile-android/android/app/google-services.json
```

⚠️ **NO** committearlo al repo público. Está en `.gitignore` por defecto
(verificar antes de hacer push). Para CI/CD se inyecta como secreto.

## 3) Aplicar el plugin Gradle de Google Services

En `artifacts/isp-mobile-android/android/build.gradle` (raíz):

```gradle
buildscript {
    dependencies {
        // ...resto...
        classpath 'com.google.gms:google-services:4.4.2'
    }
}
```

Y al final de `artifacts/isp-mobile-android/android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    // ...resto...
    implementation platform('com.google.firebase:firebase-bom:33.5.1')
    implementation 'com.google.firebase:firebase-messaging'
}
```

(`@capacitor/push-notifications` se encarga del resto del wiring; no hace
falta declarar el `FirebaseMessagingService` manualmente.)

## 4) Permisos en `AndroidManifest.xml`

Ya están en `AndroidManifest-permissions.xml` (la línea de `POST_NOTIFICATIONS`
ya estaba para Android 13+).

## 5) Obtener la cuenta de servicio para el api-server

El api-server envía mensajes vía **Firebase Admin SDK**, que requiere una
cuenta de servicio:

1. Firebase Console → **Project settings → Service accounts**.
2. Botón **Generate new private key** → descarga un JSON.
3. Copiar el **contenido completo** del JSON.
4. Configurarlo como secreto en el deploy del api-server:

   ```
   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...",...}'
   ```

   En Replit Deployments: **Tools → Secrets → New secret**.

Si la variable **no** está configurada, `push.service.ts` entra en modo stub:
loggea lo que habría enviado y devuelve `{ simulated: true }` (útil en dev).

## 6) Build del APK nuevo

```bash
cd artifacts/isp-mobile-android
pnpm install        # asegura que @capacitor/push-notifications esté instalado
pnpm run build:apk  # compila web + cap sync + assembleRelease
```

El APK incluye ahora el SDK de FCM. Subirlo como release y propagar la
versión nueva a los dispositivos (los usuarios deben **instalar el APK
manualmente** — OTA no sirve para cambios de plugin nativo).

## 7) Verificar que funciona

1. Instalar el APK nuevo en un dispositivo.
2. Loguearse → el cliente registra el token contra `/api/push/tokens`.
3. Confirmar en la DB:
   ```sql
   SELECT id, user_id, platform, last_seen_at FROM push_tokens;
   ```
4. Disparar prueba desde el panel admin (cuando esté la UI) o por curl:
   ```bash
   curl -X POST $API/push/test \
     -H "Content-Type: application/json" \
     -d '{"userId": 1, "title": "Prueba", "body": "Hola desde el server"}'
   ```
5. El dispositivo debe mostrar la notificación en segundos.
6. Crear una emergencia → todos los admins/supervisores con APK reciben
   push automático (`🚨 Emergencia — <tipo>`).
