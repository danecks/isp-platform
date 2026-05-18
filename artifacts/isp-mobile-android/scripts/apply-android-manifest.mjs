#!/usr/bin/env node
/**
 * Aplica de forma idempotente los permisos y el <service> requeridos por
 * los plugins de Capacitor a `android/app/src/main/AndroidManifest.xml`,
 * generado previamente por `npx cap add android`.
 *
 * Por qué existe este script:
 * - `npx cap add android` genera un AndroidManifest mínimo (sólo INTERNET).
 * - Los plugins nuevos (background-geolocation, push) requieren permisos
 *   extra Y la declaración de un <service> dentro de <application>.
 * - Hasta ahora el README pedía editar el XML "a mano". En CI eso no se
 *   hace, así que el APK quedaba sin los permisos / sin el <service> y
 *   el plugin de GPS en background no funcionaba al minimizar la app.
 *
 * Qué inserta:
 * - El bloque de <uses-permission> y <uses-feature> definido en
 *   `android-templates/AndroidManifest-permissions.xml` (la parte que NO
 *   está comentada).
 * - El <service> de @capacitor-community/background-geolocation con
 *   `foregroundServiceType="location"` dentro de <application>.
 *
 * Idempotente: si los nodos ya están presentes (detectados por un marcador
 * de comentario), no los duplica. Pensado para correr en cada build.
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const manifestPath = resolve(root, "android", "app", "src", "main", "AndroidManifest.xml");

const PERMISSIONS_MARKER = "<!-- ISP-permissions:start -->";
const PERMISSIONS_END = "<!-- ISP-permissions:end -->";
const SERVICE_MARKER = "<!-- ISP-bg-geolocation:start -->";
const SERVICE_END = "<!-- ISP-bg-geolocation:end -->";

const BG_SERVICE_CLASS =
  "com.equimaps.capacitorblbackgroundgeolocation.BackgroundGeolocationService";

// Permisos que el plugin de background-geolocation + el resto de la app
// requieren. La detección de duplicados es semántica (por nombre de
// permiso), no sólo por marker, para no chocar con manifests que un dev
// ya editó a mano.
const REQUIRED_PERMISSIONS = [
  { name: "android.permission.INTERNET", line: '<uses-permission android:name="android.permission.INTERNET" />' },
  { name: "android.permission.ACCESS_NETWORK_STATE", line: '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />' },
  { name: "android.permission.ACCESS_FINE_LOCATION", line: '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' },
  { name: "android.permission.ACCESS_COARSE_LOCATION", line: '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />' },
  { name: "android.permission.ACCESS_BACKGROUND_LOCATION", line: '<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />' },
  { name: "android.permission.CAMERA", line: '<uses-permission android:name="android.permission.CAMERA" />' },
  { name: "android.permission.READ_EXTERNAL_STORAGE", line: '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />' },
  { name: "android.permission.WRITE_EXTERNAL_STORAGE", line: '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />' },
  { name: "android.permission.FOREGROUND_SERVICE", line: '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />' },
  { name: "android.permission.FOREGROUND_SERVICE_LOCATION", line: '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />' },
  { name: "android.permission.POST_NOTIFICATIONS", line: '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' },
  { name: "android.permission.WAKE_LOCK", line: '<uses-permission android:name="android.permission.WAKE_LOCK" />' },
];

const REQUIRED_FEATURES = [
  { name: "android.hardware.camera", line: '<uses-feature android:name="android.hardware.camera" android:required="false" />' },
  { name: "android.hardware.location", line: '<uses-feature android:name="android.hardware.location" android:required="false" />' },
  { name: "android.hardware.location.gps", line: '<uses-feature android:name="android.hardware.location.gps" android:required="false" />' },
];

const SERVICE_BLOCK = `        ${SERVICE_MARKER}
        <service
            android:name="${BG_SERVICE_CLASS}"
            android:foregroundServiceType="location"
            android:exported="false" />
        ${SERVICE_END}`;

function hasPermission(xml, permName) {
  // Match <uses-permission ... android:name="permName" ... />
  // Tolerant a comillas simples/dobles y atributos extra.
  const re = new RegExp(
    `<uses-permission\\b[^>]*android:name\\s*=\\s*["']${permName.replace(/\./g, "\\.")}["']`,
  );
  return re.test(xml);
}

function hasFeature(xml, featName) {
  const re = new RegExp(
    `<uses-feature\\b[^>]*android:name\\s*=\\s*["']${featName.replace(/\./g, "\\.")}["']`,
  );
  return re.test(xml);
}

function hasService(xml, className) {
  const re = new RegExp(
    `<service\\b[^>]*android:name\\s*=\\s*["']${className.replace(/\./g, "\\.")}["']`,
  );
  return re.test(xml);
}

try {
  await stat(manifestPath);
} catch {
  console.error(`✗ No existe ${manifestPath}.`);
  console.error(`  Corré primero: cd artifacts/isp-mobile-android && npx cap add android`);
  process.exit(1);
}

let xml = await readFile(manifestPath, "utf8");
let touched = false;

// ── Permisos + features ──────────────────────────────────────────────
// Insertamos sólo los que NO estén ya presentes en el manifest (chequeo
// semántico por android:name). Esto evita duplicar entradas que un dev
// pudo haber agregado a mano sin usar nuestros markers.
const missingPerms = REQUIRED_PERMISSIONS.filter((p) => !hasPermission(xml, p.name));
const missingFeats = REQUIRED_FEATURES.filter((f) => !hasFeature(xml, f.name));

if (missingPerms.length === 0 && missingFeats.length === 0) {
  console.log("• Permisos y features requeridos ya están todos presentes.");
} else {
  const lines = [
    `    ${PERMISSIONS_MARKER}`,
    ...missingPerms.map((p) => `    ${p.line}`),
    ...missingFeats.map((f) => `    ${f.line}`),
    `    ${PERMISSIONS_END}`,
  ];
  const block = lines.join("\n");

  const manifestOpenMatch = xml.match(/<manifest\b[^>]*>/);
  if (!manifestOpenMatch) {
    console.error("✗ No encontré la etiqueta <manifest> en AndroidManifest.xml");
    process.exit(1);
  }
  const insertAt = manifestOpenMatch.index + manifestOpenMatch[0].length;
  xml = xml.slice(0, insertAt) + "\n" + block + "\n" + xml.slice(insertAt);

  console.log(
    `✔ Insertados ${missingPerms.length} permiso(s) y ${missingFeats.length} feature(s) faltantes.`,
  );
  for (const p of missingPerms) console.log(`    + ${p.name}`);
  for (const f of missingFeats) console.log(`    + uses-feature ${f.name}`);
  touched = true;
}

// ── <service> de background-geolocation ──────────────────────────────
// Chequeo semántico por className: si el dev ya lo agregó a mano (sin
// nuestro marker), no lo duplicamos — duplicar <service android:name=...>
// rompe el manifest merger de Gradle.
if (hasService(xml, BG_SERVICE_CLASS)) {
  console.log("• <service> de background-geolocation ya presente, no se duplica.");
} else {
  const closeApp = xml.lastIndexOf("</application>");
  if (closeApp === -1) {
    console.error("✗ No encontré </application> en AndroidManifest.xml");
    process.exit(1);
  }
  xml = xml.slice(0, closeApp) + SERVICE_BLOCK + "\n    " + xml.slice(closeApp);
  console.log("✔ <service> de background-geolocation insertado.");
  touched = true;
}

if (touched) {
  await writeFile(manifestPath, xml, "utf8");
  console.log(`✔ AndroidManifest.xml actualizado: ${manifestPath}`);
} else {
  console.log("✔ AndroidManifest.xml ya estaba al día — nada que hacer.");
}
