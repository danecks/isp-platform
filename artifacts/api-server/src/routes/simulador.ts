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
import { pool } from "@workspace/db";
import { deleteSession } from "../services/whatsapp/anticipo-session";
import { clearPhoneRegSession } from "../services/whatsapp/phone-registration-session";
import {
  simularMensaje,
  normalizarTelefono,
} from "../services/whatsapp/simulator";
import { logger } from "../lib/logger";

const router = Router();

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

export default router;
