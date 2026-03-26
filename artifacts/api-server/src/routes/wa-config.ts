/**
 * WA CONFIG ROUTES — /api/wa-config/*
 *
 * Gestión de la configuración del bot de WhatsApp desde el panel admin.
 * Solo accesible por admin.
 *
 * ENDPOINTS:
 *  GET  /api/wa-config/general           — obtener toda la configuración
 *  PUT  /api/wa-config/general/:clave    — actualizar un valor de config
 *  GET  /api/wa-config/messages          — obtener todos los mensajes
 *  PUT  /api/wa-config/messages/:clave   — actualizar un mensaje
 *  GET  /api/wa-config/menus             — obtener todas las opciones de menú
 *  PUT  /api/wa-config/menus/:id         — actualizar una opción de menú
 *  GET  /api/wa-config/auditoria         — obtener log de auditoría
 */

import { Router } from "express";
import {
  getAllConfigRows,
  getAllMessageRows,
  getMenuOptions,
  getAuditLog,
  setWaConfig,
  setWaMessage,
  setWaMenuOption,
} from "../services/whatsapp/wa-config.service";

export const waConfigRouter = Router();

// ─── General ──────────────────────────────────────────────────────────────────

waConfigRouter.get("/wa-config/general", async (_req, res) => {
  try {
    const rows = await getAllConfigRows();
    res.json(rows);
  } catch (err) {
    console.error("[wa-config/general GET]", err);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

waConfigRouter.put("/wa-config/general/:clave", async (req, res) => {
  const { clave } = req.params;
  const { valor, usuario } = req.body;
  if (valor === undefined) {
    return res.status(400).json({ error: "Se requiere campo 'valor'" });
  }

  try {
    await setWaConfig(clave, String(valor), usuario);
    res.json({ ok: true, clave, valor });
  } catch (err) {
    console.error("[wa-config/general PUT]", err);
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
});

// ─── Mensajes ─────────────────────────────────────────────────────────────────

waConfigRouter.get("/wa-config/messages", async (_req, res) => {
  try {
    const rows = await getAllMessageRows();
    res.json(rows);
  } catch (err) {
    console.error("[wa-config/messages GET]", err);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
});

waConfigRouter.put("/wa-config/messages/:clave", async (req, res) => {
  const { clave } = req.params;
  const { texto, usuario } = req.body;
  if (!texto) {
    return res.status(400).json({ error: "Se requiere campo 'texto'" });
  }

  try {
    await setWaMessage(clave, texto, usuario);
    res.json({ ok: true, clave, texto });
  } catch (err) {
    console.error("[wa-config/messages PUT]", err);
    res.status(500).json({ error: "Error al actualizar mensaje" });
  }
});

// ─── Menús ────────────────────────────────────────────────────────────────────

waConfigRouter.get("/wa-config/menus", async (req, res) => {
  const rol = req.query.rol as string | undefined;
  try {
    const rows = await getMenuOptions(rol);
    res.json(rows);
  } catch (err) {
    console.error("[wa-config/menus GET]", err);
    res.status(500).json({ error: "Error al obtener menús" });
  }
});

waConfigRouter.put("/wa-config/menus/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { activo, texto, orden, usuario } = req.body;
  const updates: any = {};
  if (activo !== undefined) updates.activo = Boolean(activo);
  if (texto !== undefined) updates.texto = texto;
  if (orden !== undefined) updates.orden = parseInt(orden, 10);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No hay campos para actualizar" });
  }

  try {
    const clave = `menu_option_${id}`;
    await setWaMenuOption(id, updates, clave, usuario);
    res.json({ ok: true, id, updates });
  } catch (err) {
    console.error("[wa-config/menus PUT]", err);
    res.status(500).json({ error: "Error al actualizar menú" });
  }
});

// ─── Auditoría ────────────────────────────────────────────────────────────────

waConfigRouter.get("/wa-config/auditoria", async (req, res) => {
  const limit = parseInt(req.query.limit as string || "50", 10);
  try {
    const rows = await getAuditLog(Math.min(limit, 200));
    res.json(rows);
  } catch (err) {
    console.error("[wa-config/auditoria GET]", err);
    res.status(500).json({ error: "Error al obtener auditoría" });
  }
});
