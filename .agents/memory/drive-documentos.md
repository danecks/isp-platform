---
name: Documentos a Google Drive
description: Contratos/actas/HE suben a Drive en vez de descargar; patrón de salida dual y por qué la ruta /drive no lleva módulo.
---

Los botones de descarga de **contratos**, **actas administrativas** y **constancias de horas extra** SUBEN el PDF a Google Drive (carpetas por tipo: Contratos, Actas, Horas Extras) EN LUGAR de descargarlo al equipo. Decisión del director: no quiere un botón aparte, quiere que la descarga misma vaya a Drive.

**Cómo funciona el patrón de salida dual:**
- Los generadores de `pdfRrhh.ts` (generarContratoLaboral, generarActaAdministrativa, generarConstanciaHorasExtra) aceptan un 2º parámetro `salida: "descargar" | "drive"` (default `"descargar"`). Con `"drive"` devuelven `ResultadoPdf {filename, base64}` (vía helper `entregar()`); con `"descargar"` hacen `pdf.save()` y devuelven void.
- `IspPdf.toBase64()` (pdfExport.ts) replica los footers de `save()` antes de exportar, para que el PDF en Drive tenga el mismo formato final.
- Frontend sube con `guardarEnDrive(tipo, nombre, base64)` → `POST /api/drive/upload` body `{tipo, nombre, contenidoBase64}`.
- Backend `googleDrive.ts` usa `@replit/connectors-sdk` (connector `google-drive`, scope `drive.file`): `c.proxy(connector, path, {method,headers,body})` para list/create carpeta y upload multipart/related; `c.listConnections({connector_names})` para estado. NO cachear el cliente entre requests (se crea barato); SÍ cachear folderName→id en memoria.

**Qué NO se tocó (a propósito, siguen descargando):** boleta de descuento (rama no-HE), acta de anulación, KioscoSolicitudes, BatchActasPanel, PlantillasContrato (preview), kpi.tsx. Usan el default `"descargar"`.

**Por qué `/api/drive/*` NO está en ROUTE_MODULO_MAP (solo "sesión requerida"):**
La ruta la consumen DOS módulos distintos — contratos desde *empleados*, actas/HE desde *eventos_rrhh*. Mapearla a un único módulo bloquearía uno de los dos flujos. Y el endpoint solo sube un PDF ya generado por el usuario al Drive propio de la empresa (no expone datos), así que la autorización efectiva ya la da el acceso del usuario a esas pantallas. Code review lo marcó como hardening no-bloqueante; se dejó así adrede.

**How to apply:** si agregas un nuevo tipo de documento a Drive, añade su carpeta en `CARPETAS` (drive.ts) y un valor a `TipoDocumentoDrive` (guardarEnDrive.ts), y llama al generador con `"drive"`. Recuerda: el api-server NO auto-recarga (build+start) → reiniciar workflow tras cambios backend; la web usa HMR.
