# Workspace

## Overview
This project is a pnpm monorepo for "Investigaciones y Seguridad Profesional S.A." (Guatemala), providing a comprehensive digital platform with a corporate website and an admin dashboard. The platform aims to streamline internal operations, enhance client interaction, and establish a robust online presence.

Key capabilities include:
- **Comprehensive Admin Modules:** Covering Commercial (leads CRM), Recruitment (job applications), Incidents Management, HR Advances, HR Disciplinary KPI, Operational Rotation KPI, RRHH Automatic Alerts, CMS, Novedades Nómina, and Pre-Planilla Operativa.
- **Dynamic Roles & Permissions:** Configurable role-based access control managed from the Usuarios module. Roles, module permissions, and employee types are stored in the database (`system_roles`, `rol_permisos`, `tipos_personal_config`). Includes server-side route blocking middleware (403 if unauthorized module). Admin role always bypasses all restrictions.
- **Robust Authentication & RBAC:** Granular role-based access control for various user roles.
- **Client Portal:** Secure access for clients to view incidents and KPIs.
- **Trello Integration:** Seamless integration for Incidencias, Leads, and Postulaciones.
- **WhatsApp Integration:** Transforms WhatsApp messages into structured database records.
- **Lead and Applicant Conversion:** Facilitates conversion of leads to clients and applicants to employees.
- **Branding Consistency:** Centralized configuration for a uniform corporate identity.
- **Unified Operational Architecture:** Featuring a "Pizarrón Operativo" for daily operations, "Seguimiento SSA" for administrative tracking, and "Pipeline SSA" for commercial overview.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. Do not make changes to the `lib/api-spec` folder. Do not make changes to the `orval.config.ts` file.

## Critical Business Rules
- **Todo dato del formulario = dato en la ficha del empleado.** Cuando se crea un registro de empleado a partir de cualquier formulario (Kiosco, solicitud, etc.), TODOS los campos capturados en el formulario deben transferirse a la ficha del empleado. Si un campo del formulario no tiene columna correspondiente en `employees`, hay que agregar la columna. Nunca perder datos del formulario al contratar.
- **Reclutamiento Web (legacy) fue reemplazado por el sistema de Kiosco Solicitudes.** El módulo admin `/admin/reclutamiento` y su página fueron eliminados. El backend (`/api/applications`, tabla `applications`) se conserva por compatibilidad con WhatsApp. No recrear la pantalla de Reclutamiento Web.
- **Canal de origen (solicitudes_empleo.canal):** Valores válidos: `kiosco` (default), `externo`, `whatsapp`, `referido`. Las solicitudes externas muestran alerta ámbar en el modal con recordatorio de llamar al candidato para citarlo.
- **Flujo contratar:** El botón "Contratar" despliega un formulario inline en el modal (no un diálogo separado) con 3 campos: puesto a asignar, tipo de personal (guardia/supervisor/administrativo/motorista/recepcionista/tecnico), y salario (Q). El endpoint `/contratar` acepta `puesto_asignado`, `tipo_personal`, `sueldo_base` en el body.

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
    - **RRHH/Pizarrón/Planilla Integration (OPER-RRHH-01/02/03):** Full bidirectional traceability between the operational board and HR. When a `ausencia_sin_cubrir` is registered in the pizarrón, the system auto-detects active events (vacaciones/incapacidad/suspension) and, if none found, generates an `rrhh_alertas` entry of type `faltante_sin_cubrir`. When a relevo is assigned, the alert auto-resolves and `cubriendo_a_employee_id` is saved for bidirectional traceability. If the relevo generates overtime hours, a `horas_extra_pendiente` alert is created. Discount calculation: 2x if 1 titular (12h post), 3x if 2 titulares (24h post). New columns: `cobertura_segmentos.cubriendo_a_employee_id`, `novedades_nomina_diarias.dias_descuento/horas_extra_estado/horas_extra_aprobadas_por/at`, `rrhh_alertas.puesto_id/puesto_nombre/fecha_evento/cubierto_por_*`. New RRHH UI tab "Alertas Pizarrón" with faltante queue, HE approval queue (aprobar/rechazar), and per-employee KPI panel with Art.77 GT semaphore (🟢🟡🔴 — 2 consecutive absent days or 3+ absences in month). Batch actas printing panel with date range + tipo filter. Pre-planilla annex now shows `horas_extra_estado` badge (Aprobado/Pendiente/Rechazado) and `dias_descuento` multiplier (2x/3x) in the faltas table.
    - **Integración Custodios ↔ Puestos (CUST-02):** Introduces `tipo_puesto` for 'custodia' positions with a dedicated dashboard.
    - **Módulo Prestaciones Laborales (PREST-01):** Comprehensive Guatemala labor benefits module including aguinaldo, bono14, vacations, indemnification, and provisions with a dedicated calculation library and API.
    - **Sistema de Dotación de Uniformes (UNIF-01):** Full uniform/boots deduction system. Clients can be configured with a uniform quota (N uniforms every X months) for their titular agents. Deliveries are registered in Bodega with installment cuotas (1–N). Cuotas automatically deduct from planilla (same pattern as anticipos). Unpaid balance at termination deducts from liquidación as a negative rubro. Tables: `entregas_uniforme`, `entregas_uniforme_cuotas`. New planilla_lineas columns: `descuentos_uniforme`, `uniforme_cuota_ids`. New client columns: `dotacion_uniforme_num`, `dotacion_uniforme_frecuencia_meses`.
    - **Plantilla de Turnos (TURNOS-01):** Weekly shift schedule grid per puesto. Table `puesto_slots` (puesto_id FK, slot_numero, horas_turno 12|24, hora_entrada, dias_trabajo int[] 1=Lun–7=Dom, empleado_id FK, notas, activo). Operative purpose: days marked = agent works; unmarked days = agent rests = available for overtime/coverage. UI: new "Plantilla de Turnos" tab in FichaCliente with interactive 7-day grid (click cell = toggle work/rest, auto-saves). Modal "Nuevo slot" with puesto select, 12h/24h toggle, time input, employee search, day picker. API: GET/POST/PUT/DELETE `/api/puestos/:id/slots`, GET `/api/clientes/:id/slots`, GET `/api/operaciones/disponibles-cobertura` (agents resting today).
    - **Rondas de Patrullaje + NFC Piloto:** GPS patrol route tracking with NFC checkpoint verification. Tables: `nfc_devices`, `nfc_tags`, `nfc_shift_events`, `nfc_supervisor_forms`, `nfc_supervisor_form_items`, `nfc_audit_log`, `nfc_sandbox_schedules`, `nfc_ronda_puntos`, `nfc_ronda_eventos`. Public kiosk endpoint at `/kiosko`. Full admin UI in NfcPiloto.tsx.
    - **Rondas QR (QR-RONDAS-01):** QR code-based patrol round system as alternative to NFC. Guards scan printed QR codes with phone camera; system verifies GPS proximity at server side. Tables: `qr_rondas` (round definitions with client assignment), `qr_ronda_puntos` (checkpoints with lat/lng ref, configurable radius in meters, unique UUID token embedded in QR), `qr_ronda_eventos` (scan logs with GPS, distance, result: ok|fuera_de_rango|sin_gps). Admin UI: RondasQR.tsx at `/admin/rondas-qr` — interactive Leaflet/OpenStreetMap map for placing checkpoints, per-point QR generation, printable QR cards, scan history report. Guard page: RondaGuardia.tsx at `/ronda?token=<uuid>` — phone opens this URL after scanning QR, auto-captures GPS, submits scan, shows result. API: GET/POST/PUT/DELETE `/api/qr-rondas`, POST `/api/qr-rondas/:id/puntos`, GET `/api/qr-rondas/scan/:token`, POST `/api/qr-rondas/scan`, GET `/api/qr-rondas/:id/eventos`. Dependencies added: `leaflet`, `@types/leaflet`, `react-leaflet`, `qrcode.react` (frontend); `uuid`, `@types/uuid` (API server).
    - **Fichaje QR de Agentes + Dispositivos Autenticados (FICHAJE-QR-01 + SUPERVISOR-DEV-01):** QR credential system for guard attendance and supervisor inspection. Each guard has a unique UUID token on their credential card (printable). Scanning the QR opens `/agente?token=<uuid>`. Trust is **device-based** — only pre-registered phones can perform any action. Tables: `agente_qr_tokens` (UUID token per employee, one active per person), `puestos_gps` (GPS lat/lng + radius per puesto_operativo), `agente_fichajes` (unified log with supervisor_device_id FK), `supervisor_devices` (registered phones with tipo='puesto'|'supervisor', device_uuid, device_token_hash SHA-256, puesto_id FK optional, activo). Device types: `puesto` → fichaje (attendance) mode, must be at specific post phone; `supervisor` → supervision form mode (checklist, star rating, observations). **Auth flow:** On load, page checks localStorage for `isp_device={uuid,token}`, calls POST `/api/supervisor-devices/validate` → routes to correct mode or shows "dispositivo no autorizado". **Activation:** Admin registers device → one-time token shown as QR (`/supervisor/activar?uuid=...&token=...`) → phone opens URL, token saved to localStorage. **Admin UI (FichajeQR.tsx, 3 tabs):** (1) Credenciales: generate/revoke QR tokens, print credential cards; (2) Dispositivos: register/revoke post phones and supervisor phones, show activation QR; (3) Historial: fichaje/supervision log with filter. **Public pages:** AgenteEscaneo.tsx (`/agente?token=<uuid>`), SupervisorActivar.tsx (`/supervisor/activar?uuid=...&token=...`). **API:** POST `/supervisor-devices/validate` (public), GET/POST/DELETE `/supervisor-devices` (admin, fichaje_qr module), GET `/agente/scan/:token` (public), POST `/agente/fichaje` (requires puesto device), POST `/api/agente/supervision` (requires supervisor device), GET `/api/agente/tokens`, POST `/api/agente/tokens/generate`, DELETE `/api/agente/tokens/:id`, GET `/api/agente/fichajes`, GET/PUT `/api/puestos-gps`. Permissions module: `fichaje_qr` (roles: admin, operaciones, supervisor).

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.