# WhatsApp Fase 1 — Documentación Técnica

## Resumen

Este módulo convierte WhatsApp en un canal de entrada real para el sistema ISP. Cada mensaje recibido se clasifica automáticamente y se guarda en la base de datos con `origen = "whatsapp"` o `canal = "whatsapp"`.

---

## Archivos modificados o creados

| Archivo | Acción | Descripción |
|---|---|---|
| `src/routes/whatsapp-webhook.ts` | **Creado** | Router principal del webhook de WhatsApp |
| `src/services/whatsapp/classifier.ts` | **Creado** | Clasificador de mensajes por palabras clave |
| `src/routes/index.ts` | **Modificado** | Registra el nuevo router de webhook |
| `src/admin/components/StatusBadge.tsx` (frontend) | **Modificado** | Ícono verde con MessageCircle para WA |
| `src/admin/pages/Reclutamiento.tsx` (frontend) | **Modificado** | Filtro de canal + highlight de filas WA |
| `src/admin/pages/Comercial.tsx` (frontend) | **Modificado** | Filtro de canal + highlight de filas WA |

---

## Endpoints creados

### GET /api/webhooks/whatsapp
Verificación requerida por Meta al conectar el webhook.

Parámetros de query (enviados por Meta):
- `hub.mode` — debe ser `subscribe`
- `hub.verify_token` — debe coincidir con `WA_VERIFY_TOKEN` (env variable)
- `hub.challenge` — devuelto como respuesta 200

Variable de entorno requerida:
```
WA_VERIFY_TOKEN=isp_whatsapp_verify_2024
```

---

### POST /api/webhooks/whatsapp
Recibe mensajes entrantes desde Meta (WhatsApp Cloud API).

Responde inmediatamente con `200 OK` (requerido por Meta para evitar reintentos).
Procesa el mensaje de forma asíncrona y lo guarda en la tabla correspondiente.

Formato esperado (payload de Meta):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "...", "phone_number_id": "..." },
        "contacts": [{ "profile": { "name": "Juan García" }, "wa_id": "50212345678" }],
        "messages": [{
          "from": "50212345678",
          "id": "wamid.xxx",
          "timestamp": "1700000000",
          "type": "text",
          "text": { "body": "Quiero aplicar como guardia" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

---

### POST /api/webhooks/whatsapp/simulate
**Para pruebas sin credenciales reales de Meta.**

Body:
```json
{ "scenario": "postulacion" }
```
Escenarios disponibles:
- `"postulacion"` — simula "quiero aplicar como guardia"
- `"lead"` — simula "necesito cotización para custodias"
- `"incidencia"` — simula "reporto incidencia en planta norte"

Opcionales (para personalizar el mensaje simulado):
```json
{
  "scenario": "incidencia",
  "nombre": "Carlos Mendez",
  "telefono": "+50299990000",
  "mensaje": "Alerta en bodega 3, se detectó intrusión"
}
```

Respuesta:
```json
{
  "simulacion": true,
  "scenario": "incidencia",
  "entrada": { "nombre": "...", "telefono": "...", "mensaje": "..." },
  "clasificacion": "incidencia",
  "resultado": { "tabla": "incidentes", "id": "WA-260326-1234" }
}
```

---

## Cómo probar sin credenciales reales (Fase 1)

```bash
# Simular postulación (guardia)
curl -X POST /api/webhooks/whatsapp/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "postulacion"}'

# Simular lead comercial (cotización)
curl -X POST /api/webhooks/whatsapp/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "lead"}'

# Simular incidencia (emergencia)
curl -X POST /api/webhooks/whatsapp/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "incidencia"}'
```

Después de cada simulación, abrir el admin en:
- **Incidencias** → filtrar por Origen: WhatsApp
- **Reclutamiento** → filtrar por Canal: WhatsApp
- **Comercial** → filtrar por Canal: WhatsApp

---

## Lógica de clasificación de mensajes

El clasificador (`classifier.ts`) normaliza el texto (minúsculas + sin acentos) y busca palabras clave:

| Categoría | Palabras clave |
|---|---|
| **Incidencia** | incidencia, emergencia, reporto, reporte, robo, asalto, intruso, alerta, urgente, peligro, auxilio... |
| **Postulación** | aplicar, aplico, guardia, trabajo, empleo, agente, vacante, quiero trabajar, reclutamiento... |
| **Lead** | cotización, servicio, custodia, precio, propuesta, contrato, presupuesto, quiero contratar... |
| **Default** | Si ninguna palabra clave coincide → **lead** |

El clasificador es extensible: editar `INCIDENCIA_KEYWORDS`, `POSTULACION_KEYWORDS` o `LEAD_KEYWORDS` en `classifier.ts`.

---

## Qué guarda en base de datos

### Incidencias (`incidents`)
```
id        : "WA-YYMMDD-XXXX"  (ej: WA-260326-7423)
cliente   : nombre del contacto WA
tipo      : "Alerta WhatsApp"
origen    : "whatsapp"        ← campo clave
ubicacion : "Por confirmar"
prioridad : "alta"
estado    : "abierta"
descripcion: "[WA:wamid.xxx] mensaje original"
```

### Postulaciones (`applications`)
```
nombre    : nombre del contacto WA
telefono  : +502XXXXXXXX
canal     : "whatsapp"        ← campo clave
puesto    : "Agente de Seguridad"
experiencia: "Por evaluar"
notas     : mensaje original
```

### Leads (`leads`)
```
empresa   : nombre del contacto WA
contacto  : nombre del contacto WA
telefono  : +502XXXXXXXX
canal     : "whatsapp"        ← campo clave
servicio  : "Por definir"
notas     : mensaje original
```

---

## Marca visual en el admin

- **Badge WA**: ícono verde MessageCircle + texto "WhatsApp" (verde #25D366, color oficial de WA)
- **Highlight de fila**: fondo verde muy tenue en filas con `canal = "whatsapp"`
- **Filtro de canal**: Reclutamiento y Comercial tienen filtro "Canal: WhatsApp"
- **Filtro de origen**: Incidencias ya tenía filtro "Origen: WhatsApp" desde fase anterior
- **Contador**: Muestra "N via WhatsApp" si hay registros de ese canal

---

## Cómo conectar la WhatsApp Cloud API real (Fase 2 prep)

1. Crear cuenta en [Meta for Developers](https://developers.facebook.com)
2. Crear app → producto WhatsApp → número de teléfono de prueba
3. En "Configuración del webhook":
   - URL: `https://tu-dominio.replit.app/api/webhooks/whatsapp`
   - Token de verificación: valor de `WA_VERIFY_TOKEN` (configurar en Secrets del proyecto)
   - Suscribir a: `messages`
4. Agregar variable de entorno:
   ```
   WA_VERIFY_TOKEN=isp_whatsapp_verify_2024
   WA_PHONE_NUMBER_ID=123456789          (para enviar mensajes, Fase 2)
   WA_ACCESS_TOKEN=EAAxxxxxxx            (token de acceso de la app)
   ```
5. Meta enviará un GET de verificación → el endpoint lo responde automáticamente
6. Cada mensaje entrante llega como POST → se procesa y guarda automáticamente

---

## Qué falta para Fase 2

| Característica | Estado | Notas |
|---|---|---|
| Webhook receptor de mensajes | ✅ Listo | Sin credenciales aún |
| Clasificador por palabras clave | ✅ Listo | Extensible |
| Guardado en 3 tablas reales | ✅ Listo | BD real, visible en admin |
| Simulador local | ✅ Listo | 3 escenarios |
| Badge visual en admin | ✅ Listo | Color oficial WA |
| Filtros de canal en Reclutamiento/Comercial | ✅ Listo | |
| Respuestas automáticas via WA | ⬜ Fase 2 | Requiere `WA_ACCESS_TOKEN` + `WA_PHONE_NUMBER_ID` |
| Bot conversacional multi-turno | ⬜ Fase 2 | Requiere sesiones de conversación |
| Menú interactivo (botones WA) | ⬜ Fase 2 | List messages / reply buttons de Meta |
| Soporte a imágenes / documentos | ⬜ Fase 2 | `type !== "text"` actualmente ignorado |
| Clasificación con IA (NLP) | ⬜ Fase 3 | Reemplazar keywords con modelo |
| Panel de conversaciones WA en admin | ⬜ Fase 2 | Vista de hilo de mensajes |
| Notificación a responsable al recibir incidencia | ⬜ Fase 2 | Email o push interno |
