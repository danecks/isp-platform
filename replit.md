# Workspace

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
- **Admin Dashboard Modules:** Live dashboards, CRM, job application management, incident reporting, HR advance requests, employee management, and comprehensive payroll management.
- **Client Portal (`/portal/*`):** Secure interface for clients to view data and KPIs.
- **Operational Management:** Features like "Ficha de Cliente — Modelo Maestro Operativo", "Emergencias Restringidas", "Cierre Operativo Diario — en Pizarrón", "Centro de Operaciones — Pizarrón Operativo", "Tareas con Evidencia", "Reportería Profesional", and "Zonas Operativas Globales".
- **Integrations:** WhatsApp integration for processing messages and Trello integration for creating cards.
- **Advanced Modules:**
    - **Módulo Vehículos (VEH-01):** Full vehicle supervision.
    - **Módulo Armería (ARM-01/ARM-02):** Weapons control module.
    - **Multi-titular consolidation (PT-01):** Unified `puesto_titulares` table.
    - **Motor de Turnos Completo (T001-T007):** Rewritten shift engine.
    - **Solicitudes de Eliminación (DEL-01):** Admin page for deletion requests.
    - **Cancelación de Servicios Adicionales (SSA-CAN-01):** Workflow for cancelling additional services.
    - **Novedades RRHH — Flujo de Revisión Pendiente (NRRHH-01):** Workflow for HR review of daily absences and incidents.
    - **RRHH/Pizarrón/Planilla Integration (OPER-RRHH-01/02/03):** Full bidirectional traceability between operational board and HR, including overtime calculation and alerts.
    - **Flujo Operaciones → RRHH → Planilla (HE Validation):** Complete approval chain for overtime (HE) payments. RRHH event approval/rejection now propagates atomically to `novedades_nomina_diarias`: falta events → `falta=TRUE, impacto_nomina='aprobado_rrhh'`; suspensiones → `suspension=TRUE`; incapacidad → `impacto_nomina='aprobado_rrhh'`; HE → `horas_extra_estado='aprobado'`. Rejection reverses all fields. Fallback matching by `fecha+employee_id` handles legacy events without direct `evento_rrhh_id` links. Pre-planilla query uses both `impacto_nomina` and `horas_extra_estado` for accurate HE summation.
    - **Novedades Base para Titulares (Paso 4.5):** generarNovedades creates a base novedad for ALL active titulares on each closed day. Monthly contract = all days paid: descanso_ciclo gets `trabajo_dia=TRUE` with turno hours. Uses `ON CONFLICT DO UPDATE` to fix stale records. Paso 4.6 adjusts hours for rest-day coverage (base + HE). Paso 4.7 sets `dias_descuento` on faltas (3d for 24h turno, 2d for 12h turno).
    - **Pre-planilla dias_descuento:** Total estimado now uses `total_dias_descuento` (turn-based penalty days) instead of raw falta count for accurate deduction calculation. Cash HE (pagado_efectivo) excluded from planilla HE totals.
    - **Modo de Pago HE (ModalPagoHE):** Payment mode selector for overtime, either "En Planilla" or "En Efectivo".
    - **ModalSustitucion Redesign:** Two-section layout: Section A "¿Por qué sale el titular?" (MOTIVOS_SALIDA: falta_total, abandono_parcial, permiso_sin_goce, incapacidad, permiso_con_goce) and Section B "¿Cómo cubre el entrante?" (Relevo completo / Relevo parcial). Generates 2 RRHH events per substitution (saliente + entrante). Jornada auto-detection from hora_entrada/hora_salida. Partial coverage hours sent as structured fields to backend for accurate cobertura_segmentos.
    - **Eventos RRHH Pareados (evento_par_id):** Sustituciones generan dos eventos vinculados bidireccionales: falta del titular + HE del cubriente. Columna `evento_par_id` en `eventos_rrhh` enlaza ambos. Frontend los muestra agrupados en una tarjeta con header "Sustitución #N", lado izquierdo "TITULAR — Descuento" y derecho "CUBRIENTE — Horas Extra". Eventos anteriores sin par se muestran individuales.
    - **Falta Diferida (FALTA-DIF-01):** Clic directo en "Faltante" en el pizarrón NO genera evento de falta inmediato — solo marca el puesto como 'faltando' con metadata (falta_employee_id, falta_motivo, falta_notas, falta_usuario). El evento de falta se genera al CIERRE del pizarrón, solo si el puesto sigue sin cobertura. Si durante el día se hace una sustitución (drag-and-drop), la metadata se limpia y solo el par de eventos de la sustitución aplica. Anulación en cascada: anular falta anula HE del par; anular HE no toca la falta.
    - **Documentos RRHH por tipo:** Faltas/suspensiones → "Boleta de descuento" + "Acta administrativa". Horas extra → "Constancia de Horas Extra" (sin boleta ni acta). Cada tipo genera su PDF correspondiente con contenido legal apropiado.
    - **Integración Custodios ↔ Puestos (CUST-02):** Introduces `tipo_puesto` for 'custodia' positions.
    - **Módulo Prestaciones Laborales (PREST-01):** Comprehensive Guatemala labor benefits module. Confirmed liquidation auto-deactivates `puesto_titulares` and clears `puestos_operativos.titular_employee_id`, removes employee from pizarrón and generarNovedades. Pre-planilla excludes employees with confirmed liquidation (`NOT EXISTS prestaciones_liquidaciones WHERE estado='confirmada'`). Baja employee's last-period pay goes in liquidation cheque, not in planilla quincenal.
    - **Sistema de Dotación de Uniformes (UNIF-01):** Full uniform/boots deduction system.
    - **Plantilla de Turnos (TURNOS-01):** Weekly shift schedule grid per puesto.
    - **Rondas de Patrullaje + NFC Piloto:** GPS patrol route tracking with NFC checkpoint verification.
    - **Rondas QR (QR-RONDAS-01):** QR code-based patrol round system with GPS verification.
    - **Fichaje QR de Agentes + Dispositivos Autenticados (FICHAJE-QR-01 + SUPERVISOR-DEV-01):** QR credential system for guard attendance and supervisor inspection, trust based on pre-registered devices.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.