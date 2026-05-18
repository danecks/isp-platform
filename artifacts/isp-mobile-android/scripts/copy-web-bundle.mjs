#!/usr/bin/env node
/**
 * Copia el bundle compilado de @workspace/isp-web a ./www/ para que
 * `cap sync` lo empaquete dentro del APK.
 *
 * Requiere haber corrido antes: pnpm --filter @workspace/isp-web build
 */
import { cp, rm, stat, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "..", "isp-web", "dist", "public");
const dst = resolve(root, "www");

try {
  await stat(src);
} catch {
  console.error(`No existe el bundle web en ${src}. Corré primero: pnpm --filter @workspace/isp-web build`);
  process.exit(1);
}

await rm(dst, { recursive: true, force: true });
await mkdir(dst, { recursive: true });
await cp(src, dst, { recursive: true });
console.log(`✔ Bundle web copiado a ${dst}`);
