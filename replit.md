# Workspace

## Overview
This project is a pnpm workspace monorepo using TypeScript, designed for "Investigaciones y Seguridad Profesional S.A." (Guatemala). It includes a corporate website and an admin dashboard with a premium dark navy/gold design, all text in corporate Spanish.

The monorepo contains:
- `artifacts/isp-web`: A React + Vite + Tailwind + shadcn/ui Single Page Application (SPA) that serves both the public corporate site and the admin dashboard.
- `artifacts/api-server`: An Express 5 REST API handling all backend logic, data persistence, and business rules.

Key capabilities include:
- **Comprehensive Admin Modules:** Dashboard, Commercial (leads CRM), Recruitment (job applications), and Incidents Management.
- **Robust Authentication & RBAC:** User roles (admin, operaciones, rrhh, comercial, supervisor, cliente) with granular permissions for accessing different modules and features, stored in a PostgreSQL database with bcrypt-hashed passwords.
- **Client Portal:** A dedicated, secure portal for clients to view their specific incidents, KPIs, and assigned agents.
- **External System Integration Readiness:** Designed with placeholder services and database fields for future integration with external HR systems.
- **Branding Consistency:** Centralized branding configuration ensures a consistent corporate identity across the application.
- **Scalable Architecture:** Built on a monorepo structure with shared libraries for OpenAPI specification, generated API clients, and database access.

The project aims to provide a comprehensive digital platform for ISP S.A., streamlining internal operations, enhancing client interaction, and establishing a strong online presence.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

## System Architecture

### Monorepo Structure
The project is organized as a pnpm workspace monorepo with the following high-level structure:
- `artifacts/`: Deployable applications (e.g., `api-server`, `isp-web`).
- `lib/`: Shared libraries (e.g., `api-spec`, `api-client-react`, `api-zod`, `db`).
- `scripts/`: Utility scripts.

All packages extend a base TypeScript configuration (`tsconfig.base.json`) with `composite: true`, enabling efficient type-checking and build processes across the monorepo.

### Technology Stack
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **Package Manager:** pnpm
- **TypeScript:** v5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Build Tool:** esbuild (for CJS bundles)

### UI/UX Decisions
- **Design System:** Premium dark navy/gold theme.
- **Component Library:** shadcn/ui for consistent and accessible UI components.
- **Language:** All user-facing text is in corporate Spanish.
- **Branding:** Centralized branding configuration (`artifacts/isp-web/src/config/branding.ts`) for legal names, short names, taglines, and copyright information, ensuring consistency across all layouts (Navbar, Footer, AdminSidebar, AdminTopbar, Login).

### Technical Implementations & Feature Specifications
- **API Server (`@workspace/api-server`):**
    - Express 5 server with routes in `src/routes/`.
    - Uses `@workspace/api-zod` for request/response validation and `@workspace/db` for persistence.
    - Routes are mounted at `/api`.
- **Database Layer (`@workspace/db`):**
    - Drizzle ORM with PostgreSQL.
    - Exports a Drizzle client and schema models.
    - `drizzle.config.ts` for Drizzle Kit.
    - Supports migrations (handled by Replit in production, `pnpm --filter @workspace/db run push` in development).
- **API Specification & Codegen (`@workspace/api-spec`):**
    - Owns the OpenAPI 3.1 spec (`openapi.yaml`).
    - Uses Orval for codegen, generating:
        - React Query hooks (`lib/api-client-react`).
        - Zod schemas (`lib/api-zod`).
- **Authentication & Authorization:**
    - PostgreSQL `users` table with bcrypt-hashed passwords.
    - Session stored in `sessionStorage`.
    - Role-Based Access Control (RBAC) with predefined roles: `admin`, `operaciones`, `rrhh`, `comercial`, `supervisor`, `cliente`.
    - `AuthGuard` component protects routes based on user roles.
    - Updated login flow redirects users based on their role (`/portal/dashboard` for `cliente`, `/admin/dashboard` for others).
- **Admin Dashboard Modules:**
    - **Dashboard:** Live counts from leads, applications, incidents.
    - **Comercial (`/admin/comercial`):** Manages leads (CRM pipeline).
    - **Reclutamiento (`/admin/reclutamiento`):** Manages job applications.
    - **Incidencias (`/admin/incidencias`):** Full operational module with table, filters, stat cards, and modals for creating/editing incidents. Uses React Query with a 15s refetch interval.
- **Client Portal (`/portal/*`):**
    - Separate section for users with `rol='cliente'`.
    - Protected by `PortalGuard` and `AuthGuard` to ensure role-specific access and redirection.
    - Filters all data by `users.clienteId` (e.g., incidents, assigned agents).
    - API endpoints (`/api/portal/*`) enforce `x-isp-role` and `x-isp-clienteid` headers for data isolation.
    - Displays client-specific dashboard, incidents, KPIs, and assigned agents (with sensitive employee data excluded).
- **Employee Management (Future RH Integration):**
    - `employees` table with fields for external ID, source system, sync status, and last sync timestamp.
    - `users.employeeId` for linking users to employees (nullable, no hard FK).
    - API endpoints for listing, creating, updating employees and checking sync status.
    - Placeholder `HRSyncService` for integrating with external HR SQL databases.
    - Portal agents (`/portal/agentes`) consume `agent_assignments JOIN employees`.
- **Database Tables:**
    - `leads`: `id`, `empresa`, `contacto`, `servicio`, `canal`, `estado`, `ejecutivo`.
    - `applications`: `id`, `nombre`, `telefono`, `puesto`, `canal`, `estado`.
    - `incidents`: `id` (INC-YYMMDD-XXXX), `cliente`, `tipo`, `origen`, `prioridad`, `estado`, `responsable`, `descripcion`, `clienteRefId`.
    - `users`: `id`, `username`, `passwordHash`, `nombre`, `rol`, `clienteId`, `employeeId`.
    - `agent_assignments`: `employeeId`, `clienteId`, `codigoAsignacion`, `puesto`, `servicio`, `ubicacion`, `supervisorNombre`, `fechaInicio`, `fechaFin`, `estado`.

## WhatsApp Fase 1 — Canal de Entrada Real

Webhook que convierte mensajes de WhatsApp en registros reales en la BD.

**Nuevos archivos:**
- `artifacts/api-server/src/routes/whatsapp-webhook.ts` — router del webhook (verificación Meta + recepción + simulador)
- `artifacts/api-server/src/services/whatsapp/classifier.ts` — clasificador de mensajes por palabras clave en español
- `artifacts/api-server/WA-WEBHOOK-README.md` — documentación completa de endpoints, formato Meta, cómo probar y cómo conectar la API real

**Endpoints:**
- `GET /api/webhooks/whatsapp` — verificación Meta (hub.challenge), usa `WA_VERIFY_TOKEN`
- `POST /api/webhooks/whatsapp` — recibe payload de Meta Cloud API (responde 200 inmediato, procesa async)
- `POST /api/webhooks/whatsapp/simulate` — simulador local con 3 escenarios: `postulacion`, `lead`, `incidencia`

**Lógica de clasificación:**
- Palabras clave de incidencia → `incidentsTable`, `origen = "whatsapp"`, ID `WA-YYMMDD-XXXX`
- Palabras clave de postulación → `applicationsTable`, `canal = "whatsapp"`
- Palabras clave de lead / default → `leadsTable`, `canal = "whatsapp"`

**Visual en admin:**
- Badge verde (#25D366) con ícono MessageCircle en `StatusBadge`
- Highlight verde tenue en filas con `canal = "whatsapp"` en Reclutamiento y Comercial
- Filtro de canal "WhatsApp" agregado a Reclutamiento y Comercial
- Contador "N via WhatsApp" visible en filtros

**Módulos con datos mock (pendientes de conectar a BD):**
- Tareas, KPI (admin), Custodias, Clientes

## External Dependencies
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Used for interacting with the PostgreSQL database.
- **Orval:** For generating API client code and Zod schemas from the OpenAPI specification.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **shadcn/ui:** Reusable UI components.