/**
 * ANTICIPOS API — Solicitudes de anticipo salarial
 *
 * GET    /api/anticipos         — listar con filtros (estado, origen, periodo, fecha)
 * PATCH  /api/anticipos/:id     — actualizar estado y observaciones
 * GET    /api/anticipos/config  — configuración de períodos habilitados
 * GET    /api/anticipos/export  — exportar CSV (fecha, nombre, puesto, dpi, cantidad, telefono, estado)
 */

import { Router } from "express";
import { db, anticiposTable } from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { DIAS_HABILITADOS, getPeriodoActivo } from "../services/whatsapp/anticipo-session";
import { calcularLimiteAnticipo } from "../services/anticipo-limite";

const anticiposRouter = Router();

// ── GET /api/anticipos/config ──────────────────────────────────────────────
anticiposRouter.get("/anticipos/config", (_req, res) => {
  const periodoActual = getPeriodoActivo();
  res.json({
    diasHabilitados: DIAS_HABILITADOS,
    toleranciaDias: 1,
    periodoActual,
    habilitadoAhora: periodoActual !== null,
    estadosValidos: ["pendiente", "aprobada", "rechazada", "pagada"],
  });
});

// ── GET /api/anticipos/export — CSV ────────────────────────────────────────
anticiposRouter.get("/anticipos/export", async (req, res) => {
  try {
    const { estado, periodo, desde, hasta } = req.query as Record<string, string>;

    let rows = await db
      .select()
      .from(anticiposTable)
      .orderBy(desc(anticiposTable.fechaSolicitud));

    // Filtros
    if (estado) rows = rows.filter((r) => r.estado === estado);
    if (periodo) rows = rows.filter((r) => r.periodo === periodo);
    if (desde) rows = rows.filter((r) => new Date(r.fechaSolicitud) >= new Date(desde));
    if (hasta) rows = rows.filter((r) => new Date(r.fechaSolicitud) <= new Date(hasta));

    // CSV
    const header = "fecha,nombre,puesto,dpi,cantidad,telefono,estado,periodo,origen\n";
    const csvRows = rows.map((r) => {
      const cols = [
        r.fechaSolicitud.toISOString().split("T")[0],
        `"${(r.nombre ?? "").replace(/"/g, '""')}"`,
        `"${(r.puesto ?? "").replace(/"/g, '""')}"`,
        r.dpi ?? "",
        r.cantidad,
        r.telefono ?? "",
        r.estado,
        r.periodo ?? "",
        r.origen,
      ];
      return cols.join(",");
    });

    const csv = header + csvRows.join("\n");
    const filename = `anticipos-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM para Excel en español
  } catch (err) {
    res.status(500).json({ error: "Error al exportar CSV" });
  }
});

// ── GET /api/anticipos ─────────────────────────────────────────────────────
anticiposRouter.get("/anticipos", async (req, res) => {
  try {
    const { estado, origen, periodo, desde, hasta } = req.query as Record<string, string>;

    let rows = await db
      .select()
      .from(anticiposTable)
      .orderBy(desc(anticiposTable.fechaSolicitud));

    if (estado) rows = rows.filter((r) => r.estado === estado);
    if (origen) rows = rows.filter((r) => r.origen === origen);
    if (periodo) rows = rows.filter((r) => r.periodo === periodo);
    if (desde) rows = rows.filter((r) => new Date(r.fechaSolicitud) >= new Date(desde));
    if (hasta) rows = rows.filter((r) => new Date(r.fechaSolicitud) <= new Date(hasta));

    // Totales por estado
    const all = await db.select().from(anticiposTable);
    const totales = {
      pendiente: all.filter((r) => r.estado === "pendiente").length,
      aprobada: all.filter((r) => r.estado === "aprobada").length,
      rechazada: all.filter((r) => r.estado === "rechazada").length,
      pagada: all.filter((r) => r.estado === "pagada").length,
      total: all.length,
      montoPendiente: all.filter((r) => r.estado === "pendiente").reduce((s, r) => s + r.cantidad, 0),
      montoAprobado: all.filter((r) => r.estado === "aprobada").reduce((s, r) => s + r.cantidad, 0),
    };

    res.json({ anticipos: rows, totales });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener anticipos" });
  }
});

// ── POST /api/anticipos — crear anticipo manual ────────────────────────────
anticiposRouter.post("/anticipos", async (req, res) => {
  const { nombre, cantidad, empleadoId, puesto, dpi, telefono, observaciones } = req.body ?? {};

  if (!nombre || !cantidad) {
    return res.status(400).json({ error: "nombre y cantidad son requeridos" });
  }
  const monto = Number(cantidad);
  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({ error: "cantidad debe ser un número mayor a 0" });
  }

  try {
    const periodo = getPeriodoActivo() ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-manual`;

    // Validar límite si el colaborador está vinculado
    if (empleadoId) {
      const limite = await calcularLimiteAnticipo(Number(empleadoId), periodo);
      if (limite.tieneLimite && limite.restante !== null && monto > limite.restante) {
        return res.status(422).json({
          error: "excede_limite",
          mensaje:
            limite.restante === 0
              ? `${nombre} ya no tiene saldo disponible para este período.`
              : `El monto Q${monto} excede el disponible de Q${limite.restante} para este período.`,
          limite: limite.limite,
          solicitado: limite.solicitado,
          restante: limite.restante,
          periodo,
        });
      }
    }

    const [created] = await db
      .insert(anticiposTable)
      .values({
        employeeId: empleadoId ? Number(empleadoId) : null,
        nombre: String(nombre).trim(),
        puesto: puesto ? String(puesto).trim() : null,
        dpi: dpi ? String(dpi).trim() : null,
        telefono: telefono ? String(telefono).trim() : null,
        cantidad: monto,
        origen: "manual",
        estado: "pendiente",
        periodo,
        observaciones: observaciones ? String(observaciones).trim() : null,
        fechaSolicitud: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear anticipo" });
  }
});

// ── GET /api/anticipos/:id ─────────────────────────────────────────────────
anticiposRouter.get("/anticipos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [row] = await db
      .select()
      .from(anticiposTable)
      .where(eq(anticiposTable.id, id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Anticipo no encontrado" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener anticipo" });
  }
});

// ── PATCH /api/anticipos/:id ───────────────────────────────────────────────
anticiposRouter.patch("/anticipos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { estado, observaciones } = req.body ?? {};
  const ESTADOS_VALIDOS = ["pendiente", "aprobada", "rechazada", "pagada"];
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: "Estado inválido", validos: ESTADOS_VALIDOS });
  }

  try {
    // Bloqueo de seguridad: anticipos vinculados a una planilla no se pueden editar
    const existing = await db.select().from(anticiposTable).where(eq(anticiposTable.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Anticipo no encontrado" });

    if (existing[0].planilla_id !== null) {
      return res.status(409).json({
        error: "Este anticipo está vinculado a una planilla y no puede modificarse. Para corregirlo, revierte la planilla primero.",
        planilla_id: existing[0].planilla_id,
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (estado) updates.estado = estado;
    if (observaciones !== undefined) updates.observaciones = observaciones;

    const [updated] = await db
      .update(anticiposTable)
      .set(updates)
      .where(eq(anticiposTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Anticipo no encontrado" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar anticipo" });
  }
});

export default anticiposRouter;
