/**
 * ANTICIPO SESSION MANAGER — Conversaciones multi-turno de WhatsApp
 *
 * Mantiene el estado de la conversación de anticipo por número de teléfono.
 * Estado en memoria (Phase 1). Las sesiones expiran en SESSION_TTL_MS.
 *
 * Flujo:
 *   WAIT_DPI      → colaborador proporciona su DPI
 *   WAIT_CANTIDAD → colaborador proporciona el monto en Quetzales
 */

import { db, employeesTable, anticiposTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ── Configuración de períodos ───────────────────────────────────────────────
// Días del mes en que se habilitan las solicitudes de anticipo
// Se permite ±1 día de tolerancia (ej: días 9, 10, 11 y 24, 25, 26)
export const DIAS_HABILITADOS = [10, 25];
const TOLERANCIA_DIAS = 1;

// Tiempo máximo de inactividad antes de cancelar la sesión (30 minutos)
const SESSION_TTL_MS = 30 * 60 * 1000;

// ── Estado de sesión ────────────────────────────────────────────────────────
export type SessionState = "WAIT_DPI" | "WAIT_CANTIDAD";

export interface AnticipoSession {
  state: SessionState;
  telefono: string;
  employeeId: number;
  nombre: string;
  puesto: string | null;
  dpi: string | null;           // null si aún no lo ha proporcionado
  periodo: string;
  lastActivity: number;         // timestamp ms
}

const sessions = new Map<string, AnticipoSession>();

// ── Utilidades de período ───────────────────────────────────────────────────

/**
 * Devuelve el período activo para una fecha dada, o null si no está habilitado.
 * Ejemplo de resultado: "2026-03-dia10" | "2026-03-dia25" | null
 */
export function getPeriodoActivo(fecha: Date = new Date()): string | null {
  const dia = fecha.getDate();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");

  for (const diaHab of DIAS_HABILITADOS) {
    if (Math.abs(dia - diaHab) <= TOLERANCIA_DIAS) {
      return `${anio}-${mes}-dia${diaHab}`;
    }
  }
  return null;
}

/**
 * Devuelve los próximos días habilitados del mes actual y siguiente.
 */
export function getProximosDiasHabilitados(): string {
  const hoy = new Date();
  const dia = hoy.getDate();
  const diasPendientes = DIAS_HABILITADOS.filter((d) => d > dia);
  if (diasPendientes.length > 0) {
    return `el día ${diasPendientes[0]} de este mes`;
  }
  const mesProx = new Date(hoy.getFullYear(), hoy.getMonth() + 1, DIAS_HABILITADOS[0]);
  return `el día ${DIAS_HABILITADOS[0]} del próximo mes`;
}

// ── Normalización de teléfono ───────────────────────────────────────────────
export function normalizarTelefono(tel: string): string {
  return tel.replace(/\D/g, ""); // Solo dígitos
}

// ── Validaciones ────────────────────────────────────────────────────────────

/**
 * Busca un empleado activo por número de teléfono.
 * Normaliza ambos lados antes de comparar.
 */
export async function buscarEmpleadoPorTelefono(telefono: string) {
  const telNorm = normalizarTelefono(telefono);
  const empleados = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.estadoLaboral, "activo"));

  return empleados.find((e) => {
    if (!e.telefono) return false;
    return normalizarTelefono(e.telefono) === telNorm;
  }) ?? null;
}

/**
 * Verifica si ya existe una solicitud pendiente del mismo colaborador en el mismo período.
 */
export async function existeSolicitudPendiente(employeeId: number, periodo: string): Promise<boolean> {
  const existente = await db
    .select({ id: anticiposTable.id })
    .from(anticiposTable)
    .where(
      and(
        eq(anticiposTable.employeeId, employeeId),
        eq(anticiposTable.periodo, periodo),
        eq(anticiposTable.estado, "pendiente")
      )
    )
    .limit(1);
  return existente.length > 0;
}

// ── Gestión de sesiones ─────────────────────────────────────────────────────

export function getSession(telefono: string): AnticipoSession | null {
  const s = sessions.get(normalizarTelefono(telefono));
  if (!s) return null;
  // Expiración
  if (Date.now() - s.lastActivity > SESSION_TTL_MS) {
    sessions.delete(normalizarTelefono(telefono));
    return null;
  }
  return s;
}

export function createSession(data: Omit<AnticipoSession, "lastActivity">): AnticipoSession {
  const session: AnticipoSession = { ...data, lastActivity: Date.now() };
  sessions.set(normalizarTelefono(data.telefono), session);
  return session;
}

export function updateSession(telefono: string, updates: Partial<AnticipoSession>): void {
  const key = normalizarTelefono(telefono);
  const s = sessions.get(key);
  if (s) {
    Object.assign(s, updates, { lastActivity: Date.now() });
    sessions.set(key, s);
  }
}

export function deleteSession(telefono: string): void {
  sessions.delete(normalizarTelefono(telefono));
}

// ── Procesamiento de mensajes de anticipo ────────────────────────────────────

/**
 * Inicia el flujo de anticipo cuando se detecta la keyword.
 * Retorna el mensaje de respuesta al colaborador.
 */
export async function iniciarAnticipo(
  nombre: string,
  telefono: string
): Promise<string> {
  // 1. Validar empleado registrado
  const empleado = await buscarEmpleadoPorTelefono(telefono);
  if (!empleado) {
    return (
      "⛔ Tu número de WhatsApp no está registrado como colaborador de ISP, S.A.\n\n" +
      "Si crees que es un error, comunícate con RRHH."
    );
  }

  // 2. Validar fecha habilitada
  const periodo = getPeriodoActivo();
  if (!periodo) {
    const proximo = getProximosDiasHabilitados();
    return (
      "📅 El período de solicitud de anticipos no está habilitado.\n\n" +
      `Puedes solicitar tu anticipo *${proximo}*.\n` +
      `Días habilitados: ${DIAS_HABILITADOS.map((d) => `día ${d}`).join(" y ")} de cada mes.`
    );
  }

  // 3. Validar duplicado
  const hayDuplicado = await existeSolicitudPendiente(empleado.id, periodo);
  if (hayDuplicado) {
    return (
      "⚠️ Ya tienes una solicitud de anticipo *pendiente* para este período.\n\n" +
      "Espera a que RRHH la revise antes de enviar otra."
    );
  }

  // 4. Iniciar sesión
  const necesitaDpi = !empleado.dpi;
  createSession({
    state: necesitaDpi ? "WAIT_DPI" : "WAIT_CANTIDAD",
    telefono,
    employeeId: empleado.id,
    nombre: empleado.nombreCompleto,
    puesto: empleado.puesto ?? null,
    dpi: empleado.dpi ?? null,
    periodo,
  });

  if (necesitaDpi) {
    return (
      `✅ Hola *${empleado.nombreCompleto}*, vamos a registrar tu solicitud de anticipo.\n\n` +
      `📋 Período: ${periodo.replace("-dia", " — día ")}\n\n` +
      "Para verificar tu identidad, proporciona tu *número de DPI*:"
    );
  } else {
    return (
      `✅ Hola *${empleado.nombreCompleto}*, vamos a registrar tu solicitud de anticipo.\n\n` +
      `📋 Período: ${periodo.replace("-dia", " — día ")}\n` +
      `💼 Puesto: ${empleado.puesto ?? "N/D"}\n\n` +
      "¿Cuánto anticipo necesitas? Indica el monto en *Quetzales* (solo el número, ej: *500*):"
    );
  }
}

/**
 * Continúa una sesión de anticipo activa.
 * Retorna { respuesta: string, completada: boolean }
 */
export async function continuarAnticipo(
  session: AnticipoSession,
  mensaje: string
): Promise<{ respuesta: string; completada: boolean }> {
  const texto = mensaje.trim();

  if (session.state === "WAIT_DPI") {
    // Validar formato básico de DPI (mínimo 8 dígitos)
    const soloDigitos = texto.replace(/\s/g, "");
    if (!/^\d{8,15}$/.test(soloDigitos)) {
      return {
        respuesta:
          "❌ El DPI debe contener entre 8 y 15 dígitos numéricos.\n\nProporciona nuevamente tu *número de DPI*:",
        completada: false,
      };
    }
    updateSession(session.telefono, { dpi: soloDigitos, state: "WAIT_CANTIDAD" });
    return {
      respuesta:
        `✅ DPI registrado.\n\n` +
        "¿Cuánto anticipo necesitas? Indica el monto en *Quetzales* (solo el número, ej: *500*):",
      completada: false,
    };
  }

  if (session.state === "WAIT_CANTIDAD") {
    const cantidad = parseInt(texto.replace(/[Q,\s.]/gi, ""), 10);
    if (isNaN(cantidad) || cantidad <= 0) {
      return {
        respuesta:
          "❌ Indica un monto válido en Quetzales.\n\nEjemplos: *500*, *1500*, *2000*",
        completada: false,
      };
    }
    if (cantidad > 50000) {
      return {
        respuesta:
          "❌ El monto máximo por solicitud es de Q50,000.\n\nIndica un monto menor:",
        completada: false,
      };
    }

    // Obtener sesión actualizada (puede tener DPI recién ingresado)
    const sesActual = getSession(session.telefono) ?? session;

    // Crear anticipo en DB
    const [anticipo] = await db
      .insert(anticiposTable)
      .values({
        employeeId: sesActual.employeeId,
        nombre: sesActual.nombre,
        puesto: sesActual.puesto ?? null,
        dpi: sesActual.dpi ?? null,
        telefono: sesActual.telefono,
        cantidad,
        origen: "whatsapp",
        estado: "pendiente",
        periodo: sesActual.periodo,
        observaciones: `Solicitud vía WhatsApp. Período: ${sesActual.periodo}.`,
      })
      .returning();

    deleteSession(session.telefono);

    return {
      respuesta:
        `✅ *Solicitud registrada correctamente*\n\n` +
        `📌 Referencia: *ANT-${anticipo.id}*\n` +
        `👤 Colaborador: ${sesActual.nombre}\n` +
        `💰 Monto solicitado: *Q${cantidad.toLocaleString("es-GT")}*\n` +
        `📅 Período: ${sesActual.periodo.replace("-dia", " — día ")}\n\n` +
        "RRHH revisará tu solicitud en breve. ¡Gracias!",
      completada: true,
    };
  }

  return { respuesta: "Estado de sesión desconocido. Intenta nuevamente.", completada: false };
}
