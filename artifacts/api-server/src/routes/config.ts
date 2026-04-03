import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const configRouter = Router();

// ─── GET /api/config/permisos ──────────────────────────────────────────────
// Devuelve mapa { path → rol[] } con los permisos actuales
configRouter.get("/config/permisos", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rol, path FROM permisos_ruta_rol ORDER BY path, rol`
    );
    const mapa: Record<string, string[]> = {};
    for (const r of rows) {
      if (!mapa[r.path]) mapa[r.path] = [];
      mapa[r.path].push(r.rol);
    }
    res.json(mapa);
  } catch (err) {
    logger.error({ err }, "GET /config/permisos error");
    res.status(500).json({ error: "Error al cargar permisos" });
  }
});

// ─── PUT /api/config/permisos ──────────────────────────────────────────────
// Reemplaza todos los permisos (solo admin)
// Body: Array<{ path: string; roles: string[] }>
configRouter.put("/config/permisos", async (req, res) => {
  let rolSesion = "";
  try { rolSesion = JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; } catch {}
  if (rolSesion !== "admin") {
    return res.status(403).json({ error: "Solo administradores pueden modificar permisos" });
  }

  const entradas: { path: string; roles: string[] }[] = req.body;
  if (!Array.isArray(entradas)) {
    return res.status(400).json({ error: "Se esperaba un array de { path, roles }" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Reemplazar solo los que no son admin (admin siempre tiene todo)
    const paths = entradas.map((e) => e.path);
    if (paths.length > 0) {
      await client.query(
        `DELETE FROM permisos_ruta_rol WHERE rol != 'admin' AND path = ANY($1)`,
        [paths]
      );
    }

    for (const entrada of entradas) {
      for (const rol of entrada.roles) {
        if (rol === "admin") continue;
        await client.query(
          `INSERT INTO permisos_ruta_rol (rol, path) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [rol, entrada.path]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true, mensaje: `${entradas.length} rutas actualizadas` });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "PUT /config/permisos error");
    res.status(500).json({ error: "Error al guardar permisos" });
  } finally {
    client.release();
  }
});

export default configRouter;
