/**
 * EMERGENCIAS ROUTER — ISP, S.A.
 *
 * Endpoints para el módulo de emergencias restringidas.
 *
 * POST /emergencias                  — crear emergencia (valida permiso, resuelve alias)
 * GET  /emergencias                  — listar solo incidencias con esEmergencia=true
 * GET  /emergencias/tipos            — catálogo de tipos de emergencia
 * GET  /emergencias/verificar/:userId — verificar si el usuario puede reportar
 * POST /emergencias/resolver-alias   — probar resolución de ubicación vía alias
 */

import { Router } from "express";
import { db, incidentsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  esTextoEmergencia,
  puedeReportarEmergencia,
  crearEmergencia,
  resolverUbicacionEmergencia,
  buscarUsuarioPorTelefono,
  TIPOS_EMERGENCIA_DEFAULT,
} from "../services/whatsapp/emergencias.service";

const router = Router();

// GET /emergencias/tipos — catálogo de tipos
router.get("/emergencias/tipos", (_req, res) => {
  res.json(TIPOS_EMERGENCIA_DEFAULT);
});

// GET /emergencias — listar emergencias activas
router.get("/emergencias", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.esEmergencia, true))
      .orderBy(desc(incidentsTable.fecha));
    res.json(rows);
  } catch (err) {
    console.error("[emergencias] GET error:", err);
    res.status(500).json({ error: "Error al obtener emergencias" });
  }
});

// GET /emergencias/count — solo abiertas
router.get("/emergencias/count", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(incidentsTable)
      .where(
        and(
          eq(incidentsTable.esEmergencia, true),
          eq(incidentsTable.estado, "abierta")
        )
      );
    res.json({ count: rows.length });
  } catch (err) {
    console.error("[emergencias] COUNT error:", err);
    res.status(500).json({ error: "Error al contar emergencias" });
  }
});

// GET /emergencias/verificar/:userId — verificar si puede reportar
router.get("/emergencias/verificar/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "userId inválido" });

    const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado" });

    const user = rows[0];
    const permiso = puedeReportarEmergencia({
      rol: user.rol,
      estado: user.estado,
      canReportEmergency: user.canReportEmergency,
    });

    res.json({
      userId,
      nombre: user.nombre,
      rol: user.rol,
      ...permiso,
    });
  } catch (err) {
    console.error("[emergencias] VERIFICAR error:", err);
    res.status(500).json({ error: "Error al verificar permiso" });
  }
});

// POST /emergencias/resolver-alias — probar resolución de texto libre
router.post("/emergencias/resolver-alias", async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto?.trim() || texto.trim().length < 2) {
      return res.status(400).json({ error: "Se requiere 'texto' con al menos 2 caracteres" });
    }
    const resultado = await resolverUbicacionEmergencia(texto.trim());
    res.json(resultado);
  } catch (err) {
    console.error("[emergencias] RESOLVER-ALIAS error:", err);
    res.status(500).json({ error: "Error al resolver alias" });
  }
});

// POST /emergencias/detectar — detectar si texto activa flujo
router.post("/emergencias/detectar", (req, res) => {
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ error: "Se requiere campo 'texto'" });
  const resultado = esTextoEmergencia(texto);
  res.json(resultado);
});

// POST /emergencias — crear emergencia
router.post("/emergencias", async (req, res) => {
  try {
    const {
      clienteNombre,
      clienteRefId,
      ubicacion,
      tipoEmergencia,
      descripcion,
      reportadoPor,
      origen,
      userId,           // opcional: validar permiso del usuario
      ubicacionTexto,   // opcional: texto libre para resolver alias automáticamente
    } = req.body;

    // Validaciones básicas
    if (!clienteNombre?.trim()) {
      return res.status(400).json({ error: "El campo 'clienteNombre' es requerido" });
    }
    if (!tipoEmergencia?.trim()) {
      return res.status(400).json({ error: "El campo 'tipoEmergencia' es requerido" });
    }
    if (!reportadoPor?.trim()) {
      return res.status(400).json({ error: "El campo 'reportadoPor' es requerido" });
    }

    // Validar permiso del usuario si se proporciona userId
    if (userId) {
      const userRows = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(userId, 10)));
      if (!userRows.length) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const permiso = puedeReportarEmergencia(userRows[0]);
      if (!permiso.autorizado) {
        return res.status(403).json({ error: `No autorizado: ${permiso.razon}` });
      }
    }

    // Resolver alias si se proporciona texto libre de ubicación
    let ubicacionFinal = ubicacion?.trim() || "No especificada";
    let aliasResult = null;

    if (ubicacionTexto?.trim()) {
      aliasResult = await resolverUbicacionEmergencia(ubicacionTexto.trim());
      // Si hay coincidencia de alta confianza sin ambigüedad, usar esa ubicación
      if (aliasResult.resultados.length > 0 && !aliasResult.ambiguo && aliasResult.confianzaMaxima >= 0.7) {
        const top = aliasResult.resultados[0];
        if (top.tipo === "puesto") {
          ubicacionFinal = `${top.nombrePuesto} — ${top.clienteNombre}`;
        } else {
          ubicacionFinal = top.nombreComercial || top.nombre;
        }
      }
    }

    const incidencia = await crearEmergencia({
      clienteNombre: clienteNombre.trim(),
      clienteRefId: clienteRefId || null,
      ubicacion: ubicacionFinal,
      tipoEmergencia: tipoEmergencia.trim(),
      descripcion: descripcion?.trim() || "Sin descripción adicional",
      reportadoPor: reportadoPor.trim(),
      origen: origen || "manual",
    });

    res.status(201).json({
      ...incidencia,
      aliasResuelto: aliasResult,
    });
  } catch (err) {
    console.error("[emergencias] POST error:", err);
    res.status(500).json({ error: "Error al registrar emergencia" });
  }
});

// PATCH /emergencias/:id/permiso — actualizar permiso de usuario para reportar
router.patch("/emergencias/usuario/:userId/permiso", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { canReportEmergency } = req.body;

    if (typeof canReportEmergency !== "boolean" && canReportEmergency !== null) {
      return res.status(400).json({ error: "canReportEmergency debe ser true, false o null" });
    }

    const updated = await db
      .update(usersTable)
      .set({ canReportEmergency, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated.length) return res.status(404).json({ error: "Usuario no encontrado" });

    const permiso = puedeReportarEmergencia(updated[0]);
    res.json({ ...updated[0], permiso });
  } catch (err) {
    console.error("[emergencias] PATCH PERMISO error:", err);
    res.status(500).json({ error: "Error al actualizar permiso" });
  }
});

export default router;
