#!/usr/bin/env node
/**
 * Sube ota-out/manifest.json y ota-out/v<VERSION>.zip a Object Storage
 * bajo `<PUBLIC_OBJECT_SEARCH_PATHS[0]>/app-updates/` usando el sidecar de
 * Replit (mismo cliente que api-server/src/lib/objectStorage.ts).
 *
 * Variables:
 *   OTA_VERSION  (default: lee manifest.version)
 */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const requireCJS = createRequire(import.meta.url);
const { Storage } = requireCJS(
  resolve(
    here,
    "../../../node_modules/.pnpm/@google-cloud+storage@7.19.0/node_modules/@google-cloud/storage",
  ),
);

const SIDECAR = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const searchPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (!searchPaths.length) {
  console.error("PUBLIC_OBJECT_SEARCH_PATHS no está seteado");
  process.exit(1);
}
const base = searchPaths[0].replace(/\/$/, "");
const trimmed = base.replace(/^\/+/, "");
const slash = trimmed.indexOf("/");
const bucketName = trimmed.slice(0, slash);
const basePrefix = trimmed.slice(slash + 1); // "public"

const OTA_DIR = resolve(here, "..", "ota-out");
const manifest = JSON.parse(
  await readFile(resolve(OTA_DIR, "manifest.json"), "utf8"),
);
const version = process.env.OTA_VERSION || manifest.version;
const zipName = `v${version}.zip`;
const zipBuf = await readFile(resolve(OTA_DIR, zipName));
const manifestBuf = await readFile(resolve(OTA_DIR, "manifest.json"));

const bucket = storage.bucket(bucketName);

async function upload(objectName, buf, contentType) {
  const file = bucket.file(objectName);
  await file.save(buf, { contentType, resumable: false });
  console.log(`✔ ${objectName} (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.log(`Bucket: ${bucketName}`);
console.log(`Prefix: ${basePrefix}/app-updates/`);

await upload(`${basePrefix}/app-updates/${zipName}`, zipBuf, "application/zip");
await upload(
  `${basePrefix}/app-updates/manifest.json`,
  manifestBuf,
  "application/json",
);

console.log("✅ OTA publicado. Manifest:", manifest);
