---
name: Lectura de DPI en el kiosco de empleo
description: Cómo funciona y cómo diagnosticar el lector de DPI del kiosco de solicitudes de empleo (extracción por IA de visión).
---

# Lector de DPI del kiosco (extraer-dpi)

El kiosco de solicitud de empleo captura la foto del DPI con la cámara y extrae los
datos (nombre, CUI, fecha nac., género, municipio, departamento) con un modelo de
visión vía la integración de IA de Replit (endpoint `POST /api/solicitudes-empleo/extraer-dpi`).
Si la extracción falla, NO bloquea: guarda las fotos igual y el aspirante llena los
datos a mano. Por eso el síntoma reportado es "captura pero no llena los datos".

**Diagnóstico (clave, no obvio):** cuando faltan las env vars de IA el endpoint responde
**503 sin escribir en el log** (solo loguea 502/500). Entonces "no hay errores en los
logs" NO significa que funcione. Para distinguir, llamar directo al endpoint con una
imagen dummy de 1px y mirar el status:
- 503 → integración de IA no configurada en ese entorno.
- 502 `image_parse_error` → la IA SÍ está configurada y alcanzable (rechaza el dummy);
  el problema real es la calidad de la foto o el modelo, no la config.
- Probar producción directo: `curl -X POST https://ispsa.net/api/solicitudes-empleo/extraer-dpi -d '{"imagen":"<dataurl>"}'`.

**Lección de modelo:** `gpt-4o` (legacy) leía mal el texto denso del DPI y devolvía
campos vacíos. Subir a un modelo de visión más capaz mejora la lectura; el endpoint
ahora loguea (sin PII) qué campos vinieron vacíos para detectar fallos en prod.

**Importante:** los arreglos al lector solo llegan al kiosco real tras **republicar**
(la app del kiosco corre en el despliegue de producción, no en el preview de dev).
