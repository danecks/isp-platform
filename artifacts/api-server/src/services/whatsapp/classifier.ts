export type MessageClassification = "anticipo" | "incidencia" | "postulacion" | "lead";

const ANTICIPO_KEYWORDS = [
  "anticipo", "quiero anticipo", "solicitar anticipo", "pedir anticipo",
  "adelanto", "quiero adelanto", "solicitar adelanto", "necesito anticipo",
  "anticipo salarial", "pago anticipado",
];

const INCIDENCIA_KEYWORDS = [
  "incidencia", "emergencia", "reporto", "reporte", "alerta",
  "robo", "asalto", "intruso", "sospechoso", "accidente",
  "herido", "golpe", "pelea", "invasion", "invasión", "amenaza",
  "disparos", "peligro", "auxilio", "sos",
];

const POSTULACION_KEYWORDS = [
  "aplicar", "aplico", "postular", "postulo", "trabajo", "empleo",
  "guardia", "agente de seguridad", "contratarme", "vacante",
  "quiero trabajar", "busco trabajo", "trabaj", "reclutamiento",
  "me interesa el puesto",
];

const LEAD_KEYWORDS = [
  "cotizacion", "cotización", "servicio", "custodia", "precio",
  "informacion", "información", "contrato", "propuesta",
  "necesito seguridad", "quiero contratar", "requiero", "solicitud",
  "presupuesto", "cuanto cuesta", "cuánto cuesta",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classifyMessage(messageText: string): MessageClassification {
  const text = normalize(messageText);

  // Anticipo tiene prioridad máxima (antes de incidencia)
  for (const kw of ANTICIPO_KEYWORDS) {
    if (text.includes(normalize(kw))) return "anticipo";
  }
  for (const kw of INCIDENCIA_KEYWORDS) {
    if (text.includes(normalize(kw))) return "incidencia";
  }
  for (const kw of POSTULACION_KEYWORDS) {
    if (text.includes(normalize(kw))) return "postulacion";
  }
  for (const kw of LEAD_KEYWORDS) {
    if (text.includes(normalize(kw))) return "lead";
  }

  return "lead";
}

export function extractPhoneFromWaId(waId: string): string {
  return waId.startsWith("+") ? waId : `+${waId}`;
}
