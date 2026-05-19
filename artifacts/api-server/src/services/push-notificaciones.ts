/**
 * PUSH DE ASIGNACIONES Y APROBACIONES — ISP, S.A.
 *
 * Helpers de notificación push para los flujos operativos / RRHH que
 * complementan a `push-emergencias.ts`:
 *
 *   - notificarAsignacionTurnoPush:
 *       Avisa al colaborador asignado a un puesto/turno cuando
 *       Operaciones lo coloca en el pizarrón. Busca el o los usuarios
 *       cuya `users.employee_id` coincida con el agente.
 *
 *   - notificarAprobacionPendientePush:
 *       Avisa a los aprobadores (roles admin/rrhh por defecto) cada vez
 *       que se crea una solicitud que requiere su revisión: anticipos,
 *       vacaciones (programadas) o solicitudes de cambio operativo.
 *
 * Todos los envíos se hacen en "fire and forget" desde los handlers
 * para no bloquear la respuesta HTTP — los errores sólo se loggean.
 */

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendPushToUsers, sendPushToRoles, type PushResult } from "./push.service";
import { logger } from "../lib/logger";

// Roles que reciben las notificaciones de aprobaciones pendientes.
// Se mantienen agrupados aquí para que sea fácil ajustarlos sin tocar
// los routers.
export const ROLES_APROBADORES_RRHH = ["admin", "rrhh"] as const;
export const ROLES_APROBADORES_OPERACIONES = ["admin", "operaciones"] as const;

/**
 * Busca todos los `users.id` (activos) vinculados a un `employees.id`.
 * Puede haber 0 (colaborador sin cuenta) o más de uno (raro pero posible).
 */
async function userIdsForEmployee(employeeId: number): Promise<number[]> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.employeeId, employeeId));
  return rows.map((r) => r.id);
}

// ─── Asignación de turno ──────────────────────────────────────────────────────

export interface AsignacionPushArgs {
  agenteId: number;
  agenteNombre: string;
  puestoId: number | string;
  puestoNombre: string;
  clienteNombre?: string | null;
  fecha?: string | null;          // "YYYY-MM-DD" del día de cobertura
  soloCobertura?: boolean;        // true = relevo temporal; false = titular
  horaInicio?: string | null;
}

export async function notificarAsignacionTurnoPush(
  args: AsignacionPushArgs
): Promise<PushResult> {
  const userIds = await userIdsForEmployee(args.agenteId);
  if (userIds.length === 0) {
    return { ok: true, sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }

  const tituloPrefijo = args.soloCobertura ? "🛡 Relevo asignado" : "🛡 Turno asignado";
  const titulo = `${tituloPrefijo} — ${args.puestoNombre}`;
  const cuerpoPartes = [
    args.clienteNombre,
    args.fecha ? `📅 ${args.fecha}` : null,
    args.horaInicio ? `⏰ ${args.horaInicio}` : null,
  ].filter(Boolean);
  const cuerpo = cuerpoPartes.length
    ? cuerpoPartes.join(" · ")
    : "Tienes una nueva asignación de turno";

  const result = await sendPushToUsers({
    userIds,
    title: titulo,
    body: cuerpo,
    priority: "high",
    data: {
      tipo: "asignacion_turno",
      puestoId: String(args.puestoId),
      agenteId: String(args.agenteId),
      fecha: args.fecha ?? "",
      soloCobertura: args.soloCobertura ? "1" : "0",
      // El cliente usa esto para navegar al detalle del turno asignado.
      ruta: `/mi-turno?puestoId=${args.puestoId}${args.fecha ? `&fecha=${args.fecha}` : ""}`,
    },
  });

  logger.info(
    {
      agenteId: args.agenteId,
      puestoId: args.puestoId,
      userIds,
      sent: result.sent,
      failed: result.failed,
      simulated: result.simulated ?? false,
    },
    "[Push-Asignacion] resultado de notificación"
  );
  return result;
}

// ─── Aprobaciones pendientes ──────────────────────────────────────────────────

export type TipoAprobacion =
  | "anticipo"
  | "vacaciones"
  | "solicitud_cambio";

export interface AprobacionPushArgs {
  tipo: TipoAprobacion;
  solicitudId: number | string;
  /** Nombre del colaborador que generó la solicitud (para el cuerpo). */
  empleadoNombre?: string | null;
  /** Resumen corto de la solicitud (ej. monto, fechas, tipo de cambio). */
  resumen?: string | null;
  /** Roles que deben aprobar. Por defecto: admin + rrhh. */
  roles?: readonly string[];
  /** Ruta a abrir en la app al tocar la notificación. */
  ruta?: string;
}

const TITULOS_APROBACION: Record<TipoAprobacion, string> = {
  anticipo:          "💵 Anticipo pendiente",
  vacaciones:        "🏖 Vacaciones pendientes",
  solicitud_cambio:  "📝 Solicitud de cambio pendiente",
};

export async function notificarAprobacionPendientePush(
  args: AprobacionPushArgs
): Promise<PushResult> {
  const roles = (args.roles ?? ROLES_APROBADORES_RRHH) as string[];
  const titulo = TITULOS_APROBACION[args.tipo];
  const cuerpo = [args.empleadoNombre, args.resumen]
    .filter(Boolean)
    .join(" — ") || "Nueva solicitud — requiere tu revisión";

  const ruta = args.ruta ?? rutaPorDefecto(args.tipo, args.solicitudId);

  const result = await sendPushToRoles({
    roles,
    title: titulo,
    body: cuerpo,
    priority: "high",
    data: {
      tipo: `aprobacion_${args.tipo}`,
      solicitudId: String(args.solicitudId),
      ruta,
    },
  });

  logger.info(
    {
      tipo: args.tipo,
      solicitudId: args.solicitudId,
      roles,
      sent: result.sent,
      failed: result.failed,
      simulated: result.simulated ?? false,
    },
    "[Push-Aprobacion] resultado de notificación"
  );
  return result;
}

function rutaPorDefecto(tipo: TipoAprobacion, id: number | string): string {
  switch (tipo) {
    case "anticipo":          return `/anticipos/${id}`;
    case "vacaciones":        return `/vacaciones/${id}`;
    case "solicitud_cambio":  return `/solicitudes-cambio/${id}`;
  }
}

// ─── Abandono de puesto (supervisión) ─────────────────────────────────────────

// Roles con permiso de supervisión (mismos que abren el dashboard).
// Se mantienen aquí para que un cambio en el menú no rompa el push.
export const ROLES_SUPERVISION = ["admin", "operaciones", "supervisor"] as const;

export interface AbandonoPuestoPushArgs {
  novedadId: number;
  supervisorNombre?: string | null;
  puestoNombre?: string | null;
  clienteNombre?: string | null;
  permanenciaSegundos: number;
}

export async function notificarAbandonoPuestoPush(
  args: AbandonoPuestoPushArgs
): Promise<PushResult> {
  const minutos = Math.max(0, Math.round(args.permanenciaSegundos / 60));
  const titulo = "🚨 Abandono de puesto detectado";
  const partes = [
    args.supervisorNombre ? `Supervisor: ${args.supervisorNombre}` : null,
    args.puestoNombre ? `Puesto: ${args.puestoNombre}` : null,
    args.clienteNombre ? `Cliente: ${args.clienteNombre}` : null,
    `Permanencia: ${minutos} min`,
  ].filter(Boolean) as string[];
  const cuerpo = partes.join(" · ");

  const result = await sendPushToRoles({
    roles: [...ROLES_SUPERVISION],
    title: titulo,
    body: cuerpo,
    priority: "high",
    data: {
      tipo: "abandono_puesto",
      novedadId: String(args.novedadId),
      ruta: `/admin/supervision/novedades/${args.novedadId}`,
    },
  });

  logger.info(
    {
      novedadId: args.novedadId,
      sent: result.sent,
      failed: result.failed,
      simulated: result.simulated ?? false,
    },
    "[Push-Abandono] resultado de notificación"
  );
  return result;
}
