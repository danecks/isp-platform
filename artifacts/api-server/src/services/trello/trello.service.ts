const TRELLO_BASE = "https://api.trello.com/1";

export const CHECKLIST_ITEMS = [
  "Validar incidente con el cliente",
  "Contactar al cliente / lugar del evento",
  "Asignar recurso y supervisor",
  "Ejecutar acción operativa",
  "Registrar evidencia / fotografías",
  "Cerrar incidente en sistema ISP",
];

export interface TrelloConfig {
  apiKey: string;
  token: string;
  listId: string;
  memberSupervisor?: string;
  memberOperaciones?: string;
}

export interface TrelloCardResult {
  card: { id: string; name: string; url: string; shortUrl: string };
  checklistId: string;
  checklistItems: string[];
  membersAssigned: string[];
  mockMode: boolean;
}

export function getTrelloConfig(): TrelloConfig | null {
  const apiKey = process.env.TRELLO_API_KEY?.trim();
  const token = process.env.TRELLO_TOKEN?.trim();
  const listId = process.env.TRELLO_LIST_ID?.trim();
  if (!apiKey || !token || !listId) return null;
  return {
    apiKey,
    token,
    listId,
    memberSupervisor: process.env.TRELLO_MEMBER_SUPERVISOR?.trim(),
    memberOperaciones: process.env.TRELLO_MEMBER_OPERACIONES?.trim(),
  };
}

function auth(cfg: TrelloConfig) {
  return `key=${cfg.apiKey}&token=${cfg.token}`;
}

async function trelloPost<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function buildDescription(incident: {
  id: string;
  cliente: string;
  tipo: string;
  prioridad: string;
  ubicacion?: string | null;
  responsable?: string | null;
  descripcion?: string | null;
  origen?: string | null;
  fecha: string;
}): string {
  const lines = [
    `**INCIDENCIA ISP — ${incident.id}**`,
    ``,
    `📌 **Cliente:** ${incident.cliente}`,
    `⚡ **Tipo:** ${incident.tipo}`,
    `🔺 **Prioridad:** ${incident.prioridad.toUpperCase()}`,
    `📍 **Ubicación:** ${incident.ubicacion ?? "Por confirmar"}`,
    `👤 **Responsable:** ${incident.responsable ?? "Sin asignar"}`,
    `📡 **Origen:** ${incident.origen ?? "manual"}`,
    `🕐 **Registrada:** ${new Date(incident.fecha).toLocaleString("es-GT")}`,
    ``,
    `---`,
  ];
  if (incident.descripcion) {
    lines.push(`**Descripción:**`);
    lines.push(incident.descripcion);
    lines.push(`---`);
  }
  lines.push(`*Generado automáticamente por ISP Sistema Operativo*`);
  return lines.join("\n");
}

const PRIORIDAD_EMOJI: Record<string, string> = {
  urgente: "🚨",
  alta: "🔴",
  media: "🟡",
  baja: "🟢",
};

export async function createIncidentCard(
  cfg: TrelloConfig,
  incident: {
    id: string;
    cliente: string;
    tipo: string;
    prioridad: string;
    ubicacion?: string | null;
    responsable?: string | null;
    descripcion?: string | null;
    origen?: string | null;
    fecha: string;
  }
): Promise<TrelloCardResult> {
  const emoji = PRIORIDAD_EMOJI[incident.prioridad] ?? "⚪";
  const cardName = `${emoji} ${incident.id} — ${incident.tipo}`;

  const card = await trelloPost<{ id: string; name: string; url: string; shortUrl: string }>(
    `${TRELLO_BASE}/cards?${auth(cfg)}`,
    {
      idList: cfg.listId,
      name: cardName,
      desc: buildDescription(incident),
      pos: "top",
    }
  );

  const checklist = await trelloPost<{ id: string }>(
    `${TRELLO_BASE}/checklists?${auth(cfg)}`,
    { idCard: card.id, name: "Protocolo de Incidencia ISP" }
  );

  for (const item of CHECKLIST_ITEMS) {
    await trelloPost(
      `${TRELLO_BASE}/checklists/${checklist.id}/checkItems?${auth(cfg)}`,
      { name: item, checked: false }
    );
  }

  const membersToAssign = [cfg.memberSupervisor, cfg.memberOperaciones].filter(Boolean) as string[];
  const membersAssigned: string[] = [];
  for (const memberId of membersToAssign) {
    try {
      await trelloPost(`${TRELLO_BASE}/cards/${card.id}/idMembers?${auth(cfg)}`, { value: memberId });
      membersAssigned.push(memberId);
    } catch (err) {
      console.warn(`[Trello] No se pudo asignar miembro ${memberId}:`, err);
    }
  }

  return {
    card,
    checklistId: checklist.id,
    checklistItems: CHECKLIST_ITEMS,
    membersAssigned,
    mockMode: false,
  };
}

export function createMockCardResult(incident: { id: string; tipo: string; prioridad: string }): TrelloCardResult {
  const mockId = `mock-${Date.now()}`;
  const emoji = PRIORIDAD_EMOJI[incident.prioridad] ?? "⚪";
  return {
    card: {
      id: mockId,
      name: `${emoji} ${incident.id} — ${incident.tipo}`,
      url: `https://trello.com/c/${mockId}`,
      shortUrl: `https://trello.com/c/${mockId}`,
    },
    checklistId: `mock-cl-${Date.now()}`,
    checklistItems: CHECKLIST_ITEMS,
    membersAssigned: [],
    mockMode: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES GENÉRICAS — para otros módulos (leads, reclutamiento, tareas)
//
// Permiten que cualquier módulo cree tarjetas Trello con su propio contenido,
// checklist y configuración de lista/board. Si no se pasa listId, se usa
// el listId por defecto (TRELLO_LIST_ID) o el específico del módulo.
// ─────────────────────────────────────────────────────────────────────────────

export type ModuloTrello = "incidencias" | "leads" | "reclutamiento" | "tareas";

const LISTA_ENV_KEY: Record<ModuloTrello, string> = {
  incidencias: "TRELLO_LIST_ID",
  leads: "TRELLO_LIST_ID_LEADS",
  reclutamiento: "TRELLO_LIST_ID_RRHH",
  tareas: "TRELLO_LIST_ID_TAREAS",
};

const CHECKLIST_POR_MODULO: Record<ModuloTrello, string[]> = {
  incidencias: CHECKLIST_ITEMS,
  leads: [
    "Verificar datos de contacto",
    "Hacer primera llamada de bienvenida",
    "Enviar cotización inicial",
    "Agendar visita o reunión",
    "Registrar acuerdo en sistema ISP",
    "Cerrar lead (ganado/perdido)",
  ],
  reclutamiento: [
    "Revisar expediente del postulante",
    "Contactar y agendar entrevista",
    "Realizar entrevista presencial",
    "Verificar referencias",
    "Notificar resultado al postulante",
    "Archivar expediente",
  ],
  tareas: [
    "Verificar descripción y alcance",
    "Asignar responsable",
    "Ejecutar tarea",
    "Documentar resultado",
    "Cerrar en sistema ISP",
  ],
};

export function getTrelloConfigForModulo(modulo: ModuloTrello): TrelloConfig | null {
  const apiKey = process.env.TRELLO_API_KEY?.trim();
  const token = process.env.TRELLO_TOKEN?.trim();

  // Intentar lista específica del módulo, luego la genérica
  const envKey = LISTA_ENV_KEY[modulo];
  const listId = (process.env[envKey]?.trim()) || process.env.TRELLO_LIST_ID?.trim();

  if (!apiKey || !token || !listId) return null;
  return {
    apiKey,
    token,
    listId,
    memberSupervisor: process.env.TRELLO_MEMBER_SUPERVISOR?.trim(),
    memberOperaciones: process.env.TRELLO_MEMBER_OPERACIONES?.trim(),
  };
}

export interface GenericCardInput {
  titulo: string;
  descripcion: string;
  modulo: ModuloTrello;
  checklistNombre?: string;
  checklistItems?: string[];
}

export async function createGenericCard(
  cfg: TrelloConfig,
  input: GenericCardInput
): Promise<TrelloCardResult> {
  const checklistItems = input.checklistItems ?? CHECKLIST_POR_MODULO[input.modulo] ?? CHECKLIST_ITEMS;
  const checklistNombre = input.checklistNombre ?? `Protocolo ${input.modulo.charAt(0).toUpperCase() + input.modulo.slice(1)} ISP`;

  const card = await trelloPost<{ id: string; name: string; url: string; shortUrl: string }>(
    `${TRELLO_BASE}/cards?${auth(cfg)}`,
    { idList: cfg.listId, name: input.titulo, desc: input.descripcion, pos: "top" }
  );

  const checklist = await trelloPost<{ id: string }>(
    `${TRELLO_BASE}/checklists?${auth(cfg)}`,
    { idCard: card.id, name: checklistNombre }
  );

  for (const item of checklistItems) {
    await trelloPost(
      `${TRELLO_BASE}/checklists/${checklist.id}/checkItems?${auth(cfg)}`,
      { name: item, checked: false }
    );
  }

  const membersToAssign = [cfg.memberSupervisor, cfg.memberOperaciones].filter(Boolean) as string[];
  const membersAssigned: string[] = [];
  for (const memberId of membersToAssign) {
    try {
      await trelloPost(`${TRELLO_BASE}/cards/${card.id}/idMembers?${auth(cfg)}`, { value: memberId });
      membersAssigned.push(memberId);
    } catch (err) {
      console.warn(`[Trello] No se pudo asignar miembro ${memberId}:`, err);
    }
  }

  return { card, checklistId: checklist.id, checklistItems, membersAssigned, mockMode: false };
}

export function createMockGenericCard(input: GenericCardInput): TrelloCardResult {
  const mockId = `mock-${input.modulo}-${Date.now()}`;
  const checklistItems = input.checklistItems ?? CHECKLIST_POR_MODULO[input.modulo] ?? CHECKLIST_ITEMS;
  return {
    card: {
      id: mockId,
      name: input.titulo,
      url: `https://trello.com/c/${mockId}`,
      shortUrl: `https://trello.com/c/${mockId}`,
    },
    checklistId: `mock-cl-${Date.now()}`,
    checklistItems,
    membersAssigned: [],
    mockMode: true,
  };
}

// ─── Descripciones por módulo ─────────────────────────────────────────────────

export function buildLeadDescription(lead: {
  id: number;
  empresa: string;
  contacto: string;
  telefono?: string | null;
  correo?: string | null;
  servicio: string;
  ubicacion?: string | null;
  canal: string;
  estado: string;
  ejecutivo?: string | null;
  notas?: string | null;
  createdAt: string;
}): string {
  return [
    `**LEAD COMERCIAL ISP — #${lead.id}**`,
    ``,
    `🏢 **Empresa:** ${lead.empresa}`,
    `👤 **Contacto:** ${lead.contacto}`,
    `📞 **Teléfono:** ${lead.telefono ?? "—"}`,
    `📧 **Correo:** ${lead.correo ?? "—"}`,
    `🔒 **Servicio solicitado:** ${lead.servicio}`,
    `📍 **Ubicación:** ${lead.ubicacion ?? "—"}`,
    `📡 **Canal:** ${lead.canal}`,
    `📊 **Estado:** ${lead.estado}`,
    `👔 **Ejecutivo asignado:** ${lead.ejecutivo ?? "Sin asignar"}`,
    `🕐 **Registrado:** ${new Date(lead.createdAt).toLocaleString("es-GT")}`,
    ``,
    lead.notas ? `**Notas:** ${lead.notas}` : "",
    `---`,
    `*Generado automáticamente por ISP Sistema Comercial*`,
  ].filter(Boolean).join("\n");
}

export function buildApplicationDescription(app: {
  id: number;
  nombre: string;
  telefono: string;
  correo?: string | null;
  puesto?: string | null;
  experiencia?: string | null;
  ubicacion?: string | null;
  canal: string;
  estado: string;
  notas?: string | null;
  createdAt: string;
}): string {
  return [
    `**POSTULACIÓN RRHH ISP — #${app.id}**`,
    ``,
    `👤 **Postulante:** ${app.nombre}`,
    `📞 **Teléfono:** ${app.telefono}`,
    `📧 **Correo:** ${app.correo ?? "—"}`,
    `💼 **Puesto solicitado:** ${app.puesto ?? "Agente de Seguridad"}`,
    `📋 **Experiencia:** ${app.experiencia ?? "—"}`,
    `📍 **Ubicación:** ${app.ubicacion ?? "—"}`,
    `📡 **Canal:** ${app.canal}`,
    `📊 **Estado:** ${app.estado}`,
    `🕐 **Registrado:** ${new Date(app.createdAt).toLocaleString("es-GT")}`,
    ``,
    app.notas ? `**Notas:** ${app.notas}` : "",
    `---`,
    `*Generado automáticamente por ISP Sistema RRHH*`,
  ].filter(Boolean).join("\n");
}
