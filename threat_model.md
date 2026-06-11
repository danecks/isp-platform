# Threat Model

## Project Overview

Aplicación monolítica en un monorepo pnpm para operaciones, RRHH, nómina, clientes y flujos móviles de Investigaciones y Seguridad Profesional S.A. El backend productivo es `artifacts/api-server` (Express 5 + PostgreSQL/Drizzle) y sirve un panel interno, un portal de clientes, endpoints públicos para reclutamiento/kiosko, y flujos móviles/PWA para agentes y supervisores. La app está desplegada públicamente en `https://ispsa.net`.

Supuestos de alcance para este escaneo:
- Solo cuentan vulnerabilidades explotables en producción.
- `artifacts/mockup-sandbox/`, `src/test/` y simuladores/dev tools se consideran fuera de alcance salvo evidencia de exposición en producción.
- TLS entre cliente y servidor lo aporta la plataforma.

## Assets

- **Cuentas internas y sesiones de panel** — usuarios admin, operaciones, RRHH, comercial, supervisor y sus permisos por módulo. Su compromiso permite acceso total a datos laborales, operativos y financieros.
- **Portal de clientes** — usuarios cliente, vínculos `usuarios_clientes`, KPIs, incidencias, cobertura y rondas. Su compromiso expone datos operativos de clientes.
- **Datos de empleados y RRHH** — información personal, contratos, vacaciones, nómina, prestaciones, anticipos, disciplina y documentos.
- **Datos operativos y de seguridad** — puestos, rondas QR, visitas, fichajes, incidencias, custodias, vehículos, armas y reportes de campo.
- **Archivos privados** — fotos de DPI, evidencias y otros blobs en object storage privado.
- **Capacidades destructivas administrativas** — endpoints de reset, importación, configuración, usuarios y otros cambios de alto impacto.
- **Secretos e integraciones** — credenciales de DB, object storage, WhatsApp/Meta, push y OTA móvil.

## Trust Boundaries

- **Navegador / móvil ↔ API** — todo header, query param, body y token del cliente es no confiable y debe validarse server-side.
- **Rutas públicas ↔ rutas autenticadas** — formularios públicos, portal cliente y flujos de agentes/supervisores no deben heredar privilegios internos ni aceptar identidad sólo por headers manipulables.
- **API ↔ PostgreSQL** — consultas raw y lógica de autorización protegen casi toda la información sensible del sistema.
- **API ↔ object storage** — los paths de objetos y descargas privadas deben requerir identidad/autorización real y scoping por recurso.
- **API ↔ servicios externos** — WhatsApp, push, OCR/IA y OTA no deben aceptar callbacks falsos ni filtrar secretos.
- **Usuario interno ↔ admin** — el rol `admin` y el módulo `usuarios` protegen endpoints capaces de borrar, importar o reconfigurar todo el sistema.

## Scan Anchors

- **Entradas productivas**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts`, `artifacts/isp-web/src/main.tsx`.
- **Auth/RBAC principal**: `artifacts/api-server/src/lib/permisos-middleware.ts`, `artifacts/api-server/src/routes/users.ts`, `artifacts/isp-web/src/contexts/AuthContext.tsx`, `artifacts/isp-web/src/lib/httpClient.ts`.
- **Superficies públicas**: rutas `/api/portal*`, `/api/agente*`, `/api/qr-rondas*`, `/api/solicitudes-empleo*`, `/api/anticipos*`, `/api/storage*`, `/api/app-updates*`, `/api/descarga-apk*`.
- **Áreas de mayor riesgo**: autenticación basada en headers, object storage privado, visitas/DPI, flujos de agente con device/tracking tokens, endpoints admin destructivos (`/admin/*`, importación, usuarios, reset), y módulos de RRHH/nómina con datos sensibles.
- **Áreas dev-only a ignorar salvo evidencia contraria**: `artifacts/mockup-sandbox/`, `artifacts/api-server/src/test/`, simulador de WhatsApp, mocks del frontend.

## Threat Categories

### Spoofing

La amenaza principal es la suplantación de identidad mediante headers, tokens de dispositivo o identificadores de cliente/usuario enviados desde el frontend. El sistema debe exigir pruebas de autenticidad no falsificables para toda ruta protegida y validar server-side que la identidad presentada corresponde al usuario o dispositivo real.

### Tampering

El panel interno y los flujos móviles permiten crear, editar o borrar datos operativos, de RRHH y nómina. Cualquier dato de actor, rol, cliente, empleado o importes enviado por el cliente debe considerarse manipulable; la API debe recalcular permisos, ownership y reglas de negocio desde la base de datos.

### Information Disclosure

El sistema almacena PII laboral, fotos de DPI, incidentes, cobertura, rondas, nómina y documentación interna. Las respuestas y descargas deben limitarse al usuario/cliente autorizado, y los endpoints públicos o de portal no deben permitir lectura cruzada ni acceso a blobs privados.

### Denial of Service

Existen endpoints públicos de login, OCR, reclutamiento, visitas, descargas y flujos de campo que pueden ser abusados para generar carga o costos externos. Deben tener límites razonables, validaciones de tamaño y mecanismos anti-abuso proporcionales a su exposición pública.

### Elevation of Privilege

El backend concentra funciones administrativas muy potentes: usuarios, importaciones, resets, payroll, storage y configuración. Debe aplicar autorización server-side robusta y fail-closed, evitando que un usuario sin privilegios o un caller anónimo alcance capacidades de admin por manipulación de headers, IDs, rutas no catalogadas o controles sólo en frontend.
