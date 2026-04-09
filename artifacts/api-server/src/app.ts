import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { permisosMiddleware } from "./lib/permisos-middleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Descarga del agente de impresión para Windows (sin autenticación) ──────
// Registrada ANTES del middleware de permisos para que no sea interceptada
// El archivo .exe se sirve como estático desde el frontend (evita límites del proxy de API).
// Este endpoint redirige a esa URL estática para mantener compatibilidad con links antiguos.
app.get("/api/download/print-agent", (_req, res) => {
  res.redirect(302, "/downloads/ISP-PrintAgent.exe");
});

app.use("/api", permisosMiddleware as any);
app.use("/api", router);

export default app;
