import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const eventosRrhhRouter = Router();

// ─── GET /api/rrhh/eventos ────────────────────────────────────────────────────
// Lista todos los eventos RRHH, con filtros opcionales
eventosRrhhRouter.get("/rrhh/eventos", async (req, res) => {
  const { tipo, estado, empleado } = req.query;

  let where = "WHERE 1=1";
  const params: unknown[] = [];
  let idx = 1;

  if (tipo) { where += ` AND e.tipo_evento = $${idx++}`; params.push(tipo); }
  if (estado) { where += ` AND e.estado = $${idx++}`; params.push(estado); }
  if (empleado) {
    where += ` AND (LOWER(e.employee_nombre) LIKE $${idx++})`;
    params.push(`%${String(empleado).toLowerCase()}%`);
  }

  try {
    const { rows } = await pool.query(
      `SELECT e.*,
              emp.dpi        AS employee_dpi_db,
              emp.puesto     AS employee_puesto
       FROM eventos_rrhh e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       ${where}
       ORDER BY e.fecha DESC
       LIMIT 200`,
      params,
    );

    const eventos = rows.map((r) => ({
      ...r,
      employee_dpi: r.employee_dpi_db
        ? `****${String(r.employee_dpi_db).slice(-4)}`
        : r.employee_dpi,
    }));

    res.json(eventos);
  } catch (err) {
    logger.error({ err }, "GET /rrhh/eventos error");
    res.status(500).json({ error: "Error al obtener eventos RRHH" });
  }
});

// ─── GET /api/rrhh/eventos/:id ────────────────────────────────────────────────
eventosRrhhRouter.get("/rrhh/eventos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  try {
    const { rows } = await pool.query(
      `SELECT e.*,
              emp.dpi    AS employee_dpi_db,
              emp.puesto AS employee_puesto
       FROM eventos_rrhh e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.id = $1`,
      [id],
    );

    if (!rows.length) return res.status(404).json({ error: "Evento no encontrado" });

    const evento = {
      ...rows[0],
      employee_dpi: rows[0].employee_dpi_db
        ? `****${String(rows[0].employee_dpi_db).slice(-4)}`
        : rows[0].employee_dpi,
    };

    res.json(evento);
  } catch (err) {
    logger.error({ err }, "GET /rrhh/eventos/:id error");
    res.status(500).json({ error: "Error al obtener evento" });
  }
});

// ─── POST /api/rrhh/eventos ───────────────────────────────────────────────────
// Crear evento manualmente (o llamado internamente desde operaciones)
eventosRrhhRouter.post("/rrhh/eventos", async (req, res) => {
  const {
    employeeId,
    tipoEvento,
    clienteNombre,
    puestoNombre,
    supervisorNombre,
    generadoDesde,
    movimientoId,
    observaciones,
    notas,
    usuarioGenerador,
  } = req.body;

  if (!employeeId || !tipoEvento) {
    return res.status(400).json({ error: "employeeId y tipoEvento son requeridos" });
  }

  try {
    // Obtener datos del empleado
    const { rows: empRows } = await pool.query(
      `SELECT id, nombre_completo, dpi FROM employees WHERE id = $1`,
      [employeeId],
    );
    if (!empRows.length) return res.status(404).json({ error: "Empleado no encontrado" });
    const emp = empRows[0];

    const { rows } = await pool.query(
      `INSERT INTO eventos_rrhh
         (employee_id, employee_nombre, employee_dpi,
          tipo_evento, cliente_nombre, puesto_nombre,
          supervisor_nombre, generado_desde, movimiento_id,
          estado, observaciones, notas, usuario_generador,
          documentos_generados, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,$11,$12,'[]',NOW())
       RETURNING *`,
      [
        emp.id,
        emp.nombre_completo,
        emp.dpi || null,
        tipoEvento,
        clienteNombre || null,
        puestoNombre  || null,
        supervisorNombre || null,
        generadoDesde || "operaciones",
        movimientoId  || null,
        observaciones || null,
        notas         || null,
        usuarioGenerador || "sistema",
      ],
    );

    logger.info({ id: rows[0].id, tipo: tipoEvento }, "Evento RRHH creado");
    res.status(201).json({ ok: true, evento: rows[0] });
  } catch (err) {
    logger.error({ err }, "POST /rrhh/eventos error");
    res.status(500).json({ error: "Error al crear evento RRHH" });
  }
});

// ─── PATCH /api/rrhh/eventos/:id/estado ──────────────────────────────────────
eventosRrhhRouter.patch("/rrhh/eventos/:id/estado", async (req, res) => {
  const id = Number(req.params.id);
  const { estado, notas } = req.body;

  const VALID = ["pendiente", "en_proceso", "cerrado"];
  if (!VALID.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Válidos: ${VALID.join(", ")}` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE eventos_rrhh
       SET estado=$1, notas=COALESCE($2, notas), updated_at=NOW()
       WHERE id=$3
       RETURNING *`,
      [estado, notas || null, id],
    );

    if (!rows.length) return res.status(404).json({ error: "Evento no encontrado" });
    res.json({ ok: true, evento: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/eventos/:id/estado error");
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

// ─── PATCH /api/rrhh/eventos/:id/documentos ──────────────────────────────────
// Registrar que se generó un documento (para auditoría)
eventosRrhhRouter.patch("/rrhh/eventos/:id/documentos", async (req, res) => {
  const id = Number(req.params.id);
  const { tipo, usuario } = req.body; // tipo: 'boleta' | 'acta'

  if (!tipo) return res.status(400).json({ error: "tipo es requerido" });

  try {
    const entrada = {
      tipo,
      usuario: usuario || "sistema",
      fecha: new Date().toISOString(),
    };

    const { rows } = await pool.query(
      `UPDATE eventos_rrhh
       SET documentos_generados = documentos_generados || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify([entrada]), id],
    );

    if (!rows.length) return res.status(404).json({ error: "Evento no encontrado" });
    res.json({ ok: true, evento: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/eventos/:id/documentos error");
    res.status(500).json({ error: "Error al registrar documento" });
  }
});

// ─── GET /api/rrhh/stats ──────────────────────────────────────────────────────
eventosRrhhRouter.get("/rrhh/stats", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE estado = 'pendiente')                   AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'en_proceso')                  AS en_proceso,
        COUNT(*) FILTER (WHERE estado = 'cerrado')                     AS cerrados,
        COUNT(*) FILTER (WHERE tipo_evento = 'falta')                  AS faltas,
        COUNT(*) FILTER (WHERE tipo_evento = 'suspension')             AS suspensiones,
        COUNT(*) FILTER (WHERE fecha >= NOW() - INTERVAL '7 days')     AS ultimos_7_dias,
        COUNT(*) FILTER (WHERE fecha >= NOW() - INTERVAL '30 days')    AS ultimos_30_dias
      FROM eventos_rrhh
    `);
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /rrhh/stats error");
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});
