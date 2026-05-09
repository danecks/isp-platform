import app from "./app";
import { logger } from "./lib/logger";
import { runAutoMigrations, runAutoSeed } from "./lib/auto-seed";
import { limpiarFotosExpiradas } from "./routes/reclutamiento";

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
  });
});
