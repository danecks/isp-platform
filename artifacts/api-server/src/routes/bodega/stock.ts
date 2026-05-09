import { Router } from "express";
import { pool } from "@workspace/db";

export const stockRouter = Router();

// ── GET /api/bodega/stock — artículos con stock masivo ────────────────────────
stockRouter.get("/bodega/stock", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.id, a.nombre, a.talla, a.costo_unitario AS precio,
        a.stock_bodega, a.stock_lavanderia, a.stock_servicio, a.stock_mal_estado,
        (a.stock_bodega + a.stock_lavanderia + a.stock_servicio + a.stock_mal_estado) AS stock_total,
        c.nombre AS categoria
      FROM bodega_articulos a
      LEFT JOIN bodega_categorias c ON c.id = a.categoria_id
      WHERE a.stock_bodega > 0 OR a.stock_lavanderia > 0 OR a.stock_servicio > 0 OR a.stock_mal_estado > 0
      ORDER BY c.nombre, a.nombre, a.talla NULLS LAST
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/bodega/importar-inventario ──────────────────────────────────────
// Importa artículos de almacén desde Excel con stock masivo.
// Payload: { items: Array<{ categoria, descripcion, talla?, stock_bodega, stock_lavanderia, precio? }>, preview? }
stockRouter.post("/bodega/importar-inventario", async (req, res) => {
  const { items = [], preview = false } = req.body as {
    items: Array<{
      categoria: string;
      descripcion: string;
      talla?: string | null;
      stock_bodega: number;
      stock_lavanderia: number;
      precio?: number;
    }>;
    preview?: boolean;
  };

  let insertados = 0, actualizados = 0;
  const errores: string[] = [];
  const categorias: Record<string, number> = {};

  for (const item of items) {
    try {
      const { categoria, descripcion, talla, stock_bodega, stock_lavanderia, precio } = item;
      if (!descripcion?.trim()) continue;

      const stockBodega  = Number(stock_bodega)    || 0;
      const stockLav     = Number(stock_lavanderia) || 0;
      const precioUnit   = Number(precio)           || 0;
      const tallaVal     = talla?.trim() || null;
      const catNombre    = categoria?.trim() || "GENERAL";

      if (!preview) {
        const { rows: catRows } = await pool.query(
          `INSERT INTO bodega_categorias (nombre) VALUES ($1)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [catNombre]
        );
        let catId: number;
        if (catRows[0]) {
          catId = catRows[0].id;
        } else {
          const { rows: ex } = await pool.query(`SELECT id FROM bodega_categorias WHERE nombre = $1`, [catNombre]);
          catId = ex[0].id;
        }

        const { rows: artRows } = await pool.query(
          `INSERT INTO bodega_articulos
             (categoria_id, nombre, talla, codigo_prefijo, tipo_rastreo, costo_unitario,
              stock_bodega, stock_lavanderia)
           VALUES ($1,$2,$3,'GEN','granel',$4,$5,$6)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [catId, descripcion.trim(), tallaVal, precioUnit, stockBodega, stockLav]
        );

        if (artRows[0]) {
          insertados++;
        } else {
          await pool.query(
            `UPDATE bodega_articulos
             SET stock_bodega=$1, stock_lavanderia=$2, costo_unitario=$3, updated_at=NOW()
             WHERE nombre=$4 AND categoria_id=$5 AND (talla=$6 OR (talla IS NULL AND $6 IS NULL))`,
            [stockBodega, stockLav, precioUnit || null, descripcion.trim(), catId, tallaVal]
          );
          actualizados++;
        }
      }

      categorias[catNombre] = (categorias[catNombre] || 0) + 1;
    } catch (err: any) {
      errores.push(`${item.descripcion || "?"}: ${err.message}`);
    }
  }

  res.json({ insertados, actualizados, errores: errores.slice(0, 30), total_errores: errores.length, categorias, preview });
});
