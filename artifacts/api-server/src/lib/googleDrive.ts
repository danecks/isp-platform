// Integración Google Drive vía Replit Connectors (connector "google-drive").
//
// Sube documentos PDF generados por el sistema (contratos, actas, horas
// extra) a carpetas por tipo dentro del Google Drive de la cuenta que
// autorizó la conexión. Usa @replit/connectors-sdk, que inyecta el token
// OAuth y lo refresca automáticamente en cada request.
//
// IMPORTANTE: no cachear el cliente (ReplitConnectors) entre requests; se crea
// barato y el SDK resuelve credenciales frescas internamente. El scope de la
// conexión es `drive.file`, por lo que la app SOLO ve y maneja archivos/
// carpetas que ella misma creó — por eso la carpeta que creamos sí aparece en
// búsquedas posteriores y se puede reutilizar.
import { ReplitConnectors } from "@replit/connectors-sdk";

const CONNECTOR = "google-drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";

// Caché en memoria: nombre de carpeta → ID. Evita relistar/recrear en cada
// subida dentro del mismo proceso. Tras un reinicio, la búsqueda vuelve a
// encontrar la carpeta (creada por la app) y rellena la caché.
const folderCache = new Map<string, string>();

async function readError(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

async function ensureFolder(name: string): Promise<string> {
  const cached = folderCache.get(name);
  if (cached) return cached;

  const c = new ReplitConnectors();
  const safeName = name.replace(/['\\]/g, "\\$&");
  const q = `name = '${safeName}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const listRes = await c.proxy(
    CONNECTOR,
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive&pageSize=10`,
    { method: "GET" },
  );
  if (!listRes.ok) {
    throw new Error(`Drive list error ${listRes.status}: ${await readError(listRes)}`);
  }
  const listData = (await listRes.json()) as { files?: Array<{ id: string }> };
  const existing = listData.files?.[0]?.id;
  if (existing) {
    folderCache.set(name, existing);
    return existing;
  }

  const createRes = await c.proxy(CONNECTOR, `/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
  });
  if (!createRes.ok) {
    throw new Error(`Drive folder create error ${createRes.status}: ${await readError(createRes)}`);
  }
  const created = (await createRes.json()) as { id: string };
  folderCache.set(name, created.id);
  return created.id;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink?: string;
}

export async function uploadPdfToDrive(opts: {
  folderName: string;
  fileName: string;
  base64: string;
}): Promise<DriveUploadResult> {
  const folderId = await ensureFolder(opts.folderName);
  const c = new ReplitConnectors();

  // Upload multipart/related: parte 1 = metadata JSON, parte 2 = el PDF en
  // base64 (Content-Transfer-Encoding: base64 evita manejar binarios).
  const boundary = `isp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = { name: opts.fileName, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/pdf\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${opts.base64}\r\n` +
    `--${boundary}--`;

  const res = await c.proxy(
    CONNECTOR,
    `/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Drive upload error ${res.status}: ${await readError(res)}`);
  }
  return (await res.json()) as DriveUploadResult;
}

// ¿Hay una conexión de Google Drive autorizada para este proyecto?
export async function isDriveConnected(): Promise<boolean> {
  try {
    const c = new ReplitConnectors();
    const conns = await c.listConnections({ connector_names: CONNECTOR });
    return conns.length > 0;
  } catch {
    return false;
  }
}
