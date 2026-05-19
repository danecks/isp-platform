#!/usr/bin/env node
/**
 * Variante de pack-ota.mjs que NO usa el binario `zip` del sistema
 * (que segfaulta en el sandbox de Replit). Usa JSZip puro de Node.
 */
import { readFile, writeFile, readdir, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const requireCJS = createRequire(import.meta.url);
const JSZip = requireCJS(
  resolve(here, "../../../node_modules/.pnpm/jszip@3.10.1/node_modules/jszip"),
);

const root = resolve(here, "..");
const SRC = resolve(root, "..", "isp-web", "dist", "public");
const OUT = resolve(root, "ota-out");

const VERSION = process.env.OTA_VERSION || "0.0.0";
const BASE_URL = (
  process.env.OTA_BASE_URL || "https://ispsa.net/api/app-updates"
).replace(/\/$/, "");
const NOTES = process.env.OTA_NOTES || "";

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const files = await walk(SRC);
console.log(`Archivos a empaquetar: ${files.length}`);

const zip = new JSZip();
for (const fp of files) {
  const rel = relative(SRC, fp).split("\\").join("/");
  zip.file(rel, await readFile(fp));
}

const buf = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});

const zipName = `v${VERSION}.zip`;
await writeFile(join(OUT, zipName), buf);

const checksum = createHash("sha256").update(buf).digest("hex");
const manifest = {
  version: VERSION,
  url: `${BASE_URL}/${zipName}`,
  checksum,
  releasedAt: new Date().toISOString(),
  notes: NOTES,
};
await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`✔ ${zipName} — ${(buf.length / 1048576).toFixed(2)} MB`);
console.log(`✔ checksum: ${checksum}`);
console.log(`✔ manifest:`, manifest);
