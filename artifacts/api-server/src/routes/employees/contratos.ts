import { Router, type Request, type Response } from "express";
import sharp from "sharp";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

// Limita la concurrencia de procesamiento de imágenes para evitar saturar
// CPU/memoria si llegan varios uploads simultáneos.
sharp.concurrency(2);

const router = Router();

// ─── GET /api/employees/:id/contratos ────────────────────────────────────────
router.get("/employees/:id/contratos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(`
      SELECT id, employee_id, tipo_contrato, etiqueta,
             TO_CHAR(fecha_contrato, 'YYYY-MM-DD') AS fecha_contrato,
             TO_CHAR(fecha_inicio,   'YYYY-MM-DD') AS fecha_inicio,
             TO_CHAR(fecha_fin,      'YYYY-MM-DD') AS fecha_fin,
             puesto, sueldo_base, observaciones,
             generado_automatico, metadata, created_at
      FROM contratos_empleados
      WHERE employee_id = $1
      ORDER BY fecha_contrato ASC, id ASC
    `, [id]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /employees/:id/contratos error");
    res.status(500).json({ error: "Error al obtener contratos" });
  }
});

// ─── POST /api/employees/:id/contratos ───────────────────────────────────────
router.post("/employees/:id/contratos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { tipoContrato, etiqueta, fechaContrato, fechaInicio, fechaFin, puesto, sueldoBase, observaciones } = req.body ?? {};
  if (!etiqueta || !fechaContrato || !fechaInicio) {
    return res.status(400).json({ error: "etiqueta, fechaContrato y fechaInicio son requeridos" });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO contratos_empleados
        (employee_id, tipo_contrato, etiqueta, fecha_contrato, fecha_inicio, fecha_fin, puesto, sueldo_base, observaciones, generado_automatico)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
      RETURNING *
    `, [id, tipoContrato ?? "inicial", etiqueta, fechaContrato, fechaInicio, fechaFin ?? null, puesto ?? null, sueldoBase ?? null, observaciones ?? null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /employees/:id/contratos error");
    res.status(500).json({ error: "Error al crear contrato" });
  }
});

// ─── PATCH /api/employees/:id/foto ───────────────────────────────────────────
// Actualiza la foto_url del empleado (ruta del objeto en GCS)
router.patch("/employees/:id/foto", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { foto_url } = req.body ?? {};
  if (!foto_url) return res.status(400).json({ error: "foto_url requerida" });
  try {
    const { rowCount } = await pool.query(
      `UPDATE employees SET foto_url = $1, updated_at = NOW() WHERE id = $2`,
      [foto_url, id]
    );
    if (!rowCount) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /employees/:id/foto error");
    res.status(500).json({ error: "Error actualizando foto" });
  }
});

// ─── POST /api/employees/:id/foto-upload ─────────────────────────────────────
// Sube la foto del empleado: el servidor la procesa con sharp (auto-orient EXIF,
// resize a 480 px, JPEG q82) y la guarda como data URL base64 en employees.foto_url.
// Funciona en producción aunque el sidecar de Object Storage falle, porque
// no toca el bucket. El cliente envía la imagen cruda (cualquier formato común).
const FOTO_MAX_BYTES = 15 * 1024 * 1024; // 15 MB de subida cruda

router.post("/employees/:id/foto-upload", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    // Leer el cuerpo crudo en chunks con límite de tamaño.
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let aborted = false;

    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk: Buffer) => {
        if (aborted) return;
        totalBytes += chunk.length;
        if (totalBytes > FOTO_MAX_BYTES) {
          aborted = true;
          req.destroy();
          res.status(413).json({ error: "La foto supera el tamaño máximo de 15 MB" });
          reject(new Error("aborted-by-size"));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => resolve());
      req.on("error", (err) => reject(err));
    }).catch((e) => {
      if (e?.message === "aborted-by-size") return; // ya respondido
      throw e;
    });

    if (aborted || res.headersSent) return;

    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      return res.status(400).json({ error: "Imagen vacía" });
    }

    // Procesar con sharp: respeta orientación EXIF, escala el lado mayor a 480 px,
    // convierte a JPEG con calidad 82 (~30 KB típico).
    // limitInputPixels: rechaza imágenes >24 MP (suficiente para fotos de iPhone Pro)
    // — protege contra "image bombs" que podrían agotar memoria.
    let procesada: Buffer;
    try {
      procesada = await sharp(buffer, { limitInputPixels: 24_000_000, failOn: "truncated" })
        .rotate() // auto-orient según EXIF
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      logger.warn({ err, originalBytes: buffer.length }, "POST /employees/:id/foto-upload: sharp falló");
      return res.status(400).json({ error: "Imagen inválida, dañada o demasiado grande en píxeles" });
    }

    const dataUrl = `data:image/jpeg;base64,${procesada.toString("base64")}`;

    const { rowCount } = await pool.query(
      `UPDATE employees SET foto_url = $1, updated_at = NOW() WHERE id = $2`,
      [dataUrl, id]
    );
    if (!rowCount) return res.status(404).json({ error: "Empleado no encontrado" });

    res.json({
      ok: true,
      fotoUrl: dataUrl,
      bytesOriginales: buffer.length,
      bytesComprimidos: procesada.length,
    });
  } catch (err) {
    if (res.headersSent) return;
    logger.error({ err }, "POST /employees/:id/foto-upload error");
    res.status(500).json({ error: "Error procesando la foto" });
  }
});

export default router;
