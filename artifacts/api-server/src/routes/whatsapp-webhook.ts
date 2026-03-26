import { Router } from "express";
import { db, incidentsTable, applicationsTable, leadsTable } from "@workspace/db";
import { classifyMessage, extractPhoneFromWaId } from "../services/whatsapp/classifier";

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
  return { tabla: "incidentes", id: inserted[0].id };
}

async function processPostulacion(
  nombre: string,
  telefono: string,
  mensaje: string
) {
  const inserted = await db
    .insert(applicationsTable)
    .values({
      nombre,
      telefono,
      correo: null,
      experiencia: "Por evaluar",
      ubicacion: "Guatemala",
      puesto: "Agente de Seguridad",
      canal: "whatsapp",
      notas: mensaje,
    })
    .returning();
  return { tabla: "postulaciones", id: inserted[0].id };
}

async function processLead(
  nombre: string,
  telefono: string,
  mensaje: string
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
      canal: "whatsapp",
      notas: mensaje,
    })
    .returning();
  return { tabla: "leads", id: inserted[0].id };
}

async function handleIncomingMessage(
  nombre: string,
  telefono: string,
  texto: string,
  waMessageId: string
) {
  const tipo = classifyMessage(texto);

  if (tipo === "incidencia") {
    return { tipo, ...(await processIncidencia(nombre, telefono, texto, waMessageId)) };
  } else if (tipo === "postulacion") {
    return { tipo, ...(await processPostulacion(nombre, telefono, texto)) };
  } else {
    return { tipo: "lead", ...(await processLead(nombre, telefono, texto)) };
  }
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

          const result = await handleIncomingMessage(nombre, telefono, texto, msg.id);
          console.log(`[WA-Webhook] Procesado → tipo=${result.tipo}, id=${result.id}`);
        }
      }
    }
  } catch (err) {
    console.error("[WA-Webhook] Error procesando payload:", err);
  }
});

// ── POST /webhooks/whatsapp/simulate — Simulación local de mensajes ────────
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
    if (!base) {
      return res.status(400).json({
        error: "Escenario inválido.",
        disponibles: Object.keys(SCENARIOS),
        uso: 'POST /api/webhooks/whatsapp/simulate con body: { "scenario": "postulacion" | "lead" | "incidencia" }',
      });
    }

    const nombre = nombreCustom ?? base.nombre;
    const telefono = telCustom ?? base.telefono;
    const mensaje = mensajeCustom ?? base.mensaje;
    const waMessageId = `sim-${Date.now()}`;

    console.log(`[WA-Simulate] Escenario: ${scenario}, mensaje: "${mensaje}"`);

    const result = await handleIncomingMessage(nombre, telefono, mensaje, waMessageId);

    console.log(`[WA-Simulate] Resultado: tipo=${result.tipo}, id=${result.id}`);

    res.status(201).json({
      simulacion: true,
      scenario,
      entrada: { nombre, telefono, mensaje },
      clasificacion: result.tipo,
      resultado: result,
      nota: "Registro guardado en la base de datos real. Visible en el admin de inmediato.",
    });
  } catch (err) {
    console.error("[WA-Simulate] Error:", err);
    res.status(500).json({ error: "Error al procesar simulación" });
  }
});

export default router;
