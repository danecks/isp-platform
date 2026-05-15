# Auditoría del sistema ISP, S.A. — Fase 0

> Estado al cierre de Fase 0 (refactor de fundaciones). Este documento es la
> foto inicial sobre la cual se planifican las fases siguientes (Operaciones,
> RRHH, Comercial, Logística, Portal/PWA, Soporte/WA/CMS).

---

## 1. Mapa de paquetes del monorepo

| Paquete                                | Propósito                                          | Tipo        |
|----------------------------------------|----------------------------------------------------|-------------|
| `lib/db`                               | Esquema Drizzle + cliente Postgres compartido      | librería    |
| `lib/domain` *(nuevo en Fase 0)*       | Tipos, fechas y validadores compartidos            | librería    |
| `lib/api-spec`                         | OpenAPI tipado (codegen)                           | librería    |
| `lib/api-zod`                          | Schemas Zod compartidos backend/frontend           | librería    |
| `lib/api-client-react`                 | Cliente TanStack Query autogenerado                | librería    |
| `artifacts/api-server`                 | API Express + auto-migrador (`auto-seed.ts`)       | servicio    |
| `artifacts/isp-web`                    | Web app (público + admin + portal cliente)         | frontend    |
| `artifacts/mockup-sandbox`             | Sandbox de mockups y previsualización              | dev tool    |

---

## 2. Esquema de base de datos

### 2.1 Tablas en Drizzle (`lib/db/src/schema/*`)

Tras la división por dominio (Fase 0), 19 tablas viven en el schema Drizzle:

| Dominio       | Archivo                | Tablas                                                                                       |
|---------------|------------------------|----------------------------------------------------------------------------------------------|
| Usuarios      | `usuarios.ts`          | `users`                                                                                      |
| Clientes      | `clientes.ts`          | `clients`, `client_aliases`, `service_locations`, `position_aliases`                         |
| RRHH          | `rrhh.ts`              | `employees`, `anticipos`, `plantillas_contrato`                                              |
| Operaciones   | `operaciones.ts`       | `incidents`, `agent_assignments`, `tareas`, `task_evidencias`, `wa_notificaciones_log`       |
| Comercial     | `comercial.ts`         | `leads`, `applications`                                                                      |
| WhatsApp      | `whatsapp.ts`          | `wa_config`, `wa_messages`, `wa_menu_options`, `wa_audit_log`                                |

`isp.ts` se conserva como **barrel retrocompatible** — todos los imports
históricos (`from "@workspace/db/schema/isp"`) siguen funcionando.

### 2.2 Tablas creadas dinámicamente vía `auto-seed.ts`

`artifacts/api-server/src/lib/auto-seed.ts` (6 354 líneas) es el único
mecanismo autorizado para crear/extender tablas en producción
(`CREATE TABLE IF NOT EXISTS`). Crea **102 tablas adicionales** que NO tienen
definición Drizzle y por tanto NO disponen de tipos `$inferSelect` ni Zod
schemas autogenerados.

Listado completo (orden alfabético):

```
agente_fichajes, agente_qr_tokens, agente_recorrido_gps,
amonestacion_causales_legales, amonestaciones, amonestacion_motivos,
amonestacion_solicitudes_creacion, amonestacion_solicitudes_modificacion,
arma_codigo_renumeracion, arma_custodia, arma_ordenes_servicio, armas,
armas_alertas, arma_sugerencias, barraca_asignaciones, barracas,
bodega_articulos, bodega_categorias, bodega_movimientos, bodega_solicitudes,
bodega_unidades, cambios_salariales, cierre_auditoria, cierre_operativo_diario,
client_sedes, cobertura_diaria, cobertura_segmentos, config_empresa,
config_tarifa_he, contratos_empleados, custodia_asignacion_diaria,
custodia_fuerza_semanal, custodia_sync_log, custodia_titulares, detalle_lib_sal,
detalle_prestaciones_odbc, dotacion_pendiente, dotacion_pendiente_items,
empleados_periodos_laborales, employee_descanso_semanal,
employee_operational_assignments, entregas_uniforme, entregas_uniforme_cuotas,
eventos_rrhh, historial_lib_sal, historial_prestaciones_externas,
igss_config_patrono, incentivos_cash_cobertura, kit_ingreso_items,
lead_dotacion_items, movimientos_operativos, novedades_nomina_diarias,
operational_zones, ordenes_compra, ordenes_compra_items, page_content,
personal_slots, phone_auth_log, planificacion_futura, planilla_lineas,
planillas, planillas_especiales, planillas_especiales_lineas,
planillas_especiales_pagos, pre_planilla_auditoria, pre_planilla_cierres,
pre_planilla_revision, prestaciones_acumulados, prestaciones_config,
prestaciones_liquidacion_detalle, prestaciones_liquidaciones,
prestaciones_movimientos, prestaciones_provisiones, puesto_municion,
puestos_gps, puesto_slots, puestos_operativos, puesto_titulares,
puesto_titular_historico, qr_ronda_eventos, qr_ronda_puntos, qr_rondas,
relevo_equipo_novedades, reporte_turno, rol_permisos, rrhh_alertas,
seguros_config, solicitudes_cambio_operativo, solicitudes_cambio_turno,
solicitudes_eliminacion, solicitudes_merge_requests,
solicitudes_servicio_adicional, ssa_agentes, ssa_historial_cambios,
supervision_catalogo_items, supervision_gps_tracks, supervision_inspecciones,
supervision_novedades, supervision_plan_mensual, supervision_sesiones,
supervision_visitas_programadas, supervisor_devices, system_config,
system_roles, tipos_personal_config, turnos, usuarios_clientes,
vacaciones_movimientos, vacaciones_saldos, vehiculo_custodia, vehiculos,
visitas, zona_supervisores
```

Anomalía detectada: `CREATE TABLE IF NOT EXISTS para` — nombre genérico
sospechoso (probablemente fragmento residual de un statement multiline). A
revisar en Fase 1.

### 2.3 Recomendación

Ir migrando estas 102 tablas a definiciones Drizzle por dominio (en cada
fase posterior toca un dominio). El `auto-seed.ts` debe permanecer como
fuente de migraciones, pero los SELECT/INSERT del código aplicación deberían
usar Drizzle tipado en lugar de `db.execute(sql\`...\`)`.

---

## 3. Rutas del API (`artifacts/api-server/src/routes/`)

**75 archivos de ruta** registrados en `routes/index.ts`. Todas se montan
sin prefijo (cada router define sus propios `/api/...` internos).

Routers por dominio (agrupación informativa — mismo orden que `index.ts`):

- **Salud / infra**: `health`
- **Comercial**: `leads`, `applications`, `solicitudes-empleo`,
  `solicitudes-servicio`
- **Operaciones**: `incidents`, `tareas`, `emergencias`, `operaciones`,
  `zonas`, `cobertura`, `solicitudes-cambio`, `puesto-slots`,
  `personal-slots`, `solicitudes-turno`, `agente-fichaje`, `qr-rondas`,
  `agente-supervision`, `agente-supervision-jornada`,
  `supervision-programaciones`, `supervision-zonas`, `supervision-dashboard`,
  `supervision-reportes`, `supervision-plan-mensual`, `visitas`,
  `planificacion-futura`, `actas`, `custodias`
- **RRHH / Nómina**: `employees`, `anticipos`, `eventos-rrhh`, `rrhh-alertas`,
  `nomina`, `pre-planilla`, `planilla`, `planillas-especiales`,
  `libro-salarios`, `vacaciones`, `cambios-salariales`, `prestaciones`,
  `barracas`, `seguros`, `amonestaciones`, `igss`, `incentivos`,
  `plantillas-contrato`, `tipos-personal-config`
- **Logística**: `vehiculos`, `armeria`, `bodega`, `dotacion`, `uniformes`
- **Clientes / Portal**: `portal`, `ficha`, `sedes`, `alias`,
  `usuarios-clientes`
- **WhatsApp / Soporte**: `whatsapp-webhook`, `wa-config`, `simulador`,
  `trello`
- **CMS / docs**: `cms`, `docs`
- **Admin**: `users`, `roles`, `dashboard`, `kpi`, `reportes`, `storage`,
  `solicitudes-eliminacion`, `admin-reset`, `reset-datos`, `importacion`,
  `importacion-maestro`, `turnos`

No se detectaron routers huérfanos (todo lo que existe en `routes/` está
montado en `routes/index.ts`).

### 3.1 Inventario cruzado FE ↔ BE (segmentos `/api/<segmento>`)

Análisis programático sobre las 75 rutas mounteadas y todos los archivos
`.ts/.tsx` de `artifacts/isp-web/src`. Ojo: el cruce es a nivel del **primer
segmento** después de `/api/`; un segmento "presente en BE" puede tener
sub-rutas que sí se usen desde el FE.

**Segmentos del backend SIN llamadas detectables desde el frontend** (12):

| Segmento                       | Archivo del router          | Hipótesis              |
|--------------------------------|-----------------------------|------------------------|
| `/api/cambios-salariales`      | `cambios-salariales.ts`     | Llamado vía clave dinámica (`/api/${tipo}`) o no integrado todavía |
| `/api/cms`                     | `cms.ts`                    | Editor de contenido del sitio público — confirmar uso |
| `/api/emergencias`             | `emergencias.ts`            | Botón de pánico del agente — revisar |
| `/api/healthz`                 | `health.ts`                 | Probe de Replit — uso esperado fuera del FE |
| `/api/kpi`                     | `kpi.ts`                    | KPIs del dashboard — verificar si lo consume `Dashboard.tsx` con path dinámico |
| `/api/notificaciones`          | `tareas.ts`                 | Sub-feature de tareas |
| `/api/reportes`                | `reportes.ts`               | Página `Reportes.tsx` (1 149 líneas) usa endpoints específicos |
| `/api/roles`                   | `roles.ts`                  | Catálogo de roles para Usuarios — revisar |
| `/api/session`                 | `roles.ts`                  | Probable validación de sesión, posible duplicado |
| `/api/simulador`               | `simulador.ts`              | Herramienta interna de simulación |
| `/api/tipos-personal-config`   | `tipos-personal-config.ts`  | Config de tipos de personal |
| `/api/webhooks`                | `whatsapp-webhook.ts`       | Webhook de Meta — uso correcto fuera del FE |

**Cuentas globales**: 32 segmentos llamados desde el FE, 23 segmentos
mounteados en BE (raíz), 11 segmentos coincidentes a nivel de primer
segmento. Los segmentos sólo en FE corresponden a sub-rutas que se
montan en `index.ts` con prefijos como `/api/users`, `/api/employees`,
etc., agrupados a través de `app.use("/api/<x>", router)`.

**Acción Fase 1+**: para cada segmento BE no detectado, hacer grep en
profundidad por nombre de endpoint específico (no sólo prefijo) y, si
realmente no se usa, marcarlo para eliminación.

---

## 4. Páginas del frontend (`artifacts/isp-web/src/admin/pages/`)

### 4.1 Páginas registradas en `App.tsx`

72 rutas wouter activas (admin + portal + público + PWA agente).

### 4.2 Páginas potencialmente huérfanas

Componentes en `admin/pages/` que **no están importados desde `App.tsx`**:

| Página                        | Estado                                                      |
|-------------------------------|-------------------------------------------------------------|
| `ArmeriaReportes.tsx`         | **Sí se usa** — importada como `TabReportes` desde `Armeria.tsx` (no es huérfana, solo no es ruta directa) |
| `EstadisticasRondas.tsx`      | Sin referencias — candidato a eliminar o re-conectar        |
| `FichajeQR.tsx` (1 261 líneas)| Sin referencias — sospechoso por su tamaño                  |
| `RecorridosCustodia.tsx`      | Sin referencias                                             |
| `RondasQR.tsx` (1 140 líneas) | Sin referencias — sospechoso por su tamaño                  |
| `VacacionesTab.tsx`           | **Sí se usa** como tab interno desde `AdminVacaciones` y `Prestaciones` (no es huérfano, solo no es ruta) |

Acción recomendada: en Fase 5 (Portal/PWA) confirmar con el usuario qué
páginas se eliminan y cuáles deben re-cablearse.

---

## 5. Archivos sobre-dimensionados (>1 000 líneas)

Listado priorizado para refactor en fases posteriores:

| Líneas  | Archivo                                                        | Fase asignada |
|---------|----------------------------------------------------------------|---------------|
| 10 146  | `artifacts/isp-web/src/admin/pages/Operaciones.tsx`            | Fase 1        |
|  6 354  | `artifacts/api-server/src/lib/auto-seed.ts`                    | Transversal   |
|  6 032  | `artifacts/isp-web/src/admin/pages/Empleados.tsx`              | Fase 2        |
|  4 990  | `artifacts/api-server/src/routes/operaciones.ts`               | Fase 1        |
|  4 419  | `artifacts/isp-web/src/admin/pages/Importacion.tsx`            | Fase 4        |
|  3 411  | `artifacts/api-server/src/routes/agente-fichaje.ts`            | Fase 1        |
|  2 994  | `artifacts/isp-web/src/admin/pages/FichaCliente.tsx`           | Fase 3        |
|  2 688  | `artifacts/isp-web/src/pages/AgenteInicio.tsx`                 | Fase 5        |
|  2 559  | `artifacts/isp-web/src/admin/pages/PrePlanilla.tsx`            | Fase 2        |
|  2 292  | `artifacts/api-server/src/routes/employees.ts`                 | Fase 2        |
|  2 167  | `artifacts/isp-web/src/admin/pages/RRHHEventos.tsx`            | Fase 2        |
|  2 031  | `artifacts/isp-web/src/pages/KioscoSolicitud.tsx`              | Fase 5        |
|  1 825  | `artifacts/isp-web/src/admin/pages/Armeria.tsx`                | Fase 4        |
|  1 773  | `artifacts/isp-web/src/pages/AgenteEscaneo.tsx`                | Fase 5        |
|  1 760  | `artifacts/api-server/src/routes/armeria.ts`                   | Fase 4        |
|  1 670  | `artifacts/isp-web/src/admin/pages/Bodega.tsx`                 | Fase 4        |
|  1 570  | `artifacts/isp-web/src/admin/pages/KioscoSolicitudes.tsx`      | Fase 5        |
|  1 459  | `artifacts/isp-web/src/admin/pages/Planilla.tsx`               | Fase 2        |
|  1 457  | `artifacts/api-server/src/routes/importacion.ts`               | Fase 4        |
|  1 438  | `artifacts/isp-web/src/admin/pages/Clientes.tsx`               | Fase 3        |
|  1 435  | `artifacts/isp-web/src/admin/pages/Amonestaciones.tsx`         | Fase 2        |
|  1 405  | `artifacts/api-server/src/routes/solicitudes-servicio.ts`      | Fase 3        |
|  1 375  | `artifacts/isp-web/src/admin/pages/Usuarios.tsx`               | Transversal   |
|  1 333  | `artifacts/api-server/src/routes/nomina.ts`                    | Fase 2        |
|  1 272  | `artifacts/api-server/src/routes/importacion-maestro.ts`       | Fase 4        |
|  1 261  | `artifacts/isp-web/src/admin/pages/FichajeQR.tsx`              | Fase 5 (¿?)   |
|  1 207  | `artifacts/api-server/src/routes/pre-planilla.ts`              | Fase 2        |
|  1 159  | `artifacts/isp-web/src/admin/pages/Prestaciones.tsx`           | Fase 2        |
|  1 153  | `artifacts/api-server/src/routes/eventos-rrhh.ts`              | Fase 2        |
|  1 149  | `artifacts/isp-web/src/admin/pages/Reportes.tsx`               | Transversal   |
|  1 140  | `artifacts/isp-web/src/admin/pages/RondasQR.tsx`               | Fase 5 (¿?)   |
|  1 063  | `artifacts/api-server/src/routes/prestaciones.ts`              | Fase 2        |
|  1 038  | `artifacts/api-server/src/routes/planilla.ts`                  | Fase 2        |
|  1 026  | `artifacts/api-server/src/routes/portal.ts`                    | Fase 5        |
|  1 014  | `artifacts/isp-web/src/lib/pdfRrhh.ts`                         | Fase 2        |
|  1 009  | `artifacts/isp-web/src/admin/pages/PlanillasEspeciales.tsx`    | Fase 2        |

---

## 6. Cliente HTTP del frontend

### 6.1 Estado anterior

- `lib/api.ts` — `apiFetch` privado con header `x-isp-session`
- `lib/portalApi.ts` — duplicaba la lógica para el portal
- `lib/fetchSessionPatch.ts` — **monkey-patch** del `window.fetch` global
- `QueryClient` instanciado inline dentro de `App.tsx`
- Más de 30 componentes leyendo `sessionStorage` directamente para añadir el
  header (ver tabla en §6.3)

### 6.2 Nuevos módulos (Fase 0)

- `artifacts/isp-web/src/lib/httpClient.ts`
  - `apiRequest<T>(path, options)` — único helper recomendado
  - `apiUrl()`, `getSessionToken()`, `ApiError`
- `artifacts/isp-web/src/lib/queryClient.ts`
  - `queryClient = new QueryClient()` extraído del inline en `App.tsx`,
    **sin tocar los defaults** de TanStack Query para no alterar el
    comportamiento de cache/refetch/retry observable por el usuario.
  - `App.tsx` ya consume desde aquí

### 6.3 Adaptadores legados redirigidos al cliente central

Para evitar duplicación sin tener que modificar las decenas de páginas que
ya usan los wrappers existentes, los tres módulos heredados ahora delegan
en `httpClient.apiRequest`:

- `lib/api.ts` → `apiFetch()` reemplaza su `fetch` interno por
  `apiRequest()`. Todos los `employeesApi`, `usersApi`, `leadsApi`,
  `applicationsApi`, `incidentsApi`, `tareasApi`, `anticiposApi`,
  `dashboardApi`, `rrhhAlertasApi` y `trelloApi` quedan automáticamente
  centralizados.
- `lib/portalApi.ts` → `portalGet`/`portalPost` siguen exponiendo la misma
  firma pero su cuerpo ahora es un thin wrapper que arma los headers de
  cliente (`x-isp-role`, `x-isp-userid`, `x-isp-clienteid`) y delega en
  `apiRequest()`.
- `lib/fetchSessionPatch.ts` → continúa siendo el monkey-patch de
  `window.fetch` como red de seguridad para librerías de terceros, pero
  importa `getSessionToken()` desde `httpClient.ts` para no duplicar la
  lectura de `sessionStorage`. Documentado como código a eliminar al
  cierre de las Fases 1-6.

### 6.4 Migración masiva de lectura de sesión (Fase 0)

Como parte de Fase 0 se migraron **58 archivos** del frontend que leían
directamente `sessionStorage.getItem("isp_admin_session_v2")` para que ahora
usen `getSessionToken()` de `lib/httpClient.ts`. Esto deja una única fuente
de verdad para el token de sesión.

Verificación: `rg sessionStorage.getItem\(\"isp_admin_session_v2\"\)
artifacts/isp-web/src` devuelve **0 matches** (excepto en el propio
`httpClient.ts`, que es la fuente).

Los `sessionStorage` que aún permanecen en otros componentes corresponden a
estados de UI (no del servidor): chips activos, último filtro, vistas
favoritas, etc. — esos no se tocan porque no son estado de servidor.

#### Ejemplos representativos del conteo previo (referencia histórica)

```
admin/pages/Operaciones.tsx              10 hits
admin/pages/Empleados.tsx                14 hits
admin/pages/Amonestaciones.tsx            1
admin/pages/Armeria.tsx                   1
admin/pages/Barracas.tsx                  1
admin/pages/Bodega.tsx                    1
admin/pages/CMS.tsx                       1
admin/pages/Clientes.tsx                  1
admin/pages/Comercial.tsx                 1
admin/pages/IGSS.tsx                      1
admin/pages/Importacion.tsx               1
admin/pages/KioscoSolicitudes.tsx         1
admin/pages/KioscoSolicitudImprimible.tsx 1
admin/pages/LibroSalarios.tsx             1
admin/pages/MergeRequests.tsx             1
admin/pages/PlanillasEspeciales.tsx       1
admin/pages/ReportePlantillaTurnos.tsx    1
admin/pages/RRHHAlertas.tsx               1
admin/pages/SolicitudesEliminacion.tsx    1
admin/pages/Turnos.tsx                    1
admin/pages/Visitas.tsx                   1
admin/pages/operaciones/EditarPlantillaPersonalModal.tsx 1
admin/pages/supervision/api.ts            1
admin/pages/supervision/TabAsignacionZonas.tsx 1
contexts/AuthContext.tsx                  2
contexts/DeleteModeContext.tsx            3
lib/api.ts                                1
lib/fetchSessionPatch.ts                  1
lib/portalApi.ts                          4
```

---

## 7. Seeds (`artifacts/api-server/src/seed/`)

Se consolidaron en una carpeta dedicada (Fase 0):

| Antes                       | Ahora                            | Propósito                                  |
|-----------------------------|----------------------------------|--------------------------------------------|
| `src/seed.ts`               | `src/seed/operaciones.ts`        | Leads, incidencias, tareas y clientes demo |
| `src/seed-employees.ts`     | `src/seed/rrhh.ts`               | Empleados de ejemplo                       |
| `src/seed-users.ts`         | `src/seed/usuarios.ts`           | Usuarios admin / portal                    |
| `src/seed-assignments.ts`   | `src/seed/asignaciones.ts`       | Asignaciones de agentes a CLI-001          |

`src/seed/index.ts` documenta los scripts disponibles. Ningún `package.json`
referenciaba directamente las rutas viejas — los desarrolladores ejecutan
los scripts a mano con `tsx`.

> **Importante**: NO confundir con `src/lib/auto-seed.ts`, que es el
> migrador idempotente que corre en cada arranque del servidor.

---

## 8. Librería compartida `@workspace/domain`

Nueva en Fase 0. Contiene utilidades puras (sin Express ni React) que pueden
usarse desde backend y frontend:

- `dates.ts` — `todayGT()`, `lunesAnterior()`, `diffDays()`
- `turnos.ts` — `calcEstadoSlot()` (motor unificado de ciclos D1..Dn)
- `types.ts` — `EstadoIncidencia`, `Prioridad`, `RolUsuario`, etc.
- `validators.ts` — `dpiSchema`, `telefonoGTSchema`, `fechaISOSchema`

Las versiones existentes en `artifacts/api-server/src/lib/turno-calc.ts`,
`semana-mes.ts`, `fecha-lunes.ts`, etc. **no se mueven en Fase 0** para no
arriesgar regresiones; cada fase de dominio absorberá sus helpers.

---

## 9. Riesgos y deuda técnica detectada

1. **`auto-seed.ts` (6 354 líneas)** — único punto de fallo para migraciones
   en producción. Necesita división por dominio sin perder idempotencia.
2. **`Operaciones.tsx` (10 146 líneas)** — la pantalla más grande del sistema
   concentra pizarrón, plantilla de turnos, slots, cierres, etc. Refactor
   prioritario en Fase 1.
3. **Monkey-patch de `window.fetch`** (`fetchSessionPatch.ts`) — invisible
   para nuevos contribuyentes y dificulta el testing. Reemplazar por
   `apiRequest()` y eliminar el patch al cierre de las fases por dominio.
4. **102 tablas sin tipos Drizzle** — todo el SQL se escribe a mano contra
   `db.execute(sql\`...\`)`, sin chequeo de columnas en tiempo de compilación.
5. **Más de 30 componentes leyendo `sessionStorage` directamente** — la
   sesión debería pasar por `getSessionToken()` o por el `AuthContext`.
6. **Tests pre-existentes con errores de TypeScript** —
   `src/test/e2e-abril/unit-tests.ts` tiene 552 errores `TS2345` por
   firmar argumentos `number` donde se esperaba `string` (no introducidos
   por este refactor; ya estaban antes de Fase 0).

---

## 10. Validación de no-regresión

Verificación ejecutada al cierre de la fase para garantizar que el refactor
no introduce errores nuevos:

| Comando                                            | Antes (baseline `5d247dc`) | Después (Fase 0) |
|----------------------------------------------------|----------------------------|------------------|
| `pnpm --filter @workspace/api-server typecheck`    | 552 errores TS             | **552 errores TS** ✅ |
| `pnpm --filter @workspace/isp-web typecheck`       | 80 errores TS              | **80 errores TS** ✅ |
| `pnpm run typecheck:libs`                          | 13 errores TS2344          | **13 errores TS2344** ✅ |
| `pnpm install`                                     | OK                         | OK (`@workspace/domain` añadido) |
| Workflows `api-server`, `isp-web`, `mockup-sandbox`| running                    | running, sin nuevos errores en consola |

**Detalle de los 13 errores `TS2344` en `lib/db`**:
son pre-existentes en el original `lib/db/src/schema/isp.ts` (verificado
restaurando ese archivo desde `5d247dc` y corriendo `pnpm run
typecheck:libs` — devuelve los mismos 13 errores). Son una incompatibilidad
conocida entre `drizzle-zod` y la versión de Zod del workspace al tipar
`z.infer<typeof insertXxxSchema>`. La limpieza de estos tipados queda en
backlog para una fase de tooling (no operativa).

Los 552/80 errores pre-existentes en api-server y isp-web están en archivos
NO tocados por este refactor (principalmente `src/test/e2e-abril/unit-tests.ts`,
`src/pages/KioscoSolicitud.tsx`, `src/pages/SolicitarAnticipo.tsx`,
`src/pages/SolicitudEmpleo.tsx`, `src/pages/acceso-clientes.tsx`).

Procedimiento de baseline: se restauró `lib/db/src/schema/isp.ts` y
`lib/db/src/schema/index.ts` desde el commit `5d247dc` (último commit
antes de Fase 0), se removieron temporalmente los archivos nuevos
(`usuarios.ts`, `clientes.ts`, `rrhh.ts`, `operaciones.ts`, `comercial.ts`,
`whatsapp.ts`), se corrió `pnpm run typecheck:libs` y se contaron los
errores. Luego se restauró el estado actual y se volvió a contar para
confirmar paridad exacta.

---

## 11. Alcance de la Fase 0 (qué SÍ y qué NO)

Esta fase es explícitamente **fundacional**. No persigue migrar todas las
páginas ni eliminar el monkey-patch global; eso queda planificado para las
Fases 1-6 dominio por dominio.

**Sí está en alcance Fase 0:**
- Schema dividido por dominio + barrel retrocompatible.
- Librería compartida `@workspace/domain`.
- Cliente HTTP central (`httpClient.ts`) y `queryClient` compartido.
- Wrappers heredados (`api.ts`, `portalApi.ts`, `fetchSessionPatch.ts`)
  delegando en `httpClient.apiRequest` para que toda la app comparta una
  sola implementación de fetch + sesión + manejo de errores.
- Seeds consolidados.
- Documento de auditoría con inventario cruzado FE↔BE.

**Diferido explícitamente a Fases 1-6 (por dominio):**
- Eliminar `fetchSessionPatch.ts` cuando ningún caller lo necesite (el patch
  permanece como red de seguridad para librerías de terceros).
- Reemplazar los wrappers `*Api.getAll/create/update` por hooks de
  TanStack Query autogenerados (`@workspace/api-client-react`).
- Migrar las 102 tablas creadas por `auto-seed.ts` a definiciones Drizzle.

Esta separación es deliberada para que cada fase posterior tenga un alcance
acotado y testeable, en vez de un mega-cambio que afecte 100+ archivos.

---

## 12. Resumen de acciones realizadas en Fase 0

- [x] Schema dividido por dominio (`usuarios`, `clientes`, `rrhh`,
      `operaciones`, `comercial`, `whatsapp`) con `isp.ts` como barrel.
- [x] Nuevo paquete `@workspace/domain` con utilidades puras compartidas.
- [x] Cliente HTTP unificado (`httpClient.ts`) + `queryClient` extraído.
- [x] `lib/api.ts`, `lib/portalApi.ts` y `lib/fetchSessionPatch.ts`
      refactorizados para delegar en `httpClient.apiRequest` (un solo punto
      de fetch + sesión + manejo de errores).
- [x] Migración masiva: 58 componentes/módulos pasan a usar
      `getSessionToken()` en lugar de leer `sessionStorage` directamente.
- [x] Seeds consolidados en `artifacts/api-server/src/seed/`.
- [x] Documento de auditoría (`docs/auditoria-sistema.md`) generado, con
      inventario cruzado FE↔BE y secciones de riesgos / validación.
- [x] Funcionalidad visible: sin cambios. Typecheck mantiene el mismo
      número de errores pre-existentes en ambos paquetes.

---

## 13. Fase 3 — Comercial, Clientes y Reclutamiento

**Reorganización backend** (`artifacts/api-server/src/routes/`):

- `routes/comercial/` — `leads.ts` + `applications.ts` (postulaciones del
  sitio público). Barrel `comercial/index.ts` re-exporta los routers.
- `routes/clientes/` — `alias.ts` + `ficha.ts` + `sedes.ts` (ficha maestra
  del cliente: datos, contractuales, puestos, sedes, aliases). Barrel
  `clientes/index.ts` re-exporta los routers.
- `routes/reclutamiento/` — `solicitudes-empleo.ts` (kiosco interno,
  reemplazo moderno de `applications`). Barrel `reclutamiento/index.ts`
  re-exporta el router y la tarea `limpiarFotosExpiradas`.

`routes/index.ts` y `src/index.ts` se actualizan para importar desde los
barrels nuevos. Comportamiento idéntico al previo.

**Reorganización frontend** (`artifacts/isp-web/src/admin/pages/`):

- `clientes/TabRentabilidad.tsx` — extraída de `FichaCliente.tsx`
  (tab autocontenida con sus propios tipos `RentaData / RentaPuesto /
  BajaDetalle` y formateo `fmtQr`). `FichaCliente.tsx` baja de 2995 a
  ~2790 líneas.

**Aliases integrados (no son módulo aparte):**

- `client_aliases` y `position_aliases` se administran exclusivamente
  desde la pantalla `Clientes` (tabs Resolver/Sedes y modal de cliente);
  no existe una pantalla independiente de aliases. Confirmado en
  Fase 3 — el alcance era solo verificar la integración.

**Solapamiento `applications` ↔ `solicitudes_empleo`:**

- `POST /api/applications` se sigue usando desde el formulario público
  `pages/reclutamiento.tsx` (vía `applicationsApi.create`).
- El resto de endpoints de `applications` (`GET`, `PATCH /:id`,
  `POST /:id/contratar`) están **huérfanos en frontend**: la pantalla
  admin `KioscoSolicitudes` opera contra `solicitudes-empleo`, que
  expone el flujo completo con merge requests por DPI.
- Acción para una fase futura: o bien migrar el formulario público a
  `solicitudes-empleo` y eliminar `applications` por completo, o
  recortar `applications` al único endpoint usado (POST). Se deja
  documentado y no se elimina aún para no perder datos históricos.

**Pendientes — propuestos como follow-ups:**

- Dividir `FichaCliente.tsx` (~2790 líneas) extrayendo tabs restantes
  (`TabTitulares`, `TabPlantillaTurnos`, `TabIGSSCentro`,
  `TabUsuariosCliente`) y modales (`ModalPuesto`, `ModalEditarCliente`,
  `ModalNuevaSede`, `ModalCrearSlot`).
- Dividir `Clientes.tsx` (1439 líneas) en pestañas separadas
  (`TabResolver`, `TabSedes`, `TabSalarios`, `TabRentabilidadClientes`).
- Dividir `KioscoSolicitudes.tsx` (1571 líneas) extrayendo el panel de
  detalle/edición y el flujo de contratación.
- Migrar `pages/reclutamiento.tsx` al endpoint `solicitudes-empleo`
  para eliminar `applications` por completo.

---

## 14. Fase 6 — Soporte, WhatsApp y CMS

Última fase de refactor. Cierra los módulos transversales y de soporte
dejando una huella consistente con el resto del sistema.

### 14.1 Refactor de Usuarios

`artifacts/isp-web/src/admin/pages/Usuarios.tsx` baja de **1 376 → 399
líneas**. Se extrae la siguiente carpeta:

```
admin/pages/usuarios/
├── shared.tsx                  (104) Tipos Rol, ROLES, useSystemRoles,
│                                     RolBadge, EstadoBadge, PermisoBadge,
│                                     PermToggle, getAdminSessionHeader
├── EmpleadoPicker.tsx          (165) Combo de búsqueda de empleados
├── NuevoUsuarioModal.tsx       (297) Modal de alta de usuario
├── EditarUsuarioModal.tsx      (364) Modal de edición (tabs Datos/Permisos/Pwd)
└── PermisosReferenceTable.tsx  (74)  Tabla informativa de permisos por rol
```

`Usuarios.tsx` queda como orquestador (header, tabs, filtros, tabla,
inconsistencias). El comportamiento visible no cambia.

### 14.2 Documentación del bot de WhatsApp

Se añade `docs/whatsapp-bot-flow.md` con:

- Mapa de rutas (`whatsapp-webhook`, `wa-config`, `simulador`) y servicios
  (`classifier`, `wa-sender`, `wa-config.service`, sesiones de anticipo y
  registro de teléfono, emergencias, notificaciones).
- Diagrama del flujo de un mensaje entrante (carnet público → sesiones
  activas → lookup `users.telefono` → clasificación de intención).
- Tablas Drizzle involucradas (`wa_config`, `wa_messages`,
  `wa_menu_options`, `wa_audit_log`) y tablas auxiliares
  (`phone_auth_log`, `wa_notificaciones_log`).
- Cómo se administra desde `/admin/whatsapp-config` y cómo funciona el
  simulador en modo dry-run vs real.

El código de WhatsApp ya estaba modularizado correctamente
(`services/whatsapp/*` por dominio) — esta fase no introduce cambios de
estructura, solo el documento que faltaba para entenderlo end-to-end.

### 14.3 CMS y Documentación

`CMS.tsx` (654) y `Documentacion.tsx` (185) se confirman como módulos
**ya prolijos**: ambos usan schemas tipados (`lib/cmsSchema`), endpoints
acotados (`/api/cms`, `/api/docs`) y componentes compactos. No requieren
refactor estructural en esta fase.

### 14.4 Decisión sobre módulos a medio terminar

| Módulo            | Decisión                                                      |
|-------------------|---------------------------------------------------------------|
| **Seguros**       | **Mantener** — funcional (config histórica + reportes mensuales con export CSV). No es stub. |
| **MergeRequests** | **Mantener** — funcional (panel de verificación de identidad por DPI duplicado contra `employees`). |
| **HR-Sync**       | **Stub explícito** — `services/hr-sync/index.ts` define `IHRAdapter`, `HRSyncService` y un `HR-SYNC-README.md` describiendo cómo conectarlo cuando exista una base externa. No hay scheduler activo, no se importa desde `routes/index.ts`, no expone endpoints. Queda documentado y listo para ser activado en una fase futura de integración. |

### 14.5 Limpieza de huérfanos remanentes

Estado al cierre de Fase 6:

- `routes/comercial/applications.ts` — sólo `POST /api/applications`
  (formulario público de reclutamiento) y `GET /api/applications`
  (Dashboard) están en uso. Los demás endpoints quedan como deuda menor;
  para no romper datos históricos se mantienen y se documentan en §13.
- Páginas `EstadisticasRondas.tsx`, `FichajeQR.tsx`, `RecorridosCustodia.tsx`
  y `RondasQR.tsx`: revisadas en esta fase, **no son huérfanas** — son las
  pestañas de `ControlOperativoQR.tsx` (importadas explícitamente desde ese
  contenedor, que a su vez se monta en `App.tsx`). Se quitan de la lista de
  candidatas a borrado.

### 14.6 Resumen de acciones — Fase 6

- [x] `Usuarios.tsx` partido en 5 componentes bajo
      `admin/pages/usuarios/`. La página principal pasa de 1 376 a 399 líneas.
- [x] `docs/whatsapp-bot-flow.md` creado con el flujo end-to-end del bot.
- [x] HR-Sync confirmado como stub explícito (sin endpoints, sin scheduler,
      con README y comentarios `TODO`).
- [x] Seguros, MergeRequests, CMS y Documentación validados como
      módulos completos y prolijos — no requieren cambios.
- [x] Documento de auditoría actualizado con el estado final.
