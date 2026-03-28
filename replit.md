# Workspace

## Overview
This project is a pnpm monorepo for "Investigaciones y Seguridad Profesional S.A." (Guatemala), providing a comprehensive digital platform. It includes a corporate website and an admin dashboard, both designed with a dark navy/gold theme and presented in corporate Spanish. The platform aims to streamline internal operations, enhance client interaction, and establish a robust online presence.

Key capabilities include:
- **Comprehensive Admin Modules:** Covering Commercial (leads CRM), Recruitment (job applications), Incidents Management, HR Advances, HR Disciplinary KPI, Operational Rotation KPI, RRHH Automatic Alerts, and a CMS for public website content.
- **Robust Authentication & RBAC:** Granular role-based access control (admin, operaciones, rrhh, comercial, supervisor, cliente).
- **Client Portal:** Secure access for clients to view incidents and KPIs (SQL aggregation via DATE_TRUNC; auth validated against DB).
- **Trello Integration:** Seamless integration for Incidencias, Leads, and Postulaciones, with a mock mode for development.
- **WhatsApp Integration:** Transforms WhatsApp messages into structured database records for leads, applications, incidents, advance requests, and task queries. Includes admin config module with session-header audit attribution.
- **Client and Position Aliases:** Facilitates using common names for client and service locations in incident reporting.
- **Lead → Cliente Conversion:** POST /api/leads/:id/convertir-cliente promotes a "ganado" lead to a real clients record (lazy migration of leads.cliente_id FK).
- **Postulante → Empleado Conversion:** POST /api/applications/:id/contratar creates an employees record from an "aprobado" application.
- **Branding Consistency:** Centralized configuration ensures a uniform corporate identity.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

## System Architecture

### Monorepo Structure
The project uses a pnpm workspace monorepo, organizing deployable applications (`api-server`, `isp-web`) in `artifacts/`, shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`) in `lib/`, and utilities in `scripts/`. It leverages a base TypeScript configuration for efficient development.

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
- **Employee Management (`/admin/empleados`):** Core module for managing employee data, including their profiles, assignments, system links, operational tasks, and individual KPIs.
- **WhatsApp Integration:** Processes incoming WhatsApp messages via a webhook, classifying them to create records for incidents, applications, leads, and advance requests. Includes a DPI phone registration flow for unknown numbers.
- **Trello Integration:** Facilitates creating Trello cards from the admin panel for incidents, complete with detailed information and automated assignments.
- **Client and Position Aliases:** Manages aliases for clients and service locations, improving data entry and reporting accuracy.
- **Ficha de Cliente — Modelo Maestro Operativo (`/admin/clientes/:id`):** A unified operational view per client, detailing contract information, site structures, operational coverage, and assigned employees.
- **Emergencias Restringidas:** An emergency reporting system with keyword detection, role-based access, and location resolution through aliases.
- **Cierre Operativo Diario — en Pizarrón (`/admin/operaciones`):** A secure, auditable daily operational closing system for supervisors and admins, preventing changes to past data and providing detailed audit logs.
- **Centro de Operaciones — Pizarrón Operativo (`/admin/operaciones`):** A real-time Kanban-style board for managing personnel assignments to operational posts via drag-and-drop or click-to-select, with comprehensive logging of movements.
- **Tareas con Evidencia:** A task management system requiring photo and comment evidence for completion, with full API support and a planned WhatsApp closure flow.
- **Reportería Profesional (`/admin/reportes`):** A multi-tab reporting module featuring charts, filterable tables, and export options (CSV, PDF) for various operational aspects, including incidents, tasks, HR, commercial, and executive KPIs.
- **Zonas Operativas Globales (`/admin/operaciones/zonas`):** Cross-client operational zone grouping. Zones aggregate `puestos_operativos` from different clients under a single zone supervisor. DB: `operational_zones` table + `zona_operativa_id` FK on `puestos_operativos`. API: full CRUD at `/api/operaciones/zonas`, plus `/zonas/:id/detalle`, `/zonas/:id/puestos` (assign bulk), `/todos-puestos`. Frontend: ZonasOperativas.tsx page with zone cards (stats, coverage bar, supervisor), "Asignar puestos" modal (grouped by client, checkbox per puesto, warns if puesto is in another zone), detail modal. Pizarrón (`Operaciones.tsx`) has zone + client filter dropdowns in the action bar and a "Zonas" navigation link. FichaCliente.tsx shows a zona badge on each puesto row. Empleados.tsx TabOperacion shows the zones supervised by the employee.
- **Reporte de Cobertura por Zona Operativa (`/admin/reportes/cobertura-zonas`):** Standalone reporting page for analyzing daily operational coverage by zone. Features: 8 period presets (Hoy/Ayer/7d/15d/Este mes/Mes anterior/Este año/Personalizado), filter bar (zona, cliente, tipo cobertura), global stats cards (registros/puestos/zonas/clientes/titular/relevo/descubiertos/HE), color-coded global coverage bar, per-zone summary cards with supervisor info and coverage %, hierarchical detail table (zona → cliente → sede → puestos, collapsible), "base para costo de supervisión" section, CSV export, PDF export (IspPdf). API: `GET /api/reportes/cobertura-zonas` with desde/hasta/zona_id/cliente_id/sede_id/tipo_cobertura/supervisor_id params; JOINs cobertura_diaria + puestos_operativos + operational_zones + employees. Linked from Reportes.tsx as a featured card for admin/operaciones/supervisor roles.
- **Pizarrón → Fuente Oficial de Nómina (Multi-tramos + Novedades):** Multi-person coverage segments per post/day with time ranges. DB: `cobertura_segmentos` (fecha, puesto_id, employee_id, tipo_cobertura, hora_inicio, hora_fin, horas_calculadas, fue_en_dia_descanso, genera_horas_extra) and `novedades_nomina_diarias` (UNIQUE fecha+employee_id, trabajo_dia, horas_trabajadas, horas_extra, falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia). API: GET/POST/DELETE `/api/cobertura/segmentos` with automatic hour calculation and rest-day/overtime detection; GET `/api/nomina/novedades`, POST `/api/nomina/novedades/generar`, GET `/api/nomina/novedades/resumen-periodo`. `generarNovedades(fecha, cierreId)` helper exported from nomina.ts; POST `/api/operaciones/cierre` calls it automatically and returns `novedadesGeneradas` count. Frontend: `ModalSegmentos` component in Operaciones.tsx — opens from "Tramos" button on every puesto card, shows existing segments with HE/descanso badges, employee search (autocomplete), type/time/motivo form, add/delete segments. HH:MM format validation on hora_inicio/hora_fin fields (regex + inline error text).
- **Audit Fixes (Round 1):** C-01: `ModalNuevoCliente` in Clientes.tsx — "Nuevo cliente" button with modal (nombre, nombreComercial, nit, sector, notas) via POST `/api/alias/clientes`. A-05: `GET /api/operaciones/cierre-hoy` now queries `cobertura_segmentos` for covered posts without segments and adds an advertencia. A-03/M-03: `ModalPuesto` in FichaCliente.tsx now includes "Zona operativa" select (loads from `/api/operaciones/zonas/disponibles`) and "Empleado titular" autocomplete search; POST `/api/clientes/:id/puestos` and PATCH `/api/puestos/:id` now accept `zona_operativa_id` and `titular_employee_id`. M-07: ModalSegmentos hora fields validate HH:MM format with red border + inline error on invalid input.
- **Audit Fixes (Round 2):** C-02: `syncCoberturaDesdeSegmentos` helper in `cobertura.ts` auto-syncs `cobertura_diaria` from segments after each POST/DELETE — sums hours, determines dominant tipo (titular>relevo), upserts or deletes cobertura_diaria record. C-03: `POST /api/rrhh/eventos/:id/anular` now reverts `novedades_nomina_diarias` (falta/suspension/descuento_dia → FALSE) if no other active events exist for same employee+date, with audit note in observaciones. C-04: `GET /api/portal/agentes` rewritten to query `puestos_operativos` (LEFT JOIN client_sedes, employees, operational_zones) instead of legacy `agent_assignments`; returns puesto_id, puesto, turno, estado_puesto, sede_nombre, empleado_nombre_completo, zona_nombre. C-05: `incidents` table has new `client_id INTEGER REFERENCES clients(id)` column (auto-seed migration + backfill); `incidents.ts` POST and `emergencias.service.ts` `crearEmergencia` both derive and store `client_id`; Drizzle schema updated with `clientId: integer("client_id")`.
- **Audit Fixes (Round 3 — High):** A-01: UNIQUE constraint on `clients.portal_cliente_id` + FK `agent_assignments.cliente_id → clients.portal_cliente_id NOT VALID` (both in auto-seed.ts). A-02: PUT `/api/nomina/novedades/:id` endpoint; `NovedadesNomina.tsx` page at `/admin/rrhh/nomina` with date filters, inline edit, CSV export, re-generate; fmtFecha fixed for ISO timestamps. A-04: `operaciones.ts` asignar+sustituir auto-creates `cobertura_segmentos` records with turno-based times. A-06: `CerrarTareaModal.tsx` rewritten — 2-step GCS upload flow (POST request-url → PUT to presigned URL → send URL), uses `URL.createObjectURL` for preview (no base64), shows upload progress. `storage.ts` wildcards fixed for Express 5 path-to-regexp v8 (`*path` syntax).
- **Audit Fixes (Round 4 — Medium):** M-01: `GET /employees` SQL WHERE conditions instead of in-memory Array.filter (Drizzle ORM with `ilike`/`eq`/`and`/`or`). M-02: `POST /tareas/:id/cerrar` now validates supervisor role from DB via `usersTable` lookup using supervisorId (no longer trusts body `rolSupervisor`). M-03: `Reportes.tsx` FiltrosBar "Cliente" field changed from free text to `<select>` dropdown populated from `/api/alias/clientes`. M-04: `GET /employees/sync/status` uses SQL `COUNT(*) FILTER (WHERE ...)` aggregation instead of loading all rows in memory. M-05: `GET /tareas` evidences query uses `WHERE tarea_id = ANY($1::varchar[])` to fetch only evidences for returned task IDs.
- **Audit Fixes (Round 5 — Pending):** P-01: `ResponsableSelector` now also calls `onChangeWithId(nombre, id)` with the employee ID; `NuevaIncidenciaModal` tracks `responsableId` and sends it to the server; `incidents.ts` POST validates the ID against `employees` table and resolves the canonical name from DB, rejecting unknown/inactive employees; new `responsable_id INTEGER REFERENCES employees(id)` column added via `auto-seed.ts` migration. P-02: `GET /operaciones/pool` now uses a single SQL query with `LEFT JOIN` + `CASE` expression to categorize agents into disponible/en_puesto/en_descanso/suspendido — eliminates two-query approach and JS-side Array.filter. P-03: `PATCH /operaciones/puestos/:id` returns HTTP 400 if all fields (horario, jornada, sedeId, notas, turno) are undefined/null, preventing silent no-op UPDATEs. P-04: `CMS.tsx` content fields now show a live character counter (current/max) with color change at 85% and red border at 100%; text fields capped at 200 chars, textarea at 1000; `maxLength` enforced in `onChange` handler. P-05: `users.ts` new `GET /api/users/check?username=xxx` endpoint returns `{ available: boolean }`; `Usuarios.tsx` NuevoUsuarioModal calls it `onBlur` on the username field, shows inline error if taken, and blocks form submission if the username is already registered.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.