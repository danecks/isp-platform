import { Router } from "express";
import { db, applicationsTable } from "@workspace/db";
import { desc, eq, count } from "drizzle-orm";

const router = Router();

router.get("/applications", async (_req, res) => {
  try {
    const rows = await db.select().from(applicationsTable).orderBy(desc(applicationsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener postulaciones" });
  }
});

router.get("/applications/count", async (_req, res) => {
  try {
    const result = await db.select({ total: count() }).from(applicationsTable).where(eq(applicationsTable.estado, "recibido"));
    res.json({ count: result[0]?.total ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Error al contar postulaciones" });
  }
});

router.post("/applications", async (req, res) => {
  try {
    const { nombre, telefono, correo, experiencia, ubicacion, puesto, canal, notas } = req.body;
    if (!nombre || !telefono) {
      return res.status(400).json({ error: "nombre y telefono son requeridos" });
    }
    const inserted = await db.insert(applicationsTable).values({
      nombre, telefono, correo,
      experiencia: experiencia ?? "Sin experiencia",
      ubicacion: ubicacion ?? "Guatemala",
      puesto: puesto ?? "Agente de Seguridad",
      canal: canal ?? "web",
      notas,
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al crear postulación" });
  }
});

router.patch("/applications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { estado, notas } = req.body;
    const updated = await db.update(applicationsTable)
      .set({ estado, notas, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!updated.length) return res.status(404).json({ error: "Postulación no encontrada" });
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar postulación" });
  }
});

export default router;
