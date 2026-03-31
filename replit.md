# Workspace

## Overview
This project is a pnpm monorepo for "Investigaciones y Seguridad Profesional S.A." (Guatemala), providing a comprehensive digital platform. It includes a corporate website and an admin dashboard, both designed with a dark navy/gold theme and presented in corporate Spanish. The platform aims to streamline internal operations, enhance client interaction, and establish a robust online presence.

Key capabilities include:
- **Comprehensive Admin Modules:** Covering Commercial (leads CRM), Recruitment (job applications), Incidents Management, HR Advances, HR Disciplinary KPI, Operational Rotation KPI, RRHH Automatic Alerts, a CMS for public website content, Novedades Nómina (payroll novelties), and Pre-Planilla Operativa (period-based payroll review).
- **Robust Authentication & RBAC:** Granular role-based access control (admin, operaciones, rrhh, comercial, supervisor, cliente).
- **Client Portal:** Secure access for clients to view incidents and KPIs.
- **Trello Integration:** Seamless integration for Incidencias, Leads, and Postulaciones, with a mock mode for development.
- **WhatsApp Integration:** Transforms WhatsApp messages into structured database records for leads, applications, incidents, advance requests, and task queries.
- **Client and Position Aliases:** Facilitates using common names for client and service locations in incident reporting.
- **Lead → Cliente Conversion:** Promotes a "ganado" lead to a real client record.
- **Postulante → Empleado Conversion:** Creates an employee record from an "aprobado" application.
- **Branding Consistency:** Centralized configuration ensures a uniform corporate identity.
- **Unified Operational Architecture:** A central "Pizarrón Operativo" for daily operations, "Seguimiento SSA" for administrative tracking, and "Pipeline SSA" for commercial pipeline overview.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

## System Architecture

### Monorepo Structure
The project uses a pnpm workspace monorepo, organizing deployable applications (`api-server`, `isp-web`) in `artifacts/`, shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`) in `lib/`, and utilities in `scripts/`. It leverages a base TypeScript configuration.

### Technology Stack
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **TypeScript:** v5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod, drizzle-zod
- **API Codegen:** Orval (from OpenAPI spec)
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Build Tool:** esbuild

### UI/UX Decisions
- **Design System:** Premium dark navy/gold theme.
- **Component Library:** shadcn/ui for consistent and accessible UI components.
- **Language:** All user-facing content is in corporate Spanish.
- **Branding:** Centralized configuration for a consistent corporate identity across all interfaces.

### Technical Implementations & Feature Specifications
- **API Server (`@workspace/api-server`):** Express 5 backend managing all business logic and data.
- **Database Layer (`@workspace/db`):** Drizzle ORM with PostgreSQL, including schema management and migrations.
- **API Specification & Codegen (`@workspace/api-spec`):** OpenAPI 3.1 specification used by Orval to generate React Query hooks and Zod schemas.
- **Authentication & Authorization:** Secure user management with bcrypt-hashed passwords and comprehensive Role-Based Access Control (RBAC).
- **Admin Dashboard Modules:** Includes live dashboards, CRM for leads, job application management, incident reporting, and HR advance requests.
- **Client Portal (`/portal/*`):** Provides a secure, dedicated interface for clients to view their specific data and KPIs.
- **Employee Management (`/admin/empleados`):** Core module for managing employee data, including payroll-critical fields.
- **Pre-Payroll Audit Fixes:** Enhancements for payroll accuracy, including labor fields, unique DPI validation, required time fields for coverage segments, auto-absence detection, HR suspension integration, and payroll advance tracking.
- **Planilla Final (`/admin/rrhh/planilla`) + Complete Financial Control:** Full payroll cycle closure with financial control, including database structure for planillas and line items, and API endpoints for generation, retrieval, status updates, reversal, and export.
- **Pre-Planilla Control de Cierre (v3):** Formalized pre-close control system with 4-state validation per collaborator, automatic validation engine, blocking modal for period closure, period snapshot saving, and edit-lock after period close.
- **WhatsApp Integration:** Processes incoming WhatsApp messages via a webhook, classifying them to create records for incidents, applications, leads, and advance requests, including a DPI phone registration flow.
- **Trello Integration:** Facilitates creating Trello cards from the admin panel for incidents with detailed information and automated assignments.
- **Client and Position Aliases:** Manages aliases for clients and service locations, improving data entry and reporting accuracy.
- **Ficha de Cliente — Modelo Maestro Operativo (`/admin/clientes/:id`):** Unified operational view per client, detailing contract information, site structures, operational coverage, and assigned employees.
- **Emergencias Restringidas:** Emergency reporting system with keyword detection, role-based access, and location resolution through aliases.
- **Cierre Operativo Diario — en Pizarrón (`/admin/operaciones`):** Secure, auditable daily operational closing system for supervisors and admins.
- **Centro de Operaciones — Pizarrón Operativo (`/admin/operaciones`):** Real-time Kanban-style board for managing personnel assignments to operational posts via drag-and-drop.
- **Tareas con Evidencia:** Task management system requiring photo and comment evidence for completion.
- **Reportería Profesional (`/admin/reportes`):** Multi-tab reporting module with charts, filterable tables, and export options for various operational aspects.
- **Zonas Operativas Globales (`/admin/operaciones/zonas`):** Cross-client operational zone grouping with CRUD functionality, assignment of puestos, and integration into operational dashboards and client fichas.
- **Reporte de Cobertura por Zona Operativa (`/admin/reportes/cobertura-zonas`):** Standalone reporting page for analyzing daily operational coverage by zone.
- **Pizarrón → Fuente Oficial de Nómina (Multi-tramos + Novedades):** Supports multi-person coverage segments per post/day with time ranges, automatic hour calculation, and generation of daily payroll novelties.
- **Tipos de Novedad Estructurados (13 categorías — MOV-01/02/03):** Replaces free-text `motivo` with a structured `tipo_novedad` field on `cobertura_segmentos` and `novedades_nomina_diarias`, categorized into payroll-impact groups.
- **SSA Pipeline Sync (Phase 2):** Automated syncing of SSA-linked task closure to update area states and recalculate general status.
- **Pool de Agentes — Elegibilidad y Sincronización (SSA-04):** Employee eligibility for the agent pool based on `elegible_pool` column, with supervisors/non-operational staff marked as ineligible, and integration with active SSA assignments.
- **Audit Fixes (Comprehensive):** Numerous system enhancements and bug fixes across various modules, including client creation, warnings for uncovered posts, validation, synchronization, and query optimizations.
- **Vista Futura con Estado de Turno (T001/T002):** Future-date board view shows real turno name (from catalog, `turno_nombre`), and each puesto card shows whether the titular is expected to be "Trabaja" (teal) or "Descansa" (blue) on that date, based on the agent's pool-futuro cycle calculation. ClienteColumnaFutura now receives poolFuturo data and builds a per-employee lookup. TarjetaPuestoFuturo shows turno badge and work/rest status.
- **EV-FIN-01 migration:** Added `fecha_fin DATE` column to `eventos_rrhh` for multi-day event ranges (vacaciones, incapacidades). POST /rrhh/eventos now accepts `fechaInicio`/`fechaFin`. Pool-futuro RRHH events query uses `BETWEEN fecha AND COALESCE(fecha_fin, fecha)`.
- **POST /puestos con turno requerido:** Creating a new puesto now requires `tipoTurnoId` (validated against `turnos` catalog) and `fechaInicioCiclo` (YYYY-MM-DD). ModalNuevoPuesto updated with turno selector and fechaInicioCiclo date input.
- **Anti-contaminación de eventos RRHH futuros (T003):** Fixed: creating an RRHH event with `fechaInicio` in the future no longer auto-generates a novedad for today. Auto-generation of `novedades_nomina_diarias` is now gated on `fechaEvento <= hoy`. Pool-futuro `tipo_ciclo` is now derived via `CASE WHEN (horas_trabajo + horas_descanso) <= 24` (no `tipo_ciclo` column in `turnos`). Pool-futuro response correctly aliases `nombre_completo AS nombre`.
- **Pre-planilla Operativa — 7 escenarios completos:** 3 tipos de error (falta_y_trabajo, trabajo_sin_horas, exento_con_descuento) y 4 tipos de alerta (sin_registros, pendiente_revision, abandono_parcial, permiso_sin_goce). Pool-futuro ausenteProgramado incluye permiso_con_goce. exento_con_descuento validado también en cierre POST.
- **Comercial → Pizarrón Operativo (Arranque Programado):** `fecha_inicio_contrato DATE` añadido a `clients` table (schema + ALTER TABLE). alias.ts POST/PATCH y leads.ts convertir-cliente aceptan este campo. Pool-futuro retorna `iniciosProyecto[]` (clientes que inician ese día) con tarjetas amber "Arranque Programado" en PoolFuturoPanel. Nuevo endpoint `GET /api/operaciones/proximos-arranques?dias=N` devuelve arranques en los próximos N días (máx 180). Banner "Próximos Arranques" en sidebar del Pizarrón (vista presente) con codificación de colores: rojo ≤7d, ámbar ≤14d, gris >14d.
- **Fix Bug Crítico 1 — RRHH↔Nómina conectados:** `generarNovedades()` ahora carga todos los eventos de ausencia RRHH aplicables para la fecha (permiso_sin_goce, vacaciones, incapacidad, suspensión, etc.) al inicio del proceso usando `$fecha BETWEEN er.fecha::date AND COALESCE(er.fecha_fin::date, er.fecha::date)`. En el paso de segmentos (Step 1): si el employee_id tiene un evento RRHH activo, se genera novedad de AUSENCIA (no trabajo) con el tipo correcto. En el paso de titulares sin presencia (P-NOM-04): los eventos RRHH tienen prioridad sobre el tipo_novedad del relevo para determinar descuento/falta. Resultado: un titular con permiso_sin_goce no puede terminar pagado como si trabajara.
- **Tablero futuro — planeación de arranques nuevos:** `GET /operaciones/tablero` ahora acepta parámetro opcional `?fecha=YYYY-MM-DD`. Cuando el frontend está en modo futuro (`esFuturo=true`), pasa `?fecha=${fechaVista}` al endpoint y actualiza el `queryKey` para incluir la fecha (`["operaciones-tablero", fechaVista]`). El filtro de `fecha_inicio_contrato` usa `COALESCE($1::date, CURRENT_DATE)` en lugar de `CURRENT_DATE` fijo. Resultado: el tablero del 18/04 muestra CCA-4 como cliente operativo con `iniciaHoy=true`; el supervisor puede asignar relevos a sus puestos desde esa vista; el tablero de hoy sigue excluyendo CCA-4 correctamente.
- **Fix Bug Crítico 2 — Activación automática de proyecto al día de arranque:** El tablero operativo (`GET /operaciones/tablero`) ahora hace JOIN con `clients` y filtra por `cl.fecha_inicio_contrato IS NULL OR cl.fecha_inicio_contrato <= CURRENT_DATE`. Clientes con fecha futura NO aparecen en el tablero antes de su arranque. Al llegar la fecha, aparecen automáticamente sin ningún paso manual. El tablero retorna además `iniciaHoy: boolean` y `fechaInicioContrato: string` para que la UI muestre el badge "Nuevo servicio · Inicia hoy" (borde esmeralda + pulso animado). El agrupador usa `cliente_id` como key (no cliente_nombre) para evitar colisiones entre clientes con el mismo nombre.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.