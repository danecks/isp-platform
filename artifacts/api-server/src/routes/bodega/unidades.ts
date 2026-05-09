import { Router } from "express";
import { pool } from "@workspace/db";
import { getUser } from "./_helpers";

export const unidadesRouter = Router();

// ─── UNIDADES ─────────────────────────────────────────────────────────────────
unidadesRouter.get("/bodega/unidades", async (req, res) => {
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

unidadesRouter.get("/bodega/unidades/:id", async (req, res) => {
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
unidadesRouter.post("/bodega/unidades", async (req, res) => {
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

unidadesRouter.put("/bodega/unidades/:id", async (req, res) => {
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
unidadesRouter.post("/bodega/unidades/:id/asignar", async (req, res) => {
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
unidadesRouter.post("/bodega/unidades/:id/devolver", async (req, res) => {
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
unidadesRouter.post("/bodega/unidades/:id/baja", async (req, res) => {
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

