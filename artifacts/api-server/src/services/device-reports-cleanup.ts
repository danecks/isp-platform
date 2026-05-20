/**
 * DEVICE REPORTS CLEANUP — TASK #101
 *
 * Job programado que borra filas de `device_reports` cuyo `last_seen_at` sea
 * más viejo que `DEVICE_REPORTS_RETENTION_DAYS` (default 90 días). Sin esto la
 * tabla crece sin límite: empleados que se fueron, celulares perdidos, sesiones
 * de prueba… todos quedan ensuciando el filtro de "desactualizados" del panel
 * admin.
 *
 * Cada corrida se registra en `device_reports_cleanup` para que el panel
 * pueda mostrar cuántos dispositivos se purgaron y cuándo fue el último
 * cleanup, sin tener que mirar logs.
 */
import {
  db,
  deviceReportsTable,
  deviceReportsCleanupTable,
} from "@workspace/db";
import { lt, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const DEFAULT_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 día

export function getRetentionDays(): number {
  const raw = process.env["DEVICE_REPORTS_RETENTION_DAYS"];
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_RETENTION_DAYS;
}

export async function cleanupOldDeviceReports(): Promise<{
  purgedCount: number;
  cutoffDays: number;
}> {
  const cutoffDays = getRetentionDays();
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(deviceReportsTable)
    .where(lt(deviceReportsTable.lastSeenAt, cutoff))
    .returning({ id: deviceReportsTable.id });

  const purgedCount = deleted.length;

  await db.insert(deviceReportsCleanupTable).values({
    purgedCount,
    cutoffDays,
  });

  // Retener sólo las últimas 50 corridas; la bitácora no necesita crecer.
  await db.execute(sql`
    DELETE FROM device_reports_cleanup
    WHERE id NOT IN (
      SELECT id FROM device_reports_cleanup
      ORDER BY run_at DESC
      LIMIT 50
    )
  `);

  return { purgedCount, cutoffDays };
}

export async function getLastCleanup(): Promise<{
  runAt: string;
  purgedCount: number;
  cutoffDays: number;
} | null> {
  const rows = await db
    .select({
      runAt: deviceReportsCleanupTable.runAt,
      purgedCount: deviceReportsCleanupTable.purgedCount,
      cutoffDays: deviceReportsCleanupTable.cutoffDays,
    })
    .from(deviceReportsCleanupTable)
    .orderBy(desc(deviceReportsCleanupTable.runAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    runAt: row.runAt instanceof Date ? row.runAt.toISOString() : String(row.runAt),
    purgedCount: row.purgedCount,
    cutoffDays: row.cutoffDays,
  };
}

export function startDeviceReportsCleanupJob(): void {
  const run = async () => {
    try {
      const { purgedCount, cutoffDays } = await cleanupOldDeviceReports();
      if (purgedCount > 0) {
        logger.info(
          { purgedCount, cutoffDays },
          "[DeviceReports] Cleanup: dispositivos purgados",
        );
      }
    } catch (err) {
      logger.error({ err }, "[DeviceReports] Error en cleanup");
    }
  };
  void run();
  setInterval(() => void run(), CLEANUP_INTERVAL_MS);
}
