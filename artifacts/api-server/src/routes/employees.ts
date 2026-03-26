import { Router } from "express";
import { db, employeesTable, usersTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";

const employeesRouter = Router();

// GET /api/employees — list all employees
employeesRouter.get("/employees", async (req, res) => {
  try {
    const { syncStatus, estadoLaboral, area, sourceSystem } = req.query as Record<string, string>;

    let query = db.select().from(employeesTable).orderBy(asc(employeesTable.nombreCompleto));

    // Apply filters if provided
    const results = await query;
    const filtered = results.filter((e) => {
      if (syncStatus && e.syncStatus !== syncStatus) return false;
      if (estadoLaboral && e.estadoLaboral !== estadoLaboral) return false;
      if (area && e.area !== area) return false;
      if (sourceSystem && e.sourceSystem !== sourceSystem) return false;
      return true;
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener empleados" });
  }
});

// GET /api/employees/:id — single employee
employeesRouter.get("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);
    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener empleado" });
  }
});

// POST /api/employees — create employee (manual entry)
employeesRouter.post("/employees", async (req, res) => {
  const {
    nombreCompleto, dpi, telefono, correo, puesto, area,
    estadoLaboral, sede, supervisorNombre, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus,
  } = req.body ?? {};

  if (!nombreCompleto) {
    return res.status(400).json({ error: "nombreCompleto es requerido" });
  }

  try {
    const [emp] = await db
      .insert(employeesTable)
      .values({
        nombreCompleto,
        dpi: dpi || null,
        telefono: telefono || null,
        correo: correo || null,
        puesto: puesto || null,
        area: area || null,
        estadoLaboral: estadoLaboral || "activo",
        sede: sede || null,
        supervisorNombre: supervisorNombre || null,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null,
        notas: notas || null,
        externalId: externalId || null,
        sourceSystem: sourceSystem || "manual",
        syncStatus: syncStatus || "manual",
      })
      .returning();

    res.status(201).json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al crear empleado" });
  }
});

// PATCH /api/employees/:id — update employee
employeesRouter.patch("/employees/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    nombreCompleto, dpi, telefono, correo, puesto, area,
    estadoLaboral, sede, supervisorNombre, fechaIngreso, notas,
    externalId, sourceSystem, syncStatus, lastSyncAt,
  } = req.body ?? {};

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (nombreCompleto !== undefined) updates.nombreCompleto = nombreCompleto;
  if (dpi !== undefined) updates.dpi = dpi || null;
  if (telefono !== undefined) updates.telefono = telefono || null;
  if (correo !== undefined) updates.correo = correo || null;
  if (puesto !== undefined) updates.puesto = puesto || null;
  if (area !== undefined) updates.area = area || null;
  if (estadoLaboral !== undefined) updates.estadoLaboral = estadoLaboral;
  if (sede !== undefined) updates.sede = sede || null;
  if (supervisorNombre !== undefined) updates.supervisorNombre = supervisorNombre || null;
  if (fechaIngreso !== undefined) updates.fechaIngreso = fechaIngreso ? new Date(fechaIngreso) : null;
  if (notas !== undefined) updates.notas = notas || null;
  if (externalId !== undefined) updates.externalId = externalId || null;
  if (sourceSystem !== undefined) updates.sourceSystem = sourceSystem;
  if (syncStatus !== undefined) updates.syncStatus = syncStatus;
  if (lastSyncAt !== undefined) updates.lastSyncAt = lastSyncAt ? new Date(lastSyncAt) : null;

  try {
    const [emp] = await db
      .update(employeesTable)
      .set(updates)
      .where(eq(employeesTable.id, id))
      .returning();

    if (!emp) return res.status(404).json({ error: "Empleado no encontrado" });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar empleado" });
  }
});

// GET /api/employees/sync/status — summary of sync state (placeholder for future)
employeesRouter.get("/employees/sync/status", async (_req, res) => {
  try {
    const all = await db.select().from(employeesTable);
    const summary = {
      total: all.length,
      bySource: {
        manual: all.filter((e) => e.sourceSystem === "manual").length,
        hr_sql_external: all.filter((e) => e.sourceSystem === "hr_sql_external").length,
        api: all.filter((e) => e.sourceSystem === "api").length,
      },
      bySyncStatus: {
        manual: all.filter((e) => e.syncStatus === "manual").length,
        synced: all.filter((e) => e.syncStatus === "synced").length,
        pending: all.filter((e) => e.syncStatus === "pending").length,
        error: all.filter((e) => e.syncStatus === "error").length,
      },
      lastSyncAt: all
        .filter((e) => e.lastSyncAt)
        .sort((a, b) => (b.lastSyncAt!.getTime() - a.lastSyncAt!.getTime()))
        .at(0)?.lastSyncAt ?? null,
    };
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estado de sync" });
  }
});

export default employeesRouter;
