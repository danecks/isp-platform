import { Router } from "express";
import { pool } from "@workspace/db";

export const bodegaRouter = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────
function getUser(req: any): string {
  try { return JSON.parse(req.headers["x-isp-session"] || "{}").username ?? "sistema"; } catch { return "sistema"; }
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
bodegaRouter.get("/bodega/dashboard", async (req, res) => {
  try {
    const [statsRes, movRes, artRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado = 'disponible')              AS disponible,
          COUNT(*) FILTER (WHERE estado = 'asignado_puesto')         AS asignado_puesto,
          COUNT(*) FILTER (WHERE estado = 'asignado_colaborador')    AS asignado_colaborador,
          COUNT(*) FILTER (WHERE estado = 'en_reparacion')           AS en_reparacion,
          COUNT(*) FILTER (WHERE estado = 'baja')                    AS baja,
          COUNT(*)                                                    AS total
        FROM bodega_unidades
      `),
      pool.query(`
        SELECT
          m.id, m.tipo, m.notas, m.registrado_por,
          m.created_at::text AS created_at,
          u.codigo_inventario,
          a.nombre AS articulo_nombre,
          COALESCE(po.nombre, '') AS puesto_nombre,
          COALESCE(e.nombre_completo, '') AS empleado_nombre
        FROM bodega_movimientos m
        JOIN bodega_unidades u ON u.id = m.unidad_id
        JOIN bodega_articulos a ON a.id = u.articulo_id
        LEFT JOIN puestos_operativos po ON po.id = m.puesto_id
        LEFT JOIN employees e ON e.id = m.employee_id
        ORDER BY m.created_at DESC LIMIT 15
      `),
      pool.query(`
        SELECT a.id, a.nombre, a.tipo_asignacion,
          COUNT(u.id) FILTER (WHERE u.estado = 'disponible')           AS disponible,
          COUNT(u.id) FILTER (WHERE u.estado != 'baja')               AS total
        FROM bodega_articulos a
        LEFT JOIN bodega_unidades u ON u.articulo_id = a.id
        WHERE a.activo = TRUE
        GROUP BY a.id
        ORDER BY COUNT(u.id) DESC LIMIT 10
      `),
    ]);
    res.json({
      stats:     statsRes.rows[0],
      recientes: movRes.rows,
      articulos: artRes.rows,
    });
  } catch (e: any) { res.status(500).send(e.message); }
});

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
bodegaRouter.get("/bodega/categorias", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(a.id)::int AS total_articulos
      FROM bodega_categorias c
      LEFT JOIN bodega_articulos a ON a.categoria_id = c.id AND a.activo = TRUE
      WHERE c.activo = TRUE
      GROUP BY c.id ORDER BY c.nombre
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.post("/bodega/categorias", async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: "Nombre requerido" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO bodega_categorias (nombre, descripcion) VALUES ($1,$2) RETURNING *`,
      [nombre.trim(), descripcion?.trim() || null]
    );
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.put("/bodega/categorias/:id", async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE bodega_categorias SET nombre=$1, descripcion=$2 WHERE id=$3 RETURNING *`,
      [nombre?.trim(), descripcion?.trim() || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.delete("/bodega/categorias/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE bodega_categorias SET activo=FALSE WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).send(e.message); }
});

// ─── ARTÍCULOS ────────────────────────────────────────────────────────────────
bodegaRouter.get("/bodega/articulos", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.*,
        c.nombre AS categoria_nombre,
        COUNT(u.id) FILTER (WHERE u.estado != 'baja') ::int AS stock_total,
        COUNT(u.id) FILTER (WHERE u.estado = 'disponible')          ::int AS stock_disponible,
        COUNT(u.id) FILTER (WHERE u.estado = 'asignado_puesto')     ::int AS stock_asignado_puesto,
        COUNT(u.id) FILTER (WHERE u.estado = 'asignado_colaborador')::int AS stock_asignado_colaborador,
        COUNT(u.id) FILTER (WHERE u.estado = 'en_reparacion')       ::int AS stock_reparacion,
        COUNT(u.id) FILTER (WHERE u.estado = 'baja')                ::int AS stock_baja
      FROM bodega_articulos a
      LEFT JOIN bodega_categorias c ON c.id = a.categoria_id
      LEFT JOIN bodega_unidades u ON u.articulo_id = a.id
      WHERE a.activo = TRUE
      GROUP BY a.id, c.nombre
      ORDER BY c.nombre NULLS LAST, a.nombre
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.post("/bodega/articulos", async (req, res) => {
  const { nombre, descripcion, categoria_id, codigo_prefijo, tipo_rastreo, tipo_asignacion, costo_unitario } = req.body;
  if (!nombre?.trim() || !codigo_prefijo?.trim()) return res.status(400).json({ error: "Nombre y prefijo requeridos" });
  const prefijo = codigo_prefijo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  try {
    const { rows } = await pool.query(`
      INSERT INTO bodega_articulos
        (nombre, descripcion, categoria_id, codigo_prefijo, tipo_rastreo, tipo_asignacion, costo_unitario)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [nombre.trim(), descripcion?.trim() || null, categoria_id || null, prefijo,
        tipo_rastreo || "seriado", tipo_asignacion || "colaborador",
        parseFloat(costo_unitario) || 0]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.put("/bodega/articulos/:id", async (req, res) => {
  const { nombre, descripcion, categoria_id, codigo_prefijo, tipo_rastreo, tipo_asignacion, costo_unitario } = req.body;
  const prefijo = codigo_prefijo?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  try {
    const { rows } = await pool.query(`
      UPDATE bodega_articulos SET
        nombre=$1, descripcion=$2, categoria_id=$3,
        codigo_prefijo=$4, tipo_rastreo=$5, tipo_asignacion=$6,
        costo_unitario=$7, updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [nombre?.trim(), descripcion?.trim() || null, categoria_id || null, prefijo,
        tipo_rastreo, tipo_asignacion, parseFloat(costo_unitario) || 0, req.params.id]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.delete("/bodega/articulos/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE bodega_articulos SET activo=FALSE WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).send(e.message); }
});

// Siguiente código disponible para un artículo
bodegaRouter.get("/bodega/articulos/:id/siguiente-codigo", async (req, res) => {
  try {
    const { rows: art } = await pool.query(
      `SELECT codigo_prefijo FROM bodega_articulos WHERE id=$1`, [req.params.id]
    );
    if (!art[0]) return res.status(404).json({ error: "Artículo no encontrado" });
    const prefijo = art[0].codigo_prefijo;
    const { rows } = await pool.query(`
      SELECT codigo_inventario FROM bodega_unidades
      WHERE codigo_inventario LIKE $1
      ORDER BY codigo_inventario DESC LIMIT 1
    `, [`ISP-${prefijo}-%`]);
    let siguiente = 1;
    if (rows[0]) {
      const partes = rows[0].codigo_inventario.split("-");
      const ultimo = parseInt(partes[partes.length - 1]) || 0;
      siguiente = ultimo + 1;
    }
    res.json({
      siguiente_codigo: `ISP-${prefijo}-${String(siguiente).padStart(3, "0")}`,
      siguiente_numero: siguiente,
      prefijo,
    });
  } catch (e: any) { res.status(500).send(e.message); }
});

// ─── UNIDADES ─────────────────────────────────────────────────────────────────
bodegaRouter.get("/bodega/unidades", async (req, res) => {
  const { articulo_id, estado, puesto_id, employee_id, q } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (articulo_id) { params.push(articulo_id); conditions.push(`u.articulo_id = $${params.length}`); }
  if (estado)      { params.push(estado);      conditions.push(`u.estado = $${params.length}`); }
  if (puesto_id)   { params.push(puesto_id);   conditions.push(`u.puesto_id = $${params.length}`); }
  if (employee_id) { params.push(employee_id); conditions.push(`u.employee_id = $${params.length}`); }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(u.codigo_inventario ILIKE $${params.length} OR u.numero_serie ILIKE $${params.length} OR a.nombre ILIKE $${params.length})`);
  }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  try {
    const { rows } = await pool.query(`
      SELECT
        u.*,
        u.created_at::text AS created_at,
        u.updated_at::text AS updated_at,
        a.nombre AS articulo_nombre,
        a.codigo_prefijo,
        a.tipo_asignacion,
        c.nombre AS categoria_nombre,
        COALESCE(po.nombre, '') AS puesto_nombre,
        COALESCE(po.cliente_nombre, '') AS puesto_cliente,
        COALESCE(e.nombre_completo, '') AS empleado_nombre
      FROM bodega_unidades u
      JOIN bodega_articulos a ON a.id = u.articulo_id
      LEFT JOIN bodega_categorias c ON c.id = a.categoria_id
      LEFT JOIN puestos_operativos po ON po.id = u.puesto_id
      LEFT JOIN employees e ON e.id = u.employee_id
      ${where}
      ORDER BY u.codigo_inventario
    `, params);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.get("/bodega/unidades/:id", async (req, res) => {
  try {
    const { rows: u } = await pool.query(`
      SELECT u.*, u.created_at::text, u.updated_at::text,
        a.nombre AS articulo_nombre, a.tipo_asignacion, c.nombre AS categoria_nombre,
        COALESCE(po.nombre,'') AS puesto_nombre,
        COALESCE(e.nombre_completo,'') AS empleado_nombre
      FROM bodega_unidades u
      JOIN bodega_articulos a ON a.id = u.articulo_id
      LEFT JOIN bodega_categorias c ON c.id = a.categoria_id
      LEFT JOIN puestos_operativos po ON po.id = u.puesto_id
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.id = $1
    `, [req.params.id]);
    if (!u[0]) return res.status(404).json({ error: "No encontrada" });

    const { rows: mov } = await pool.query(`
      SELECT m.*, m.created_at::text AS created_at,
        COALESCE(po.nombre,'') AS puesto_nombre,
        COALESCE(e.nombre_completo,'') AS empleado_nombre
      FROM bodega_movimientos m
      LEFT JOIN puestos_operativos po ON po.id = m.puesto_id
      LEFT JOIN employees e ON e.id = m.employee_id
      WHERE m.unidad_id = $1 ORDER BY m.created_at DESC
    `, [req.params.id]);

    res.json({ unidad: u[0], movimientos: mov });
  } catch (e: any) { res.status(500).send(e.message); }
});

// Crear una o varias unidades de un artículo
bodegaRouter.post("/bodega/unidades", async (req, res) => {
  const { articulo_id, unidades } = req.body as {
    articulo_id: number;
    unidades: { codigo_inventario: string; numero_serie?: string; condicion?: string; notas?: string }[];
  };
  if (!articulo_id || !unidades?.length) return res.status(400).json({ error: "Datos incompletos" });
  const usuario = getUser(req);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created: any[] = [];
    for (const u of unidades) {
      const { rows } = await client.query(`
        INSERT INTO bodega_unidades
          (articulo_id, codigo_inventario, numero_serie, condicion, notas)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [articulo_id, u.codigo_inventario, u.numero_serie?.trim() || null,
          u.condicion || "bueno", u.notas?.trim() || null]);
      await client.query(`
        INSERT INTO bodega_movimientos (unidad_id, tipo, condicion_despues, notas, registrado_por)
        VALUES ($1,'entrada',$2,'Ingreso inicial al inventario',$3)
      `, [rows[0].id, u.condicion || "bueno", usuario]);
      created.push(rows[0]);
    }
    await client.query("COMMIT");
    res.json({ created });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally { client.release(); }
});

bodegaRouter.put("/bodega/unidades/:id", async (req, res) => {
  const { numero_serie, condicion, notas } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE bodega_unidades SET numero_serie=$1, condicion=$2, notas=$3, updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [numero_serie?.trim() || null, condicion, notas?.trim() || null, req.params.id]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).send(e.message); }
});

// Asignar unidad (a puesto o colaborador)
bodegaRouter.post("/bodega/unidades/:id/asignar", async (req, res) => {
  const { tipo_asignacion, puesto_id, employee_id, notas, condicion } = req.body;
  if (!tipo_asignacion) return res.status(400).json({ error: "tipo_asignacion requerido" });
  const usuario = getUser(req);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: cur } = await client.query(
      `SELECT estado, condicion FROM bodega_unidades WHERE id=$1`, [req.params.id]
    );
    if (!cur[0]) throw new Error("Unidad no encontrada");
    const nuevoEstado = tipo_asignacion === "puesto" ? "asignado_puesto" : "asignado_colaborador";
    const nuevaCondicion = condicion || cur[0].condicion;
    await client.query(`
      UPDATE bodega_unidades SET
        estado=$1, puesto_id=$2, employee_id=$3, condicion=$4, updated_at=NOW()
      WHERE id=$5
    `, [nuevoEstado, puesto_id || null, employee_id || null, nuevaCondicion, req.params.id]);
    await client.query(`
      INSERT INTO bodega_movimientos
        (unidad_id, tipo, puesto_id, employee_id, condicion_antes, condicion_despues, notas, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [req.params.id,
        tipo_asignacion === "puesto" ? "asignacion_puesto" : "asignacion_colaborador",
        puesto_id || null, employee_id || null,
        cur[0].condicion, nuevaCondicion, notas?.trim() || null, usuario]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally { client.release(); }
});

// Devolver unidad a bodega
bodegaRouter.post("/bodega/unidades/:id/devolver", async (req, res) => {
  const { condicion, notas } = req.body;
  const usuario = getUser(req);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: cur } = await client.query(
      `SELECT estado, condicion, puesto_id, employee_id FROM bodega_unidades WHERE id=$1`, [req.params.id]
    );
    if (!cur[0]) throw new Error("Unidad no encontrada");
    const nuevaCondicion = condicion || cur[0].condicion;
    await client.query(`
      UPDATE bodega_unidades SET
        estado='disponible', puesto_id=NULL, employee_id=NULL, condicion=$1, updated_at=NOW()
      WHERE id=$2
    `, [nuevaCondicion, req.params.id]);
    await client.query(`
      INSERT INTO bodega_movimientos
        (unidad_id, tipo, puesto_id, employee_id, condicion_antes, condicion_despues, notas, registrado_por)
      VALUES ($1,'devolucion',$2,$3,$4,$5,$6,$7)
    `, [req.params.id, cur[0].puesto_id, cur[0].employee_id,
        cur[0].condicion, nuevaCondicion, notas?.trim() || null, usuario]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally { client.release(); }
});

// Dar de baja una unidad
bodegaRouter.post("/bodega/unidades/:id/baja", async (req, res) => {
  const { notas, condicion } = req.body;
  const usuario = getUser(req);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: cur } = await client.query(
      `SELECT estado, condicion FROM bodega_unidades WHERE id=$1`, [req.params.id]
    );
    if (!cur[0]) throw new Error("Unidad no encontrada");
    const nuevaCondicion = condicion || "deteriorado";
    await client.query(`
      UPDATE bodega_unidades SET
        estado='baja', puesto_id=NULL, employee_id=NULL, condicion=$1, updated_at=NOW()
      WHERE id=$2
    `, [nuevaCondicion, req.params.id]);
    await client.query(`
      INSERT INTO bodega_movimientos
        (unidad_id, tipo, condicion_antes, condicion_despues, notas, registrado_por)
      VALUES ($1,'baja',$2,$3,$4,$5)
    `, [req.params.id, cur[0].condicion, nuevaCondicion, notas?.trim() || null, usuario]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).send(e.message);
  } finally { client.release(); }
});

// ─── MOVIMIENTOS ─────────────────────────────────────────────────────────────
bodegaRouter.get("/bodega/movimientos", async (req, res) => {
  const { unidad_id, tipo, limit = "50" } = req.query as Record<string, string>;
  const conditions: string[] = [];
  const params: any[] = [];
  if (unidad_id) { params.push(unidad_id); conditions.push(`m.unidad_id = $${params.length}`); }
  if (tipo)      { params.push(tipo);      conditions.push(`m.tipo = $${params.length}`); }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  params.push(Math.min(parseInt(limit) || 50, 500));
  try {
    const { rows } = await pool.query(`
      SELECT
        m.*, m.created_at::text AS created_at,
        u.codigo_inventario,
        a.nombre AS articulo_nombre,
        COALESCE(po.nombre,'') AS puesto_nombre,
        COALESCE(e.nombre_completo,'') AS empleado_nombre
      FROM bodega_movimientos m
      JOIN bodega_unidades u ON u.id = m.unidad_id
      JOIN bodega_articulos a ON a.id = u.articulo_id
      LEFT JOIN puestos_operativos po ON po.id = m.puesto_id
      LEFT JOIN employees e ON e.id = m.employee_id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

// Puestos y colaboradores para selectores
bodegaRouter.get("/bodega/puestos", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre, COALESCE(cliente_nombre,'') AS cliente_nombre
      FROM puestos_operativos ORDER BY cliente_nombre, nombre
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

bodegaRouter.get("/bodega/colaboradores", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre_completo, dpi, puesto
      FROM employees WHERE estado_laboral='activo' ORDER BY nombre_completo
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).send(e.message); }
});

// ── GET /api/bodega/stock — artículos con stock masivo ────────────────────────
bodegaRouter.get("/bodega/stock", async (_req, res) => {
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
bodegaRouter.post("/bodega/importar-inventario", async (req, res) => {
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
