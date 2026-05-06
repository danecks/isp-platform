# Overview
This project is a pnpm monorepo for "Investigaciones y Seguridad Profesional S.A." (Guatemala), providing a comprehensive digital platform with a corporate website and an admin dashboard. The platform aims to streamline internal operations, enhance client interaction, and establish a robust online presence.

Key capabilities include:
- **Comprehensive Admin Modules:** Covering Commercial (leads CRM), Recruitment (job applications), Incidents Management, HR Advances, HR Disciplinary KPI, Operational Rotation KPI, RRHH Automatic Alerts, CMS, Novedades Nómina, and Pre-Planilla Operativa.
- **Dynamic Roles & Permissions:** Configurable role-based access control.
- **Robust Authentication & RBAC:** Granular role-based access control for various user roles.
- **Client Portal:** Secure access for clients to view incidents and KPIs.
- **Trello Integration:** Seamless integration for Incidencias, Leads, and Postulaciones.
- **WhatsApp Integration:** Transforms WhatsApp messages into structured database records.
- **Lead and Applicant Conversion:** Facilitates conversion of leads to clients and applicants to employees.
- **Branding Consistency:** Centralized configuration for a uniform corporate identity.
- **Unified Operational Architecture:** Featuring a "Pizarrón Operativo" for daily operations, "Seguimiento SSA" for administrative tracking, and "Pipeline SSA" for commercial overview.
- **Advanced Modules:** Vehicle and armory management, multi-titular consolidation, a rewritten shift engine, deletion requests, service cancellation workflows, HR review flows, payroll integration, disciplinary action system, labor benefits module (including probation period and liquidation), uniform deduction system, and per-puesto profitability analysis.
- **Operational Features:** GPS and QR-based patrol rounds, QR credentialing for guard attendance, and refined titularity/absence management on the operational board.
- **Payroll Features:** Quincenal ISR calculation and IGSS payroll TXT file generation.

# User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

# System Architecture

## Monorepo Structure
The project uses a pnpm workspace monorepo, organizing deployable applications (`api-server`, `isp-web`) in `artifacts/`, shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`) in `lib/`, and utilities in `scripts/`. It leverages a base TypeScript configuration.

## Technology Stack
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **TypeScript:** v5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod, drizzle-zod
- **API Codegen:** Orval (from OpenAPI spec)
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Build Tool:** esbuild

## UI/UX Decisions
- **Design System:** Premium dark navy/gold theme.
- **Component Library:** shadcn/ui for consistent and accessible UI components.
- **Language:** All user-facing content is in corporate Spanish.
- **Branding:** Centralized configuration for a consistent corporate identity.

## Technical Implementations & Feature Specifications
- **API Server (`@workspace/api-server`):** Express 5 backend managing all business logic and data.
- **Database Layer (`@workspace/db`):** Drizzle ORM with PostgreSQL, including schema management and migrations.
- **API Specification & Codegen (`@workspace/api-spec`):** OpenAPI 3.1 specification used by Orval.
- **Authentication & Authorization:** Secure user management with bcrypt and comprehensive Role-Based Access Control (RBAC). Authentication has been hardened to prevent fail-open issues and privilege escalation by validating sessions and user roles server-side.
- **Admin Dashboard Modules:** Live dashboards, CRM, job application management, incident reporting, HR advance requests, employee management, and comprehensive payroll management.
- **Client Portal (`/portal/*`):** Secure interface for clients to view data and KPIs.
- **Operational Management:** "Ficha de Cliente — Modelo Maestro Operativo", "Emergencias Restringidas", "Cierre Operativo Diario — en Pizarrón", "Centro de Operaciones — Pizarrón Operativo", "Tareas con Evidencia", "Reportería Profesional", and "Zonas Operativas Globales". Includes a "Pizarrón" with refined logic for titular assignment, coverage, and associated overtime generation. Pool segmentation clearly differentiates available, covering, and rest/vacationing agents.
- **HR & Payroll Workflows:** Comprehensive management of daily absences, incidents, and overtime (HE) with full approval chains and bidirectional traceability between operational board and HR. Features include nuanced calculations for `dias_descuento`, handling of cash vs. planilla HE, and a redesigned substitution modal generating paired RRHH events. HE generation is gated: only agents in "descansando" (rest day) or "vacaciones" (vacation) status generate overtime events. Disciplinary actions include custom causal selection, PDF generation (Acta Administrativa, Aviso al Inspector), and integration with employee KPIs.
- **Labor Benefits:** Manages "Prestaciones Laborales" including liquidation processes and probation period tracking, impacting payroll and IGSS calculations.
- **Operational Planning:** "Plantilla de Turnos" provides a weekly shift schedule grid with support for full and half-shifts. The system includes an export functionality for shift templates in CSV/XLSX format, which can also be used for mass uploads to modify existing slots. PDF exports visualize slots with color-coded mini-grids.
- **Payroll Generation:** Functionality for calculating Quincenal ISR and generating IGSS payroll TXT files in the official v2.2.0 format.
- **Custody Management:** Integrated "Custodias" module allows managing custody clients and their specific operational slots directly within the main operational board. Custody slots support permanent titulares, absence registration, relief coverage, weapon inheritance, and are included in daily closure snapshots.
- **Armory Management:** Implemented documentary statuses (`pendiente`/`en_tramite`) for weapon documentation, auto-generated weapon codes (`ARM-####`), and a visual indicator ("EN ARMERÍA") when a weapon is unassigned. **ARM-08 (May 2026):** added `armas.ubicacion_interna` ('armeria' | 'jefatura_servicios') for unassigned weapons, and `armas.custodio_employee_id` (FK employees) as a custodian override exclusively for posts of `tipo_puesto='custodia'` (rutas/custodia routes). Backend invariant enforced in POST/PATCH `/api/armas` and `syncCustodiaArma`: override is only persisted when the post is type custodia and propagates as `tipo_origen='custodia_asignada'` in `arma_custodia`.
- **Barracas (Company Housing):** Module for managing company-rented housing with defined quotas per barraca, integrated into pre-payroll and payroll deductions. Includes admin CRUD for barracas and assignment/unassignment of employees.
- **Assignment History:** Provides a detailed history of employee assignments, including titularships and daily coverage.
- **PWA Agent Middleware:** Explicit allow-listing for public endpoints consumed by PWA agent pages, ensuring proper access control while allowing necessary public interactions.
- **Visitas (entradas/salidas en garita):** Módulo completo para registrar entrada/salida de personas (con foto+OCR de DPI vía IA gpt-4o) y vehículos (con placa) en cada puesto. Backend en `routes/visitas.ts` con tabla `visitas` auto-creada vía `auto-seed.ts`. Tres interfaces: PWA agente (móvil, autenticado por device_uuid+device_token, paso a paso con cámara + confirmación grande para salidas), panel admin (control_qr, 3 tabs: tiempo real con auto-refresh 30s, histórico exportable a CSV, estadísticas con KPIs/gráfico/top 5), y portal cliente (mismo patrón filtrado por su `cliente_id`). Endpoint `/agente/visitas/extraer-dpi` valida device antes de invocar IA para evitar abuso/costos.
- **Kiosko de Puesto Fijo (multi-agente):** Tras el escaneo del QR del puesto desde un dispositivo del puesto, `AgenteInicio.tsx` muestra una pantalla operativa con cabecera de agentes activos (auto-refresh 30s) y botonería: Agregar agente, Terminar turno, Rondas y Visitas. Endpoints en `routes/agente-fichaje.ts` autenticados por `tracking_token` del fichaje de sesión: `GET /agente/turnos-activos-del-puesto/:fichaje_id` (lista agentes en turno hoy del mismo puesto; 410 si la sesión está cerrada), `POST /agente/cerrar-turno-verificado` (doble verificación: el agente debe escanear su propio carnet QR para cerrar — anti malas prácticas en kiosko compartido; 410 si la sesión está cerrada), `POST /agente/marcar-ronda-puesto` (selector de agente activo + escaneo del QR de ronda — el evento queda asociado al `user_id` del agente seleccionado, no al de la sesión kiosko), y los endpoints de visitas-puesto (entrada/abiertas/salida, foto DPI vía object storage privado, OCR reutilizando `extraer-dpi`).
- **Visitas — Foto DPI con retención 30 días:** Las entradas peatón/vehículo desde el kiosko de puesto fijo capturan foto del DPI almacenada en object storage privado (paths `/objects/uploads/<uuid>`). Las columnas `dpi_frente_url`+`dpi_frente_subida_en` y `conductor_dpi_frente_url`+`conductor_dpi_frente_subida_en` (auto-creadas vía VIS-02 en `auto-seed.ts`) registran la URL y timestamp. El endpoint `POST /admin/visitas/cleanup-fotos-dpi` (solo admin/operaciones, validando rol vigente desde sesión vía `getPermisosForUsername` — NO desde header `x-isp-role` falsificable) recorre fotos > 30 días, borra el blob físico vía `ObjectStorageService.deleteObjectByPath()` y pone NULL en BD. Si el delete del blob falla, BD se actualiza igual y el blob queda como huérfano contado en `blobs_huerfanos` para limpieza manual.
- **Sincronización Pizarrón ↔ Pestaña Asignación (modal Empleados):** El Pizarrón Operativo asigna titulares escribiendo a `puestos_operativos.titular_employee_id` (y a `puesto_titulares` para multi-titular). La pestaña *Asignación* del modal de empleado lee de `employee_operational_assignments` (eoa). Cuando la asignación se hace desde el Pizarrón, no se sincroniza a eoa, por lo que el modal mostraba "Sin asignación" aun cuando el empleado SÍ era titular. `GET /api/employees/:id/asignacion-operativa` (en `routes/employees.ts`) ahora aplica fallback de lectura: si no hay fila activa en eoa, busca en `puestos_operativos.titular_employee_id` y luego en `puesto_titulares.employee_id`, devolviendo la asignación inferida con `derivada_de_pizarron: true`. La forma JSON es idéntica a la respuesta normal para que el frontend la consuma sin cambios. El campo `derivada_de_pizarron` está en TODAS las respuestas (true/false) para uniformidad. El PUT del mismo endpoint ya sincroniza eoa → puestos_operativos; pendiente futuro: sincronizar también la dirección inversa Pizarrón → eoa para eliminar el desfase de raíz en lugar de depender solo del fallback.
- **Bloqueo de Asignación por Fecha de Ingreso Futura:** Empleados con `fecha_ingreso > hoy` no pueden ser asignados (puestos, coberturas, custodias, segmentos, titulares) ni generan día pagado en el cierre nominal. Helper compartido `lib/empleado-fecha-ingreso.ts → validarEmpleadoAsignable()` aplicado en endpoints de asignación; cinturón de filtro `e.fecha_ingreso <= fecha_cierre` aplicado a todos los pasos del cierre que generan novedad. Etiqueta visual ámbar "⏳ Inicia DD-mmm" en la tarjeta del agente del pool en Operaciones cuando la fecha de ingreso es futura (calculada en hora local de Guatemala).

## Database Migration Policy (CRITICAL — leer antes de tocar schema o deploy)
- **Fuente de verdad de la estructura de BD:** El bloque `auto-migrate` en `artifacts/api-server/src/lib/auto-seed.ts` es el ÚNICO mecanismo autorizado para crear o extender tablas y columnas en producción. Es idempotente y NO destructivo (solo `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- **Drizzle schema (`lib/db/src/schema/isp.ts`) está intencionalmente incompleto y desfasado:** Solo declara las tablas/columnas que el código TypeScript necesita importar como tipos. NO refleja la BD real (faltan armas, arma_custodia, puestos_operativos, novedades, kiosko, y muchas columnas extra de tablas que sí declara). NO intentar "sincronizar" el schema TS con la BD real — provoca migraciones destructivas.
- **`pnpm --filter db push` está DESHABILITADO** (convertido en `echo` en `lib/db/package.json`) y removido de `scripts/post-merge.sh`. Si alguien lo reactiva, Replit Deploy compara el schema TS desfasado contra la BD real, lo declara conflicto destructivo, y muestra el diálogo "Migrations failed validation, please review".
- **Diálogo "Migrations failed validation" — protocolo obligatorio:** Si aparece durante un deploy, SIEMPRE elegir **"Cancel deployment and retry once your schema conflicts are resolved"**. NUNCA elegir **"Copy your development database schema & data to production"** — esa opción reemplaza la BD de producción con la de desarrollo y BORRA cualquier dato que dev no tenga (en abril 2026 borró las 100 armas de la armería, recuperadas vía PITR de Neon).
- **Índices únicos de armería en producción:** `armas_serie_uq`, `armas_numero_tenencia_uq`, `armas_numero_portacion_uq` (índices únicos parciales sobre valores no nulos). Mantienen la integridad ante el wipe; junto con `validarUnicidadArma()` en `routes/armeria.ts` forman la doble capa de protección contra duplicados.
- **ARM-10 (May 2026) — Backfill tipo_puesto por tipo_servicio del cliente:** Bloque idempotente en `auto-seed.ts` que marca `puestos_operativos.tipo_puesto='custodia'` para todos los puestos (que aún están como 'normal') de clientes con `clients.tipo_servicio='custodia'` (clientes 100% rutas). Habilita el selector "Rutas / Custodia" + campo "Custodio asignado" en la Armería para esos puestos. **Clientes 'mixto' NO se tocan automáticamente** — requieren marcado manual desde Operaciones → Puestos. Causa raíz: en prod los puestos de APS Zona 2/7 y VAS Villa Nueva tenían `tipo_puesto='normal'` por defecto a pesar de que el cliente era de tipo custodia, lo que ocultaba el selector de custodio.
- **ARM-09 (May 2026) — Regla "1 puesto = 1 arma":** Índice único parcial `armas_puesto_uq ON armas(puesto_id) WHERE puesto_id IS NOT NULL AND activo=TRUE` + helper `validarPuestoSinArmaActiva()` en `routes/armeria.ts` (POST y PATCH `/api/armas` devuelven 409 con mensaje en español si el puesto ya tiene un arma activa). Los agentes que rotan en un puesto comparten la misma arma (la custodia se transfiere por turno). Bloque de cleanup idempotente en `auto-seed.ts` desasigna armas excedentes a bodega (`puesto_id=NULL`, `ubicacion_interna='armeria'`) y cierra sus `arma_custodia` activas, conservando la primera asignada por puesto (criterio: MIN(arma_custodia.fecha_inicio) → fallback created_at → id ASC). Las armas no se eliminan: el armero las reasigna al puesto correcto desde bodega.

# External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.