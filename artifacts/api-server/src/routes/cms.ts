import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// ── GET /cms/pages — lista todas las páginas (admin) ─────────────────────────
router.get("/cms/pages", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT page_key, seo_title, seo_description, status, updated_by, updated_at
       FROM page_content
       ORDER BY page_key ASC`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "CMS: error listando páginas");
    res.status(500).json({ error: "Error al obtener páginas CMS" });
  }
});

// ── GET /cms/pages/:key — contenido publicado (público) ──────────────────────
router.get("/cms/pages/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT content_json, seo_title, seo_description, status, updated_at
       FROM page_content
       WHERE page_key = $1 AND status = 'published'`,
      [key]
    );
    if (!rows.length) {
      return res.json({ content: {}, seo_title: null, seo_description: null });
    }
    const row = rows[0];
    res.json({
      content: row.content_json ?? {},
      seo_title: row.seo_title,
      seo_description: row.seo_description,
    });
  } catch (err) {
    logger.error({ err }, "CMS: error obteniendo página pública");
    res.status(500).json({ error: "Error al obtener contenido CMS" });
  }
});

// ── GET /cms/admin/pages/:key — contenido completo (admin, borradores) ───────
router.get("/cms/admin/pages/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT page_key, content_json, seo_title, seo_description, status, updated_by, updated_at
       FROM page_content
       WHERE page_key = $1`,
      [key]
    );
    if (!rows.length) {
      return res.json({
        page_key: key,
        content: {},
        seo_title: null,
        seo_description: null,
        status: "draft",
        updated_by: null,
        updated_at: null,
      });
    }
    const row = rows[0];
    res.json({
      page_key: row.page_key,
      content: row.content_json ?? {},
      seo_title: row.seo_title,
      seo_description: row.seo_description,
      status: row.status,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
    });
  } catch (err) {
    logger.error({ err }, "CMS: error obteniendo página admin");
    res.status(500).json({ error: "Error al obtener contenido CMS (admin)" });
  }
});

// ── PUT /cms/admin/pages/:key — guardar borrador ──────────────────────────────
router.put("/cms/admin/pages/:key", async (req, res) => {
  const { key } = req.params;
  const { content, seo_title, seo_description, updated_by } = req.body as {
    content: Record<string, string>;
    seo_title?: string;
    seo_description?: string;
    updated_by?: string;
  };

  if (!content || typeof content !== "object") {
    return res.status(400).json({ error: "Contenido inválido" });
  }

  try {
    await pool.query(
      `INSERT INTO page_content (page_key, content_json, seo_title, seo_description, status, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, NOW())
       ON CONFLICT (page_key) DO UPDATE
         SET content_json   = EXCLUDED.content_json,
             seo_title      = EXCLUDED.seo_title,
             seo_description= EXCLUDED.seo_description,
             updated_by     = EXCLUDED.updated_by,
             updated_at     = NOW()`,
      [key, JSON.stringify(content), seo_title ?? null, seo_description ?? null, updated_by ?? "admin"]
    );
    res.json({ ok: true, status: "draft" });
  } catch (err) {
    logger.error({ err }, "CMS: error guardando borrador");
    res.status(500).json({ error: "Error al guardar borrador" });
  }
});

// ── POST /cms/admin/pages/:key/publish — publicar ─────────────────────────────
router.post("/cms/admin/pages/:key/publish", async (req, res) => {
  const { key } = req.params;
  const { content, seo_title, seo_description, updated_by } = req.body as {
    content: Record<string, string>;
    seo_title?: string;
    seo_description?: string;
    updated_by?: string;
  };

  if (!content || typeof content !== "object") {
    return res.status(400).json({ error: "Contenido inválido" });
  }

  try {
    await pool.query(
      `INSERT INTO page_content (page_key, content_json, seo_title, seo_description, status, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, 'published', $5, NOW())
       ON CONFLICT (page_key) DO UPDATE
         SET content_json    = EXCLUDED.content_json,
             seo_title       = EXCLUDED.seo_title,
             seo_description = EXCLUDED.seo_description,
             status          = 'published',
             updated_by      = EXCLUDED.updated_by,
             updated_at      = NOW()`,
      [key, JSON.stringify(content), seo_title ?? null, seo_description ?? null, updated_by ?? "admin"]
    );
    res.json({ ok: true, status: "published" });
  } catch (err) {
    logger.error({ err }, "CMS: error publicando página");
    res.status(500).json({ error: "Error al publicar página" });
  }
});

export default router;
