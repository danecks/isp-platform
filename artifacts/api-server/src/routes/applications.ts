import { Router } from "express";
import { db, applicationsTable } from "@workspace/db";
import { pool } from "@workspace/db";
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

const ESTADOS_POSTULANTE = ["recibido", "en_revision", "entrevista", "aprobado", "descartado"] as const;

router.post("/applications", async (req, res) => {
  try {
    const { nombre, telefono, correo, experiencia, ubicacion, puesto, canal, notas, dpi } = req.body;
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
    // A-12: guardar DPI en columna separada (agregada en Fase 2)
    if (dpi?.trim() && inserted[0]?.id) {
      await (await import("@workspace/db")).pool.query(
        `UPDATE applications SET dpi = $1 WHERE id = $2`,
        [dpi.trim(), inserted[0].id]
      );
    }
    res.status(201).json(inserted[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al crear postulación" });
  }
});

router.patch("/applications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { estado, notas, dpi } = req.body;

    // Validar estado contra enum antes de guardar
    if (estado !== undefined && !ESTADOS_POSTULANTE.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Valores permitidos: ${ESTADOS_POSTULANTE.join(", ")}`,
      });
    }

    const updated = await db.update(applicationsTable)
      .set({ estado, notas, updatedAt: new Date() })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!updated.length) return res.status(404).json({ error: "Postulación no encontrada" });

    // A-12: actualizar DPI si viene en el body
    if (dpi !== undefined) {
      await (await import("@workspace/db")).pool.query(
        `UPDATE applications SET dpi = $1 WHERE id = $2`,
        [dpi?.trim() || null, id]
      );
    }

    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar postulación" });
  }
});

// A-11: POST /api/applications/:id/contratar — crear empleado desde postulación aprobada
router.post("/applications/:id/contratar", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
    if (!app) return res.status(404).json({ error: "Postulación no encontrada" });
    if (app.estado !== "aprobado") {
      return res.status(400).json({ error: "Solo se pueden contratar postulantes con estado 'aprobado'" });
    }
    if (!app.nombre || !String(app.nombre).trim()) {
      return res.status(400).json({ error: "La postulación no tiene nombre válido — no se puede crear el empleado" });
    }

    // Asegurar que la columna employee_id existe (migración lazy)
    await pool.query(
      `ALTER TABLE applications ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id)`
    );

    // Verificar si ya fue convertido
    const { rows: existCheck } = await pool.query(
      `SELECT employee_id FROM applications WHERE id = $1 AND employee_id IS NOT NULL`, [id]
    );
    if (existCheck.length > 0) {
      return res.status(409).json({ error: "Esta postulación ya fue convertida a empleado", empleadoId: existCheck[0].employee_id });
    }

    // Obtener DPI del postulante
    const { rows: appFull } = await pool.query(
      `SELECT dpi FROM applications WHERE id = $1`, [id]
    );
    const dpi = appFull[0]?.dpi ?? null;

    // Crear empleado
    const { rows: nuevoEmp } = await pool.query<{ id: number }>(`
      INSERT INTO employees (
        nombre_completo, dpi, telefono, correo,
        puesto, area, sede,
        estado_laboral, fecha_ingreso,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', NOW(), NOW(), NOW())
      RETURNING id
    `, [
      String(app.nombre).trim(),
      dpi,
      app.telefono,
      app.correo ?? null,
      app.puesto ?? "Agente de Seguridad",
      "Operaciones",
      app.ubicacion ?? "Guatemala",
    ]);

    const empleadoId = nuevoEmp[0].id;
    const numEmpleado = `EMP-${String(empleadoId).padStart(4, "0")}`;

    // Vincular empleado a la postulación
    await pool.query(
      `UPDATE applications SET employee_id = $1, updated_at = NOW() WHERE id = $2`,
      [empleadoId, id]
    );

    res.status(201).json({
      ok: true,
      mensaje: "Postulante contratado y empleado creado exitosamente",
      empleadoId,
      numEmpleado,
      nombre: app.nombre,
    });
  } catch (err) {
    console.error("[applications/contratar]", err);
    res.status(500).json({ error: "Error al crear empleado desde postulación" });
  }
});

export default router;
