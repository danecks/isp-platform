/**
 * Endpoint público que entrega el APK de "ISP Operaciones" descargándolo
 * desde el release privado de GitHub. Existe porque el repo es privado y
 * los assets de releases no son accesibles sin autenticación, pero el APK
 * sí debe poder descargarse desde cualquier teléfono.
 *
 *   GET /api/descarga-apk           → última versión (DEFAULT_VERSION)
 *   GET /api/descarga-apk/0.2.0     → versión específica
 *
 * Implementación:
 *   1. Resuelve el release por tag `mobile-v{version}` (con caché en memoria).
 *   2. Localiza el asset `ISP-Operaciones-v{version}.apk`.
 *   3. Pide el download URL al API de GitHub con Accept: octet-stream.
 *      GitHub responde 302 con una URL firmada (signed S3) válida ~5 min.
 *   4. Valida que el host del Location esté en allowlist (defensa SSRF).
 *   5. Redirige al cliente — el navegador descarga directo de S3.
 *
 * Defensas (endpoint público):
 *   - Rate limit dedicado: 20 req/min/IP (más estricto que el global).
 *   - Caché en memoria del asset.id por tag (5 min) → reduce llamadas al
 *     API de GitHub y protege la cuota del PAT.
 *   - Allowlist de hosts permitidos en el redirect.
 *   - Mapeo correcto de errores upstream (401/403/429/5xx → 502/503).
 *
 * Requiere el secret `GITHUB_RELEASES_TOKEN` (PAT con `contents:read` sobre
 * danecks/isp-platform).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const REPO = "danecks/isp-platform";
const DEFAULT_VERSION = "0.2.0";
const TAG_PREFIX = "mobile-v";
const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const ASSET_CACHE_TTL_MS = 5 * 60 * 1000;
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

// Caché del asset por tag — el id de asset no cambia salvo que se reemplace
// el archivo en el release, por lo que 5 min es muy seguro.
const assetCache = new Map<string, { assetId: number; expiresAt: number }>();

const descargaApkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20, // 20 descargas/min/IP — más que suficiente para uso humano
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Demasiadas descargas. Esperá un momento e intentá de nuevo.",
});

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
  return { code: 502, msg: "GitHub no respondió correctamente. Reintentá." };
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
  const relRes = await fetch(
    `https://api.github.com/repos/${REPO}/releases/tags/${tag}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ispsa-api",
      },
    },
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
  assetCache.set(tag, { assetId: asset.id, expiresAt: now + ASSET_CACHE_TTL_MS });
  return { ok: true, assetId: asset.id };
}

async function handler(req: Request, res: Response): Promise<void> {
  const token = process.env["GITHUB_RELEASES_TOKEN"];
  if (!token) {
    logger.error("[descarga-apk] GITHUB_RELEASES_TOKEN no está configurado");
    res
      .status(503)
      .type("text/plain")
      .send(
        "La descarga del APK no está disponible en este momento. " +
          "Contactá al administrador.",
      );
    return;
  }

  const raw = (req.params["version"] || DEFAULT_VERSION).replace(/^v/, "");
  if (!SEMVER_RE.test(raw)) {
    res.status(400).type("text/plain").send("Versión inválida.");
    return;
  }
  const tag = `${TAG_PREFIX}${raw}`;
  const assetName = `ISP-Operaciones-v${raw}.apk`;

  try {
    const resolved = await resolveAssetId(tag, assetName, token);
    if (!resolved.ok) {
      const { code, msg } = mapUpstreamError(resolved.status);
      logger.warn(
        `[descarga-apk] resolve fallo tag=${tag} upstream=${resolved.status} → ${code}`,
      );
      res.status(code).type("text/plain").send(msg);
      return;
    }

    const dlRes = await fetch(
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
        logger.warn(`[descarga-apk] Location no parseable`);
        res.status(502).type("text/plain").send("Respuesta inválida del origen.");
        return;
      }
      if (!ALLOWED_REDIRECT_HOSTS.has(host)) {
        logger.warn(`[descarga-apk] host no permitido en redirect: ${host}`);
        res
          .status(502)
          .type("text/plain")
          .send("Destino de descarga no permitido.");
        return;
      }
      res.redirect(302, location);
      return;
    }
    // Si GitHub no devolvió un redirect, mapear status correctamente.
    if (dlRes.status >= 400) {
      const { code, msg } = mapUpstreamError(dlRes.status);
      logger.warn(
        `[descarga-apk] asset fallo id=${resolved.assetId} upstream=${dlRes.status} → ${code}`,
      );
      res.status(code).type("text/plain").send(msg);
      return;
    }
    logger.warn(`[descarga-apk] respuesta inesperada status=${dlRes.status}`);
    res
      .status(502)
      .type("text/plain")
      .send("No se pudo obtener el archivo en este momento.");
  } catch (err) {
    logger.error(`[descarga-apk] error: ${err}`);
    // Fallo de red/timeout hacia GitHub → 503 (servicio dependiente caído).
    res
      .status(503)
      .type("text/plain")
      .send("Servicio de descarga temporalmente no disponible.");
  }
}

router.get("/descarga-apk", descargaApkLimiter, handler);
router.get("/descarga-apk/:version", descargaApkLimiter, handler);

export default router;
