/**
 * Helper del frontend para subir documentos PDF a Google Drive a través del
 * backend (`/api/drive/*`). El backend usa la conexión Replit Connectors del
 * proyecto; aquí solo mandamos el PDF en base64 y el tipo de documento, y el
 * servidor lo coloca en la carpeta correspondiente (Contratos, Actas,
 * Horas Extras).
 */
import { apiRequest } from "./httpClient";

export type TipoDocumentoDrive = "contrato" | "acta" | "horas_extra";

export interface DriveUploadResponse {
  ok: boolean;
  duplicado?: boolean;
  carpeta: string;
  subcarpeta?: string;
  id: string;
  nombre: string;
  enlace: string | null;
}

export async function guardarEnDrive(
  tipo: TipoDocumentoDrive,
  nombre: string,
  contenidoBase64: string,
  fecha?: string,
): Promise<DriveUploadResponse> {
  return apiRequest<DriveUploadResponse>("/drive/upload", {
    method: "POST",
    json: { tipo, nombre, contenidoBase64, fecha },
  });
}

export async function driveEstado(): Promise<{ conectado: boolean }> {
  return apiRequest<{ conectado: boolean }>("/drive/estado");
}
