/**
 * CLASIFICADOR DE MENSAJES WHATSAPP — ISP, S.A.
 *
 * Determina la intención de un mensaje entrante de WhatsApp.
 *
 * ─── INTENCIONES INTERNAS (solo usuarios registrados y activos) ─────────────
 *   anticipo    — Solicitud de anticipo salarial
 *   incidencia  — Reporte de emergencia / incidencia operativa
 *
 * ─── INTENCIONES EXTERNAS (abiertas para cualquier número) ──────────────────
 *   lead            — Cotización, servicios, precios, contratar seguridad
 *   postulacion     — Empleo, trabajo, plaza, guardia
 *   info_general    — Información sobre ISP, dudas generales
 *   contacto_asesor — Quiere hablar con una persona / asesor
 *   saludo_externo  — Saludo genérico sin intención clara → muestra menú externo
 *
 * ─── TOLERANCIA ─────────────────────────────────────────────────────────────
 *   · Todo el texto se normaliza: minúsculas + eliminación de acentos
 *   · Palabras parciales (trabaj → trabajo, cotiz → cotización)
 *   · Errores ortográficos comunes (kisiera, quiciera, necesito, ocupo)
 */

export type MessageClassification =
  | "anticipo"
  | "incidencia"
  | "postulacion"
  | "lead"
  | "info_general"
  | "contacto_asesor"
  | "saludo_externo";

/**
 * Intenciones que son de uso EXCLUSIVAMENTE interno.
 * Si un número desconocido las intenta, se bloquean con menú de alternativas.
 */
export const INTERNAL_INTENTS: MessageClassification[] = ["anticipo", "incidencia"];

// ─── Palabras clave por intención ─────────────────────────────────────────────

const ANTICIPO_KW = [
  "anticipo", "adelanto", "anticipo salarial", "pago anticipado",
  "quiero anticipo", "solicitar anticipo", "necesito anticipo",
  "pedir anticipo", "solicitar adelanto", "quiero adelanto",
  "me pueden dar anticipo", "pago adelantado",
];

const INCIDENCIA_KW = [
  "incidencia", "emergencia", "reporto", "reporte", "alerta",
  "robo", "asalto", "intruso", "sospechoso", "sospechosa", "accidente",
  "herido", "herida", "golpe", "pelea", "invasion", "amenaza",
  "disparos", "peligro", "auxilio", "sos", "socorro", "persona sospechosa",
  "persona extraña", "intrusión", "intrusion", "ayuda urgente", "necesito ayuda urgente",
  "robo en curso", "robo a mano armada",
];

const POSTULACION_KW = [
  "aplicar", "aplico", "postular", "postulo", "quiero trabajo",
  "busco trabajo", "busco empleo", "quiero empleo",
  "trabaj",        // cubre: trabajo, trabajar, trabajando
  "guardia",       // cubre: guardia, guardias
  "agente de seguridad", "agente seguridad",
  "contratarme", "vacante", "plaza",
  "reclutamiento", "me interesa el puesto",
  "quiero aplicar", "quisiera aplicar", "kisiera aplicar",
  "quiciera aplicar", "quiero ser guardia",
  "quiero ser agente", "soy seguridad",
  "tengo experiencia en seguridad",
  "busco plaza", "estoy buscando trabajo",
  "necesito trabajo", "ocupo trabajo",
];

const LEAD_KW = [
  "cotizacion", "cotizacion", "servicio de seguridad", "servicios de seguridad",
  "custodia", "precio", "precios", "propuesta", "contrato",
  "necesito seguridad", "quiero contratar", "requiero guardias",
  "requiero agentes", "solicitud de servicio",
  "presupuesto", "cuanto cuesta", "cuanto cobran",
  "cuanto vale", "tarifa",
  "seguridad para", "proteccion para", "vigilancia para",
  "quiero cotizar", "ocupo guardias", "necesito guardias",
  "guardias para", "agentes para", "personal de seguridad",
  "seguridad privada", "interesado en sus servicios",
  "interesado con ustedes", "me interesa",
  "cotizacion de seguridad", "seguridad empresarial",
  "seguridad industrial",
];

const INFO_GENERAL_KW = [
  "informacion", "que servicios", "que hacen", "que ofrecen",
  "como trabajan", "quiero saber", "sobre ustedes", "sobre isp",
  "conocer isp", "sus servicios", "sus soluciones",
  "conocer sus servicios", "de donde son", "a que se dedican",
  "quiero informacion", "necesito informacion",
  "me pueden informar", "me dan informacion",
];

const CONTACTO_ASESOR_KW = [
  "hablar con alguien", "hablar con asesor", "asesor",
  "hablar con una persona", "hablar con humano",
  "quiero hablar con", "comuníquenme", "comuniquenme",
  "me comunican con", "quiero que me llamen",
  "pueden llamarme", "pueden contactarme",
  "dejar mis datos", "dejar numero", "dejar mi numero",
  "hablar con representante", "hablar con ejecutivo",
];

// Saludos / mensajes muy cortos sin intención clara → mostrar menú externo
const SALUDO_EXTERNO_KW = [
  "hola", "buenas", "buenos dias", "buenas tardes", "buenas noches",
  "buen dia", "hey", "saludos", "hi", "hello",
  "que tal", "como estan", "ola",
];

// ─── Función de normalización ─────────────────────────────────────────────────

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // eliminar acentos
    .replace(/[^a-z0-9\s]/g, " ")   // eliminar puntuación
    .replace(/\s+/g, " ")           // colapsar espacios
    .trim();
}

function matches(text: string, keywords: string[]): boolean {
  const t = norm(text);
  return keywords.some(kw => t.includes(norm(kw)));
}

/**
 * Detecta si el mensaje es un saludo corto / sin intención clara.
 * Aplica para mensajes de ≤ 4 palabras que contengan solo saludo.
 */
function esSaludoGenerico(text: string): boolean {
  const t = norm(text);
  const words = t.split(" ").filter(Boolean);
  if (words.length > 5) return false;
  return SALUDO_EXTERNO_KW.some(s => t === norm(s) || t.startsWith(norm(s) + " ") || t.endsWith(" " + norm(s)));
}

// ─── Clasificador principal ───────────────────────────────────────────────────

/**
 * Clasifica un mensaje en una intención.
 *
 * Prioridades (de mayor a menor):
 *   1. anticipo     — siempre máxima prioridad (función interna sensible)
 *   2. incidencia   — emergencias operativas (función interna)
 *   3. postulacion  — empleo (externa, específica)
 *   4. lead         — cotización / contratar (externa, específica)
 *   5. info_general — información sobre ISP (externa, genérica)
 *   6. contacto_asesor — quiere hablar con persona (externa)
 *   7. saludo_externo  — saludo sin intención clara (externa)
 *   DEFAULT: lead   — para mensajes sin clasificación pero externos
 */
export function classifyMessage(messageText: string): MessageClassification {
  if (matches(messageText, ANTICIPO_KW))        return "anticipo";
  if (matches(messageText, INCIDENCIA_KW))      return "incidencia";
  if (matches(messageText, POSTULACION_KW))     return "postulacion";
  if (matches(messageText, LEAD_KW))            return "lead";
  if (matches(messageText, INFO_GENERAL_KW))    return "info_general";
  if (matches(messageText, CONTACTO_ASESOR_KW)) return "contacto_asesor";
  if (esSaludoGenerico(messageText))            return "saludo_externo";

  // Default: mensajes ambiguos de externos → tratar como lead potencial
  return "lead";
}

export function extractPhoneFromWaId(waId: string): string {
  return waId.startsWith("+") ? waId : `+${waId}`;
}
