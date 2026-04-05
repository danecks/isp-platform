import { Router } from "express";
import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino();
const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUser(req: any): string {
  try {
    const s = req.headers["x-isp-session"];
    if (!s) return "sistema";
    return JSON.parse(s as string).nombre || "admin";
  } catch { return "sistema"; }
}

const FACTOR_JORNADA: Record<string, number> = {
  "24x24": 2, "12x12": 2, "8x8": 3, "6x6": 4, "turno_unico": 1,
};

// ══════════════════════════════════════════════════════════════════════════════
// ARTÍCULOS DE BODEGA (para picker en dotación)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/dotacion/articulos", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ba.id, ba.nombre, ba.codigo_prefijo, ba.tipo_rastreo,
        ba.tipo_asignacion, COALESCE(ba.costo_unitario, 0) AS costo_unitario,
        COUNT(bu.id)::int                                    AS stock_total,
        COUNT(bu.id) FILTER (WHERE bu.estado = 'disponible')::int AS stock_disponible
      FROM bodega_articulos ba
      LEFT JOIN bodega_unidades bu ON bu.articulo_id = ba.id
      WHERE ba.activo = true
      GROUP BY ba.id
      ORDER BY ba.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /dotacion/articulos error");
    res.status(500).json({ error: "Error al obtener artículos" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DOTACIÓN DE UN LEAD
// ══════════════════════════════════════════════════════════════════════════════

// GET /dotacion/lead/:id — ítems de dotación del lead
router.get("/dotacion/lead/:id", async (req, res) => {
  const leadId = parseInt(req.params.id);
  if (isNaN(leadId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(`
      SELECT
        ldi.*,
        ba.nombre AS articulo_nombre_bodega,
        COALESCE(stock.disponible, 0)::int AS stock_disponible
      FROM lead_dotacion_items ldi
      LEFT JOIN bodega_articulos ba ON ba.id = ldi.articulo_id
      LEFT JOIN (
        SELECT articulo_id, COUNT(*) FILTER (WHERE estado = 'disponible')::int AS disponible
        FROM bodega_unidades GROUP BY articulo_id
      ) stock ON stock.articulo_id = ldi.articulo_id
      WHERE ldi.lead_id = $1
      ORDER BY ldi.id
    `, [leadId]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /dotacion/lead/:id error");
    res.status(500).json({ error: "Error al obtener dotación" });
  }
});

// POST /dotacion/lead/:id/item — agregar ítem
router.post("/dotacion/lead/:id/item", async (req, res) => {
  const leadId = parseInt(req.params.id);
  if (isNaN(leadId)) return res.status(400).json({ error: "ID inválido" });
  const { articulo_id, nombre_articulo, es_equipo_personal, cantidad_por_puesto, costo_unitario, notas } = req.body;
  if (!nombre_articulo) return res.status(400).json({ error: "nombre_articulo es requerido" });
  try {
    const { rows } = await pool.query(`
      INSERT INTO lead_dotacion_items
        (lead_id, articulo_id, nombre_articulo, es_equipo_personal, cantidad_por_puesto, costo_unitario, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [leadId, articulo_id || null, nombre_articulo, es_equipo_personal || false,
        cantidad_por_puesto || 1, costo_unitario || 0, notas || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /dotacion/lead/:id/item error");
    res.status(500).json({ error: "Error al agregar ítem" });
  }
});

// PATCH /dotacion/lead/:id/item/:itemId — actualizar ítem
router.patch("/dotacion/lead/:id/item/:itemId", async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  if (isNaN(itemId)) return res.status(400).json({ error: "ID inválido" });
  const { es_equipo_personal, cantidad_por_puesto, costo_unitario, notas } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE lead_dotacion_items
      SET es_equipo_personal  = COALESCE($1, es_equipo_personal),
          cantidad_por_puesto = COALESCE($2, cantidad_por_puesto),
          costo_unitario      = COALESCE($3, costo_unitario),
          notas               = COALESCE($4, notas),
          updated_at          = NOW()
      WHERE id = $5
      RETURNING *
    `, [es_equipo_personal ?? null, cantidad_por_puesto ?? null,
        costo_unitario ?? null, notas ?? null, itemId]);
    if (!rows.length) return res.status(404).json({ error: "Ítem no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /dotacion/lead item error");
    res.status(500).json({ error: "Error al actualizar ítem" });
  }
});

// DELETE /dotacion/lead/:id/item/:itemId — eliminar ítem
router.delete("/dotacion/lead/:id/item/:itemId", async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  if (isNaN(itemId)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query(`DELETE FROM lead_dotacion_items WHERE id = $1`, [itemId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /dotacion/lead item error");
    res.status(500).json({ error: "Error al eliminar ítem" });
  }
});

// GET /dotacion/lead/:id/resumen — resumen completo: personal + stock + costos
router.get("/dotacion/lead/:id/resumen", async (req, res) => {
  const leadId = parseInt(req.params.id);
  if (isNaN(leadId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows: [lead] } = await pool.query(
      `SELECT empresa, COALESCE(num_puestos, 0)::int AS num_puestos,
              COALESCE(tipo_jornada, '24x24') AS tipo_jornada
       FROM leads WHERE id = $1`, [leadId]
    );
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const numPuestos: number = lead.num_puestos;
    const factor: number = FACTOR_JORNADA[lead.tipo_jornada] ?? 2;
    const agentesNecesarios = numPuestos * factor;

    // Agentes disponibles (activos + no asignados operativamente)
    const { rows: [agRow] } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM employees
          WHERE estado_laboral = 'activo'
            AND (tipo_personal NOT IN ('administrativo_bodega','administrativo_rrhh','gerencia') OR tipo_personal IS NULL)
        ) AS total_activos,
        (SELECT COUNT(*)::int FROM employees
          WHERE estado_laboral = 'activo'
            AND (tipo_personal NOT IN ('administrativo_bodega','administrativo_rrhh','gerencia') OR tipo_personal IS NULL)
            AND id NOT IN (
              SELECT DISTINCT employee_id FROM employee_operational_assignments
              WHERE activa = TRUE AND employee_id IS NOT NULL
            )
        ) AS disponibles
    `);
    const agentesDisponibles: number = agRow.disponibles;
    const deficit: number = Math.max(0, agentesNecesarios - agentesDisponibles);

    // Ítems de dotación con cálculo de stock
    const { rows: items } = await pool.query(`
      SELECT
        ldi.id, ldi.nombre_articulo, ldi.es_equipo_personal,
        ldi.cantidad_por_puesto::float AS cantidad_por_puesto,
        ldi.costo_unitario::float      AS costo_unitario,
        ldi.articulo_id,
        COALESCE(stock.disponible, 0)::int AS stock_disponible
      FROM lead_dotacion_items ldi
      LEFT JOIN (
        SELECT articulo_id, COUNT(*) FILTER (WHERE estado = 'disponible')::int AS disponible
        FROM bodega_unidades GROUP BY articulo_id
      ) stock ON stock.articulo_id = ldi.articulo_id
      WHERE ldi.lead_id = $1
      ORDER BY ldi.id
    `, [leadId]);

    const itemsCalc = items.map((item: any) => {
      const qty = item.cantidad_por_puesto;
      const totalNecesario = item.es_equipo_personal
        ? Math.ceil(deficit * qty)          // solo para nuevas contrataciones
        : Math.ceil(numPuestos * qty);       // para todos los puestos
      const faltante = Math.max(0, totalNecesario - item.stock_disponible);
      const costoFaltante = faltante * item.costo_unitario;
      return { ...item, total_necesario: totalNecesario, faltante, costo_faltante: costoFaltante };
    });

    const totalInversion = itemsCalc.reduce((s: number, i: any) => s + i.costo_faltante, 0);

    res.json({
      lead: { empresa: lead.empresa, num_puestos: numPuestos, tipo_jornada: lead.tipo_jornada },
      personal: {
        agentes_necesarios: agentesNecesarios,
        agentes_disponibles: agentesDisponibles,
        total_activos: agRow.total_activos,
        deficit,
        factor_jornada: factor,
      },
      items: itemsCalc,
      totales: {
        inversion_total: totalInversion,
        hay_gaps: itemsCalc.some((i: any) => i.faltante > 0),
        hay_deficit_personal: deficit > 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /dotacion/lead/:id/resumen error");
    res.status(500).json({ error: "Error al calcular resumen" });
  }
});

// POST /dotacion/lead/:id/generar-orden — generar orden de compra desde gaps
router.post("/dotacion/lead/:id/generar-orden", async (req, res) => {
  const leadId = parseInt(req.params.id);
  if (isNaN(leadId)) return res.status(400).json({ error: "ID inválido" });
  const createdBy = getUser(req);
  try {
    // Reutilizar lógica de resumen
    const { rows: [lead] } = await pool.query(
      `SELECT empresa, cliente_id, COALESCE(num_puestos,0)::int AS num_puestos,
              COALESCE(tipo_jornada,'24x24') AS tipo_jornada
       FROM leads WHERE id = $1`, [leadId]
    );
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

    const numPuestos: number = lead.num_puestos;
    const factor: number = FACTOR_JORNADA[lead.tipo_jornada] ?? 2;
    const agentesNecesarios = numPuestos * factor;

    const { rows: [agRow] } = await pool.query(`
      SELECT (SELECT COUNT(*)::int FROM employees WHERE estado_laboral='activo'
        AND id NOT IN (SELECT DISTINCT employee_id FROM employee_operational_assignments WHERE activa=TRUE AND employee_id IS NOT NULL)
        AND (tipo_personal NOT IN ('administrativo_bodega','administrativo_rrhh','gerencia') OR tipo_personal IS NULL)
      ) AS disponibles
    `);
    const deficit = Math.max(0, agentesNecesarios - (agRow.disponibles as number));

    const { rows: items } = await pool.query(`
      SELECT ldi.*, ldi.cantidad_por_puesto::float AS qty, ldi.costo_unitario::float AS costo,
             COALESCE(stock.disponible,0)::int AS stock_disponible
      FROM lead_dotacion_items ldi
      LEFT JOIN (
        SELECT articulo_id, COUNT(*) FILTER (WHERE estado='disponible')::int AS disponible
        FROM bodega_unidades GROUP BY articulo_id
      ) stock ON stock.articulo_id = ldi.articulo_id
      WHERE ldi.lead_id = $1
    `, [leadId]);

    const gaps = items.filter((item: any) => {
      const total = item.es_equipo_personal
        ? Math.ceil(deficit * item.qty)
        : Math.ceil(numPuestos * item.qty);
      item._faltante = Math.max(0, total - item.stock_disponible);
      return item._faltante > 0;
    });

    if (!gaps.length) {
      return res.status(200).json({ ok: true, message: "No hay artículos faltantes, no se generó orden de compra." });
    }

    const total = gaps.reduce((s: number, i: any) => s + i._faltante * i.costo, 0);

    const { rows: [orden] } = await pool.query(`
      INSERT INTO ordenes_compra (lead_id, cliente_id, total, created_by, notas)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [leadId, lead.cliente_id || null, total, createdBy,
        `Generada automáticamente por déficit de stock — Lead: ${lead.empresa}`]);

    for (const gap of gaps) {
      await pool.query(`
        INSERT INTO ordenes_compra_items (orden_id, articulo_id, nombre_articulo, cantidad, costo_unitario)
        VALUES ($1, $2, $3, $4, $5)
      `, [orden.id, gap.articulo_id || null, gap.nombre_articulo, gap._faltante, gap.costo]);
    }

    res.status(201).json({ ok: true, orden_id: orden.id, total, items_count: gaps.length });
  } catch (err) {
    logger.error({ err }, "POST /dotacion/lead/:id/generar-orden error");
    res.status(500).json({ error: "Error al generar orden de compra" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// KIT DE INGRESO (configuración global)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/dotacion/kit-ingreso", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ki.*, ba.nombre AS articulo_nombre_bodega,
             COALESCE(stock.disponible,0)::int AS stock_disponible
      FROM kit_ingreso_items ki
      LEFT JOIN bodega_articulos ba ON ba.id = ki.articulo_id
      LEFT JOIN (
        SELECT articulo_id, COUNT(*) FILTER (WHERE estado='disponible')::int AS disponible
        FROM bodega_unidades GROUP BY articulo_id
      ) stock ON stock.articulo_id = ki.articulo_id
      WHERE ki.activo = TRUE
      ORDER BY ki.id
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /dotacion/kit-ingreso error");
    res.status(500).json({ error: "Error al obtener kit de ingreso" });
  }
});

// PUT /dotacion/kit-ingreso — reemplaza todos los ítems del kit
router.put("/dotacion/kit-ingreso", async (req, res) => {
  const { items } = req.body as { items: Array<{ articulo_id?: number; nombre_articulo: string; cantidad: number }> };
  if (!Array.isArray(items)) return res.status(400).json({ error: "items debe ser un arreglo" });
  try {
    await pool.query(`DELETE FROM kit_ingreso_items`);
    for (const item of items) {
      if (!item.nombre_articulo) continue;
      await pool.query(`
        INSERT INTO kit_ingreso_items (articulo_id, nombre_articulo, cantidad, activo)
        VALUES ($1, $2, $3, TRUE)
      `, [item.articulo_id || null, item.nombre_articulo, item.cantidad || 1]);
    }
    const { rows } = await pool.query(`SELECT * FROM kit_ingreso_items WHERE activo=TRUE ORDER BY id`);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "PUT /dotacion/kit-ingreso error");
    res.status(500).json({ error: "Error al guardar kit de ingreso" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DOTACIONES PENDIENTES (entrega a empleados nuevos)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/dotacion/pendientes", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        dp.id, dp.employee_id, dp.estado, dp.notas, dp.created_at,
        e.nombre_completo AS empleado_nombre,
        e.puesto AS empleado_puesto,
        COUNT(dpi.id)::int                                    AS total_items,
        COUNT(dpi.id) FILTER (WHERE dpi.entregado = TRUE)::int AS items_entregados
      FROM dotacion_pendiente dp
      JOIN employees e ON e.id = dp.employee_id
      LEFT JOIN dotacion_pendiente_items dpi ON dpi.dotacion_id = dp.id
      GROUP BY dp.id, e.nombre_completo, e.puesto
      ORDER BY dp.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /dotacion/pendientes error");
    res.status(500).json({ error: "Error al obtener dotaciones pendientes" });
  }
});

router.get("/dotacion/pendientes/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const { rows: [dp] } = await pool.query(`
      SELECT dp.*, e.nombre_completo AS empleado_nombre
      FROM dotacion_pendiente dp JOIN employees e ON e.id = dp.employee_id WHERE dp.id = $1
    `, [id]);
    if (!dp) return res.status(404).json({ error: "No encontrado" });
    const { rows: items } = await pool.query(
      `SELECT * FROM dotacion_pendiente_items WHERE dotacion_id = $1 ORDER BY id`, [id]
    );
    res.json({ ...dp, items });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// PATCH /dotacion/pendientes/:id/entregar — marcar toda la dotación como entregada
router.patch("/dotacion/pendientes/:id/entregar", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query(`UPDATE dotacion_pendiente_items SET entregado=TRUE WHERE dotacion_id=$1`, [id]);
    await pool.query(`UPDATE dotacion_pendiente SET estado='entregado', updated_at=NOW() WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /dotacion/pendientes/:id/entregar error");
    res.status(500).json({ error: "Error al marcar como entregada" });
  }
});

// PATCH /dotacion/pendientes/:id/cancelar
router.patch("/dotacion/pendientes/:id/cancelar", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query(`UPDATE dotacion_pendiente SET estado='cancelado', updated_at=NOW() WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al cancelar" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ÓRDENES DE COMPRA
// ══════════════════════════════════════════════════════════════════════════════

router.get("/dotacion/ordenes-compra", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        oc.id, oc.estado, oc.total, oc.created_by, oc.created_at, oc.notas,
        l.empresa AS lead_empresa,
        c.nombre  AS cliente_nombre,
        COUNT(oci.id)::int AS items_count
      FROM ordenes_compra oc
      LEFT JOIN leads   l ON l.id = oc.lead_id
      LEFT JOIN clients c ON c.id = oc.cliente_id
      LEFT JOIN ordenes_compra_items oci ON oci.orden_id = oc.id
      GROUP BY oc.id, l.empresa, c.nombre
      ORDER BY oc.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /dotacion/ordenes-compra error");
    res.status(500).json({ error: "Error al obtener órdenes" });
  }
});

router.get("/dotacion/ordenes-compra/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows: [orden] } = await pool.query(`
      SELECT oc.*, l.empresa AS lead_empresa, c.nombre AS cliente_nombre
      FROM ordenes_compra oc
      LEFT JOIN leads   l ON l.id = oc.lead_id
      LEFT JOIN clients c ON c.id = oc.cliente_id
      WHERE oc.id = $1
    `, [id]);
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    const { rows: items } = await pool.query(
      `SELECT oci.*, oci.cantidad * oci.costo_unitario AS subtotal
       FROM ordenes_compra_items oci WHERE oci.orden_id = $1 ORDER BY oci.id`, [id]
    );
    res.json({ ...orden, items });
  } catch (err) {
    logger.error({ err }, "GET /dotacion/ordenes-compra/:id error");
    res.status(500).json({ error: "Error al obtener orden" });
  }
});

// PATCH /dotacion/ordenes-compra/:id/estado — cambiar estado
router.patch("/dotacion/ordenes-compra/:id/estado", async (req, res) => {
  const id = parseInt(req.params.id);
  const { estado } = req.body;
  const VALID = ["pendiente", "procesada", "cancelada"];
  if (!VALID.includes(estado)) return res.status(400).json({ error: "Estado inválido" });
  try {
    await pool.query(`UPDATE ordenes_compra SET estado=$1, updated_at=NOW() WHERE id=$2`, [estado, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

// PATCH /dotacion/lead/:id/servicio — actualizar num_puestos y tipo_jornada del lead
router.patch("/dotacion/lead/:id/servicio", async (req, res) => {
  const leadId = parseInt(req.params.id);
  if (isNaN(leadId)) return res.status(400).json({ error: "ID inválido" });
  const { num_puestos, tipo_jornada } = req.body;
  try {
    await pool.query(`
      UPDATE leads SET num_puestos=$1, tipo_jornada=$2, updated_at=NOW() WHERE id=$3
    `, [num_puestos || null, tipo_jornada || null, leadId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar servicio del lead" });
  }
});

export { router as dotacionRouter };
