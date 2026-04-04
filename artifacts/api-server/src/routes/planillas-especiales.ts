import { Router } from "express";
import { pool } from "@workspace/db";
import {
  calcularBono14,
  calcularAguinaldo,
  periodoBono14Guatemala,
  periodoAguinaldoGuatemala,
} from "../lib/prestaciones-calc";

export const planillasEspecialesRouter = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function getSession(req: import("express").Request): string {
  return (req.headers["x-isp-session"] as string) ?? "";
}

function getUsuario(session: string): string {
  if (!session) return "sistema";
  try {
    const parsed = JSON.parse(session);
    return parsed.nombre ?? parsed.username ?? "sistema";
  } catch {
    return "sistema";
  }
}

/** Queries all employees active at any point in [periodoInicio, periodoFin] */
async function getEmpleadosDelPeriodo(periodoInicio: string, periodoFin: string) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (e.id)
        e.id, e.nombre_completo,
        e.sueldo_base::numeric AS sueldo_base,
        e.fecha_ingreso::text AS fecha_ingreso,
        e.fecha_baja::text    AS fecha_baja,
        e.estado_laboral,
        COALESCE(po.puesto, e.puesto) AS puesto,
        COALESCE(cs.nombre, '')        AS sede,
        COALESCE(c.nombre, '')         AS cliente
     FROM employees e
     LEFT JOIN LATERAL (
       SELECT eoa.sede_id, eoa.cliente_id,
              (SELECT nombre FROM puestos_operativos WHERE id = eoa.puesto_id LIMIT 1) AS puesto
       FROM employee_operational_assignments eoa
       WHERE eoa.employee_id = e.id AND eoa.activa = TRUE
       ORDER BY eoa.updated_at DESC NULLS LAST
       LIMIT 1
     ) po ON TRUE
     LEFT JOIN client_sedes cs ON cs.id = po.sede_id
     LEFT JOIN clients      c  ON c.id  = po.cliente_id
     WHERE e.estado_laboral NOT IN ('candidato')
       AND e.fecha_ingreso <= $2::date
       AND (e.fecha_baja IS NULL OR e.fecha_baja >= $1::date)
     ORDER BY e.id, e.nombre_completo`,
    [periodoInicio, periodoFin]
  );
  return rows;
}

/** Core calculation: returns lineas for a given tipo/anio */
function calcularLineas(
  empleados: Record<string, unknown>[],
  tipo: "bono14" | "aguinaldo",
  anio: number
) {
  const { inicio: periodoInicio, fin: periodoFin } =
    tipo === "bono14"
      ? periodoBono14Guatemala(anio)
      : periodoAguinaldoGuatemala(anio);

  return empleados
    .map((e) => {
      const sueldo = parseFloat(String(e.sueldo_base ?? 0));
      const calcResult =
        tipo === "bono14"
          ? calcularBono14({
              sueldoMensual: sueldo,
              fechaIngreso:  String(e.fecha_ingreso),
              periodoInicio,
              periodoFin,
              fechaEgreso:   e.fecha_baja ? String(e.fecha_baja) : undefined,
            })
          : calcularAguinaldo({
              sueldoMensual: sueldo,
              fechaIngreso:  String(e.fecha_ingreso),
              periodoInicio,
              periodoFin,
              fechaEgreso:   e.fecha_baja ? String(e.fecha_baja) : undefined,
            });

      if (calcResult.diasLaborados <= 0) return null;

      return {
        employee_id:       e.id as number,
        nombre_completo:   String(e.nombre_completo),
        puesto:            String(e.puesto ?? ""),
        sede:              String(e.sede ?? ""),
        cliente:           String(e.cliente ?? ""),
        fecha_ingreso:     String(e.fecha_ingreso),
        fecha_egreso_emp:  e.fecha_baja ? String(e.fecha_baja) : null,
        estado_laboral:    String(e.estado_laboral),
        dias_periodo_total: calcResult.diasPeriodo,
        dias_laborados:    calcResult.diasLaborados,
        salario_referencia: calcResult.salarioReferencia,
        monto_total:       calcResult.montoTotal,
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof calcularLineas>[number]>[];
}

/** Split monto_total into N installments; last cuota absorbs rounding */
function calcularCuotas(
  totalBruto: number,
  numPagos: number
): { numero: number; porcentaje: number; monto: number }[] {
  if (numPagos === 1) return [{ numero: 1, porcentaje: 100, monto: totalBruto }];
  const base = Math.floor((100 / numPagos) * 100) / 100;
  const cuotas = Array.from({ length: numPagos }, (_, i) => ({
    numero:     i + 1,
    porcentaje: i < numPagos - 1 ? base : parseFloat((100 - base * (numPagos - 1)).toFixed(2)),
    monto:      0,
  }));
  let acum = 0;
  for (let i = 0; i < cuotas.length - 1; i++) {
    const m = Math.round(totalBruto * (cuotas[i].porcentaje / 100) * 100) / 100;
    cuotas[i].monto = m;
    acum += m;
  }
  cuotas[cuotas.length - 1].monto = Math.round((totalBruto - acum) * 100) / 100;
  return cuotas;
}

// ─── GET /nomina/planillas-especiales ─────────────────────────────────────────
planillasEspecialesRouter.get("/nomina/planillas-especiales", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pe.*,
             (SELECT COUNT(*) FROM planillas_especiales_pagos p
              WHERE p.planilla_especial_id = pe.id AND p.estado = 'pagado') AS pagos_realizados
      FROM planillas_especiales pe
      WHERE pe.estado != 'anulada'
      ORDER BY pe.anio DESC, pe.tipo DESC
    `);
    return res.json({ planillas: rows });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── GET /nomina/planillas-especiales/:id ─────────────────────────────────────
planillasEspecialesRouter.get("/nomina/planillas-especiales/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows: [pe] } = await pool.query(
      `SELECT * FROM planillas_especiales WHERE id = $1`, [id]
    );
    if (!pe) return res.status(404).json({ error: "Planilla especial no encontrada" });

    const { rows: lineas } = await pool.query(
      `SELECT * FROM planillas_especiales_lineas WHERE planilla_especial_id = $1 ORDER BY nombre_completo`,
      [id]
    );
    const { rows: pagos } = await pool.query(
      `SELECT * FROM planillas_especiales_pagos WHERE planilla_especial_id = $1 ORDER BY numero_pago`,
      [id]
    );

    return res.json({ planilla: pe, lineas, pagos });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── POST /nomina/planillas-especiales/preview ────────────────────────────────
planillasEspecialesRouter.post("/nomina/planillas-especiales/preview", async (req, res) => {
  try {
    const tipo: "bono14" | "aguinaldo" = req.body.tipo;
    const anio: number = parseInt(req.body.anio);
    const numPagos: number = Math.min(3, Math.max(1, parseInt(req.body.num_pagos ?? 1)));

    if (!["bono14", "aguinaldo"].includes(tipo)) {
      return res.status(400).json({ error: "tipo debe ser 'bono14' o 'aguinaldo'" });
    }

    const { inicio: periodoInicio, fin: periodoFin } =
      tipo === "bono14"
        ? periodoBono14Guatemala(anio)
        : periodoAguinaldoGuatemala(anio);

    const empleados = await getEmpleadosDelPeriodo(periodoInicio, periodoFin);
    const lineas    = calcularLineas(empleados, tipo, anio);
    const totalBruto = lineas.reduce((s, l) => s + l.monto_total, 0);
    const cuotas    = calcularCuotas(totalBruto, numPagos);

    return res.json({
      tipo,
      anio,
      periodo_inicio:       periodoInicio,
      periodo_fin:          periodoFin,
      num_pagos:            numPagos,
      total_colaboradores:  lineas.length,
      total_bruto:          parseFloat(totalBruto.toFixed(2)),
      cuotas,
      lineas,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── POST /nomina/planillas-especiales ────────────────────────────────────────
planillasEspecialesRouter.post("/nomina/planillas-especiales", async (req, res) => {
  const session   = getSession(req);
  const usuario   = getUsuario(session);
  const tipo: "bono14" | "aguinaldo" = req.body.tipo;
  const anio: number = parseInt(req.body.anio);
  const numPagos: number = Math.min(3, Math.max(1, parseInt(req.body.num_pagos ?? 1)));
  const observaciones: string | null = req.body.observaciones ?? null;

  // fechas_programadas: ["2025-12-15", "2026-01-15"] optional
  const fechasProgramadas: (string | null)[] = req.body.fechas_programadas ?? [];

  if (!["bono14", "aguinaldo"].includes(tipo)) {
    return res.status(400).json({ error: "tipo debe ser 'bono14' o 'aguinaldo'" });
  }

  const { inicio: periodoInicio, fin: periodoFin } =
    tipo === "bono14"
      ? periodoBono14Guatemala(anio)
      : periodoAguinaldoGuatemala(anio);

  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    // Check for existing active planilla of same tipo+anio
    const { rows: exist } = await db.query(
      `SELECT id FROM planillas_especiales WHERE tipo = $1 AND anio = $2 AND estado != 'anulada'`,
      [tipo, anio]
    );
    if (exist.length > 0) {
      await db.query("ROLLBACK");
      return res.status(409).json({
        error: `Ya existe una planilla de ${tipo} para el año ${anio}`,
        planilla_id: exist[0].id,
      });
    }

    const empleados  = await getEmpleadosDelPeriodo(periodoInicio, periodoFin);
    const lineas     = calcularLineas(empleados, tipo, anio);
    const totalBruto = parseFloat(lineas.reduce((s, l) => s + l.monto_total, 0).toFixed(2));
    const cuotas     = calcularCuotas(totalBruto, numPagos);

    // Insert header
    const { rows: [pe] } = await db.query<{ id: number }>(
      `INSERT INTO planillas_especiales
         (tipo, anio, periodo_inicio, periodo_fin, num_pagos, estado,
          total_colaboradores, total_bruto, generado_por, observaciones)
       VALUES ($1,$2,$3,$4,$5,'borrador',$6,$7,$8,$9)
       RETURNING id`,
      [tipo, anio, periodoInicio, periodoFin, numPagos,
       lineas.length, totalBruto, usuario, observaciones]
    );

    // Insert lineas
    for (const l of lineas) {
      await db.query(
        `INSERT INTO planillas_especiales_lineas
           (planilla_especial_id, employee_id, nombre_completo, puesto, sede, cliente,
            fecha_ingreso, fecha_egreso_emp, dias_periodo_total, dias_laborados,
            salario_referencia, monto_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [pe.id, l.employee_id, l.nombre_completo, l.puesto, l.sede, l.cliente,
         l.fecha_ingreso, l.fecha_egreso_emp,
         l.dias_periodo_total, l.dias_laborados, l.salario_referencia, l.monto_total]
      );
    }

    // Insert pagos (installments)
    for (const c of cuotas) {
      await db.query(
        `INSERT INTO planillas_especiales_pagos
           (planilla_especial_id, numero_pago, porcentaje, fecha_programada, total_este_pago)
         VALUES ($1,$2,$3,$4,$5)`,
        [pe.id, c.numero, c.porcentaje,
         fechasProgramadas[c.numero - 1] ?? null, c.monto]
      );
    }

    await db.query("COMMIT");
    return res.status(201).json({ id: pe.id, mensaje: "Planilla especial generada correctamente" });
  } catch (err) {
    await db.query("ROLLBACK");
    return res.status(500).json({ error: String(err) });
  } finally {
    db.release();
  }
});

// ─── PATCH /nomina/planillas-especiales/:id/estado ────────────────────────────
planillasEspecialesRouter.patch("/nomina/planillas-especiales/:id/estado", async (req, res) => {
  try {
    const id    = parseInt(req.params.id);
    const nuevoEstado: string = req.body.estado;

    const allowed = ["aprobada", "anulada"];
    if (!allowed.includes(nuevoEstado)) {
      return res.status(400).json({ error: `Estado inválido. Permitidos: ${allowed.join(", ")}` });
    }

    const { rows: [pe] } = await pool.query(
      `SELECT estado FROM planillas_especiales WHERE id = $1`, [id]
    );
    if (!pe) return res.status(404).json({ error: "Planilla especial no encontrada" });
    if (pe.estado === "completada") {
      return res.status(409).json({ error: "No se puede modificar una planilla completada" });
    }
    if (pe.estado === "anulada") {
      return res.status(409).json({ error: "La planilla ya está anulada" });
    }

    await pool.query(
      `UPDATE planillas_especiales SET estado = $1, updated_at = NOW() WHERE id = $2`,
      [nuevoEstado, id]
    );
    return res.json({ mensaje: `Planilla actualizada a estado '${nuevoEstado}'` });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── PATCH /nomina/planillas-especiales/pagos/:pagoId/pagar ───────────────────
planillasEspecialesRouter.patch(
  "/nomina/planillas-especiales/pagos/:pagoId/pagar",
  async (req, res) => {
    const session = getSession(req);
    const usuario = getUsuario(session);
    const pagoId  = parseInt(req.params.pagoId);

    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      const { rows: [pago] } = await db.query(
        `SELECT p.*, pe.estado AS planilla_estado, pe.tipo, pe.anio
         FROM planillas_especiales_pagos p
         JOIN planillas_especiales pe ON pe.id = p.planilla_especial_id
         WHERE p.id = $1`,
        [pagoId]
      );
      if (!pago) {
        await db.query("ROLLBACK");
        return res.status(404).json({ error: "Pago no encontrado" });
      }
      if (pago.estado === "pagado") {
        await db.query("ROLLBACK");
        return res.status(409).json({ error: "Este pago ya fue registrado" });
      }
      if (!["borrador", "aprobada"].includes(pago.planilla_estado)) {
        await db.query("ROLLBACK");
        return res.status(409).json({
          error: `La planilla debe estar en estado 'aprobada' o 'borrador' para registrar pagos`,
        });
      }

      // Mark pago as paid
      await db.query(
        `UPDATE planillas_especiales_pagos
         SET estado = 'pagado', pagado_por = $1, pagado_at = NOW(), updated_at = NOW(),
             observaciones = COALESCE($2, observaciones)
         WHERE id = $3`,
        [usuario, req.body.observaciones ?? null, pagoId]
      );

      // Update monto_ya_pagado on each linea proportionally
      const porcentaje = parseFloat(pago.porcentaje);
      await db.query(
        `UPDATE planillas_especiales_lineas
         SET monto_ya_pagado = ROUND(monto_ya_pagado + (monto_total * $1 / 100.0), 2)
         WHERE planilla_especial_id = $2`,
        [porcentaje, pago.planilla_especial_id]
      );

      // Check if all pagos are now paid → mark planilla as completada
      const { rows: pendientes } = await db.query(
        `SELECT COUNT(*) AS cnt FROM planillas_especiales_pagos
         WHERE planilla_especial_id = $1 AND estado = 'pendiente'`,
        [pago.planilla_especial_id]
      );
      if (parseInt(pendientes[0].cnt) === 0) {
        await db.query(
          `UPDATE planillas_especiales SET estado = 'completada', updated_at = NOW() WHERE id = $1`,
          [pago.planilla_especial_id]
        );
      }

      await db.query("COMMIT");
      return res.json({ mensaje: "Pago registrado correctamente" });
    } catch (err) {
      await db.query("ROLLBACK");
      return res.status(500).json({ error: String(err) });
    } finally {
      db.release();
    }
  }
);

// ─── DELETE /nomina/planillas-especiales/:id ──────────────────────────────────
planillasEspecialesRouter.delete("/nomina/planillas-especiales/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows: [pe] } = await pool.query(
      `SELECT estado FROM planillas_especiales WHERE id = $1`, [id]
    );
    if (!pe) return res.status(404).json({ error: "Planilla especial no encontrada" });
    if (pe.estado === "completada") {
      return res.status(409).json({ error: "No se puede anular una planilla completada" });
    }

    await pool.query(
      `UPDATE planillas_especiales SET estado = 'anulada', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return res.json({ mensaje: "Planilla especial anulada correctamente" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── GET /nomina/planillas-especiales/pagos-empleado/:employeeId ──────────────
// Used by liquidaciones to know how much has been paid per tipo/anio
planillasEspecialesRouter.get(
  "/nomina/planillas-especiales/pagos-empleado/:employeeId",
  async (req, res) => {
    try {
      const empId = parseInt(req.params.employeeId);
      const { rows } = await pool.query(
        `SELECT pe.tipo, pe.anio, pe.periodo_inicio, pe.periodo_fin,
                l.monto_total, l.monto_ya_pagado
         FROM planillas_especiales_lineas l
         JOIN planillas_especiales pe ON pe.id = l.planilla_especial_id
         WHERE l.employee_id = $1
           AND pe.estado != 'anulada'
           AND l.monto_ya_pagado > 0
         ORDER BY pe.anio DESC, pe.tipo`,
        [empId]
      );
      return res.json({ pagos: rows });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }
);
