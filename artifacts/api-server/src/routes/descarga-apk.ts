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
 *   1. Resuelve el release por tag `mobile-v{version}`.
 *   2. Localiza el asset `ISP-Operaciones-v{version}.apk`.
 *   3. Pide el download URL al API de GitHub con Accept: octet-stream.
 *      GitHub responde 302 con una URL firmada (signed S3) válida ~5 min.
 *   4. Redirige al cliente a esa URL firmada — el navegador descarga
 *      directo de S3, no consume ancho de banda nuestro.
 *
 * Requiere el secret `GITHUB_RELEASES_TOKEN` (PAT con `contents:read` sobre
 * danecks/isp-platform). Si falta, devuelve 503 con mensaje claro.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const REPO = "danecks/isp-platform";
const DEFAULT_VERSION = "0.2.0";
const TAG_PREFIX = "mobile-v";
const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;

interface ReleaseAsset {
  id: number;
  name: string;
}
interface ReleaseResponse {
  assets?: ReleaseAsset[];
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
      logger.warn(`[descarga-apk] release ${tag} no existe (${relRes.status})`);
      res.status(404).type("text/plain").send("Esa versión no existe.");
      return;
    }
    const rel = (await relRes.json()) as ReleaseResponse;
    const asset =
      rel.assets?.find((a) => a.name === assetName) ||
      rel.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
    if (!asset) {
      logger.warn(`[descarga-apk] APK no encontrado en release ${tag}`);
      res
        .status(404)
        .type("text/plain")
        .send("El APK no está disponible en este release.");
      return;
    }

    const dlRes = await fetch(
      `https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`,
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
      res.redirect(302, location);
      return;
    }
    logger.warn(
      `[descarga-apk] respuesta inesperada de GitHub: status=${dlRes.status}`,
    );
    res
      .status(502)
      .type("text/plain")
      .send("No se pudo obtener el archivo en este momento.");
  } catch (err) {
    logger.error(`[descarga-apk] error: ${err}`);
    res.status(500).type("text/plain").send("Error al obtener el APK.");
  }
}

router.get("/descarga-apk", handler);
router.get("/descarga-apk/:version", handler);

export default router;
