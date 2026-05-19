/**
 * Endpoints OTA para el wrapper Capacitor "ISP Operaciones".
 *
 *   GET /api/app-updates/manifest.json   → manifest con la versión activa
 *   GET /api/app-updates/v<version>.zip  → bundle web zipeado
 *   GET /app-updates/manifest.json       → alias raíz (URL bakeada en v0.2.0)
 *   GET /app-updates/v<version>.zip      → alias raíz
 *
 * Los bundles se almacenan en Object Storage de Replit bajo el prefijo
 * `app-updates/` dentro de uno de los PUBLIC_OBJECT_SEARCH_PATHS.
 *
 * NO autenticado: el APK necesita poder pedir el manifest sin sesión. Los
 * bundles son JS público (sin secretos), igual que el sitio web servido a
 * cualquier navegador.
 *
 * El alias raíz `/app-updates/*` existe porque el APK v0.2.0 tiene esa URL
 * baked y NO podemos cambiarla sin reinstalar — debe quedar funcional para
 * que OTA pueda entregar el fix.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const OTA_PREFIX = "app-updates";
const VERSION_RE = /^[A-Za-z0-9._-]+$/;

function getSearchPaths(): string[] {
  const raw = process.env["PUBLIC_OBJECT_SEARCH_PATHS"] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePath(p: string): { bucket: string; objectPath: string } | null {
  const trimmed = p.replace(/^\/+/, "");
  const slash = trimmed.indexOf("/");
  if (slash < 0) return null;
  return { bucket: trimmed.slice(0, slash), objectPath: trimmed.slice(slash + 1) };
}

export async function readManifest(): Promise<unknown | null> {
  for (const base of getSearchPaths()) {
    const parsed = parsePath(`${base.replace(/\/$/, "")}/${OTA_PREFIX}/manifest.json`);
    if (!parsed) continue;
    try {
      const file = objectStorageClient.bucket(parsed.bucket).file(parsed.objectPath);
      const [exists] = await file.exists();
      if (!exists) continue;
      const [buf] = await file.download();
      return JSON.parse(buf.toString("utf8"));
    } catch (err) {
      logger.warn({ err, base }, "[OTA] error leyendo manifest en este path");
    }
  }
  return null;
}

async function findBundle(version: string) {
  for (const base of getSearchPaths()) {
    const parsed = parsePath(`${base.replace(/\/$/, "")}/${OTA_PREFIX}/v${version}.zip`);
    if (!parsed) continue;
    const file = objectStorageClient.bucket(parsed.bucket).file(parsed.objectPath);
    const [exists] = await file.exists();
    if (exists) return file;
  }
  return null;
}

async function handleManifest(_req: Request, res: Response): Promise<void> {
  try {
    const m = await readManifest();
    if (!m) {
      res.status(404).json({ error: "manifest no publicado" });
      return;
    }
    res.set("Cache-Control", "no-store");
    res.json(m);
  } catch (err) {
    logger.error({ err }, "[OTA] error sirviendo manifest");
    res.status(500).json({ error: "error interno" });
  }
}

/**
 * Resuelve el nombre del bundle a un objeto de Object Storage y, si existe,
 * devuelve el `file` junto con los metadatos (tamaño + etag) necesarios para
 * responder HEAD y GET con `Content-Length` correcto.
 */
async function resolveBundle(name: string): Promise<
  | { error: "invalid" }
  | { error: "notfound" }
  | { file: ReturnType<ReturnType<typeof objectStorageClient.bucket>["file"]>; size: number; etag: string | undefined; version: string }
> {
  const match = /^v([A-Za-z0-9._-]+)\.zip$/.exec(name);
  if (!match || !VERSION_RE.test(match[1]!)) return { error: "invalid" };
  const version = match[1]!;
  const file = await findBundle(version);
  if (!file) return { error: "notfound" };
  const [meta] = await file.getMetadata();
  const sizeRaw = meta?.size;
  const size = typeof sizeRaw === "number" ? sizeRaw : parseInt(String(sizeRaw ?? "0"), 10) || 0;
  const etag = typeof meta?.etag === "string" ? meta.etag : undefined;
  return { file, size, etag, version };
}

function setBundleHeaders(res: Response, size: number, etag: string | undefined): void {
  res.set("Content-Type", "application/zip");
  res.set("Content-Length", String(size));
  res.set("Accept-Ranges", "bytes");
  // OJO: NO usar `immutable` ni cache largo. El plugin @capgo/capacitor-updater
  // hace HEAD periódico al .zip antes de descargar; con `immutable` algunos
  // stacks HTTP nativos cachean el HEAD fallido y nunca llegan a hacer el GET.
  // Cache corto + must-revalidate evita ese deadlock manteniendo CDN-friendly.
  res.set("Cache-Control", "public, max-age=60, must-revalidate");
  if (etag) res.set("ETag", etag);
}

async function handleBundleHead(req: Request, res: Response): Promise<void> {
  const name = req.params["bundle"] ?? "";
  try {
    const r = await resolveBundle(name);
    if ("error" in r) {
      res.status(r.error === "invalid" ? 400 : 404).end();
      return;
    }
    setBundleHeaders(res, r.size, r.etag);
    res.status(200).end();
  } catch (err) {
    logger.error({ err }, "[OTA] error en HEAD bundle");
    res.status(500).end();
  }
}

async function handleBundle(req: Request, res: Response): Promise<void> {
  const name = req.params["bundle"] ?? "";
  try {
    const r = await resolveBundle(name);
    if ("error" in r) {
      res.status(r.error === "invalid" ? 400 : 404).json({
        error: r.error === "invalid" ? "nombre de bundle inválido" : "bundle no encontrado",
      });
      return;
    }
    setBundleHeaders(res, r.size, r.etag);
    r.file
      .createReadStream()
      .on("error", (err) => {
        logger.error({ err, version: r.version }, "[OTA] error streaming bundle");
        if (!res.headersSent) res.status(500).end();
      })
      .pipe(res);
  } catch (err) {
    logger.error({ err }, "[OTA] error sirviendo bundle");
    res.status(500).json({ error: "error interno" });
  }
}

// Router montado bajo /api (vía routes/index.ts) → expone /api/app-updates/*
const router: IRouter = Router();
router.get("/app-updates/manifest.json", handleManifest);
router.head("/app-updates/manifest.json", handleManifest);
router.head("/app-updates/:bundle", handleBundleHead);
router.get("/app-updates/:bundle", handleBundle);

// Router montado en la raíz (vía app.ts) → expone /app-updates/* sin /api.
// Es la URL que el APK v0.2.0 tiene baked en capacitor.config.ts y liveUpdate.ts.
export const appUpdatesRootRouter: IRouter = Router();
appUpdatesRootRouter.get("/manifest.json", handleManifest);
appUpdatesRootRouter.head("/manifest.json", handleManifest);
appUpdatesRootRouter.head("/:bundle", handleBundleHead);
appUpdatesRootRouter.get("/:bundle", handleBundle);

export default router;
