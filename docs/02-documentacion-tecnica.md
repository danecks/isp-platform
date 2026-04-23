# Documentación Técnica — Plataforma ISP

> Para desarrolladores que mantengan o extiendan el sistema.

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Stack técnico](#2-stack-técnico)
3. [Estructura del monorepo](#3-estructura-del-monorepo)
4. [Convenciones](#4-convenciones)
5. [Autenticación y permisos](#5-autenticación-y-permisos)
6. [Migraciones automáticas](#6-migraciones-automáticas)
7. [Módulos: endpoints y tablas](#7-módulos-endpoints-y-tablas)
8. [Integraciones externas](#8-integraciones-externas)
9. [Deploy](#9-deploy)

---

## 1. Arquitectura general

```
┌────────────────────────────────────────────────────────────┐
│                      Cloudflare / Replit                    │
│                          (proxy, TLS)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
       ┌───────────────────┴────────────────────┐
       ▼                                        ▼
┌─────────────┐                          ┌──────────────┐
│   isp-web   │                          │  api-server  │
│ React+Vite  │  ─── /api/* (proxy) ───▶ │   Express    │
│  (SPA)      │                          │   (Node)     │
└─────────────┘                          └──────┬───────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │  PostgreSQL  │
                                         │   (Replit)   │
                                         └──────────────┘
                                                │
                            ┌───────────────────┴──────────┐
                            ▼                              ▼
                    ┌──────────────┐              ┌─────────────────┐
                    │  WhatsApp    │              │ Cloudflare      │
                    │   Business   │              │   Turnstile     │
                    └──────────────┘              └─────────────────┘
```

- **isp-web**: SPA en React + Vite. Sirve sitio público y panel admin.
- **api-server**: API REST en Express (Node.js). Toda la lógica de negocio.
- **PostgreSQL**: única fuente de verdad. Sin ORM (queries SQL crudas con `pg`).
- **mockup-sandbox**: artifact auxiliar para prototipos UI (no productivo).

---

## 2. Stack técnico

### Frontend (`artifacts/isp-web`)
- **React 18** + **TypeScript**
- **Vite 7** como bundler
- **Wouter** para routing
- **TanStack Query** (`@tanstack/react-query`) para caching/fetching
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives)
- **Lucide React** para iconos

### Backend (`artifacts/api-server`)
- **Node.js 20** + **TypeScript** + **ESM**
- **Express 4**
- **pg** (driver PostgreSQL puro, sin ORM)
- **Pino** para logging estructurado
- **bcrypt** para passwords
- **helmet**, **express-rate-limit** para seguridad
- **esbuild** para bundle (build.mjs)

### Base de datos
- **PostgreSQL 16** (Replit-managed)
- **130 tablas** aproximadamente
- Migraciones automáticas en código (sin tool externo, sin Drizzle/Prisma)

---

## 3. Estructura del monorepo

```
/
├── artifacts/
│   ├── api-server/
│   │   ├── src/
│   │   │   ├── app.ts                # Express app + middlewares
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── db.ts                 # pg Pool
│   │   │   ├── routes/               # 64 archivos de rutas
│   │   │   ├── auto-migrations/      # Migraciones idempotentes al boot
│   │   │   ├── services/             # Lógica reusable (whatsapp, cálculos)
│   │   │   ├── middlewares/          # auth, permissions, rateLimit
│   │   │   └── utils/                # date helpers, etc.
│   │   ├── build.mjs
│   │   └── .replit-artifact/artifact.toml
│   │
│   ├── isp-web/
│   │   ├── src/
│   │   │   ├── App.tsx               # Routes
│   │   │   ├── main.tsx              # Entry
│   │   │   ├── pages/                # Sitio público
│   │   │   ├── admin/pages/          # Panel admin
│   │   │   │   └── tabs/             # Sub-componentes pesados
│   │   │   ├── portal/pages/         # Portal de cliente
│   │   │   ├── components/ui/        # shadcn components
│   │   │   ├── contexts/             # AuthContext, etc.
│   │   │   ├── config/branding.ts
│   │   │   └── lib/api.ts            # API client
│   │   ├── vite.config.ts
│   │   └── .replit-artifact/artifact.toml
│   │
│   └── mockup-sandbox/               # Auxiliar (no productivo)
│
├── docs/                              # Esta documentación
├── replit.md                          # Notas del proyecto
└── pnpm-workspace.yaml
```

### Comunicación frontend ↔ backend
- En desarrollo: vite proxy `/api` → `http://localhost:8080`.
- En producción: ambos artifacts corren en el mismo dominio bajo paths distintos.
- El frontend usa `API_BASE = "/api"` (relativo).
- Algunas requests envían `headers: { "x-isp-session": <token> }` con el token guardado en `sessionStorage("isp_admin_session_v2")`.

---

## 4. Convenciones

### Nomenclatura
- **Tablas**: snake_case plural (`employees`, `puestos_operativos`, `eventos_rrhh`).
- **Columnas**: snake_case (`tipo_personal`, `fecha_inicio_ciclo`).
- **Endpoints**: kebab-case (`/api/operaciones/tablero/administracion`).
- **Componentes React**: PascalCase (`Operaciones.tsx`).
- **Variables JS**: camelCase.

### Fechas
- En BD: `DATE` o `TIMESTAMP WITHOUT TIME ZONE` (hora Guatemala).
- Helper `todayGT()` en `utils/date.ts` para "hoy" en GT.
- En API responses: strings `YYYY-MM-DD`.

### Errores
- HTTP 4xx para errores de cliente (validación, permisos).
- HTTP 5xx para errores de servidor.
- Body: `{ error: "mensaje legible" }`.

### Logging
- `logger.info({ ctx }, "mensaje")` — solo info útil.
- `logger.error({ err }, "endpoint X falló")` — siempre con contexto.
- No loguear datos sensibles (passwords, tokens).

---

## 5. Autenticación y permisos

### Login
- Endpoint: `POST /api/users/login`
- Body: `{ usuario, password, turnstileToken }`
- Backend:
  1. **Rate limit**: `loginLimiter` (10 intentos / 5 min por IP+username).
  2. **Verifica Turnstile** contra `https://challenges.cloudflare.com/turnstile/v0/siteverify` si `TURNSTILE_SECRET_KEY` está definido.
  3. Compara password con `bcrypt`.
  4. Retorna `{ token, usuario, rol, permisos }`.

### Sesión
- **Token** se guarda en `sessionStorage("isp_admin_session_v2")` en el cliente.
- Cada request enviar `x-isp-session: <token>`.
- Middleware `requireAuth` valida el token y carga `req.currentUser`.

### Permisos
- Tabla `system_roles` — define roles (admin, rrhh, operaciones, jefe_servicio, cliente, etc.).
- Tabla `rol_permisos` — relaciona rol → permiso (string como `"empleados.editar"`, `"planilla.cerrar"`).
- Middleware `requirePermiso("permiso.x")` valida.
- Tabla `permisos_ruta_rol` — control granular de rutas.

### Variables de entorno
| Variable | Descripción | Dónde se lee |
|----------|-------------|--------------|
| `DATABASE_URL` | URL Postgres | api-server |
| `SESSION_SECRET` | Secreto sesiones | api-server |
| `TURNSTILE_SECRET_KEY` | Captcha Cloudflare | api-server (runtime) |
| `VITE_TURNSTILE_SITE_KEY` | Captcha Cloudflare | isp-web (build-time) |
| `WA_ACCESS_TOKEN` | WhatsApp Business | api-server |
| `WA_PHONE_NUMBER_ID` | WhatsApp Business | api-server |
| `WA_VERIFY_TOKEN` | Verify webhook WhatsApp | api-server |
| `WA_BUSINESS_ACCOUNT_ID` | WhatsApp Business | api-server |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Object Storage Replit | api-server |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Object Storage paths públicos | api-server |
| `PRIVATE_OBJECT_DIR` | Object Storage path privado | api-server |

> ⚠️ Vite necesita `VITE_*` env vars en `[services.env]` del `artifact.toml`. No se heredan automáticamente del entorno compartido.

---

## 6. Migraciones automáticas

No usamos Drizzle/Prisma. Las migraciones están en `artifacts/api-server/src/auto-migrations/` y corren al iniciar el server.

### Patrón
Cada migración es **idempotente** (usa `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... IF NOT EXISTS`):

```ts
export async function migrarPESP01() {
  await pool.query(`CREATE TABLE IF NOT EXISTS planillas_especiales (...)`);
  logger.info("Auto-migrate: PESP-01 tablas planillas_especiales creadas/verificadas");
}
```

### Agregar una migración
1. Creá archivo `auto-migrations/<NN>-<nombre>.ts`.
2. Exportá una función async.
3. Importala y llamala en `auto-migrations/index.ts` en el orden correcto.
4. Hacela idempotente (siempre verificar antes).
5. **Nunca borres datos** sin un backup explícito.

---

## 7. Módulos: endpoints y tablas

### 7.1 Empleados (`/api/employees`)
- **Archivo**: `routes/employees.ts`
- **Endpoints principales**:
  - `GET /employees` — lista con filtros `?clienteId&supervisorId&q&tipoPersonal`
  - `GET /employees/:id` — ficha completa
  - `POST /employees` — crear
  - `PATCH /employees/:id` — editar (con guard administrativos)
  - `GET /employees/:id/operacion` — actividad operativa reciente
  - `GET /employees/:id/asignacion-operativa` — puesto/zona
  - `PUT /employees/:id/asignacion-operativa` — cambiar asignación
  - `GET /employees/:id/rotation` — KPI rotación
- **Tablas**: `employees`, `empleados_periodos_laborales`, `employee_operational_assignments`, `employee_descanso_semanal`

### 7.2 Operaciones (`/api/operaciones`)
- **Archivo**: `routes/operaciones.ts` (4900+ líneas, módulo más complejo)
- **Endpoints**:
  - `GET /operaciones/tablero?fecha=YYYY-MM-DD` — pizarrón
  - `GET /operaciones/tablero/administracion` — panel admin
  - `GET /operaciones/pizarron-historico/:fecha` — vista pasada
  - `POST /operaciones/asignar` — asignar guardia
  - `POST /operaciones/sustituir` — sustitución
  - `POST /operaciones/falta` — marcar falta
  - `GET /operaciones/cierre-hoy` — estado de cierre
  - `POST /operaciones/cerrar-dia` — cierre operativo
  - `GET /operaciones/historial` — movimientos recientes
  - `GET /operaciones/clientes-disponibles`
  - `GET /operaciones/puestos/sin-zona`
  - `GET /operaciones/planificacion-futura?fecha`
  - `GET /operaciones/puestos/:id/titulares`
- **Tablas**: `puestos_operativos`, `puesto_titulares`, `puesto_titular_historico`, `puesto_slots`, `cobertura_segmentos`, `cobertura_diaria`, `movimientos_operativos`, `cierre_operativo_diario`, `cierre_auditoria`, `planificacion_futura`, `solicitudes_cambio_operativo`

### 7.3 RRHH
- **Eventos**: `routes/eventos-rrhh.ts` → tabla `eventos_rrhh`
- **Alertas**: `routes/rrhh-alertas.ts` → `rrhh_alertas`
- **Amonestaciones**: `routes/amonestaciones.ts` → `amonestaciones`, `amonestacion_motivos`, `amonestacion_solicitudes_modificacion`

### 7.4 Planilla y Nómina
- **Pre-planilla**: `routes/pre-planilla.ts` → `pre_planilla_cierres`, `pre_planilla_revision`, `pre_planilla_auditoria`
- **Planilla**: `routes/planilla.ts`, `routes/nomina.ts` → `planillas`, `planilla_lineas`
- **Planillas especiales**: `routes/planillas-especiales.ts` → `planillas_especiales`, `planillas_especiales_lineas`, `planillas_especiales_pagos`
- **Novedades nómina**: `novedades_nomina_diarias`
- **Cálculos clave**: bonificación 1/2/3, horas extras (`config_tarifa_he`), descuentos (`anticipos`, IGSS, seguro de vida).

### 7.5 Anticipos (`/api/anticipos`)
- **Archivo**: `routes/anticipos.ts`
- **Tabla**: `anticipos` (con cuotas, descuentos automáticos)

### 7.6 IGSS (`/api/igss`)
- **Archivo**: `routes/igss.ts`
- **Tablas**: `igss_config_patrono`, `historial_lib_sal`, `detalle_lib_sal`, `detalle_prestaciones_odbc`

### 7.7 Vacaciones (`/api/vacaciones`)
- **Archivo**: `routes/vacaciones.ts`
- **Tablas**: `vacaciones_saldos`, `vacaciones_movimientos`

### 7.8 Prestaciones (`/api/prestaciones`)
- **Archivo**: `routes/prestaciones.ts`
- **Tablas**: `prestaciones_acumulados`, `prestaciones_config`, `prestaciones_movimientos`, `prestaciones_provisiones`, `prestaciones_liquidaciones`, `prestaciones_liquidacion_detalle`, `historial_prestaciones_externas`

### 7.9 Cambios salariales (`/api/cambios-salariales`)
- **Archivo**: `routes/cambios-salariales.ts`
- **Tabla**: `cambios_salariales`

### 7.10 Armería (`/api/armeria`)
- **Archivo**: `routes/armeria.ts`
- **Tablas**: `armas`, `arma_custodia`, `arma_ordenes_servicio`, `arma_sugerencias`, `puesto_municion`

### 7.11 Bodega (`/api/bodega`)
- **Archivo**: `routes/bodega.ts`
- **Tablas**: `bodega_articulos`, `bodega_categorias`, `bodega_movimientos`, `bodega_solicitudes`, `bodega_unidades`

### 7.12 Dotación y Uniformes (`/api/dotacion`, `/api/uniformes`)
- **Archivos**: `routes/dotacion.ts`, `routes/uniformes.ts`
- **Tablas**: `dotacion_pendiente`, `dotacion_pendiente_items`, `kit_ingreso_items`, `lead_dotacion_items`, `entregas_uniforme`, `entregas_uniforme_cuotas`, `ordenes_compra`, `ordenes_compra_items`

### 7.13 Vehículos (`/api/vehiculos`)
- **Archivo**: `routes/vehiculos.ts`
- **Tablas**: `vehiculos`, `vehiculo_custodia`

### 7.14 Custodias (`/api/custodias`)
- **Archivo**: `routes/custodias.ts`
- **Tablas**: `custodia_titulares`, `custodia_asignacion_diaria`, `custodia_fuerza_semanal`, `custodia_sync_log`

### 7.15 Barracas (`/api/barracas`)
- **Archivo**: `routes/barracas.ts`
- **Tablas**: `barracas`, `barraca_asignaciones`

### 7.16 Clientes (`/api/clientes`, `/api/sedes`, `/api/zonas`)
- **Archivos**: `routes/admin-reset.ts` (clientes), `routes/sedes.ts`, `routes/zonas.ts`, `routes/alias.ts`
- **Tablas**: `clients`, `client_aliases`, `client_sedes`, `service_locations`, `operational_zones`, `position_aliases`

### 7.17 Comercial / Leads (`/api/leads`)
- **Archivo**: `routes/leads.ts`
- **Tabla**: `leads`

### 7.18 Solicitudes de Servicio Adicional (SSA) (`/api/solicitudes-servicio`)
- **Archivo**: `routes/solicitudes-servicio.ts`
- **Tablas**: `solicitudes_servicio_adicional`, `ssa_agentes`, `ssa_historial_cambios`

### 7.19 Solicitudes de Empleo (`/api/solicitudes-empleo`)
- **Archivo**: `routes/solicitudes-empleo.ts`
- **Tablas**: `solicitudes_empleo`, `solicitudes_merge_requests`, `applications`

### 7.20 Solicitudes de cambio (turno y operativo) (`/api/solicitudes-cambio`, `/api/solicitudes-turno`)
- **Archivos**: `routes/solicitudes-cambio.ts`, `routes/solicitudes-turno.ts`
- **Tablas**: `solicitudes_cambio_turno`, `solicitudes_cambio_operativo`

### 7.21 Solicitudes de eliminación (`/api/solicitudes-eliminacion`)
- **Archivo**: `routes/solicitudes-eliminacion.ts`
- **Tabla**: `solicitudes_eliminacion`

### 7.22 Turnos (`/api/turnos`)
- **Archivo**: `routes/turnos.ts`, `routes/puesto-slots.ts`
- **Tablas**: `turnos`, `puesto_slots`

### 7.23 Fichaje QR (`/api/agente-fichaje`)
- **Archivo**: `routes/agente-fichaje.ts`
- **Tablas**: `agente_fichajes`, `agente_qr_tokens`, `agente_recorrido_gps`, `agent_assignments`, `phone_auth_log`

### 7.24 Rondas QR (`/api/qr-rondas`)
- **Archivo**: `routes/qr-rondas.ts`
- **Tablas**: `qr_rondas`, `qr_ronda_puntos`, `qr_ronda_eventos`

### 7.25 NFC (legacy / sandbox)
- **Tablas**: `nfc_devices`, `nfc_tags`, `nfc_audit_log`, `nfc_ronda_puntos`, `nfc_ronda_eventos`, `nfc_supervisor_forms`, `nfc_supervisor_form_items`, `nfc_shift_events`, `nfc_sandbox_schedules`

### 7.26 Supervisor (dispositivos)
- Vinculado a `agente-fichaje.ts` y `cobertura.ts`.
- **Tabla**: `supervisor_devices`

### 7.27 Cobertura y Reporte de Turno (`/api/cobertura`)
- **Archivo**: `routes/cobertura.ts`, `routes/reportes.ts`
- **Tablas**: `cobertura_segmentos`, `cobertura_diaria`, `reporte_turno`, `relevo_equipo_novedades`

### 7.28 Incentivos (`/api/incentivos`)
- **Archivo**: `routes/incentivos.ts`
- **Tabla**: `incentivos_cash_cobertura`

### 7.29 Incidencias (`/api/incidents`)
- **Archivo**: `routes/incidents.ts`
- **Tabla**: `incidents`

### 7.30 Emergencias (`/api/emergencias`)
- **Archivo**: `routes/emergencias.ts`

### 7.31 Actas (`/api/actas`)
- **Archivo**: `routes/actas.ts`
- **Configuración**: `config_empresa`

### 7.32 WhatsApp (`/api/wa-config`, `/api/whatsapp-webhook`)
- **Archivos**: `routes/wa-config.ts`, `routes/whatsapp-webhook.ts`, `services/whatsapp/wa-sender.ts`
- **Tablas**: `wa_config`, `wa_menu_options`, `wa_messages`, `wa_audit_log`, `wa_notificaciones_log`
- **Flujo**: ver `WA-WEBHOOK-README.md`.

### 7.33 CMS (`/api/cms`)
- **Archivo**: `routes/cms.ts`
- **Tabla**: `page_content`

### 7.34 Importación (`/api/importacion`)
- **Archivos**: `routes/importacion.ts`, `routes/importacion-maestro.ts`

### 7.35 KPI y Dashboard (`/api/kpi`, `/api/dashboard`)
- **Archivos**: `routes/kpi.ts`, `routes/dashboard.ts`

### 7.36 Reportes (`/api/reportes`)
- **Archivo**: `routes/reportes.ts`

### 7.37 Tareas (Trello-like) (`/api/tareas`, `/api/trello`)
- **Archivos**: `routes/tareas.ts`, `routes/trello.ts`
- **Tablas**: `tareas`, `task_evidencias`
- Ver `TRELLO-README.md`.

### 7.38 Usuarios y Roles (`/api/users`, `/api/roles`)
- **Archivos**: `routes/users.ts`, `routes/roles.ts`
- **Tablas**: `users`, `usuarios_clientes`, `system_roles`, `rol_permisos`, `permisos_ruta_rol`

### 7.39 Tipos de personal config (`/api/tipos-personal-config`)
- **Tabla**: `tipos_personal_config`

### 7.40 Sistema y storage
- **`routes/health.ts`** — healthcheck.
- **`routes/storage.ts`** — proxy a Object Storage para archivos privados.
- **`routes/admin-reset.ts`** — utilidades admin (reset, seeds).
- **`routes/reset-datos.ts`** — borrado controlado.
- **`routes/simulador.ts`** — simulador interno.
- **`routes/portal.ts`** — endpoints específicos del portal cliente.
- **`routes/ficha.ts`** — endpoints unificados de ficha empleado/cliente.

### 7.41 Configuración del sistema
- **Tablas**: `system_config`, `config_empresa`, `config_tarifa_he`, `seguros_config`

---

## 8. Integraciones externas

### 8.1 WhatsApp Business
- **Endpoint Meta**: `https://graph.facebook.com/v18.0/<phone_id>/messages`
- **Webhook recibido**: `POST /api/whatsapp-webhook`
- **Verificación**: `GET /api/whatsapp-webhook?hub.verify_token=...`
- Detalles completos en `artifacts/api-server/WA-WEBHOOK-README.md`.

### 8.2 Cloudflare Turnstile
- **Site verify**: `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- **Modo recomendado**: Managed.
- Hostnames a configurar: `ispsa.net`, `www.ispsa.net`.
- Site key: pública (puede hardcodearse).
- Secret key: solo en env vars.

### 8.3 Object Storage (Replit App Storage)
- Usado para subir DPI (frente/reverso), fotos, documentos.
- Endpoints proxy en `routes/storage.ts` para servir archivos privados con auth.
- **Subida de foto de empleado (manual desde ficha)**: en la pestaña Perfil del empleado, el botón "Subir/Cambiar foto" usa el mismo flujo que el carnet/kiosco: comprime la imagen a JPEG 480 px, calidad 0.82 (`comprimirFotoEmpleado` en `Empleados.tsx`), sube el blob a `POST /api/storage/uploads/direct` con `Content-Type: image/jpeg` y luego guarda el `objectPath` con `PATCH /api/employees/:id/foto` (`{ foto_url }`). Mismo backend que la carga masiva, sin endpoints nuevos.

### 8.4 IGSS
- Sin API directa; el sistema genera archivos en formato compatible con la planilla IGSS para presentación manual.

---

## 9. Deploy

### Workflows de desarrollo
- `pnpm --filter @workspace/api-server run dev` — backend con hot reload.
- `pnpm --filter @workspace/isp-web run dev` — frontend Vite.

### Build
- Backend: `pnpm --filter @workspace/api-server run build` (esbuild → `dist/index.mjs`).
- Frontend: `pnpm --filter @workspace/isp-web run build` (Vite).

### Producción
- Deploy en Replit Reserved VM o Autoscale.
- Cada artifact tiene su `artifact.toml` con `[services.env]` para variables públicas y `[services.production.env]` para overrides.
- Variables sensibles en **shared userenv** del Replit (no en archivos).
- Captcha site key (público) hardcodeado en `[services.env]` del isp-web para que Vite lo incruste en build.

### Notas críticas
- ⚠️ **Vite no ve el shared userenv en build automáticamente.** Variables `VITE_*` deben estar en `[services.env]` del artifact.toml.
- ⚠️ **Node sí ve el shared userenv en runtime.** Variables como `WA_ACCESS_TOKEN` o `TURNSTILE_SECRET_KEY` están disponibles en `process.env` del backend.
- ⚠️ **No editar `.replit-artifact/artifact.toml` directamente** — usar `verifyAndReplaceArtifactToml` del entorno Replit.

### Health check
- `GET /api/health` — devuelve `{ ok: true }` si DB y server responden.

### Logs en producción
- Pino en formato JSON. Replit los expone en su panel de deployment logs.

---

## 10. Bugfixes notables

### 10.1 Pantalla en blanco en `/admin/operaciones/zonas` (abr 2026)
- **Síntoma**: la página no desplegaba contenido.
- **Causa raíz**: en `ZonasOperativas.tsx` se importaba el ícono `Map` de
  `lucide-react`, sombreando el constructor global `Map` de JavaScript.
  Cuando el componente intentaba construir un `new Map(...)` (en el modal
  de zona), el bundle de Vite trataba de instanciar el componente React
  como constructor y crasheaba.
- **Fix**: renombrar el import a `Map as MapIcon` y dejar `new Map(...)`
  apuntando al constructor global (commit fix Zonas).
- **Hardening adicional**:
  - Helper `fetchArray<T>()` que normaliza respuestas no-array a `[]`,
    evitando crashes si el backend devuelve `{ error: ... }`.
  - `ZonasErrorBoundary` local: si algo crashea en runtime, muestra el
    error en pantalla (mensaje + stack) en vez de quedar en blanco.
  - Normalización de `zona.supervisores` a `[]` por si llega `null`.

### 10.2 Contrato post-prueba con fecha incorrecta (abr 2026)
- **Síntoma**: al imprimir los dos contratos desde el flujo
  *Kiosco → Solicitud contratada*, ambos PDFs salían con la misma
  fecha de inicio (la fecha de alta).
- **Causa**: en `KioscoSolicitudes.tsx`, el botón "Contrato Post-Prueba"
  pasaba `fecha_inicio: new Date().toISOString().slice(0, 10)` igual que
  el botón "Contrato Inicial", sin sumar los 2 meses de período de prueba.
- **Fix**: el botón post-prueba ahora calcula `new Date() + 2 meses`
  vía `setMonth(getMonth() + 2)` antes de pasarlo al generador de PDF.
- **Notas**:
  - El botón equivalente en la ficha del empleado (`Empleados.tsx →
    TabContratos`) ya hacía bien el cálculo (lee de la BD el
    `fecha_inicio` del contrato post-prueba almacenado).
  - El backend ya guardaba bien las fechas en `contratos_empleados`
    al dar de alta (`fechaIngreso` para inicial, `+2 meses` para
    post-prueba) — el bug era solo en la generación del PDF desde
    el flujo del kiosco.

### 10.3.6 Contrato post-prueba comparte fecha de inicio con el inicial (abr 2026)
- **Necesidad**: el contrato post-prueba estaba imprimiendo como "fecha de
  inicio de la relación laboral" la fecha de alta + 2 meses (vencimiento
  del período de prueba). Lo correcto es que ambos contratos (inicial y
  post-prueba) lleven como fecha de inicio la fecha de alta original,
  porque el post-prueba es la *sustitución* del inicial y la antigüedad se
  cuenta desde el ingreso.
- **Cambios**:
  - `KioscoSolicitudes.tsx` botón *Contrato Post-Prueba*: ya no suma 2
    meses; usa `asignacion.fecha_alta` directo, igual que el inicial.
  - `Empleados.tsx → TabContratos`: tanto el contrato inicial como el
    post-prueba se generan con `fecha_inicio = fechaIngreso` (la del
    contrato inicial guardado, con fallback a `employees.fecha_ingreso`).
- **Notas**:
  - La cláusula QUINTA del PDF post-prueba ya menciona explícitamente que
    el contrato sustituye al inicial y reconoce la antigüedad acumulada,
    así que la frase de inicio no necesita cambiar.
  - El registro `contratos_empleados` del post-prueba sigue almacenado en
    BD con `fecha_inicio = alta + 2 meses` para fines administrativos
    (saber cuándo termina el período de prueba); este cambio solo afecta
    el texto del PDF.

### 10.3.5 Fecha de alta editable al contratar desde el kiosco (abr 2026)
- **Necesidad**: al contratar desde *Kiosco → Solicitudes*, la fecha de
  ingreso siempre se fijaba en `CURRENT_DATE` (hoy). Esto era incorrecto
  cuando el contrato se procesa días después o cuando se quiere agendar
  una alta a futuro.
- **Cambios**:
  - **Frontend** (`KioscoSolicitudes.tsx`): nuevo input `type="date"` en
    el formulario de "Confirmar y Crear Ficha", con valor por defecto =
    hoy. Esa fecha se envía como `fecha_ingreso` al backend y también la
    consumen los botones de "Contrato Inicial" (= esa fecha) y
    "Contrato Post-Prueba" (= esa fecha + 2 meses, calculado en local
    para evitar desfase UTC).
  - **Backend** (`routes/solicitudes-empleo.ts → POST /:id/contratar`):
    acepta `fecha_ingreso` opcional en formato `YYYY-MM-DD`. Si viene,
    se usa para `employees.fecha_ingreso` y para
    `fecha_inicio_prestaciones = fecha_ingreso + 2 meses`. Si no viene,
    cae a `CURRENT_DATE` como antes (compatibilidad). Aplica tanto al
    INSERT inicial como al UPDATE de reactivación (DPI ya existente).
- **Notas**:
  - Validación estricta en backend con regex `/^\d{4}-\d{2}-\d{2}$/`
    para evitar inyección o fechas con timezone.
  - Por consistencia con `Empleados.tsx → TabContratos`, esa fecha es la
    que aparece como “Fecha de ingreso” en la ficha del colaborador y
    es fuente única de verdad para contratos, prestaciones y antigüedad.

### 10.3 Edad del representante legal en contratos (abr 2026)
- **Necesidad**: el contrato laboral imprimía “mayor de edad” para el
  representante legal de la empresa, en lugar de la edad real
  (“de XX años de edad”) como se hace con los comparecientes.
- **Cambios**:
  - **BD**: nueva columna `representante_fecha_nacimiento DATE` en
    `config_empresa` (auto-migrate idempotente en `auto-seed.ts`,
    junto a la migración ACTAS-01).
  - **API** (`routes/actas.ts`):
    - `GET /config-empresa` devuelve la fecha como `YYYY-MM-DD`
      vía `TO_CHAR`.
    - `PUT /config-empresa` acepta el campo y permite limpiarlo
      enviando `""` (CASE → NULL).
  - **Frontend**:
    - `RRHHEventos.tsx → ModalConfigEmpresa`: nuevo input
      `type="date"` junto al DPI del representante legal.
    - `pdfRrhh.ts`: helper `calcularEdadAnios()`,
      `cargarPatronoDesdeConfig()` lee el nuevo campo, y
      `generarContratoLaboral()` reemplaza el literal “mayor de
      edad” por `de X años de edad` cuando hay fecha registrada
      (fallback al texto genérico si no se ha configurado).
- **Notas**:
  - El cálculo de edad se hace en cliente al momento de generar el
    PDF, así la edad siempre está actualizada sin depender de un
    campo derivado almacenado.
  - Misma fórmula que para los comparecientes (`floor((hoy - dob)
    / 365.25)`).
