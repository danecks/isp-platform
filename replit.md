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
- **Armory Management:** Implemented documentary statuses (`pendiente`/`en_tramite`) for weapon documentation, auto-generated weapon codes (`ARM-####`), and a visual indicator ("EN ARMERÍA") when a weapon is unassigned.
- **Barracas (Company Housing):** Module for managing company-rented housing with defined quotas per barraca, integrated into pre-payroll and payroll deductions. Includes admin CRUD for barracas and assignment/unassignment of employees.
- **Assignment History:** Provides a detailed history of employee assignments, including titularships and daily coverage.
- **PWA Agent Middleware:** Explicit allow-listing for public endpoints consumed by PWA agent pages, ensuring proper access control while allowing necessary public interactions.
- **Bloqueo de Asignación por Fecha de Ingreso Futura:** Empleados con `fecha_ingreso > hoy` no pueden ser asignados (puestos, coberturas, custodias, segmentos, titulares) ni generan día pagado en el cierre nominal. Helper compartido `lib/empleado-fecha-ingreso.ts → validarEmpleadoAsignable()` aplicado en endpoints de asignación; cinturón de filtro `e.fecha_ingreso <= fecha_cierre` aplicado a todos los pasos del cierre que generan novedad. Etiqueta visual ámbar "⏳ Inicia DD-mmm" en la tarjeta del agente del pool en Operaciones cuando la fecha de ingreso es futura (calculada en hora local de Guatemala).

# External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.