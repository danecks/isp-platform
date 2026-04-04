import { Router } from "express";
import { pool } from "@workspace/db";

export const libroSalariosRouter = Router();

const COLS = `
  p.id               AS planilla_id,
  p.periodo_desde::text,
  p.periodo_hasta::text,
  p.estado           AS planilla_estado,
  p.generado_por,
  pl.id              AS linea_id,
  pl.employee_id,
  pl.nombre_completo,
  pl.dpi,
  pl.puesto,
  pl.sede,
  pl.cliente,
  pl.frecuencia_pago,
  pl.sueldo_base,
  pl.periodo_dias,
  pl.dias_trabajados,
  pl.faltas,
  pl.suspensiones,
  pl.horas_extra,
  pl.sueldo_periodo,
  pl.desc_faltas,
  pl.valor_he,
  COALESCE(pl.bonificacion_incentivo, 0) AS bonificacion_incentivo,
  COALESCE(pl.desc_septimo, 0)           AS desc_septimo,
  pl.total_bruto,
  COALESCE(pl.igss_trabajador, 0)        AS igss_trabajador,
  pl.anticipos,
  COALESCE(pl.otros_descuentos, 0)       AS otros_descuentos,
  pl.total_neto
`;

// ── GET /api/libro-salarios/empleados ─────────────────────────────────────────
// Lista de empleados que tienen al menos una línea de planilla (para el dropdown)
libroSalariosRouter.get("/libro-salarios/empleados", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT pl.employee_id AS id, MIN(pl.nombre_completo) AS nombre_completo
      FROM planilla_lineas pl
      WHERE pl.employee_id IS NOT NULL
      GROUP BY pl.employee_id
      ORDER BY MIN(pl.nombre_completo)
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/general ───────────────────────────────────────────
// Todas las nóminas de un mes/año dados, todas las líneas agrupadas por planilla
libroSalariosRouter.get("/libro-salarios/general", async (req, res, next) => {
  try {
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
    const mes  = parseInt(req.query.mes  as string) || new Date().getMonth() + 1;

    const { rows } = await pool.query(`
      SELECT ${COLS}
      FROM planillas p
      JOIN planilla_lineas pl ON pl.planilla_id = p.id
      WHERE
        EXTRACT(YEAR  FROM p.periodo_desde) = $1
        AND EXTRACT(MONTH FROM p.periodo_desde) = $2
        AND (p.anulada IS NULL OR p.anulada = FALSE)
      ORDER BY p.periodo_desde, p.periodo_hasta, pl.nombre_completo
    `, [anio, mes]);

    res.json({ rows, anio, mes });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/colaborador/:id ───────────────────────────────────
// Historial completo de nóminas de un colaborador, filtrado por rango de fechas
libroSalariosRouter.get("/libro-salarios/colaborador/:id", async (req, res, next) => {
  try {
    const empId = parseInt(req.params.id);
    const desde = (req.query.desde as string) || `${new Date().getFullYear()}-01-01`;
    const hasta = (req.query.hasta as string) || `${new Date().getFullYear()}-12-31`;

    const [lineasResult, empResult] = await Promise.all([
      pool.query(`
        SELECT ${COLS}
        FROM planillas p
        JOIN planilla_lineas pl ON pl.planilla_id = p.id
        WHERE
          pl.employee_id = $1
          AND p.periodo_desde >= $2::date
          AND p.periodo_hasta <= $3::date
          AND (p.anulada IS NULL OR p.anulada = FALSE)
        ORDER BY p.periodo_desde DESC
      `, [empId, desde, hasta]),
      pool.query(`
        SELECT id, nombre_completo, dpi, puesto
        FROM employees WHERE id = $1
      `, [empId]),
    ]);

    res.json({
      rows:     lineasResult.rows,
      empleado: empResult.rows[0] ?? null,
      desde,
      hasta,
    });
  } catch (err) {
    next(err);
  }
});
