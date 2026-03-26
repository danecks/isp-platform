import { Router } from "express";
import { db, incidentsTable, leadsTable, applicationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getTrelloConfig,
  getTrelloConfigForModulo,
  createIncidentCard,
  createMockCardResult,
  createGenericCard,
  createMockGenericCard,
  buildLeadDescription,
  buildApplicationDescription,
  CHECKLIST_ITEMS,
} from "../services/trello/trello.service";

const router = Router();

// ── GET /trello/config — estado de configuración ───────────────────────────
router.get("/trello/config", (_req, res) => {
  const cfg = getTrelloConfig();
  const hasLeads = !!(process.env.TRELLO_LIST_ID_LEADS?.trim());
  const hasRRHH  = !!(process.env.TRELLO_LIST_ID_RRHH?.trim());
  const hasTareas = !!(process.env.TRELLO_LIST_ID_TAREAS?.trim());

  res.json({
    configured: !!cfg,
    hasMemberSupervisor: !!(process.env.TRELLO_MEMBER_SUPERVISOR?.trim()),
    hasMemberOperaciones: !!(process.env.TRELLO_MEMBER_OPERACIONES?.trim()),
    checklistItems: CHECKLIST_ITEMS,
    mockMode: !cfg,
    modulos: {
      incidencias: { configurado: !!cfg, listaEspecifica: !!process.env.TRELLO_LIST_ID?.trim() },
      leads:       { configurado: !!getTrelloConfigForModulo("leads"), listaEspecifica: hasLeads },
      reclutamiento: { configurado: !!getTrelloConfigForModulo("reclutamiento"), listaEspecifica: hasRRHH },
      tareas:      { configurado: !!getTrelloConfigForModulo("tareas"), listaEspecifica: hasTareas },
    },
  });
});

// ── POST /trello/send-incident/:id — crear tarjeta de Trello ───────────────
router.post("/trello/send-incident/:id", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, req.params.id));

    if (!rows.length) {
      return res.status(404).json({ error: "Incidencia no encontrada" });
    }

    const inc = rows[0];

    if (inc.tareaAsociada) {
      return res.status(409).json({
        error: "Esta incidencia ya tiene una tarjeta de Trello",
        trelloUrl: inc.tareaAsociada,
        alreadySent: true,
      });
    }

    const cfg = getTrelloConfig();
    const result = cfg
      ? await createIncidentCard(cfg, inc)
      : createMockCardResult(inc);

    await db
      .update(incidentsTable)
      .set({ tareaAsociada: result.card.shortUrl, updatedAt: new Date() })
      .where(eq(incidentsTable.id, inc.id));

    console.log(
      `[Trello] Tarjeta creada para ${inc.id}: ${result.card.shortUrl} (mock=${result.mockMode})`
    );

    res.status(201).json({
      incidenciaId: inc.id,
      ...result,
    });
  } catch (err) {
    console.error("[Trello] Error al crear tarjeta:", err);
    res.status(500).json({
      error: "Error al crear tarjeta de Trello",
      detail: (err as Error).message,
    });
  }
});

// ── POST /trello/send-lead/:id — crear tarjeta Trello para un lead ──────────
router.post("/trello/send-lead/:id", async (req, res) => {
  const leadId = parseInt(req.params.id, 10);
  if (isNaN(leadId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    if (lead.tareaAsociada) {
      return res.status(409).json({
        error: "Este lead ya tiene una tarjeta de Trello",
        trelloUrl: lead.tareaAsociada,
        alreadySent: true,
      });
    }

    const cfg = getTrelloConfigForModulo("leads");
    const input = {
      titulo: `💼 Lead #${lead.id} — ${lead.empresa}`,
      descripcion: buildLeadDescription({ ...lead, createdAt: lead.createdAt.toISOString() }),
      modulo: "leads" as const,
    };
    const result = cfg
      ? await createGenericCard(cfg, input)
      : createMockGenericCard(input);

    await db
      .update(leadsTable)
      .set({ tareaAsociada: result.card.shortUrl, updatedAt: new Date() })
      .where(eq(leadsTable.id, lead.id));

    console.log(`[Trello] Lead #${lead.id} → ${result.card.shortUrl} (mock=${result.mockMode})`);
    res.status(201).json({ leadId: lead.id, ...result });
  } catch (err) {
    console.error("[Trello] Error lead:", err);
    res.status(500).json({ error: "Error al crear tarjeta Trello para lead", detail: (err as Error).message });
  }
});

// ── POST /trello/send-application/:id — crear tarjeta Trello para postulación
router.post("/trello/send-application/:id", async (req, res) => {
  const appId = parseInt(req.params.id, 10);
  if (isNaN(appId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, appId));
    if (!app) return res.status(404).json({ error: "Postulación no encontrada" });

    if (app.tareaAsociada) {
      return res.status(409).json({
        error: "Esta postulación ya tiene una tarjeta de Trello",
        trelloUrl: app.tareaAsociada,
        alreadySent: true,
      });
    }

    const cfg = getTrelloConfigForModulo("reclutamiento");
    const input = {
      titulo: `👤 Postulación #${app.id} — ${app.nombre}`,
      descripcion: buildApplicationDescription({ ...app, createdAt: app.createdAt.toISOString() }),
      modulo: "reclutamiento" as const,
    };
    const result = cfg
      ? await createGenericCard(cfg, input)
      : createMockGenericCard(input);

    await db
      .update(applicationsTable)
      .set({ tareaAsociada: result.card.shortUrl, updatedAt: new Date() })
      .where(eq(applicationsTable.id, app.id));

    console.log(`[Trello] App #${app.id} → ${result.card.shortUrl} (mock=${result.mockMode})`);
    res.status(201).json({ applicationId: app.id, ...result });
  } catch (err) {
    console.error("[Trello] Error application:", err);
    res.status(500).json({ error: "Error al crear tarjeta Trello para postulación", detail: (err as Error).message });
  }
});

export default router;
