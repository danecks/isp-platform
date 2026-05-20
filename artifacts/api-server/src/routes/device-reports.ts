/**
 * DEVICE REPORTS — TASK #97
 *
 * El cliente (APK o navegador) reporta al backend qué versión nativa de APK
 * y qué bundle OTA tiene activo en ese dispositivo. Permite al panel admin
 * detectar qué celulares se quedaron en una versión vieja sin tener que
 * preguntarle al usuario.
 *
 *   POST /device-reports       — registrar / refrescar reporte (cualquier sesión)
 *   GET  /device-reports       — listado para el panel admin
 *
 * El POST está abierto a cualquier sesión válida (override en isPublicPath)
 * porque todos los usuarios necesitan reportar SU dispositivo al loguearse.
 * El GET queda restringido al módulo "usuarios" (admin).
 */
import { Router, type IRouter } from "express";
import { db, deviceReportsTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { readManifest } from "./app-updates";
import { logger } from "../lib/logger";
import {
  getLastCleanup,
  getRetentionDays,
  cleanupOldDeviceReports,
} from "../services/device-reports-cleanup";

const router: IRouter = Router();

function clip(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

// POST /device-reports — upsert por deviceId
// Body: { deviceId, userId?, platform?, nativeVersion?, bundleVersion?,
//         bundleId?, deviceModel?, lastOtaCheckAt?, lastOtaStatus? }
router.post("/device-reports", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const deviceId = clip(body["deviceId"], 100);
    if (!deviceId) {
      res.status(400).json({ error: "Se requiere 'deviceId'" });
      return;
    }

    // Resolver userId desde la SESIÓN — nunca confiar en el body para
    // routes públicas: un usuario común podría spoofear `userId` y
    // sobrescribir el reporte de otro (UPSERT por deviceId). El middleware
    // garantiza que llegamos acá sólo con sesión válida, así que basta con
    // exigir el header. Admin puede override explícito vía body.userId.
    let sessionUserId: number | null = null;
    let sessionRol = "";
    try {
      const raw = req.headers["x-isp-session"] as string | undefined;
      const session = raw ? JSON.parse(raw) : null;
      const id = Number(session?.id);
      sessionUserId = Number.isFinite(id) ? id : null;
      sessionRol = String(session?.rol ?? "");
    } catch {
      /* sesión malformada */
    }
    if (sessionUserId === null) {
      res.status(401).json({ error: "Sesión requerida" });
      return;
    }

    const bodyUserIdRaw = body["userId"];
    let userId: number = sessionUserId;
    if (bodyUserIdRaw !== undefined && bodyUserIdRaw !== null && bodyUserIdRaw !== "") {
      const bodyUserId = Number(bodyUserIdRaw);
      if (!Number.isFinite(bodyUserId) || bodyUserId <= 0) {
        res.status(400).json({ error: "userId inválido" });
        return;
      }
      if (bodyUserId !== sessionUserId && sessionRol !== "admin") {
        res.status(403).json({ error: "Sólo podés reportar dispositivos para tu propia cuenta" });
        return;
      }
      userId = bodyUserId;
    }

    let lastOtaCheckAt: Date | null = null;
    const checkAtRaw = body["lastOtaCheckAt"];
    if (typeof checkAtRaw === "string" && checkAtRaw) {
      const d = new Date(checkAtRaw);
      if (!Number.isNaN(d.getTime())) lastOtaCheckAt = d;
    }

    const values = {
      deviceId,
      userId,
      platform: clip(body["platform"], 20) ?? "web",
      nativeVersion: clip(body["nativeVersion"], 50),
      bundleVersion: clip(body["bundleVersion"], 50),
      bundleId: clip(body["bundleId"], 100),
      deviceModel: clip(body["deviceModel"], 100),
      lastOtaCheckAt,
      lastOtaStatus: clip(body["lastOtaStatus"], 50),
    };

    await db
      .insert(deviceReportsTable)
      .values(values)
      .onConflictDoUpdate({
        target: deviceReportsTable.deviceId,
        set: {
          userId: values.userId,
          platform: values.platform,
          nativeVersion: values.nativeVersion,
          bundleVersion: values.bundleVersion,
          bundleId: values.bundleId,
          deviceModel: values.deviceModel,
          lastOtaCheckAt: values.lastOtaCheckAt,
          lastOtaStatus: values.lastOtaStatus,
          lastSeenAt: sql`NOW()`,
        },
      });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[device-reports] POST error");
    res.status(500).json({ error: "Error registrando reporte de dispositivo" });
  }
});

// GET /device-reports?desactualizados=1
// Devuelve { rows, manifestVersion } con join al nombre del usuario.
router.get("/device-reports", async (req, res) => {
  try {
    const manifest = (await readManifest().catch(() => null)) as { version?: string } | null;
    const manifestVersion = typeof manifest?.version === "string" ? manifest.version : null;

    const soloDesactualizados = String(req.query["desactualizados"] ?? "") === "1";

    const baseQuery = db
      .select({
        id: deviceReportsTable.id,
        deviceId: deviceReportsTable.deviceId,
        userId: deviceReportsTable.userId,
        userName: usersTable.nombre,
        userUsername: usersTable.username,
        platform: deviceReportsTable.platform,
        nativeVersion: deviceReportsTable.nativeVersion,
        bundleVersion: deviceReportsTable.bundleVersion,
        bundleId: deviceReportsTable.bundleId,
        deviceModel: deviceReportsTable.deviceModel,
        lastOtaCheckAt: deviceReportsTable.lastOtaCheckAt,
        lastOtaStatus: deviceReportsTable.lastOtaStatus,
        lastSeenAt: deviceReportsTable.lastSeenAt,
        createdAt: deviceReportsTable.createdAt,
      })
      .from(deviceReportsTable)
      .leftJoin(usersTable, eq(usersTable.id, deviceReportsTable.userId));

    const filtros = [];
    // Sólo filas con dato OTA real (excluye web sin bundle nativo) cuando se
    // pide "desactualizados" — el navegador siempre carga la última versión.
    if (soloDesactualizados && manifestVersion) {
      filtros.push(
        and(
          sql`${deviceReportsTable.bundleVersion} IS NOT NULL`,
          sql`${deviceReportsTable.bundleVersion} <> ${manifestVersion}`,
        )!,
      );
    }
    const where = filtros.length ? and(...filtros) : undefined;

    const rows = await (where ? baseQuery.where(where) : baseQuery)
      .orderBy(desc(deviceReportsTable.lastSeenAt))
      .limit(500);

    const lastCleanup = await getLastCleanup().catch(() => null);
    const retentionDays = getRetentionDays();

    res.json({ rows, manifestVersion, lastCleanup, retentionDays });
  } catch (err) {
    logger.error({ err }, "[device-reports] GET error");
    res.status(500).json({ error: "Error listando reportes de dispositivos" });
  }
});

// POST /device-reports/cleanup — fuerza una corrida manual del job (admin).
// Útil para que el admin pueda purgar al momento desde el panel sin esperar
// al ciclo de 24h.
router.post("/device-reports/cleanup", async (req, res) => {
  try {
    let sessionRol = "";
    try {
      const raw = req.headers["x-isp-session"] as string | undefined;
      const session = raw ? JSON.parse(raw) : null;
      sessionRol = String(session?.rol ?? "");
    } catch {
      /* sesión malformada */
    }
    if (sessionRol !== "admin") {
      res.status(403).json({ error: "Sólo admin puede ejecutar el cleanup" });
      return;
    }

    const { purgedCount, cutoffDays } = await cleanupOldDeviceReports();
    res.json({ ok: true, purgedCount, cutoffDays });
  } catch (err) {
    logger.error({ err }, "[device-reports] cleanup manual error");
    res.status(500).json({ error: "Error ejecutando cleanup" });
  }
});

export default router;
