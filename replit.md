# Workspace

## Overview
This project is a pnpm workspace monorepo for "Investigaciones y Seguridad Profesional S.A." (Guatemala), encompassing a corporate website and an admin dashboard with a dark navy/gold design, all in corporate Spanish. It provides a comprehensive digital platform to streamline internal operations, enhance client interaction, and establish an online presence.

Key capabilities include:
- **Comprehensive Admin Modules:** Dashboard, Commercial (leads CRM), Recruitment (job applications), Incidents Management, and HR Advances.
- **Robust Authentication & RBAC:** Granular permissions for user roles (admin, operaciones, rrhh, comercial, supervisor, cliente).
- **Client Portal:** Secure portal for clients to view incidents and KPIs.
- **Trello Integration:** Full Trello board integration for Incidencias, Leads (Comercial), and Postulaciones (Reclutamiento) — each module has a send-to-Trello button; mock mode when credentials not set.
- **WhatsApp Configuration Admin:** New admin module at `/admin/configuracion/whatsapp` with 4 tabs: General (bot settings), Mensajes (12 automatic messages), Opciones de Menú (19 options across 4 roles), and Auditoría (change history).
- **WhatsApp Integration:** Transforms WhatsApp messages into database records for leads, applications, incidents, and advance requests.
- **Client and Position Aliases:** Allows using common names for clients and service locations in incident reporting.
- **Branding Consistency:** Centralized configuration ensures a consistent corporate identity.
- **CMS Web Module:** Full-featured admin CMS at `/admin/cms` (admin-only) for editing all 10 public pages. Content is stored in `page_content` PostgreSQL table (JSONB). Supports Save Draft / Publish workflow with status indicators. Public pages use `useCmsPage(key)` hook with graceful fallback to hardcoded defaults when no published content exists.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

## System Architecture

### Monorepo Structure
The project is a pnpm workspace monorepo with `artifacts/` for deployable applications (`api-server`, `isp-web`), `lib/` for shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`), and `scripts/` for utilities. It uses a base TypeScript configuration for efficient type-checking and build processes.

### Technology Stack
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **TypeScript:** v5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Build Tool:** esbuild

### UI/UX Decisions
- **Design System:** Premium dark navy/gold theme.
- **Component Library:** shadcn/ui for consistent and accessible UI.
- **Language:** All user-facing text is in corporate Spanish.
- **Branding:** Centralized branding configuration for consistent corporate identity across all layouts.

### Technical Implementations & Feature Specifications
- **API Server (`@workspace/api-server`):** Express 5 server handling all backend logic, data persistence, and business rules.
- **Database Layer (`@workspace/db`):** Drizzle ORM with PostgreSQL, supporting schema models and migrations.
- **API Specification & Codegen (`@workspace/api-spec`):** Defines the OpenAPI 3.1 spec and uses Orval to generate React Query hooks and Zod schemas.
- **Authentication & Authorization:** PostgreSQL `users` table with bcrypt-hashed passwords. Role-Based Access Control (RBAC) with roles: `admin`, `operaciones`, `rrhh`, `comercial`, `supervisor`, `cliente`. `AuthGuard` protects routes based on user roles, redirecting to `/portal/dashboard` for `cliente` and `/admin/dashboard` for others.
- **Admin Dashboard Modules:**
    - **Dashboard:** Live counts from leads, applications, incidents.
    - **Comercial (`/admin/comercial`):** Leads CRM.
    - **Reclutamiento (`/admin/reclutamiento`):** Job applications.
    - **Incidencias (`/admin/incidencias`):** Full operational module with tables, filters, and modals for incident management.
    - **Anticipos (`/admin/anticipos`):** HR module for managing advance requests with status tracking, filtering, and CSV export.
- **Client Portal (`/portal/*`):** Dedicated section for `cliente` role users, displaying client-specific incidents, KPIs, and assigned agents. API endpoints enforce headers for data isolation.
- **Employee Management:** Supports `employees` table with fields for external HR system integration and links users to employees.
- **WhatsApp Integration:** Webhook (`/api/webhooks/whatsapp`) classifies incoming messages (incidents, applications, leads, advance requests) based on keywords and creates corresponding database entries. Includes a local simulator. WhatsApp-originated entries are visually highlighted in the admin UI.
- **DPI Phone Registration (WhatsApp):** Unknown phones attempting internal functions (anticipo, emergency) trigger a multi-turn DPI identity verification flow instead of being blocked. State machine: `WAIT_DPI → WAIT_CONFIRM/WAIT_REPLACE → registered/secondary/cancelled`. DB tables: 5 new columns on `users` (telefono_secundario, wa_autorizado, telefono_verificado_at, last_phone_update_at, auth_source) and `phone_auth_log` audit table. 11 configurable WA messages for the DPI flow. Max 3 attempts. Session TTL: 20 min. Service: `phone-registration-session.ts`.
- **HR Advances (Anticipos):** Manages advance requests via a dedicated API and admin module. Supports multi-turn WhatsApp flow for requests, validates employee status, eligible dates, and prevents duplicates.
- **Trello Integration:** Creates Trello cards for incidents from the admin panel (`/api/trello/send-incident/:id`). Cards include incident details, a predefined checklist, and auto-assignment to configured members. Supports mock mode.
- **Client and Position Aliases:** Tables (`clients`, `client_aliases`, `service_locations`, `position_aliases`) resolve free-text to clients/locations. Admin UI at `/admin/clientes` with 3 tabs.
- **Emergencias Restringidas:** Emergency reporting system with keyword detection (23 triggers), permission control by role, alias-based location resolution. 7 API endpoints at `/api/emergencias/*`. Visual indicators in Incidencias and Dashboard. Emergency modal from admin panel.
- **Centro de Operaciones — Pizarrón Operativo (`/admin/operaciones`):** Tablero Kanban visual en tiempo real para gestión de cobertura de puestos. Columnas por cliente (auto-agrupadas), cada puesto muestra agente asignado/descubierto con indicadores visuales. Pool de agentes en la parte inferior con 4 pestañas (disponibles, en puesto, descanso, suspendidos). Drag & drop con @dnd-kit/core + @dnd-kit/sortable — arrastrar agente sobre puesto para asignar. También modo click-to-select para dispositivos táctiles. Lógica de sustitución completa: detecta conflictos (agente ya en otro puesto), muestra advertencia y permite forzar. Panel lateral de historial (últimos 80 movimientos). Stats en tiempo real: cobertura %, cubiertos/descubiertos/disponibles. Modales: confirmar sustitución (con motivo seleccionable: rotación, falta, descanso, suspensión, emergencia), liberar agente (con motivo), crear nuevo puesto (selector de cliente + manual). Auto-refresh cada 30 seg. DB: `puestos_operativos` (cliente_id, cliente_nombre, nombre, turno, agente_id, agente_nombre, estado, orden, activo) + `movimientos_operativos` (log completo con agente saliente/entrante, tipo, motivo, usuario que hizo el cambio). 7 endpoints API en `/api/operaciones/`. Seed automático de 8 puestos iniciales al primer arranque. Acceso: admin, operaciones, supervisor.
- **Gestión de Colaboradores (`/admin/empleados`):** Módulo CORE que convierte `employees` en la entidad central del sistema. Vista de tabla (por defecto) y tarjetas con toggle. Columnas: nombre, DPI enmascarado (****XXXX), teléfono, puesto/área, supervisor, estado. Filtros por estado (activo, suspendido, baja, licencia, inactivo), área y búsqueda por nombre, DPI, teléfono. Stats: total, activos, suspendidos/baja, con DPI registrado. CRUD completo (crear/editar) con validación de DPI único. Cambio rápido de estado desde el botón de la ficha. Ficha del colaborador con 5 pestañas: Perfil (datos + DPI masked + WA status), Asignaciones (historial de despliegues), Sistema (usuario vinculado + IDs + WA info), Operación (tareas, incidencias y anticipos recientes), KPI Individual (métricas 90 días con progress bars). Acceso para roles: admin, operaciones, rrhh, supervisor. Schema DB `employees` extendido con: `telefono_secundario`, `tipo_servicio`, `supervisor_id` (self-ref), `cliente_id` (→ clients), `wa_autorizado`, `telefono_verificado_at`. Nuevos endpoints API: GET `/api/employees/:id/user`, GET `/api/employees/:id/operacion`, PATCH `/api/employees/:id/estado`.
- **Tareas con Evidencia:** Operational task management fully backed by PostgreSQL. Tables: `tareas` (8 fields) and `task_evidencias` (supervisor, comment, photo URL as base64, channel, close date). Only `supervisor` and `admin` roles can close tasks. Requires: photo (max 1.5 MB base64) + minimum 10-char comment. API: GET/POST/PATCH/DELETE `/api/tareas`, POST `/api/tareas/:id/cerrar`. Evidence history shown in admin UI with photo preview. WhatsApp closure flow fully prepared (6 WA messages seeded): step-by-step supervisor interaction via WA will call the same `/api/tareas/:id/cerrar` endpoint with `canal="whatsapp"`. Trello auto-move hook commented in code at `tareas.ts` line 303 — awaiting Trello list ID for "Resuelto".
- **Reportería Profesional (`/admin/reportes`):** 6-tab reporting module with real PostgreSQL data, charts (Recharts bar charts), expandable tables, global filter bar (date range, client, status, channel, priority), and dual export (CSV + PDF). PDF uses jsPDF + jspdf-autotable with ISP membrete (logo, company header, gold accent, exec summary cards, data tables, confidentiality footer + page numbers). Tabs: Operaciones (non-emergency incidents), Emergencias (emergency incidents only), Tareas (task completion + supervisor performance), RRHH (anticipos + reclutamiento sub-tabs), Comercial (leads pipeline + executive), KPI Ejecutivo (consolidated metrics + client activity heatmap). Role access: admin, operaciones, rrhh, comercial, supervisor. KPI tab admin-only. API: 6 endpoints at `/api/reportes/{operaciones|emergencias|tareas|rrhh|comercial|kpi}`, all accept filter query params.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Database interaction.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration (implicit, as it handles webhooks).
- **Trello:** For task management integration.