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
    - **Pre-planilla dias_descuento:** Total estimado now uses `total_dias_descuento` (turn-based penalty days) instead of raw falta count for accurate deduction calculation. Cash HE (pagado_efectivo) excluded from planilla HE totals. Pre-planilla now shows dual totals: "Total Real" (based on `dias_cerrados` actually processed) in emerald green and "Total Estimado" (projected to full period) in primary blue. `dias_cerrados` field added to consolidado query. CSV export includes dias_cerrados and total_dias_descuento columns. Step 2 (ausencias) DO UPDATE now preserves approved falta/suspension rows (P-NOM-04 fix extended). Suspensions correctly added to `total_dias_descuento` in deduction calc.
    - **Modo de Pago HE (ModalPagoHE):** Payment mode selector for overtime, either "En Planilla" or "En Efectivo".
    - **ModalSustitucion Redesign:** Two-section layout: Section A "¿Por qué sale el titular?" (MOTIVOS_SALIDA: falta_total, abandono_parcial, permiso_sin_goce, incapacidad, permiso_con_goce) and Section B "¿Cómo cubre el entrante?" (Relevo completo / Relevo parcial). Generates 2 RRHH events per substitution (saliente + entrante). Jornada auto-detection from hora_entrada/hora_salida. Partial coverage hours sent as structured fields to backend for accurate cobertura_segmentos.
    - **Eventos RRHH Pareados (evento_par_id):** Sustituciones generan dos eventos vinculados bidireccionales: falta del titular + HE del cubriente. Columna `evento_par_id` en `eventos_rrhh` enlaza ambos. Frontend los muestra agrupados en una tarjeta con header "Sustitución #N", lado izquierdo "TITULAR — Descuento" y derecho "CUBRIENTE — Horas Extra". Eventos anteriores sin par se muestran individuales.
    - **Falta Diferida (FALTA-DIF-01):** Clic directo en "Faltante" en el pizarrón NO genera evento de falta inmediato — solo marca el puesto como 'faltando' con metadata (falta_employee_id, falta_motivo, falta_notas, falta_usuario). El evento de falta se genera al CIERRE del pizarrón, solo si el puesto sigue sin cobertura. Si durante el día se hace una sustitución (drag-and-drop), la metadata se limpia y solo el par de eventos de la sustitución aplica. Anulación en cascada: anular falta anula HE del par; anular HE no toca la falta.
    - **Novedad Saliente Inmediata (A-04 saliente):** Al ejecutar una sustitución tipo relevo, el endpoint `sustituir` ahora crea inmediatamente la novedad de falta/ausencia del titular saliente en `novedades_nomina_diarias` (trabajo_dia=FALSE, falta=TRUE, dias_descuento según turno). Esto elimina la dependencia de que generarNovedades encuentre el evento RRHH al momento del cierre. ON CONFLICT respeta decisiones ya aprobadas por RRHH. Reglas de descuento: >=24h → 3d, >=12h → 2d, <12h → 1d. Suspensiones (incluye legacy 'suspension') se marcan correctamente.
    - **Documentos RRHH por tipo:** Faltas/suspensiones → "Boleta de descuento" + "Acta administrativa". Horas extra → "Constancia de Horas Extra" (sin boleta ni acta). Cada tipo genera su PDF correspondiente con contenido legal apropiado.
    - **Sistema de Actas Disciplinarias (ACTAS-01/02/03):** Complete disciplinary workflow: `config_empresa` table (representante legal, DPI, dirección, umbrales), correlative acta numbering, 10 predefined `CAUSALES_ACTA` mapped to Guatemala Código de Trabajo articles (Art. 77 incisos a-f). PDF generation in oficio format for both Acta Administrativa and Aviso al Inspector de Trabajo. Causal selector modal (`ModalCausalesActa`) opens before PDF download — pre-selects relevant causals based on event type. `ActaDesdeKPI` component in employee ficha KPI tab triggers acta generation when disciplinary score < 70. `TabIndemnizacion` has "Generar Aviso al Inspector" button. `ModalBajaEmpleado` fetches `/evaluar-causa-justa` on open to suggest cause type with evidence. Supervisor QR form (`AgenteEscaneo.tsx`) includes disciplinary action selector that auto-creates RRHH events. `ModalConfigEmpresa` in RRHHEventos settings gear for company data management.
    - **Integración Custodios ↔ Puestos (CUST-02):** Introduces `tipo_puesto` for 'custodia' positions.
    - **Módulo Prestaciones Laborales (PREST-01):** Comprehensive Guatemala labor benefits module. Confirmed liquidation auto-deactivates `puesto_titulares` and clears `puestos_operativos.titular_employee_id`, removes employee from pizarrón and generarNovedades. Pre-planilla excludes employees with confirmed liquidation (`NOT EXISTS prestaciones_liquidaciones WHERE estado='confirmada'`). Baja employee's last-period pay goes in liquidation cheque, not in planilla quincenal. **Período de prueba (PRUEBA-01):** `fecha_inicio_prestaciones` column in employees — set to `fecha_ingreso + 2 months` for new hires. During probation, employees receive salary but do NOT accrue prestaciones (aguinaldo, bono14, vacaciones, indemnización) and are excluded from IGSS payroll. All prestaciones calculations use `COALESCE(fecha_inicio_prestaciones, fecha_ingreso)` — existing employees (NULL) keep their original fecha_ingreso behavior unchanged.
    - **Sistema de Dotación de Uniformes (UNIF-01):** Full uniform/boots deduction system.
    - **Plantilla de Turnos (TURNOS-01):** Weekly shift schedule grid per puesto. `puesto_slots.dias_trabajo` is the sole source of truth for work/rest classification in the pool. `slot_trabaja_hoy` overrides `calcularEstadoCiclo` for agents with active slots. Drop on empty slot with vacant plantilla slot auto-assigns agent as titular without turno selection dialog. Slot assignment is atomic (single UPDATE...WHERE empleado_id IS NULL RETURNING). Auto-assign only fires when puesto has no existing titular (`!titular_employee_id`); otherwise the cobertura/titular selection modal appears. **dias_medio_turno (T/2):** 3-state toggle per day in plantilla grid: D (descansa) → T (turno completo) → T/2 (medio turno, 12h even if base is 24h) → D. Column `puesto_slots.dias_medio_turno integer[] DEFAULT '{}'` stores days with half-shift. A day in both `dias_trabajo` AND `dias_medio_turno` = half-shift. Amber color (½) in UI. Affects Operaciones ModalConfigTurno, FichaCliente PuestoSlotsInline, and TabPlantillaTurnos.
    - **Rondas de Patrullaje + NFC Piloto:** GPS patrol route tracking with NFC checkpoint verification.
    - **Rondas QR (QR-RONDAS-01):** QR code-based patrol round system with GPS verification.
    - **ISR Quincenal (ISR-01):** ISR calculated on projected annual salary (sueldo_base × 12), minus IGSS anual (4.83% only if aplica_igss=true), minus Q48,000 personal deduction. Progressive: 5% ≤ Q300K, 7% above. Divided by 24 = fixed quincenal retention. ISR is a fixed amount per quincena (does NOT vary with faltas/HE of specific period). ISR column added to planilla_lineas + planillas tables, displayed in Planilla.tsx table and CSV export. calcularISRQuincenal() shared in nomina-calc.ts (backend) and PrePlanilla.tsx (frontend). Non-IGSS employees correctly skip IGSS deduction in ISR base calculation.
    - **Planilla IGSS TXT (IGSS-TXT-01):** Full IGSS payroll file generation in v2.2.0 format. Generates pipe-delimited TXT file for upload to IGSS portal. Endpoint: `GET /api/igss/generar-planilla?mes=N&anio=N[&preview=true]`. Preview mode returns JSON with totals, employee details, and center breakdown. Download mode returns the TXT file. Format: Registro tipo 1 (header per liquidation/centro) + Registro tipo 2 (per employee). Fields: afiliación, apellidos/nombres split, días trabajados (30), salario mensual, salario diario, tipo contrato (C/P), circunscripción económica (CE1=Guatemala/CE2=resto). Cuotas: laboral 4.83%, patronal 12.67%. Frontend panel in IGSS.tsx with month/year selector, preview with KPI cards + employee table, and download button.
    - **Fichaje QR de Agentes + Dispositivos Autenticados (FICHAJE-QR-01 + SUPERVISOR-DEV-01):** QR credential system for guard attendance and supervisor inspection, trust based on pre-registered devices.
    - **Pizarrón — Cambio de Titularidad vs Falta (PIZARRON-FIX-01):** When dropping an available agent onto a puesto that has existing titulares (in puesto_titulares), the system always shows the modal asking "Cambio de titularidad" vs "Sustitución por falta". Auto-assign only fires for truly empty puestos (no titulares at all). HE logic fixed: horas extra only generate when covering agent is on their rest day (cycle-based via puesto_slots/puesto_titulares) or on vacation (via eventos_rrhh). Disponibles without puesto assignment do NOT generate HE — they're just working a normal day. `fue_en_dia_descanso` in `cobertura_segmentos` now reflects actual agent state instead of hardcoded FALSE.
    - **Módulo Custodias v2 (CUST-03):** Custodia clients now appear directly in the pizarrón operativo alongside vigilancia clients. `tipo_servicio` selector in FichaCliente (vigilancia/custodia/mixto). Custodia clients show a truck icon (🚛) in the pizarrón header. Dynamic custodia slots are generated per day based on `custodia_fuerza_semanal` (day 0=Sun..6=Sat → agent count). Slots appear as "Custodio 1", "Custodio 2", etc. with drag-and-drop assignment from pool — same UX as regular puestos. Assignment creates records in `custodia_asignacion_diaria` (with `slot_numero`). Mixto clients show both regular puestos (shield) and custodia slots (truck). Backend: `POST /api/operaciones/asignar-custodia` endpoint. Module `/admin/custodias` serves as consultation/history + fuerza semanal config + hoja imprimible (Marca, Serie, Nombre, Munición pre-filled; Código/No blank for client).
    - **Historial de Asignaciones (HIST-ASIG-01):** New "Historial" tab in employee FichaModal showing complete assignment history. Backend endpoint `GET /api/employees/:id/historial-asignaciones?desde=&hasta=` combines `cobertura_segmentos` (daily coverage logs), `puesto_titular_historico` (previous titularships), and `puesto_titulares` (current active). Frontend tab with date range filter (default last 30 days), current titular card, titularidad timeline, and grouped coverage entries by date with HE/rest-day badges. Color-coded coverage types (relevo, titular, cob. supervisor, cob. jefe servicio).
    - **Pool Segmentation (POOL-SEG-01):** Pool panel now split into clear categories: "Disponibles" (genuinely free agents), "Disp. cubriendo" (disponibles with active cobertura_segmentos today), "Desc/Vac cubriendo" (descanseros + vacacionistas with active coverage today — generates HE). Backend returns `disponiblesCubriendo` and `vacacionistasCubriendo` arrays split from `disponibles` and `enVacaciones` based on `cs_trabajando_hoy`. Frontend tabs reorganized with visual separators between groups. Collapsed header shows key counts. Covering tabs are read-only (disabled drag).
    - **Módulo Rentabilidad por Puesto (RENT-01):** Per-client profitability analysis. `GET /api/clientes/:id/rentabilidad` calculates: IVA (12%) + ISR servicios (5%) over gross tariff, operational costs (sueldos + IGSS patronal 12.67% + prestaciones 41.83% + bonificación + HE últimos 30 días), net margin. Tab "Rentabilidad" in FichaCliente.tsx with income cascade, expandable per-puesto breakdown, and baja panel (con/sin indemnización). `GET /api/rentabilidad/global` returns all-client summary for Comercial page. Comercial.tsx has two tabs: "Pipeline de Leads" and "Rentabilidad por Cliente" with KPI cards, risk alert for negative margins, and sortable client table with margin percentages.

## External Dependencies
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Object-relational mapping.
- **Orval:** API client and Zod schema generation.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** Styling framework.
- **shadcn/ui:** UI component library.
- **Meta Cloud API:** For WhatsApp integration.
- **Trello:** Task management platform.