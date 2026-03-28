/**
 * storage.ts — Upload presigned URLs y servido de objetos GCS
 *
 * A-06: Permite subir fotos de evidencia de tareas directamente a GCS
 * en lugar de guardarlas como base64 en la DB.
 *
 * ENDPOINTS:
 *   POST /storage/uploads/request-url  → genera presigned URL para subir a GCS
 *   GET  /storage/public-objects/*     → sirve objetos públicos
 *   GET  /storage/objects/*            → sirve objetos privados
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 * Solicita URL presignada para subir archivo directamente a GCS.
 * Body: { name, size, contentType }
 * Returns: { uploadURL, objectPath }
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const { name, contentType } = req.body ?? {};
  if (!name || !contentType) {
    res.status(400).json({ error: "Se requieren name y contentType" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (error) {
    logger.error({ err: error }, "[storage] Error al generar URL presignada");
    res.status(500).json({ error: "Error al generar URL de carga" });
  }
});

/**
 * GET /storage/public-objects/*
 * Sirve objetos públicos sin autenticación.
 */
router.get("/storage/public-objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = (req.params as any).path as string;
    const file = await objectStorageService.searchPublicObject(raw);
    if (!file) {
      res.status(404).json({ error: "Archivo no encontrado" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    logger.error({ err: error }, "[storage] Error al servir objeto público");
    res.status(500).json({ error: "Error al servir objeto" });
  }
});

/**
 * GET /storage/objects/*
 * Sirve objetos privados (sin ACL por ahora — protegido por sesión ISP en el futuro).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = (req.params as any).path as string;
    const objectPath = `/objects/${raw}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Objeto no encontrado" });
      return;
    }
    logger.error({ err: error }, "[storage] Error al servir objeto");
    res.status(500).json({ error: "Error al servir objeto" });
  }
});

export default router;
