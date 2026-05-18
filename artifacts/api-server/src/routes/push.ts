/**
 * PUSH ROUTER — ISP, S.A.
 *
 * Endpoints para gestionar tokens FCM y disparar notificaciones manuales
 * desde el panel admin.
 *
 * POST   /push/tokens             — registrar o refrescar un token del dispositivo logueado
 * DELETE /push/tokens/:token      — borrar un token (logout / desinstalación)
 * GET    /push/tokens/usuario/:id — listar dispositivos de un usuario (panel admin)
 * GET    /push/status             — saber si Firebase está configurado
 * POST   /push/test               — enviar push de prueba a un usuario (panel admin)
 * POST   /push/emergencia/:id     — re-enviar push de una emergencia existente
 */

import { Router } from "express";
import { db, pushTokensTable, usersTable, incidentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  sendPushToUsers,
  pushIsConfigured,
} from "../services/push.service";
import { notificarEmergenciaPush } from "../services/push-emergencias";

const router = Router();

// GET /push/status — diagnóstico para el panel admin
router.get("/push/status", async (_req, res) => {
  try {
    const configured = await pushIsConfigured();
    res.json({ configured, mode: configured ? "real" : "stub" });
  } catch (err) {
    console.error("[push] STATUS error:", err);
    res.status(500).json({ error: "Error consultando estado de push" });
  }
});

// POST /push/tokens — registrar / actualizar token de un dispositivo
// Body: { token, userId, platform?, appVersion?, deviceModel? }
// Idempotente: si el token ya existe, refresca lastSeenAt y reasigna el
// userId si cambió (cuenta logueada cambió en el mismo dispositivo).
router.post("/push/tokens", async (req, res) => {
  try {
    const { token, userId, platform, appVersion, deviceModel } = req.body ?? {};
    if (!token?.trim()) {
      return res.status(400).json({ error: "Se requiere 'token'" });
    }
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return res.status(400).json({ error: "Se requiere 'userId' válido" });
    }

    // Defense-in-depth: el endpoint deja pasar cualquier sesión válida
    // (override en permisos-middleware), pero acá verificamos que la sesión
    // sólo pueda registrar tokens para SÍ misma. Admin puede registrar para
    // cualquiera (útil para soporte). Esto previene que un usuario común
    // robe notificaciones de otro.
    try {
      const raw = req.headers["x-isp-session"] as string | undefined;
      const session = raw ? JSON.parse(raw) : null;
      const sessionUserId = Number(session?.id);
      const sessionRol = String(session?.rol ?? "");
      if (sessionRol !== "admin" && Number.isFinite(sessionUserId) && sessionUserId !== uid) {
        return res.status(403).json({ error: "Sólo podés registrar tokens para tu propia cuenta" });
      }
    } catch {
      /* sesión malformada — el middleware ya la habría bloqueado */
    }

    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, uid));
    if (!userRows.length) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // UPSERT por token (UNIQUE).
    await db
      .insert(pushTokensTable)
      .values({
        token: token.trim(),
        userId: uid,
        platform: (platform ?? "android").toString().slice(0, 20),
        appVersion: appVersion ? String(appVersion).slice(0, 50) : null,
        deviceModel: deviceModel ? String(deviceModel).slice(0, 100) : null,
      })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: {
          userId: uid,
          platform: (platform ?? "android").toString().slice(0, 20),
          appVersion: appVersion ? String(appVersion).slice(0, 50) : null,
          deviceModel: deviceModel ? String(deviceModel).slice(0, 100) : null,
          lastSeenAt: sql`NOW()`,
        },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("[push] POST tokens error:", err);
    res.status(500).json({ error: "Error registrando token" });
  }
});

// DELETE /push/tokens/:token — borrar token (logout o reset).
// Validamos ownership: un usuario sólo puede borrar tokens que estén
// asociados a SU cuenta. Admin puede borrar cualquiera. Esto previene que
// alguien con sesión válida limpie las notificaciones de otro usuario si
// llegara a conocer su token (improbable, pero defensa en profundidad).
router.delete("/push/tokens/:token", async (req, res) => {
  try {
    const token = req.params.token;
    if (!token?.trim()) return res.status(400).json({ error: "Token requerido" });

    let sessionUserId: number | null = null;
    let sessionRol = "";
    try {
      const raw = req.headers["x-isp-session"] as string | undefined;
      const session = raw ? JSON.parse(raw) : null;
      const id = Number(session?.id);
      sessionUserId = Number.isFinite(id) ? id : null;
      sessionRol = String(session?.rol ?? "");
    } catch {
      /* sesión malformada — el middleware ya la habría bloqueado */
    }

    const conditions =
      sessionRol === "admin" || sessionUserId === null
        ? eq(pushTokensTable.token, token)
        : and(
            eq(pushTokensTable.token, token),
            eq(pushTokensTable.userId, sessionUserId)
          );

    const result = await db
      .delete(pushTokensTable)
      .where(conditions)
      .returning();
    res.json({ ok: true, deleted: result.length });
  } catch (err) {
    console.error("[push] DELETE token error:", err);
    res.status(500).json({ error: "Error eliminando token" });
  }
});

// GET /push/tokens/usuario/:id — dispositivos de un usuario (panel admin)
router.get("/push/tokens/usuario/:id", async (req, res) => {
  try {
    const uid = parseInt(req.params.id, 10);
    if (!Number.isFinite(uid)) return res.status(400).json({ error: "userId inválido" });
    const rows = await db
      .select()
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, uid));
    // No exponer el token completo en listados; el admin no necesita verlo.
    const masked = rows.map((r) => ({
      id: r.id,
      tokenPreview: `${r.token.slice(0, 12)}…${r.token.slice(-6)}`,
      platform: r.platform,
      appVersion: r.appVersion,
      deviceModel: r.deviceModel,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
    }));
    res.json(masked);
  } catch (err) {
    console.error("[push] GET tokens usuario error:", err);
    res.status(500).json({ error: "Error listando tokens" });
  }
});

// POST /push/test — enviar push de prueba
// Body: { userId, title?, body? }
router.post("/push/test", async (req, res) => {
  try {
    const { userId, title, body } = req.body ?? {};
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return res.status(400).json({ error: "Se requiere 'userId' válido" });
    }
    const result = await sendPushToUsers({
      userIds: [uid],
      title: title?.trim() || "Notificación de prueba",
      body: body?.trim() || "Si recibís esta notificación, las push están funcionando.",
      data: { tipo: "test" },
    });
    res.json(result);
  } catch (err) {
    console.error("[push] TEST error:", err);
    res.status(500).json({ error: "Error enviando push de prueba" });
  }
});

// POST /push/emergencia/:id — re-enviar push de una emergencia existente
// (la creación ya dispara push automático; este endpoint sirve para
// reintentar manualmente desde el panel si falló la primera vez).
router.post("/push/emergencia/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await db
      .select()
      .from(incidentsTable)
      .where(and(eq(incidentsTable.id, id), eq(incidentsTable.esEmergencia, true)));
    if (!rows.length) {
      return res.status(404).json({ error: "Emergencia no encontrada" });
    }
    const result = await notificarEmergenciaPush(rows[0]!);
    res.json(result);
  } catch (err) {
    console.error("[push] EMERGENCIA error:", err);
    res.status(500).json({ error: "Error enviando push de emergencia" });
  }
});

export default router;
