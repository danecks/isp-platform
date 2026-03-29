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
- **Pre-Payroll Audit Fixes:** Enhancements for payroll accuracy, including labor fields in employee records, unique DPI validation, required time fields for coverage segments, auto-absence detection, integration of HR suspension events, and tracking payroll advances.
- **WhatsApp Integration:** Processes incoming WhatsApp messages via a webhook, classifying them to create records for incidents, applications, leads, and advance requests, including a DPI phone registration flow.
- **Trello Integration:** Facilitates creating Trello cards from the admin panel for incidents with detailed information and automated assignments.
- **Client and Position Aliases:** Manages aliases for clients and service locations, improving data entry and reporting accuracy.
- **Ficha de Cliente — Modelo Maestro Operativo (`/admin/clientes/:id`):** A unified operational view per client, detailing contract information, site structures, operational coverage, and assigned employees.
- **Emergencias Restringidas:** An emergency reporting system with keyword detection, role-based access, and location resolution through aliases.
- **Cierre Operativo Diario — en Pizarrón (`/admin/operaciones`):** A secure, auditable daily operational closing system for supervisors and admins.
- **Centro de Operaciones — Pizarrón Operativo (`/admin/operaciones`):** A real-time Kanban-style board for managing personnel assignments to operational posts via drag-and-drop.
- **Tareas con Evidencia:** A task management system requiring photo and comment evidence for completion.
- **Reportería Profesional (`/admin/reportes`):** A multi-tab reporting module featuring charts, filterable tables, and export options for various operational aspects.
- **Zonas Operativas Globales (`/admin/operaciones/zonas`):** Cross-client operational zone grouping with full CRUD functionality, assignment of puestos, and integration into operational dashboards and client fichas.
- **Reporte de Cobertura por Zona Operativa (`/admin/reportes/cobertura-zonas`):** Standalone reporting page for analyzing daily operational coverage by zone with period presets, filters, global stats, color-coded coverage bar, and hierarchical detail table.
- **Pizarrón → Fuente Oficial de Nómina (Multi-tramos + Novedades):** Supports multi-person coverage segments per post/day with time ranges, automatic hour calculation, and generation of daily payroll novelties, including an interactive segment modal.
- **Audit Fixes (Comprehensive):** Includes updates such as `ModalNuevoCliente` for client creation, improved warning system for uncovered posts, "Zona operativa" selection and "Empleado titular" autocomplete in `ModalPuesto`, HH:MM format validation in `ModalSegmentos`, automatic synchronization of `cobertura_diaria` from segments, anulação of RRHH events, rewritten `GET /api/portal/agentes` query, and addition of `client_id` to `incidents`. Further fixes cover `portal_cliente_id` uniqueness, `PUT /api/nomina/novedades/:id` endpoint, automatic `cobertura_segmentos` creation during assignments, GCS upload flow for `CerrarTareaModal`, optimized SQL queries, supervisor role validation, dynamic client dropdowns in reports, efficient sync status checks, optimized evidences query, tracking `responsableId` for incidents, single SQL query for `/operaciones/pool`, validation for `PATCH /operaciones/puestos/:id`, live character counters in `CMS.tsx`, and username availability checks in `Usuarios.tsx`.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.