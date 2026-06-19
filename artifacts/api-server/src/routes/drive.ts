import { Router } from "express";
import { logger } from "../lib/logger";
import { uploadPdfToDrive, isDriveConnected } from "../lib/googleDrive";

export const driveRouter = Router();

// Tipo de documento → nombre de carpeta en Google Drive.
const CARPETAS: Record<string, string> = {
  contrato: "Contratos",
  acta: "Actas",
  horas_extra: "Horas Extras",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Subcarpeta por mes: "YYYY-MM Mes" (el prefijo numérico mantiene el orden
// cronológico en Drive). Usa la fecha del documento si viene; si no, la actual.
// Para fechas "YYYY-MM-DD" se extrae año/mes del string directamente: new Date()
// las interpreta como UTC y en zona Guatemala (UTC-6) el día 1 caería en el mes
// anterior.
function mesCarpeta(fecha?: string): string {
  if (fecha) {
    const m = /^(\d{4})-(\d{2})/.exec(fecha.trim());
    if (m) {
      const anio = m[1];
      const mes = Number(m[2]);
      if (mes >= 1 && mes <= 12) return `${anio}-${m[2]} ${MESES[mes - 1]}`;
    }
  }
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm} ${MESES[d.getMonth()]}`;
}

// GET /api/drive/estado — ¿está conectado Google Drive? El frontend lo usa
// para mostrar/ocultar el botón "Guardar en Drive".
driveRouter.get("/drive/estado", async (_req, res) => {
  const conectado = await isDriveConnected();
  res.json({ conectado });
});

// POST /api/drive/upload — sube un PDF (base64) a la carpeta de su tipo.
// Body: { tipo: "contrato"|"acta"|"horas_extra", nombre: string, contenidoBase64: string }
driveRouter.post("/drive/upload", async (req, res) => {
  const { tipo, nombre, contenidoBase64, fecha } = req.body ?? {};

  const carpeta = CARPETAS[String(tipo)];
  if (!carpeta) {
    return res.status(400).json({ error: "Tipo de documento inválido" });
  }
  if (typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ error: "Falta el nombre del archivo" });
  }
  if (typeof contenidoBase64 !== "string" || contenidoBase64.length < 16) {
    return res.status(400).json({ error: "Falta el contenido del documento" });
  }

  const fileName = nombre.toLowerCase().endsWith(".pdf") ? nombre : `${nombre}.pdf`;
  const subcarpeta = mesCarpeta(typeof fecha === "string" ? fecha : undefined);
  try {
    const result = await uploadPdfToDrive({
      folderName: carpeta,
      subFolder: subcarpeta,
      fileName,
      base64: contenidoBase64,
    });
    res.json({
      ok: true,
      duplicado: result.duplicate,
      carpeta,
      subcarpeta,
      id: result.id,
      nombre: result.name,
      enlace: result.webViewLink ?? null,
    });
  } catch (err) {
    logger.error({ err }, "POST /drive/upload error");
    res.status(502).json({
      error: "No se pudo guardar en Google Drive. Verifica que la conexión siga activa.",
    });
  }
});
