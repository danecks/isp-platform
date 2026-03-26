# HR Sync — Integración con Base SQL de Recursos Humanos

## Estado actual: PREPARADO / No conectado

Este servicio está listo para conectarse a la base SQL de Recursos Humanos cuando
esté disponible. No requiere cambios de schema ni migración en ese momento.

---

## Arquitectura de entidades

```
┌─────────────────────────────────────────────────────────────────┐
│  BASE SQL RH (externa, futura)    │   Sistema ISP, S.A. (este)  │
│  ─────────────────────────────    │   ─────────────────────────  │
│  tabla: colaboradores             │   tabla: employees            │
│  - id_colaborador (PK)            │   - externalId  ←────────── │ ← sync
│  - nombre                         │   - sourceSystem = 'hr_sql'  │
│  - dpi                            │   - syncStatus               │
│  - cargo                          │   - lastSyncAt               │
│  - departamento                   │   - nombreCompleto           │
│  - estado_laboral                 │   - estadoLaboral            │
│  ...                              │   - ...                      │
└───────────────────────────────────┴──────────────────────────────┘
         │                                        │
         │ futura sync (hr-sync service)          │ vínculo optional
         └────────────────────────────────────────┘
                                                  │
                                            tabla: users
                                            - employeeId (nullable)
                                            - username
                                            - rol
                                            - passwordHash
```

### Diferencia entre entidades

| | `employees` | `users` | `leads` |
|---|---|---|---|
| **Qué es** | Colaborador/empleado de ISP | Cuenta de acceso al sistema | Empresa cliente potencial |
| **Origen** | RH interno / manual | Admin del sistema | Formulario web / WhatsApp |
| **Quién lo crea** | RH (sync) o admin | Admin del sistema | Automático |
| **Relación** | Puede tener una cuenta de usuario | Puede estar vinculado a un empleado | Sin vínculo interno |
| **Login** | No aplica | Sí (usuario + contraseña) | No aplica |

---

## Cómo conectar la base de RH cuando esté disponible

### Paso 1 — Variables de entorno

Agregar al archivo `.env` o secrets de Replit:

```env
HR_DB_HOST=servidor.rh.isp.gt
HR_DB_PORT=1433
HR_DB_NAME=RecursosHumanos
HR_DB_USER=isp_readonly
HR_DB_PASSWORD=xxxxx
HR_DB_TYPE=mssql   # o 'postgres' según el motor
```

### Paso 2 — Implementar el adaptador SQL

Crear `artifacts/api-server/src/services/hr-sync/adapters/hr-sql.adapter.ts`:

```typescript
import { IHRAdapter, HREmployeeRecord } from "../index";
import sql from "mssql"; // o pg según el motor de RH

export class HRSqlAdapter implements IHRAdapter {
  name = "hr_sql_external" as const;

  async healthCheck(): Promise<boolean> {
    try {
      // const pool = await sql.connect({ ... });
      // await pool.request().query("SELECT 1");
      return true;
    } catch { return false; }
  }

  async fetchAll(): Promise<HREmployeeRecord[]> {
    // const pool = await sql.connect({ ... });
    // const result = await pool.request().query(`
    //   SELECT
    //     id_colaborador AS externalId,
    //     nombre_completo AS nombreCompleto,
    //     dpi,
    //     telefono,
    //     correo_institucional AS correo,
    //     cargo AS puesto,
    //     departamento AS area,
    //     estado AS estadoLaboral,
    //     sede,
    //     nombre_supervisor AS supervisorNombre,
    //     fecha_ingreso AS fechaIngreso
    //   FROM COLABORADORES
    //   WHERE estado != 'ELIMINADO'
    // `);
    // return result.recordset.map(row => ({
    //   ...row,
    //   sourceSystem: "hr_sql_external",
    //   estadoLaboral: mapEstado(row.estadoLaboral),
    //   fechaIngreso: row.fechaIngreso ? new Date(row.fechaIngreso) : undefined,
    // }));
    return [];
  }

  async fetchSince(since: Date): Promise<HREmployeeRecord[]> {
    // Sync incremental: solo registros modificados desde `since`
    // WHERE fecha_modificacion > @since
    return [];
  }
}
```

### Paso 3 — Registrar el adaptador en el servicio

En `artifacts/api-server/src/services/hr-sync/index.ts`, activar:

```typescript
import { HRSqlAdapter } from "./adapters/hr-sql.adapter";

const adapter = new HRSqlAdapter();
hrSyncService.registerAdapter(adapter);
```

### Paso 4 — Activar el endpoint de sync

Agregar en `artifacts/api-server/src/routes/employees.ts`:

```typescript
// POST /api/employees/sync — ejecutar sync manual
employeesRouter.post("/employees/sync", async (req, res) => {
  const { source = "hr_sql_external" } = req.body;
  try {
    const result = await hrSyncService.sync(source);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

### Paso 5 — (Opcional) Scheduler automático

Para sync automático cada X horas, agregar en `artifacts/api-server/src/app.ts`:

```typescript
import { CronJob } from "cron";
import { hrSyncService } from "./services/hr-sync";

// Sync diario a las 03:00 AM
new CronJob("0 3 * * *", async () => {
  console.log("[cron] Iniciando sync diario de RH...");
  await hrSyncService.sync("hr_sql_external");
}, null, true);
```

---

## Lógica de upsert (sin romper datos actuales)

La sincronización usa `(externalId, sourceSystem)` como llave única, NO el `id`
interno. Esto garantiza que el sistema ISP puede seguir creando registros manuales
(externalId=null) sin conflictos con los registros de RH.

```typescript
async function upsertEmployee(record: HREmployeeRecord): Promise<void> {
  const existing = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(
      and(
        eq(employeesTable.externalId, record.externalId),
        eq(employeesTable.sourceSystem, record.sourceSystem)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // UPDATE — empleado ya existe, actualizar datos
    await db
      .update(employeesTable)
      .set({ ...record, syncStatus: "synced", lastSyncAt: new Date() })
      .where(eq(employeesTable.id, existing[0].id));
  } else {
    // INSERT — empleado nuevo en el sistema
    await db.insert(employeesTable).values({
      ...record,
      syncStatus: "synced",
      lastSyncAt: new Date(),
    });
  }
}
```

---

## Campos de integración en `employees`

| Campo | Tipo | Propósito |
|---|---|---|
| `externalId` | varchar, nullable | ID del empleado en la fuente externa |
| `sourceSystem` | varchar | Origen del registro: `manual`, `hr_sql_external`, `api` |
| `syncStatus` | varchar | Estado: `manual`, `synced`, `pending`, `error` |
| `lastSyncAt` | timestamp, nullable | Última vez que se sincronizó este registro |

## Vínculo `users.employeeId`

Si un colaborador tiene cuenta de sistema:
```sql
UPDATE users SET employee_id = 3 WHERE username = 'ops01';
```
O via API:
```http
PATCH /api/users/3
{ "employeeId": 15 }
```

La relación es **opcional y no-destructiva**: los usuarios sin empleado vinculado
(clientes, externos) no se ven afectados.

---

## Endpoints disponibles ahora

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/employees` | Lista todos los empleados (filtros: syncStatus, estadoLaboral, area, sourceSystem) |
| GET | `/api/employees/:id` | Empleado por ID |
| POST | `/api/employees` | Crear empleado manualmente |
| PATCH | `/api/employees/:id` | Actualizar datos de empleado |
| GET | `/api/employees/sync/status` | Resumen de estado de sincronización |
