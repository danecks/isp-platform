import { Router } from "express";
import { db, incidentsTable, pool } from "@workspace/db";
import { desc, eq, or, count } from "drizzle-orm";

const router = Router();

function generateId(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INC-${yy}${mm}${dd}-${rand}`;
}

// GET /incidents — lista completa ordenada por fecha desc
router.get("/incidents", async (_req, res) => {
  try {
    const rows = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.fecha));
    res.json(rows);
  } catch (err) {
    console.error("[incidents] GET error:", err);
    res.status(500).json({ error: "Error al obtener incidencias" });
  }
});

// GET /incidents/count — solo abiertas + en_proceso
router.get("/incidents/count", async (_req, res) => {
  try {
    const result = await db
      .select({ total: count() })
      .from(incidentsTable)
      .where(or(eq(incidentsTable.estado, "abierta"), eq(incidentsTable.estado, "en_proceso")));
    res.json({ count: result[0]?.total ?? 0 });
  } catch (err) {
    console.error("[incidents] COUNT error:", err);
    res.status(500).json({ error: "Error al contar incidencias" });
  }
});

// GET /incidents/:id — detalle de una incidencia
router.get("/incidents/:id", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, req.params.id));
    if (!rows.length) return res.status(404).json({ error: "Incidencia no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[incidents] GET/:id error:", err);
    res.status(500).json({ error: "Error al obtener incidencia" });
  }
});

// POST /incidents — crear nueva incidencia
router.post("/incidents", async (req, res) => {
  try {
    const { cliente, tipo, origen, ubicacion, prioridad, responsable, descripcion } = req.body;

    if (!cliente?.trim()) return res.status(400).json({ error: "El campo 'cliente' es requerido" });
    if (!tipo?.trim()) return res.status(400).json({ error: "El campo 'tipo' es requerido" });

    const PRIORIDADES_VALIDAS = ["alta", "media", "baja", "urgente", "critica"];
    const ORIGENES_VALIDOS = ["manual", "web", "whatsapp", "llamada", "portal"];
    const ESTADOS_VALIDOS = ["abierta", "en_proceso", "resuelta", "cerrada"];

    const { esEmergencia, reportadoPor, clienteId, clienteRefId, puestoId, sedeId } = req.body;

    // C-05: resolver client_id (FK real) desde clienteId numérico o clienteRefId
    let resolvedClientId: number | null = null;
    const rawClientId = clienteId ?? clienteRefId;
    if (rawClientId !== undefined && rawClientId !== null) {
      const parsed = parseInt(String(rawClientId), 10);
      if (!isNaN(parsed)) resolvedClientId = parsed;
    }

    // P-01: validar responsableId contra tabla employees (si se provee)
    let resolvedResponsableId: number | null = null;
    let resolvedResponsable = responsable?.trim() || "Sin asignar";
    const rawResponsableId = req.body.responsableId;
    if (rawResponsableId !== undefined && rawResponsableId !== null) {
      const rid = parseInt(String(rawResponsableId), 10);
      if (!isNaN(rid)) {
        const { rows: empRows } = await pool.query(
          `SELECT id, nombre_completo FROM employees WHERE id = $1 AND estado_laboral != 'inactivo'`,
          [rid]
        );
        if (!empRows.length) {
          return res.status(400).json({ error: "El responsable indicado no existe o está inactivo" });
        }
        resolvedResponsableId = rid;
        resolvedResponsable = empRows[0].nombre_completo;
      }
    }

    const id = generateId();
    const inserted = await db
      .insert(incidentsTable)
      .values({
        id,
        cliente: cliente.trim(),
        tipo: tipo.trim(),
        origen: ORIGENES_VALIDOS.includes(origen) ? origen : "manual",
        ubicacion: ubicacion?.trim() || "Guatemala",
        prioridad: PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : "media",
        estado: ESTADOS_VALIDOS.includes(req.body.estado) ? req.body.estado : "abierta",
        responsable: resolvedResponsable,
        descripcion: descripcion?.trim() || null,
        esEmergencia: esEmergencia === true || esEmergencia === "true",
        reportadoPor: reportadoPor?.trim() || null,
        clienteRefId: rawClientId ? String(rawClientId) : null,
        clientId: resolvedClientId,
      } as any)
      .returning();

    // Guardar responsable_id, puesto_id y sede_id en columnas extra (A-05)
    const extraUpdates: string[] = [];
    const extraParams: (number | string)[] = [];
    let pIdx = 1;

    if (resolvedResponsableId) {
      extraUpdates.push(`responsable_id = $${pIdx++}`);
      extraParams.push(resolvedResponsableId);
    }

    const resolvedPuestoId = puestoId ? parseInt(String(puestoId), 10) : null;
    const resolvedSedeId   = sedeId   ? parseInt(String(sedeId),   10) : null;

    if (resolvedPuestoId && !isNaN(resolvedPuestoId)) {
      extraUpdates.push(`puesto_id = $${pIdx++}`);
      extraParams.push(resolvedPuestoId);
    }
    if (resolvedSedeId && !isNaN(resolvedSedeId)) {
      extraUpdates.push(`sede_id = $${pIdx++}`);
      extraParams.push(resolvedSedeId);
    }

    if (extraUpdates.length > 0 && inserted[0]?.id) {
      extraParams.push(inserted[0].id);
      await pool.query(
        `UPDATE incidents SET ${extraUpdates.join(", ")} WHERE id = $${pIdx}`,
        extraParams
      );
    }

    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error("[incidents] POST error:", err);
    res.status(500).json({ error: "Error al crear incidencia" });
  }
});

// PATCH /incidents/:id — actualizar campos operativos
router.patch("/incidents/:id", async (req, res) => {
  try {
    const { estado, prioridad, responsable, notas, descripcion, tareaAsociada } = req.body;

    const PRIORIDADES_VALIDAS = ["alta", "media", "baja", "urgente"];
    const ESTADOS_VALIDOS = ["abierta", "en_proceso", "resuelta", "cerrada"];

    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }
    if (prioridad !== undefined && !PRIORIDADES_VALIDAS.includes(prioridad)) {
      return res.status(400).json({ error: "Prioridad inválida" });
    }

    const { esEmergencia, reportadoPor } = req.body;

    // A-04: validar responsableId contra employees igual que en POST
    let resolvedResponsableId: number | undefined;
    let resolvedResponsable: string | undefined;
    const rawResponsableId = req.body.responsableId;
    if (rawResponsableId !== undefined && rawResponsableId !== null) {
      const rid = parseInt(String(rawResponsableId), 10);
      if (!isNaN(rid)) {
        const { rows: empRows } = await pool.query(
          `SELECT id, nombre_completo FROM employees WHERE id = $1 AND estado_laboral != 'inactivo'`,
          [rid]
        );
        if (!empRows.length) {
          return res.status(400).json({ error: "El responsable indicado no existe o está inactivo" });
        }
        resolvedResponsableId = rid;
        resolvedResponsable = empRows[0].nombre_completo;
      }
    }

    const patch: Partial<typeof incidentsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (estado !== undefined) patch.estado = estado;
    if (prioridad !== undefined) patch.prioridad = prioridad;
    // Si viene responsableId validado, usamos el nombre derivado de la BD
    if (resolvedResponsable !== undefined) {
      patch.responsable = resolvedResponsable;
    } else if (responsable !== undefined) {
      patch.responsable = responsable?.trim() || "Sin asignar";
    }
    if (notas !== undefined) patch.descripcion = notas?.trim() || null;
    if (descripcion !== undefined) patch.descripcion = descripcion?.trim() || null;
    if (tareaAsociada !== undefined) patch.tareaAsociada = tareaAsociada?.trim() || null;
    if (esEmergencia !== undefined) patch.esEmergencia = esEmergencia === true || esEmergencia === "true";
    if (reportadoPor !== undefined) patch.reportadoPor = reportadoPor?.trim() || null;

    // A-05: auto-poblar fecha_cierre cuando estado cambia a cerrada/resuelta
    if (estado === "cerrada" || estado === "resuelta") {
      (patch as any).fechaCierre = new Date();
    }

    const updated = await db
      .update(incidentsTable)
      .set(patch)
      .where(eq(incidentsTable.id, req.params.id))
      .returning();

    if (!updated.length) return res.status(404).json({ error: "Incidencia no encontrada" });

    // A-04: persistir responsable_id si fue validado
    if (resolvedResponsableId && updated[0]?.id) {
      await pool.query(
        `UPDATE incidents SET responsable_id = $1 WHERE id = $2`,
        [resolvedResponsableId, updated[0].id]
      );
    }

    res.json(updated[0]);
  } catch (err) {
    console.error("[incidents] PATCH error:", err);
    res.status(500).json({ error: "Error al actualizar incidencia" });
  }
});

export default router;
