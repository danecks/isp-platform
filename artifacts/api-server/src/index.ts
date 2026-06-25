import app from "./app";
import { logger } from "./lib/logger";
import { runAutoMigrations, runAutoSeed } from "./lib/auto-seed";
import { limpiarFotosExpiradas } from "./routes/reclutamiento";
import { cleanupExpiredAnticipoSessions } from "./services/whatsapp/anticipo-session";
import { cleanupExpiredPhoneRegSessions } from "./services/whatsapp/phone-registration-session";
import { startRecordatorioAbandonoJob } from "./services/recordatorio-abandono";
import { startDeviceReportsCleanupJob } from "./services/device-reports-cleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Arrancamos el servidor HTTP ANTES de correr las auto-migraciones/seed.
//
// Motivo: la cadena de auto-migraciones (idempotente, "verifica/crea") ha
// crecido hasta tardar ~1 min en arrancar. Cuando se corría antes de
// `app.listen`, el puerto no quedaba enlazado durante ese minuto y el
// healthcheck del deploy (/api, /app-updates) recibía 500 → la publicación
// fallaba (promote sin instancia sana). Escuchando primero, el healthcheck
// pasa de inmediato y las migraciones corren en segundo plano. En producción
// el esquema ya existe, así que las migraciones son verificaciones casi
// instantáneas y las rutas funcionan mientras terminan.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  runAutoMigrations()
    .then(() => runAutoSeed())
    .then(() => {
      logger.info("Auto-migraciones y seed completados");

      // Limpiar fotos expiradas de solicitudes al arrancar y luego diariamente
      limpiarFotosExpiradas();
      setInterval(limpiarFotosExpiradas, 24 * 60 * 60 * 1000);

      // GC periódico de sesiones de WhatsApp expiradas (anticipo + phone-reg).
      // El TTL ya se valida al leer; este job solo libera filas viejas para
      // mantener la tabla pequeña.
      const gcSesionesWa = async () => {
        try {
          const a = await cleanupExpiredAnticipoSessions();
          const p = await cleanupExpiredPhoneRegSessions();
          if (a > 0 || p > 0) {
            logger.info({ anticipo: a, phoneReg: p }, "[WA-Sessions] GC sesiones expiradas");
          }
        } catch (err) {
          logger.error({ err }, "[WA-Sessions] Error en GC de sesiones");
        }
      };
      gcSesionesWa();
      setInterval(gcSesionesWa, 5 * 60 * 1000);

      // Recordatorios push de alertas de abandono de puesto sin reconocer.
      // Corre cada RECORDATORIO_ABANDONO_INTERVAL_MIN (default 5 min) y
      // notifica las novedades cuyo `generada_at` lleve más del umbral
      // configurable (default 30 min) sin que nadie las reconozca.
      startRecordatorioAbandonoJob();

      // Cleanup periódico de reportes de dispositivos sin actividad (TASK #101).
      // Borra filas de `device_reports` cuyo `last_seen_at` sea más viejo que
      // DEVICE_REPORTS_RETENTION_DAYS (default 90) para que el filtro de
      // "desactualizados" no se llene de celulares perdidos o de empleados que
      // ya no están. Corre al arrancar y luego cada 24h.
      startDeviceReportsCleanupJob();
    })
    .catch((err) => {
      logger.error({ err }, "Error en auto-migraciones/seed al arrancar");
    });
});
