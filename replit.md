# Workspace

## Overview
This project is a pnpm monorepo for "Investigaciones y Seguridad Profesional S.A." (Guatemala), providing a comprehensive digital platform with a corporate website and an admin dashboard. The platform aims to streamline internal operations, enhance client interaction, and establish a robust online presence.

Key capabilities include:
- **Comprehensive Admin Modules:** Covering Commercial (leads CRM), Recruitment (job applications), Incidents Management, HR Advances, HR Disciplinary KPI, Operational Rotation KPI, RRHH Automatic Alerts, CMS, Novedades Nómina, and Pre-Planilla Operativa.
- **Robust Authentication & RBAC:** Granular role-based access control for various user roles.
- **Client Portal:** Secure access for clients to view incidents and KPIs.
- **Trello Integration:** Seamless integration for Incidencias, Leads, and Postulaciones.
- **WhatsApp Integration:** Transforms WhatsApp messages into structured database records.
- **Lead and Applicant Conversion:** Facilitates conversion of leads to clients and applicants to employees.
- **Branding Consistency:** Centralized configuration for a uniform corporate identity.
- **Unified Operational Architecture:** Featuring a "Pizarrón Operativo" for daily operations, "Seguimiento SSA" for administrative tracking, and "Pipeline SSA" for commercial overview.

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
- **Branding:** Centralized configuration for a consistent corporate identity.

### Technical Implementations & Feature Specifications
- **API Server (`@workspace/api-server`):** Express 5 backend managing all business logic and data.
- **Database Layer (`@workspace/db`):** Drizzle ORM with PostgreSQL, including schema management and migrations.
- **API Specification & Codegen (`@workspace/api-spec`):** OpenAPI 3.1 specification used by Orval.
- **Authentication & Authorization:** Secure user management with bcrypt and comprehensive Role-Based Access Control (RBAC).
- **Admin Dashboard Modules:** Live dashboards, CRM, job application management, incident reporting, HR advance requests.
- **Client Portal (`/portal/*`):** Secure interface for clients to view data and KPIs.
- **Employee Management (`/admin/empleados`):** Core module for managing employee data.
- **Pre-Payroll Audit Fixes:** Enhancements for payroll accuracy and tracking.
- **Planilla Final (`/admin/rrhh/planilla`) + Complete Financial Control:** Full payroll cycle closure with financial control, generation, retrieval, status updates, reversal, and export.
- **Pre-Planilla Control de Cierre (v3):** Formalized pre-close control system with 4-state validation, automatic validation, blocking modal, period snapshot, and edit-lock.
- **WhatsApp Integration:** Processes incoming WhatsApp messages via webhook for incidents, applications, leads, and advance requests.
- **Trello Integration:** Creates Trello cards from the admin panel for incidents with detailed information.
- **Client and Position Aliases:** Manages aliases for clients and service locations.
- **Ficha de Cliente — Modelo Maestro Operativo (`/admin/clientes/:id`):** Unified operational view per client, detailing contracts, sites, coverage, and assigned employees.
- **Emergencias Restringidas:** Emergency reporting system with keyword detection, RBAC, and location resolution.
- **Cierre Operativo Diario — en Pizarrón (`/admin/operaciones`):** Secure, auditable daily operational closing system.
- **Centro de Operaciones — Pizarrón Operativo (`/admin/operaciones`):** Real-time Kanban-style board for personnel assignment.
- **Tareas con Evidencia:** Task management system requiring photo and comment evidence.
- **Reportería Profesional (`/admin/reportes`):** Multi-tab reporting module with charts, filterable tables, and export options.
- **Zonas Operativas Globales (`/admin/operaciones/zonas`):** Cross-client operational zone grouping with CRUD functionality.
- **Reporte de Cobertura por Zona Operativa (`/admin/reportes/cobertura-zonas`):** Reporting page for daily operational coverage by zone.
- **Pizarrón → Fuente Oficial de Nómina (Multi-tramos + Novedades):** Supports multi-person coverage segments, automatic hour calculation, and daily payroll novelty generation.
- **Tipos de Novedad Estructurados:** Replaces free-text `motivo` with structured `tipo_novedad` for payroll impact.
- **SSA Pipeline Sync (Phase 2):** Automated syncing of SSA-linked task closure to update states.
- **Pool de Agentes — Elegibilidad y Sincronización (SSA-04):** Employee eligibility for agent pool based on `elegible_pool` column and active SSA assignments.
- **Audit Fixes:** System enhancements and bug fixes across various modules.
- **Vista Futura con Estado de Turno (T001/T002):** Future-date board view shows real turno name and employee work/rest status based on cycle calculation.
- **EV-FIN-01 migration:** Added `fecha_fin DATE` to `eventos_rrhh` for multi-day event ranges.
- **POST /puestos con turno requerido:** New puesto creation requires `tipoTurnoId` and `fechaInicioCiclo`.
- **Anti-contaminación de eventos RRHH futuros (T003):** Prevents future HR events from generating current day novelties.
- **Pre-planilla Operativa — 7 escenarios completos:** Defines 3 types of errors and 4 types of alerts for pre-payroll review.
- **Comercial → Pizarrón Operativo (Arranque Programado):** `fecha_inicio_contrato DATE` added to `clients` table, enabling "Arranque Programado" cards in PoolFuturoPanel and a "Próximos Arranques" banner.
- **Fix Bug Crítico 1 — RRHH↔Nómina conectados:** Ensures `generarNovedades()` correctly processes HR absence events, prioritizing them over relief types for payroll.
- **Tablero futuro — planeación de arranques nuevos:** `GET /operaciones/tablero` accepts optional `?fecha=YYYY-MM-DD` to view future operational boards, filtering clients by `fecha_inicio_contrato`.
- **Fix Bug Crítico 2 — Activación automática de proyecto al día de arranque:** Operational board automatically includes clients on their `fecha_inicio_contrato` with an `iniciaHoy` indicator.
- **Servicios Programados — Vista Unificada (SP-01):** `servicios_programados_v` VIEW unifies client start dates and active/pending SSAs.
- **Planificación Futura SSA (PF-02):** `planificacion_futura` extended to support SSA planning, including `puesto_id` nullable, `ssa_id`, and `tipo_cobertura_futura`.
- **SelectorAgenteAgrupado (universal):** Shared component for agent selection, grouping agents by real operational status.
- **Titularidad Histórica Temporal — TH:** Historic ownership of positions is now temporal, defined by `puesto_titular_historico` with fallbacks.
- **Motor de Turnos Completo — 5 tipos ISPSA (T001-T007):** Rewritten `turno-calc.ts` to support various shift cycles (12h, 24x24, 24x48, 24x72, 8x8).
- **Módulo Vehículos (`/admin/vehiculos`) — VEH-01:** Full vehicle supervision module with auto custody by zone supervisor on duty. Tables: `vehiculos`, `vehiculo_custodia`. Sync endpoint updates custody based on turn engine.
- **Módulo Armería (`/admin/armeria`) — ARM-01 (Fase 1):** Weapons control module with arma → puesto → agente logic. Tables: `armas`, `arma_custodia`. Current responsible auto-calculated from `planificacion_futura` (relief override) + `calcularEstadoCiclo` (titular on-duty check). Endpoints: GET /api/armas, GET /api/armas/estado-operativo, POST /api/armas, PATCH /api/armas/:id, POST /api/armas/:id/sync-custodia, POST /api/armas/sync-custodias, GET /api/armas/historial/global. 3-tab UI: Estado Operativo, Armas, Historial. Future phases: municiones, mantenimiento, inventario avanzado.
- **Armería — Control Documental de Tenencia (ARM-02):** Added `numero_tenencia` (TEXT) and `fecha_vencimiento_tenencia` (DATE) to `armas` table. All GET endpoints compute `estado_documental` (`vigente`/`proximo_a_vencer`/`vencida`/`sin_registro`) and `dias_restantes` in SQL. PATCH uses dynamic SQL to update only provided tenencia fields without overwriting unrelated data. Frontend: new `TenenciaBadge` component; tenencia section in `ModalArma` form; tenencia section in `ModalFichaArma` with badge + number + date; documental filter tabs in `TabEstado` (Todas/Vencidas/Por vencer/Sin tenencia) with count badges and card border color coding; `Tenencia` column in `TabArmas` table (xl breakpoint).
- **Multi-titular consolidation — PT-01:** Replaced Par A/Par B dual-puesto pattern with a unified `puesto_titulares` table. 4 pairs merged: Garita Bancaria, Custodia de Valores, Garita Central, Garita Industrial. Each now has 1 DB record with 2 entries in `puesto_titulares` (orden=1/2), each with their own `fecha_inicio_ciclo`. Pool query updated to read `fecha_inicio_ciclo` per-employee from `puesto_titulares` (instead of puesto-level). Tablero query adds LATERAL JOIN to `puesto_titulares` and computes `titulares[]` + `par_trabajando` / `par_descansando` per puesto. UI DroppablePuesto updated to use `TitularCiclo` type for par_trabajando/par_descansando. Par B puestos (IDs 2,5,7,11) deactivated; EOA records redirected to merged puesto.
- **Nuevos Clientes — Hotel Real Intercontinental y Centro Logístico del Norte:** Added 2 new clients (IDs 4, 5) with 4 new puestos: 1x turno 24x48 (Garita Principal, puesto ID=15) and 3x turno 24x72 (Control de Entrada ID=16, Garita Norte ID=17, Bodega Segura ID=18). 15 new employees created (IDs 26-40). Turno rules confirmed: 24x48 uses 2 titulares with weekly alternating pattern (fecha_inicio_ciclo must be a Monday, 7-day offset between T1/T2); 24x72 uses 2 titulares with a 30-day complementary pattern (T2.fecha_inicio = T1.fecha_inicio + 15 days). Each puesto has weapon assigned (armas IDs 15-18: P-015, P-016, P-017, R-018). Employees 28, 31, 32, 35, 36, 39, 40 remain unassigned as available pool agents.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.