/**
 * prestaciones.ts — API de Prestaciones Laborales (Guatemala)
 *
 * Endpoints:
 *   GET  /api/prestaciones/config                              → leer configuración global/cliente
 *   PUT  /api/prestaciones/config                              → actualizar configuración
 *   GET  /api/prestaciones/acumulados/:employeeId              → acumulados del colaborador
 *   GET  /api/prestaciones/vacaciones/saldo/:employeeId        → saldo de vacaciones
 *   POST /api/prestaciones/vacaciones/movimiento               → registrar movimiento de vacaciones
 *   POST /api/prestaciones/provisionar                         → generar provisiones por período
 *   GET  /api/prestaciones/provisiones                         → consultar provisiones (filtros)
 *   POST /api/prestaciones/simular-liquidacion                 → simulación sin persistir
 *   POST /api/prestaciones/liquidaciones                       → ejecutar liquidación confirmada
 *   GET  /api/prestaciones/liquidaciones/:id                   → detalle de liquidación
 *   GET  /api/prestaciones/liquidaciones                       → lista de liquidaciones
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { getSaldoUniformePendiente } from "./uniformes";
import {
  calcularAguinaldo,
  calcularBono14,
  calcularIndemnizacion,
  calcularLiquidacionFinal,
  calcularProvisionPeriodo,
  calcularVacacionesPago,
  calcularVacacionesDevengadas,
  diasEntreFechas,
  periodoAguinaldoGuatemala,
  periodoBono14Guatemala,
  type CausalEgreso,
  type PrestacionesConfig,
  CONFIG_DEFAULT,
} from "../lib/prestaciones-calc";

export const prestacionesRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function r2(n: number) { return parseFloat(n.toFixed(2)); }

// ─── GET /api/prestaciones/config ─────────────────────────────────────────────
prestacionesRouter.get("/prestaciones/config", async (req, res) => {
  try {
    const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
    const q = clientId
      ? await pool.query(`SELECT * FROM prestaciones_config WHERE client_id = $1 AND activo = TRUE LIMIT 1`, [clientId])
      : await pool.query(`SELECT * FROM prestaciones_config WHERE client_id IS NULL AND activo = TRUE LIMIT 1`);

    if (q.rows.length === 0) {
      return res.json({ config: CONFIG_DEFAULT, source: "default" });
    }

    const row = q.rows[0];
    const config: PrestacionesConfig = {
      aguinaldoBase:              row.aguinaldo_base,
      bono14Base:                 row.bono14_base,
      vacacionesDiasPrimerAnio:   row.vacaciones_dias_primer_anio,
      vacacionesDiasQuinquenio:   row.vacaciones_dias_quinquenio,
      vacacionesDiasElegibilidad: row.vacaciones_dias_elegibilidad,
      indemnizacionSoloLegal:     row.indemnizacion_solo_legal,
      redondeoDecimales:          row.redondeo_decimales,
    };
    return res.json({ config, source: "db", id: row.id });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── PUT /api/prestaciones/config ─────────────────────────────────────────────
prestacionesRouter.put("/prestaciones/config", async (req, res) => {
  try {
    const body = req.body;
    const clientId = body.client_id ?? null;

    // Upsert manual: check si ya existe config para este client_id
    const existQ = clientId
      ? await pool.query(`SELECT id FROM prestaciones_config WHERE client_id = $1 AND activo = TRUE LIMIT 1`, [clientId])
      : await pool.query(`SELECT id FROM prestaciones_config WHERE client_id IS NULL AND activo = TRUE LIMIT 1`);

    const params = [
      body.aguinaldo_base ?? "salario_actual",
      body.bono14_base ?? "promedio_periodo",
      body.vacaciones_dias_primer_anio ?? 15,
      body.vacaciones_dias_quinquenio  ?? 20,
      body.vacaciones_dias_elegibilidad ?? 150,
      body.indemnizacion_solo_legal ?? true,
      body.redondeo_decimales ?? 2,
    ];

    if (existQ.rows.length > 0) {
      await pool.query(
        `UPDATE prestaciones_config SET
           aguinaldo_base              = $1,
           bono14_base                 = $2,
           vacaciones_dias_primer_anio = $3,
           vacaciones_dias_quinquenio  = $4,
           vacaciones_dias_elegibilidad= $5,
           indemnizacion_solo_legal    = $6,
           redondeo_decimales          = $7,
           updated_at                  = NOW()
         WHERE id = $8`,
        [...params, existQ.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO prestaciones_config (
           client_id, aguinaldo_base, bono14_base,
           vacaciones_dias_primer_anio, vacaciones_dias_quinquenio, vacaciones_dias_elegibilidad,
           indemnizacion_solo_legal, redondeo_decimales, activo
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
        [clientId, ...params]
      );
    }

    return res.json({ ok: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/prestaciones/vacaciones/saldo/:employeeId ───────────────────────
prestacionesRouter.get("/prestaciones/vacaciones/saldo/:employeeId", async (req, res) => {
  try {
    const empId = parseInt(req.params.employeeId);
    const { rows } = await pool.query(
      `SELECT vs.*, e.nombre_completo, e.fecha_ingreso, e.sueldo_base
       FROM vacaciones_saldos vs
       JOIN employees e ON e.id = vs.employee_id
       WHERE vs.employee_id = $1`,
      [empId]
    );

    if (rows.length === 0) {
      // Inicializar saldo si no existe
      const { rows: emp } = await pool.query(
        `SELECT id, nombre_completo, fecha_ingreso, sueldo_base FROM employees WHERE id = $1`, [empId]
      );
      if (emp.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });
      return res.json({
        employee_id: empId,
        nombre_completo: emp[0].nombre_completo,
        dias_ganados: 0,
        dias_gozados: 0,
        dias_disponibles: 0,
        dias_pendientes_pago: 0,
        inicializado: false,
      });
    }

    return res.json(rows[0]);
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/prestaciones/vacaciones/movimiento ─────────────────────────────
prestacionesRouter.post("/prestaciones/vacaciones/movimiento", async (req, res) => {
  try {
    const { employee_id, tipo, dias, fecha, periodo_inicio, periodo_fin, observaciones } = req.body;
    if (!employee_id || !tipo || !dias || !fecha) {
      return res.status(400).json({ error: "employee_id, tipo, dias y fecha son requeridos" });
    }

    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      // Insertar movimiento
      await db.query(
        `INSERT INTO vacaciones_movimientos (employee_id, tipo, dias, fecha, periodo_inicio, periodo_fin, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [employee_id, tipo, dias, fecha, periodo_inicio ?? null, periodo_fin ?? null, observaciones ?? null]
      );

      // Actualizar saldo
      const deltaGanadas = tipo === "ganadas" ? parseFloat(dias) : 0;
      const deltaGozadas = tipo === "gozadas" ? parseFloat(dias) : 0;

      await db.query(
        `INSERT INTO vacaciones_saldos (employee_id, dias_ganados, dias_gozados, dias_disponibles, fecha_ultima_actualizacion)
         VALUES ($1, $2::numeric, $3::numeric, GREATEST(0::numeric, $2::numeric - $3::numeric), NOW())
         ON CONFLICT (employee_id) DO UPDATE SET
           dias_ganados    = vacaciones_saldos.dias_ganados    + $2::numeric,
           dias_gozados    = vacaciones_saldos.dias_gozados    + $3::numeric,
           dias_disponibles= GREATEST(0::numeric, vacaciones_saldos.dias_ganados + $2::numeric - (vacaciones_saldos.dias_gozados + $3::numeric)),
           fecha_ultima_actualizacion = NOW()`,
        [employee_id, deltaGanadas, deltaGozadas]
      );

      await db.query("COMMIT");
      return res.json({ ok: true });
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/prestaciones/acumulados/:employeeId ─────────────────────────────
prestacionesRouter.get("/prestaciones/acumulados/:employeeId", async (req, res) => {
  try {
    const empId = parseInt(req.params.employeeId);
    const { rows } = await pool.query(
      `SELECT pa.*, e.nombre_completo FROM prestaciones_acumulados pa
       JOIN employees e ON e.id = pa.employee_id
       WHERE pa.employee_id = $1 ORDER BY pa.tipo, pa.anio DESC`,
      [empId]
    );
    return res.json({ rows, total: rows.length });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/prestaciones/provisionar ───────────────────────────────────────
prestacionesRouter.post("/prestaciones/provisionar", async (req, res) => {
  try {
    const { periodo_desde, periodo_hasta, tipos, client_id, sede, employee_ids } = req.body;
    if (!periodo_desde || !periodo_hasta) {
      return res.status(400).json({ error: "periodo_desde y periodo_hasta requeridos" });
    }

    const diasPeriodo = diasEntreFechas(periodo_desde, periodo_hasta);
    const tiposCalc: Array<"aguinaldo" | "bono14" | "vacaciones" | "indemnizacion"> =
      tipos ?? ["aguinaldo", "bono14", "vacaciones", "indemnizacion"];

    // Obtener empleados del período
    let empQuery = `SELECT e.id, e.nombre_completo, e.sueldo_base, e.sede, e.puesto,
                           e.fecha_ingreso, e.frecuencia_pago, e.estado_laboral,
                           COALESCE(e.cliente_id, 0) AS client_id
                    FROM employees e
                    WHERE e.estado_laboral = 'activo'`;
    const params: unknown[] = [];
    let pIdx = 1;

    if (client_id) {
      empQuery += ` AND e.cliente_id = $${pIdx++}`;
      params.push(client_id);
    }
    if (sede) {
      empQuery += ` AND e.sede = $${pIdx++}`;
      params.push(sede);
    }
    if (employee_ids?.length) {
      empQuery += ` AND e.id = ANY($${pIdx++})`;
      params.push(employee_ids);
    }

    const { rows: empleados } = await pool.query(empQuery, params);

    const provisiones: Record<string, unknown>[] = [];
    const errors: string[] = [];

    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      for (const emp of empleados) {
        const sueldo = parseFloat(emp.sueldo_base);
        if (!isFinite(sueldo) || sueldo <= 0) continue;
        // Años de servicio para tasa de vacaciones
        const fechaIngreso = new Date(emp.fecha_ingreso);
        const hoy = new Date(periodo_hasta);
        const aniosServ = Math.max(0, hoy.getUTCFullYear() - fechaIngreso.getUTCFullYear());

        for (const tipo of tiposCalc) {
          try {
            const result = calcularProvisionPeriodo({
              sueldoMensual: sueldo,
              diasPeriodo,
              tipo,
              aniosServicio: aniosServ,
            });

            await db.query(
              `INSERT INTO prestaciones_provisiones
                 (periodo_desde, periodo_hasta, tipo, employee_id, empleado_nombre, sede, puesto,
                  client_id, dias_periodo, salario_referencia, monto_provision, generado_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
               ON CONFLICT (periodo_desde, periodo_hasta, tipo, employee_id) DO UPDATE SET
                 monto_provision    = EXCLUDED.monto_provision,
                 salario_referencia = EXCLUDED.salario_referencia,
                 dias_periodo       = EXCLUDED.dias_periodo,
                 generado_at        = NOW()`,
              [
                periodo_desde, periodo_hasta, tipo, emp.id, emp.nombre_completo,
                emp.sede ?? null, emp.puesto ?? null, emp.client_id,
                diasPeriodo, sueldo, result.montoProvision,
              ]
            );

            // Insertar movimiento de provisión
            await db.query(
              `INSERT INTO prestaciones_movimientos
                 (employee_id, empleado_nombre, tipo_prestacion, subtipo,
                  periodo_inicio, periodo_fin, fecha_calculo,
                  monto, dias_base, salario_referencia, base_calculo,
                  origen, observaciones, version_calculo)
               VALUES ($1,$2,$3,'provision',$4,$5,$6::date,$7,$8,$9,$10,'provision_periodica',null,1)`,
              [
                emp.id, emp.nombre_completo, tipo,
                periodo_desde, periodo_hasta, periodo_hasta,
                result.montoProvision, diasPeriodo, sueldo, result.baseCalculo,
              ]
            );

            provisiones.push({ employee_id: emp.id, tipo, monto: result.montoProvision });
          } catch (err) {
            errors.push(`${emp.nombre_completo}/${tipo}: ${String(err)}`);
          }
        }
      }

      await db.query("COMMIT");
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }

    const totalPorTipo: Record<string, number> = {};
    for (const p of provisiones) {
      const key = p.tipo as string;
      const monto = p.monto as number;
      if (!isFinite(monto)) continue;
      totalPorTipo[key] = r2((totalPorTipo[key] ?? 0) + monto);
    }

    return res.json({
      ok: true,
      periodo: { desde: periodo_desde, hasta: periodo_hasta, dias: diasPeriodo },
      empleados_procesados: empleados.length,
      provisiones_generadas: provisiones.length,
      total_por_tipo: totalPorTipo,
      total_general: r2(Object.values(totalPorTipo).reduce((a, b) => a + b, 0)),
      errores: errors,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/prestaciones/provisiones ────────────────────────────────────────
prestacionesRouter.get("/prestaciones/provisiones", async (req, res) => {
  try {
    const { periodo_desde, periodo_hasta, tipo, employee_id, sede, client_id, agrupar_por } = req.query;

    let q = `SELECT pp.*, e.sueldo_base, e.fecha_ingreso
             FROM prestaciones_provisiones pp
             JOIN employees e ON e.id = pp.employee_id
             WHERE 1=1`;
    const params: unknown[] = [];
    let pIdx = 1;

    // Solapamiento: muestra provisiones cuyo período se cruza con el rango consultado
    if (periodo_desde) { q += ` AND pp.periodo_hasta >= $${pIdx++}`; params.push(periodo_desde); }
    if (periodo_hasta) { q += ` AND pp.periodo_desde <= $${pIdx++}`; params.push(periodo_hasta); }
    if (tipo)         { q += ` AND pp.tipo = $${pIdx++}`;           params.push(tipo); }
    if (employee_id)  { q += ` AND pp.employee_id = $${pIdx++}`;    params.push(parseInt(employee_id as string)); }
    if (sede)         { q += ` AND pp.sede = $${pIdx++}`;           params.push(sede); }
    if (client_id)    { q += ` AND pp.client_id = $${pIdx++}`;      params.push(parseInt(client_id as string)); }

    q += ` ORDER BY pp.periodo_desde DESC, pp.tipo, pp.empleado_nombre`;

    const { rows } = await pool.query(q, params);

    // Totales por tipo — parseFloat puede devolver NaN si monto_provision es null
    const totalPorTipo: Record<string, number> = {};
    for (const row of rows) {
      const monto = parseFloat(row.monto_provision) || 0;
      totalPorTipo[row.tipo] = r2((totalPorTipo[row.tipo] ?? 0) + monto);
    }

    return res.json({
      rows,
      total: rows.length,
      total_por_tipo: totalPorTipo,
      total_general: r2(Object.values(totalPorTipo).reduce((a, b) => a + b, 0)),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Función interna para calcular liquidación completa ───────────────────────
async function buildLiquidacion(empId: number, body: Record<string, unknown>) {
  const { rows: emp } = await pool.query(
    `SELECT e.id, e.nombre_completo, e.fecha_ingreso, e.sueldo_base,
            COALESCE(e.frecuencia_pago, 'quincenal') AS frecuencia_pago
     FROM employees e WHERE e.id = $1`,
    [empId]
  );
  if (emp.length === 0) throw new Error("Empleado no encontrado");

  if (!emp[0].fecha_ingreso)
    throw new Error("El colaborador no tiene fecha de ingreso registrada. Actualice la ficha antes de calcular la liquidación.");
  if (!emp[0].sueldo_base || isNaN(parseFloat(emp[0].sueldo_base)) || parseFloat(emp[0].sueldo_base) <= 0)
    throw new Error("El colaborador no tiene sueldo base configurado. Actualice la ficha antes de calcular la liquidación.");

  const { rows: vacSaldo } = await pool.query(
    `SELECT dias_disponibles FROM vacaciones_saldos WHERE employee_id = $1`, [empId]
  );

  const fechaEgreso  = body.fecha_egreso as string;
  const causal       = (body.causal_egreso ?? body.tipo_egreso ?? "renuncia") as CausalEgreso;
  const fechaIngreso = emp[0].fecha_ingreso.toISOString().slice(0, 10);
  const sueldo       = parseFloat(emp[0].sueldo_base);

  // Determinar período de aguinaldo y Bono 14
  const anoPago       = new Date(fechaEgreso).getUTCFullYear();
  const aguPeriodo    = periodoAguinaldoGuatemala(anoPago);
  const b14Periodo    = periodoBono14Guatemala(anoPago);
  const diasPendiente = parseFloat(String(body.dias_salario_pendiente ?? 0));
  const diasVac       = parseFloat(String(vacSaldo[0]?.dias_disponibles ?? body.dias_vacaciones_pendientes ?? 0));

  const result = calcularLiquidacionFinal({
    sueldoMensual:            sueldo,
    promedioUltimos6Meses:    body.promedio_ultimos_6_meses ? parseFloat(String(body.promedio_ultimos_6_meses)) : undefined,
    fechaIngreso,
    fechaEgreso,
    causalEgreso:             causal,
    diasSalarioPendiente:     diasPendiente,
    diasVacacionesPendientes: diasVac,
    periodoAguinaldoInicio:   body.periodo_aguinaldo_inicio as string ?? aguPeriodo.inicio,
    periodoAguinaldoFin:      body.periodo_aguinaldo_fin   as string ?? aguPeriodo.fin,
    periodoBono14Inicio:      body.periodo_bono14_inicio   as string ?? b14Periodo.inicio,
    periodoBono14Fin:         body.periodo_bono14_fin      as string ?? b14Periodo.fin,
  });

  // ── Descontar pagos ya realizados vía planillas especiales ───────────────────
  const { rows: pagosEsp } = await pool.query(
    `SELECT pe.tipo, l.monto_ya_pagado::numeric AS monto_ya_pagado
     FROM planillas_especiales_lineas l
     JOIN planillas_especiales pe ON pe.id = l.planilla_especial_id
     WHERE l.employee_id = $1
       AND pe.estado != 'anulada'
       AND l.monto_ya_pagado > 0
       AND (
         (pe.tipo = 'aguinaldo' AND pe.anio = $2) OR
         (pe.tipo = 'bono14'    AND pe.anio = $2)
       )`,
    [empId, anoPago]
  );

  const aguinaldoYaPagado = pagosEsp
    .filter((r) => r.tipo === "aguinaldo")
    .reduce((s, r) => s + parseFloat(r.monto_ya_pagado), 0);
  const bono14YaPagado = pagosEsp
    .filter((r) => r.tipo === "bono14")
    .reduce((s, r) => s + parseFloat(r.monto_ya_pagado), 0);

  if (aguinaldoYaPagado > 0) {
    result.rubros.push({
      rubro:             "descuento_aguinaldo_pagado",
      descripcion:       `Aguinaldo ${anoPago} ya cancelado vía planilla especial`,
      salarioReferencia: result.sueldoMensual,
      monto:             parseFloat((-aguinaldoYaPagado).toFixed(2)),
      baseCalculo:       JSON.stringify({ planilla_especial: true, ya_pagado: aguinaldoYaPagado }),
    });
    result.totalAguinaldo = Math.max(
      0, parseFloat((result.totalAguinaldo - aguinaldoYaPagado).toFixed(2))
    );
  }
  if (bono14YaPagado > 0) {
    result.rubros.push({
      rubro:             "descuento_bono14_pagado",
      descripcion:       `Bono 14 ${anoPago} ya cancelado vía planilla especial`,
      salarioReferencia: result.sueldoMensual,
      monto:             parseFloat((-bono14YaPagado).toFixed(2)),
      baseCalculo:       JSON.stringify({ planilla_especial: true, ya_pagado: bono14YaPagado }),
    });
    result.totalBono14 = Math.max(
      0, parseFloat((result.totalBono14 - bono14YaPagado).toFixed(2))
    );
  }
  if (aguinaldoYaPagado > 0 || bono14YaPagado > 0) {
    result.totalGeneral = parseFloat((
      result.totalSalarioPendiente +
      result.totalVacaciones +
      result.totalAguinaldo +
      result.totalBono14 +
      result.totalIndemnizacion
    ).toFixed(2));
  }

  // ── Verificar recuperación de vacaciones anticipadas ─────────────────────────
  // Si el empleado gozó más días de los que ganó proporcionalmente hasta el egreso
  // se genera un rubro negativo para recuperar la diferencia.
  const { rows: vacProrataRows } = await pool.query(`
    WITH srv AS (
      SELECT
        ($2::date - fecha_ingreso::date)::int AS dias_servicio,
        EXTRACT(YEAR FROM AGE($2::date, fecha_ingreso::date))::int AS anios_servicio
      FROM employees WHERE id = $1
    ),
    autorizados AS (
      SELECT COALESCE(SUM(
        (SELECT COUNT(*)::int
         FROM generate_series(er.fecha::date, COALESCE(er.fecha_fin::date, er.fecha::date), '1 day'::interval) g(d)
         WHERE EXTRACT(DOW FROM g.d) != 0)
      ), 0) AS total
      FROM eventos_rrhh er
      WHERE er.employee_id = $1
        AND er.tipo_evento IN ('vacaciones', 'vacaciones_programadas')
        AND er.estado NOT IN ('anulado', 'cancelado')
        AND er.fecha::date <= $2::date
    )
    SELECT
      ROUND(
        (dias_servicio::numeric / 365.0) *
        CASE WHEN anios_servicio >= 5 THEN 20 ELSE 15 END,
        2
      ) AS dias_ganados_proporcional,
      a.total AS dias_autorizados
    FROM srv, autorizados a
  `, [empId, fechaEgreso]);

  const diasGanadosProporcional = parseFloat(String(vacProrataRows[0]?.dias_ganados_proporcional ?? 0));
  const diasAutorizadosTotal    = parseInt(String(vacProrataRows[0]?.dias_autorizados ?? 0));

  if (diasAutorizadosTotal > diasGanadosProporcional) {
    const diasRecuperar    = parseFloat((diasAutorizadosTotal - diasGanadosProporcional).toFixed(2));
    const montoRecuperacion = parseFloat((diasRecuperar * (sueldo / 30)).toFixed(2));
    result.rubros.push({
      rubro:             "recuperacion_vacaciones_anticipadas",
      descripcion:       `Recuperación vacaciones anticipadas: gozó ${diasAutorizadosTotal} día(s), ganó ${diasGanadosProporcional} proporcional`,
      salarioReferencia: sueldo,
      monto:             -montoRecuperacion,
      baseCalculo:       JSON.stringify({
        dias_autorizados:        diasAutorizadosTotal,
        dias_ganados_proporcional: diasGanadosProporcional,
        dias_a_recuperar:         diasRecuperar,
        tasa_diaria:              parseFloat((sueldo / 30).toFixed(2)),
      }),
    });
    // Restar del total de vacaciones (si quedaba algo) y recalcular total general
    result.totalVacaciones  = Math.max(0, parseFloat((result.totalVacaciones - montoRecuperacion).toFixed(2)));
    result.totalGeneral     = parseFloat((
      result.totalSalarioPendiente +
      result.totalVacaciones +
      result.totalAguinaldo +
      result.totalBono14 +
      result.totalIndemnizacion
    ).toFixed(2));
  }

  // ── Saldo pendiente de uniformes / dotación ──────────────────────────────────
  // Cuotas no descontadas en planilla = rubro negativo en la liquidación.
  const saldoUniforme = await getSaldoUniformePendiente(empId);
  if (saldoUniforme > 0) {
    result.rubros.push({
      rubro:             "descuento_uniforme_pendiente",
      descripcion:       `Saldo pendiente de cobro de uniformes/botas (cuotas no descontadas en planilla)`,
      salarioReferencia: sueldo,
      monto:             parseFloat((-saldoUniforme).toFixed(2)),
      baseCalculo:       JSON.stringify({ saldo_uniforme_pendiente: saldoUniforme }),
    });
    result.totalGeneral = parseFloat((result.totalGeneral - saldoUniforme).toFixed(2));
  }

  // ── Saldo pendiente de anticipos ──────────────────────────────────────────
  // Anticipos aprobados con cuotas de planilla aún no descontadas → rubro negativo.
  const { rows: anticRows } = await pool.query<{ saldo_total: string; anticipos_count: string }>(`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN cuota_monto IS NOT NULL
            THEN (COALESCE(num_cuotas,1) - COALESCE(cuotas_pagadas,0))::numeric * cuota_monto
          ELSE
            GREATEST(0, COALESCE(monto_cobro, cantidad * 1.1)
              - COALESCE(cuotas_pagadas,0) * COALESCE(cuota_monto, monto_cobro, cantidad * 1.1))
        END
      ), 0)::float AS saldo_total,
      COUNT(*)::int AS anticipos_count
    FROM anticipos
    WHERE employee_id = $1
      AND estado = 'aprobada'
      AND COALESCE(cuotas_pagadas, 0) < COALESCE(num_cuotas, 1)
  `, [empId]);

  const saldoAnticipo = parseFloat(anticRows[0]?.saldo_total ?? "0");
  const anticiposPendientes = parseInt(String(anticRows[0]?.anticipos_count ?? "0"));

  if (saldoAnticipo > 0) {
    result.rubros.push({
      rubro:             "descuento_anticipo_pendiente",
      descripcion:       `Anticipo(s) pendiente(s) de cobro: ${anticiposPendientes} solicitud(es) — cuotas no descontadas`,
      salarioReferencia: sueldo,
      monto:             parseFloat((-saldoAnticipo).toFixed(2)),
      baseCalculo:       JSON.stringify({ anticipos_pendientes: anticiposPendientes, saldo_anticipo: saldoAnticipo }),
    });
    result.totalGeneral = parseFloat((result.totalGeneral - saldoAnticipo).toFixed(2));
  }

  return { emp: emp[0], result, fechaEgreso, causal, diasVac, aguinaldoYaPagado, bono14YaPagado,
           diasGanadosProporcional, diasAutorizadosTotal, saldoUniforme, saldoAnticipo, anticiposPendientes };
}

// ─── POST /api/prestaciones/simular-liquidacion ───────────────────────────────
prestacionesRouter.post("/prestaciones/simular-liquidacion", async (req, res) => {
  try {
    const empId = parseInt(req.body.employee_id);
    const { emp, result, aguinaldoYaPagado, bono14YaPagado } = await buildLiquidacion(empId, req.body);
    return res.json({
      simulacion:           true,
      employee_id:          empId,
      nombre_completo:      emp.nombre_completo,
      liquidacion:          result,
      aguinaldo_ya_pagado:  aguinaldoYaPagado,
      bono14_ya_pagado:     bono14YaPagado,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/prestaciones/liquidaciones ─────────────────────────────────────
prestacionesRouter.post("/prestaciones/liquidaciones", async (req, res) => {
  try {
    const empId = parseInt(req.body.employee_id);
    const { emp, result, fechaEgreso, causal, diasVac } = await buildLiquidacion(empId, req.body);

    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      // Verificar que no exista liquidación activa para el mismo egreso
      const { rows: exist } = await db.query(
        `SELECT id FROM prestaciones_liquidaciones
         WHERE employee_id = $1 AND fecha_egreso = $2 AND estado != 'anulada'`,
        [empId, fechaEgreso]
      );
      if (exist.length > 0) {
        await db.query("ROLLBACK");
        return res.status(409).json({
          error: "Ya existe una liquidación activa para este colaborador y fecha de egreso",
          liquidacion_id: exist[0].id,
        });
      }

      // Insertar encabezado
      const { rows: [liq] } = await db.query<{ id: number }>(
        `INSERT INTO prestaciones_liquidaciones (
           employee_id, empleado_nombre, fecha_egreso, causal_egreso,
           fecha_ingreso, anios_servicio, dias_servicio, salario_actual,
           total_salario_pendiente, total_vacaciones, total_aguinaldo,
           total_bono14, total_indemnizacion, total_general,
           estado, simulacion, observaciones
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'confirmada',false,$15)
         RETURNING id`,
        [
          empId, emp.nombre_completo, fechaEgreso, causal,
          result.fechaIngreso, result.aniosServicio, result.diasServicio, result.sueldoMensual,
          result.totalSalarioPendiente, result.totalVacaciones, result.totalAguinaldo,
          result.totalBono14, result.totalIndemnizacion, result.totalGeneral,
          req.body.observaciones ?? null,
        ]
      );

      // Insertar detalle por rubro
      for (const rubro of result.rubros) {
        await db.query(
          `INSERT INTO prestaciones_liquidacion_detalle
             (liquidacion_id, rubro, descripcion, periodo_inicio, periodo_fin,
              dias_base, salario_referencia, monto, base_calculo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            liq.id, rubro.rubro, rubro.descripcion,
            null, null,
            rubro.diasBase ?? null,
            rubro.salarioReferencia, rubro.monto,
            rubro.baseCalculo,
          ]
        );
      }

      // Descontar vacaciones gozadas del saldo
      if (diasVac > 0) {
        await db.query(
          `UPDATE vacaciones_saldos SET
             dias_pendientes_pago  = dias_pendientes_pago + $1,
             dias_disponibles      = GREATEST(0, dias_disponibles - $1),
             fecha_ultima_actualizacion = NOW()
           WHERE employee_id = $2`,
          [diasVac, empId]
        );
      }

      // Marcar anticipos pendientes como saldados por liquidación
      await db.query(
        `UPDATE anticipos
         SET estado       = 'pagada',
             observaciones = COALESCE(observaciones || ' | ', '') ||
                             'Saldo descontado de liquidación — baja ' || $1
         WHERE employee_id = $2
           AND estado = 'aprobada'
           AND COALESCE(cuotas_pagadas, 0) < COALESCE(num_cuotas, 1)`,
        [fechaEgreso, empId]
      );

      // Marcar al empleado como dado de baja
      await db.query(
        `UPDATE employees SET
           estado_laboral = 'baja',
           fecha_baja     = $1,
           motivo_baja    = $2
         WHERE id = $3`,
        [fechaEgreso, causal, empId]
      );

      await db.query("COMMIT");
      return res.status(201).json({ ok: true, liquidacion_id: liq.id, liquidacion: result });
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/prestaciones/liquidaciones ──────────────────────────────────────
prestacionesRouter.get("/prestaciones/liquidaciones", async (req, res) => {
  try {
    const { employee_id, estado, limit: lim } = req.query;
    let q = `SELECT pl.*, e.nombre_completo AS empleado
             FROM prestaciones_liquidaciones pl
             JOIN employees e ON e.id = pl.employee_id
             WHERE 1=1`;
    const params: unknown[] = [];
    let pIdx = 1;

    if (employee_id) { q += ` AND pl.employee_id = $${pIdx++}`; params.push(parseInt(employee_id as string)); }
    if (estado)      { q += ` AND pl.estado = $${pIdx++}`;       params.push(estado); }
    q += ` ORDER BY pl.created_at DESC`;
    if (lim)         { q += ` LIMIT $${pIdx++}`;                 params.push(parseInt(lim as string)); }

    const { rows } = await pool.query(q, params);
    return res.json({ rows, total: rows.length });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/prestaciones/liquidaciones/:id ──────────────────────────────────
prestacionesRouter.get("/prestaciones/liquidaciones/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows: [liq] } = await pool.query(
      `SELECT pl.*, e.nombre_completo FROM prestaciones_liquidaciones pl
       JOIN employees e ON e.id = pl.employee_id WHERE pl.id = $1`, [id]
    );
    if (!liq) return res.status(404).json({ error: "Liquidación no encontrada" });

    const { rows: detalle } = await pool.query(
      `SELECT * FROM prestaciones_liquidacion_detalle WHERE liquidacion_id = $1 ORDER BY id`, [id]
    );

    return res.json({ liquidacion: liq, detalle });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── PATCH /api/prestaciones/liquidaciones/:id/anular ─────────────────────────
prestacionesRouter.patch("/prestaciones/liquidaciones/:id/anular", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const id = parseInt(req.params.id);

    // Marcar liquidación como anulada y obtener el employee_id
    const { rows } = await client.query(
      `UPDATE prestaciones_liquidaciones
          SET estado = 'anulada', updated_at = NOW()
        WHERE id = $1 AND estado != 'anulada'
        RETURNING id, employee_id`, [id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Liquidación no encontrada o ya anulada" });
    }

    const employeeId = rows[0].employee_id;

    // Reactivar al empleado: estado activo, limpiar fecha_baja y motivo_baja
    await client.query(
      `UPDATE employees
          SET estado_laboral = 'activo',
              fecha_baja     = NULL,
              motivo_baja    = NULL,
              updated_at     = NOW()
        WHERE id = $1`, [employeeId]
    );

    await client.query("COMMIT");
    return res.json({ ok: true, id, employeeId, reactivado: true });
  } catch (err: unknown) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: String(err) });
  } finally {
    client.release();
  }
});

// ─── GET /api/prestaciones/movimientos/:employeeId ────────────────────────────
prestacionesRouter.get("/prestaciones/movimientos/:employeeId", async (req, res) => {
  try {
    const empId = parseInt(req.params.employeeId);
    const { tipo } = req.query;
    let q = `SELECT * FROM prestaciones_movimientos WHERE employee_id = $1`;
    const params: unknown[] = [empId];
    if (tipo) { q += ` AND tipo_prestacion = $2`; params.push(tipo); }
    q += ` ORDER BY created_at DESC LIMIT 100`;
    const { rows } = await pool.query(q, params);
    return res.json({ rows, total: rows.length });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/prestaciones/calcular (simulación individual sin persistir) ────
prestacionesRouter.post("/prestaciones/calcular", async (req, res) => {
  try {
    const {
      tipo, employee_id,
      sueldo_mensual, promedio_salario,
      fecha_ingreso, periodo_inicio, periodo_fin, fecha_egreso,
      causal_egreso, dias_vacaciones,
    } = req.body;

    let empSueldo = sueldo_mensual;
    let empIngreso = fecha_ingreso;
    if (employee_id && !sueldo_mensual) {
      const { rows } = await pool.query(`SELECT sueldo_base, fecha_ingreso FROM employees WHERE id = $1`, [employee_id]);
      if (rows.length) {
        empSueldo = parseFloat(rows[0].sueldo_base);
        empIngreso = rows[0].fecha_ingreso.toISOString().slice(0, 10);
      }
    }

    let result: unknown;
    switch (tipo) {
      case "aguinaldo":
        result = calcularAguinaldo({ sueldoMensual: empSueldo, promedioSalario: promedio_salario, fechaIngreso: empIngreso, periodoInicio: periodo_inicio, periodoFin: periodo_fin, fechaEgreso: fecha_egreso });
        break;
      case "bono14":
        result = calcularBono14({ sueldoMensual: empSueldo, promedioSalario: promedio_salario, fechaIngreso: empIngreso, periodoInicio: periodo_inicio, periodoFin: periodo_fin, fechaEgreso: fecha_egreso });
        break;
      case "indemnizacion":
        result = calcularIndemnizacion({ sueldoMensual: empSueldo, fechaIngreso: empIngreso, fechaEgreso: fecha_egreso, causalEgreso: causal_egreso });
        break;
      case "vacaciones_pago":
        result = calcularVacacionesPago({ sueldoMensual: empSueldo, diasVacaciones: parseFloat(dias_vacaciones) });
        break;
      default:
        return res.status(400).json({ error: `tipo desconocido: ${tipo}` });
    }

    return res.json({ ok: true, tipo, resultado: result });
  } catch (err: unknown) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Importar dbo_DetallePrestaciones (ODBC histórico por empleado) ──────────
prestacionesRouter.post("/prestaciones/importar-detalle-odbc", async (req, res) => {
  try {
    interface DPRow {
      empl_numero: number; pre_ano: number; pre_mes: number; pla_numero?: number;
      dias_lab?: number; pro_bono14?: number; pro_aguinaldo?: number;
      pro_vacaciones?: number; pro_indemnizacion?: number;
      base_bono14?: number; base_aguinaldo?: number; base_vacas?: number; base_indem?: number;
    }
    const rows: DPRow[] = req.body.rows ?? [];
    if (!rows.length) return res.status(400).json({ error: "Sin filas" });

    let insertadas = 0; let actualizadas = 0; let errores = 0;
    for (const r of rows) {
      if (!r.empl_numero || !r.pre_ano || !r.pre_mes) { errores++; continue; }
      try {
        const result = await pool.query(`
          INSERT INTO detalle_prestaciones_odbc
            (empl_numero, pre_ano, pre_mes, pla_numero, dias_lab,
             pro_bono14, pro_aguinaldo, pro_vacaciones, pro_indemnizacion,
             base_bono14, base_aguinaldo, base_vacas, base_indem)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (empl_numero, pre_ano, pre_mes, pla_numero) DO UPDATE SET
            dias_lab          = EXCLUDED.dias_lab,
            pro_bono14        = EXCLUDED.pro_bono14,
            pro_aguinaldo     = EXCLUDED.pro_aguinaldo,
            pro_vacaciones    = EXCLUDED.pro_vacaciones,
            pro_indemnizacion = EXCLUDED.pro_indemnizacion,
            base_bono14       = EXCLUDED.base_bono14,
            base_aguinaldo    = EXCLUDED.base_aguinaldo,
            base_vacas        = EXCLUDED.base_vacas,
            base_indem        = EXCLUDED.base_indem,
            importado_at      = NOW()
          RETURNING (xmax = 0) as inserted
        `, [
          r.empl_numero, r.pre_ano, r.pre_mes, r.pla_numero ?? 1, r.dias_lab ?? 0,
          r.pro_bono14 ?? 0, r.pro_aguinaldo ?? 0, r.pro_vacaciones ?? 0, r.pro_indemnizacion ?? 0,
          r.base_bono14 ?? 0, r.base_aguinaldo ?? 0, r.base_vacas ?? 0, r.base_indem ?? 0,
        ]);
        if (result.rows[0]?.inserted) insertadas++; else actualizadas++;
      } catch { errores++; }
    }
    return res.json({ ok: true, total: rows.length, insertadas, actualizadas, errores });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ─── Resumen acumulado por empleado desde detalle_prestaciones_odbc ──────────
prestacionesRouter.get("/prestaciones/resumen-odbc", async (req, res) => {
  try {
    // Totales en BD
    const totRow = await pool.query(`
      SELECT COUNT(DISTINCT empl_numero) as empleados,
        SUM(pro_bono14) as bono14, SUM(pro_aguinaldo) as aguinaldo,
        SUM(pro_vacaciones) as vacaciones, SUM(pro_indemnizacion) as indem,
        MIN(pre_ano*100+pre_mes) as periodo_min, MAX(pre_ano*100+pre_mes) as periodo_max,
        COUNT(*) as filas
      FROM detalle_prestaciones_odbc
    `);

    // Por empleado — join con employees para nombre
    const rows = await pool.query(`
      SELECT
        d.empl_numero,
        e.nombre_completo,
        e.fecha_ingreso,
        e.fecha_baja,
        e.sueldo_base,
        SUM(d.pro_bono14)        AS total_bono14,
        SUM(d.pro_aguinaldo)     AS total_aguinaldo,
        SUM(d.pro_vacaciones)    AS total_vacaciones,
        SUM(d.pro_indemnizacion) AS total_indem,
        SUM(d.dias_lab)          AS dias_laborados,
        MAX(d.base_bono14)       AS base_bono14_ult,
        MAX(d.base_vacas)        AS base_vacas_ult,
        COUNT(DISTINCT d.pre_ano*100+d.pre_mes) AS periodos_con_data
      FROM detalle_prestaciones_odbc d
      LEFT JOIN employees e ON e.empl_numero = d.empl_numero
      GROUP BY d.empl_numero, e.nombre_completo, e.fecha_ingreso, e.fecha_baja, e.sueldo_base
      ORDER BY e.nombre_completo NULLS LAST
    `);

    return res.json({
      ok: true,
      resumen: totRow.rows[0],
      empleados: rows.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
