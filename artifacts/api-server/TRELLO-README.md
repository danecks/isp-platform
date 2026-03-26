# Trello Fase 1.5 — Documentación Técnica

## Resumen

Integración de Trello como herramienta operativa para ISP. Cuando un operador decide escalar una incidencia, puede crear una tarjeta de Trello directamente desde el panel admin con un solo clic. La tarjeta se crea con:
- Descripción completa con todos los datos de la incidencia
- Checklist de 6 pasos del Protocolo ISP
- Asignación automática de miembros (supervisor + operaciones)

---

## Archivos creados / modificados

| Archivo | Acción | Descripción |
|---|---|---|
| `src/services/trello/trello.service.ts` | **Creado** | Wrapper de Trello Cloud API + modo mock |
| `src/routes/trello.ts` | **Creado** | Router Express con 2 endpoints |
| `src/routes/index.ts` | **Modificado** | Registra trelloRouter |
| `artifacts/isp-web/src/lib/api.ts` | **Modificado** | Agrega `trelloApi.sendIncident()` y `trelloApi.getConfig()` |
| `artifacts/isp-web/src/admin/components/EditarIncidenciaModal.tsx` | **Modificado** | Sección Trello con botón + estado de tarjeta creada |
| `artifacts/isp-web/src/admin/pages/Tareas.tsx` | **Modificado** | Banner actualizado: "Trello Fase 1.5 activa" |

---

## Endpoints

### GET /api/trello/config
Devuelve el estado de configuración. Útil para que el frontend sepa si está en modo real o mock.

```json
{
  "configured": false,
  "hasMemberSupervisor": false,
  "hasMemberOperaciones": false,
  "checklistItems": ["Validar incidente...", "..."],
  "mockMode": true
}
```

### POST /api/trello/send-incident/:incidenciaId
Crea una tarjeta de Trello para la incidencia indicada.

- Si la incidencia ya tiene `tareaAsociada` (ya fue enviada a Trello): responde `409 Conflict`
- Si `TRELLO_API_KEY` no está configurado: funciona en **modo mock** (responde igual pero no llama a Trello)
- En cualquier caso, guarda la URL de la tarjeta en `incidents.tareaAsociada`

**Respuesta exitosa:**
```json
{
  "incidenciaId": "INC-260326-1234",
  "card": {
    "id": "abc123xyz",
    "name": "🔴 INC-260326-1234 — Robo en Bodega",
    "url": "https://trello.com/c/abc123xyz/1-inc-260326-1234-robo-en-bodega",
    "shortUrl": "https://trello.com/c/abc123xyz"
  },
  "checklistId": "cl-xyz789",
  "checklistItems": [
    "Validar incidente con el cliente",
    "Contactar al cliente / lugar del evento",
    "Asignar recurso y supervisor",
    "Ejecutar acción operativa",
    "Registrar evidencia / fotografías",
    "Cerrar incidente en sistema ISP"
  ],
  "membersAssigned": [],
  "mockMode": true
}
```

---

## Cómo configurar credenciales reales de Trello

### Paso 1: Obtener API Key y Token

1. Ir a: https://trello.com/app-key
2. Copiar el **API Key**
3. Hacer clic en "Token" → autorizar → copiar el token

### Paso 2: Obtener IDs de lista y tablero

```bash
# Ver tableros del usuario
curl "https://api.trello.com/1/members/me/boards?key=TU_API_KEY&token=TU_TOKEN&fields=id,name"

# Ver listas del tablero
curl "https://api.trello.com/1/boards/BOARD_ID/lists?key=TU_API_KEY&token=TU_TOKEN&fields=id,name"
```

### Paso 3: Obtener IDs de miembros (opcional)

```bash
# Ver miembros del tablero
curl "https://api.trello.com/1/boards/BOARD_ID/members?key=TU_API_KEY&token=TU_TOKEN&fields=id,fullName,username"
```

### Paso 4: Configurar variables de entorno

En los Secrets del proyecto (NO en código fuente):

```
TRELLO_API_KEY=tu_api_key_aqui
TRELLO_TOKEN=tu_token_aqui
TRELLO_LIST_ID=id_de_la_lista_destino
TRELLO_MEMBER_SUPERVISOR=id_del_miembro_supervisor   (opcional)
TRELLO_MEMBER_OPERACIONES=id_del_miembro_operaciones (opcional)
```

Una vez configuradas, los próximos envíos a Trello crearán tarjetas reales automáticamente, sin cambiar ningún código.

---

## Checklist del Protocolo ISP

El checklist se define en `trello.service.ts` como `CHECKLIST_ITEMS`. Se puede modificar sin tocar el resto del código:

```typescript
export const CHECKLIST_ITEMS = [
  "Validar incidente con el cliente",
  "Contactar al cliente / lugar del evento",
  "Asignar recurso y supervisor",
  "Ejecutar acción operativa",
  "Registrar evidencia / fotografías",
  "Cerrar incidente en sistema ISP",
];
```

Para agregar, quitar o reordenar pasos: editar esta lista. El frontend los leerá automáticamente via `GET /api/trello/config`.

---

## Cómo probar sin credenciales (Modo Mock)

Cuando `TRELLO_API_KEY` no está configurado, el sistema funciona en **modo mock**:
- Los endpoints responden igual que con credenciales reales
- No se hacen llamadas a la API de Trello
- La URL de la tarjeta es `https://trello.com/c/mock-TIMESTAMP`
- El campo `tareaAsociada` de la incidencia se actualiza igual
- El modal muestra badge "Simulación"

Para probar:
```bash
# Simular envío a Trello (incidencia INC-260326-2469)
curl -X POST http://localhost:8080/api/trello/send-incident/INC-260326-2469

# Verificar configuración
curl http://localhost:8080/api/trello/config
```

---

## Flujo UX en el Admin

1. El operador abre cualquier incidencia (clic en la fila de la tabla)
2. El modal de edición muestra la sección **"Integración Trello"** al final
3. Sección muestra el checklist de 6 pasos como preview (fondo gris claro)
4. Botón azul **"Enviar a Trello"** con ícono Trello
5. Al hacer clic: botón cambia a "Creando tarjeta..." con spinner
6. Éxito: sección se transforma en estado "Tarjeta creada":
   - Ícono verde checkmark
   - Checklist items destacados en azul
   - Enlace a la URL de la tarjeta de Trello
7. Si el admin abre la misma incidencia de nuevo: ya muestra el estado "Ya en Trello"

---

## Qué hace exactamente la tarjeta creada en Trello

**Nombre:** `🔴 INC-260326-1234 — Robo en Bodega`  
(el emoji cambia según prioridad: 🚨 urgente, 🔴 alta, 🟡 media, 🟢 baja)

**Descripción (markdown):**
```
**INCIDENCIA ISP — INC-260326-1234**

📌 **Cliente:** Distribuidora XYZ
⚡ **Tipo:** Robo en Bodega  
🔺 **Prioridad:** ALTA
📍 **Ubicación:** Zona 11, Guatemala
👤 **Responsable:** Pedro Martínez
📡 **Origen:** whatsapp
🕐 **Registrada:** 26/3/2026, 14:30:00

---
**Descripción:**
Reporte de robo detectado en bodega norte a las 14:00...
---
*Generado automáticamente por ISP Sistema Operativo*
```

**Checklist:** "Protocolo de Incidencia ISP" con 6 ítems sin marcar

**Posición:** Top de la lista (la tarjeta más urgente queda arriba)

**Miembros:** Los configurados en `TRELLO_MEMBER_SUPERVISOR` y `TRELLO_MEMBER_OPERACIONES`

---

## Qué falta para Trello Fase 2

| Característica | Estado | Notas |
|---|---|---|
| Crear tarjeta desde incidencia | ✅ Listo | Con checklist y miembros |
| Modo mock (sin credenciales) | ✅ Listo | |
| Guardar URL en BD (`tareaAsociada`) | ✅ Listo | |
| Estado visual en modal (ya en Trello) | ✅ Listo | |
| Banner Tareas actualizado | ✅ Listo | |
| Webhook de Trello (recibir cambios) | ⬜ Fase 2 | Requiere URL pública + Trello Power-Up |
| Sincronizar estado Trello → ISP | ⬜ Fase 2 | `POST /api/webhooks/trello` |
| Sincronizar estado ISP → Trello | ⬜ Fase 2 | Mover tarjeta a otra lista según estado |
| Mostrar tarjetas Trello en módulo Tareas | ⬜ Fase 2 | `GET /api/trello/cards` desde BD |
| Cerrar automáticamente al completar checklist | ⬜ Fase 3 | Requiere webhook + lógica |
| Notificación a supervisor al crear tarjeta | ⬜ Fase 2 | Email o WA Fase 2 |
