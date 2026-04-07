import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const igssRouter = Router();

// ─── GET /api/igss/config-patrono ─────────────────────────────────────────────
igssRouter.get("/igss/config-patrono", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, numero_patronal, nit_patrono, nombre_comercial, correo_igss,
              codigo_actividad_principal, created_at, updated_at
       FROM igss_config_patrono LIMIT 1`
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    logger.error({ err }, "GET /igss/config-patrono error");
    res.status(500).json({ error: "Error al leer configuración del patrono" });
  }
});

// ─── PATCH /api/igss/config-patrono ───────────────────────────────────────────
igssRouter.patch("/igss/config-patrono", async (req, res) => {
  const {
    numero_patronal, nit_patrono, nombre_comercial,
    correo_igss, codigo_actividad_principal,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO igss_config_patrono (numero_patronal, nit_patrono, nombre_comercial, correo_igss, codigo_actividad_principal)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         numero_patronal           = EXCLUDED.numero_patronal,
         nit_patrono               = EXCLUDED.nit_patrono,
         nombre_comercial          = EXCLUDED.nombre_comercial,
         correo_igss               = EXCLUDED.correo_igss,
         codigo_actividad_principal = EXCLUDED.codigo_actividad_principal,
         updated_at                = NOW()
       RETURNING *`,
      [numero_patronal ?? null, nit_patrono ?? null, nombre_comercial ?? null,
       correo_igss ?? null, codigo_actividad_principal ?? null]
    );
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /igss/config-patrono error");
    res.status(500).json({ error: "Error al guardar configuración del patrono" });
  }
});

// ─── GET /api/igss/centros ────────────────────────────────────────────────────
// Clientes que están marcados como centros de trabajo IGSS
igssRouter.get("/igss/centros", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, nombre_comercial, nit, sector, estado,
              igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
              igss_departamento, igss_municipio, igss_codigo_actividad,
              igss_contacto, igss_fax, igss_email, igss_telefono
       FROM clients
       WHERE igss_aplica = TRUE AND estado = 'activo'
       ORDER BY igss_codigo_centro::int NULLS LAST, nombre`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /igss/centros error");
    res.status(500).json({ error: "Error al cargar centros de trabajo IGSS" });
  }
});

// ─── PATCH /api/igss/clientes/:id/centro ──────────────────────────────────────
// Actualiza los campos IGSS de un cliente (centro de trabajo)
igssRouter.patch("/igss/clientes/:id/centro", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const {
    igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
    igss_departamento, igss_municipio, igss_codigo_actividad,
    igss_contacto, igss_fax, igss_email, igss_telefono,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE clients SET
        igss_aplica            = $1,
        igss_codigo_centro     = $2,
        igss_direccion         = $3,
        igss_zona              = $4,
        igss_departamento      = $5,
        igss_municipio         = $6,
        igss_codigo_actividad  = $7,
        igss_contacto          = $8,
        igss_fax               = $9,
        igss_email             = $10,
        igss_telefono          = $11,
        updated_at             = NOW()
       WHERE id = $12
       RETURNING id, nombre, nombre_comercial,
                 igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
                 igss_departamento, igss_municipio, igss_codigo_actividad,
                 igss_contacto, igss_fax, igss_email, igss_telefono`,
      [
        igss_aplica ?? false,
        igss_codigo_centro ?? null,
        igss_direccion ?? null,
        igss_zona ?? null,
        igss_departamento ? Number(igss_departamento) : null,
        igss_municipio ? Number(igss_municipio) : null,
        igss_codigo_actividad ?? null,
        igss_contacto ?? null,
        igss_fax ?? null,
        igss_email ?? null,
        igss_telefono ?? null,
        id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /igss/clientes/:id/centro error");
    res.status(500).json({ error: "Error al actualizar datos IGSS del cliente" });
  }
});
