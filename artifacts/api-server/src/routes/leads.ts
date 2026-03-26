import { Router } from "express";
import { db, leadsTable } from "@workspace/db";
import { desc, eq, count } from "drizzle-orm";

const router = Router();

router.get("/leads", async (_req, res) => {
  try {
    const rows = await db.select().from(leadsTable).orderBy(desc(leadsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener leads" });
  }
});

router.get("/leads/count", async (_req, res) => {
  try {
    const result = await db.select({ total: count() }).from(leadsTable).where(eq(leadsTable.estado, "nuevo"));
    res.json({ count: result[0]?.total ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Error al contar leads" });
  }
});

router.post("/leads", async (req, res) => {
  try {
    const { empresa, contacto, telefono, correo, servicio, ubicacion, canal, notas } = req.body;
    if (!empresa || !contacto || !servicio) {
      return res.status(400).json({ error: "empresa, contacto y servicio son requeridos" });
    }
    const inserted = await db.insert(leadsTable).values({
      empresa, contacto, telefono, correo, servicio,
      ubicacion: ubicacion ?? "Guatemala",
      canal: canal ?? "web",
      notas,
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al crear lead" });
  }
});

router.patch("/leads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { estado, ejecutivo, notas } = req.body;
    const updated = await db.update(leadsTable)
      .set({ estado, ejecutivo, notas, updatedAt: new Date() })
      .where(eq(leadsTable.id, id))
      .returning();
    if (!updated.length) return res.status(404).json({ error: "Lead no encontrado" });
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar lead" });
  }
});

export default router;
