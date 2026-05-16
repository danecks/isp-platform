import app from "./app";
import { logger } from "./lib/logger";
import { runAutoMigrations, runAutoSeed } from "./lib/auto-seed";
import { limpiarFotosExpiradas } from "./routes/reclutamiento";
import { cleanupExpiredAnticipoSessions } from "./services/whatsapp/anticipo-session";
import { cleanupExpiredPhoneRegSessions } from "./services/whatsapp/phone-registration-session";

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

runAutoMigrations().then(() => runAutoSeed()).then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");

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
  });
});
