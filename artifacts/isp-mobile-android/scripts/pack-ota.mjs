#!/usr/bin/env node
/**
 * Empaqueta el bundle web compilado como un zip versionado listo para
 * subir a ispsa.net/app-updates/.
 *
 * Salida:
 *   ota-out/v<versionName>-<sha>.zip
 *   ota-out/manifest.json   { version, url, checksum, releasedAt, notes }
 *
 * Variables de entorno:
 *   OTA_VERSION   ej: 1.4.2  (default: timestamp UTC)
 *   OTA_BASE_URL  ej: https://ispsa.net/app-updates  (default)
 *   OTA_NOTES     texto libre opcional
 */
import { cp, rm, mkdir, stat, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "..", "isp-web", "dist", "public");
const out = resolve(root, "ota-out");

try { await stat(src); } catch {
  console.error(`No existe ${src}. Corré: pnpm --filter @workspace/isp-web build`);
  process.exit(1);
}

const now = new Date();
const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const version = process.env.OTA_VERSION ?? stamp;
const baseUrl = (process.env.OTA_BASE_URL ?? "https://ispsa.net/app-updates").replace(/\/$/, "");
const notes = process.env.OTA_NOTES ?? "";
const zipName = `v${version}.zip`;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const r = spawnSync("zip", ["-r", "-q", resolve(out, zipName), "."], { cwd: src, stdio: "inherit" });
if (r.status !== 0) { console.error("Falló zip"); process.exit(r.status ?? 1); }

const buf = await readFile(resolve(out, zipName));
// Capgo @capgo/capacitor-updater v6 espera SHA-256 en hex plano (sin prefijo
// `sha256-`). Si se manda con prefijo, el nativo invalida el bundle bajado y
// nunca lo aplica (síntoma: HEAD al .zip y ningún GET — el plugin desiste).
const checksum = createHash("sha256").update(buf).digest("hex");
const manifest = {
  version,
  url: `${baseUrl}/${zipName}`,
  checksum,
  releasedAt: now.toISOString(),
  notes,
};
await writeFile(resolve(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`✔ OTA bundle listo en ${out}\n  zip: ${zipName}\n  version: ${version}\n  checksum: ${checksum}`);
