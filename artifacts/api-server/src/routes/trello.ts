import { Router } from "express";
import { db, incidentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getTrelloConfig,
  createIncidentCard,
  createMockCardResult,
  CHECKLIST_ITEMS,
} from "../services/trello/trello.service";

const router = Router();

// ── GET /trello/config — estado de configuración ───────────────────────────
router.get("/trello/config", (_req, res) => {
  const cfg = getTrelloConfig();
  res.json({
    configured: !!cfg,
    hasMemberSupervisor: !!(process.env.TRELLO_MEMBER_SUPERVISOR?.trim()),
    hasMemberOperaciones: !!(process.env.TRELLO_MEMBER_OPERACIONES?.trim()),
    checklistItems: CHECKLIST_ITEMS,
    mockMode: !cfg,
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

export default router;
