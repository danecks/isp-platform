/**
 * WA SENDER — ISP, S.A.
 *
 * Envía mensajes salientes a la WhatsApp Cloud API (Meta Graph API).
 *
 * Variables de entorno requeridas:
 *   WA_PHONE_NUMBER_ID  — id del número (no el número en sí), aparece en Meta App Dashboard
 *   WA_ACCESS_TOKEN     — token permanente de la app (System User Token recomendado)
 *
 * Si faltan credenciales, hace fallback a log y no rompe (modo "preview").
 */

const GRAPH_API_VERSION = "v20.0";

interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

function isCredsConfigured(): boolean {
  return !!(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
}

/**
 * Envía un mensaje de texto plano a un número de WhatsApp.
 * @param toPhone número en formato internacional con o sin "+" (ej: 50212345678)
 * @param text   contenido del mensaje (máx 4096 chars en WA)
 */
export async function enviarTextoWA(toPhone: string, text: string): Promise<SendResult> {
  if (!text || !text.trim()) {
    return { ok: false, error: "texto vacío", skipped: true };
  }

  if (!isCredsConfigured()) {
    console.log(
      `[WA-Sender] (preview, sin credenciales) → ${toPhone}: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"`
    );
    return { ok: false, skipped: true, error: "WA_PHONE_NUMBER_ID o WA_ACCESS_TOKEN no configurados" };
  }

  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID!;
  const token = process.env.WA_ACCESS_TOKEN!;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const cleanPhone = toPhone.replace(/^\+/, "").replace(/\D/g, "");
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "text",
    text: { preview_url: false, body: text.slice(0, 4096) },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        data?.error?.message ?? `HTTP ${res.status} ${res.statusText}`;
      console.error(`[WA-Sender] Error enviando a ${cleanPhone}:`, errMsg, data);
      return { ok: false, error: errMsg };
    }

    const messageId: string | undefined = data?.messages?.[0]?.id;
    console.log(`[WA-Sender] ✓ Enviado a ${cleanPhone} (id=${messageId ?? "?"})`);
    return { ok: true, messageId };
  } catch (err: any) {
    console.error(`[WA-Sender] Excepción enviando a ${cleanPhone}:`, err?.message ?? err);
    return { ok: false, error: err?.message ?? String(err) };
  }
}

/**
 * Marca un mensaje entrante como leído (los dos chequecitos azules en WA).
 * Es opcional pero mejora UX. Silencioso ante fallos.
 */
export async function marcarLeidoWA(waMessageId: string): Promise<void> {
  if (!isCredsConfigured() || !waMessageId) return;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID!;
  const token = process.env.WA_ACCESS_TOKEN!;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: waMessageId,
      }),
    });
  } catch {
    /* silencioso */
  }
}

export function waCredsStatus() {
  return {
    configured: isCredsConfigured(),
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID ? "✓ set" : "✗ falta",
    accessToken: process.env.WA_ACCESS_TOKEN ? "✓ set" : "✗ falta",
    verifyToken: process.env.WA_VERIFY_TOKEN ? "✓ set" : "✗ usa default",
  };
}
