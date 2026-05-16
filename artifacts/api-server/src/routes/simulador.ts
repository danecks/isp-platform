/**
 * SIMULADOR DE WHATSAPP — Rutas HTTP
 *
 * Capa fina sobre `services/whatsapp/simulator/*`. Toda la lógica de
 * simulación (validación, intenciones, modo dry-run vs. real) vive en el
 * servicio; aquí solo manejamos parsing, errores y endpoints auxiliares.
 *
 * Endpoints:
 *   POST   /api/simulador           — simula un mensaje entrante.
 *   GET    /api/simulador/usuarios  — lista usuarios activos para el selector.
 *   DELETE /api/simulador/sesion    — limpia sesiones de anticipo y DPI.
 */

import { Router } from "express";
import { pool, db, waSimulatorScenariosTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { deleteSession } from "../services/whatsapp/anticipo-session";
import { clearPhoneRegSession } from "../services/whatsapp/phone-registration-session";
import {
  simularMensaje,
  normalizarTelefono,
} from "../services/whatsapp/simulator";
import { logger } from "../lib/logger";

const router = Router();

type ScenarioGrupo = "interno" | "externo" | "dpi";
const GRUPOS_VALIDOS = new Set<ScenarioGrupo>(["interno", "externo", "dpi"]);

// Tipo de inserción derivado del schema Drizzle, sin id ni updatedAt (los
// genera la DB). Lo usamos como fuente de verdad para el payload del POST.
type ScenarioInsert = Omit<
  typeof waSimulatorScenariosTable.$inferInsert,
  "id" | "updatedAt"
>;
type ScenarioUpdate = Partial<ScenarioInsert>;

function isGrupoValido(v: unknown): v is ScenarioGrupo {
  return typeof v === "string" && GRUPOS_VALIDOS.has(v as ScenarioGrupo);
}

function parseScenarioCreate(body: unknown): ScenarioInsert {
  const b = (body ?? {}) as Record<string, unknown>;

  if (!isGrupoValido(b.grupo)) {
    throw new Error("grupo inválido (use: interno | externo | dpi)");
  }
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) throw new Error("label es obligatorio");
  const mensaje = typeof b.mensaje === "string" ? b.mensaje.trim() : "";
  if (!mensaje) throw new Error("mensaje es obligatorio");

  const out: ScenarioInsert = {
    grupo: b.grupo,
    label,
    mensaje,
    icono: typeof b.icono === "string" ? b.icono.slice(0, 16) : "",
    color: typeof b.color === "string" ? b.color.slice(0, 200) : "",
    skipValidacion: Boolean(b.skipValidacion),
    activo: b.activo === undefined ? true : Boolean(b.activo),
    orden: 0,
  };

  if (b.orden !== undefined) {
    const n = Number(b.orden);
    if (!Number.isFinite(n)) throw new Error("orden debe ser numérico");
    out.orden = Math.trunc(n);
  }
  return out;
}

function parseScenarioUpdate(body: unknown): ScenarioUpdate {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: ScenarioUpdate = {};

  if (b.grupo !== undefined) {
    if (!isGrupoValido(b.grupo)) {
      throw new Error("grupo inválido (use: interno | externo | dpi)");
    }
    out.grupo = b.grupo;
  }
  if (b.label !== undefined) {
    const v = typeof b.label === "string" ? b.label.trim() : "";
    if (!v) throw new Error("label es obligatorio");
    out.label = v;
  }
  if (b.mensaje !== undefined) {
    const v = typeof b.mensaje === "string" ? b.mensaje.trim() : "";
    if (!v) throw new Error("mensaje es obligatorio");
    out.mensaje = v;
  }
  if (b.icono !== undefined) {
    out.icono = typeof b.icono === "string" ? b.icono.slice(0, 16) : "";
  }
  if (b.color !== undefined) {
    out.color = typeof b.color === "string" ? b.color.slice(0, 200) : "";
  }
  if (b.skipValidacion !== undefined) out.skipValidacion = Boolean(b.skipValidacion);
  if (b.activo !== undefined) out.activo = Boolean(b.activo);
  if (b.orden !== undefined) {
    const n = Number(b.orden);
    if (!Number.isFinite(n)) throw new Error("orden debe ser numérico");
    out.orden = Math.trunc(n);
  }
  return out;
}

router.post("/simulador", async (req, res) => {
  try {
    const {
      telefono,
      nombre = "Simulado",
      mensaje,
      persistir = false,
      skipValidacion = false,
    } = req.body;

    if (!telefono?.trim()) return res.status(400).json({ error: "El teléfono es obligatorio" });
    if (!mensaje?.trim()) return res.status(400).json({ error: "El mensaje es obligatorio" });

    const result = await simularMensaje({
      telefono: telefono.trim(),
      nombre: nombre.trim(),
      mensaje: mensaje.trim(),
      persistir: Boolean(persistir),
      skipValidacion: Boolean(skipValidacion),
    });

    logger.info({
      telefono,
      intencion: result.debug.clasificacion.intencion,
      persistir,
      duracionMs: result.debug.duracionMs,
    }, "[Simulador] Mensaje procesado");

    res.json(result);
  } catch (err) {
    logger.error({ err }, "[Simulador] Error inesperado");
    res.status(500).json({ error: "Error al simular mensaje" });
  }
});

router.get("/simulador/usuarios", async (_req, res) => {
  try {
    const { rows } = await pool.query<{
      id: number;
      nombre: string;
      rol: string;
      telefono: string | null;
      estado: string;
    }>(
      `SELECT id, nombre, rol, telefono, estado
       FROM users
       WHERE estado = 'activo'
       ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[Simulador] Error al listar usuarios");
    res.status(500).json({ error: "Error al listar usuarios" });
  }
});

// Limpia tanto la sesión de anticipo como la de registro de teléfono (DPI).
router.delete("/simulador/sesion", async (req, res) => {
  try {
    const { telefono } = req.body;
    if (!telefono) return res.status(400).json({ error: "Teléfono requerido" });
    const tel = normalizarTelefono(telefono);
    deleteSession(tel);
    clearPhoneRegSession(tel);
    logger.info({ telefono: tel }, "[Simulador] Sesiones anticipo y DPI limpiadas");
    res.json({ ok: true, telefono: tel });
  } catch (err) {
    logger.error({ err }, "[Simulador] Error limpiando sesión");
    res.status(500).json({ error: "Error al limpiar sesión" });
  }
});

// ─── Escenarios rápidos (CRUD) ────────────────────────────────────────────────
// Permite gestionar desde el panel admin los botones de "escenarios rápidos"
// que aparecen sobre el input del simulador.

router.get("/simulador/escenarios", async (req, res) => {
  try {
    const incluirInactivos = String(req.query.all ?? "") === "1";
    const rows = await db
      .select()
      .from(waSimulatorScenariosTable)
      .orderBy(asc(waSimulatorScenariosTable.grupo), asc(waSimulatorScenariosTable.orden), asc(waSimulatorScenariosTable.id));
    const filtered = incluirInactivos ? rows : rows.filter(r => r.activo);
    res.json(filtered);
  } catch (err) {
    logger.error({ err }, "[Simulador] Error listando escenarios");
    res.status(500).json({ error: "Error al listar escenarios" });
  }
});

router.post("/simulador/escenarios", async (req, res) => {
  let data: ScenarioInsert;
  try {
    data = parseScenarioCreate(req.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payload inválido";
    return res.status(400).json({ error: msg });
  }
  try {
    const [row] = await db
      .insert(waSimulatorScenariosTable)
      .values(data)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "[Simulador] Error creando escenario");
    res.status(500).json({ error: "Error al crear escenario" });
  }
});

router.put("/simulador/escenarios/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  let data: ScenarioUpdate;
  try {
    data = parseScenarioUpdate(req.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payload inválido";
    return res.status(400).json({ error: msg });
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No hay campos para actualizar" });
  }

  try {
    const [row] = await db
      .update(waSimulatorScenariosTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(waSimulatorScenariosTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Escenario no encontrado" });
    res.json(row);
  } catch (err) {
    logger.error({ err }, "[Simulador] Error actualizando escenario");
    res.status(500).json({ error: "Error al actualizar escenario" });
  }
});

router.delete("/simulador/escenarios/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [row] = await db
      .delete(waSimulatorScenariosTable)
      .where(eq(waSimulatorScenariosTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Escenario no encontrado" });
    res.json({ ok: true, id });
  } catch (err) {
    logger.error({ err }, "[Simulador] Error eliminando escenario");
    res.status(500).json({ error: "Error al eliminar escenario" });
  }
});

export default router;
