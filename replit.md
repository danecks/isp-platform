# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

---

## ISP S.A. — Corporate Website & Admin Dashboard

### Overview
Full corporate site for "Investigaciones y Seguridad Profesional S.A." (Guatemala). Premium dark navy/gold design. All text in corporate Spanish.

### Artifacts
- `artifacts/isp-web` — React + Vite + Tailwind + shadcn/ui SPA (public site + admin dashboard)
- `artifacts/api-server` — Express 5 REST API on port 8080, served at `/api`

### Authentication
- Hardcoded credentials: `dan2336` / `1234` (in `src/contexts/AuthContext.tsx`)
- Session stored in `sessionStorage` — clears on window close
- All `/admin/*` routes protected by `AuthGuard` component
- Login page: `/admin/login`

### Database Tables (PostgreSQL via Drizzle ORM)
Schema: `lib/db/src/schema/isp.ts`

| Table | Primary Key | Key Fields |
|-------|-------------|-----------|
| `leads` | `serial id` | empresa, contacto, servicio, canal, estado, ejecutivo |
| `applications` | `serial id` | nombre, telefono, puesto, canal, estado |
| `incidents` | `varchar id` (INC-YYMMDD-XXXX) | cliente, tipo, origen, prioridad, estado, responsable, descripcion |

Seed data: `artifacts/api-server/src/seed.ts` — run with `cd artifacts/api-server && pnpm exec tsx src/seed.ts`

### API Endpoints (`/api`)
- `GET /leads` — all leads ordered by createdAt desc
- `POST /leads` — create lead (required: empresa, contacto, servicio)
- `PATCH /leads/:id` — update lead fields
- `GET /applications` — all applications
- `POST /applications` — create application (required: nombre, telefono)
- `PATCH /applications/:id` — update application fields
- `GET /incidents` — all incidents ordered by fecha desc
- `GET /incidents/count` — count of active incidents (abierta + en_proceso)
- `GET /incidents/:id` — single incident detail
- `POST /incidents` — create incident (required: cliente, tipo; auto-generates ID)
- `PATCH /incidents/:id` — update: estado, prioridad, responsable, notas, tareaAsociada

### Admin Modules with Real Database Data
- **Dashboard** — reads live counts from leads, applications, incidents
- **Comercial** (`/admin/comercial`) — manages leads (CRM pipeline)
- **Reclutamiento** (`/admin/reclutamiento`) — manages job applications
- **Incidencias** (`/admin/incidencias`) — full operational module:
  - Table with all incidents, filterable by estado + prioridad + origen
  - Stat cards (clickable to filter by estado)
  - "Nueva Incidencia" modal: creates incident with validation
  - Edit modal (click any row): edit estado, prioridad, responsable, notas
  - React Query refetchInterval: 15s
  - Modals use `createPortal` to avoid React DOM tree conflicts

### Módulo Employees — Colaboradores / Futura integración RH

**Tabla DB**: `employees` (9 registros de ejemplo sembrados)

**Campos de integración (preparados para sync con SQL externo de RH)**:
- `externalId` — ID del empleado en la base de RH externa
- `sourceSystem` — Origen: `manual` | `hr_sql_external` | `api`
- `syncStatus` — Estado: `manual` | `synced` | `pending` | `error`
- `lastSyncAt` — Timestamp de última sincronización exitosa

**Vínculo users ↔ employees**: `users.employeeId` nullable integer. Sin FK hard en DB para máxima flexibilidad. 4 usuarios vinculados: ops01, supervisor01, rrhh01, comercial01.

**Endpoints disponibles (`/api/employees`)**:
- `GET /employees` — lista (filtros: `?syncStatus=`, `?estadoLaboral=`, `?area=`, `?sourceSystem=`)
- `GET /employees/:id` — empleado individual
- `POST /employees` — crear manualmente
- `PATCH /employees/:id` — actualizar
- `GET /employees/sync/status` — resumen de estado de sincronización

**Servicio HR Sync (placeholder)**: `artifacts/api-server/src/services/hr-sync/`
- `index.ts` — interfaces `IHRAdapter`, `HRSyncService`, tipos `SyncSource`, `SyncResult`
- `HR-SYNC-README.md` — instrucciones completas de integración futura con base SQL de RH

**Seed de empleados**: `artifacts/api-server/src/seed-employees.ts`

**Para conectar la base de RH cuando esté disponible**:
1. Configurar env vars `HR_DB_HOST`, `HR_DB_NAME`, etc.
2. Implementar `adapters/hr-sql.adapter.ts` con la clase `HRSqlAdapter`
3. Registrar adaptador en `hrSyncService.registerAdapter(new HRSqlAdapter())`
4. El upsert usa `(externalId, sourceSystem)` como llave — no rompe datos manuales existentes

### Modules with Mock Data (not yet connected to DB)
- Tareas, KPI, Custodias, Clientes

### Auth & RBAC System (Real DB)
The authentication system uses a real PostgreSQL `users` table with bcrypt-hashed passwords.

**Login flow**: POST `/api/auth/login` → validates username/password against DB → returns user object (no hash) → stored in `sessionStorage` key `isp_admin_session_v2`

**Roles**: `admin` | `operaciones` | `rrhh` | `comercial` | `supervisor` | `cliente`

**Role permissions** (see `artifacts/isp-web/src/config/permissions.ts`):
| Módulo | admin | operaciones | rrhh | comercial | supervisor |
|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Incidencias | ✓ | ✓ | — | — | ✓ |
| Custodias | ✓ | ✓ | — | — | ✓ |
| Reclutamiento | ✓ | — | ✓ | — | — |
| Comercial | ✓ | — | — | ✓ | — |
| Tareas | ✓ | ✓ | — | — | ✓ |
| KPI | ✓ | — | — | — | — |
| Clientes | ✓ | ✓ | — | ✓ | — |
| Usuarios | ✓ | — | — | — | — |

**Seed users** (run `cd artifacts/api-server && pnpm exec tsx src/seed-users.ts`):
- `dan2336` / `1234` → admin
- `admin` / `Admin2024!` → admin
- `ops01` / `Ops2024!` → operaciones
- `rrhh01` / `RRHH2024!` → rrhh
- `comercial01` / `Comercial2024!` → comercial
- `supervisor01` / `Supervisor2024!` → supervisor
- `cliente01` / `Cliente2024!` → cliente

**Key files**:
- `lib/db/src/schema/isp.ts` → `usersTable` schema
- `artifacts/api-server/src/routes/users.ts` → Auth login + Users CRUD API
- `artifacts/isp-web/src/config/permissions.ts` → Role definitions + nav filter
- `artifacts/isp-web/src/contexts/AuthContext.tsx` → Real API auth, stores `AuthUser` object
- `artifacts/isp-web/src/components/AuthGuard.tsx` → Route protection by role
- `artifacts/isp-web/src/admin/pages/Usuarios.tsx` → Full CRUD page (list, create, edit, toggle)

**Admin Users API** (`/api`):
- `POST /auth/login` — authenticate (returns user without passwordHash)
- `GET /users` — list all users (no password)
- `POST /users` — create user (requires nombre, username, password)
- `PATCH /users/:id` — update fields or reset password
- `GET /users/:id` — single user

**Future portal clientes**: The `cliente` role and `clienteId` field are in place. A `/cliente` portal can use the same login API and check `rol === 'cliente'` to show client-specific views.

### Branding Config (Central Source of Truth)
- `artifacts/isp-web/src/config/branding.ts` — exports `brand` object with `legalName`, `shortName` ("ISP, S.A."), `acronym`, `taglineShort`, `systemName`, `copyright(year)`.
- All layouts (Navbar, Footer, AdminSidebar, AdminTopbar, Login) import from this file.
- Rule: use `brand.shortName` for UI headers, `brand.legalName` for legal/formal text.

### Key Files
- `artifacts/isp-web/src/lib/api.ts` — API client (all endpoints + TypeScript interfaces)
- `artifacts/isp-web/src/contexts/AuthContext.tsx` — auth state + credentials
- `artifacts/isp-web/src/admin/components/NuevaIncidenciaModal.tsx` — create incident modal
- `artifacts/isp-web/src/admin/components/EditarIncidenciaModal.tsx` — edit incident modal
- `artifacts/isp-web/src/admin/components/StatusBadge.tsx` — badge for all status/origin/priority values
- `artifacts/api-server/src/routes/incidents.ts` — full incident CRUD

### WhatsApp Integration (Future)
Incidents with `origen: "whatsapp"` will be created automatically when the WhatsApp channel is connected. The PATCH endpoint and edit modal are ready to handle them the same as manual incidents. No code changes needed in the modal or table — just the webhook that calls `POST /api/incidents` with `origen: "whatsapp"`.
