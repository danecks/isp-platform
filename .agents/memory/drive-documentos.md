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

**Qué NO se tocó (a propósito, siguen descargando):** boleta de descuento (rama no-HE), acta de anulación, PlantillasContrato (preview), kpi.tsx. Usan el default `"descargar"`.

**Contrato desde Solicitudes (KioscoSolicitudes.tsx) SÍ sube a Drive:** los dos botones (Contrato Inicial y Post-Prueba) llaman `generarContratoLaboral(datos, "drive")` + `guardarEnDrive("contrato", ...)`. Este archivo NO usa toast (useToast); su patrón de feedback es `alert()`, así que el resultado/duplicado/error se muestra con alert.

**Batch de actas (BatchActasPanel.tsx) SÍ sube a Drive** (decisión del director): itera los eventos filtrados, llama `generarActaAdministrativa(datos, "drive")` + `guardarEnDrive("acta", filename, base64, ev.fecha)` con la MISMA lógica que las individuales (nombre completo, subcarpeta por mes, dedupe). El toast resume subidas/repetidas/errores. Se renombraron labels: "Batch de Actas a Google Drive" y "Subir N acta(s) a Drive".

**Por qué `/api/drive/*` NO está en ROUTE_MODULO_MAP (solo "sesión requerida"):**
La ruta la consumen DOS módulos distintos — contratos desde *empleados*, actas/HE desde *eventos_rrhh*. Mapearla a un único módulo bloquearía uno de los dos flujos. Y el endpoint solo sube un PDF ya generado por el usuario al Drive propio de la empresa (no expone datos), así que la autorización efectiva ya la da el acceso del usuario a esas pantallas. Code review lo marcó como hardening no-bloqueante; se dejó así adrede.

**Nombre de archivo legible + dedupe + subcarpeta por mes (decisión del director):**
- El nombre del PDF incluye el NOMBRE COMPLETO del agente (no slug+fecha): "Acta No. 0001 - Juan Perez.pdf", "Constancia HE ERH-0033 - Juan Perez.pdf", "Contrato Inicial - Juan Perez.pdf". Se quitó la fecha del contrato a propósito para que el nombre sea determinista y el dedupe funcione por persona+tipo.
- Estructura en Drive: `<Tipo>/<YYYY-MM Mes>/archivo.pdf` (ej. `Actas/2026-06 Junio/...`). El prefijo `YYYY-MM` mantiene orden cronológico.
- **Dedupe:** antes de subir, `findFileInFolder(name, parentId)` busca nombre exacto en la subcarpeta del mes; si existe, NO se sube de nuevo y se devuelve `duplicate:true`. Funciona porque scope `drive.file` ve lo que la app creó. El front muestra toast distinto ("Ya estaba en Google Drive") y NO re-registra descarga cuando `duplicado`.
- **Mes:** `mesCarpeta(fecha?)` en drive.ts. Para HE/acta se pasa `evento.fecha`; contrato no pasa fecha (usa el mes actual). OJO: parsear `YYYY-MM-DD` con regex y extraer año/mes del STRING, nunca `new Date(s)` → en zona Guatemala (UTC-6) el día 1 caería al mes anterior.
- `ensureFolder(name, parentId?)` cachea por clave `<parentId>/<name>` y filtra con `'<parent>' in parents`. `escapeQuery()` escapa comillas/backslash antes de interpolar en queries de Drive (evita inyección).

**How to apply:** si agregas un nuevo tipo de documento a Drive, añade su carpeta en `CARPETAS` (drive.ts) y un valor a `TipoDocumentoDrive` (guardarEnDrive.ts), y llama al generador con `"drive"`. Recuerda: el api-server NO auto-recarga (build+start) → reiniciar workflow tras cambios backend; la web usa HMR.
