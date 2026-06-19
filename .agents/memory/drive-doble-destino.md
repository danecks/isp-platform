---
name: Drive doble destino + solicitud
description: Cómo se suben los PDF a Google Drive con doble destino (tipo+mes y carpeta del empleado) y el PDF de solicitud de empleo.
---

# Doble destino en Google Drive

Cada documento sube a DOS lugares en la misma llamada `POST /drive/upload`:
1. Carpeta por tipo + subcarpeta por mes: `Contratos/<YYYY-MM Mes>/`, `Actas/...`, `Horas Extras/...`, `Solicitudes/...`.
2. Si el body trae `empleado` (nombre completo), también a `Empleados/<nombre>/` (SIN mes), donde se juntan todos los documentos de esa persona. Los nombres de archivo ya distinguen el tipo, así que la carpeta del empleado va plana (no subcarpetas por tipo).

**Por qué:** el director quiere ambas vistas a la vez — por tipo (como siempre) y por persona (todo junto). Lo confirmó explícitamente.

**Cómo aplica:**
- `duplicado` que devuelve el backend = ya existía en TODOS los destinos aplicables (`result.duplicate && (resultEmpleado == null || resultEmpleado.duplicate)`). El dedupe es por-ubicación dentro de `uploadPdfToDrive` (findFileInFolder), así que cada destino se evalúa solo.
- El nombre de la carpeta del empleado se sanitiza en backend (`nombreCarpetaEmpleado`): quita control chars y barras, normaliza espacios, corta a 120. Drive no usa rutas reales, pero igual se limpia.
- El helper frontend `guardarEnDrive(tipo, nombre, base64, fecha?, empleado?)` pasa `empleado`. TODOS los callers lo mandan: contrato (datos.empleado_nombre / emp.nombreCompleto), acta y HE (evento.employee_nombre), batch actas (ev.employee_nombre).
- Riesgo conocido: dos empleados con el MISMO nombre comparten carpeta. Se aceptó así por pedido del director (orden por nombre); si llega a ser problema, desambiguar con DPI.

# PDF de Solicitud de Empleo

No existía documento físico previo: el PDF ES la solicitud. Lo genera `generarSolicitudEmpleo(datos, salida)` en `pdfRrhh.ts` con `IspPdf` (mismo patrón que los demás), secciones en tablas Campo/Dato que omiten filas vacías. Filename `Solicitud de Empleo - <nombre>.pdf`. Se dispara desde un botón en el detalle del Kiosco; sube con tipo `solicitud` y `empleado=detalle.nombre_completo`, usando `created_at` como fecha del mes.
