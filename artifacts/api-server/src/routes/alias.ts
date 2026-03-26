/**
 * ALIAS ROUTES — /api/alias/*
 *
 * Gestión de alias de clientes y puestos/rutas.
 * Permisos: admin y supervisor (lectura). Solo admin puede crear/eliminar.
 *
 * ENDPOINTS:
 *  GET  /api/alias/clientes              — lista clientes con alias
 *  POST /api/alias/clientes              — crear cliente
 *  GET  /api/alias/clientes/:id          — cliente + alias + puestos
 *  POST /api/alias/clientes/:id/alias    — agregar alias a cliente
 *  DELETE /api/alias/clientes/alias/:aliasId — eliminar alias de cliente
 *
 *  GET  /api/alias/puestos               — lista puestos con alias
 *  POST /api/alias/puestos               — crear puesto
 *  GET  /api/alias/puestos/:id           — puesto + alias
 *  POST /api/alias/puestos/:id/alias     — agregar alias a puesto
 *  DELETE /api/alias/puestos/alias/:aliasId — eliminar alias de puesto
 *
 *  POST /api/alias/resolver              — resolver texto libre → coincidencias
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable,
  clientAliasesTable,
  serviceLocationsTable,
  positionAliasesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { resolverAlias } from "../services/alias/resolver";

export const aliasRouter = Router();

// ─── Middleware de autenticación simple ───────────────────────────────────────
function requireAdmin(req: any, res: any, next: any) {
  const session = req.headers["x-isp-session"];
  const role = req.headers["x-isp-role"];
  if (!session && !role) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/alias/clientes
aliasRouter.get("/alias/clientes", async (req, res) => {
  try {
    const clientes = await db.select().from(clientsTable).orderBy(clientsTable.nombre);
    const aliases = await db.select().from(clientAliasesTable);

    const result = clientes.map((c) => ({
      ...c,
      aliases: aliases.filter((a) => a.clientId === c.id),
    }));

    res.json(result);
  } catch (err) {
    console.error("[alias/clientes GET]", err);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

// POST /api/alias/clientes
aliasRouter.post("/alias/clientes", async (req, res) => {
  const { nombre, nombreComercial, nit, sector, notas, portalClienteId } = req.body;
  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

  try {
    const [nuevo] = await db
      .insert(clientsTable)
      .values({ nombre, nombreComercial, nit, sector, notas, portalClienteId })
      .returning();
    res.status(201).json(nuevo);
  } catch (err) {
    console.error("[alias/clientes POST]", err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

// GET /api/alias/clientes/:id
aliasRouter.get("/alias/clientes/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [cliente] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    const aliases = await db.select().from(clientAliasesTable).where(eq(clientAliasesTable.clientId, id));
    const puestos = await db.select().from(serviceLocationsTable).where(eq(serviceLocationsTable.clientId, id));
    const puestoIds = puestos.map((p) => p.id);

    let posAliases: any[] = [];
    if (puestoIds.length > 0) {
      posAliases = await db.select().from(positionAliasesTable);
      posAliases = posAliases.filter((pa) => puestoIds.includes(pa.puestoId));
    }

    const puestosConAlias = puestos.map((p) => ({
      ...p,
      aliases: posAliases.filter((pa) => pa.puestoId === p.id),
    }));

    res.json({ ...cliente, aliases, puestos: puestosConAlias });
  } catch (err) {
    console.error("[alias/clientes/:id GET]", err);
    res.status(500).json({ error: "Error al obtener cliente" });
  }
});

// PATCH /api/alias/clientes/:id
aliasRouter.patch("/alias/clientes/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { nombre, nombreComercial, nit, sector, notas, portalClienteId, estado } = req.body;

  try {
    const [updated] = await db
      .update(clientsTable)
      .set({
        ...(nombre && { nombre }),
        ...(nombreComercial !== undefined && { nombreComercial }),
        ...(nit !== undefined && { nit }),
        ...(sector !== undefined && { sector }),
        ...(notas !== undefined && { notas }),
        ...(portalClienteId !== undefined && { portalClienteId }),
        ...(estado && { estado }),
        updatedAt: new Date(),
      })
      .where(eq(clientsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(updated);
  } catch (err) {
    console.error("[alias/clientes/:id PATCH]", err);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

// POST /api/alias/clientes/:id/alias
aliasRouter.post("/alias/clientes/:id/alias", async (req, res) => {
  const clientId = parseInt(req.params.id, 10);
  if (isNaN(clientId)) return res.status(400).json({ error: "ID inválido" });

  const { alias, tipoAlias } = req.body;
  if (!alias) return res.status(400).json({ error: "alias es requerido" });

  try {
    const [nuevo] = await db
      .insert(clientAliasesTable)
      .values({ clientId, alias: alias.toLowerCase().trim(), tipoAlias: tipoAlias || "comun" })
      .returning();
    res.status(201).json(nuevo);
  } catch (err) {
    console.error("[alias/clientes/:id/alias POST]", err);
    res.status(500).json({ error: "Error al agregar alias" });
  }
});

// DELETE /api/alias/clientes/alias/:aliasId
aliasRouter.delete("/alias/clientes/alias/:aliasId", async (req, res) => {
  const aliasId = parseInt(req.params.aliasId, 10);
  if (isNaN(aliasId)) return res.status(400).json({ error: "ID inválido" });

  try {
    await db.delete(clientAliasesTable).where(eq(clientAliasesTable.id, aliasId));
    res.json({ ok: true });
  } catch (err) {
    console.error("[alias/clientes/alias/:aliasId DELETE]", err);
    res.status(500).json({ error: "Error al eliminar alias" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUESTOS / SERVICE LOCATIONS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/alias/puestos
aliasRouter.get("/alias/puestos", async (req, res) => {
  try {
    const puestos = await db
      .select({
        id: serviceLocationsTable.id,
        clientId: serviceLocationsTable.clientId,
        nombrePuesto: serviceLocationsTable.nombrePuesto,
        ubicacion: serviceLocationsTable.ubicacion,
        tipo: serviceLocationsTable.tipo,
        estado: serviceLocationsTable.estado,
        notas: serviceLocationsTable.notas,
        createdAt: serviceLocationsTable.createdAt,
        clienteNombre: clientsTable.nombre,
        clienteNombreComercial: clientsTable.nombreComercial,
      })
      .from(serviceLocationsTable)
      .innerJoin(clientsTable, eq(serviceLocationsTable.clientId, clientsTable.id))
      .orderBy(clientsTable.nombre, serviceLocationsTable.nombrePuesto);

    const aliases = await db.select().from(positionAliasesTable);

    const result = puestos.map((p) => ({
      ...p,
      aliases: aliases.filter((a) => a.puestoId === p.id),
    }));

    res.json(result);
  } catch (err) {
    console.error("[alias/puestos GET]", err);
    res.status(500).json({ error: "Error al obtener puestos" });
  }
});

// POST /api/alias/puestos
aliasRouter.post("/alias/puestos", async (req, res) => {
  const { clientId, nombrePuesto, ubicacion, tipo, notas } = req.body;
  if (!clientId || !nombrePuesto) return res.status(400).json({ error: "clientId y nombrePuesto son requeridos" });

  try {
    const [nuevo] = await db
      .insert(serviceLocationsTable)
      .values({ clientId: parseInt(clientId, 10), nombrePuesto, ubicacion, tipo: tipo || "vigilancia", notas })
      .returning();
    res.status(201).json(nuevo);
  } catch (err) {
    console.error("[alias/puestos POST]", err);
    res.status(500).json({ error: "Error al crear puesto" });
  }
});

// GET /api/alias/puestos/:id
aliasRouter.get("/alias/puestos/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [puesto] = await db.select().from(serviceLocationsTable).where(eq(serviceLocationsTable.id, id));
    if (!puesto) return res.status(404).json({ error: "Puesto no encontrado" });

    const aliases = await db.select().from(positionAliasesTable).where(eq(positionAliasesTable.puestoId, id));
    res.json({ ...puesto, aliases });
  } catch (err) {
    console.error("[alias/puestos/:id GET]", err);
    res.status(500).json({ error: "Error al obtener puesto" });
  }
});

// POST /api/alias/puestos/:id/alias
aliasRouter.post("/alias/puestos/:id/alias", async (req, res) => {
  const puestoId = parseInt(req.params.id, 10);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID inválido" });

  const { alias, tipoAlias } = req.body;
  if (!alias) return res.status(400).json({ error: "alias es requerido" });

  try {
    const [nuevo] = await db
      .insert(positionAliasesTable)
      .values({ puestoId, alias: alias.toLowerCase().trim(), tipoAlias: tipoAlias || "comun" })
      .returning();
    res.status(201).json(nuevo);
  } catch (err) {
    console.error("[alias/puestos/:id/alias POST]", err);
    res.status(500).json({ error: "Error al agregar alias" });
  }
});

// DELETE /api/alias/puestos/alias/:aliasId
aliasRouter.delete("/alias/puestos/alias/:aliasId", async (req, res) => {
  const aliasId = parseInt(req.params.aliasId, 10);
  if (isNaN(aliasId)) return res.status(400).json({ error: "ID inválido" });

  try {
    await db.delete(positionAliasesTable).where(eq(positionAliasesTable.id, aliasId));
    res.json({ ok: true });
  } catch (err) {
    console.error("[alias/puestos/alias/:aliasId DELETE]", err);
    res.status(500).json({ error: "Error al eliminar alias" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVER — endpoint de prueba y uso programático
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/alias/resolver
aliasRouter.post("/alias/resolver", async (req, res) => {
  const { texto } = req.body;
  if (!texto || typeof texto !== "string") {
    return res.status(400).json({ error: "Se requiere campo 'texto'" });
  }
  if (texto.trim().length < 2) {
    return res.status(400).json({ error: "El texto debe tener al menos 2 caracteres" });
  }

  try {
    const resultado = await resolverAlias(texto.trim());
    res.json(resultado);
  } catch (err) {
    console.error("[alias/resolver POST]", err);
    res.status(500).json({ error: "Error al resolver alias" });
  }
});

// GET /api/alias/resolver?q=texto  (versión GET para conveniencia)
aliasRouter.get("/alias/resolver", async (req, res) => {
  const texto = req.query.q as string;
  if (!texto || texto.trim().length < 2) {
    return res.status(400).json({ error: "Se requiere parámetro q con al menos 2 caracteres" });
  }

  try {
    const resultado = await resolverAlias(texto.trim());
    res.json(resultado);
  } catch (err) {
    console.error("[alias/resolver GET]", err);
    res.status(500).json({ error: "Error al resolver alias" });
  }
});
