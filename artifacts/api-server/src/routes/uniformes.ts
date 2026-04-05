/**
 * UNIF — Dotación de Uniformes & Cobros a Planilla
 *
 * Reglas de negocio:
 *  tipo_cargo = 'cargo_empleado'  → se cobra al agente vía planilla (cuotas)
 *  tipo_cargo = 'dotacion_cliente'→ lo paga el cliente, no se descuenta al agente
 *
 * Integración planilla:
 *  Al generar planilla, se toma la siguiente cuota pendiente de cada empleado
 *  (estado activo, tipo_cargo = cargo_empleado, descontado = FALSE).
 *  Al ejecutar la planilla, la cuota se marca descontado=TRUE y planilla_id=<planillaId>.
 *
 * Integración liquidación:
 *  Al calcular prestaciones/liquidación se suman todas las cuotas no pagadas
 *  y se añaden como rubro negativo "descuento_uniforme_pendiente".
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import pino from "pino";

const logger = pino();
const router = Router();

function getUser(req: any): string {
  try {
    const s = req.headers["x-isp-session"];
    if (!s) return "sistema";
    return JSON.parse(s as string).nombre || "admin";
  } catch { return "sistema"; }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSULTAS
// ══════════════════════════════════════════════════════════════════════════════

// GET /uniformes/empleado/:id — historial de entregas de un empleado
router.get("/uniformes/empleado/:id", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(`
      SELECT
        eu.*,
        eu.monto_total::float        AS monto_total,
        c.nombre                     AS cliente_nombre,
        po.nombre                    AS puesto_nombre,
        ba.nombre                    AS articulo_nombre_bodega,
        (SELECT COUNT(*)::int FROM entregas_uniforme_cuotas WHERE entrega_id = eu.id AND descontado = FALSE)
                                     AS cuotas_pendientes
      FROM entregas_uniforme eu
      LEFT JOIN clients c ON c.id = eu.cliente_id
      LEFT JOIN puestos_operativos po ON po.id = eu.puesto_id
      LEFT JOIN bodega_articulos ba ON ba.id = eu.articulo_id
      WHERE eu.employee_id = $1
      ORDER BY eu.created_at DESC
    `, [empId]);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /uniformes/empleado/:id");
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// GET /uniformes/empleado/:id/cuotas — cuotas detalladas de un empleado
router.get("/uniformes/empleado/:id/cuotas", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(`
      SELECT
        euc.*,
        euc.monto::float        AS monto,
        eu.nombre_articulo,
        eu.tipo_cargo,
        eu.estado               AS entrega_estado,
        eu.num_cuotas,
        p.periodo_desde,
        p.periodo_hasta
      FROM entregas_uniforme_cuotas euc
      JOIN entregas_uniforme eu ON eu.id = euc.entrega_id
      LEFT JOIN planillas p ON p.id = euc.planilla_id
      WHERE eu.employee_id = $1
      ORDER BY euc.entrega_id, euc.num_cuota
    `, [empId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener cuotas" });
  }
});

// GET /uniformes/pendientes — lista general para bodega
router.get("/uniformes/pendientes", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        eu.id, eu.employee_id, eu.nombre_articulo, eu.tipo_cargo,
        eu.monto_total::float AS monto_total,
        eu.num_cuotas, eu.cuotas_pagadas, eu.estado, eu.created_at,
        e.nombre_completo AS empleado_nombre,
        e.puesto          AS empleado_puesto,
        c.nombre          AS cliente_nombre,
        (SELECT COUNT(*)::int FROM entregas_uniforme_cuotas WHERE entrega_id = eu.id AND descontado = FALSE)
                          AS cuotas_pendientes,
        (SELECT COALESCE(SUM(monto),0)::float FROM entregas_uniforme_cuotas WHERE entrega_id = eu.id AND descontado = FALSE)
                          AS saldo_pendiente
      FROM entregas_uniforme eu
      JOIN employees e ON e.id = eu.employee_id
      LEFT JOIN clients c ON c.id = eu.cliente_id
      WHERE eu.estado = 'activo' AND eu.tipo_cargo = 'cargo_empleado'
      ORDER BY eu.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /uniformes/pendientes");
    res.status(500).json({ error: "Error al obtener pendientes" });
  }
});

// GET /uniformes/pendientes-liquidacion/:id — saldo total pendiente para liquidación
router.get("/uniformes/pendientes-liquidacion/:id", async (req, res) => {
  const empId = parseInt(req.params.id);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows: [row] } = await pool.query(`
      SELECT
        COUNT(euc.id)::int        AS cuotas_pendientes,
        COALESCE(SUM(euc.monto), 0)::float AS saldo_total
      FROM entregas_uniforme_cuotas euc
      JOIN entregas_uniforme eu ON eu.id = euc.entrega_id
      WHERE eu.employee_id = $1
        AND euc.descontado = FALSE
        AND eu.tipo_cargo = 'cargo_empleado'
        AND eu.estado = 'activo'
    `, [empId]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// GET /uniformes/entregas/:id — detalle de una entrega
router.get("/uniformes/entregas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows: [eu] } = await pool.query(`
      SELECT eu.*, e.nombre_completo AS empleado_nombre, c.nombre AS cliente_nombre
      FROM entregas_uniforme eu
      JOIN employees e ON e.id = eu.employee_id
      LEFT JOIN clients c ON c.id = eu.cliente_id
      WHERE eu.id = $1
    `, [id]);
    if (!eu) return res.status(404).json({ error: "Entrega no encontrada" });
    const { rows: cuotas } = await pool.query(
      `SELECT *, monto::float AS monto FROM entregas_uniforme_cuotas WHERE entrega_id = $1 ORDER BY num_cuota`, [id]
    );
    res.json({ ...eu, cuotas });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// GET /uniformes/config-clientes — lista de clientes con su configuración de dotación
router.get("/uniformes/config-clientes", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre,
             COALESCE(dotacion_uniforme_num, 0)::int AS dotacion_uniforme_num,
             COALESCE(dotacion_uniforme_frecuencia_meses, 0)::int AS dotacion_uniforme_frecuencia_meses
      FROM clients ORDER BY nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener config de clientes" });
  }
});

// GET /uniformes/verificar-titular/:empId — verifica si un agente es titular en un puesto con dotación de cliente
router.get("/uniformes/verificar-titular/:empId", async (req, res) => {
  const empId = parseInt(req.params.empId);
  if (isNaN(empId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(`
      SELECT
        po.id AS puesto_id, po.nombre AS puesto_nombre,
        c.id  AS cliente_id, c.nombre AS cliente_nombre,
        COALESCE(c.dotacion_uniforme_num, 0)::int              AS dotacion_num,
        COALESCE(c.dotacion_uniforme_frecuencia_meses, 0)::int AS dotacion_frecuencia_meses
      FROM puestos_operativos po
      JOIN clients c ON c.portal_cliente_id = po.cliente_id OR c.id::text = po.cliente_id::text
      WHERE po.titular_employee_id = $1
        AND po.activo = TRUE
        AND COALESCE(c.dotacion_uniforme_num, 0) > 0
      LIMIT 1
    `, [empId]);
    if (rows.length > 0) {
      res.json({ es_titular_con_dotacion: true, ...rows[0] });
    } else {
      res.json({ es_titular_con_dotacion: false });
    }
  } catch (err) {
    logger.error({ err }, "GET /uniformes/verificar-titular/:empId");
    res.json({ es_titular_con_dotacion: false });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// REGISTRAR ENTREGA
// ══════════════════════════════════════════════════════════════════════════════

// POST /uniformes/entregas — registrar nueva entrega con cuotas
router.post("/uniformes/entregas", async (req, res) => {
  const {
    employee_id, articulo_id, nombre_articulo,
    tipo_cargo, cliente_id, puesto_id,
    monto_total, num_cuotas, notas,
  } = req.body;

  if (!employee_id || !nombre_articulo) {
    return res.status(400).json({ error: "employee_id y nombre_articulo son requeridos" });
  }
  if (!["cargo_empleado", "dotacion_cliente"].includes(tipo_cargo)) {
    return res.status(400).json({ error: "tipo_cargo debe ser 'cargo_empleado' o 'dotacion_cliente'" });
  }
  if (tipo_cargo === "cargo_empleado" && (!monto_total || monto_total <= 0)) {
    return res.status(400).json({ error: "monto_total requerido cuando tipo_cargo = cargo_empleado" });
  }

  const cuotas = Math.max(1, parseInt(num_cuotas) || 1);
  const monto = parseFloat(monto_total) || 0;
  const montoPorCuota = monto > 0 ? parseFloat((monto / cuotas).toFixed(2)) : 0;
  const registradoPor = getUser(req);

  try {
    const { rows: [entrega] } = await pool.query(`
      INSERT INTO entregas_uniforme
        (employee_id, articulo_id, nombre_articulo, tipo_cargo, cliente_id, puesto_id,
         monto_total, num_cuotas, cuotas_pagadas, estado, notas, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'activo',$9,$10)
      RETURNING id
    `, [
      employee_id, articulo_id || null, nombre_articulo,
      tipo_cargo, cliente_id || null, puesto_id || null,
      monto, cuotas, notas || null, registradoPor,
    ]);

    // Generar cuotas individuales (solo si es cargo_empleado con monto > 0)
    if (tipo_cargo === "cargo_empleado" && montoPorCuota > 0) {
      for (let i = 1; i <= cuotas; i++) {
        // Última cuota ajusta el redondeo
        const mCuota = i === cuotas
          ? parseFloat((monto - montoPorCuota * (cuotas - 1)).toFixed(2))
          : montoPorCuota;
        await pool.query(`
          INSERT INTO entregas_uniforme_cuotas (entrega_id, num_cuota, monto)
          VALUES ($1, $2, $3)
        `, [entrega.id, i, mCuota]);
      }
    }

    res.status(201).json({ ok: true, entrega_id: entrega.id });
  } catch (err) {
    logger.error({ err }, "POST /uniformes/entregas");
    res.status(500).json({ error: "Error al registrar entrega" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ACCIONES
// ══════════════════════════════════════════════════════════════════════════════

// PATCH /uniformes/entregas/:id/condonar — condonar saldo pendiente
router.patch("/uniformes/entregas/:id/condonar", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { notas } = req.body;
  try {
    await pool.query(
      `UPDATE entregas_uniforme SET estado='condonado', updated_at=NOW(), notas=COALESCE($1, notas) WHERE id=$2`,
      [notas || null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al condonar" });
  }
});

// PATCH /uniformes/entregas/:id/completar — marcar como completamente pagado
router.patch("/uniformes/entregas/:id/completar", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await pool.query(
      `UPDATE entregas_uniforme SET estado='pagado', updated_at=NOW() WHERE id=$1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al completar" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE DOTACIÓN POR CLIENTE (PATCH)
// ══════════════════════════════════════════════════════════════════════════════
router.patch("/uniformes/config-cliente/:clienteId", async (req, res) => {
  const clienteId = parseInt(req.params.clienteId);
  if (isNaN(clienteId)) return res.status(400).json({ error: "ID inválido" });
  const { dotacion_uniforme_num, dotacion_uniforme_frecuencia_meses } = req.body;
  try {
    await pool.query(`
      UPDATE clients
      SET dotacion_uniforme_num              = $1,
          dotacion_uniforme_frecuencia_meses = $2
      WHERE id = $3
    `, [
      parseInt(dotacion_uniforme_num) || 0,
      parseInt(dotacion_uniforme_frecuencia_meses) || 0,
      clienteId,
    ]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTADO INTERNO — para uso desde planilla.ts y prestaciones.ts
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Devuelve la siguiente cuota pendiente de cada empleado (tipo cargo_empleado, estado activo).
 * Retorna Map<employeeId, {cuotaId, monto}>.
 * Para usar ANTES de calcular las líneas de planilla.
 */
export async function buildUniformeCuotaMap(
  employeeIds: number[]
): Promise<Map<number, { cuotaId: number; monto: number }>> {
  const result = new Map<number, { cuotaId: number; monto: number }>();
  if (!employeeIds.length) return result;
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (eu.employee_id)
        eu.employee_id,
        euc.id   AS cuota_id,
        euc.monto::float AS monto
      FROM entregas_uniforme_cuotas euc
      JOIN entregas_uniforme eu ON eu.id = euc.entrega_id
      WHERE eu.employee_id = ANY($1::int[])
        AND euc.descontado = FALSE
        AND eu.tipo_cargo = 'cargo_empleado'
        AND eu.estado = 'activo'
      ORDER BY eu.employee_id, euc.num_cuota ASC
    `, [employeeIds]);

    for (const r of rows) {
      result.set(r.employee_id as number, {
        cuotaId: r.cuota_id as number,
        monto: r.monto as number,
      });
    }
  } catch (err) {
    logger.error({ err }, "buildUniformeCuotaMap: error (no bloqueante)");
  }
  return result;
}

/**
 * Marca una cuota como descontada y vincula a la planilla.
 * Actualiza cuotas_pagadas en entregas_uniforme.
 */
export async function descontarCuotaUniforme(
  cuotaId: number,
  planillaId: number
): Promise<void> {
  try {
    const { rows: [cuota] } = await pool.query(
      `UPDATE entregas_uniforme_cuotas
       SET descontado=TRUE, planilla_id=$1, fecha_descuento=NOW()::date
       WHERE id=$2 RETURNING entrega_id`,
      [planillaId, cuotaId]
    );
    if (cuota?.entrega_id) {
      // Incrementar cuotas_pagadas + verificar si está completamente pagado
      await pool.query(`
        UPDATE entregas_uniforme
        SET cuotas_pagadas = cuotas_pagadas + 1,
            estado = CASE WHEN cuotas_pagadas + 1 >= num_cuotas THEN 'pagado' ELSE estado END,
            updated_at = NOW()
        WHERE id = $1
      `, [cuota.entrega_id]);
    }
  } catch (err) {
    logger.error({ err }, `descontarCuotaUniforme: cuota ${cuotaId} — error (no bloqueante)`);
  }
}

/**
 * Suma del saldo pendiente de uniformes de un empleado (para liquidación).
 */
export async function getSaldoUniformePendiente(employeeId: number): Promise<number> {
  try {
    const { rows: [row] } = await pool.query(`
      SELECT COALESCE(SUM(euc.monto), 0)::float AS saldo
      FROM entregas_uniforme_cuotas euc
      JOIN entregas_uniforme eu ON eu.id = euc.entrega_id
      WHERE eu.employee_id = $1
        AND euc.descontado = FALSE
        AND eu.tipo_cargo = 'cargo_empleado'
        AND eu.estado = 'activo'
    `, [employeeId]);
    return row?.saldo ?? 0;
  } catch {
    return 0;
  }
}

export { router as uniformesRouter };
