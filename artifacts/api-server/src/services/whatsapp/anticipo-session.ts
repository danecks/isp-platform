/**
 * ANTICIPO SESSION MANAGER — Conversaciones multi-turno de WhatsApp
 *
 * Mantiene el estado de la conversación de anticipo por número de teléfono.
 * Estado en memoria (Phase 1). Las sesiones expiran en SESSION_TTL_MS.
 *
 * Flujo normal:
 *   WAIT_DPI       → colaborador proporciona su DPI
 *   WAIT_CANTIDAD  → colaborador proporciona el monto en Quetzales
 *
 * Flujo con límite excedido:
 *   WAIT_DPI       → (igual que arriba)
 *   WAIT_CANTIDAD  → se verifica el límite
 *   WAIT_LIMITE_OPCION → se le presenta el restante y elige:
 *                        1. Solicitar el restante disponible
 *                        2. Ingresar monto menor (vuelve a WAIT_CANTIDAD)
 *                        3. Cancelar
 */

import { db, employeesTable, anticiposTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { calcularLimiteAnticipo } from "../anticipo-limite";

// ── Configuración de períodos ───────────────────────────────────────────────
export const DIAS_HABILITADOS = [10, 25];
const TOLERANCIA_DIAS = 1;
const SESSION_TTL_MS = 30 * 60 * 1000;

// ── Estado de sesión ────────────────────────────────────────────────────────
export type SessionState = "WAIT_DPI" | "WAIT_CANTIDAD" | "WAIT_LIMITE_OPCION";

export interface AnticipoSession {
  state: SessionState;
  telefono: string;
  employeeId: number;
  nombre: string;
  puesto: string | null;
  dpi: string | null;
  periodo: string;
  lastActivity: number;
  // Contexto de límite (presente cuando state=WAIT_LIMITE_OPCION)
  limiteRestante?: number;
  limiteTotal?: number;
  montoSolicitado?: number;
}

const sessions = new Map<string, AnticipoSession>();

// ── Utilidades de período ───────────────────────────────────────────────────

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

export function getProximosDiasHabilitados(): string {
  const hoy = new Date();
  const dia = hoy.getDate();
  const diasPendientes = DIAS_HABILITADOS.filter((d) => d > dia);
  if (diasPendientes.length > 0) return `el día ${diasPendientes[0]} de este mes`;
  const mesProx = new Date(hoy.getFullYear(), hoy.getMonth() + 1, DIAS_HABILITADOS[0]);
  return `el día ${DIAS_HABILITADOS[0]} del próximo mes`;
}

// ── Normalización de teléfono ───────────────────────────────────────────────
export function normalizarTelefono(tel: string): string {
  return tel.replace(/\D/g, "");
}

// ── Validaciones ────────────────────────────────────────────────────────────

export async function buscarEmpleadoPorTelefono(telefono: string) {
  const telNorm = normalizarTelefono(telefono);
  const empleados = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.estadoLaboral, "activo"));
  return empleados.find((e) => e.telefono && normalizarTelefono(e.telefono) === telNorm) ?? null;
}

export async function existeSolicitudPendiente(employeeId: number, periodo: string): Promise<boolean> {
  const existente = await db
    .select({ id: anticiposTable.id })
    .from(anticiposTable)
    .where(and(
      eq(anticiposTable.employeeId, employeeId),
      eq(anticiposTable.periodo, periodo),
      eq(anticiposTable.estado, "pendiente")
    ))
    .limit(1);
  return existente.length > 0;
}

// ── Gestión de sesiones ─────────────────────────────────────────────────────

export function getSession(telefono: string): AnticipoSession | null {
  const s = sessions.get(normalizarTelefono(telefono));
  if (!s) return null;
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

// ── Guardar anticipo en DB ──────────────────────────────────────────────────

async function guardarAnticipo(sesActual: AnticipoSession, cantidad: number) {
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
  return anticipo;
}

// ── Procesamiento principal ─────────────────────────────────────────────────

export async function iniciarAnticipo(nombre: string, telefono: string): Promise<string> {
  const empleado = await buscarEmpleadoPorTelefono(telefono);
  if (!empleado) {
    return (
      "⛔ Tu número de WhatsApp no está registrado como colaborador de ISP, S.A.\n\n" +
      "Si crees que es un error, comunícate con RRHH."
    );
  }

  const periodo = getPeriodoActivo();
  if (!periodo) {
    const proximo = getProximosDiasHabilitados();
    return (
      "📅 El período de solicitud de anticipos no está habilitado.\n\n" +
      `Puedes solicitar tu anticipo *${proximo}*.\n` +
      `Días habilitados: ${DIAS_HABILITADOS.map((d) => `día ${d}`).join(" y ")} de cada mes.`
    );
  }

  const hayDuplicado = await existeSolicitudPendiente(empleado.id, periodo);
  if (hayDuplicado) {
    return (
      "⚠️ Ya tienes una solicitud de anticipo *pendiente* para este período.\n\n" +
      "Espera a que RRHH la revise antes de enviar otra."
    );
  }

  // Verificar si ya tiene saldo disponible
  const limite = await calcularLimiteAnticipo(empleado.id, periodo);
  if (limite.tieneLimite && limite.restante !== null && limite.restante <= 0) {
    return (
      "⛔ Ya no tienes *saldo disponible* para solicitar anticipo en este período.\n\n" +
      `Límite: Q${limite.limite?.toLocaleString("es-GT")}\n` +
      `Solicitado: Q${limite.solicitado.toLocaleString("es-GT")}\n\n` +
      "Comunícate con RRHH si necesitas un ajuste."
    );
  }

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

  const infoLimite =
    limite.tieneLimite && limite.restante !== null
      ? `\n💵 Saldo disponible: *Q${limite.restante.toLocaleString("es-GT")}*`
      : "";

  if (necesitaDpi) {
    return (
      `✅ Hola *${empleado.nombreCompleto}*, vamos a registrar tu solicitud de anticipo.\n\n` +
      `📋 Período: ${periodo.replace("-dia", " — día ")}${infoLimite}\n\n` +
      "Para verificar tu identidad, proporciona tu *número de DPI*:"
    );
  } else {
    return (
      `✅ Hola *${empleado.nombreCompleto}*, vamos a registrar tu solicitud de anticipo.\n\n` +
      `📋 Período: ${periodo.replace("-dia", " — día ")}\n` +
      `💼 Puesto: ${empleado.puesto ?? "N/D"}${infoLimite}\n\n` +
      "¿Cuánto anticipo necesitas? Indica el monto en *Quetzales* (solo el número, ej: *500*):"
    );
  }
}

export async function continuarAnticipo(
  session: AnticipoSession,
  mensaje: string
): Promise<{ respuesta: string; completada: boolean }> {
  const texto = mensaje.trim();

  // ── WAIT_DPI ────────────────────────────────────────────────────────────
  if (session.state === "WAIT_DPI") {
    const soloDigitos = texto.replace(/\s/g, "");
    if (!/^\d{8,15}$/.test(soloDigitos)) {
      return {
        respuesta: "❌ El DPI debe contener entre 8 y 15 dígitos numéricos.\n\nProporciona nuevamente tu *número de DPI*:",
        completada: false,
      };
    }
    updateSession(session.telefono, { dpi: soloDigitos, state: "WAIT_CANTIDAD" });
    return {
      respuesta:
        "✅ DPI registrado.\n\n" +
        "¿Cuánto anticipo necesitas? Indica el monto en *Quetzales* (solo el número, ej: *500*):",
      completada: false,
    };
  }

  // ── WAIT_CANTIDAD ───────────────────────────────────────────────────────
  if (session.state === "WAIT_CANTIDAD") {
    const cantidad = parseInt(texto.replace(/[Q,\s.]/gi, ""), 10);
    if (isNaN(cantidad) || cantidad <= 0) {
      return {
        respuesta: "❌ Indica un monto válido en Quetzales.\n\nEjemplos: *500*, *1500*, *2000*",
        completada: false,
      };
    }
    if (cantidad > 50000) {
      return {
        respuesta: "❌ El monto máximo por solicitud es de Q50,000.\n\nIndica un monto menor:",
        completada: false,
      };
    }

    const sesActual = getSession(session.telefono) ?? session;

    // Verificar límite del colaborador
    const limite = await calcularLimiteAnticipo(sesActual.employeeId, sesActual.periodo);
    if (limite.tieneLimite && limite.restante !== null && cantidad > limite.restante) {
      if (limite.restante <= 0) {
        deleteSession(session.telefono);
        return {
          respuesta:
            "⛔ Ya no tienes *saldo disponible* para este período.\n\n" +
            `Límite: Q${limite.limite?.toLocaleString("es-GT")}\n` +
            `Solicitado: Q${limite.solicitado.toLocaleString("es-GT")}\n\n` +
            "Comunícate con RRHH si necesitas un ajuste.",
          completada: false,
        };
      }

      // Ofrecer opciones al colaborador
      updateSession(session.telefono, {
        state: "WAIT_LIMITE_OPCION",
        limiteRestante: limite.restante,
        limiteTotal: limite.limite ?? 0,
        montoSolicitado: cantidad,
      });

      return {
        respuesta:
          `⚠️ Tu *saldo disponible* para este período es de *Q${limite.restante.toLocaleString("es-GT")}*.\n` +
          `(Límite: Q${limite.limite?.toLocaleString("es-GT")} · Ya solicitado: Q${limite.solicitado.toLocaleString("es-GT")})\n\n` +
          "¿Qué deseas hacer?\n" +
          `*1.* Solicitar el disponible (*Q${limite.restante.toLocaleString("es-GT")}*)\n` +
          "*2.* Ingresar un monto menor\n" +
          "*3.* Cancelar la solicitud",
        completada: false,
      };
    }

    // Sin límite o dentro del límite — guardar
    const anticipo = await guardarAnticipo(sesActual, cantidad);
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

  // ── WAIT_LIMITE_OPCION ──────────────────────────────────────────────────
  if (session.state === "WAIT_LIMITE_OPCION") {
    const sesActual = getSession(session.telefono) ?? session;
    const restante = sesActual.limiteRestante ?? 0;
    const textoNorm = texto.toLowerCase().replace(/[áéíóúü]/g, (c) =>
      ({ á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u" }[c] ?? c)
    );

    // Opción 3 — cancelar
    if (["3", "cancelar", "cancel", "no", "salir"].includes(textoNorm)) {
      deleteSession(session.telefono);
      return {
        respuesta: "✅ Solicitud cancelada. Puedes iniciar una nueva cuando desees.",
        completada: false,
      };
    }

    // Opción 2 — ingresar monto menor (vuelve a WAIT_CANTIDAD)
    if (["2", "otro", "otro monto", "menor", "cambiar"].includes(textoNorm)) {
      updateSession(session.telefono, { state: "WAIT_CANTIDAD" });
      return {
        respuesta:
          `Indica el monto que deseas solicitar (máximo *Q${restante.toLocaleString("es-GT")}*):`,
        completada: false,
      };
    }

    // Opción 1 — solicitar el restante, o el número exacto restante, o "sí/si/acepto"
    let montoAceptado: number | null = null;

    if (["1", "si", "sí", "acepto", "ok", "listo", "adelante"].includes(textoNorm)) {
      montoAceptado = restante;
    } else {
      // ¿escribió un número directamente?
      const n = parseInt(textoNorm.replace(/[q,\s.]/gi, ""), 10);
      if (!isNaN(n) && n > 0 && n <= restante) {
        montoAceptado = n;
      } else if (!isNaN(n) && n > restante) {
        return {
          respuesta:
            `❌ El monto Q${n} sigue excediendo tu saldo disponible de *Q${restante.toLocaleString("es-GT")}*.\n\n` +
            "Indica un monto menor o responde *3* para cancelar:",
          completada: false,
        };
      }
    }

    if (montoAceptado !== null) {
      const anticipo = await guardarAnticipo(sesActual, montoAceptado);
      deleteSession(session.telefono);
      return {
        respuesta:
          `✅ *Solicitud registrada correctamente*\n\n` +
          `📌 Referencia: *ANT-${anticipo.id}*\n` +
          `👤 Colaborador: ${sesActual.nombre}\n` +
          `💰 Monto solicitado: *Q${montoAceptado.toLocaleString("es-GT")}*\n` +
          `📅 Período: ${sesActual.periodo.replace("-dia", " — día ")}\n\n` +
          "RRHH revisará tu solicitud en breve. ¡Gracias!",
        completada: true,
      };
    }

    // Respuesta no reconocida
    return {
      respuesta:
        `No entendí tu respuesta. Por favor elige una opción:\n\n` +
        `*1.* Solicitar Q${restante.toLocaleString("es-GT")} (disponible)\n` +
        "*2.* Ingresar un monto menor\n" +
        "*3.* Cancelar",
      completada: false,
    };
  }

  return { respuesta: "Estado de sesión desconocido. Intenta nuevamente.", completada: false };
}
