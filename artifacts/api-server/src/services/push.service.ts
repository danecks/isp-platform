/**
 * SERVICIO DE NOTIFICACIONES PUSH — ISP, S.A.
 *
 * Envía notificaciones push a dispositivos móviles (APK Android, en el
 * futuro iOS) usando Firebase Cloud Messaging (FCM) vía firebase-admin.
 *
 * ─── CONFIGURACIÓN ────────────────────────────────────────────────────────
 *   Requiere la variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON con el
 *   JSON completo de una cuenta de servicio del proyecto Firebase (Roles:
 *   "Firebase Cloud Messaging API Admin"). Se obtiene desde
 *   Firebase Console → Project settings → Service accounts → Generate new
 *   private key.
 *
 *   Si la variable NO está configurada, el servicio entra en MODO STUB:
 *   no envía nada por red, sólo loggea lo que habría enviado y retorna
 *   { ok: false, simulated: true }. Esto permite levantar el api-server
 *   en desarrollo sin tener credenciales reales.
 *
 * ─── USO ──────────────────────────────────────────────────────────────────
 *   import { sendPushToUsers } from "./push.service";
 *   await sendPushToUsers({
 *     userIds: [1, 2, 3],
 *     title: "Emergencia en CCV",
 *     body: "Robo a mano armada — confirmar",
 *     data: { tipo: "emergencia", incidenciaId: "INC-..." },
 *   });
 *
 *   También expone sendPushToTokens(tokens, msg) para envíos por token
 *   directo (ej. botón "Enviar test" del panel admin).
 *
 * ─── LIMPIEZA DE TOKENS INVÁLIDOS ─────────────────────────────────────────
 *   Cuando FCM responde con "registration-token-not-registered" o
 *   "invalid-argument", el token correspondiente se borra de push_tokens
 *   para no seguir intentando enviarle.
 */

import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

// firebase-admin se importa dinámicamente para que el bundler no lo arrastre
// cuando la credencial no está presente (evita warnings de módulos node
// nativos en builds donde el push está desactivado).
type FirebaseMessaging = {
  sendEachForMulticast: (msg: {
    tokens: string[];
    notification: { title: string; body: string };
    data?: Record<string, string>;
    android?: { priority?: "normal" | "high" };
  }) => Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{
      success: boolean;
      error?: { code: string; message: string };
      messageId?: string;
    }>;
  }>;
};

let cachedMessaging: FirebaseMessaging | null = null;
let initAttempted = false;

async function getMessaging(): Promise<FirebaseMessaging | null> {
  if (cachedMessaging) return cachedMessaging;
  if (initAttempted) return null;
  initAttempted = true;

  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw?.trim()) {
    logger.warn(
      "[Push] FIREBASE_SERVICE_ACCOUNT_JSON no configurado — push notifications en modo stub (no se envía nada)."
    );
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const admin = await import("firebase-admin");
    const apps = admin.default.apps ?? [];
    const app = apps.length
      ? apps[0]!
      : admin.default.initializeApp({
          credential: admin.default.credential.cert(parsed),
        });
    cachedMessaging = admin.default.messaging(app!) as unknown as FirebaseMessaging;
    logger.info({ projectId: parsed.project_id }, "[Push] Firebase Admin inicializado");
    return cachedMessaging;
  } catch (err) {
    logger.error({ err }, "[Push] Error inicializando Firebase Admin — push deshabilitado");
    return null;
  }
}

export interface PushMessage {
  title: string;
  body: string;
  /**
   * Datos arbitrarios (claves y valores deben ser strings — limitación FCM).
   * El cliente los recibe en pushNotificationActionPerformed.notification.data.
   */
  data?: Record<string, string>;
  /**
   * "high" (default) entrega el mensaje aunque la app esté en doze/standby.
   * Usar "normal" para mensajes diferibles.
   */
  priority?: "normal" | "high";
}

export interface PushResult {
  ok: boolean;
  simulated?: boolean;
  sent: number;
  failed: number;
  invalidTokensRemoved: number;
}

/**
 * Envía una notificación push a una lista de tokens. Borra tokens que el
 * servicio reporte como inválidos.
 */
export async function sendPushToTokens(
  tokens: string[],
  msg: PushMessage
): Promise<PushResult> {
  const unique = Array.from(new Set(tokens.filter((t) => !!t?.trim())));
  if (unique.length === 0) {
    return { ok: true, sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }

  const messaging = await getMessaging();

  // Modo stub: sólo loggea, devuelve simulado.
  if (!messaging) {
    logger.info(
      {
        title: msg.title,
        body: msg.body,
        tokensCount: unique.length,
        data: msg.data,
      },
      "[Push] STUB — habría enviado push (Firebase no configurado)"
    );
    return {
      ok: false,
      simulated: true,
      sent: 0,
      failed: unique.length,
      invalidTokensRemoved: 0,
    };
  }

  // Stringify data values — FCM exige strings.
  const dataStrings: Record<string, string> = {};
  if (msg.data) {
    for (const [k, v] of Object.entries(msg.data)) {
      dataStrings[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
  }

  const resp = await messaging.sendEachForMulticast({
    tokens: unique,
    notification: { title: msg.title, body: msg.body },
    data: dataStrings,
    android: { priority: msg.priority ?? "high" },
  });

  // Recolectar tokens inválidos para borrarlos.
  const tokensToDelete: string[] = [];
  resp.responses.forEach((r, idx) => {
    if (r.success) return;
    const code = r.error?.code ?? "";
    if (
      code.includes("registration-token-not-registered") ||
      code.includes("invalid-argument") ||
      code.includes("invalid-registration-token")
    ) {
      tokensToDelete.push(unique[idx]!);
    }
  });

  if (tokensToDelete.length > 0) {
    try {
      await db
        .delete(pushTokensTable)
        .where(inArray(pushTokensTable.token, tokensToDelete));
      logger.info(
        { count: tokensToDelete.length },
        "[Push] Tokens inválidos eliminados de push_tokens"
      );
    } catch (err) {
      logger.error({ err }, "[Push] Error eliminando tokens inválidos");
    }
  }

  return {
    ok: resp.failureCount === 0,
    sent: resp.successCount,
    failed: resp.failureCount,
    invalidTokensRemoved: tokensToDelete.length,
  };
}

/**
 * Envía una notificación a todos los dispositivos registrados para los
 * usuarios indicados.
 */
export async function sendPushToUsers(args: {
  userIds: number[];
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: "normal" | "high";
}): Promise<PushResult> {
  const { userIds, ...msg } = args;
  if (userIds.length === 0) {
    return { ok: true, sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, userIds));
  return sendPushToTokens(
    rows.map((r) => r.token),
    msg
  );
}

/**
 * Envía una notificación a todos los usuarios con uno de los roles
 * indicados que estén activos. Usado para "broadcast a admins" cuando
 * surge una emergencia.
 */
export async function sendPushToRoles(args: {
  roles: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: "normal" | "high";
}): Promise<PushResult> {
  const { roles, ...msg } = args;
  if (roles.length === 0) {
    return { ok: true, sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }
  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.rol, roles));
  const activeIds = users.map((u) => u.id);
  if (activeIds.length === 0) {
    return { ok: true, sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }
  return sendPushToUsers({ userIds: activeIds, ...msg });
}

/**
 * Indica si el servicio tiene credenciales válidas. Útil para que el panel
 * admin muestre un banner "push en modo simulado" cuando aplica.
 */
export async function pushIsConfigured(): Promise<boolean> {
  const m = await getMessaging();
  return m !== null;
}
