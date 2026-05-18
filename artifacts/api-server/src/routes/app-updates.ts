/**
 * Endpoints OTA para el wrapper Capacitor "ISP Operaciones".
 *
 *   GET /api/app-updates/manifest.json   → manifest con la versión activa
 *   GET /api/app-updates/:version.zip    → bundle web zipeado
 *
 * Los bundles se almacenan en Object Storage de Replit bajo el prefijo
 * `app-updates/` dentro de uno de los PUBLIC_OBJECT_SEARCH_PATHS. Esta es la
 * alternativa al deploy por SSH a ispsa.net documentada en publish-ota.yml.
 *
 * NO autenticado: el APK necesita poder pedir el manifest sin sesión. Los
 * bundles son JS público (sin secretos), igual que el sitio web servido a
 * cualquier navegador.
 */
import { Router, type IRouter } from "express";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

async function readManifest(): Promise<unknown | null> {
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

router.get("/api/app-updates/manifest.json", async (_req, res) => {
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
});

router.get("/api/app-updates/:bundle", async (req, res) => {
  const name = req.params["bundle"] ?? "";
  const match = /^v([A-Za-z0-9._-]+)\.zip$/.exec(name);
  if (!match || !VERSION_RE.test(match[1]!)) {
    res.status(400).json({ error: "nombre de bundle inválido" });
    return;
  }
  try {
    const file = await findBundle(match[1]!);
    if (!file) {
      res.status(404).json({ error: "bundle no encontrado" });
      return;
    }
    res.set("Content-Type", "application/zip");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    file.createReadStream().on("error", (err) => {
      logger.error({ err, version: match[1] }, "[OTA] error streaming bundle");
      if (!res.headersSent) res.status(500).end();
    }).pipe(res);
  } catch (err) {
    logger.error({ err }, "[OTA] error sirviendo bundle");
    res.status(500).json({ error: "error interno" });
  }
});

export default router;
