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

export default coberturaRouter;
