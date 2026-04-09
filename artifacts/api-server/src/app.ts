import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
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
app.get("/api/download/print-agent", (_req, res) => {
  // El servidor compilado queda en artifacts/api-server/dist/
  // Subir 3 niveles llega al workspace root: workspace/tools/print-agent/dist/
  const exePath = path.resolve(__dirname, "../../../tools/print-agent/dist/ISP-PrintAgent.exe");
  if (!fs.existsSync(exePath)) {
    res.status(404).json({ error: "Archivo no disponible" });
    return;
  }
  const size = fs.statSync(exePath).size;
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="ISP-PrintAgent.exe"');
  res.setHeader("Content-Length", size);
  fs.createReadStream(exePath).pipe(res);
});

app.use("/api", permisosMiddleware as any);
app.use("/api", router);

export default app;
