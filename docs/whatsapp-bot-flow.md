# Bot de WhatsApp — Flujo end-to-end

> Documento de referencia para el módulo de WhatsApp del sistema ISP, S.A.
> Resume cómo entra un mensaje, cómo se decide qué responder, qué tablas se
> tocan y cómo configurarlo desde el panel admin.

---

## 1. Componentes

### 1.1 Rutas Express (`artifacts/api-server/src/routes/`)

| Archivo                | Endpoint(s)                          | Rol                                                          |
|------------------------|--------------------------------------|--------------------------------------------------------------|
| `whatsapp-webhook.ts`  | `GET/POST /api/webhooks/whatsapp`    | Punto de entrada de Meta (verify token + recepción mensajes) |
| `wa-config.ts`         | `/api/wa-config/*`                   | API admin para editar config, mensajes, menús, auditoría     |
| `simulador.ts`         | `/api/simulador/*`                   | Capa HTTP del simulador (delega en `services/whatsapp/simulator/*`) |

### 1.2 Servicios (`artifacts/api-server/src/services/whatsapp/`)

| Archivo                          | Propósito                                                                   |
|----------------------------------|-----------------------------------------------------------------------------|
| `classifier.ts`                  | Clasifica un texto libre en una intención (`anticipo`, `incidencia`, …)     |
| `wa-sender.ts`                   | Envía mensajes a Meta WhatsApp Cloud API (`enviarTextoWA`, `marcarLeidoWA`) |
| `wa-config.service.ts`           | Lee/escribe `wa_config`, `wa_messages`, `wa_menu_options`, `wa_audit_log`   |
| `phone-registration-session.ts`  | Sesión multi-paso para verificar DPI ↔ teléfono                             |
| `anticipo-session.ts`            | Sesión multi-paso para solicitar anticipo de nómina                         |
| `emergencias.service.ts`         | Crea incidencias con `esEmergencia=true`                                    |
| `notificaciones.service.ts`      | Envía notificaciones salientes (tareas asignadas, alertas operativas)       |
| `simulator/`                     | Lógica del simulador admin (ver detalle abajo)                              |

#### 1.2.1 Submódulo `services/whatsapp/simulator/`

El simulador (modo dry-run vs. real) está dividido por responsabilidad para
poder agregar nuevos escenarios o intenciones sin tocar un único archivo
gigante:

| Archivo          | Rol                                                                                |
|------------------|------------------------------------------------------------------------------------|
| `types.ts`       | `DebugInfo`, `SimularParams`, `SimularResult` y la fábrica `makeDebug()`           |
| `utils.ts`       | `normalizarTelefono`, `buscarUsuarioPorTelefono`, `buscarAlias`, `generarIdIncidencia` |
| `validation.ts`  | Sesión DPI activa, usuario inactivo y flujo de número desconocido                  |
| `real.ts`        | Handlers que **persisten en DB** (incidencia, postulación, leads, tareas, …)       |
| `dry-run.ts`     | Handlers equivalentes que **NO escriben** (mismo shape de retorno)                 |
| `simulate.ts`    | Orquestador `simularMensaje()` que arma debug, valida y despacha al handler        |
| `index.ts`       | Re-export público (`simularMensaje`, `normalizarTelefono`, tipos)                  |

La UI admin vive en `artifacts/isp-web/src/admin/pages/whatsapp-simulator/`
con un orquestador (`index.tsx`) y paneles separados (`ConfigPanel`,
`ChatPanel`, `QuickScenarios`, `DebugSidePanel`, `MsgBubble`) más el hook
`use-simulador.ts` que centraliza el estado y los llamados a la API.

### 1.3 Tablas en Drizzle (`lib/db/src/schema/whatsapp.ts`)

| Tabla              | Para qué sirve                                                          |
|--------------------|-------------------------------------------------------------------------|
| `wa_config`        | Pares clave/valor de configuración global (modo, horarios, números…)    |
| `wa_messages`      | Plantillas de texto editables, indexadas por clave                      |
| `wa_menu_options`  | Opciones de menú filtradas por rol                                      |
| `wa_audit_log`     | Historial de cambios manuales hechos desde `/admin/whatsapp-config`     |

Tablas adicionales usadas por el flujo (creadas por `auto-seed.ts`):

- `phone_auth_log` — cada intento de verificación DPI ↔ teléfono.
- `wa_notificaciones_log` — registro de alertas salientes a personal.

---

## 2. Flujo de un mensaje entrante

```
        Meta Cloud API
              │
              ▼
   POST /api/webhooks/whatsapp     (whatsapp-webhook.ts)
              │
              ├── marcarLeidoWA()   (acuse de recibo a Meta)
              │
              ├── ¿texto empieza con [ISP-CARNET:<token>] ?
              │      └─► crea incidente público y termina
              │
              ├── ¿hay phone-registration-session activa ?
              │      └─► procesarPhoneRegStep()
              │
              ├── ¿hay anticipo-session activa ?
              │      └─► continuarAnticipo()
              │
              ├── lookup users.telefono = from
              │      ├─ usuario activo  → ramas operativas
              │      ├─ usuario inactivo → mensaje de cuenta deshabilitada
              │      └─ desconocido     → classifyMessage(text)
              │            ├─ intención interna  → inicia phone-registration
              │            └─ intención externa  → leads / kiosko / info
              │
              ▼
        wa-sender.enviarTextoWA(to, texto)
              │
              ▼
        Meta entrega al usuario
```

### 2.1 Roles y menús

`wa-config.service.getMenuOptions(rol)` devuelve sólo las opciones activas
para el rol del usuario:

- `guardia`, `supervisor` → menú operativo (incidencia, anticipo si tiene
  permiso, emergencia si tiene permiso).
- `cliente` → menú de portal/servicios.
- `desconocido` → menú comercial (leads, info, postulación).

Los textos de cada respuesta se obtienen vía `getWaMessage(clave)` para que el
admin pueda editarlos desde el panel sin desplegar código.

### 2.2 Permisos especiales

Dos flags por usuario controlan acciones sensibles vía WA:

- `users.canReportEmergency` — habilita el botón de pánico.
- `users.canRequestAdvance` — habilita la sesión de anticipos.

Se editan desde `Usuarios → Editar usuario → Permisos WA`.

---

## 3. Configuración desde el panel admin

Pantalla: **Usuarios → WhatsApp Config** (`/admin/whatsapp-config`).

| Tab          | Endpoint API              | Tabla              |
|--------------|---------------------------|--------------------|
| General      | `GET/PUT /wa-config/general/:clave`   | `wa_config`         |
| Mensajes     | `GET/PUT /wa-config/messages/:clave`  | `wa_messages`       |
| Menús        | `GET/PUT /wa-config/menus/:id`        | `wa_menu_options`   |
| Auditoría    | `GET /wa-config/auditoria`            | `wa_audit_log`      |

Cada `PUT` registra automáticamente una entrada en `wa_audit_log` con el
usuario que hizo el cambio (extraído del header `x-isp-session`, no del body).

---

## 4. Simulador (`/admin/whatsapp-simulator`)

Herramienta para probar el bot sin involucrar a Meta:

- **Modo simulado**: ejecuta `classifier` + sesiones en memoria, sin escribir
  en DB de incidentes/leads/anticipos. Útil para iteración rápida.
- **Modo real**: ejecuta el flujo completo escribiendo en DB con
  `canal='simulador_admin'` para diferenciar de mensajes reales.

Comparte la lógica con el webhook (mismo `classifier.ts`, misma
`anticipo-session`, misma `phone-registration-session`).

---

## 5. Notificaciones salientes

`notificaciones.service.ts` se invoca desde otros módulos del sistema:

- Asignación de tareas → `notifyTareaAsignada(tareaId)`
- Aprobación / rechazo de anticipos
- Alertas RRHH (vencimientos, eventos)

Cada envío queda en `wa_notificaciones_log` con éxito/fallo y `messageId`
devuelto por Meta. El log es consultable desde el panel para diagnosticar
problemas de entrega.
