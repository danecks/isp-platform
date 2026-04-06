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
- **Admin Dashboard Modules:** Live dashboards, CRM, job application management, incident reporting, HR advance requests, employee management, and comprehensive payroll management (Pre-Payroll Audit, Planilla Final, Pre-Planilla Control de Cierre v3, Nómina — Motor de Cálculo Completo, Séptimo Día RRHH-Driven, IGSS Guatemala, Bonificación Incentivo Decreto 78-89, Special Day Counters, E2E Integral payroll suite).
- **Client Portal (`/portal/*`):** Secure interface for clients to view data and KPIs.
- **Operational Management:** Features like "Ficha de Cliente — Modelo Maestro Operativo" for unified client views, "Emergencias Restringidas" for emergency reporting, "Cierre Operativo Diario — en Pizarrón" for daily closing, "Centro de Operaciones — Pizarrón Operativo" for real-time personnel assignment, "Tareas con Evidencia" for task tracking, "Reportería Profesional" for multi-tab reports, and "Zonas Operativas Globales" for cross-client grouping.
- **Integrations:** WhatsApp integration for processing messages and Trello integration for creating cards.
- **Advanced Modules:**
    - **Módulo Vehículos (VEH-01):** Full vehicle supervision with auto custody.
    - **Módulo Armería (ARM-01/ARM-02):** Weapons control module with arma → puesto → agente logic, including documental control of possession.
    - **Multi-titular consolidation (PT-01):** Unified `puesto_titulares` table for managing multiple position holders.
    - **Motor de Turnos Completo (T001-T007):** Rewritten shift engine supporting various cycles (12h, 24x24, 24x48, 24x72, 8x8).
    - **Solicitudes de Eliminación (DEL-01):** Admin page for reviewing and managing deletion requests.
    - **Cancelación de Servicios Adicionales (SSA-CAN-01):** Workflow for cancelling additional services.
    - **Novedades RRHH — Flujo de Revisión Pendiente (NRRHH-01):** Workflow for HR review of daily absences and incidents before payroll impact.
    - **Integración Custodios ↔ Puestos (CUST-02):** Introduces `tipo_puesto` for 'custodia' positions with a dedicated dashboard.
    - **Módulo Prestaciones Laborales (PREST-01):** Comprehensive Guatemala labor benefits module including aguinaldo, bono14, vacations, indemnification, and provisions with a dedicated calculation library and API.
    - **Sistema de Dotación de Uniformes (UNIF-01):** Full uniform/boots deduction system. Clients can be configured with a uniform quota (N uniforms every X months) for their titular agents. Deliveries are registered in Bodega with installment cuotas (1–N). Cuotas automatically deduct from planilla (same pattern as anticipos). Unpaid balance at termination deducts from liquidación as a negative rubro. Tables: `entregas_uniforme`, `entregas_uniforme_cuotas`. New planilla_lineas columns: `descuentos_uniforme`, `uniforme_cuota_ids`. New client columns: `dotacion_uniforme_num`, `dotacion_uniforme_frecuencia_meses`.
    - **Plantilla de Turnos (TURNOS-01):** Weekly shift schedule grid per puesto. Table `puesto_slots` (puesto_id FK, slot_numero, horas_turno 12|24, hora_entrada, dias_trabajo int[] 1=Lun–7=Dom, empleado_id FK, notas, activo). Operative purpose: days marked = agent works; unmarked days = agent rests = available for overtime/coverage. UI: new "Plantilla de Turnos" tab in FichaCliente with interactive 7-day grid (click cell = toggle work/rest, auto-saves). Modal "Nuevo slot" with puesto select, 12h/24h toggle, time input, employee search, day picker. API: GET/POST/PUT/DELETE `/api/puestos/:id/slots`, GET `/api/clientes/:id/slots`, GET `/api/operaciones/disponibles-cobertura` (agents resting today).
    - **Rondas de Patrullaje + NFC Piloto:** GPS patrol route tracking with NFC checkpoint verification. Tables: `nfc_devices`, `nfc_tags`, `nfc_shift_events`, `nfc_supervisor_forms`, `nfc_supervisor_form_items`, `nfc_audit_log`, `nfc_sandbox_schedules`, `nfc_ronda_puntos`, `nfc_ronda_eventos`. Public kiosk endpoint at `/kiosko`. Full admin UI in NfcPiloto.tsx.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.