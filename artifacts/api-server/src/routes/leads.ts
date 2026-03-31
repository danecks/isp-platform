import { Router } from "express";
import { db, leadsTable } from "@workspace/db";
import { pool } from "@workspace/db";
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

const ESTADOS_LEAD = ["nuevo", "contactado", "cotizado", "ganado", "perdido"] as const;

router.patch("/leads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { estado, ejecutivo, notas } = req.body;

    if (estado !== undefined && !ESTADOS_LEAD.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Valores permitidos: ${ESTADOS_LEAD.join(", ")}`,
      });
    }

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

// A-09: POST /api/leads/:id/convertir-cliente — promover lead ganado a cliente real
router.post("/leads/:id/convertir-cliente", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    // Asegurar que la columna cliente_id existe (migración lazy)
    await pool.query(
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clients(id)`
    );

    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
    if (lead.estado !== "ganado") {
      return res.status(400).json({ error: "Solo se pueden convertir leads con estado 'ganado'" });
    }

    // Verificar si ya fue convertido (cliente_id ya existe en el lead)
    const { rows: existCheck } = await pool.query(
      `SELECT cliente_id FROM leads WHERE id = $1 AND cliente_id IS NOT NULL`, [id]
    );
    if (existCheck.length > 0) {
      return res.status(409).json({ error: "Este lead ya fue convertido a cliente", clienteId: existCheck[0].cliente_id });
    }

    // Extraer fecha_inicio_contrato del body (opcional pero recomendado)
    const { fecha_inicio_contrato } = req.body ?? {};

    // Crear cliente en la tabla clients
    const { rows: nuevoCliente } = await pool.query<{ id: number }>(`
      INSERT INTO clients (nombre, nombre_comercial, sector, notas, portal_cliente_id, fecha_inicio_contrato, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id
    `, [
      lead.empresa,
      lead.empresa,
      lead.servicio ?? "seguridad",
      `Cliente convertido desde lead #${lead.id}. Contacto: ${lead.contacto}. Notas: ${lead.notas ?? ""}`.trim(),
      `CLI-LEAD-${lead.id}`,
      fecha_inicio_contrato || null,
    ]);

    const clienteId = nuevoCliente[0].id;

    // Vincular el cliente al lead
    await pool.query(
      `UPDATE leads SET cliente_id = $1, updated_at = NOW() WHERE id = $2`,
      [clienteId, id]
    );

    res.status(201).json({
      ok: true,
      mensaje: `Lead convertido a cliente exitosamente`,
      clienteId,
      empresa: lead.empresa,
    });
  } catch (err) {
    console.error("[leads/convertir-cliente]", err);
    res.status(500).json({ error: "Error al convertir lead a cliente" });
  }
});

export default router;
