/**
 * PUSH DE EMERGENCIAS — ISP, S.A.
 *
 * Cuando se crea una incidencia con `esEmergencia=true`, este módulo se
 * encarga de notificar a los roles que deben enterarse en tiempo real:
 * administradores y supervisores operativos.
 *
 * Roles notificados: "admin", "operaciones", "supervisor". Si se quiere
 * cambiar la lista, modificar ROLES_NOTIFICAR_EMERGENCIA.
 *
 * El envío se hace en "fire and forget" desde el handler POST
 * /emergencias para no bloquear la respuesta al cliente que reportó —
 * cualquier error sólo se loggea.
 */

import { sendPushToRoles, type PushResult } from "./push.service";
import { logger } from "../lib/logger";
import type { Incident } from "@workspace/db";

export const ROLES_NOTIFICAR_EMERGENCIA = ["admin", "operaciones", "supervisor"] as const;

export async function notificarEmergenciaPush(incidencia: Incident): Promise<PushResult> {
  const titulo = `🚨 Emergencia — ${incidencia.tipo}`;
  const cuerpo = [
    incidencia.cliente,
    incidencia.ubicacion ? `(${incidencia.ubicacion})` : null,
    incidencia.reportadoPor ? `reportado por ${incidencia.reportadoPor}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const result = await sendPushToRoles({
    roles: [...ROLES_NOTIFICAR_EMERGENCIA],
    title: titulo,
    body: cuerpo || "Nueva emergencia reportada — revisar panel",
    priority: "high",
    evento: "emergencia",
    data: {
      tipo: "emergencia",
      incidenciaId: incidencia.id,
      clienteId: incidencia.clienteRefId ?? "",
      // El cliente usa esto para navegar al detalle al tocar la notificación.
      ruta: `/emergencias/${incidencia.id}`,
    },
  });

  logger.info(
    {
      incidenciaId: incidencia.id,
      sent: result.sent,
      failed: result.failed,
      simulated: result.simulated ?? false,
    },
    "[Push-Emergencia] resultado de notificación"
  );
  return result;
}
