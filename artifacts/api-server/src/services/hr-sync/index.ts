/**
 * HR Sync Service — Integración futura con base SQL de Recursos Humanos
 *
 * ESTADO ACTUAL: Placeholder / No conectado
 *
 * Este módulo está preparado para sincronizar empleados desde una base SQL
 * externa de RH hacia la tabla `employees` de ISP, S.A.
 *
 * Cuando la base de RH esté disponible, solo es necesario:
 *   1. Implementar el adaptador en `adapters/hr-sql.adapter.ts`
 *   2. Configurar las variables de entorno (HR_DB_HOST, HR_DB_NAME, etc.)
 *   3. Activar el scheduler en este archivo
 *
 * Ver HR-SYNC-README.md para instrucciones completas.
 */

export type SyncSource = "hr_sql_external" | "api" | "manual";

export type SyncStatus = "manual" | "synced" | "pending" | "error";

/**
 * Representa un registro de empleado proveniente del sistema externo de RH.
 * Este es el contrato de datos que cualquier adaptador debe cumplir.
 */
export interface HREmployeeRecord {
  /** ID del empleado en el sistema de RH (llave de upsert) */
  externalId: string;
  /** Nombre del sistema de origen */
  sourceSystem: SyncSource;
  /** Datos del empleado */
  nombreCompleto: string;
  dpi?: string;
  telefono?: string;
  correo?: string;
  puesto?: string;
  area?: string;
  estadoLaboral: "activo" | "inactivo" | "licencia" | "suspendido" | "baja";
  sede?: string;
  supervisorNombre?: string;
  fechaIngreso?: Date;
}

/**
 * Resultado de una operación de sincronización.
 */
export interface SyncResult {
  source: SyncSource;
  startedAt: Date;
  finishedAt: Date;
  created: number;
  updated: number;
  errors: number;
  errorDetails: string[];
}

/**
 * Adaptador base que cualquier fuente de RH debe implementar.
 * Para integrar una nueva fuente, crear una clase que extienda este contrato.
 */
export interface IHRAdapter {
  /** Nombre identificador del adaptador */
  name: SyncSource;
  /** Verifica si la conexión con la fuente está disponible */
  healthCheck(): Promise<boolean>;
  /** Obtiene todos los registros de empleados de la fuente */
  fetchAll(): Promise<HREmployeeRecord[]>;
  /** Obtiene registros modificados desde una fecha (sync incremental) */
  fetchSince?(since: Date): Promise<HREmployeeRecord[]>;
}

/**
 * HRSyncService — Orquestador de sincronización
 *
 * PLACEHOLDER: La lógica de upsert contra la tabla `employees` se implementará
 * aquí cuando el adaptador de la fuente externa esté listo.
 *
 * Flujo de sync:
 *   1. adapter.healthCheck() → verifica conexión
 *   2. adapter.fetchAll() o fetchSince() → obtiene registros
 *   3. Para cada registro: upsert en employees usando (externalId, sourceSystem)
 *   4. Actualizar syncStatus='synced' y lastSyncAt=now() en los registros procesados
 *   5. Marcar como syncStatus='error' los que fallaron
 *   6. Retornar SyncResult con métricas
 */
export class HRSyncService {
  private adapters: Map<SyncSource, IHRAdapter> = new Map();

  registerAdapter(adapter: IHRAdapter): void {
    this.adapters.set(adapter.name, adapter);
    console.log(`[hr-sync] Adaptador registrado: ${adapter.name}`);
  }

  async sync(source: SyncSource): Promise<SyncResult> {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      throw new Error(`[hr-sync] Adaptador no registrado: ${source}`);
    }

    const startedAt = new Date();
    console.log(`[hr-sync] Iniciando sync desde: ${source}`);

    // TODO: Implementar cuando el adaptador de RH esté disponible
    // const records = await adapter.fetchAll();
    // for (const record of records) {
    //   await upsertEmployee(record); // → lib/db employeesTable
    // }

    console.warn(`[hr-sync] PLACEHOLDER: sync de ${source} aún no implementado`);
    console.warn(`[hr-sync] Ver artifacts/api-server/src/services/hr-sync/HR-SYNC-README.md`);

    return {
      source,
      startedAt,
      finishedAt: new Date(),
      created: 0,
      updated: 0,
      errors: 0,
      errorDetails: ["Adaptador no implementado — pendiente de integración con RH"],
    };
  }

  async healthCheck(source: SyncSource): Promise<boolean> {
    const adapter = this.adapters.get(source);
    if (!adapter) return false;
    return adapter.healthCheck();
  }
}

// Exportar instancia singleton
export const hrSyncService = new HRSyncService();
