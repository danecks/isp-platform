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
  // En dev pnpm corre desde artifacts/api-server/ → __dirname = artifacts/api-server/dist/
  // En prod node corre desde workspace root → process.cwd() = workspace root
  // Probamos ambas rutas para cubrir los dos entornos.
  const byDir = path.resolve(__dirname, "../../../tools/print-agent/dist/ISP-PrintAgent.exe");
  const byCwd = path.resolve(process.cwd(), "tools/print-agent/dist/ISP-PrintAgent.exe");
  const exePath = fs.existsSync(byDir) ? byDir : byCwd;
  if (!fs.existsSync(exePath)) {
    console.error("[download] exe no encontrado. byDir:", byDir, "byCwd:", byCwd);
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
