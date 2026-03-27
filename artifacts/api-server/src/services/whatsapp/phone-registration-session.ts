/**
 * PHONE REGISTRATION SESSION — ISP, S.A.
 *
 * Flujo de autenticación por DPI y registro de número de WhatsApp
 * para colaboradores que acceden desde un número no registrado.
 *
 * ─── FLUJO COMPLETO ──────────────────────────────────────────────────────────
 *
 *  1. Número desconocido intenta función interna (anticipo, incidencia, etc.)
 *     → Bot solicita DPI → inicia sesión en estado WAIT_DPI
 *
 *  2. Colaborador envía su DPI
 *     → Se valida contra employees (DPI + estadoLaboral='activo')
 *     → Si inválido: aviso + reintento (máx. 3 intentos)
 *     → Si válido:
 *         a) Sin número previo  → estado WAIT_CONFIRM (¿Registrar? SI / NO)
 *         b) Con número previo  → estado WAIT_REPLACE (opciones 1/2/3)
 *
 *  3a. Responde SI → Registra número, marca wa_autorizado=TRUE
 *  3b. Responde NO → Sesión temporal, sin cambio en DB
 *
 *  4. Con número previo:
 *      1 = Reemplazar: mueve anterior a telefono_secundario, nuevo como principal
 *      2 = Secundario: guarda nuevo en telefono_secundario (solo referencia)
 *      3 = Cancelar: no cambia nada, acceso temporal
 *
 * ─── DECISIÓN DE DISEÑO — Número previo ─────────────────────────────────────
 *   Se pregunta en lugar de sobrescribir silenciosamente.
 *   El número anterior se muestra enmascarado (***XXXX) por seguridad.
 *   Si se reemplaza, el anterior queda en telefono_secundario para auditoría.
 *
 * ─── AUDITORÍA ───────────────────────────────────────────────────────────────
 *   Cada intento se registra en phone_auth_log con:
 *   - empleado_id, user_id, dpi(parcial), numero_anterior, numero_nuevo
 *   - accion: 'autorizado'|'reemplazo'|'secundario'|'no_autorizado'|
 *             'cancelado'|'max_intentos'
 *   - metodo_validacion = 'dpi'
 *
 * ─── UTILIDAD PARA DEPURACIÓN DE BASE DE TELÉFONOS ──────────────────────────
 *   Permite corregir/agregar teléfonos de colaboradores de forma auditable,
 *   validando la identidad con DPI en lugar de requerir intervención manual.
 */

import { pool } from "@workspace/db";
import { getWaMessage } from "./wa-config.service";
import { logger } from "../../lib/logger";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PhoneRegState = "WAIT_DPI" | "WAIT_CONFIRM" | "WAIT_REPLACE";

export interface PhoneRegSession {
  telefono: string;          // Nuevo número no registrado
  nombre: string;
  state: PhoneRegState;
  intentos: number;          // Intentos de DPI fallidos
  empleadoId?: number;
  empleadoNombre?: string;
  userId?: number;           // users.id si existe vínculo
  dpiValidado?: string;      // DPI exitoso (parcial en logs)
  telefonoAnterior?: string; // Teléfono previo (si lo había)
  intencionOriginal: string; // anticipo | incidencia | etc.
  lastActivity: number;
}

// ─── Configuración ────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 20 * 60 * 1000; // 20 min inactividad
const MAX_INTENTOS = 3;

const regSessions = new Map<string, PhoneRegSession>();

// ─── Normalización ────────────────────────────────────────────────────────────

function normTel(tel: string): string {
  return tel.replace(/[\s\-\(\)\+]/g, "");
}

function normResp(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ─── Gestión de sesiones ──────────────────────────────────────────────────────

export function getPhoneRegSession(telefono: string): PhoneRegSession | null {
  const key = normTel(telefono);
  const s = regSessions.get(key);
  if (!s) return null;
  if (Date.now() - s.lastActivity > SESSION_TTL_MS) {
    regSessions.delete(key);
    return null;
  }
  return s;
}

export function startPhoneRegSession(
  telefono: string,
  nombre: string,
  intencionOriginal: string
): PhoneRegSession {
  const session: PhoneRegSession = {
    telefono: normTel(telefono),
    nombre,
    state: "WAIT_DPI",
    intentos: 0,
    intencionOriginal,
    lastActivity: Date.now(),
  };
  regSessions.set(normTel(telefono), session);
  logger.info({ telefono: normTel(telefono), intencionOriginal }, "[PhoneReg] Sesión iniciada");
  return session;
}

function updatePhoneReg(telefono: string, updates: Partial<PhoneRegSession>): void {
  const key = normTel(telefono);
  const s = regSessions.get(key);
  if (s) {
    Object.assign(s, updates, { lastActivity: Date.now() });
    regSessions.set(key, s);
  }
}

export function clearPhoneRegSession(telefono: string): void {
  regSessions.delete(normTel(telefono));
}

// ─── DB: buscar empleado por DPI ─────────────────────────────────────────────

async function buscarEmpleadoPorDPI(dpi: string): Promise<{
  id: number;
  nombre_completo: string;
  dpi: string;
  telefono: string | null;
  estado_laboral: string;
} | null> {
  const { rows } = await pool.query(
    `SELECT id, nombre_completo, dpi, telefono, estado_laboral
     FROM employees
     WHERE dpi = $1 AND estado_laboral = 'activo'
     LIMIT 1`,
    [dpi.replace(/\s/g, "")]
  );
  return rows[0] ?? null;
}

// ─── DB: buscar usuario vinculado al empleado ─────────────────────────────────

async function buscarUsuarioPorEmpleadoId(empleadoId: number): Promise<{
  id: number;
  estado: string;
  telefono: string | null;
  rol: string;
} | null> {
  const { rows } = await pool.query(
    `SELECT id, estado, telefono, rol
     FROM users
     WHERE employee_id = $1
     LIMIT 1`,
    [empleadoId]
  );
  return rows[0] ?? null;
}

// ─── DB: crear usuario nuevo para empleado sin cuenta ─────────────────────────

async function crearUsuarioDesdeEmpleado(
  empleadoId: number,
  nombreCompleto: string,
  telefono: string
): Promise<number> {
  const base = nombreCompleto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 10);
  const username = `${base}${Date.now().toString().slice(-4)}`;

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users
       (nombre, username, password, rol, estado, telefono, employee_id,
        wa_autorizado, auth_source, created_at, updated_at)
     VALUES ($1, $2, $3, 'guardia', 'activo', $4, $5,
             TRUE, 'dpi', NOW(), NOW())
     RETURNING id`,
    [nombreCompleto, username, "PENDIENTE_CAMBIO", telefono, empleadoId]
  );
  logger.info({ empleadoId, userId: rows[0].id }, "[PhoneReg] Usuario guardia creado");
  return rows[0].id;
}

// ─── DB: registrar teléfono como principal ────────────────────────────────────

async function guardarTelefonoPrincipal(
  empleadoId: number,
  userId: number,
  telefonoNuevo: string,
  dpi: string,
  telefonoAnterior: string | null
): Promise<void> {
  // Actualizar employees.telefono
  await pool.query(
    `UPDATE employees SET telefono = $1 WHERE id = $2`,
    [telefonoNuevo, empleadoId]
  );

  // Actualizar users: nuevo teléfono principal + campos de autorización WA
  await pool.query(
    `UPDATE users
     SET telefono = $1,
         wa_autorizado = TRUE,
         telefono_verificado_at = NOW(),
         last_phone_update_at = NOW(),
         auth_source = 'dpi',
         updated_at = NOW()
     WHERE id = $2`,
    [telefonoNuevo, userId]
  );

  // Si había un teléfono anterior distinto, guardarlo como secundario
  if (telefonoAnterior && telefonoAnterior !== telefonoNuevo) {
    await pool.query(
      `UPDATE users SET telefono_secundario = $1 WHERE id = $2`,
      [telefonoAnterior, userId]
    );
  }

  const accion = telefonoAnterior ? "reemplazo" : "autorizado";
  await logPhoneAuth({
    userId,
    empleadoId,
    dpi,
    numeroAnterior: telefonoAnterior,
    numeroNuevo: telefonoNuevo,
    accion,
    notas: telefonoAnterior
      ? `Reemplazó ${telefonoAnterior}`
      : "Registro inicial vía DPI",
  });
}

// ─── DB: registrar teléfono como secundario ───────────────────────────────────

async function guardarTelefonoSecundario(
  empleadoId: number,
  userId: number,
  telefonoNuevo: string,
  dpi: string,
  telefonoPrincipal: string
): Promise<void> {
  await pool.query(
    `UPDATE users
     SET telefono_secundario = $1,
         last_phone_update_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [telefonoNuevo, userId]
  );

  await logPhoneAuth({
    userId,
    empleadoId,
    dpi,
    numeroAnterior: telefonoPrincipal,
    numeroNuevo: telefonoNuevo,
    accion: "secundario",
    notas: `Secundario registrado. Principal mantiene: ${telefonoPrincipal}`,
  });
}

// ─── DB: auditoría ────────────────────────────────────────────────────────────

async function logPhoneAuth(params: {
  userId: number | null;
  empleadoId: number;
  dpi: string;
  numeroAnterior: string | null;
  numeroNuevo: string;
  accion: "autorizado" | "reemplazo" | "secundario" | "no_autorizado" | "cancelado" | "max_intentos";
  notas?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO phone_auth_log
       (user_id, empleado_id, dpi, numero_anterior, numero_nuevo, accion, metodo_validacion, notas)
     VALUES ($1, $2, $3, $4, $5, $6, 'dpi', $7)`,
    [
      params.userId,
      params.empleadoId,
      params.dpi.replace(/\D/g, "").substring(0, 8) + "****",
      params.numeroAnterior,
      params.numeroNuevo,
      params.accion,
      params.notas ?? null,
    ]
  );
}

// ─── Máquina de estados ───────────────────────────────────────────────────────

/**
 * Procesa el siguiente paso del flujo de registro de número.
 * Se invoca cuando existe una sesión PhoneReg activa para el teléfono.
 */
export async function procesarPhoneRegStep(
  session: PhoneRegSession,
  texto: string
): Promise<{ tipo: string; respuesta: string }> {

  const dpiInput = texto.trim().replace(/\s/g, "");
  const resp = normResp(texto);

  // ── ESTADO: WAIT_DPI ──────────────────────────────────────────────────────
  if (session.state === "WAIT_DPI") {

    // Validar formato
    if (!/^\d{8,15}$/.test(dpiInput)) {
      const intentos = session.intentos + 1;
      updatePhoneReg(session.telefono, { intentos });
      if (intentos >= MAX_INTENTOS) {
        clearPhoneRegSession(session.telefono);
        return {
          tipo: "dpi_max_intentos",
          respuesta: await getWaMessage(
            "wa_dpi_max_intentos",
            "🔒 Máximo de intentos alcanzado. Por seguridad la sesión fue cancelada.\n\nContacta a tu supervisor o a RRHH para acceder al sistema."
          ),
        };
      }
      const restantes = MAX_INTENTOS - intentos;
      return {
        tipo: "dpi_formato_invalido",
        respuesta: await getWaMessage(
          "wa_dpi_invalido",
          `❌ El DPI debe contener entre 8 y 15 dígitos.\n\nIntentos restantes: ${restantes}. Envía tu DPI:`
        ).then(m => m.replace("{restantes}", String(restantes))),
      };
    }

    // Buscar empleado
    const empleado = await buscarEmpleadoPorDPI(dpiInput);

    if (!empleado) {
      const intentos = session.intentos + 1;
      updatePhoneReg(session.telefono, { intentos });

      if (intentos >= MAX_INTENTOS) {
        clearPhoneRegSession(session.telefono);
        await logPhoneAuth({
          userId: null, empleadoId: 0, dpi: dpiInput,
          numeroAnterior: null, numeroNuevo: session.telefono,
          accion: "max_intentos",
          notas: "DPI no encontrado en 3 intentos",
        }).catch(() => {});
        return {
          tipo: "dpi_max_intentos",
          respuesta: await getWaMessage(
            "wa_dpi_max_intentos",
            "🔒 No encontramos ese DPI en nuestro sistema tras 3 intentos.\n\nContacta a RRHH para verificar tus datos."
          ),
        };
      }

      const restantes = MAX_INTENTOS - intentos;
      return {
        tipo: "dpi_no_encontrado",
        respuesta: `❌ No encontramos ese DPI. Verifica el número e intenta de nuevo.\n(${restantes} intento${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""})`,
      };
    }

    // ✅ DPI válido — verificar usuario vinculado
    const usuarioVinculado = await buscarUsuarioPorEmpleadoId(empleado.id);

    if (usuarioVinculado && usuarioVinculado.estado !== "activo") {
      clearPhoneRegSession(session.telefono);
      return {
        tipo: "empleado_inactivo",
        respuesta:
          "🚫 Tu cuenta de colaborador está desactivada.\n\n" +
          "Contacta a tu supervisor o a RRHH para reactivar tu acceso.",
      };
    }

    const telAnterior = usuarioVinculado?.telefono ?? empleado.telefono ?? null;
    const hayTelPrevio = telAnterior && normTel(telAnterior) !== normTel(session.telefono);

    if (hayTelPrevio) {
      // Tiene número diferente → preguntar
      updatePhoneReg(session.telefono, {
        state: "WAIT_REPLACE",
        empleadoId: empleado.id,
        empleadoNombre: empleado.nombre_completo,
        userId: usuarioVinculado?.id ?? undefined,
        dpiValidado: dpiInput,
        telefonoAnterior: telAnterior!,
      });

      const mask = `***${telAnterior!.slice(-4)}`;
      const msg = await getWaMessage(
        "wa_dpi_numero_anterior",
        `✅ Identidad verificada como *{nombre}*.\n\n` +
        `Ya tienes registrado el número ${mask}.\n\n` +
        "¿Qué deseas hacer con este nuevo número?\n\n" +
        "1️⃣ Reemplazar el número anterior\n" +
        "2️⃣ Guardar como número secundario\n" +
        "3️⃣ Cancelar\n\nResponde 1, 2 o 3."
      );
      return {
        tipo: "dpi_valido_numero_previo",
        respuesta: msg
          .replace("{nombre}", empleado.nombre_completo)
          .replace("{anterior}", mask),
      };
    }

    // Sin número previo → preguntar SI/NO
    updatePhoneReg(session.telefono, {
      state: "WAIT_CONFIRM",
      empleadoId: empleado.id,
      empleadoNombre: empleado.nombre_completo,
      userId: usuarioVinculado?.id ?? undefined,
      dpiValidado: dpiInput,
      telefonoAnterior: null,
    });

    const msg = await getWaMessage(
      "wa_dpi_valido_registrar",
      `✅ Identidad verificada como *{nombre}*.\n\n` +
      "¿Deseas registrar este número como tu número autorizado de WhatsApp?\n\n" +
      "Responde *SI* para registrar o *NO* para continuar sin guardar."
    );
    return {
      tipo: "dpi_valido_sin_numero_previo",
      respuesta: msg.replace("{nombre}", empleado.nombre_completo),
    };
  }

  // ── ESTADO: WAIT_CONFIRM (SI / NO) ────────────────────────────────────────
  if (session.state === "WAIT_CONFIRM") {
    if (resp === "si" || resp === "yes" || resp === "1") {
      let userId = session.userId;
      if (!userId) {
        userId = await crearUsuarioDesdeEmpleado(
          session.empleadoId!, session.empleadoNombre!, session.telefono
        );
      }
      await guardarTelefonoPrincipal(
        session.empleadoId!, userId, session.telefono, session.dpiValidado!, null
      );
      clearPhoneRegSession(session.telefono);
      return {
        tipo: "numero_registrado",
        respuesta: await getWaMessage(
          "wa_numero_registrado_ok",
          "✅ ¡Número registrado exitosamente!\n\n" +
          "A partir de ahora puedes usar todas las funciones de ISP desde este número. " +
          "Puedes continuar con tu solicitud."
        ),
      };
    }

    if (resp === "no" || resp === "2") {
      await logPhoneAuth({
        userId: session.userId ?? null,
        empleadoId: session.empleadoId!,
        dpi: session.dpiValidado!,
        numeroAnterior: null,
        numeroNuevo: session.telefono,
        accion: "no_autorizado",
        notas: "Colaborador declinó registrar el número",
      });
      clearPhoneRegSession(session.telefono);
      return {
        tipo: "numero_no_guardado",
        respuesta: await getWaMessage(
          "wa_numero_no_guardado",
          "Entendido. El número no fue guardado.\n\n" +
          "Tienes acceso temporal por esta sesión. Puedes continuar con tu solicitud."
        ),
      };
    }

    return {
      tipo: "esperando_si_no",
      respuesta: "Por favor responde *SI* para registrar el número o *NO* para continuar sin guardar.",
    };
  }

  // ── ESTADO: WAIT_REPLACE (1 / 2 / 3) ─────────────────────────────────────
  if (session.state === "WAIT_REPLACE") {
    if (resp === "1" || resp.includes("reemplaz")) {
      let userId = session.userId;
      if (!userId) {
        userId = await crearUsuarioDesdeEmpleado(
          session.empleadoId!, session.empleadoNombre!, session.telefono
        );
      }
      await guardarTelefonoPrincipal(
        session.empleadoId!, userId, session.telefono,
        session.dpiValidado!, session.telefonoAnterior!
      );
      clearPhoneRegSession(session.telefono);
      const mask = `***${session.telefonoAnterior!.slice(-4)}`;
      return {
        tipo: "numero_reemplazado",
        respuesta: await getWaMessage(
          "wa_numero_reemplazado_ok",
          `✅ Número actualizado exitosamente.\n\nEl número anterior (${mask}) fue guardado como referencia.\nPuedes continuar con tu solicitud.`
        ).then(m => m.replace("{anterior}", mask)),
      };
    }

    if (resp === "2" || resp.includes("secundar")) {
      let userId = session.userId;
      if (!userId) {
        userId = await crearUsuarioDesdeEmpleado(
          session.empleadoId!, session.empleadoNombre!, session.telefono
        );
      }
      await guardarTelefonoSecundario(
        session.empleadoId!, userId, session.telefono,
        session.dpiValidado!, session.telefonoAnterior!
      );
      clearPhoneRegSession(session.telefono);
      return {
        tipo: "numero_secundario",
        respuesta: await getWaMessage(
          "wa_numero_secundario_ok",
          "✅ Número guardado como referencia secundaria.\n\nTu número principal no fue modificado. Tienes acceso temporal."
        ),
      };
    }

    if (resp === "3" || resp.includes("cancelar")) {
      await logPhoneAuth({
        userId: session.userId ?? null,
        empleadoId: session.empleadoId!,
        dpi: session.dpiValidado!,
        numeroAnterior: session.telefonoAnterior!,
        numeroNuevo: session.telefono,
        accion: "cancelado",
        notas: "Colaborador canceló el registro",
      });
      clearPhoneRegSession(session.telefono);
      return {
        tipo: "registro_cancelado",
        respuesta: await getWaMessage(
          "wa_registro_cancelado",
          "Registro cancelado. Tu número anterior no fue modificado.\n\nTienes acceso temporal por esta sesión."
        ),
      };
    }

    return {
      tipo: "esperando_opcion_reemplazo",
      respuesta: "Responde:\n*1* para reemplazar\n*2* para secundario\n*3* para cancelar",
    };
  }

  clearPhoneRegSession(session.telefono);
  return {
    tipo: "estado_desconocido",
    respuesta: "Sesión de verificación expirada. Intenta nuevamente.",
  };
}
