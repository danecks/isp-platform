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

// ── Descarga del agente de impresión para Windows ──────────────────────────
// Sirve el exe desde artifacts/isp-web/public/downloads/ que SÍ está en git.
// Usa sendFile() para transferencia correcta de archivos grandes.
app.get("/api/download/print-agent", (req, res) => {
  // En producción process.cwd() = workspace root.
  // En dev (pnpm --filter desde artifacts/api-server) = artifacts/api-server/.
  // Intentamos ambas rutas.
  const candidates = [
    path.resolve(process.cwd(), "artifacts/isp-web/public/downloads/ISP-PrintAgent.exe"),
    path.resolve(__dirname, "../../../artifacts/isp-web/public/downloads/ISP-PrintAgent.exe"),
  ];
  const exePath = candidates.find(p => fs.existsSync(p));
  if (!exePath) {
    console.error("[download] exe no encontrado en:", candidates);
    res.status(404).json({ error: "Archivo no disponible" });
    return;
  }
  res.setHeader("Content-Disposition", 'attachment; filename="ISP-PrintAgent.exe"');
  res.sendFile(exePath, (err) => {
    if (err) console.error("[download] sendFile error:", err.message);
  });
});

app.use("/api", permisosMiddleware as any);
app.use("/api", router);

export default app;
