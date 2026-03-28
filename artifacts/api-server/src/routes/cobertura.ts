import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const coberturaRouter = Router();

// ─── GET /api/cobertura/diaria ────────────────────────────────────────────────
// Cobertura del día (o fecha específica), opcionalmente filtrada por cliente
coberturaRouter.get("/cobertura/diaria", async (req, res) => {
  try {
    const fecha     = (req.query.fecha as string)    || new Date().toISOString().split("T")[0];
    const clienteId = req.query.clienteId as string;

    let sql = `
      SELECT cd.*,
             et.nombre_completo AS titular_nombre_emp,
             et.telefono        AS titular_telefono,
             ec.nombre_completo AS cobertura_nombre_emp,
             ec.telefono        AS cobertura_telefono
      FROM cobertura_diaria cd
      LEFT JOIN employees et ON et.id = cd.titular_employee_id
      LEFT JOIN employees ec ON ec.id = cd.cobertura_employee_id
      WHERE cd.fecha = $1
    `;
    const params: any[] = [fecha];

    if (clienteId) {
      sql += ` AND cd.client_id = $2`;
      params.push(clienteId);
    }

    sql += ` ORDER BY cd.cliente_nombre, cd.puesto_nombre`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /cobertura/diaria error");
    res.status(500).json({ error: "Error al cargar cobertura diaria" });
  }
});

// ─── POST /api/cobertura/diaria ───────────────────────────────────────────────
// Registrar o actualizar cobertura para un puesto en una fecha
coberturaRouter.post("/cobertura/diaria", async (req, res) => {
  const {
    fecha, puestoId, clientId, sedeId, clienteNombre, puestoNombre,
    titularEmployeeId, titularNombre, coberturaEmployeeId, coberturaNombre,
    tipoCobertura, motivo, horasTrabajadas, horasExtra, observaciones, usuarioRegistro
  } = req.body;

  if (!fecha || !puestoId) return res.status(400).json({ error: "fecha y puestoId son requeridos" });

  try {
    // Upsert: si ya existe registro para ese puesto+fecha, actualiza
    const existing = await pool.query(
      `SELECT id FROM cobertura_diaria WHERE fecha = $1 AND puesto_id = $2`,
      [fecha, puestoId]
    );

    if (existing.rows.length > 0) {
      const { rows } = await pool.query(
        `UPDATE cobertura_diaria
         SET cobertura_employee_id = $1,
             cobertura_nombre      = $2,
             tipo_cobertura        = $3,
             motivo                = $4,
             horas_trabajadas      = $5,
             horas_extra           = $6,
             observaciones         = $7,
             usuario_registro      = $8,
             updated_at            = NOW()
         WHERE id = $9
         RETURNING *`,
        [coberturaEmployeeId ?? null, coberturaNombre ?? null,
         tipoCobertura || 'titular', motivo ?? null,
         horasTrabajadas ?? null, horasExtra ?? null,
         observaciones ?? null, usuarioRegistro ?? null, existing.rows[0].id]
      );
      return res.json(rows[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO cobertura_diaria
         (fecha, puesto_id, client_id, sede_id, cliente_nombre, puesto_nombre,
          titular_employee_id, titular_nombre, cobertura_employee_id, cobertura_nombre,
          tipo_cobertura, motivo, horas_trabajadas, horas_extra, observaciones, usuario_registro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [fecha, puestoId, clientId ?? null, sedeId ?? null, clienteNombre ?? null, puestoNombre ?? null,
       titularEmployeeId ?? null, titularNombre ?? null, coberturaEmployeeId ?? null, coberturaNombre ?? null,
       tipoCobertura || 'titular', motivo ?? null, horasTrabajadas ?? null, horasExtra ?? null,
       observaciones ?? null, usuarioRegistro ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /cobertura/diaria error");
    res.status(500).json({ error: "Error al registrar cobertura" });
  }
});

// ─── GET /api/cobertura/reporte ───────────────────────────────────────────────
// Reporte de cobertura para un rango de fechas
coberturaRouter.get("/cobertura/reporte", async (req, res) => {
  try {
    const desde     = (req.query.desde as string)    || new Date().toISOString().split("T")[0];
    const hasta     = (req.query.hasta as string)    || desde;
    const clienteId = req.query.clienteId as string;

    let sql = `
      SELECT
        cd.fecha,
        cd.cliente_nombre,
        cd.puesto_nombre,
        cd.titular_nombre,
        cd.cobertura_nombre,
        cd.tipo_cobertura,
        cd.motivo,
        cd.horas_trabajadas,
        cd.horas_extra,
        cd.observaciones,
        CASE WHEN cd.tipo_cobertura = 'ausencia_sin_cubrir' THEN TRUE ELSE FALSE END AS faltante,
        CASE WHEN cd.tipo_cobertura = 'relevo' THEN TRUE ELSE FALSE END AS hubo_relevo
      FROM cobertura_diaria cd
      WHERE cd.fecha BETWEEN $1 AND $2
    `;
    const params: any[] = [desde, hasta];

    if (clienteId) {
      sql += ` AND cd.client_id = $3`;
      params.push(clienteId);
    }

    sql += ` ORDER BY cd.fecha DESC, cd.cliente_nombre, cd.puesto_nombre`;

    const { rows } = await pool.query(sql, params);

    const resumen = {
      totalRegistros : rows.length,
      totalTitulares : rows.filter((r: any) => r.tipo_cobertura === 'titular').length,
      totalRelevos   : rows.filter((r: any) => r.tipo_cobertura === 'relevo').length,
      totalAusencias : rows.filter((r: any) => r.tipo_cobertura === 'ausencia_sin_cubrir').length,
      horasExtra     : rows.reduce((s: number, r: any) => s + parseFloat(r.horas_extra || 0), 0),
    };

    res.json({ reporte: rows, resumen });
  } catch (err) {
    logger.error({ err }, "GET /cobertura/reporte error");
    res.status(500).json({ error: "Error al generar reporte de cobertura" });
  }
});

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

/**
 * Convierte "HH:MM" a minutos desde medianoche.
 * Si hora_fin < hora_inicio → turno cruzó medianoche (+1440).
 */
function horaAMinutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

function calcularHoras(horaInicio: string, horaFin: string): number {
  let inicio = horaAMinutos(horaInicio);
  let fin    = horaAMinutos(horaFin);
  if (fin <= inicio) fin += 1440; // turno nocturno cruza medianoche
  return parseFloat(((fin - inicio) / 60).toFixed(2));
}

/** Verifica si un tramo [inicio, fin] solapa con la ventana de descanso del puesto */
function solapaCon(inicioSeg: string, finSeg: string, descInicio: string | null, descFin: string | null): boolean {
  if (!descInicio || !descFin) return false;
  const a1 = horaAMinutos(inicioSeg);
  let a2 = horaAMinutos(finSeg); if (a2 <= a1) a2 += 1440;
  const b1 = horaAMinutos(descInicio);
  let b2 = horaAMinutos(descFin); if (b2 <= b1) b2 += 1440;
  return a1 < b2 && a2 > b1;
}

// ─── GET /api/cobertura/segmentos ─────────────────────────────────────────────
// Tramos de cobertura para un puesto en una fecha (o todos los de un empleado en una fecha)
coberturaRouter.get("/cobertura/segmentos", async (req, res) => {
  try {
    const fecha      = (req.query.fecha as string) || new Date().toISOString().split("T")[0];
    const puestoId   = req.query.puestoId   as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    const clauses: string[] = ["cs.fecha = $1"];
    const params: unknown[] = [fecha];

    if (puestoId) {
      params.push(Number(puestoId));
      clauses.push(`cs.puesto_id = $${params.length}`);
    }
    if (employeeId) {
      params.push(Number(employeeId));
      clauses.push(`cs.employee_id = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT cs.*,
             e.nombre_completo AS empleado_nombre_join,
             po.nombre         AS puesto_nombre_join,
             po.hora_entrada, po.hora_salida,
             po.descanso_inicio, po.descanso_fin,
             po.elegible_horas_extra
      FROM cobertura_segmentos cs
      LEFT JOIN employees         e  ON e.id  = cs.employee_id
      LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY cs.hora_inicio NULLS LAST, cs.created_at
    `, params);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /cobertura/segmentos error");
    res.status(500).json({ error: "Error al cargar segmentos de cobertura" });
  }
});

// ─── Helper: sincroniza cobertura_diaria desde los segmentos registrados ────
// Llamado cada vez que se agrega o elimina un segmento, mantiene ambas tablas
// consistentes para que los reportes y la nómina usen la misma fuente de verdad.
async function syncCoberturaDesdeSegmentos(fecha: string, puestoId: number): Promise<void> {
  // 1. Traer todos los segmentos activos del puesto para esa fecha
  const { rows: segs } = await pool.query(
    `SELECT cs.*,
            po.cliente_id, po.sede_id,
            po.nombre AS puesto_nombre_po,
            po.titular_employee_id,
            c.nombre AS cliente_nombre_c
     FROM cobertura_segmentos cs
     LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
     LEFT JOIN clients            c  ON c.id  = po.cliente_id
     WHERE cs.fecha = $1 AND cs.puesto_id = $2
     ORDER BY cs.hora_inicio NULLS LAST`,
    [fecha, puestoId]
  );

  // 2. Si no quedan segmentos → borrar el registro de cobertura_diaria
  if (segs.length === 0) {
    await pool.query(
      `DELETE FROM cobertura_diaria WHERE fecha = $1 AND puesto_id = $2`,
      [fecha, puestoId]
    );
    return;
  }

  // 3. Calcular totales agregados
  const totalHoras = segs.reduce((s: number, r: any) => s + parseFloat(r.horas_calculadas ?? 0), 0);
  const totalHE    = segs.reduce((s: number, r: any) => s + (r.genera_horas_extra ? parseFloat(r.horas_calculadas ?? 0) : 0), 0);

  // Tipo de cobertura predominante: titular > relevo > otros
  const tipos = segs.map((s: any) => s.tipo_cobertura);
  let tipoPred = tipos.includes("titular") ? "titular"
               : tipos.includes("relevo")  ? "relevo"
               : tipos[0] ?? "relevo";

  // Empleado representativo: último segmento registrado (o el titular)
  const last    = segs[segs.length - 1];
  const first   = segs[0];
  const clientId     = last.cliente_id;
  const sedeId       = last.sede_id;
  const clienteNom   = last.cliente_nombre_c ?? last.empleado_nombre;
  const puestoNom    = last.puesto_nombre_po ?? last.empleado_nombre;
  const cobEmpId     = last.employee_id;
  const cobEmpNom    = last.empleado_nombre ?? null;
  const titEmpId     = first.titular_employee_id ?? null;

  // 4. Upsert en cobertura_diaria
  const existing = await pool.query(
    `SELECT id FROM cobertura_diaria WHERE fecha = $1 AND puesto_id = $2`,
    [fecha, puestoId]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE cobertura_diaria
       SET tipo_cobertura        = $1,
           cobertura_employee_id = $2,
           cobertura_nombre      = $3,
           horas_trabajadas      = $4,
           horas_extra           = $5,
           updated_at            = NOW()
       WHERE id = $6`,
      [tipoPred, cobEmpId, cobEmpNom,
       parseFloat(totalHoras.toFixed(2)),
       parseFloat(totalHE.toFixed(2)),
       existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO cobertura_diaria
         (fecha, puesto_id, client_id, sede_id, cliente_nombre, puesto_nombre,
          titular_employee_id, cobertura_employee_id, cobertura_nombre,
          tipo_cobertura, horas_trabajadas, horas_extra, usuario_registro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'sistema_segmentos')`,
      [fecha, puestoId, clientId ?? null, sedeId ?? null,
       clienteNom ?? null, puestoNom ?? null,
       titEmpId ?? null, cobEmpId, cobEmpNom,
       tipoPred,
       parseFloat(totalHoras.toFixed(2)),
       parseFloat(totalHE.toFixed(2))]
    );
  }
}

// ─── POST /api/cobertura/segmentos ────────────────────────────────────────────
// Registrar un nuevo tramo de cobertura con cálculo automático de horas
coberturaRouter.post("/cobertura/segmentos", async (req, res) => {
  const {
    fecha, puestoId, clientId, sedeId, employeeId, empleadoNombre,
    tipoCobertura, horaInicio, horaFin, motivo, observaciones, usuarioRegistro,
  } = req.body;

  if (!fecha || !puestoId || !employeeId) {
    return res.status(400).json({ error: "fecha, puestoId y employeeId son requeridos" });
  }

  try {
    // Obtener datos del puesto para validaciones
    const { rows: puestos } = await pool.query(
      `SELECT descanso_inicio, descanso_fin, elegible_horas_extra, hora_entrada, hora_salida
       FROM puestos_operativos WHERE id = $1`,
      [puestoId]
    );
    const puesto = puestos[0];

    // Calcular horas del tramo
    let horasCalculadas: number | null = null;
    let fueEnDiaDescanso = false;
    let generaHorasExtra = false;

    if (horaInicio && horaFin) {
      horasCalculadas = calcularHoras(horaInicio, horaFin);

      // Detectar solapamiento con descanso del puesto
      if (puesto?.descanso_inicio && puesto?.descanso_fin) {
        fueEnDiaDescanso = solapaCon(horaInicio, horaFin, puesto.descanso_inicio, puesto.descanso_fin);
      }

      // Detectar horas extra: si el tramo excede la jornada base del puesto (elegible_horas_extra)
      if (puesto?.elegible_horas_extra && puesto?.hora_entrada && puesto?.hora_salida) {
        const jornadaBase = calcularHoras(puesto.hora_entrada, puesto.hora_salida);
        // Se marcan HE si se está cubriendo en día de descanso del titular O si el tramo excede la jornada
        generaHorasExtra = fueEnDiaDescanso;
      }
    }

    const { rows } = await pool.query(`
      INSERT INTO cobertura_segmentos
        (fecha, puesto_id, client_id, sede_id, employee_id, empleado_nombre,
         tipo_cobertura, hora_inicio, hora_fin, horas_calculadas,
         motivo, fue_en_dia_descanso, genera_horas_extra, observaciones, usuario_registro)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      fecha, puestoId, clientId ?? null, sedeId ?? null, employeeId,
      empleadoNombre ?? null,
      tipoCobertura || 'relevo', horaInicio ?? null, horaFin ?? null,
      horasCalculadas, motivo ?? null, fueEnDiaDescanso, generaHorasExtra,
      observaciones ?? null, usuarioRegistro ?? null,
    ]);

    // C-02: sincronizar cobertura_diaria con el nuevo segmento
    try {
      await syncCoberturaDesdeSegmentos(fecha, Number(puestoId));
    } catch (syncErr) {
      logger.warn({ syncErr }, "POST /cobertura/segmentos — sync cobertura_diaria falló (no bloqueante)");
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /cobertura/segmentos error");
    res.status(500).json({ error: "Error al registrar segmento de cobertura" });
  }
});

// ─── DELETE /api/cobertura/segmentos/:id ──────────────────────────────────────
coberturaRouter.delete("/cobertura/segmentos/:id", async (req, res) => {
  try {
    // Obtener fecha y puestoId antes de borrar (para re-sync)
    const { rows: pre } = await pool.query(
      `SELECT fecha, puesto_id FROM cobertura_segmentos WHERE id = $1`,
      [req.params.id]
    );
    if (!pre.length) return res.status(404).json({ error: "Segmento no encontrado" });
    const { fecha, puesto_id } = pre[0];

    await pool.query(`DELETE FROM cobertura_segmentos WHERE id = $1`, [req.params.id]);

    // C-02: re-sincronizar cobertura_diaria (puede quedar vacío → borra registro)
    try {
      await syncCoberturaDesdeSegmentos(fecha, Number(puesto_id));
    } catch (syncErr) {
      logger.warn({ syncErr }, "DELETE /cobertura/segmentos — sync cobertura_diaria falló (no bloqueante)");
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /cobertura/segmentos error");
    res.status(500).json({ error: "Error al eliminar segmento" });
  }
});

export default coberturaRouter;
