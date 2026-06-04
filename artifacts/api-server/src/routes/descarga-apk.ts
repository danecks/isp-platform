/**
 * Endpoint público que entrega el APK de "ISP Operaciones" SIRVIÉNDOLO DESDE
 * ispsa.net (Object Storage propio), no desde GitHub.
 *
 *   GET /api/descarga-apk           → última versión publicada
 *   GET /api/descarga-apk/1.0.6     → versión específica
 *
 * Estrategia "espejo perezoso":
 *   1. Resuelve la versión a entregar:
 *        - si viene en la URL, esa.
 *        - si no, la última release `mobile-v*` de GitHub (con caché). Si GitHub
 *          no está disponible, cae a la versión más alta que ya tengamos guardada.
 *   2. Si el APK ya está en Object Storage (prefijo `app-downloads/`), lo entrega
 *      por streaming directamente desde ispsa.net — sin tocar GitHub.
 *   3. Si NO está, lo descarga UNA vez desde el release privado de GitHub, lo
 *      guarda en Object Storage y lo entrega. A partir de ahí queda 100% en
 *      ispsa.net, aunque GitHub esté caído.
 *
 * El APK queda alojado bajo `app-downloads/ISP-Operaciones-v{version}.apk` dentro
 * de uno de los PUBLIC_OBJECT_SEARCH_PATHS (mismo bucket que los bundles OTA).
 *
 * Defensas (endpoint público):
 *   - Rate limit dedicado: 20 req/min/IP.
 *   - Caché en memoria de la última versión y del asset.id por tag (5 min).
 *   - Allowlist de hosts permitidos al copiar desde GitHub (defensa SSRF).
 *
 * El secret `GITHUB_RELEASES_TOKEN` (PAT con `contents:read`) solo se necesita
 * la PRIMERA vez que se copia una versión nueva. Si el APK ya está en ispsa.net,
 * se sirve sin token y sin GitHub.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const REPO = "danecks/isp-platform";
const TAG_PREFIX = "mobile-v";
const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const CACHE_TTL_MS = 5 * 60 * 1000;
const DOWNLOAD_PREFIX = "app-downloads";
const APK_MIME = "application/vnd.android.package-archive";
const ALLOWED_REDIRECT_HOSTS = new Set([
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

interface ReleaseAsset {
  id: number;
  name: string;
}
interface ReleaseResponse {
  assets?: ReleaseAsset[];
}

// Caché del asset por tag y de la última versión conocida.
const assetCache = new Map<string, { assetId: number; expiresAt: number }>();
let latestCache: { version: string; expiresAt: number } | null = null;
// Singleflight: si llegan varias descargas de una versión aún no copiada, solo
// UNA baja el binario desde GitHub; las demás esperan ese mismo resultado.
type SeedResult = { ok: true; buffer: Buffer } | { ok: false; status: number };
const seedInflight = new Map<string, Promise<SeedResult>>();

const descargaApkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20, // 20 descargas/min/IP — más que suficiente para uso humano
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Demasiadas descargas. Esperá un momento e intentá de nuevo.",
});

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ispsa-api",
  };
}

const API_TIMEOUT_MS = 15_000; // llamadas al API de GitHub (JSON)
const BINARY_TIMEOUT_MS = 90_000; // descarga del binario del APK (~31 MB)

/** fetch con timeout/abort para que un upstream lento no deje requests colgadas. */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

function mapUpstreamError(status: number): { code: number; msg: string } {
  if (status === 404) {
    return { code: 404, msg: "Esa versión no existe." };
  }
  if (status === 401 || status === 403) {
    return {
      code: 503,
      msg: "La descarga no está disponible (configuración del servidor).",
    };
  }
  if (status === 429) {
    return {
      code: 503,
      msg: "Demasiadas descargas en este momento. Probá en unos minutos.",
    };
  }
  return { code: 502, msg: "No se pudo obtener el archivo. Reintentá." };
}

// ---------------------------------------------------------------------------
// Object Storage helpers
// ---------------------------------------------------------------------------

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

function apkObjectName(version: string): string {
  return `ISP-Operaciones-v${version}.apk`;
}

type StorageFile = ReturnType<ReturnType<typeof objectStorageClient.bucket>["file"]>;

async function findApk(version: string): Promise<StorageFile | null> {
  const name = apkObjectName(version);
  for (const base of getSearchPaths()) {
    const parsed = parsePath(`${base.replace(/\/$/, "")}/${DOWNLOAD_PREFIX}/${name}`);
    if (!parsed) continue;
    const file = objectStorageClient.bucket(parsed.bucket).file(parsed.objectPath);
    const [exists] = await file.exists();
    if (exists) return file;
  }
  return null;
}

function cmpSemver(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Versión más alta ya guardada en Object Storage (fallback si GitHub no responde). */
async function scanStorageLatest(): Promise<string | null> {
  let best: number[] | null = null;
  let bestStr: string | null = null;
  for (const base of getSearchPaths()) {
    const parsed = parsePath(`${base.replace(/\/$/, "")}/${DOWNLOAD_PREFIX}/`);
    if (!parsed) continue;
    try {
      const [files] = await objectStorageClient
        .bucket(parsed.bucket)
        .getFiles({ prefix: parsed.objectPath });
      for (const f of files) {
        const name = f.name.split("/").pop() ?? "";
        const m = /^ISP-Operaciones-v(\d+)\.(\d+)\.(\d+)\.apk$/.exec(name);
        if (!m) continue;
        const v = [Number(m[1]), Number(m[2]), Number(m[3])];
        if (!best || cmpSemver(v, best) > 0) {
          best = v;
          bestStr = `${v[0]}.${v[1]}.${v[2]}`;
        }
      }
    } catch (err) {
      logger.warn({ err, base }, "[descarga-apk] error escaneando storage");
    }
  }
  return bestStr;
}

/** Guarda el buffer del APK en Object Storage (best-effort). */
async function saveApk(version: string, buffer: Buffer): Promise<void> {
  const base = getSearchPaths()[0];
  if (!base) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS no configurado");
  const parsed = parsePath(`${base.replace(/\/$/, "")}/${DOWNLOAD_PREFIX}/${apkObjectName(version)}`);
  if (!parsed) throw new Error("ruta de almacenamiento inválida");
  await objectStorageClient
    .bucket(parsed.bucket)
    .file(parsed.objectPath)
    .save(buffer, { contentType: APK_MIME, resumable: false });
}

// ---------------------------------------------------------------------------
// GitHub helpers (solo para la primera copia de cada versión)
// ---------------------------------------------------------------------------

/** Última versión `mobile-v*` publicada en GitHub (con caché 5 min). */
async function resolveLatestVersion(token: string): Promise<string | null> {
  const now = Date.now();
  if (latestCache && latestCache.expiresAt > now) return latestCache.version;
  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/repos/${REPO}/releases?per_page=100`,
      { headers: githubHeaders(token) },
    );
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{ tag_name?: string; draft?: boolean }>;
    let best: number[] | null = null;
    let bestStr: string | null = null;
    for (const r of list) {
      if (!r.tag_name || r.draft) continue;
      const m = /^mobile-v(\d+)\.(\d+)\.(\d+)$/.exec(r.tag_name);
      if (!m) continue;
      const v = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (!best || cmpSemver(v, best) > 0) {
        best = v;
        bestStr = `${v[0]}.${v[1]}.${v[2]}`;
      }
    }
    if (bestStr) latestCache = { version: bestStr, expiresAt: now + CACHE_TTL_MS };
    return bestStr;
  } catch (err) {
    logger.warn({ err }, "[descarga-apk] no se pudo resolver última versión de GitHub");
    return null;
  }
}

async function resolveAssetId(
  tag: string,
  assetName: string,
  token: string,
): Promise<{ ok: true; assetId: number } | { ok: false; status: number }> {
  const cached = assetCache.get(tag);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { ok: true, assetId: cached.assetId };
  }
  const relRes = await fetchWithTimeout(
    `https://api.github.com/repos/${REPO}/releases/tags/${tag}`,
    { headers: githubHeaders(token) },
  );
  if (!relRes.ok) {
    return { ok: false, status: relRes.status };
  }
  const rel = (await relRes.json()) as ReleaseResponse;
  const asset =
    rel.assets?.find((a) => a.name === assetName) ||
    rel.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
  if (!asset) {
    return { ok: false, status: 404 };
  }
  assetCache.set(tag, { assetId: asset.id, expiresAt: now + CACHE_TTL_MS });
  return { ok: true, assetId: asset.id };
}

/** Descarga el binario del APK desde el release de GitHub (primera copia). */
async function fetchApkFromGitHub(
  version: string,
  token: string,
): Promise<{ ok: true; buffer: Buffer } | { ok: false; status: number }> {
  const tag = `${TAG_PREFIX}${version}`;
  const assetName = apkObjectName(version);
  const resolved = await resolveAssetId(tag, assetName, token);
  if (!resolved.ok) return { ok: false, status: resolved.status };

  const dlRes = await fetchWithTimeout(
    `https://api.github.com/repos/${REPO}/releases/assets/${resolved.assetId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/octet-stream",
        "User-Agent": "ispsa-api",
      },
      redirect: "manual",
    },
  );

  const location = dlRes.headers.get("location");
  if ((dlRes.status === 302 || dlRes.status === 301) && location) {
    let host: string;
    try {
      host = new URL(location).hostname;
    } catch {
      logger.warn("[descarga-apk] Location no parseable");
      return { ok: false, status: 502 };
    }
    if (!ALLOWED_REDIRECT_HOSTS.has(host)) {
      logger.warn(`[descarga-apk] host no permitido en redirect: ${host}`);
      return { ok: false, status: 502 };
    }
    const binRes = await fetchWithTimeout(location, {}, BINARY_TIMEOUT_MS);
    if (!binRes.ok) return { ok: false, status: binRes.status };
    return { ok: true, buffer: Buffer.from(await binRes.arrayBuffer()) };
  }
  if (dlRes.status >= 400) {
    return { ok: false, status: dlRes.status };
  }
  // GitHub respondió el binario directo (sin redirect).
  return { ok: true, buffer: Buffer.from(await dlRes.arrayBuffer()) };
}

/**
 * Copia una versión desde GitHub a Object Storage (una sola vez por versión)
 * y devuelve el buffer. Usa singleflight: descargas concurrentes de la misma
 * versión comparten una única bajada + guardado.
 */
function seedApk(version: string, token: string): Promise<SeedResult> {
  const existing = seedInflight.get(version);
  if (existing) return existing;
  const p = (async (): Promise<SeedResult> => {
    const fetched = await fetchApkFromGitHub(version, token);
    if (fetched.ok) {
      try {
        await saveApk(version, fetched.buffer);
        logger.info(`[descarga-apk] APK v${version} copiado a Object Storage`);
      } catch (err) {
        logger.error({ err, version }, "[descarga-apk] no se pudo guardar el APK en storage");
      }
    }
    return fetched;
  })();
  seedInflight.set(version, p);
  void p.finally(() => seedInflight.delete(version)).catch(() => {});
  return p;
}

// ---------------------------------------------------------------------------
// Respuesta
// ---------------------------------------------------------------------------

function setApkHeaders(res: Response, version: string, size: number | null): void {
  res.set("Content-Type", APK_MIME);
  res.set(
    "Content-Disposition",
    `attachment; filename="${apkObjectName(version)}"`,
  );
  res.set("Cache-Control", "public, max-age=300");
  if (size != null) res.set("Content-Length", String(size));
}

async function streamFromStorage(
  file: StorageFile,
  res: Response,
  version: string,
): Promise<void> {
  const [meta] = await file.getMetadata();
  const sizeRaw = meta?.size;
  const size =
    typeof sizeRaw === "number"
      ? sizeRaw
      : parseInt(String(sizeRaw ?? "0"), 10) || null;
  setApkHeaders(res, version, size);
  file
    .createReadStream()
    .on("error", (err) => {
      logger.error({ err, version }, "[descarga-apk] error streaming desde storage");
      if (!res.headersSent) res.status(500).end();
    })
    .pipe(res);
}

async function handler(req: Request, res: Response): Promise<void> {
  const token = process.env["GITHUB_RELEASES_TOKEN"];

  // 1. Determinar la versión a entregar.
  let version: string | null = null;
  const rawParam = req.params["version"];
  if (rawParam !== undefined) {
    const raw = String(rawParam).replace(/^v/, "");
    if (!SEMVER_RE.test(raw)) {
      res.status(400).type("text/plain").send("Versión inválida.");
      return;
    }
    version = raw;
  } else {
    if (token) version = await resolveLatestVersion(token);
    if (!version) version = await scanStorageLatest();
  }
  if (!version) {
    logger.warn("[descarga-apk] no se pudo resolver versión (sin GitHub ni storage)");
    res
      .status(503)
      .type("text/plain")
      .send("La descarga no está disponible en este momento.");
    return;
  }

  try {
    // 2. Si ya está en ispsa.net, servir directo (sin tocar GitHub).
    const existing = await findApk(version);
    if (existing) {
      await streamFromStorage(existing, res, version);
      return;
    }

    // 3. Primera copia: traer desde GitHub, guardar y servir.
    if (!token) {
      logger.error("[descarga-apk] GITHUB_RELEASES_TOKEN no configurado y APK no está en storage");
      res
        .status(503)
        .type("text/plain")
        .send("La descarga no está disponible en este momento.");
      return;
    }

    const fetched = await seedApk(version, token);
    if (!fetched.ok) {
      const { code, msg } = mapUpstreamError(fetched.status);
      logger.warn(`[descarga-apk] copia desde GitHub falló v=${version} upstream=${fetched.status} → ${code}`);
      res.status(code).type("text/plain").send(msg);
      return;
    }

    setApkHeaders(res, version, fetched.buffer.length);
    res.send(fetched.buffer);
  } catch (err) {
    logger.error(`[descarga-apk] error: ${err}`);
    if (!res.headersSent) {
      res
        .status(503)
        .type("text/plain")
        .send("Servicio de descarga temporalmente no disponible.");
    }
  }
}

router.get("/descarga-apk", descargaApkLimiter, handler);
router.get("/descarga-apk/:version", descargaApkLimiter, handler);

export default router;
