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

### Middleware `permisos-middleware.ts` (modo estricto, abr 2026)

Implementa el cierre por defecto de la API: **toda ruta admin requiere sesión válida y permiso**, salvo las explícitamente whitelisted.

- **`ROUTE_MODULO_MAP`**: mapa de prefijo de ruta → clave de módulo (la misma que se guarda en `rol_permisos.modulo_clave`). Ejemplos reales del código: `"/employees" → "empleados"`, `"/operaciones" → "pizarron"`, `"/planificacion-futura" → "pizarron"`, `"/cms" → "cms"`, `"/agente/tokens" → "carnets_qr"`. El matcheo es **PRECISO**: el path debe ser exactamente el prefijo o seguir con `/` (esto evita que `/wa` matchee `/wa-config`, o que `/roles` matchee `/roles/:clave`).
- **`isPublicPath(path, method)`**: rutas legítimamente públicas. Hoy son:
  - Exactas (cualquier método): `/healthz`, `/health`, `/auth/login`, `/auth/change-password`, `/session/permisos`, `/roles/modulos`.
  - `GET /cms/pages/:key` (consumido por el sitio web público — solo páginas con `status='published'` y campos sanitizados; el listado `/cms/pages` queda admin porque incluye borradores y metadata interna).
  - Prefijos seguros con su propio guard: `/portal/*` (tiene `requirePortalAuth`), `/webhooks/whatsapp/*` (validado por Meta).
  - POST-only para formularios públicos: `POST /leads`, `POST /applications` (GET/PATCH/DELETE de esos recursos siguen siendo admin).
- **Comportamiento ante sesión inválida o ausente**: si la ruta está mapeada en `ROUTE_MODULO_MAP` y no hay sesión válida → **401** (no 200 con datos vacíos, lo que cerró la fuga histórica). Si la ruta no está mapeada y no es pública, el middleware hace `next()` (passthrough) y queda en manos del handler/router específico decidir si requerir auth — por eso es importante mantener `ROUTE_MODULO_MAP` actualizado al agregar módulos nuevos.
- **Caché en memoria**: permisos por usuario con TTL 30s para no golpear la DB en cada request.

#### Convención frontend

Todas las páginas admin envían el header `x-isp-session` en cada fetch. Cada archivo define un helper local al inicio:

```ts
const sessionHeader = () => ({ "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "" });
```

Y lo aplica en cada request:

```ts
fetch(`${API_BASE}/employees/${id}`, { headers: sessionHeader() })
fetch(`${API_BASE}/employees/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...sessionHeader() },
  body: JSON.stringify(data),
})
```

Si una pantalla admin empieza a devolver 401 después de un cambio, lo más probable es que un `fetch` nuevo se haya quedado **sin** el header de sesión. Buscar con `rg "fetch\(\`\\\$\{API_BASE\}" archivo.tsx` los fetches del archivo y verificar que cada uno lleve `headers: sessionHeader()` (o el helper equivalente del archivo: `hd()`, `hdr()`, `h()`).

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
  - `GET /operaciones/proximos-regresos-vacaciones?dias=5&fecha=YYYY-MM-DD` — titulares que regresan de vacaciones dentro de la ventana indicada (default 5 días). Devuelve `{fecha, dias, regresos:[{employee_id, nombre_completo, vac_inicio, vac_fin, dias_para_regreso, puestos:[{id, nombre, cliente_nombre}]}]}`. Cruza vacaciones activas con puesto_slots + puesto_titulares + legacy. Usado por el banner de cuenta regresiva en pizarrón y en RRHH/Vacaciones.
- **Tablas**: `puestos_operativos`, `puesto_titulares`, `puesto_titular_historico`, `puesto_slots`, `cobertura_segmentos`, `cobertura_diaria`, `movimientos_operativos`, `cierre_operativo_diario`, `cierre_auditoria`, `planificacion_futura`, `solicitudes_cambio_operativo`
- **Reglas de visualización del titular en el pizarrón**:
  - El pizarrón lee titulares de **3 fuentes** (orden de prioridad): (A) `puesto_slots.empleado_id` (multi-titular 24x24), (B) `puesto_titulares.employee_id`, (C) `puestos_operativos.titular_employee_id` (legacy). Cualquier endpoint que valide titularidad debe consultar las 3.
  - **Regla de unicidad de titularidad** (PIZ-DUP-01): un colaborador solo puede ser titular de **un** puesto operativo a la vez. Cualquier endpoint que asigne titularidad (POST/PUT a `puesto_slots`, asignar desde pizarrón, cambiar titular custodia, importación) debe envolverse en transacción + advisory lock por `employee_id` + llamar a `liberarTitularidadAgente()` en `routes/operaciones/_helpers/titularidad.ts`. Esa función libera las 3 fuentes (puesto_slots, puesto_titulares, legacy) y custodias en un solo paso atómico, excluyendo el destino actual.
  - **Falta del titular** (`eventos_rrhh.tipo_evento='falta'`): el puesto se muestra descubierto, `titular_faltando=true`. Se preserva `titular_employee_id` para mostrar de quién fue la falta.
  - **Vacaciones del titular** (`tipo_evento='vacaciones'` con rango `fecha`–`fecha_fin` que incluye la fecha consultada): el puesto se muestra descubierto, `titular_en_vacaciones=true` con `titular_vac_inicio`/`titular_vac_fin`. Al terminar el rango, el titular vuelve a aparecer cubriendo el puesto automáticamente. **No** aplica para `vacaciones_trabajadas` (el colaborador renuncia a sus vacaciones y trabaja).
  - **Titular dado de baja** (PIZ-BAJA-01) (`employees.estado_laboral != 'activo'`): el puesto se muestra descubierto y `titular_dado_de_baja=true` con `titular_estado_laboral` ('baja', 'suspendido', 'licencia'). El operador debe asignar nuevo titular desde el pizarrón. La titularidad real **no** se borra automáticamente — el operador la libera al asignar otro empleado al slot (gracias a la regla de unicidad).
  - Estos vaciados son **virtuales** (solo en respuesta del API, no tocan BD), por lo que la titularidad real se preserva intacta.

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
- **Generación de planilla mensual** (`GET /igss/generar-planilla?mes&anio`):
  Construye archivo `.txt` formato 2.2.0 con secciones `[centros]`, `[empleados]`,
  `[suspendidos]`, `[licencias]`, `[juramento]`.
  - **Sección `[empleados]`**: días trabajados = `30 - dias_descuento` donde
    `dias_descuento` ahora suma tanto **faltas aprobadas** (`novedades_nomina_diarias.falta = TRUE`)
    como **suspensiones aprobadas** (`novedades_nomina_diarias.suspension = TRUE`),
    excluyendo siempre las rechazadas (`impacto_nomina = 'rechazado_rrhh'`). El salario
    devengado se reduce proporcionalmente a esos días.
  - **Sección `[suspendidos]`**: una línea por cada periodo de suspensión que se
    solapa con el mes. Fuente: `eventos_rrhh` con `tipo_evento = 'suspension'` y
    `estado = 'aprobado'`. Las fechas (`desde` / `hasta`) se clipean al rango del
    mes en SQL (`GREATEST` / `LEAST` sobre `date` puros) para evitar off-by-one
    por zona horaria. Si un empleado tiene múltiples puestos titulares activos
    se elige el centro IGSS de menor código de forma determinista. Como
    fallback, los empleados con `estado_laboral = 'suspendido'` que NO tienen
    evento aprobado en el mes se siguen reportando con fechas del mes completo
    (compatibilidad con planillas anteriores).
- **Doble entrada del evento de suspensión** (Forma A / Forma B): el evento
  RRHH `tipo_evento = 'suspension'` aprobado se puede crear por dos rutas y
  ambas dejan **el mismo estado en BD**:
  - **Forma B – RRHH > Eventos** (`POST /rrhh/eventos`): captura un evento
    pendiente que un aprobador valida después.
  - **Forma A – Ficha del empleado** (`PATCH /employees/:id/estado` con
    `estadoLaboral='suspendido'`): el endpoint exige `fechaDesde` y
    `fechaHasta` (YYYY-MM-DD); en una sola transacción actualiza
    `estado_laboral`, inserta el evento RRHH ya `aprobado` con
    `generado_desde='ficha_empleado'` y hace UPSERT en
    `novedades_nomina_diarias` para cada día del rango con
    `suspension=TRUE`, `descuento_dia=TRUE`, `trabajo_dia=FALSE`. La UI
    abre un modal (`ModalSuspenderEmpleado`) para pedir las fechas y un
    motivo opcional antes de llamar al endpoint.
- **Alertas de suspensión próxima a vencer y renovación**:
  - `auto-seed.ts` (bloque **SUSP-01**, no bloqueante) corre al levantar
    el API y consulta `eventos_rrhh` con `tipo_evento='suspension'`,
    `estado='aprobado'`, `anulado_at IS NULL` cuya `fecha_fin` cae entre
    `CURRENT_DATE` y `CURRENT_DATE + 7 días`. Genera filas en
    `rrhh_alertas` con `tipo='suspension_proxima_vencer'` para los
    triggers **7 / 3 / 1 días antes** del vencimiento (prioridad
    `baja` / `media` / `alta` respectivamente). El `datos_clave`
    incluye `evento_id`, `fecha_inicio`, `fecha_fin`, `dias_restantes`,
    `trigger_dias`, `cliente_nombre`, `puesto_nombre`. La deduplicación
    es por `employee_id + tipo + evento_id + trigger_dias` (no se
    crea una nueva alerta para el mismo trigger en el mismo evento).
  - `POST /api/employees/:id/renovar-suspension` extiende la
    `fecha_fin` de un evento de suspensión aprobado vigente. Body:
    `{ eventoId, nuevaFechaHasta (YYYY-MM-DD), observaciones? }`. En
    una sola transacción: valida (mismo empleado, evento aprobado y no
    anulado, nueva fecha > fecha_fin actual, sin solapamiento con otra
    suspensión aprobada del mismo empleado), `UPDATE` la `fecha_fin`,
    concatena un comentario en `observaciones` con la marca de
    renovación, hace UPSERT en `novedades_nomina_diarias` para los días
    nuevos `(fecha_fin_anterior + 1 .. nuevaFechaHasta)` con
    `suspension=TRUE`, `descuento_dia=TRUE`, `trabajo_dia=FALSE` y
    vínculo a `evento_rrhh_id`, y por último marca como `'resuelta'`
    todas las alertas `suspension_proxima_vencer` asociadas a ese
    `evento_id`. Devuelve `{ ok, eventoId, fechaFinAnterior,
    nuevaFechaHasta, novedadesCreadas, alertasResueltas }`. La pantalla
    **Alertas RRHH** muestra estas alertas con un botón "Renovar
    suspensión" que abre `ModalRenovarSuspension` (selector de fecha
    con `min = fecha_fin_actual + 1 día` y campo de motivo).

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

### 10.4 Editor de plantillas de contrato laboral (abr 2026)
- **Necesidad**: el texto del Contrato Individual de Trabajo (inicial y
  post-prueba) estaba hardcodeado en `pdfRrhh.ts`. Cualquier cambio
  legal o redacción requería tocar código. Se necesitaba un editor en
  Admin con variables del estilo `{{empleado_nombre}}`.
- **BD**: nueva tabla `plantillas_contrato`
  (`id, tipo, version, activa, titulo, subtitulo, encabezado, clausulas
  TEXT (JSON), cierre, notas, created_by/at, updated_at`) +
  índice `plantillas_contrato_tipo_activa_idx`. Creada con SQL directo
  porque drizzle-kit push detectó nombre similar y proponía RENOMBRAR
  tablas existentes (peligro). Schema en `lib/db/src/schema/isp.ts`.
- **API** (`routes/plantillas-contrato.ts`):
  - `GET /plantillas-contrato/variables` (público) — catálogo de
    `{{vars}}` con descripción y ejemplo.
  - `GET /plantillas-contrato/:tipo/activa` (público) — lazy-seed:
    si no hay versión activa la inserta desde
    `lib/plantillas-contrato-default.ts`.
  - `GET /plantillas-contrato/:tipo/versiones` (admin/rrhh).
  - `PUT /plantillas-contrato/:tipo` (admin/rrhh) — crea version+1
    activa, desactiva las previas del mismo tipo.
  - `POST /plantillas-contrato/:tipo/restaurar/:version` — activa una
    versión vieja sin crear nueva fila.
  - `POST /plantillas-contrato/:tipo/reset-default` — crea versión
    nueva con el texto base del archivo defaults.
- **Frontend**:
  - Pantalla `admin/pages/configuracion/PlantillasContrato.tsx` con
    tabs Inicial / Post-prueba, editor de cada cláusula
    (subir/bajar/eliminar/agregar), bloques fijos para encabezado
    y cierre, panel lateral de variables (clic = copia al portapapeles),
    botones Guardar / Restaurar original / Versiones / Vista previa.
  - Ruta `/admin/configuracion/plantillas-contrato` registrada en
    `App.tsx`, sidebar entrada en `permissions.ts` sección 6
    (Configuración) con permiso `plantillas_contrato` para roles
    `admin` y `rrhh`.
  - `pdfRrhh.ts → generarContratoLaboral`: ahora carga la plantilla
    activa por `fetch /api/plantillas-contrato/:tipo/activa`,
    construye un objeto `ctx` con todas las variables disponibles y
    aplica `aplicarVars()` (regex `/\{\{var\}\}/`) sobre encabezado,
    cada cláusula y cierre. Soporta:
    - Párrafos separados por línea en blanco (`\n\n`).
    - Negrita de párrafo completo envolviéndolo entre `**...**`.
    - Si una variable no existe se deja el literal `{{nombre}}` para
      que sea visible en revisión.
  - El bloque hardcodeado de cláusulas (~210 líneas) fue eliminado de
    `pdfRrhh.ts`. Las firmas siguen como layout fijo.
- **Cambios de redacción aplicados al default**:
  - Cláusula SEXTA: se eliminó el inciso (e) "Cobertura del IGSS" que
    estaba duplicado/redundante; los incisos (e/f/g) se renumeraron
    a (e/f).
- **Observabilidad**: cada PUT/restore queda en logs del API con
  `username`, `tipo`, `version`. La pantalla muestra historial
  completo en modal con quién y cuándo creó cada versión.

### 10.5 Pre-planilla — devengados completos y amonestaciones (abr 2026)

- **Síntoma**: la tarjeta de Total Real / Total Estimado por
  colaborador en `/admin/pre-planilla` solo mostraba el sueldo
  proporcional, las horas extra y los descuentos. Faltaba ver la
  bonificación incentivo (Q250 por defecto), las bonificaciones
  1/2/3 y el descuento por amonestaciones económicas — aunque el
  backend ya los traía en `QUERY_CONSOLIDADO`.

- **Cambio funcional**:
  - **Devengados** ahora visibles y sumados al total:
    - Bonificación incentivo (Decreto 78-89).
    - Bonificación 1, 2 y 3 (las que tenga registradas el empleado).
  - **Egreso nuevo** ahora visible y descontado del total:
    - Amonestaciones económicas activas del período.
  - **Egresos ya existentes** que faltaban en el desglose visual
    aunque sí se descontaban (ahora visibles): seguro de vida,
    anticipos/uniforme/barraca en la tarjeta de proyección.

- **Fórmula de proporcionalidad** (decisión de negocio confirmada
  por dirección — fórmula simple, sin interpretar legalmente
  vacaciones/incapacidad):
  - `bonif_real      = base / 30 × dias_trabajados`
  - `bonif_proyectada = base / 30 × (dias_periodo − dias_descuento)`
  - Aplica idéntica a bonificación incentivo y a bonificaciones
    1/2/3. Cada una usa su propia base mensual del perfil del
    empleado (`employees.bonificacion_incentivo`,
    `bonificacion_1/2/3`).

- **IGSS / ISR — sin cambios**: se siguen calculando solo sobre
  el sueldo base (no sobre bonificaciones). Es lo correcto
  legalmente: la bonificación incentivo no es base de IGSS ni
  forma parte del salario ordinario para retención de ISR
  quincenal.

- **Archivos**:
  - `artifacts/isp-web/src/admin/pages/PrePlanilla.tsx`
    - `interface ColaboradorPre`: añadidos `bon_incentivo_base`,
      `bon_1_base`, `bon_2_base`, `bon_3_base`,
      `amonestaciones_monto`, `amonestaciones_count`.
    - `calcularTotalEstimado()`: calcula `bonIncentivoReal/Proy`,
      `bon1/2/3 Real/Proy`, `totalBonifReal/Proy`,
      `amonestaciones`, y los suma/resta en `total` y `totalReal`.
    - Tarjetas "Total Real" y "Total Estimado": agregadas filas
      condicionales (`> 0`) para cada bonificación, amonestaciones
      y seguro de vida.
  - `artifacts/api-server/src/routes/pre-planilla.ts` — sin
    cambios (ya devolvía los campos).

- **Compatibilidad**: el backend ya generaba los campos desde el
  hito BON-01 / AMON-01; los autotests y la planilla final no
  cambian. La `calcularBruto` del lado del API (al cerrar
  planilla quincenal) ya incluye bonificación incentivo y
  amonestaciones — esta corrección únicamente alinea la vista
  previa de pre-planilla con lo que terminará pagando la
  planilla cerrada.

### 10.5.1 Pre-planilla — columnas devengados/egresos en tabla y total general (abr 2026)

- **Tabla principal de pre-planilla** ahora muestra TODOS los
  devengados y egresos por colaborador, no solo en el panel
  lateral de detalle. Columnas agregadas:
  - **Bonif.** — suma de bonificación incentivo + bonif 1/2/3
    devengadas en el período (proporcional a días trabajados).
    Tooltip al pasar el mouse desglosa cada componente.
  - **Otros Desc.** — suma de cuota uniforme + barraca + seguro
    de vida + amonestaciones económicas. Tooltip desglosa cada
    componente y muestra el nombre de la barraca y el conteo
    de amonestaciones.
- **Fila de totales (`<tfoot>`)** sticky al final de la tabla.
  Suma por columna de toda la lista filtrada:
  - Sueldo base, faltas, suspensiones, horas extra (h),
    bonificaciones (+), anticipos (–), otros descuentos (–),
    **Total General** (real cerrado + estimado a período
    completo si difiere), IGSS (–), ISR (–).
  - El total general se pinta verde si es positivo, rojo si
    queda negativo (caso patológico que indica más descuentos
    que devengos — alerta visible).
- **Optimización**: `calcularTotalEstimado()` ahora se llama
  una sola vez por colaborador (`estimadosPorEmp`) en vez de
  3+ veces como hacía antes (totalIGSS, totalISR, render).

### 10.5.2 Bonificaciones — fórmula unificada en pre-planilla y planilla final (abr 2026)

- **Decisión de empresa** (confirmada por dirección, abr 2026):
  > La bonificación incentivo (Q250 y bonif 1/2/3) se devenga
  > únicamente por **días efectivamente trabajados + permiso con
  > goce**. Vacaciones e incapacidad por IGSS NO devengan
  > bonificación.

- **Razonamiento de la decisión**:
  - **Vacaciones**: durante vacaciones el colaborador no realiza
    actividad para la empresa; la bonif. incentivo es por
    productividad, no por estar contratado.
  - **Incapacidad IGSS**: la subvención por incapacidad la paga
    el seguro social, no la empresa, así que no corresponde
    devengar bonificación.
  - **Permiso con goce**: la empresa elige reconocerlo (cumpleaños,
    duelo, matrimonio, etc.).

- **Fórmula final unificada** en backend y frontend:
  ```
  bonificacion = (montoBase_mensual / 30) × diasPagables
  diasPagables = dias_trabajados + dias_permiso_con_goce
                 (capped a [0, diasPeriodo])
  ```
  - Divisor fijo **/30** (mes contable estándar) — IDÉNTICO en
    `calcularBonificacionIncentivo`, `bonProporcional` (planilla.ts)
    y `calcularTotalEstimado` (PrePlanilla.tsx).
  - `montoBase_mensual` siempre el mensual entero
    (Q250 para incentivo, `employees.bonificacion_1/2/3` para las otras).
    Para una quincena con los 15 días pagables sale Q125 automáticamente
    (250/30×15=125), sin necesidad de escalar el monto por frecuencia.
  - Aplica idéntica a bonificación incentivo y a bonificaciones 1, 2, 3.

- **Archivos modificados para alinear**:
  - `artifacts/api-server/src/lib/nomina-calc.ts` →
    `calcularBonificacionIncentivo()`: removidos
    `diasVacaciones` y `diasIncapacidadConGoce` del cálculo.
  - `artifacts/api-server/src/routes/planilla.ts` línea 143 →
    `bonProporcional()`: misma corrección para bonif 1/2/3.
  - `artifacts/isp-web/src/admin/pages/PrePlanilla.tsx` →
    `calcularTotalEstimado()`: `diasTrabReal` ahora suma
    `dias_permiso_con_goce`. `diasTrabProy` resta vacaciones
    e incapacidad del período proyectado.

- **Garantía operativa**: lo que el supervisor ve en
  pre-planilla = lo que el sistema paga al cerrar planilla.
  Ya no hay discrepancia silenciosa por vacaciones/incapacidad.

### 10.5.3 Amonestaciones económicas — cobro real en planilla final (abr 2026)

- **Problema previo**: la pre-planilla mostraba el monto de
  amonestaciones económicas activas como descuento estimado, pero al
  cerrar la planilla solo se VINCULABAN a la planilla
  (`UPDATE amonestaciones SET descontado=TRUE, planilla_id=…`)
  sin restarse del neto. El campo `otros_descuentos` estaba fijado en
  `0` literal. Resultado: BD decía "cobrada" pero el colaborador
  recibía el pago sin la rebaja.

- **Corrección**:
  - `routes/planilla.ts` POST `/nomina/planilla`: el monto a cobrar
    se LEE DEL SNAPSHOT del cierre (`row.amonestaciones_monto`), no
    de BD viva. Ese campo del snapshot lo congela
    `pre-planilla.ts:266-274` (QUERY_CONSOLIDADO) al cerrar la
    pre-planilla, con criterios `tipo='economica' AND estado='activa'
    AND descontado=FALSE AND fecha BETWEEN desde AND hasta`.
  - `calcularLinea()` recibe `amonestacionesMonto` y lo asigna a
    `otros_descuentos`. El `total_neto` se calcula restando
    `otros_descuentos` igual que cualquier otro descuento.
  - El `UPDATE amonestaciones SET descontado=TRUE` posterior usa
    los mismos criterios para vincular las filas en BD.

- **Garantía operativa**: lo que la pre-planilla muestra como
  descuento por amonestaciones = lo que el colaborador deja de
  recibir en la planilla final, **incluso si entre cierre y
  generación de planilla alguien crea/modifica/anula amonestaciones**
  en BD. Lo cobrado queda fijado al momento del cierre.

- **Reversión**: al revertir planilla, las amonestaciones vinculadas
  vuelven a `descontado=FALSE` y `planilla_id=NULL`, y al re-cerrarse
  la pre-planilla regenera el snapshot con el estado vigente.

- **Pendiente menor (no bloqueante)**: agregar `total_otros_descuentos`
  al reduce de totales y a la tabla `planillas` para que el reporte
  agregado muestre cuánto se cobró en total por amonestaciones.
