#!/usr/bin/env node
/**
 * Sube de versión Android Gradle Plugin (AGP) y Gradle wrapper en el
 * proyecto Android generado por `npx cap add android`.
 *
 * Por qué existe:
 * - `@capacitor/android@6.x` genera AGP 8.2.1 + Gradle 8.2.1, que sólo
 *   soportan compileSdk hasta 34.
 * - Alguno de nuestros plugins (background-geolocation / capgo updater)
 *   requiere compileSdk 35, y el build falla con:
 *     "plugin 8.2.1 is 34. Update Android Gradle plugin to one that
 *      supports 35".
 * - AGP 8.7.x soporta compileSdk 35 y requiere Gradle >= 8.9.
 *
 * Idempotente: detecta la versión actual y solo reemplaza si está por
 * debajo del mínimo requerido. Pensado para correr en CI después de
 * `npx cap add android` y antes de `./gradlew assembleRelease`.
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const buildGradle = resolve(root, "android/build.gradle");
const variablesGradle = resolve(root, "android/variables.gradle");
const appBuildGradle = resolve(root, "android/app/build.gradle");
const wrapperProps = resolve(
  root,
  "android/gradle/wrapper/gradle-wrapper.properties",
);

const AGP_TARGET = "8.7.2";
const GRADLE_TARGET = "8.9";
const COMPILE_SDK_TARGET = 35;
const TARGET_SDK_TARGET = 35;
const MIN_SDK_TARGET = 26;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function patchAgp() {
  if (!(await exists(buildGradle))) {
    console.log(`[patch-android-gradle] SKIP: ${buildGradle} no existe`);
    return false;
  }
  const src = await readFile(buildGradle, "utf8");
  const re = /com\.android\.tools\.build:gradle:([\d.]+)/;
  const m = src.match(re);
  if (!m) {
    console.warn(
      "[patch-android-gradle] No encontré classpath de AGP en build.gradle",
    );
    return false;
  }
  if (m[1] === AGP_TARGET) {
    console.log(`[patch-android-gradle] AGP ya está en ${AGP_TARGET}`);
    return false;
  }
  const out = src.replace(re, `com.android.tools.build:gradle:${AGP_TARGET}`);
  await writeFile(buildGradle, out, "utf8");
  console.log(`[patch-android-gradle] AGP ${m[1]} → ${AGP_TARGET}`);
  return true;
}

async function patchGradleWrapper() {
  if (!(await exists(wrapperProps))) {
    console.log(`[patch-android-gradle] SKIP: ${wrapperProps} no existe`);
    return false;
  }
  const src = await readFile(wrapperProps, "utf8");
  const re = /gradle-([\d.]+)-(all|bin)\.zip/;
  const m = src.match(re);
  if (!m) {
    console.warn(
      "[patch-android-gradle] No encontré distributionUrl en wrapper props",
    );
    return false;
  }
  if (m[1] === GRADLE_TARGET) {
    console.log(`[patch-android-gradle] Gradle wrapper ya en ${GRADLE_TARGET}`);
    return false;
  }
  const out = src.replace(
    re,
    `gradle-${GRADLE_TARGET}-${m[2]}.zip`,
  );
  await writeFile(wrapperProps, out, "utf8");
  console.log(
    `[patch-android-gradle] Gradle wrapper ${m[1]} → ${GRADLE_TARGET}`,
  );
  return true;
}

async function patchVariablesGradle() {
  if (!(await exists(variablesGradle))) {
    console.log(`[patch-android-gradle] SKIP: ${variablesGradle} no existe`);
    return false;
  }
  let src = await readFile(variablesGradle, "utf8");
  const before = src;
  // Cada línea suele ser: `compileSdkVersion = 34` / `targetSdkVersion = 34`
  // / `minSdkVersion = 22`. Reemplazamos sólo si están por debajo del target.
  const bumps = [
    { name: "minSdkVersion", target: MIN_SDK_TARGET },
    { name: "compileSdkVersion", target: COMPILE_SDK_TARGET },
    { name: "targetSdkVersion", target: TARGET_SDK_TARGET },
  ];
  for (const { name, target } of bumps) {
    const re = new RegExp(`(${name}\\s*=\\s*)(\\d+)`);
    const m = src.match(re);
    if (!m) continue;
    const cur = parseInt(m[2], 10);
    if (cur < target) {
      src = src.replace(re, `$1${target}`);
      console.log(`[patch-android-gradle] ${name} ${cur} → ${target}`);
    } else {
      console.log(`[patch-android-gradle] ${name} ya en ${cur} (>= ${target})`);
    }
  }
  if (src !== before) {
    await writeFile(variablesGradle, src, "utf8");
    return true;
  }
  return false;
}

async function patchAppBuildGradle() {
  if (!(await exists(appBuildGradle))) {
    console.log(`[patch-android-gradle] SKIP: ${appBuildGradle} no existe`);
    return false;
  }
  let src = await readFile(appBuildGradle, "utf8");
  const before = src;
  // Capacitor 6.x hardcodea `minSdkVersion 24` / `targetSdkVersion 34` /
  // `compileSdk 34` directamente en defaultConfig (NO referenciando
  // rootProject.ext). Forzamos los valores acá para el merger del manifest.
  const bumps = [
    { re: /(\bminSdkVersion\s+)(\d+)/, target: MIN_SDK_TARGET, name: "minSdkVersion" },
    { re: /(\btargetSdkVersion\s+)(\d+)/, target: TARGET_SDK_TARGET, name: "targetSdkVersion" },
    { re: /(\bcompileSdkVersion\s+)(\d+)/, target: COMPILE_SDK_TARGET, name: "compileSdkVersion" },
    { re: /(\bcompileSdk\s+)(\d+)/, target: COMPILE_SDK_TARGET, name: "compileSdk" },
  ];
  for (const { re, target, name } of bumps) {
    const m = src.match(re);
    if (!m) {
      console.log(`[patch-android-gradle] app/build.gradle: ${name} no encontrado`);
      continue;
    }
    const cur = parseInt(m[2], 10);
    if (cur < target) {
      src = src.replace(re, `$1${target}`);
      console.log(`[patch-android-gradle] app/build.gradle ${name} ${cur} → ${target}`);
    } else {
      console.log(`[patch-android-gradle] app/build.gradle ${name} ya en ${cur}`);
    }
  }
  if (src !== before) {
    await writeFile(appBuildGradle, src, "utf8");
  }

  // Fuerza bruta: appendear bloque override al final del archivo. En Gradle,
  // los bloques `android { defaultConfig { ... } }` repetidos se mergean y
  // el último valor escalar gana. Esto garantiza que min/target/compile
  // queden en los valores que necesitamos, sin importar qué hizo el regex
  // de arriba ni qué referenciaba el template original (rootProject.ext.*).
  const MARKER = "// ── ISP sdk override ─────────────────────────────";
  if (!src.includes(MARKER)) {
    const block = [
      "",
      MARKER,
      "android {",
      "    compileSdk " + COMPILE_SDK_TARGET,
      "    defaultConfig {",
      "        minSdkVersion " + MIN_SDK_TARGET,
      "        targetSdkVersion " + TARGET_SDK_TARGET,
      "    }",
      "}",
      "",
    ].join("\n");
    await writeFile(appBuildGradle, src + block, "utf8");
    console.log(
      `[patch-android-gradle] override block appendeado a app/build.gradle`,
    );
  } else {
    console.log(`[patch-android-gradle] override block ya presente`);
  }
  return true;
}

// Algunos templates de Capacitor escriben <uses-sdk> directamente en el
// AndroidManifest, lo que invalida lo que diga build.gradle. Borramos
// cualquier <uses-sdk> del manifest del app para que sólo gobierne gradle.
const appManifest = resolve(root, "android/app/src/main/AndroidManifest.xml");
async function stripUsesSdkFromManifest() {
  if (!(await exists(appManifest))) {
    console.log(`[patch-android-gradle] SKIP manifest: no existe`);
    return false;
  }
  const src = await readFile(appManifest, "utf8");
  const re = /<uses-sdk\b[^/>]*\/>\s*|<uses-sdk\b[\s\S]*?<\/uses-sdk>\s*/g;
  if (!re.test(src)) {
    console.log(`[patch-android-gradle] manifest: sin <uses-sdk>, OK`);
    return false;
  }
  const out = src.replace(re, "");
  await writeFile(appManifest, out, "utf8");
  console.log(`[patch-android-gradle] manifest: <uses-sdk> removido`);
  return true;
}

await patchAgp();
await patchGradleWrapper();
await patchVariablesGradle();
await patchAppBuildGradle();
await stripUsesSdkFromManifest();
console.log("[patch-android-gradle] OK");
