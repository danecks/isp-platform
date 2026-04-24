# Workspace

## ⚠ Recordatorios pendientes para el usuario
- **Miércoles 6 de mayo de 2026 (o primera sesión después de esa fecha)**: recordarle al usuario que dejó pendiente decidir si arrancamos el **refactor modular del Pizarrón Operativo** (`artifacts/isp-web/src/admin/pages/Operaciones.tsx`, hoy ~9,862 líneas). Plan propuesto: (1) escribir tests E2E de los flujos críticos, (2) extraer tipos/helpers puros, (3) extraer modales, (4) extraer secciones (PoolDisponibles, SegmentosPorCliente, CustodiasPanel, ProximosRegresos), (5) mover hooks de datos (useTablero, usePool, useCustodias…), (6) dejar `Operaciones.tsx` como orquestador de 500-800 líneas. Antes de tocar código, armar plan completo de tareas con dependencias para que el usuario apruebe. **Borrar este recordatorio una vez tratado.**

## Overview
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

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

## Documentación oficial — REGLA OBLIGATORIA
La documentación del proyecto vive en `/docs/` (5 archivos `.md`: README, manual de usuario, documentación técnica, procedimientos operativos, diccionario de datos) y se publica en el panel admin en `/admin/documentacion` (solo rol admin). El endpoint backend es `GET /api/docs` y `GET /api/docs/:slug`.

**Cada vez que se haga un cambio significativo al sistema** (nuevo módulo, nuevo endpoint, nueva tabla en BD, cambio de flujo operativo, refactor que mueva código, nueva regla de negocio, cambio de permisos, etc.) **se DEBE actualizar el documento correspondiente en `/docs/`**:
- `01-manual-usuario.md` → cambios visibles para el usuario final (UI, nuevas pantallas, nuevos botones, flujos operativos).
- `02-documentacion-tecnica.md` → cambios de arquitectura, endpoints, archivos importantes, helpers, dependencias.
- `03-procedimientos-operativos.md` → cambios en cómo se hacen las cosas día a día (cierre, sustitución, falta, etc.).
- `04-diccionario-datos.md` → cualquier nueva tabla o columna en Postgres.
- `README.md` → solo si cambia la estructura general de la documentación.

No se considera completo un cambio hasta que la documentación correspondiente esté actualizada.

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
- **Admin Dashboard Modules:** Live dashboards, CRM, job application management, incident reporting, HR advance requests, employee management, and comprehensive payroll management.
- **Client Portal (`/portal/*`):** Secure interface for clients to view data and KPIs.
- **Operational Management:** "Ficha de Cliente — Modelo Maestro Operativo", "Emergencias Restringidas", "Cierre Operativo Diario — en Pizarrón", "Centro de Operaciones — Pizarrón Operativo", "Tareas con Evidencia", "Reportería Profesional", and "Zonas Operativas Globales". Includes a "Pizarrón" with refined logic for titular assignment, coverage, and associated overtime generation. Pool segmentation clearly differentiates available, covering, and rest/vacationing agents.
- **HR & Payroll Workflows:** Comprehensive management of daily absences, incidents, and overtime (HE) with full approval chains and bidirectional traceability between operational board and HR. Features include nuanced calculations for `dias_descuento`, handling of cash vs. planilla HE, and a redesigned substitution modal generating paired RRHH events. HE generation is gated: only agents in "descansando" (rest day) or "vacaciones" (vacation) status generate overtime events — "disponible" and "trabajando" agents do NOT. This is enforced both in the frontend (UI hides HE section) and backend (server-side cycle/vacation check, ignores client `generaHE` hint). Disciplinary actions include custom causal selection, PDF generation (Acta Administrativa, Aviso al Inspector), and integration with employee KPIs.
- **Labor Benefits:** Manages "Prestaciones Laborales" including liquidation processes and probation period tracking, impacting payroll and IGSS calculations.
- **Operational Planning:** "Plantilla de Turnos" provides a weekly shift schedule grid with support for full and half-shifts.
- **Reportería — Plantilla de Turnos Vigente:** New endpoint `GET /api/reportes/plantilla-turnos` and admin page `/admin/reportes/plantilla-turnos`. Snapshot del momento por Cliente → Sede → Puesto → Slot, mostrando titularidad, turno (12/24h), rotación 1-4 semanas (longitud_ciclo 7/14/21/28), días de trabajo y descanso por semana, y hora de entrada por semana cuando rota. Filtros: cliente, zona, solo vacantes. El JOIN preserva puestos sin slots configurados (ps.activo = TRUE va en ON, no en WHERE) para detectar puestos completamente vacíos como super-vacantes. **Exports** (refactor 2026-04-24): el Excel (CSV con BOM UTF-8) usa formato AMPLIO determinístico con 28 columnas día (`S{1..4}-{L|M|X|J|V|S|D}` con valores `T`/`M`/`D`/vacío), 4 columnas hora (`S{1..4}-Hora`) e IDs técnicos (`ID Slot`, `ID Puesto`, `ID Cliente`, `ID Empleado`) — diseñado además como plantilla para CARGA MASIVA futura (los IDs harán match exacto al re-importar y `Longitud Ciclo (días)` indica cuántas semanas son válidas). El PDF (`IspPdf`) ahora dibuja **una tarjeta visual por slot** con cabecera + mini-grid semanas×días coloreado (verde=T, ámbar=M, gris=D) en lugar de texto codificado, con leyenda al inicio y tope de 250 slots. Habilitado por nuevo helper `IspPdf.addCustomBlock(estimatedHeight, render)` (genérico, expone `doc`, posición y colores corporativos para dibujo arbitrario).
- **Payroll Generation:** Functionality for calculating Quincenal ISR and generating IGSS payroll TXT files in the official v2.2.0 format.
- **Custody Management:** Integrated "Custodias" module allows managing custody clients and their specific operational slots directly within the main operational board. Custodia slots appear in the pizarrón with truck icons (🚛), support permanent titulares, falta registration, relevo coverage, weapon inheritance per slot, and are included in the daily cierre snapshot with coverage stats. Endpoints: `asignar-custodia`, `registrar-falta-custodia`, `cambiar-titular-custodia`. Arma-slot binding via `armas.custodia_cliente_id` + `armas.custodia_slot_numero`.
- **Barracas (Company Housing):** Module for managing company-rented housing where guards can live. Cuota is defined per barraca (same for all occupants), deducted from payroll. Tables: `barracas`, `barraca_asignaciones`. One active assignment per employee (unique index). Integrated into pre-planilla (`barraca_monto` subquery) and planilla (`descuento_barraca` column). Admin page at `/admin/rrhh/barracas` with CRUD, capacity management, and employee assignment/unassignment. Routes: `GET/POST/PATCH/DELETE /barracas`, `POST /barracas/:id/asignar`, `POST /barracas/desasignar/:id`. Helper: `buildBarracaCuotaMap()` for planilla integration.
- **Assignment History:** Provides a detailed history of employee assignments, including titularships and daily coverage.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.