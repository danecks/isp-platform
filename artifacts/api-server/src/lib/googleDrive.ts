// Integración Google Drive vía Replit Connectors (connector "google-drive").
//
// Sube documentos PDF generados por el sistema (contratos, actas, horas
// extra) a carpetas por tipo dentro del Google Drive de la cuenta que
// autorizó la conexión. Usa @replit/connectors-sdk, que inyecta el token
// OAuth y lo refresca automáticamente en cada request.
//
// Estructura en Drive: <Tipo> / <YYYY-MM Mes> / archivo.pdf
//   ej. "Actas / 2026-06 Junio / Acta No. 0001 - Juan Perez.pdf"
//
// Dedupe: antes de subir, busca un archivo con el MISMO nombre en la
// subcarpeta destino; si ya existe, NO sube de nuevo y devuelve el existente
// marcado como `duplicate`. Esto evita actas/contratos repetidos en Drive.
//
// IMPORTANTE: no cachear el cliente (ReplitConnectors) entre requests; se crea
// barato y el SDK resuelve credenciales frescas internamente. El scope de la
// conexión es `drive.file`, por lo que la app SOLO ve y maneja archivos/
// carpetas que ella misma creó — por eso las carpetas/archivos que creamos sí
// aparecen en búsquedas posteriores y se pueden reutilizar/deduplicar.
import { ReplitConnectors } from "@replit/connectors-sdk";

const CONNECTOR = "google-drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";

// Caché en memoria: clave "<parentId>/<nombre>" → ID de carpeta. Evita
// relistar/recrear en cada subida dentro del mismo proceso. Tras un reinicio,
// la búsqueda vuelve a encontrar la carpeta (creada por la app) y rellena la
// caché.
const folderCache = new Map<string, string>();

async function readError(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

// Escapa comillas y backslashes para usar el valor dentro de una query de Drive.
function escapeQuery(value: string): string {
  return value.replace(/['\\]/g, "\\$&");
}

// Devuelve el ID de una carpeta por nombre (opcionalmente dentro de un padre),
// creándola si no existe. Cachea por "<parentId>/<nombre>".
async function ensureFolder(name: string, parentId?: string): Promise<string> {
  const cacheKey = `${parentId ?? "root"}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const c = new ReplitConnectors();
  let q = `name = '${escapeQuery(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  if (parentId) q += ` and '${escapeQuery(parentId)}' in parents`;
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
    folderCache.set(cacheKey, existing);
    return existing;
  }

  const metadata: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
  if (parentId) metadata.parents = [parentId];
  const createRes = await c.proxy(CONNECTOR, `/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!createRes.ok) {
    throw new Error(`Drive folder create error ${createRes.status}: ${await readError(createRes)}`);
  }
  const created = (await createRes.json()) as { id: string };
  folderCache.set(cacheKey, created.id);
  return created.id;
}

// Busca un archivo por nombre exacto dentro de una carpeta. Devuelve el primero
// (o undefined). Usado para el dedupe.
async function findFileInFolder(
  c: ReplitConnectors,
  name: string,
  parentId: string,
): Promise<{ id: string; name: string; webViewLink?: string } | undefined> {
  const q = `name = '${escapeQuery(name)}' and '${escapeQuery(parentId)}' in parents and trashed = false`;
  const res = await c.proxy(
    CONNECTOR,
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&spaces=drive&pageSize=1`,
    { method: "GET" },
  );
  if (!res.ok) {
    throw new Error(`Drive find error ${res.status}: ${await readError(res)}`);
  }
  const data = (await res.json()) as { files?: Array<{ id: string; name: string; webViewLink?: string }> };
  return data.files?.[0];
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink?: string;
  duplicate: boolean;
}

export async function uploadPdfToDrive(opts: {
  folderName: string;
  subFolder?: string;
  fileName: string;
  base64: string;
}): Promise<DriveUploadResult> {
  const typeFolderId = await ensureFolder(opts.folderName);
  const targetFolderId = opts.subFolder
    ? await ensureFolder(opts.subFolder, typeFolderId)
    : typeFolderId;

  const c = new ReplitConnectors();

  // Dedupe: si ya existe un archivo con el mismo nombre en la carpeta destino,
  // no subir de nuevo.
  const existing = await findFileInFolder(c, opts.fileName, targetFolderId);
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      webViewLink: existing.webViewLink,
      duplicate: true,
    };
  }

  // Upload multipart/related: parte 1 = metadata JSON, parte 2 = el PDF en
  // base64 (Content-Transfer-Encoding: base64 evita manejar binarios).
  const boundary = `isp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = { name: opts.fileName, parents: [targetFolderId] };
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
  const uploaded = (await res.json()) as { id: string; name: string; webViewLink?: string };
  return { ...uploaded, duplicate: false };
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
