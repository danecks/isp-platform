import { Router } from "express";
import { db, incidentsTable, leadsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { puestoCubiertoSql } from "../lib/cobertura-puesto";
import {
  classifyMessage,
  extractPhoneFromWaId,
  INTERNAL_INTENTS,
  type MessageClassification,
} from "../services/whatsapp/classifier";
import {
  getSession,
  iniciarAnticipo,
  continuarAnticipo,
} from "../services/whatsapp/anticipo-session";
import {
  getPhoneRegSession,
  startPhoneRegSession,
  procesarPhoneRegStep,
} from "../services/whatsapp/phone-registration-session";
import { enviarTextoWA, marcarLeidoWA, waCredsStatus } from "../services/whatsapp/wa-sender";
import { pool } from "@workspace/db";

function kioskoUrl(): string {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "https://ispsa.net";
  return `${base}/kiosko`;
}

// Crea una incidencia desde un reporte público enviado por WhatsApp con el
// marcador `[ISP-CARNET:<token>]`. Resuelve el agente vía qr_token, enriquece
// con el puesto actual y guarda en `incidents` con origen='carnet_publico_wa'.
async function crearIncidenciaDesdeCarnet(args: {
  token: string;
  descripcion: string;
  telefonoReporte: string;
  nombreReporte: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { rows: tkRows } = await pool.query(
    `SELECT aqt.employee_id, aqt.activo, e.nombre_completo, e.puesto AS cargo
     FROM agente_qr_tokens aqt
     JOIN employees e ON e.id = aqt.employee_id
     WHERE aqt.qr_token = $1`,
    [args.token]
  );
  if (!tkRows[0]) return { ok: false, error: "Carnet no reconocido." };
  if (!tkRows[0].activo) return { ok: false, error: "Carnet desactivado." };

  const emp = tkRows[0];

  const { rows: poRows } = await pool.query(
    `SELECT id, nombre, cliente_nombre, cliente_id, sede_id
     FROM puestos_operativos
     WHERE agente_id = $1 AND ${puestoCubiertoSql("puestos_operativos")}
     LIMIT 1`,
    [emp.employee_id]
  );
  const puesto = poRows[0] ?? null;

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  const id = `INC-${yy}${mm}${dd}-${rand}`;

  await pool.query(
    `INSERT INTO incidents
       (id, origen, cliente, ubicacion, tipo, prioridad, estado,
        responsable, descripcion, es_emergencia, reportado_por,
        puesto_id, client_id, sede_id, responsable_id)
     VALUES ($1, 'carnet_publico_wa', $2, $3, 'Reporte ciudadano sobre agente',
             'media', 'abierta', 'Sin asignar', $4, false, $5, $6, $7, $8, $9)`,
    [
      id,
      puesto?.cliente_nombre ?? "—",
      puesto?.nombre ?? "Vía pública / sin puesto asignado",
      `Reporte sobre el agente ${emp.nombre_completo}${emp.cargo ? ` (${emp.cargo})` : ""}.\n\n${args.descripcion}`,
      `${args.nombreReporte} (WhatsApp ${args.telefonoReporte})`,
      puesto?.id ?? null,
      puesto?.cliente_id ?? null,
      puesto?.sede_id ?? null,
      emp.employee_id,
    ]
  );

  return { ok: true, id };
}

const router = Router();

interface WaContact {
  profile: { name: string };
  wa_id: string;
}

interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WaChangeValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WaContact[];
  messages?: WaMessage[];
}

interface WaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{ value: WaChangeValue; field: string }>;
  }>;
}

function generateWaIncidentId(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `WA-${yy}${mm}${dd}-${rand}`;
}

/**
 * Busca el mensaje configurable en wa_messages por clave.
 * Si no existe, devuelve el fallback.
 */
async function getWaMessage(clave: string, fallback: string): Promise<string> {
  try {
    const result = await pool.query(
      "SELECT texto FROM wa_messages WHERE clave = $1 LIMIT 1",
      [clave]
    );
    return result.rows[0]?.texto ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Valida si el número de teléfono está registrado y activo en el sistema.
 */
async function validarNumeroWA(
  telefono: string
): Promise<{ autorizado: boolean; motivo?: string; usuario?: typeof usersTable.$inferSelect }> {
  try {
    const [usuario] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telefono, telefono))
      .limit(1);

    if (!usuario) {
      return { autorizado: false, motivo: "no_registrado" };
    }
    if (usuario.estado !== "activo") {
      return { autorizado: false, motivo: "inactivo", usuario };
    }
    return { autorizado: true, usuario };
  } catch (err) {
    console.error("[WA-Webhook] Error al validar número:", err);
    // Si la BD falla (timeout, conexión muerta), asumir número desconocido
    // para que al menos responda con menú externo en lugar de quedarse mudo.
    return { autorizado: false, motivo: "no_registrado" };
  }
}

async function processIncidencia(
  nombre: string,
  _telefono: string,
  mensaje: string,
  waMessageId: string
) {
  const id = generateWaIncidentId();
  const inserted = await db
    .insert(incidentsTable)
    .values({
      id,
      cliente: nombre,
      tipo: "Alerta WhatsApp",
      origen: "whatsapp",
      ubicacion: "Por confirmar",
      prioridad: "alta",
      estado: "abierta",
      responsable: "Sin asignar",
      descripcion: `[WA:${waMessageId.slice(0, 30)}] ${mensaje}`,
    })
    .returning();
  const respuesta = await getWaMessage(
    "incidencia_recibida",
    `🚨 Recibimos tu reporte (ID ${inserted[0].id}). Nuestro equipo de operaciones lo está atendiendo. Si es una emergencia inmediata, llama al *(502) 2220-0000*.`
  );
  return { tabla: "incidentes", id: inserted[0].id, respuesta };
}

async function processPostulacion(
  _nombre: string,
  _telefono: string,
  _mensaje: string
) {
  // Por política: NO crear application automática desde WA.
  // Redirigimos al kiosko para que complete la solicitud formal.
  const respuesta = await getWaMessage(
    "postulacion_redirect_kiosko",
    `👷 ¡Gracias por tu interés en trabajar con ISP!\n\n` +
    `Para postular, completa tu solicitud aquí (te tomará ~5 minutos):\n` +
    `${kioskoUrl()}\n\n` +
    `Llena tus datos personales, experiencia y adjunta tu DPI. Nuestro equipo de RRHH te contactará pronto.`
  );
  return { tabla: "postulaciones", id: undefined, respuesta };
}

async function processLead(
  nombre: string,
  telefono: string,
  mensaje: string,
  canal = "whatsapp"
) {
  const inserted = await db
    .insert(leadsTable)
    .values({
      empresa: nombre,
      contacto: nombre,
      telefono,
      correo: null,
      servicio: "Por definir",
      ubicacion: "Guatemala",
      canal,
      notas: mensaje,
    })
    .returning();
  return { tabla: "leads", id: inserted[0].id };
}

/**
 * Procesa un mensaje entrante de WhatsApp.
 *
 * ─── LÓGICA DE ACCESO ────────────────────────────────────────────────────────
 *
 * Número DESCONOCIDO (no registrado):
 *   · Clasifica la intención primero
 *   · Si intenta función INTERNA (anticipo, incidencia) →
 *       responde "no autorizado para función interna" + menú de alternativas externas
 *   · Si saluda sin intención clara → menú de bienvenida externo
 *   · Para cualquier otra intención (lead, postulacion, info, contacto) →
 *       procesa normalmente (crea lead / postulación)
 *
 * Usuario INACTIVO:
 *   · Bloqueo total con mensaje de cuenta desactivada
 *
 * Usuario REGISTRADO y ACTIVO:
 *   · Flujo normal completo (anticipo, incidencia, etc.)
 *
 * @param skipValidation - Si es true, omite la validación de número (simulaciones)
 */
async function handleIncomingMessage(
  nombre: string,
  telefono: string,
  texto: string,
  waMessageId: string,
  skipValidation = false
): Promise<{ tipo: string; id?: string | number; respuesta?: string }> {

  // 0a. ¿Hay sesión de registro de teléfono (DPI) activa para este número?
  //     Se verifica ANTES de la validación para permitir que números desconocidos
  //     continúen el flujo multi-turno de registro.
  if (!skipValidation) {
    const regSession = await getPhoneRegSession(telefono);
    if (regSession) {
      console.log(`[WA-Webhook] Sesión PhoneReg activa (${telefono}), estado=${regSession.state}`);
      const resultado = await procesarPhoneRegStep(regSession, texto);
      return { tipo: resultado.tipo, respuesta: resultado.respuesta };
    }
  }

  // 0b. Validar número
  if (!skipValidation) {
    const validacion = await validarNumeroWA(telefono);

    if (!validacion.autorizado) {

      // ── USUARIO INACTIVO: bloqueo total ──────────────────────────────────
      if (validacion.motivo === "inactivo") {
        const msg = await getWaMessage(
          "acceso_inactivo",
          "🚫 Tu acceso al sistema ha sido desactivado temporalmente. Contacta a tu supervisor."
        );
        console.log(`[WA-Webhook] Usuario INACTIVO: ${telefono} (${validacion.usuario?.nombre})`);
        return { tipo: "inactivo", respuesta: msg };
      }

      // ── NÚMERO DESCONOCIDO: clasificar intención ──────────────────────────
      if (validacion.motivo === "no_registrado") {
        const intencion: MessageClassification = classifyMessage(texto);
        console.log(`[WA-Webhook] Número externo (${telefono}), intención detectada: ${intencion}`);

        // Intento de función interna → ofrecer validación por DPI
        if (INTERNAL_INTENTS.includes(intencion)) {
          const msg = await getWaMessage(
            "wa_dpi_solicitud",
            "🔐 Para acceder a funciones exclusivas de colaboradores, necesitas verificar tu identidad.\n\n" +
            "Envía tu número de *DPI* (Documento Personal de Identificación) para continuar."
          );
          await startPhoneRegSession(telefono, nombre, intencion);
          console.log(`[WA-Webhook] Externo con intención interna (${intencion}) → iniciando flujo DPI: ${telefono}`);
          return { tipo: "dpi_solicitado", respuesta: msg };
        }

        // Saludo genérico → menú de bienvenida externo
        if (intencion === "saludo_externo") {
          const msg = await getWaMessage(
            "bienvenida_externo",
            "👋 ¡Bienvenido a ISP — Investigaciones y Seguridad Profesional S.A.!\n\n" +
            "Soy el asistente virtual de ISP. ¿En qué puedo ayudarte hoy?\n\n" +
            "1️⃣ Información sobre nuestros servicios\n" +
            "2️⃣ Solicitar cotización\n" +
            "3️⃣ Postularme a una plaza de trabajo\n" +
            "4️⃣ Hablar con un asesor\n\n" +
            "Escribe el número de opción o cuéntanos tu necesidad."
          );
          console.log(`[WA-Webhook] Externo saludo genérico: ${telefono}`);
          return { tipo: "saludo_externo", respuesta: msg };
        }

        // Intención externa permitida (lead, postulacion, info_general, contacto_asesor)
        // Continúa al procesamiento normal abajo
        console.log(`[WA-Webhook] Externo con intención permitida (${intencion}): ${telefono}`);
      }
    } else {
      console.log(`[WA-Webhook] Autorizado: ${telefono} (${validacion.usuario?.nombre ?? "sin nombre"})`);
    }
  }

  // 1. ¿Hay sesión de anticipo activa para este número?
  const sesionActiva = await getSession(telefono);
  if (sesionActiva) {
    const { respuesta, completada } = await continuarAnticipo(sesionActiva, texto);
    console.log(`[WA-Webhook] Anticipo en curso (${telefono}): estado=${sesionActiva.state}, completada=${completada}`);
    return { tipo: "anticipo_sesion", respuesta };
  }

  // 2. Clasificar mensaje
  const tipo: MessageClassification = classifyMessage(texto);

  if (tipo === "anticipo") {
    const respuesta = await iniciarAnticipo(nombre, telefono);
    console.log(`[WA-Webhook] Anticipo iniciado: ${telefono}`);
    return { tipo: "anticipo_inicio", respuesta };
  }

  if (tipo === "incidencia") {
    return { tipo, ...(await processIncidencia(nombre, telefono, texto, waMessageId)) };
  }

  if (tipo === "postulacion") {
    return { tipo, ...(await processPostulacion(nombre, telefono, texto)) };
  }

  if (tipo === "contacto_asesor") {
    const msg = await getWaMessage(
      "contacto_asesor_externo",
      "📞 Entendido. Uno de nuestros asesores se pondrá en contacto contigo a la brevedad.\n\n" +
      "También puedes comunicarte directamente al (502) 2220-0000 de lunes a viernes de 8:00 a 17:00 horas."
    );
    // Registrar como lead para seguimiento
    const leadResult = await processLead(nombre, telefono, `[ASESOR] ${texto}`);
    return { tipo: "contacto_asesor", id: leadResult.id, respuesta: msg };
  }

  if (tipo === "info_general") {
    const msg = await getWaMessage(
      "info_servicios_externo",
      "ℹ️ ISP — Investigaciones y Seguridad Profesional S.A. ofrece:\n\n" +
      "🔒 Seguridad física y vigilancia\n" +
      "🚐 Custodia y transporte de valores\n" +
      "📹 Monitoreo y respuesta a alarmas\n" +
      "🏢 Seguridad corporativa e industrial\n\n" +
      "¿Te gustaría solicitar una cotización o más información?\n" +
      "Escríbenos o llama al (502) 2220-0000."
    );
    const leadResult = await processLead(nombre, telefono, `[INFO] ${texto}`);
    return { tipo: "info_general", id: leadResult.id, respuesta: msg };
  }

  // Default: lead / cotización (siempre con acuse de recibo)
  const leadResult = await processLead(nombre, telefono, texto);
  const respuesta = await getWaMessage(
    "lead_recibido",
    `🙌 ¡Gracias por escribir a *ISP — Investigaciones y Seguridad Profesional S.A.*!\n\n` +
    `Recibimos tu mensaje y un asesor te atenderá a la brevedad.\n\n` +
    `Mientras tanto puedes:\n` +
    `1️⃣ Solicitar cotización de seguridad\n` +
    `2️⃣ Postularte a una plaza de guardia\n` +
    `3️⃣ Conocer nuestros servicios\n\n` +
    `Escribe el número de la opción o cuéntanos más sobre tu necesidad.`
  );
  return { tipo: "lead", id: leadResult.id, respuesta };
}

// ── GET /webhooks/whatsapp — Verificación de Meta ──────────────────────────
router.get("/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN ?? "isp_whatsapp_verify_2024";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WA-Webhook] Webhook verificado por Meta");
    return res.status(200).send(challenge);
  }

  console.warn("[WA-Webhook] Token de verificación incorrecto. Recibido:", token);
  res.status(403).json({ error: "Token de verificación inválido" });
});

// ── POST /webhooks/whatsapp — Mensajes entrantes desde Meta ───────────────
router.post("/webhooks/whatsapp", async (req, res) => {
  res.status(200).json({ ok: true });

  try {
    const body = req.body as WaWebhookPayload;

    if (body.object !== "whatsapp_business_account") {
      console.warn("[WA-Webhook] Objeto inesperado:", body.object);
      return;
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value = change.value;

        for (const msg of value.messages ?? []) {
          if (msg.type !== "text" || !msg.text?.body) continue;

          const contacto = value.contacts?.find((c) => c.wa_id === msg.from);
          const nombre = contacto?.profile?.name ?? `WA-${msg.from}`;
          const telefono = extractPhoneFromWaId(msg.from);
          const texto = msg.text.body;

          console.log(`[WA-Webhook] Mensaje de ${nombre} (${telefono}): "${texto}"`);

          // Acuse visual: marcar como leído (los dos chequecitos azules en WA).
          marcarLeidoWA(msg.id).catch(() => {});

          // ── Reporte público desde un carnet QR ────────────────────────
          // Si el mensaje viene del botón "Reportar por WhatsApp" de la
          // tarjeta pública del carnet, contiene el marcador
          // [ISP-CARNET:<token>] al inicio. Lo procesamos aquí (sin pasar
          // por el bot de sesiones) para que cualquier ciudadano pueda
          // reportar sin estar registrado en el sistema.
          const carnetMatch = texto.match(/^\s*\[ISP-CARNET:([A-Za-z0-9-]+)\]\s*([\s\S]*)$/);
          if (carnetMatch) {
            const [, tokenCarnet, restoMensaje] = carnetMatch;
            const descripcion = restoMensaje.trim() || "(sin descripción adicional)";
            try {
              const incRes = await crearIncidenciaDesdeCarnet({
                token: tokenCarnet,
                descripcion,
                telefonoReporte: telefono,
                nombreReporte: nombre,
              });
              const reply = incRes.ok
                ? `✅ Recibido. Su reporte fue registrado con el ID *${incRes.id}*. Un supervisor ISP lo atenderá. Gracias.`
                : `⚠️ No pudimos registrar el reporte: ${incRes.error}`;
              await enviarTextoWA(telefono, reply);
            } catch (errCar) {
              console.error("[WA-Webhook] Error en reporte público:", errCar);
              await enviarTextoWA(
                telefono,
                "⚠️ No pudimos registrar el reporte por un error interno. Llame directamente a ISP."
              );
            }
            continue; // no pasar al bot
          }

          const result = await handleIncomingMessage(nombre, telefono, texto, msg.id);
          console.log(`[WA-Webhook] Procesado → tipo=${result.tipo}, id=${result.id ?? "sesion"}`);

          // Enviar respuesta automática si la hay
          if (result.respuesta) {
            const sendRes = await enviarTextoWA(telefono, result.respuesta);
            console.log(
              `[WA-Webhook] Send → ok=${sendRes.ok} ${sendRes.skipped ? "(skipped: " + sendRes.error + ")" : sendRes.error ? "err=" + sendRes.error : "id=" + sendRes.messageId}`
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("[WA-Webhook] Error procesando payload:", err);
  }
});

// ── GET /webhooks/whatsapp/status — Diagnóstico de credenciales ────────────
router.get("/webhooks/whatsapp/status", (_req, res) => {
  res.json({
    creds: waCredsStatus(),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "(no configurado, usando default)",
    kioskoUrl: kioskoUrl(),
  });
});

// ── POST /webhooks/whatsapp/simulate — Simulación local ────────────────────
router.post("/webhooks/whatsapp/simulate", async (req, res) => {
  try {
    const { scenario, nombre: nombreCustom, telefono: telCustom, mensaje: mensajeCustom } = req.body;

    const SCENARIOS: Record<string, { nombre: string; telefono: string; mensaje: string }> = {
      postulacion: {
        nombre: "Juan Batz (Simulado)",
        telefono: "+50255550001",
        mensaje: "Hola, quiero aplicar como guardia de seguridad. Tengo 3 años de experiencia.",
      },
      lead: {
        nombre: "Distribuidora XYZ (Simulado)",
        telefono: "+50255550002",
        mensaje: "Buenos días, necesito cotización para servicios de custodia en planta.",
      },
      incidencia: {
        nombre: "Operador Norte (Simulado)",
        telefono: "+50255550003",
        mensaje: "Reporto incidencia en planta norte, persona sospechosa detectada.",
      },
    };

    const base = SCENARIOS[scenario];
    if (!base && !mensajeCustom) {
      return res.status(400).json({
        error: "Escenario inválido.",
        disponibles: [...Object.keys(SCENARIOS), "(o usa nombre+telefono+mensaje personalizado)"],
      });
    }

    const nombre = nombreCustom ?? base?.nombre ?? "Simulado";
    const telefono = telCustom ?? base?.telefono ?? "+50200000000";
    const mensaje = mensajeCustom ?? base?.mensaje ?? "";
    const waMessageId = `sim-${Date.now()}`;

    const result = await handleIncomingMessage(nombre, telefono, mensaje, waMessageId, true);

    res.status(201).json({
      simulacion: true,
      scenario: scenario ?? "personalizado",
      entrada: { nombre, telefono, mensaje },
      clasificacion: result.tipo,
      resultado: { id: result.id },
      respuesta_wa: result.respuesta ?? null,
    });
  } catch (err) {
    console.error("[WA-Simulate] Error:", err);
    res.status(500).json({ error: "Error al procesar simulación" });
  }
});

export default router;
