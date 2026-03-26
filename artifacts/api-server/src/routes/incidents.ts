import { Router } from "express";
import { db, incidentsTable } from "@workspace/db";
import { desc, eq, or, count } from "drizzle-orm";

const router = Router();

function generateId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INC-${yy}${mm}-${rand}`;
}

router.get("/incidents", async (_req, res) => {
  try {
    const rows = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener incidencias" });
  }
});

router.get("/incidents/count", async (_req, res) => {
  try {
    const result = await db.select({ total: count() }).from(incidentsTable).where(
      or(eq(incidentsTable.estado, "abierta"), eq(incidentsTable.estado, "en_proceso"))
    );
    res.json({ count: result[0]?.total ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Error al contar incidencias" });
  }
});

router.post("/incidents", async (req, res) => {
  try {
    const { cliente, tipo, origen, ubicacion, prioridad, responsable, descripcion } = req.body;
    if (!cliente || !tipo) {
      return res.status(400).json({ error: "cliente y tipo son requeridos" });
    }
    const id = generateId();
    const inserted = await db.insert(incidentsTable).values({
      id, cliente, tipo,
      origen: origen ?? "manual",
      ubicacion: ubicacion ?? "Guatemala",
      prioridad: prioridad ?? "media",
      estado: "abierta",
      responsable: responsable ?? "Sin asignar",
      descripcion,
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al crear incidencia" });
  }
});

router.patch("/incidents/:id", async (req, res) => {
  try {
    const { estado, responsable } = req.body;
    const updated = await db.update(incidentsTable)
      .set({ estado, responsable, updatedAt: new Date() })
      .where(eq(incidentsTable.id, req.params.id))
      .returning();
    if (!updated.length) return res.status(404).json({ error: "Incidencia no encontrada" });
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar incidencia" });
  }
});

export default router;
